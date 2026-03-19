# ---- Builder ----
FROM node:24-alpine AS builder

RUN apk update && apk upgrade --no-cache

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

# Generate Prisma client from the schema (no DB needed — reads schema file only)
RUN npx prisma generate

COPY . .

RUN npm run build

# ---- Production ----
FROM node:24-alpine AS production

RUN apk update && apk upgrade --no-cache && npm install -g npm@latest

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh && chown -R node:node /app

USER node

EXPOSE 3002

ENTRYPOINT ["./docker-entrypoint.sh"]
