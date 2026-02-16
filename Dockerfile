FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Build
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Worker build
FROM base AS worker-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx tsx --version > /dev/null

# Production - Web
FROM base AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
EXPOSE 3000
CMD ["npm", "start"]

# Production - Worker
FROM base AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=worker-builder /app/src ./src
COPY --from=worker-builder /app/package.json ./
COPY --from=worker-builder /app/tsconfig.json ./
CMD ["npx", "tsx", "src/worker/index.ts"]

# Production - Combined (default build target)
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=worker-builder /app/src ./src
COPY --from=worker-builder /app/tsconfig.json ./
EXPOSE 3000
CMD ["npm", "start"]
