// Push #337 — lib/viralTopics.ts: 30-topic pool with full prompts, seeded shuffle, 4-hour rotation

export type ViralTopic = {
  id: string
  slot: number
  emoji: string
  label: string
  category: string
  title: string
  hook: string
  description: string
  prompt: string
  badge: 'Hot' | 'Trending' | 'High Retention' | 'Viral'
  viralScore: number
  duration: number
  vertical: string
}

export const VIRAL_TOPICS_POOL: ViralTopic[] = [
  // ── BILLIONAIRE ──────────────────────────────────────────────────────────
  {
    id: 'bill-01',
    slot: 0,
    emoji: '💰',
    label: '💰 Billionaire',
    category: 'Wealth Strategy',
    title: 'How billionaires use debt to get richer',
    hook: "Billionaires don't spend their own money — they borrow it. Here's the legal trick that makes them richer every year.",
    description: 'Why the ultra-wealthy prefer loans over selling assets — and the tax strategy behind it.',
    badge: 'Hot',
    viralScore: 94,
    duration: 45,
    vertical: 'billionaire',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: gold coins stack luxury wealth] Billionaires don't spend their own money — they borrow it. Here's the legal trick making them richer every year.

MICRO REWARD 1: [Pexels: bank loan documents signing desk] The buy-borrow-die method: Elon Musk used $100B in Tesla stock as collateral for personal loans — paying 2% interest instead of 37% income tax.

MICRO REWARD 2: [Pexels: irs tax forms accountant office] When you sell stock you trigger capital gains tax. When you borrow against it, you pay nothing. The loan isn't income. That's the entire strategy.

MICRO REWARD 3: [Pexels: stock portfolio wealth management screen] Jeff Bezos borrowed against Amazon shares to fund Blue Origin. Larry Ellison used Oracle stock as collateral for a $10B loan to buy 98% of Lanai island.

ESCALATION: [Pexels: private jet luxury yacht helicopter ocean] The triple compounding: assets keep growing, loans stay cheap, and taxes are deferred until death — where a stepped-up basis resets capital gains to zero.

PAYOFF: [Pexels: person financial freedom beach sunset luxury] The rich don't earn their way to wealth. They engineer it. The debt isn't a burden — it's the weapon. Save this before it disappears.`,
  },
  {
    id: 'bill-02',
    slot: 0,
    emoji: '💰',
    label: '💰 Billionaire',
    category: 'Billionaire Mindset',
    title: 'Why rich people think differently about time',
    hook: "A billionaire's hour is worth $10,000. Here's how they protect it — and why they say no more than anyone.",
    description: 'How the wealthiest people structure, protect, and monetize their time differently from everyone else.',
    badge: 'High Retention',
    viralScore: 88,
    duration: 45,
    vertical: 'billionaire',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: luxury watch close up time billionaire] A billionaire's hour is worth $10,000. Here's how they protect every single one — and why they say no more than anyone alive.

MICRO REWARD 1: [Pexels: calendar schedule planner executive] Warren Buffett keeps 80% of his calendar empty. Not because he's lazy — because he says thinking IS the work. Meetings are the interruption.

MICRO REWARD 2: [Pexels: private assistant team delegation office] Jeff Bezos invented the "two-pizza rule": if a meeting needs more than two pizzas to feed the room, the meeting is too big. He walked out of anything larger.

MICRO REWARD 3: [Pexels: no sign rejection boundary setting] Elon Musk cold-exits meetings the moment his value drops to zero. Tim Cook wakes at 3:45am to answer zero emails from people — he processes them before the world wakes up.

ESCALATION: [Pexels: billionaire private jet flying above clouds] The pattern: every billionaire treats their calendar like a bank account. Every yes costs them. Every no compounds. They're not rude — they're calculating.

PAYOFF: [Pexels: person focused productivity desk sunrise] You don't need a billion dollars to think like one. Guard your hours like they're worth $10,000. Because the ones you waste today are the ones you can never bill back.`,
  },
  {
    id: 'bill-03',
    slot: 0,
    emoji: '💰',
    label: '💰 Billionaire',
    category: 'Wealth Rules',
    title: 'The 3 rules billionaires never break',
    hook: "Billionaires don't get rich by accident — they follow 3 rules most people never learn.",
    description: 'Warren Buffett, Elon Musk, and Jeff Bezos all share these same 3 financial rules.',
    badge: 'Viral',
    viralScore: 96,
    duration: 45,
    vertical: 'billionaire',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: billionaire mansion wealth success luxury] Billionaires don't get rich by accident. They follow 3 rules most people are never taught — and breaking even one costs everything.

MICRO REWARD 1: [Pexels: rule number one investment portfolio stocks] Rule 1: Never lose money. Warren Buffett's actual rule — not metaphor. He holds cash for years waiting for a crash. Patience is his weapon. Panic is yours.

MICRO REWARD 2: [Pexels: asymmetric bet risk reward calculation] Rule 2: Asymmetric bets only. Elon Musk bet $180M — his entire PayPal fortune — on SpaceX and Tesla simultaneously. The downside was broke. The upside was trillions. Small risks don't build empires.

MICRO REWARD 3: [Pexels: compound interest growth chart exponential] Rule 3: Never stop compounding. Jeff Bezos reinvested every Amazon dollar for 7 years. No dividends. No luxury. Pure compounding. By year 8, the machine was unstoppable.

ESCALATION: [Pexels: three rules wealth system formula] These three rules share one DNA: protect the base, bet asymmetrically, and compound relentlessly. It's not complicated. It's just hard to follow when emotion takes over.

PAYOFF: [Pexels: financial freedom sunrise person wealth] Rule 1: Don't lose. Rule 2: Bet big on asymmetric odds. Rule 3: Compound without stopping. Three rules. Followed by every billionaire alive. Save this.`,
  },
  {
    id: 'bill-04',
    slot: 0,
    emoji: '💰',
    label: '💰 Billionaire',
    category: 'Success Habits',
    title: 'What billionaires do every Sunday night',
    hook: "Top billionaires don't dread Mondays — because Sunday night they do 3 things most people skip.",
    description: 'The Sunday evening ritual shared by Mark Cuban, Warren Buffett, and Richard Branson.',
    badge: 'Trending',
    viralScore: 87,
    duration: 45,
    vertical: 'billionaire',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: sunday evening home office planning notebook] Billionaires don't dread Mondays. Because Sunday night they do 3 things most people skip entirely.

MICRO REWARD 1: [Pexels: weekly review journal writing planner] Thing 1: The weekly review. Mark Cuban spends 45 minutes every Sunday writing what worked, what failed, and what he learned that week. Not a diary — a performance audit.

MICRO REWARD 2: [Pexels: priority list top three goals executive desk] Thing 2: The Monday pre-load. Warren Buffett reads the 3 most important decisions waiting for him Monday morning — Saturday night. By Sunday he's already solved them in his head while most people are still hungover.

MICRO REWARD 3: [Pexels: physical exercise outdoor evening workout] Thing 3: Physical reset. Richard Branson exercises every Sunday evening — specifically Sunday, not Monday morning. He says it flips his mental state from weekend mode to builder mode 12 hours earlier than his competitors.

ESCALATION: [Pexels: calendar organized week ahead schedule] The math: if you pre-load your week 52 times a year, you're mentally 52 Mondays ahead of everyone reacting. Billionaires don't respond to the week — they've already run it in their heads.

