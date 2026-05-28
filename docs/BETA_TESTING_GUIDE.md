# Beta Test Yayını — TestFlight + Play Internal Testing

EAS Build üzerinden hem iOS hem Android beta build alma ve yayınlama rehberi.

## Ön koşullar

- [ ] Apple Developer Program üyeliği (yıllık $99)
- [ ] Google Play Developer hesabı (tek seferlik $25)
- [ ] EAS CLI yüklü: `npm install -g eas-cli`
- [ ] EAS hesabı: `eas login`
- [ ] `app.config.ts`'de `expo.extra.eas.projectId` set edilmiş ✅

## 1. iOS — TestFlight

### Bir kerelik kurulum

```bash
# 1. EAS'a credentials yükle (Apple ID + App-Specific Password gerekir)
eas credentials --platform ios

# 2. Bundle ID kontrol
# app.config.ts → ios.bundleIdentifier = "com.shipirio.app" ✅

# 3. App Store Connect'te uygulama oluştur:
#    - https://appstoreconnect.apple.com
#    - My Apps → "+" → New App
#    - Bundle ID: com.shipirio.app
#    - SKU: shipirio-001
#    - Primary Language: Turkish
```

### Beta build + submit

```bash
# 1. Production build al
eas build --platform ios --profile production

# Build yaklaşık 15-25 dk sürer
# Bittikten sonra .ipa dosyası EAS hesabında görünür

# 2. App Store Connect'e gönder
eas submit --platform ios --latest

# Veya manuel: Transporter app ile .ipa yükle
```

### TestFlight'a tester ekle

1. App Store Connect → TestFlight → Internal Testing
2. "Add Group" → "Shipirio Beta"
3. Tester ekle (Apple ID + e-mail)
4. Build'i grup için aktif et
5. Tester'lara davet maili gider

**İlk build için:** Apple beta review gerekebilir (24-48 saat)

## 2. Android — Play Internal Testing

### Bir kerelik kurulum

```bash
# 1. Play Console'a uygulama oluştur:
#    - https://play.google.com/console
#    - Create app → Name: Shipirio
#    - Default language: Turkish
#    - App type: App, Free
#    - Declarations: tamamla

# 2. Google Service Account oluştur:
#    - Setup → API access → Create service account
#    - JSON key indir → ios/.gcloud-service-account.json olarak kaydet
#    - .gitignore'da olduğundan emin ol

# 3. EAS'a service account bağla
eas credentials --platform android
```

### Beta build + submit

```bash
# 1. AAB (app bundle) build al
eas build --platform android --profile production

# 2. Play Console'a gönder (eas.json'da track: internal ✅)
eas submit --platform android --latest

# Veya manuel: Play Console → Testing → Internal testing → Create new release
```

### Internal testers ekle

1. Play Console → Testing → Internal testing
2. Testers tab → "Create email list"
3. List name: "Shipirio Beta"
4. Tester email'leri ekle
5. Opt-in URL'i paylaş (test cihazlarında bu link ile aboneliği aç)

## 3. Hızlı tek komut workflow

```bash
# Hem iOS hem Android build + submit tek seferde
eas build --platform all --profile production --auto-submit

# Veya sadece build:
eas build --platform all --profile production
```

## 4. Versiyon yönetimi

`app.config.ts`:
```ts
expo: {
  version: "1.0.0",           // Marketing version (semantic)
  ios: { buildNumber: "1" },  // Auto-increments (eas.json)
  android: { versionCode: 1 } // Auto-increments
}
```

Production build alırken `autoIncrement: true` yüzden build/version code otomatik artar.

## 5. Sık karşılaşılan sorunlar

### "Provisioning profile expired"
```bash
eas credentials --platform ios
# → Remove and create new
```

### "Bundle identifier already exists"
- Bundle ID değiştir (app.config.ts) veya
- Apple Developer Portal'dan eski profile'ı sil

### Build başarısız: NitroModule / MMKV
- Native modüller Expo Go'da çalışmaz, sadece custom build'de
- `developmentClient: true` profile kullan veya `eas build --platform ios --profile preview`

### Sentry source maps yüklenmedi
- `SENTRY_AUTH_TOKEN` env var EAS'a eklenmiş olmalı:
```bash
eas secret:create --name SENTRY_AUTH_TOKEN --value sntrys_xxx
```

## 6. Beta test sonrası → Production

Beta'da sorun çıkmazsa:

```bash
# iOS: TestFlight'tan App Store'a yükselt
# App Store Connect → Pricing → Available
# Submit for Review → ~24-48 saat

# Android: Internal → Closed → Open → Production
# Play Console → Production → Promote release
```

## Kontrol Listesi

### iOS Beta
- [ ] Apple Developer Program aktif
- [ ] App Store Connect'te app oluşturuldu
- [ ] EAS credentials yüklendi
- [ ] `eas build --platform ios --profile production` çalıştı
- [ ] TestFlight'a submit edildi
- [ ] Internal tester group + email'ler eklendi
- [ ] Test cihazında uygulama açıldı, login + 1 kombin önerisi alındı

### Android Beta
- [ ] Play Developer hesabı aktif
- [ ] Play Console'da app oluşturuldu
- [ ] Service account JSON yüklendi
- [ ] EAS credentials bağlandı
- [ ] `eas build --platform android --profile production` çalıştı
- [ ] Play Console'a submit edildi
- [ ] Internal tester listesi oluşturuldu
- [ ] Opt-in link tester'lara gönderildi
- [ ] Test cihazında çalıştı

## Notlar

- İlk EAS build genelde ~25 dk, sonrakiler cache sayesinde ~15 dk
- TestFlight beta linki 90 gün geçerli, yenilemek için tekrar build gönder
- Play Internal Testing'de versiyon değiştirmek için yeni AAB gerekir
