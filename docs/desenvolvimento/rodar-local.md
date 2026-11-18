# Rodar a API localmente

> **Contém:** pré-requisitos, passo a passo do zero, como testar cada endpoint, o dia a dia e problemas comuns.
> **Origem:** fluxo verificado em 18/11/2026 (`npm run start:dev` + Postgres do compose).

## Pré-requisitos

| Ferramenta | Versão | Conferir |
| --- | --- | --- |
| Node.js | 22 (fixado no `.nvmrc`; o nanoid 6 exige Node 22+) | `node -v` |
| npm | 10 | `npm -v` |
| Docker com Compose | qualquer recente | `docker compose version` |

A API roda direto no Node (com reload ao salvar); só o Postgres roda no Docker.

Se o seu Node padrão é outro (ex.: 20), entre na pasta e rode `nvm use`: ele lê o `.nvmrc` e troca para o 22 só nesse terminal. Se faltar a versão, `nvm install` baixa.

## Primeira vez

```bash
cd agelink
nvm use                   # Node 22 do .nvmrc

# 1. Configuração
cp .env.example .env
npm run -s key            # gera uma API key; cole em API_KEYS no .env
```

Abra o `.env` e confira:

| Variável | Para rodar local |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Qualquer valor. Defina **antes** do passo 3: o banco é criado com eles. |
| `POSTGRES_HOST` / `POSTGRES_PORT` | `localhost` / `5432` (troque a porta se a 5432 já estiver em uso). |
| `PORT` | `3010` |
| `PUBLIC_BASE_URL` | `http://localhost:3010` (mesma porta do `PORT`) |
| `API_KEYS` | A chave gerada acima |
| `ALLOWED_DOMAINS` | Vazio (aceita qualquer link) |

```bash
# 2. Dependências
npm install

# 3. Banco
docker compose up -d --wait   # sobe só o Postgres

# 4. Tabelas e client do Prisma
npx prisma migrate dev

# 5. API com reload automático
npm run start:dev
```

A primeira compilação leva uns 30 segundos. Pronto quando aparecer `Nest application successfully started`.

## Testar

Em outro terminal, com a chave do `.env`:

```bash
export KEY='cole-aqui-a-chave-do-API_KEYS'
```

**Health**

```bash
curl http://localhost:3010/api/health
# {"status":"ok"}
```

**Encurtar**

```bash
curl -i -X POST http://localhost:3010/api/short-links \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $KEY" \
  -d '{"url":"https://www.exemplo.com.br/pagina?x=1"}'
# HTTP/1.1 201 Created
# {"code":"Chni2uG","shortUrl":"http://localhost:3010/Chni2uG",...}
```

Rode de novo com a mesma URL: volta **200** com o mesmo `code`.

**Abrir o link curto**

```bash
curl -i http://localhost:3010/Chni2uG
# HTTP/1.1 302 Found
# Location: https://www.exemplo.com.br/pagina?x=1
```

Ou cole `http://localhost:3010/Chni2uG` no navegador: ele vai direto para o destino.

**Casos de erro**

```bash
# sem chave → 401
curl -i -X POST http://localhost:3010/api/short-links -H 'Content-Type: application/json' -d '{"url":"https://x.com"}'

# esquema inválido → 400
curl -i -X POST http://localhost:3010/api/short-links -H 'Content-Type: application/json' -H "X-API-Key: $KEY" -d '{"url":"ftp://x.com/a"}'

# código inexistente → 404
curl -i http://localhost:3010/zzzzzzz
```

Referência completa dos endpoints: [api/README.md](../api/README.md).

## Dia a dia

```bash
nvm use                       # se o terminal estiver em outro Node
docker compose up -d --wait   # se o Postgres não estiver de pé
npm run start:dev
```

| Comando | O quê |
| --- | --- |
| `npm test` | Testes unitários (não precisam do banco) |
| `npm run lint` | oxlint |
| `npx prisma studio` | Ver e editar a tabela no navegador |
| `npx prisma migrate dev --name <descricao>` | Depois de mudar `prisma/schema.prisma`: cria a migração e regenera o client |
| `docker compose stop` | Para o Postgres, mantém os dados |
| `docker compose down -v` | Para o Postgres e **apaga** o banco (o próximo `up` cria do zero com o `.env` atual) |

## Rodar a imagem de produção localmente

Para testar exatamente o que vai para o servidor (API dentro do Docker):

```bash
docker compose --profile prod up -d --build --wait
curl http://localhost:3010/api/health
docker compose --profile prod stop api    # libera a porta para o npm run start:dev
```

Detalhes em [deploy.md](../arquitetura/deploy.md).

## Problemas comuns

| Sintoma | Causa | Solução |
| --- | --- | --- |
| `P1000: Authentication failed` ou `role "..." does not exist` | Mudou `POSTGRES_USER`/`POSTGRES_PASSWORD` depois que o volume foi criado; o Postgres só lê esses valores na primeira vez. | Em dev: `docker compose down -v` e `docker compose up -d --wait`, depois `npx prisma migrate dev`. Apaga os dados locais. |
| `Faltam variáveis de banco no ambiente: ...` | `.env` sem as `POSTGRES_*` (ou o comando não foi rodado na pasta do projeto). | Confira o `.env` contra o `.env.example`. |
| `EADDRINUSE :::3010` | Outra coisa na porta (outro projeto, ou o container `api` do perfil prod). | `docker compose --profile prod stop api`, ou troque `PORT` e `PUBLIC_BASE_URL`. |
| `Bind for 127.0.0.1:5432 failed: port is already allocated` | Outro Postgres usando a 5432. | Troque `POSTGRES_PORT` no `.env` (ex.: `5433`) e suba de novo. |
| `EBADENGINE` no `npm install`, ou erro ao importar `nanoid`/Prisma | Terminal no Node 20 (ou outro). | `nvm use` na pasta do projeto. |
| Erro de import em `generated/prisma` | Client do Prisma não gerado (pasta fora do git). | `npx prisma generate` |
| `npm install` falha com `reading 'edgesOut'` | Bug do npm com peers do Vitest. | O `.npmrc` do projeto já resolve; confira se ele existe. |
| `401` mesmo com a chave | Chave diferente da do `.env`, espaço extra ou o `.env` foi alterado com a API rodando. | Reinicie o `npm run start:dev` após mudar o `.env`. |
| `400 Domínio não permitido` para `http://localhost:3010/...` | A API recusa encurtar links dela mesma (RN03). | Use uma URL de outro host. |
