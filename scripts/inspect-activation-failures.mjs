import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(path) {
  const values = {}
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[match[1]] = value
  }
  return values
}

function parseHours() {
  const raw = process.argv.find((arg) => arg.startsWith('--hours='))?.split('=')[1] ?? '72'
  const hours = Number(raw)
  if (!Number.isFinite(hours) || hours <= 0 || hours > 720) throw new Error('--hours must be between 1 and 720')
  return hours
}

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {}
  const allowed = [
    'attempt_id', 'campaign', 'engine', 'error', 'failed_from_stage', 'quality',
    'reason', 'recovery', 'source', 'stage', 'variant',
  ]
  return Object.fromEntries(allowed.filter((key) => key in metadata).map((key) => [key, metadata[key]]))
}

async function main() {
  const env = { ...loadEnv('.env.local'), ...process.env }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service-role configuration is missing')
  }
  const hours = parseHours()
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase
    .from('events')
    .select('name,user_id,metadata,created_at')
    .gte('created_at', cutoff)
    .in('name', [
      'activation_autostart_eligible',
      'activation_autostart_dispatched',
      'activation_autostart_checkpointed',
      'activation_autostart_recovery_eligible',
      'activation_autostart_recovery_dispatched',
      'generate_started',
      'generation_checkpoint_saved',
      'video_generation_failed',
      'video_generation_completed',
    ])
    .order('created_at', { ascending: true })
  if (error) throw error

  const attempts = new Map()
  for (const row of data ?? []) {
    const attemptId = typeof row.metadata?.attempt_id === 'string' ? row.metadata.attempt_id : null
    if (!attemptId) continue
    const bucket = attempts.get(attemptId) ?? { userId: row.user_id, events: [] }
    bucket.events.push({ name: row.name, createdAt: row.created_at, metadata: safeMetadata(row.metadata) })
    attempts.set(attemptId, bucket)
  }

  const activationAttempts = [...attempts.values()]
    .filter((attempt) => attempt.events.some((event) => event.name === 'activation_autostart_dispatched'))
    .map((attempt, index) => ({
      attempt: index + 1,
      events: attempt.events,
      outcome: attempt.events.some((event) => event.name === 'video_generation_completed')
        ? 'completed'
        : attempt.events.some((event) => event.name === 'video_generation_failed')
          ? 'failed'
          : attempt.events.some((event) => event.name === 'activation_autostart_checkpointed')
            ? 'checkpointed_pending'
            : 'dispatched_without_checkpoint',
    }))

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), windowHours: hours, activationAttempts }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
