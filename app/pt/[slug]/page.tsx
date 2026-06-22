// #487 — Páginas SEO em português (canal dark com IA). Programáticas sob /pt/.
// Alvo: buscas BR de alta intenção ("canal dark com IA", "alternativa ao Opus
// Clip em português", "criar shorts com IA"). Estáticas, no sitemap, FAQ schema,
// CTA Pix. Copy 100% PT-BR nativo. Vantagem: Pix no ar + produto upstream.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-static'
export const dynamicParams = false

type Section = { h: string; p: string }
type PtPage = { title: string; desc: string; h1: string; intro: string; sections: Section[]; faq: { q: string; a: string }[] }

const PAGES: Record<string, PtPage> = {
  'canal-dark-com-ia': {
    title: 'Como criar um canal dark com IA (ferramenta que faz o Short inteiro) — ShortsForgeAI',
    desc: 'Crie um canal dark com IA sem aparecer e sem editar. O ShortsForgeAI transforma uma ideia num Short pronto (roteiro + voz + imagens + legendas) em ~60s. Pague no Pix, a partir de R$24,90.',
    h1: 'Canal dark com IA: do zero ao Short pronto em 60 segundos',
    intro:
      'Montar um canal dark (faceless) trava na produção: roteiro, voz, busca de imagens, edição. O ShortsForgeAI resolve tudo isso num passo — você digita uma ideia e recebe um Short vertical pronto pra postar no YouTube Shorts, TikTok e Reels. Sem aparecer, sem filmar, sem editar. E você paga no Pix, em Real, sem IOF.',
    sections: [
      { h: 'Por que canal dark com IA explodiu', p: 'Canais dark monetizam sem rosto, sem câmera e sem equipe — só conteúdo. A IA derrubou a última barreira: antes você precisava de ChatGPT + ElevenLabs + CapCut + banco de imagens. Agora uma ferramenta só faz o pacote inteiro em ~60s, então dá pra postar todo dia sem virar editor.' },
      { h: 'Como o ShortsForgeAI faz', p: 'Você dá o tema. A IA escreve o roteiro com gancho viral, grava a narração com voz de IA, busca e encaixa as imagens cena a cena, e adiciona as legendas. Sai um MP4 9:16 pronto. Funciona pra qualquer nicho: finanças, mistério, história, curiosidades, motivação.' },
      { h: 'Quanto custa (e por que Pix importa)', p: 'Ferramentas gringas cobram em dólar e ainda levam IOF. Aqui você paga no Pix, em Real: pacotes a partir de R$24,90, créditos que não expiram. O primeiro Short é grátis, sem cartão.' },
    ],
    faq: [
      { q: 'Preciso aparecer ou gravar minha voz?', a: 'Não. É 100% faceless: roteiro, narração com voz de IA, imagens e legendas são gerados automaticamente. Você só escolhe o tema.' },
      { q: 'Funciona pra qualquer nicho de canal dark?', a: 'Sim — finanças, mistério, história, curiosidades, motivação e mais. A IA adapta o roteiro e as imagens ao tema.' },
      { q: 'Como pago?', a: 'No Pix, em Real, sem IOF. A partir de R$24,90, créditos não expiram. O primeiro vídeo é grátis, sem cartão.' },
    ],
  },
  'alternativa-opusclip-portugues': {
    title: 'Alternativa ao Opus Clip em português (com Pix) — ShortsForgeAI',
    desc: 'Procurando uma alternativa ao Opus Clip em português? O ShortsForgeAI cria o Short do zero a partir de uma ideia (não só corta vídeo longo), 100% faceless, e você paga no Pix. A partir de R$24,90.',
    h1: 'A alternativa ao Opus Clip em português — e com Pix',
    intro:
      'O Opus Clip é ótimo pra cortar um vídeo longo que você já gravou. Mas se você quer criar um Short faceless do zero, a partir de uma ideia, é outra ferramenta. O ShortsForgeAI escreve o roteiro, narra com voz de IA, busca as imagens e monta o Short em ~60s — em português de verdade, e com pagamento no Pix.',
    sections: [
      { h: 'A diferença que importa', p: 'Opus Clip = reaproveita vídeo longo (precisa do seu material). ShortsForgeAI = cria o vídeo inteiro a partir de uma ideia, sem você precisar de gravação nenhuma. Para canal dark, é a ferramenta certa: ela produz, não só recorta.' },
      { h: 'Português nativo + Pix sem IOF', p: 'O Opus Clip cobra em dólar e é fraco em português. Aqui a interface e a narração são em PT, e você paga no Pix, em Real, sem cartão internacional e sem IOF — a partir de R$24,90, créditos que não expiram.' },
      { h: 'Quando escolher cada um', p: 'Escolha o Opus Clip se você já grava vídeos longos ou podcasts e só quer cortá-los. Escolha o ShortsForgeAI se quer criar Shorts faceless do zero, em português, sem aparecer.' },
    ],
    faq: [
      { q: 'Qual a melhor alternativa ao Opus Clip em português?', a: 'O ShortsForgeAI é a alternativa brasileira: gera o Short completo (roteiro, voz, imagens e legendas) a partir de uma ideia, sem precisar subir vídeo, em PT e com pagamento no Pix a partir de R$24,90.' },
      { q: 'É mais barato que o Opus Clip pra quem é do Brasil?', a: 'Você paga no Pix em Real, sem IOF e sem cartão internacional — o que costuma sair bem mais em conta do que ferramentas cobradas em dólar. O primeiro Short é grátis.' },
      { q: 'Preciso ter um vídeo pronto pra usar?', a: 'Não. Diferente do Opus Clip, você só precisa de uma ideia — a IA cria o vídeo do zero.' },
    ],
  },
  'criar-shorts-com-ia': {
    title: 'Criar Shorts com IA em 60 segundos (sem editar) — ShortsForgeAI',
    desc: 'Crie Shorts com IA em ~60s: roteiro, voz, imagens e legendas no automático. Sem aparecer, sem editar. Pague no Pix, a partir de R$24,90. Primeiro vídeo grátis.',
    h1: 'Criar Shorts com IA em 60 segundos',
    intro:
      'Você digita uma ideia e o ShortsForgeAI monta o Short inteiro: roteiro com gancho, narração com voz de IA, imagens cena a cena e legendas. Pronto pra postar no YouTube Shorts, TikTok e Reels — sem aparecer, sem editar, em ~60 segundos.',
    sections: [
      { h: 'Uma ideia entra, um Short sai', p: 'Sem prompt complicado, sem timeline pra aprender. Tema → vídeo 9:16 pronto. É a forma mais rápida de postar conteúdo curto todo dia sem montar um estúdio.' },
      { h: 'Tudo no automático', p: 'A IA escreve o roteiro, grava a voz, encaixa as imagens e adiciona as legendas. Você só baixa e posta. Funciona em qualquer nicho.' },
      { h: 'Pague no Pix', p: 'Pacotes a partir de R$24,90, no Pix, sem IOF, créditos que não expiram. Primeiro Short grátis, sem cartão.' },
    ],
    faq: [
      { q: 'Em quanto tempo o Short fica pronto?', a: 'Cerca de 60 segundos, do tema ao vídeo 9:16 pronto pra baixar e postar.' },
      { q: 'Preciso saber editar?', a: 'Não. Não há timeline. Você digita uma ideia e recebe o vídeo finalizado, com voz e legendas.' },
      { q: 'Como pago?', a: 'No Pix, em Real, a partir de R$24,90. Créditos não expiram e o primeiro vídeo é grátis.' },
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
  const url = `https://www.shortsforgeai.com/pt/${params.slug}`
  return {
    metadataBase: new URL('https://www.shortsforgeai.com'),
    title: pg.title,
    description: pg.desc,
    alternates: { canonical: url },
    openGraph: { title: pg.title, description: pg.desc, url, type: 'website' },
  }
}

const CARD = { background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }

export default function PtSeoPage({ params }: { params: { slug: string } }) {
  const pg = PAGES[params.slug]
  if (!pg) notFound()
  const signupUrl = `/signup?utm_source=seo&utm_medium=pt&utm_campaign=${params.slug}`
  const faqJsonLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: pg.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <main style={{ minHeight: '100vh', background: '#0A0A0B', color: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 18px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/pt" style={{ color: '#22D3EE', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>⚡ ShortsForgeAI</Link>
          <Link href="/" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.8rem' }}>English</Link>
        </div>

        <section style={{ marginTop: 36 }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#22D3EE', background: 'rgba(34,211,238,0.1)', borderRadius: 999, padding: '6px 14px' }}>🇧🇷 Em português · Pix</div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: 900, lineHeight: 1.15, margin: '16px 0 0' }}>{pg.h1}</h1>
          <p style={{ fontSize: '1.02rem', color: '#CBD5E1', lineHeight: 1.6, margin: '14px 0 0' }}>{pg.intro}</p>
          <Link href={signupUrl} style={{ display: 'inline-block', marginTop: 20, background: 'linear-gradient(135deg,#22D3EE,#10B981)', color: '#0A0A0B', fontWeight: 900, padding: '14px 30px', borderRadius: 14, textDecoration: 'none', fontSize: '1.02rem' }}>Criar meu primeiro vídeo grátis →</Link>
        </section>

        {pg.sections.map((s) => (
          <section key={s.h} style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '0 0 8px' }}>{s.h}</h2>
            <p style={{ color: '#CBD5E1', lineHeight: 1.65, margin: 0, fontSize: '0.97rem' }}>{s.p}</p>
          </section>
        ))}

        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '0 0 14px' }}>Perguntas frequentes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pg.faq.map((f) => (
              <div key={f.q} style={{ ...CARD, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontWeight: 800, marginBottom: 6, fontSize: '0.95rem' }}>{f.q}</div>
                <p style={{ margin: 0, color: '#94A3B8', lineHeight: 1.6, fontSize: '0.9rem' }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 40, textAlign: 'center', ...CARD, borderRadius: 18, padding: '28px 20px' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, margin: 0 }}>Faça seu primeiro Short grátis</h2>
          <p style={{ color: '#CBD5E1', margin: '8px 0 18px', fontSize: '0.95rem' }}>Uma ideia entra, um Short pronto sai. Pague no Pix, sem cartão.</p>
          <Link href={signupUrl} style={{ display: 'inline-block', background: '#22D3EE', color: '#0A0A0B', fontWeight: 900, padding: '14px 30px', borderRadius: 12, textDecoration: 'none', fontSize: '1.02rem' }}>Começar grátis →</Link>
        </section>

        <nav style={{ marginTop: 36, textAlign: 'center', fontSize: '0.8rem', color: '#64748B' }}>
          <span>Mais: </span>
          {PT_SLUGS.filter((s) => s !== params.slug).map((s, i) => (
            <span key={s}>{i > 0 && ' · '}<Link href={`/pt/${s}`} style={{ color: '#94A3B8', textDecoration: 'none' }}>{PAGES[s].h1.split(':')[0].split(' — ')[0].slice(0, 28)}</Link></span>
          ))}
          {' · '}<Link href="/pt" style={{ color: '#94A3B8', textDecoration: 'none' }}>Início PT</Link>
        </nav>
      </div>
    </main>
  )
}
