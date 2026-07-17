# PUSH #37 — Private pack upgrade must fail closed

**Data:** 16/07/2026

**Status:** pronto para publicação

**Meta comercial ativa:** 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga

**Placar antes deste PUSH:** 0/10

## Evidência

- O Lote 1 contém somente quatro compradores reais do pack de US$4.90; nenhum outro segmento foi acionado.
- A promessa individual é Creator por mais US$5 agora, com renovação normal em 30 dias; para o comprador em INR, o equivalente configurado é ₹405 agora e ₹1,599/mês depois.
- Os quatro promotion codes foram revalidados na Stripe como ativos, individuais, de uso único e sem resgates.
- O checkout anterior ignorava silenciosamente um promotion code inválido ou indisponível e continuava pelo preço cheio.
- O valor enviado à página de sucesso continuava sendo o preço cheio, mesmo quando a Stripe cobrava o valor promocional.
- Ao cancelar e tentar novamente, a página de retry descartava o promotion code e mostrava o preço normal.

## Correção

- Todo código privado com prefixo `KINEO5-` agora falha fechado: se preço, moeda, cliente, validade ou desconto não puderem ser confirmados, nenhuma Checkout Session é criada.
- A oferta privada só é aceita para Creator mensal, sem combinação com a oferta introdutória.
- O servidor valida código ativo, expiração, limite de uso, restrição por cliente, coupon válido, duração `once`, moeda e cobrança inicial exata.
- A página de erro declara explicitamente que o comprador não foi cobrado e orienta responder a Joseph.
- O valor da página de sucesso e da medição passa a refletir a primeira cobrança real: US$5 ou ₹405.
- Checkout Session e assinatura recebem `offer=kineo5_pack_upgrade`, sem armazenar o código individual nos eventos.
- O cancelamento preserva plano, período, moeda e promotion code no retry e mostra cobrança atual e renovação corretas.
- Erros de verificação não escrevem o código privado completo nos logs.
- Códigos promocionais comuns continuam com o comportamento já existente; a regra fail-closed é restrita à oferta privada.

## Privacidade

- Nenhum e-mail, código individual ou link privado faz parte deste release.
- Os quatro códigos foram comparados localmente com o índice Git: zero ocorrência em arquivos rastreados.
- O arquivo privado do Lote 1 continua local e fora do stage.

## Fora do escopo

- Nenhum e-mail ou follow-up foi enviado.
- Nenhuma Checkout Session foi criada para QA.
- Nenhuma cobrança, resgate de promotion code ou evento falso foi produzido.
- Nenhuma ampliação para outros segmentos foi realizada.

## Validação local

- `npm.cmd run build`: aprovado, 146/146 páginas estáticas.
- `git diff --check`: aprovado.
- TypeScript: nenhum erro reportado nos dois arquivos alterados; o baseline geral ainda contém diagnósticos preexistentes fora deste escopo.
- Quatro tokens privados inspecionados; zero ocorrência em arquivos rastreados.
- Validação estática confirma os caminhos fail-closed, o valor promocional na success URL, metadados da oferta e preservação do promotion code no retry.

## Arquivos do release

- `app/api/stripe/checkout/route.ts`
- `app/checkout/cancelled/page.tsx`
- `PUSH-37-RELEASE.md`
- `PUSH-INDEX.md`

## Publicação

- Commit: pendente.
- Deploy Vercel: pendente.
- Validação de produção: pendente.

## Gate pós-deploy

- Resposta `UPGRADE`: enviar somente o link individual já auditado.
- Checkout iniciado: confirmar `private_offer_applied=true` e o valor inicial correto.
- Assinatura: confirmar na Stripe status `active`/`trialing`, comprador externo e renovação normal.
- Código inválido ou indisponível: confirmar erro claro e ausência de Checkout Session.
- Não ampliar o Lote 1 antes de fechar a janela de 48 horas e observar sinal real.
