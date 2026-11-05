# Compass auth email templates

Approved pictured designs and subjects,2November2026:

- recovery.html: Reset your Compass password
- confirm-signup.html: Confirm your Compass email address

These files are source-controlled templates for manual application in Supabase Authentication > Email templates. Merging does not apply the templates. Preserve {{ .ConfirmationURL }} in the button and fallback link. The public logo asset was approved separately and verified live before substituting its URL. No sender, SMTP, redirect, rate-limit or authentication settings are changed by these files.

The Compass needle mark (public/compass-logo-email.png, transparent 128px PNG shown at 44px) sits beside the COMPASS wordmark in the header. Its absolute URL only resolves once a build carrying the asset is live on compass-demo.websitesbynick.co.uk; verify the URL before applying the templates.
