const MAX_SERIES_SEED_LENGTH = 180

export type SeriesContinuationSource =
  | 'done_screen'
  | 'generate_recent_video'
  | 'history_milestone'
  | 'history_video_card'

export function normalizeSeriesSeed(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/["“”]+/g, '')
    .trim()
    .slice(0, MAX_SERIES_SEED_LENGTH)
}

export function buildSeriesContinuationPrompt(value: string | null | undefined): string {
  const seed = normalizeSeriesSeed(value)
  if (!seed) return ''
  return `Create the next episode in the same Short series about "${seed}". Keep the topic and format recognizable, but use a completely new hook, new facts, and a fresh payoff. Do not repeat the previous episode.`
}

export function buildSeriesContinuationHref(
  value: string | null | undefined,
  source: SeriesContinuationSource,
): string {
  const prompt = buildSeriesContinuationPrompt(value)
  if (!prompt) return '/generate'
  const params = new URLSearchParams({
    prompt,
    autoanalyze: '1',
    series: '1',
    continuation_source: source,
  })
  return `/generate?${params.toString()}`
}
