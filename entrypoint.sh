#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy --config ./prisma.config.ts

echo "Starting application as nodejs user..."
exec su-exec nodejs node dist/index.js
