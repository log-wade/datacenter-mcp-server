# Use Node.js 20 slim as base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --production

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Remove source files after build (keep only dist)
RUN rm -rf src tsconfig.json

# Expose the default HTTP port
EXPOSE 3000

# Set environment to HTTP transport mode
ENV TRANSPORT=http
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the MCP server
CMD ["npm", "run", "start:http"]
