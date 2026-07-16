import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { writeServerEvent } from '@/lib/serverEvents'
import GenerateClient from './GenerateClient'

export const dynamic = 'force-dynamic'

type GeneratePageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

function generatePath(searchParams: GeneratePageProps['searchParams']): string {
  const params = new URLSearchParams()
  for (const [rawKey, rawValue] of Object.entries(searchParams ?? {})) {
    const key = rawKey.slice(0, 64)
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    for (const value of values) {
      if (typeof value === 'string') params.append(key, value.slice(0, 2000))
    }
  }
  const query = params.toString()
  return query ? `/generate?${query}` : '/generate'
}

function firstParam(
  searchParams: GeneratePageProps['searchParams'],
  key: string,
): string | null {
  const value = searchParams?.[key]
  return typeof value === 'string'
    ? value
    : Array.isArray(value) && typeof value[0] === 'string'
      ? value[0]
      : null
}

export default async function GeneratePage({ searchParams }: GeneratePageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const activationEntry = firstParam(searchParams, 'signup') === '1'
    ? 'oauth_signup'
    : firstParam(searchParams, 'welcome') === '1'
      ? 'email_signup'
      : 'standard'
  const sessionId = cookies().get('kineo_event_session_id')?.value ?? null
  const path = generatePath(searchParams)

  if (!user) {
    if (activationEntry !== 'standard') {
      await writeServerEvent({
        name: 'generate_activation_auth_missing',
        path: '/generate',
        sessionId,
        metadata: { activation_entry: activationEntry },
      })
    }
    // Resolve missing/late auth on the server and preserve the complete local
    // destination. The login page resumes this exact activation path.
    redirect(`/login?redirect=${encodeURIComponent(path)}`)
  }

  await writeServerEvent({
    name: 'generate_arrived_server',
    userId: user.id,
    path: '/generate',
    sessionId,
    metadata: {
      activation_entry: activationEntry,
      has_prompt: Boolean(firstParam(searchParams, 'prompt')?.trim()),
      autoanalyze: firstParam(searchParams, 'autoanalyze') === '1',
    },
  })

  return (
    <Suspense fallback={null}>
      <GenerateClient />
    </Suspense>
  )
}
