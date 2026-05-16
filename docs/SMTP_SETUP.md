# Supabase Auth Custom SMTP via Resend

This is a one-time manual setup. The Supabase dashboard is not configurable
from the application code, so the steps below have to be performed in the
Supabase web UI by a project admin.

## Why

By default, Supabase sends auth emails (signup confirmation, magic link,
password reset) from `noreply@mail.app.supabase.io`. These emails:

- come from a Supabase-owned domain — bad for deliverability and brand,
- are rate-limited per project,
- cannot be templated beyond the built-in editor.

Routing through Resend with our own domain (`shortsforgeai.com`) fixes
all three.

## Steps

1. Open the Supabase dashboard for the production project.
2. Go to **Authentication** → **Settings** → **SMTP Settings**.
3. Enable **Custom SMTP** and fill in:

   | Field         | Value                                          |
   | ------------- | ---------------------------------------------- |
   | Host          | `smtp.resend.com`                              |
   | Port          | `587`                                          |
   | Username      | `resend`                                       |
   | Password      | The `RESEND_API_KEY` from Resend (do NOT commit) |
   | Sender email  | `hello@shortsforgeai.com`                      |
   | Sender name   | `ShortsForgeAI`                                |

4. Click **Save**.
5. Use **Send test email** in the same panel to confirm delivery.
6. Trigger a real signup with a fresh email to verify the confirmation
   flow lands in the inbox (not spam).

## Domain prerequisites in Resend

Before step 3 will work, the Resend dashboard must have:

- The `shortsforgeai.com` domain added under **Domains**.
- SPF, DKIM, and DMARC DNS records published and verified (green
  checkmarks in Resend).
- An API key generated under **API Keys** with **Send access** scope.

If `hello@shortsforgeai.com` is not yet a configured sender, add it as a
verified sender in Resend before saving the SMTP settings, otherwise
Supabase's test email will fail with a "from address not verified" error.

## Vercel environment variables

The application also reads a Resend API key for the in-app welcome email
(separate from the Supabase auth email path). Make sure these are set in
Vercel for both the staging and production deployments:

| Variable             | Description                                        |
| -------------------- | -------------------------------------------------- |
| `RESEND_API_KEY`     | The same key used in Supabase SMTP settings.       |
| `RESEND_FROM_EMAIL`  | `hello@shortsforgeai.com`                          |

**Never commit the real value of `RESEND_API_KEY`.** It belongs in Vercel
project settings (and Supabase), not in `.env.example` or any file in
the repo. `.env.example` should only document the variable name.

## Rollback

If deliverability regresses after the switch, disable **Custom SMTP** in
Supabase to fall back to the default sender. The application code does
not need to change.
