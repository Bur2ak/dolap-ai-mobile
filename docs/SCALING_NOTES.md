# Ölçeklenme Notları (Faz 5)

## ✅ Yapıldı
- **5.2 AI response cache** — recommend-outfit aynı parametre+gardrop imzasında Gemini'yi atlar (migration 028, _shared/cache.ts). 6 saat TTL. Maliyet + hız kazancı.
- **5.4 Load test** — `docs/load-test.js` (k6). 100/1000/10000 senaryoları.
- **5.5 Admin metrics** — `admin_metrics` + `admin_activation` view'ları (migration 029). Supabase SQL Editor'den tek sorgu.
- **5.3 pgvector index** — IVFFlat index zaten var (migration 021/024). 100K+ item'a kadar tune gerekmez.

## ⏸️ ERTELENDİ (şu an GEREK YOK — dürüst değerlendirme)

### 5.1 AI çağrı kuyruğu (queue)
**Neden ertelendi:** 0 kullanıcı + rate limit (20/dk) + cache zaten var. Queue altyapısı (Redis/QStash) karmaşıklık ve maliyet ekler. Gerçek ihtiyaç: **eşzamanlı 1000+ kullanıcı Gemini'ye aynı anda vurduğunda.** O noktaya gelince (10K+ DAU) eklenir.
**Ne zaman:** Gemini kota hatası (429 from Google) görmeye başlayınca.

### Web uygulaması
**Neden ertelendi:** Mobil-first doğru karar. Web ayrı bir ürün eforu. Önce mobilde PMF kanıtla.

## 📊 Ölçeklenme Tetikleyicileri (ne zaman ne yapılmalı)

| Sinyal | Aksiyon |
|---|---|
| DAU > 100 | Supabase Pro'ya geç |
| Gemini latency p95 > 3sn | Cache TTL'i uzat, prompt küçült |
| Google'dan 429 (kota) | AI queue ekle (5.1) |
| DB CPU > %70 | pgvector index tune, read replica |
| Cache hit < %30 | Cache key stratejisini gözden geçir |

## Maliyet Projeksiyonu (kabaca)
- Gemini 2.0 Flash görsel: ~$0.0001-0.0003/çağrı
- Free kullanıcı günde max 60 AI çağrısı (limit) ama ortalama ~5-10
- 1000 aktif kullanıcı × 10 çağrı/gün = 10K çağrı/gün ≈ $1-3/gün
- Cache %40 hit → maliyet %40 düşer
- **Sonuç:** AI maliyeti düşük; asıl maliyet Supabase Pro ($25/ay) + remove.bg API
