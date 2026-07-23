'use client'

// #484 — Interactive free script tool. Calls the public, rate-limited
// /api/demo-script (no auth) and renders the structured result, then pushes the
// visitor to signup to turn the script into a finished video. No browser storage.
import { useState } from 'react'
import Link from 'next/link'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'
import { trackEvent } from '@/lib/analytics'

const SIGNUP = '/signup?utm_source=seo&utm_medium=organic&utm_campaign=push22_script_generator'
const CARD = { background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }

const EXAMPLES = [
  'The island humans are forbidden to enter',
  '5 money habits of billionaires',
  'Why Iceland has no mosquitoes',
  'The unsolved case that broke the FBI',
]

type Line = { label: string; text: string }

function activationHref(lines: Line[]): string {
  if (lines.length === 0) return SIGNUP

  // The public result uses reader-friendly FACT labels. Translate those into
  // the markers understood by /generate so the approved script survives
  // signup/OAuth and enters the verbatim fast-path instead of being rewritten.
  const markerFor = (label: string): string => {
    const normalized = label.replace(/\s+/g, ' ').trim().toUpperCase()
    if (normalized === 'HOOK') return 'HOOK'
    if (normalized === 'FACT 1') return 'MICRO REWARD 1'
    if (normalized === 'FACT 2') return 'MICRO REWARD 2'
    if (normalized === 'FACT 3') return 'ESCALATION'
    if (normalized === 'PAYOFF') return 'PAYOFF'
    return label
  }
  const script = lines
    .slice(0, 5)
    .map(({ label, text }) => {
      const marker = markerFor(label)
      const safeText = text.slice(0, 220)
      return marker ? `${marker}: ${safeText}` : safeText
    })
    .join('\n')
  const destination = `/generate?${new URLSearchParams({ prompt: script, autoanalyze: '1' }).toString()}`
  const signup = new URLSearchParams({
    utm_source: 'seo',
    utm_medium: 'organic',
    utm_campaign: 'push22_script_generator',
    redirect: destination,
  })
  return `/signup?${signup.toString()}`
}

function parseScript(raw: string): Line[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(':')
      if (i > 0 && i < 16) return { label: l.slice(0, i).toUpperCase(), text: l.slice(i + 1).trim() }
      return { label: '', text: l }
    })
}

export default function FreeScriptClient() {
  const [topic, setTopic] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const createShortHref = activationHref(lines)

  async function generate(t?: string) {
    const q = (t ?? topic).trim()
    if (q.length < 3) {
      setError('Type a topic first.')
      return
    }
    setLoading(true)
    setError('')
    setLines([])
    try {
      const res = await fetch('/api/demo-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: q }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not generate. Try again.')
        return
      }
      setLines(parseScript(data.script || ''))
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
          <Link href="/pricing" style={{ color: '#86868b', textDecoration: 'none', fontSize: '0.8rem' }}>Pricing</Link>
        </div>

        {/* Hero */}
        <section style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#2997ff', background: 'rgba(41,151,255,0.1)', borderRadius: 999, padding: '6px 14px' }}>
            Free · no signup
          </div>
          <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)', fontWeight: 900, lineHeight: 1.15, margin: '14px 0 0' }}>
            Free YouTube Short Script Generator
          </h1>
          <p style={{ fontSize: '1rem', color: '#CBD5E1', lineHeight: 1.6, margin: '14px auto 0', maxWidth: 600 }}>
            Type a topic and get a viral, hook-driven faceless Short script (hook → 3 facts → payoff) in seconds. No account needed.
          </p>
        </section>

        {/* Tool */}
        <section style={{ marginTop: 26, ...CARD, borderRadius: 16, padding: 18 }}>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. The island humans are forbidden to enter"
            rows={2}
            maxLength={200}
            style={{ width: '100%', boxSizing: 'border-box', background: '#000', color: '#f5f5f7', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 14px', fontSize: '1rem', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <button
            onClick={() => generate()}
            disabled={loading}
            style={{ width: '100%', marginTop: 10, background: 'linear-gradient(135deg,#2997ff,#2997ff)', color: '#000', fontWeight: 900, padding: '14px', borderRadius: 12, border: 'none', fontSize: '1.02rem', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '✍️ Writing your script…' : 'Generate my script →'}
          </button>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => { setTopic(ex); generate(ex) }} disabled={loading}
                style={{ background: 'rgba(255,255,255,0.05)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '7px 13px', fontSize: '0.8rem', cursor: 'pointer' }}>
                {ex}
              </button>
            ))}
          </div>
          {error && <p style={{ color: '#FDA4AF', fontSize: '0.88rem', margin: '12px 0 0' }}>{error}</p>}
        </section>

        {/* Result */}
        {lines.length > 0 && (
          <section style={{ marginTop: 18, ...CARD, borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {lines.map((l, i) => (
                <div key={i}>
                  {l.label && <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', color: '#2997ff', marginBottom: 2 }}>{l.label}</div>}
                  <div style={{ fontSize: '1rem', lineHeight: 1.5 }}>{l.text}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, padding: '16px', borderRadius: 12, background: 'rgba(41,151,255,0.08)', border: '1px solid rgba(41,151,255,0.25)', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Now turn this into a finished video 🎬</div>
              <p style={{ color: '#86868b', fontSize: '0.88rem', margin: '0 0 12px' }}>AI adds the voiceover, footage and captions — a ready-to-post 9:16 Short in a few minutes. Your script comes with you after signup.</p>
              <Link href={createShortHref} onClick={() => { void trackEvent('free_script_to_signup_clicked', { destination: 'generate', autoanalyze: true }); void trackEvent('organic_cta_clicked', { source: 'push22_script_generator', placement: 'result' }) }} style={{ display: 'inline-block', background: '#2997ff', color: '#000', fontWeight: 900, padding: '12px 26px', borderRadius: 10, textDecoration: 'none' }}>Create this Short from my script →</Link>
            </div>
          </section>
        )}

        {/* SEO copy */}
        <section style={{ marginTop: 30, color: '#86868b', fontSize: '0.92rem', lineHeight: 1.65 }}>
          <h2 style={{ color: '#f5f5f7', fontSize: '1.15rem', fontWeight: 900, margin: '0 0 8px' }}>How the free script generator works</h2>
          <p style={{ margin: '0 0 14px' }}>
            This free tool writes a complete, retention-optimized script for a 45-60 second faceless YouTube Short. It uses the same viral structure that powers Kineo — a pattern-interrupt <b>hook</b>, three escalating <b>facts</b>, and a <b>payoff</b> that delivers on the hook. Works for any niche: finance, history, mystery, motivation and more. No login, no credit card.
        </p>
          <h2 style={{ color: '#f5f5f7', fontSize: '1.15rem', fontWeight: 900, margin: '0 0 8px' }}>From script to finished Short</h2>
          <p style={{ margin: 0 }}>
            A script is step one. Inside Kineo, the same idea becomes a finished, ready-to-post video — AI voiceover, matched footage and captions, rendered vertical (9:16), usually in 2–4 minutes. <Link href={createShortHref} onClick={() => { void trackEvent('free_script_to_signup_clicked', { destination: 'generate', placement: 'explainer', autoanalyze: lines.length > 0 }); void trackEvent('organic_cta_clicked', { source: 'push22_script_generator', placement: 'explainer' }) }} style={{ color: '#2997ff' }}>Create this Short →</Link>
          </p>
        </section>
      </div>
      <StickyFreeShortCTA />
    </main>
  )
}