PAYOFF: [Pexels: productive monday morning coffee work focus] Sunday night review. Monday morning pre-loaded. Physical reset before the week starts. Three moves. Zero cost. Save this and start this Sunday.`,
  },
  {
    id: 'bill-05',
    slot: 0,
    emoji: '💰',
    label: '💰 Billionaire',
    category: 'CEO Habits',
    title: "Bezos's daily habit that built $200 billion",
    hook: "Jeff Bezos does one thing every morning that 99% of CEOs refuse to do — and it's why Amazon hit $2 trillion.",
    description: "Three boring morning habits responsible for building the world's largest e-commerce company.",
    badge: 'Viral',
    viralScore: 93,
    duration: 45,
    vertical: 'billionaire',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: morning routine alarm clock sunrise executive] Jeff Bezos does one thing every morning that 99% of CEOs refuse to do. It's why Amazon crossed $2 trillion — and it's embarrassingly simple.

MICRO REWARD 1: [Pexels: coffee morning slow breakfast reading] Habit 1: Bezos protects his first 3 hours. No calls before 10am. No meetings before breakfast. He calls this his "puttering" time — wandering, reading, thinking without agenda. Most CEOs sprint to their inbox. Bezos walks.

MICRO REWARD 2: [Pexels: small decisions focus clarity notebook] Habit 2: He makes his hardest decisions before noon. Bezos publicly stated he makes only 3 high-quality decisions per day — and all 3 happen in the morning when his prefrontal cortex is fresh. Not when he's tired at 4pm.

MICRO REWARD 3: [Pexels: sleep schedule rest 8 hours bed night] Habit 3: 8 hours of sleep. Non-negotiable. Bezos said on record: "I need 8 hours. If I get 6, I make 20% worse decisions." For a man running a $2 trillion company, 20% is $400 billion.

ESCALATION: [Pexels: amazon headquarters seattle building corporate] Three boring habits. Protect the morning. Limit daily decisions. Sleep 8 hours. No cold plunge. No 4am wake-up. No biohacking. Just ruthless protection of cognitive quality.

PAYOFF: [Pexels: person morning window coffee productive focus] The man who built the world's largest empire guards his mornings like a vault. You have the same 24 hours. The question is who controls your first three.`,
  },

  // ── MONEY ────────────────────────────────────────────────────────────────
  {
    id: 'mon-01',
    slot: 0,
    emoji: '📈',
    label: '📈 Finance',
    category: 'Money Strategy',
    title: "5 money facts that sound illegal but aren't",
    hook: "These 5 money moves look like they shouldn't be legal — but they're how the wealthy play the game.",
    description: "Legal financial strategies used by the wealthy that most people don't know exist.",
    badge: 'Viral',
    viralScore: 97,
    duration: 45,
    vertical: 'money',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: money cash hundred dollar bills stack] These 5 money moves look completely illegal. They're not. They're how the wealthy quietly play a different game.

MICRO REWARD 1: [Pexels: roth ira investment account documents] Fact 1: You can put $7,000 into a Roth IRA, invest it in the S&P 500, and withdraw millions tax-free at 65. Peter Thiel turned $2,000 into $5 billion in a Roth. Legally. Tax-free. Forever.

MICRO REWARD 2: [Pexels: real estate depreciation tax deduction property] Fact 2: Real estate investors legally show a "loss" on paper while making real cash. It's called depreciation — the IRS lets you deduct a building's value over 27.5 years even as it appreciates. That loss offsets other income.

MICRO REWARD 3: [Pexels: health savings account hsa medical card] Fact 3: An HSA is the only triple-tax-free account in America. Contributions are pre-tax. Growth is tax-free. Withdrawals for medical are tax-free. After 65 it becomes a second IRA.

ESCALATION: [Pexels: 1031 exchange real estate investor property] Facts 4 and 5: 1031 exchanges let real estate investors roll unlimited gains into new properties, forever deferring taxes. And qualified opportunity zone funds let you erase capital gains entirely if you hold 10 years.

PAYOFF: [Pexels: wealth financial planning advisor desk documents] None of this is secret. It's just never taught in school. The wealthy use every single one. Save this so you know the rules of a game you're already in.`,
  },
  {
    id: 'mon-02',
    slot: 0,
    emoji: '📈',
    label: '📈 Finance',
    category: 'Personal Finance',
    title: '5 money traps keeping you broke',
    hook: '5 money habits that feel completely normal — but are silently making you poorer every single month.',
    description: 'The four financial traps most people are already in without realizing it.',
    badge: 'Hot',
    viralScore: 92,
    duration: 45,
    vertical: 'money',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: empty wallet broke person stress money] 5 money habits that feel completely normal — but are silently making you poorer every single month.

MICRO REWARD 1: [Pexels: subscription services streaming phone apps] Trap 1: Subscription creep. The average American pays $219/month in subscriptions they forgot they have. That's $2,628 a year — or $52,000 over 20 years at 7% invested. Log into your bank statement right now.

MICRO REWARD 2: [Pexels: car loan monthly payment dealership] Trap 2: Car payments. A $600/month car payment for 6 years costs $43,200. Invest that same $600/month in the S&P 500 for 6 years and you have $54,000. The car drops to $0. The investment doesn't.

MICRO REWARD 3: [Pexels: credit card interest debt minimum payment] Trap 3: Minimum payments. Paying minimums on $10,000 of credit card debt at 24% APR takes 27 years and costs $16,000 in interest. You pay for the debt twice.

ESCALATION: [Pexels: lifestyle inflation spending raise salary] Traps 4 and 5: Lifestyle inflation — spending every raise before it compounds. And buying depreciating assets — furniture, electronics, clothes — with money that could be compounding at 10% a year.

PAYOFF: [Pexels: financial freedom debt free person smiling] None of these feel like traps. That's what makes them lethal. Check your subscriptions, kill the car payment, attack the card. Save this — your bank doesn't want you to see it.`,
  },
  {
    id: 'mon-03',
    slot: 0,
    emoji: '📈',
    label: '📈 Finance',
    category: 'Investing',
    title: "$200 a month makes you a millionaire — here's the math",
    hook: "$200 a month. That's all it takes. But start after 30 and you pay an $850,000 penalty.",
    description: 'The exact compound interest math that turns small monthly investments into seven figures.',
    badge: 'High Retention',
    viralScore: 91,
    duration: 45,
    vertical: 'money',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: two hundred dollars monthly investment savings] $200 a month. That's it. That's all it takes. But start after 30 and you pay an $850,000 penalty. Here's the math.

MICRO REWARD 1: [Pexels: compound interest chart growth exponential] Start at 20, invest $200/month in an S&P 500 index fund averaging 10% annually. By 65 you have $1,480,000. You contributed $108,000. The market added $1,372,000. That's compound interest.

MICRO REWARD 2: [Pexels: age 30 calendar late start investing] Wait until 30 to start. Same $200/month, same 10% return. By 65: $630,000. You contributed $84,000. You earned $546,000. You made less than half — because you waited 10 years. That's the $850,000 penalty.

MICRO REWARD 3: [Pexels: index fund vanguard sp500 investment screen] Wait until 40: $227,000 at 65. The math is brutal. Every decade you delay cuts your final number by roughly 60%. Time is the actual investment. $200 is just the ticket.

ESCALATION: [Pexels: dollar cost averaging monthly investment automatic] The strategy: automate $200 every month into a low-cost index fund. Don't watch it. Don't touch it. Vanguard VOO. Fidelity FZROX. Zero thinking required after setup.

PAYOFF: [Pexels: millionaire retirement financial freedom beach] You don't need to be rich to start. You need to start to be rich. $200. This month. The market opens Monday. Save this and show someone who still has time.`,
  },
  {
    id: 'mon-04',
    slot: 0,
    emoji: '📈',
    label: '📈 Finance',
    category: 'Consumer Psychology',
    title: 'The hidden psychology behind expensive brands',
    hook: "You don't buy a $1,500 handbag for the leather. You buy it for what your brain thinks it signals.",
    description: 'The psychological triggers luxury brands use to make you pay 40x the production cost.',
    badge: 'Trending',
    viralScore: 85,
    duration: 45,
    vertical: 'money',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: luxury handbag designer store display] You don't buy a $1,500 handbag for the leather. You buy it for what your brain thinks it signals about you. Here's the science.

MICRO REWARD 1: [Pexels: louis vuitton hermes luxury brand store] A Louis Vuitton bag costs $50 to manufacture. It sells for $2,000. That $1,950 isn't leather — it's identity. Luxury brands sell belonging to a group that's designed to feel exclusive. Your brain pays for the membership, not the material.

MICRO REWARD 2: [Pexels: scarcity limited edition luxury product] The scarcity trigger: Hermes intentionally makes you wait years for a Birkin bag. The wait doesn't reflect production limits — it's engineered. Scarcity makes your brain assign higher value. The more you can't have it, the more you want it.

MICRO REWARD 3: [Pexels: social status signaling psychology behavior] The signaling loop: a 2022 Harvard study found luxury buyers report feeling more confident after purchase — but the effect lasts only 72 hours before baseline returns. So they buy again. That's not fashion. That's a dopamine cycle.

