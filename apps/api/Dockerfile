# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools for native modules (better-sqlite3, bcrypt, etc.)
RUN apk add --no-cache python3 make g++ openssl

# Copy root workspace manifest files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (devDeps needed for Nx build)
RUN npm ci

# Copy full workspace source
COPY . .

# Generate Prisma client targeting linux/musl (Alpine)
RUN npx prisma generate

# Build the NestJS API with Nx
RUN npx nx build api --prod

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Required by Prisma client at runtime
RUN apk add --no-cache openssl

# Copy the built application (webpack generates package.json here too)
COPY --from=builder /app/dist/api ./

# Copy full node_modules — preserves Prisma linux binaries and prisma CLI
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema, migrations, and config for runtime migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run migrations then start the server (exec hands PID 1 to node for signal handling)
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node main.js"]
