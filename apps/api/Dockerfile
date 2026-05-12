# FlowDesk API — Dockerfile para desenvolvimento local + build de produção
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

FROM node:20-alpine AS build

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Usuário não-root pra produção
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 flowdesk

COPY --from=build --chown=flowdesk:nodejs /app/dist ./dist
COPY --from=build --chown=flowdesk:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=flowdesk:nodejs /app/package.json ./

USER flowdesk

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
