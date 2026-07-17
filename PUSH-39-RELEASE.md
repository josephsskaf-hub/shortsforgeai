# PUSH #39 — Turn Viral Now impressions into preserved video intent

**Data:** 17/07/2026

**Status:** pronto para publicação

**Meta comercial ativa:** 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga

**Placar antes deste PUSH:** 0/10

## Evidência

- O Search Console registrou 23 impressões e zero cliques para `/viral-now` entre 01/07 e 14/07.
- Era a maior oportunidade não jurídica entre as páginas sem clique.
- A página tinha apenas o título genérico `Viral Now — Kineo`, sem description, canonical, Open Graph ou conteúdo estruturado próprio.
- Os temas eram buscados somente depois da hidratação; o HTML inicial entregue ao crawler continha skeletons em vez dos títulos reais.
- Visitante deslogado que escolhia um tema era enviado para `/login?redirect=/viral-now`; o roteiro escolhido desaparecia e exigia um segundo clique depois do login.

## Correção

- O servidor agora entrega os oito temas atuais no primeiro HTML.
- Metadata específica cobre intenção de busca, description factual, canonical, robots, Open Graph e Twitter.
- Um `ItemList` JSON-LD descreve somente títulos e descrições públicas dos oito temas.
- O H1 e o texto de apoio explicam a proposta, a atualização a cada quatro horas e o primeiro vídeo watermarked gratuito sem cartão.
- O CTA agora diz `Create this Short free`.
- Cada card tem âncora estável e o rodapé usa a contagem real de tópicos.
- Visitantes deslogados vão diretamente ao cadastro com o destino completo preservado.
- Somente o ID curto e validado do tema atravessa signup/OAuth; o servidor restaura o prompt confiável dentro de `/generate`, evitando URL gigante e truncamento.
- ID inexistente ou adulterado retorna à lista, sem gerar um vídeo diferente silenciosamente.
- O dashboard interno foi verificado conforme a regra do projeto; ele já é autenticado e continua levando o prompt diretamente ao gerador, portanto não precisava ser alterado.

## Medição

- `viral_now_viewed`: uma visualização anonymous-safe por sessão do browser.
- `viral_now_topic_clicked`: escolha do tema, sem gravar prompt ou e-mail.
- Metadata limitada a campanha, ID público do tema, vertical, quantidade de temas e estado de login.
- O painel administrativo agora mostra atores externos únicos em view, escolha e taxa `view → topic`.
- Cadastros com `push39_viral_now` entram no cohort orgânico e seguem até vídeo e assinatura recorrente verificada pela Stripe.

## Fora do escopo

- Nenhum e-mail, follow-up ou segmento novo foi acionado.
- Nenhum vídeo, render ou job de provedor foi executado.
- Nenhum evento artificial foi gravado.
- Nenhum preço, cupom, crédito ou regra Stripe foi alterado.
- Nenhuma propriedade ou solicitação do Search Console foi modificada.

## Validação local

- `npm.cmd run build`: aprovado; 146/146 páginas estáticas e `/viral-now` compilado como rota dinâmica SSR.
- `git diff --check`: aprovado.
- HTTP local de `/viral-now`: 200.
- Título SEO, description, canonical e `ItemList` presentes no HTML do servidor.
- A API e o HTML entregaram oito temas; o primeiro título real e o CTA gratuito estavam presentes no HTML inicial.
- Tema válido deslogado: 307 para auth preservando apenas `viral_topic=bill-01`; nenhum prompt vazou no redirect.
- Tema adulterado: 307 de volta para `/viral-now?topic=unavailable`.
- O typecheck completo continua com erros preexistentes em rotas/admin e regiões antigas de `GenerateClient`; nenhum diagnóstico ocorreu nas regiões ou arquivos novos deste PUSH.

## Arquivos do release

- `app/(dashboard)/viral-now/page.tsx`
- `app/(dashboard)/viral-now/ViralNowClient.tsx`
- `lib/viralTopics.ts`
- `app/(dashboard)/generate/page.tsx`
- `app/(dashboard)/generate/GenerateClient.tsx`
- `app/api/admin/funnel/route.ts`
- `app/(dashboard)/admin/funnel/FunnelClient.tsx`
- `PUSH-39-RELEASE.md`
- `PUSH-INDEX.md`

## Publicação

- Commit: pendente.
- Deploy Vercel: pendente.

## Gate pós-deploy

- Impressão sem clique: testar title/description somente depois de nova amostra do Search Console.
- View sem escolha de tema: revisar headline, proposta ou cards.
- Escolha sem cadastro: revisar confiança e fricção da tela de signup.
- Cadastro sem chegada ao gerador: auditar o redirect de auth pelo evento server-side.
- Chegada sem vídeo: usar os eventos do primeiro vídeo para localizar o passo exato.
- Vídeo sem checkout: revisar o momento do upgrade sem ampliar campanha ainda.
- Contar assinatura somente pela Stripe, excluindo internos e testes.
