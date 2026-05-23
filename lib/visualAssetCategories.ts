// Push #212 — Verified Visual Asset Whitelist
//
// Maps visual topic categories to allowed queries, negative rejection terms,
// and fallback strategies. This system prevents wrong stock footage (toy
// rockets, cartoon pyramids, music studios) from appearing in documentary-
// style YouTube Shorts.
//
// Each category defines:
//   allowedQueries  — ordered list of Pexels queries to try (best → fallback)
//   negativeTerms   — URL slug words that disqualify a Pexels result
//   strictMode      — if true, refuse any clip that doesn't pass slug check

export interface VisualCategory {
  id: string
  label: string
  /** Ordered Pexels queries — tried in sequence until a valid clip is found */
  allowedQueries: string[]
  /** If any of these words appear in the Pexels video URL slug, the clip is rejected */
  negativeTerms: string[]
  /** True for topics where wrong footage is totally unacceptable */
  strictMode: boolean
}

export const VISUAL_CATEGORIES: Record<string, VisualCategory> = {
  rocket_launch: {
    id: 'rocket_launch',
    label: 'Rocket Launch',
    allowedQueries: [
      'Falcon 9 rocket launch fire night',
      'real rocket launch pad smoke',
      'NASA space rocket launch vertical',
      'rocket launch slow motion fire',
      'space rocket liftoff flames',
      'rocket launch pad exhaust',
    ],
    negativeTerms: [
      'toy', 'cartoon', 'animation', 'child', 'children', 'playground', 'model',
      'bottle', 'firework', 'fireworks', 'illustration', 'drawing', 'render',
      'game', 'skateboard', 'studio', 'music', 'party', 'miniature', 'paper',
      'craft', 'diy', 'kids', 'birthday', 'plastic', 'lego', 'water-rocket',
      'water-bottle', 'hobby', 'amateur',
      // Push #235 — "fire/flames/night" queries kept returning these instead of
      // an actual launch (the candle bug). They are never a rocket.
      'candle', 'candles', 'fireplace', 'campfire', 'bonfire', 'lighter',
      'match', 'matches', 'gas-stove', 'stove', 'lantern', 'torch',
    ],
    strictMode: true,
  },

  booster_landing: {
    id: 'booster_landing',
    label: 'Rocket Booster Landing',
    allowedQueries: [
      'Falcon 9 booster landing drone ship ocean',
      'rocket vertical landing pad',
      'SpaceX reusable rocket landing fire',
      'rocket booster return descent',
      'rocket landing exhaust slow motion',
    ],
    negativeTerms: [
      'toy', 'cartoon', 'model', 'animation', 'illustration', 'game', 'kids',
      'child', 'plastic', 'lego', 'paper', 'amateur',
      // Push #235 — same flame false-positives as rocket_launch.
      'candle', 'candles', 'fireplace', 'campfire', 'bonfire', 'lighter',
      'match', 'matches', 'lantern', 'torch',
    ],
    strictMode: true,
  },

  mission_control: {
    id: 'mission_control',
    label: 'Mission Control / Space Operations Center',
    allowedQueries: [
      'NASA mission control room large screens',
      'space agency operations center monitors',
      'aerospace control room engineers dark',
      'rocket launch control room screens countdown',
      'space mission control center',
    ],
    negativeTerms: [
      'music-studio', 'recording-studio', 'dj', 'concert', 'club', 'nightclub',
      'dance', 'party', 'gaming', 'esports', 'toy', 'cartoon',
    ],
    strictMode: true,
  },

  earth_orbit: {
    id: 'earth_orbit',
    label: 'Earth from Orbit / Space View',
    allowedQueries: [
      'planet Earth from space blue atmosphere',
      'Earth orbit satellite view',
      'Earth from space station window',
      'astronaut view Earth orbit',
      'Earth globe space black',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'animated', 'illustration', '3d-render', 'cgi',
      'game', 'drawing', 'plastic', 'globe-toy', 'miniature',
    ],
    strictMode: true,
  },

  spacecraft: {
    id: 'spacecraft',
    label: 'Spacecraft / Space Technology',
    allowedQueries: [
      'spacecraft solar panels orbit dark',
      'satellite orbit space station exterior',
      'space capsule orbit earth',
      'rocket engine test fire close',
      'space shuttle exterior orbit',
    ],
    negativeTerms: [
      'toy', 'cartoon', 'model-kit', 'plastic', 'kids', 'animation', 'game',
      'lego', 'drawing', 'illustration',
    ],
    strictMode: true,
  },

  pyramids: {
    id: 'pyramids',
    label: 'Egyptian Pyramids',
    allowedQueries: [
      'Great Pyramid of Giza aerial desert sunrise',
      'ancient Egyptian pyramid stones close',
      'Giza desert pyramid golden hour',
      'pyramid Egypt archaeological site',
      'Egyptian pyramid aerial drone shot',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'illustration', '3d', 'render', 'drawing', 'toy',
      'game', 'model', 'kids', 'miniature', 'food', 'cake', 'lego', 'plastic',
    ],
    strictMode: true,
  },

  ancient_egypt: {
    id: 'ancient_egypt',
    label: 'Ancient Egyptian Artifacts / Hieroglyphics',
    allowedQueries: [
      'Egyptian hieroglyphics temple wall stone',
      'ancient Egypt artifact museum close',
      'pyramid interior corridor stone dark',
      'Egyptian sarcophagus museum',
      'ancient Egypt temple column',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'drawing', 'illustration', 'game', 'toy', 'kids',
      'plastic', 'costume', 'acting', 'movie-set',
    ],
    strictMode: true,
  },

  deep_ocean: {
    id: 'deep_ocean',
    label: 'Deep Ocean / Underwater Research',
    allowedQueries: [
      'deep sea submarine lights dark ocean',
      'underwater research vessel deep ocean footage',
      'bioluminescent sea creature dark water',
      'ocean floor deep submarine',
      'deep water dark ocean footage',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'aquarium-tank', 'aquarium-glass', 'swimming-pool',
      'snorkel', 'holiday', 'vacation', 'tourist', 'kids-swimming', 'beach-party',
      'pool', 'beach',
    ],
    strictMode: true,
  },

  underwater_science: {
    id: 'underwater_science',
    label: 'Underwater Science / Marine Biology',
    allowedQueries: [
      'coral reef marine biology research diver',
      'marine scientist underwater ocean',
      'ocean research expedition documentary',
      'whale shark reef coral close',
      'underwater ocean wildlife documentary',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'aquarium-glass', 'swimming-pool', 'toy', 'kids',
      'pool', 'beach-holiday',
    ],
    strictMode: false,
  },

  underground_city: {
    id: 'underground_city',
    label: 'Underground City / Cave / Ancient Tunnel',
    allowedQueries: [
      'underground cave tunnel ancient stone carved',
      'Cappadocia underground city stone chamber',
      'ancient underground chamber archaeological',
      'cave tunnel dark ancient civilization',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'game', 'minecraft', 'kids', 'toy', 'drawing',
      'illustration',
    ],
    strictMode: false,
  },

  ancient_engineering: {
    id: 'ancient_engineering',
    label: 'Ancient Engineering / Megastructures',
    allowedQueries: [
      'Stonehenge megalith ancient stone aerial',
      'ancient stone construction precision close',
      'megalith ancient engineering archaeological',
      'ancient temple stone architecture close',
      'ancient ruins archaeological excavation',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'drawing', 'illustration', 'game', 'toy', '3d',
      'render', 'lego', 'miniature', 'kids',
    ],
    strictMode: false,
  },

  ancient_city: {
    id: 'ancient_city',
    label: 'Ancient City Ruins',
    allowedQueries: [
      'Roman Colosseum ancient ruins stone',
      'ancient city ruins archaeological site',
      'Greek temple ancient ruins marble',
      'archaeological excavation site ruins',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'game', 'toy', '3d-render', 'miniature',
      'illustration', 'drawing', 'lego',
    ],
    strictMode: false,
  },

  desert_ruins: {
    id: 'desert_ruins',
    label: 'Desert Ruins / Archaeological Sites',
    allowedQueries: [
      'desert ruins archaeological sandy ancient',
      'ancient desert structure ruins sunset',
      'Middle East archaeological ruins stone',
      'desert ancient city ruins',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'game', '3d-render', 'illustration', 'toy',
      'lego', 'miniature',
    ],
    strictMode: false,
  },

  dna_lab: {
    id: 'dna_lab',
    label: 'DNA / Genetics / Science Laboratory',
    allowedQueries: [
      'DNA double helix laboratory science',
      'scientist microscope lab research close',
      'genetics laboratory equipment',
      'molecular biology research lab',
      'science laboratory test tube close',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'illustration', 'game', 'toy', '3d-render',
      'kids', 'drawing', 'clipart',
    ],
    strictMode: false,
  },

  mystery_document: {
    id: 'mystery_document',
    label: 'Historical Documents / Manuscripts / Archives',
    allowedQueries: [
      'ancient manuscript parchment close text',
      'historical document archive library old',
      'old paper scroll manuscript reading',
      'ancient text stone inscription',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'game', 'toy', 'illustration', 'kids', 'drawing',
    ],
    strictMode: false,
  },

  library_archive: {
    id: 'library_archive',
    label: 'Library / Archive / Knowledge Repository',
    allowedQueries: [
      'ancient library dark atmospheric books',
      'historic library archive rows books old',
      'old archive reading room shelves',
      'library books dark moody atmospheric',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'game', 'toy', 'illustration', 'kids',
      'modern-office', 'drawing',
    ],
    strictMode: false,
  },

  forensic_case: {
    id: 'forensic_case',
    label: 'Forensic Investigation',
    allowedQueries: [
      'forensic investigation crime scene close',
      'forensic scientist evidence collection lab',
      'crime lab forensic evidence dark',
      'forensic analysis laboratory close',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'game', 'toy', 'kids', 'comedy', 'drawing',
      'illustration',
    ],
    strictMode: false,
  },
}

