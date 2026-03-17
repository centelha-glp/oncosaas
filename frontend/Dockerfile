# ---- Dependencies ----
FROM node:20-alpine AS deps

RUN apk upgrade --no-cache

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ---- Builder ----
FROM node:20-alpine AS builder

RUN apk upgrade --no-cache

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# These public env vars are baked into the JS bundle at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:3002
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3002
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build

# ---- Production ----
FROM node:20-alpine AS production

RUN apk upgrade --no-cache && npm install -g npm@latest

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "server.js"]
