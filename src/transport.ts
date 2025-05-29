/**
 * HTTP transport for Notion MCP Server
 * Based on the pattern from https://github.com/microsoft/playwright-mcp
 */

import http from 'node:http'
import crypto from 'node:crypto'
import { AsyncLocalStorage } from 'async_hooks'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'

// Store for authentication headers per request
export const authStorage = new AsyncLocalStorage<Record<string, string>>()

/**
 * Extract authentication headers from HTTP request
 */
function extractAuthHeaders(req: http.IncomingMessage): Record<string, string> {
  const authHeaders: Record<string, string> = {}
  
  console.log('🔍 Extracting auth headers from request')
  console.log('📋 Available headers:', Object.keys(req.headers))
  
  // Support X-Notion-API-Key header
  if (req.headers['x-notion-api-key']) {
    console.log('🔑 Found X-Notion-API-Key header')
    authHeaders['Notion-Version'] = '2022-06-28'
    authHeaders['Authorization'] = `Bearer ${req.headers['x-notion-api-key']}`
  }
  
  // Support Authorization header
  if (req.headers['authorization']) {
    console.log('🔑 Found Authorization header')
    authHeaders['Authorization'] = req.headers['authorization'] as string
    authHeaders['Notion-Version'] = '2022-06-28'
  }
  
  // Support custom auth headers via JSON
  if (req.headers['x-auth-headers']) {
    console.log('🔑 Found X-Auth-Headers')
    try {
      const customHeaders = JSON.parse(req.headers['x-auth-headers'] as string)
      Object.assign(authHeaders, customHeaders)
      console.log('✅ Parsed custom headers:', customHeaders)
    } catch (error) {
      console.warn('❌ Failed to parse X-Auth-Headers:', error)
    }
  }

  console.log('🔐 Final auth headers:', authHeaders)
  return authHeaders
}

/**
 * Handle Server-Sent Events (SSE) transport
 */
async function handleSSE(
  server: Server, 
  req: http.IncomingMessage, 
  res: http.ServerResponse, 
  url: URL, 
  sessions: Map<string, SSEServerTransport>
) {
  if (req.method === 'POST') {
    const sessionId = url.searchParams.get('sessionId')
    if (!sessionId) {
      res.statusCode = 400
      return res.end('Missing sessionId')
    }

    const transport = sessions.get(sessionId)
    if (!transport) {
      res.statusCode = 404
      return res.end('Session not found')
    }

    const authHeaders = extractAuthHeaders(req)
    return await authStorage.run(authHeaders, async () => {
      return await transport.handlePostMessage(req, res)
    })
  } else if (req.method === 'GET') {
    const transport = new SSEServerTransport('/sse', res)
    sessions.set(transport.sessionId, transport)
    
    const authHeaders = extractAuthHeaders(req)
    await authStorage.run(authHeaders, async () => {
      await server.connect(transport)
    })
    
    res.on('close', () => {
      sessions.delete(transport.sessionId)
      void server.close().catch(e => console.error(e))
    })
    return
  }

  res.statusCode = 405
  res.end('Method not allowed')
}

/**
 * Handle streamable HTTP transport
 */
async function handleStreamable(
  server: Server,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  sessions: Map<string, StreamableHTTPServerTransport>
) {
  console.log('🌐 handleStreamable called:', req.method, req.url)
  console.log('📋 Request headers:', req.headers)
  
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  
  if (sessionId) {
    console.log('🔑 Using existing session:', sessionId)
    const transport = sessions.get(sessionId)
    if (!transport) {
      console.log('❌ Session not found:', sessionId)
      res.statusCode = 404
      res.end('Session not found')
      return
    }
    
    const authHeaders = extractAuthHeaders(req)
    console.log('🔐 Extracted auth headers:', authHeaders)
    return await authStorage.run(authHeaders, async () => {
      return await transport.handleRequest(req, res)
    })
  }

  if (req.method === 'POST') {
    console.log('📦 Creating new streamable transport session')
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: sessionId => {
        console.log('🆕 Session initialized:', sessionId)
        sessions.set(sessionId, transport)
      }
    })
    
    transport.onclose = () => {
      if (transport.sessionId) {
        console.log('🔚 Session closed:', transport.sessionId)
        sessions.delete(transport.sessionId)
      }
    }
    
    const authHeaders = extractAuthHeaders(req)
    console.log('🔐 Extracted auth headers:', authHeaders)
    
    await authStorage.run(authHeaders, async () => {
      console.log('🔌 Connecting server to transport')
      await server.connect(transport)
      console.log('📨 Handling request with transport')
      await transport.handleRequest(req, res)
    })
    return
  }

  console.log('❌ Invalid request method:', req.method)
  res.statusCode = 400
  res.end('Invalid request')
}

/**
 * Start HTTP transport server
 */
export function startHttpTransport(server: Server, port: number, hostname?: string) {
  const sseSessions = new Map<string, SSEServerTransport>()
  const streamableSessions = new Map<string, StreamableHTTPServerTransport>()
  
  const httpServer = http.createServer(async (req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-ID, Last-Event-ID, X-Notion-API-Key, X-Auth-Headers, mcp-session-id')
    res.setHeader('Access-Control-Expose-Headers', 'X-Session-ID')
    
    if (req.method === 'OPTIONS') {
      res.statusCode = 200
      res.end()
      return
    }

    const url = new URL(`http://localhost${req.url}`)
    
    // Route to appropriate handler
    if (url.pathname.startsWith('/mcp')) {
      await handleStreamable(server, req, res, streamableSessions)
    } else if (url.pathname.startsWith('/sse')) {
      await handleSSE(server, req, res, url, sseSessions)
    } else if (url.pathname === '/health') {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ status: 'healthy', service: 'notion-mcp-server' }))
    } else {
      res.statusCode = 404
      res.end('Not Found')
    }
  })
  
  httpServer.listen(port, hostname, () => {
    const address = httpServer.address()
    if (!address) {
      throw new Error('Could not bind server socket')
    }
    
    let url: string
    if (typeof address === 'string') {
      url = address
    } else {
      const resolvedPort = address.port
      let resolvedHost = address.family === 'IPv4' ? address.address : `[${address.address}]`
      if (resolvedHost === '0.0.0.0' || resolvedHost === '[::]') {
        resolvedHost = 'localhost'
      }
      url = `http://${resolvedHost}:${resolvedPort}`
    }
    
    const message = [
      `Notion MCP Server listening on ${url}`,
      'Put this in your client config:',
      JSON.stringify({
        'mcpServers': {
          'notion': {
            'url': `${url}/sse`
          }
        }
      }, undefined, 2),
      'If your client supports streamable HTTP, you can use the /mcp endpoint instead.',
      '',
      'Authentication headers supported:',
      '- X-Notion-API-Key: your_notion_api_key',
      '- Authorization: Bearer your_notion_api_key', 
      '- X-Auth-Headers: {"custom": "headers"}'
    ].join('\n')
    
    console.error(message)
  })
  
  return httpServer
}
