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
supabase secrets set GOOGLE_GEMINI_API_KEY=your-gemini-key
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-key
```

## Dokumanlar

- `Dolap_AI_Gelistirme_Spesifikasyonu.md`: teknik gelistirme plani
- `Dolap_AI_Uygulama_Raporu.md`: uygulanabilirlik raporu
- `Dolap_AI_Urun_Raporu.docx`: urun raporu
