import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const digest = (value: string) => createHash('sha256').update(value).digest();

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly keys = (process.env.API_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
    .map(digest);

  canActivate(context: ExecutionContext): boolean {
    const header = context.switchToHttp().getRequest<Request>().headers['x-api-key'];
    if (typeof header === 'string') {
      const given = digest(header);
      if (this.keys.some((key) => timingSafeEqual(key, given))) return true;
    }
    throw new UnauthorizedException();
  }
}
