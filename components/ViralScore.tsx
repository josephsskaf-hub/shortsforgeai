'use client'

interface ViralScoreProps {
  hook: string
  title: string
  script: string
}

const POWER_WORDS = [
  'you', 'secret', 'nobody', 'shocking', 'truth', 'finally', 'never',
  'reveal', 'exposed', 'hidden', 'warning', 'dangerous', 'real', 'actually',
  'why', 'how', 'stop', 'instantly', 'proof', 'banned', 'forbidden', 'won\'t',
  'didn\'t', 'doesn\'t', 'wrong', 'mistake', 'most', 'every', 'this',
]

const TRANSITIONS = [
  'but', 'however', 'meanwhile', 'suddenly', 'wait', 'then', 'because',
  'until', 'unless', 'now', 'here\'s', 'so', 'and yet', 'plot twist',
]

const CLIFFHANGERS = ['?', '...', 'but', 'wait', 'next', 'until', 'before']

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n))
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function hasNumber(s: string): boolean {
  return /\d/.test(s)
}

function countOccurrences(text: string, words: string[]): number {
  const lower = text.toLowerCase()
  let count = 0
  for (const w of words) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const m = lower.match(re)
    if (m) count += m.length
  }
  return count
}

function hasEmoji(s: string): boolean {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s)
}

export function calcHookScore(hook: string): number {
  if (!hook) return 0
  const words = wordCount(hook)
  let score = 30

  // Ideal length 8-15 words
  if (words >= 8 && words <= 15) score += 25
  else if (words >= 6 && words <= 18) score += 15
  else if (words >= 4) score += 5

  // Question mark
  if (/\?/.test(hook)) score += 12

  // Number presence
  if (hasNumber(hook)) score += 10

  // Power words
  const powerHits = countOccurrences(hook, POWER_WORDS)
  score += Math.min(20, powerHits * 6)

  // Starts with number or "Did you know"
  if (/^\s*\d/.test(hook)) score += 8
  if (/^\s*(did you know|what if|why|how|imagine|here'?s why)/i.test(hook)) score += 10

  return Math.round(clamp(score))
}

export function calcRetentionScore(script: string): number {
  if (!script) return 0
  const words = wordCount(script)
  let score = 30

  // Ideal length 150-250 words
  if (words >= 150 && words <= 250) score += 25
  else if (words >= 110 && words <= 320) score += 15
  else if (words >= 70) score += 8

  // Sentence variety
  const sentences = script.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean)
  if (sentences.length >= 4) {
    const lengths = sentences.map(wordCount)
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance =
      lengths.reduce((acc, n) => acc + (n - avg) ** 2, 0) / lengths.length
    if (variance > 8) score += 15
    else if (variance > 3) score += 8
  }

  // Transition words
  const transHits = countOccurrences(script, TRANSITIONS)
  score += Math.min(15, transHits * 3)

  // Cliffhangers
  const cliffHits = CLIFFHANGERS.reduce(
    (acc, w) => acc + (script.toLowerCase().includes(w) ? 1 : 0),
    0
  )
  score += Math.min(15, cliffHits * 3)

  return Math.round(clamp(score))
}

export function calcCtrScore(title: string): number {
  if (!title) return 0
  const len = title.length
  let score = 30

  // Ideal length 40-70 chars
  if (len >= 40 && len <= 70) score += 25
  else if (len >= 30 && len <= 85) score += 15
  else if (len >= 20) score += 6

  // Number
  if (hasNumber(title)) score += 12

  // Brackets/parens
  if (/[\[\(]/.test(title)) score += 10

  // Power words
  const powerHits = countOccurrences(title, POWER_WORDS)
  score += Math.min(15, powerHits * 5)

  // Emoji
  if (hasEmoji(title)) score += 8

  return Math.round(clamp(score))
}

export function calcViralPotential(
  hookScore: number,
  retentionScore: number,
  ctrScore: number
): number {
  const avg = (hookScore + retentionScore + ctrScore) / 3
  const multiplier = hookScore > 70 ? 1.1 : 1
  return Math.round(clamp(avg * multiplier))
}

function colorFor(score: number): { bar: string; text: string; glow: string } {
  if (score < 50) {
    return {
      bar: 'linear-gradient(90deg, #ef4444, #f87171)',
      text: '#f87171',
      glow: 'rgba(239,68,68,.35)',
    }
  }
  if (score < 70) {
    return {
      bar: 'linear-gradient(90deg, #eab308, #facc15)',
      text: '#facc15',
      glow: 'rgba(234,179,8,.35)',
    }
  }
  return {
    bar: 'linear-gradient(90deg, #10b981, #34d399)',
    text: '#34d399',
    glow: 'rgba(16,185,129,.35)',
  }
}

function ScorePill({
  label,
  score,
  emoji,
}: {
  label: string
  score: number
  emoji: string
}) {
  const c = colorFor(score)
  return (
    <div
      className="flex-1 min-w-[110px] rounded-[10px] px-2.5 py-2"
      style={{
        background: 'rgba(0,0,0,.28)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-xs font-bold uppercase tracking-wider flex items-center gap-1"
          style={{ color: 'var(--muted2)', fontSize: '0.6rem' }}
        >
          <span>{emoji}</span>
          {label}
        </span>
        <span
          className="font-black"
          style={{ color: c.text, fontSize: '0.85rem', textShadow: `0 0 8px ${c.glow}` }}
        >
          {score}
        </span>
      </div>
      <div
        className="rounded-full overflow-hidden"
        style={{ height: 4, background: 'rgba(255,255,255,.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: c.bar }}
        />
      </div>
    </div>
  )
}

export function ViralScore({ hook, title, script }: ViralScoreProps) {
  const hookScore = calcHookScore(hook)
  const retentionScore = calcRetentionScore(script)
  const ctrScore = calcCtrScore(title)
  const viralScore = calcViralPotential(hookScore, retentionScore, ctrScore)

  return (
    <div className="flex flex-wrap gap-2">
      <ScorePill label="Hook" emoji="🪝" score={hookScore} />
      <ScorePill label="Retention" emoji="📈" score={retentionScore} />
      <ScorePill label="CTR" emoji="🎯" score={ctrScore} />
      <ScorePill label="Viral" emoji="🔥" score={viralScore} />
    </div>
  )
}

export default ViralScore
