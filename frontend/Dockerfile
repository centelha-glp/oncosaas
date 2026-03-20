# ---- deps ----
FROM node:24.14.0-alpine3.23 AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

# ---- builder ----
FROM node:24.14.0-alpine3.23 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:3002
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3002
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build

# ---- production ----
FROM gcr.io/distroless/nodejs24-debian13:nonroot
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["server.js"]