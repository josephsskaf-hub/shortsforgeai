// Aesthetic Packs (13/06) — "Fast Mode 100%".
// Root cause of Joseph's recurring complaint: the auto visual layer picked
// SEMANTICALLY related but AESTHETICALLY wrong stock ("billionaire habits" →
// coins spinning / worn dollar bills) because nothing told the model what the
// niche's audience expects to SEE. Each pack defines the approved visual
// universe + audience-tested rejects for a niche. Used two ways:
//   1. injected into the broll-engine GPT prompt (steer generation)
//   2. enforcePackOnQueries() post-filters whatever came back (hard guarantee)
import type {} from './types'

export interface AestheticPack {
  id: string
  /** Approved 2-4 word Pexels-friendly visual building blocks. */
  vocab: string[]
  /** Niche-specific banned substrings (lowercase). */
  banned: string[]
}

// Visuals no niche should ever pull for these channels' content.
export const UNIVERSAL_BANNED = [
  'dancing', 'dance', 'party club', 'nightclub', 'selfie', 'tiktok',
  'influencer posing', 'twerk',
]

const PACKS: AestheticPack[] = [
  {
    id: 'wealth',
    vocab: [
      'private jet interior', 'penthouse city view', 'luxury watch closeup',
      'supercar night city', 'yacht deck ocean', 'man suit skyline',
      'trading screens office', 'modern glass office', 'mansion estate aerial',
      'businessman walking city', 'luxury hotel lobby', 'helicopter city aerial',
      'champagne celebration luxury', 'private library reading',
    ],
    banned: [
      'coins', 'coin spinning', 'dollar bills', 'cash closeup', 'money stack',
      'piggy bank', 'wallet', 'counting money hands',
    ],
  },
  {
    id: 'psychology',
    vocab: [
      'eye closeup dramatic', 'brain neurons abstract', 'chess pieces dark',
      'silhouette person shadow', 'crowd walking slow motion',
      'man thinking dark room', 'mirror reflection face', 'hands gesture talking',
      'maze aerial view', 'puppet strings concept',
    ],
    banned: ['smiling stock photo', 'thumbs up'],
  },
  {
    id: 'stoic',
    vocab: [
      'roman statue marble', 'mountain sunrise mist', 'man looking horizon',
      'candle dark room', 'journal writing pen', 'storm clouds timelapse',
      'lone runner dawn', 'ancient ruins columns', 'ocean cliff waves',
      'cold shower water face',
    ],
    banned: ['gym mirror selfie'],
  },
  {
    id: 'dark_mystery',
    vocab: [
      'foggy forest dark', 'old documents archive', 'abandoned building interior',
      'candle flicker darkness', 'stormy coast cliff', 'vintage photographs box',
      'dark corridor flashlight', 'full moon clouds', 'old map closeup',
      'rain window night',
    ],
    banned: ['halloween costume', 'horror makeup'],
  },
  {
    id: 'facts_science',
    vocab: [
      'space stars galaxy', 'microscope laboratory', 'ocean underwater deep',
      'library books shelves', 'lightning storm slow motion', 'dna strand abstract',
      'telescope night sky', 'pyramids desert egypt', 'glacier aerial drone',
      'octopus underwater closeup',
    ],
    banned: [],
  },
]

const PACK_TRIGGERS: Array<{ pack: string; triggers: string[] }> = [
  { pack: 'wealth', triggers: ['billionaire', 'money', 'wealth', 'luxury', 'finance', 'rich', 'millionaire', 'invest', 'old money'] },
  { pack: 'psychology', triggers: ['psychology', 'psych', 'dark psychology', 'mind', 'manipulation', 'behavior'] },
  { pack: 'stoic', triggers: ['stoic', 'stoicism', 'mindset', 'discipline', 'philosophy', 'motivation'] },
  { pack: 'dark_mystery', triggers: ['mystery', 'misterio', 'dark history', 'unsolved', 'creepy', 'paranormal', 'crime', 'history'] },
  { pack: 'facts_science', triggers: ['fact', 'science', 'space', 'learning', 'curiosidade', 'educational', 'geography', 'country'] },
]

const DEFAULT_PACK: AestheticPack = {
  id: 'default',
  vocab: [
    'cinematic city aerial', 'nature landscape drone', 'people walking street',
    'ocean waves aerial', 'sunset timelapse sky', 'hands typing laptop',
  ],
  banned: [],
}

/** Pick the aesthetic pack for a niche string (substring match, EN/PT). */
export function packForNiche(niche: string): AestheticPack {
  const n = (niche ?? '').toLowerCase()
  for (const { pack, triggers } of PACK_TRIGGERS) {
    if (triggers.some((t) => n.includes(t))) {
      return PACKS.find((p) => p.id === pack) ?? DEFAULT_PACK
    }
  }
  return DEFAULT_PACK
}

function isBanned(query: string, pack: AestheticPack): boolean {
  const q = query.toLowerCase()
  return [...UNIVERSAL_BANNED, ...pack.banned].some((b) => q.includes(b))
}

/**
 * Hard guarantee: drop banned queries; if a scene ends up with none, hand it
 * a vocab term (rotated by scene index so consecutive fallbacks differ).
 */
export function enforcePackOnQueries(
  queries: string[],
  pack: AestheticPack,
  sceneIndex: number,
): string[] {
  const ok = queries.filter((q) => !isBanned(q, pack))
  if (ok.length > 0) return ok
  return [pack.vocab[sceneIndex % pack.vocab.length]]
}
