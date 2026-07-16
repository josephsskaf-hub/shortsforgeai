# Kineo — PUSH #30

**Nome:** Search Discovery — IndexNow Recovery
**Status:** PUBLICADO, SUBMETIDO E VALIDADO EM PRODUÇÃO
**Data:** 16/07/2026
**Commit de código:** `f0b68b5` — `PUSH #30 notify search engines of public updates`
**Deploy Vercel:** `dpl_3gztt8hxD9gpRcNrVYGRc31r8z6o` — Production · READY

## Evidência que escolheu este push

- A aquisição externa caiu 86,4% entre as duas últimas janelas de sete dias.
- Nas últimas 24 horas ainda entraram dois usuários externos: um via TAAFT e um via Google.
- O usuário do Google concluiu e baixou um vídeo, confirmando que tráfego orgânico qualificado ainda consegue ativar.
- A busca pública `site:usekineo.com` exibiu somente a homepage.
- O resultado ainda usava o snippet anterior ao PUSH 22/26: “From $9.90/mo”, “First Short free” e preços recorrentes sem a entrada atual.
- O sitemap de produção contém 61 URLs válidas, mas um sitemap é uma sugestão de descoberta e não prova recrawl ou indexação.
- As páginas públicas e a oferta foram materialmente alteradas em 16/07, portanto a notificação de atualização é legítima.

## Hipótese

Notificar imediatamente os buscadores participantes sobre as 61 páginas alteradas deve acelerar o recrawl da homepage, dos hubs e das páginas de alta intenção. Isso pode recuperar descoberta orgânica e corrigir snippets desatualizados sem mídia paga. O Google continua dependendo do sitemap e do Search Console; sua Indexing API não é usada porque páginas comuns não são elegíveis.

## Escopo

- Hospedar uma chave IndexNow UTF-8 no root público do domínio canônico.
- Adicionar um script manual e auditável que:
  - lê as URLs do sitemap de produção;
  - remove duplicatas;
  - rejeita URL fora de `https://www.usekineo.com`;
  - respeita o limite de 10.000 URLs;
  - opera em dry-run por padrão;
  - somente envia com `--submit` explícito;
  - valida a chave já publicada antes do POST;
  - aceita apenas HTTP 200 ou 202 como recebimento válido.
- Enviar uma única notificação em lote após o deploy READY.
- Não executar o envio automaticamente em todo build, evitando reenvio sem mudança material.

## Invariantes

- Nenhum email, mensagem, post social, anúncio ou campanha é enviado.
- Nenhum cadastro, evento de funil, checkout, pagamento ou render é fabricado.
- O script não cria páginas rasas nem altera conteúdo apenas para SEO.
- Nenhuma URL privada, `/generate`, `/history`, `/admin`, `/api` ou `/v/[id]` entra na submissão.
- O recebimento pelo IndexNow não será descrito como garantia de indexação ou ranking.
- Announce, base fria, demais segmentos e Product Hunt continuam pausados.
- O placar comercial continua excluindo contas internas.

## Gate de publicação

1. Dry-run deve retornar exatamente as 61 URLs canônicas do sitemap.
2. Chave local deve ser idêntica ao nome do arquivo e ter formato permitido.
3. `git diff --check` deve passar.
4. Build completo deve passar.
5. Revisar stage exato; nunca usar `git add .`.
6. Publicar na `main` e aguardar Vercel READY.
7. Confirmar chave pública com HTTP 200 e conteúdo exato.
8. Executar uma única submissão explícita.
9. Registrar HTTP 200 ou 202, quantidade e horário, sem alegar indexação.
10. Reconsultar descoberta e snippets nos próximos dias; não reenviar sem mudança material.

## Validação local concluída em 16/07/2026

- Dry-run retornou exatamente 61 URLs.
- As 61 URLs são únicas e usam `https://www.usekineo.com`.
- Zero rotas privadas de API, app, admin ou vídeo público não enumerável foram incluídas.
- A chave tem 32 caracteres permitidos e o conteúdo local corresponde exatamente ao nome do arquivo.
- O modo padrão apenas imprime o plano; o POST exige `--submit` explícito.
- O modo de submissão valida primeiro a chave já publicada e para antes do POST se ela não estiver disponível ou divergir.
- `git diff --check`: aprovado nos quatro arquivos do PUSH 30.
- Build completo de produção: aprovado; 141 de 141 páginas geradas.
- Nenhum evento, cadastro, checkout, pagamento, email, mensagem, anúncio ou render foi criado.

## Publicação e submissão concluídas em 16/07/2026

- Commit `f0b68b5` enviado para `origin/main` com stage limitado aos quatro arquivos do PUSH 30.
- Deploy `dpl_3gztt8hxD9gpRcNrVYGRc31r8z6o` confirmado como READY e associado a `www.usekineo.com`.
- Homepage, `sitemap.xml`, `robots.txt` e arquivo da chave responderam HTTP 200.
- O arquivo público retornou somente a chave esperada.
- Uma única submissão foi executada para `https://api.indexnow.org/indexnow`.
- Resultado: HTTP 202, 61 URLs, `submittedAt=2026-07-16T21:53:45.826Z`.
- HTTP 202 foi registrado corretamente como “recebido; validação da chave pendente”, sem alegar indexação ou ranking.
- Snapshot comercial às `2026-07-16T21:54:33.250Z`:
  - 665 perfis externos acumulados;
  - zero novos perfis desde o deploy do PUSH 30;
  - zero eventos reais versionados do PUSH 29;
  - duas assinaturas Stripe `active/trialing`, ambas internas;
  - **zero assinantes recorrentes externos — placar 0/10**.
- Nenhum email, mensagem, post, anúncio, evento de funil, checkout, pagamento ou render foi criado pela publicação.

## Meta vinculada

Chegar a pelo menos 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga. Placar no início deste push: **0/10**.
