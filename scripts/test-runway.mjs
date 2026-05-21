// Standalone Runway API smoke test.
//
// Verifies the API key + payload work end-to-end against Runway:
//   1) POST /v1/text_to_image (gen4_image)  → poll → image URL
//   2) POST /v1/image_to_video (gen4_turbo) → poll → video URL
//
// Run:  RUNWAY_API_KEY=xxx node scripts/test-runway.mjs
// Node 18+ required (built-in fetch).

const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1'
const RUNWAY_VERSION = '2024-11-06'

const API_KEY = process.env.RUNWAY_API_KEY
if (!API_KEY) {
  console.error('Missing RUNWAY_API_KEY env var.')
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  'X-Runway-Version': RUNWAY_VERSION,
  'Content-Type': 'application/json',
}

async function postTask(path, payload) {
  console.log(`POST ${path} payload:`, JSON.stringify(payload))
  const res = await fetch(`${RUNWAY_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  console.log(`${path} → status=${res.status}`)
  console.log(`${path} body:`, text.slice(0, 800))
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  const data = JSON.parse(text)
  if (!data.id) throw new Error(`${path} returned no task id`)
  return data.id
}

async function poll(id, maxMs = 90_000) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const res = await fetch(`${RUNWAY_BASE}/tasks/${id}`, { headers })
    const data = await res.json()
    console.log(`task ${id} status=${data.status} progress=${data.progress ?? 'n/a'}`)
    if (data.status === 'SUCCEEDED') return data
    if (data.status === 'FAILED' || data.status === 'CANCELLED') {
      throw new Error(`task ${id} ${data.status}: ${data.failure ?? '(no detail)'}`)
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`task ${id} timed out`)
}

function extractUrl(task) {
  const out = task.output
  if (Array.isArray(out)) return typeof out[0] === 'string' ? out[0] : out[0]?.url ?? null
  if (typeof out === 'string') return out
  if (out && typeof out === 'object') return out.url ?? null
  return null
}

const PROMPT = process.argv[2] ?? 'Dark mysterious ocean at night, cinematic, 4K'

const imgTaskId = await postTask('/text_to_image', {
  model: 'gen4_image',
  promptText: PROMPT,
  ratio: '720:1280',
})
const imgDone = await poll(imgTaskId)
const imageUrl = extractUrl(imgDone)
if (!imageUrl) throw new Error('No image URL in text_to_image output')
console.log('IMAGE URL:', imageUrl)

const vidTaskId = await postTask('/image_to_video', {
  model: 'gen4_turbo',
  promptImage: imageUrl,
  promptText: PROMPT,
  ratio: '720:1280',
  duration: 10,
})
const vidDone = await poll(vidTaskId, 180_000)
const videoUrl = extractUrl(vidDone)
console.log('VIDEO URL:', videoUrl)
console.log('OK — Runway end-to-end pipeline works.')
