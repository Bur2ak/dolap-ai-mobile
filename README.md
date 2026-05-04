# Shipirio Mobile

Expo ve React Native ile gelistirilen Shipirio mobil uygulamasi.

Domain: https://shipirio.com

## Baslangic

```bash
npm install
npm run start
```

Ortam degiskenleri icin `.env.example` dosyasini referans al.

## Supabase

Ilk migration:

```bash
supabase db push
```

Kiyafet analiz fonksiyonu:

```bash
supabase functions deploy analyze-clothing
supabase functions deploy recommend-outfit
supabase functions deploy buy-decision
supabase functions deploy event-outfit
supabase functions deploy price-check
supabase functions deploy revenuecat-webhook
supabase secrets set GOOGLE_GEMINI_API_KEY=your-gemini-key
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set REVENUECAT_WEBHOOK_SECRET=your-webhook-secret
```

## Premium

Paywall, abonelik durumu ekrani, RevenueCat webhook ve freemium kapilari hazir. RevenueCat baglanana kadar paywall butonlari yerel premium onizleme modunu acar.

## Bildirimler

Bildirim tercihleri, bildirim kutusu ve Expo push token kaydi uygulama tarafinda hazir. Gercek cihazda push token icin EAS `projectId` ayarlanmalidir.

## Fiyat Takibi

Fiyat takip CRUD ekranina ek olarak `price-check` Edge Function aktif takipleri kontrol eder, uygulama icinden manuel tetiklenebilir ve hedef fiyat altinda bildirim kaydi olusturur.

## Sosyal

Arkadas arama, istek gonderme, kabul etme, engelleme, davet linki, paylasilan arkadas dolabi ve kombine oy verme akislari Premium kapisi arkasinda hazir.

## Hesap Ayarlari

Profil bilgisi, kullanici adi ve gizlilik tercihleri ayarlar ekranlarindan guncellenebilir.

## Auth

Giris, kayit ve Supabase email sifre sifirlama akislari hazir.

## Legal

Shipirio gizlilik politikasi ve kullanim sartlari uygulama icinde `/legal/privacy` ve `/legal/terms` ekranlarinda hazir.

## Dokumanlar

- `Dolap_AI_Gelistirme_Spesifikasyonu.md`: teknik gelistirme plani
- `Dolap_AI_Uygulama_Raporu.md`: uygulanabilirlik raporu
- `Dolap_AI_Urun_Raporu.docx`: urun raporu
