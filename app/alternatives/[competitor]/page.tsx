// #482 — Comparison / "X alternative" SEO pages. Targets high-intent searches
// like "OpusClip alternative", "InVideo alternative for faceless creators", etc.
// Comparison pages convert ~15x a normal blog post because they catch buyers at
// the decision moment. Statically generated + in the sitemap + FAQ JSON-LD so
// Google AND AI answer engines (ChatGPT/Perplexity/AI Overviews) can cite us.
// Each page is honest (says when to pick the competitor) — buyers smell trashing.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StickyFreeShortCTA from '@/components/StickyFreeShortCTA'
import Footer from '@/components/Footer'
import OrganicCtaLink from '@/components/OrganicCtaLink'

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
// honest and current as of June 2026. We only quote our own price ($9.90);
// competitor prices change, so we compare on what each tool fundamentally does.
export const COMPETITORS: Record<string, Competitor> = {
  opusclip: {
    name: 'OpusClip',
    h1: 'The OpusClip Alternative That Builds the Whole Short From One Idea',
    intro:
      'OpusClip is great at one thing: chopping a long video you already filmed into clips. But if you don’t have footage — if you want a finished, faceless Short from just an idea — that’s a different tool. Kineo writes the script, records the voiceover, finds the footage and renders a ready-to-post 9:16 Short in about 60 seconds. No upload, no camera, no editing.',
    theyDo: 'OpusClip repurposes long-form video you already have into short clips.',
    pickThem:
      'Pick OpusClip if you already record long videos or podcasts and just want them auto-clipped. Pick Kineo if you want to create faceless Shorts from scratch without filming anything.',
    rows: [
      { feature: 'Creates the full video from just an idea', sfa: true, them: false },
      { feature: 'Needs you to upload existing footage', sfa: 'No', them: 'Yes' },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: false },
      { feature: 'Finds & matches the footage automatically', sfa: true, them: false },
      { feature: 'Fully faceless — no camera needed', sfa: true, them: 'Needs your video' },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      {
        q: 'Is there an OpusClip alternative that creates videos from scratch?',
        a: 'Yes. Kineo generates a complete faceless Short — script, AI voiceover, footage and captions — from a single idea, with no video upload required. OpusClip instead repurposes long videos you already filmed.',
      },
      {
        q: 'Can I make faceless Shorts without filming anything?',
        a: 'Yes. Kineo is built for faceless creators: you type a topic and get a finished vertical Short in about 60 seconds. You never appear on camera and never need source footage.',
      },
      {
        q: 'How much does Kineo cost?',
        a: 'Starter is $4.90 for the first month and then $9.90/month, with a 7-day money-back guarantee. A new account can create up to 3 watermarked Fast videos every 24 hours with no card.',
      },
    ],
  },
  invideo: {
    name: 'InVideo AI',
    h1: 'The InVideo AI Alternative Built Specifically for Faceless Shorts',
    intro:
      'InVideo AI is a powerful general-purpose video generator. Kineo is narrower on purpose: it’s built only for faceless short-form (9:16) with a viral hook structure baked into every script. One idea in, a ready-to-post YouTube Short, TikTok or Reel out — script, voiceover, footage and captions done in about 60 seconds, starting at $9.90/mo.',
    theyDo: 'InVideo AI is a broad, general-purpose AI video maker for many formats.',
    pickThem:
      'Pick InVideo if you need long-form, horizontal, or many different video formats from one tool. Pick Kineo if your whole game is posting faceless Shorts daily and you want them optimized for retention out of the box.',
    rows: [
      { feature: 'Creates the full video from just an idea', sfa: true, them: true },
      { feature: 'Purpose-built for faceless 9:16 Shorts', sfa: true, them: 'General-purpose' },
      { feature: 'Viral hook structure baked into the script', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: true },
      { feature: 'Finds & matches the footage automatically', sfa: true, them: true },
      { feature: 'One-tap, no timeline to learn', sfa: true, them: 'Editor-style' },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      {
        q: 'What is the best InVideo alternative for faceless YouTube Shorts?',
        a: 'Kineo is purpose-built for faceless short-form: it writes a hook-driven script, voices it, finds footage and renders a 9:16 Short from one idea in about 60 seconds, starting at $9.90/month.',
      },
      {
        q: 'Is Kineo cheaper than InVideo?',
        a: 'Kineo Starter is $4.90 for the first month and then $9.90/month. A new account can create up to 3 watermarked Fast videos every 24 hours with no card. Competitor pricing changes over time, so check both.',
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
      'Submagic adds animated captions and B-roll to a video you already have. Kineo makes the entire video for you — it writes the script, records the AI voiceover, finds the footage AND adds the captions, from a single idea, in about 60 seconds. If you don’t have a video to caption yet, this is the tool that creates one.',
    theyDo: 'Submagic adds captions and effects to videos you already recorded.',
    pickThem:
      'Pick Submagic if you already have finished videos and only need polished captions. Pick Kineo if you need the whole faceless Short created from scratch.',
    rows: [
      { feature: 'Creates the full video from just an idea', sfa: true, them: false },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: false },
      { feature: 'Finds & matches the footage automatically', sfa: true, them: false },
      { feature: 'Auto-captions included', sfa: true, them: true },
      { feature: 'Fully faceless — no source video needed', sfa: true, them: 'Needs your video' },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      {
        q: 'Is there a Submagic alternative that also writes the script and voiceover?',
        a: 'Yes. Kineo generates the entire Short — script, AI voiceover, footage and captions — from one idea. Submagic focuses on adding captions and B-roll to a video you already have.',
      },
      {
        q: 'Can I make a faceless Short if I have no footage at all?',
        a: 'Yes. You only need an idea. Kineo writes, voices, sources footage and captions it automatically into a 9:16 video.',
      },
      {
        q: 'How fast is it?',
        a: 'About 60 seconds from idea to a downloadable, ready-to-post Short. Your first one is free.',
      },
    ],
  },
  // KINEO-SEO-COMPARE-2026-07-11 — REPOSICIONADA: desde o AI Presenter
  // (10/07) o Kineo TEM avatar falante; a página antiga dizia o contrário e
  // subvendia. Novo ângulo: "the presenter AND the finished video, cheaper".
  heygen: {
    name: 'HeyGen',
    h1: 'The HeyGen Alternative That Delivers the Presenter AND the Finished Short',
    intro:
      'HeyGen gives you a talking avatar clip. Kineo gives you the talking AI Presenter — one photo + your script, studio-grade lip-sync — PLUS the whole Short built around it: viral script, AI scenes or your own footage, captions and your own voice. Lock one character and keep the exact same face in every video. From $9.90/mo where HeyGen starts around $29.',
    theyDo: 'HeyGen creates AI-avatar / talking-head clips and enterprise avatar video workflows.',
    pickThem:
      'Pick HeyGen if you need enterprise avatar libraries, translation at scale or corporate workflows. Pick Kineo if you are a creator shipping Shorts daily and want the presenter, script, scenes and captions to come out of ONE prompt — at creator pricing.',
    rows: [
      { feature: 'Talking AI presenter with lip-sync (photo + script)', sfa: true, them: true },
      { feature: 'Creates the FULL Short from just an idea', sfa: true, them: 'Avatar clip only' },
      { feature: 'Same face across every video (Character Lock)', sfa: true, them: 'Custom avatar' },
      { feature: 'Use your own footage as scenes', sfa: true, them: false },
      { feature: 'Use your own voice (upload or clone)', sfa: 'Both', them: 'Clone' },
      { feature: 'Transparent gesture clips (WebM alpha) for courses/slides', sfa: true, them: false },
      { feature: 'Viral-structure scripts (hook → payoff) built-in', sfa: true, them: false },
      { feature: 'Also does fully faceless Shorts (no avatar at all)', sfa: true, them: false },
      { feature: 'Starting price', sfa: '$4.90 first month · then $9.90/mo', them: '$29/mo+' },
    ],
    faq: [
      {
        q: 'What is the best HeyGen alternative for YouTube Shorts creators?',
        a: 'Kineo — it has a talking AI Presenter with studio lip-sync like HeyGen, but it also writes the viral script, generates the scenes (or uses your footage), adds captions and can narrate in your cloned voice. You get the finished 9:16 Short, not just an avatar clip, from $9.90/mo.',
      },
      {
        q: 'Does Kineo have an AI avatar like HeyGen?',
        a: 'Yes. Kineo’s AI Presenter turns one photo + your script into a talking video with perfect lip-sync, and Character Lock keeps the exact same face across every video and thumbnail you make.',
      },
      {
        q: 'Is Kineo cheaper than HeyGen?',
        a: 'Yes — Kineo Starter is $4.90 for the first month and then $9.90/month (HeyGen starts around $29). A new account can create up to 3 watermarked Fast videos every 24 hours with no card.',
      },
    ],
  },
  pika: {
    name: 'Pika',
    h1: 'The Pika Alternative That Builds the Whole Faceless Short From One Idea',
    intro:
      'Pika is a generative AI video tool — you prompt it and it produces short, animated or cinematic clips (typically 5–10 seconds) from text or an image, with creative effects like morphing and motion control. It is built for generating individual scenes, not for assembling a complete, narrated, captioned short. Kineo takes one idea and produces the entire faceless YouTube Short — script, AI voice, footage, and captions — in about 60 seconds.',
    theyDo: 'Pika focuses on generating short, eye-catching AI video clips and effects from a text or image prompt.',
    pickThem: 'Pick Pika when you want to generate a striking standalone AI clip or visual effect to drop into a larger edit; pick Kineo when you want the whole faceless Short finished end to end.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: false },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'Adds AI voiceover (narration)', sfa: true, them: false },
      { feature: 'Auto-captions / subtitles', sfa: true, them: false },
      { feature: 'Generates short cinematic AI clips', sfa: true, them: true },
      { feature: 'Built for vertical YouTube Shorts output', sfa: true, them: 'Short clips only' },
      { feature: 'Finished video in ~60 seconds', sfa: true, them: 'Clips, then you edit' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Pika alternative for faceless YouTube Shorts?', a: 'Kineo is the strongest Pika alternative for full faceless Shorts, because it does not just generate a clip — it writes the script, adds the AI voice, pulls the footage, and burns in captions to deliver a finished vertical Short in about 60 seconds.' },
      { q: 'Can Pika make a complete YouTube Short with voiceover and captions?', a: 'Not on its own — Pika generates short AI clips, and you would still need to add a script, narration, and captions yourself. Kineo handles that entire pipeline automatically from a single idea.' },
      { q: 'Is Kineo cheaper than Pika?', a: 'Kineo starts at $9.90/mo and turns one idea into a complete faceless Short. Pika prices change, so check their site, but the bigger difference is scope: Pika gives you clips, Kineo gives you the whole video.' },
    ],
  },
  fliki: {
    name: 'Fliki',
    h1: 'The Fliki Alternative That Turns One Idea Into a Finished Faceless Short',
    intro:
      'Fliki is a text-to-video platform with a huge AI voice library (2,500+ voices, 80+ languages) that turns scripts, blog posts, or prompts into videos with voiceover, stock visuals, and captions. It is powerful and multilingual, but it is built around a script you bring and an editor you work in. Kineo is built for one thing — taking a single idea and producing a finished faceless YouTube Short, script and all, in about 60 seconds.',
    theyDo: 'Fliki turns scripts and blog posts into videos using the largest AI voice and language library in the category.',
    pickThem: 'Pick Fliki when you need many languages, voice cloning, or fine control over a script you already have; pick Kineo when you want to go from raw idea to a finished Short with no scripting or editing.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: 'Needs your script' },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Pulls matching footage automatically', sfa: true, them: true },
      { feature: 'Huge multilingual voice library (80+ languages)', sfa: 'English-focused', them: true },
      { feature: 'Finished Short in ~60 seconds, no editor', sfa: true, them: 'Edit in timeline' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Fliki alternative for faceless YouTube Shorts?', a: 'Kineo is a great Fliki alternative when you want a finished Short without writing the script yourself — it generates the script, AI voice, footage, and captions from a single idea in about 60 seconds.' },
      { q: 'Does Kineo write the script like Fliki, or do I bring my own?', a: 'Fliki expects you to bring a script, blog post, or prompt to shape. Kineo writes the script for you from just an idea, so you never start with a blank page.' },
      { q: 'Should I use Fliki or Kineo for faceless content?', a: 'Choose Fliki if you need many languages, accents, or voice cloning. Choose Kineo if you mainly publish English faceless Shorts and want the whole video built automatically for $9.90/mo.' },
    ],
  },
  revid: {
    name: 'Revid',
    h1: 'The Revid Alternative That Builds the Whole Faceless Short From One Idea',
    intro:
      'Revid.ai is a faceless-video platform that turns a script, prompt, or URL into a short with AI voice, captions, and B-roll, plus dozens of visual styles and templates. It is a close competitor in the faceless niche, but workflows tend to run longer and lean on you to paste in or guide the content. Kineo is tuned to take one idea and deliver a finished faceless YouTube Short in about 60 seconds.',
    theyDo: 'Revid turns scripts, prompts, or URLs into faceless short and long-form videos with a large library of visual styles.',
    pickThem: 'Pick Revid if you want lots of visual-style presets and templates and do not mind a longer per-video workflow; pick Kineo when speed from idea to finished Short matters most.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: true },
      { feature: 'Writes the script for you', sfa: true, them: 'Paste or guide it' },
      { feature: 'AI voiceover', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Matching footage / B-roll', sfa: true, them: true },
      { feature: 'Fully faceless output', sfa: true, them: true },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: 'Longer per video' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Revid alternative for faceless YouTube Shorts?', a: 'Kineo is a strong Revid alternative when speed is the priority — it turns a single idea into a finished faceless Short (script, AI voice, footage, captions) in about 60 seconds, without pasting in a script or URL first.' },
      { q: 'Is Kineo faster than Revid for making a Short?', a: 'For a single faceless Short, yes — Kineo is built to deliver a finished video in roughly 60 seconds from one idea, while Revid workflows often take longer per video. Revid does offer more visual-style presets.' },
      { q: 'Revid vs Kineo — which is better for a faceless channel?', a: 'Both make faceless Shorts. Pick Revid for its larger library of styles and templates; pick Kineo for the fastest idea-to-finished-Short flow at $9.90/mo.' },
    ],
  },
  crayo: {
    name: 'Crayo',
    h1: 'The Crayo Alternative That Builds the Whole Faceless Short From One Idea',
    intro:
      'Crayo.ai is built for faceless short-form at scale, with polished niche templates like Reddit-story, fake-texts, and split-screen, turning a prompt or YouTube link into a clip with voiceover, subtitles, and music. It shines for those specific viral formats. Kineo is broader and idea-first: give it one idea and it writes the script and produces a finished faceless YouTube Short in about 60 seconds.',
    theyDo: 'Crayo specializes in high-volume faceless clips built around viral templates like Reddit-story, fake-texts, and split-screen.',
    pickThem: 'Pick Crayo if your channel lives on Reddit-story, fake-text, or split-screen formats; pick Kineo when you want an idea turned into a complete, narrated faceless Short without picking a template.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: true },
      { feature: 'Writes the script for you', sfa: true, them: 'Prompt-based' },
      { feature: 'AI voiceover', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Matching footage / B-roll', sfa: true, them: 'Template-driven' },
      { feature: 'Reddit-story / fake-text / split-screen templates', sfa: false, them: true },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Crayo alternative for faceless YouTube Shorts?', a: 'Kineo is a solid Crayo alternative when you want narrated, footage-driven Shorts from a single idea rather than template-driven formats — it writes the script, adds AI voice and footage, and captions it in about 60 seconds.' },
      { q: 'Crayo vs Kineo — which should I use?', a: 'Use Crayo if your channel relies on Reddit-story, fake-texts, or split-screen templates. Use Kineo if you want any idea turned into a complete faceless Short without choosing a template.' },
      { q: 'Does Kineo do faceless Shorts like Crayo?', a: 'Yes — Kineo produces fully faceless Shorts with AI voice, footage, and captions, starting at $9.90/mo. The difference is approach: Kineo is idea-first and footage-driven, Crayo is template-first.' },
    ],
  },
  autoshorts: {
    name: 'AutoShorts',
    h1: 'The AutoShorts Alternative With Better Scripts — and Real Proof',
    intro:
      'AutoShorts also generates faceless videos on autopilot. Kineo focuses on a viral hook structure (hook → micro-rewards → payoff) and matches footage to each line — from one idea, in about 60 seconds. Starter is $4.90 for the first month and then $9.90/month, with a 7-day money-back guarantee; free access includes up to 3 watermarked Fast videos every 24 hours with no card.',
    theyDo: 'AutoShorts auto-generates and can auto-post faceless videos on a schedule.',
    pickThem:
      'Pick AutoShorts if hands-off scheduled auto-posting is all you want. Pick Kineo if you care about the script and footage actually being good — and want it cheaper.',
    rows: [
      { feature: 'Creates the full video from just an idea', sfa: true, them: true },
      { feature: 'Viral hook structure baked into the script', sfa: true, them: false },
      { feature: 'Footage matched per script line (not generic stock)', sfa: true, them: 'Often static' },
      { feature: 'AI voiceover included', sfa: true, them: true },
      { feature: 'Auto-captions included', sfa: true, them: true },
      { feature: 'Fully faceless — no footage needed', sfa: true, them: true },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'Is there a cheaper AutoShorts alternative with hook-first scripts?', a: 'Kineo Starter is $4.90 for the first month and then $9.90/month. It builds each Short around a hook structure with footage matched to the narration. Free access includes up to 3 watermarked Fast videos every 24 hours with no card.' },
      { q: 'Why do AI faceless videos sometimes get no views?', a: 'Usually the script and footage. A faceless Short lives or dies on the hook and the first 2 seconds. Kineo writes a hook-first script and matches specific footage per line, which is what holds retention.' },
      { q: 'Can I try it before paying?', a: 'Yes. A new account can create up to 3 watermarked Fast videos every 24 hours with no card, and paid plans include a 7-day money-back guarantee.' },
    ],
  },
  klap: {
    name: 'Klap',
    h1: 'The Klap Alternative That Creates the Short From Scratch',
    intro:
      'Klap turns a long video you already have into short clips. Kineo starts from the opposite end: you give it a topic and it writes the script, records the voiceover, finds the footage and captions it into a finished 9:16 Short — no source video, no camera — in about 60 seconds from $9.90/mo.',
    theyDo: 'Klap repurposes existing long-form video into short vertical clips.',
    pickThem:
      'Pick Klap if you already film long videos and just want them auto-clipped. Pick Kineo if you want faceless Shorts created from just an idea.',
    rows: [
      { feature: 'Creates the full video from just an idea', sfa: true, them: false },
      { feature: 'Needs you to upload existing footage', sfa: 'No', them: 'Yes' },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: false },
      { feature: 'Finds & matches the footage automatically', sfa: true, them: false },
      { feature: 'Fully faceless — no camera needed', sfa: true, them: 'Needs your video' },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'Is there a Klap alternative that builds the video from scratch?', a: 'Yes. Kineo generates a complete faceless Short — script, AI voiceover, footage and captions — from one idea, with no video upload. Klap instead clips long videos you already filmed.' },
      { q: 'Can I make faceless Shorts without any footage?', a: 'Yes. You only need a topic. Kineo writes, voices, sources footage and captions it into a 9:16 video automatically.' },
      { q: 'How much does it cost?', a: 'Starter is $4.90 for the first month and then $9.90/month, with a 7-day money-back guarantee. Free access includes up to 3 watermarked Fast videos every 24 hours with no card.' },
    ],
  },
  quso: {
    name: 'Quso',
    h1: 'The Quso Alternative Built to Generate Shorts, Not Just Repurpose Them',
    intro:
      'Quso (formerly Vidyo.ai) repurposes long videos into clips and schedules them. Kineo is for creators who start with nothing but a topic: it writes the hook-driven script, records the AI voiceover, finds matching footage and captions it into a ready-to-post 9:16 Short in about 60 seconds, starting at $9.90/mo.',
    theyDo: 'Quso repurposes and schedules clips from long-form videos you already have.',
    pickThem:
      'Pick Quso if you already have long videos to clip and schedule. Pick Kineo if you want a finished faceless Short generated from a single idea.',
    rows: [
      { feature: 'Creates the full video from just an idea', sfa: true, them: false },
      { feature: 'Needs you to upload existing footage', sfa: 'No', them: 'Yes' },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'Viral hook structure baked into the script', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: 'Limited' },
      { feature: 'Fully faceless — no source video needed', sfa: true, them: 'Needs your video' },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is a good Quso (Vidyo.ai) alternative for faceless Shorts?', a: 'Kineo is purpose-built for faceless short-form: it writes a hook-driven script, voices it, finds footage and renders a 9:16 Short from one idea in about 60 seconds, from $9.90/month.' },
      { q: 'Does it work without uploading a video?', a: 'Yes. You type a topic and get a finished vertical Short — no source footage, no camera.' },
      { q: 'Can I use Kineo without paying?', a: 'Yes. A new account can create up to 3 watermarked Fast videos every 24 hours with no card, and paid plans include a 7-day money-back guarantee.' },
    ],
  },
  capcut: {
    name: 'CapCut',
    h1: 'The CapCut Alternative That Builds the Whole Faceless Short Automatically',
    intro:
      'CapCut is a full video editor with templates, effects, auto-captions, AI avatars, and a growing set of AI generation tools — incredibly capable, but it is fundamentally a hands-on editor where you assemble and refine the video. Kineo removes the editing entirely: from one idea it generates the script, AI voice, footage, and captions and hands you a finished faceless YouTube Short in about 60 seconds.',
    theyDo: 'CapCut is a powerful template-and-timeline video editor with AI tools layered on top for manual short-form creation.',
    pickThem: 'Pick CapCut when you want full manual control to edit, polish, and customize every detail; pick Kineo when you want a finished faceless Short with zero editing.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: false },
      { feature: 'Writes the script for you', sfa: true, them: 'AI assist, manual' },
      { feature: 'AI voiceover', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Pulls matching footage automatically', sfa: true, them: false },
      { feature: 'No timeline editing required', sfa: true, them: false },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: 'You edit it' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Free + paid plans' },
    ],
    faq: [
      { q: 'What is the best CapCut alternative for faceless YouTube Shorts?', a: 'Kineo is the best CapCut alternative for hands-off faceless Shorts — instead of editing in a timeline, you give it one idea and it returns a finished Short with script, AI voice, footage, and captions in about 60 seconds.' },
      { q: 'Can CapCut make a faceless Short automatically like Kineo?', a: 'CapCut has AI tools, but it is still an editor — you assemble and refine the video yourself. Kineo builds the entire faceless Short for you from a single idea, with no editing.' },
      { q: 'Should I use CapCut or Kineo?', a: 'Use CapCut when you want full manual control and detailed editing (and its free tier). Use Kineo when you want speed and automation — a complete faceless Short from one idea for $9.90/mo.' },
    ],
  },
  // ROBO2-SEO-2026-06-29
  pictory: {
    name: 'Pictory',
    h1: 'The Pictory Alternative That Builds the Whole Short From One Idea',
    intro:
      'Pictory turns long-form written content — blog posts, articles, scripts — and long videos into summarized short videos with stock visuals, AI voiceover, and auto-captions. It is mature and great for repurposing content you already have, but it expects you to bring that content and work in its editor. Kineo is idea-first: you give it one idea and it writes the script and returns a finished faceless 9:16 Short in about 60 seconds, with no article or source video needed.',
    theyDo: 'Pictory summarizes blog posts, articles, scripts, and long videos into shorter videos with stock visuals and AI voiceover.',
    pickThem: 'Pick Pictory if you have blogs, articles, or long videos to convert and want a mature editor with a big stock library; pick Kineo when you want a finished faceless Short from a single idea with no scripting or editing.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: 'Needs your content' },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Pulls matching footage automatically', sfa: true, them: true },
      { feature: 'Repurposes blog posts & long videos', sfa: false, them: true },
      { feature: 'Finished Short in ~60 seconds, no editor', sfa: true, them: 'Edit in timeline' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Pictory alternative for faceless YouTube Shorts?', a: 'Kineo is a strong Pictory alternative when you want a finished Short without bringing your own content — it writes the script, adds the AI voice, pulls the footage, and burns in captions to deliver a faceless 9:16 Short from a single idea in about 60 seconds.' },
      { q: 'Does Kineo need a blog post or video like Pictory?', a: 'No. Pictory is built to repurpose written content or long videos you already have. Kineo starts from just an idea — it writes the script for you, so you never need an article or source video.' },
      { q: 'Should I use Pictory or Kineo?', a: 'Choose Pictory if you have blogs, articles, or long videos to convert and want a mature editor with a big stock library. Choose Kineo if you want a finished faceless Short from one idea with no scripting or editing, from $9.90/mo.' },
    ],
  },
  // ROBO2-SEO-2026-06-29b — VEED (editor) / Vizard (repurposer) / Descript (text-editor)
  veed: {
    name: 'VEED',
    h1: 'The VEED Alternative That Builds the Whole Short — No Editor to Learn',
    intro:
      'VEED is a powerful browser-based video editor with AI tools — auto-subtitles, screen recording, a stock library and a full timeline. It is built for people who want to sit down and edit. Kineo removes the editor entirely: you give it one idea and it writes the script, records the AI voiceover, finds the footage and captions it into a finished faceless 9:16 Short in about 60 seconds. No timeline, no camera, nothing to assemble.',
    theyDo: 'VEED is a browser-based video editor with AI helpers, auto-subtitles and screen recording — you assemble and refine the video on a timeline.',
    pickThem:
      'Pick VEED if you want hands-on control to edit, trim and brand a video on a timeline (and its screen recorder). Pick Kineo if you want a finished faceless Short from one idea with zero editing.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: false },
      { feature: 'Writes the script for you', sfa: true, them: 'AI add-on, manual' },
      { feature: 'AI voiceover included', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Pulls matching footage automatically', sfa: true, them: false },
      { feature: 'No timeline editing required', sfa: true, them: false },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: 'You edit it' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Free + paid plans' },
    ],
    faq: [
      { q: 'What is the best VEED alternative for faceless YouTube Shorts?', a: 'Kineo is the best VEED alternative for hands-off faceless Shorts — instead of editing on a timeline, you give it one idea and it returns a finished 9:16 Short with script, AI voice, footage and captions in about 60 seconds.' },
      { q: 'Can VEED make a Short automatically like Kineo?', a: 'VEED has AI helpers, but it is fundamentally an editor — you still assemble and refine the video yourself. Kineo builds the entire faceless Short for you from a single idea, with no editing.' },
      { q: 'Should I use VEED or Kineo?', a: 'Use VEED when you want full manual control, screen recording and detailed editing. Use Kineo when you want a complete faceless Short generated from one idea, with up to 3 watermarked Fast videos every 24h and no card.' },
    ],
  },
  vizard: {
    name: 'Vizard',
    h1: 'The Vizard Alternative That Creates the Short From Scratch',
    intro:
      'Vizard uses AI to turn a long video you already have — a podcast, webinar or talking-head recording — into short clips, with highlight detection, captions and viral scores. It is excellent at repurposing. But if you are faceless and starting from just an idea, there is no long video to clip. Kineo builds the whole Short from a topic: it writes the script, records the AI voiceover, finds footage matched to each line and captions it, in about 60 seconds.',
    theyDo: 'Vizard repurposes long videos (podcasts, webinars, interviews) into short vertical clips using AI highlight detection.',
    pickThem:
      'Pick Vizard if you already record long videos and want the best moments auto-clipped and captioned. Pick Kineo if you want a faceless Short created from just an idea, with no source video.',
    rows: [
      { feature: 'Creates the full video from just an idea', sfa: true, them: false },
      { feature: 'Needs you to upload an existing long video', sfa: 'No', them: 'Yes' },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover (new narration)', sfa: true, them: 'Uses your audio' },
      { feature: 'Finds & matches footage automatically', sfa: true, them: 'Clips your video' },
      { feature: 'Fully faceless — no camera needed', sfa: true, them: 'Needs your video' },
      { feature: 'Auto-captions included', sfa: true, them: true },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Free + paid plans' },
    ],
    faq: [
      { q: 'Is there a Vizard alternative that builds the video from scratch?', a: 'Yes. Kineo generates a complete faceless Short — script, AI voiceover, footage and captions — from one idea, with no video to upload. Vizard instead clips long videos you already recorded.' },
      { q: 'Can I make faceless Shorts without recording a long video first?', a: 'Yes. You only need a topic. Kineo writes the script, voices it, finds matching footage and captions it into a 9:16 Short automatically — nothing to record or clip.' },
      { q: 'Vizard vs Kineo — which should I use?', a: 'Use Vizard if you already produce long videos and want them auto-clipped into highlights. Use Kineo if you want a finished faceless Short generated from a single idea, with up to 3 watermarked Fast videos every 24h and no card.' },
    ],
  },
  descript: {
    name: 'Descript',
    h1: 'The Descript Alternative That Generates the Whole Short — Nothing to Record',
    intro:
      'Descript is a text-based video and podcast editor: it transcribes your recording so you can edit the video by editing the words, clone your voice with Overdub, and remove filler words. It is brilliant for podcasters and talking-head creators polishing footage they already recorded. Kineo is for when you have no recording at all — just an idea. It writes the script, voices it with AI, finds the footage and captions it into a faceless 9:16 Short in about 60 seconds.',
    theyDo: 'Descript is a text-based editor for podcasts and talking-head video — you record, it transcribes, and you edit by editing the transcript.',
    pickThem:
      'Pick Descript if you record podcasts or talking-head video and want to edit by editing text, clone your own voice, or strip filler words. Pick Kineo if you want a faceless Short generated from one idea, with nothing to record.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: false },
      { feature: 'Needs you to record audio/video first', sfa: 'No', them: 'Yes' },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover from text (no training)', sfa: true, them: 'Overdub clones your voice' },
      { feature: 'Pulls matching footage automatically', sfa: true, them: false },
      { feature: 'Fully faceless — no camera or mic', sfa: true, them: 'Needs your recording' },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: 'You edit it' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Free + paid plans' },
    ],
    faq: [
      { q: 'What is the best Descript alternative for faceless YouTube Shorts?', a: 'Kineo is a strong Descript alternative when you have nothing recorded — it writes the script, adds an AI voice, pulls footage and burns in captions to deliver a faceless 9:16 Short from one idea in about 60 seconds, with no transcript to edit.' },
      { q: 'Does Kineo need a recording like Descript?', a: 'No. Descript edits audio or video you already recorded by editing its transcript. Kineo starts from just an idea and generates the voiceover for you, so you never record anything.' },
      { q: 'Should I use Descript or Kineo?', a: 'Use Descript if you record podcasts or talking-head video and want text-based editing and voice cloning. Use Kineo if you want a finished faceless Short from a single idea with no recording or editing, from $9.90/mo.' },
    ],
  },
  // ROBO-SEO-2026-06-30 — Synthesia (avatar) / Canva (design editor) / Kapwing (browser editor)
  // KINEO-SEO-COMPARE-2026-07-11 — reposicionada pós-AI Presenter (mesma
  // correção da página do HeyGen: agora temos avatar E o vídeo completo).
  synthesia: {
    name: 'Synthesia',
    h1: 'The Synthesia Alternative for Creators — Presenter Included, Short Included',
    intro:
      'Synthesia is the leading corporate AI-avatar platform: pick a digital presenter, type a script, get a talking-head video. Kineo brings that to creators — an AI Presenter with studio lip-sync from one photo — and then finishes the job: viral script, AI scenes or your own footage, captions and your own voice, delivered as a ready-to-post 9:16 Short. From $9.90/mo.',
    theyDo: 'Synthesia creates AI-avatar / talking-head videos with a digital presenter on screen, in 140+ languages.',
    pickThem:
      'Pick Synthesia for corporate training and multilingual explainers at enterprise scale. Pick Kineo if you are a creator: the presenter, the script, the scenes and the captions come out of one prompt, at a price an individual can pay.',
    rows: [
      { feature: 'Talking AI presenter with lip-sync', sfa: true, them: true },
      { feature: 'Creates the FULL Short from just an idea', sfa: true, them: 'Script → avatar' },
      { feature: 'Same face across every video (Character Lock)', sfa: true, them: 'Avatar library' },
      { feature: 'Writes the viral script for you', sfa: true, them: false },
      { feature: 'Use your own footage as scenes', sfa: true, them: false },
      { feature: 'Also does fully faceless Shorts (no avatar at all)', sfa: true, them: false },
      { feature: 'Built for YouTube Shorts / TikTok / Reels', sfa: true, them: 'Corporate / training' },
      { feature: 'Starting price', sfa: '$4.90 first month · then $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Synthesia alternative for YouTube Shorts?', a: 'Kineo — it gives creators a talking AI Presenter with studio lip-sync AND the finished Short: viral script, AI scenes or your own footage, captions and your own cloned voice, from $9.90/mo.' },
      { q: 'Does Kineo have an AI presenter like Synthesia?', a: 'Yes. Kineo’s AI Presenter animates one photo into a talking video with perfect lip-sync, and Character Lock keeps the same face across every video — ideal for a channel host or brand persona.' },
      { q: 'Is Kineo cheaper than Synthesia?', a: 'Kineo Starter is $4.90 for the first month and then $9.90/month, and free access includes up to 3 watermarked Fast videos every 24 hours with no card. The bigger difference is scope: Synthesia makes the avatar video, while Kineo delivers the whole ready-to-post Short.' },
    ],
  },
  canva: {
    name: 'Canva',
    h1: 'The Canva Alternative That Builds the Whole Short — No Template to Edit',
    intro:
      'Canva is an all-in-one design suite with a video editor, Magic Studio AI tools, thousands of templates and a huge asset library. It is fantastic when you want to design and edit something yourself. Kineo removes the design work entirely: from one idea it writes the script, records the AI voiceover, finds footage and captions it into a finished faceless 9:16 Short in about 60 seconds — no template to pick, no canvas to arrange.',
    theyDo: 'Canva is a template-and-design editor with AI tools — you pick a template and assemble the video yourself.',
    pickThem:
      'Pick Canva when you want to design and customize a video by hand with templates, brand kits and a big asset library (and its free tier). Pick Kineo when you want a finished faceless Short generated from one idea with no design work.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: false },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: 'Limited' },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Pulls matching footage automatically', sfa: true, them: 'You pick assets' },
      { feature: 'No template or canvas to edit', sfa: true, them: false },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: 'You design it' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Free + paid plans' },
    ],
    faq: [
      { q: 'What is the best Canva alternative for faceless YouTube Shorts?', a: 'Kineo is the best Canva alternative for hands-off faceless Shorts — instead of picking a template and arranging it, you give it one idea and it returns a finished 9:16 Short with script, AI voice, footage and captions in about 60 seconds.' },
      { q: 'Can Canva make a Short automatically like Kineo?', a: 'Canva has AI tools, but it is still a design editor — you choose a template and assemble the video yourself. Kineo builds the entire faceless Short for you from a single idea, with no design work.' },
      { q: 'Should I use Canva or Kineo?', a: 'Use Canva when you want full creative control to design and brand a video by hand (and its free tier). Use Kineo when you want a complete faceless Short generated from one idea, with up to 3 watermarked Fast videos every 24h and no card.' },
    ],
  },
  kapwing: {
    name: 'Kapwing',
    h1: 'The Kapwing Alternative That Generates the Whole Short — No Editor to Open',
    intro:
      'Kapwing is a popular browser-based video editor with AI helpers — auto-subtitles, a text-to-video tool, a stock library and a collaborative timeline. It is built for editing in the browser. Kineo removes the editor: you give it one idea and it writes the script, records the AI voiceover, finds footage matched to each line and captions it into a finished faceless 9:16 Short in about 60 seconds. No timeline, no camera, nothing to assemble.',
    theyDo: 'Kapwing is a browser-based, collaborative video editor with AI helpers and a timeline you edit on.',
    pickThem:
      'Pick Kapwing if you want hands-on control to edit, subtitle and collaborate on a video in the browser (and its free tier). Pick Kineo if you want a finished faceless Short generated from one idea with zero editing.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: false },
      { feature: 'Writes the script for you', sfa: true, them: 'AI tool, manual' },
      { feature: 'AI voiceover included', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Pulls matching footage automatically', sfa: true, them: false },
      { feature: 'No timeline editing required', sfa: true, them: false },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: 'You edit it' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Free + paid plans' },
    ],
    faq: [
      { q: 'What is the best Kapwing alternative for faceless YouTube Shorts?', a: 'Kineo is the best Kapwing alternative for hands-off faceless Shorts — instead of editing on a timeline, you give it one idea and it returns a finished 9:16 Short with script, AI voice, footage and captions in about 60 seconds.' },
      { q: 'Can Kapwing make a Short automatically like Kineo?', a: 'Kapwing has AI helpers and a text-to-video tool, but it is fundamentally an editor — you still assemble and refine the video yourself. Kineo builds the entire faceless Short for you from a single idea, with no editing.' },
      { q: 'Should I use Kapwing or Kineo?', a: 'Use Kapwing when you want to edit, subtitle and collaborate on a video in the browser (and its free tier). Use Kineo when you want a complete faceless Short generated from one idea, with up to 3 watermarked Fast videos every 24h and no card.' },
    ],
  },
  // ROBO-SEO-2026-06-30b — RunwayML (generative AI clip model, same category
  // pattern as the existing Pika entry above: standalone clips vs. finished Short).
  runwayml: {
    name: 'Runway',
    h1: 'The Runway Alternative That Builds the Whole Faceless Short From One Idea',
    intro:
      'Runway (RunwayML) is a leading generative AI video model — you prompt it and it generates short, high-fidelity AI video clips, with tools for camera control, motion brushes and video-to-video effects. It is built for generating raw creative footage and VFX, not for assembling a complete narrated, captioned Short. Kineo takes one idea and produces the entire faceless YouTube Short — script, AI voice, footage, and captions — in about 60 seconds.',
    theyDo: 'Runway focuses on generating AI video clips and creative effects from a text or image prompt, aimed at filmmakers and VFX/creative work.',
    pickThem:
      'Pick Runway when you want to generate a striking standalone AI clip or visual effect for a larger creative or VFX project; pick Kineo when you want the whole faceless Short finished end to end.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: false },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'Adds AI voiceover (narration)', sfa: true, them: false },
      { feature: 'Auto-captions / subtitles', sfa: true, them: false },
      { feature: 'Generates high-fidelity AI video clips', sfa: 'Stock + AI footage', them: true },
      { feature: 'Built for vertical YouTube Shorts output', sfa: true, them: 'Clips only' },
      { feature: 'Finished video in ~60 seconds', sfa: true, them: 'Clips, then you edit' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Runway (RunwayML) alternative for faceless YouTube Shorts?', a: 'Kineo is the strongest Runway alternative for full faceless Shorts, because it does not just generate a clip — it writes the script, adds the AI voice, pulls the footage, and burns in captions to deliver a finished vertical Short in about 60 seconds.' },
      { q: 'Can Runway make a complete YouTube Short with voiceover and captions?', a: 'Not on its own — Runway generates AI video clips, and you would still need to add a script, narration, and captions yourself, typically in a separate editor. Kineo handles that entire pipeline automatically from a single idea.' },
      { q: 'Is Kineo cheaper than Runway?', a: 'Kineo starts at $9.90/mo and turns one idea into a complete faceless Short. Runway prices change, so check their site, but the bigger difference is scope: Runway gives you AI-generated clips for creative/VFX work, Kineo gives you the whole finished Short.' },
    ],
  },
  // ROBO-SEO-2026-07-01 — Synthesys (avatar) / D-ID (avatar API), same category
  // pattern as the existing Synthesia/HeyGen entries: avatar/talking-head vs faceless.
  // KINEO-SEO-COMPARE-2026-07-11 — reposicionada pós-AI Presenter.
  synthesys: {
    name: 'Synthesys',
    h1: 'The Synthesys Alternative With the Presenter AND the Finished Short',
    intro:
      'Synthesys gives you an AI presenter or a cloned voice — and stops there. Kineo has both (AI Presenter with studio lip-sync from one photo, your own voice uploaded or cloned) and then finishes the video: viral script, AI scenes or your own footage, captions, ready-to-post 9:16. Lock one character and keep the same face forever. From $9.90/mo.',
    theyDo: 'Synthesys creates AI-avatar / talking-head videos and AI voiceovers, with a digital presenter on screen.',
    pickThem:
      'Pick Synthesys if you only need a spokesperson clip or a voice track. Pick Kineo if you want the presenter, the script, the scenes and the captions delivered as one finished Short — plus fully faceless mode when you don’t want a face at all.',
    rows: [
      { feature: 'Talking AI presenter with lip-sync', sfa: true, them: true },
      { feature: 'Voice cloning (narrate with YOUR voice)', sfa: true, them: true },
      { feature: 'Creates the FULL Short from just an idea', sfa: true, them: 'Script → avatar' },
      { feature: 'Same face across every video (Character Lock)', sfa: true, them: false },
      { feature: 'Use your own footage as scenes', sfa: true, them: false },
      { feature: 'Also does fully faceless Shorts', sfa: true, them: false },
      { feature: 'Built for YouTube Shorts / TikTok / Reels', sfa: true, them: 'Talking-head focus' },
      { feature: 'Starting price', sfa: '$4.90 first month · then $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best Synthesys alternative for YouTube Shorts?', a: 'Kineo — AI Presenter with studio lip-sync, voice cloning, Character Lock for a consistent host, plus the whole Short (script, scenes, captions) generated from one idea. From $9.90/mo.' },
      { q: 'Does Kineo do voice cloning like Synthesys?', a: 'Yes — record about a minute of audio and every video can be narrated in your cloned voice. You can also upload a ready voiceover and Kineo syncs the captions to it.' },
      { q: 'Is Kineo cheaper than Synthesys?', a: 'Kineo Starter is $4.90 for the first month and then $9.90/month, and free access includes up to 3 watermarked Fast videos every 24 hours with no card. You get the finished Short, not just the avatar or voice.' },
    ],
  },
  // KINEO-SEO-COMPARE-2026-07-11 — reposicionada pós-AI Presenter.
  'd-id': {
    name: 'D-ID',
    h1: 'The D-ID Alternative That Ships the Talking Video — Not Just the Avatar API',
    intro:
      'D-ID animates a face from a photo — at the API level, for developers. Kineo does the same trick as a finished product: upload one photo, paste your script, and the AI Presenter delivers a talking video with studio lip-sync — wrapped in a complete Short with viral script, scenes, captions and your own voice if you want it. No code, from $9.90/mo.',
    theyDo: 'D-ID provides AI talking-head avatar generation (including an API), animating a face to speak a script.',
    pickThem:
      'Pick D-ID if you are a developer building avatar video into your own app. Pick Kineo if you want the result, not the API: a talking presenter and a ready-to-post 9:16 Short from one prompt.',
    rows: [
      { feature: 'Photo + script → talking video with lip-sync', sfa: true, them: true },
      { feature: 'No code needed (finished product)', sfa: true, them: 'API / developer tool' },
      { feature: 'Creates the FULL Short from just an idea', sfa: true, them: false },
      { feature: 'Same face across every video (Character Lock)', sfa: true, them: 'Your implementation' },
      { feature: 'Writes the viral script for you', sfa: true, them: false },
      { feature: 'Also does fully faceless Shorts', sfa: true, them: false },
      { feature: 'Ready-to-post 9:16 in minutes', sfa: true, them: 'Needs your own pipeline' },
      { feature: 'Starting price', sfa: '$4.90 first month · then $9.90/mo', them: 'Paid plans' },
    ],
    faq: [
      { q: 'What is the best D-ID alternative for creators (no coding)?', a: 'Kineo — the AI Presenter turns one photo + your script into a talking video with studio lip-sync, and the platform finishes the whole Short around it: script, scenes, captions, your own voice. No API, no code.' },
      { q: 'Can Kineo animate a photo into a talking video like D-ID?', a: 'Yes — that is exactly what the AI Presenter does, and Character Lock keeps that same face consistent across every video and thumbnail you make.' },
      { q: 'Is Kineo an alternative to the D-ID API?', a: 'For developers who need an API, D-ID fits better. For creators and businesses who want a finished talking video, Kineo Starter is $4.90 for the first month and then $9.90/month; free access includes up to 3 watermarked Fast videos every 24 hours with no card.' },
    ],
  },
  // ROBO-SEO-2026-07-01b — SendShort (repurposing + faceless hybrid) / Luma Dream
  // Machine (generative AI clip model), verified live and active tools as of July 2026.
  sendshort: {
    name: 'SendShort',
    h1: 'The SendShort Alternative Built Around One Idea, Not a Long Video',
    intro:
      'SendShort mainly repurposes long videos and YouTube links into short vertical clips with auto-captions, and also offers a separate faceless video generator on its higher tiers. Kineo is built around a single workflow: give it one idea and it writes the script, records the AI voiceover, finds matching footage and captions it into a finished faceless 9:16 Short in about 60 seconds — no long video to upload, no tier to unlock for faceless output.',
    theyDo: 'SendShort repurposes long videos/YouTube links into short clips, with a faceless AI video option on its Professional/Business plans.',
    pickThem:
      'Pick SendShort if you already have long videos to auto-clip and want scheduled auto-posting across platforms. Pick Kineo if you want a faceless Short generated from just an idea, with no source video and no plan tier to unlock that.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: 'Higher tiers only' },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Pulls matching footage automatically', sfa: true, them: 'Repurposed clips' },
      { feature: 'Needs a long video or YouTube link to start', sfa: 'No', them: 'For repurposing mode' },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'From ~$19/mo' },
    ],
    faq: [
      { q: 'What is the best SendShort alternative for faceless YouTube Shorts?', a: 'Kineo is a strong SendShort alternative when you have no source video — it writes the script, adds an AI voice, pulls footage and burns in captions to deliver a faceless 9:16 Short from one idea in about 60 seconds, on every plan.' },
      { q: 'Does Kineo need a long video or YouTube link like SendShort?', a: 'No. SendShort is primarily built to repurpose a long video or link into clips, with faceless generation as an add-on. Kineo starts from just an idea and writes the script for you, so there is nothing to upload.' },
      { q: 'Should I use SendShort or Kineo?', a: 'Use SendShort if you already publish long-form video and want it auto-clipped and scheduled across platforms. Use Kineo if you are faceless and starting from an idea, and want the whole Short — script included — from $9.90/mo.' },
    ],
  },
  luma: {
    name: 'Luma Dream Machine',
    h1: 'The Luma Dream Machine Alternative That Builds the Whole Faceless Short From One Idea',
    intro:
      'Luma Dream Machine (Ray3) is a generative AI video model — you prompt it and it produces short, photorealistic or cinematic clips from text or an image, with fast sampling and HDR rendering. It is built for generating individual AI video clips, not for assembling a complete narrated, captioned Short. Kineo takes one idea and produces the entire faceless YouTube Short — script, AI voice, footage, and captions — in about 60 seconds.',
    theyDo: 'Luma Dream Machine focuses on generating short, photorealistic AI video clips from a text or image prompt.',
    pickThem:
      'Pick Luma Dream Machine when you want to generate a striking standalone AI clip to drop into a larger edit; pick Kineo when you want the whole faceless Short finished end to end.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: false },
      { feature: 'Writes the script for you', sfa: true, them: false },
      { feature: 'Adds AI voiceover (narration)', sfa: true, them: false },
      { feature: 'Auto-captions / subtitles', sfa: true, them: false },
      { feature: 'Generates photorealistic AI video clips', sfa: 'Stock + AI footage', them: true },
      { feature: 'Built for vertical YouTube Shorts output', sfa: true, them: 'Clips only' },
      { feature: 'Finished video in ~60 seconds', sfa: true, them: 'Clips, then you edit' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'From $9.99/mo' },
    ],
    faq: [
      { q: 'What is the best Luma Dream Machine alternative for faceless YouTube Shorts?', a: 'Kineo is the strongest Luma Dream Machine alternative for full faceless Shorts, because it does not just generate a clip — it writes the script, adds the AI voice, pulls the footage, and burns in captions to deliver a finished vertical Short in about 60 seconds.' },
      { q: 'Can Luma Dream Machine make a complete YouTube Short with voiceover and captions?', a: 'Not on its own — Luma generates short AI video clips, and you would still need to add a script, narration, and captions yourself in a separate editor. Kineo handles that entire pipeline automatically from a single idea.' },
      { q: 'Is Kineo cheaper than Luma Dream Machine?', a: 'Kineo starts at $9.90/mo and turns one idea into a complete faceless Short. Luma’s paid plans start lower at $9.99/mo, but the scope is different: Luma gives you raw AI clips, Kineo gives you the whole finished Short.' },
    ],
  },
  // ROBO-SEO-2026-07-01c — BigMotion AI / Faceless.so / Faceless.video: three
  // faceless-autopilot competitors, verified live July 2026. Note: Faceless.so and
  // Faceless.video are DIFFERENT products (.so = Veo 3.1 + 7-platform scheduling,
  // .video = daily auto-post channel tool). Vadoo AI is NOT added — it rebranded
  // to Quso.ai and is already covered by the `quso` slug above.
  bigmotion: {
    name: 'BigMotion AI',
    h1: 'The BigMotion AI Alternative With Better Scripts at a Lower Price',
    intro:
      'BigMotion AI generates faceless videos on autopilot — AI script, voiceover, captions and music — and publishes them on a schedule. Kineo focuses on the individual video: a hook structure with footage matched to each line, turned into a finished 9:16 Short in about 60 seconds. Starter is $4.90 for the first month and then $9.90/month; free access includes up to 3 watermarked Fast videos every 24 hours with no card.',
    theyDo: 'BigMotion AI auto-generates faceless videos and publishes them to YouTube, TikTok and Instagram Reels on autopilot.',
    pickThem:
      'Pick BigMotion if hands-off scheduled auto-posting across platforms is your main goal and you will review the output. Pick Kineo if you care about the script and footage actually being good — and want it cheaper per month.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: true },
      { feature: 'Viral hook structure baked into the script', sfa: true, them: false },
      { feature: 'Footage matched per script line', sfa: true, them: 'Hit-or-miss' },
      { feature: 'AI voiceover included', sfa: true, them: true },
      { feature: 'Auto-captions included', sfa: true, them: true },
      { feature: 'Auto-publishes to your channels on a schedule', sfa: false, them: true },
      { feature: 'Ready-to-post 9:16 in ~60s', sfa: true, them: true },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'From $19/mo (12 videos)' },
    ],
    faq: [
      { q: 'Is there a lower-cost BigMotion AI alternative with hook-first scripts?', a: 'Kineo Starter is $4.90 for the first month and then $9.90/month. It builds each Short around a hook structure with footage matched to the narration. Free access includes up to 3 watermarked Fast videos every 24 hours with no card.' },
      { q: 'Does BigMotion AI make good faceless videos automatically?', a: 'BigMotion delivers the automation it promises, but user reviews consistently mention robotic voices and hit-or-miss scripts that need manual quality control. A faceless Short lives or dies on the hook, which is why Kineo writes a hook-first script and matches specific footage per line.' },
      { q: 'BigMotion vs Kineo — which should I use?', a: 'Use BigMotion if fully hands-off scheduled posting to YouTube, TikTok and Instagram matters more to you than per-video quality. Use Kineo if you want each Short built from one idea with a strong script, from $9.90/mo.' },
    ],
  },
  'faceless-so': {
    name: 'Faceless.so',
    h1: 'The Faceless.so Alternative That Nails Each Short, Not Just the Schedule',
    intro:
      'Faceless.so is a faceless-video autopilot that generates series and schedules them across social platforms. Kineo is built for the individual video: one idea in, a finished faceless 9:16 Short out in about 60 seconds — hook-driven script, AI voiceover, matched footage and captions. Starter is $4.90 for the first month and then $9.90/month; free access includes up to 3 watermarked Fast videos every 24 hours with no card.',
    theyDo: 'Faceless.so auto-generates faceless video series (with Veo 3.1 AI visuals) from prompts, Reddit or blogs and auto-schedules them across multiple platforms.',
    pickThem:
      'Pick Faceless.so if you want a hands-off series pumping out scheduled videos across many platforms, or Reddit/blog-sourced content on autopilot. Pick Kineo if you want each Short crafted from a single idea with a viral hook structure — and to see the finished video in about 60 seconds.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: true },
      { feature: 'Viral hook structure baked into the script', sfa: true, them: false },
      { feature: 'AI voiceover included', sfa: true, them: true },
      { feature: 'Auto-captions / subtitles', sfa: true, them: true },
      { feature: 'Veo 3.1 AI-generated visuals', sfa: 'Stock + AI footage', them: true },
      { feature: 'Auto-schedules series across multiple platforms', sfa: false, them: true },
      { feature: 'Turns Reddit threads / blogs into videos', sfa: false, them: true },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: 'Runs on a schedule' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'From ~$20/mo' },
    ],
    faq: [
      { q: 'What is the best Faceless.so alternative for faceless YouTube Shorts?', a: 'Kineo is a strong Faceless.so alternative when per-video quality matters more than scheduled volume — it turns one idea into a finished faceless Short with a hook-driven script, AI voice, matched footage and captions in about 60 seconds, from $9.90/mo.' },
      { q: 'Faceless.so vs Kineo — what is the real difference?', a: 'Faceless.so is a series autopilot: it generates and auto-schedules batches of videos across platforms, with Veo 3.1 AI visuals. Kineo is idea-first: you type one topic and get one finished, ready-to-post Short in about 60 seconds, so you control what goes out.' },
      { q: 'Is Faceless.so the same as Faceless.video?', a: 'No — they are different products. Faceless.so is the Veo 3.1-powered multi-platform autopilot; Faceless.video is a separate daily auto-posting channel tool. Kineo compares to both as the idea-first option that finishes a single Short in about 60 seconds.' },
    ],
  },
  'faceless-video': {
    name: 'Faceless.video',
    h1: 'The Faceless.video Alternative That Puts You in Control of Every Short',
    intro:
      'Faceless.video runs a faceless channel for you: pick a niche, and it creates videos — script, AI voiceover, music, captions and AI visuals — and auto-posts them to TikTok, YouTube Shorts and Instagram Reels on a set schedule (up to twice a day), with plans from $15 to $45/mo per series. It is genuinely hands-off, but users report repetitive content and occasional visual glitches across batches. Kineo takes the opposite bet: one idea, one hook-driven script, one finished 9:16 Short in about 60 seconds — so you approve every video before it goes out, from $9.90/mo.',
    theyDo: 'Faceless.video auto-creates and auto-posts faceless videos to TikTok, YouTube Shorts and Instagram Reels on a recurring schedule.',
    pickThem:
      'Pick Faceless.video if you want a channel that posts itself on a schedule and you accept batch-generated content. Pick Kineo if you want to choose each topic, get a hook-driven script, and review the finished Short before posting — for less per month.',
    rows: [
      { feature: 'Creates the full faceless Short from just an idea', sfa: true, them: 'Niche-based batches' },
      { feature: 'Viral hook structure baked into the script', sfa: true, them: false },
      { feature: 'You pick the topic of every video', sfa: true, them: 'Autopilot decides' },
      { feature: 'AI voiceover included', sfa: true, them: true },
      { feature: 'Auto-captions included', sfa: true, them: true },
      { feature: 'Auto-posts to your accounts on a schedule', sfa: false, them: true },
      { feature: 'Finished Short in ~60 seconds', sfa: true, them: 'Runs on a schedule' },
      { feature: 'Starting price', sfa: 'From $9.90/mo', them: 'From $15/mo per series' },
    ],
    faq: [
      { q: 'What is a Faceless.video alternative for individual YouTube Shorts?', a: 'Kineo is an option when you want control over each video — it turns one idea into a finished faceless Short with a hook-driven script, AI voice, matched footage and captions in about 60 seconds. Starter is $4.90 for the first month; free access includes up to 3 watermarked Fast videos every 24 hours with no card.' },
      { q: 'Why do auto-posted faceless videos sometimes underperform?', a: 'Batch-generated autopilot content tends to repeat itself, and users of scheduling tools report repetitive scripts and visual glitches slipping through. Kineo generates one Short per idea with a hook-first script and matched footage, and you review it before posting.' },
      { q: 'Faceless.video vs Kineo — which should I use?', a: 'Use Faceless.video if a self-posting channel on a fixed schedule (its plans run $15–$45/mo per series) is what you want. Use Kineo if you want to pick every topic and get a finished, ready-to-post Short in about 60 seconds for $9.90/mo.' },
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
  const title = `${c.name} Alternative for Faceless Creators — Kineo`
  const description = `Looking for a ${c.name} alternative? Kineo turns one idea into a finished faceless YouTube Short. Try up to 3 watermarked Fast videos every 24h; Starter is $4.90 for the first month.`
  const url = `https://www.usekineo.com/alternatives/${params.competitor}`
  return {
    metadataBase: new URL('https://www.usekineo.com'),
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const CARD = { background: '#161618', border: '1px solid #2a2a2d' }

function currentKineoOffer(value: string): string {
  return value
    .replace(/is the first short really free\?/gi, 'Can I use Kineo without paying?')
    .replace(/your first short is free(?: with no credit card(?: required)?)?/gi, 'you can create up to 3 watermarked Fast videos every 24h with no card')
    .replace(/the first short is free(?: with no credit card(?: required)?)?/gi, 'you can create up to 3 watermarked Fast videos every 24h with no card')
    .replace(/a free first short/gi, 'up to 3 watermarked Fast videos every 24h with no card')
    .replace(/free first short/gi, 'up to 3 watermarked Fast videos every 24h with no card')
    .replace(/plans start at \$9\.90\/month/gi, 'Starter is $4.90 for the first month, then $9.90/month')
    .replace(/Kineo starts at \$9\.90\/month/gi, 'Kineo Starter is $4.90 for the first month, then $9.90/month')
    .replace(/Kineo starts at \$9\.90\/mo/gi, 'Kineo Starter is $4.90 for the first month, then $9.90/month')
    .replaceAll('starts lower at $9.90/mo', 'starts with Starter at $4.90 for the first month')
    .replaceAll('From $9.90/mo', 'Starter $4.90 first month')
    .replaceAll('from $9.90/mo', 'with Starter at $4.90 for the first month')
    .replaceAll('for $9.90/mo', 'with Starter at $4.90 for the first month')
    .replaceAll('from $9.90/month', 'with Starter at $4.90 for the first month')
    .replaceAll('for $9.90/month', 'with Starter at $4.90 for the first month')
    .replaceAll('first Short free', 'up to 3 watermarked Fast videos every 24h, no card')
    .replaceAll('first one is free', 'up to 3 watermarked Fast videos every 24h are free')
    .replaceAll('first one free', 'up to 3 watermarked Fast videos every 24h, no card')
}

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <span style={{ color: '#2997ff', fontWeight: 900 }}>✓</span>
  if (v === false) return <span style={{ color: '#6e6e73', fontWeight: 900 }}>—</span>
  return <span style={{ fontSize: '0.82rem', color: '#86868b' }}>{currentKineoOffer(v)}</span>
}

export default function AlternativePage({ params }: { params: { competitor: string } }) {
  const c = COMPETITORS[params.competitor]
  if (!c) notFound()

  const campaign = `push22_alternative_${params.competitor}`
  const signupUrl = `/signup?utm_source=seo&utm_medium=organic&utm_campaign=${campaign}`

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faq.map((f) => ({
      '@type': 'Question',
      name: currentKineoOffer(f.q),
      acceptedAnswer: { '@type': 'Answer', text: currentKineoOffer(f.a) },
    })),
  }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#f5f5f7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 18px 64px' }}>
        <Link href="/" style={{ color: '#2997ff', fontWeight: 800, textDecoration: 'none', fontSize: '1.05rem' }}>
          ⚡ Kineo
        </Link>

        {/* Hero */}
        <section style={{ marginTop: 36, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#2997ff', background: 'rgba(41,151,255,0.1)', borderRadius: 999, padding: '6px 14px' }}>
            {c.name} alternative
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.15, margin: '16px 0 0' }}>
            {c.h1}
          </h1>
          <p style={{ fontSize: '1.02rem', color: '#86868b', lineHeight: 1.6, margin: '16px auto 0', maxWidth: 660 }}>
            {currentKineoOffer(c.intro)}
          </p>
          <OrganicCtaLink
            href={signupUrl}
            source={campaign}
            placement="hero"
            style={{ display: 'inline-block', marginTop: 22, background: '#f5f5f7', color: '#000', fontWeight: 900, padding: '15px 32px', borderRadius: 980, textDecoration: 'none', fontSize: '1.05rem' }}
          >
            Try Kineo free →
          </OrganicCtaLink>
          <p style={{ fontSize: '0.82rem', color: '#86868b', margin: '10px 0 0' }}>
            Up to 3 watermarked Fast videos / 24h · no card · Starter <b style={{ color: '#2997ff' }}>$4.90 first month</b>
          </p>
        </section>

        {/* Comparison table */}
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>
            Kineo vs {c.name}
          </h2>
          <div style={{ ...CARD, borderRadius: 16, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 700, color: '#86868b' }}>Feature</th>
                  <th style={{ textAlign: 'center', padding: '12px 10px', fontWeight: 900, color: '#2997ff' }}>Kineo</th>
                  <th style={{ textAlign: 'center', padding: '12px 10px', fontWeight: 700, color: '#86868b' }}>{c.name}</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r, i) => (
                  <tr key={r.feature} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: i % 2 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '11px 14px', color: '#f5f5f7' }}>{r.feature}</td>
                    <td style={{ padding: '11px 10px', textAlign: 'center' }}><Cell v={r.sfa} /></td>
                    <td style={{ padding: '11px 10px', textAlign: 'center' }}><Cell v={r.them} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.74rem', color: '#6e6e73', textAlign: 'center', margin: '10px 0 0' }}>
            Comparison reflects each tool’s core product focus as publicly described (July 2026); features and pricing may change.
          </p>
        </section>

        {/* Honest "pick them" */}
        <section style={{ marginTop: 40, ...CARD, borderRadius: 16, padding: '20px 22px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: '0 0 8px' }}>Which one should you pick?</h2>
          <p style={{ margin: 0, color: '#86868b', lineHeight: 1.6, fontSize: '0.95rem' }}>{currentKineoOffer(c.pickThem)}</p>
        </section>

        {/* How it works */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', margin: '0 0 18px' }}>How Kineo works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { n: '1', t: 'Type one idea', d: 'A topic, a fact, a hook — one sentence is enough.' },
              { n: '2', t: 'AI builds the Short', d: 'Script, AI voiceover, captions and matched footage, assembled automatically.' },
              { n: '3', t: 'Download & post', d: 'A vertical 9:16 MP4 in ~60s, ready for YouTube Shorts, TikTok and Reels.' },
            ].map((s) => (
              <div key={s.n} style={{ ...CARD, borderRadius: 14, padding: 16 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(41,151,255,0.12)', color: '#2997ff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{s.n}</div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{s.t}</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#86868b', lineHeight: 1.5 }}>{s.d}</p>
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
                <div style={{ fontWeight: 800, marginBottom: 6, fontSize: '0.95rem' }}>{currentKineoOffer(f.q)}</div>
                <p style={{ margin: 0, color: '#86868b', lineHeight: 1.6, fontSize: '0.9rem' }}>{currentKineoOffer(f.a)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ marginTop: 44, textAlign: 'center', ...CARD, borderRadius: 18, padding: '28px 20px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Make a faceless Fast video free</h2>
          <p style={{ color: '#86868b', margin: '8px 0 18px', fontSize: '0.95rem' }}>One idea in, a ready-to-post watermarked video out. No editing, no card.</p>
          <OrganicCtaLink
            href={signupUrl}
            source={campaign}
            placement="final"
            style={{ display: 'inline-block', background: '#f5f5f7', color: '#000', fontWeight: 900, padding: '14px 30px', borderRadius: 980, textDecoration: 'none', fontSize: '1.02rem' }}
          >
            Start free →
          </OrganicCtaLink>
        </section>

        {/* Cross-links */}
        <nav style={{ marginTop: 40, textAlign: 'center', fontSize: '0.8rem', color: '#6e6e73' }}>
          <span>Other comparisons: </span>
          {COMPETITOR_SLUGS.filter((s) => s !== params.competitor).map((s, i) => (
            <span key={s}>
              {i > 0 && ' · '}
              <Link href={`/alternatives/${s}`} style={{ color: '#86868b', textDecoration: 'none' }}>{COMPETITORS[s].name}</Link>
            </span>
          ))}
        </nav>
      </div>
      <StickyFreeShortCTA href={signupUrl} />
      <Footer />
    </main>
  )
}
