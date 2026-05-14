# Shipirio Release Runbook

## Local Checks

Run these before every release branch or store build:

```sh
npm run release:check
```

Expected preflight warnings before final production setup:

- Missing production `.env` values for EAS, OpenWeather, RevenueCat, Sentry and PostHog.
- `apple-app-site-association` and `assetlinks.json` may still be `.example` until real Apple Team ID and Android SHA-256 values are known.

## Supabase Release Steps

1. Confirm migrations are synced:

```sh
supabase db push
supabase migration list
```

2. Deploy all functions:

```sh
npm run deploy:functions
```

3. Confirm required function secrets in the Supabase dashboard:

- `GOOGLE_GEMINI_API_KEY`
- `REMOVE_BG_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REVENUECAT_WEBHOOK_SECRET`
- `ACCOUNT_DELETION_CRON_SECRET`

4. Configure cron jobs from the examples after replacing placeholders:

- `supabase/cron/price_check_cron.sql.example`
- `supabase/cron/account_deletion_cron.sql.example`

Do not commit filled cron files because they can contain secrets.

## Domain Release Steps

Publish final versions on `https://shipirio.com`:

- `/.well-known/apple-app-site-association`
- `/.well-known/assetlinks.json`
- `/privacy.html`
- `/support.html`
- `/delete-account.html`
- `/terms.html`
- `/kvkk.html`

Universal link files must not include `.example` suffixes in production.

## Store Build Steps

1. Fill production env values in EAS or local release env.
2. Run:

```sh
npm run build:production
```

3. Smoke test a real device build:

- Register, confirm email and sign in.
- Add a wardrobe item from gallery.
- Run clothing analysis and background removal.
- Request an outfit.
- Run buy decision.
- Add price tracking.
- Enable notifications and verify push readiness.
- Open social invite, friend, lending and shared outfit routes.
- Request account deletion and cancel it from settings.

4. Submit after smoke test:

```sh
npm run submit:production
```

## Review Account Notes

Use a clean review account with sample clothing photos, no real private email shown in screenshots, and no third-party copyrighted brand-heavy imagery.
