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
  title: 'Kineo x Perrengue Chique',
  description: 'A ferramenta que o Perrengue Chique usa pra criar Shorts faceless com IA em 60s. Primeiro vídeo grátis, sem cartão.',
  robots: { index: false, follow: false },
}

const CARD = { background: '#161618', border: '1px solid #2a2a2d' }
// Trocar pelo cupom real quando o deal fechar. Tracking já apontando pra campanha.
const CODE = 'PERRENGUE'
const signupUrl = '/signup?utm_source=perrengue&utm_medium=creator&utm_campaign=perrengue'

export default function PerrenguePage() {
  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 18px 64px', textAlign: 'center' }}>
        <Link href="/pt" style={{ color: '#2997ff', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>⚡ Kineo</Link>

        <section style={{ marginTop: 40 }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#2997ff', background: 'rgba(41,151,255,0.12)', borderRadius: 999, padding: '6px 14px' }}>Indicado pelo Perrengue Chique</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 6vw, 2.7rem)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.12, margin: '16px 0 0', background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>A ferramenta que faz seu Short faceless em 60 segundos</h1>
          <p style={{ fontSize: '1.05rem', color: '#86868b', lineHeight: 1.6, margin: '16px auto 0', maxWidth: 600 }}>
            Você digita uma ideia e o Kineo monta o vídeo inteiro: roteiro + voz de IA + imagens + legendas. Sem aparecer, sem editar.
          </p>
          <div style={{ ...CARD, borderRadius: 14, padding: '16px 20px', maxWidth: 360, margin: '22px auto 0' }}>
            <div style={{ fontSize: '0.85rem', color: '#86868b' }}>Cupom exclusivo</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#2997ff', letterSpacing: '2px' }}>{CODE}</div>
          </div>
          <Link href={signupUrl} style={{ display: 'inline-block', marginTop: 22, background: '#f5f5f7', color: '#000', fontWeight: 600, padding: '15px 34px', borderRadius: 980, textDecoration: 'none', fontSize: '1.05rem' }}>Criar meu primeiro Short grátis →</Link>
          <p style={{ fontSize: '0.82rem', color: '#86868b', margin: '10px 0 0' }}>Primeiro vídeo grátis · sem cartão</p>
        </section>
      </div>
    </main>
  )
}
