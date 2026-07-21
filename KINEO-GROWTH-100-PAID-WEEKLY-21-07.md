# Kineo — 100 novos pagantes por semana

**Início:** 21/07/2026  
**North star:** 100 novos clientes pagantes recorrentes externos por janela móvel de 7 dias.  
**Restrições:** zero mídia paga, zero outreach por e-mail e zero aparição do founder.  
**Relatório:** todos os dias às 22:00 BRT.

## O que conta como resultado

Conta apenas uma nova assinatura externa confirmada no provedor de pagamento como
`active` ou `trialing`, com cobrança recorrente legítima. Não contam founder,
contas internas, QA, bots, usuários gratuitos, packs avulsos, `is_pro` manual,
checkout criado, trial sem método válido, pagamento de teste ou evento duplicado.

A meta é uma direção agressiva, não uma promessa de resultado. A operação deve
mostrar diariamente o que foi comprovado e nunca transformar deploy, impressão,
view, cadastro ou checkout em “cliente”.

## Baseline verificado em 21/07/2026

Janela móvel de 7 dias:

| Etapa | Resultado |
|---|---:|
| Atores externos qualificados | 215 |
| Submits de tópico | 15 atores |
| Cadastros externos | 24 |
| Primeiro vídeo concluído | 6 |
| Pricing | 3 atores |
| Checkouts recorrentes | 2 |
| Novos pagantes recorrentes | 0 |

O maior vazamento observado é checkout → pagamento: as duas sessões externas
expiraram sem pagamento e sem falha técnica registrada. Esse baseline deve ser
recalculado diariamente com evidência viva.

## Matemática operacional da meta

Para 100 pagamentos em 7 dias são necessários, em média, 14,3 novos pagamentos
por dia. O cenário operacional recomendado, ainda a validar, usa taxas fortes
mas menos excepcionais: 15% visita → cadastro, 50% cadastro → primeiro vídeo,
50% primeiro vídeo → intenção de compra, 40% intenção → checkout e 50% checkout
→ pagamento.

`1.905 visitantes qualificados/dia → 286 cadastros → 143 primeiros vídeos → 72 intenções de compra → 29 checkouts → 14–15 pagamentos`

Isso equivale aproximadamente a 13.334 visitantes qualificados, 2.000 cadastros,
1.000 primeiros vídeos, 500 intenções de compra, 200 checkouts e 100 pagamentos
por semana. O volume atual de visitantes é cerca de 62 vezes menor que esse
cenário. Mesmo um funil excepcional exigiria aproximadamente 4.630 visitantes
por semana. Cada taxa deve ser substituída pela taxa real assim que houver volume
suficiente.

`pricing_view` é um sinal, mas não uma etapa obrigatória: existem CTAs que entram
direto no checkout. A auditoria de 21/07 provou que o bruto
`41 checkout_attempted → 39 checkout_auth_required → 2 checkout_started` não é
uma coorte sequencial: 37 requisições não tinham `user_id` nem `session_id` e
vieram em rajadas Starter/Creator/Studio, padrão de crawler/link checker/QA.
Somente uma sessão humana chegou à tela de cadastro (duas tentativas, nenhum
método escolhido). As duas tentativas autenticadas viraram 2/2 sessões Stripe,
ambas expiradas. Taxas de conversão devem contar atores identificáveis; o ruído
sem identidade aparece separado e nunca como comprador perdido.

## Experimento prioritário — prova do produto no canal próprio

O YouTube é o único alcance próprio imediato já comprovado: o canal tem audiência
existente e trouxe sessões, mas ainda não gerou envio de tópico. O próximo Short
buyer-intent deve mostrar, sem founder, a transformação real
“uma frase → um vídeo Kineo”, usando um exemplo público legítimo e uma legenda por
vez. CTA: “Make up to 3 watermarked Fast videos every 24h. No card. Link in
profile.” Destino rastreado:
`/youtube-shorts-from-topic?utm_source=youtube&utm_medium=organic&utm_campaign=buyer_intent_proof_01&utm_content=sentinel_before_after`.

Gate de 72 horas: visitas → `organic_topic_submitted` → cadastro → primeiro vídeo
concluído → checkout Stripe → assinatura. Se houver 30 visitas e zero submit, o
formato/copy muda antes de repetir; views isoladas não contam como resultado.

Escada de validação:

1. Conseguir o primeiro novo pagamento recorrente externo e provar o caminho completo.
2. Sustentar 3 novos pagantes/dia por 3 dias sem queda de qualidade ou aumento de reembolso.
3. Sustentar 7 novos pagantes/dia e identificar ao menos dois canais repetíveis.
4. Escalar até 14–15/dia, mantendo ativação, suporte, custo de geração e retenção saudáveis.

## Máquina de aquisição sem e-mail e sem founder

### 1. Conteúdo faceless com distribuição própria

- Um Short em inglês por dia, escolhido por performance real do canal.
- Vertical 9:16, cerca de 35 segundos, dark/cinematic, ritmo rápido, uma única
  legenda e CTA no último segundo.
