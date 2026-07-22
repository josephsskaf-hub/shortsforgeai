import { promises as dns } from 'node:dns'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'

export const MAX_ANIMATE_IMAGE_BYTES = 8 * 1024 * 1024

const MAX_URL_LENGTH = 2048
const MAX_REDIRECTS = 3
const DNS_TIMEOUT_MS = 5_000
const REQUEST_TIMEOUT_MS = 12_000
const DOWNLOAD_DEADLINE_MS = 25_000
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png'])
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export type AnimateImageMime = 'image/jpeg' | 'image/png'

export class RemoteImageError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'RemoteImageError'
    this.status = status
  }
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split('.').map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [a, b, c] = octets
  if (a === 0 || a === 10 || a === 127) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 0 && c === 0) return false
  if (a === 192 && b === 0 && c === 2) return false
  if (a === 192 && b === 88 && c === 99) return false
  if (a === 192 && b === 168) return false
  if (a === 198 && (b === 18 || b === 19)) return false
  if (a === 198 && b === 51 && c === 100) return false
  if (a === 203 && b === 0 && c === 113) return false
  if (a >= 224) return false
  return true
}

function ipv6Bytes(input: string): number[] | null {
  let address = input.toLowerCase().split('%')[0]
  if (address.startsWith('[') && address.endsWith(']')) address = address.slice(1, -1)

  if (address.includes('.')) {
    const lastColon = address.lastIndexOf(':')
    if (lastColon < 0) return null
    const ipv4 = address.slice(lastColon + 1)
    if (!isIP(ipv4) || isIP(ipv4) !== 4) return null
    const octets = ipv4.split('.').map(Number)
    const high = ((octets[0] << 8) | octets[1]).toString(16)
    const low = ((octets[2] << 8) | octets[3]).toString(16)
    address = `${address.slice(0, lastColon)}:${high}:${low}`
  }

  const halves = address.split('::')
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const missing = 8 - left.length - right.length
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null
  const groups = halves.length === 2
    ? [...left, ...Array(missing).fill('0'), ...right]
    : left
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null

  const bytes: number[] = []
  for (const group of groups) {
    const value = Number.parseInt(group, 16)
    bytes.push((value >> 8) & 0xff, value & 0xff)
  }
  return bytes
}

function isPublicIpv6(address: string): boolean {
  const bytes = ipv6Bytes(address)
  if (!bytes) return false

  const firstTwelveZero = bytes.slice(0, 12).every((byte) => byte === 0)
  if (firstTwelveZero) return false // unspecified, loopback and deprecated IPv4-compatible forms

  const ipv4Mapped = bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff
  if (ipv4Mapped) return isPublicIpv4(bytes.slice(12).join('.'))

  if ((bytes[0] & 0xfe) === 0xfc) return false // unique-local fc00::/7
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return false // link-local fe80::/10
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return false // deprecated site-local fec0::/10
  if (bytes[0] === 0xff) return false // multicast
  if (bytes[0] === 0x01 && bytes.slice(1, 8).every((byte) => byte === 0)) return false // discard-only 100::/64
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) return false // NAT64
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) return false // Teredo
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return false // 6to4
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return false // docs
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x02) return false // benchmark
  if (
    bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 &&
    ((bytes[3] & 0xf0) === 0x10 || (bytes[3] & 0xf0) === 0x20)
  ) return false // ORCHID v1/v2

  return (bytes[0] & 0xe0) === 0x20 // global unicast 2000::/3
}

export function isPublicNetworkAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isPublicIpv4(address)
  if (family === 6) return isPublicIpv6(address)
  return false
}

