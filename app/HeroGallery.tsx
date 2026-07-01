// KINEO-HERO-GALLERY-2026-06-30 — the 6 real Shorts Joseph picked as his best,
// served straight from the public Supabase renders bucket. Each card links to
// /signup so the showcase doubles as a conversion path. (No fetch needed — these
// are stable public URLs.)
import Link from 'next/link'

const BASE =
  'https://cqqukkvjjrguayiyjvhh.supabase.co/storage/v1/object/public/renders/e92d81bf-0068-46c3-8de7-1f67e2006756/'

const CARDS = [
  { file: '57ec7ddf-6ec8-4691-8b22-d302ecfd56d4.mp4', lab: 'AI · 60s', vt: 'The desert hole on fire for 54 years' },
  { file: 'd9f846cb-e43e-4647-8123-b5f914aea15d.mp4', lab: 'AI · 60s', vt: 'The island where getting close can kill you' },
  { file: '04e720d6-ceb5-46e4-8bc8-b8438f216920.mp4', lab: 'AI · 53s', vt: 'Japan built an AI that hires other AIs' },
  { file: '78ce1bb0-cd00-4df2-b39d-86d3b4ba94ea.mp4', lab: 'AI · 45s', vt: 'Three days after launch, the US shut this AI down' },
  { file: '50fe1fbf-9049-48c7-81c8-be53a81287ca.mp4', lab: 'AI · 45s', vt: 'The AI the US government pulled offline' },
  { file: 'fd06abbe-1695-43fa-a636-d02eaaa604fe.mp4', lab: 'AI · 60s', vt: 'The most elegant chaos in football history' },
]

export default function HeroGallery() {
  return (
    <div id="samples" className="hero-gallery">
      {CARDS.map((c) => (
        <Link key={c.file} href="/signup" className="vcard" aria-label={c.vt}>
          <video
            className="hvid"
            src={BASE + c.file}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
          />
          <span className="lab">{c.lab}</span>
          <div className="vt">{c.vt}</div>
        </Link>
      ))}
    </div>
  )
}
