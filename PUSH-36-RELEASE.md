# PUSH #36 — Preserve Portuguese intent through activation

**Data:** 16/07/2026

**Status:** pronto para publicação

**Meta comercial ativa:** 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga

**Placar antes deste PUSH:** 0/10

## Evidência

- Nos 14 dias auditados, 6 de 38 cadastros externos do Brasil chegaram a um vídeo: **15,8% de ativação**.
- No mesmo recorte, a ativação foi 51,0% na Índia e 41,3% nos Estados Unidos.
- A landing `/pt` e as três páginas SEO em `/pt/[slug]` prometiam uma experiência em português, mas todos os CTAs abriam um cadastro sem tema.
- O cadastro preservava `prompt`, mas descartava o idioma.
- O gerador sempre iniciava com inglês, mesmo quando a aquisição vinha de uma página em português.
- O atalho de cadastro para login também descartava o destino de ativação para usuários que já tinham conta.
- As páginas usavam UTMs internas `utm_source=seo`, capazes de esconder a origem first-touch real.

## Correção

- A landing `/pt` ganhou um formulário topic-to-Short na primeira dobra, com três temas concretos em português.
- Cada uma das três páginas SEO PT ganhou o mesmo caminho, com exemplos adequados à intenção da página.
- O formulário compartilhado agora aceita copy localizada e um idioma validado, sem alterar os defaults ingleses dos PUSHes #32 e #35.
- `prompt`, `language=pt` e a campanha de intenção chegam juntos ao cadastro.
- O cadastro preserva o idioma no destino `/generate` para e-mail, Google OAuth e Apple OAuth.
- O gerador inicializa o seletor de saída em português quando recebe `language=pt`.
- Os links para login agora transportam o destino completo de ativação, inclusive para uma conta já existente.
- UTMs internas foram removidas; `intent_campaign=push36_pt_*` mede a intervenção sem sobrescrever Google, TAAFT, TopAI ou acesso direto.

## Fora do escopo

- Nenhum e-mail, DM ou nova campanha enviado.
- Nenhuma alteração em preço, cupom, Stripe ou créditos.
- Nenhuma alteração na campanha inativa `/pt/perrengue`.
- Nenhum vídeo ou job pago executado para QA.

## Validação local

- `npm.cmd run build`: aprovado, 146/146 páginas estáticas.
- `git diff --check`: aprovado.
- `/pt` e as três páginas SEO geram exatamente um formulário cada.
- Os quatro HTMLs gerados contêm `name="language" value="pt"`, campanha `push36_pt_*` e a promessa de preservação do idioma.
- Zero ocorrência de `utm_source=seo` nos quatro HTMLs gerados.
- O typecheck completo continua bloqueado por erros preexistentes fora deste escopo; nenhum erro novo foi reportado nos componentes alterados.

## Arquivos do release

- `app/pt/page.tsx`
- `app/pt/[slug]/page.tsx`
- `app/youtube-shorts-from-topic/TopicGeneratorForm.tsx`
- `app/(auth)/signup/page.tsx`
- `app/(dashboard)/generate/GenerateClient.tsx`
- `PUSH-36-RELEASE.md`
- `PUSH-INDEX.md`

## Medíção

- `organic_topic_submitted` com `source=push36_pt_*` e `language=pt`.
- Cadastro com `signup_utm_campaign=push36_pt_*`, sem alterar a origem real.
- Callback de autenticação com prompt preservado.
- Primeiro vídeo concluído pela coorte brasileira.
- Pricing, checkout e assinatura recorrente dessa coorte.

## Gate

- Formulário sem cadastro: revisar confiança e transição do auth.
- Cadastro sem primeiro vídeo: revisar o passo de preview/análise no gerador.
- Vídeo sem pricing: revisar o momento do upgrade.
- Pricing sem checkout: revisar oferta e confiança, sem mudar preço antes de uma sessão Stripe atual.