// Global negative terms that apply to ALL categories in strict mode.
// These are the classic "wrong footage" patterns that plague stock searches.
export const GLOBAL_STRICT_NEGATIVE_TERMS = [
  'toy', 'cartoon', 'animation', 'animated', 'anime', 'illustration',
  'drawing', '3d-render', 'cgi', 'vfx', 'miniature', 'model-kit',
  'lego', 'kids', 'children', 'birthday', 'party', 'playground',
  'gaming', 'esports', 'video-game',
]

/**
 * Detect the visual category for a scene based on its search query + voiceover.
 * Returns null if no specific category matches (generic handling applies).
 */
export function detectVisualCategory(
  stockSearchQuery: string,
  voiceover: string,
): string | null {
  const combined = `${stockSearchQuery} ${voiceover}`.toLowerCase()

  // Space / rocket topics — order matters: most-specific first
  if (/booster.landing|rocket.landing|vertical.landing|reusable.land/.test(combined)) return 'booster_landing'
  if (/rocket.launch|falcon.9.launch|spacex.launch|liftoff|launch.pad|blastoff/.test(combined)) return 'rocket_launch'
  if (/mission.control|control.room|ground.control|houston/.test(combined)) return 'mission_control'
  if (/earth.from.orbit|orbit.*earth|planet.earth.*space|space.station.*view|satellite.view/.test(combined)) return 'earth_orbit'
  if (/spacecraft|space.station|solar.panel.*space|satellite.orbit|raptor.engine|falcon.*capsule/.test(combined)) return 'spacecraft'
  if (/spacex|falcon.9|starship|elon.musk.*rocket|reusable.rocket/.test(combined)) return 'rocket_launch'

  // Ancient Egypt / Pyramids
  if (/hieroglyphic|sarcophagus|pyramid.*interior|corridor.*pyramid|mummy/.test(combined)) return 'ancient_egypt'
  if (/pyramid|giza|egypt|pharaoh|sphinx/.test(combined)) return 'pyramids'

  // Ocean
  if (/deep.sea|deep.ocean|submarine.light|bioluminescent|abyssal/.test(combined)) return 'deep_ocean'
  if (/underwater|marine.bio|coral.reef|ocean.floor|sea.creature/.test(combined)) return 'underwater_science'

  // Ancient / Underground
  if (/underground.city|cappadocia|underground.chamber|underground.tunnel/.test(combined)) return 'underground_city'
  if (/megalith|stonehenge|ancient.engineer|ancient.construct|ancient.machine/.test(combined)) return 'ancient_engineering'
  if (/ancient.city|ancient.ruin|roman.colosseum|greek.temple|archaeological.site/.test(combined)) return 'ancient_city'
  if (/desert.ruin|desert.ancient|arabian.desert.*structure/.test(combined)) return 'desert_ruins'

  // Science
  if (/dna|genetic|genome|molecule|helix|chromosom/.test(combined)) return 'dna_lab'
  if (/manuscript|parchment|ancient.document|scroll|ancient.text/.test(combined)) return 'mystery_document'
  if (/library|archive.*book|book.*archive/.test(combined)) return 'library_archive'
  if (/forensic|crime.scene|evidence.collect|investigat/.test(combined)) return 'forensic_case'

  return null
}

