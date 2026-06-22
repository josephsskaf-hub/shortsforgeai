// #483 — Landing em português (Brasil). Aproveita as vantagens injustas do
// projeto no BR: Pix/Mercado Pago já no ar, público de "canal dark com IA", e
// preço em Real sem IOF. Estática, no sitemap, com canonical + hreflang. CTA
// para /signup com UTM pt/brazil para o funil atribuir o tráfego brasileiro.
import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.shortsforgeai.com'),
  title: 'ShortsForgeAI — Crie vídeos para canal dark com IA (em português, Pix)',
  description:
    'Transforme uma ideia em um Short faceless pronto (roteiro + voz IA + imagens + legendas) em ~60s. Em português, pague no Pix em Real (sem IOF). A partir de R$24,90. Primeiro vídeo grátis.',
  alternates: {
    canonical: 'https://www.shortsforgeai.com/pt',
    languages: { 'en-US': 'https://www.shortsforgeai.com/', 'pt-BR': 'https://www.shortsforgeai.com/pt' },
  },
  openGraph: {
    title: 'Crie vídeos para canal dark com IA — em português, com Pix',
    description:
      'Uma ideia vira um Short faceless pronto em ~60s. Roteiro, voz, imagens e legendas no automático. Pague no Pix. Primeiro vídeo grátis.',
    url: 'https://www.shortsforgeai.com/pt',
    type: 'website',
  },
}

const CARD = { background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }
const signupUrl = '/signup?utm_source=seo&utm_medium=pt&utm_campaign=brazil'

const faq = [
  {
    q: 'Funciona para canal dark / faceless?',
    a: 'Sim — é exatamente para isso. Você digita o tema e recebe um Short vertical pronto, sem aparecer, sem filmar e sem editar: roteiro, narração com voz de IA, imagens e legendas, tudo no automático.',
  },
  {
    q: 'Preciso pagar em dólar?',
    a: 'Não. Você paga no Pix, em Real, sem IOF e sem cartão internacional. Pacotes a partir de R$24,90 (one-time) — os créditos não expiram.',
  },
  {
    q: 'Em quanto tempo o vídeo fica pronto?',
    a: 'Cerca de 60 segundos. Uma ideia entra, um Short 9:16 pronto para postar no YouTube Shorts, TikTok e Reels sai.',
  },
  {
    q: 'Qual a diferença para o Opus Clip?',
    a: 'O Opus Clip corta vídeos longos que você JÁ gravou. O ShortsForgeAI cria o vídeo do zero a partir de uma ideia — sem precisar de footage, sem aparecer, e em português de verdade.',
  },
]

