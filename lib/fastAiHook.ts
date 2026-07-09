// KINEO-FAST-V4-2026-07-10 — AI HOOK for the FIRST video of every account.
//
// The first video is where a new user decides whether Kineo is magic or just
// stock clips. This module generates ONE Seedance clip (5s, 720p, ~$0.10-0.15)
// for the opening scene of a user's FIRST Fast video only — the "wow" first
// frame of the AI engine, injected into the free product exactly once, at the
// moment of maximum conversion leverage. Every generated hook is also vaulted,
// so over time popular topics get their AI hooks reused for FREE.
//
// Fail-safe by design:
//   - Toggle: FAST_AI_HOOK=false disables entirely.
//   - Submit + poll are capped (default 60s): on timeout/error the caller just
//     keeps its stock hook. The video is NEVER blocked or degraded by this.
//   - Only fires when FAL_KEY exists and the caller confirmed first-video.

import { fal } from '@fal-ai/client'
import { vaultClipAsync } from './clipVault'

const SEEDANCE_MODEL = 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video'
const POLL_INTERVAL_MS = 2500

export interface AiHookHandle {
  requestId: string
  prompt: string
}

/** Build a faceless, era-safe cinematic prompt from the hook scene's text. */
export function buildHookPrompt(sceneDescription: string, topic: string): string {
  const base = `${sceneDescription || topic}`
    .replace(/\b(man|woman|person|people|guy|girl|influencer|model)\b/gi, 'distant silhouetted figure')
    .slice(0, 300)
  return (
    `${base}, cinematic establishing shot, photorealistic, dramatic lighting, ` +
    `dark moody atmosphere, high detail, no text, no captions, no logos, ` +
    `no recognizable human faces`
  )
}

/** Submit the hook generation. Returns null when disabled/unconfigured. Never throws. */
export async function submitAiHook(prompt: string): Promise<AiHookHandle | null> {
  try {
    if (process.env.FAST_AI_HOOK === 'false') return null
    const falKey = process.env.FAL_KEY
    if (!falKey) return null
    fal.config({ credentials: falKey })
    const { request_id } = await fal.queue.submit(SEEDANCE_MODEL, {
      input: {
        prompt,
        aspect_ratio: '9:16',
        resolution: '720p', // fastest + cheapest; a 9:16 phone hook hides the difference
        duration: '5',
        generate_audio: false,
      },
    })
    if (!request_id) return null
    console.log(`[ai-hook] submitted request=${request_id} prompt="${prompt.slice(0, 70)}"`)
    return { requestId: request_id, prompt }
  } catch (err) {
    console.warn('[ai-hook] submit failed (non-blocking):', err instanceof Error ? err.message : String(err))
    return null
  }
}

/**
 * Poll until the hook clip is ready or the budget runs out. Returns the video
 * URL or null. Never throws. On success the clip is vaulted (fire-and-forget)
 * so future videos on this topic get it free.
 */
export async function awaitAiHook(
  handle: AiHookHandle,
  budgetMs = 60_000,
  vaultQuery?: string,
): Promise<string | null> {
  const deadline = Date.now() + budgetMs
  try {
    while (Date.now() < deadline) {
      const status = await fal.queue.status(SEEDANCE_MODEL, {
        requestId: handle.requestId,
        logs: false,
      })
      if (status.status === 'COMPLETED') {
        const result = await fal.queue.result(SEEDANCE_MODEL, { requestId: handle.requestId })
        const url = (result?.data as { video?: { url?: string } } | undefined)?.video?.url ?? null
        if (url) {
          console.log(`[ai-hook] READY in budget — url=${url.slice(0, 60)}`)
          void vaultClipAsync({
            sourceUrl: url,
            provider: 'pixabay', // vault schema provider is informational; tags mark it
            query: vaultQuery ?? handle.prompt.slice(0, 120),
            tags: `ai-hook, seedance, cinematic, ${(vaultQuery ?? '').toLowerCase()}`,
            score: 30, // AI hooks outrank any stock clip in vault searches
            durationSec: 5,
          })
        }
        return url
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }
    console.log(`[ai-hook] budget exhausted (${budgetMs}ms) — keeping stock hook (clip may still vault via future request)`)
    return null
  } catch (err) {
    console.warn('[ai-hook] await failed (non-blocking):', err instanceof Error ? err.message : String(err))
    return null
  }
}
