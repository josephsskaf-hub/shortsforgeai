'use client'

import { useEffect, useState } from 'react'
import { rememberSignupCampaign, trackEvent } from '@/lib/analytics'

export const SAASHUB_CAMPAIGN = 'push65_saashub_directory_bridge'

const VIEW_MARKER = 'kineo_push65_saashub_directory_bridge_viewed'
const EXAMPLES = [
  'The island nobody is allowed to visit',
  'Why the Door to Hell is still burning',
  'The money habit that quietly keeps people broke',
] as const

export default function SaaSHubBridgeClient({ isSignedIn }: { isSignedIn: boolean }) {
  const [prompt, setPrompt] = useState(EXAMPLES[0])

  useEffect(() => {
    try {
      if (sessionStorage.getItem(VIEW_MARKER)) return
      sessionStorage.setItem(VIEW_MARKER, '1')
    } catch {
      // Analytics must never affect the directory landing page.
    }

    void trackEvent('directory_bridge_viewed', {
      source: SAASHUB_CAMPAIGN,
      directory: 'saashub',
      campaign: SAASHUB_CAMPAIGN,
      intent_campaign: SAASHUB_CAMPAIGN,
      placement: 'saashub_product_listing',
      signed_in: isSignedIn,
    }, '/from-saashub')
  }, [isSignedIn])

  const destination = isSignedIn ? '/generate' : '/signup'

  return (
    <div
      className="rounded-3xl border border-blue-400/30 bg-[linear-gradient(145deg,rgba(41,151,255,0.14),rgba(255,255,255,0.035))] p-5 shadow-2xl shadow-blue-950/25 sm:p-7"
    >
      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">
        Try the complete workflow
      </p>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
        Create a real Short before choosing a plan.
      </h2>
      <p className="mt-2 text-sm leading-6 text-white/60">
        Start with the proven topic below, edit it, or replace it with your own idea.
      </p>

      <form
        action={destination}
        method="get"
        className="mt-5"
        onSubmit={() => {
          if (!isSignedIn) rememberSignupCampaign(SAASHUB_CAMPAIGN)
          void trackEvent('organic_topic_submitted', {
            source: SAASHUB_CAMPAIGN,
            directory: 'saashub',
            campaign: SAASHUB_CAMPAIGN,
            intent_campaign: SAASHUB_CAMPAIGN,
            placement: 'saashub_product_listing',
            destination,
            signed_in: isSignedIn,
            topic_length: prompt.trim().length,
          }, '/from-saashub')
        }}
      >
        <label htmlFor="saashub-bridge-topic" className="sr-only">
          Topic for your faceless Short
        </label>
        <textarea
          id="saashub-bridge-topic"
          name="prompt"
          rows={4}
          required
          minLength={3}
          maxLength={1000}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Type one topic — e.g. the island nobody is allowed to visit"
          className="block min-h-32 w-full resize-y rounded-2xl border border-white/15 bg-black/70 px-4 py-4 text-base leading-6 text-white outline-none transition placeholder:text-white/35 focus:border-blue-300/70"
        />

        <input type="hidden" name="create_intent" value="fast" />
        <input type="hidden" name="intent_campaign" value={SAASHUB_CAMPAIGN} />
        <input type="hidden" name="utm_source" value="saashub" />
        <input type="hidden" name="utm_medium" value="directory" />
        <input type="hidden" name="utm_campaign" value={SAASHUB_CAMPAIGN} />
        <input type="hidden" name="utm_content" value="product_listing" />
        <input type="hidden" name="language" value="en" />

        <button
          type="submit"
          className="mt-3 block w-full rounded-full bg-white px-6 py-4 text-base font-black text-black transition hover:bg-blue-200"
        >
          Create this Short free →
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
