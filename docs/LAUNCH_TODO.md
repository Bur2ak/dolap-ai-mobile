# Shipirio — Tam Launch Yol Haritası (Öncelikli)

QA raporu + bekleyen işler + production hazırlık birleştirilmiş tam liste.
Sırayla yapılmalı. ✅ = bitti, 🔲 = bekliyor.

---

## FAZ 0 — LAUNCH BLOCKER'LARI (bunlar bitmeden 1 kullanıcı bile alma)

### Güvenlik & Maliyet (en acil — maliyet patlaması riski)
- 🔲 **0.1** `detect-garments` edge function'a JWT auth ekle (şu an auth'suz — herkes Gemini harcayabilir)
- 🔲 **0.2** `analyze-clothing` edge function'a JWT auth ekle
- 🔲 **0.3** `remove-background` edge function'a JWT auth ekle
- 🔲 **0.4** Server-side usage limit: edge function içinde `usage_counters` tablosundan günlük sayaç kontrolü (Gemini çağrısından ÖNCE) — client-side MMKV bypass'ını kapat
- 🔲 **0.5** Rate limiting: user/IP başına edge function throttle (Upstash Redis veya DB sayacı)
- 🔲 **0.6** Gemini maliyet modeli hesapla → free tier limitini ona göre ayarla (günde kaç çağrı sürdürülebilir?)

### Altyapı
- 🔲 **0.7** Supabase Pro plan'a geç ($25/ay) — free tier production'da haftalık uyuyor, kullanıcı geldiğinde çöker
- 🔲 **0.8** RevenueCat production setup (docs/REVENUECAT_SETUP.md) — şu an para alınamıyor
- 🔲 **0.9** Global Error Boundary (root layout) + Sentry'ye bağla — tek render hatası tüm uygulamayı düşürüyor

### KVKK / Yasal
- 🔲 **0.10** Renk DNA selfie'si "biyometrik veri" — açık rıza ekranı + saklama/silme politikası (KVKK zorunlu)

---

## FAZ 1 — PRODUCTION HAZIRLIK (launch haftasında)

### Edge function deploy & test
- ✅ detect-garments deploy edildi
- ✅ color-dna deploy edildi
- ✅ migration 026 uygulandı
- 🔲 **1.1** detect-garments gerçek fotoğrafla test (bbox doğruluğu — 5 parça ser, kaç tanıyor?)
- 🔲 **1.2** color-dna gerçek selfie ile test (mantıklı sonuç mu?)
- 🔲 **1.3** Avatar upload gerçek test (avatars bucket + RLS çalışıyor mu?)

### Native build & store
- 🔲 **1.4** EAS production build (iOS + Android)
- 🔲 **1.5** App Store Connect uygulama oluştur + screenshots (docs/STORE_ASSETS_GUIDE.md)
- 🔲 **1.6** Play Console uygulama oluştur + service account JSON
- 🔲 **1.7** Store listing metinlerini gir (docs/STORE_LISTING_TR.md + EN)
- 🔲 **1.8** App icon final kontrol (1024 + 512)

### Monitoring
- 🔲 **1.9** UptimeRobot kur (shipirio.com + Supabase health check)
- 🔲 **1.10** Sentry alert kuralları (kritik hata → bildirim)
- 🔲 **1.11** Supabase DB backup doğrula (Pro'da PITR aktif mi?)

---

## FAZ 2 — BETA TEST (50-100 kullanıcı)

- 🔲 **2.1** TestFlight internal testing (docs/BETA_TESTING_GUIDE.md)
- 🔲 **2.2** Play Internal Testing
- 🔲 **2.3** 50 gerçek kullanıcı getir (el ile — çevre, Instagram)
- 🔲 **2.4** 10 kullanıcıyı birebir izle (nerede takılıyorlar?)
- 🔲 **2.5** PostHog funnel kur: kayıt → ilk parça → ilk kombin → 2. gün dönüş
- 🔲 **2.6** Aktivasyon oranını ölç (kaç kişi 5+ parça ekledi?)
- 🔲 **2.7** D1/D7 retention ölç

---

## FAZ 3 — UX & FRİKSİYON İYİLEŞTİRME (bekleyen + QA bulguları)

### Friksiyon (kısmen yapıldı)
- ✅ Onboarding reframe ("5 favori parça")
- ✅ Akıllı Tarama (tek fotoğrafta çoklu parça)
- ✅ Galeri import
- 🔲 **3.1** İlk parça eklenince ANINDA kombin göster (aha moment — 60 sn)
- 🔲 **3.2** Giyim günlüğü streak (Duolingo mantığı — retention)
- 🔲 **3.3** Davranışsal retention push ("hava 8°, dün giydiğin montu öner")

### Bekleyen tasarım işleri
- 🔲 **3.4** Profil mockup'ı (landing için — kullanıcı görsel verecek)
- 🔲 **3.5** Stil DNA paylaşılabilir kart (viral mekanizma — Instagram story)

---

## FAZ 4 — GELİR & BÜYÜME (launch sonrası)

- 🔲 **4.1** Affiliate entegrasyonu (Trendyol/Zara linkleri — "Almalı Mıyım?" sonucu)
- 🔲 **4.2** Dolap.com satış komisyonu entegrasyonu
- 🔲 **4.3** Referral mekanizması (arkadaş davet → premium gün)
- 🔲 **4.4** Mikro-influencer kampanyası (5-10 işbirliği)
- 🔲 **4.5** TikTok/Instagram UGC içerik makinesi

---

## FAZ 5 — ÖLÇEKLENME (10K+ kullanıcı)

- 🔲 **5.1** AI çağrılarını kuyruğa al (anında değil — queue)
- 🔲 **5.2** Gemini response cache (aynı kombin tekrar hesaplanmasın)
- 🔲 **5.3** pgvector IVFFlat index tune (100K+ item)
- 🔲 **5.4** k6/Artillery load test (1000 eşzamanlı kullanıcı)
- 🔲 **5.5** Admin dashboard (kullanıcı/gelir/kullanım metrikleri)
- 🔲 **5.6** Web uygulaması versiyonu

---

## ÖZET — İLK 10 AKSİYON (kesin sıra)

1. detect-garments + analyze-clothing + remove-background auth (0.1-0.3)
2. Server-side usage limit (0.4)
3. Rate limiting (0.5)
4. Gemini maliyet modeli + free limit (0.6)
5. Supabase Pro (0.7)
6. Error Boundary (0.9)
7. RevenueCat production (0.8)
8. KVKK selfie rıza (0.10)
9. Gerçek cihaz testi: Akıllı Tarama + Renk DNA + Avatar (1.1-1.3)
10. EAS build → TestFlight → 50 kullanıcı (1.4 + 2.1 + 2.3)

> **Faz 0 + Faz 1 = ~1 hafta. Sonra beta. Beta'da retention iyiyse → store launch.**
