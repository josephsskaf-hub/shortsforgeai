import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(path) {
  const values = {}
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) value = value.slice(1, -1)
    values[match[1]] = value
  }
  return values
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  return sorted[Math.min(index, sorted.length - 1)]
}

function roundedMinutes(milliseconds) {
  return Number((milliseconds / 60_000).toFixed(2))
}

function summarize(rows) {
  const sorted = rows.map((row) => row.latencyMs).sort((a, b) => a - b)
  return {
    completed: rows.length,
    medianMinutes: percentile(sorted, 0.5) === null ? null : roundedMinutes(percentile(sorted, 0.5)),
    p75Minutes: percentile(sorted, 0.75) === null ? null : roundedMinutes(percentile(sorted, 0.75)),
    p90Minutes: percentile(sorted, 0.9) === null ? null : roundedMinutes(percentile(sorted, 0.9)),
    fastestMinutes: sorted.length === 0 ? null : roundedMinutes(sorted[0]),
    slowestMinutes: sorted.length === 0 ? null : roundedMinutes(sorted.at(-1)),
  }
}

async function fetchAll(queryFactory, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

const hoursArg = process.argv.find((arg) => arg.startsWith('--hours='))
const hours = Number(hoursArg?.split('=')[1] || 168)
if (!Number.isFinite(hours) || hours <= 0 || hours > 2160) {
  throw new Error('--hours must be between 1 and 2160')
}

const env = loadEnv('.env.local')
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials in .env.local')
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const now = Date.now()
const cutoff = new Date(now - hours * 60 * 60 * 1000).toISOString()
const maturityCutoffMs = now - 20 * 60 * 1000

const jobs = await fetchAll(() => db
  .from('render_jobs')
  .select('render_id,quality,cost,created_at')
  .gte('created_at', cutoff)
  .order('created_at', { ascending: true }))

const videos = await fetchAll(() => db
  .from('videos')
  .select('render_id,status,created_at,quality_mode')
  .gte('created_at', cutoff)
  .not('render_id', 'is', null)
  .order('created_at', { ascending: true }))

const completedByRender = new Map(
  videos
    .filter((video) => video.status === 'completed' && typeof video.render_id === 'string')
    .map((video) => [video.render_id, video]),
)

const matched = jobs.flatMap((job) => {
  const completed = completedByRender.get(job.render_id)
  if (!completed) return []
  const startedAt = new Date(job.created_at || 0).getTime()
  const completedAt = new Date(completed.created_at || 0).getTime()
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) return []
  return [{
    quality: job.quality || completed.quality_mode || 'unknown',
    cost: Number(job.cost || 0),
    startedAt: job.created_at,
    completedAt: completed.created_at,
    latencyMs: completedAt - startedAt,
  }]
})

const maturedJobs = jobs.filter((job) => new Date(job.created_at || 0).getTime() <= maturityCutoffMs)
const maturedCompleted = maturedJobs.filter((job) => completedByRender.has(job.render_id))
const byQuality = Object.fromEntries(
  [...new Set(matched.map((row) => row.quality))]
    .sort()
    .map((quality) => [quality, summarize(matched.filter((row) => row.quality === quality))]),
)

console.log(JSON.stringify({
  generatedAt: new Date(now).toISOString(),
  window: { hours, cutoff, maturityMinutes: 20 },
  jobs: {
    total: jobs.length,
    mature: maturedJobs.length,
    matureCompleted: maturedCompleted.length,
    matureCompletionRate: maturedJobs.length === 0
      ? null
      : Number((maturedCompleted.length / maturedJobs.length).toFixed(3)),
  },
  latency: {
    overall: summarize(matched),
    byQuality,
  },
  latestCompleted: matched
    .slice()
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10)
    .map((row) => ({
      quality: row.quality,
      cost: row.cost,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      latencyMinutes: roundedMinutes(row.latencyMs),
    })),
}, null, 2))
