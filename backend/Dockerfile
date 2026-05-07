# ---- deps ----
FROM node:24.14.1-alpine3.23 AS deps
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ---- rds-ca ----
FROM alpine:3.23 AS rds-ca
RUN apk add --no-cache curl
RUN mkdir -p /certs && \
    curl -fsSL "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" \
      -o /certs/rds-global-bundle.pem

# ---- dev ----
FROM node:24.14.1-alpine3.23 AS dev
WORKDIR /app

ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

EXPOSE 3002
CMD ["npm", "run", "start:dev"]

# ---- builder ----
FROM node:24.14.1-alpine3.23 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate && \
    npm run build

RUN npm prune --omit=dev

# ---- production ----
FROM node:24.14.1-alpine3.23 AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.mjs ./prisma.config.mjs
COPY --from=rds-ca /certs/rds-global-bundle.pem /app/certs/rds-global-bundle.pem

RUN apk update && apk upgrade --no-cache && chown -R node:node /app

USER node

EXPOSE 3002
CMD ["node", "dist/src/main"]
