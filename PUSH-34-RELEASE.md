# PUSH #34 — Recover legacy branded-search traffic

**Data:** 16/07/2026

**Status:** em preparação para publicação

**Meta comercial ativa:** 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga

**Placar antes deste PUSH:** 0/10

## Evidência

- A busca pública por páginas HTML antigas da marca ainda exibe `https://www.shortsforgeai.com/auth.html?mode=signup` como resultado.
- Em produção, esse endereço terminava em `/login?mode=signup`, apesar da intenção explícita de criar uma conta.
- `/dashboard.html` e `/generate.html` terminavam em HTTP 404.
- O funil histórico mostra que a ativação permaneceu perto de 38%; a queda principal foi aquisição. Recuperar tráfego de marca já conquistado tem prioridade sobre criar outra página sem distribuição.

## Correção

- `/auth.html?mode=signup` e `mode=register` redirecionam permanentemente para `/signup`.
- O redirecionamento inclui `intent_campaign=push34_legacy_auth`, sem substituir a origem real de aquisição.
- Parâmetros antigos como `prompt`, `plan` e `redirect` são preservados.
- `/auth.html` para login continua redirecionando para `/login`.
- Compatibilidade adicionada para:
  - `/signup.html` → `/signup`
  - `/login.html` → `/login`
  - `/dashboard.html` → `/dashboard`
  - `/generate.html` → `/generate`
  - `/pricing.html` → `/pricing`
  - `/history.html` → `/history`
  - `/index.html` → `/`

## Fora do escopo

- Nenhum e-mail, DM ou campanha externa enviado.
- Nenhuma mudança no Google Search Console.
- Nenhum IndexNow enviado.
- Nenhuma alteração de preço, oferta ou checkout.

## Validação local

- `npm.cmd run build`: aprovado, 146/146 páginas estáticas.
- `git diff --check`: aprovado.
- Todos os caminhos de compatibilidade retornam HTTP 308.
- Cadastro preserva `mode`, `prompt`, `plan`, `redirect` e adiciona a campanha de intenção.
- Login preserva `redirect` e não recebe campanha de aquisição.
- A implementação segue o comportamento documentado do Next.js para `redirects`, `has` por query e preservação de parâmetros.

## Arquivos do release

- `next.config.js`
- `PUSH-34-RELEASE.md`
- `PUSH-INDEX.md`

## Publicação

- Commit: pendente.
- Deploy Vercel: pendente.
- Validação em produção: pendente.

## Medição

- Cadastros com `signup_utm_campaign=push34_legacy_auth`.
- Quantidade de novos acessos que deixam de cair em login/404.
- Primeiro vídeo, checkout e assinatura dos usuários recuperados.
