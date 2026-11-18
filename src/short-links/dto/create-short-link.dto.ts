export class CreateShortLinkDto {
  url: string;
}

export class ShortLinkResponseDto {
  code: string;
  shortUrl: string;
  url: string;
  createdAt: Date;
}
