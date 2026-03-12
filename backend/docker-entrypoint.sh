#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint] Checking if database needs seeding..."
TENANT_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.tenant.count()
  .then(n => { process.stdout.write(String(n)); return p.\$disconnect(); })
  .catch(() => { process.stdout.write('0'); return p.\$disconnect(); });
" 2>/dev/null)

if [ "$TENANT_COUNT" = "0" ]; then
  echo "[entrypoint] Seeding database..."
  node dist/prisma/seed.js
else
  echo "[entrypoint] Database already seeded ($TENANT_COUNT tenant(s) found), skipping."
fi

echo "[entrypoint] Starting NestJS backend..."
exec node dist/src/main
