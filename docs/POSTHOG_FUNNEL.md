# PostHog Funnel & Retention Kurulumu

Kod tarafı hazır — tüm event'ler uygulamada `captureEvent` ile gönderiliyor.
Bu dokümandaki funnel'ları PostHog dashboard'unda tanımla (2-3 dakika, dashboard işi).

## Ön Koşul
`.env`'de `EXPO_PUBLIC_POSTHOG_API_KEY` set olmalı (yoksa event gitmez).
PostHog ücretsiz plan: aylık 1M event — beta için fazlasıyla yeter.

---

## ANA FUNNEL — Aktivasyon (en kritik metrik)

PostHog → Funnels → New Funnel → şu adımları sırayla ekle:

| Adım | Event | Anlamı |
|---|---|---|
| 1 | `auth_register_completed` | Kayıt oldu |
| 2 | `wardrobe_add_screen_viewed` | Ekleme ekranını açtı |
| 3 | `wardrobe_add_flow_completed` VEYA `smart_scan_completed` | İlk parçayı ekledi (AKTİVASYON) |
| 4 | `outfit_screen_viewed` | Kombin sekmesine gitti |
| 5 | `outfit_recommendation_*` | İlk kombin önerisi aldı (AHA MOMENT) |

**Hedef:** Adım 1 → 3 dönüşümü > %40 olmalı. Düşükse onboarding friksiyonu var.

---

## RETENTION — Geri dönüş

PostHog → Retention → şu ayarlar:
- **First event:** `auth_register_completed`
- **Returning event:** `app_opened` veya herhangi `*_screen_viewed`
- **Period:** Daily

**Hedef:**
- D1 (1. gün dönüş) > %40
- D7 (7. gün) > %25
- D30 > %15

Bunların altındaysa retention problemi var → streak/push gerekir.

---

## EK FUNNEL — Premium Dönüşüm (gelir sonrası)

| Adım | Event |
|---|---|
| 1 | `paywall_viewed` |
| 2 | `paywall_purchase_started` |
| 3 | `paywall_purchase_completed` |

---

## İZLENECEK ÖZELLİK KULLANIMI (hangi feature tutuyor?)

PostHog → Insights → Trends, şu event'leri karşılaştır:
- `smart_scan_completed` (Akıllı Tarama)
- `color_dna_analysis_completed` (Renk DNA)
- `outfit_diary_entry_added` (Giyim günlüğü)
- `style_chat_message_sent` (Stil asistanı)
- `buy_decision_completed` (Almalı Mıyım)

**En çok kullanılan 3 özellik = senin "killer feature"ların.** Pazarlamayı onlara odakla.
En az kullanılanlar = ya görünür değil ya da değersiz → kaldırmayı veya iyileştirmeyi düşün.

---

## Beta'da İzlenecek Kuzey Yıldızı Metrik

**"İlk 7 günde 5+ parça ekleyip 1+ kombin önerisi alan kullanıcı oranı"**

Bu metrik yüksekse (>%30) → PMF sinyali var, büyümeye bas.
Düşükse → ürün henüz tutmuyor, friksiyonu çöz.
