# PUSH #38 — Put the first free video above the fold

**Data:** 16/07/2026

**Status:** publicado e validado em produção

**Meta comercial ativa:** 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga

**Placar antes deste PUSH:** 0/10

## Evidência ao vivo

- Depois do PUSH #32, entrou um novo cadastro externo real pelo TAAFT, da Índia.
- A jornada autenticada registrou cadastro por e-mail, quatro chegadas ao gerador e uma visita a pricing.
- O usuário não disparou `analyze_idea_clicked`, não iniciou geração e não criou vídeo.
- O primeiro botão principal do gerador ficava depois de upload de footage, exemplos, seletor de motor e duração.
- A ativação histórica auditada continua baixa: 120 de 317 cadastros externos chegaram a algum vídeo, 37,9%.
- Nas últimas 24 horas havia somente 3 cadastros externos, contra 1 nas 24 horas anteriores; o volume ainda é pequeno demais para reescrever oferta ou preço.

## Diagnóstico

O primeiro valor gratuito existia, mas não era um caminho de um clique para quem escapava ou já havia concluído o modal inicial. Uma pessoa com a ideia já preenchida precisava atravessar controles avançados antes de encontrar `Create my Short`. A visita precoce a pricing, seguida de retornos ao gerador sem `analyze`, é compatível com CTA escondido e confusão entre saldo zero e Fast gratuito.

## Correção

- Contas gratuitas sem nenhum vídeo ganham um CTA primário imediatamente abaixo da ideia preenchida.
- A primeira textarea fica compacta nesse estado, mantendo ideia + CTA no primeiro viewport.
- O CTA promete exatamente o que entrega: Fast preview gratuito, sem cartão e com watermark.
- Um clique usa o mesmo fluxo Autopilot/Fast do onboarding existente: estrutura, analisa e despacha automaticamente.
- Upload, exemplos, motores e duração continuam disponíveis abaixo como configurações opcionais.
- Contas pagas e usuários que já criaram vídeo mantêm a interface existente.
- O guard de processamento impede clique duplicado.

## Medição

O fallback usa a série já existente e deduplicada do primeiro vídeo:

- `viral_onboarding_viewed` com `source=inline_first_video`;
- `viral_onboarding_primary_clicked`;
- `first_video_started_from_viral_onboarding`;
- `first_video_generation_dispatched_from_viral_onboarding`;
- `first_video_generation_completed_from_viral_onboarding` ou falha.

Nenhum prompt, e-mail ou identificador pessoal é gravado nesses eventos.

## Fora do escopo

- Nenhum e-mail, follow-up ou novo segmento acionado.
- Nenhum preço, cupom, crédito ou regra Stripe alterado.
- Nenhum vídeo ou job de provedor executado para QA.
- Nenhum evento artificial criado.
- Nenhuma postagem pública realizada.

## Validação local

- `npm.cmd run build`: aprovado, 146/146 páginas estáticas.
- `git diff --check`: aprovado.
- O build compilou o bundle `/generate` com o novo CTA.
- O typecheck completo ainda reporta diagnósticos preexistentes no arquivo; nenhum ocorre nas regiões alteradas pelo PUSH #38.
- O lint interativo não está configurado no repositório e, portanto, não produz uma checagem automatizada utilizável.

## Arquivos do release

- `app/(dashboard)/generate/GenerateClient.tsx`
- `PUSH-38-RELEASE.md`
- `PUSH-INDEX.md`

## Publicação

- Commit: `ee98fed` (`PUSH #38 put first free video above the fold`).
- Deploy Vercel: `dpl_FfX72ohz59B2spRYKh7WtNJHivir` — `READY`.
- O log da Vercel confirma clone do commit `ee98fed`, compilação bem-sucedida e rota `/generate` no bundle de produção.
- O domínio canônico `https://www.usekineo.com` foi confirmado no mesmo deploy.
- `/generate` respondeu com o redirect autenticado esperado para `/login?redirect=%2Fgenerate`, sem falha de rota.
- A validação não executou JavaScript autenticado nem clicou no CTA; portanto, nenhum evento, render ou custo de provedor foi criado.

## Gate pós-deploy

- View sem clique: revisar posição/copy do CTA, sem mexer no produto inteiro.
- Clique sem dispatch: auditar generate-script/analyze e o efeito Autopilot.
- Dispatch sem conclusão: corrigir o primeiro erro real do pipeline.
- Vídeo concluído sem pricing/checkout: preservar o resultado e revisar o momento do upgrade.
- Continuar contando assinatura somente pela Stripe, excluindo internos/testes.
