'use client'

// Push #051 — V2 prototype page.
//
// STAGING ONLY. This page is intentionally UI-only — the Generate
// Preview button is disabled and no provider is actually called.
// The existing /generate flow at app/(dashboard)/generate/* must
// remain 100% untouched and is the path the "Use Current Generator"
// CTA below points at.
//
// Architecture context: V2_PRODUCT_PLAN.md, V2_TECHNICAL_ARCHITECTURE.md,
// V2_PROVIDER_RESEARCH.md, and lib/providers/index.ts.

import Link from 'next/link'
import { useState } from 'react'
import { VIDEO_PROVIDERS, V2_CREDIT_MODEL, type V2DurationKey } from '@/lib/providers'

// ─── Static option lists ────────────────────────────────────────────────────
const VIDEO_TYPES = [
  { id: 'short', label: 'Short Video', hint: 'Vertical, fast-cut, 10–50s.' },
  { id: 'faceless', label: 'Faceless Video', hint: 'No on-camera talent.' },
  { id: 'explainer', label: 'Explainer', hint: 'Teaches one concept clearly.' },
  { id: 'ad', label: 'Ad', hint: 'Strong hook + CTA in the last 3s.' },
  { id: 'educational', label: 'Educational', hint: 'Captions front and centre.' },
  { id: 'product', label: 'Product Video', hint: 'Product shots + USP overlays.' },
  { id: 'history', label: 'History / Facts', hint: 'High-retention narration.' },
] as const

const DURATIONS: { id: V2DurationKey; label: string; beta?: boolean }[] = [
  { id: '10s', label: '10s' },
  { id: '30s', label: '30s' },
  { id: '50s', label: '50s' },
  { id: '90s', label: '90s', beta: true },
  { id: '120s', label: '120s', beta: true },
]

const PLATFORMS = [
  { id: 'shorts', label: 'YouTube Shorts', aspect: '9:16' },
  { id: 'tiktok', label: 'TikTok', aspect: '9:16' },
  { id: 'reels', label: 'Instagram Reels', aspect: '9:16' },
  { id: 'youtube', label: 'YouTube', aspect: '16:9' },
  { id: 'ig_feed', label: 'Instagram Feed', aspect: '1:1' },
  { id: 'general', label: 'General Video', aspect: '16:9' },
] as const

const ENGINES = [
  {
    id: 'fast',
    label: 'Fast',
    hint: 'Stock-clip composition. Lowest cost.',
    providerHint: 'Stock library',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    hint: 'Runway Gen-4.5 generative clips. Best look-to-cost ratio.',
    providerHint: VIDEO_PROVIDERS.runway.name,
  },
  {
    id: 'premium',
    label: 'Premium',
    hint: 'Reserved for an upcoming model (research stage).',
    providerHint: VIDEO_PROVIDERS.kling.name,
  },
] as const

// Example niches shown as static cards at the bottom. No click handlers —
// this is UI-only.
const EXAMPLES: {
  title: string
  prompt: string
  duration: V2DurationKey
  platform: string
  type: string
}[] = [
  {
    title: 'Space Mystery',
    prompt: 'A signal from deep space that scientists still cannot explain.',
    duration: '30s',
    platform: 'YouTube Shorts',
    type: 'Faceless Video',
  },
  {
    title: 'History Facts',
    prompt: 'Three forgotten Roman engineering tricks that still work today.',
    duration: '50s',
    platform: 'TikTok',
    type: 'History / Facts',
  },
  {
    title: 'Product Demo',
    prompt: 'Demo the new ShortsForgeAI flow in under a minute.',
    duration: '50s',
    platform: 'Instagram Reels',
    type: 'Product Video',
  },
  {
    title: 'Faceless Explainer',
    prompt: 'How compound interest quietly builds millionaires.',
    duration: '90s',
    platform: 'YouTube',
    type: 'Explainer',
  },
  {
    title: 'TikTok Ad',
    prompt: 'A 15s ad for a productivity app — hook in the first second.',
    duration: '30s',
    platform: 'TikTok',
    type: 'Ad',
  },
  {
    title: 'Educational Video',
    prompt: 'Why the ocean is salty — explained for curious minds.',
    duration: '120s',
    platform: 'YouTube',
    type: 'Educational',
  },
]

