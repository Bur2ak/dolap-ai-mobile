# Shipirio Store Readiness

## Store URLs

- Privacy Policy: `https://shipirio.com/privacy.html`
- Support URL: `https://shipirio.com/support.html`
- Account Deletion URL: `https://shipirio.com/delete-account.html`
- Marketing URL: `https://shipirio.com`
- Terms URL: `https://shipirio.com/terms.html`
- KVKK URL: `https://shipirio.com/kvkk.html`

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

## Store Product Setup

- RevenueCat entitlement: `premium`
- App Store product IDs:
  - `premium_monthly`
  - `premium_yearly`
- Google Play product IDs:
  - `premium_monthly`
  - `premium_yearly`
- Both monthly and yearly products must unlock the same `premium` entitlement.
- RevenueCat webhook URL: Supabase `revenuecat-webhook` function URL.
- Webhook authorization: set `REVENUECAT_WEBHOOK_SECRET` in Supabase function secrets and configure the same bearer token in RevenueCat.

## Supabase Production Checklist

- `supabase db push` applied through migration `019_wardrobe_fabric_usage_context.sql`
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
- Support screen includes direct email templates, diagnostics routing, subscription routing and public support/legal links.
- Support screen includes a shareable support context with app/build/account metadata and all public legal/support URLs.
- Privacy screen includes share controls, data category explanations, legal routing and a shareable privacy summary.
- Wardrobe screen includes usage-based sorting, metadata readiness signals, item-level share summaries and full wardrobe summary sharing for reviewer-visible daily use flows.
- Analytics screen includes shareable wardrobe health summaries covering utilization, sustainability, gaps, style profile and weekly goals.
- Notification settings include push readiness checks, smart reminder setup and quick preference presets; notification inbox includes filters, cleanup actions and shareable digests.
- Subscription surfaces include RevenueCat readiness checks, restore guidance, store billing notes and shareable subscription summaries.
- Profile surface includes a shareable launch-readiness summary across onboarding, wardrobe, premium and review routes.
- Social surfaces include friend status summaries, invite reward guidance and shareable social readiness notes.
- Style feed includes shareable trend summaries for public shared outfit validation.
- Lending surfaces include shareable incoming/outgoing loan summaries, overdue signals and status controls.
- Shopping surfaces include shareable buy-decision results and price-tracking digests for reviewer validation.
- Event planner includes shareable travel packing plans, event outfit suggestions and saved event summaries.
- Profile and settings surfaces include release-readiness shortcuts for diagnostics, privacy, support and subscription review.
- Account and legal surfaces include shareable account control summaries plus in-app privacy, account deletion, support and subscription control routes.
- Diagnostics includes a submission checklist covering app version, platform build numbers, public site, RevenueCat, push readiness and env warnings.
- Price tracking depends on public product pages; some stores may block automated price detection.

## Store Listing Copy

Ready-to-paste app descriptions, keywords and data safety notes are in `docs/store-listing.md`.

## Screenshot Checklist

- iPhone 6.7 inch: Dolabim, Kombin, Almali Miyim, Analiz, Fiyat Takibi, Profil.
- iPhone 6.5 inch: same core screens if App Store Connect requires the slot.
- Android phone: same core screens for Play Console.
- Avoid showing real personal email addresses, private names or live API keys in screenshots.
- Use a seeded demo account with clean clothing photos and no third-party copyrighted brand-heavy imagery.

## Domain Files

Before production release, publish filled versions of:

- `public/.well-known/apple-app-site-association.example`
- `public/.well-known/assetlinks.json.example`

Remove the `.example` suffix after filling the real Apple Team ID and Android SHA-256 certificate fingerprint on the hosted domain.
