<h1 align="center">🔗 Lynko</h1>

<p align="center">
  <b>Encurtador de URL via API — rápido, idempotente e seguro por padrão.</b>
</p>

<p align="center">
  <img alt="Node.js 22" src="https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white">
  <img alt="NestJS 12" src="https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white">
  <img alt="Prisma 7" src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white">
  <img alt="PostgreSQL 17" src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white">
  <img alt="Vitest" src="https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
</p>

---

## 📌 O que é

O **Lynko** é uma API REST que transforma URLs gigantes em links curtos e redireciona quem acessa para o destino original.

```
https://storage.exemplo.com/itens/questao-1432/figura-2.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=9f8e...
                                         ⬇
                          https://lnk.exemplo.com/aB3xK9p
```

Ele nasceu de uma dor real: num sistema de elaboração de questões, os usuários cadastravam imagens por link, e esses links (URLs assinadas, links de drive, parâmetros de redimensionamento) eram tão longos que acabavam quebrando. A saída era abrir um encurtador gratuito em outra aba, colar o link e trazer o resultado de volta. Agora o próprio sistema chama a API do Lynko ao salvar e grava o link curto, sem o usuário sair da tela.

A API não depende desse caso: qualquer sistema com uma API key pode encurtar qualquer link `http`/`https`, seja página, imagem, PDF, vídeo ou formulário.

```mermaid
flowchart LR
    C[Sistema cliente] -- "POST /api/short-links<br/>X-API-Key" --> A[Lynko API]
    A -- "https://dominio/aB3xK9p" --> C
    Q[Navegador / img / download] -- "GET /aB3xK9p" --> A
    A -- "302 Location: URL original" --> Q
    A <--> P[(PostgreSQL)]
```

## ✨ Destaques

- **Idempotente**: a mesma URL sempre devolve o mesmo código, inclusive com requisições simultâneas.
- **Unicidade garantida pelo banco**: colisões de código são tratadas por constraint `UNIQUE` e nova tentativa, sem depender de sorte nem de lock.
- **Seguro por padrão**: autenticação por API key comparada em tempo constante, bloqueio de esquemas perigosos (`javascript:`, `data:`, `file:`…), lista opcional de domínios permitidos contra *open redirect* e bloqueio de link apontando para o próprio encurtador.
- **Enxuto**: uma API e um Postgres. Sem cache, fila ou worker, porque um `SELECT` por chave primária já resolve o redirect.
- **Pronto para produção**: Dockerfile multi-stage, Docker Compose com healthcheck e migrações automáticas no start.
- **Testado**: 17 testes unitários cobrindo todas as regras de negócio (RN01–RN07).

## 🧠 A lógica de encurtamento

Por dentro, um encurtador é uma tabela de duas colunas: **código → URL**. O trabalho todo está em gerar o código, evitar duplicidade e lidar com concorrência.

### 1. Validação e normalização

Antes de tudo, a URL passa por `new URL()`, da própria plataforma:

| Regra | Comportamento |
| --- | --- |
| Esquema | Só `http:` e `https:`. `javascript:`, `ftp:`, `data:`, `file:` e URLs relativas → **400** |
| Tamanho | Até 8192 caracteres, o suficiente para URLs assinadas do S3/Google |
| Credenciais | `https://user:senha@host` é recusada |
| Domínio | Se `ALLOWED_DOMAINS` estiver definida, só aceita esses domínios e seus subdomínios (`exemplo.com` libera `img.exemplo.com`, mas não `exemplo.com.br`) |
| Auto-referência | Link do próprio Lynko é recusado, para não criar link que aponta para link |

A forma canônica é `url.href`: esquema e host em minúsculas, porta padrão removida, caracteres especiais codificados. Assim, `https://Exemplo.com:443/x` e `https://exemplo.com/x` viram a mesma URL.

### 2. Geração do código: `nanoid(7)`

