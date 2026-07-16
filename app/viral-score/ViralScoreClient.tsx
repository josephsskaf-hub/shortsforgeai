'use client'

// KINEO-PUBLIC-VIRALSCORE-2026-07-08 — free public grader UI. Calls the real
// engine at /api/public/viral-score and funnels to signup with a strong CTA.
import { useState } from 'react'
import { trackEvent } from '@/lib/analytics'

type Result = {
  overall: number
  hook: number
  retention: number
  trend: number
  share: number
  verdict: string
  subtitle: string
  tips: string[]
}

const EXAMPLES = [
  "The island where landing gets you killed — and it's illegal to even try",
  '3 money habits that quietly make you rich by 30',
  'In 1922 a family was murdered by someone already living in their house',
  'Why Norway pays you $2,000 a month just to move there',
  'The billionaire who eats the same $1 lunch every day',
]

const CHIPS = ['Snake Island', 'A billionaire money habit', 'An unsolved mystery', 'A country that pays you to move']

function verdictColor(v: number): string {
  if (v >= 85) return '#22c55e'
  if (v >= 70) return '#57b0ff'
  if (v >= 50) return '#2997ff'
  if (v >= 35) return '#f5a623'
  return '#ef4444'
}

export default function ViralScoreClient() {
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<Result | null>(null)
  const [err, setErr] = useState('')

  async function run(text: string) {
    const v = text.trim()
    if (v.length < 4) { setErr('Type a real idea first.'); return }
    setLoading(true); setErr(''); setRes(null)
    void trackEvent('viral_score_started')
    try {
      const r = await fetch('/api/public/viral-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: v }),
      })
      const data = await r.json()
      if (!r.ok) { setErr(data?.error || 'Something went wrong — try again.'); return }
      const result = data as Result
      setRes(result)
      void trackEvent('viral_score_completed', { score_band: Math.floor(result.overall / 10) * 10 })
    } catch {
      setErr('Network error — try again.')
    } finally {
      setLoading(false)
    }
  }

  const bars: [string, number][] = res
    ? [['Hook strength', res.hook], ['Trend fit', res.trend], ['Retention', res.retention], ['Shareability', res.share]]
    : []
  const color = res ? verdictColor(res.overall) : '#2997ff'
  const ctaHref = `/signup?utm_source=seo&utm_medium=organic&utm_campaign=push22_viral_score&prompt=${encodeURIComponent(idea.trim().slice(0, 120))}`

  return (
    <div className="vs-wrap">
      <style>{CSS}</style>
      <div className="vs-brand"><span className="vs-logo">◆</span><b>Kineo</b></div>
      <h1>Will your idea <span>go viral?</span></h1>
      <p className="vs-sub">Paste any YouTube Shorts / TikTok idea. Get an instant score from Kineo&apos;s viral engine — free, no signup.</p>

      <div className="vs-card">
        <label htmlFor="vs-idea">Your Short idea</label>
        <textarea
          id="vs-idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          maxLength={300}
          placeholder="e.g. The island where landing gets you killed — and it's illegal to even try"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(idea) }}
        />
        <div className="vs-row">
          <button className="vs-go" onClick={() => run(idea)} disabled={loading}>
            {loading ? 'Scoring…' : 'Score my idea →'}
          </button>
          <button className="vs-ghost" onClick={() => { const ex = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]; setIdea(ex); run(ex) }} disabled={loading}>
            Surprise me
          </button>
        </div>
        <div className="vs-chips">
          {CHIPS.map((c) => (
            <span key={c} className="vs-chip" onClick={() => { setIdea(c); run(c) }}>{c}</span>
          ))}
        </div>
        {err && <p className="vs-err">{err}</p>}
      </div>

      {res && (
        <div className="vs-result">
          <div className="vs-card">
            <div className="vs-top">
              <div className="vs-dial" style={{ background: `conic-gradient(${color} ${res.overall}%, #1e2230 0)` }}>
                <div><b>{res.overall}</b><br /><small>/100</small></div>
              </div>
              <div>
                <div className="vs-verdict" style={{ color }}>{res.verdict}</div>
                {res.subtitle && <div className="vs-vsub">{res.subtitle}</div>}
              </div>
            </div>
            <div className="vs-bars">
              {bars.map(([n, val]) => (
                <div className="vs-bar" key={n}>
                  <div className="vs-bl"><span>{n}</span><span>{val}/10</span></div>
                  <div className="vs-track"><div className="vs-fill" style={{ width: `${val * 10}%` }} /></div>
                </div>
              ))}
            </div>
            {res.tips?.length > 0 && (
              <div className="vs-tips">
                <h3>How to push it higher</h3>
                <ul>{res.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
          </div>
          <div className="vs-cta">
            <p>You&apos;ve got the idea. <b>Kineo turns it into a finished, faceless Short in ~60 seconds</b> — AI scenes, voiceover, captions and music, done for you.</p>
            <a href={ctaHref} onClick={() => { void trackEvent('organic_cta_clicked', { source: 'push22_viral_score', placement: 'result' }) }}>Make a Fast video from this idea →</a>
          </div>
        </div>
      )}

      <p className="vs-foot">Free tool by Kineo — turn any idea into a viral-ready Short. Score is a prediction, not a guarantee.</p>
    </div>
  )
}

const CSS = `
.vs-wrap{max-width:640px;margin:0 auto;padding:30px 16px;color:#eef1f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.5}
.vs-wrap h1{font-size:30px;line-height:1.15;text-align:center;letter-spacing:-.6px;margin:0 0 8px}
.vs-wrap h1 span{background:linear-gradient(120deg,#57b0ff,#a98bff);-webkit-background-clip:text;background-clip:text;color:transparent}
.vs-brand{display:flex;align-items:center;gap:9px;justify-content:center;margin-bottom:20px}
.vs-logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#2997ff,#7c5cff);display:flex;align-items:center;justify-content:center;font-weight:900}
.vs-brand b{font-size:18px}
.vs-sub{text-align:center;color:#9aa3b7;font-size:15px;margin:0 0 22px}
.vs-card{background:#12141c;border:1px solid #232838;border-radius:16px;padding:18px}
.vs-card label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9aa3b7;margin-bottom:8px}
.vs-card textarea{width:100%;min-height:104px;resize:vertical;background:#171a24;border:1px solid #232838;border-radius:11px;color:#eef1f7;padding:13px 14px;font-size:15px;font-family:inherit;outline:none}
.vs-card textarea:focus{border-color:#2997ff}
.vs-row{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
.vs-go,.vs-ghost{cursor:pointer;border:none;font-family:inherit;font-weight:800;border-radius:11px;transition:.15s}
.vs-go{flex:1;min-width:180px;background:linear-gradient(135deg,#2997ff,#4f7bff);color:#fff;padding:14px 18px;font-size:15px}
.vs-go:disabled{opacity:.6;cursor:default}
.vs-ghost{background:transparent;border:1px solid #232838;color:#9aa3b7;padding:14px 16px;font-size:14px}
.vs-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
.vs-chip{font-size:12.5px;color:#9aa3b7;background:#171a24;border:1px solid #232838;border-radius:999px;padding:6px 11px;cursor:pointer}
.vs-chip:hover{color:#eef1f7;border-color:#2997ff}
.vs-err{color:#f5a623;font-size:13.5px;margin:12px 0 0}
.vs-result{margin-top:18px}
.vs-top{display:flex;align-items:center;gap:18px}
.vs-dial{width:104px;height:104px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;position:relative}
.vs-dial::after{content:"";position:absolute;inset:9px;border-radius:50%;background:#12141c}
.vs-dial b{position:relative;font-size:30px;z-index:1}
.vs-dial small{position:relative;z-index:1;color:#9aa3b7;font-weight:600;font-size:12px}
.vs-verdict{font-size:22px;font-weight:900;letter-spacing:-.3px}
.vs-vsub{font-size:13.5px;color:#9aa3b7;margin-top:3px}
.vs-bars{margin-top:18px;display:grid;gap:11px}
.vs-bl{display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px}
.vs-bl span:last-child{color:#9aa3b7}
.vs-track{height:8px;background:#1e2230;border-radius:6px;overflow:hidden}
.vs-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#2997ff,#57b0ff)}
.vs-tips{margin-top:16px;background:#171a24;border:1px solid #232838;border-radius:12px;padding:14px}
.vs-tips h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#9aa3b7;margin:0 0 9px}
.vs-tips ul{margin:0;padding:0}
.vs-tips li{list-style:none;font-size:14px;padding:6px 0 6px 24px;position:relative;color:#d7dcea}
.vs-tips li::before{content:"→";position:absolute;left:0;color:#57b0ff;font-weight:800}
.vs-cta{margin-top:18px;background:linear-gradient(135deg,#12203a,#171a24);border:1px solid #26406b;border-radius:14px;padding:18px;text-align:center}
.vs-cta p{color:#9aa3b7;font-size:14px;margin:0 0 12px}
.vs-cta b{color:#eef1f7}
.vs-cta a{display:inline-block;background:linear-gradient(135deg,#2997ff,#4f7bff);color:#fff;text-decoration:none;font-weight:800;padding:13px 26px;border-radius:11px}
.vs-foot{text-align:center;color:#9aa3b7;font-size:12.5px;margin-top:22px}
`
