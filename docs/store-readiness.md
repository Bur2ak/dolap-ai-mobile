# Shipirio Store Readiness

## Store URLs

- Privacy Policy: `https://shipirio.com/privacy.html`
- Support URL: `https://shipirio.com/support.html`
- Account Deletion URL: `https://shipirio.com/delete-account.html`
- Marketing URL: `https://shipirio.com`

## App Identity

- App name: Shipirio
- iOS bundle identifier: `com.shipirio.mobile`
- Android package: `com.shipirio.mobile`
- Universal link domains: `shipirio.com`, `www.shipirio.com`

## Required Production Values

- `EXPO_PUBLIC_EAS_PROJECT_ID`
- `EXPO_PUBLIC_SITE_URL=https://shipirio.com`
- `EXPO_PUBLIC_OPENWEATHER_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_POSTHOG_API_KEY`

## Supabase Production Checklist

- `supabase db push` applied through migration `018_revenuecat_customer_index.sql`
- `supabase functions deploy analyze-clothing`
- `supabase functions deploy remove-background`
- `supabase functions deploy recommend-outfit`
- `supabase functions deploy buy-decision`
- `supabase functions deploy event-outfit`
- `supabase functions deploy send-notification`
- `supabase functions deploy price-check`
- `supabase functions deploy revenuecat-webhook`
- `supabase functions deploy process-account-deletions`

Required function secrets:

- `GOOGLE_GEMINI_API_KEY`
- `REMOVE_BG_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REVENUECAT_WEBHOOK_SECRET`
- `ACCOUNT_DELETION_CRON_SECRET`

Optional cron setup:

- Fill and run `supabase/cron/price_check_cron.sql.example`
- Fill and run `supabase/cron/account_deletion_cron.sql.example`

## App Review Notes

- Premium unlock is handled through RevenueCat entitlement `premium`.
- Development-only local premium preview is hidden outside `__DEV__`.
- Account deletion is available under profile/account settings and uses a 30 day waiting period.
- Public account deletion instructions are available at `https://shipirio.com/delete-account.html`.
- Price tracking depends on public product pages; some stores may block automated price detection.

## Store Listing Copy

Ready-to-paste app descriptions, keywords and data safety notes are in `docs/store-listing.md`.

## Domain Files

Before production release, publish filled versions of:

- `public/.well-known/apple-app-site-association.example`
- `public/.well-known/assetlinks.json.example`

Remove the `.example` suffix after filling the real Apple Team ID and Android SHA-256 certificate fingerprint on the hosted domain.
