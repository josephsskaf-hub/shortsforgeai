// AI Avatar — "Scene" image generation.
// Takes the user's uploaded face photo + a scene description and returns a NEW
// image of that SAME person in the described scene (e.g. "wearing a Brazil
// national team jersey, in a packed World Cup stadium crowd"), preserving the
// face. That generated image is then animated by OmniHuman (full body & gestures).
//
// Model: FLUX.1 Kontext [pro] on fal — an in-context image EDITOR that changes
// clothes/background while keeping the same person. Runs on the same FAL_KEY as
// the avatar engines. ~$0.04 per image.
import { fal } from '@fal-ai/client'

const KONTEXT_MODEL = 'fal-ai/flux-pro/kontext'
export const KONTEXT_USD_PER_IMAGE = 0.04

function configureFal(): boolean {
  const key = process.env.FAL_KEY
  if (!key) return false
  fal.config({ credentials: key })
  return true
}

/**
 * Generate a scene image from a face photo + prompt. Returns the fal-hosted
 * image URL, or throws. ONE automatic retry on a transient failure (same
 * protection pattern as the avatar engines).
 */
export async function generateSceneImage(args: {
  imageUrl: string
  prompt: string
}): Promise<string> {
  if (!configureFal()) throw new Error('Image engine is not configured.')
  // Plain object + widened model string so the fal client uses its generic
  // (untyped-input) overload — same pattern as submitAvatarJob in veed.ts.
  const input: Record<string, unknown> = {
    image_url: args.imageUrl,
    prompt: args.prompt,
    num_images: 1,
    output_format: 'jpeg',
    safety_tolerance: '2',
  }
  const model: string = KONTEXT_MODEL
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = (await fal.subscribe(model, { input })) as {
        data?: { images?: Array<{ url?: string }> }
        images?: Array<{ url?: string }>
      }
      const url = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url ?? null
      if (url) return url
      lastErr = new Error('Image model returned no image URL.')
    } catch (err) {
      lastErr = err
      console.error(`[avatar/scene] attempt ${attempt} failed:`, err instanceof Error ? err.message : String(err))
      if (attempt === 1) await new Promise((r) => setTimeout(r, 800))
    }
  }
  throw new Error(
    `Scene image generation failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  )
}
