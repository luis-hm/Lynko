import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard.js';
import { Prisma, type ShortLink } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ShortLinksService } from './short-links.service.js';

function fakePrisma(rows: ShortLink[] = []) {
  const p2002 = () =>
    new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
  const shortLink = {
    findUnique: vi.fn(async ({ where }: { where: Partial<ShortLink> }) =>
      rows.find((r) => (where.code ? r.code === where.code : r.urlHash === where.urlHash)) ?? null,
    ),
    create: vi.fn(async ({ data }: { data: Omit<ShortLink, 'createdAt'> }) => {
      if (rows.some((r) => r.code === data.code || r.urlHash === data.urlHash)) throw p2002();
      const row = { ...data, createdAt: new Date() };
      rows.push(row);
      return row;
    }),
  };
  return { rows, shortLink, prisma: { shortLink } as unknown as PrismaService };
}

function service(env: Record<string, string> = {}, rows?: ShortLink[]) {
  Object.assign(process.env, { PUBLIC_BASE_URL: 'https://lnk.test/', ALLOWED_DOMAINS: '', ...env });
  const fake = fakePrisma(rows);
  return { ...fake, svc: new ShortLinksService(fake.prisma) };
}

describe('ShortLinksService', () => {
  it('cria código de 7 caracteres e shortUrl (RN04)', async () => {
    const { svc } = service();
    const { link, created } = await svc.shorten('https://exemplo.com/a?b=1');
    expect(created).toBe(true);
    expect(link.code).toMatch(/^[A-Za-z0-9_-]{7}$/);
    expect(link.shortUrl).toBe(`https://lnk.test/${link.code}`);
  });

  it('mesma URL (após normalizar) devolve o mesmo código com created=false (RN05)', async () => {
    const { svc, rows } = service();
    const a = await svc.shorten('https://Exemplo.com:443/x');
    const b = await svc.shorten('https://exemplo.com/x');
    expect(b).toEqual({ link: a.link, created: false });
    expect(rows).toHaveLength(1);
    expect(a.link.url).toBe('https://exemplo.com/x');
  });

  it('URLs que diferem na query recebem códigos diferentes', async () => {
    const { svc } = service();
    const a = await svc.shorten('https://exemplo.com/x?w=1');
    const b = await svc.shorten('https://exemplo.com/x?w=2');
    expect(a.link.code).not.toBe(b.link.code);
  });

  it('colisão de código sorteia outro (RN04)', async () => {
    const { svc, shortLink } = service();
    shortLink.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }),
    );
    const { created } = await svc.shorten('https://exemplo.com/colisao');
    expect(created).toBe(true);
    expect(shortLink.create).toHaveBeenCalledTimes(2);
  });

  it('corrida com a mesma URL devolve o registro gravado pela outra requisição (RN05)', async () => {
    const { svc, rows, shortLink } = service();
    shortLink.findUnique.mockResolvedValueOnce(null); // a busca inicial não vê a outra requisição
    const first = await service({}, rows).svc.shorten('https://exemplo.com/corrida');
    const second = await svc.shorten('https://exemplo.com/corrida');
    expect(second).toEqual({ link: first.link, created: false });
  });

  it.each([
    ['ftp://exemplo.com/a', 'Só são aceitas URLs http ou https'],
    ['javascript:alert(1)', 'Só são aceitas URLs http ou https'],
    ['/relativa', 'url inválida'],
    ['https://user:senha@exemplo.com/', 'url inválida'],
    [`https://exemplo.com/${'a'.repeat(8192)}`, 'url inválida'],
    [123, 'url inválida'],
    [undefined, 'url inválida'],
    ['https://lnk.test/aB3xK9p', 'Domínio não permitido'],
  ])('recusa %s (RN01–RN03)', async (url, message) => {
    await expect(service().svc.shorten(url)).rejects.toThrow(new BadRequestException(message));
  });

  it('ALLOWED_DOMAINS libera o domínio e subdomínios, e só eles (RN03)', async () => {
    const { svc } = service({ ALLOWED_DOMAINS: 'exemplo.com' });
    await expect(svc.shorten('https://exemplo.com/a')).resolves.toBeDefined();
    await expect(svc.shorten('https://img.exemplo.com/a')).resolves.toBeDefined();
    for (const url of ['https://exemplo.com.br/a', 'https://outroexemplo.com/a']) {
      await expect(svc.shorten(url)).rejects.toThrow('Domínio não permitido');
    }
  });

  it('resolve devolve a URL e 404 para código inexistente ou fora do formato (RN06)', async () => {
    const { svc, shortLink } = service();
    const { link } = await svc.shorten('https://exemplo.com/r');
    await expect(svc.resolve(link.code)).resolves.toBe('https://exemplo.com/r');
    await expect(svc.resolve('zzzzzzz')).rejects.toThrow(NotFoundException);
    shortLink.findUnique.mockClear();
    await expect(svc.resolve('../../x')).rejects.toThrow(NotFoundException);
    expect(shortLink.findUnique).not.toHaveBeenCalled();
  });
});

describe('ApiKeyGuard (RN07)', () => {
  const ctx = (key?: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers: key ? { 'x-api-key': key } : {} }) }),
    }) as unknown as ExecutionContext;

  it('aceita qualquer chave da lista e recusa as demais', () => {
    process.env.API_KEYS = 'chave-a, chave-b';
    const guard = new ApiKeyGuard();
    expect(guard.canActivate(ctx('chave-a'))).toBe(true);
    expect(guard.canActivate(ctx('chave-b'))).toBe(true);
    expect(() => guard.canActivate(ctx('chave-c'))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx())).toThrow(UnauthorizedException);
  });

  it('API_KEYS vazia recusa tudo', () => {
    process.env.API_KEYS = '';
    expect(() => new ApiKeyGuard().canActivate(ctx(''))).toThrow(UnauthorizedException);
  });
});
