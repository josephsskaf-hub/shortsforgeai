export interface PublicExample {
  slug: string
  title: string
  shortTitle: string
  description: string
  prompt: string
  outputDurationSeconds: number
  previewDurationSeconds: number
  videoPath: string
  posterPath: string
}

// Public proof assets selected for the Kineo homepage. Each MP4 is an honest
// five-second preview cut from the longer export described by
// outputDurationSeconds. These are founder-owned samples, never customer
// uploads. Keep this allow-list explicit so a private render cannot
// accidentally become indexable.
export const PUBLIC_EXAMPLES: readonly PublicExample[] = [
  {
    slug: 'turkmenistan-door-to-hell',
    title: 'Turkmenistan Door to Hell — AI Short Preview',
    shortTitle: 'Turkmenistan: Door to Hell',
    description:
      'Watch a five-second preview cut from a 60-second faceless Short created with Kineo about Turkmenistan’s Darvaza gas crater.',
    prompt:
      'Create a fast-paced faceless Short about Turkmenistan’s Darvaza gas crater, with a strong curiosity hook, cinematic footage and clear captions.',
    outputDurationSeconds: 60,
    previewDurationSeconds: 5,
    videoPath: '/videos/example-turkmenistan.mp4',
    posterPath: '/videos/example-turkmenistan.jpg',
  },
  {
    slug: 'north-sentinel-island',
    title: 'North Sentinel Island — AI Short Preview',
    shortTitle: 'North Sentinel Island',
    description:
      'Watch a five-second preview cut from a 60-second faceless Short created with Kineo about North Sentinel Island.',
    prompt:
      'Create a fast-paced faceless Short about North Sentinel Island, with a respectful mystery hook, specific footage and readable captions.',
    outputDurationSeconds: 60,
    previewDurationSeconds: 5,
    videoPath: '/videos/example-sentinel.mp4',
    posterPath: '/videos/example-sentinel.jpg',
  },
  {
    slug: 'japan-autonomous-ai',
    title: 'Japan and Autonomous AI — AI Short Preview',
    shortTitle: 'Japan and autonomous AI',
    description:
      'Watch a five-second preview cut from a 53-second faceless Short created with Kineo about autonomous AI in Japan.',
    prompt:
      'Create a fast-paced faceless Short about autonomous AI in Japan, with a surprising hook, technology B-roll and clear captions.',
    outputDurationSeconds: 53,
    previewDurationSeconds: 5,
    videoPath: '/videos/example-japan-ai.mp4',
    posterPath: '/videos/example-japan-ai.jpg',
  },
  {
    slug: 'us-ai-shutdown-story',
    title: 'U.S. AI Shutdown Story — AI Short Preview',
    shortTitle: 'A U.S. AI shutdown story',
    description:
      'Watch a five-second preview cut from a 45-second faceless Short created with Kineo about a U.S. AI shutdown story.',
    prompt:
      'Create a fast-paced faceless Short about a U.S. AI shutdown story, with a direct hook, relevant footage and readable captions.',
    outputDurationSeconds: 45,
    previewDurationSeconds: 5,
    videoPath: '/videos/example-shutdown.mp4',
    posterPath: '/videos/example-shutdown.jpg',
  },
] as const

export function getPublicExample(slug: string): PublicExample | undefined {
  return PUBLIC_EXAMPLES.find((example) => example.slug === slug)
}
