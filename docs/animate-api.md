# Animate API

`POST /api/animate` runs the same 5-credit image-to-video pipeline as the
`/animate` page. Generation is asynchronous: the POST returns a request ID,
then the client polls the returned status URL until `clip_url` is available.

## Authentication

Send the signed-in user's short-lived Supabase access token:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

Browser calls may use the existing Kineo session cookie instead. A client may
obtain its current access token from `supabase.auth.getSession()`; never send a
`user_id`, service-role key, or another user's token. Supabase access tokens are
short-lived: refresh the session and replace the Bearer token when it expires.

## Start a clip

Every POST requires an idempotency key of 8-100 characters. Reusing the same
key with the same payload returns the original job; reusing it with a different
payload returns `409` and never submits or charges a second job.

```bash
curl -X POST "$BASE_URL/api/animate" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: batch-2026-07-22-scene-001" \
  -d '{
    "image_url": "https://images.example.com/scene-001.jpg",
    "motion_prompt": "subtle natural motion, cinematic camera push",
    "duration": 5
  }'
```

The image must be a public JPG or PNG no larger than 8 MB. Kineo downloads and
validates it on the server; the caller's browser never fetches the source URL.

Successful submission returns HTTP `202`:

```json
{
  "status": "processing",
  "request_id": "provider-request-id",
  "status_url": "https://example.com/api/animate?request_id=provider-request-id",
  "clip_url": null,
  "poll_after_ms": 5000,
  "image_url": "https://storage.example.com/imported.jpg",
  "duration": "5",
  "credits_charged": 5,
  "balance": 95
}
```

## Poll the job

```bash
curl "$STATUS_URL" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

While processing, GET returns HTTP `202`. When complete, it returns HTTP `200`:

```json
{
  "status": "done",
  "request_id": "provider-request-id",
  "clip_url": "https://cdn.example.com/clip.mp4",
  "video_url": "https://cdn.example.com/clip.mp4"
}
```

Terminal provider failure is automatically refunded and reported only after
the refund ledger is confirmed. `Retry-After` and `poll_after_ms` indicate when
the client should poll or retry.

## Errors and safe retries

- `400`: malformed JSON, URL, duration, or idempotency key.
- `401`: token/session missing or expired. Refresh authentication first.
- `402`: fewer than 5 credits are available; no provider job was submitted.
- `404`: the polled job does not belong to the authenticated user or does not exist.
- `413`: the downloaded image exceeds 8 MB.
- `415`: the source is not a valid JPG or PNG.
- `422`: the remote host could not deliver a usable image.
- `409`: the same key is already in progress, belongs to another payload, or a
  refunded attempt is closed. Keep retrying the same key only when the response
  says it is pending. If `retry_same_idempotency_key` is `true`, retry that same
  key immediately. When `use_new_idempotency_key` is `true`, create a new key.
- `429`: too many concurrent/recent or refunded attempts; respect `Retry-After`.
- `502`: the provider reported terminal failure; any debit is confirmed refunded
  before this response is returned.
- `503`: safety storage, debit, refund, or provider acknowledgement is being
  reconciled. Do not create a new key or send a second scene while `pending` is
  `true`; retry the same request after `Retry-After`.
- `504`: the source host timed out. Reuse the same key; Kineo will reconcile the
  existing attempt safely.

Network timeout, an unreadable response body, or any uncertain `5xx` response
is never a reason to create a new idempotency key. Retry the identical payload
and key so Kineo can recover the original request safely.
