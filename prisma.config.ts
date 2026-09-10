import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: {
    path: 'apps/api/prisma/migrations',
    seed: 'pnpm --filter @ntr/api exec tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL || '',
  },
});