- Alfabeto URL-safe de **64 símbolos** (`A-Z a-z 0-9 _ -`).
- 7 caracteres → 64⁷ ≈ **4,4 trilhões** de combinações.
- Gerado com fonte criptográfica (`crypto`), então não é sequencial nem previsível: ninguém consegue enumerar os links dos outros incrementando um ID.
- O código é a **chave primária** da tabela, e o redirect é uma busca por PK.

### 3. Deduplicação por hash

Indexar a URL inteira não funciona, porque um índice B-tree do Postgres tem limite de tamanho e URLs de 8 KB estouram esse limite. A solução é guardar o **SHA-256** da URL normalizada numa coluna `CHAR(64)` com índice único:

```sql
CREATE TABLE short_links (
  code       TEXT PRIMARY KEY,          -- nanoid(7)
  url        TEXT NOT NULL,             -- URL normalizada
  url_hash   CHAR(64) NOT NULL UNIQUE,  -- sha256(url)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4. O fluxo completo (com concorrência)

```mermaid
flowchart TD
    A[POST url] --> B{Válida?}
    B -- não --> E400[400 Bad Request]
    B -- sim --> C[normaliza + sha256]
    C --> D{url_hash existe?}
    D -- sim --> R200[200 + código existente]
    D -- não --> G["INSERT code = nanoid(7)"]
    G -- ok --> R201[201 Created]
    G -- "P2002 (unique violation)" --> H{url_hash existe agora?}
    H -- "sim: outra requisição gravou a mesma URL" --> R200
    H -- "não: colisão de código" --> T{"< 5 tentativas?"}
    T -- sim --> G
    T -- não --> E500[500]
```

O ponto principal é que **o banco é a fonte da verdade**. Em vez de "verificar e depois inserir", que tem *race condition*, o serviço tenta inserir e interpreta a violação de unicidade:

- conflito no `url_hash` → outra requisição encurtou a mesma URL no mesmo instante, e o serviço devolve o registro dela;
- conflito no `code` → colisão de nanoid (raríssima), e o serviço sorteia outro código.

Isso foi validado contra o Postgres real: 10 requisições paralelas com a mesma URL resultam em **um único código**.

### 5. Redirect: 302, não 301

`GET /{code}` responde **302 Found**. Um 301 fica gravado no cache do navegador para sempre; com 302, a API continua decidindo o destino a cada acesso. Códigos fora do formato `^[A-Za-z0-9_-]{7}$` recebem 404 **sem consultar o banco**.

## 🏗️ Stack

| Camada | Tecnologia |
| --- | --- |
| Runtime | Node.js 22 (ESM) |
| Framework | NestJS 12 |
| Linguagem | TypeScript 6 |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Banco | PostgreSQL 17 |
| Testes | Vitest |
| Lint | oxlint (type-aware) |
| Infra | Docker multi-stage + Docker Compose |

## 🚀 Como rodar

**Pré-requisitos:** Node.js 22 (`nvm use` lê o `.nvmrc`) e Docker.

```bash
git clone https://github.com/luis-hm/Lynko.git
cd Lynko

# 1. Configuração
cp .env.example .env
npm run -s key              # gera uma API key → cole em API_KEYS no .env

# 2. Dependências
npm install

# 3. Banco (só o Postgres no Docker)
docker compose up -d --wait

# 4. Tabelas + client do Prisma
npx prisma migrate dev

# 5. API com hot reload
npm run start:dev
```

A API sobe em `http://localhost:3010`.

### Tudo em Docker (modo produção)

```bash
docker compose --profile prod up -d --build --wait
```

## 📡 Como usar

### Encurtar um link

```bash
curl -i -X POST http://localhost:3010/api/short-links \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: SUA_CHAVE" \
  -d '{"url":"https://www.exemplo.com.br/relatorios/2026/resultado?turma=3B&utm_source=email"}'
```

```http
HTTP/1.1 201 Created

{
  "code": "aB3xK9p",
  "shortUrl": "http://localhost:3010/aB3xK9p",
  "url": "https://www.exemplo.com.br/relatorios/2026/resultado?turma=3B&utm_source=email",
  "createdAt": "2026-11-18T20:41:07.512Z"
}
```

