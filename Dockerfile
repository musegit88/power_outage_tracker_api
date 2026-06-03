# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

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

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and production dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Copy compiled application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy entrypoint script
COPY --chown=nodejs:nodejs ./entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3004

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run migrations and start app
CMD ["./entrypoint.sh"]
