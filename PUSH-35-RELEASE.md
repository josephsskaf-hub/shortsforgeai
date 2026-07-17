# PUSH #35 — Turn indexed ideas into first videos

**Data:** 16/07/2026

**Status:** pronto para publicação

**Meta comercial ativa:** 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga

**Placar antes deste PUSH:** 0/10

## Evidência

- `/faceless-channel-ideas` já aparece em busca pública para o cluster competitivo de ideias de canais faceless.
- A página oferecia 50 ideias, mas os cards não executavam nenhuma ação; o visitante precisava copiar a ideia, encontrar outro CTA e começar novamente.
- Os CTAs principais abriam um cadastro vazio, sem preservar qual ideia motivou o clique.
- A página ainda usava UTMs internas (`utm_source=seo`) para uma navegação dentro do próprio site. Isso podia classificar tráfego direto como SEO e dificultar a leitura da origem real.
- O diagnóstico geral continua sendo aquisição: 320/320 cadastros recentes tinham perfil e e-mail confirmado, enquanto o volume diário de novos usuários caiu abruptamente.

## Correção

- Um formulário topic-to-Short foi inserido antes da lista, com três exemplos concretos.
- O formulário compartilhado agora aceita `campaign`, `source`, exemplos e ID próprios, sem mudar o comportamento do PUSH #32.
- Cada uma das 50 ideias recebeu `Make this first Short →`.
- Cada CTA leva para `/signup` com um prompt específico já preenchido.
- Após email ou OAuth, o prompt continua até `/generate` pelo fluxo de ativação existente.
- A campanha `push35_faceless_idea` mede esta intenção sem sobrescrever Google, TAAFT, TopAI ou outro first-touch real.
- As UTMs internas antigas foram removidas desta página.

## Fora do escopo

- Nenhum e-mail, DM ou campanha externa enviado.
- Nenhuma postagem, submissão em diretório ou mudança no Search Console.
- Nenhuma mudança de preço, cupom, Stripe ou créditos.
- Nenhum vídeo pago executado para QA.

## Validação local

- `npm.cmd run build`: aprovado, 146/146 páginas estáticas.
- `git diff --check`: aprovado.
- HTML estático gerado contém o formulário, a campanha e links com prompt preenchido.
- Os 50 cards renderizam CTA; o HTML/RSC contém duas representações de cada texto, como esperado no build do App Router.
- Zero ocorrência dos marcadores antigos `push22_faceless_ideas` ou `utm_source=seo` na página gerada.
- O componente original de `/youtube-shorts-from-topic` mantém seus defaults `push32_topic_intent` e `push32_topic`.

## Arquivos do release

- `app/faceless-channel-ideas/page.tsx`
- `app/youtube-shorts-from-topic/TopicGeneratorForm.tsx`
- `PUSH-35-RELEASE.md`
- `PUSH-INDEX.md`

## Publicação

- Commit: pendente.
- Deploy Vercel: pendente.
- Validação em produção: pendente.

## Medição

- `landing_session_started` em `/faceless-channel-ideas`.
- `organic_topic_submitted` com `source=push35_faceless_ideas`.
- `organic_cta_clicked` por `placement=idea_X_Y`.
- Cadastros com `signup_utm_campaign=push35_faceless_idea`.
- Primeiro vídeo, pricing, checkout e assinatura desta coorte.

## Gate

- Sessão sem submit/CTA: revisar primeira dobra e valor percebido.
- Clique/submit sem cadastro: revisar transição e confiança no auth.
- Cadastro sem primeiro vídeo: revisar ativação e carregamento do prompt.
- Vídeo sem pricing: revisar momento do upgrade.
- Pricing sem checkout: revisar oferta/confiança.
- Checkout sem pagamento: auditar a sessão Stripe atual antes de alterar preço ou método.