ESCALATION: [Pexels: price anchoring expensive menu restaurant] Anchoring: luxury brands display the $10,000 version first so the $2,000 version feels like a deal. Your brain doesn't compare to production cost. It compares to the anchor they set.

PAYOFF: [Pexels: person smart financial decision no logo minimalist] Knowing this doesn't stop the feeling. But it lets you ask: am I buying the bag or buying the signal? Two different purchases. One of them compounds. Save this before your next checkout.`,
  },

  // ── AI ───────────────────────────────────────────────────────────────────
  {
    id: 'ai-01',
    slot: 0,
    emoji: '🤖',
    label: '🤖 AI',
    category: 'AI & Jobs',
    title: 'The AI tool replacing 10 jobs right now',
    hook: "One AI tool launched in 2024 is already replacing entire teams. Most people still haven't heard of it.",
    description: 'Five specific job categories already being replaced by AI tools available today.',
    badge: 'Hot',
    viralScore: 95,
    duration: 45,
    vertical: 'ai',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: ai robot computer screen technology] One AI tool launched in 2024 is already replacing entire departments. Most people still haven't heard its name.

MICRO REWARD 1: [Pexels: legal documents lawyer paralegal office] Job 1: Paralegals. Harvey AI reviews 10,000 legal documents in 4 hours — a task that took 6 paralegals 3 weeks. Allen & Overy, one of the world's biggest law firms, already deployed it. 30 paralegal roles eliminated.

MICRO REWARD 2: [Pexels: customer service call center headset] Job 2: Customer service. Klarna's AI assistant handles 2.3 million conversations per month — the equivalent of 700 full-time agents. Response time dropped from 11 minutes to 2 minutes. 700 jobs. Gone.

MICRO REWARD 3: [Pexels: coding software developer laptop programming] Job 3: Junior developers. GitHub Copilot now writes 46% of all code on its platform. Companies are hiring 30% fewer junior devs. The ones being hired know how to use AI. The others are being passed over.

ESCALATION: [Pexels: radiologist medical imaging xray ai diagnosis] Jobs 4 and 5: Radiologists — Google's AI detects lung cancer with 94.4% accuracy vs 88% for human radiologists. And financial analysts — JPMorgan's COiN AI reviews 12,000 credit agreements per year in seconds. That task used 360,000 human hours.

PAYOFF: [Pexels: ai tools learn adapt future work skills] This isn't coming. It's here. The question isn't whether AI takes your job — it's whether you're using AI to make yourself irreplaceable. Save this. Learn the tools before someone else does.`,
  },
  {
    id: 'ai-02',
    slot: 0,
    emoji: '🤖',
    label: '🤖 AI',
    category: 'Tech Secrets',
    title: "How Google knows what you'll search before you type it",
    hook: "Google predicts your next search before you finish typing — and the way it does it is unsettling.",
    description: 'The predictive technology behind autocomplete and what it reveals about human behavior.',
    badge: 'High Retention',
    viralScore: 89,
    duration: 45,
    vertical: 'ai',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: google search bar typing phone screen] Google predicts your next search before you finish typing your first word — and the way it does it is genuinely unsettling.

MICRO REWARD 1: [Pexels: search algorithm machine learning data center] It's not magic — it's a transformer model trained on 8.5 billion daily searches. Google's autocomplete system processes your 3 typed characters against real-time query patterns from everyone else searching right now, in your language, in your country.

MICRO REWARD 2: [Pexels: location data phone gps tracking map] It also knows where you are, what time it is, what you searched last week, what device you're on, and what results you clicked. The autocomplete isn't guessing — it's profiling. It knows what YOU specifically will want next.

MICRO REWARD 3: [Pexels: behavioral data user profile privacy] A 2023 MIT study found Google can predict your next search with 73% accuracy after just 2 weeks of observing your patterns. After 6 months: 89%. Your searches are so predictable, an algorithm knows you better than your friends.

ESCALATION: [Pexels: data privacy filter bubble information control] The darker layer: Google's autocomplete also shapes what you search. By surfacing certain completions, it steers queries. The EU fined Google 2.4 billion euros for using autocomplete to manipulate shopping results. It's not just prediction — it's suggestion.

PAYOFF: [Pexels: person thinking independently no phone digital] Google doesn't just answer your questions. It learns to answer them before you ask — and occasionally decides what you'll ask next. Save this. Then search something unexpected just to keep it guessing.`,
  },
  {
    id: 'ai-03',
    slot: 0,
    emoji: '🤖',
    label: '🤖 AI',
    category: 'Future Tech',
    title: 'The future technology nobody is ready for',
    hook: 'In 5 years, this technology will change daily life more than smartphones did. Almost nobody is preparing.',
    description: 'Brain-computer interfaces, humanoid robots, and AI doctors — the three techs arriving faster than expected.',
    badge: 'Viral',
    viralScore: 93,
    duration: 45,
    vertical: 'ai',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: futuristic technology brain computer interface] In 5 years, three technologies will change daily life more than smartphones did. Almost nobody is preparing for any of them.

MICRO REWARD 1: [Pexels: neuralink brain implant neuroscience] Technology 1: Brain-computer interfaces. Neuralink's first patient, Noland Arbaugh, controls a computer cursor and plays chess with his thoughts alone. The 2025 roadmap includes restoring vision and controlling prosthetic limbs. The lag between thought and action: 40 milliseconds.

MICRO REWARD 2: [Pexels: humanoid robot boston dynamics figure ai] Technology 2: Humanoid robots. Figure 01 and Tesla Optimus can now fold laundry, sort packages, and navigate stairs at human speed. BMW already has humanoid robots on factory floors. By 2027, Morgan Stanley estimates 1 million humanoid robots in the workforce.

MICRO REWARD 3: [Pexels: ai doctor diagnosis medical scan treatment] Technology 3: AI doctors. Google's MedPaLM 2 scores 85% on US medical licensing exams — above the passing threshold. Hospitals in India and Africa are already using it for primary diagnosis where there aren't enough doctors.

ESCALATION: [Pexels: technology convergence ai robot brain future] The convergence: these three don't arrive separately. A brain-computer interface controlling a humanoid robot diagnosed by an AI doctor is a single system. That system exists in labs right now. The timeline to consumer deployment: 2027–2030.

PAYOFF: [Pexels: person adapting learning future technology] The people who understand what's coming before it arrives are the ones who build the companies, take the jobs, and make the money. Save this. The window to prepare is still open — barely.`,
  },
  {
    id: 'ai-04',
    slot: 0,
    emoji: '🤖',
    label: '🤖 AI',
    category: 'Future of Work',
    title: '5 jobs that will not exist in 10 years',
    hook: 'These 5 professions will be 90% automated by 2035 — and millions of people are still training for them.',
    description: 'The exact jobs most at risk from AI and what the data says about the timeline.',
    badge: 'Trending',
    viralScore: 90,
    duration: 45,
    vertical: 'ai',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: office worker desk computer job employment] These 5 professions will be 90% automated by 2035. Millions of people are still in school training for them right now.

MICRO REWARD 1: [Pexels: data entry spreadsheet typing office] Job 1: Data entry clerks. 3.3 million in the US. AI can process 10,000 rows per minute with 99.9% accuracy vs 95% human accuracy at 200 rows per hour. McKinsey: 97% automation probability by 2030. Already happening.

MICRO REWARD 2: [Pexels: travel agent booking tour operator desk] Job 2: Travel agents. AI booking tools like Kayak's AI planner and Google Travel already build complete itineraries, compare 400 flight options, and flag price drops automatically. Industry employment down 43% since 2019.

MICRO REWARD 3: [Pexels: cashier retail checkout grocery store] Job 3: Cashiers. Amazon Go has 50 fully cashierless stores. Walmart is deploying 1,000 autonomous checkout lanes. Standard Cognition's AI camera system works in any existing store without hardware changes. 3.5 million cashier jobs in the US. Gone by 2032.

ESCALATION: [Pexels: loan officer bank financial advisor desk] Jobs 4 and 5: Loan officers — AI credit scoring is already 31% more accurate than humans at predicting default, and processes applications in 11 seconds vs 2 weeks. And telemarketers — AI voice agents close at 22% higher rates with zero rejection sensitivity.

