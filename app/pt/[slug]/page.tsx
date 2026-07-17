// #487 — Páginas SEO em português (canal dark com IA). Programáticas sob /pt/.
// Alvo: buscas BR de alta intenção ("canal dark com IA", "alternativa ao Opus
// Clip em português", "criar shorts com IA"). Estáticas, no sitemap, FAQ schema,
// Copy 100% PT-BR nativo. Vantagem: produto upstream.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import TopicGeneratorForm from '@/app/youtube-shorts-from-topic/TopicGeneratorForm'

export const dynamic = 'force-static'
export const dynamicParams = false

type Section = { h: string; p: string }
type PtPage = {
  title: string
  desc: string
  h1: string
  intro: string
  examples: readonly string[]
  sections: Section[]
  faq: { q: string; a: string }[]
}

const PAGES: Record<string, PtPage> = {
  'canal-dark-com-ia': {
    title: 'Como criar um canal dark com IA (ferramenta que faz o Short inteiro) — Kineo',
    desc: 'Crie um canal dark com IA sem aparecer e sem editar. O Kineo transforma uma ideia num Short pronto com roteiro, voz, imagens e legendas. Primeiro Short grátis.',
    h1: 'Canal dark com IA: do zero ao Short pronto, sem editar',
    intro:
      'Montar um canal dark (faceless) trava na produção: roteiro, voz, busca de imagens, edição. O Kineo resolve tudo isso num passo — você digita uma ideia e recebe um Short vertical pronto pra postar no YouTube Shorts, TikTok e Reels. Sem aparecer, sem filmar, sem editar.',
    examples: [
      '3 mistérios do oceano que a ciência ainda não explicou',
      'Como a cidade mais rica do mundo ficou sem dinheiro',
      'O lugar mais isolado e perigoso do planeta',
    ],
    sections: [
      { h: 'Por que canal dark com IA explodiu', p: 'Canais dark monetizam sem rosto, sem câmera e sem equipe — só conteúdo. A IA derrubou a última barreira: antes você precisava de ChatGPT + ElevenLabs + CapCut + banco de imagens. Agora uma ferramenta só faz o pacote inteiro, então dá pra postar todo dia sem virar editor.' },
      { h: 'Como o Kineo faz', p: 'Você dá o tema. A IA escreve o roteiro com gancho viral, grava a narração com voz de IA, busca e encaixa as imagens cena a cena, e adiciona as legendas. Sai um MP4 9:16 pronto. Funciona pra qualquer nicho: finanças, mistério, história, curiosidades, motivação.' },
      { h: 'Quanto custa', p: 'O primeiro Short é grátis, sem cartão. No Brasil, o Starter custa R$24,90 no primeiro mês e depois R$49,90/mês, com 25 créditos renovados a cada ciclo.' },
    ],
    faq: [
      { q: 'Preciso aparecer ou gravar minha voz?', a: 'Não. É 100% faceless: roteiro, narração com voz de IA, imagens e legendas são gerados automaticamente. Você só escolhe o tema.' },
      { q: 'Funciona pra qualquer nicho de canal dark?', a: 'Sim — finanças, mistério, história, curiosidades, motivação e mais. A IA adapta o roteiro e as imagens ao tema.' },
      { q: 'Como funciona o plano?', a: 'O primeiro vídeo é grátis, sem cartão. No Brasil, o Starter custa R$24,90 no primeiro mês e depois R$49,90/mês; os créditos renovam mensalmente.' },
    ],
  },
  'alternativa-opusclip-portugues': {
    title: 'Alternativa ao Opus Clip em português — Kineo',
    desc: 'Procurando uma alternativa ao Opus Clip em português? O Kineo cria o Short do zero a partir de uma ideia, em vez de apenas cortar um vídeo longo. Primeiro Short grátis.',
    h1: 'A alternativa ao Opus Clip em português',
    intro:
      'O Opus Clip é ótimo pra cortar um vídeo longo que você já gravou. Mas se você quer criar um Short faceless do zero, a partir de uma ideia, é outra ferramenta. O Kineo escreve o roteiro, narra com voz de IA, busca as imagens e monta o Short — em português de verdade.',
    examples: [
      'Como a Blockbuster perdeu tudo para a Netflix',
      'Por que os aviões evitam voar sobre o Tibete',
      'A ilha brasileira onde quase ninguém pode entrar',
    ],
    sections: [
      { h: 'A diferença que importa', p: 'Opus Clip = reaproveita vídeo longo (precisa do seu material). Kineo = cria o vídeo inteiro a partir de uma ideia, sem você precisar de gravação nenhuma. Para canal dark, é a ferramenta certa: ela produz, não só recorta.' },
      { h: 'Português nativo', p: 'No Kineo, a interface e a narração funcionam em português. O primeiro Short é grátis; no Brasil, o Starter custa R$24,90 no primeiro mês e depois R$49,90/mês.' },
      { h: 'Quando escolher cada um', p: 'Escolha o Opus Clip se você já grava vídeos longos ou podcasts e só quer cortá-los. Escolha o Kineo se quer criar Shorts faceless do zero, em português, sem aparecer.' },
    ],
    faq: [
      { q: 'Qual a melhor alternativa ao Opus Clip em português?', a: 'O Kineo gera o Short completo — roteiro, voz, imagens e legendas — a partir de uma ideia, sem precisar subir um vídeo, e funciona em português.' },
      { q: 'É mais barato que o Opus Clip pra quem é do Brasil?', a: 'Você paga em Real — o que costuma sair bem mais em conta do que ferramentas cobradas em dólar. O primeiro Short é grátis.' },
      { q: 'Preciso ter um vídeo pronto pra usar?', a: 'Não. Diferente do Opus Clip, você só precisa de uma ideia — a IA cria o vídeo do zero.' },
    ],
  },
  'criar-shorts-com-ia': {
    title: 'Criar Shorts com IA sem editar — Kineo',
    desc: 'Crie Shorts com IA: roteiro, voz, imagens e legendas no automático. Sem aparecer, sem editar. Primeiro vídeo grátis.',
    h1: 'Criar Shorts com IA sem editar',
    intro:
      'Você digita uma ideia e o Kineo monta o Short inteiro: roteiro com gancho, narração com voz de IA, imagens cena a cena e legendas. Pronto pra postar no YouTube Shorts, TikTok e Reels — sem aparecer e sem editar.',
    examples: [
      'O que acontece com seu corpo depois de 3 dias sem açúcar',
      'O bilionário que perdeu tudo em uma noite',
      'Por que a Porta do Inferno continua queimando',
    ],
    sections: [
      { h: 'Uma ideia entra, um Short sai', p: 'Sem prompt complicado, sem timeline pra aprender. Tema → vídeo 9:16 pronto. É a forma mais rápida de postar conteúdo curto todo dia sem montar um estúdio.' },
      { h: 'Tudo no automático', p: 'A IA escreve o roteiro, grava a voz, encaixa as imagens e adiciona as legendas. Você só baixa e posta. Funciona em qualquer nicho.' },
      { h: 'Plano mensal', p: 'Primeiro Short grátis, sem cartão. No Brasil, Starter por R$24,90 no primeiro mês e depois R$49,90/mês, com créditos renovados a cada ciclo.' },
    ],
    faq: [
      { q: 'Em quanto tempo o Short fica pronto?', a: 'Cerca de 60 segundos, do tema ao vídeo 9:16 pronto pra baixar e postar.' },
      { q: 'Preciso saber editar?', a: 'Não. Não há timeline. Você digita uma ideia e recebe o vídeo finalizado, com voz e legendas.' },
      { q: 'Como funciona o preço?', a: 'O primeiro vídeo é grátis. No Brasil, o Starter custa R$24,90 no primeiro mês e depois R$49,90/mês; os créditos renovam mensalmente.' },
    ],
  },
}