export default function V2PrototypePage() {
  const [prompt, setPrompt] = useState('')
  const [videoType, setVideoType] = useState<string>('short')
  const [duration, setDuration] = useState<V2DurationKey>('30s')
  const [platform, setPlatform] = useState<string>('shorts')
  const [engine, setEngine] = useState<string>('cinematic')

  const cost = V2_CREDIT_MODEL[duration]
  const engineMeta = ENGINES.find((e) => e.id === engine)
  const premiumLocked = engine === 'premium'

  return (
    <main className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
      {/* ─── Staging-only banner ─── */}
      <div
        className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3 flex-wrap"
        style={{
          background: 'linear-gradient(135deg, rgba(251,191,36,.10), rgba(245,158,11,.06))',
          border: '1px solid rgba(251,191,36,.40)',
          color: '#fbbf24',
        }}
      >
        <span
          className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded"
          style={{
            background: 'rgba(251,191,36,.18)',
            border: '1px solid rgba(251,191,36,.50)',
            color: '#fde68a',
          }}
        >
          V2 Beta — Staging Only
        </span>
        <span className="text-xs font-bold">
          UI prototype. Generation is disabled — your credits are safe.
        </span>
      </div>

      {/* ─── Header ─── */}
      <div className="mb-6">
        <h1 className="font-black text-2xl sm:text-3xl mb-2" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Create AI videos for Shorts, Reels, ads, explainers and faceless channels.
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted2)', lineHeight: 1.55 }}>
          Turn one idea into a complete video with visuals, voiceover, captions and final render.
        </p>
      </div>

      {/* ─── Idea textarea ─── */}
      <section
        className="rounded-2xl p-5 sm:p-6 mb-6"
        style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
      >
        <label
          className="block text-xs font-black uppercase tracking-widest mb-2"
          style={{ color: 'var(--muted)' }}
        >
          Your idea
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video you want. e.g. A faceless 90s YouTube explainer about why time slows down near a black hole."
          maxLength={1000}
          className="w-full rounded-xl px-4 py-4 text-sm leading-relaxed"
          style={{
            width: '100%',
            maxWidth: '830px',
            background: 'rgba(0,0,0,.3)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
            resize: 'none',
            minHeight: '400px',
          }}
        />

        {/* ─── Selectors ─── */}
        <div className="grid gap-5 mt-6" style={{ gridTemplateColumns: '1fr' }}>
          <Selector
            label="Video Type"
            options={VIDEO_TYPES.map((v) => ({ id: v.id, label: v.label, hint: v.hint }))}
            value={videoType}
            onChange={setVideoType}
          />
          <DurationSelector value={duration} onChange={setDuration} />
          <Selector
            label="Platform"
            options={PLATFORMS.map((p) => ({ id: p.id, label: p.label, hint: p.aspect }))}
            value={platform}
            onChange={setPlatform}
          />
          <EngineSelector value={engine} onChange={setEngine} />
        </div>

        {/* ─── Cost preview ─── */}
        <div
          className="rounded-xl px-4 py-3 mt-6 flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: 'rgba(37,99,235,.08)',
            border: '1px solid rgba(37,99,235,.25)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
            <strong style={{ color: '#93c5fd' }}>{duration}</strong> · {engineMeta?.label} engine ·{' '}
            <span style={{ color: 'var(--muted)' }}>{engineMeta?.providerHint}</span>
          </div>
          <div className="text-xs font-bold" style={{ color: '#93c5fd' }}>
            Estimated cost: {cost.basic} / {cost.pro} credits (basic / pro)
          </div>
        </div>

        {/* ─── Actions ─── */}
        <div className="flex items-center justify-end gap-3 mt-5 flex-wrap">
          <Link
            href="/generate"
            className="rounded-xl px-5 py-2.5 text-sm font-bold"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            Use Current Generator →
          </Link>
          <button
            type="button"
            disabled
            title={
              premiumLocked
                ? 'Premium engine is in research — see V2_PROVIDER_RESEARCH.md'
                : 'V2 generation is not wired up yet — prototype only.'
            }
            className="rounded-xl px-5 py-2.5 text-sm font-black"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              cursor: 'not-allowed',
            }}
          >
            Generate Preview · Coming Soon
          </button>
        </div>
      </section>

      {/* ─── Example niches ─── */}
      <section
        className="rounded-2xl p-5 sm:p-6 mb-6"
        style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
      >
        <div className="mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
            Example formats
          </div>
          <h3 className="font-black text-base sm:text-lg" style={{ color: 'var(--text)' }}>
            What V2 will be able to build
          </h3>
        </div>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          {EXAMPLES.map((ex) => (
            <div
              key={ex.title}
              className="rounded-xl p-4 flex flex-col gap-2"
              style={{
                background: 'rgba(255,255,255,.03)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="text-sm font-black" style={{ color: 'var(--text)' }}>
                {ex.title}
              </div>
              <p
                className="text-xs"
                style={{ color: 'var(--muted2)', lineHeight: 1.45, margin: 0 }}
              >
                “{ex.prompt}”
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Chip>{ex.type}</Chip>
                <Chip>{ex.duration}</Chip>
                <Chip>{ex.platform}</Chip>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-center" style={{ color: 'var(--muted)' }}>
        V2 is a parallel surface. V1 lives at <Link href="/generate" style={{ color: '#93c5fd', textDecoration: 'none' }}>/generate</Link> and is unaffected by anything on this page.
      </p>
    </main>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-bold"
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: 'rgba(37,99,235,.10)',
        border: '1px solid rgba(37,99,235,.25)',
        color: '#93c5fd',
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  )
}

function Selector({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: string; label: string; hint?: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = value === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className="rounded-full px-3 py-1.5 text-sm font-bold"
              style={{
                background: selected ? 'rgba(37,99,235,.85)' : 'rgba(255,255,255,.04)',
                border: selected ? '1px solid rgba(37,99,235,.6)' : '1px solid var(--border)',
                color: selected ? '#fff' : 'var(--muted2)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              title={o.hint}
            >
              {o.label}
              {o.hint ? (
                <span
                  className="ml-1.5 text-[10px] font-bold"
                  style={{ color: selected ? 'rgba(255,255,255,.7)' : 'var(--muted)' }}
                >
                  · {o.hint}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DurationSelector({
  value,
  onChange,
}: {
  value: V2DurationKey
  onChange: (id: V2DurationKey) => void
}) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
        Duration
      </div>
      <div className="flex flex-wrap gap-2">
        {DURATIONS.map((d) => {
          const selected = value === d.id
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onChange(d.id)}
              className="rounded-full px-3 py-1.5 text-sm font-bold inline-flex items-center gap-1.5"
              style={{
                background: selected ? 'rgba(37,99,235,.85)' : 'rgba(255,255,255,.04)',
                border: selected ? '1px solid rgba(37,99,235,.6)' : '1px solid var(--border)',
                color: selected ? '#fff' : 'var(--muted2)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {d.label}
              {d.beta && (
                <span
                  className="text-[9px] font-black uppercase tracking-widest"
                  style={{
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: 'rgba(251,191,36,.18)',
                    border: '1px solid rgba(251,191,36,.45)',
                    color: '#fde68a',
                    letterSpacing: '0.08em',
                  }}
                >
                  V2 beta
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EngineSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
        Engine
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {ENGINES.map((e) => {
          const selected = value === e.id
          const research = e.id === 'premium'
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onChange(e.id)}
              className="rounded-xl p-3 text-left"
              style={{
                background: selected ? 'rgba(37,99,235,.12)' : 'rgba(255,255,255,.03)',
                border: selected ? '1px solid rgba(37,99,235,.55)' : '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-black" style={{ color: selected ? '#93c5fd' : 'var(--text)' }}>
                  {e.label}
                </span>
                {research && (
                  <span
                    className="text-[9px] font-black uppercase tracking-widest"
                    style={{
                      padding: '1px 6px',
                      borderRadius: 999,
                      background: 'rgba(251,191,36,.18)',
                      border: '1px solid rgba(251,191,36,.45)',
                      color: '#fde68a',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Research
                  </span>
                )}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--muted2)', lineHeight: 1.45 }}>
                {e.hint}
              </div>
              <div className="text-[10px] mt-1.5" style={{ color: 'var(--muted)' }}>
                {e.providerHint}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
