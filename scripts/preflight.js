const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const env = readEnvFile(path.join(root, ".env"));
const envExample = readEnvFile(path.join(root, ".env.example"));

const requiredPublicEnv = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"];
const recommendedPublicEnv = [
  "EXPO_PUBLIC_SITE_URL",
  "EXPO_PUBLIC_EAS_PROJECT_ID",
  "EXPO_PUBLIC_OPENWEATHER_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_IOS_KEY",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY",
  "EXPO_PUBLIC_SENTRY_DSN",
  "EXPO_PUBLIC_POSTHOG_API_KEY",
];
const requiredFunctionSecrets = [
  "GOOGLE_GEMINI_API_KEY",
  "REMOVE_BG_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REVENUECAT_WEBHOOK_SECRET",
  "ACCOUNT_DELETION_CRON_SECRET",
];
const requiredFiles = [
  "app.config.js",
  "eas.json",
  "supabase/functions/analyze-clothing/index.ts",
  "supabase/functions/remove-background/index.ts",
  "supabase/functions/recommend-outfit/index.ts",
  "supabase/functions/buy-decision/index.ts",
  "supabase/functions/event-outfit/index.ts",
  "supabase/functions/send-notification/index.ts",
  "supabase/functions/price-check/index.ts",
  "supabase/functions/revenuecat-webhook/index.ts",
  "supabase/functions/process-account-deletions/index.ts",
  "supabase/cron/price_check_cron.sql.example",
  "supabase/cron/account_deletion_cron.sql.example",
  "app/legal/kvkk.tsx",
  "app/legal/privacy.tsx",
  "app/legal/terms.tsx",
];
const placeholderFragments = ["your-", "placeholder", "YOUR_"];

const failures = [];
const warnings = [];

for (const key of requiredPublicEnv) {
  if (!hasRealValue(env[key])) {
    failures.push(`${key} .env icinde eksik veya placeholder.`);
  }
}

for (const key of recommendedPublicEnv) {
  if (!hasRealValue(env[key])) {
    warnings.push(`${key} .env icinde eksik veya placeholder.`);
  }
}

for (const key of [...requiredPublicEnv, ...recommendedPublicEnv]) {
  if (!envExample[key]) {
    warnings.push(`${key} .env.example icinde belgelenmemis.`);
  }
}

for (const key of requiredFunctionSecrets) {
  if (!envExample[key]) {
    warnings.push(`${key} .env.example icinde belgelenmemis.`);
  }
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`${file} bulunamadi.`);
  }
}

const migrationDir = path.join(root, "supabase/migrations");
const migrations = fs.existsSync(migrationDir) ? fs.readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort() : [];
if (migrations.length === 0) {
  failures.push("supabase/migrations icinde migration bulunamadi.");
}

if (!migrations.some((file) => file.startsWith("017_"))) {
  warnings.push("017 events/buy decisions realtime migration gorunmuyor; remote/local migration durumunu kontrol et.");
}

if (!migrations.some((file) => file.includes("usage_counters"))) {
  warnings.push("Server tarafli usage counter migration'i gorunmuyor; freemium limitleri sadece lokal kalabilir.");
}

printSection("Shipirio preflight");
printList("OK", [
  `${migrations.length} migration dosyasi bulundu.`,
  `${requiredFiles.length - failures.filter((failure) => failure.includes("bulunamadi")).length}/${requiredFiles.length} kritik dosya mevcut.`,
]);
printList("Uyari", warnings);
printList("Hata", failures);

if (failures.length > 0) {
  process.exitCode = 1;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
        return [key, value];
      }),
  );
}

function hasRealValue(value) {
  const trimmed = value?.trim();
  return Boolean(trimmed && !placeholderFragments.some((fragment) => trimmed.includes(fragment)));
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function printList(title, items) {
  if (items.length === 0) {
    console.log(`${title}: yok`);
    return;
  }

  console.log(`${title}:`);
  for (const item of items) {
    console.log(`- ${item}`);
  }
}
