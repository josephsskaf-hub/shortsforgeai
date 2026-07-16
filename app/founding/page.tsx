import { redirect } from 'next/navigation'

// Defense in depth for the retired founding offer. next.config.js performs the
// edge redirect, while this route prevents the old 50%-for-life checkout from
// returning if that configuration is ever changed.
export default function FoundingPage() {
  redirect('/pricing')
}
