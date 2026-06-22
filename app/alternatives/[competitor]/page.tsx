// #482 — Comparison / "X alternative" SEO pages. Targets high-intent searches
// like "OpusClip alternative", "InVideo alternative for faceless creators", etc.
// Comparison pages convert ~15x a normal blog post because they catch buyers at
// the decision moment. Statically generated + in the sitemap + FAQ JSON-LD so
// Google AND AI answer engines (ChatGPT/Perplexity/AI Overviews) can cite us.
// Each page is honest (says when to pick the competitor) — buyers smell trashing.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-static'
export const dynamicParams = false

type Row = { feature: string; sfa: boolean | string; them: boolean | string }
type Competitor = {
  name: string
  h1: string
  intro: string
  theyDo: string
  pickThem: string
  rows: Row[]
  faq: { q: string; a: string }[]
}

// Feature claims are about the PRODUCT CATEGORY each tool is built for, kept
// honest and current as of June 2026. We only quote our own price ($11.90);
// competitor prices change, so we compare on what each tool fundamentally does.
const COMPETITORS: Record<string, Competitor> = {
  opusclip: {
    name: 'OpusClip',
    h1: 'The OpusClip Alternative That Builds the Whole Short From One Idea',
    intro:
      'OpusClip is great at one thing: chopping a long video you already filmed into clips. But if you don’t have footage — if you want a finished, faceless Short from just an idea — that’s a different tool. ShortsForgeAI writes the script, records the voiceover, finds the footage and renders a ready-to-post 9:16 Short in about 60 seconds. No upload, no camera, no editing.',
    theyDo: 'OpusClip repurposes long-form video you already have into short clips.',
    pickThem:
      'Pick OpusClip if you already record long videos or podcasts and just want them auto-clipped. Pick ShortsForgeAI if you want to create faceless Shorts from scratch without filming anything.',
    rows: [
      { feature: 'Creates the full video from just an idea', sfa: true, them: false },
      { feature: 'Needs you to upload existing footage', sfa: 'No', them: 'Yes' },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: false },
      { feature: 'Finds & matches the footage automatically', sfa: true, them: false },
      { feature: 'Fully faceless — no camera needed', sfa: true, them: 'Needs your video' },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $11.90/mo', them: 'Paid plans' },
    ],
    faq: [
      {
        q: 'Is there an OpusClip alternative that creates videos from scratch?',
        a: 'Yes. ShortsForgeAI generates a complete faceless Short — script, AI voiceover, footage and captions — from a single idea, with no video upload required. OpusClip instead repurposes long videos you already filmed.',
      },
      {
        q: 'Can I make faceless Shorts without filming anything?',
        a: 'Yes. ShortsForgeAI is built for faceless creators: you type a topic and get a finished vertical Short in about 60 seconds. You never appear on camera and never need source footage.',
      },
      {
        q: 'How much does ShortsForgeAI cost?',
        a: 'Plans start at $11.90/month, with a 7-day money-back guarantee. Your first Short is free, no credit card required.',
      },
    ],
  },
  invideo: {
    name: 'InVideo AI',
    h1: 'The InVideo AI Alternative Built Specifically for Faceless Shorts',
    intro:
      'InVideo AI is a powerful general-purpose video generator. ShortsForgeAI is narrower on purpose: it’s built only for faceless short-form (9:16) with a viral hook structure baked into every script. One idea in, a ready-to-post YouTube Short, TikTok or Reel out — script, voiceover, footage and captions done in about 60 seconds, starting at $11.90/mo.',
    theyDo: 'InVideo AI is a broad, general-purpose AI video maker for many formats.',
    pickThem:
      'Pick InVideo if you need long-form, horizontal, or many different video formats from one tool. Pick ShortsForgeAI if your whole game is posting faceless Shorts daily and you want them optimized for retention out of the box.',
    rows: [
      { feature: 'Creates the full video from just an idea', sfa: true, them: true },
      { feature: 'Purpose-built for faceless 9:16 Shorts', sfa: true, them: 'General-purpose' },
      { feature: 'Viral hook structure baked into the script', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: true },
      { feature: 'Finds & matches the footage automatically', sfa: true, them: true },
      { feature: 'One-tap, no timeline to learn', sfa: true, them: 'Editor-style' },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $11.90/mo', them: 'Paid plans' },
    ],
    faq: [
      {
        q: 'What is the best InVideo alternative for faceless YouTube Shorts?',
        a: 'ShortsForgeAI is purpose-built for faceless short-form: it writes a hook-driven script, voices it, finds footage and renders a 9:16 Short from one idea in about 60 seconds, starting at $11.90/month.',
      },
      {
        q: 'Is ShortsForgeAI cheaper than InVideo?',
        a: 'ShortsForgeAI starts at $11.90/month with a free first Short and no credit card required. Competitor pricing changes over time, so check both, but ShortsForgeAI is designed as a low-cost, single-purpose Shorts tool.',
      },
      {
        q: 'Do I need editing skills?',
        a: 'No. There is no timeline to learn. You type an idea and get a finished, ready-to-post vertical video.',
      },
    ],
  },
  submagic: {
    name: 'Submagic',
    h1: 'The Submagic Alternative That Makes the Whole Video, Not Just the Captions',
    intro:
      'Submagic adds animated captions and B-roll to a video you already have. ShortsForgeAI makes the entire video for you — it writes the script, records the AI voiceover, finds the footage AND adds the captions, from a single idea, in about 60 seconds. If you don’t have a video to caption yet, this is the tool that creates one.',
    theyDo: 'Submagic adds captions and effects to videos you already recorded.',
    pickThem:
      'Pick Submagic if you already have finished videos and only need polished captions. Pick ShortsForgeAI if you need the whole faceless Short created from scratch.',
    rows: [
      { feature: 'Creates the full video from just an idea', sfa: true, them: false },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: false },
      { feature: 'Finds & matches the footage automatically', sfa: true, them: false },
      { feature: 'Auto-captions included', sfa: true, them: true },
      { feature: 'Fully faceless — no source video needed', sfa: true, them: 'Needs your video' },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $11.90/mo', them: 'Paid plans' },
    ],
    faq: [
      {
        q: 'Is there a Submagic alternative that also writes the script and voiceover?',
        a: 'Yes. ShortsForgeAI generates the entire Short — script, AI voiceover, footage and captions — from one idea. Submagic focuses on adding captions and B-roll to a video you already have.',
      },
      {
        q: 'Can I make a faceless Short if I have no footage at all?',
        a: 'Yes. You only need an idea. ShortsForgeAI writes, voices, sources footage and captions it automatically into a 9:16 video.',
      },
      {
        q: 'How fast is it?',
        a: 'About 60 seconds from idea to a downloadable, ready-to-post Short. Your first one is free.',
      },
    ],
  },
  heygen: {
    name: 'HeyGen',
    h1: 'The HeyGen Alternative for Truly Faceless Videos — No Avatar Needed',
    intro:
      'HeyGen is built around AI avatars and talking heads — there’s a face on screen. ShortsForgeAI is the opposite: it makes fully faceless Shorts with cinematic footage, AI voiceover and captions, from one idea, in about 60 seconds. No avatar to set up, no face on camera, starting at $11.90/mo.',
    theyDo: 'HeyGen creates AI-avatar / talking-head videos (a face on screen).',
    pickThem:
      'Pick HeyGen if you specifically want an on-screen AI presenter or spokesperson. Pick ShortsForgeAI if you want classic faceless Shorts — footage + voiceover + captions, no face at all.',
    rows: [
      { feature: 'Fully faceless (no avatar, no face)', sfa: true, them: false },
      { feature: 'Creates the full Short from just an idea', sfa: true, them: 'Script → avatar' },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: true },
      { feature: 'Cinematic B-roll footage matched per scene', sfa: true, them: 'Avatar-centric' },
      { feature: 'Built for YouTube Shorts / TikTok / Reels', sfa: true, them: true },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $11.90/mo', them: 'Paid plans' },
    ],
    faq: [
      {
        q: 'What is the best HeyGen alternative for faceless content?',
        a: 'ShortsForgeAI is built for fully faceless Shorts — cinematic footage, AI voiceover and captions from one idea, with no avatar and no face on screen. HeyGen is centered on AI avatars and talking heads.',
      },
      {
        q: 'Can I make videos without an AI avatar?',
        a: 'Yes. ShortsForgeAI never uses an on-screen presenter. It assembles real footage, voiceover and captions into a faceless 9:16 Short.',
      },
      {
        q: 'How much does it cost?',
        a: 'Plans start at $11.90/month with a 7-day money-back guarantee, and your first Short is free with no credit card.',
      },
    ],
  },
  pika: {
    name: 'Pika',
    h1: 'The Pika Alternative That Builds the Whole Faceless Short From One Idea',
    intro:
      'Pika is a generative AI video tool — you prompt it and it produces short, animated or cinematic clips (typically 5–10 seconds) from text or an image, with creative effects like morphing and motion control. It is built for generating individual scenes, not for assembling a complete, narrated, captioned short. ShortsForgeAI takes one idea and produces the entire faceless YouTube Short — script, AI voice, footage, and captions — in about 60 seconds.',
    theyDo: 'Pika focuses on generating short, eye-catching AI video clips and effects from a text or image prompt.',
    pickThem: 'Pick Pika when you want to generate a striking standalone AI clip or visual effect to drop into a larger edit; pick ShortsForgeAI when you want the whole faceless Short finished end to end.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: false },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'Adds AI voiceover (narration)', sfa: true, them: false },
      { feature: 'Auto-captions / subtitles', sfa: true, them: false },
      { feature: 'Generates short cinematic AI clips', sfa: true, them: true },
      { feature: 'Built for vertical YouTube Shorts output', sfa: true, them: 'Short clips only' },
      { feature: 'Finished video in ~60 seconds', sfa: true, them: 'Clips, then you edit' },
      { feature: 'Starting price', sfa: 'From $11.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Pika alternative for faceless YouTube Shorts?', a: 'ShortsForgeAI is the strongest Pika alternative for full faceless Shorts, because it does not just generate a clip — it writes the script, adds the AI voice, pulls the footage, and burns in captions to deliver a finished vertical Short in about 60 seconds.' },
      { q: 'Can Pika make a complete YouTube Short with voiceover and captions?', a: 'Not on its own — Pika generates short AI clips, and you would still need to add a script, narration, and captions yourself. ShortsForgeAI handles that entire pipeline automatically from a single idea.' },
      { q: 'Is ShortsForgeAI cheaper than Pika?', a: 'ShortsForgeAI starts at $11.90/mo and turns one idea into a complete faceless Short. Pika prices change, so check their site, but the bigger difference is scope: Pika gives you clips, ShortsForgeAI gives you the whole video.' },
    ],
  },
  fliki: {
    name: 'Fliki',
    h1: 'The Fliki Alternative That Turns One Idea Into a Finished Faceless Short',
    intro:
      'Fliki is a text-to-video platform with a huge AI voice library (2,500+ voices, 80+ languages) that turns scripts, blog posts, or prompts into videos with voiceover, stock visuals, and captions. It is powerful and multilingual, but it is built around a script you bring and an editor you work in. ShortsForgeAI is built for one thing — taking a single idea and producing a finished faceless YouTube Short, script and all, in about 60 seconds.',
    theyDo: 'Fliki turns scripts and blog posts into videos using the largest AI voice and language library in the category.',
    pickThem: 'Pick Fliki when you need many languages, voice cloning, or fine control over a script you already have; pick ShortsForgeAI when you want to go from raw idea to a finished Short with no scripting or editing.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: 'Needs your script' },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Pulls matching footage automatically', sfa: true, them: true },
      { feature: 'Huge multilingual voice library (80+ languages)', sfa: 'English-focused', them: true },
      { feature: 'Finished Short in ~60 seconds, no editor', sfa: true, them: 'Edit in timeline' },
      { feature: 'Starting price', sfa: 'From $11.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Fliki alternative for faceless YouTube Shorts?', a: 'ShortsForgeAI is a great Fliki alternative when you want a finished Short without writing the script yourself — it generates the script, AI voice, footage, and captions from a single idea in about 60 seconds.' },
      { q: 'Does ShortsForgeAI write the script like Fliki, or do I bring my own?', a: 'Fliki expects you to bring a script, blog post, or prompt to shape. ShortsForgeAI writes the script for you from just an idea, so you never start with a blank page.' },
      { q: 'Should I use Fliki or ShortsForgeAI for faceless content?', a: 'Choose Fliki if you need many languages, accents, or voice cloning. Choose ShortsForgeAI if you mainly publish English faceless Shorts and want the whole video built automatically for $11.90/mo.' },
    ],
  },
  revid: {
    name: 'Revid',
    h1: 'The Revid Alternative That Builds the Whole Faceless Short From One Idea',
    intro:
      'Revid.ai is a faceless-video platform that turns a script, prompt, or URL into a short with AI voice, captions, and B-roll, plus dozens of visual styles and templates. It is a close competitor in the faceless niche, but workflows tend to run longer and lean on you to paste in or guide the content. ShortsForgeAI is tuned to take one idea and deliver a finished faceless YouTube Short in about 60 seconds.',
    theyDo: 'Revid turns scripts, prompts, or URLs into faceless short and long-form videos with a large library of visual styles.',
    pickThem: 'Pick Revid if you want lots of visual-style presets and templates and do not mind a longer per-video workflow; pick ShortsForgeAI when speed from idea to finished Short matters most.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: true },
      { feature: 'Writes the script for you', sfa: true, them: 'Paste or guide it' },
      { feature: 'AI voiceover', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Matching footage / B-roll', sfa: true, them: true },
      { feature: 'Fully faceless output', sfa: true, them: true },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: 'Longer per video' },
      { feature: 'Starting price', sfa: 'From $11.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Revid alternative for faceless YouTube Shorts?', a: 'ShortsForgeAI is a strong Revid alternative when speed is the priority — it turns a single idea into a finished faceless Short (script, AI voice, footage, captions) in about 60 seconds, without pasting in a script or URL first.' },
      { q: 'Is ShortsForgeAI faster than Revid for making a Short?', a: 'For a single faceless Short, yes — ShortsForgeAI is built to deliver a finished video in roughly 60 seconds from one idea, while Revid workflows often take longer per video. Revid does offer more visual-style presets.' },
      { q: 'Revid vs ShortsForgeAI — which is better for a faceless channel?', a: 'Both make faceless Shorts. Pick Revid for its larger library of styles and templates; pick ShortsForgeAI for the fastest idea-to-finished-Short flow at $11.90/mo.' },
    ],
  },
  crayo: {
    name: 'Crayo',
    h1: 'The Crayo Alternative That Builds the Whole Faceless Short From One Idea',
    intro:
      'Crayo.ai is built for faceless short-form at scale, with polished niche templates like Reddit-story, fake-texts, and split-screen, turning a prompt or YouTube link into a clip with voiceover, subtitles, and music. It shines for those specific viral formats. ShortsForgeAI is broader and idea-first: give it one idea and it writes the script and produces a finished faceless YouTube Short in about 60 seconds.',
    theyDo: 'Crayo specializes in high-volume faceless clips built around viral templates like Reddit-story, fake-texts, and split-screen.',
    pickThem: 'Pick Crayo if your channel lives on Reddit-story, fake-text, or split-screen formats; pick ShortsForgeAI when you want an idea turned into a complete, narrated faceless Short without picking a template.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: true },
      { feature: 'Writes the script for you', sfa: true, them: 'Prompt-based' },
      { feature: 'AI voiceover', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Matching footage / B-roll', sfa: true, them: 'Template-driven' },
      { feature: 'Reddit-story / fake-text / split-screen templates', sfa: false, them: true },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $11.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Crayo alternative for faceless YouTube Shorts?', a: 'ShortsForgeAI is a solid Crayo alternative when you want narrated, footage-driven Shorts from a single idea rather than template-driven formats — it writes the script, adds AI voice and footage, and captions it in about 60 seconds.' },
      { q: 'Crayo vs ShortsForgeAI — which should I use?', a: 'Use Crayo if your channel relies on Reddit-story, fake-texts, or split-screen templates. Use ShortsForgeAI if you want any idea turned into a complete faceless Short without choosing a template.' },
      { q: 'Does ShortsForgeAI do faceless Shorts like Crayo?', a: 'Yes — ShortsForgeAI produces fully faceless Shorts with AI voice, footage, and captions, starting at $11.90/mo. The difference is approach: ShortsForgeAI is idea-first and footage-driven, Crayo is template-first.' },
    ],
  },
  capcut: {
    name: 'CapCut',
    h1: 'The CapCut Alternative That Builds the Whole Faceless Short Automatically',
    intro:
      'CapCut is a full video editor with templates, effects, auto-captions, AI avatars, and a growing set of AI generation tools — incredibly capable, but it is fundamentally a hands-on editor where you assemble and refine the video. ShortsForgeAI removes the editing entirely: from one idea it generates the script, AI voice, footage, and captions and hands you a finished faceless YouTube Short in about 60 seconds.',
    theyDo: 'CapCut is a powerful template-and-timeline video editor with AI tools layered on top for manual short-form creation.',
    pickThem: 'Pick CapCut when you want full manual control to edit, polish, and customize every detail; pick ShortsForgeAI when you want a finished faceless Short with zero editing.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: false },
      { feature: 'Writes the script for you', sfa: true, them: 'AI assist, manual' },
      { feature: 'AI voiceover', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Pulls matching footage automatically', sfa: true, them: false },
      { feature: 'No timeline editing required', sfa: true, them: false },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: 'You edit it' },
      { feature: 'Starting price', sfa: 'From $11.90/mo', them: 'Free + paid plans' },
    ],
    faq: [
      { q: 'What is the best CapCut alternative for faceless YouTube Shorts?', a: 'ShortsForgeAI is the best CapCut alternative for hands-off faceless Shorts — instead of editing in a timeline, you give it one idea and it returns a finished Short with script, AI voice, footage, and captions in about 60 seconds.' },
      { q: 'Can CapCut make a faceless Short automatically like ShortsForgeAI?', a: 'CapCut has AI tools, but it is still an editor — you assemble and refine the video yourself. ShortsForgeAI builds the entire faceless Short for you from a single idea, with no editing.' },
      { q: 'Should I use CapCut or ShortsForgeAI?', a: 'Use CapCut when you want full manual control and detailed editing (and its free tier). Use ShortsForgeAI when you want speed and automation — a complete faceless Short from one idea for $11.90/mo.' },
    ],
  },
}

