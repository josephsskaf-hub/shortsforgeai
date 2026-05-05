'use client'

import { useState } from 'react'

const TOOLS = [
  {
    id: 'viral-hook',
    icon: '🎣',
    title: 'Viral Hook Generator',
    desc: 'Generate attention-grabbing opening lines that stop the scroll and keep viewers watching.',
    tags: ['Hook', 'Retention', 'Watch Time'],
    color: '#818cf8',
    status: 'coming_soon',
  },
  {
    id: 'youtube-title',
    icon: '📺',
    title: 'YouTube Title Generator',
    desc: 'Craft click-worthy titles optimized for YouTube Shorts algorithm and search discoverability.',
    tags: ['SEO', 'CTR', 'Algorithm'],
    color: '#f87171',
    status: 'coming_soon',
  },
  {
    id: 'hashtag',
    icon: '#️⃣',
    title: 'Hashtag Generator',
    desc: 'Get platform-specific hashtag sets for TikTok, Instagram Reels, and YouTube Shorts.',
    tags: ['TikTok', 'Instagram', 'YouTube'],
    color: '#34d399',
    status: 'coming_soon',
  },
  {
    id: 'video-prompt',
    icon: '🎬',
    title: 'Video Prompt Generator',
    desc: 'Generate detailed AI image and video prompts to visualize your short-form content.',
    tags: ['AI Video', 'Visuals', 'Prompt'],
    color: '#fbbf24',
    status: 'coming_soon',
  },
  {
    id: 'cta',
    icon: '📣',
    title: 'CTA Generator',
    desc: 'Create powerful calls-to-action that drive likes, follows, comments, and shares.',
    tags: ['Engagement', 'Growth', 'Conversion'],
    color: '#a855f7',
    status: 'coming_soon',
  },
]

export default function TemplatesClient() {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div className="px-6 py-7 pb-20">
      {/* Header */}
      <div className="mb-8">
        <div className="font-black uppercase tracking-widest mb-1" style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}>
          Creator Toolkit
        </div>
        <h1 className="font-black tracking-tight mb-2" style={{ fontSize: '1.45rem', color: 'var(--text)', lineHeight: 1.15 }}>
          <span style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Templates</span> & Tools
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', maxWidth: 520, lineHeight: 1.55 }}>
          A growing suite of AI tools to supercharge your short-form content creation. Each tool is purpose-built for viral growth.
        </p>
      </div>

      {/* Coming soon banner */}
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3 mb-7"
        style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.18)' }}
      >
        <span className="text-lg">🚧</span>
        <div>
          <p className="text-xs font-bold" style={{ color: '#fbbf24' }}>Tools coming soon</p>
          <p className="text-xs" style={{ color: 'var(--muted)', marginTop: 2 }}>
            These tools are under development. The main <strong style={{ color: 'var(--text2)' }}>Short Generator</strong> on Dashboard is fully live today.
          </p>
        </div>
      </div>

      {/* Tools grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {TOOLS.map((tool) => (
          <div
            key={tool.id}
            onMouseEnter={() => setHoveredId(tool.id)}
            onMouseLeave={() => setHoveredId(null)}
            className="rounded-2xl p-6 transition-all relative overflow-hidden"
            style={{
              background: 'var(--card)',
              border: hoveredId === tool.id ? `1px solid ${tool.color}40` : '1px solid var(--border)',
              cursor: 'default',
              boxShadow: hoveredId === tool.id ? `0 8px 32px ${tool.color}14` : 'none',
            }}
          >
            {/* Status badge */}
            <div
              className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.2)', color: '#fbbf24', fontSize: '0.6rem' }}
            >
              Coming Soon
            </div>

            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
              style={{
                background: `${tool.color}15`,
                border: `1px solid ${tool.color}28`,
              }}
            >
              {tool.icon}
            </div>

            {/* Content */}
            <h3 className="font-bold mb-2" style={{ fontSize: '0.95rem', color: 'var(--text)' }}>
              {tool.title}
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              {tool.desc}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {tool.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-md font-medium"
                  style={{ background: `${tool.color}12`, border: `1px solid ${tool.color}22`, color: tool.color, fontSize: '0.65rem' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div
        className="mt-8 rounded-2xl p-7 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,.08), rgba(124,58,237,.05))',
          border: '1px solid rgba(99,102,241,.18)',
        }}
      >
        <div className="text-3xl mb-3">⚡</div>
        <h2 className="font-black mb-2 tracking-tight" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
          Ready to generate viral content now?
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          The main Short Generator is fully live. Pick a niche and generate 5 viral scripts in 30 seconds.
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black text-white"
          style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', boxShadow: '0 4px 22px rgba(99,102,241,.35)', textDecoration: 'none' }}
        >
          ⚡ Go to Dashboard
        </a>
      </div>
    </div>
  )
}
