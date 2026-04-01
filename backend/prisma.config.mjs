import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrate: {
    async adapter(env) {
      const pool = new Pool({ connectionString: env.DATABASE_URL });
      return new PrismaPg(pool);
    },
  },
});
