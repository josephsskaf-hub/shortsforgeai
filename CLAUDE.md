# CLAUDE.md — Regras Permanentes para todas as sessões
# App versão atual: v2.2 ✅ (estável — commit #287, deploy READY)

## ✅ Status da v2.2 (confirmado em 26/05/2026)
- Home page: carregando corretamente, sem crash
- Planos: Basic $4.90 / Pro $9.90 visíveis, sem card free
- Legenda dupla: corrigida — só 1 legenda branca (sem palavras amarelas)
- Geração de vídeo: funcionando — "5 Ocean Secrets" gerado com sucesso (45s, viral score 85/100)
- Coerência visual: pipeline `generateScenes()` operacional
- Funil de signup: novos usuários vão direto para /pricing (não /generate)
- Welcome email: atualizado — sem texto "crédito grátis" (removido no #270)
- Hero: menos padding no topo, h1 menor, prompt box maior (#284)
- Commits chave desta versão:
  - #277: removida legenda amarela dupla (`buildCaptionElements` → só `baseCaption`)
  - #278: `HomePageClient.tsx` sem null bytes
  - #279: `app/start/page.tsx` truncation fix (SWC parse error corrigido)
  - #280: `lib/pricing.ts` — export `PLAN_LIST` restaurado (crash `.map()` corrigido)
  - #281: `app/auth/callback/route.ts` + `signup/page.tsx` — novos usuários → /pricing
  - #282: `app/api/send-welcome/route.ts` — welcome email sem cópia de crédito grátis
  - #283: `lib/pricing.ts` — export duplicado `PLAN_LIST` removido (TS2300 corrigido)
  - #284: `HomePageClient.tsx` — hero padding reduzido, h1 menor, prompt box maior
  - #285: `signup/page.tsx` — CRLF→LF (SWC parse error corrigido)
  - #286: `send-welcome/route.ts` — truncation fix (eof SWC error corrigido)
  - #287: `auth/callback/route.ts` — truncation fix (eof SWC error corrigido)

## ⚠️ REGRA CRÍTICA — InVideo
**SEMPRE usar modo AUTOPILOT. NUNCA usar Agent One Pro.**
- Agent One Pro consome créditos demais e esgota a conta
- Autopilot usa 1–4 créditos por vídeo e gera automaticamente
- Se não tiver opção de Autopilot visível, perguntar ao usuário antes de prosseguir
- Se os créditos estiverem zerados, parar e avisar o usuário imediatamente

## Configuração dos vídeos InVideo
- **Somente 1 legenda/subtitle** por vídeo (não múltiplas)
- **Último segundo do vídeo:** incluir call to action com o site → **shortsforgeai.com**
- Formato: YouTube Shorts (9:16, vertical)
- Duração: ~35 segundos
- Estilo: dark, cinematic, fast-paced
- Idioma: Inglês
- Escolher sempre os temas com maior potencial viral (baseado nos Shorts que já performaram bem)

## Workflow de vídeos diários
1. Verificar no YouTube Studio quais Shorts tiveram mais views/engajamento
2. Escolher 5 temas similares aos que viralizaram
3. Criar vídeos no InVideo com **Autopilot** (YouTube Shorts, 9:16, ~35s)
4. Configurar: 1 legenda + shortsforgeai.com no último segundo
5. Usuário baixa e sobe no YouTube

## Informações do projeto
- Canal: Money Facts / Finanças em inglês
- App: https://shortsforgeai.vercel.app
- Repo GitHub: josephsskaf-hub/shortsforgeai (branch main)
- Email: josephsskaf@gmail.com
- Push para GitHub: criar .bat e rodar via computer use
