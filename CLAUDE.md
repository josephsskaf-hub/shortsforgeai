# CLAUDE.md — Regras Permanentes para todas as sessões
# App versão atual: v3.0-dev 🚧 (Phase 1 B-roll Intelligence in progress)
# v3.0 IN PROGRESS — Phase 1: B-roll Intelligence System (Visual Director)
# New files: lib/broll/*, app/api/generate-broll-plan, app/api/regenerate-scene, components/video/VisualDirector, components/video/SceneCard

## ✅ Status da v2.5 (confirmado em 27/05/2026)
- AUTO-STRUCTURE: qualquer prompt manual agora passa por /api/generate-script antes de analyze-idea (#310)
- Fast-path ativa 100% das vezes — usuário nunca precisa saber de HOOK/MICRO REWARD (#310)
- Viral Now: 3 cards trending diários em /viral-now + dashboard, 1 click = gera vídeo
- Viral script fast-path: voiceovers parsed EM CÓDIGO — GPT só gera visual layer (#307)
- Marcadores todos em inglês: HOOK, MICRO REWARD, ESCALATION, PAYOFF (#306)
- Dashboard viral cards: cores por vertical (billionaire=amber, mystery=purple, country=blue) (#305)
- Nav: "My Videos" substituído por "🔥 Viral Now" em sidebar, mobile nav, e top menu (#302-303)
- Commits chave desta versão:
  - #319: My Videos v2 — /history page rewritten to query `videos` table; 9:16 video grid cards with click-to-play, download, expandable description; title extracted from HOOK line in topic field
  - #320: My Videos: thumbnail support + HomePageClient footer fix — thumbnail_url as background on play button; dark overlay; play icon z-indexed; fixed footer /my-videos → /history link
  - #310: AUTO-STRUCTURE — /api/generate-script transforma qualquer tópico em script estruturado antes de analyze-idea; fast-path sempre ativa; usuário digita tema livre
  - #309: Fix: restore all truncated route files (cron + viral-now + scenes + analyze-idea)
  - #307: VIRAL FAST-PATH — parseViralScriptSections() em código; voiceovers NUNCA reescritos pelo GPT
  - #306: Marcadores em inglês: MICRO REWARD/ESCALATION/RHYTHM
  - #305: analyze-idea detecta scripts virais → cores por vertical no dashboard
  - #301–303: Viral Now — tabela Supabase, API route, cards no dashboard, nav

## Arquitetura do pipeline de geração (v2.5)
1. Usuário digita qualquer coisa → GenerateClient chama /api/generate-script se não houver marcadores
2. generate-script (GPT-4o-mini, temp 0.7) → script estruturado com HOOK/MICRO REWARD/ESCALATION/PAYOFF
3. Script estruturado → `analyze-idea` → `parseViralScriptSections()` detecta marcadores → voiceovers verbatim → GPT só gera visual_prompt + caption
4. `scenes` → busca B-roll específico no Pexels com os termos derivados do voiceover real
5. Vídeo com conteúdo específico garantido — sem menina aleatória, sem narração genérica

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
