'use client'

// Push #060 — Examples / gallery client.
// Six prompt categories. Each card shows the category name, description,
// sample prompt (in a code/quote block), duration + platform badges, and
// a "Use this style" button that drops the prompt straight into the
// /generate page via a ?prompt= query param.

import Link from 'next/link'

interface Example {
  key: string
  icon: string
  name: string
  description: string
  prompt: string
  duration: string
  platform: string
}

const EXAMPLES: Example[] = [
  {
    key: 'space',
    icon: '🚀',
    name: 'Space Mystery',
    description: "Dark, cinematic explorations of the universe's greatest unknowns",
    prompt:
      'Create a mysterious cinematic YouTube Short about a strange signal coming from deep space.',
    duration: '~35s',
    platform: 'YouTube Shorts',
  },
  {
    key: 'history',
    icon: '📜',
    name: 'History Facts',
    description: 'Mind-blowing historical facts that sound too strange to be real',
    prompt:
      'Create a cinematic YouTube Short about 5 strange history facts that sound fake but are real.',
    duration: '~35s',
    platform: 'YouTube Shorts',
  },
  {
    key: 'places',
    icon: '🌍',
    name: 'Hidden Places',
    description: 'Remote and secretive locations that seem straight out of fiction',
    prompt:
      'Create a cinematic YouTube Short about 5 hidden places on Earth that look impossible.',
    duration: '~35s',
    platform: 'YouTube Shorts',
  },
  {
    key: 'animals',
    icon: '🦑',
    name: 'Weird Animals',
    description: "Nature's strangest creatures and their unbelievable abilities",
    prompt:
      "Create a cinematic YouTube Short about 5 animals that look like they shouldn't exist.",
    duration: '~35s',
    platform: 'YouTube Shorts',
  },
  {
    key: 'cold-cases',
    icon: '🕵️',
    name: 'Cold Cases',
    description: 'Unsolved mysteries and disappearances that still haunt the world',
    prompt:
      'Create a cinematic YouTube Short about a famous unsolved mystery that was never explained.',
    duration: '~35s',
    platform: 'YouTube Shorts',
  },
  {
    key: 'money',
    icon: '💰',
    name: 'Money Facts',
    description: 'Shocking money and finance facts most people never learn in school',
    prompt:
      'Create a cinematic YouTube Short about 5 money facts that will change how you think about wealth.',
    duration: '~35s',
    platform: 'YouTube Shorts',
  },
]

export default function ExamplesClient() {
  return (
    <div className="px-4 sm:px-6 py-7 pb-20 max-w-6xl mx-auto">
      <header className="mb-7">
        <div
          className="font-black uppercase tracking-[.16em] mb-1"
          style={{ fontSize: '0.68rem', color: '#3B82F6' }}
        >
          Examples
        </div>
        <h1
          className="font-black tracking-tight mb-1"
          style={{ fontSize: '1.6rem', color: 'var(--text)' }}
        >
          Pick a viral style to remix
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Click any card to drop the sample prompt straight into Generate.
        </p>
      </header>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        {EXAMPLES.map((ex) => (
          <ExampleCard key={ex.key} example={ex} />
        ))}
      </div>
    </div>
  )
}

function ExampleCard({ example }: { example: Example }) {
  const href = `/generate?prompt=${encodeURIComponent(example.prompt)}`
  return (
    <div
      className="rounded-2xl p-5 flex flex-col"
      style={{
        background: 'rgba(15,15,30,0.85)',
        border: '1px solid var(--border)',
        transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
      }}
    >
      <div className="flex items-start gap-3 mb-2">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background:
              'linear-gradient(135deg, rgba(59, 130, 246,.18), rgba(37, 99, 235,.12))',
            border: '1px solid rgba(59, 130, 246,.28)',
            fontSize: '1.3rem',
          }}
        >
          {example.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2
            className="font-black tracking-tight"
            style={{ fontSize: '1.05rem', color: 'var(--text)', lineHeight: 1.2 }}
          >
            {example.name}
          </h2>
        </div>
      </div>

      <p className="text-sm mb-3" style={{ color: 'var(--muted2)', lineHeight: 1.55 }}>
        {example.description}
      </p>

      <pre
        className="rounded-xl px-3 py-2.5 mb-3 whitespace-pre-wrap"
        style={{
          background: 'rgba(0,0,0,.35)',
          border: '1px solid var(--border)',
          color: 'var(--text2)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.75rem',
          lineHeight: 1.55,
          margin: 0,
          wordBreak: 'break-word',
        }}
      >
        {example.prompt}
      </pre>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge>{example.duration}</Badge>
        <Badge>{example.platform}</Badge>
      </div>

      <Link
        href={href}
        className="rounded-xl py-2.5 text-sm font-black text-center mt-auto"
        style={{
          background: '#3B82F6',
          color: '#FFFFFF',
          boxShadow: '0 4px 18px rgba(59, 130, 246,.3)',
          textDecoration: 'none',
        }}
      >
        Use this style →
      </Link>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
      style={{
        background: 'rgba(59, 130, 246,.10)',
        border: '1px solid rgba(59, 130, 246,.32)',
        color: '#3B82F6',
      }}
    >
      {children}
    </span>
  )
}
