import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import { Prisma, type ShortLink } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ShortLinkResponseDto } from './dto/create-short-link.dto.js';

const CODE_LENGTH = 7;
const CODE_PATTERN = /^[A-Za-z0-9_-]{7}$/;
const MAX_URL_LENGTH = 8192;
const MAX_CODE_TRIES = 5;

@Injectable()
export class ShortLinksService {
  private readonly baseUrl = process.env.PUBLIC_BASE_URL!.replace(/\/+$/, '');
  private readonly ownHost = new URL(this.baseUrl).host;
  private readonly allowedDomains = (process.env.ALLOWED_DOMAINS ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  constructor(private readonly prisma: PrismaService) {}

  async shorten(raw: unknown): Promise<{ link: ShortLinkResponseDto; created: boolean }> {
    const url = this.normalize(raw);
    const urlHash = createHash('sha256').update(url).digest('hex');

    const existing = await this.prisma.shortLink.findUnique({ where: { urlHash } });
    if (existing) return { link: this.toDto(existing), created: false };

    for (let i = 0; i < MAX_CODE_TRIES; i++) {
      try {
        const link = await this.prisma.shortLink.create({
          data: { code: nanoid(CODE_LENGTH), url, urlHash },
        });
        return { link: this.toDto(link), created: true };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
          throw error;
        }
        // Conflito no url_hash = mesma URL gravada em paralelo; senão foi o código, sorteia outro.
        const raced = await this.prisma.shortLink.findUnique({ where: { urlHash } });
        if (raced) return { link: this.toDto(raced), created: false };
      }
    }
    throw new InternalServerErrorException();
  }

  async resolve(code: string): Promise<string> {
    if (CODE_PATTERN.test(code)) {
      const link = await this.prisma.shortLink.findUnique({ where: { code }, select: { url: true } });
      if (link) return link.url;
    }
    throw new NotFoundException();
  }

  private normalize(raw: unknown): string {
    if (typeof raw !== 'string' || raw.length > MAX_URL_LENGTH || !URL.canParse(raw)) {
      throw new BadRequestException('url inválida');
    }
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException('Só são aceitas URLs http ou https');
    }
    if (url.username || url.password) throw new BadRequestException('url inválida');

    const allowed =
      url.host !== this.ownHost &&
      (this.allowedDomains.length === 0 ||
        this.allowedDomains.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`)));
    if (!allowed) throw new BadRequestException('Domínio não permitido');

    return url.href;
  }

  private toDto(link: ShortLink): ShortLinkResponseDto {
    return {
      code: link.code,
      shortUrl: `${this.baseUrl}/${link.code}`,
      url: link.url,
      createdAt: link.createdAt,
    };
  }
}
