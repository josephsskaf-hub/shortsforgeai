// #488 — Landing da campanha Perrengue Chique (DORMENTE até o deal fechar).
// noindex (não entra no sitemap nem no Google) até virar pública. Quando o deal
// fechar: trocar CODE pelo cupom real, tirar o noindex, e o Perrengue posta o
// vídeo "como eu faço meus Shorts" apontando pra cá. Tracking via UTM perrengue.
import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static'

// Dormente: não indexar até o lançamento.
export const metadata: Metadata = {
  metadataBase: new URL('https://www.shortsforgeai.com'),
  title: 'ShortsForgeAI x Perrengue Chique',
  description: 'A ferramenta que o Perrengue Chique usa pra criar Shorts faceless com IA em 60s. Pague no Pix.',
  robots: { index: false, follow: false },
}

const CARD = { background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }
// Trocar pelo cupom real quando o deal fechar. Tracking já apontando pra campanha.
const CODE = 'PERRENGUE'
const signupUrl = '/signup?utm_source=perrengue&utm_medium=creator&utm_campaign=perrengue'

export default function PerrenguePage() {
  return (
    <main style={{ minHeight: '100vh', background: '#0A0A0B', color: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 18px 64px', textAlign: 'center' }}>
        <Link href="/pt" style={{ color: '#22D3EE', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>⚡ ShortsForgeAI</Link>

        <section style={{ marginTop: 40 }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#22D3EE', background: 'rgba(34,211,238,0.1)', borderRadius: 999, padding: '6px 14px' }}>Indicado pelo Perrengue Chique</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 6vw, 2.7rem)', fontWeight: 900, lineHeight: 1.12, margin: '16px 0 0' }}>A ferramenta que faz seu Short faceless em 60 segundos</h1>
          <p style={{ fontSize: '1.05rem', color: '#CBD5E1', lineHeight: 1.6, margin: '16px auto 0', maxWidth: 600 }}>
            Você digita uma ideia e o ShortsForgeAI monta o vídeo inteiro: roteiro + voz de IA + imagens + legendas. Sem aparecer, sem editar. Pague no Pix.
          </p>
          <div style={{ ...CARD, borderRadius: 14, padding: '16px 20px', maxWidth: 360, margin: '22px auto 0' }}>
            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Cupom exclusivo</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#22D3EE', letterSpacing: '2px' }}>{CODE}</div>
          </div>
          <Link href={signupUrl} style={{ display: 'inline-block', marginTop: 22, background: 'linear-gradient(135deg,#22D3EE,#10B981)', color: '#0A0A0B', fontWeight: 900, padding: '15px 34px', borderRadius: 14, textDecoration: 'none', fontSize: '1.05rem' }}>Criar meu primeiro Short grátis →</Link>
          <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '10px 0 0' }}>Primeiro vídeo grátis · sem cartão · pague no Pix</p>
        </section>
      </div>
    </main>
  )
}
