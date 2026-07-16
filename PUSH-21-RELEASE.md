# Kineo — PUSH #21

**Nome:** Activation Proof + First-Video Conversion
**Status:** VALIDADO LOCALMENTE — aguardando commit, deploy READY e validação ao vivo
**Data de preparação:** 16/07/2026

## Problema comprovado

- Os cadastros externos recentes concluíram autenticação, mas não há prova confiável de chegada ao gerador.
- `generate_page_view` dependia apenas do navegador e podia se perder em abandono precoce, bloqueio de analytics ou falha de sessão.
- Contas gratuitas começam corretamente com 0 créditos, pois o Fast gratuito não consome créditos, mas a primeira tela mostrava “0 credits left” e “Upgrade to keep creating”.
- Essa mensagem contradizia a oferta de até 3 vídeos Fast com marca d'água a cada 24 horas exatamente no momento de ativação.

## Escopo

- Registrar `auth_callback_completed` no servidor antes do redirect OAuth.
- Registrar `auth_callback_failed` sem guardar código OAuth, erro sensível ou PII.
- Registrar `email_signup_completed` no servidor para o cadastro por senha com confirmação automática.
- Registrar `generate_arrived_server` para cada chegada autenticada ao gerador.
- Registrar `generate_activation_auth_missing` quando uma chegada pós-cadastro perde a sessão.
- Bloquear falsificação desses quatro eventos pelo endpoint genérico do navegador.
- Resolver no servidor a ausência de sessão e preservar a URL completa para login e retomada.
- Substituir o aviso enganoso de 0 créditos por “Fast previews are free” em contas gratuitas usando Fast.
- Exibir de forma direta: até 3 previews/24h, marca d'água e nenhum cartão.
- Manter saldo de créditos visível e correto para contas pagantes e motores premium.
- Exibir os novos eventos autoritativos no painel Admin · Funnel com filtro por período.

## Gate de publicação

1. TypeScript sem novos erros nos arquivos do PUSH #21.
2. Build de produção completo.
3. `git diff --check` limpo.
4. Revisão exata dos arquivos staged; nunca usar `git add .`.
5. Deploy Vercel READY.
6. Validar ao vivo uma chegada autenticada sem gerar trabalho pago de provider.
7. Confirmar no banco `generate_arrived_server` com usuário interno e nenhuma ocorrência falsa de `generate_activation_auth_missing`.
8. Medir os próximos cadastros externos por: callback concluído → gerador → primeiro clique → render concluído.

## Validação local concluída em 16/07/2026

- Build de produção concluído com sucesso: 140/140 páginas.
- TypeScript: somente os 22 erros baseline já conhecidos; zero erro novo nos arquivos do PUSH #21.
- `git diff --check` sem erros.
- Chegada anônima em `/generate?prompt=hello` retorna 307 e preserva o destino completo no login.
- Endpoint de confirmação direta por e-mail retorna 401 sem sessão.
- Tentativa de forjar `generate_arrived_server` pelo endpoint genérico é ignorada e não gravada.
- Nenhum job pago de provider foi criado durante a validação.

## Meta imediata

Nos próximos cinco cadastros externos válidos:

- pelo menos 80% devem chegar autenticados ao gerador;
- pelo menos 50% dos que chegam devem iniciar a criação;
- pelo menos 30% dos cadastros devem concluir o primeiro vídeo Fast.

O PUSH #21 melhora e prova a ativação. Ele não autoriza ampliar e-mail, base fria, announce ou publicar Product Hunt.
