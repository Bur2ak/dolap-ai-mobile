# Dolap AI Mobile

Expo ve React Native ile gelistirilen Dolap AI mobil uygulamasi.

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
supabase secrets set GOOGLE_GEMINI_API_KEY=your-gemini-key
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-key
```

## Premium

Paywall ve freemium kapilari hazir. RevenueCat baglanana kadar paywall butonlari yerel premium onizleme modunu acar.

## Bildirimler

Bildirim tercihleri ve Expo push token kaydi uygulama tarafinda hazir. Gercek cihazda push token icin EAS `projectId` ayarlanmalidir.

## Sosyal

Arkadas arama, istek gonderme, kabul etme ve engelleme akislari Premium kapisi arkasinda hazir.

## Dokumanlar

- `Dolap_AI_Gelistirme_Spesifikasyonu.md`: teknik gelistirme plani
- `Dolap_AI_Uygulama_Raporu.md`: uygulanabilirlik raporu
- `Dolap_AI_Urun_Raporu.docx`: urun raporu