export default function PtLandingPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <main style={{ minHeight: '100vh', background: '#0A0A0B', color: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 18px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/pt" style={{ color: '#22D3EE', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>⚡ ShortsForgeAI</Link>
          <Link href="/" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.8rem' }}>English</Link>
        </div>

        {/* Hero */}
        <section style={{ marginTop: 36, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#22D3EE', background: 'rgba(34,211,238,0.1)', borderRadius: 999, padding: '6px 14px' }}>
            🇧🇷 Em português · pague no Pix
          </div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5.5vw, 2.7rem)', fontWeight: 900, lineHeight: 1.12, margin: '16px 0 0' }}>
            Crie vídeos para canal dark com IA — sem aparecer, sem editar
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#CBD5E1', lineHeight: 1.6, margin: '16px auto 0', maxWidth: 640 }}>
            Você digita uma ideia e o ShortsForgeAI monta o Short faceless inteiro: <b>roteiro + voz de IA + imagens + legendas</b>, em cerca de 60 segundos. Pronto para postar no YouTube Shorts, TikTok e Reels.
          </p>
          <Link href={signupUrl} style={{ display: 'inline-block', marginTop: 22, background: 'linear-gradient(135deg,#22D3EE,#10B981)', color: '#0A0A0B', fontWeight: 900, padding: '15px 32px', borderRadius: 14, textDecoration: 'none', fontSize: '1.05rem' }}>
            Criar meu primeiro vídeo grátis →
          </Link>
          <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '10px 0 0' }}>
            Primeiro vídeo <b style={{ color: '#22D3EE' }}>grátis</b> · sem cartão · pague no Pix em Real (sem IOF)
          </p>
        </section>

        {/* Como funciona */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>Como funciona</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { n: '1', t: 'Digite a ideia', d: 'Um tema, um fato, uma curiosidade. Uma frase já basta.' },
              { n: '2', t: 'A IA monta o vídeo', d: 'Roteiro, narração com voz de IA, imagens e legendas — tudo no automático.' },
              { n: '3', t: 'Baixe e poste', d: 'Um MP4 vertical 9:16 em ~60s, pronto para YouTube Shorts, TikTok e Reels.' },
            ].map((s) => (
              <div key={s.n} style={{ ...CARD, borderRadius: 14, padding: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(34,211,238,0.12)', color: '#22D3EE', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{s.n}</div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{s.t}</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94A3B8', lineHeight: 1.5 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pix pricing */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 6px' }}>Pague no Pix, em Real</h2>
          <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.9rem', margin: '0 0 18px' }}>Pagamento único · sem assinatura · créditos não expiram</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { price: 'R$50', credits: '90 créditos', detail: '3 vídeos AI Gen ou 90 vídeos rápidos' },
              { price: 'R$90', credits: '180 créditos', detail: '6 vídeos AI Gen ou 180 vídeos rápidos' },
            ].map((p) => (
              <div key={p.price} style={{ ...CARD, borderRadius: 16, padding: '22px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 900 }}>{p.price}</div>
                <div style={{ color: '#22D3EE', fontWeight: 800, margin: '4px 0' }}>{p.credits}</div>
                <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: '0 0 14px' }}>{p.detail}</p>
                <Link href={signupUrl} style={{ display: 'inline-block', background: '#22D3EE', color: '#0A0A0B', fontWeight: 900, padding: '11px 22px', borderRadius: 10, textDecoration: 'none', fontSize: '0.92rem' }}>Começar →</Link>
              </div>
            ))}
          </div>
        </section>

        {/* vs OpusClip */}
        <section style={{ marginTop: 44, ...CARD, borderRadius: 16, padding: '20px 22px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: '0 0 8px' }}>ShortsForgeAI x Opus Clip</h2>
          <p style={{ margin: 0, color: '#CBD5E1', lineHeight: 1.6, fontSize: '0.95rem' }}>
            O Opus Clip <b>corta</b> vídeos longos que você já gravou e cobra em dólar (com IOF). O ShortsForgeAI <b>cria o vídeo do zero</b> a partir de uma ideia, 100% faceless, em português, e você paga no Pix. Para canal dark, é a ferramenta certa.
          </p>
        </section>

        {/* FAQ */}
        <section style={{ marginTop: 44 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>Perguntas frequentes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {faq.map((f) => (
              <div key={f.q} style={{ ...CARD, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontWeight: 800, marginBottom: 6, fontSize: '0.95rem' }}>{f.q}</div>
                <p style={{ margin: 0, color: '#94A3B8', lineHeight: 1.6, fontSize: '0.9rem' }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section style={{ marginTop: 44, textAlign: 'center', ...CARD, borderRadius: 18, padding: '28px 20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Faça seu primeiro Short grátis</h2>
          <p style={{ color: '#CBD5E1', margin: '8px 0 18px', fontSize: '0.95rem' }}>Uma ideia entra, um Short pronto sai. Sem editar, sem cartão.</p>
          <Link href={signupUrl} style={{ display: 'inline-block', background: '#22D3EE', color: '#0A0A0B', fontWeight: 900, padding: '14px 30px', borderRadius: 12, textDecoration: 'none', fontSize: '1.02rem' }}>Começar grátis →</Link>
        </section>
      </div>
    </main>
  )
}
