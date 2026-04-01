import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

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
  migrate: {
    async adapter(env) {
      const pool = new Pool({ connectionString: env.DATABASE_URL });
      return new PrismaPg(pool);
    },
  },
});
