# Kineo — PUSH #31

**Nome:** Real Video Proof + Campaign Safety
**Status:** PUBLICADO, VALIDADO EM PRODUÇÃO E SUBMETIDO AO INDEXNOW
**Data:** 16/07/2026
**Commit de código:** `4ab24bf` — `PUSH #31 add real video watch pages`
**Deploy Vercel:** `dpl_FXQPMmmPju7cJwRwQ31zazywwpFm` — Production · READY

## Evidência que escolheu este push

- O relatório de vídeo do Google Search Console mostra zero vídeos indexados e quatro páginas afetadas por “video is not on a watch page”.
- A homepage usa quatro previews reais, mas cada card enviava diretamente para cadastro; não existia uma página em que o vídeo fosse o conteúdo principal.
- `/examples` continha somente prompts e não tinha canonical, metadados próprios, vídeos ou entrada no sitemap.
- O sitemap público tinha 61 URLs e não enumerava exemplos.
- Três crons de lifecycle continuavam agendados apesar do gate de produção estar atualmente ausente/pausado.
- O banco registra, em 15/07, 3 marcações de activation nudge, 17 de video rescue e 1 de checkout recovery. Os logs da Vercel confirmam ao menos um envio de activation nudge e um de video rescue naquele dia. Nenhum endereço é registrado neste relatório.
- O código de video rescue ainda usa uma oferta aposentada de 50% e não faz parte do Lote 1 aprovado.

## Hipótese

Páginas dedicadas, honestas e indexáveis para os previews reais devem resolver a causa técnica indicada pelo Search Console e dar ao visitante uma prova melhor antes do cadastro. Remover os agendamentos de lifecycle não aprovados impede que o microteste de quatro compradores seja contaminado por outros segmentos.

## Escopo

- Substituir a antiga galeria de prompts por `/examples`, uma landing pública de prova real.
- Criar quatro watch pages estáticas em `/examples/[slug]`.
- Manter uma allow-list explícita somente com assets públicos e founder-owned.
- Informar claramente que cada MP4 é um preview de cinco segundos cortado de um export mais longo.
- Adicionar canonical, Open Graph, `VideoObject` e video sitemap.
- Fazer os cards da homepage abrirem a respectiva watch page.
- Medir somente ações reais: primeiro play e clique de CTA.
- Manter QA local/preview fora do banco de produção pela proteção já existente em `/api/events`.
- Retirar do `vercel.json` os agendamentos de:
  - `send-recovery`;
  - `send-activation-nudge`;
  - `send-video-rescue`.
- Preservar `send-reminders` porque seu sweep de refunds roda antes do gate de e-mail; a parte de outbound continua pausada pelo gate.
- Tornar `/founding` um redirect também no código, além do redirect de edge existente.

## Invariantes

- Nenhum vídeo privado de cliente é exposto.
- Nenhum claim de views, viralidade, receita ou quantidade de clientes é criado.
- Nenhum email, mensagem, anúncio, checkout, pagamento ou render é disparado por este push.
- Announce, base fria, demais segmentos e Product Hunt continuam pausados.
- O Lote 1 permanece limitado aos quatro compradores já contatados.
- Search Console não será alterado sem confirmação explícita do owner.
- O placar comercial continua excluindo contas internas.

## Gate de publicação

1. Auditar os quatro assets, posters, slugs, canonical e structured data.
2. Confirmar que sitemap normal e video sitemap contêm somente URLs públicas allow-listed.
3. Confirmar que `/founding` não contém checkout ou promo aposentada.
4. Confirmar que os três crons não aprovados saíram do agendamento.
5. Rodar TypeScript focal, build completo e `git diff --check`.
6. Testar visualmente `/examples` e uma watch page sem gravar eventos de QA.
7. Revisar stage exato; nunca usar `git add .`.
8. Publicar na `main`, aguardar Vercel READY e validar produção.
9. Submeter IndexNow uma única vez apenas porque existem URLs públicas novas.
10. Não reenviar o sitemap pelo Search Console sem confirmação explícita do owner.

## Medição pós-publicação

- `example_video_play` por slug, somente após play real.
- `example_watch_cta_click` por slug e destino.
- cliques e impressões orgânicas em `/examples` e watch pages.
- cadastros e renders atribuídos a `utm_campaign=push31`.
- assinantes recorrentes externos válidos; meta permanece 10 em 14 dias.

## Validação local concluída em 16/07/2026

