'use client'

// Background-loop video for marketing pages (hero phone mockup + Examples
// cards on app/KineoLanding.tsx). The plain `<video autoPlay loop muted
// playsInline>` HTML attribute approach silently failed to start playback
// in testing (loaded fine — readyState 4, correct dimensions — but stayed
// paused at frame 0 with zero error events). Switching to the same
// explicit IntersectionObserver + ref.play() pattern already proven in
// app/(dashboard)/my-videos/MyVideosClient.tsx, which reliably autoplays
// without any click/hover. A `poster` frame is always supplied so the
// element never reads as "blank" even before playback kicks in.
import { useEffect, useRef } from 'react'

type Props = {
  src: string
  poster?: string
  className?: string
}

export default function AutoplayVideo({ src, poster, className }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {
            /* autoplay blocked by the browser — poster frame stays visible, not an error */
          })
        } else {
          el.pause()
        }
      },
      { threshold: 0.1 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
    >
      <source src={src} type="video/mp4" />
    </video>
  )
}
