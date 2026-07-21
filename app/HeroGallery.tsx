// Public proof used above the fold.
//
// These previews are compressed cuts from founder-owned Kineo exports that
// were explicitly selected for the public homepage. The shared allow-list also
// powers dedicated watch pages; private customer renders never enter it.
import Link from 'next/link'
import { PUBLIC_EXAMPLES } from '@/lib/publicExamples'

export default function HeroGallery() {
  return (
    <div id="samples" className="hero-gallery" aria-label="Real Shorts made with Kineo">
      {PUBLIC_EXAMPLES.map((example) => (
        <Link
          key={example.slug}
          href={`/examples/${example.slug}`}
          className="vcard"
          aria-label={`${example.title} — watch a real Kineo output preview`}
        >
          <video
            className="hvid"
            src={example.videoPath}
            poster={example.posterPath}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
          />
          <div className="vt">{example.shortTitle}</div>
        </Link>
      ))}
    </div>
  )
}
