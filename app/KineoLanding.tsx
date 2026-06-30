// Kineo landing — new Apple-dark redesign (replaces the old HomePageClient on the homepage).
// Self-contained, styles scoped under .klp so they don't leak into the rest of the app.
// Marker: KINEO-LANDING-2026-06-30
import Link from 'next/link'

type Props = {
  initialUser?: { id: string } | null
  initialEmail?: string
  initialIsPro?: boolean
}

const KLP_CSS = `
.klp{--bg:#000;--card:#161618;--card2:#1d1d1f;--line:#2a2a2d;--line2:#3a3a3d;--txt:#f5f5f7;--muted:#86868b;--muted2:#6e6e73;--blue:#2997ff;background:#000;color:#f5f5f7;font-family:'Inter',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5;min-height:100vh}
.klp *{box-sizing:border-box;margin:0;padding:0}
.klp a{text-decoration:none;color:inherit}
.klp .wrap{max-width:1080px;margin:0 auto;padding:0 28px}
.klp .btn{display:inline-flex;align-items:center;gap:7px;font-weight:600;font-size:16px;padding:13px 28px;border-radius:980px;cursor:pointer;transition:.18s;border:1px solid transparent}
.klp .btn-w{background:var(--txt);color:#000}
.klp .btn-w:hover{background:#fff;transform:scale(1.02)}
.klp .btn-o{border-color:#48484a;color:var(--txt)}
.klp .btn-o:hover{background:#1c1c1e;border-color:#5a5a5d}
.klp .link{color:var(--blue);font-weight:600;font-size:16px;display:inline-flex;align-items:center;gap:4px}
.klp .link:hover{text-decoration:underline}
.klp .gtxt{background:linear-gradient(180deg,#fff 35%,#a1a1a6);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.klp .eyebrow{font-size:13px;font-weight:600;letter-spacing:.01em;color:var(--muted)}
.klp nav{position:sticky;top:0;z-index:50;background:rgba(0,0,0,.7);backdrop-filter:blur(20px);border-bottom:1px solid var(--line)}
.klp .nav-in{display:flex;align-items:center;justify-content:space-between;height:62px}
.klp .logo{display:flex;align-items:center;gap:9px;font-weight:700;font-size:18px;letter-spacing:-.01em}
.klp .logo .mk{width:28px;height:28px;border-radius:8px;background:linear-gradient(160deg,#3a3a3d,#1c1c1e);border:1px solid #3a3a3d;display:grid;place-items:center;font-size:14px}
.klp .nav-links{display:flex;gap:32px;font-size:14px;color:var(--muted);font-weight:500}
.klp .nav-links a:hover{color:var(--txt)}
.klp .hero{position:relative;padding:78px 0 84px;overflow:hidden}
.klp .hero .glow{position:absolute;width:820px;height:520px;left:42%;top:-120px;transform:translateX(-50%);background:radial-gradient(ellipse at center,rgba(120,140,175,.2),transparent 70%);pointer-events:none}
.klp .hero-grid{position:relative;z-index:1;display:grid;grid-template-columns:1.06fr .94fr;gap:48px;align-items:center}
.klp .hl h1{font-size:clamp(2.4rem,5.2vw,4rem);font-weight:600;line-height:1.04;letter-spacing:-.035em;margin:16px 0 0;max-width:13ch}
.klp .hl .sub{font-size:clamp(1.05rem,2.1vw,1.28rem);color:var(--muted);max-width:480px;margin:20px 0 0;line-height:1.45}
.klp .composer{display:flex;gap:9px;align-items:center;margin-top:30px;background:var(--card);border:1px solid var(--line2);border-radius:18px;padding:9px 9px 9px 18px;max-width:520px;box-shadow:0 20px 50px -24px rgba(0,0,0,.9)}
.klp .composer .ci{flex:1;min-width:0;background:transparent;border:none;outline:none;color:var(--txt);font-size:15.5px;font-family:inherit;padding:8px 0}
.klp .composer .ci::placeholder{color:var(--muted2)}
.klp .composer .cbtn{white-space:nowrap;padding:13px 24px;font-size:15px;border-radius:13px}
.klp .hl .trust{margin-top:15px;font-size:13.5px;color:var(--muted2)}
.klp .hl .trust b{color:var(--txt);font-weight:600}
.klp .hr{display:flex;justify-content:center}
.klp .phone{width:250px;aspect-ratio:9/16;border-radius:38px;padding:11px;background:#1c1c1e;border:1px solid #2a2a2d;box-shadow:0 60px 120px -30px rgba(0,0,0,.95),0 0 0 1px rgba(255,255,255,.03);position:relative}
.klp .screen{height:100%;border-radius:28px;background:radial-gradient(120% 80% at 50% 0%,#2c2c30,#0a0a0c 70%);position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:17px}
.klp .b9{position:absolute;top:14px;left:14px;font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:8px;background:rgba(255,255,255,.12);color:#d2d2d7}
.klp .pl{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.95);color:#000;display:grid;place-items:center;font-size:20px;padding-left:3px}
.klp .cap{font-size:15px;font-weight:800;line-height:1.25;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.7)}
.klp .cmeta{margin-top:8px;font-size:11px;color:var(--muted)}
.klp section{padding:104px 0}
.klp .sec-h{text-align:center;max-width:640px;margin:0 auto 56px}
.klp .sec-h h2{font-size:clamp(2rem,4.4vw,3rem);font-weight:600;letter-spacing:-.025em;line-height:1.08}
.klp .sec-h p{margin-top:16px;color:var(--muted);font-size:1.12rem}
.klp .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.klp .step{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:32px;transition:.2s}
.klp .step:hover{border-color:var(--line2);transform:translateY(-3px)}
.klp .step .n{font-size:14px;font-weight:700;color:var(--muted2)}
.klp .step h3{margin-top:14px;font-size:1.25rem;font-weight:600;letter-spacing:-.01em}
.klp .step p{margin-top:10px;color:var(--muted);font-size:.98rem;line-height:1.6}
.klp .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.klp .vcard{aspect-ratio:9/16;border-radius:18px;background:radial-gradient(120% 80% at 50% 0%,#26262a,#0c0c0e 72%);border:1px solid var(--line);position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:15px;transition:.2s}
.klp .vcard:hover{border-color:var(--line2);transform:translateY(-4px)}
.klp .vcard .lab{position:absolute;top:12px;left:12px;font-size:10px;font-weight:700;color:var(--muted);background:rgba(255,255,255,.08);padding:3px 8px;border-radius:7px}
.klp .vcard .vt{font-size:14px;font-weight:700;line-height:1.25;color:#fff}
.klp .cmp{background:var(--card);border:1px solid var(--line);border-radius:22px;overflow:hidden}
.klp .cmp table{width:100%;border-collapse:collapse;font-size:14.5px}
.klp .cmp th,.klp .cmp td{padding:16px 18px;text-align:center;border-bottom:1px solid var(--line)}
.klp .cmp th:first-child,.klp .cmp td:first-child{text-align:left;color:var(--muted);font-weight:400}
.klp .cmp thead th{font-weight:600;color:var(--muted)}
.klp .cmp thead th.us,.klp .cmp td.us{background:rgba(255,255,255,.04)}
.klp .cmp thead th.us{color:var(--txt)}
.klp .cmp td.us{color:var(--txt);font-weight:700}
.klp .cmp .no{color:var(--muted2)}
.klp .cmp tr:last-child td{border-bottom:none}
.klp .price{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;align-items:stretch}
.klp .plan{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:32px 28px;display:flex;flex-direction:column;transition:.2s}
.klp .plan:hover{transform:translateY(-3px);border-color:var(--line2)}
.klp .plan.pop{background:var(--card2);border-color:#48484a}
.klp .plan .pt{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted2)}
.klp .plan.pop .pt{color:var(--blue)}
.klp .plan .nm{margin-top:10px;font-size:1.3rem;font-weight:600}
.klp .plan .pr{margin-top:6px;font-size:2.6rem;font-weight:700;letter-spacing:-.02em}
.klp .plan .pr span{font-size:1rem;font-weight:500;color:var(--muted)}
.klp .plan ul{list-style:none;margin:22px 0 26px;display:flex;flex-direction:column;gap:12px}
.klp .plan li{display:flex;gap:10px;font-size:14.5px;color:var(--muted)}
.klp .plan li b{color:var(--txt);font-weight:600}
.klp .plan li .ck{color:var(--blue)}
.klp .plan .btn{justify-content:center;margin-top:auto}
.klp .snote{margin:24px auto 0;max-width:540px;text-align:center;border:1px solid var(--line);border-radius:16px;padding:18px 22px;font-size:14.5px;color:var(--muted)}
.klp .snote b{color:var(--txt)}
.klp .final{position:relative;text-align:center;overflow:hidden;border-radius:30px;padding:80px 24px;background:var(--card);border:1px solid var(--line)}
.klp .final .glow{position:absolute;width:600px;height:340px;left:50%;top:-100px;transform:translateX(-50%);background:radial-gradient(ellipse at center,rgba(120,140,175,.22),transparent 70%)}
.klp .final h2{font-size:clamp(2rem,4.4vw,3rem);font-weight:600;letter-spacing:-.025em}
.klp .final p{margin-top:14px;color:var(--muted);font-size:1.15rem}
.klp .final .fcta{display:flex;justify-content:center;margin-top:30px}
.klp footer{border-top:1px solid var(--line);padding:40px 0;color:var(--muted2);font-size:13.5px;text-align:center}
.klp footer a:hover{color:var(--muted)}
@media(max-width:880px){.klp .hero-grid{grid-template-columns:1fr;gap:44px;text-align:center}.klp .hl h1{margin-left:auto;margin-right:auto}.klp .hl .sub{margin-left:auto;margin-right:auto}.klp .composer{margin-left:auto;margin-right:auto}.klp .price{grid-template-columns:1fr;max-width:400px;margin:0 auto}}
@media(max-width:820px){.klp .grid4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:780px){.klp .steps{grid-template-columns:1fr}.klp .nav-links{display:none}}
@media(max-width:520px){.klp .composer{flex-direction:column;align-items:stretch;padding:14px;gap:12px}}
`

