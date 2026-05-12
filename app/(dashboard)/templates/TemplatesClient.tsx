'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─── Hook Generator Data ─────────────────────────────────────────────────────

const HOOK_STYLES = [
  { id: 'shocking', label: '😱 Shocking Stat', template: (topic: string) => [
    `99% of people don't know this about ${topic}`,
    `This ${topic} fact will blow your mind`,
    `Scientists are SHOCKED by what they discovered about ${topic}`,
    `The truth about ${topic} they never taught you in school`,
    `${topic} just changed EVERYTHING and nobody's talking about it`,
  ]},
  { id: 'secret', label: '🔒 Hidden Secret', template: (topic: string) => [
    `The ${topic} secret they don't want you to know`,
    `Why the government hides the truth about ${topic}`,
    `This was buried for 50 years — the real story of ${topic}`,
    `They LIED to you about ${topic} your whole life`,
    `Insider reveals the shocking truth about ${topic}`,
  ]},
  { id: 'question', label: '❓ Open Loop', template: (topic: string) => [
    `What if everything you knew about ${topic} was wrong?`,
    `Can you guess what happened when they tested ${topic}?`,
    `Why does ${topic} make millionaires nervous?`,
    `What's the one thing about ${topic} nobody talks about?`,
    `How does ${topic} actually work behind the scenes?`,
  ]},
  { id: 'fear', label: '⚠️ Fear Trigger', template: (topic: string) => [
    `You're making a huge mistake with ${topic} right now`,
    `Stop doing THIS with ${topic} immediately`,
    `Most people lose everything because of ${topic}`,
    `${topic} is more dangerous than you think`,
    `If you ignore ${topic}, this will happen to you`,
  ]},
  { id: 'number', label: '🔢 Number Hook', template: (topic: string) => [
    `3 facts about ${topic} that will change how you see the world`,
    `The #1 thing nobody tells you about ${topic}`,
    `5 seconds of ${topic} knowledge that took experts decades to learn`,
    `The top 3 secrets about ${topic} revealed`,
    `Here are 7 things about ${topic} that will leave you speechless`,
  ]},
]