Se a mesma requisição for repetida, a resposta é **200** com o mesmo `code`.

### Acessar o link curto

```bash
curl -i http://localhost:3010/aB3xK9p
```

```http
HTTP/1.1 302 Found
Location: https://www.exemplo.com.br/relatorios/2026/resultado?turma=3B&utm_source=email
```

Também dá para abrir o link no navegador, que vai direto ao destino.

### Endpoints

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/short-links` | `X-API-Key` | Encurta uma URL (201 novo / 200 já existente) |
| `GET` | `/{code}` | pública | Redireciona (302) para a URL original |
| `GET` | `/api/health` | pública | `{"status":"ok"}` se a API alcança o banco |

| Status | Quando |
| --- | --- |
| `400` | URL inválida, esquema não permitido ou domínio bloqueado |
| `401` | `X-API-Key` ausente ou inválida |
| `404` | Código inexistente ou fora do formato |

### Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `PORT` | Porta HTTP da API |
| `PUBLIC_BASE_URL` | Base usada para montar a `shortUrl` (ex.: `https://lnk.exemplo.com`) |
| `API_KEYS` | Chaves aceitas, separadas por vírgula, o que permite rotacionar sem downtime |
| `ALLOWED_DOMAINS` | Domínios de destino permitidos (vazio = qualquer um) |
| `POSTGRES_*` / `DATABASE_URL` | Conexão com o banco |

## 🧪 Testes

```bash
npm test        # 17 testes unitários, sem precisar de banco
npm run lint    # oxlint type-aware
```

Os testes cobrem geração de código, deduplicação, normalização, colisão, *race condition*, validações de URL, lista de domínios, redirect e o guard de API key.

## 📂 Estrutura

```
src/
├── main.ts                       # bootstrap do Nest
├── app.module.ts
├── health.controller.ts          # GET /api/health
├── auth/
│   └── api-key.guard.ts          # X-API-Key com comparação em tempo constante
├── prisma/                       # PrismaService + montagem da conexão
└── short-links/
    ├── short-links.controller.ts # POST /api/short-links
    ├── redirect.controller.ts    # GET /:code
    ├── short-links.service.ts    # toda a regra de negócio
    └── short-links.service.spec.ts
prisma/
├── schema.prisma
└── migrations/
docs/                             # documentação completa (regras, API, arquitetura, deploy)
```

## 🧭 Decisões de projeto

| Decisão | Por quê |
| --- | --- |
| Código aleatório em vez de ID sequencial em base62 | Não expõe volume nem permite enumerar links |
| SHA-256 indexado em vez da URL | URLs longas estouram o limite de índice do Postgres |
| Unicidade no banco em vez de lock na aplicação | Funciona com várias instâncias da API, sem coordenação |
| 302 em vez de 301 | O navegador não fixa o destino em cache para sempre |
| API key em variável de ambiente em vez de tabela | Poucos clientes internos; rotação por lista separada por vírgula |
| Sem contador de acessos | Cada clique viraria uma escrita no banco; entra quando alguém precisar do número |
| Links imutáveis e sem expiração | Um link já publicado precisa continuar funcionando |

## 📚 Documentação

A pasta [`docs/`](docs/README.md) tem a documentação completa do projeto:

- [Visão e escopo](docs/produto/visao-e-escopo.md)
- [Regras de negócio (RN01–RN07)](docs/regras-de-negocio/README.md)
- [Referência da API](docs/api/README.md) · [Guia de integração](docs/api/integracao.md)
- [Arquitetura](docs/arquitetura/visao-geral.md) · [Deploy](docs/arquitetura/deploy.md)
- [Rodar localmente](docs/desenvolvimento/rodar-local.md)
- [Progresso e log de decisões](docs/PROGRESSO.md)

---

<p align="center">
  Feito por <a href="https://github.com/luis-hm">Luis</a>
</p>
