'use client'

// #485 — Interactive free hook tool. Calls public /api/demo-hooks (no auth),
// renders 5 hooks, then pushes the visitor to signup to turn one into a video.
import { useState } from 'react'
import Link from 'next/link'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'
import { trackEvent } from '@/lib/analytics'

const SIGNUP = '/signup?utm_source=seo&utm_medium=tool&utm_campaign=hook-generator'
const CARD = { background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }
const EXAMPLES = ['Billionaire money habits', 'The Bermuda Triangle', 'Why we dream', 'Ancient Rome secrets']

function activationHref(topic: string, hook?: string): string {
  const cleanTopic = topic.trim().slice(0, 200)
  if (!cleanTopic) return SIGNUP
  const prompt = hook
    ? `Use this exact opening hook: "${hook.trim().slice(0, 220)}"\nTopic: ${cleanTopic}`
    : cleanTopic
  const destination = `/generate?${new URLSearchParams({ prompt, autoanalyze: '1' }).toString()}`
  const signup = new URLSearchParams({
    utm_source: 'seo',
    utm_medium: 'tool',
    utm_campaign: 'hook-generator',
    redirect: destination,
  })
  return `/signup?${signup.toString()}`
}

export default function FreeHookClient() {
  const [topic, setTopic] = useState('')
  const [hooks, setHooks] = useState<string[]>([])
  const [generatedTopic, setGeneratedTopic] = useState('')
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
      setGeneratedTopic(q)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 18px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ color: '#2997ff', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>Kineo</Link>
          <Link href="/free-script-generator" style={{ color: '#86868b', textDecoration: 'none', fontSize: '0.8rem' }}>Free script generator →</Link>
        </div>

        <section style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#2997ff', background: 'rgba(41,151,255,0.1)', borderRadius: 999, padding: '6px 14px' }}>Free · no signup</div>
          <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)', fontWeight: 900, lineHeight: 1.15, margin: '14px 0 0' }}>Free Viral Hook Generator</h1>
          <p style={{ fontSize: '1rem', color: '#CBD5E1', lineHeight: 1.6, margin: '14px auto 0', maxWidth: 600 }}>Type a topic and get 5 scroll-stopping hooks for your next YouTube Short or TikTok. No account needed.</p>
        </section>

        <section style={{ marginTop: 26, ...CARD, borderRadius: 16, padding: 18 }}>
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Billionaire money habits" rows={2} maxLength={200}
            style={{ width: '100%', boxSizing: 'border-box', background: '#000', color: '#f5f5f7', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 14px', fontSize: '1rem', resize: 'vertical', fontFamily: 'inherit' }} />
          <button onClick={() => generate()} disabled={loading}
            style={{ width: '100%', marginTop: 10, background: 'linear-gradient(135deg,#2997ff,#2997ff)', color: '#000', fontWeight: 900, padding: '14px', borderRadius: 12, border: 'none', fontSize: '1.02rem', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
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
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', padding: '10px 0', borderBottom: i < hooks.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div style={{ minWidth: 24, height: 24, borderRadius: 6, background: 'rgba(41,151,255,0.12)', color: '#2997ff', fontWeight: 900, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                  <div style={{ flex: '1 1 280px', fontSize: '1.02rem', lineHeight: 1.45, fontWeight: 600 }}>{h}</div>
                  <Link href={activationHref(generatedTopic, h)} onClick={() => { void trackEvent('free_hook_to_signup_clicked', { destination: 'generate', variant: 'hook', hook_index: i + 1, autoanalyze: true }) }} style={{ color: '#2997ff', fontWeight: 900, fontSize: '0.82rem', textDecoration: 'none', whiteSpace: 'nowrap', padding: '3px 0' }}>Create this Short →</Link>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, padding: '16px', borderRadius: 12, background: 'rgba(41,151,255,0.08)', border: '1px solid rgba(41,151,255,0.25)', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Pick a hook above to create the full Short 🎬</div>
              <p style={{ color: '#86868b', fontSize: '0.88rem', margin: '0 0 12px' }}>Your chosen hook and topic come with you after signup. AI writes the rest, then adds voiceover, footage and captions.</p>
              <Link href={activationHref(generatedTopic)} onClick={() => { void trackEvent('free_hook_to_signup_clicked', { destination: 'generate', variant: 'topic', autoanalyze: true }) }} style={{ display: 'inline-block', background: '#2997ff', color: '#000', fontWeight: 900, padding: '12px 26px', borderRadius: 10, textDecoration: 'none' }}>Create a Short from this topic →</Link>
            </div>
          </section>
        )}

        <section style={{ marginTop: 30, color: '#86868b', fontSize: '0.92rem', lineHeight: 1.65 }}>
          <h2 style={{ color: '#f5f5f7', fontSize: '1.15rem', fontWeight: 900, margin: '0 0 8px' }}>Why the hook decides everything</h2>
          <p style={{ margin: 0 }}>On YouTube Shorts and TikTok, the first 1-2 seconds decide whether your video gets watched or skipped. This free tool writes 5 pattern-interrupt hooks for any topic — the same hook logic that powers Kineo. Pick one, then <Link href={SIGNUP} style={{ color: '#2997ff' }}>turn it into a finished faceless Short in ~60s →</Link></p>
        </section>
      </div>
      <StickyFreeShortCTA />
    </main>
  )
}
