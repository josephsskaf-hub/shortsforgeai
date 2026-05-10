import { Suspense } from 'react'
import GenerateClient from './GenerateClient'

export const dynamic = 'force-dynamic'

export default function GeneratePage() {
  return (
    <Suspense fallback={null}>
      <GenerateClient />
    </Suspense>
  )
}
