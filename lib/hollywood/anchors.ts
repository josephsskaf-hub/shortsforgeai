// KINEO-HOLLYWOOD-30-2026-07-10 — HOLLYWOOD 3.0 "UM MUNDO": image anchors.
//
// The v2.x defect this kills (founder feedback on real renders): the presenter
// CHANGES FACE between his own scenes, and the b-roll lives in a visually
// DIFFERENT world — every clip was an independent text-to-video generation,
// and a textual characterSheet cannot lock identity across generations.
//
// The fix: BEFORE submitting any scene, generate TWO anchor images from the
// plan's sheets:
//   (1) PORTRAIT — the canonical presenter (9:16, medium shot, looking at the
//       camera, standing in the environment). Every DIALOGUE scene is then
//       Kling O3 Pro image-to-video seeded with THIS image → same face, same
//       clothes, same place, in every scene where the person appears.
//   (2) ENVIRONMENT STILL — the same environment, empty (9:16, no people).
//       Every non-dialogue scene (support/cinematic) is i2v seeded with THIS
//       image → the b-roll visibly belongs to the SAME world.
//
// Model: fal-ai/flux/schnell (fast + cheap text-to-image; the repo's only
// other image model, FLUX Kontext in lib/avatar/scene.ts, is an image EDITOR
// that requires an input photo — not usable for from-scratch anchors). Same
// Each paid queue POST is sent exactly once, followed only by read-only status
// polling; image generation is fast enough to finish before scene submission.
//
// FAIL-OPEN: any failure here returns null and the route falls back to the
// v2.4 text-to-video path — anchors can never kill a render.
import { fal } from '@fal-ai/client'
import { FalQueueSubmitError, submitFalQueueOnce } from '@/lib/falQueue'

const ANCHOR_IMAGE_MODEL = 'fal-ai/flux/schnell'

// KINEO-HOLLYWOOD-30-2026-07-10 — approximate cost of the 2 anchor images
// (flux/schnell is ~pennies; logged conservatively as a flat $0.10 so the
// [hollywood-cost] TOTAL never understates).
export const ANCHORS_USD = 0.1

export type HollywoodAnchors = {
  /** Canonical presenter portrait (9:16) — image_url for dialogue scenes. */
  portraitUrl: string
  /** Empty environment still (9:16) — image_url for support/cinematic scenes. */
  environmentUrl: string
}

/** Generate ONE anchor image and return its fal-hosted URL (fal.media URLs
 * are directly usable as Kling `image_url`). Never retry the paid POST after
 * an ambiguous response; only status/result reads may be retried. */
async function generateAnchorImage(prompt: string): Promise<string | null> {
  const input: Record<string, unknown> = {
    prompt,
    image_size: 'portrait_16_9', // 9:16 vertical
    num_images: 1,
    num_inference_steps: 4,
    enable_safety_checker: true,
  }
  const model: string = ANCHOR_IMAGE_MODEL
  let requestId: string
  try {
    requestId = await submitFalQueueOnce(model, input)
  } catch (err) {
    console.error(
      '[hollywood-anchors] single queue submit failed:',
      err instanceof Error ? err.message : String(err),
    )
    if (err instanceof FalQueueSubmitError && err.ambiguous) throw err
    return null
  }

  const deadline = Date.now() + 35_000
  while (Date.now() < deadline) {
    try {
      const statusResult = await fal.queue.status(model, { requestId })
      const status = (statusResult as { status?: string }).status
      if (status === 'COMPLETED') {
        const result = await fal.queue.result(model, { requestId }) as {
          data?: { images?: Array<{ url?: string }> }
          images?: Array<{ url?: string }>
        }
        const url = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url ?? null
        if (url) return url
        console.error('[hollywood-anchors] image model completed without a URL')
        return null
      }
      if (status === 'FAILED') return null
    } catch (err) {
      // Status/result calls are read-only. A transient failure does not justify
      // creating a second paid anchor job.
      console.warn('[hollywood-anchors] transient poll failure:', err instanceof Error ? err.message : String(err))
    }
    await new Promise((resolve) => setTimeout(resolve, 750))
  }
  throw new FalQueueSubmitError('Hollywood anchor is still processing after the polling window', {
    ambiguous: true,
  })
}

/**
 * Generate the two Hollywood 3.0 anchor images from the plan's sheets.
 * Returns null on ANY failure (fail-open → caller uses the v2.4 t2v path).
 * BOTH anchors must succeed: a half-anchored video (locked face but drifting
 * world, or vice-versa) would look worse than a consistent t2v fallback.
 */
export async function generateHollywoodAnchors(args: {
  characterSheet: string
  environmentSheet: string
  styleSheet: string
}): Promise<HollywoodAnchors | null> {
  const key = process.env.FAL_KEY
  if (!key) return null
  try {
    fal.config({ credentials: key })

    const character = (args.characterSheet ?? '').trim()
    const environment = (args.environmentSheet ?? '').trim()
    const style = (args.styleSheet ?? '').trim()
    // Without real sheets the anchors would anchor nothing — fall back.
    if (character.length < 15 || environment.length < 10) return null

    const portraitPrompt =
      `${character}. Standing in: ${environment}. Cinematography: ${style}. ` +
      `vertical 9:16 portrait, medium shot, looking directly at the camera, photorealistic, ` +
      `sharp focus on the face, no text, no watermark, no logo`
    const stillPrompt =
      `${environment}. Cinematography: ${style}. ` +
      `vertical 9:16, empty scene, no people, no human figures, photorealistic, ` +
      `establishing shot, no text, no watermark, no logo`

    // flux/schnell has no shared-alias concurrency limit (that's the Kling
    // video queue) — the two images can run in parallel.
    const [portraitUrl, environmentUrl] = await Promise.all([
      generateAnchorImage(portraitPrompt),
      generateAnchorImage(stillPrompt),
    ])
    if (!portraitUrl || !environmentUrl) {
      console.warn(
        `[hollywood-anchors] incomplete anchors (portrait=${!!portraitUrl} environment=${!!environmentUrl}) — falling back to t2v`,
      )
      return null
    }
    console.log(
      `[hollywood-anchors] ready portrait=${portraitUrl.slice(0, 60)} environment=${environmentUrl.slice(0, 60)}`,
    )
    return { portraitUrl, environmentUrl }
  } catch (err) {
    if (err instanceof FalQueueSubmitError && err.ambiguous) throw err
    console.error(
      '[hollywood-anchors] failed (falling back to t2v):',
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}
