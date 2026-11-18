# Documentação do agelink

> **Contém:** o índice da documentação e qual arquivo responde a qual pergunta.
> **Origem:** pedido do dono do projeto em 18/11/2026; estrutura no padrão da documentação do Varal.

Sessão nova começa por [PROGRESSO.md](PROGRESSO.md).

| Pergunta | Arquivo |
| --- | --- |
| Em que ponto estamos? O que já foi decidido? | [PROGRESSO.md](PROGRESSO.md) |
| Para que serve o agelink? O que fica fora? | [produto/visao-e-escopo.md](produto/visao-e-escopo.md) |
| Como acontece encurtar e acessar um link? | [casos-de-uso/README.md](casos-de-uso/README.md) |
| Qual é a regra RNxx (validação, código, deduplicação, redirect)? | [regras-de-negocio/README.md](regras-de-negocio/README.md) |
| Quais tabelas e campos existem? | [dados/modelo.md](dados/modelo.md) |
| Como as peças conversam? Quais módulos existem e o que cada um tem? | [arquitetura/visao-geral.md](arquitetura/visao-geral.md) |
| Que versões, portas e variáveis de ambiente? Como rodar? | [arquitetura/stack.md](arquitetura/stack.md) |
| Como rodar a API na minha máquina? | [desenvolvimento/rodar-local.md](desenvolvimento/rodar-local.md) |
| Como subir em produção? | [arquitetura/deploy.md](arquitetura/deploy.md) |
| Quais endpoints existem, com request e response? | [api/README.md](api/README.md) |
| Como outro sistema chama a API? | [api/integracao.md](api/integracao.md) |

## Regras

- Docs mudam no **mesmo commit** que o código que os afeta.
- Mudar uma regra de negócio exige registrar a decisão no log do [PROGRESSO.md](PROGRESSO.md).
- O código cita as regras pelo ID (`RN04`); o ID não muda nem é reaproveitado.