function parseRemoteUrl(rawUrl: string): URL {
  const raw = rawUrl.trim()
  if (!raw || raw.length > MAX_URL_LENGTH) {
    throw new RemoteImageError('Enter a valid public JPG or PNG URL.')
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new RemoteImageError('Enter a valid public JPG or PNG URL.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new RemoteImageError('The image URL must use HTTP or HTTPS.')
  }
  if (url.username || url.password) {
    throw new RemoteImageError('Image URLs with embedded credentials are not supported.')
  }
  const allowedPort = !url.port || (url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')
  if (!allowedPort) throw new RemoteImageError('The image URL must use a standard HTTP or HTTPS port.')

  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (
    !hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') || hostname.endsWith('.internal') ||
    hostname.endsWith('.home') || hostname.endsWith('.lan')
  ) {
    throw new RemoteImageError('The image URL must point to a public internet host.')
  }
  return url
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new RemoteImageError(message, 504)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function timeRemaining(deadline: number): number {
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new RemoteImageError('The image download took too long.', 504)
  return remaining
}

async function resolvePinnedAddress(url: URL, deadline: number): Promise<{ address: string; family: 4 | 6 }> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(hostname)) {
    if (!isPublicNetworkAddress(hostname)) {
      throw new RemoteImageError('The image URL must point to a public internet host.')
    }
    return { address: hostname, family: isIP(hostname) as 4 | 6 }
  }

  const addresses = await withTimeout(
    dns.lookup(hostname, { all: true, verbatim: true }),
    Math.min(DNS_TIMEOUT_MS, timeRemaining(deadline)),
    'The image host took too long to resolve.',
  )
  if (!addresses.length || addresses.some(({ address }) => !isPublicNetworkAddress(address))) {
    throw new RemoteImageError('The image URL must point to a public internet host.')
  }
  const selected = addresses.find(({ family }) => family === 4) ?? addresses[0]
  return { address: selected.address, family: selected.family as 4 | 6 }
}

async function openPinnedResponse(url: URL, deadline: number): Promise<IncomingMessage> {
  const pinned = await resolvePinnedAddress(url, deadline)
  const lookup: LookupFunction = (_hostname, _options, callback) => {
    if (_options.all) {
      callback(null, [{ address: pinned.address, family: pinned.family }])
      return
    }
    callback(null, pinned.address, pinned.family)
  }
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest

  return new Promise<IncomingMessage>((resolve, reject) => {
    const remaining = timeRemaining(deadline)
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null
    const req = request(url, {
      method: 'GET',
      lookup,
      headers: {
        Accept: 'image/png,image/jpeg;q=0.9',
        'Accept-Encoding': 'identity',
        'User-Agent': 'Kineo-Remote-Image/1.0',
      },
    }, (response) => {
      if (deadlineTimer) clearTimeout(deadlineTimer)
      resolve(response)
    })
    deadlineTimer = setTimeout(() => {
      req.destroy(new RemoteImageError('The image download took too long.', 504))
    }, remaining)
    req.setTimeout(Math.min(REQUEST_TIMEOUT_MS, remaining), () => {
      req.destroy(new RemoteImageError('The image host took too long to respond.', 504))
    })
    req.on('error', (error) => {
      if (deadlineTimer) clearTimeout(deadlineTimer)
      reject(error instanceof RemoteImageError
        ? error
        : new RemoteImageError('Could not download the image from that host.', 502))
    })
    req.end()
  })
}

function contentTypeOf(response: IncomingMessage): AnimateImageMime {
  const rawHeader = response.headers['content-type']
  const raw = (Array.isArray(rawHeader) ? rawHeader[0] : rawHeader ?? '').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_CONTENT_TYPES.has(raw)) {
    throw new RemoteImageError('That URL did not return a JPG or PNG image.', 415)
  }
  return raw === 'image/png' ? 'image/png' : 'image/jpeg'
}

function detectImageMime(buffer: Buffer): AnimateImageMime | null {
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (isPng) return 'image/png'
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (isJpeg) return 'image/jpeg'
  return null
}

export async function downloadPublicAnimateImage(rawUrl: string): Promise<{
  buffer: Buffer
  contentType: AnimateImageMime
  finalUrl: string
}> {
  let url = parseRemoteUrl(rawUrl)
  const deadline = Date.now() + DOWNLOAD_DEADLINE_MS

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await openPinnedResponse(url, deadline)
    const status = response.statusCode ?? 0

    if (REDIRECT_STATUSES.has(status)) {
      const locationHeader = response.headers.location
      response.destroy()
      if (!locationHeader) throw new RemoteImageError('The image host returned an invalid redirect.', 502)
      if (redirects === MAX_REDIRECTS) throw new RemoteImageError('The image URL redirected too many times.')
      try {
        url = parseRemoteUrl(new URL(locationHeader, url).toString())
      } catch (error) {
        if (error instanceof RemoteImageError) throw error
        throw new RemoteImageError('The image host returned an invalid redirect.', 502)
      }
      continue
    }

    if (status !== 200) {
      response.destroy()
      throw new RemoteImageError(`Could not download the image (HTTP ${status || 'error'}).`, 422)
    }

    const encodingHeader = response.headers['content-encoding']
    const encoding = (Array.isArray(encodingHeader) ? encodingHeader[0] : encodingHeader ?? 'identity').toLowerCase()
    if (encoding !== 'identity') {
      response.destroy()
      throw new RemoteImageError('Compressed image responses are not supported.', 415)
    }
    let declaredMime: AnimateImageMime
    try {
      declaredMime = contentTypeOf(response)
    } catch (error) {
      response.destroy()
      throw error
    }
    const lengthHeader = response.headers['content-length']
    const declaredLength = Number(Array.isArray(lengthHeader) ? lengthHeader[0] : lengthHeader)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_ANIMATE_IMAGE_BYTES) {
      response.destroy()
      throw new RemoteImageError('Photo is too large — max 8 MB.', 413)
    }

    const chunks: Buffer[] = []
    let total = 0
    let bodyTimeoutMs: number
    try {
      bodyTimeoutMs = Math.min(REQUEST_TIMEOUT_MS, timeRemaining(deadline))
    } catch (error) {
      response.destroy()
      throw error
    }
    const bodyTimer = setTimeout(() => {
      response.destroy(new RemoteImageError('The image download took too long.', 504))
    }, bodyTimeoutMs)
    try {
      for await (const chunk of response) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        total += bytes.length
        if (total > MAX_ANIMATE_IMAGE_BYTES) {
          response.destroy()
          throw new RemoteImageError('Photo is too large — max 8 MB.', 413)
        }
        chunks.push(bytes)
      }
    } catch (error) {
      throw error instanceof RemoteImageError
        ? error
        : new RemoteImageError('Could not finish downloading the image.', 502)
    } finally {
      clearTimeout(bodyTimer)
    }
    if (total === 0) throw new RemoteImageError('The image download was empty.', 422)

    const buffer = Buffer.concat(chunks, total)
    const detectedMime = detectImageMime(buffer)
    if (!detectedMime || detectedMime !== declaredMime) {
      throw new RemoteImageError('The downloaded file was not a valid JPG or PNG image.', 415)
    }
    return { buffer, contentType: detectedMime, finalUrl: url.toString() }
  }

  throw new RemoteImageError('The image URL redirected too many times.')
}
