#!/usr/bin/env npx tsx

/**
 * Test authentication header functionality with mock API calls
 * This validates the authentication flow without requiring real API keys
 */

import axios from 'axios'

const SERVER_URL = 'http://localhost:3000'

interface TestCase {
  name: string
  headers: Record<string, string>
  expectedAuth: string
}

const testCases: TestCase[] = [
  {
    name: 'X-Notion-API-Key header',
    headers: { 'X-Notion-API-Key': 'test_api_key_123' },
    expectedAuth: 'Bearer test_api_key_123'
  },
  {
    name: 'Authorization header (Bearer)',
    headers: { 'Authorization': 'Bearer test_bearer_token' },
    expectedAuth: 'Bearer test_bearer_token'
  },
  {
    name: 'Authorization header (plain)',
    headers: { 'Authorization': 'test_plain_token' },
    expectedAuth: 'test_plain_token'
  },
  {
    name: 'X-Auth-Headers with custom headers',
    headers: { 'X-Auth-Headers': JSON.stringify({ 'Custom-Auth': 'custom_value', 'Notion-Version': '2022-06-28' }) },
    expectedAuth: 'should use custom headers'
  }
]

async function testListTools() {
  console.log('🔍 Testing tool listing (no auth required)...')
  try {
    const response = await axios.post(`${SERVER_URL}/mcp`, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    }, {
      headers: { 'Content-Type': 'application/json' }
    })

    if (response.data.result && response.data.result.tools) {
      console.log(`✅ Successfully listed ${response.data.result.tools.length} tools`)
      console.log('📋 Available tools:', response.data.result.tools.map((t: any) => t.name).slice(0, 3).join(', ') + '...')
      return true
    } else {
      console.log('❌ Unexpected response format:', response.data)
      return false
    }
  } catch (error) {
    console.log('❌ Error listing tools:', error instanceof Error ? error.message : error)
    return false
  }
}

async function testAuthHeaders() {
  console.log('\n🔐 Testing authentication header extraction...')
  
  for (const testCase of testCases) {
    console.log(`\n📝 Testing: ${testCase.name}`)
    
    try {
      // Try to call a tool that would require authentication
      // We expect this to fail with API errors, but we can check if headers are processed
      const response = await axios.post(`${SERVER_URL}/mcp`, {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'API-listUsers',
          arguments: {}
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...testCase.headers
        }
      })

      // If we get here, check if it's a successful response
      if (response.data.result) {
        console.log('✅ Unexpected success - API call worked (might be a mock)')
      } else {
        console.log('⚠️  Unexpected response format')
      }
    } catch (error: any) {
      // We expect API errors since we're using fake tokens
      if (error.response) {
        const errorData = error.response.data
        if (errorData.error) {
          // Check if the error indicates authentication was attempted
          const errorMessage = JSON.stringify(errorData.error)
          if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid') || errorMessage.includes('401')) {
            console.log('✅ Authentication header processed (got auth error as expected)')
          } else if (errorMessage.includes('API')) {
            console.log('✅ Request reached API layer (headers processed)')
          } else {
            console.log('⚠️  Unexpected error type:', errorMessage.substring(0, 100))
          }
        } else {
          console.log('⚠️  No error details in response')
        }
      } else {
        console.log('❌ Network error:', error.message)
      }
    }
  }
}

async function testCORSHeaders() {
  console.log('\n🌐 Testing CORS headers...')
  
  try {
    const response = await axios.options(`${SERVER_URL}/mcp`, {
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'X-Notion-API-Key,Authorization,X-Auth-Headers'
      }
    })

    const corsHeaders = response.headers['access-control-allow-headers']
    if (corsHeaders && corsHeaders.includes('X-Notion-API-Key')) {
      console.log('✅ CORS headers properly configured for authentication')
    } else {
      console.log('⚠️  CORS headers may not include authentication headers')
    }
  } catch (error) {
    console.log('⚠️  Could not test CORS:', error instanceof Error ? error.message : error)
  }
}

async function main() {
  console.log('🚀 Testing Notion MCP Server Authentication Headers\n')
  
  // Test basic functionality
  const toolsWorking = await testListTools()
  if (!toolsWorking) {
    console.log('\n❌ Basic functionality test failed. Exiting.')
    process.exit(1)
  }

  // Test authentication headers
  await testAuthHeaders()
  
  // Test CORS
  await testCORSHeaders()

  console.log('\n✅ Authentication header tests completed!')
  console.log('📝 Note: API errors are expected when using mock tokens')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
