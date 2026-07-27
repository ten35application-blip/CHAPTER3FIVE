# Supabase Auth Email Templates

Supabase's default auth emails use a generic "C" placeholder logo. To ship
chapter3five branding, paste the HTML below into the Supabase Dashboard.

## Where to paste

Supabase Dashboard → Authentication → Email Templates. Update at least:

- **Confirm signup** (the one Wilson noticed first — new-signup verification)
- **Magic Link** (if we ever enable magic-link sign-in)
- **Change Email Address**
- **Reset Password**

The templates support Go template syntax. Available variables per template
(see [Supabase docs](https://supabase.com/docs/guides/auth/auth-email-templates)):

- `{{ .ConfirmationURL }}` — the confirm/action URL
- `{{ .Token }}` — 6-digit code (if OTP flow)
- `{{ .Email }}` — recipient
- `{{ .SiteURL }}` — the project's site URL

## Logo asset

The template below inlines the logo as a hosted URL:
`https://chapter3five.app/logo-transparent.png`

That file lives in `public/` and is already served at that path. If you'd
rather host the email logo on a CDN, swap the src.

## Template — Confirm signup

```html
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Confirm your chapter3five account</title>
  </head>
  <body style="margin:0;padding:0;background:#fcf5ec;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif;color:#1c1c1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fcf5ec;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background:#fffefb;border-radius:24px;padding:40px 32px;box-shadow:0 20px 48px -16px rgba(28,28,26,0.12);">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <img
                  src="https://chapter3five.app/logo-transparent.png"
                  alt="chapter3five"
                  width="72"
                  height="72"
                  style="display:block;border:0;outline:none;"
                />
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:28px;font-weight:700;letter-spacing:-0.02em;line-height:1.1;color:#1c1c1a;padding-bottom:16px;">
                Confirm your account.
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:16px;line-height:1.55;color:#4a4a48;padding-bottom:32px;">
                Tap the button below to confirm your email and finish
                setting up your chapter3five account.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:32px;">
                <a
                  href="{{ .ConfirmationURL }}"
                  style="display:inline-block;background:linear-gradient(135deg,#e88a76 0%,#7ec4c4 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 32px;border-radius:999px;box-shadow:0 16px 36px -10px rgba(232,138,118,0.55),0 6px 16px -4px rgba(126,196,196,0.45);"
                >
                  Confirm my email
                </a>
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:13px;line-height:1.55;color:#6e6e6c;padding-bottom:8px;">
                If the button doesn't work, copy and paste this link:
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:12px;line-height:1.55;color:#8e8e8c;word-break:break-all;padding-bottom:32px;">
                {{ .ConfirmationURL }}
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:12px;color:#8e8e8c;padding-top:24px;border-top:1px solid #e8e6e1;">
                chapter3five &middot; someone to talk to. someone to keep.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Template — Reset password

Same shell, swap the heading and button copy:

- Heading: `Reset your password.`
- Body: `Tap the button below to set a new password for your chapter3five account. If you didn't request this, you can ignore this email.`
- Button: `Reset password`

## Template — Magic Link (if enabled)

- Heading: `Sign in to chapter3five.`
- Body: `Tap the button below to sign in. This link expires in an hour.`
- Button: `Sign in`

## Notes

- Inline everything (no external CSS): most email clients strip
  `<style>` blocks and reject `<link>`. The template uses table-based
  layout and inline styles for maximum client compatibility.
- The gradient button uses `linear-gradient()` which some older clients
  (early Outlook) fall back to solid coral — acceptable.
- The logo is served from the public Vercel deployment; if the domain
  ever changes, update the `src` here.
