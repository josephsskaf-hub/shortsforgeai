# CLAUDE.md — Regras Permanentes para todas as sessões
# App versão atual: v2.4 ✅ (estável — commit #307, deploy READY)

## ✅ Status da v2.4 (confirmado em 27/05/2026)
- Viral Now: 3 cards trending diários em /viral-now + dashboard, 1 click = gera vídeo
- Viral script fast-path: voiceovers parsed EM CÓDIGO — GPT só gera visual layer (#307)
- Marcadores todos em inglês: HOOK, MICRO REWARD, ESCALATION, PAYOFF (#306)
- Dashboard viral cards: cores por vertical (billionaire=amber, mystery=purple, country=blue) (#305)
- Nav: "My Videos" substituído por "🔥 Viral Now" em sidebar, mobile nav, e top menu (#302-303)
- Commits chave desta versão:
  - #301: Viral Now — tabela Supabase, API route, cards no dashboard, cron 6AM UTC
  - #302: Sidebar + MobileNav — My Videos → Viral Now
  - #303: Homepage top menu + página dedicada /viral-now
  - #304: Prompts reescritos com formula viral completa (Hook+MR×3-5+Escalation+Payoff)
  - #305: analyze-idea detecta scripts virais → cores por vertical no dashboard
  - #306: Substituição de MICRO RECOMPENSA/ESCALADA/RITMO → MICRO REWARD/ESCALATION/RHYTHM (inglês)
  - #307: VIRAL FAST-PATH — parseViralScriptSections() em código; voiceovers NUNCA reescritos pelo GPT; GPT só adiciona visual_prompt + caption; garantia de conteúdo específico no vídeo

## Arquitetura do pipeline de geração (v2.4)
1. Usuário clica card Viral Now → `/generate?prompt=FULL_SCRIPT&autoanalyze=1&autogenerate=1&duration=45`
2. `analyze-idea` recebe o script → `parseViralScriptSections()` detecta HOOK/MICRO REWARD/ESCALATION/PAYOFF em código TypeScript → voiceovers extraídos verbatim → GPT-4o-mini só gera visual_prompt + caption por cena (temperature 0.5)
3. `scenes` recebe voiceover_script → detecta markers → divide exatamente em HOOK/MR/ESCALATION/PAYOFF → busca B-roll correto no Pexels
4. Vídeo composto com cenas alinhadas à formula viral, conteúdo específico garantido (ex: Sodder children, DB Cooper, Beaumont)

## ⚠️ REGRA CRÍTICA: ao modificar componentes, sempre buscar os pares
- Sidebar.tsx → verificar MobileNav.tsx e HomePageClient.tsx (nav do top menu público)
- Viral Now cards → verificar DashboardClient.tsx E ViralNowClient.tsx (ambos renderizam cards)
- viral-now/route.ts (FALLBACK_TOPICS) → verificar cron/refresh-viral-now/route.ts (TOPIC_POOL)

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