PAYOFF: [Pexels: skills future proof career pivot learning] This isn't fear — it's a map. The professions most protected: those requiring physical presence, emotional intelligence, or creative judgment. Save this and figure out which side of the line you're on.`,
  },

  // ── PSYCHOLOGY ───────────────────────────────────────────────────────────
  {
    id: 'psy-01',
    slot: 0,
    emoji: '🧠',
    label: '🧠 Psychology',
    category: 'Brain Science',
    title: '5 brain tricks you fall for every day',
    hook: "Your brain makes 35,000 decisions a day — and it cheats on most of them. Here's how.",
    description: 'Three cognitive biases running silently in your brain right now, shaping every decision you make.',
    badge: 'Viral',
    viralScore: 96,
    duration: 45,
    vertical: 'psychology',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: human brain neuroscience mind thinking] Your brain makes 35,000 decisions every day — and it cheats on most of them. Here are 5 tricks it's running on you right now.

MICRO REWARD 1: [Pexels: anchoring price tag shopping retail] Trick 1: Anchoring. You see a jacket "on sale" from $400 to $180. You feel like you saved $220. But the original price was invented to make $180 feel cheap. Your brain anchors to the first number it sees — always.

MICRO REWARD 2: [Pexels: confirmation bias social media news feed] Trick 2: Confirmation bias. You believe something — your brain searches for evidence it's true and dismisses contradictions. A 2019 Yale study found people with higher IQs are MORE susceptible — smarter brains rationalize better.

MICRO REWARD 3: [Pexels: loss aversion fear losing money wallet] Trick 3: Loss aversion. Losing $50 feels twice as bad as gaining $50 feels good. That asymmetry makes people hold losing stocks, stay in bad relationships, and avoid necessary risks. Nobel Prize winner Daniel Kahneman proved this in 1979. Still happening.

ESCALATION: [Pexels: availability bias news media fear statistics] Tricks 4 and 5: Availability bias — you overestimate risks you've recently seen. Plane crashes feel more dangerous than car trips because they're on TV. And the Dunning-Kruger effect — the less you know, the more confident you feel. Peak confidence hits at minimal knowledge.

PAYOFF: [Pexels: self aware person thinking clearly mindful] Your brain isn't broken. It's running shortcuts built for survival — not spreadsheets. Knowing the tricks doesn't make you immune. But it gives you a half-second to catch yourself. Save this.`,
  },
  {
    id: 'psy-02',
    slot: 0,
    emoji: '🧠',
    label: '🧠 Psychology',
    category: 'Memory Science',
    title: 'Why you remember bad memories more than good ones',
    hook: "Your brain stores negative memories with 3x the detail of positive ones — and it's doing it on purpose.",
    description: 'The evolutionary reason your brain is wired for negativity bias and how to rewire it.',
    badge: 'High Retention',
    viralScore: 88,
    duration: 45,
    vertical: 'psychology',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: sad memory painful recall person thinking alone] Your brain stores bad memories with 3 times more detail than good ones — and it's doing it completely on purpose.

MICRO REWARD 1: [Pexels: amygdala brain memory stress cortisol] The mechanism: your amygdala tags emotional experiences. Negative events trigger cortisol and adrenaline — stress hormones that act like a highlighter on memory storage. A bad breakup gets encoded in high resolution. A good Tuesday gets filed in low-res and lost.

MICRO REWARD 2: [Pexels: survival instinct prehistoric human danger] The reason: for 300,000 years, forgetting where the tiger was would kill you. Forgetting a good berry bush wouldn't. Evolution built your brain to overweight bad outcomes because the cost of ignoring them was death. That system is still running. In your 2025 brain.

MICRO REWARD 3: [Pexels: negativity bias news media problem solving] The consequence: you replay embarrassing moments from 2009. You catastrophize future scenarios that never happen. A single harsh comment erases 10 compliments. Not weakness — ancient programming. A 2021 Cambridge study found people recall negative events from 7x further back than equivalent positive ones.

ESCALATION: [Pexels: rewire brain neuroplasticity habits positive] The rewire: neuroplasticity research shows you can counteract negativity bias by deliberately savoring positive experiences for 20+ seconds. The brain re-encodes the memory with more emotional weight. It's called positive neuroplasticity training. Rick Hanson at UC Berkeley has studied it for 20 years.

PAYOFF: [Pexels: person peaceful mindful meditation sunrise] Your brain isn't pessimistic. It's old. The hardware is prehistoric. The rewiring is your job. Save this — especially if a bad memory is already trying to interrupt you reading this.`,
  },
  {
    id: 'psy-03',
    slot: 0,
    emoji: '🧠',
    label: '🧠 Psychology',
    category: 'Digital Psychology',
    title: "The dark side of social media your brain can't resist",
    hook: "Social media isn't addictive by accident. It was engineered — using the same psychology as slot machines.",
    description: 'The exact dopamine loop social platforms exploit and the three design tricks keeping you scrolling.',
    badge: 'Hot',
    viralScore: 94,
    duration: 45,
    vertical: 'psychology',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: social media phone scrolling addiction screen] Social media isn't addictive by accident. It was engineered — using the exact same psychology as Las Vegas slot machines.

MICRO REWARD 1: [Pexels: dopamine reward brain like notification] The mechanism: variable reward. Slot machines pay out unpredictably — and that unpredictability is what makes them addictive. Your Instagram feed works identically. Sometimes you scroll and find something great. Most times, nothing. That uncertainty is the hook. B.F. Skinner proved this in 1957 with pigeons. Meta's designers read the same research.

MICRO REWARD 2: [Pexels: infinite scroll design ux phone swipe] Design trick 2: Infinite scroll. Sean Parker, Facebook's first president, said publicly: "We gave you a little dopamine hit every once in a while because someone liked or commented on a photo. It's a social validation feedback loop." Infinite scroll removes the natural stopping point your brain needs to disengage.

MICRO REWARD 3: [Pexels: notification red badge alert phone] Design trick 3: Notification red dots. They're red deliberately. Red triggers urgency in the human brain — a survival-coded color. Instagram engineers tested multiple notification colors and found red produced the highest re-engagement rate. You're not picking up your phone. You're responding to a trigger.

ESCALATION: [Pexels: teen mental health anxiety social media study] The data: average person checks their phone 96 times per day. TikTok's average session length is 95 minutes. A 2023 Stanford study found 16-24 year olds show dopamine pathway changes identical to gambling addiction after 6 months of daily use.

PAYOFF: [Pexels: person putting phone down intentional screen time] The platforms aren't evil. They're optimized. But optimized for engagement, not your wellbeing. Knowing the tricks doesn't make you immune — but it makes the pull visible. Save this. Then put your phone down for 10 minutes, just to prove you can.`,
  },

  // ── MYSTERY ──────────────────────────────────────────────────────────────
  {
    id: 'mys-01',
    slot: 0,
    emoji: '🔮',
    label: '🔮 Mystery',
    category: 'Cold Cases',
    title: 'The disappearance nobody solved in 70 years',
    hook: '3 people vanished without a trace — and the evidence left behind is more disturbing than the disappearance.',
    description: 'Three real unsolved disappearances with evidence so strange no explanation has ever fit.',
    badge: 'Viral',
    viralScore: 95,
    duration: 45,
    vertical: 'mystery',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: dark forest missing person mystery disappearance] 3 people vanished without a trace. The evidence left behind is more disturbing than the disappearance itself — and none of it has ever been explained.

MICRO REWARD 1: [Pexels: abandoned camp campfire wilderness cold case] Case 1: The Yuba County Five, 1978. Five young men drove to a basketball game in Sacramento. Their car was found 70 miles in the opposite direction, deep in the Plumas National Forest. The engine was running. Their food was untouched. Three were later found — but their bodies showed no injury and their deaths were ruled exposure. They'd walked miles in the wrong direction in freezing temperatures with no explanation why.

MICRO REWARD 2: [Pexels: plane cockpit aviation mystery ocean] Case 2: Frederick Valentich, 1978. An Australian pilot radioed air traffic control to report a metallic object with a green light hovering above his plane at 5,000 feet. His last words: "It's hovering and it's not an aircraft." Then 17 seconds of metallic scraping sounds. Then silence. No wreckage was ever found. The official finding: "Unknown reason."

