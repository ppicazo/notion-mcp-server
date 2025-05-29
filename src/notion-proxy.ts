/**
 * Notion MCP Proxy - Simplified implementation following Playwright MCP pattern
 */

import { CallToolRequest, Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { JSONSchema7 as IJsonSchema } from 'json-schema'
import { OpenAPIToMCPConverter } from './openapi-mcp-server/openapi/parser.js'
import { HttpClient, HttpClientError } from './openapi-mcp-server/client/http-client.js'
import { OpenAPIV3 } from 'openapi-types'
import { AsyncLocalStorage } from 'async_hooks'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'

type PathItemObject = OpenAPIV3.PathItemObject & {
  get?: OpenAPIV3.OperationObject
  put?: OpenAPIV3.OperationObject
  post?: OpenAPIV3.OperationObject
  delete?: OpenAPIV3.OperationObject
  patch?: OpenAPIV3.OperationObject
}

type NewToolDefinition = {
  methods: Array<{
    name: string
    description: string
    inputSchema: IJsonSchema & { type: 'object' }
    returnSchema?: IJsonSchema
  }>
}

export class NotionMCPProxy {
  private httpClient: HttpClient
  private tools: Record<string, NewToolDefinition>
  private openApiLookup: Record<string, OpenAPIV3.OperationObject & { method: string; path: string }>
  private authStorage: AsyncLocalStorage<Record<string, string>>
  private server: Server

  constructor(openApiSpec: OpenAPIV3.Document, authStorage?: AsyncLocalStorage<Record<string, string>>) {
    this.authStorage = authStorage || new AsyncLocalStorage<Record<string, string>>()
    
    // Create MCP server
    this.server = new Server({ name: 'notion-mcp-server', version: '1.0.0' }, { capabilities: { tools: {} } })
    
    const baseUrl = openApiSpec.servers?.[0].url
    if (!baseUrl) {
      throw new Error('No base URL found in OpenAPI spec')
    }
    
    this.httpClient = new HttpClient(
      {
        baseUrl,
        headers: this.parseHeadersFromEnv(),
      },
      openApiSpec,
    )

    // Convert OpenAPI spec to MCP tools
    const converter = new OpenAPIToMCPConverter(openApiSpec)
    const { tools, openApiLookup } = converter.convertToMCPTools()
    this.tools = tools
    this.openApiLookup = openApiLookup
    
    // Add comprehensive logging for debugging
    console.log('🔧 NotionMCPProxy initialized')
    console.log('📋 Available tools:', Object.keys(this.tools))
    console.log('🔍 OpenAPI lookup keys:', Object.keys(this.openApiLookup))
    
    // Log all tool methods and their names
    Object.entries(this.tools).forEach(([toolKey, toolDef]) => {
      console.log(`📦 Tool "${toolKey}" has ${toolDef.methods.length} methods:`)
      toolDef.methods.forEach(method => {
        console.log(`  - ${method.name}: ${method.description}`)
      })
    })
  }

  /**
   * List all available tools
   */
  async listTools(): Promise<{ tools: Tool[] }> {
    const tools = Object.values(this.tools).flatMap(toolDef =>
      toolDef.methods.map(method => ({
        name: this.truncateToolName(method.name),
        description: method.description,
        inputSchema: method.inputSchema as Tool['inputSchema']
      }))
    )

    console.log('📋 listTools() called, returning', tools.length, 'tools:')
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`)
    })

    return { tools }
  }

  /**
   * Call a tool with the given parameters
   */
  async callTool(request: CallToolRequest['params']): Promise<CallToolResult> {
    const { name, arguments: params } = request

    console.log('🔧 callTool() called with name:', name)
    console.log('🔍 Available lookup keys:', Object.keys(this.openApiLookup))
    console.log('🎯 Looking for operation:', name)

    // Find the operation in OpenAPI spec
    const operation = this.findOperation(name)
    if (!operation) {
      console.error('❌ Method not found:', name)
      console.error('💡 Available operations:')
      Object.keys(this.openApiLookup).forEach(key => {
        console.error(`  - ${key}`)
      })
      throw new Error(`Method ${name} not found`)
    }

    console.log('✅ Found operation:', operation.method.toUpperCase(), operation.path)

    try {
      // Get dynamic authentication headers from async local storage
      const dynamicHeaders = this.authStorage.getStore() || {}
      
      // Merge with environment-based headers (dynamic headers take precedence)
      const authHeaders = {
        ...this.parseHeadersFromEnv(),
        ...dynamicHeaders
      }

      console.log('🔐 Auth headers for API call:', authHeaders)

      // Execute the operation with dynamic headers
      const response = await this.httpClient.executeOperation(operation, params, authHeaders)

      // Convert response to MCP format
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data),
          },
        ],
      }
    } catch (error) {
      console.error('Error in tool call', error)
      if (error instanceof HttpClientError) {
        console.error('HttpClientError encountered, returning structured error', error)
        const data = error.data?.response?.data ?? error.data ?? {}
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'error',
                ...(typeof data === 'object' ? data : { data: data }),
              }),
            },
          ],
        }
      }
      throw error
    }
  }

  private findOperation(operationId: string): (OpenAPIV3.OperationObject & { method: string; path: string }) | null {
    console.log('🔍 findOperation called with:', operationId)
    
    // Try direct lookup first
    let operation = this.openApiLookup[operationId] ?? null
    if (operation) {
      console.log('✅ Direct lookup found:', operationId)
      return operation
    }
    
    // Try with API- prefix
    const withPrefix = `API-${operationId}`
    operation = this.openApiLookup[withPrefix] ?? null
    if (operation) {
      console.log('✅ Lookup with API- prefix found:', withPrefix)
      return operation
    }
    
    // Try without API- prefix if provided
    if (operationId.startsWith('API-')) {
      const withoutPrefix = operationId.substring(4)
      operation = this.openApiLookup[withoutPrefix] ?? null
      if (operation) {
        console.log('✅ Lookup without API- prefix found:', withoutPrefix)
        return operation
      }
    }
    
    console.log('❌ No operation found for:', operationId)
    return null
  }

  private parseHeadersFromEnv(): Record<string, string> {
    const headersJson = process.env.OPENAPI_MCP_HEADERS
    if (!headersJson) {
      return {}
    }

    try {
      const headers = JSON.parse(headersJson)
      if (typeof headers !== 'object' || headers === null) {
        console.warn('OPENAPI_MCP_HEADERS environment variable must be a JSON object, got:', typeof headers)
        return {}
      }
      return headers
    } catch (error) {
      console.warn('Failed to parse OPENAPI_MCP_HEADERS environment variable:', error)
      return {}
    }
  }

  private truncateToolName(name: string): string {
    if (name.length <= 64) {
      return name
    }
    return name.slice(0, 64)
  }

  /**
   * Connect to a transport (for compatibility with original MCPProxy)
   */
  async connect(transport: Transport): Promise<void> {
    // For the new pattern, we don't use the Server.connect method
    // The transport will be handled by the HTTP server directly
    await Promise.resolve()
  }

  /**
   * Get the server instance (for compatibility with original MCPProxy)
   */
  getServer(): Server {
    return this.server
  }
}
