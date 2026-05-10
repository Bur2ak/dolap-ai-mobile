type PublicEnvKey =
  | "EXPO_PUBLIC_SUPABASE_URL"
  | "EXPO_PUBLIC_SUPABASE_ANON_KEY"
  | "EXPO_PUBLIC_SITE_URL"
  | "EXPO_PUBLIC_EAS_PROJECT_ID"
  | "EXPO_PUBLIC_OPENWEATHER_API_KEY"
  | "EXPO_PUBLIC_REVENUECAT_IOS_KEY"
  | "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY"
  | "EXPO_PUBLIC_SENTRY_DSN"
  | "EXPO_PUBLIC_POSTHOG_API_KEY"
  | "EXPO_PUBLIC_POSTHOG_HOST";

const placeholderValues = new Set([
  "https://your-project.supabase.co",
  "your-anon-key",
  "your-eas-project-id",
  "your-openweather-key",
  "appl_your-revenuecat-ios-key",
  "goog_your-revenuecat-android-key",
  "your-sentry-dsn",
  "your-posthog-project-api-key",
]);

const explicitSiteUrl = normalizePublicUrlEnv("EXPO_PUBLIC_SITE_URL", process.env.EXPO_PUBLIC_SITE_URL);

export const publicEnv = {
  easProjectId: normalizePublicEnv("EXPO_PUBLIC_EAS_PROJECT_ID", process.env.EXPO_PUBLIC_EAS_PROJECT_ID),
  openWeatherApiKey: normalizePublicEnv("EXPO_PUBLIC_OPENWEATHER_API_KEY", process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY),
  posthogApiKey: normalizePublicEnv("EXPO_PUBLIC_POSTHOG_API_KEY", process.env.EXPO_PUBLIC_POSTHOG_API_KEY),
  posthogHost: normalizePublicUrlEnv("EXPO_PUBLIC_POSTHOG_HOST", process.env.EXPO_PUBLIC_POSTHOG_HOST),
  revenueCatAndroidKey: normalizePublicEnv("EXPO_PUBLIC_REVENUECAT_ANDROID_KEY", process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY),
  revenueCatIosKey: normalizePublicEnv("EXPO_PUBLIC_REVENUECAT_IOS_KEY", process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY),
  sentryDsn: normalizePublicUrlEnv("EXPO_PUBLIC_SENTRY_DSN", process.env.EXPO_PUBLIC_SENTRY_DSN),
  siteUrl: explicitSiteUrl ?? "https://shipirio.com",
  siteUrlConfigured: Boolean(explicitSiteUrl),
  supabaseAnonKey: normalizePublicEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  supabaseUrl: normalizePublicUrlEnv("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
};

export function getMissingRequiredPublicEnv() {
  return [
    publicEnv.supabaseUrl ? null : "EXPO_PUBLIC_SUPABASE_URL",
    publicEnv.supabaseAnonKey ? null : "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean) as PublicEnvKey[];
}

export function getPublicEnvWarnings() {
  const missingRequired = getMissingRequiredPublicEnv();
  const warnings = missingRequired.map((key) => `${key} eksik veya placeholder.`);

  if (!publicEnv.openWeatherApiKey) {
    warnings.push("EXPO_PUBLIC_OPENWEATHER_API_KEY eksik; hava durumu onerileri pasif kalir.");
  }

  if (!publicEnv.siteUrlConfigured) {
    warnings.push("EXPO_PUBLIC_SITE_URL eksik; paylasim linkleri varsayilan shipirio.com alan adina gider.");
  }

  if (!publicEnv.revenueCatIosKey || !publicEnv.revenueCatAndroidKey) {
    warnings.push("RevenueCat public key eksik; gercek abonelik teklifleri cihazda gelmeyebilir.");
  }

  if (!publicEnv.easProjectId) {
    warnings.push("EXPO_PUBLIC_EAS_PROJECT_ID eksik; gercek cihaz push token icin EAS projectId gerekir.");
  }

  if (!publicEnv.sentryDsn) {
    warnings.push("EXPO_PUBLIC_SENTRY_DSN eksik; runtime hata takibi pasif kalir.");
  }

  if (!publicEnv.posthogApiKey) {
    warnings.push("EXPO_PUBLIC_POSTHOG_API_KEY eksik; urun analitigi pasif kalir.");
  }

  return warnings;
}

function normalizePublicUrlEnv(key: PublicEnvKey, value: string | undefined) {
  const normalized = normalizePublicEnv(key, value);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).toString().replace(/\/+$/, "");
  } catch {
    if (__DEV__) {
      console.warn(`${key} gecerli bir URL degil.`);
    }
    return null;
  }
}

function normalizePublicEnv(key: PublicEnvKey, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || placeholderValues.has(trimmed)) {
    if (__DEV__ && trimmed && placeholderValues.has(trimmed)) {
      console.warn(`${key} placeholder gorunuyor. .env degerini gercek anahtarla degistir.`);
    }
    return null;
  }

  return trimmed;
}
