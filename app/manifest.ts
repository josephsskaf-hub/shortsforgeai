import type { MetadataRoute } from 'next'

// Push #422 — PWA manifest. Makes shortsforgeai.com installable on
// iPhone/Android ("Add to Home Screen"): full-screen standalone window,
// branded icon and splash colors. Next.js serves this at
// /manifest.webmanifest and auto-injects the <link> tag site-wide.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kineo — AI YouTube Shorts Generator',
    short_name: 'Kineo',
    description:
      'Turn any topic into a viral YouTube Short in 60 seconds. AI writes the script, finds footage, adds voiceover & captions.',
    id: '/',
    start_url: '/generate',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0d0d14',
    theme_color: '#0d0d14',
    categories: ['productivity', 'video'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
