// Kineo landing — new Apple-dark redesign (replaces the old HomePageClient on the homepage).
// Self-contained, styles scoped under .klp so they don't leak into the rest of the app.
// Marker: KINEO-LANDING-V3-2026-06-30
import Link from 'next/link'
import NavCreditsBadge from '@/components/NavCreditsBadge'
import HeroGallery from './HeroGallery'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'
import LiveStatsBadge from '@/components/LiveStatsBadge'
import Footer from '@/components/Footer'

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
.klp .logo .mk{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#17171a,#161618);border:1px solid rgba(41,151,255,.45);box-shadow:0 0 14px rgba(41,151,255,.4),0 0 6px rgba(41,151,255,.25);display:grid;place-items:center;font-size:14px}
.klp .nav-links{display:flex;gap:32px;font-size:14px;color:var(--muted);font-weight:500}
.klp .nav-links a:hover{color:var(--txt)}
.klp .hero{position:relative;padding:78px 0 84px;overflow:hidden}
.klp .hero .glow{position:absolute;width:820px;height:520px;left:42%;top:-120px;transform:translateX(-50%);background:radial-gradient(ellipse at center,rgba(120,140,175,.2),transparent 70%);pointer-events:none}
.klp .hero-grid{position:relative;z-index:1;display:grid;grid-template-columns:1.35fr .65fr;gap:48px;align-items:center}
.klp .hl h1{font-size:clamp(2.4rem,5.2vw,4rem);font-weight:600;line-height:1.04;letter-spacing:-.035em;margin:16px 0 0;max-width:13ch}
.klp .hl .sub,.klp .hero-center .sub{font-size:clamp(1.05rem,2.1vw,1.28rem);color:var(--muted);max-width:480px;margin:20px 0 0;line-height:1.45}
.klp .composer{display:flex;flex-direction:column;gap:14px;margin-top:30px;background:var(--card);border:1px solid var(--line2);border-radius:22px;padding:22px;width:100%;max-width:730px;min-height:300px;box-shadow:0 20px 50px -24px rgba(0,0,0,.9)}
.klp .composer .ci{flex:1;width:100%;min-height:170px;resize:none;background:transparent;border:none;outline:none;color:var(--txt);font-size:17px;line-height:1.5;font-family:inherit;padding:6px 2px}
.klp .composer .ci::placeholder{color:var(--muted2)}
.klp .composer .cbtn{align-self:flex-end;white-space:nowrap;padding:14px 28px;font-size:15.5px;border-radius:13px}
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
.klp .vcard .vt{font-size:14px;font-weight:700;line-height:1.25;color:#fff}
.klp .cmp{background:var(--card);border:1px solid var(--line);border-radius:22px;overflow-x:auto}
.klp .cmp table{width:100%;min-width:560px;border-collapse:collapse;font-size:14.5px}
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
.klp .taaft-badge{margin:0 auto 18px;opacity:.8;line-height:0}
.klp .taaft-badge img{max-width:190px;height:auto;display:inline-block}
.klp .taaft-badge:hover{opacity:1}
.klp .tools{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.klp .tcard{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:26px 22px;transition:.2s;display:flex;flex-direction:column;gap:6px}
.klp .tcard:hover{border-color:var(--line2);transform:translateY(-3px)}
.klp .tcard .ti{font-size:26px}
.klp .tcard h3{font-size:1.05rem;font-weight:600;letter-spacing:-.01em;margin-top:6px;display:flex;align-items:center;gap:7px}
.klp .tcard p{font-size:.92rem;color:var(--muted);line-height:1.55;margin-top:2px}
.klp .tcard .tlink{margin-top:14px;color:var(--blue);font-size:.86rem;font-weight:600}
.klp .badge{display:inline-block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--blue);background:rgba(41,151,255,.12);border:1px solid rgba(41,151,255,.3);padding:2px 7px;border-radius:6px}
.klp .pricing-more{margin-top:18px;text-align:center;font-size:13.5px}
.klp .nav-cta{display:flex;align-items:center;gap:10px}
.klp .hvid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.klp .vcard .hvid{border-radius:18px}
.klp .vcard{justify-content:flex-end}
@media(max-width:820px){.klp .tools{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.klp .tools{grid-template-columns:1fr}}
@media(max-width:880px){.klp .hero-grid{grid-template-columns:1fr;gap:44px;text-align:center}.klp .hl h1{margin-left:auto;margin-right:auto}.klp .hl .sub{margin-left:auto;margin-right:auto}.klp .composer{margin-left:auto;margin-right:auto}.klp .price{grid-template-columns:1fr;max-width:400px;margin:0 auto}}
@media(max-width:820px){.klp .grid4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:780px){.klp .steps{grid-template-columns:1fr}.klp .nav-links{display:none}}
@media(max-width:520px){.klp .composer{flex-direction:column;align-items:stretch;padding:14px;gap:12px}}
.klp .hero-center{position:relative;z-index:1;text-align:center;max-width:760px;margin:0 auto}
.klp .hero-center h1{margin:0 auto;font-size:clamp(3rem,7.4vw,5.8rem);font-weight:600;line-height:1.03;letter-spacing:-.04em}
.klp .hero-center .sub{margin-left:auto;margin-right:auto}
.klp .hero-center .composer{margin:48px auto 0;max-width:640px;min-height:auto;text-align:left}
.klp .hero-center .composer .ci{min-height:104px}
.klp .hero-center .trust{text-align:center}
.klp .hero-gallery{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;max-width:820px;margin:52px auto 0}
.klp .hero-gallery .vcard{aspect-ratio:9/16;padding:13px}
.klp .hero-gallery .vcard .vt{font-size:12.5px}
.klp .gallery-cap{position:relative;z-index:1;margin-top:20px;text-align:center;font-size:13.5px;color:var(--muted2)}
@media(max-width:900px){.klp .hero-gallery{grid-template-columns:repeat(2,1fr);max-width:420px}}
@media(max-width:560px){.klp .hero-gallery{grid-template-columns:repeat(2,1fr);max-width:380px}}
.klp .platforms{position:relative;z-index:1;margin:22px auto 0;text-align:center;font-size:12px;font-weight:600;letter-spacing:.09em;color:var(--muted2);text-transform:uppercase}
.klp .platforms b{color:var(--muted);font-weight:700}
.klp .faq{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.klp .qa{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px 24px}
.klp .qa h3{font-size:1.08rem;font-weight:600;letter-spacing:-.01em}
.klp .qa p{margin-top:8px;color:var(--muted);font-size:.98rem;line-height:1.6}
@media(max-width:560px){.klp .hero-center h1{font-size:clamp(2.4rem,11vw,3.3rem)}.klp .hero-gallery{gap:10px}}
`

function pricingCheckoutHref(checkoutPath: string, isSignedIn: boolean): string {
  if (isSignedIn) return checkoutPath

  // Signed-out buyers see the auth screen before the payment API. This keeps
  // public link checkers from inflating checkout telemetry while preserving
  // the exact plan and intro offer through signup/OAuth.
  const separator = checkoutPath.includes('?') ? '&' : '?'
  const resumePath = `${checkoutPath}${separator}resumed=1`
  return `/signup?reason=checkout&redirect=${encodeURIComponent(resumePath)}`
}

export default function KineoLanding({ initialUser }: Props) {
  const isSignedIn = Boolean(initialUser)
  const starterCheckoutHref = pricingCheckoutHref('/api/stripe/checkout?tier=starter&intro=1', isSignedIn)
  const creatorCheckoutHref = pricingCheckoutHref('/api/stripe/checkout?tier=basic&intro=1', isSignedIn)
  const studioCheckoutHref = pricingCheckoutHref('/api/stripe/checkout?tier=pro', isSignedIn)

  return (
    <>
    <main className="klp">
      <style dangerouslySetInnerHTML={{ __html: KLP_CSS }} />

      <nav><div className="wrap nav-in">
        <Link href="/" className="logo">
          <div className="mk">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#2997ff" stroke="#2997ff" strokeWidth="0.5" strokeLinejoin="round" />
            </svg>
          </div>
          Kineo
        </Link>
        <div className="nav-links"><Link href="/generate">Video Generation</Link><Link href="/avatar">AI Avatar</Link><Link href="/examples">Examples</Link><a href="#pricing">Pricing</a></div>
        {initialUser
          ? <div className="nav-cta"><NavCreditsBadge /><Link className="btn btn-w" style={{ padding: '9px 20px', fontSize: '14px' }} href="/generate">Dashboard</Link></div>
          : <Link className="btn btn-w" style={{ padding: '9px 20px', fontSize: '14px' }} href="/signup">Start free</Link>}
      </div></nav>

      <header className="hero">
        <div className="glow" />
        <div className="wrap">
          <div className="hero-center">
            {/* KINEO-SPRINT-OFFER-2026-07-14 — hero now sells the recurring
                FORMAT (a show with one consistent AI host), not a one-off
                "type an idea" novelty. Same h1/.sub classes, text only —
                the .sub rule was widened to .hero-center in the CSS above.
                Line lengths kept ≤ ~15 chars so the h1 never wraps to a 3rd
                line at the clamp's 5.8rem max inside the 760px container. */}
            <h1 className="gtxt">Launch your<br />AI Shorts show.</h1>
            <p className="sub">Same face, same voice, same style — every episode. Script, voice, captions and scenes in ~60 seconds.</p>
            <form className="composer" action={initialUser ? '/generate' : '/signup'} method="get">
              <textarea className="ci" name="prompt" rows={3} required minLength={3} maxLength={1000} placeholder="Type a topic — e.g. the island too dangerous to visit" />
              <input type="hidden" name="create_intent" value="fast" />
              {!initialUser && <input type="hidden" name="utm_source" value="homepage" />}
              <button className="btn btn-w cbtn" type="submit">Generate →</button>
            </form>
            {/* PROVA-SOCIAL-REAL-2026-07-02 — real DB counts; renders nothing if numbers are low/unavailable */}
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>
              <LiveStatsBadge />
            </div>
          </div>
          <HeroGallery />
          <p className="gallery-cap">Real Kineo exports, not mockups. Each started with one topic — script, voice, footage and captions, automatically. <Link href="/youtube-shorts-from-topic">See the topic-to-Short workflow →</Link></p>
          <div className="platforms">Built for <b>YouTube Shorts</b> · <b>TikTok</b> · <b>Reels</b></div>
        </div>
      </header>

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
              <tr><td>No per-minute caps</td><td className="us">✓</td><td className="no">credits</td><td className="no">credits</td><td className="no">—</td></tr>
              <tr><td>Starting price</td><td className="us">$4.90 first month</td><td>$15/mo</td><td>$29/mo</td><td>$19/mo</td></tr>
            </tbody>
          </table></div>
        </div>
      </section>

      <section id="toolkit">
        <div className="wrap">
          {/* KINEO-SHOWCASE-2026-07-10 — toolkit expanded to 8 cards (2 rows):
              the 4 new avatar-suite features on top, evergreen tools below. */}
          <div className="sec-h"><h2>One idea — or a whole toolkit.</h2><p>Talking presenters, reusable characters, transparent clips, product ads — plus everything to find and ride a trend.</p></div>
          <div className="tools">
            <Link href="/avatar" className="tcard">
              <span className="ti">🎬</span>
              <h3>AI Presenter <span className="badge">New</span></h3>
              <p>One photo + your script — a talking video with studio-grade lip-sync, HeyGen-style.</p>
              <span className="tlink">Try AI Presenter →</span>
            </Link>
            <Link href="/avatar" className="tcard">
              <span className="ti">🎭</span>
              <h3>Character Lock <span className="badge">New</span></h3>
              <p>Save a character once — the exact same face in every video and thumbnail you make.</p>
              <span className="tlink">Lock a character →</span>
            </Link>
            <Link href="/avatar" className="tcard">
              <span className="ti">🫥</span>
              <h3>Transparent Clips <span className="badge">New</span></h3>
              <p>Presenter gestures — wave, point, present — as WebM with a real transparent background.</p>
              <span className="tlink">Make a clip →</span>
            </Link>
            <Link href="/avatar" className="tcard">
              <span className="ti">📦</span>
              <h3>UGC Product Ads <span className="badge">New</span></h3>
              <p>Paste any product — get a 15-30s creator-style ad, scripted and spoken for you.</p>
              <span className="tlink">Make an ad →</span>
            </Link>
            <Link href="/animate" className="tcard">
              <span className="ti">🌀</span>
              <h3>Animate a Photo</h3>
              <p>Bring any still photo to life as a moving, postable video.</p>
              <span className="tlink">Animate a photo →</span>
            </Link>
            <Link href="/thumbnail-generator" className="tcard">
              <span className="ti">🖼️</span>
              <h3>AI Thumbnails</h3>
              <p>Click-worthy thumbnails in the style of the biggest channels — from a prompt.</p>
              <span className="tlink">Make a thumbnail →</span>
            </Link>
            <Link href="/viral-now" className="tcard">
              <span className="ti">🔥</span>
              <h3>Viral Now</h3>
              <p>Today&apos;s trending topics, ready to turn into a Short with one click.</p>
              <span className="tlink">See what&apos;s trending →</span>
            </Link>
            <Link href="/channel" className="tcard">
              <span className="ti">📺</span>
              <h3>Channel Builder</h3>
              <p>Pick a winning niche with real RPM, growth and competition data.</p>
              <span className="tlink">Find your niche →</span>
            </Link>
          </div>
        </div>
      </section>

      <section id="pricing">
        <div className="wrap">
          <div className="sec-h"><h2>Simple pricing. Try Fast free first.</h2><p>Create, download and share up to 3 watermarked Fast videos every 24h, no card. Paid plans unlock clean MP4s.</p></div>
          <div className="price">
            {/* Signed-in buyers go straight to Stripe. Signed-out buyers go to
                signup with the complete checkout destination encoded, which
                preserves tier + intro and prevents crawlers from calling the
                payment API just by following the public pricing links. */}
            <div className="plan">
              <div className="pt">Starter</div><div className="nm">Starter</div>
              <div className="pr">$9.90<span>/mo</span></div>
              {/* KINEO-SHOWCASE-2026-07-10 — V3C: 25 credits, Fast = 1 credit. */}
              <ul><li><span className="ck">✓</span> <b>First month $4.90</b> — renews at $9.90/mo in 30 days, cancel anytime</li><li><span className="ck">✓</span> 25 credits/month (Fast = 1 cr)</li><li><span className="ck">✓</span> AI script + neural voiceover + captions</li><li><span className="ck">✓</span> Watermark-free MP4</li></ul>
              <a className="btn btn-o" href={starterCheckoutHref}>Start — $4.90 first month</a>
            </div>
            <div className="plan pop">
              <div className="pt">Most popular</div><div className="nm">Creator</div>
              <div className="pr">$24.90<span>/mo</span></div>
              {/* KINEO-PRICING-V3B-2026-07-10 — $24.90/150cr, 1 Hollywood film/mo included */}
              <ul><li><span className="ck">✓</span> <b>First month $9.90</b> — renews at $24.90/mo in 30 days, cancel anytime</li><li><span className="ck">✓</span> 1 Hollywood film/mo included · 150 credits</li><li><span className="ck">✓</span> Every scene generated by AI</li><li><span className="ck">✓</span> Script + voiceover + captions</li></ul>
              <a className="btn btn-w" href={creatorCheckoutHref}>Go Creator — $9.90 first month</a>
            </div>
            <div className="plan">
              <div className="pt">Studio</div><div className="nm">Studio</div>
              <div className="pr">$37.90<span>/mo</span></div>
              {/* KINEO-REBASE-2026-07-10 — 400 → 200 credits (2:1 rebase, USD unchanged) */}
              <ul><li><span className="ck">✓</span> <b>~4 Cinematic AI</b> videos/mo (Kling)</li><li><span className="ck">✓</span> 200 credits/mo (33% more)</li><li><span className="ck">✓</span> Highest quality + priority queue</li><li><span className="ck">✓</span> Everything in Creator</li></ul>
              <a className="btn btn-o" href={studioCheckoutHref}>Continue with Studio</a>
            </div>
          </div>
          {/* KINEO-SPRINT-OFFER-2026-07-14 — the "10 videos for $4.90 one-time"
              note is gone (single-offer cleanup; ?pack=starter stays alive for
              the watermark unlock only). The intro month is the entry path. */}
          <div className="snote">Try it first: <b>create, watch, download and share up to 3 Fast videos every 24h</b> — no card, watermark included.</div>
          <div className="pricing-more"><Link className="link" href="/pricing">Full pricing, FAQ &amp; plan comparison →</Link></div>
        </div>
      </section>

      <section id="faq">
        <div className="wrap">
          <div className="sec-h"><h2>Questions, answered.</h2></div>
          <div className="faq">
            <div className="qa"><h3>Is the video really mine to post?</h3><p>Yes. Never-paid free users can download, share and post the watermarked MP4. Paid plans unlock the clean, watermark-free MP4 for YouTube, TikTok or Reels.</p></div>
            <div className="qa"><h3>Do I need any editing skills?</h3><p>None. You type one idea and the AI writes the script, records the voice, finds the footage and adds captions. Free downloads carry a watermark; paid plans unlock the clean MP4.</p></div>
            <div className="qa"><h3>Is there a watermark?</h3><p>Free access gives new users up to 3 watermarked Fast videos every 24 hours, with no card. You can download and share them. Paid plans export clean, watermark-free MP4s.</p></div>
            <div className="qa"><h3>Can I use my own script?</h3><p>Yes — paste your script and pick &ldquo;Use my script as is&rdquo; and the AI narrates it word for word.</p></div>
            <div className="qa"><h3>What if a generation fails?</h3><p>Your credits come back automatically the moment a render fails — no support ticket, no waiting. You only pay for videos you actually get.</p></div>
            {/* KINEO-SPRINT-OFFER-2026-07-14 — "credits never expire" was the
                old one-time-pack promise; plan credits refresh monthly (no
                rollover), same as the /pricing FAQ says. Copy aligned. */}
            <div className="qa"><h3>Can I cancel anytime?</h3><p>Anytime, in one click. Plans are month to month and your credits refresh every month.</p></div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="final">
            <div className="glow" />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 className="gtxt">Type a topic. Get a finished Short.</h2>
              <p>Create, watch, download and share up to 3 watermarked Fast videos every 24h — no card.</p>
              <div className="fcta"><Link className="btn btn-w" href="/signup">Make my Fast video — free</Link></div>
            </div>
          </div>
        </div>
      </section>

      {/* Marker: KINEO-TAAFT-BADGE-2026-07-01 (verification embed — homepage only) */}
      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 28, textAlign: 'center', borderTop: '1px solid #2a2a2d' }}>
        <div className="taaft-badge">
          <a href={"https://theresanaiforthat.com/ai/kineo/?ref=featured&v=11418043"} target="_blank" rel="nofollow noreferrer">
            <img width={200} src={"https://media.theresanaiforthat.com/featured-on-taaft.png?width=600"} alt="Featured on There's An AI For That" />
          </a>
        </div>
      </div>
      <StickyFreeShortCTA />
    </main>
    <Footer showStats={false} />
    </>
  )
}
