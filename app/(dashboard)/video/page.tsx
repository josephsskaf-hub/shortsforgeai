import { Suspense } from 'react'
import VideoClient from './VideoClient'

export default function VideoPage() {
  return (
    <Suspense fallback={null}>
      <VideoClient />
    </Suspense>
  )
}