MICRO REWARD 3: [Pexels: hotel crime scene mystery unexplained] Case 3: Elisa Lam, 2013. Disappeared from the Cecil Hotel in Los Angeles. Found weeks later in a rooftop water tank accessible only through a locked, alarmed door that required a key to open from inside. Hotel CCTV showed her behaving inexplicably in an elevator — pressing every button, hiding in corners, gesturing at something in the hallway. The door alarm was never triggered. The coroner ruled accidental drowning.

ESCALATION: [Pexels: cold case detective evidence board files] The pattern across all three: evidence that eliminates every logical explanation. No motive. No witnesses. No physical trail. Just people — and then no people. And evidence that creates more questions than it answers.

PAYOFF: [Pexels: mystery unsolved question dark night] The most disturbing thing about these cases isn't that we don't know what happened. It's that every explanation requires ignoring at least one piece of evidence. Save this if you think you can solve what the FBI couldn't.`,
  },
  {
    id: 'mys-02',
    slot: 0,
    emoji: '🔮',
    label: '🔮 Mystery',
    category: 'Unsolved History',
    title: 'What really happened at Dyatlov Pass',
    hook: "9 experienced hikers died in the Soviet mountains in 1959. The official explanation is still 'unknown force.'",
    description: "The Soviet cold case with injuries so impossible every theory fails to explain all nine facts.",
    badge: 'High Retention',
    viralScore: 91,
    duration: 45,
    vertical: 'mystery',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: snowy mountain night cold russia urals] In 1959, 9 experienced Soviet hikers died on a mountain in the Ural range. The official Russian investigation concluded the cause was — and I quote — "an unknown compelling force."

MICRO REWARD 1: [Pexels: tent cut from inside wilderness snow] The tent was cut open from the inside. Not outside. All 9 hikers fled in temperatures of -30 degrees Celsius wearing only underwear or socks. They left voluntarily and then died of hypothermia within 500 meters. Nothing outside the tent has ever explained why all 9 left simultaneously in the dark.

MICRO REWARD 2: [Pexels: forensic injury autopsy evidence trauma] Three of the bodies showed injuries consistent with a car crash — fractured ribs, a crushed skull — but no external bruising. The Soviet pathologist wrote the force required was "beyond human capability." Two of the bodies had their eyes and tongues removed, with no bleeding — indicating removal after death by something precise.

MICRO REWARD 3: [Pexels: radiation geiger counter contamination measurement] All 9 bodies showed elevated radiation levels when found weeks later. The Soviet government classified all case files and locked the region for 3 years. When asked why, the official answer was "military testing." When pressed for specifics: silence. The files stayed classified until 2019.

ESCALATION: [Pexels: infrasound avalanche secret military weapons test] Modern theories: infrasound from wind causing mass panic. A military weapons test gone wrong. Ball lightning. An avalanche that produced no avalanche debris. Every single theory explains some of the facts. None explains all nine.

PAYOFF: [Pexels: mystery snow mountain night cold wind] 65 years later, 9 people are still dead and nobody has a single theory that explains everything. The Russian government's 2019 reinvestigation concluded: avalanche. The lead investigator was asked about the missing eyes and tongue. He changed the subject. Save this.`,
  },
  {
    id: 'mys-03',
    slot: 0,
    emoji: '🔮',
    label: '🔮 Mystery',
    category: 'Declassified',
    title: '3 government secrets declassified in the last 10 years',
    hook: "These 3 government programs were classified for 50 years — and what's in them is stranger than fiction.",
    description: 'Real CIA, FBI, and DOD programs that turned out to be exactly what conspiracy theorists said.',
    badge: 'Trending',
    viralScore: 89,
    duration: 45,
    vertical: 'mystery',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: classified government documents top secret stamp] These 3 government programs were classified for 50 years. What's inside them is stranger than anything conspiracy theorists claimed.

MICRO REWARD 1: [Pexels: cia mkultra experiments mind control documents] Program 1: MKUltra. Declassified by the CIA in 1977 after a FOIA request. The US government ran illegal mind control experiments on American citizens from 1953 to 1973. LSD administered without consent. Sleep deprivation. Electroshock. 150 sub-projects across 80 institutions including Harvard. The CIA director ordered all documents destroyed in 1973. 20,000 survived by accident in a budget filing.

MICRO REWARD 2: [Pexels: pentagon ufo uap classified military report] Program 2: AATIP — the Advanced Aerospace Threat Identification Program. Congress declassified it in 2017. The Pentagon had a secret $22 million program studying unidentified aerial phenomena since 2007. In 2023, a Pentagon whistleblower testified under oath that the US government has recovered "non-human intelligence" and "non-human biologics." That testimony is in the official Congressional record.

MICRO REWARD 3: [Pexels: nsa surveillance phone data collection] Program 3: PRISM. Edward Snowden leaked it in 2013. The NSA was collecting metadata on every phone call made in the United States — legally, under a secret interpretation of the Patriot Act that no judge had ever reviewed publicly. The FISA Court ruled in 2020 that the program was illegal. It had run for 7 years.

ESCALATION: [Pexels: conspiracy theory truth revealed documents] The pattern: each program was dismissed as conspiracy theory for years. Each was confirmed true by official government documents. The uncomfortable question isn't what they classified — it's what's still classified.

PAYOFF: [Pexels: freedom of information act documents sunlight] The most dangerous conspiracy theories are the ones that turned out to be accurate. Save this. Then ask what's still 50 years from being declassified.`,
  },

  // ── HISTORY ──────────────────────────────────────────────────────────────
  {
    id: 'his-01',
    slot: 0,
    emoji: '🏛️',
    label: '🏛️ History',
    category: 'World History',
    title: 'Why ancient Rome collapsed in 5 steps',
    hook: 'Rome took 500 years to build and 50 years to collapse — and the same 5 warning signs are visible today.',
    description: 'The exact sequence of economic, political, and military failures that ended the Roman Empire.',
    badge: 'High Retention',
    viralScore: 90,
    duration: 45,
    vertical: 'history',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: ancient rome colosseum ruins history] Rome took 500 years to build and 50 years to collapse. The same 5 warning signs that destroyed it are visible right now.

MICRO REWARD 1: [Pexels: currency debasement inflation ancient coins roman] Step 1: Currency debasement. In 200 AD a Roman silver coin was 85% silver. By 270 AD it was 2%. The emperors kept cutting silver content to pay armies. Prices rose. Trust collapsed. Sound familiar?

MICRO REWARD 2: [Pexels: political division senate rome government] Step 2: Political paralysis. In Rome's final 100 years, 37 emperors were crowned. 25 were assassinated by their own armies. The political class spent more energy destroying each other than governing. Laws became weapons. Institutions became pawns.

MICRO REWARD 3: [Pexels: military overextension border defense soldiers] Step 3: Military overextension. Rome's border stretched 10,000 miles. Defending it cost 80% of the imperial budget. When money ran out, Rome hired Germanic mercenaries to guard the border. By 410 AD, those mercenaries were the ones sacking Rome.

ESCALATION: [Pexels: wealth inequality rich poor roman society] Steps 4 and 5: Wealth concentration so extreme that 1% of Romans owned 16% of all land — and stopped paying taxes through legal exemptions. And civic disengagement — by 400 AD, Roman citizens had stopped participating in governance. They'd stopped caring. The barbarians didn't end Rome. Apathy did.

PAYOFF: [Pexels: history lesson modern civilization warning] Every empire that collapsed did so with these 5 steps in order. Not always at the same speed. But always in the same sequence. History doesn't repeat — but it rhymes with terrifying precision. Save this.`,
  },
  {
    id: 'his-02',
    slot: 0,
    emoji: '🏛️',
    label: '🏛️ History',
    category: 'Ancient History',
    title: '5 ancient inventions way ahead of their time',
    hook: 'The ancient world had computers, batteries, and steam engines — then lost them for 1,500 years.',
    description: 'Five real technologies from the ancient world that were only rediscovered centuries later.',
    badge: 'Viral',
    viralScore: 92,
    duration: 45,
    vertical: 'history',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: ancient artifact museum history relic] The ancient world had computers, batteries, and steam engines — then lost them for 1,500 years. Here are 5 inventions that broke history's timeline.