const TITLE_STYLES = [
  { id: 'curiosity', label: '🧠 Curiosity Gap', template: (topic: string) => [
    `The ${topic} Secret Nobody Talks About #shorts`,
    `What They NEVER Told You About ${topic} #facts`,
    `${topic}: The Truth FINALLY Revealed #shorts`,
    `I Can't Believe This About ${topic} #mindblown`,
    `The ${topic} Truth Will Shock You #viral`,
  ]},
  { id: 'number', label: '🔢 Listicle', template: (topic: string) => [
    `3 ${topic} Facts That Will Blow Your Mind #shorts`,
    `5 Things About ${topic} That Changed History #facts`,
    `Top 7 ${topic} Secrets Experts Hide #viral`,
    `The #1 ${topic} Fact Nobody Knows #shorts`,
    `10 Shocking ${topic} Truths Revealed #mindblown`,
  ]},
  { id: 'vs', label: '⚔️ Comparison', template: (topic: string) => [
    `${topic} vs What They Teach You in School #facts`,
    `The ${topic} Most People Get WRONG #shorts`,
    `Real ${topic} vs What the Media Says #truth`,
    `Before vs After Knowing About ${topic} #mindblown`,
    `Experts vs Regular People on ${topic} #viral`,
  ]},
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
      style={{
        background: copied ? 'rgba(52,211,153,.12)' : 'rgba(255,255,255,.05)',
        border: copied ? '1px solid rgba(52,211,153,.3)' : '1px solid var(--border)',
        color: copied ? '#34d399' : 'var(--muted)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TemplatesClient() {
  const [activeTool, setActiveTool] = useState<'hooks' | 'titles' | 'coming'>('hooks')
  const [topic, setTopic] = useState('')
  const [hookStyle, setHookStyle] = useState(HOOK_STYLES[0].id)
  const [titleStyle, setTitleStyle] = useState(TITLE_STYLES[0].id)
  const [results, setResults] = useState<string[]>([])
  const [generated, setGenerated] = useState(false)

  function generate() {
    if (!topic.trim()) return
    if (activeTool === 'hooks') {
      const style = HOOK_STYLES.find((s) => s.id === hookStyle)
      setResults(style ? style.template(topic.trim()) : [])
    } else if (activeTool === 'titles') {
      const style = TITLE_STYLES.find((s) => s.id === titleStyle)
      setResults(style ? style.template(topic.trim()) : [])
    }
    setGenerated(true)
  }

  function handleToolChange(tool: 'hooks' | 'titles' | 'coming') {
    setActiveTool(tool)
    setResults([])
    setGenerated(false)
    setTopic('')
  }

  return (
    <div className="px-4 md:px-6 py-7 pb-20">
      {/* Header */}
      <div className="mb-7">
        <div className="font-black uppercase tracking-widest mb-1" style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}>
          Creator Toolkit
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-black tracking-tight mb-1" style={{ fontSize: '1.45rem', color: 'var(--text)', lineHeight: 1.1 }}>
              <span style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Viral Tools
              </span>{' '}
              & Templates
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              Free creator tools to maximize your Shorts performance.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', textDecoration: 'none' }}
          >
            ⚡ Create AI Short
          </Link>
        </div>
      </div>

      {/* Tool tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {[
          { id: 'hooks', label: '🪝 Hook Generator', live: true },
          { id: 'titles', label: '📺 Title Generator', live: true },
          { id: 'coming', label: '🚀 More Tools', live: false },
        ].map(({ id, label, live }) => (
          <button
            key={id}
            onClick={() => handleToolChange(id as 'hooks' | 'titles' | 'coming')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={{
              background: activeTool === id ? 'rgba(99,102,241,.15)' : 'var(--card)',
              border: activeTool === id ? '1px solid rgba(99,102,241,.4)' : '1px solid var(--border)',
              color: activeTool === id ? 'var(--indigo-light)' : 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            {label}
            {live && (
              <span className="px-1.5 py-0.5 rounded text-xs font-black" style={{ background: 'rgba(52,211,153,.12)', color: '#34d399', fontSize: '0.55rem' }}>
                LIVE
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Hook Generator */}
      {activeTool === 'hooks' && (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div>
            {/* Input panel */}
            <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h2 className="font-black text-sm mb-1" style={{ color: 'var(--text)' }}>🪝 Viral Hook Generator</h2>
              <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
                Generate 5 scroll-stopping opening lines for any topic.
              </p>

              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted2)' }}>Your Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && generate()}
                  placeholder="e.g. Bitcoin, Black holes, Sleep..."
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid var(--border2)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
              </div>

              <div className="mb-5">
                <label className="block text-xs font-bold mb-2" style={{ color: 'var(--muted2)' }}>Hook Style</label>
                <div className="flex flex-col gap-2">
                  {HOOK_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setHookStyle(style.id)}
                      className="text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: hookStyle === style.id ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.03)',
                        border: hookStyle === style.id ? '1px solid rgba(99,102,241,.35)' : '1px solid var(--border)',
                        color: hookStyle === style.id ? 'var(--indigo-light)' : 'var(--muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generate}
                disabled={!topic.trim()}
                className="w-full rounded-xl py-3 text-sm font-black text-white transition-all"
                style={{
                  background: topic.trim()
                    ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)'
                    : 'rgba(255,255,255,.06)',
                  border: 'none',
                  color: topic.trim() ? 'white' : 'var(--muted)',
                  cursor: topic.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: topic.trim() ? '0 4px 22px rgba(99,102,241,.35)' : 'none',
                }}
              >
                ⚡ Generate 5 Hooks
              </button>
            </div>
          </div>

          {/* Results panel */}
          <div>
            {generated && results.length > 0 ? (
              <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid rgba(99,102,241,.25)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-sm" style={{ color: 'var(--text)' }}>✅ Your 5 Viral Hooks</h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(results.join('\n'))}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', color: 'var(--indigo-light)', cursor: 'pointer' }}
                  >
                    Copy All
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {results.map((hook, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-xl px-4 py-3"
                      style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}
                    >
                      <span className="text-xs font-black mt-0.5 flex-shrink-0" style={{ color: 'var(--indigo-light)', minWidth: 16 }}>#{i + 1}</span>
                      <span className="text-xs leading-relaxed flex-1" style={{ color: 'var(--text2)' }}>{hook}</span>
                      <CopyButton text={hook} />
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-4 text-center" style={{ color: 'var(--muted)' }}>
                  Use these as your first 3 seconds. Then head to{' '}
                  <Link href="/dashboard" style={{ color: 'var(--indigo-light)', textDecoration: 'none' }}>Creator Hub</Link>
                  {' '}for full scripts.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl p-8 text-center h-full flex flex-col items-center justify-center" style={{ background: 'var(--card)', border: '1px solid var(--border)', minHeight: 260 }}>
                <div className="text-4xl mb-3">🪝</div>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>Enter a topic to get started</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>5 scroll-stopping hooks, instantly.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Title Generator */}
      {activeTool === 'titles' && (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div>
            <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h2 className="font-black text-sm mb-1" style={{ color: 'var(--text)' }}>📺 YouTube Title Generator</h2>
              <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
                Generate 5 click-worthy titles optimized for YouTube Shorts.
              </p>

              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted2)' }}>Your Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && generate()}
                  placeholder="e.g. Bitcoin, Black holes, Sleep..."
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid var(--border2)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
              </div>

              <div className="mb-5">
                <label className="block text-xs font-bold mb-2" style={{ color: 'var(--muted2)' }}>Title Style</label>
                <div className="flex flex-col gap-2">
                  {TITLE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setTitleStyle(style.id)}
                      className="text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: titleStyle === style.id ? 'rgba(99,102,241,.12)' : 'rgba(255,255,255,.03)',
                        border: titleStyle === style.id ? '1px solid rgba(99,102,241,.35)' : '1px solid var(--border)',
                        color: titleStyle === style.id ? 'var(--indigo-light)' : 'var(--muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generate}
                disabled={!topic.trim()}
                className="w-full rounded-xl py-3 text-sm font-black text-white transition-all"
                style={{
                  background: topic.trim()
                    ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)'
                    : 'rgba(255,255,255,.06)',
                  border: 'none',
                  color: topic.trim() ? 'white' : 'var(--muted)',
                  cursor: topic.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: topic.trim() ? '0 4px 22px rgba(99,102,241,.35)' : 'none',
                }}
              >
                ⚡ Generate 5 Titles
              </button>
            </div>
          </div>

          <div>
            {generated && results.length > 0 ? (
              <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid rgba(99,102,241,.25)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-sm" style={{ color: 'var(--text)' }}>✅ Your 5 Viral Titles</h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(results.join('\n'))}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', color: 'var(--indigo-light)', cursor: 'pointer' }}
                  >
                    Copy All
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {results.map((title, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-xl px-4 py-3"
                      style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}
                    >
                      <span className="text-xs font-black mt-0.5 flex-shrink-0" style={{ color: 'var(--indigo-light)', minWidth: 16 }}>#{i + 1}</span>
                      <span className="text-xs leading-relaxed flex-1" style={{ color: 'var(--text2)' }}>{title}</span>
                      <CopyButton text={title} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-8 text-center h-full flex flex-col items-center justify-center" style={{ background: 'var(--card)', border: '1px solid var(--border)', minHeight: 260 }}>
                <div className="text-4xl mb-3">📺</div>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>Enter a topic to get started</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>5 click-worthy titles, ready to paste.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coming Soon */}
      {activeTool === 'coming' && (
        <div>
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5"
            style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.18)' }}
          >
            <span className="text-lg">🚧</span>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              These tools are actively being built. Hook Generator and Title Generator are{' '}
              <strong style={{ color: '#34d399' }}>live now</strong> — try them!
            </p>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {[
              { icon: '#️⃣', title: 'Hashtag Generator', desc: 'Platform-specific hashtag sets for TikTok, Reels, and Shorts.', color: '#34d399' },
              { icon: '🎬', title: 'Video Prompt Generator', desc: 'Detailed AI image/video prompts for your script visuals.', color: '#fbbf24' },
              { icon: '📣', title: 'CTA Generator', desc: 'Drive likes, follows, and shares with proven CTAs.', color: '#a855f7' },
              { icon: '🖼️', title: 'Thumbnail Text Generator', desc: 'Generate click-bait thumbnail text overlays. (Pro)', color: '#f87171' },
              { icon: '📊', title: 'Viral Score Analyzer', desc: 'Paste your script and get a viral potential score.', color: '#818cf8' },
              { icon: '🔄', title: 'Script Rewriter', desc: 'Paste any script and get 3 viral rewrites instantly.', color: '#06b6d4' },
            ].map((tool) => (
              <div
                key={tool.title}
                className="rounded-2xl p-5 relative"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div
                  className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(245,158,11,.12)', color: '#fbbf24', fontSize: '0.6rem' }}
                >
                  Soon
                </div>
                <div className="text-2xl mb-3">{tool.icon}</div>
                <h3 className="font-black text-sm mb-1.5" style={{ color: 'var(--text)' }}>{tool.title}</h3>
                <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{tool.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
