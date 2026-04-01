# ---- deps ----
FROM node:24.14.0-alpine3.23 AS deps
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ---- dev ----
FROM node:24.14.0-alpine3.23 AS dev
WORKDIR /app

ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=secret,id=DATABASE_URL,env=DATABASE_URL,required=true \
    npx prisma generate

EXPOSE 3002
CMD ["npm", "run", "start:dev"]

# ---- builder ----
FROM node:24.14.0-alpine3.23 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=secret,id=DATABASE_URL,env=DATABASE_URL,required=true \
    npx prisma generate && \
    npm run build

RUN npm prune --omit=dev

# ---- production ----
FROM node:24.14.0-alpine3.23 AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

RUN chown -R node:node /app

USER node

EXPOSE 3002
CMD ["node", "dist/src/main"]