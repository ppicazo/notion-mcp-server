# Example: Deploying Notion MCP Server with HTTP Transport

This directory contains example configurations for deploying the Notion MCP Server using the HTTP transport.

## Local Development

```bash
# Start the HTTP server
npm run dev:http

# Test the connection
npm run test:http
```

## Cloud Run Deployment (Google Cloud)

1. Create a `cloudbuild.yaml`:
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'Dockerfile.http', '-t', 'gcr.io/$PROJECT_ID/notion-mcp-http', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/notion-mcp-http']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'notion-mcp'
      - '--image'
      - 'gcr.io/$PROJECT_ID/notion-mcp-http'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--port'
      - '3000'
      - '--set-env-vars'
      - 'NOTION_API_KEY=$$NOTION_API_KEY'
    secretEnv: ['NOTION_API_KEY']

availableSecrets:
  secretManager:
    - versionName: projects/$PROJECT_ID/secrets/notion-api-key/versions/latest
      env: 'NOTION_API_KEY'
```

2. Deploy:
```bash
gcloud builds submit
```

## Vercel Deployment

Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "scripts/start-http-server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    { "src": "/mcp", "dest": "/scripts/start-http-server.ts" },
    { "src": "/health", "dest": "/scripts/start-http-server.ts" }
  ],
  "env": {
    "NOTION_API_KEY": "@notion-api-key"
  }
}
```

## Railway Deployment

Create `railway.json`:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start:http"
  }
}
```

## Environment Variables

All platforms require:
- `NOTION_API_KEY` - Your Notion API key
- `PORT` - Server port (automatically set by most platforms)

Optional:
- `NODE_ENV` - Environment mode
- `BASE_URL` - Override Notion API base URL
