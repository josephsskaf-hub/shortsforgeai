'use client'

import { useRef } from 'react'

interface ExampleVideoPlayerProps {
  slug: string
  title: string
  src: string
  poster: string
  placement?: string
  version?: string
}

export default function ExampleVideoPlayer({
  slug,
  title,
  src,
  poster,
  placement = 'example_watch',
  version = 'push31',
}: ExampleVideoPlayerProps) {
  const tracked = useRef(false)

  function trackPlay() {
    if (tracked.current) return
    tracked.current = true

    try {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'example_video_play',
          path: window.location.pathname,
          metadata: {
            version,
            example_slug: slug,
            placement,
          },
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // The sample remains playable if analytics is unavailable.
    }
  }

  return (
    <video
      aria-label={title}
      className="h-full w-full bg-black object-cover"
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      onPlay={trackPlay}
    />
  )
}
