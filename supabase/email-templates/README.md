# Supabase email templates & sender setup

These are the branded HTML email templates StorePilot sends through Supabase Auth.
Supabase doesn't read this folder automatically — you paste the HTML into the
Supabase dashboard. The files are kept here under version control so the next
person can update them without guessing.

## 1. Templates in this folder

| File | Where to paste it (Supabase dashboard) |
| --- | --- |
| `confirmation.html` | Authentication → Email Templates → **Confirm signup** |
| `invite.html` | Authentication → Email Templates → **Invite user** |
| `magic_link.html` | Authentication → Email Templates → **Magic Link** |
| `email_change.html` | Authentication → Email Templates → **Change Email Address** |
| `recovery.html` | Authentication → Email Templates → **Reset Password** |

For each one, also set the **Subject** field. Suggested subjects:

- Confirm signup → `Confirm your StorePilot account`
- Invite user → `You've been invited to StorePilot`
- Magic Link → `Your StorePilot sign-in link`
- Change Email → `Confirm your new StorePilot email`
- Reset Password → `Reset your StorePilot password`

The placeholders (`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`)
are filled in by Supabase at send time — leave them as-is.

## 2. Site URL & Redirect URLs

Authentication → URL Configuration:

- **Site URL**: the canonical production URL, e.g. `https://app.storepilot.com`
  (this is what every link in every email defaults to).
- **Redirect URLs**: every additional URL that's allowed to receive auth
  callbacks. Add at minimum:
  - `https://app.storepilot.com/**`
  - `https://maroon-lemur-580964.hostingersite.com/**` (or whatever the
    Hostinger preview domain is)
  - `http://localhost:3000/**` (local dev)
  - `http://localhost:5173/**` (Vite default)

The `**` wildcard lets all of `/login`, `/reset-password`, `/signup`, etc. work.

The app's reset-password flow now sends users to
`<origin>/reset-password` (see `src/contexts/SupabaseAuthContext.jsx`), so
make sure that URL is allowed.

## 3. Sender address (custom SMTP)

By default Supabase sends from `noreply@mail.app.supabase.io`. To send from
`@storepilot.com` you need to enable **Custom SMTP** in
Authentication → SMTP Settings.

Pick a transactional email provider (Resend, Postmark, SendGrid, Mailgun, AWS
SES, etc.), verify your domain there (SPF, DKIM, optional DMARC), and copy
their SMTP credentials into Supabase:

- Sender email: e.g. `hello@storepilot.com`
- Sender name: `StorePilot`
- Host / Port / Username / Password: from your provider
- Minimum interval between emails: leave at default

After you save, hit **Send test email** in the dashboard to verify.

## 4. Testing

1. Push and redeploy the web app (the in-product reset link points to
   `/reset-password`, which is a new route).
2. From the deployed site, click **Forgot password?** on `/login`.
3. The email should arrive from your branded sender address with the
   StorePilot template.
4. Clicking the button should land on `/reset-password` on the same domain you
   started from. Set a new password — you should be redirected to `/app`.