export const PT_SLUGS = Object.keys(PAGES)

export function generateStaticParams() {
  return PT_SLUGS.map((slug) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const pg = PAGES[params.slug]
  if (!pg) return {}
  const url = `https://www.usekineo.com/pt/${params.slug}`
  return {
    metadataBase: new URL('https://www.usekineo.com'),
    title: pg.title,
    description: pg.desc,
    alternates: { canonical: url },
    openGraph: { title: pg.title, description: pg.desc, url, type: 'website' },
  }
}

const CARD = { background: '#161618', border: '1px solid #2a2a2d' }
const PT_FORM_COPY = {
  label: 'Qual ideia você quer transformar em Short?',
  placeholder: 'Digite um tema ou cole seu roteiro',
  submit: 'Criar meu primeiro Short →',
  examplesLabel: 'Temas de exemplo',
  note: 'Seu tema e o idioma português continuam preenchidos depois do cadastro. Sem cartão no primeiro vídeo.',
}

export default function PtSeoPage({ params }: { params: { slug: string } }) {
  const pg = PAGES[params.slug]
  if (!pg) notFound()
  const campaign = `push36_pt_${params.slug}`
  const faqJsonLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: pg.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 18px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/pt" style={{ color: '#2997ff', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>⚡ Kineo</Link>
          <Link href="/" style={{ color: '#86868b', textDecoration: 'none', fontSize: '0.8rem' }}>English</Link>
        </div>

        <section style={{ marginTop: 36 }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#2997ff', background: 'rgba(41,151,255,0.12)', borderRadius: 999, padding: '6px 14px' }}>🇧🇷 Em português</div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '16px 0 0', background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{pg.h1}</h1>
          <p style={{ fontSize: '1.02rem', color: '#86868b', lineHeight: 1.6, margin: '14px 0 0' }}>{pg.intro}</p>
          <Link href="#criar-short" style={{ display: 'inline-block', marginTop: 20, background: '#f5f5f7', color: '#000', fontWeight: 600, padding: '14px 30px', borderRadius: 980, textDecoration: 'none', fontSize: '1.02rem' }}>Escolher o tema do meu vídeo →</Link>
          <TopicGeneratorForm
            campaign={campaign}
            source={campaign}
            examples={pg.examples}
            formId="criar-short"
            language="pt"
            copy={PT_FORM_COPY}
          />
        </section>

        {pg.sections.map((s) => (
          <section key={s.h} style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 8px', color: '#f5f5f7' }}>{s.h}</h2>
            <p style={{ color: '#86868b', lineHeight: 1.65, margin: 0, fontSize: '0.97rem' }}>{s.p}</p>
          </section>
        ))}

        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 14px', color: '#f5f5f7' }}>Perguntas frequentes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pg.faq.map((f) => (
              <div key={f.q} style={{ ...CARD, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.95rem', color: '#f5f5f7' }}>{f.q}</div>
                <p style={{ margin: 0, color: '#86868b', lineHeight: 1.6, fontSize: '0.9rem' }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 40, textAlign: 'center', ...CARD, borderRadius: 20, padding: '28px 20px' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: '#f5f5f7' }}>Faça seu primeiro Short grátis</h2>
          <p style={{ color: '#86868b', margin: '8px 0 18px', fontSize: '0.95rem' }}>Uma ideia entra, um Short pronto sai. Sem cartão.</p>
          <Link href="#criar-short" style={{ display: 'inline-block', background: '#f5f5f7', color: '#000', fontWeight: 600, padding: '14px 30px', borderRadius: 980, textDecoration: 'none', fontSize: '1.02rem' }}>Escolher meu tema →</Link>
        </section>

        <nav style={{ marginTop: 36, textAlign: 'center', fontSize: '0.8rem', color: '#6e6e73' }}>
          <span>Mais: </span>
          {PT_SLUGS.filter((s) => s !== params.slug).map((s, i) => (
            <span key={s}>{i > 0 && ' · '}<Link href={`/pt/${s}`} style={{ color: '#86868b', textDecoration: 'none' }}>{PAGES[s].h1.split(':')[0].split(' — ')[0].slice(0, 28)}</Link></span>
          ))}
          {' · '}<Link href="/pt" style={{ color: '#86868b', textDecoration: 'none' }}>Início PT</Link>
        </nav>
      </div>
    </main>
  )
}
