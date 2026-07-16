'use client'

// PUSH #27 — activation handoff for a brand-new account.
//
// The previous full-screen catalog asked a just-converted visitor to compare
// eight topics, filters, hooks, scores and two input paths before the first
// render. Live TAAFT evidence showed an authenticated user reaching this view
// and leaving without a click. This version keeps the one-click Fast path but
// presents one concrete choice and one escape hatch. No timer, viral promise,
// view claim or fabricated urgency.

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'

const FIRST_VIDEO = {
  topic: 'The disappearance nobody solved in 70 years',
  niche: 'mystery',
  hook: 'Three people vanished without a trace. What they left behind made the case even stranger.',
}

type Props = {
  onPick: (topic: string) => void
  onClose: () => void
}

export default function NicheOnboarding({ onPick, onClose }: Props) {
  useEffect(() => {
    void trackEvent('viral_onboarding_viewed', {
      version: 'push27_single_choice',
      is_first_video: true,
    })
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      void trackEvent('viral_onboarding_skipped', {
        version: 'push27_single_choice',
        action: 'escape',
      })
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function createFirstVideo() {
    const metadata = {
      source: 'viral_onboarding',
      version: 'push27_single_choice',
      engine: 'fast',
      is_first_video: true,
      selected_category: FIRST_VIDEO.niche,
    }
    void trackEvent('viral_onboarding_primary_clicked', metadata)
    // Preserve the established event so the pre-PUSH #27 activation series
    // remains comparable in the admin funnel.
    void trackEvent('first_video_started_from_viral_onboarding', metadata)
    onPick(FIRST_VIDEO.topic)
  }

  function useOwnIdea() {
    void trackEvent('viral_onboarding_skipped', {
      version: 'push27_single_choice',
      action: 'own_idea',
    })
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-video-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '20px 16px',
        background: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          padding: 'clamp(22px, 5vw, 34px)',
          borderRadius: 24,
          border: '1px solid #2a2a2d',
          background: '#131316',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ marginBottom: 10, color: '#2997ff', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Your first Fast video
        </div>
        <h1 id="first-video-title" style={{ margin: '0 0 10px', color: '#f5f5f7', fontSize: 'clamp(1.55rem, 6vw, 2.15rem)', lineHeight: 1.1, letterSpacing: '-0.035em' }}>
          Start with one ready-to-make idea.
        </h1>
        <p style={{ margin: '0 0 20px', color: '#a1a1a6', fontSize: '0.94rem', lineHeight: 1.55 }}>
          Kineo builds the script, voiceover, footage and captions. Free access includes up to 3 watermarked Fast videos every 24 hours, with no card.
        </p>

        <div style={{ marginBottom: 18, padding: '17px 18px', borderRadius: 16, border: '1px solid rgba(41,151,255,0.35)', background: 'rgba(41,151,255,0.08)' }}>
          <div style={{ marginBottom: 7, color: '#f5f5f7', fontSize: '1.05rem', fontWeight: 850, lineHeight: 1.3 }}>
            {FIRST_VIDEO.topic}
          </div>
          <div style={{ color: '#a1a1a6', fontSize: '0.82rem', fontStyle: 'italic', lineHeight: 1.45 }}>
            “{FIRST_VIDEO.hook}”
          </div>
        </div>

        <button
          type="button"
          onClick={createFirstVideo}
          style={{
            width: '100%',
            minHeight: 52,
            padding: '14px 18px',
            border: 0,
            borderRadius: 999,
            background: '#f5f5f7',
            color: '#000',
            cursor: 'pointer',
            fontSize: '0.98rem',
            fontWeight: 900,
          }}
        >
          Create this free watermarked video →
        </button>
        <button
          type="button"
          onClick={useOwnIdea}
          style={{
            display: 'block',
            margin: '16px auto 0',
            padding: 0,
            border: 0,
            background: 'transparent',
            color: '#86868b',
            cursor: 'pointer',
            fontSize: '0.86rem',
            fontWeight: 650,
            textDecoration: 'underline',
          }}
        >
          Use my own idea instead
        </button>
      </div>
    </div>
  )
}
