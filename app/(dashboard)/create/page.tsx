import { Suspense } from 'react'
import CreateClient from './CreateClient'

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateClient />
    </Suspense>
  )
}
