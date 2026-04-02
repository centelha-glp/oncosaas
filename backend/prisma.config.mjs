import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * URL do datasource para o CLI.
 * Use `process.env` direto (não `env()` do Prisma) quando a variável pode não existir
 * — ex.: `prisma generate` no Docker sem DATABASE_URL. Ver:
 * https://www.prisma.io/docs/orm/reference/prisma-config-reference#handling-optional-environment-variables
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
});
