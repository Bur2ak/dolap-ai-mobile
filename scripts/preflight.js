const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const env = readEnvFile(path.join(root, ".env"));
const envExample = readEnvFile(path.join(root, ".env.example"));
const appConfig = readJsonFile(path.join(root, "app.json"))?.expo ?? {};
const packageJson = readJsonFile(path.join(root, "package.json")) ?? {};

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
  "public/.well-known/apple-app-site-association.example",
  "public/.well-known/assetlinks.json.example",
  "public/privacy.html",
  "public/support.html",
  "public/delete-account.html",
  "public/terms.html",
  "public/kvkk.html",
  "docs/store-readiness.md",
  "docs/store-listing.md",
  "app/settings/support.tsx",
  "app/legal/kvkk.tsx",
  "app/legal/privacy.tsx",
  "app/legal/terms.tsx",
];
const placeholderFragments = ["your-", "placeholder", "YOUR_"];
const expectedFunctionNames = requiredFiles
  .filter((file) => file.startsWith("supabase/functions/") && file.endsWith("/index.ts"))
  .map((file) => file.split("/")[2])
  .sort();

const failures = [];
const warnings = [];
const deployFunctionsScript = readTextFile(path.join(root, "scripts/deploy-functions.sh"));

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

validateAppConfig(appConfig, failures, warnings);
validatePackageJson(packageJson, warnings);
validateFunctionDeployment(deployFunctionsScript, expectedFunctionNames, failures, warnings);
validateDomainFiles(warnings);

const migrationDir = path.join(root, "supabase/migrations");
const migrations = fs.existsSync(migrationDir) ? fs.readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort() : [];
if (migrations.length === 0) {
  failures.push("supabase/migrations icinde migration bulunamadi.");
}

if (!migrations.some((file) => file.startsWith("018_"))) {
  warnings.push("018 revenuecat customer index migration gorunmuyor; remote/local migration durumunu kontrol et.");
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

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    failures.push(`${path.relative(root, filePath)} okunamadi: ${error.message}`);
    return null;
  }
}

function readTextFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    failures.push(`${path.relative(root, filePath)} okunamadi: ${error.message}`);
    return "";
  }
}

function validateAppConfig(config, failures, warnings) {
  const iosBundleId = config.ios?.bundleIdentifier;
  const androidPackage = config.android?.package;
  const scheme = config.scheme;
  const androidPermissions = config.android?.permissions ?? [];
  const associatedDomains = config.ios?.associatedDomains ?? [];
  const intentFilters = config.android?.intentFilters ?? [];

  if (iosBundleId !== "com.shipirio.mobile") {
    failures.push("iOS bundleIdentifier com.shipirio.mobile olmali.");
  }

  if (androidPackage !== "com.shipirio.mobile") {
    failures.push("Android package com.shipirio.mobile olmali.");
  }

  if (scheme !== "shipirio") {
    failures.push("Expo scheme shipirio olmali.");
  }

  if (!androidPermissions.includes("POST_NOTIFICATIONS")) {
    warnings.push("Android POST_NOTIFICATIONS izni app.json icinde yok; Android 13+ push izni sorunlu olabilir.");
  }

  if (!associatedDomains.includes("applinks:shipirio.com")) {
    warnings.push("iOS associatedDomains icinde applinks:shipirio.com yok.");
  }

  const androidHosts = intentFilters
    .flatMap((filter) => (Array.isArray(filter.data) ? filter.data : []))
    .map((entry) => entry.host)
    .filter(Boolean);
  if (!androidHosts.includes("shipirio.com")) {
    warnings.push("Android intentFilters icinde shipirio.com yok.");
  }
}

function validatePackageJson(pkg, warnings) {
  const dependencies = pkg.dependencies ?? {};
  if (!dependencies["expo-image"]) {
    warnings.push("expo-image dependency yok; cache'li gorsel render beklenen kaliteyi vermeyebilir.");
  }
}

function validateFunctionDeployment(scriptContent, expectedNames, failures, warnings) {
  const functionDir = path.join(root, "supabase/functions");
  const actualNames = fs.existsSync(functionDir)
    ? fs
        .readdirSync(functionDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

  const scriptNames = extractDeployFunctionNames(scriptContent);
  for (const name of expectedNames) {
    if (!actualNames.includes(name)) {
      failures.push(`supabase/functions/${name} klasoru bulunamadi.`);
    }

    if (!scriptNames.includes(name)) {
      warnings.push(`${name} deploy-functions.sh icinde deploy edilmiyor.`);
    }
  }

  for (const name of actualNames) {
    if (!expectedNames.includes(name)) {
      warnings.push(`${name} function klasoru preflight kritik dosya listesine eklenmemis.`);
    }
  }
}

function validateDomainFiles(warnings) {
  const wellKnownDir = path.join(root, "public/.well-known");
  const appleExample = path.join(wellKnownDir, "apple-app-site-association.example");
  const appleLive = path.join(wellKnownDir, "apple-app-site-association");
  const assetLinksExample = path.join(wellKnownDir, "assetlinks.json.example");
  const assetLinksLive = path.join(wellKnownDir, "assetlinks.json");

  if (fs.existsSync(appleExample) && !fs.existsSync(appleLive)) {
    warnings.push("apple-app-site-association henuz .example olarak duruyor; production domain icin gercek dosya yayinlanmali.");
  }

  if (fs.existsSync(assetLinksExample) && !fs.existsSync(assetLinksLive)) {
    warnings.push("assetlinks.json henuz .example olarak duruyor; Android App Links icin gercek dosya yayinlanmali.");
  }
}

function extractDeployFunctionNames(scriptContent) {
  if (!scriptContent) {
    return [];
  }

  return [...scriptContent.matchAll(/^\s*([a-z0-9-]+)\s*$/gm)]
    .map((match) => match[1])
    .filter((name) => name !== "functions")
    .sort();
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
