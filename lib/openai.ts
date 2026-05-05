import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export interface ShortVideo {
  title: string
  script: string
  videoPrompt: string
  hashtags: string[]
  youtubeDescription: string
}

export function buildGenerationPrompt(niche: string): string {
  const nicheContext: Record<string, string> = {
    mideast: 'Middle East Secrets — hidden stories, geopolitics, untold facts, and shocking truths from the Middle East region (Dubai, Saudi Arabia, Egypt, Iran, etc.)',
    money: 'Money Facts — viral finance content, wealth inequality, how the rich get richer, money psychology, banking secrets, economic facts',
    mind: 'Mind Blowing Facts — jaw-dropping science, history, psychology, and nature facts that make people say "I never knew that"',
    dark: 'Dark Mysteries — unsolved mysteries, creepy historical events, government cover-ups, unexplained phenomena, horror history',
    motivation: 'Motivation — powerful motivational content, success mindset, daily discipline, overcoming failure, inspirational stories of real people',
  }

  const context = nicheContext[niche] || niche

  return `You are a viral YouTube Shorts content creator specializing in the "${context}" niche.

Generate exactly 5 viral YouTube Shorts scripts. Each short must be designed to maximize watch time, shares, and follows.

Return ONLY a valid JSON array with exactly 5 objects. No markdown, no code blocks, no extra text — just the raw JSON array.

Each object must have these exact fields:
- "title": string — a click-bait, curiosity-driving title under 70 chars with 1 relevant emoji at the end
- "script": string — a complete 30-second script with 3 clearly labeled sections: "🎯 HOOK:" (first 3 seconds, shocking statement), "📝 CONTENT:" (main body, 20 seconds), "🔗 ENDING:" (call to action, 7 seconds). Use \\n\\n between sections.
- "videoPrompt": string — a detailed AI video generation prompt describing visuals, camera angles, text overlays, transitions, mood, and vertical 9:16 format
- "hashtags": array of 7 strings — each starting with # (e.g. "#shorts"), mix of niche-specific and viral tags
- "youtubeDescription": string — 2-3 sentences optimized for YouTube Shorts SEO, include primary keyword naturally

Make every hook absolutely shocking. The first 3 seconds must make the viewer physically unable to scroll past.`
}
