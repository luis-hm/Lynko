import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiKeyGuard } from '../auth/api-key.guard.js';
import { CreateShortLinkDto, ShortLinkResponseDto } from './dto/create-short-link.dto.js';
import { ShortLinksService } from './short-links.service.js';

@Controller('api/short-links')
@UseGuards(ApiKeyGuard)
export class ShortLinksController {
  constructor(private readonly shortLinks: ShortLinksService) {}

  @Post()
  async create(
    @Body() dto: CreateShortLinkDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ShortLinkResponseDto> {
    const { link, created } = await this.shortLinks.shorten(dto?.url);
    res.status(created ? 201 : 200);
    return link;
  }
}
