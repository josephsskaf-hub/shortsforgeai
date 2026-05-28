import type { GlobalVisualStyle, VisualMood } from './types'

interface NicheStyleRule {
  mood: VisualMood
  lighting: GlobalVisualStyle['lighting']
  cameraStyle: GlobalVisualStyle['cameraStyle']
  saturation: GlobalVisualStyle['saturation']
  realism: number
}

const NICHE_STYLE_MAP: Array<{ patterns: RegExp; style: NicheStyleRule }> = [
  {
    patterns: /billionaire|wealth|luxury|rich|money|finance|invest|cash|gold/i,
    style: {
      mood: 'luxurious',
      lighting: 'cinematic_dark',
      cameraStyle: 'cinematic',
      saturation: 'low',
      realism: 0.9,
    },
  },
  {
    patterns: /mystery|history|weird|paranormal|secret|conspiracy|ancient|unexplained|cover.?up/i,
    style: {
      mood: 'mysterious',
      lighting: 'cinematic_dark',
      cameraStyle: 'documentary',
      saturation: 'low',
      realism: 0.95,
    },
  },
  {
    patterns: /country|place|geography|mountain|city|travel|landscape|world/i,
    style: {
      mood: 'epic',
      lighting: 'golden_hour',
      cameraStyle: 'broadcast',
      saturation: 'normal',
      realism: 0.95,
    },
  },
  {
    patterns: /finance|stock|market|economy|bank|trading|wall street|economic/i,
    style: {
      mood: 'tense',
      lighting: 'studio',
      cameraStyle: 'broadcast',
      saturation: 'normal',
      realism: 0.9,
    },
  },
  {
    patterns: /learning|facts|mental|education|science|psychology|brain|mind/i,
    style: {
      mood: 'energetic',
      lighting: 'natural',
      cameraStyle: 'documentary',
      saturation: 'normal',
      realism: 0.85,
    },
  },
]

const DEFAULT_STYLE: NicheStyleRule = {
  mood: 'energetic',
  lighting: 'natural',
  cameraStyle: 'documentary',
  saturation: 'normal',
  realism: 0.85,
}

function derivePacing(tone: string): GlobalVisualStyle['pacing'] {
  const t = tone.toLowerCase()
  if (/ultra.?fast|hyper/.test(t)) return 'ultra_fast'
  if (/fast|energetic|viral|rapid|intense/.test(t)) return 'fast'
  if (/medium|moderate|balanced/.test(t)) return 'medium'
  return 'fast'
}

/**
 * Derives a GlobalVisualStyle from niche + tone + optional script hint.
 * Matches niche patterns in order — first match wins. Falls back to defaults.
 */
export function deriveGlobalStyle(
  niche: string,
  tone: string,
  script = '',
): GlobalVisualStyle {
  const searchText = `${niche} ${tone} ${script.slice(0, 300)}`

  let matched: NicheStyleRule | null = null
  for (const rule of NICHE_STYLE_MAP) {
    if (rule.patterns.test(searchText)) {
      matched = rule.style
      break
    }
  }

  const base = matched ?? DEFAULT_STYLE

  return {
    mood: base.mood,
    realism: base.realism,
    pacing: derivePacing(tone),
    saturation: base.saturation,
    cameraStyle: base.cameraStyle,
    lighting: base.lighting,
  }
}
