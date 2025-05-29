#!/usr/bin/env tsx

/**
 * HTTP Server for Notion MCP - Based on Playwright MCP pattern
 */

import path from 'node:path'
import { fileURLToPath } from 'url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { startHttpTransport, authStorage } from '../src/transport.js'
import { initProxy, ValidationError } from '../src/init-server.js'

async function createServer(): Promise<Server> {
  const filename = fileURLToPath(import.meta.url)
  const directory = path.dirname(filename)
  const specPath = path.resolve(directory, '../scripts/notion-openapi.json')
  const baseUrl = process.env.BASE_URL ?? undefined

  // Initialize the Notion MCP proxy with auth storage
  const proxy = await initProxy(specPath, baseUrl, authStorage)

  // Create MCP Server
  const server = new Server(
    { name: 'notion-mcp-server', version: '1.8.1' },
    { capabilities: { tools: {} } }
  )

  // Set up tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return await proxy.listTools()
  })

  // Set up tool calling with authentication context
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await proxy.callTool(request.params)
  })

  return server
}

export async function startHttpServer(port: number = 3000) {
  console.log('Starting Notion MCP HTTP Server...')
  
  try {
    const server = await createServer()
    const httpServer = startHttpTransport(server, port, "0.0.0.0")
    
    // Graceful shutdown
    const handleShutdown = async () => {
      console.log('\nShutting down server...')
      httpServer.close(() => {
        console.log('Server shut down')
        process.exit(0)
      })
    }
    
    process.on('SIGINT', handleShutdown)
    process.on('SIGTERM', handleShutdown)
    
    return { server, httpServer }
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Invalid OpenAPI 3.1 specification:')
      error.errors.forEach(err => console.error(err))
    } else {
      console.error('Error starting server:', error)
    }
    process.exit(1)
  }
}

// Start the server if this file is run directly
// if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000
  startHttpServer(port)
// }
