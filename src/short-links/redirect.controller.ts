import { Controller, Get, Param, Redirect } from '@nestjs/common';
import { ShortLinksService } from './short-links.service.js';

@Controller()
export class RedirectController {
  constructor(private readonly shortLinks: ShortLinksService) {}

  @Get(':code')
  @Redirect()
  async redirect(@Param('code') code: string) {
    return { url: await this.shortLinks.resolve(code), statusCode: 302 };
  }
}
