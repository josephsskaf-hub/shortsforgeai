# Kineo — PUSH #27

**Nome:** One-Choice First Video Handoff
**Status:** PUBLICADO E VALIDADO EM PRODUÇÃO
**Data:** 16/07/2026
**Commit de código:** `17d9ff855a06ee1754e3aa4b6b7f9db54789b714`
**Deploy Vercel:** `dpl_FtesbFzBTN8X4kuNzhwJ6aqd3QMT` — READY

## Evidência que escolheu este push

- TAAFT é a maior fonte externa conhecida: 58 cadastros no recorte auditado.
- Apenas 17 desses 58 usuários criaram algum vídeo: ativação de 29,3%.
- Quarenta e um cadastros TAAFT — 70,7% — não criaram vídeo algum.
- Os 41 estavam com email confirmado e sessão de cadastro válida; não foi falha de confirmação.
- Entre os 41 sem vídeo:
  - 38 entraram por Google OAuth;
  - 3 entraram por email.
- O usuário TAAFT mais recente chegou corretamente a `/generate`, registrou `viral_onboarding_viewed` e saiu sem clicar.
- O onboarding anterior mostrava ao mesmo tempo:
  - oito ideias;
  - filtros por nicho;
  - scores e badges;
  - preview de hook;
  - Surprise Me;
  - campo de ideia própria;
  - vários CTAs e uma página longa com scroll.
- No histórico global, 298 usuários únicos viram esse onboarding e 230 dispararam a intenção de primeiro vídeo. Os 68 restantes não escolheram uma ação; a interface ainda deixava uma perda de 22,8% antes da análise.
- O auto-dispatch até o Fast render só entrou no PUSH #16. O PUSH #27 preserva esse caminho e remove a escolha excessiva que ainda existe antes dele.

## Problema comprovado

O cadastro e o OAuth já entregam o usuário autenticado no gerador. O próximo bloqueio é a primeira tela: uma pessoa que acabou de se cadastrar recebe um catálogo inteiro antes de experimentar o produto. Com pouco tráfego novo, cada abandono anterior ao primeiro vídeo elimina também a oferta pós-vídeo do PUSH #25.

## Escopo

- Substituir o catálogo full-screen por um handoff compacto, sem scroll e com uma única decisão principal.
- Mostrar uma ideia concreta já pronta:
  - `The disappearance nobody solved in 70 years`;
  - hook de exemplo;
  - explicação curta do que será criado.
- CTA primário único: `Create this free watermarked video`.
- Alternativa secundária: `Use my own idea instead`.
- Manter Escape como saída acessível.
- Depois do clique:
  - preencher a ideia;
  - forçar Fast;
  - estruturar o roteiro;
  - pular o preview intermediário;
  - disparar a geração automaticamente quando a análise estiver pronta.
- Preservar o marker do render na sessão para medir conclusão mesmo após reload da mesma aba.
- Remover do primeiro contato:
  - scores de viralidade;
  - badges `Viral`, `Hot` e `High Retention`;
  - claim de views;
  - filtros e múltiplos cards;
  - Surprise Me e input duplicado.

## Instrumentação

Eventos com `version=push27_single_choice`:

- `viral_onboarding_viewed`;
- `viral_onboarding_primary_clicked`;
- `viral_onboarding_skipped`;
- `first_video_started_from_viral_onboarding`;
- `first_video_generation_dispatched_from_viral_onboarding`;
- `first_video_generation_completed_from_viral_onboarding`;
- `first_video_generation_failed_from_viral_onboarding`.

Admin · Funnel ganha uma seção específica com atores únicos:

- handoffs vistos;
- cliques primários;
- escolha de ideia própria;
- renders despachados;
- vídeos concluídos;
- falhas;
- view → click;
- click → dispatch;
- dispatch → complete.

Os números do PUSH #27 filtram a versão nova; eventos históricos do onboarding antigo não contaminam o baseline.

## Invariantes

- Nada é gerado sem clique explícito do usuário.
- Free continua sendo Fast com marca d’água, até 3 vídeos por 24 horas, sem cartão.
- O usuário continua podendo ignorar a sugestão e escrever sua própria ideia.
- O render Fast continua no pipeline existente; não troca provider, custo, qualidade ou limite.
- Não existe timer, escassez, claim de viralidade, prova social ou view inventada.
- Nenhum email é enviado.
- Nenhum render/provider é disparado pela validação.
- Lote 1, announce, base fria e Product Hunt permanecem nos gates atuais.
- Contas internas continuam excluídas do placar.

## Validação local

- `npm.cmd run build`: aprovado; 141 de 141 páginas geradas na versão final local.
- Bundle de `/generate` caiu de aproximadamente 52,6 kB para 50,1 kB no build comparável.
- TypeScript completo mantém 21 erros de baseline; os erros existentes de `GenerateClient.tsx` ficam fora das linhas alteradas.
- `git diff --check`: aprovado.
- O componente novo tem uma ação principal e uma saída secundária.
- O CTA declara marca d’água antes do clique.
- A geração automática continua condicionada ao clique e ao término bem-sucedido da análise.
- Nenhum cadastro, evento, checkout, pagamento, email ou render artificial foi criado.

## Validação em produção concluída em 16/07/2026

- Commit `17d9ff8` confirmado em `origin/main`.
- Deploy `dpl_FtesbFzBTN8X4kuNzhwJ6aqd3QMT` confirmado como `READY`.
- `www.usekineo.com`, `usekineo.com`, `shortsforgeai.com` e aliases Vercel apontam para o mesmo deploy.
- Homepage confirmou HTTP 200.
- `/generate` sem sessão confirmou HTTP 307 para `/login?redirect=%2Fgenerate`.
- `/api/admin/funnel` sem sessão confirmou HTTP 403.
- O onboarding autenticado não foi aberto durante a validação, evitando fabricar impressão ou geração.
- Consulta direta aos sete eventos com `version=push27_single_choice` confirmou baseline zero: nenhuma view, clique, saída, intenção, geração despachada, conclusão ou falha artificial.
- O baseline deve crescer somente com usuários externos reais a partir deste deploy.

## Meta do microteste

Nos próximos 10 usuários externos que visualizarem o handoff:

- pelo menos 8 devem clicar no CTA primário;
- pelo menos 7 devem chegar ao dispatch Fast;
- pelo menos 6 devem concluir o primeiro vídeo;
- falhas devem ficar abaixo de 10%;
- pelo menos 5 devem visualizar a oferta pós-vídeo do PUSH #25;
- pelo menos 1 deve iniciar checkout recorrente.

Se view → click falhar, trocar a ideia/copy. Se click → dispatch falhar, corrigir análise/estado. Se dispatch → complete falhar, corrigir o pipeline Fast. Não alterar checkout sem evidência nessa etapa.

## Meta vinculada

Chegar a pelo menos 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga. Placar no início deste push: **0/10**.
