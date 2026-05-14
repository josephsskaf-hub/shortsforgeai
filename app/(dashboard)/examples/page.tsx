// Push #060 — Examples / gallery page.
// Static showcase of 6 prompt categories. Server component just renders
// the client; data is hard-coded inside the client component so we don't
// need any Supabase queries here.

import ExamplesClient from './ExamplesClient'

export const dynamic = 'force-dynamic'

export default function ExamplesPage() {
  return <ExamplesClient />
}
