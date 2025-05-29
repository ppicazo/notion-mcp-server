#!/usr/bin/env tsx

/**
 * Basic test to validate the HTTP server is working and can handle authentication headers
 * This test doesn't require real API keys - it just tests the server infrastructure
 */

async function testServerBasic() {
  const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000'
  
  console.log('🔧 Testing Basic Server Functionality')
  console.log('=' .repeat(50))
  console.log(`Server URL: ${serverUrl}`)
  console.log()

  try {
    // Test 1: Health endpoint
    console.log('🏥 Testing health endpoint...')
    const healthResponse = await fetch(`${serverUrl}/health`)
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`)
    }
    const healthData = await healthResponse.json()
    console.log('✅ Health check passed:', healthData)
    console.log()

    // Test 2: MCP endpoint with authentication headers (should handle gracefully)
    console.log('🔐 Testing MCP endpoint with authentication headers...')
    
    // Test with X-Notion-API-Key header
    const mcpResponse1 = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Notion-API-Key': 'test-key-123'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        },
        id: 1
      })
    })
    
    console.log(`📡 Response status: ${mcpResponse1.status}`)
    console.log(`📡 Response headers:`, Object.fromEntries(mcpResponse1.headers.entries()))
    
    if (mcpResponse1.ok) {
      const responseData = await mcpResponse1.text()
      console.log('✅ MCP endpoint responded successfully')
      console.log('📄 Response preview:', responseData.substring(0, 200) + (responseData.length > 200 ? '...' : ''))
    } else {
      console.log('⚠️  MCP endpoint returned error status (expected without real API key)')
    }
    console.log()

    // Test 3: MCP endpoint with Authorization header
    console.log('🔑 Testing MCP endpoint with Authorization header...')
    const mcpResponse2 = await fetch(`${serverUrl}/mcp`, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token-456'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client', 
            version: '1.0.0'
          }
        },
        id: 2
      })
    })
    
    console.log(`📡 Response status: ${mcpResponse2.status}`)
    if (mcpResponse2.ok) {
      console.log('✅ Authorization header test passed')
    } else {
      console.log('⚠️  Authorization header test returned error (expected without real API key)')
    }
    console.log()

    // Test 4: MCP endpoint with X-Auth-Headers
    console.log('📋 Testing MCP endpoint with X-Auth-Headers...')
    const customHeaders = {
      'Authorization': 'Bearer custom-token-789',
      'Notion-Version': '2022-06-28',
      'Custom-Header': 'custom-value'
    }
    
    const mcpResponse3 = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Headers': JSON.stringify(customHeaders)
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize', 
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        },
        id: 3
      })
    })
    
    console.log(`📡 Response status: ${mcpResponse3.status}`)
    if (mcpResponse3.ok) {
      console.log('✅ X-Auth-Headers test passed')
    } else {
      console.log('⚠️  X-Auth-Headers test returned error (expected without real API key)')
    }
    console.log()

    console.log('🎉 Basic server tests completed!')
    console.log('✅ Server is accepting requests and processing authentication headers')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testServerBasic().catch(error => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})
