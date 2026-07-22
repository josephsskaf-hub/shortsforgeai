'use client'

import { useEffect, useState } from 'react'
import { rememberSignupCampaign, trackEvent } from '@/lib/analytics'

export const YOUTUBE_RELATED_CAMPAIGN = 'push55_youtube_related_bridge'

const VIEW_MARKER = 'kineo_push55_youtube_related_bridge_viewed'
const EXAMPLES = [
  'The island nobody is allowed to visit',
  'Why the Door to Hell is still burning',
  'The money habit that quietly keeps people broke',
] as const

export default function YouTubeBridgeClient({
  isSignedIn,
  initialPrompt,
}: {
  isSignedIn: boolean
  initialPrompt: string
}) {
  const [prompt, setPrompt] = useState(initialPrompt)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(VIEW_MARKER)) return
      sessionStorage.setItem(VIEW_MARKER, '1')
    } catch {
      // Analytics must never affect the campaign page.
    }

    void trackEvent('youtube_related_bridge_viewed', {
      source: YOUTUBE_RELATED_CAMPAIGN,
      campaign: YOUTUBE_RELATED_CAMPAIGN,
      intent_campaign: YOUTUBE_RELATED_CAMPAIGN,
      placement: 'screen_demo_bridge',
      signed_in: isSignedIn,
    }, '/from-youtube')
  }, [isSignedIn])

  const destination = isSignedIn ? '/generate' : '/signup'

  return (
    <div
      id="try-youtube-topic"
      className="order-1 rounded-3xl border border-cyan-300/25 bg-[linear-gradient(145deg,rgba(34,211,238,0.11),rgba(255,255,255,0.035))] p-5 shadow-2xl shadow-cyan-950/20 sm:p-7 lg:order-2"
      style={{ scrollMarginTop: 24 }}
    >
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
        Try the workflow with your idea
      </p>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
        Start with the exact topic from the demo.
      </h2>
      <p className="mt-2 text-sm leading-6 text-white/55">
        It is ready below. Edit anything, replace it with your own idea, or create it as-is.
      </p>

      <form
        action={destination}
        method="get"
        className="mt-5"
        onSubmit={() => {
          if (!isSignedIn) rememberSignupCampaign(YOUTUBE_RELATED_CAMPAIGN)
          void trackEvent('organic_topic_submitted', {
            source: YOUTUBE_RELATED_CAMPAIGN,
            campaign: YOUTUBE_RELATED_CAMPAIGN,
            intent_campaign: YOUTUBE_RELATED_CAMPAIGN,
            placement: 'screen_demo_bridge',
            destination,
            signed_in: isSignedIn,
            topic_length: prompt.trim().length,
          }, '/from-youtube')
        }}
      >
        <label htmlFor="youtube-bridge-topic" className="sr-only">
          Topic for your faceless Short
        </label>
        <textarea
          id="youtube-bridge-topic"
          name="prompt"
          rows={4}
          required
          minLength={3}
          maxLength={1000}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Type one topic — e.g. the island too dangerous to visit"
          className="block min-h-32 w-full resize-y rounded-2xl border border-white/15 bg-black/70 px-4 py-4 text-base leading-6 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/70"
        />

        <input type="hidden" name="create_intent" value="fast" />
        <input type="hidden" name="intent_campaign" value={YOUTUBE_RELATED_CAMPAIGN} />
        <input type="hidden" name="utm_source" value="youtube" />
        <input type="hidden" name="utm_medium" value="related_video" />
        <input type="hidden" name="utm_campaign" value={YOUTUBE_RELATED_CAMPAIGN} />
        <input type="hidden" name="utm_content" value="screen_demo" />
        <input type="hidden" name="language" value="en" />

        <button
          type="submit"
          className="mt-3 block w-full rounded-full bg-white px-6 py-4 text-base font-black text-black transition hover:bg-cyan-200"
        >
          Create this Short →
        </button>
      </form>

      <div aria-label="Example topics" className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setPrompt(example)}
            className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-left text-xs font-bold text-white/60 transition hover:border-white/25 hover:text-white"
          >
            {example}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-white/45">
        No card. New accounts can create, watch, download and share up to three
        watermarked Fast videos every 24 hours. Paid plans unlock clean exports.
      </p>
    </div>
  )
}
