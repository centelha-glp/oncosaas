# ---- deps ----
FROM node:24.14.0-alpine3.23 AS deps
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ---- builder ----
FROM node:24.14.0-alpine3.23 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# ---- production ----
FROM node:24.14.0-alpine3.23 AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh \
    && chown -R node:node /app

USER node

EXPOSE 3002
ENTRYPOINT ["./docker-entrypoint.sh"]