# RevenueCat Production Setup — Shipirio

Bu rehber, RevenueCat'i production'a almak için adımları içerir. Kod tarafı hazır; sadece dashboard kurulumu + env vars gerekiyor.

## Mevcut kod durumu (✓ Hazır)

- `lib/revenuecat.ts` — Configure / purchase / restore / webhook hazır
- `supabase/functions/revenuecat-webhook/` — Webhook handler aktif
- `app/paywall.tsx` — Paywall UI hazır
- `hooks/useSubscription.ts` — Premium entitlement check
- **Entitlement ID:** `premium` (kodda sabit)

## Yapılacaklar

### 1. RevenueCat hesabı oluştur
1. https://app.revenuecat.com/signup → ücretsiz hesap aç
2. Yeni proje: **"Shipirio"**

### 2. Apps ekle
- **iOS App** → Bundle ID: `com.shipirio.app`
  - App Store Connect'ten "App-Specific Shared Secret" üret (Subscriptions → App Information)
  - RevenueCat'e gir
- **Android App** → Package: `com.shipirio.app`
  - Google Play Console'da Service Account JSON oluştur
  - RevenueCat'e yükle

### 3. Products oluştur

App Store Connect ve Play Console'da şu **product ID**'lerle ürün oluştur:

| Plan | Product ID | Fiyat | Period |
|---|---|---|---|
| Aylık Premium | `shipirio_premium_monthly` | ₺79 | 1 month auto-renewable |
| Yıllık Premium | `shipirio_premium_yearly` | ₺399 | 1 year auto-renewable |

> Free trial: 7 gün öneriyorum (her ikisinde de)

### 4. Entitlement oluştur
- RevenueCat dashboard → **Entitlements** → "+ New"
- ID: `premium`
- Her iki product'ı bu entitlement'a ata

### 5. Offerings oluştur
- **Default Offering** → Packages:
  - Monthly: `shipirio_premium_monthly`
  - Annual: `shipirio_premium_yearly`

### 6. API keys'leri al
- RevenueCat dashboard → **Project Settings → API Keys**
- iOS: `appl_xxxxx` (Public app-specific)
- Android: `goog_xxxxx` (Public app-specific)

### 7. .env dosyasına ekle

`/Users/gemici/Desktop/TestVault/.env` dosyasına:

```env
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxxxxxxxxxxx
```

### 8. Webhook secret (server-side)

Supabase Edge Function için webhook secret gerekiyor:

```bash
# RevenueCat: Integrations → Webhooks → "+ Add"
# URL: https://mdvasffuseqkyhiegsck.supabase.co/functions/v1/revenuecat-webhook
# Authorization header value'yu kopyala

# Supabase secrets'a ekle:
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=your_secret_here --project-ref mdvasffuseqkyhiegsck
```

### 9. Build & test

```bash
# Native build (RevenueCat NitroModule kullanır, Expo Go çalışmaz)
npx expo run:ios --device "iPhone 17"

# TestFlight ile sandbox test:
eas build --platform ios --profile preview
```

Test akışı:
1. Sandbox tester ile giriş yap
2. Paywall'a git → Premium'a Geç
3. Satın al → entitlement aktif olmalı
4. Restore Purchases → çalışmalı

## Kontrol listesi

- [ ] RevenueCat hesap + proje açıldı
- [ ] iOS bundle ID + App-Specific Shared Secret yüklendi
- [ ] Android package + Service Account JSON yüklendi
- [ ] 2 product oluşturuldu (`shipirio_premium_monthly`, `shipirio_premium_yearly`)
- [ ] `premium` entitlement oluşturuldu ve product'lar atandı
- [ ] Default offering aktif
- [ ] iOS + Android public API keys alındı
- [ ] `.env` güncellendi (2 EXPO_PUBLIC değişkeni)
- [ ] Webhook eklendi + Supabase secret set edildi
- [ ] Sandbox test başarılı
