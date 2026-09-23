# --- Stage 1: Build Frontend Dashboard and SDK ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools required for native C++ modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package descriptors
COPY package*.json ./
COPY packages/alsabase/package*.json ./packages/alsabase/

# Install all dependencies including devDependencies
RUN npm ci

# Copy full application source code
COPY . .

# Build React Admin Dashboard UI into ./dist and compile SDK package
RUN npm run build
RUN npm run build --prefix packages/alsabase

# --- Stage 2: Production Server Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

# Install native runtime libraries for SQLite
RUN apk add --no-cache python3 make g++

ENV NODE_ENV=production
ENV PORT=8090

# Copy package descriptors and install dependencies
COPY package*.json ./
COPY packages/alsabase/package*.json ./packages/alsabase/

RUN npm ci

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/packages/alsabase/dist ./packages/alsabase/dist

# Copy backend server code, hooks, static hosting, and public assets
COPY server ./server
COPY public ./public
COPY _hooks ./_hooks
COPY _public ./_public
COPY tsconfig.server.json ./
COPY tsconfig.json ./

# Create directories for persistent SQLite data, backups, hooks, and static files
RUN mkdir -p /app/data /app/backups /app/_hooks /app/_public

# Expose HTTP port
EXPOSE 8090

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8090/api/health || exit 1

# Start AlsaBase server
CMD ["npm", "run", "server"]
