'use client'

import { useState } from 'react'
import Link from 'next/link'

const CHANNEL_NICHES = [
  {
    id: 'money',
    emoji: '💰',
    name: 'Money Facts',
    rpm: '$12–22',
    growth: 'Very High',
    competition: 'Medium',
    bestFor: 'Finance audience, high monetization',
    posting: '1–2x daily',
    style: 'Dark cinematic, text overlays',
    hooks: ['This bank NEVER told you...', 'The #1 wealth secret hidden from you', '95% of people get this WRONG about money'],
    color: 'rgba(41,151,255,.1)',
    border: 'rgba(41,151,255,.25)',
    accent: '#2997ff',
  },
  {
    id: 'mind',
    emoji: '🧠',
    name: 'Mind Blowing Facts',
    rpm: '$4–8',
    growth: 'Explosive',
    competition: 'High',
    bestFor: 'Massive shareability, saves & rewatches',
    posting: '2–3x daily',
    style: 'Fast cuts, dramatic music, text on screen',
    hooks: ['Your brain does THIS without you knowing', 'Scientists JUST discovered something terrifying', 'The human mind can do things you never imagined'],
    color: 'rgba(255,255,255,.05)',
    border: '#3a3a3d',
    accent: '#f5f5f7',
  },
  {
    id: 'dark',
    emoji: '😱',
    name: 'Dark Mysteries',
    description: 'Horror & mystery niche that creates binge-watch loops',
    rpm: '$5–10',
    growth: 'High',
    competition: 'Medium',
    bestFor: 'Watch time, binge loops, horror fans',
    posting: '1–2x daily',
    style: 'Eerie music, dark visuals, suspenseful pacing',
    hooks: ['This terrifying event was COVERED UP', 'Nobody survived to tell this story... until now', 'The government buried this for 50 years'],
    color: 'rgba(255,255,255,.05)',
    border: '#3a3a3d',
    accent: '#f5f5f7',
  },
  {
    id: 'space',
    emoji: '🚀',
    name: 'Space Mysteries',
    rpm: '$5–9',
    growth: 'High',
    competition: 'Medium',
    bestFor: 'Curiosity-driven audience, strong saves',
    posting: '1–2x daily',
    style: 'Cinematic space visuals, dramatic narration',
    hooks: ['NASA REFUSES to explain this', 'What they found in deep space will terrify you', 'This planet should not exist'],
    color: 'rgba(41,151,255,.08)',
    border: 'rgba(41,151,255,.2)',
    accent: '#5cb3ff',
  },
]

const POSTING_SCHEDULE = [
  { time: '7:00 AM', label: 'Morning Drop', note: 'Hook early risers before work' },
  { time: '12:30 PM', label: 'Lunch Drop', note: 'Peak scroll time on breaks' },
  { time: '7:00 PM', label: 'Evening Drop', note: 'Highest algorithm push window' },
]

const GROWTH_MILESTONES = [
  { subs: '0 → 1K', timeframe: '2–4 weeks', key: 'Post daily, optimize hooks, reply to comments', icon: '🌱' },
  { subs: '1K → 10K', timeframe: '1–3 months', key: 'Double down on top 3 performing formats', icon: '📈' },
  { subs: '10K → 100K', timeframe: '3–6 months', key: 'Consistent posting + community tab + Shorts remix', icon: '🚀' },
  { subs: '100K+', timeframe: '6–12 months', key: 'Brand deals, memberships, course upsells', icon: '💎' },
]

