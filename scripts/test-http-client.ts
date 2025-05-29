import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

async function testHttpClient() {
  const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp'
  
  console.log(`Connecting to MCP server at: ${serverUrl}`)
  
  // Create HTTP transport for client
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl))
  
  // Create MCP client
  const client = new Client(
    {
      name: 'notion-mcp-test-client',
      version: '1.0.0',
    },
    {
      capabilities: {
        roots: {
          listChanged: true,
        },
        sampling: {},
      },
    }
  )

  try {
    // Connect to the server
    await client.connect(transport)
    console.log('Connected to MCP server!')

    // List available tools
    const tools = await client.listTools()
    console.log('Available tools:', tools.tools.map(t => t.name))

    // List available resources
    const resources = await client.listResources()
    console.log('Available resources:', resources.resources.map(r => r.uri))

    // Example: Call a tool (if available)
    if (tools.tools.length > 0) {
      const firstTool = tools.tools[0]
      console.log(`\nTesting tool: ${firstTool.name}`)
      console.log(`Description: ${firstTool.description}`)
      
      // You can call the tool here if it doesn't require specific parameters
      // const result = await client.callTool({
      //   name: firstTool.name,
      //   arguments: {}
      // })
      // console.log('Tool result:', result)
    }

  } catch (error) {
    console.error('Error testing HTTP client:', error)
  } finally {
    await client.close()
    console.log('Client disconnected')
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testHttpClient().catch(console.error)
}

export { testHttpClient }
