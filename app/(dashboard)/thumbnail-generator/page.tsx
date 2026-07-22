import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ThumbnailGeneratorClient from './ThumbnailGeneratorClient'

export const metadata: Metadata = {
  title: 'AI Thumbnail Generator | Kineo',
  description: 'Generate viral YouTube thumbnails with AI in seconds.',
}

const OWNER_EMAIL = 'josephsskaf@gmail.com'
const OWNER_DAILY_LIMIT = 100

export default async function ThumbnailGeneratorPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isOwner = user?.email?.trim().toLowerCase() === OWNER_EMAIL

  return (
    <ThumbnailGeneratorClient
      dailyLimit={isOwner ? OWNER_DAILY_LIMIT : undefined}
    />
  )
}
