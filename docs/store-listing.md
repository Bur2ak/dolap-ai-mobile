# Shipirio Store Listing

## App Store

- Name: Shipirio
- Subtitle: Akilli dolap ve kombin asistani
- Category: Lifestyle
- Secondary category: Shopping
- Age rating notes: User-generated wardrobe photos, no public adult content feed, no gambling, no medical claims.
- Content rights: No third-party copyrighted content is bundled.
- Sign-in required: Yes, email authentication is used for personal wardrobe data.
- Review account: Create a temporary reviewer account before submission and remove it after review.
- In-app purchases:
  - `premium_monthly`: Shipirio Premium Monthly
  - `premium_yearly`: Shipirio Premium Yearly

## Short Description

Dolabini duzenle, kombin onerileri al, fiyatlari takip et ve alisveris kararlarini daha bilincli ver.

## Long Description

Shipirio, dolabindaki kiyafetleri tek yerde toplamana ve her gun ne giyecegine daha hizli karar vermene yardimci olan akilli gardirob uygulamasidir.

Kiyafetlerini fotografla ekleyebilir, kategori, renk, sezon ve marka bilgileriyle dolabini arayabilirsin. Kombin onerileri; dolabindaki parcalar, ruh halin, etkinlik tipi ve hava durumu gibi sinyallerle desteklenir. Alisveris karar motoru, yeni bir urunu mevcut dolabinla karsilastirarak satin alma kararina yardim eder.

Shipirio ayrica fiyat takibi, bildirimler, arkadaslarla paylasim, oylama, odunc istegi, premium ozellikler ve hesap/veri yonetimi akislari sunar. Hesap silme talebi uygulama icinden baslatilabilir ve gizlilik sayfalarina uygulama icinden ulasilabilir.

## App Store Promotional Text

Dolabindan kombin onerileri al, yeni alisverislerini mevcut stilinle karsilastir ve fiyat dususlerini takip et.

## Keywords

dolap, gardirob, kombin, moda, kiyafet, alisveris, stil, fiyat takibi, outfit, wardrobe

## Screenshot Copy

- Dolabini tek yerde topla
- Hava, etkinlik ve ruh haline gore kombin oner
- Yeni urun almaya deger mi hizlica karar ver
- Fiyatlari takip et, dusunce bildirim al
- Arkadas dolabi, davet ve odunc akisini tek yerden yonet
- Premium ile limitleri ac

## Subscription Copy

- Monthly display name: Shipirio Premium Aylik
- Yearly display name: Shipirio Premium Yillik
- Entitlement: `premium`
- Premium benefits: Sinirsiz kiyafet, sinirsiz kombin onerisi, Almali Miyim karar motoru, etkinlik kombinleri, gelismis analiz, fiyat takibi ve sosyal ozellikler.
- Restore path: Profile > Subscription > Aboneligi Geri Yukle
- Manage subscription path: iOS App Store account settings / Google Play subscriptions.

## Play Store Data Safety Notes

- Account info: email and profile data for authentication and profile features.
- Photos and videos: wardrobe item photos uploaded by the user.
- App activity: feature usage events for analytics, diagnostics and product improvement.
- Diagnostics: crash and performance data for reliability.
- Purchases: subscription state handled through RevenueCat.
- Approximate location: optional weather-based outfit suggestions, only when the user grants permission.
- Contacts: not uploaded; friend search uses in-app usernames/emails already stored in Shipirio.
- Data deletion: available in app and documented at `https://shipirio.com/delete-account.html`.

## Review Notes

- Premium purchases are managed by RevenueCat.
- AI features may use uploaded item images and wardrobe metadata to produce clothing analysis, outfit suggestions and purchase guidance.
- Price tracking depends on public product pages; unsupported pages may return no detected price.
- Push notifications require device permission and Expo push token registration.
- Reviewer can test core flows with a temporary review account seeded with sample wardrobe items.

## Reviewer Test Flow

1. Sign in with the temporary review account.
2. Open Dolabim and add a clothing item from gallery.
3. Open Kombin and request an outfit suggestion.
4. Open Almali Miyim and run a purchase decision with a sample product image.
5. Open Fiyat Takibi and add a public product URL.
6. Open Sosyal > Arkadaslar to review invite, friend request and lending entry points.
7. Open Profil > Ayarlar to review notification, privacy, subscription and account deletion flows.