/**
 * Extract the descriptive slug from a Pexels video page URL.
 * Example: "https://www.pexels.com/video/toy-rocket-in-garden-12345/" → "toy-rocket-in-garden"
 */
export function extractPexelsSlug(url: string): string {
  try {
    const m = url.match(/\/video\/([^/]+?)(?:-\d+)?\/?$/)
    return m ? m[1].toLowerCase() : ''
  } catch {
    return ''
  }
}

/**
 * Returns true if the Pexels video URL slug contains any negative terms
 * for this category, meaning the clip should be rejected.
 */
export function isSlugRejected(
  videoUrl: string,
  negativeTerms: string[],
  categoryId?: string,
): boolean {
  const slug = extractPexelsSlug(videoUrl)
  if (!slug) return false // no slug to check → don't reject

  for (const term of negativeTerms) {
    // Match with word boundary: "toy" should not match "destroy"
    const safe = term.replace(/-/g, '[- ]')
    if (new RegExp(`\\b${safe}\\b`).test(slug)) return true
  }

  // Also apply global strict terms for space topics (the worst offenders)
  if (categoryId && ['rocket_launch', 'booster_landing', 'earth_orbit', 'spacecraft'].includes(categoryId)) {
    for (const term of GLOBAL_STRICT_NEGATIVE_TERMS) {
      const safe = term.replace(/-/g, '[- ]')
      if (new RegExp(`\\b${safe}\\b`).test(slug)) return true
    }
  }

  return false
}
