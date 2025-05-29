#!/usr/bin/env tsx

import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

async function testAuthHeaders() {
  const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp'
  // Use a test API key - this won't make real API calls but will test header processing
  const notionApiKey = process.env.NOTION_API_KEY || 'secret_test_notion_api_key_for_header_validation'

  console.log('🔐 Testing HTTP Header Authentication')
  console.log('=' .repeat(50))
  console.log(`Server URL: ${serverUrl}`)
  console.log(`Using API Key: ${notionApiKey.substring(0, 10)}...`)
  console.log('📝 Note: Using test key for header validation (no real API calls)')
  console.log()

  try {
    // Test Method 1: Direct HTTP requests with authentication headers
    console.log('🧪 Testing direct HTTP requests with authentication headers...')
    
    // Test health endpoint first
    const healthResponse = await fetch(serverUrl.replace('/mcp', '/health'))
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`)
    }
    console.log('✅ Health check passed')

    // Test JSON-RPC request with authentication headers
    const rpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }

    const mcpResponse = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'X-Notion-API-Key': notionApiKey
      },
      body: JSON.stringify(rpcRequest)
    })

    if (!mcpResponse.ok) {
      const errorText = await mcpResponse.text()
      console.log(`⚠️  MCP request failed: ${mcpResponse.status}`)
      console.log(`   Response: ${errorText}`)
      
      // If using test key, this is expected for actual API calls
      if (notionApiKey.includes('test')) {
        console.log('   ℹ️  This is expected when using a test API key')
      }
      return // Skip further tests if basic connection fails
    }

    const rpcResult = await mcpResponse.json() as any
    console.log('✅ Direct HTTP request with X-Notion-API-Key header successful')
    console.log(`   Found ${rpcResult.result?.tools?.length || 0} tools`)

    // Test Method 2: Authorization header
    console.log('\n🔐 Testing Authorization header method...')
    
    const authResponse = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${notionApiKey}`
      },
      body: JSON.stringify(rpcRequest)
    })

    if (authResponse.ok) {
      console.log('✅ Authorization Bearer header authentication successful')
    } else {
      console.log('⚠️  Authorization header test failed:', authResponse.status)
    }

    // Test Method 3: Custom headers via X-Auth-Headers
    console.log('\n🔐 Testing custom headers method...')
    
    const customHeaders = {
      'Authorization': `Bearer ${notionApiKey}`,
      'Notion-Version': '2022-06-28'
    }

    const customResponse = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'X-Auth-Headers': JSON.stringify(customHeaders)
      },
      body: JSON.stringify(rpcRequest)
    })

    if (customResponse.ok) {
      console.log('✅ Custom headers via X-Auth-Headers successful')
    } else {
      console.log('⚠️  Custom headers test failed:', customResponse.status)
    }

    // Test Method 4: Tool execution with authentication
    console.log('\n🔧 Testing tool execution with authentication...')
    
    const toolRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get-self',
        arguments: {}
      }
    }

    const toolResponse = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'X-Notion-API-Key': notionApiKey
      },
      body: JSON.stringify(toolRequest)
    })

    if (toolResponse.ok) {
      const toolResult = await toolResponse.json() as any
      console.log('✅ Tool execution with authentication successful')
      if (toolResult.result?.content?.[0]?.text) {
        try {
          const userData = JSON.parse(toolResult.result.content[0].text)
          console.log(`   User: ${userData.name || 'Unknown'} (${userData.type})`)
        } catch {
          console.log(`   Response: ${toolResult.result.content[0].text}`)
        }
      }
    } else {
      const errorText = await toolResponse.text()
      console.log('⚠️  Tool execution test failed:', toolResponse.status)
      console.log(`   Response: ${errorText}`)
      
      if (notionApiKey.includes('test')) {
        console.log('   ℹ️  This is expected when using a test API key with real API calls')
      }
    }

    console.log('\n🎉 Authentication tests completed!')
    console.log('\n📝 Supported authentication methods:')
    console.log('   1. X-Notion-API-Key header: Your Notion integration token')
    console.log('   2. Authorization header: Bearer <token>')
    console.log('   3. X-Auth-Headers: JSON object with custom headers')
    console.log('\n💡 Usage in MCP clients:')
    console.log('   Add these headers to your HTTP requests to the MCP endpoint')
    console.log('   The server will automatically extract and use them for Notion API calls')

  } catch (error) {
    console.error('\n❌ Authentication test failed:', error)
    console.error('\n🔧 Troubleshooting:')
    console.error('   1. Check that the server is running: npm run start:http')
    console.error('   2. If using a real API key, verify it\'s correct and has permissions')
    console.error('   3. For testing purposes, this script uses a test key by default')
    // Don't exit with error - let tests continue
  }
}

// Test with MCP SDK client (without headers since transport doesn't support them)
async function testMCPClient() {
  const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp'
  
  console.log('\n🔌 Testing MCP SDK Client (without authentication)')
  console.log('-' .repeat(50))

  try {
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl))
    
    const client = new Client(
      {
        name: 'notion-mcp-test-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
      }
    )

    await client.connect(transport)
    console.log('✅ MCP SDK client connection successful')
    
    // Test listing tools (should work without auth)
    const tools = await client.listTools()
    console.log(`✅ Found ${tools.tools.length} tools available`)

    // Note about authentication
    console.log('\n💡 Note: MCP SDK client needs custom transport implementation')
    console.log('   to support HTTP headers. For now, use direct HTTP requests')
    console.log('   or implement a custom transport that adds headers.')

    await client.close()

  } catch (error) {
    console.log('⚠️  MCP SDK client test failed:', error)
  }
}

// Run all tests
if (import.meta.url === `file://${process.argv[1]}`) {
  testAuthHeaders()
    .then(() => testMCPClient())
    .catch(console.error)
}

export { testAuthHeaders, testMCPClient }
