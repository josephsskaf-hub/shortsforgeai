'use client'

import { useEffect, useState } from 'react'
import { rememberSignupCampaign, trackEvent } from '@/lib/analytics'

const HOME_PROMPT_CAMPAIGN = 'push53_home_prompt_first'
const HOME_PROMPT_VIEW_MARKER = 'kineo_push53_home_prompt_first_viewed'

export default function HomeTopicForm({ isSignedIn }: { isSignedIn: boolean }) {
  const [prompt, setPrompt] = useState('')

  useEffect(() => {
    try {
      if (sessionStorage.getItem(HOME_PROMPT_VIEW_MARKER)) return
      sessionStorage.setItem(HOME_PROMPT_VIEW_MARKER, '1')
    } catch {
      // Analytics must never affect the form.
    }

    void trackEvent('home_prompt_first_viewed', {
      source: HOME_PROMPT_CAMPAIGN,
      placement: 'home_hero',
      signed_in: isSignedIn,
    }, '/')
  }, [isSignedIn])

  return (
    <form
      id="try-kineo"
      className="composer"
      action={isSignedIn ? '/generate' : '/signup'}
      method="get"
      onSubmit={() => {
        if (!isSignedIn) rememberSignupCampaign(HOME_PROMPT_CAMPAIGN)
        void trackEvent('organic_topic_submitted', {
          source: HOME_PROMPT_CAMPAIGN,
          placement: 'home_hero',
          destination: isSignedIn ? '/generate' : '/signup',
          signed_in: isSignedIn,
          topic_length: prompt.trim().length,
        }, '/')
      }}
    >
      <textarea
        className="ci"
        name="prompt"
        rows={3}
        required
        minLength={3}
        maxLength={1000}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Type a topic — e.g. the island too dangerous to visit"
      />
      <input type="hidden" name="create_intent" value="fast" />
      <input type="hidden" name="intent_campaign" value={HOME_PROMPT_CAMPAIGN} />
      <button className="btn btn-w cbtn" type="submit">Generate →</button>
    </form>
  )
}
