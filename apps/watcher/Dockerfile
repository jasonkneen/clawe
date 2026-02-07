FROM node:22-slim

WORKDIR /app

# Copy package files
COPY apps/watcher/package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install dependencies
RUN npm install --omit=dev 2>/dev/null || true

# Copy source code
COPY apps/watcher/dist/ ./dist/
COPY packages/shared/src/ ./node_modules/@clawe/shared/src/
COPY packages/backend/convex/_generated/ ./node_modules/@clawe/backend/convex/_generated/

# Environment variables (set via docker-compose)
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