MICRO REWARD 1: [Pexels: antikythera mechanism ancient greek gears museum] Invention 1: The Antikythera Mechanism, 100 BC. A bronze device recovered from a Greek shipwreck with 37 interlocking gears that calculated the positions of the sun, moon, and 5 planets — predicted eclipses — and modeled a 19-year astronomical cycle. Scientists in 2021 finally reconstructed how it worked. The next device of comparable mechanical complexity didn't appear until 1,400 years later.

MICRO REWARD 2: [Pexels: baghdad battery ancient electricity jar copper] Invention 2: The Baghdad Battery, 250 BC. Clay jars found in Iraq containing copper cylinders, iron rods, and acidic residue. When replicated with grape juice as the electrolyte, they produce 1.1 volts of electricity. Archaeologists have no consensus on what it powered. The next documented battery: Alessandro Volta in 1800 AD. Gap: 2,050 years.

MICRO REWARD 3: [Pexels: roman concrete underwater ancient architecture] Invention 3: Roman concrete. The Pantheon's dome — poured in 128 AD — is still the world's largest unreinforced concrete dome. In 2023, MIT discovered Roman concrete actually gets stronger underwater over time due to a self-healing mineral reaction. We still can't fully replicate the formula.

ESCALATION: [Pexels: steam engine ancient hero alexandria aeolipile] Inventions 4 and 5: Hero of Alexandria built a working steam engine in 70 AD — 1,700 years before the Industrial Revolution. And Greek fire, the Byzantine naval weapon that burned on water, destroyed Arab fleets from 672 to 718 AD — and whose chemical formula has never been identified despite 1,300 years of trying.

PAYOFF: [Pexels: ancient wisdom modern science history knowledge] The ancient world wasn't primitive. It was brilliant — and then catastrophically interrupted. Every one of these technologies was lost and had to be rediscovered. Save this. Imagine what else we're still waiting to find.`,
  },
  {
    id: 'his-03',
    slot: 0,
    emoji: '🏛️',
    label: '🏛️ History',
    category: 'Economic History',
    title: "The dark secret behind ancient Rome's wealth",
    hook: "Rome didn't get rich from trade. It ran on a system so efficient it lasted 400 years on one resource.",
    description: "How Roman military economics, slave labor math, and infrastructure spending built the ancient world's richest empire.",
    badge: 'Trending',
    viralScore: 86,
    duration: 45,
    vertical: 'history',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: ancient rome wealth gold treasure empire] Rome didn't get rich from trade or agriculture. It ran on one resource so efficiently that it funded an empire for 400 years. And what that resource was is deeply uncomfortable.

MICRO REWARD 1: [Pexels: roman conquest military expansion soldiers battle] The engine: military conquest. Every campaign Rome won generated slaves — and slaves were the Roman economy. At Rome's peak, 35-40% of the entire Italian population was enslaved. 3 million people. After the conquest of Dacia in 106 AD, Trajan brought 500,000 slaves to Rome in a single campaign. The Colosseum was built with slave labor in 8 years.

MICRO REWARD 2: [Pexels: roman infrastructure roads aqueducts construction] What the wealth bought: 80,000 kilometers of paved roads — more than the US Interstate Highway System today. 11 major aqueducts delivering 1 million cubic meters of fresh water to Rome daily. Free grain for 200,000 Roman citizens. An economy of abundance built entirely on coerced labor.

MICRO REWARD 3: [Pexels: roman tax system tribute provinces wealth] The multiplier: conquered provinces paid tribute. Egypt alone sent 20% of its grain harvest to Rome every year for 400 years. Rome didn't produce food — it extracted it. Didn't manufacture goods — it confiscated them. The GDP of the Roman Empire at its peak: equivalent to 20-30% of global output. More than the US share today.

ESCALATION: [Pexels: collapse economic system dependence rome] The fatal dependency: when Rome stopped winning wars, the supply of slaves dried up. Land owners couldn't afford free workers. Agricultural output collapsed. The economy that had run on coercion for 400 years had no alternative. The wealth wasn't built — it was extracted. And extraction has a finite supply.

PAYOFF: [Pexels: history economic lesson modern society empire] Every empire in history has had a resource it depended on until it didn't. The question worth asking is always: what is ours? Save this.`,
  },

  // ── SCIENCE ──────────────────────────────────────────────────────────────
  {
    id: 'sci-01',
    slot: 0,
    emoji: '🔬',
    label: '🔬 Science',
    category: 'Mind-Blowing Science',
    title: '5 scientific facts that sound completely fake',
    hook: '5 science facts that will make people call you a liar — all verified by peer-reviewed research.',
    description: 'Oxford is older than the Aztecs, Venus days are longer than Venus years, and three more mind-benders.',
    badge: 'Viral',
    viralScore: 97,
    duration: 45,
    vertical: 'science',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: science laboratory microscope research facts] 5 science facts that will make everyone call you a liar — all verified by peer-reviewed research. Let's go.

MICRO REWARD 1: [Pexels: oxford university england medieval architecture] Fact 1: Oxford University is older than the Aztec Empire. Oxford began teaching in 1096. The Aztec Empire was founded in 1428. When Aztec priests were conducting human sacrifices, Oxford had already been teaching for 332 years. Your brain refuses this. It's true.

MICRO REWARD 2: [Pexels: venus planet solar system rotation orbit] Fact 2: A day on Venus is longer than a year on Venus. Venus rotates so slowly on its axis that it takes 243 Earth days to complete one rotation — but only 225 Earth days to orbit the sun. Venus's day is longer than its year. Also, it rotates backwards.

MICRO REWARD 3: [Pexels: cleopatra pyramid sphinx ancient egypt timeline] Fact 3: Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid. The pyramids were built around 2560 BC. Cleopatra was born in 69 BC. The Moon landing was 1969. Cleopatra is 2,491 years from the pyramids. She's 2,038 years from the Moon landing. We're closer to Cleopatra than she was to the pyramids.

ESCALATION: [Pexels: space universe atoms quantum physics particles] Facts 4 and 5: Atoms are 99.9999999% empty space — which means all matter, including you, is almost entirely nothing. And there are more possible iterations of a game of chess than there are atoms in the observable universe. The number of chess games: 10 to the power of 120. Atoms in the universe: 10 to the power of 82.

PAYOFF: [Pexels: person amazed wonder curiosity science learning] Reality is weirder than fiction — and it's been peer-reviewed. Save this and use it to win every argument at a dinner table for the rest of your life.`,
  },
  {
    id: 'sci-02',
    slot: 0,
    emoji: '🔬',
    label: '🔬 Science',
    category: 'Ocean Science',
    title: "The ocean mystery scientists still can't explain",
    hook: "We've mapped 95% of the ocean floor — and what's down there contradicts everything scientists expected.",
    description: "Three deep ocean discoveries that don't fit any existing biological or geological models.",
    badge: 'High Retention',
    viralScore: 91,
    duration: 45,
    vertical: 'science',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: ocean deep sea dark water mystery] We've mapped 95% of the ocean floor. And what's down there contradicts everything scientists thought they knew.

MICRO REWARD 1: [Pexels: hydrothermal vent deep sea creatures life] Discovery 1: Life without sunlight. In 1977, a submersible found hydrothermal vents at 2,500 meters depth where no sunlight reaches. What they found there broke biology: tube worms 2 meters long, shrimp with eyes on their backs, crabs that turn minerals into food. An entire ecosystem running on chemosynthesis — not photosynthesis. We didn't know this was possible. It rewrote the definition of life.

MICRO REWARD 2: [Pexels: underwater lake brine pool ocean floor] Discovery 2: Underwater lakes. The Gulf of Mexico seafloor contains liquid brine pools that sit on the ocean floor like lakes — with their own shorelines, waves, and currents. The brine is 5 times saltier and 4 times denser than surrounding seawater. Animals that fall in are immediately paralyzed. Scientists found mussels thriving on the shores. The ecosystem shouldn't exist.

MICRO REWARD 3: [Pexels: ocean sound anomaly deep sea recording bloop] Discovery 3: The Bloop. In 1997, NOAA underwater microphones detected a sound so loud it was heard across 5,000 kilometers of Pacific Ocean — louder than any known animal sound ever recorded. In 2012 NOAA attributed it to icequake activity. Former NOAA researchers dispute that explanation. The original signal has never been replicated or explained to the satisfaction of the scientific community.

