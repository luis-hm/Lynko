# API

> **Contém:** convenções, autenticação, todos os endpoints com request/response e o formato de erro.
> **Origem:** regras de [regras-de-negocio/README.md](../regras-de-negocio/README.md); rotas em `src/short-links/` e `src/health.controller.ts`.

## Convenções

- Rotas da API sob `/api/`, sem barra final; o redirect fica na raiz (`/{code}`).
- JSON em UTF-8, campos em camelCase, datas ISO 8601 em UTC.
- Erros no formato padrão do Nest (ver [Erros](#erros)).

## Autenticação

`POST /api/short-links` exige o header **`X-API-Key`** com uma das chaves configuradas em `API_KEYS` (RN07). Sem o header ou com chave errada: **401**. As demais rotas são públicas.

A chave é segredo do backend do sistema cliente: **nunca** vai para o navegador, para o HTML nem para o JavaScript do front.

## Endpoints

| Método e rota | Autenticação | Descrição |
| --- | --- | --- |
| `POST /api/short-links` | `X-API-Key` | Encurta uma URL; devolve o código e a URL curta |
| `GET /{code}` | pública | Redireciona (302) para a URL original |
| `GET /api/health` | pública | `{"status":"ok"}` se a API alcança o banco |

### `POST /api/short-links`

Corpo:

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `url` | string | sim | http/https, absoluta, até 8192 caracteres, sem usuário/senha, domínio permitido (RN01–RN03) |

**Request**

```http
POST /api/short-links HTTP/1.1
Host: lnk.exemplo.com
Content-Type: application/json
X-API-Key: 3c9f…

{
  "url": "https://www.exemplo.com.br/relatorios/2026/resultado-final?turma=3B&utm_source=email&utm_campaign=novembro"
}
```

**Response 201** — link novo

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "code": "aB3xK9p",
  "shortUrl": "https://lnk.exemplo.com/aB3xK9p",
  "url": "https://www.exemplo.com.br/relatorios/2026/resultado-final?turma=3B&utm_source=email&utm_campaign=novembro",
  "createdAt": "2026-11-18T20:41:07.512Z"
}
```

O destino pode ser de qualquer tipo; uma imagem funciona igual:

```json
{ "url": "https://storage.exemplo.com/itens/questao-1432/figura-2.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=9f8e..." }
```

**Response 200** — a mesma URL já tinha sido encurtada (RN05). Mesmo corpo, com o `code` e o `createdAt` originais.

| Campo | Descrição |
| --- | --- |
| `code` | Código de 7 caracteres (`A-Z a-z 0-9 _ -`) |
| `shortUrl` | `PUBLIC_BASE_URL` + `/` + `code`. **É isto que se usa no lugar do link original** (`href`, `<img src>`, mensagem, QR code…). |
| `url` | URL original normalizada (pode diferir da enviada em minúsculas do host ou codificação; ver RN05) |
| `createdAt` | Quando o código foi criado |

**Erros**

| Status | Quando | `message` (exemplos) |
| --- | --- | --- |
| 400 | `url` ausente, não é string ou não é URL válida | `"url inválida"` |
| 400 | Esquema diferente de http/https | `"Só são aceitas URLs http ou https"` |
| 400 | Mais de 8192 caracteres ou com usuário/senha | `"url inválida"` |
| 400 | Domínio fora de `ALLOWED_DOMAINS` ou do próprio agelink | `"Domínio não permitido"` |
| 401 | `X-API-Key` ausente ou inválida | `"Unauthorized"` |
| 500 | 5 colisões seguidas de código (RN04) ou falha do banco | `"Internal server error"` |

Repetir a mesma chamada é seguro: a deduplicação torna o `POST` idempotente para a mesma URL.

### `GET /{code}`

Usado por quem abre o link curto (navegador, `<img>`, download, outro programa), não pelo sistema cliente.

**Request**

```http
GET /aB3xK9p HTTP/1.1
Host: lnk.exemplo.com
```

**Response 302**

```http
HTTP/1.1 302 Found
Location: https://www.exemplo.com.br/relatorios/2026/resultado-final?turma=3B&utm_source=email&utm_campaign=novembro
```

**Response 404** — código fora do formato `^[A-Za-z0-9_-]{7}$` ou inexistente (RN06).

```json
{ "message": "Not Found", "statusCode": 404 }
```

### `GET /api/health`

```http
GET /api/health HTTP/1.1
```

```json
{ "status": "ok" }
```

Sem banco, responde 500.

## Erros

Formato padrão do Nest:

```json
{ "message": "Só são aceitas URLs http ou https", "error": "Bad Request", "statusCode": 400 }
```

`error` aparece quando há `message` personalizada; o cliente deve decidir pelo **status HTTP**, não pelo texto.

Como chamar a partir de outro sistema: [integracao.md](integracao.md).
