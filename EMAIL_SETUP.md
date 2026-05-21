# ShortsForgeAI — Email Domain Setup Plan

> **Task #060** | Staging only — do NOT merge to main until all steps below are ✅

---

## 1. Official Email Plan

| Address | Purpose |
|---|---|
| `hello@shortsforgeai.com` | Transactional sender (welcome emails, notifications) |
| `support@shortsforgeai.com` | Customer-facing support inbox |

Both addresses must be routed/forwarded to Joseph's Gmail until a dedicated inbox is set up.

---

## 2. Current Email Provider & Status

| Item | Value |
|---|---|
| **Provider** | Resend (via direct `fetch` to `https://api.resend.com/emails`) |
| **Auth** | `RESEND_API_KEY` environment variable |
| **Sender env var** | `RESEND_FROM_EMAIL` |
| **Sender fallback in code** | `ShortsForgeAI <hello@shortsforgeai.com>` |
| **Domain verified in Resend** | ❌ NOT YET — "No domains yet" on dashboard |

### Routes that send email

| Route / File | What it does | Email provider |
|---|---|---|
| `app/api/send-welcome/route.ts` | Sends welcome email after signup (2 free credits, dashboard CTA) | **Resend** |
| `app/(auth)/signup/page.tsx` | Triggers `supabase.auth.signUp` — Supabase sends confirmation email | Supabase (not Resend) |
| `app/(auth)/forgot-password/page.tsx` | Triggers `supabase.auth.resetPasswordForEmail` — Supabase sends reset link | Supabase (not Resend) |

> **Note:** The welcome email route (`/api/send-welcome`) is the only route that uses Resend directly.
> It has a safe guard: if `RESEND_API_KEY` is missing or set to the placeholder, it silently skips
> and returns `{ skipped: true }` — signup never breaks.

---

## 3. DNS Records Required for Resend Domain Verification

**DNS Provider: GoDaddy** (nameservers: `ns49.domaincontrol.com`, `ns50.domaincontrol.com`)

After you add `shortsforgeai.com` in the Resend dashboard, Resend will display the exact DNS records to add. The typical set is:

### SPF (TXT on root domain)

```
Type:  TXT
Name:  @  (or shortsforgeai.com)
Value: v=spf1 include:amazonses.com ~all
TTL:   Auto / 3600
```

### DKIM (TXT — value unique to your Resend account)

```
Type:  TXT
Name:  resend._domainkey
Value: <copy exact value from Resend dashboard after adding domain>
TTL:   Auto / 3600
```

### DMARC (TXT — recommended)

```
Type:  TXT
Name:  _dmarc
Value: v=DMARC1; p=none; rua=mailto:josephsskaf@gmail.com
TTL:   Auto / 3600
```

> ⚠️ **The DKIM value is unique per account.** You MUST copy it from the Resend dashboard —
> never guess or paste a generic value here.

---

## 4. Step-by-Step Checklist for Joseph

### Step A — Add domain in Resend

