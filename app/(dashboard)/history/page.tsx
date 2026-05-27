import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MyVideosClient from './HistoryClient'

export default async function MyVideosPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: videos } = await supabase
    .from('videos')
    .select('id, video_url, thumbnail_url, topic, youtube_description, hashtags, status, quality_mode, credits_used, created_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(100)

  return <MyVideosClient videos={videos ?? []} />
}
