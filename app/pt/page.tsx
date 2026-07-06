// #483 — Landing em português (Brasil). Aproveita as vantagens injustas do
// projeto no BR: público de "canal dark com IA" e
// preço em Real. Estática, no sitemap, com canonical + hreflang. CTA
// para /signup com UTM pt/brazil para o funil atribuir o tráfego brasileiro.
import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.shortsforgeai.com'),
  title: 'Kineo — Crie vídeos para canal dark com IA (em português)',
  description:
    'Transforme uma ideia em um Short faceless pronto (roteiro + voz IA + imagens + legendas) em ~60s. Em português, com preço em Real. A partir de R$24,90. Primeiro vídeo grátis.',
  alternates: {
    canonical: 'https://www.shortsforgeai.com/pt',
    languages: { 'en-US': 'https://www.shortsforgeai.com/', 'pt-BR': 'https://www.shortsforgeai.com/pt' },
  },
  openGraph: {
    title: 'Crie vídeos para canal dark com IA — em português',
    description:
      'Uma ideia vira um Short faceless pronto em ~60s. Roteiro, voz, imagens e legendas no automático. Primeiro vídeo grátis.',
    url: 'https://www.shortsforgeai.com/pt',
    type: 'website',
  },
}

const CARD = { background: '#161618', border: '1px solid #2a2a2d' }
const signupUrl = '/signup?utm_source=seo&utm_medium=pt&utm_campaign=brazil'

const faq = [
  {
    q: 'Funciona para canal dark / faceless?',
    a: 'Sim — é exatamente para isso. Você digita o tema e recebe um Short vertical pronto, sem aparecer, sem filmar e sem editar: roteiro, narração com voz de IA, imagens e legendas, tudo no automático.',
  },
  {
    q: 'Preciso pagar em dólar?',
    a: 'Não. Você paga em Real. Pacotes a partir de R$24,90 (one-time) — os créditos não expiram.',
  },
  {
    q: 'Em quanto tempo o vídeo fica pronto?',
    a: 'Cerca de 60 segundos. Uma ideia entra, um Short 9:16 pronto para postar no YouTube Shorts, TikTok e Reels sai.',
  },
  {
    q: 'Qual a diferença para o Opus Clip?',
    a: 'O Opus Clip corta vídeos longos que você JÁ gravou. O Kineo cria o vídeo do zero a partir de uma ideia — sem precisar de footage, sem aparecer, e em português de verdade.',
  },
]

