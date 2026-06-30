import { Metadata } from 'next'
import ThumbnailGeneratorClient from './ThumbnailGeneratorClient'

export const metadata: Metadata = {
  title: 'AI Thumbnail Generator | Kineo',
  description: 'Generate viral YouTube thumbnails with AI in seconds.',
}

export default function ThumbnailGeneratorPage() {
  return <ThumbnailGeneratorClient />
}
