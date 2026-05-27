// Push #304 — Cron: refresh Viral Now topics daily at 6 AM UTC
// All prompts use the 5-element viral formula:
// HOOK → MICRO REWARD ×3-5 → ESCALATION → RHYTHM → PAYOFF
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const TOPIC_POOL: Array<{
  emoji: string
  label: string
  title: string
  prompt: string
  duration: number
  vertical: string
}> = [
  // ── BILLIONAIRE / MONEY ──────────────────────────────────────────────────────
  {
    emoji: '💰', label: '💰 Billionaire',
    title: 'The 3 rules billionaires never break',
    duration: 45, vertical: 'billionaire',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "Billionaires don't get rich by accident — they follow 3 rules most people never learn."

MICRO REWARD 1: Rule #1 — never sell your winners. Warren Buffett has held Coca-Cola for 35 years. Every time he almost sold, he lost nothing. Every time he held, he made millions more.

MICRO REWARD 2: Rule #2 — pay yourself in assets, not cash. Elon Musk takes a $1 salary. Jeff Bezos's net worth is 99% stock. Cash loses value. Assets multiply.

MICRO REWARD 3: Rule #3 — obsess over one number: return on invested capital. If a dollar in doesn't make more than a dollar out, they cut it immediately.

ESCALATION: The top 0.01% combine all three at once — low salary, compounding assets, zero tolerance for bad investments.

PAYOFF: The average person saves money. Billionaires build systems that make money while they sleep. Start with Rule #1 today.`,
  },
  {
    emoji: '💰', label: '💰 Billionaire',
    title: "Bezos's daily habit that built $200 billion",
    duration: 45, vertical: 'billionaire',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "Jeff Bezos does one thing every morning that 99% of CEOs refuse to do — and it's why Amazon is worth $2 trillion."

MICRO REWARD 1: He reads 3 newspapers before 7 AM. Not the news app. Physical papers. He says the discipline of holding information you didn't choose is what keeps you from living in a filter bubble.

MICRO REWARD 2: He has a "2-pizza rule" — no meeting should need more than 2 pizzas to feed the team. Smaller teams make faster decisions. Amazon moved faster than every competitor because their meetings were smaller.

MICRO REWARD 3: He sleeps 8 hours. No exceptions. He says every major decision he's made while tired cost him millions. Sleep is his highest-ROI investment.

ESCALATION: Three habits. All boring. All free. All responsible for building the largest e-commerce company in human history.

PAYOFF: Bezos didn't out-work his competitors. He out-rested, out-read, and out-communicated them. Which of these three can you start today?`,
  },
  {
    emoji: '📈', label: '📈 Finance',
    title: '5 money traps keeping you broke',
    duration: 45, vertical: 'money',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "5 money habits that feel normal — but are silently making you poorer every single month."

MICRO REWARD 1: Trap #1 — minimum credit card payments. If you have $5,000 in debt at 24% APR and pay the minimum, you'll pay it off in 22 years and spend $9,000 in interest. More than double the original debt.

MICRO REWARD 2: Trap #2 — lifestyle creep. Every raise you get, your spending rises to match it. You make more. You save the same. Five years later, you wonder where all the money went.

MICRO REWARD 3: Trap #3 — buying a new car. A $35,000 car loses 20% of its value the moment you drive it off the lot. That's $7,000 gone in 5 minutes.

MICRO REWARD 4: Trap #4 — no emergency fund. One unexpected expense — a hospital bill, a broken car — and you're back to zero or in debt. The emergency fund isn't optional. It's the foundation.

ESCALATION: Most people are in 3 or more of these traps right now — and don't even know it.

PAYOFF: Financial freedom isn't about making more. It's about stopping the leaks. Save this list. Check yourself against it tonight.`,
  },
  {
    emoji: '📈', label: '📈 Finance',
    title: 'How compound interest makes you a millionaire',
    duration: 45, vertical: 'money',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "$200 a month. That's all it takes. But you have to start before age 30 — or you'll pay a $400,000 penalty."

MICRO REWARD 1: If you invest $200 per month starting at age 25, at a 10% average return — the historical average of the S&P 500 — you'll have $1.3 million by age 65. You put in $96,000. The market added $1.2 million.

MICRO REWARD 2: Start at 35 instead? Same $200, same 10%, same retirement age. You end up with $452,000. The 10-year delay cost you $850,000. Not a typo.

MICRO REWARD 3: The secret is that compound interest is exponential, not linear. The first 20 years, growth feels slow. The last 10 years, it explodes. Most people quit in year 5 — right before the miracle starts.

ESCALATION: Einstein reportedly called compound interest the eighth wonder of the world. Those who understand it earn it. Those who don't pay it — in debt interest.

PAYOFF: Time in the market always beats timing the market. The best day to start was yesterday. The second best day is today.`,
  },
  {
    emoji: '💰', label: '💰 Billionaire',
    title: "What billionaires do every Sunday night",
    duration: 45, vertical: 'billionaire',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "Top billionaires don't dread Mondays — because Sunday night, they do 3 things most people skip."

MICRO REWARD 1: They plan the week on paper. Not a phone app. A physical notebook. Mark Cuban writes his week's priorities by hand every Sunday. He says the act of writing forces clarity you can't fake.

MICRO REWARD 2: They read for one hour — nonfiction only. Warren Buffett reads 500 pages a day. On Sundays, he focuses on industries he doesn't yet understand. He says every book is a $15 education.

MICRO REWARD 3: They make one important call. Not to check in. To strengthen a relationship that matters. Richard Branson calls someone he hasn't spoken to in 90 days every single Sunday.

ESCALATION: Three habits. One evening. All three billionaires started these routines before they made their first million.

PAYOFF: Sunday is the most underrated day of the week. While everyone else is watching Netflix, the top 1% are setting up next week's win.`,
  },

  // ── MYSTERY / WEIRD HISTORY ─────────────────────────────────────────────────