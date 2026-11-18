import { Module } from '@nestjs/common';
import { RedirectController } from './redirect.controller.js';
import { ShortLinksController } from './short-links.controller.js';
import { ShortLinksService } from './short-links.service.js';

@Module({
  controllers: [ShortLinksController, RedirectController],
  providers: [ShortLinksService],
})
export class ShortLinksModule {}
