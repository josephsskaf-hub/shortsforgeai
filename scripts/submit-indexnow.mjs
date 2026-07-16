const HOST = 'www.usekineo.com'
const ORIGIN = `https://${HOST}`
const KEY = '8ee9f362d6ec4042b723993c3e15936b'
const KEY_LOCATION = `${ORIGIN}/${KEY}.txt`
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

function fail(message) {
  throw new Error(`[indexnow] ${message}`)
}

const submit = process.argv.includes('--submit')

const sitemapResponse = await fetch(`${ORIGIN}/sitemap.xml`, {
  headers: { 'user-agent': 'Kineo-IndexNow/1.0' },
})

if (!sitemapResponse.ok) {
  fail(`sitemap returned HTTP ${sitemapResponse.status}`)
}

const sitemapXml = await sitemapResponse.text()
const urlList = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => match[1].trim())
  .filter((url, index, urls) => urls.indexOf(url) === index)

if (urlList.length === 0) fail('sitemap contains no URLs')
if (urlList.length > 10_000) fail('sitemap exceeds the IndexNow batch limit')

for (const rawUrl of urlList) {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:' || url.host !== HOST) {
    fail(`non-canonical URL refused: ${rawUrl}`)
  }
}

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList,
}

if (!submit) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    endpoint: INDEXNOW_ENDPOINT,
    keyLocation: KEY_LOCATION,
    urlCount: urlList.length,
    firstUrl: urlList[0],
    lastUrl: urlList[urlList.length - 1],
  }, null, 2))
} else {
  const keyResponse = await fetch(KEY_LOCATION, {
    headers: { 'user-agent': 'Kineo-IndexNow/1.0' },
  })
  if (!keyResponse.ok) fail(`key file returned HTTP ${keyResponse.status}`)
  if ((await keyResponse.text()).trim() !== KEY) fail('key file contents do not match')

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })

  if (response.status !== 200 && response.status !== 202) {
    const body = (await response.text()).slice(0, 500)
    fail(`submission returned HTTP ${response.status}${body ? `: ${body}` : ''}`)
  }

  console.log(JSON.stringify({
    mode: 'submitted',
    httpStatus: response.status,
    urlCount: urlList.length,
    host: HOST,
    keyLocation: KEY_LOCATION,
    submittedAt: new Date().toISOString(),
  }, null, 2))
}