export default function KineoLanding({ initialUser }: Props) {
  return (
    <main className="klp">
      <style dangerouslySetInnerHTML={{ __html: KLP_CSS }} />

      <nav><div className="wrap nav-in">
        <div className="logo"><div className="mk">⚡</div> Kineo</div>
        <div className="nav-links"><a href="#how">How it works</a><a href="#samples">Examples</a><a href="#compare">Compare</a><a href="#pricing">Pricing</a></div>
        {initialUser
          ? <Link className="btn btn-w" style={{ padding: '9px 20px', fontSize: '14px' }} href="/generate">Open app</Link>
          : <Link className="btn btn-w" style={{ padding: '9px 20px', fontSize: '14px' }} href="/signup">Start free</Link>}
      </div></nav>

      <header className="hero">
        <div className="glow" />
        <div className="wrap hero-grid">
          <div className="hl">
            <p className="eyebrow">AI YouTube Shorts generator</p>
            <h1 className="gtxt">One idea in. A finished Short out.</h1>
            <p className="sub">No camera, no editing. The AI writes the script, records the voice, finds the footage and adds captions — a ready-to-post 9:16 Short in ~60 seconds.</p>
            <form className="composer" action="/generate" method="get">
              <input className="ci" name="topic" placeholder="Type a topic — e.g. the island too dangerous to visit" />
              <button className="btn btn-w cbtn" type="submit">Generate — free →</button>
            </form>
            <p className="trust">First Short <b>free</b> · no credit card · from <b>$11.90/mo</b></p>
          </div>
          <div className="hr">
            <div className="phone"><div className="screen">
              <span className="b9">9:16 · 58s</span><div className="pl">▶</div>
              <div className="cap">The island too dangerous to visit</div>
              <div className="cmeta">AI voice · B-roll · captions · ready to post</div>
            </div></div>
          </div>
        </div>
      </header>

      <section id="how">
        <div className="wrap">
          <div className="sec-h"><h2>From an idea to a Short in three steps.</h2><p>It generates the whole video — it doesn&apos;t re-clip one you already filmed.</p></div>
          <div className="steps">
            <div className="step"><div className="n">Step 1</div><h3>Type one idea</h3><p>A topic, a fact, a hook — one sentence is enough. No script, no source footage needed.</p></div>
            <div className="step"><div className="n">Step 2</div><h3>AI builds the Short</h3><p>Hook-first script, AI voiceover, footage matched to every line, and captions — assembled automatically.</p></div>
            <div className="step"><div className="n">Step 3</div><h3>Download and post</h3><p>A finished vertical 9:16 video in ~60 seconds, ready for YouTube Shorts, TikTok and Reels.</p></div>
          </div>
        </div>
      </section>

      <section id="samples">
        <div className="wrap">
          <div className="sec-h"><h2>This is what the AI makes in 60 seconds.</h2><p>Each one was created from a single topic — script, voice, footage and captions, automatically.</p></div>
          <div className="grid4">
            <div className="vcard"><span className="lab">AI · 54s</span><div className="vt">What NASA hides about the Moon</div></div>
            <div className="vcard"><span className="lab">AI · 61s</span><div className="vt">The Roman invention we still use</div></div>
            <div className="vcard"><span className="lab">AI · 48s</span><div className="vt">Cities erased from every map</div></div>
            <div className="vcard"><span className="lab">AI · 57s</span><div className="vt">The case that broke the FBI</div></div>
          </div>
        </div>
      </section>

      <section id="compare">
        <div className="wrap">
          <div className="sec-h"><h2>One idea in. A finished Short out.</h2><p>Most tools re-clip a long video you already filmed. Kineo builds it from scratch.</p></div>
          <div className="cmp"><table>
            <thead><tr><th></th><th className="us">Kineo</th><th>OpusClip</th><th>HeyGen</th><th>Submagic</th></tr></thead>
            <tbody>
              <tr><td>Generates the Short from just an idea</td><td className="us">✓</td><td className="no">—</td><td className="no">~</td><td className="no">—</td></tr>
              <tr><td>Writes the script for you</td><td className="us">✓</td><td className="no">—</td><td className="no">—</td><td className="no">—</td></tr>
              <tr><td>AI voiceover included</td><td className="us">✓</td><td className="no">—</td><td>✓</td><td className="no">—</td></tr>
              <tr><td>Finds and matches footage</td><td className="us">✓</td><td className="no">your upload</td><td className="no">avatar only</td><td className="no">your upload</td></tr>
              <tr><td>No per-minute caps</td><td className="us">✓</td><td className="no">—</td><td className="no">credits</td><td className="no">—</td></tr>
              <tr><td>Starting price</td><td className="us">$11.90/mo</td><td>$15/mo</td><td>$29/mo</td><td>$14/mo</td></tr>
            </tbody>
          </table></div>
        </div>
      </section>

      <section id="pricing">
        <div className="wrap">
          <div className="sec-h"><h2>Simple pricing. First Short free.</h2><p>Three plans, flat monthly price — done-for-you Shorts at every level.</p></div>
          <div className="price">
            <div className="plan">
              <div className="pt">Starter</div><div className="nm">Starter</div>
              <div className="pr">$11.90<span>/mo</span></div>
              <ul><li><span className="ck">✓</span> <b>50 Fast videos</b>/month</li><li><span className="ck">✓</span> AI script + neural voiceover</li><li><span className="ck">✓</span> Auto-captions</li><li><span className="ck">✓</span> Watermark-free MP4</li></ul>
              <Link className="btn btn-o" href="/signup">Get started</Link>
            </div>
            <div className="plan pop">
              <div className="pt">Most popular</div><div className="nm">Creator</div>
              <div className="pr">$24.90<span>/mo</span></div>
              <ul><li><span className="ck">✓</span> <b>8 AI-generated</b> videos/mo (Seedance)</li><li><span className="ck">✓</span> 240 credits/month</li><li><span className="ck">✓</span> Every scene generated by AI</li><li><span className="ck">✓</span> Script + voiceover + captions</li></ul>
              <Link className="btn btn-w" href="/signup">Go Creator</Link>
            </div>
            <div className="plan">
              <div className="pt">Studio</div><div className="nm">Studio</div>
              <div className="pr">$37.90<span>/mo</span></div>
              <ul><li><span className="ck">✓</span> <b>8 Cinematic AI</b> videos/mo (Kling)</li><li><span className="ck">✓</span> 360 credits/mo (50% more)</li><li><span className="ck">✓</span> Highest visual quality</li><li><span className="ck">✓</span> Everything in Creator</li></ul>
              <Link className="btn btn-o" href="/signup">Continue with Studio</Link>
            </div>
          </div>
          <div className="snote">Not ready for a plan? <b>Start with 10 Shorts for $4.90</b> — one-time, no subscription, credits never expire.</div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="final">
            <div className="glow" />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 className="gtxt">Type a topic. Get a finished Short.</h2>
              <p>Your first one is free — no credit card.</p>
              <div className="fcta"><Link className="btn btn-w" href="/signup">Make my first Short — free</Link></div>
            </div>
          </div>
        </div>
      </section>

      <footer><div className="wrap">© 2026 Kineo · <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <a href="mailto:hello@usekineo.com">Contact</a></div></footer>
    </main>
  )
}
