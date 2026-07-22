'use client'

import { useState } from 'react'
import { rememberSignupCampaign, trackEvent } from '@/lib/analytics'

const TOPIC_EXAMPLES = [
  'The island too dangerous to visit',
  'Why the Door to Hell is still burning',
  'How compound interest grows $100',
] as const

type TopicGeneratorFormProps = {
  campaign?: string
  source?: string
  examples?: readonly string[]
  formId?: string
  language?: 'en' | 'pt' | 'es'
  copy?: {
    label: string
    placeholder: string
    submit: string
    examplesLabel: string
    note: string
  }
}

export default function TopicGeneratorForm({
  campaign = 'push32_topic_intent',
  source = 'push32_topic',
  examples = TOPIC_EXAMPLES,
  formId = 'try-a-topic',
  language,
  copy = {
    label: 'What should your Short be about?',
    placeholder: 'Type one topic or paste your script',
    submit: 'Turn this topic into a Short →',
    examplesLabel: 'Example topics',
    note: 'Your topic stays attached through signup. No card required for the free Fast workflow.',
  },
}: TopicGeneratorFormProps = {}) {
  const [topic, setTopic] = useState('')
  const inputId = `${formId}-input`

  return (
    <div
      id={formId}
      style={{
        marginTop: 30,
        scrollMarginTop: 24,
        border: '1px solid rgba(41,151,255,0.35)',
        borderRadius: 18,
        background: 'linear-gradient(145deg, rgba(41,151,255,0.10), rgba(255,255,255,0.025))',
        padding: 18,
      }}
    >
      <form
        action="/signup"
        method="get"
        onSubmit={() => {
          rememberSignupCampaign(campaign)
          void trackEvent('organic_topic_submitted', {
            source,
            placement: 'hero_form',
            topic_length: topic.trim().length,
            ...(language ? { language } : {}),
          })
        }}
      >
        <label htmlFor={inputId} style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#f5f5f7', marginBottom: 9 }}>
          {copy.label}
        </label>
        <textarea
          id={inputId}
          name="prompt"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          required
          minLength={3}
          maxLength={1000}
          rows={3}
          placeholder={copy.placeholder}
          style={{
            display: 'block',
            width: '100%',
            resize: 'vertical',
            minHeight: 96,
            border: '1px solid #3a3a3d',
            borderRadius: 13,
            background: '#0b0b0d',
            color: '#f5f5f7',
            padding: '14px 15px',
            font: 'inherit',
            fontSize: 16,
            lineHeight: 1.45,
            outline: 'none',
          }}
        />
        <input type="hidden" name="create_intent" value="fast" />
        <input type="hidden" name="intent_campaign" value={campaign} />
        {language && <input type="hidden" name="language" value={language} />}
        <button
          type="submit"
          style={{
            display: 'block',
            width: '100%',
            marginTop: 12,
            border: 0,
            borderRadius: 999,
            background: '#f5f5f7',
            color: '#000',
            padding: '14px 22px',
            fontSize: 15,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {copy.submit}
        </button>
      </form>

      <div aria-label={copy.examplesLabel} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 13 }}>
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setTopic(example)}
            style={{
              border: '1px solid #343438',
              borderRadius: 999,
              background: '#161618',
              color: '#a1a1a6',
              padding: '7px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {example}
          </button>
        ))}
      </div>

      <p style={{ margin: '13px 0 0', color: '#86868b', fontSize: 12, lineHeight: 1.5 }}>
        {copy.note}
      </p>
    </div>
  )
}
