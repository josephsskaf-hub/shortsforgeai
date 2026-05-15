'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ─── Script examples ──────────────────────────────────────────────────────────
const EXAMPLES = [
  {
    niche: '💰 Money Facts',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.25)',
    badge: '#064e3b',
    badgeText: '#6ee7b7',
    hook: 'The bank never told you this... 🏦',
    script:
      "Every dollar in your savings account is losing value right now. Inflation is eating 4% per year. The average savings account pays 0.5%. That means you're losing 3.5% annually just by doing nothing. Here's what the wealthy do instead...",
    hashtags: '#moneyfacts #finance #shorts #wealth',
  },
  {
    niche: '😱 Dark Mysteries',
    color: '#22D3EE',
    glow: 'rgba(34, 211, 238,0.25)',
    badge: '#2e1065',
    badgeText: '#22D3EE',
    hook: 'This was erased from history books... 😱',
    script:
      'In 1908, a massive explosion in Siberia leveled 800 square miles of forest. No crater was ever found. Scientists still debate the cause 100 years later. Some say comet. Some say meteor. Others say something else entirely...',
    hashtags: '#darkmysteries #conspiracy #shorts #history',
  },
  {
    niche: '🤯 Mind Blowing Facts',
    color: '#f472b6',
    glow: 'rgba(244,114,182,0.25)',
    badge: '#500724',
    badgeText: '#fbcfe8',
    hook: 'Your brain is lying to you right now 🤯',
    script:
      "Every memory you have is a reconstruction, not a recording. Each time you remember something, your brain rewrites it slightly. This means your oldest memories are the most distorted. You've been living with edited versions of your own past...",
    hashtags: '#mindblowing #psychology #facts #shorts',
  },
]

// Character typing speed (ms per char)
const SPEED_HOOK = 38
const SPEED_SCRIPT = 14
const SPEED_HASH = 22

type Phase =
  | 'fadeIn'
  | 'typingHook'
  | 'pauseHook'
  | 'typingScript'
  | 'pauseScript'
  | 'typingHash'
  | 'pauseEnd'
  | 'fadeOut'

