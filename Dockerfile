FROM node:20-alpine AS base

# Build
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production (web + worker combined, command overridden per deployment)
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
EXPOSE 3000
CMD ["npm", "start"]