export default function PtLandingPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 18px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/pt" style={{ color: '#2997ff', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>⚡ Kineo</Link>
          <Link href="/" style={{ color: '#86868b', textDecoration: 'none', fontSize: '0.8rem' }}>English</Link>
        </div>

        {/* Hero */}
        <section style={{ marginTop: 36, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#2997ff', background: 'rgba(41,151,255,0.12)', borderRadius: 999, padding: '6px 14px' }}>
            🇧🇷 Em português
          </div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5.5vw, 2.7rem)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.12, margin: '16px 0 0', background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Crie vídeos para canal dark com IA — sem aparecer, sem editar
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#86868b', lineHeight: 1.6, margin: '16px auto 0', maxWidth: 640 }}>
            Você digita uma ideia e o Kineo monta o Short faceless inteiro: <b>roteiro + voz de IA + imagens + legendas</b>, em cerca de 60 segundos. Pronto para postar no YouTube Shorts, TikTok e Reels.
          </p>
          <Link href={signupUrl} style={{ display: 'inline-block', marginTop: 22, background: '#f5f5f7', color: '#000', fontWeight: 600, padding: '15px 32px', borderRadius: 980, textDecoration: 'none', fontSize: '1.05rem' }}>
            Criar meu primeiro vídeo grátis →
          </Link>
          <p style={{ fontSize: '0.82rem', color: '#86868b', margin: '10px 0 0' }}>
            Primeiro vídeo <b style={{ color: '#2997ff' }}>grátis</b> · sem cartão · preço em Real
          </p>
        </section>

        {/* Como funciona */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, letterSpacing: '-0.025em', textAlign: 'center', margin: '0 0 18px', color: '#f5f5f7' }}>Como funciona</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { n: '1', t: 'Digite a ideia', d: 'Um tema, um fato, uma curiosidade. Uma frase já basta.' },
              { n: '2', t: 'A IA monta o vídeo', d: 'Roteiro, narração com voz de IA, imagens e legendas — tudo no automático.' },
              { n: '3', t: 'Baixe e poste', d: 'Um MP4 vertical 9:16 em ~60s, pronto para YouTube Shorts, TikTok e Reels.' },
            ].map((s) => (
              <div key={s.n} style={{ ...CARD, borderRadius: 20, padding: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(41,151,255,0.14)', color: '#2997ff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{s.n}</div>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#f5f5f7' }}>{s.t}</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#86868b', lineHeight: 1.5 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, letterSpacing: '-0.025em', textAlign: 'center', margin: '0 0 6px', color: '#f5f5f7' }}>Preço em Real</h2>
          <p style={{ textAlign: 'center', color: '#86868b', fontSize: '0.9rem', margin: '0 0 18px' }}>Pagamento único · sem assinatura · créditos não expiram</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { price: 'R$50', credits: '90 créditos', detail: '3 vídeos AI Gen ou 90 vídeos rápidos' },
              { price: 'R$90', credits: '180 créditos', detail: '6 vídeos AI Gen ou 180 vídeos rápidos' },
            ].map((p) => (
              <div key={p.price} style={{ ...CARD, borderRadius: 20, padding: '22px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 600, color: '#f5f5f7' }}>{p.price}</div>
                <div style={{ color: '#2997ff', fontWeight: 700, margin: '4px 0' }}>{p.credits}</div>
                <p style={{ color: '#86868b', fontSize: '0.85rem', margin: '0 0 14px' }}>{p.detail}</p>
                <Link href={signupUrl} style={{ display: 'inline-block', background: '#f5f5f7', color: '#000', fontWeight: 600, padding: '11px 22px', borderRadius: 980, textDecoration: 'none', fontSize: '0.92rem' }}>Começar →</Link>
              </div>
            ))}
          </div>
        </section>

        {/* vs OpusClip */}
        <section style={{ marginTop: 44, ...CARD, borderRadius: 20, padding: '20px 22px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 8px', color: '#f5f5f7' }}>Kineo x Opus Clip</h2>
          <p style={{ margin: 0, color: '#86868b', lineHeight: 1.6, fontSize: '0.95rem' }}>
            O Opus Clip <b>corta</b> vídeos longos que você já gravou e cobra em dólar. O Kineo <b>cria o vídeo do zero</b> a partir de uma ideia, 100% faceless, em português, com preço em Real. Para canal dark, é a ferramenta certa.
          </p>
        </section>

        {/* FAQ */}
        <section style={{ marginTop: 44 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, letterSpacing: '-0.025em', textAlign: 'center', margin: '0 0 18px', color: '#f5f5f7' }}>Perguntas frequentes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {faq.map((f) => (
              <div key={f.q} style={{ ...CARD, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.95rem', color: '#f5f5f7' }}>{f.q}</div>
                <p style={{ margin: 0, color: '#86868b', lineHeight: 1.6, fontSize: '0.9rem' }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section style={{ marginTop: 44, textAlign: 'center', ...CARD, borderRadius: 20, padding: '28px 20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: '#f5f5f7' }}>Faça seu primeiro Short grátis</h2>
          <p style={{ color: '#86868b', margin: '8px 0 18px', fontSize: '0.95rem' }}>Uma ideia entra, um Short pronto sai. Sem editar, sem cartão.</p>
          <Link href={signupUrl} style={{ display: 'inline-block', background: '#f5f5f7', color: '#000', fontWeight: 600, padding: '14px 30px', borderRadius: 980, textDecoration: 'none', fontSize: '1.02rem' }}>Começar grátis →</Link>
        </section>
      </div>
    </main>
  )
}
