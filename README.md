# Shipirio Mobile

Expo ve React Native ile gelistirilen Shipirio mobil uygulamasi.

Domain: https://shipirio.com

## Baslangic

```bash
npm install
npm run start
```

Ortam degiskenleri icin `.env.example` dosyasini referans al.

## Ortam Degiskenleri

Mobil uygulamada kullanilan public degiskenler `EXPO_PUBLIC_` ile baslar ve app bundle icine girebilir. Gizli anahtarlar icin Supabase secret veya EAS secret kullan.

Temel public app ayarlari:

- `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY`: app'in Supabase'e baglanmasi icin zorunlu.
- `EXPO_PUBLIC_SITE_URL`: paylasim linkleri icin public domain. Varsayilan `https://shipirio.com`.
- `EXPO_PUBLIC_EAS_PROJECT_ID`: gercek cihaz push token icin gerekli.
- `EXPO_PUBLIC_OPENWEATHER_API_KEY`: hava durumlu kombin onerileri icin gerekli.
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY` ve `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`: gercek abonelik teklifleri icin gerekli.
- `EXPO_PUBLIC_SENTRY_DSN`: runtime hata takibi icin gerekli.
- `EXPO_PUBLIC_POSTHOG_API_KEY` ve `EXPO_PUBLIC_POSTHOG_HOST`: urun analitigi icin gerekli.

Sentry build entegrasyonu icin EAS/CI ortaminda:

- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

App icinden Ayarlar -> Sistem Durumu ekraninda public entegrasyonlarin hazir olup olmadigini anahtar gostermeden kontrol edebilirsin.

## Observability

Sentry runtime hatalari, PostHog ise urun aksiyonlarini takip eder. Auth, dolap, kombin, karar motoru, etkinlik, fiyat takibi ve bildirim tercihleri icin eventler hazirdir. Freemium usage counter RPC'leri hata verirse app lokal sayaca duser ve hata `captureError` ile izlenir.

## Build

```bash
npm run preflight
npm run build:dev:ios
npm run build:preview
npm run build:production
npm run submit:production
```

`npm run preflight`, lokal `.env`, kritik Supabase function dosyalari ve migration klasoru icin hizli kontrol yapar. Gizli Supabase secret degerlerini uzaktan okuyamaz; onlar icin `supabase secrets list` veya dashboard kontrolu gerekir.

## Supabase

Ilk migration:

```bash
supabase db push
```

Migration `profiles`, `wardrobe_items` ve `friendships` icin `updated_at` trigger'larini kurar.

Kiyafet analiz fonksiyonu:

```bash
npm run deploy:functions
```

Tek tek deploy etmek istersen:

```bash
supabase functions deploy analyze-clothing
supabase functions deploy remove-background
supabase functions deploy recommend-outfit
supabase functions deploy buy-decision
supabase functions deploy event-outfit
supabase functions deploy send-notification
supabase functions deploy price-check
supabase functions deploy revenuecat-webhook
supabase functions deploy process-account-deletions
supabase secrets set GOOGLE_GEMINI_API_KEY=your-gemini-key
supabase secrets set REMOVE_BG_API_KEY=your-remove-bg-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set REVENUECAT_WEBHOOK_SECRET=your-webhook-secret
supabase secrets set ACCOUNT_DELETION_CRON_SECRET=your-cron-secret
```

## Premium

Paywall, abonelik durumu ekrani, RevenueCat webhook ve freemium kapilari hazir. Yerel premium onizleme sadece gelistirme modunda acilir; preview/production build'lerde premium durumu RevenueCat entitlement'i veya Supabase profil tier'i ile belirlenir.

RevenueCat webhook `REVENUECAT_WEBHOOK_SECRET` ile korunur ve `premium` / `family` entitlement veya product event'lerini `profiles.subscription_tier` alanina yazar. `CANCELLATION` ve `BILLING_ISSUE` event'leri kullaniciyi hemen free'ye dusurmez; entitlement suresi dolana kadar premium erisim korunur. `EXPIRATION` geldikten sonra profil free'ye cekilir.

## Bildirimler

Bildirim tercihleri, bildirim kutusu, okundu/silme akislari, Expo push token kaydi ve `send-notification` Edge Function hazir. Fiyat dususu, arkadas istegi, kombin oyu ve odunc istegi bildirimleri kullanici tercihine gore olusturulur. Gercek cihazda push token icin EAS `projectId` ayarlanmalidir.

EAS projectId icin projeyi Expo hesabina bagla:

```bash
eas init
```

Bu islemden sonra EAS build'lerde `Constants.easConfig.projectId` otomatik gelir. Lokal gelistirmede `.env` icine `EXPO_PUBLIC_EAS_PROJECT_ID` ekleyerek ayni degeri kullanabilirsin.

## Fiyat Takibi

Fiyat takip CRUD ekranina ek olarak kayitlar duzenlenebilir, `price-check` Edge Function aktif takipleri kontrol eder, uygulama icinden manuel tetiklenebilir ve hedef fiyat altinda bildirim kaydi ile push bildirimi olusturur.

Otomatik fiyat kontrolu icin `supabase/cron/price_check_cron.sql.example` dosyasini kopyalayip placeholder degerlerini Supabase SQL Editor'de doldurarak calistir. Doldurulmus servis anahtarini repoya ekleme.

## Karar Motoru

Almali Miyim ekrani urun fotografi, fiyat ve mevcut dolap verisiyle AI karari uretir; kaydedilen kararlar son 20 kayit olarak gecmiste listelenir.

## Sosyal

Arkadas arama, istek gonderme, istek bildirimi, istek iptali, kabul etme, arkadasliktan cikarma, engelleme, davet linki, filtrelenebilir paylasilan arkadas dolabi ve kombine oy verme akislari Premium kapisi arkasinda hazir.

## Hesap Ayarlari

Profil bilgisi, dogrulanmis kullanici adi, bio siniri, gizlilik tercihleri, yasal onay durumu ve 30 gun beklemeli hesap silme talebi ayarlar ekranlarindan guncellenebilir. Eski/test hesaplarinda KVKK veya sartlar onayi eksikse Hesap ekranindan tek seferlik tamamlanabilir. `process-account-deletions` Edge Function `{"dryRun": false}` ile cagrildiginda suresi dolan silme talepleri icin once `wardrobe-images/{userId}` storage dosyalarini, sonra auth kullanicisini silerek cascade verileri temizler.

Otomatik hesap silme islemi icin `supabase/cron/account_deletion_cron.sql.example` dosyasini kopyalayip placeholder degerlerini Supabase SQL Editor'de doldurarak calistir.

## Analiz

Dolap analiz ekrani toplam deger, maliyet/giyim, kullanim skoru, 90 gun atil kalan parcalar, kategori/renk/sezon dagilimi ve Premium gelismis temizlik onerilerini gosterir.

## Dolap

Kiyafetler kategori filtresi ve marka, renk, sezon veya kategori aramasi ile bulunabilir; detay ekraninda kategori, sezon, renk, marka ve fiyat bilgileri duzenlenebilir. Kiyafet eklerken gorsel once optimize edilir, `remove-background` fonksiyonu anahtar varsa arka plani siler, anahtar yoksa optimize gorselle devam eder.

Son 30 kiyafet ve son 3 kombin onerisi lokal cache'lenir; ag hatasinda kullanici dolabini ve son onerileri offline fallback olarak gorebilir.

## Auth

Giris, kayit, temel form dogrulamasi, legal linkler ve Supabase email sifre sifirlama akislari hazir.

## Deep Link ve Domain

`app.json` icinde iOS associated domains ve Android app links `shipirio.com` / `www.shipirio.com` icin hazir. Domain hosting tarafinda `.well-known` dosyalarini yayinlamak icin `public/.well-known/apple-app-site-association.example` ve `public/.well-known/assetlinks.json.example` sablonlarini gercek Apple Team ID ve Android SHA-256 sertifika parmak iziyle doldur.

Store hazirlik URL'leri icin statik `public/privacy.html`, `public/support.html` ve `public/delete-account.html` dosyalari hazir. App Store / Play Console alanlarinda `https://shipirio.com/privacy.html`, `https://shipirio.com/support.html` ve `https://shipirio.com/delete-account.html` kullanilabilir. Detayli kontrol listesi `docs/store-readiness.md`, magaza aciklama taslagi `docs/store-listing.md` icindedir.

Release oncesi `docs/store-readiness.md` icindeki Supabase function, secret, cron ve domain maddelerini tamamla.

## Etkinlik

Etkinlik planlari Supabase'e kaydedilebilir, kayitli etkinlikler listelenebilir, duzenlenebilir, silinebilir ve desteklenen cihazlarda sistem takvimine eklenebilir.

## Kombinler

AI kombin onerileri kaydedilebilir, arkadasa sorulabilir, kayitli kombinler listelenebilir, favoriye alinabilir, giyildi olarak isaretlenebilir ve silinebilir.

## Legal

Shipirio KVKK aydinlatma metni, gizlilik politikasi ve kullanim sartlari uygulama icinde `/legal/kvkk`, `/legal/privacy` ve `/legal/terms` ekranlarinda hazir.

## Dokumanlar

- `Dolap_AI_Gelistirme_Spesifikasyonu.md`: teknik gelistirme plani
- `Dolap_AI_Uygulama_Raporu.md`: uygulanabilirlik raporu
- `Dolap_AI_Urun_Raporu.docx`: urun raporu
