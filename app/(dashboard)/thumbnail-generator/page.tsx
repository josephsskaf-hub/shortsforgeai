import { Metadata } from 'next'
import ThumbnailGeneratorClient from './ThumbnailGeneratorClient'

export const metadata: Metadata = {
  title: 'AI Thumbnail Generator | ShortsForge AI',
  description: 'Generate viral YouTube thumbnails with AI in seconds.',
}

export default function ThumbnailGeneratorPage() {
  return <ThumbnailGeneratorClient />
}
