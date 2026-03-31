# ---- deps ----
FROM node:24.14.0-alpine3.23 AS deps
WORKDIR /app

ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/public
ENV DATABASE_URL=${DATABASE_URL}

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ---- dev ----
FROM node:24.14.0-alpine3.23 AS dev
WORKDIR /app

ENV NODE_ENV=development
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/public
ENV DATABASE_URL=${DATABASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

EXPOSE 3002
CMD ["npm", "run", "start:dev"]

# ---- builder ----
FROM node:24.14.0-alpine3.23 AS builder
WORKDIR /app

ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/public
ENV DATABASE_URL=${DATABASE_URL}

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

RUN chown -R node:node /app

USER node

EXPOSE 3002
CMD ["node", "dist/src/main"]