export default function ChannelBuilderClient() {
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'strategy' | 'schedule' | 'growth'>('strategy')

  const selected = CHANNEL_NICHES.find((n) => n.id === selectedNiche)

  return (
    <div className="px-4 md:px-6 py-7 pb-20">
      {/* Header */}
      <div className="mb-7">
        <div
          className="font-black uppercase mb-2 flex items-center gap-2"
          style={{ fontSize: '0.65rem', letterSpacing: '0.18em', color: '#2997ff' }}
        >
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#2997ff', verticalAlign: 'middle' }} />
          Faceless Channel Builder
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#2997ff', verticalAlign: 'middle' }} />
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-black tracking-tight mb-1" style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: '#f5f5f7', lineHeight: 1.1 }}>
              Build Your{' '}
              <span style={{ background: 'linear-gradient(135deg, #2997ff, #5cb3ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Viral Channel
              </span>
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#86868b' }}>
              Full strategy, posting schedule & growth roadmap for your niche.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-[980px] px-4 py-2 text-xs font-bold flex-shrink-0 transition-all"
            style={{ background: '#f5f5f7', color: '#000', textDecoration: 'none' }}
          >
            ⚡ Generate Videos
          </Link>
        </div>
      </div>

      {/* Niche picker */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#86868b' }}>
          Step 1 — Choose your niche
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {CHANNEL_NICHES.map((niche) => (
            <button
              key={niche.id}
              onClick={() => { setSelectedNiche(niche.id); setActiveTab('strategy') }}
              className="text-left rounded-2xl p-4 transition-all"
              style={{
                background: selectedNiche === niche.id ? niche.color : '#161618',
                border: selectedNiche === niche.id ? `2px solid ${niche.border}` : '1px solid #2a2a2d',
                boxShadow: selectedNiche === niche.id ? `0 0 30px ${niche.border}` : 'none',
                cursor: 'pointer',
              }}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-xl">{niche.emoji}</span>
                <div>
                  <div className="font-black text-sm" style={{ color: '#f5f5f7' }}>{niche.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: niche.accent }}>RPM {niche.rpm}</div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(255,255,255,.05)', color: '#86868b' }}>
                  {niche.growth} growth
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(255,255,255,.05)', color: '#86868b' }}>
                  {niche.competition} competition
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Strategy panel */}
      {selected && (
        <div className="animate-fade-in">
          {/* Tabs */}
          <div className="flex gap-1 mb-5 rounded-xl p-1" style={{ background: '#161618', border: '1px solid #2a2a2d', width: 'fit-content' }}>
            {(['strategy', 'schedule', 'growth'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize"
                style={{
                  background: activeTab === tab ? 'rgba(41,151,255,.16)' : 'transparent',
                  color: activeTab === tab ? '#2997ff' : '#86868b',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {tab === 'strategy' ? '🎯 Strategy' : tab === 'schedule' ? '📅 Schedule' : '📈 Growth'}
              </button>
            ))}
          </div>

          {/* Strategy tab */}
          {activeTab === 'strategy' && (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {/* Channel blueprint */}
              <div className="rounded-2xl p-5" style={{ background: '#161618', border: `1px solid ${selected.border}`, boxShadow: `0 0 40px ${selected.color}` }}>
                <div className="text-2xl mb-3">{selected.emoji}</div>
                <h2 className="font-black text-base mb-3" style={{ color: '#f5f5f7' }}>{selected.name} Blueprint</h2>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start gap-2">
                    <span className="text-xs mt-0.5">💰</span>
                    <div>
                      <div className="text-xs font-bold" style={{ color: '#f5f5f7' }}>Estimated RPM</div>
                      <div className="text-xs" style={{ color: selected.accent }}>{selected.rpm}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs mt-0.5">🎬</span>
                    <div>
                      <div className="text-xs font-bold" style={{ color: '#f5f5f7' }}>Video Style</div>
                      <div className="text-xs" style={{ color: '#86868b' }}>{selected.style}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs mt-0.5">📅</span>
                    <div>
                      <div className="text-xs font-bold" style={{ color: '#f5f5f7' }}>Posting Frequency</div>
                      <div className="text-xs" style={{ color: '#86868b' }}>{selected.posting}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs mt-0.5">🎯</span>
                    <div>
                      <div className="text-xs font-bold" style={{ color: '#f5f5f7' }}>Best For</div>
                      <div className="text-xs" style={{ color: '#86868b' }}>{selected.bestFor}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Proven hooks */}
              <div className="rounded-2xl p-5" style={{ background: '#161618', border: '1px solid #2a2a2d' }}>
                <h3 className="font-black text-sm mb-1" style={{ color: '#f5f5f7' }}>🪝 Proven Hook Formulas</h3>
                <p className="text-xs mb-4" style={{ color: '#86868b' }}>First 3 seconds = everything. Use these exact patterns.</p>
                <div className="flex flex-col gap-2.5">
                  {selected.hooks.map((hook, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                      style={{ background: 'rgba(255,255,255,.03)', border: '1px solid #2a2a2d' }}
                    >
                      <span className="text-xs font-black mt-0.5" style={{ color: selected.accent }}>#{i + 1}</span>
                      <span className="text-xs leading-relaxed" style={{ color: '#f5f5f7' }}>{hook}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Channel setup checklist */}
              <div className="rounded-2xl p-5" style={{ background: '#161618', border: '1px solid #2a2a2d' }}>
                <h3 className="font-black text-sm mb-1" style={{ color: '#f5f5f7' }}>✅ Channel Setup Checklist</h3>
                <p className="text-xs mb-4" style={{ color: '#86868b' }}>Do these once and you're ready to post.</p>
                <div className="flex flex-col gap-2">
                  {[
                    'Channel name: "NicheName Facts" or "NicheName Daily"',
                    'Profile pic: dark background + niche emoji',
                    'Channel description: include target niche keywords',
                    'Banner: use Canva faceless channel template',
                    'Enable channel memberships (at 500 subs)',
                    'Link usekineo.com in description',
                    'Set up auto-publish with YouTube Studio',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs" style={{ color: '#f5f5f7' }}>
                      <span style={{ color: '#2997ff', flexShrink: 0 }}>✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Schedule tab */}
          {activeTab === 'schedule' && (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <div className="rounded-2xl p-5" style={{ background: '#161618', border: '1px solid #2a2a2d' }}>
                <h3 className="font-black text-sm mb-1" style={{ color: '#f5f5f7' }}>📅 Daily Posting Schedule</h3>
                <p className="text-xs mb-4" style={{ color: '#86868b' }}>These windows maximize algorithm push for YouTube Shorts.</p>
                <div className="flex flex-col gap-3">
                  {POSTING_SCHEDULE.map((slot) => (
                    <div
                      key={slot.time}
                      className="flex items-center gap-4 rounded-xl px-4 py-3"
                      style={{ background: 'rgba(41,151,255,.06)', border: '1px solid rgba(41,151,255,.16)' }}
                    >
                      <div className="font-black text-sm" style={{ color: '#2997ff', minWidth: 70 }}>{slot.time}</div>
                      <div>
                        <div className="font-bold text-xs" style={{ color: '#f5f5f7' }}>{slot.label}</div>
                        <div className="text-xs" style={{ color: '#86868b' }}>{slot.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-5" style={{ background: '#161618', border: '1px solid #2a2a2d' }}>
                <h3 className="font-black text-sm mb-1" style={{ color: '#f5f5f7' }}>⚡ Weekly Content Plan</h3>
                <p className="text-xs mb-4" style={{ color: '#86868b' }}>Use Kineo to batch-create your week in one session.</p>
                <div className="flex flex-col gap-2">
                  {[
                    { day: 'Monday', tip: 'Generate 2 packs (10 scripts) — schedule week' },
                    { day: 'Tuesday–Friday', tip: 'Post 1–2 Shorts/day from your batch' },
                    { day: 'Saturday', tip: 'Review analytics — double down on top format' },
                    { day: 'Sunday', tip: 'Generate next week\'s batch + review comments' },
                  ].map(({ day, tip }) => (
                    <div key={day} className="text-xs py-2.5" style={{ borderBottom: '1px solid #2a2a2d', color: '#f5f5f7' }}>
                      <strong style={{ color: '#f5f5f7' }}>{day}:</strong> {tip}
                    </div>
                  ))}
                </div>
                <Link
                  href="/dashboard"
                  className="mt-4 block w-full text-center rounded-[980px] py-2.5 text-xs font-black transition-all"
                  style={{ background: '#f5f5f7', color: '#000', textDecoration: 'none' }}
                >
                  ⚡ Generate This Week&apos;s Batch →
                </Link>
              </div>
            </div>
          )}

          {/* Growth tab */}
          {activeTab === 'growth' && (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <div className="rounded-2xl p-5" style={{ background: '#161618', border: '1px solid #2a2a2d' }}>
                <h3 className="font-black text-sm mb-1" style={{ color: '#f5f5f7' }}>📈 Growth Milestones</h3>
                <p className="text-xs mb-4" style={{ color: '#86868b' }}>Your realistic roadmap from 0 to 100K.</p>
                <div className="flex flex-col gap-3">
                  {GROWTH_MILESTONES.map((m) => (
                    <div
                      key={m.subs}
                      className="flex items-start gap-3 rounded-xl px-4 py-3"
                      style={{ background: 'rgba(255,255,255,.025)', border: '1px solid #2a2a2d' }}
                    >
                      <span className="text-xl flex-shrink-0">{m.icon}</span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-xs" style={{ color: '#f5f5f7' }}>{m.subs}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(41,151,255,.12)', color: '#2997ff' }}>{m.timeframe}</span>
                        </div>
                        <div className="text-xs" style={{ color: '#86868b' }}>{m.key}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-5" style={{ background: '#161618', border: '1px solid #2a2a2d' }}>
                <h3 className="font-black text-sm mb-1" style={{ color: '#f5f5f7' }}>💡 Monetization Paths</h3>
                <p className="text-xs mb-4" style={{ color: '#86868b' }}>Multiple revenue streams for faceless creators.</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    { icon: '📺', label: 'YouTube AdSense', note: `RPM ${selected.rpm} — enable at 1K subs + 4K hours`, when: '1K subs' },
                    { icon: '🤝', label: 'Brand Sponsorships', note: 'Finance/tech brands pay $200–2K/Short', when: '10K subs' },
                    { icon: '🎓', label: 'Digital Products', note: 'Sell a course on faceless channel building', when: '5K subs' },
                    { icon: '👥', label: 'Channel Memberships', note: 'Exclusive content for $4.99/mo', when: '500 subs' },
                    { icon: '🔗', label: 'Affiliate Marketing', note: 'Finance tools, apps, services in description', when: 'Day 1' },
                  ].map(({ icon, label, note, when }) => (
                    <div key={label} className="flex items-start gap-3 text-xs py-2.5" style={{ borderBottom: '1px solid #2a2a2d', color: '#f5f5f7' }}>
                      <span className="text-base flex-shrink-0">{icon}</span>
                      <div className="flex-1">
                        <div className="font-bold" style={{ color: '#f5f5f7' }}>{label}</div>
                        <div className="mt-0.5" style={{ color: '#86868b' }}>{note}</div>
                      </div>
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(41,151,255,.1)', color: '#2997ff' }}>{when}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bottom CTA */}
          <div
            className="mt-6 rounded-2xl p-5 text-center"
            style={{ background: 'rgba(41,151,255,.08)', border: '1px solid rgba(41,151,255,.22)' }}
          >
            <p className="font-black text-sm mb-1" style={{ color: '#f5f5f7' }}>
              Ready to start your {selected.name} channel?
            </p>
            <p className="text-xs mb-4" style={{ color: '#86868b' }}>
              Generate your first viral Shorts pack now and post today.
            </p>
            <Link
              href={`/dashboard?niche=${selected.id}`}
              className="inline-flex items-center gap-2 rounded-[980px] px-6 py-3 text-sm font-black transition-all"
              style={{
                background: '#f5f5f7',
                color: '#000',
                textDecoration: 'none',
              }}
            >
              {selected.emoji} Generate {selected.name} Scripts →
            </Link>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selected && (
        <div className="text-center py-12 rounded-2xl" style={{ background: '#161618', border: '1px solid #2a2a2d' }}>
          <div className="text-5xl mb-3">👆</div>
          <p className="font-bold text-sm" style={{ color: '#f5f5f7' }}>Pick a niche above to get your full strategy</p>
          <p className="text-xs mt-1" style={{ color: '#86868b' }}>Blueprint, schedule, hooks & growth roadmap included.</p>
        </div>
      )}
    </div>
  )
}
