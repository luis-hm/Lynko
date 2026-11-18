# Regras de negócio

> **Contém:** RN01–RN07, agrupadas em validação, código e deduplicação, redirect e acesso.
> **Origem:** pedido do dono do projeto em 18/11/2026; decisões no log do [PROGRESSO.md](../PROGRESSO.md).

### Validação da URL

Todas as falhas de validação respondem **400** e não gravam nada.

| ID | Regra |
| --- | --- |
| RN01 | Só aceita URL absoluta com esquema `http:` ou `https:`. `ftp:`, `javascript:`, `data:`, `file:` e URL relativa são recusados. |
| RN02 | A URL tem no máximo **8192** caracteres, precisa ser aceita por `new URL()` e não pode trazer usuário/senha (`https://user:pass@host/`). |
| RN03 | Se `ALLOWED_DOMAINS` estiver preenchida, o host da URL tem que ser um dos domínios da lista ou subdomínio dele (`exemplo.com` libera `exemplo.com` e `img.exemplo.com`, não `exemplo.com.br` nem `outroexemplo.com`). Vazia, qualquer host vale. Em qualquer caso, URL cujo host é o do próprio agelink (`PUBLIC_BASE_URL`) é recusada, para não criar link que aponta para link. |

O limite de 8192 caracteres cobre URLs assinadas grandes (S3, Google) e fica longe do limite de corpo do Express (100 kB).

### Código e deduplicação

| ID | Regra |
| --- | --- |
| RN04 | O código é `nanoid(7)` com o alfabeto padrão (`A-Z a-z 0-9 _ -`, 64 símbolos, cerca de 4,4 trilhões de combinações). Se o código sorteado já existir, sorteia outro, até **5** tentativas; esgotou, responde **500**. Na prática a colisão é raríssima; o laço existe porque a unicidade é garantida pelo banco, não pela sorte. |
| RN05 | A mesma URL sempre recebe o mesmo código. A URL é normalizada por `new URL(url).href` (esquema e host em minúsculas, porta padrão removida, caracteres especiais codificados); o SHA-256 em hex dessa forma é único na tabela. Já existe: devolve o código existente com **200**. Duas requisições simultâneas com a mesma URL: o índice único barra a segunda, que relê e devolve o registro da primeira. |

A normalização não mexe em caminho, query nem fragmento: `?w=100` e `?w=200` são URLs diferentes e recebem códigos diferentes.

### Redirect

| ID | Regra |
| --- | --- |
| RN06 | `GET /{code}` responde **302** com `Location` igual à URL gravada. Código fora do formato `^[A-Za-z0-9_-]{7}$` responde **404** sem consultar o banco; código inexistente, **404**. Um link nunca expira e a URL de um código nunca muda. |

302 e não 301: o 301 fica gravado no cache do navegador para sempre; com 302 a API continua decidindo o destino a cada acesso.

### Acesso

| ID | Regra |
| --- | --- |
| RN07 | `POST /api/short-links` exige o header `X-API-Key` com uma das chaves de `API_KEYS`; a comparação é feita em tempo constante (`crypto.timingSafeEqual` sobre o SHA-256 das chaves). Sem header ou chave errada: **401**. O redirect e o health são públicos. |