- `vercel.json` válido e reduzido a quatro crons: reset de tokens, refund/reminder gated, refresh de Viral Now e refresh de nichos.
- `send-recovery`, `send-activation-nudge` e `send-video-rescue` não estão mais agendados.
- Os quatro MP4s allow-listed têm exatamente 5 segundos e os quatro posters têm 360 × 640 pixels.
- `/examples` respondeu HTTP 200 com canonical, disclosure de preview e sem oferta aposentada.
- As quatro watch pages responderam HTTP 200, cada uma com canonical, vídeo central e `VideoObject`.
- Nenhuma watch page contém URL de render privado/Supabase.
- O sitemap normal contém 66 URLs canônicas e únicas, incluindo `/examples` e quatro watch pages.
- O video sitemap contém exatamente quatro URLs e quatro elementos `video:video`.
- `robots.txt` anuncia os dois sitemaps.
- `/founding` respondeu 308 para `/pricing` e seu código não contém checkout ou promoção.
- QA visual aprovado em desktop e mobile para a galeria e a watch page de Turkmenistan.
- O preview carregou com `readyState=4`, duração 5s e dimensões 360 × 640; o navegador de QA não conseguiu acionar o controle nativo de play automaticamente, portanto nenhum evento foi forjado para simular reprodução.
- Console do navegador: zero warnings e zero errors na watch page.
- `example_video_play`: zero registros; `example_watch_cta_click`: zero registros após QA local.
- TypeScript: 21 erros baseline fora do PUSH #31; zero erro em arquivo do PUSH #31.
- Build completo de produção: aprovado; 146 de 146 páginas geradas.
- `git diff --check`: aprovado.

## Publicação e validação ao vivo concluídas em 16/07/2026

- Commit `4ab24bf` enviado para `origin/main` com stage limitado aos 14 caminhos do PUSH #31.
- O webhook Git não criou o deploy após duas janelas de espera; duas tentativas de criação por referência Git expiraram e não produziram deployment.
- Para não enviar os arquivos pessoais não rastreados da pasta, o deploy foi feito a partir de uma worktree limpa e detached do SHA exato `4ab24bf`.
- A worktree foi verificada como limpa antes do upload e removida após o deploy.
- Deploy `dpl_FXQPMmmPju7cJwRwQ31zazywwpFm` confirmado READY às `2026-07-16T22:43:05.413Z`, com alias atribuído a `www.usekineo.com` e metadata apontando para o SHA correto.
- `/examples` e as quatro watch pages responderam HTTP 200 no domínio canônico.
- As quatro watch pages retornaram canonical e `VideoObject`, usaram somente MP4s locais allow-listed e não expuseram render Supabase de cliente.
- Homepage passou a apontar seus quatro cards de prova para as respectivas watch pages e identifica cada asset como preview.
- Os quatro MP4s e o poster auditado responderam HTTP 200 com MIME correto.
- Sitemap de produção: 66 URLs canônicas e únicas, cinco URLs de exemplos e zero rota privada.
- Video sitemap: quatro URLs e quatro elementos `video:video`.
- `robots.txt` anuncia o sitemap normal e o video sitemap.
- `/founding` responde 308 para `/pricing`.
- O estado do projeto Vercel confirma somente quatro cron definitions:
  - `/api/cron/reset-cinematic-tokens`;
  - `/api/cron/send-reminders`;
  - `/api/cron/refresh-viral-now`;
  - `/api/cron/refresh-niche-trends`.
- QA visual de produção aprovado para galeria e watch page; zero warning e zero error no console.
- A primeira visita visual de QA gravou um `landing_session_started` anônimo em `/examples`. A linha exata foi identificada por nome, path, timestamp e `user_id=null`, removida isoladamente e verificada como ausente; nenhum outro evento foi apagado.
- O dry-run do IndexNow revelou uma assertion do Node 24 causada por `process.exit()` com conexões HTTPS ainda fechando. O script foi corrigido para encerramento natural e o dry-run passou com exit code 0.
- Uma única submissão IndexNow foi executada após o dry-run corrigido: HTTP 200, 66 URLs, `submittedAt=2026-07-16T22:48:42.091Z`.
- HTTP 200 registra recebimento válido, sem alegar indexação ou ranking.
- Search Console não foi alterado e o sitemap não foi reenviado sem confirmação explícita do owner.

## Snapshot comercial pós-publicação

- Baseline externo verificado: 665 perfis; zero novo perfil desde `2026-07-16T21:54:33.250Z`.
- `example_video_play`: zero.
- `example_watch_cta_click`: zero.
- Quatro eventos posteriores ao deploy pertencem à sessão interna do owner (`/admin` → auth callback → `/generate`); zero sinal externo novo.
- Quatro checkout sessions de assinatura desde 15/07: todas `open/unpaid` e vinculadas ao UUID interno do founder; zero checkout externo.
- Duas assinaturas Stripe live `active/trialing`: ambas internas.
- **Assinantes recorrentes externos válidos: 0/10.**
- Nenhum email, mensagem, anúncio, pagamento ou render foi criado pelo PUSH #31.