export default function LiveScriptPreview() {
  const [exIdx, setExIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('fadeIn')
  const [visible, setVisible] = useState(false)

  // Typed text state for each field
  const [hook, setHook] = useState('')
  const [script, setScript] = useState('')
  const [hash, setHash] = useState('')

  // Active cursor tracker: 'hook' | 'script' | 'hash' | ''
  const [cursor, setCursor] = useState<'hook' | 'script' | 'hash' | ''>('')

  // Ref to current char index for the active typing operation
  const charIdx = useRef(0)

  const ex = EXAMPLES[exIdx]

  // ─── Phase machine ──────────────────────────────────────────────────────────
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>

    if (phase === 'fadeIn') {
      setVisible(true)
      t = setTimeout(() => setPhase('typingHook'), 350)
    }

    else if (phase === 'typingHook') {
      setCursor('hook')
      if (charIdx.current < ex.hook.length) {
        t = setTimeout(() => {
          charIdx.current += 1
          setHook(ex.hook.slice(0, charIdx.current))
        }, SPEED_HOOK)
      } else {
        t = setTimeout(() => { charIdx.current = 0; setPhase('pauseHook') }, 400)
      }
    }

    else if (phase === 'pauseHook') {
      t = setTimeout(() => setPhase('typingScript'), 300)
    }

    else if (phase === 'typingScript') {
      setCursor('script')
      if (charIdx.current < ex.script.length) {
        t = setTimeout(() => {
          charIdx.current += 1
          setScript(ex.script.slice(0, charIdx.current))
        }, SPEED_SCRIPT)
      } else {
        t = setTimeout(() => { charIdx.current = 0; setPhase('pauseScript') }, 400)
      }
    }

    else if (phase === 'pauseScript') {
      t = setTimeout(() => setPhase('typingHash'), 300)
    }

    else if (phase === 'typingHash') {
      setCursor('hash')
      if (charIdx.current < ex.hashtags.length) {
        t = setTimeout(() => {
          charIdx.current += 1
          setHash(ex.hashtags.slice(0, charIdx.current))
        }, SPEED_HASH)
      } else {
        t = setTimeout(() => { charIdx.current = 0; setPhase('pauseEnd') }, 2800)
      }
    }

    else if (phase === 'pauseEnd') {
      setCursor('')
      t = setTimeout(() => setPhase('fadeOut'), 500)
    }

    else if (phase === 'fadeOut') {
      setVisible(false)
      t = setTimeout(() => {
        // Reset text + advance to next example
        setHook('')
        setScript('')
        setHash('')
        charIdx.current = 0
        setExIdx((i) => (i + 1) % EXAMPLES.length)
        setPhase('fadeIn')
      }, 600)
    }

    return () => clearTimeout(t)
  }, [phase, hook, script, hash, ex])

  // ─── Cursor blink component ─────────────────────────────────────────────────
  const Cursor = ({ active }: { active: boolean }) =>
    active ? (
      <span
        style={{
          display: 'inline-block',
          width: 2,
          height: '1em',
          background: ex.color,
          borderRadius: 2,
          marginLeft: 2,
          verticalAlign: 'text-bottom',
          animation: 'lsp-blink 0.8s step-end infinite',
        }}
      />
    ) : null

  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '0 24px 80px',
        maxWidth: 780,
        margin: '0 auto',
      }}
    >
      {/* Section header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div
          style={{
            fontSize: '0.6rem',
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: 'var(--indigo-light)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Live Preview
        </div>
        <h2
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            marginBottom: 10,
          }}
        >
          Watch it generate{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #60A5FA, #22D3EE)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            in real time
          </span>
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted2)', fontWeight: 500 }}>
          See the product working before you sign up.
        </p>
      </div>

      {/* Terminal card */}
      <div
        style={{
          background: 'rgba(8,8,20,0.95)',
          border: `1px solid ${ex.color}40`,
          borderRadius: 20,
          boxShadow: `0 0 0 1px ${ex.color}18 inset, 0 0 60px ${ex.glow}`,
          overflow: 'hidden',
          transition: 'border-color 0.6s ease, box-shadow 0.6s ease, opacity 0.5s ease, transform 0.5s ease',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(10px)',
        } as React.CSSProperties}
      >
        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 20px',
            borderBottom: `1px solid rgba(255,255,255,0.06)`,
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          {/* Traffic light dots */}
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
          <span style={{ flex: 1 }} />
          {/* Niche pill */}
          <span
            style={{
              padding: '3px 12px',
              borderRadius: 999,
              fontSize: '0.72rem',
              fontWeight: 800,
              background: ex.badge,
              color: ex.badgeText,
              border: `1px solid ${ex.color}30`,
              letterSpacing: '0.01em',
              transition: 'all 0.4s ease',
            }}
          >
            {ex.niche}
          </span>
          {/* Live dot */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.65rem',
              fontWeight: 700,
              color: ex.color,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: ex.color,
                boxShadow: `0 0 6px ${ex.color}`,
                display: 'inline-block',
                animation: 'lsp-pulse 1.4s ease-in-out infinite',
              }}
            />
            AI LIVE
          </span>
        </div>

        {/* Script body */}
        <div style={{ padding: '24px 24px 28px', fontFamily: "'JetBrains Mono', 'Fira Mono', 'Courier New', monospace" }}>
          {/* Hook line */}
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: ex.color,
                marginBottom: 6,
                opacity: 0.8,
              }}
            >
              🪝 Hook
            </div>
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#f1f5f9',
                lineHeight: 1.5,
                minHeight: '1.5em',
              }}
            >
              {hook}
              <Cursor active={cursor === 'hook'} />
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 18 }} />

          {/* Script body */}
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: ex.color,
                marginBottom: 6,
                opacity: 0.8,
              }}
            >
              📝 Script
            </div>
            <div
              style={{
                fontSize: '0.82rem',
                color: '#94a3b8',
                lineHeight: 1.75,
                minHeight: '3em',
              }}
            >
              {script}
              <Cursor active={cursor === 'script'} />
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 18 }} />

          {/* Hashtags */}
          <div>
            <div
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: ex.color,
                marginBottom: 6,
                opacity: 0.8,
              }}
            >
              #️⃣ Hashtags
            </div>
            <div
              style={{
                fontSize: '0.82rem',
                color: '#60a5fa',
                lineHeight: 1.5,
                minHeight: '1.5em',
                fontWeight: 600,
              }}
            >
              {hash}
              <Cursor active={cursor === 'hash'} />
            </div>
          </div>
        </div>

        {/* Footer bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 20px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
            shortsforgeai · ~35s · YouTube Shorts
          </span>
          {/* Niche indicator dots */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {EXAMPLES.map((e, i) => (
              <span
                key={i}
                style={{
                  width: i === exIdx ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: i === exIdx ? ex.color : 'rgba(255,255,255,0.15)',
                  transition: 'all 0.4s ease',
                  display: 'inline-block',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* CTA below card */}
      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <Link
          href="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 32px',
            borderRadius: 14,
            fontSize: '0.92rem',
            fontWeight: 900,
            color: '#fff',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 55%, #22D3EE 100%)',
            boxShadow: '0 6px 30px rgba(59, 130, 246,0.45)',
          }}
        >
          ⚡ Generate yours →
        </Link>
        <p style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 10 }}>
          Free to start · No credit card required
        </p>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes lsp-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes lsp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.45;transform:scale(0.8)} }
      `}</style>
    </section>
  )
}
