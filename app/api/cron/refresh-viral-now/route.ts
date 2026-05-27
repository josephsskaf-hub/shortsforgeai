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

  // ── MYSTERY / WEIRD HISTORY ──────────────────────────────────────────────────
  {
    emoji: '🔮', label: '🔮 Mystery',
    title: 'The disappearance nobody solved',
    duration: 45, vertical: 'mystery',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "3 people vanished without a trace — and the evidence left behind is more disturbing than the disappearance itself."

MICRO REWARD 1: The Sodder children, Christmas 1945. A house fire in West Virginia killed no adults — but 5 children were never found. No remains. No bones. Nothing. 23 years later, a photo arrived in the mail. It looked exactly like one of the missing kids. Addressed to the mother. No return address.

MICRO REWARD 2: DB Cooper, 1971. A man hijacked a Boeing 727, collected $200,000 in ransom, and parachuted into the Pacific Northwest in a rainstorm. Despite the largest manhunt in FBI history, he was never identified. A bundle of his ransom money was found in 1980 — half-decayed, on a riverbank. Nobody knows how it got there.

MICRO REWARD 3: The Beaumont children, Australia, 1966. Three siblings — ages 4, 7, and 9 — went to the beach and never came back. 600 people were questioned. Zero arrests. The case is still open. Their parents searched for them until the day they died.

ESCALATION: Three cases. Three countries. Three decades. All still unsolved. All still officially active.

PAYOFF: Some people vanish completely — and the world just keeps going. Save this and tell me: which one disturbs you the most?`,
  },
  {
    emoji: '🔮', label: '🔮 Mystery',
    title: 'What really happened at Dyatlov Pass',
    duration: 45, vertical: 'mystery',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "9 experienced hikers died in the Soviet mountains in 1959. The official explanation is still classified."

MICRO REWARD 1: The Dyatlov Pass incident. February 1st, 1959. Nine trained mountaineers set up camp on a mountain in the Ural range. By morning, all nine were dead. Their tent was cut open from the inside. They ran into the dark wearing almost nothing in minus 30 degrees.

MICRO REWARD 2: The injuries made no sense. Three hikers had fractured skulls and broken ribs — the kind of force you'd see in a car crash. But there were no external wounds. No bruising on the skin. No explanation for how internal bones shattered without a scratch on the surface.

MICRO REWARD 3: One victim was missing her tongue, eyes, and part of her lips. The Soviet government ruled it "unknown compelling force" and sealed the files for 30 years. When they were reopened, 6 pages were missing.

ESCALATION: Every theory — avalanche, military testing, infrasound panic, Yeti attack — has been proposed. None of them explain all 9 facts simultaneously.

PAYOFF: The scariest part isn't how they died. It's that someone knows — and decided the world shouldn't. Save this.`,
  },
  {
    emoji: '🔮', label: '🔮 Mystery',
    title: "History's uncracked codes nobody has solved",
    duration: 45, vertical: 'mystery',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "These 3 codes have never been cracked — and one of them might be hiding $63 million in buried treasure."

MICRO REWARD 1: The Voynich Manuscript. A 600-year-old book written in a language no linguist on Earth can identify. It contains detailed illustrations of plants that don't exist in nature, astronomical charts that don't match any known system, and 240 pages of text that has never been decoded — despite being studied by NSA cryptographers.

MICRO REWARD 2: The Beale Ciphers. In 1885, a pamphlet described three coded messages — one allegedly revealing the location of $63 million in gold buried in Virginia. Two of the three codes have never been solved. People have spent their life savings trying.

MICRO REWARD 3: The Zodiac Killer sent 4 ciphers to newspapers in the 1960s. Only one was cracked — and it took 51 years and a team of three codebreakers using modern computers. The other three remain unsolved. The killer's identity was never confirmed.

ESCALATION: Three codes. Combined, they've had millions of human hours thrown at them. Zero full solutions.

PAYOFF: Somewhere in these codes, there are answers. Nobody alive has found them yet. Save this — you might be the one.`,
  },

  // ── COUNTRIES / PLACES ───────────────────────────────────────────────────────
  {
    emoji: '🌍', label: '🌍 Countries',
    title: 'Countries that will arrest you for normal things',
    duration: 45, vertical: 'country',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "These 3 countries will arrest you for things you did this morning."

MICRO REWARD 1: Singapore — chewing gum has been illegal since 1992. Not just in public. Importing it. First offense: up to a $100,000 fine. The law was passed because subway doors kept jamming. They didn't debate it. They banned it.

MICRO REWARD 2: Bhutan — charges every tourist a $200-per-day fee by law, just for existing there. Not a hotel fee. A government-mandated "happiness tax." Result: fewer tourists, less pollution, higher GDP per person than most neighbors. The policy works.

MICRO REWARD 3: North Korea — tourists are allowed but cannot take a photo without a government guide's permission. One unauthorized image of a soldier or empty building has kept Americans in detention for years. A selfie in the wrong place can cost you everything.

ESCALATION: Three countries. Three completely different reasons. One outcome: break the rule and you don't get a warning.

PAYOFF: The world doesn't run on the same rulebook. Before you travel anywhere, look up what's actually illegal. Some surprises you cannot afford.`,
  },
  {
    emoji: '🌍', label: '🌍 Countries',
    title: 'K2 kills 1 in 4 climbers — here is why',
    duration: 45, vertical: 'country',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "Everest has a 1% death rate. K2 has 25%. Here's why the world's second-highest mountain is actually the most lethal."

MICRO REWARD 1: The Bottleneck. Every climber on K2 must pass through a 45-degree ice gully called the Bottleneck — directly beneath a serac, a massive hanging glacier the size of a 10-story building. In 2008, it collapsed. Eleven climbers were killed in a single day. It can collapse again at any time. There is no alternative route.

MICRO REWARD 2: No helicopter rescue. On Everest, helicopters can reach stranded climbers up to 7,000 meters. On K2, the mountain's shape and altitude make helicopter rescue physically impossible above base camp. If something goes wrong above 6,000 meters, you walk out or you die.

MICRO REWARD 3: K2 has never been summited in winter — until January 2021, when a team of Nepali climbers did it for the first time in history. Temperatures were minus 65 degrees Celsius. Wind gusts hit 200 kilometers per hour. They sang the Nepali national anthem at the top.

ESCALATION: 377 people have reached the summit. 91 have died trying. That ratio — 1 death for every 4 summits — has held for 70 years.

PAYOFF: Everest gets the fame. K2 gets the respect. The deadliest mountain on Earth isn't the tallest one.`,
  },
  {
    emoji: '🌍', label: '🌍 Countries',
    title: 'Singapore: the tiny country that broke every rule',
    duration: 45, vertical: 'country',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "This country has no natural resources, no farmland, no fresh water — and a higher GDP per person than the United States."

MICRO REWARD 1: Singapore became independent in 1965 with nothing. Literally nothing — they had to import water from Malaysia. Today they recycle 40% of their water through a process called NEWater. They turned a crisis into infrastructure. They didn't complain. They engineered.

MICRO REWARD 2: The mandatory savings rate. Every Singaporean worker deposits 20% of their salary into a government-managed fund called the CPF. The government adds another 17%. By retirement, most citizens have enough to own their home outright. Homeownership rate: 89%. One of the highest in the world.

MICRO REWARD 3: Zero tolerance for corruption — enforced. In Singapore, a civil servant accepting a bribe goes to prison. The prime minister's salary is $2.2 million per year — legally. Why? To remove the incentive to steal. Transparency International ranks Singapore as one of the least corrupt nations on Earth.

ESCALATION: 60 years ago, Singapore was a swamp with a fishing village. Today it's the 4th richest country per capita in the world.

PAYOFF: Singapore didn't win by luck. It won by making decisions most countries are too afraid to make. One city. Every lesson.`,
  },

  // ── LEARNING / MENTAL MODELS ─────────────────────────────────────────────────
  {
    emoji: '🧠', label: '🧠 Learning',
    title: '3 mental models that change how you think',
    duration: 45, vertical: 'learning',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "3 thinking tools used by Elon Musk, Warren Buffett, and Charlie Munger — that 99% of people have never heard of."

MICRO REWARD 1: First Principles Thinking. Instead of doing what everyone else does, break the problem down to its most basic facts. Elon Musk used this to build rocket ships. The industry said rockets cost $65 million. He asked: what do rockets cost to build from raw materials? The answer was $2 million. He built SpaceX.

MICRO REWARD 2: Inversion. Charlie Munger says the secret to success isn't just knowing what to do — it's knowing what NOT to do. Instead of asking "how do I succeed?" ask "what would definitely make me fail?" Then avoid those things. Simple. Powerful. Almost nobody uses it.

MICRO REWARD 3: The 10-10-10 Rule. Before any big decision, ask: how will I feel about this in 10 minutes? 10 months? 10 years? Most regrets come from decisions that felt good in 10 minutes and terrible in 10 years.

ESCALATION: Three tools. All free. All used by the wealthiest decision-makers alive. None taught in school.

PAYOFF: You don't need a higher IQ. You need better thinking frameworks. Save this — and use one of these before your next big decision.`,
  },
  {
    emoji: '🧠', label: '🧠 Learning',
    title: 'The Pareto Principle: why 20% does 80% of everything',
    duration: 45, vertical: 'learning',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "20% of your actions create 80% of your results. Most people spend their life on the wrong 80%."

MICRO REWARD 1: Vilfredo Pareto discovered this in 1906 when he noticed that 20% of the pea pods in his garden produced 80% of the peas. He then checked land ownership in Italy — 20% of the population owned 80% of the land. He checked wealth distribution across every country he could find. The same ratio appeared everywhere.

MICRO REWARD 2: It's not just business. 20% of your friends give you 80% of your happiness. 20% of your clothes get worn 80% of the time. 20% of roads carry 80% of traffic. The pattern is embedded in almost every complex system.

MICRO REWARD 3: The billionaire application. Warren Buffett says the difference between successful people and very successful people is that very successful people say no to almost everything. He identifies his 80-20 and eliminates the rest. His calendar has more empty space than most people's.

ESCALATION: The rule works in reverse too. 20% of your habits are probably causing 80% of your problems. Find them. Cut them.

PAYOFF: You don't need to do more. You need to find your 20%. Everything else is noise.`,
  },
  {
    emoji: '🧠', label: '🧠 Learning',
    title: 'Facts that sound completely fake but are 100% true',
    duration: 45, vertical: 'learning',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "5 facts that will make people call you a liar — all of them scientifically verified."

MICRO REWARD 1: Oxford University is older than the Aztec Empire. Teaching began at Oxford in 1096. The Aztec civilization didn't begin until 1300. Europe had an internationally recognized university before the Americas' most famous empire even started.

MICRO REWARD 2: The number of possible chess games exceeds the number of atoms in the observable universe. There are roughly 10 to the power of 80 atoms in the universe. There are 10 to the power of 120 possible chess games. The universe doesn't have enough matter to represent every game of chess that could ever be played.

MICRO REWARD 3: Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid. She was born 2,500 years after the pyramids were built. She died 2,000 years before Apollo 11. The pyramids are THAT old.

MICRO REWARD 4: A day on Venus is longer than a year on Venus. Venus rotates so slowly that it completes a full orbit around the Sun before it completes a single rotation on its own axis.

ESCALATION: Four facts. All verified. All mind-bending. All proven by the same science class most of us slept through.

PAYOFF: The universe is stranger than any story. Save this and drop one of these at your next dinner — watch what happens.`,
  },
  {
    emoji: '🧠', label: '🧠 Learning',
    title: 'Why your brain is lying to you right now',
    duration: 45, vertical: 'learning',
    prompt: `YouTube Short script, 45 seconds, 9:16 vertical.

HOOK: "Your brain makes 35,000 decisions per day — and it cheats on most of them. Here's how."

MICRO REWARD 1: Confirmation Bias. Your brain filters out any information that contradicts what you already believe. You think you're being rational. You're actually only seeing evidence that agrees with you. Studies show that people presented with identical evidence reach opposite conclusions based solely on their prior beliefs.

MICRO REWARD 2: The Dunning-Kruger Effect. The less you know about a subject, the more confident you feel about it. Beginners are supremely confident. Experts are plagued by doubt. This is why the loudest people in the room are rarely the most knowledgeable — and why you should always be suspicious of your own certainty.

MICRO REWARD 3: Sunk Cost Fallacy. You stay in a bad job, a bad relationship, or a bad investment because you've already spent time or money on it. But that time and money is already gone — it doesn't change the future. Every day you stay is a new decision. Most people treat it as a commitment.

ESCALATION: Three bugs. All in every human brain. All running silently right now, shaping your decisions without your permission.

PAYOFF: You can't delete these biases. But naming them is the first step to catching them. Save this — and ask which one cost you most this week.`,
  },
]