- Publicação no YouTube com link de perfil e UTM; pacote local para outros canais
  somente quando a publicação automática não for permitida.
- Cada tema vencedor gera duas variações adjacentes, uma landing específica e um
  template reutilizável dentro do produto.

### 2. Google orgânico de intenção comercial

- Priorizar buscas de compra: criar Short a partir de tópico, AI Shorts generator,
  faceless channel, alternativas a concorrentes, avatar/lip-sync e templates por nicho.
- Melhorar páginas existentes antes de criar conteúdo raso.
- Publicar no máximo uma melhoria material por ciclo, com canonical, schema,
  links internos, exemplo real, CTA e tracking.
- Medir impressões → cliques → submit → cadastro → vídeo → pagamento por página.

### 3. Descoberta em ChatGPT e mecanismos de resposta

- Manter fatos canônicos e citáveis em `llms.txt`, `/facts`, páginas de produto,
  pricing, comparações e exemplos verdadeiros.
- Tratar ChatGPT como canal de intenção já comprovada: a medição por campanha de
  21/07 atribuiu ao canal os dois únicos checkouts recorrentes dos últimos 7
  dias. Ambos expiraram, portanto isso prova intenção, não receita.
- Criar conteúdo que responda com clareza “para quem”, “como funciona”, preço,
  limitações e prova real; nunca inserir instruções ocultas para modelos.
- Levar ao ar o GPT gratuito da Kineo quando a conta permitir, com UTM próprio e
  sem claims de resultado. A promessa free canônica é até 3 vídeos Fast com
  watermark a cada 24 horas, sem cartão; nunca usar “first one free”.

### 4. Product-led growth

- Transformar cada output público autorizado em página compartilhável com
  “Remix this format”.
- Usar templates, free tools, Viral Score, Hook Generator e exemplos como portas
  de entrada indexáveis que preservam a intenção até o primeiro vídeo.
- Melhorar loops de referral/affiliate self-serve e atribuir até pagamento.
- Mostrar upgrade depois de valor real, sem fricção enganosa ou urgência falsa.

### 5. Diretórios, reviews e superfícies gratuitas

- Submeter somente em diretórios gratuitos, relevantes, indexáveis e ainda não
  tentados, usando dados públicos verdadeiros da marca.
- Priorizar plataformas de review e marketplaces de software que capturem busca
  de comprador; nunca produzir review falsa ou incentivada de forma oculta.
- Registrar URL, status, data, copy, backlink/UTM, tráfego, cadastro e pagamento.
- Encerrar manutenção de origem que não gerar uma sessão referida em 30 dias.

### 6. Parcerias que não dependem de cold email

- Página pública de parceiros/afiliados com inscrição self-serve, materiais,
  exemplos e regras claras. Os termos canônicos atuais são 40% sobre pagamentos
  elegíveis e atribuição first-touch de 90 dias; ignorar programas históricos.
- Templates e provas que educadores, newsletters e comunidades possam encontrar
  e adotar sem abordagem em massa.
- Listagens, programas públicos, launch platforms e integrações orgânicas onde a
  submissão for gratuita e permitida.

## Priorização diária

- **09h:** placar vivo, saúde do checkout/webhook e maior vazamento do funil.
- **13h:** SEO/AEO, diretórios, indexação e superfícies de intenção comercial.
- **17h:** melhor Short faceless do dia, QA e publicação no YouTube.
- **20h:** uma correção ou experimento de maior impacto e preparação das evidências.
- **22h:** relatório executivo único para o founder.

Em cada ciclo, escolher uma única ação pelo impacto esperado em pagamento,
executar ponta a ponta, medir e registrar. Não empilhar mudanças de produto sem
tráfego suficiente para ler a anterior.

## Guardrails

- Nunca usar e-mail, announce, base fria ou recuperação por e-mail.
- Nunca comprar tráfego, placement, diretório, créditos ou assinatura.
- Nunca usar spam, DMs em massa, comentários promocionais repetidos, fake reviews
  ou identidade falsa.
- Nunca publicar claim de views, clientes, viralidade ou receita sem prova.
- Preservar mudanças do usuário; testar antes de push e validar Vercel `READY`.
- Se uma ação externa exigir CAPTCHA, login ausente, pagamento, mudança contratual
  ou confirmação obrigatória, preparar o ativo e continuar em outra alavanca.

## Relatório das 22h

O relatório deve conter somente evidência:

1. Novos pagantes hoje, últimos 7 dias, distância para 100 e MRR novo.
2. Funil completo do dia e conversões verificadas.
3. Resultado por canal, separado de atividade.
4. Ações concluídas/publicadas, commits, deploys e URLs.
5. Falhas, riscos e dados não verificáveis.
6. Três decisões do próximo dia, ordenadas por impacto esperado.
7. Veredito: no ritmo, abaixo do ritmo ou sem dados suficientes.

As automações ativas são `kineo-opera-o-100-pagantes-por-semana` e
`kineo-relat-rio-di-rio-22h`.
