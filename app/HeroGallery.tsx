'use client'
// KINEO-HERO-GALLERY-2026-06-30 — real vertical video in the hero showcase.
// public/videos/*.mp4 never existed, so the static cards rendered black. This
// fetches /api/showcase-clips (Pexels portrait B-roll, 1h ISR cached) and plays
// real video behind each caption. Each card links to /signup so the showcase
// doubles as a conversion path. Falls back to the gradient card if a clip is
// missing (graceful — never breaks).
import { useEffect, useState } from 'react'
import Link from 'next/link'

const CARDS = [
  { id: 'travel', lab: 'AI · 58s', vt: 'The island too dangerous to visit' },
  { id: 'history', lab: 'AI · 60s', vt: 'The desert hole on fire for 54 years' },
  { id: 'hidden', lab: 'AI · 60s', vt: 'The island where getting close can kill you' },
  { id: 'facts', lab: 'AI · 53s', vt: 'Japan’s AI that hires other AIs' },
  { id: 'space', lab: 'AI · 45s', vt: 'Three days after launch, the US shut this AI down' },
]

export default function HeroGallery() {
  const [clips, setClips] = useState<Record<string, string | null>>({})

  useEffect(() => {
    let alive = true
    fetch('/api/showcase-clips')
      .then((r) => r.json())
      .then((d) => {
        if (alive) setClips((d && d.clips) || {})
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  return (
    <div id="samples" className="hero-gallery">
      {CARDS.map((c) => {
        const src = clips[c.id]
        return (
          <Link key={c.id} href="/signup" className="vcard" aria-label={c.vt}>
            {src ? (
              <video
                className="hvid"
                src={src}
                muted
                loop
                autoPlay
                playsInline
                preload="metadata"
              />
            ) : null}
            <span className="lab">{c.lab}</span>
            <div className="vt">{c.vt}</div>
          </Link>
        )
      })}
    </div>
  )
}