function pickTopicsForWindow(dateStr: string, hourBlock: number) {
  // Push #324 — 6 topics per window, rotate every 5h
  const seed = parseInt(dateStr.replace(/-/g, ''), 10) + hourBlock * 7919
  const n = seed % TOPIC_POOL.length
  const pool = [...TOPIC_POOL.slice(n), ...TOPIC_POOL.slice(0, n)]
  const picked: typeof TOPIC_POOL = []
  const usedVerticals = new Set<string>()
  for (const t of pool) {
    if (picked.length >= 6) break
    if (!usedVerticals.has(t.vertical)) { picked.push(t); usedVerticals.add(t.vertical) }
  }
  for (const t of pool) {
    if (picked.length >= 6) break
    if (!picked.includes(t)) picked.push(t)
  }
  return picked.slice(0, 6)
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const hourBlock = Math.floor(now.getUTCHours() / 5)
    const picked = pickTopicsForWindow(today, hourBlock)

    const rows = picked.map((t, i) => ({
      date: today,
      slot: i + 1,
      emoji: t.emoji,
      label: t.label,
      title: t.title,
      prompt: t.prompt,
      duration: t.duration,
      vertical: t.vertical,
    }))

    const { error } = await supabase
      .from('viral_now_topics')
      .upsert(rows, { onConflict: 'date,slot' })

    if (error) throw error

    console.log('[refresh-viral-now] updated 6 topics for', today, 'block', hourBlock)
    return NextResponse.json({ ok: true, date: today, hourBlock, count: rows.length })
  } catch (err) {
    console.error('[refresh-viral-now] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
