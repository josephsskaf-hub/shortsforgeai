# Kineo — PUSH #32

**Nome:** Search-Led Topic Intent
**Status:** VALIDADO LOCALMENTE — aguardando commit, deploy READY e validação em produção
**Data:** 16/07/2026

## Diagnóstico que escolheu este push

Auditoria ao vivo concluída em `2026-07-16T23:01:35.945Z`, excluindo as contas internas conhecidas:

- 665 perfis externos e zero assinante recorrente externo válido.
- 42 cadastros externos nos últimos sete dias contra 275 nos sete dias anteriores.
- A ativação não caiu junto: 38,1% da coorte recente criou vídeo contra 37,8% da coorte anterior.
- A queda, portanto, veio principalmente do fim do pico de distribuição dos diretórios entre 4 e 10 de julho, não de uma quebra comprovada na primeira geração.
- Em 60 dias, 37 usuários externos abriram 61 sessões de checkout recorrente; todas expiraram sem pagamento.
- As três referências de assinatura guardadas em perfis externos apontam para `incomplete_expired`, não para assinaturas ativas.
- A última sessão externa desse conjunto foi em 11/07, antes da oferta e do fluxo de checkout atuais; o histórico prova perda de conversão, mas não prova que o checkout publicado em 15/07 esteja quebrado.

## Evidência do Search Console

Consulta somente de leitura, sem reenviar sitemap nem solicitar indexação:

- Período disponível: 01/07 a 14/07.
- Total: 7 cliques, 123 impressões, CTR 5,7% e posição média 13.
- Homepage: 5 cliques e 67 impressões.
- Pricing: 1 clique e 36 impressões.
- `/youtube-shorts-from-topic`: 1 clique, 3 impressões, CTR 33,3% e posição média 4.
- Essa foi a única página não institucional com evidência simultânea de ranking alto e clique orgânico; por isso ela recebeu o investimento do PUSH #32.

## O que mudou

- Novo formulário de intenção diretamente em `/youtube-shorts-from-topic`.
- O visitante digita o tema antes do cadastro; `prompt` e o marcador `intent_campaign=push32_topic_intent` seguem por GET até `/signup`, e o prompt continua até o gerador.
- O marcador de intenção é persistido por no máximo 24 horas, inclusive durante OAuth, sem substituir a origem real, o referrer ou a campanha externa de primeira visita.
- Três sugestões editáveis reduzem o blank canvas sem escolher conteúdo pelo usuário.
- Preview real e allow-listed de cinco segundos adicionado à página, com disclosure do corte e da duração do export original.
- Nenhum render de cliente ou URL privada entra na página.
- `FAQPage`, `HowTo` e `VideoObject` descrevem somente conteúdo visível e verificável.
- A home agora liga `Examples` à galeria pública e aponta contextualmente para o fluxo topic-to-Short.
- A prioridade da página comprovada sobe de 0,8 para 0,9 no sitemap.
- `example_video_play` recebe `placement=youtube_shorts_from_topic` e `version=push32` no primeiro play real.
- Novo evento `organic_topic_submitted` mede o envio real do formulário.
- O painel orgânico passa a contar CTA clicks mais topic submits e atribui campanhas `push22_`, `push32_` e fontes `seo/organic` já existentes.

## Critério de medição após o deploy

Não escalar conteúdo no escuro. Medir por 48 horas:

1. sessões externas em `/youtube-shorts-from-topic`;
2. `organic_topic_submitted`;
3. cadastros com campanha `push32_topic_intent`;
4. primeiro vídeo concluído;
5. pricing view, checkout started e assinatura recorrente externa.

O próximo investimento orgânico só replica a estrutura se houver intenção ou ativação real. Se houver sessões sem submit, revisar a primeira dobra. Se houver submit sem cadastro, revisar a transição de autenticação. Se houver cadastro e vídeo sem checkout, revisar a oferta pós-resultado.

## Validação local

- TypeScript: 20 erros baseline fora do PUSH #32; zero erro em arquivo do PUSH #32.
- Build completo de produção: aprovado; 146 de 146 páginas geradas.
- Desktop: primeira dobra, formulário e preview real aprovados visualmente.
- HTML local HTTP 200 contém formulário, campo `prompt`, `intent_campaign=push32_topic_intent`, `FAQPage`, `HowTo` e `VideoObject`.
- O formulário não contém UTMs internas que poderiam apagar a origem verdadeira do visitante.
- HTML local não contém URL privada Supabase, `FOUNDING50` nem claim “50% for life”.
- `git diff --check`: aprovado.

## Guardrails

- Nenhum email, mensagem, anúncio, pagamento ou render foi criado.
- Lote 1, announce e demais segmentos continuam pausados.
- Search Console não foi alterado.
- IndexNow não será reenviado neste push antes do deploy.
- Assinantes recorrentes externos válidos no baseline: **0/10**.
