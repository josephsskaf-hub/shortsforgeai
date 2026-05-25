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

// Push #239 — Fireworks/celebration footage looks like a rocket launch
// (bright sparks against a dark sky), so Pexels kept returning it for
// "SpaceX rocket launch" queries. Reject these slugs for every space topic.
// Multi-word terms use dashes: the slug matcher converts "-" → "[- ]", so
// "new-year" matches both "new-year" and "new year" in a slug.
export const FIREWORKS_NEGATIVE_TERMS = [
  'fireworks', 'firework', 'celebration', 'new-year', 'festival',
  'pyrotechnic', 'sparkle', 'sparkler', 'feux', 'fuegos',
]

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
      // Push #239 — fireworks look like a launch against a dark sky.
      ...FIREWORKS_NEGATIVE_TERMS,
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
      // Push #239 — fireworks look like a booster burn against a dark sky.
      ...FIREWORKS_NEGATIVE_TERMS,
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
      // Push #239 — fireworks against the night sky get mistaken for orbit shots.
      ...FIREWORKS_NEGATIVE_TERMS,
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
      // Push #239 — fireworks against the night sky get mistaken for spacecraft.
      ...FIREWORKS_NEGATIVE_TERMS,
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

  // Push #257 — billionaire / wealth / luxury content.
  // "general_documentary" was previously returned by GPT for these topics but
  // didn't exist in VISUAL_CATEGORIES, so no negative-term filtering ran at
  // all — Pexels returned portrait shots of businessmen/beards. This category
  // enforces portrait rejection and ensures cinematic b-roll (cash, gold,
  // city nights, luxury interiors) instead of talking-head shots.
  billionaire_wealth: {
    id: 'billionaire_wealth',
    label: 'Billionaire / Wealth / Luxury Lifestyle',
    allowedQueries: [
      'wall street stock trading floor screens',
      'gold bars vault bank luxury',
      'dollar bills cash stacks money close',
      'luxury penthouse interior city view night',
      'sports car driving city night luxury',
      'private jet interior cabin luxury',
      'skyscraper aerial city skyline night',
      'stock market chart data screen',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'clipart', 'illustration', 'drawing',
      // Portrait / face rejection — the main bug this fixes.
      'portrait', 'headshot', 'selfie', 'smiling-man', 'smiling-woman',
      'businessman-portrait', 'professional-headshot', 'face-close',
      'man-looking', 'beard-man', 'person-smiling',
      // Generic office filler.
      'handshake', 'meeting', 'team', 'office-worker', 'whiteboard',
    ],
    strictMode: false,
  },

  // Push #257 — money / personal finance content (investing, crypto, savings).
  money_finance: {
    id: 'money_finance',
    label: 'Money / Personal Finance / Investing',
    allowedQueries: [
      'dollar bills cash hands counting close',
      'stock market graph chart laptop screen',
      'gold coins coins pile wealth',
      'credit card payment bank',
      'cryptocurrency bitcoin coin gold shiny',
      'trading floor stock exchange monitor',
      'investment portfolio phone coffee table',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'clipart', 'illustration', 'piggy-bank-toy',
      'drawing', 'kids', 'portrait', 'headshot', 'smiling-man', 'smiling-woman',
      'generic-office', 'handshake',
    ],
    strictMode: false,
  },

  // Push #264 — psychology / mindset / behavior
  psychology_mindset: {
    id: 'psychology_mindset',
    label: 'Psychology / Mindset / Human Behavior',
    allowedQueries: [
      'human brain neuron synapse dark close',
      'mind silhouette shadow dramatic dark',
      'neurons firing brain activity dark visualization',
      'person thinking shadow contemplation dark',
      'psychology experiment research laboratory',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'clipart', 'illustration', 'toy', 'kids',
      'portrait', 'headshot', 'smiling-man', 'smiling-woman',
    ],
    strictMode: false,
  },

  // Push #264 — technology / AI / computers / data
  technology_ai: {
    id: 'technology_ai',
    label: 'Technology / AI / Computers / Data',
    allowedQueries: [
      'computer chip circuit board macro close',
      'data center server racks dark blue glow',
      'code terminal dark screen green text',
      'neural network visualization digital dark',
      'cyber security hacker dark screen code',
      'technology circuit board abstract macro',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'clipart', 'illustration', 'toy', 'kids',
      'person-smiling', 'headshot', 'portrait', 'office-worker', 'handshake',
    ],
    strictMode: false,
  },

  // Push #264 — historical wars / military / battles
  historical_war: {
    id: 'historical_war',
    label: 'Historical War / Military / Battles',
    allowedQueries: [
      'vintage war footage black white archive historical',
      'old military equipment historical museum',
      'war memorial monument stone historical',
      'antique weapons armor museum display',
      'historical battlefield aerial ruins',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'game', 'video-game', 'toy', 'kids',
      'action-figure', 'lego', 'plastic', 'costume', 'acting', '3d-render',
    ],
    strictMode: false,
  },

  // Push #264 — geography / nature / landscapes
  nature_geography: {
    id: 'nature_geography',
    label: 'Geography / Nature / Landscapes',
    allowedQueries: [
      'aerial mountain range snow drone cinematic',
      'jungle rainforest aerial green dense',
      'ocean coastline aerial dramatic sunset',
      'desert landscape sand dunes aerial golden',
      'waterfall cliff aerial natural dramatic',
      'volcano eruption lava dramatic night',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'clipart', 'illustration', 'toy',
      'tourist-selfie', 'holiday-people', 'kids',
    ],
    strictMode: false,
  },

  // Push #264 — health / human body / medicine
  health_body: {
    id: 'health_body',
    label: 'Health / Human Body / Medicine',
    allowedQueries: [
      'human body anatomy organ close dark',
      'medical laboratory test tubes research',
      'x-ray scan medical imaging dark',
      'microscope bacteria cell research lab',
      'hospital medical equipment dark dramatic',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'clipart', 'illustration', 'toy', 'kids',
      'nurse-smiling', 'doctor-smiling', 'patient-happy', 'commercial',
    ],
    strictMode: false,
  },

  // Push #264 — true crime / mystery investigation / dark
  crime_mystery: {
    id: 'crime_mystery',
    label: 'True Crime / Mystery / Dark Investigation',
    allowedQueries: [
      'crime scene dark tape police night',
      'detective investigation folder documents dark',
      'dark forest abandoned building night fog',
      'old photograph faded black white crime',
      'prison bars dark dramatic shadows',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'comedy', 'kids', 'toy',
      'smiling', 'celebration', 'party', 'bright-happy',
    ],
    strictMode: false,
  },

  // Push #264 — animals / wildlife / nature documentary
  animal_wildlife: {
    id: 'animal_wildlife',
    label: 'Animal Facts / Wildlife / Nature Documentary',
    allowedQueries: [
      'lion predator hunting savanna cinematic',
      'eagle hawk flying aerial slow motion',
      'shark deep ocean dark dramatic',
      'elephant wildlife savanna dramatic cinematic',
      'wolf pack hunting forest dark',
      'whale ocean surface aerial dramatic',
    ],
    negativeTerms: [
      'cartoon', 'animation', 'toy', 'kids', 'pet-play',
      'zoo-enclosure-glass', 'aquarium-tank-glass', 'dog-park-playing',
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

  // Push #257 — Billionaire / wealth / money topics.
  // Must run BEFORE the space check that catches "elon.musk" for SpaceX content.
  // Ordered: billionaire_wealth first (more specific person+money context),
  // then money_finance for pure finance topics without a named person.
  if (/billionaire|ultra.wealthy|top.1.percent|richest.man|wealthiest|net.worth.*billion|warren.buffett|jeff.bezos|elon.musk.*wealth|mark.zuckerberg.*wealth|luxury.habit|luxury.lifestyle|wealth.habit/.test(combined)) return 'billionaire_wealth'
  if (/bitcoin|crypto|investing|stock.market|wall.street|compound.interest|savings.account|financial.freedom|personal.finance|money.tip|credit.card.trick/.test(combined)) return 'money_finance'

  // Push #264 — new niche categories
  if (/psychology|dopamine|serotonin|brain.hack|cognitive.bias|dark.psychology|manipulation.tactic|behavioral.science|mental.model|subconscious|unconscious.mind|ego|amygdala|prefrontal/.test(combined)) return 'psychology_mindset'
  if (/artificial.intelligence|machine.learning|neural.network|deep.learning|semiconductor|microchip|data.center|cyber.attack|hacker|silicon.valley|quantum.computer|circuit.board/.test(combined)) return 'technology_ai'
  if (/world.war|ww1|ww2|wwii|wwi|battle.of|siege.of|d.day|vietnam.war|cold.war|nuclear.bomb|atomic.bomb|military.secret|classified.operation|special.forces|navy.seal|secret.weapon|arms.race/.test(combined)) return 'historical_war'
  if (/mount.everest|k2|himalaya|amazon.river|amazon.jungle|sahara|volcano|eruption|glacier|grand.canyon|rainforest|arctic|antarctica|deepest.ocean|highest.mountain/.test(combined)) return 'nature_geography'
  if (/human.body|human.heart|immune.system|cancer.cell|virus.*body|bacteria.*body|gut.microbiome|nervous.system|hormones|insulin|cortisol|adrenaline|metabolism|gene.*health/.test(combined)) return 'health_body'
  if (/true.crime|serial.killer|cold.case|unsolved.murder|disappearance|missing.person|fbi.investigation|cia.secret|government.cover|conspiracy|illuminati|secret.society|strange.disappearance|paranormal/.test(combined)) return 'crime_mystery'
  if (/lion.hunt|shark.attack|eagle.hunt|wolf.pack|apex.predator|animal.kill|wildlife.documentary|migration.animal|bizarre.animal|animal.evolution|animal.fact|most.dangerous.animal|predator.prey/.test(combined)) return 'animal_wildlife'

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
