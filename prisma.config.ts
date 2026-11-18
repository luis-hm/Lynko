import { defineConfig } from 'prisma/config';
import { databaseUrl } from './src/prisma/database-url.js';

// O CLI do Prisma 7 não lê o .env sozinho; no Docker as variáveis já vêm do ambiente.
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: databaseUrl() },
});