export const COMPETITOR_SLUGS = Object.keys(COMPETITORS)

export function generateStaticParams() {
  return COMPETITOR_SLUGS.map((competitor) => ({ competitor }))
}

export function generateMetadata({ params }: { params: { competitor: string } }): Metadata {
  const c = COMPETITORS[params.competitor]
  if (!c) return {}
  const title = `${c.name} Alternative for Faceless Creators — ShortsForgeAI`
  const description = `Looking for a ${c.name} alternative? ShortsForgeAI turns one idea into a finished faceless YouTube Short — script, voiceover, footage & captions — in ~60s. From $11.90/mo, first Short free.`
  const url = `https://www.shortsforgeai.com/alternatives/${params.competitor}`
  return {
    metadataBase: new URL('https://www.shortsforgeai.com'),
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const CARD = { background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <span style={{ color: '#10B981', fontWeight: 900 }}>✓</span>
  if (v === false) return <span style={{ color: '#64748B', fontWeight: 900 }}>—</span>
  return <span style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>{v}</span>
}

export default function AlternativePage({ params }: { params: { competitor: string } }) {
  const c = COMPETITORS[params.competitor]
  if (!c) notFound()

  const signupUrl = `/signup?utm_source=seo&utm_medium=alternative&utm_campaign=${params.competitor}`

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0A0A0B', color: '#F1F5F9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 18px 64px' }}>
        <Link href="/" style={{ color: '#22D3EE', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>
          ⚡ ShortsForgeAI
        </Link>

        {/* Hero */}
        <section style={{ marginTop: 36, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#22D3EE', background: 'rgba(34,211,238,0.1)', borderRadius: 999, padding: '6px 14px' }}>
            {c.name} alternative
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.15, margin: '16px 0 0' }}>
            {c.h1}
          </h1>
          <p style={{ fontSize: '1.02rem', color: '#CBD5E1', lineHeight: 1.6, margin: '16px auto 0', maxWidth: 660 }}>
            {c.intro}
          </p>
          <Link
            href={signupUrl}
            style={{ display: 'inline-block', marginTop: 22, background: 'linear-gradient(135deg,#22D3EE,#10B981)', color: '#0A0A0B', fontWeight: 900, padding: '15px 32px', borderRadius: 14, textDecoration: 'none', fontSize: '1.05rem' }}
          >
            Try ShortsForgeAI free →
          </Link>
          <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '10px 0 0' }}>
            First Short free · no credit card · from <b style={{ color: '#22D3EE' }}>$11.90/mo</b>
          </p>
        </section>

        {/* Comparison table */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>
            ShortsForgeAI vs {c.name}
          </h2>
          <div style={{ ...CARD, borderRadius: 16, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, color: '#94A3B8' }}>Feature</th>
                  <th style={{ textAlign: 'center', padding: '12px 10px', fontWeight: 900, color: '#22D3EE' }}>ShortsForgeAI</th>
                  <th style={{ textAlign: 'center', padding: '12px 10px', fontWeight: 700, color: '#CBD5E1' }}>{c.name}</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r, i) => (
                  <tr key={r.feature} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: i % 2 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '11px 14px', color: '#E2E8F0' }}>{r.feature}</td>
                    <td style={{ padding: '11px 10px', textAlign: 'center' }}><Cell v={r.sfa} /></td>
                    <td style={{ padding: '11px 10px', textAlign: 'center' }}><Cell v={r.them} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.74rem', color: '#64748B', textAlign: 'center', margin: '10px 0 0' }}>
            Comparison reflects each tool’s core product focus as publicly described (June 2026); features and pricing may change.
          </p>
        </section>

        {/* Honest "pick them" */}
        <section style={{ marginTop: 40, ...CARD, borderRadius: 16, padding: '20px 22px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: '0 0 8px' }}>Which one should you pick?</h2>
          <p style={{ margin: 0, color: '#CBD5E1', lineHeight: 1.6, fontSize: '0.95rem' }}>{c.pickThem}</p>
        </section>

        {/* How it works */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>How ShortsForgeAI works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { n: '1', t: 'Type one idea', d: 'A topic, a fact, a hook — one sentence is enough.' },
              { n: '2', t: 'AI builds the Short', d: 'Script, AI voiceover, captions and matched footage, assembled automatically.' },
              { n: '3', t: 'Download & post', d: 'A vertical 9:16 MP4 in ~60s, ready for YouTube Shorts, TikTok and Reels.' },
            ].map((s) => (
              <div key={s.n} style={{ ...CARD, borderRadius: 14, padding: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(34,211,238,0.12)', color: '#22D3EE', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{s.n}</div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{s.t}</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94A3B8', lineHeight: 1.5 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ marginTop: 44 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>Questions, answered</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {c.faq.map((f) => (
              <div key={f.q} style={{ ...CARD, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontWeight: 800, marginBottom: 6, fontSize: '0.95rem' }}>{f.q}</div>
                <p style={{ margin: 0, color: '#94A3B8', lineHeight: 1.6, fontSize: '0.9rem' }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ marginTop: 44, textAlign: 'center', ...CARD, borderRadius: 18, padding: '28px 20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Make your first faceless Short free</h2>
          <p style={{ color: '#CBD5E1', margin: '8px 0 18px', fontSize: '0.95rem' }}>One idea in, a ready-to-post Short out. No editing, no credit card.</p>
          <Link
            href={signupUrl}
            style={{ display: 'inline-block', background: '#22D3EE', color: '#0A0A0B', fontWeight: 900, padding: '14px 30px', borderRadius: 12, textDecoration: 'none', fontSize: '1.02rem' }}
          >
            Start free →
          </Link>
        </section>

        {/* Cross-links */}
        <nav style={{ marginTop: 40, textAlign: 'center', fontSize: '0.8rem', color: '#64748B' }}>
          <span>Other comparisons: </span>
          {COMPETITOR_SLUGS.filter((s) => s !== params.competitor).map((s, i) => (
            <span key={s}>
              {i > 0 && ' · '}
              <Link href={`/alternatives/${s}`} style={{ color: '#94A3B8', textDecoration: 'none' }}>{COMPETITORS[s].name}</Link>
            </span>
          ))}
        </nav>
      </div>
    </main>
  )
}
