// Public proof used above the fold.
//
// These four previews are compressed copies of real Kineo exports that were
// explicitly selected for the public homepage (commit 3a9f46a). Keeping them
// in /public avoids loading six 29-52 MB Supabase files on first paint.
// They prove the one-topic -> finished-Short workflow. They do NOT claim to
// prove Character Lock or recurring-face consistency.
import Link from 'next/link'

const CARDS = [
  {
    src: '/videos/example-turkmenistan.mp4',
    poster: '/videos/example-turkmenistan.jpg',
    duration: '60s',
    title: 'The desert hole on fire for 54 years',
  },
  {
    src: '/videos/example-sentinel.mp4',
    poster: '/videos/example-sentinel.jpg',
    duration: '60s',
    title: 'The island where getting close can kill you',
  },
  {
    src: '/videos/example-japan-ai.mp4',
    poster: '/videos/example-japan-ai.jpg',
    duration: '53s',
    title: 'Japan built an AI that hires other AIs',
  },
  {
    src: '/videos/example-shutdown.mp4',
    poster: '/videos/example-shutdown.jpg',
    duration: '45s',
    title: 'Three days after launch, the US shut this AI down',
  },
]

export default function HeroGallery() {
  return (
    <div id="samples" className="hero-gallery" aria-label="Real Shorts made with Kineo">
      {CARDS.map((card) => (
        <Link
          key={card.src}
          href="/signup?utm_source=homepage_proof"
          className="vcard"
          aria-label={`${card.title} — real Kineo output`}
        >
          <video
            className="hvid"
            src={card.src}
            poster={card.poster}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
          />
          <span className="lab">REAL OUTPUT · {card.duration}</span>
          <div className="vt">{card.title}</div>
        </Link>
      ))}
    </div>
  )
}
