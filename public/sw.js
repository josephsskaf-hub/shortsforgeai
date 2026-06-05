/* Push #427 — ShortsForgeAI service worker.
 * Purpose: receive Web Push and show the "video ready" notification.
 * Pushes are sent WITHOUT payload (no encryption needed server-side),
 * so the notification text lives here. Click opens My Videos.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  // Payload-less push → static notification. If a payload ever gets added
  // server-side, prefer it.
  let title = '🎬 Your video is ready!'
  let body = 'Tap to watch and download your Short.'
  let url = '/history'
  try {
    if (event.data) {
      const d = event.data.json()
      if (d.title) title = d.title
      if (d.body) body = d.body
      if (d.url) url = d.url
    }
  } catch {
    /* keep defaults */
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'video-ready',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/history'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
