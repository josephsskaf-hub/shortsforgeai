'use client'

// #485 — Interactive free hook tool. Calls public /api/demo-hooks (no auth),
// renders 5 hooks, then pushes the visitor to signup to turn one into a video.
import { useState } from 'react'
import Link from 'next/link'

const SIGNUP = '/signup?utm_source=seo&utm_medium=tool&utm_campaign=hook-generator'
const CARD = { background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }
const EXAMPLES = ['Billionaire money habits', 'The Bermuda Triangle', 'Why we dream', 'Ancient Rome secrets']

export default function FreeHookClient() {
  const [topic, setTopic] = useState('')
  const [hooks, setHooks] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate(t?: string) {
    const q = (t ?? topic).trim()
    if (q.length < 3) { setError('Type a topic first.'); return }
    setLoading(true); setError(''); setHooks([])
    try {
      const res = await fetch('/api/demo-hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: q }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.error || 'Could not generate. Try again.'); return }
      setHooks(Array.isArray(data.hooks) ? data.hooks : [])
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0A0A0B', color: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 18px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ color: '#22D3EE', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>⚡ ShortsForgeAI</Link>
          <Link href="/free-script-generator" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.8rem' }}>Free script generator →</Link>
        </div>

        <section style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#22D3EE', background: 'rgba(34,211,238,0.1)', borderRadius: 999, padding: '6px 14px' }}>Free · no signup</div>
          <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)', fontWeight: 900, lineHeight: 1.15, margin: '14px 0 0' }}>Free Viral Hook Generator</h1>
          <p style={{ fontSize: '1rem', color: '#CBD5E1', lineHeight: 1.6, margin: '14px auto 0', maxWidth: 600 }}>Type a topic and get 5 scroll-stopping hooks for your next YouTube Short or TikTok. No account needed.</p>
        </section>

        <section style={{ marginTop: 26, ...CARD, borderRadius: 16, padding: 18 }}>
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Billionaire money habits" rows={2} maxLength={200}
            style={{ width: '100%', boxSizing: 'border-box', background: '#0A0A0B', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 14px', fontSize: '1rem', resize: 'vertical', fontFamily: 'inherit' }} />
          <button onClick={() => generate()} disabled={loading}
            style={{ width: '100%', marginTop: 10, background: 'linear-gradient(135deg,#22D3EE,#10B981)', color: '#0A0A0B', fontWeight: 900, padding: '14px', borderRadius: 12, border: 'none', fontSize: '1.02rem', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? '✍️ Writing hooks…' : 'Generate 5 hooks →'}
          </button>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => { setTopic(ex); generate(ex) }} disabled={loading}
                style={{ background: 'rgba(255,255,255,0.05)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '7px 13px', fontSize: '0.8rem', cursor: 'pointer' }}>{ex}</button>
            ))}
          </div>
          {error && <p style={{ color: '#FDA4AF', fontSize: '0.88rem', margin: '12px 0 0' }}>{error}</p>}
        </section>

        {hooks.length > 0 && (
          <section style={{ marginTop: 18, ...CARD, borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hooks.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 24, height: 24, borderRadius: 6, background: 'rgba(34,211,238,0.12)', color: '#22D3EE', fontWeight: 900, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                  <div style={{ fontSize: '1.02rem', lineHeight: 1.45, fontWeight: 600 }}>{h}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, padding: '16px', borderRadius: 12, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Turn a hook into a finished video 🎬</div>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', margin: '0 0 12px' }}>AI writes the rest, adds voiceover, footage and captions — a ready-to-post Short in ~60s. First one free.</p>
              <Link href={SIGNUP} style={{ display: 'inline-block', background: '#22D3EE', color: '#0A0A0B', fontWeight: 900, padding: '12px 26px', borderRadius: 10, textDecoration: 'none' }}>Make the full video free →</Link>
            </div>
          </section>
        )}

        <section style={{ marginTop: 30, color: '#94A3B8', fontSize: '0.92rem', lineHeight: 1.65 }}>
          <h2 style={{ color: '#F1F5F9', fontSize: '1.15rem', fontWeight: 900, margin: '0 0 8px' }}>Why the hook decides everything</h2>
          <p style={{ margin: 0 }}>On YouTube Shorts and TikTok, the first 1-2 seconds decide whether your video gets watched or skipped. This free tool writes 5 pattern-interrupt hooks for any topic — the same hook logic that powers ShortsForgeAI. Pick one, then <Link href={SIGNUP} style={{ color: '#22D3EE' }}>turn it into a finished faceless Short in ~60s →</Link></p>
        </section>
      </div>
    </main>
  )
}
