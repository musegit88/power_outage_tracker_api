# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies
RUN npm ci

# Generate Prisma client and build TypeScript
COPY src ./src
RUN npm run build

# Create pruned production node_modules
RUN npm prune --omit=dev

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files and production dependencies from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY prisma.config.ts ./

# Copy compiled application from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3004

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run migrations and start app
CMD ["sh", "-c", "npx prisma migrate deploy --config ./prisma.config.ts && node dist/index.js"]
