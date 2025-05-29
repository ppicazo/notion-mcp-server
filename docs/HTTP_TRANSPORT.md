# HTTP Transport for Notion MCP Server

This document describes how to use the Notion MCP Server with the new Streamable HTTP transport, which allows deployment in serverless environments like Google Cloud Run, AWS Lambda, and other HTTP-based services.

## Overview

The Streamable HTTP transport implements the [MCP Streamable HTTP specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http), enabling:

- **Serverless Deployment**: Deploy on Google Cloud Run, AWS Lambda, Azure Functions, etc.
- **HTTP/REST API**: Standard HTTP endpoints instead of stdio transport
- **Server-Sent Events (SSE)**: Real-time streaming capabilities
- **Session Management**: Stateful connections with session IDs
- **Resumability**: Event replay for connection recovery (optional)

## Quick Start

### 1. Start the HTTP Server

```bash
# Development mode with auto-reload
npm run dev:http

# Production mode
npm run start:http

# Custom port
PORT=8080 npm run start:http
```

The server will start on `http://localhost:3000` by default.

### 2. Test the Connection

```bash
# Test with the included client
npm run test:http

# Health check
curl http://localhost:3000/health
```

### 3. MCP Endpoint

The MCP server is available at `/mcp` and supports:
- `GET /mcp` - Server-Sent Events stream for real-time communication
- `POST /mcp` - JSON-RPC message exchange
- `DELETE /mcp` - Session termination

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and health information.

### MCP Communication
```
GET /mcp
```
Establishes an SSE stream for real-time communication. Includes session management.

```
POST /mcp
Content-Type: application/json
X-Session-ID: <session-id> (for stateful mode)

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

```
DELETE /mcp
X-Session-ID: <session-id>
```
Terminates the session.

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)
- `NOTION_API_KEY` - Your Notion API key (optional - can be provided via headers)
- `BASE_URL` - Override Notion API base URL

### Authentication

The server supports multiple authentication methods:

1. **Environment Variable** (traditional):
   ```bash
   export NOTION_API_KEY=your_notion_api_key
   ```

2. **HTTP Headers** (recommended for serverless):
   - `X-Notion-API-Key: your_notion_api_key`
   - `Authorization: Bearer your_notion_api_key`
   - `X-Auth-Headers: {"custom": "headers"}`

### Session Management

The server supports two modes:

**Stateful Mode (default)**:
- Session IDs are automatically generated
- State is maintained in memory
- Session validation on each request

**Stateless Mode**:
- No session management
- Each request is independent
- Better for serverless environments

## Docker Deployment

### Basic Docker

```bash
# Build the image
docker build -f Dockerfile.http -t notion-mcp-http .

# Run the container (with optional environment-based auth)
docker run -p 3000:3000 -e NOTION_API_KEY=your_key notion-mcp-http

# Or run without API key (use header-based auth)
docker run -p 3000:3000 notion-mcp-http
```

### Docker Compose

```bash
# Start the service
docker-compose -f docker-compose.http.yml up -d
```

## Cloud Deployment

### Google Cloud Run

1. Build and push to Google Container Registry:
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/notion-mcp-http
```

2. Deploy to Cloud Run:
```bash
# With environment-based auth (traditional)
gcloud run deploy notion-mcp \
  --image gcr.io/YOUR_PROJECT/notion-mcp-http \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars NOTION_API_KEY=your_key

# Or deploy without API key (recommended for header-based auth)
gcloud run deploy notion-mcp \
  --image gcr.io/YOUR_PROJECT/notion-mcp-http \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000
```

### AWS Lambda (with API Gateway)

The HTTP transport is compatible with serverless-http for AWS Lambda deployment.

### Azure Container Instances

```bash
# With environment-based auth
az container create \
  --resource-group myResourceGroup \
  --name notion-mcp \
  --image notion-mcp-http \
  --ports 3000 \
  --environment-variables NOTION_API_KEY=your_key

# Or without API key (for header-based auth)
az container create \
  --resource-group myResourceGroup \
  --name notion-mcp \
  --image notion-mcp-http \
  --ports 3000
```

## Client Usage

### JavaScript/TypeScript Client

```typescript
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

const transport = new StreamableHTTPClientTransport(
  new URL('http://localhost:3000/mcp')
)

const client = new Client({
  name: 'my-client',
  version: '1.0.0'
}, {
  capabilities: {
    roots: { listChanged: true },
    sampling: {}
  }
})

await client.connect(transport)

// Use the client
const tools = await client.listTools()
console.log(tools)
```

### cURL Examples

Initialize connection:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    },
    "id": 1
  }'
```

List tools:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 2
  }'
```

## Features

### Session Management
- Automatic session ID generation
- Session validation and timeout
- In-memory session storage

### Error Handling
- Proper HTTP status codes
- JSON-RPC error responses
- CORS support for web clients

### Security
- CORS configuration
- Session-based access control
- Request size limits

### Monitoring
- Health check endpoint
- Request logging
- Error tracking

## Migration from stdio

If you're migrating from the stdio transport:

1. **Client Code**: Replace `StdioClientTransport` with `StreamableHTTPClientTransport`
2. **Server Setup**: Use `start-http-server.ts` instead of `start-server.ts`
3. **Environment**: Set up HTTP endpoint instead of spawning processes
4. **Authentication**: Consider session management requirements

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure the server's CORS configuration matches your client's origin
2. **Session Issues**: Check session ID handling in stateful mode
3. **Connection Timeouts**: Verify network connectivity and firewall settings
4. **Memory Usage**: Monitor session storage in high-traffic scenarios

### Debugging

Enable debug logging:
```bash
DEBUG=mcp:* npm run start:http
```

Check server logs for detailed request/response information.

## Performance Considerations

- **Memory**: Sessions are stored in memory by default
- **Connections**: Each SSE connection maintains state
- **Scaling**: Consider external session storage for horizontal scaling
- **Timeouts**: Configure appropriate timeout values for your use case

## Contributing

To add new features or fix issues with the HTTP transport:

1. Modify `scripts/start-http-server.ts` for server-side changes
2. Update `scripts/test-http-client.ts` for client testing
3. Add tests in the appropriate test directories
4. Update this documentation

## Resources

- [MCP Streamable HTTP Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Server-Sent Events MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
