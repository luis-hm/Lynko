# Progresso

> **Contém:** estado atual, próximos passos e log de decisões.
> **Origem:** atualizado a cada entrega.

## Estado

| Etapa | Escopo | Estado |
| --- | --- | --- |
| 00 — Fundação | Documentação, Nest + Prisma, schema e migração inicial, docker-compose com Postgres, módulos vazios | Feita |
| 01 — Encurtar e redirecionar | `ApiKeyGuard`, `ShortLinksService.shorten`/`resolve`, testes de RN01–RN07 | Feita |

O que existe hoje: os três endpoints funcionam. Testes unitários em `src/short-links/short-links.service.spec.ts` (`npm test`, 17 casos). Validado também contra o Postgres real: 201/200/401/400/302/404 e 10 requisições paralelas com a mesma URL recebendo um único código.

Preparação para produção feita: `Dockerfile`, perfil `prod` no compose e configuração toda no `.env` ([deploy](arquitetura/deploy.md)); testada localmente. Falta escolher o servidor e o domínio.

Próximos passos possíveis: subir no servidor; teste e2e automatizado com banco.

## Log de decisões

| Data | Decisão |
| --- | --- |
| 18/11/2026 | Código curto = nanoid de 7 caracteres e é a chave primária da tabela; colisão gera outro código (RN04). |
| 18/11/2026 | Deduplicação pelo SHA-256 da URL normalizada, com índice único em `url_hash`; a URL em si não é indexada porque pode passar do limite de índice do Postgres (RN05). |
| 18/11/2026 | Redirect 302, não 301: o navegador não grava o destino para sempre e a API continua dona do link (RN06). |
| 18/11/2026 | Links não expiram e não são editados: um link curto já publicado tem que continuar funcionando (RN06). |
| 18/11/2026 | Autenticação por `X-API-Key` com as chaves na variável `API_KEYS`, sem tabela de clientes; os clientes são poucos sistemas internos (RN07). |
| 18/11/2026 | Sem contagem de acessos: cada acesso a um link viraria uma escrita no banco. Entra se alguém precisar do número. |
| 18/11/2026 | Prisma 7.10.1 (estável); o `latest` do npm era um RC da versão 8. |
| 18/11/2026 | O agelink é um encurtador de uso geral: aceita qualquer link http/https, de qualquer tipo de conteúdo. O sistema de itens é o primeiro cliente, não o único. |
| 18/11/2026 | Configuração toda no `.env`: o banco é descrito por `POSTGRES_*` (lidas pelo compose e pela API), sem `DATABASE_URL` duplicando a senha; `DATABASE_URL` fica só para banco externo. |
| 18/11/2026 | Produção em Docker Compose: perfil `prod` sobe Postgres + API; migração roda no start do container; portas publicadas só em `127.0.0.1`, atrás de proxy HTTPS. |
