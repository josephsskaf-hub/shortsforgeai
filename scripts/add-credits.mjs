import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing Supabase env vars')

const supabase = createClient(url, key, { auth: { persistSession: false } })

const TARGET_EMAILS = ['josephsskaf@gmail.com', 'josephskaf@hotmail.com']
const NEW_CREDITS = 500

async function main() {
  console.log('Looking up profiles by email...')
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, video_credits, is_pro, created_at')
    .in('email', TARGET_EMAILS)

  if (pErr) {
    console.error('profiles lookup error:', pErr)
    process.exit(1)
  }

  console.log('Matched profiles:', JSON.stringify(profiles, null, 2))

  if (!profiles || profiles.length === 0) {
    console.log('No profile found by email — falling back to auth.admin.listUsers()')
    const { data: usersData, error: uErr } = await supabase.auth.admin.listUsers()
    if (uErr) {
      console.error('listUsers error:', uErr)
      process.exit(1)
    }
    const found = usersData.users.filter((u) =>
      TARGET_EMAILS.includes((u.email || '').toLowerCase())
    )
    console.log('Auth users matched:', found.map((u) => ({ id: u.id, email: u.email })))
    if (found.length === 0) {
      console.error('No matching auth user. Aborting.')
      process.exit(1)
    }
    for (const u of found) {
      const { error: upErr } = await supabase
        .from('profiles')
        .upsert({ id: u.id, email: u.email, video_credits: NEW_CREDITS })
      if (upErr) console.error('upsert error for', u.email, upErr)
      else console.log('upserted', u.email, '->', NEW_CREDITS)
    }
  } else {
    for (const p of profiles) {
      const { data: upd, error: uErr } = await supabase
        .from('profiles')
        .update({ video_credits: NEW_CREDITS })
        .eq('id', p.id)
        .select('id, email, video_credits')
      if (uErr) console.error('update error for', p.email, uErr)
      else console.log('updated:', upd)
    }
  }

  console.log('\n--- Verify ---')
  const { data: verify, error: vErr } = await supabase
    .from('profiles')
    .select('id, email, video_credits, is_pro')
    .in('email', TARGET_EMAILS)
  if (vErr) console.error('verify error:', vErr)
  else console.log(JSON.stringify(verify, null, 2))
}

main().catch((e) => {
  console.error('fatal:', e)
  process.exit(1)
})
