#!/bin/bash
# Publish datacenter-mcp-server to Smithery.ai
# Usage: SMITHERY_API_KEY=your_key ./scripts/publish-smithery.sh

if [ -z "$SMITHERY_API_KEY" ]; then
  echo "Error: Set SMITHERY_API_KEY environment variable"
  echo "Get your key at: https://smithery.ai/account/api-keys"
  exit 1
fi

echo "$SMITHERY_API_KEY" | npx @smithery/cli mcp publish \
  "https://github.com/log-wade/datacenter-mcp-server" \
  -n "log-wade/datacenter-mcp-server"

echo ""
echo "Published! View at: https://smithery.ai/server/log-wade/datacenter-mcp-server"
