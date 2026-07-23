'use client'

import { useEffect, useState } from 'react'
import { rememberSignupCampaign, trackEvent } from '@/lib/analytics'

const HOME_PROMPT_CAMPAIGN = 'push69_home_one_click_starters'
const HOME_PROMPT_VIEW_MARKER = 'kineo_push69_home_one_click_starters_viewed'

const STARTER_TOPICS = [
  {
    id: 'mystery_island',
    label: 'Mystery island',
    topic: 'The island so dangerous that nobody is allowed to visit',
  },
  {
    id: 'money_habits',
    label: 'Money habits',
    topic: 'Three billionaire habits that quietly compound wealth',
  },
  {
    id: 'lost_city',
    label: 'Lost city',
    topic: 'The abandoned city that was frozen in time',
  },
] as const

export default function HomeTopicForm({ isSignedIn }: { isSignedIn: boolean }) {
  const [prompt, setPrompt] = useState('')

  function openTopic(topic: string, starterId: string) {
    if (!isSignedIn) rememberSignupCampaign(HOME_PROMPT_CAMPAIGN)
    const metadata = {
      source: HOME_PROMPT_CAMPAIGN,
      placement: 'home_hero_starter',
      destination: isSignedIn ? '/generate' : '/signup',
      signed_in: isSignedIn,
      starter_id: starterId,
      topic_length: topic.length,
    }
    void trackEvent('home_topic_starter_clicked', metadata, '/')
    void trackEvent('organic_topic_submitted', metadata, '/')
    const params = new URLSearchParams({
      prompt: topic,
      create_intent: 'fast',
      intent_campaign: HOME_PROMPT_CAMPAIGN,
    })
    window.location.assign(`${isSignedIn ? '/generate' : '/signup'}?${params.toString()}`)
  }

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
      <div className="composer-head">
        <label htmlFor="home-short-topic">What should your Short be about?</label>
        <span>Free · no card</span>
      </div>
      <textarea
        id="home-short-topic"
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
      <div className="topic-starters" aria-label="One-click topic starters">
        <span>Not sure? Start with:</span>
        <div>
          {STARTER_TOPICS.map((starter) => (
            <button
              key={starter.id}
              type="button"
              title={starter.topic}
              onClick={() => openTopic(starter.topic, starter.id)}
            >
              {starter.label} →
            </button>
          ))}
        </div>
      </div>
      <input type="hidden" name="create_intent" value="fast" />
      <input type="hidden" name="intent_campaign" value={HOME_PROMPT_CAMPAIGN} />
      <button className="btn btn-w cbtn" type="submit">Create my free Short →</button>
      <p className="composer-proof">Full watermarked video: script, voice, footage and captions. It starts automatically after signup.</p>
    </form>
  )
}
