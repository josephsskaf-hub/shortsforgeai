# Kineo — PUSH #20

**Nome:** Free-to-Paid Conversion + Protected Premium Exports
**Status:** VALIDADO LOCALMENTE — aguardando commit, deploy READY e validação ao vivo
**Data de preparação:** 16/07/2026

## Objetivo

Unificar a oferta gratuita, aumentar a conversão para Starter/Creator e impedir que vídeos premium, URLs de provider ou créditos sejam explorados por retry, concorrência, alteração de parâmetros ou reembolso indevido.

## Escopo do PUSH #20

- Oferta gratuita canônica: até 3 vídeos Fast com marca d'água a cada 24 horas.
- Fast limpo para pagantes: 1 crédito por vídeo.
- Premium AI, Avatar e Presenter disponíveis apenas para contas pagantes com saldo.
- Copy de landing, pricing, login, cadastro, conta, Generate e histórico alinhada à oferta real.
- Watermark e rótulo clean calculados por asset, não pelo plano atual do usuário.
- Compartilhamento público de vídeos em `/v/[id]` com ownership e metadados protegidos.
- Claims assinadas e geração idempotente para compose, cinematic e avatar.
- Débito determinístico antes do primeiro trabalho pago de Fal.
- Request IDs, modelos, URLs concluídas, qualidade e custo vinculados no servidor.
- Retry ambíguo não pode criar um segundo job pago.
- Falha real antes do provider confirma refund antes de liberar a claim.
- Falha downstream não devolve créditos quando o raw asset pago já foi entregue.
- Avatar Status exige claim assinada; `avatar_jobs` não concede autorização.
- Débitos upfront deixam de ser contados novamente como holds ativos.
- Submissões ambíguas preservam cenas já aceitas sem reenviar jobs pagos.
- Claims pendentes sem request ID expiram com reconciliação e refund confirmado.
- Eventos, modal de upgrade, planos Starter/Creator/Studio e mensagens de saldo corrigidos.

## Validação local concluída em 16/07/2026

- Avatar prepaid concluído de geração até compose/status.
- Auditoria focal sem novos erros TypeScript nos arquivos do PUSH #20.
- Os 22 erros TypeScript restantes são o baseline já conhecido fora deste release.
- Build de produção concluído com sucesso: 140/140 páginas.
- `git diff --check` sem erros.
- Nenhum POST pago Fal usa retry cego nos caminhos auditados.

## Gate obrigatório antes de publicar

1. Concluir Avatar prepaid de ponta a ponta.
2. Reauditar cinematic, avatar, compose, status, unlock e refunds.
3. Rodar TypeScript e confirmar somente erros baseline conhecidos.
4. Rodar build completo com todas as rotas geradas.
5. Rodar `git diff --check`.
6. Revisar a lista exata de arquivos staged; nunca usar `git add .`.
7. Commitar e enviar para `main`.
8. Aguardar Vercel READY.
9. Validar ao vivo landing, pricing, autenticação, Fast gratuito e bloqueios premium sem gerar jobs pagos de teste.

## Próximos pushes nomeados

### PUSH #21 — Activation Proof + First-Video Conversion

- Reduzir tempo até o primeiro Fast concluído.
- Mostrar prova real e CTA de upgrade no pico de satisfação.
- Medir signup → primeiro render → pricing → checkout por coorte.
- Recuperar usuários que criaram vídeo gratuito mas não iniciaram checkout.

### PUSH #22 — Organic Acquisition Recovery

- Restaurar tráfego de diretórios e páginas de alta intenção.
- Publicar comparativos e landing pages por caso de uso com atribuição UTM.
- Product Hunt permanece sujeito ao gate explícito do owner.
- Não tocar base fria nem announce sem aprovação.

### PUSH #23 — Creator Loop + Referral Distribution

- Compartilhamento com marca Kineo e CTA rastreável.
- Templates reutilizáveis por nicho.
- Referral somente com recompensa financeiramente sustentável e antifraude.

### PUSH #24 — Retention + Recurring Shows

- Reforçar Character Lock, mesma voz e mesma estética entre episódios.
- Facilitar continuação de série e calendário recorrente.
- Medir segundo vídeo, retorno em 7 dias e risco de cancelamento.

## Meta comercial vinculada

Chegar a pelo menos 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga. A publicação técnica do PUSH #20 é necessária, mas não encerra a meta.
