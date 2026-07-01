'use client'

// Post-demo proof (14/06) — closes the documented conversion gap: the home
// demo proves the AI writes a SCRIPT (which feels like "ChatGPT can do that"),
// but never shows the actual differentiator — a FINISHED, ready-to-post video.
// We surface it at PEAK INTENT: right after the visitor sees their own script
// + a good Virality Score, before the signup CTA. One real, frame-validated
// Short the Fast engine produced (same MP4 that powers /founding). Click-to-play
// (not autoplay) so a heavy MP4 never renders as a black box on slow networks —
// the lesson learned on /founding.

import { useState } from 'react'

// Real Short produced by the engine — billionaire-habits niche, on-brand for the
// wealth vertical. This IS the product output, the strongest possible proof.
const PROOF_SRC =
  'https://cqqukkvjjrguayiyjvhh.supabase.co/storage/v1/object/public/renders/e92d81bf-0068-46c3-8de7-1f67e2006756/2b312738-90c7-4572-b091-c74c9dfeb90a.mp4'

export default function DemoProofShort() {
  const [playing, setPlaying] = useState(false)

  return (
    <div
      className="mt-4 flex items-center gap-4 rounded-[12px] p-3"
      style={{ background: '#161618', border: '1px solid #2a2a2d' }}
    >
      {/* 9:16 mini player */}
      <div
        style={{
          position: 'relative',
          width: 78,
          flexShrink: 0,
          aspectRatio: '9 / 16',
          borderRadius: 10,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        {playing ? (
          <video
            src={PROOF_SRC}
            autoPlay
            controls
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label="Play a real Short made by the engine"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(155deg,#161618 0%,#1d1d1f 55%,#161618 100%)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#2997ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 22px rgba(41,151,255,.4)',
              }}
            >
              <span
                style={{
                  borderLeft: '11px solid #fff',
                  borderTop: '7px solid transparent',
                  borderBottom: '7px solid transparent',
                  marginLeft: 3,
                }}
              />
            </span>
          </button>
        )}
      </div>

      {/* Copy */}
      <div className="text-left">
        <div
          className="text-[11px] font-black uppercase tracking-widest"
          style={{ color: '#2997ff' }}
        >
          🎥 And this is the finished video
        </div>
        <p className="mt-1 text-[13px] leading-snug" style={{ color: '#86868b' }}>
          A <strong>real 45s Short</strong> the engine rendered from a script like yours —
          AI voiceover, captions and footage, ready to post. No camera, no editing.
        </p>
        {!playing && (
          <span className="mt-1 inline-block text-[12px] font-bold" style={{ color: '#2997ff' }}>
            ▶ Tap to watch
          </span>
        )}
      </div>
    </div>
  )
}