ESCALATION: [Pexels: deep ocean submersible exploration unknown] The scale of the unknown: we've explored less than 20% of the ocean's volume. The Mariana Trench alone contains depths still unmapped. Every expedition returns with new species. In 2023 alone, 866 new marine species were discovered. The ocean is the largest unexplored territory on Earth — and it's on Earth.

PAYOFF: [Pexels: ocean surface beauty mystery depth unknown] We've spent more money mapping Mars than mapping Earth's ocean floor. Whatever's down there has been there for millions of years without us. Save this. The deep ocean makes space look familiar.`,
  },
  {
    id: 'sci-03',
    slot: 0,
    emoji: '🔬',
    label: '🔬 Science',
    category: 'Physics',
    title: "Why time moves slower when you're falling",
    hook: "Time literally moves slower for you when you're afraid — and Einstein's equations prove exactly why.",
    description: "The real physics of time dilation and why extreme fear compresses your brain's perception of time.",
    badge: 'Trending',
    viralScore: 87,
    duration: 45,
    vertical: 'science',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: person falling skydiving free fall fear] Time literally moves slower for you when you're falling — and Einstein's equations tell us exactly why. This is real physics.

MICRO REWARD 1: [Pexels: einstein relativity time dilation physics] Einstein's general relativity: gravity warps spacetime. The stronger the gravitational field, the slower time moves. This isn't metaphor — it's measurable. GPS satellites run 38 microseconds fast per day because they're further from Earth's gravity. If we didn't correct for this, GPS navigation would drift 10 kilometers per day. Time dilation is so real it's already in your phone.

MICRO REWARD 2: [Pexels: brain neuroscience adrenaline fear response slow motion] The subjective effect: when you're in extreme danger, your amygdala floods your system with adrenaline and triggers a hyper-encoding state. Your brain stores 10x more sensory data per second. When you replay the memory later, the density of detail makes the event feel longer than it was. A 3-second fall feels like 30 seconds — not because time slowed, but because you recorded 30 seconds of data.

MICRO REWARD 3: [Pexels: experiment free fall stopwatch reaction time test] David Eagleman at Baylor tested this with people falling backwards off a 50-foot platform. He gave them wrist displays showing rapidly flickering numbers — too fast for normal perception. Under extreme fear: participants could read the numbers. Their perceptual speed had measurably increased. Fear doesn't just feel like it slows time. It actually does — for your brain.

ESCALATION: [Pexels: time perception neuroscience brain clock subjective] The dual reality: physics says time is objective and dilates with gravity and speed. Neuroscience says time is subjective and dilates with fear and attention. Both are true simultaneously. You experience both kinds of time dilation in the same moment — one in your equations, one in your amygdala.

PAYOFF: [Pexels: person contemplating time existence universe] You are a biological clock running inside a relativistic universe. Your brain's time and the universe's time are different measurements of the same thing. Save this — it'll make the next time you're scared feel slightly less terrifying and slightly more fascinating.`,
  },

  // ── COUNTRY ──────────────────────────────────────────────────────────────
  {
    id: 'cou-01',
    slot: 0,
    emoji: '🌍',
    label: '🌍 Countries',
    category: 'World Laws',
    title: 'Countries that will arrest you for normal things',
    hook: 'These 3 countries will arrest you for things you did this morning.',
    description: "Singapore's gum ban, Bhutan's happiness tax, North Korea's photo law — rules with real consequences.",
    badge: 'Viral',
    viralScore: 94,
    duration: 45,
    vertical: 'country',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: world countries travel passport laws rules] These 3 countries will arrest you for things you did this morning. You probably didn't know any of these were crimes.

MICRO REWARD 1: [Pexels: singapore clean city law enforcement police] Singapore: Chewing gum. Illegal since 1992 — importing, selling, or possessing chewing gum carries a fine of up to $100,000 SGD or 2 years in prison. The law was passed after gum jammed the doors of Singapore's new MRT system, costing millions in repairs. The only gum legally permitted: nicotine gum, sold by pharmacists, with your name recorded. Jaywalking: $50 fine on the spot.

MICRO REWARD 2: [Pexels: north korea border control military rule] North Korea: Photographing anything without permission. Tourists are assigned government minders and photographing soldiers, poverty, or infrastructure can result in immediate detention. In 2016, American tourist Otto Warmbier was sentenced to 15 years hard labor for taking a propaganda poster. He died after being returned in a coma. The law against foreign media: mandatory.

MICRO REWARD 3: [Pexels: uae dubai hotel alcohol dress code beach] UAE: Being drunk in public — including in your hotel lobby or a taxi — carries up to 6 months in jail. Kissing in public: up to 1 year. Importing certain medications without pre-approval — including common antidepressants and ADHD medication — can result in 4 years in prison. Dubai has 15 million tourists per year. Most have no idea.

ESCALATION: [Pexels: bhutan tourism tax happiness visa entry] Bhutan charges a $200/day Sustainable Development Fee for every tourist — and limits total annual visitors. You can't visit independently. Every tourist requires a licensed guide. The entire country is optimized for Gross National Happiness, a government policy that prioritizes mental wellbeing over GDP. The fee funds free healthcare and education for all citizens.

PAYOFF: [Pexels: travel smart research country rules knowledge] Every country you enter is a different legal universe. What's a Tuesday for you is a crime somewhere else. Save this before your next international trip.`,
  },
  {
    id: 'cou-02',
    slot: 0,
    emoji: '🌍',
    label: '🌍 Countries',
    category: 'Extreme Places',
    title: 'K2 kills 1 in 4 climbers — here is why',
    hook: "Everest has a 1% death rate. K2 has 25%. Here's why the second-tallest mountain is actually the most lethal.",
    description: "The Bottleneck serac, impossible rescue altitude, and why winter K2 went unclimbed for 61 years.",
    badge: 'High Retention',
    viralScore: 92,
    duration: 45,
    vertical: 'country',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: k2 mountain pakistan karakoram dangerous peak] Everest has a 1% death rate. K2 has 25%. For every 4 people who reach the summit, 1 dies trying. Here's exactly why.

MICRO REWARD 1: [Pexels: bottleneck k2 serac ice cliff danger] The Bottleneck: a 45-degree ice chute 400 meters below the summit with a 300-meter serac — an ice cliff the size of a 30-story building — hanging directly above it. You must traverse it twice: once up, once down. In 2008, 11 climbers died in a single day when the serac collapsed and buried the fixed ropes they needed to descend. Survivors free-soloed down K2 in the dark. Three fell.

MICRO REWARD 2: [Pexels: altitude 8000 meters oxygen hypoxia exhaustion] The altitude: at 8,611 meters, you're in the death zone. Your body is dying faster than it can recover. Oxygen concentration is 33% of sea level. At that level, your brain starts producing hallucinations within 3 hours. Climbers describe seeing people who aren't there, hearing voices, making decisions they cannot explain afterward. Several K2 deaths involve climbers who simply sat down and refused to move.

MICRO REWARD 3: [Pexels: weather k2 wind storm pakistan mountain] The weather: K2 sits in the Karakoram range, which generates its own weather systems. A clear summit day can become a Category 5 wind event within 2 hours. Winds exceed 200 km/h. Rescues above 7,000 meters are impossible — no helicopter can fly that altitude. If you're hurt on K2, you die on K2.

ESCALATION: [Pexels: winter k2 summit first 2021 team] Winter K2: for 61 years, no human being stood on K2's summit in winter. Every attempt ended in retreat or death. In February 2021, a 10-person Nepalese team finally summited — the most dangerous climb in recorded history, in wind chill of -65 degrees Celsius. The leader wept on the summit. They all came back alive.

PAYOFF: [Pexels: mountaineer triumph summit achievement extreme] Everest is technically harder. K2 is actually harder. The mountain doesn't care how prepared you are. Save this — then look up the 2008 K2 disaster and understand why this mountain has its own mythology.`,
  },
  {
    id: 'cou-03',
    slot: 0,
    emoji: '🌍',
    label: '🌍 Countries',
    category: 'Economic Geography',
    title: 'Why Dubai became so rich so fast',
    hook: "In 1960, Dubai was a fishing village. In 2024, it has the world's tallest building and zero income tax.",
    description: 'The exact economic decisions made between 1971 and 2010 that transformed a desert into a global financial hub.',
    badge: 'Trending',
    viralScore: 88,
    duration: 45,
    vertical: 'country',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: dubai skyline burj khalifa modern city desert] In 1960, Dubai was a fishing village with no roads, no electricity, and no running water. In 2024, it has the world's tallest building and zero income tax. Here's exactly how.

