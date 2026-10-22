# Email templates

The signup confirmation is the only email ACUM sends today (there is no
password-reset or magic-link flow in the product), and Supabase's default
template is generic — Supabase's logo, Supabase's words. These files give it
the product's identity instead.

Supabase's management API cannot write email templates: on a hosted project
they are edited only in the dashboard. So the templates live here — the source
of truth — and are pasted into the dashboard once.

## Paste steps (about two minutes)

1. Open the [Supabase dashboard](https://supabase.com/dashboard) → your
   project → **Authentication → Email Templates**.
2. Click **Confirm signup**.
3. Replace the entire HTML with the contents of
   [`confirm-signup.html`](confirm-signup.html). Leave the **Subject** as it
   is (`Confirm your email address`) or write your own — the body is what
   carries the brand.
4. **Save**.

Send yourself a test from **Authentication → Emails → Send Test Email** (or
sign up with a fresh address) and check the inbox: the mail now carries the
ACUM mark, the dark canvas and the gold confirm button, and the "powered by
Supabase" footer is gone.

## The variables

| Variable                | What it resolves to                                     |
| ----------------------- | ------------------------------------------------------- |
| `{{ .ConfirmationURL }}` | The link that confirms the address (single-use, expires) |
| `{{ .SiteURL }}`         | The project's **Site URL** — see below                    |
| `{{ .Email }}`           | The visitor's address                                    |

## URL Configuration (same section: Authentication → URL Configuration)

- **Site URL** — set it to the deployed origin (once on Vercel, e.g.
  `https://<your-app>.vercel.app`; locally `http://localhost:3000`). It shows
  in the footer link of the email.
- **Redirect URLs** — add the deployed origin with `/*`
  (`https://<your-app>.vercel.app/*`). The confirm link lands on the origin
  the visitor signed up from (the app passes `emailRedirectTo:
  window.location.origin`), and Supabase only redirects to allow-listed URLs.

## Sender and limits (hosted free plan)

- The From address stays **Supabase Auth &lt;noreply@mail.app.supabase.io&gt;**
  while Supabase's built-in SMTP is used. To send as
  `no-reply@your-domain` you configure **custom SMTP**
  (Authentication → SMTP Settings) with any provider — Supabase's docs
  recommend a domain the app is hosted on. Custom SMTP also lifts the
  built-in limit of **2 auth emails per hour** (the free plan's rate for
  signup/recovery combined).
- Keep link tracking **off** in the SMTP provider: the confirmation link is
  single-use, and a scanner or a link-rewriting proxy can consume it before
  the visitor does.

## If the copy changes

Change it here first, then re-paste into the dashboard — the dashboard copy
is a deployment, not the source.
