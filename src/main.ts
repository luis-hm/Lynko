import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// Fora do Docker, lê o .env; no container as variáveis já vêm do ambiente.
try {
  process.loadEnvFile();
} catch {}

const app = await NestFactory.create(AppModule);
await app.listen(process.env.PORT ?? 3000);
