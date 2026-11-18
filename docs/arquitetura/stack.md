# Stack, configuração e execução

> **Contém:** tecnologias e versões, estrutura do repositório, variáveis de ambiente, portas e como rodar.
> **Origem:** `package.json`, `prisma.config.ts`, `docker-compose.yml`, `Dockerfile` e `.env.example`.

## Stack

| Camada | Tecnologia | Versão |
| --- | --- | --- |
| Runtime | Node.js | 22 (usa `process.loadEnvFile` e ESM nativo) |
| Framework | NestJS, projeto ESM (imports relativos terminam em `.js`) | 12 |
| ORM | Prisma ORM, generator `prisma-client`, `@prisma/adapter-pg` | 7.10.1 |
| Banco | PostgreSQL | 17 (imagem `postgres:17-alpine`) |
| Código curto | nanoid | 6 |
| Hash | `node:crypto` (SHA-256, `timingSafeEqual`) | stdlib |
| Testes / lint | Vitest, oxlint | gerados pelo Nest CLI |

O `.npmrc` tem `legacy-peer-deps=true`: sem isso o `npm install` 10.9 quebra ao resolver os peers opcionais do Vitest (`Cannot read properties of null (reading 'edgesOut')`).

## Repositório

```
agelink/
├── docs/                 # esta documentação
├── prisma/
│   ├── schema.prisma     # modelo ShortLink
│   └── migrations/       # SQL versionado
├── src/                  # ver arquitetura/visao-geral.md
├── prisma.config.ts      # caminho do schema/migrações e conexão para o CLI
├── docker-compose.yml    # Postgres (dev) e Postgres + API (perfil prod)
├── Dockerfile            # imagem de produção da API
├── .env.example          # modelo do .env; única fonte de configuração
└── package.json
```

## Variáveis de ambiente

| Variável | Obrigatória | Exemplo | Uso |
| --- | --- | --- | --- |
| `POSTGRES_USER` | sim | `agelink_user` | Usuário do banco. O Postgres do compose é criado com ele. |
| `POSTGRES_PASSWORD` | sim | senha forte | Senha do banco. Pode ter caracteres especiais (a API codifica ao montar a conexão). |
| `POSTGRES_DB` | sim | `agelink` | Nome do banco. |
| `POSTGRES_HOST` | não (padrão `localhost`) | `localhost` | Onde a API acha o banco. No compose de produção é forçado para `postgres`. |
| `POSTGRES_PORT` | não (padrão 5432) | `5432` | Porta do banco; no compose também é a porta exposta em `127.0.0.1` do host. |
| `DATABASE_URL` | não | `postgresql://u:s@host:5432/db?sslmode=require` | Só para banco externo/gerenciado. Preenchida, substitui as `POSTGRES_*` na conexão (`src/prisma/database-url.ts`). |
| `PORT` | não (padrão 3000) | `3010` | Porta HTTP. O `.env.example` usa 3010 porque a 3000 costuma estar ocupada por outros projetos na máquina de desenvolvimento. |
| `PUBLIC_BASE_URL` | sim | `https://lnk.exemplo.com` | Base da `shortUrl` devolvida, sem barra final. Em produção é o domínio público do agelink. Também define o host recusado pela RN03. |
| `API_KEYS` | sim | `chave-a,chave-b` | Chaves aceitas em `X-API-Key`, separadas por vírgula. Duas chaves permitem trocar sem parar o cliente: adiciona a nova, atualiza os sistemas clientes, remove a antiga. |
| `ALLOWED_DOMAINS` | não | `exemplo.com,cdn.parceiro.com.br` | Domínios de destino permitidos (RN03). Vazia = qualquer domínio. |

Tudo sai do `.env`: o compose lê as `POSTGRES_*` para criar o banco, e a API e o CLI do Prisma montam a conexão com os mesmos valores. Não há senha repetida em outro lugar.

**Atenção:** o Postgres só usa `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` quando o volume está **vazio**. Mudar esses valores depois não altera o banco existente: em dev, `docker compose down -v` recria do zero (apaga os dados); com dados que importam, altere o usuário/senha com `ALTER ROLE` dentro do banco.

Gerar uma chave: `npm run -s key` (32 bytes aleatórios em base64url). Coloque o valor em `API_KEYS` e o mesmo valor no sistema cliente.

## Portas

| Serviço | Porta |
| --- | --- |
| API | `PORT` (3010 no `.env.example`) |
| PostgreSQL (docker-compose) | `POSTGRES_PORT`, só em `127.0.0.1` |

## Como rodar

Local: [desenvolvimento/rodar-local.md](../desenvolvimento/rodar-local.md). Produção: [deploy.md](deploy.md).
