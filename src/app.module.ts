import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ShortLinksModule } from './short-links/short-links.module.js';

@Module({
  imports: [PrismaModule, ShortLinksModule],
  controllers: [HealthController],
})
export class AppModule {}
