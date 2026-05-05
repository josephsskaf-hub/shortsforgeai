# ShortsForgeAI — Deployment Guide

A complete step-by-step guide to go from zero to live production.

---

## Prerequisites

- Node.js 18+
- A Vercel account (free tier works)
- A Supabase account (free tier works)
- A Stripe account
- An OpenAI account with API access

---

## Step 1 — Create Supabase Project + Run Schema

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Wait for the project to finish provisioning (~1-2 min).
3. In the Supabase dashboard, go to **SQL Editor**.
4. Paste the entire contents of `supabase-schema.sql` and click **Run**.
5. Verify tables `profiles` and `generations` appear under **Table Editor**.
6. Collect your credentials from **Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL` → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY` → service_role key (keep secret!)

### Disable Email Confirmation (optional but recommended for faster testing)

Go to **Authentication → Providers → Email** and disable "Confirm email".
Users will be signed in immediately after signup.

---

## Step 2 — Create Stripe Product + Get Price ID

1. Go to [stripe.com](https://stripe.com) and log in.
2. Navigate to **Products → Add product**.
3. Set:
   - Name: `ShortsForgeAI Pro`
   - Pricing model: `Recurring`
   - Price: `$5.00 / month`
4. Click **Save product**.
5. On the product page, click the price to see its details.
6. Copy the **Price ID** (format: `price_xxxxxxxxxxxxxxxx`).
7. This is your `STRIPE_PRICE_ID`.
8. Also collect:
   - `STRIPE_SECRET_KEY` from **Developers → API keys → Secret key**
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` from **Developers → API keys → Publishable key**

---

## Step 3 — Set Up Stripe Webhook

The webhook keeps your database in sync with Stripe subscription status.

1. In Stripe dashboard, go to **Developers → Webhooks → Add endpoint**.
2. Set endpoint URL to: `https://your-app.vercel.app/api/stripe/webhook`
   (Replace with your actual Vercel URL — you'll get this after Step 6)
3. Select these events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Click **Add endpoint**.
5. On the webhook details page, reveal and copy the **Signing secret** (format: `whsec_...`).
6. This is your `STRIPE_WEBHOOK_SECRET`.

> **Note:** For local testing, use [Stripe CLI](https://stripe.com/docs/stripe-cli):
> `stripe listen --forward-to localhost:3000/api/stripe/webhook`

---

## Step 4 — Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com).
2. Navigate to **API keys → Create new secret key**.
3. Copy the key — this is your `OPENAI_API_KEY`.
4. Ensure you have credits/billing set up (gpt-4o-mini is very cheap, ~$0.15/1M tokens).

---

## Step 5 — Set Environment Variables in Vercel

You'll set these during the Vercel deploy (Step 6), or in your project's **Settings → Environment Variables** after deploying.

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_ID=price_...
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

> For local development, copy `.env.local.example` to `.env.local` and fill in your values.

---

## Step 6 — Deploy to Vercel

### Option A — Vercel CLI (recommended)

```bash
# Install Vercel CLI if you haven't
npm install -g vercel

# From the shortsforgeai directory:
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: shortsforgeai
# - Directory: ./
# - Override settings? No

# Deploy to production:
vercel --prod
```

### Option B — GitHub + Vercel Dashboard

1. Push the `shortsforgeai` folder to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new).
3. Import your GitHub repo.
4. Add all environment variables in the Vercel setup wizard.
5. Click **Deploy**.

After deploy, copy your production URL (e.g. `https://shortsforgeai.vercel.app`).

---

## Step 7 — Configure Supabase Redirect URLs

1. In Supabase dashboard, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel URL: `https://your-app.vercel.app`
3. Under **Redirect URLs**, add:
   - `https://your-app.vercel.app/dashboard`
   - `https://your-app.vercel.app/auth/callback`
4. Click **Save**.

---

## Step 8 — Update Stripe Webhook URL

Go back to your Stripe webhook (from Step 3) and update the endpoint URL to your actual Vercel production URL:

```
https://your-app.vercel.app/api/stripe/webhook
```

---

## Step 9 — Verify Everything Works

1. Visit your app URL and sign up for a new account.
2. You should land on `/dashboard` immediately.
3. Click **Generate 5 Viral Shorts Now** on any niche card.
4. Check that scripts appear correctly.
5. Visit `/pricing` and click **Upgrade to Pro**.
6. Use Stripe's test card `4242 4242 4242 4242` (any future date, any CVC).
7. After payment, you should be redirected to `/dashboard?upgraded=true`.
8. Refresh — your plan badge should show **Pro**.
9. Verify the webhook fired: in Stripe → Developers → Webhooks → your endpoint → Events.

---

## Local Development

```bash
cd shortsforgeai
cp .env.local.example .env.local
# Fill in .env.local with your values

npm install
npm run dev
# App runs at http://localhost:3000
```

For Stripe webhooks locally:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## Architecture Notes

- **Auth**: Supabase email/password. Sessions are managed via cookies (SSR-compatible).
- **Free limit**: `profiles.generations_used` increments on each generation. Checked server-side in `/api/generate`.
- **Pro upgrade**: Stripe Checkout → webhook → sets `profiles.is_pro = true`.
- **Webhook security**: Stripe signature verified with `stripe.webhooks.constructEvent()`.
- **AI generation**: GPT-4o-mini returns JSON array of 5 shorts. Saved to `generations` table.
- **Middleware**: `middleware.ts` protects all `/dashboard`, `/history`, `/pricing` routes.

---

## Estimated Monthly Costs at Scale

| Users | OpenAI (gpt-4o-mini) | Supabase | Vercel | Total |
|-------|---------------------|----------|--------|-------|
| 100   | ~$2                 | Free     | Free   | ~$2   |
| 1,000 | ~$20                | Free     | $20    | ~$40  |
| 10,000| ~$200               | $25      | $20    | ~$245 |

Revenue at 1,000 Pro users @ $5/mo = **$5,000/month** 🚀
