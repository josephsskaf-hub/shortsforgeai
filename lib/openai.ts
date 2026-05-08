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

const NICHE_CONTEXT: Record<string, string> = {
  // Legacy niches
  mideast: 'Middle East Secrets — hidden stories, geopolitics, untold facts, and shocking truths from the Middle East region (Dubai, Saudi Arabia, Egypt, Iran, etc.)',
  money: 'Money Facts — viral finance content, wealth inequality, how the rich get richer, money psychology, banking secrets, economic facts',
  mind: 'Mind Blowing Facts — jaw-dropping science, history, psychology, and nature facts that make people say "I never knew that"',
  dark: 'Dark Mysteries — unsolved mysteries, creepy historical events, government cover-ups, unexplained phenomena, horror history',
  motivation: 'Motivation — powerful motivational content, success mindset, daily discipline, overcoming failure, inspirational stories of real people',
  // Core niches
  history: 'History — fascinating historical facts, lost civilizations, ancient empires, wars, rulers, and turning points the textbooks rarely mention',
  mystery: 'Mystery — conspiracies, unsolved disappearances, secret societies, paranormal phenomena, government cover-ups, eerie unexplained events',
  finance: 'Finance — money psychology, wealth-building secrets, banking and economy facts, hidden financial truths, viral investing insights',
  science: 'Science — mind-bending physics, biology, space, the human body, cutting-edge discoveries that feel like science fiction',
  technology: 'Technology — AI breakthroughs, future tech, hidden truths about big tech, gadgets, cybersecurity, the next industrial revolution',
  general: 'General Viral — the most curiosity-driven, scroll-stopping facts and stories across any topic',
  // New viral niches
  'strange-facts': 'Strange Facts — the weirdest, most bizarre, and jaw-dropping facts from science, history, and nature that feel completely unreal',
  'hidden-places': 'Hidden Places — secret locations, forbidden zones, underground cities, and mysterious places most people will never see',
  'ancient-mysteries': 'Ancient Mysteries — lost civilizations, mysterious artifacts, impossible ancient technology, pyramids, and archaeological secrets',
  'billionaire-secrets': 'Billionaire Secrets — untold stories of how the ultra-rich really live, think, spend, and hide their wealth',
  'ai-tools': 'AI Tools — the most powerful AI tools transforming work, creativity, and life that most people do not know about',
  'money-hacks': 'Money Hacks — little-known financial tricks, tax secrets, passive income strategies, and wealth-building shortcuts',
  'psychology-facts': 'Psychology Facts — shocking truths about how the human mind works, dark psychology, manipulation tactics, and behavior science',
  'space-mysteries': 'Space Mysteries — mind-blowing discoveries, unexplained cosmic phenomena, alien theories, and the terrifying scale of the universe',
  'crime-stories': 'Crime Stories — true crime, heists, serial killers, masterminds, unsolved cases, and the darkest chapters of criminal history',
  'war-secrets': 'War Secrets — classified military operations, untold battles, government cover-ups, secret weapons, and the real stories behind wars',
  'survival-tips': 'Survival Tips — life-saving knowledge, extreme survival stories, disaster preparedness, and skills that could save your life',
  'conspiracy-files': 'Conspiracy Files — the most convincing conspiracy theories, government secrets, shadow organizations, and alternative histories',
  'tech-breakthroughs': 'Tech Breakthroughs — revolutionary technologies changing the world right now, from biotech to quantum computing',
  'lost-civilizations': 'Lost Civilizations — advanced ancient cultures, mysterious disappearances, forgotten empires, and archaeological anomalies',
  'animal-facts': 'Animal Facts — the most shocking, bizarre, and fascinating animal behaviors, abilities, and secrets from the natural world',
  'health-facts': 'Health Facts — surprising truths about the human body, controversial medical facts, and wellness secrets doctors do not always share',
  'celebrity-secrets': 'Celebrity Secrets — the untold stories, hidden scandals, secret lives, and shocking truths about famous people',
  'luxury-lifestyle': 'Luxury Lifestyle — how billionaires and celebrities really live, ultra-luxury experiences, and the world of extreme wealth',
  'future-predictions': 'Future Predictions — what scientists, futurists, and AI predict for the next 10-100 years that will change everything',
  'dark-history': 'Dark History — the most disturbing, suppressed, and chilling chapters of human history that were hidden from textbooks',
}

export function buildGenerationPrompt(niche: string): string {
  const context = NICHE_CONTEXT[niche] || NICHE_CONTEXT.general

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

export function buildSingleVideoPrompt(niche: string, topic: string, tone: string, durationSec: number): string {
  const context = NICHE_CONTEXT[niche] || NICHE_CONTEXT.general
  const safeTopic = topic.trim() || 'viral curiosity'

  return `You are a viral YouTube Shorts content creator specializing in the "${context}" niche.

Generate ONE viral YouTube Short tailored to this exact topic:
"${safeTopic}"

Tone: ${tone}. Target duration: ${durationSec} seconds. Vertical 9:16 format. English language.

Return ONLY a valid JSON array containing exactly 1 object — no markdown, no code blocks, no extra text. Just the raw JSON array.

The object must have these exact fields:
- "title": string — a click-bait, curiosity-driving title under 70 chars with 1 relevant emoji at the end
- "script": string — a complete ${durationSec}-second script with 3 clearly labeled sections: "🎯 HOOK:" (first 3 seconds, shocking statement), "📝 CONTENT:" (main body), "🔗 ENDING:" (CTA — must end with: "Visit www.shortsforge.com"). Use \\n\\n between sections.
- "videoPrompt": string — a detailed AI video generation prompt describing visuals, camera angles, text overlays, transitions, mood, and vertical 9:16 format
- "hashtags": array of 7 strings — each starting with # (e.g. "#shorts"), mix of niche-specific and viral tags
- "youtubeDescription": string — 2-3 sentences optimized for YouTube Shorts SEO, include primary keyword naturally

Make the hook absolutely shocking. The first 3 seconds must make the viewer physically unable to scroll past.`
}
