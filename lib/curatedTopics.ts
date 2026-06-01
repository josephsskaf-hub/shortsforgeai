// #374 — Curated viral topic bank for the "blank canvas" fix (Task 2).
// Zero AI cost: these are hand-picked, high-curiosity evergreen topics spread
// across the channel's niches. Used by:
//   - Home hero + /generate "🎲 Surprise me" button (randomTopic)
//   - Home fixed chips (HOME_CHIPS)
// Keep topics PUNCHY and concrete — they double as ready-to-generate prompts.

export interface Chip {
  /** Label shown on the chip (may include an emoji). */
  label: string
  /** The plain topic text dropped into the textarea (no emoji). */
  value: string
}

// The 4 fixed chips under the home hero (Task 2, Camada 1).
export const HOME_CHIPS: Chip[] = [
  { label: '✨ 5 morning habits of billionaires', value: '5 morning habits of billionaires' },
  { label: '🔮 The Mary Celeste: ship found with no crew', value: 'The Mary Celeste: a ship found adrift in 1872 with no crew' },
  { label: '🌍 Why Iceland has no mosquitoes', value: 'Why Iceland has no mosquitoes' },
  { label: '💰 The $300 wallet rule of the rich', value: 'The $300 wallet rule the rich use to stay rich' },
]

// 38 curated topics across the 8 niches. Surprise me draws from this pool.
export const CURATED_TOPICS: string[] = [
  // Billionaire / mindset
  '5 morning habits of billionaires',
  'The one rule Warren Buffett follows that 99% of investors ignore',
  'What Elon Musk eats in a day to run 6 companies',
  'The $300 wallet rule the rich use to stay rich',
  'Why billionaires wear the same outfit every day',
  'The 10-second decision rule that saves the rich millions',
  // Money / finance
  'The credit card float trick that buys you 45 free days',
  'Why your savings account is quietly losing you money',
  'The 50/30/20 rule that fixes a broke paycheck',
  'The Rule of 72 — double your money without a calculator',
  'Why the rich borrow money instead of spending their own',
  // Mystery / weird history
  'The Mary Celeste: a ship found adrift in 1872 with no crew',
  'The Dyatlov Pass incident: 9 hikers found dead, still unexplained',
  'The 1518 dancing plague that made 400 people dance to death',
  'The radio signal from deep space that repeats every 16 days',
  'The Voynich manuscript no one has ever been able to read',
  'The Antikythera mechanism: a 2,000-year-old computer',
  // Countries / places
  'Why Iceland has no mosquitoes',
  'Why Norway pays you to live in the Arctic',
  'The hidden country between Russia and China almost no one visits',
  'Why Japan’s trains are never more than 60 seconds late',
  'The country that banned billboards and looks like the future',
  'Why Switzerland has a nuclear bunker for every single citizen',
  // Science
  'Why time runs faster on a mountain than at sea level',
  'The tiny animal that can survive the vacuum of space',
  'Why you can’t fold a piece of paper more than 7 times',
  'The sound a black hole makes, recorded by NASA',
  'Why the Eiffel Tower is taller in summer',
  // Space
  'There is a planet made entirely of diamond, 40 light-years away',
  'Why a day on Venus is longer than its entire year',
  'What happens to the human body in the first minute on Mars',
  'The star so big it would swallow Jupiter’s entire orbit',
  // Learning / mental models
  'The Feynman Technique to learn anything twice as fast',
  'The Pareto Principle: how 20% of effort gives 80% of results',
  'Why spaced repetition beats cramming every single time',
  'The 2-minute rule that kills procrastination instantly',
  // History
  'Why Roman concrete still stands stronger after 2,000 years',
  'The Library of Alexandria: how humanity lost a million books',
]

/**
 * Returns a random curated topic, avoiding an immediate repeat of `previous`.
 * No network / no AI — instant and free.
 */
export function randomTopic(previous?: string): string {
  if (CURATED_TOPICS.length === 0) return ''
  let pick = CURATED_TOPICS[Math.floor(Math.random() * CURATED_TOPICS.length)]
  if (previous && CURATED_TOPICS.length > 1) {
    let guard = 0
    while (pick === previous && guard < 8) {
      pick = CURATED_TOPICS[Math.floor(Math.random() * CURATED_TOPICS.length)]
      guard++
    }
  }
  return pick
}
