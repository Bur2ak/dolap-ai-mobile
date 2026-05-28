# Store Assets — Görsel Gereksinimleri

## App Icon
- **iOS:** 1024×1024 PNG (no transparency, no rounded corners — Apple yuvarlar)
  - Mevcut: `assets/icon.png` ✅
- **Android:** 512×512 PNG
  - Mevcut: `assets/adaptive-icon.png` ✅

## iOS Screenshots (zorunlu)

### iPhone 6.7" (1290×2796) — 3 ila 10 adet
Bu boyut artık zorunlu. Şu ekranlardan al:

1. Ana Sayfa (hero kart + uyum skoru)
2. Gardırobum (dolap grid)
3. Kombin Analiz (AI sonuç)
4. Almadan Önce (buy decision result)
5. Sosyal (post feed)

### iPhone 6.5" (1284×2778) — opsiyonel, otomatik scale

### iPad 12.9" (2048×2732) — sadece iPad destekliyorsa

## Android Screenshots (zorunlu)

### Phone (1080×1920 veya daha büyük) — 2 ila 8 adet
- Aynı 5 ekran iOS gibi

### 7" Tablet (1024×600) — opsiyonel
### 10" Tablet (1280×800) — opsiyonel

## Feature Graphic (Play Store, zorunlu)
- **1024×500 JPG/PNG**
- Logo + tagline + arka plan (örn: "Stilini Akıllıca Yönet")

## Promo Video (opsiyonel)
- iOS: 30 saniye preview (1080×1920 portrait)
- Android: YouTube link (30-120 saniye)

## Screenshot Üretim Workflow'u

```bash
# 1. Simulator'ü 6.7" iPhone seç
xcrun simctl boot "iPhone 15 Pro Max" 2>/dev/null

# 2. Uygulamayı açıp her ekrana git, Cmd+S ile screenshot al
# Her screenshot otomatik Desktop'a kaydedilir

# 3. Screenshot'ları "store-assets/ios/" klasörüne taşı:
# - 01-home.png
# - 02-wardrobe.png
# - 03-outfit-analysis.png
# - 04-buy-decision.png
# - 05-social.png

# 4. Android Studio simulator (Pixel 7 Pro) ile aynı işlem
# store-assets/android/ klasörüne
```

## Hazırlık Listesi
- [ ] App icon (1024 + 512) ✅ var
- [ ] iOS 6.7" — 5 screenshot al
- [ ] Android phone — 5 screenshot al
- [ ] Feature graphic 1024×500 tasarla
- [ ] Store listing metinleri (Tr + En) ✅ hazır
- [ ] Privacy + Terms URL'leri ✅ shipirio.com'da
