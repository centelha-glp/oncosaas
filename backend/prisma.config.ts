import { config } from 'dotenv';
import { resolve } from 'path';
import { defineConfig, env } from 'prisma/config';

// Garantir que .env do backend seja carregado (Prisma CLI pode pular quando usa config)
config({ path: resolve(__dirname, '.env') });

/**
 * Prisma Config (CLI). Em Prisma 6.x a URL do banco continua no schema.prisma.
 * Em Prisma 7+ a URL fica aqui (datasource.url) e é removida do schema.
 * Ver: https://pris.ly/prisma-config
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