MICRO REWARD 1: [Pexels: oil discovery uae desert 1966 wealth] The foundation: oil was discovered in Dubai in 1966. But Sheikh Rashid, Dubai's ruler, made one critical decision: he knew the oil would run out. So from day one, he used oil revenue to build infrastructure — not palaces. Roads, ports, airports. He was building a platform for commerce before commerce existed.

MICRO REWARD 2: [Pexels: dubai port jebel ali shipping trade] The bet: in 1979, Dubai built Jebel Ali Port — the largest man-made harbor in the world at the time — at massive cost, with no guaranteed customers. Within 10 years it became the busiest port in the Middle East. Dubai made itself the unavoidable logistics hub between Asia, Europe, and Africa. Geography plus infrastructure equals leverage.

MICRO REWARD 3: [Pexels: dubai free zone business tax 0 percent] The tax structure: in 1985, Dubai created free economic zones where foreign businesses pay zero corporate tax and can own 100% of their company — which was illegal everywhere else in the UAE. 35,000 companies registered in Jebel Ali Free Zone alone. Zero income tax. Zero capital gains tax. Money flowed in from Europe, Asia, and America simultaneously.

ESCALATION: [Pexels: dubai real estate construction boom tower] The real estate engine: after 9/11, Arab wealth that had been parked in US banks moved to Dubai overnight. $500 billion in foreign investment arrived in 3 years. The Burj Khalifa was conceived in 2003. Dubai's population grew from 800,000 in 2000 to 3.5 million by 2010. The entire modern city was built in 10 years.

PAYOFF: [Pexels: dubai future innovation technology wealth] Dubai ran out of oil in 2010. By then it didn't matter. 95% of GDP is non-oil. The fishing village became a global city not because of luck — but because of one ruler who spent oil money on infrastructure before anyone needed it. Save this.`,
  },

  // ── HEALTH ───────────────────────────────────────────────────────────────
  {
    id: 'hlt-01',
    slot: 0,
    emoji: '💪',
    label: '💪 Health',
    category: 'Biohacking',
    title: 'The sleep habit that doubles your focus',
    hook: "One 20-minute habit before sleep doubles next-day cognitive performance — and it's not what you think.",
    description: 'The neuroscience of memory consolidation used by military pilots and chess grandmasters.',
    badge: 'High Retention',
    viralScore: 89,
    duration: 45,
    vertical: 'health',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: sleep bedtime night routine rest pillow] One 20-minute habit before sleep doubles your next-day focus — and it has nothing to do with melatonin or blue light glasses.

MICRO REWARD 1: [Pexels: brain consolidation memory learning sleep neuroscience] The science: during the first 90 minutes of sleep, your hippocampus replays everything you learned that day — transferring it to long-term memory. A 2019 Harvard study found that what you do in the 20 minutes before sleep determines how much of the day's learning your brain consolidates. The window is real. And most people waste it on Netflix.

MICRO REWARD 2: [Pexels: reading book paper analog no screen evening] The habit: 20 minutes of focused review — not reading new material, but reviewing what you encountered that day. Notes. A work problem. A skill you're building. Chess grandmasters like Magnus Carlsen review games before bed. Military pilots mentally replay mission details. The act of intentional review signals the hippocampus: this is important. Encode it deeply.

MICRO REWARD 3: [Pexels: notebook journaling writing pen before bed] The mechanism: sleep spindles — bursts of brain activity during NREM sleep — fire more frequently for material you reviewed just before sleeping. A 2021 MIT study showed people who reviewed material 20 minutes before bed retained 40% more after 7 days than a control group who didn't. 40% more. From a 20-minute habit.

ESCALATION: [Pexels: cognitive performance focus sharpness productivity] The compounding effect: over 30 days, the reviewed group outperformed controls on cognitive tasks by 23%. The brain is most plastic and receptive immediately before sleep. Top performers have known this for decades. The rest of us are in the dark — literally.

PAYOFF: [Pexels: person waking up alert focused clear morning] Tonight: review 3 things you want to remember or improve. No phone. No TV. 20 minutes. Then sleep. Your brain will do the rest — if you give it something to work with. Save this and start tonight.`,
  },
  {
    id: 'hlt-02',
    slot: 0,
    emoji: '💪',
    label: '💪 Health',
    category: 'Brain Health',
    title: 'Why cold showers change your brain in 60 seconds',
    hook: "A 60-second cold shower triggers a neurochemical cascade your brain can't get from coffee.",
    description: 'The exact dopamine, norepinephrine, and cortisol changes a cold shower causes — and the protocol.',
    badge: 'Hot',
    viralScore: 91,
    duration: 45,
    vertical: 'health',
    prompt: `YouTube Short format, 9:16, 1 legend only

HOOK: [Pexels: cold shower water morning bathroom alert] A 60-second cold shower triggers a neurochemical cascade your brain cannot get from coffee. Here's exactly what's happening inside you.

MICRO REWARD 1: [Pexels: dopamine norepinephrine brain neuroscience chemicals] The immediate effect: cold water at 14 degrees Celsius or below triggers a 200-300% spike in norepinephrine — your focus and alertness neurotransmitter. That spike lasts 2-4 hours. Coffee gives you a 30% boost via caffeine blocking adenosine. Cold water gives you 300% via direct sympathetic nervous system activation. No crash. No tolerance buildup.

MICRO REWARD 2: [Pexels: dopamine reward system motivation cold plunge] The dopamine effect: a 2022 study from the University of Prague found cold water immersion produces a sustained dopamine increase of 250% that persists for 3-4 hours after the exposure — not during, but after. It's one of the only legal activities that produces a dopamine spike comparable in magnitude to cocaine — without the receptor downregulation. Your baseline doesn't drop. It rises.

MICRO REWARD 3: [Pexels: cortisol stress hormones regulation cold exposure] The cortisol paradox: cold exposure spikes cortisol briefly — then crashes it below baseline. The net effect: you feel calmer 30 minutes after a cold shower than before it. A 2021 Dutch study found cold shower practitioners reported 29% fewer sick days and significantly lower self-reported anxiety. The stress response training generalizes to life stress.

ESCALATION: [Pexels: andrew huberman neuroscience protocol research] The protocol: 60-90 seconds at the coldest setting your shower allows. Morning is optimal — aligns with natural cortisol peak. Don't warm up at the end. Exit cold. Your body generates heat internally, which activates brown fat thermogenesis — burning an additional 80-150 calories. Huberman Lab Protocol: 11 minutes per week total, split into sessions.

PAYOFF: [Pexels: person energized morning focus confidence shower] 60 seconds of discomfort. 4 hours of neurochemical advantage. The protocol is free. The equipment is already in your bathroom. Save this — then try it tomorrow morning and pay attention to what happens at 10am.`,
  },
]

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function getViralNowTopics(): ViralTopic[] {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const hourBlock = Math.floor(now.getUTCHours() / 4)
  const seed = parseInt(dateStr.replace(/-/g, ''), 10) + hourBlock * 7919
  const shuffled = seededShuffle([...VIRAL_TOPICS_POOL], seed)
  const picked: ViralTopic[] = []
  const usedVerticals = new Set<string>()
  for (const t of shuffled) {
    if (picked.length >= 6) break
    if (!usedVerticals.has(t.vertical)) { picked.push(t); usedVerticals.add(t.vertical) }
  }
  for (const t of shuffled) {
    if (picked.length >= 6) break
    if (!picked.includes(t)) picked.push(t)
  }
  return picked.slice(0, 6).map((t, i) => ({ ...t, slot: i + 1 }))
}

export function getNextRefreshMs(): number {
  const now = new Date()
  const msInHour = 3600000
  const blockMs = 4 * msInHour
  const msIntoCurrent = (now.getUTCHours() % 4) * msInHour + now.getUTCMinutes() * 60000 + now.getUTCSeconds() * 1000
  return blockMs - msIntoCurrent
}