- [ ] Go to [https://resend.com/domains](https://resend.com/domains)
- [ ] Click **Add Domain**
- [ ] Enter `shortsforgeai.com`
- [ ] Copy the three DNS records Resend shows you (SPF, DKIM, DMARC)

### Step B — Add DNS records in GoDaddy

- [ ] Go to [https://dcc.godaddy.com/manage/dns](https://dcc.godaddy.com/manage/dns)
- [ ] Select `shortsforgeai.com`
- [ ] Add the **SPF TXT record** (Name: `@`)
- [ ] Add the **DKIM TXT record** (Name: `resend._domainkey`)
- [ ] Add the **DMARC TXT record** (Name: `_dmarc`)
- [ ] Save all records

> DNS propagation typically takes 15–60 minutes; up to 48 hours worst case.

### Step C — Verify in Resend

- [ ] Return to [https://resend.com/domains](https://resend.com/domains)
- [ ] Click **Verify DNS Records** (or wait for Resend to auto-check)
- [ ] Confirm all three checks show ✅ green

### Step D — Update production environment variables

Only after Step C shows full green:

- [ ] In Vercel → Project → Settings → Environment Variables (Production):
  - Set `RESEND_FROM_EMAIL` = `ShortsForgeAI <hello@shortsforgeai.com>`
  - Confirm `NEXT_PUBLIC_APP_URL` = `https://www.shortsforgeai.com`
- [ ] Redeploy production (or wait for next push to main)

### Step E — Test

- [ ] Sign up with a real email address on production
- [ ] Confirm the welcome email arrives from `hello@shortsforgeai.com`
- [ ] Check spam folder — if it lands there, DMARC policy may need tightening (`p=quarantine`)
- [ ] Send a password reset from the forgot-password page (Supabase email — check separately in Supabase dashboard > Auth > Email Templates)

---

## 5. When Is It Safe to Update `RESEND_FROM_EMAIL`?

**Only after all three Resend DNS checks are green (SPF ✅ DKIM ✅ DMARC ✅).**

Until then the code falls back to `ShortsForgeAI <hello@shortsforgeai.com>` in the source,
but Resend will **reject** the send because the domain is unverified. The route handles this
gracefully — it logs the error and returns `{ sent: false }` without breaking signup.

**Do NOT** set `RESEND_FROM_EMAIL` in production before verification — it will cause every
welcome email to silently fail.

---

## 6. Email Receiving Setup (Forwarding to Gmail)

Joseph needs to receive mail sent to `hello@` and `support@shortsforgeai.com`.
Since DNS is managed by GoDaddy, the easiest free options are:

### Option A — Cloudflare Email Routing (Recommended)

1. Transfer DNS management to Cloudflare (free plan):
   - Sign up at [cloudflare.com](https://cloudflare.com)
   - Add site `shortsforgeai.com`
   - Cloudflare will copy your existing DNS records
   - Update GoDaddy nameservers to point to Cloudflare's NS (takes up to 24h)
2. In Cloudflare dashboard → Email → Email Routing → Enable
3. Add routing rules:
   - `hello@shortsforgeai.com` → `josephsskaf@gmail.com`
   - `support@shortsforgeai.com` → `josephsskaf@gmail.com`
4. Cloudflare auto-adds the required MX records

> **Advantage:** Completely free. Works with Google Workspace later. Cloudflare DNS is also faster
> and gives you a free CDN layer.

### Option B — ImprovMX (No DNS migration required)

1. Go to [https://improvmx.com](https://improvmx.com) and add `shortsforgeai.com`
2. Add the two MX records ImprovMX provides into GoDaddy
3. Forward `hello@` and `support@` to `josephsskaf@gmail.com`
4. Free tier supports up to 25 aliases

### Option C — Forward Email (Open source, free)

1. Go to [https://forwardemail.net](https://forwardemail.net)
2. Add domain, add MX + TXT records in GoDaddy
3. Configure forwarding rules

> For a solo founder, **Option A (Cloudflare)** is the best long-term choice — it also improves
> site performance and gives you free email routing that scales.

---

## 7. Environment Variables to Update Once Domain Is Verified

These go in **Vercel → Production environment variables** (and optionally in `.env.local` for local testing):

```env
# Already correct in .env.local.example — confirm in Vercel Production
NEXT_PUBLIC_APP_URL=https://www.shortsforgeai.com

# Update ONLY after Resend shows SPF ✅ DKIM ✅ DMARC ✅
RESEND_FROM_EMAIL=ShortsForgeAI <hello@shortsforgeai.com>
```

---

## 8. Test Steps After Verification

1. **Welcome email**: Sign up a new account → check inbox for `hello@shortsforgeai.com` sender
2. **Password reset**: Request reset on `/forgot-password` → Supabase sends reset link (sender configured in Supabase dashboard, not Resend)
3. **Spam check**: Use [mail-tester.com](https://mail-tester.com) to score deliverability — target 9+/10
4. **DMARC report**: After 24h, check `josephsskaf@gmail.com` for DMARC aggregate reports

---

## 9. Current `.env.local.example` Status

| Variable | Status |
|---|---|
| `NEXT_PUBLIC_APP_URL` | ✅ Already set to `https://www.shortsforgeai.com` |
| `RESEND_API_KEY` | ❌ Not in example file — add placeholder after domain verified |
| `RESEND_FROM_EMAIL` | ❌ Not in example file — add placeholder after domain verified |

---

*Generated by Task #060 on 2026-05-14. Do not merge to main until domain verification is complete.*
