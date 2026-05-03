# Dolap AI — Uygulama Fizibilite & Teknik Yol Haritası Raporu

> Hazırlayan: Claude Code AI Analiz | Tarih: Mayıs 2026  
> Kaynak Belge: Dolap_AI_Urun_Raporu v1.0

---

## İÇİNDEKİLER

1. [Yönetici Özeti](#1-yönetici-özeti)
2. [Ne Kadar Uygulayabiliriz? — Genel Fizibilite Skoru](#2-ne-kadar-uygulayabiliriz--genel-fizibilite-skoru)
3. [Özellik Bazlı Uygulama Analizi](#3-özellik-bazlı-uygulama-analizi)
4. [Kullanılacak Araçlar & Teknoloji Stack'i](#4-kullanılacak-araçlar--teknoloji-stacki)
5. [AI Mimarisi — Detaylı Uygulama Planı](#5-ai-mimarisi--detaylı-uygulama-planı)
6. [Aşamalı Geliştirme Planı (Sprint Bazlı)](#6-aşamalı-geliştirme-planı-sprint-bazlı)
7. [Maliyet Analizi — Gerçekçi Bütçe](#7-maliyet-analizi--gerçekçi-bütçe)
8. [Teknik Riskler & Çözüm Önerileri](#8-teknik-riskler--çözüm-önerileri)
9. [Trendyol & Dış Entegrasyonlar — Gerçeklik Kontrolü](#9-trendyol--dış-entegrasyonlar--gerçeklik-kontrolü)
10. [Hukuki & KVKK Gereksinimleri](#10-hukuki--kvkk-gereksinimleri)
11. [Ekip Gereksinimleri](#11-ekip-gereksinimleri)
12. [Başlangıç İçin En Kritik Adım](#12-başlangıç-için-en-kritik-adım)

---

## 1. Yönetici Özeti

Dolap AI ürün raporu, teknik olarak **büyük ölçüde uygulanabilir** bir vizyonu tanımlamaktadır. Kullanılan teknolojilerin (React Native, Supabase, Claude API) tamamı bugün erişilebilir, stabil ve iyi belgelenmiştir. Ancak bazı özellikler (Trendyol entegrasyonu, ayna selfie ile toplu tespit, fiyat geçmişi analizi) resmi API erişimi olmadan kısıtlı kalacaktır.

**Genel Değerlendirme:**
- %80'i mevcut araçlarla doğrudan uygulanabilir
- %15'i üçüncü taraf izin/API gerektirir
- %5'i teknik olarak karmaşık veya çözülmesi gereken bilinmeyenler içerir

---

## 2. Ne Kadar Uygulayabiliriz? — Genel Fizibilite Skoru

| Özellik Grubu | Uygulanabilirlik | Süre | Zorluk |
|---|---|---|---|
| Dijital Dolap Oluşturma (tekli fotoğraf) | ✅ Tam | 2–3 hafta | Orta |
| Ayna selfie ile toplu tespit | ⚠️ Kısmi | 4–6 hafta | Yüksek |
| Arka plan silme | ✅ Tam | 2–3 gün | Düşük |
| Kombin Önerisi Motoru | ✅ Tam | 3–4 hafta | Orta |
| Hava durumu entegrasyonu | ✅ Tam | 1–2 gün | Düşük |
| "Bu kıyafeti almalı mıyım?" | ✅ Tam | 1–2 hafta | Orta |
| "Şuraya gidiyorum" özelliği | ✅ Tam | 1 hafta | Düşük |
| Gardrop Analitiği | ✅ Tam | 1–2 hafta | Düşük |
| Sosyal özellikler | ✅ Tam | 2–3 hafta | Orta |
| Trendyol sipariş geçmişi import | ⚠️ Kısmi | Belirsiz | Çok Yüksek |
| Trendyol fiyat takibi | ⚠️ Kısmi | 2–4 hafta | Yüksek |
| RevenueCat ile abonelik | ✅ Tam | 3–5 gün | Düşük |
| Push bildirimleri | ✅ Tam | 1–2 gün | Düşük |

---

## 3. Özellik Bazlı Uygulama Analizi

### 3.1 Dijital Dolap Oluşturma

#### Tekli Fotoğraf + Arka Plan Silme
**Nasıl Uygulanır:**
1. Kullanıcı kıyafet fotoğrafı çeker veya galeriden seçer.
2. **Remove.bg API** ile arka plan otomatik silinir (ayda 50 ücretsiz, sonrası $9/1000 görsel).
3. Alternatif: **Anthropic Vision** ile arka plan silme prompt'u kullanılabilir, ancak Remove.bg daha temiz sonuç verir.
4. Temizlenen görsel **Supabase Storage**'a yüklenir.
5. **Claude Haiku 4.5** görseli analiz eder ve şu metadata'yı çıkarır:
   - Renk (ana renk + ton)
   - Kategori (üst, alt, dış giyim, ayakkabı, aksesuar)
   - Kumaş tipi (tahmin)
   - Desen (düz, çizgili, çiçekli, baskılı)
   - Kalıp (slim fit, oversize, crop, vb.)
   - Mevsim uygunluğu
   - Formality seviyesi (casual, smart casual, formal)

```
Örnek Prompt (Claude Haiku):
"Bu kıyafet görselini analiz et. JSON formatında şunları döndür:
{category, colors[], pattern, fit, fabric_estimate, season[], formality_level, dominant_color_hex}"
```

**Veri Tabanı Şeması (Supabase):**
```sql
CREATE TABLE wardrobe_items (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  image_url TEXT,
  category TEXT,
  colors JSONB,
  pattern TEXT,
  fit TEXT,
  season TEXT[],
  formality TEXT,
  brand TEXT,
  purchase_price DECIMAL,
  wear_count INTEGER DEFAULT 0,
  last_worn DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Ayna Selfie ile Toplu Tespit
**Durum: ⚠️ Kısmi Uygulanabilir**

Bu özellik, tek bir selfie'den üzerindeki tüm kıyafetlerin otomatik tespitini kapsar. Claude Vision bunu yapabilir ancak sınırları vardır:
- Üst üste katmanlı kıyafetleri karıştırabilir
- Aksesuar tespiti zayıf olabilir
- Birden fazla parçayı aynı anda kaydetme için UI akışı karmaşıklaşır

**Pratik Yaklaşım:**
```
Prompt: "Bu ayna selfiede görünen tüm kıyafet parçalarını listele.
Her parça için: {type, color, visible_details} döndür.
Emin olmadığın parçaları 'uncertain: true' ile işaretle."
```
MVP için bu özelliği basit tutmak önerilir: "Bugün giydiğin kombini kaydet" akışı olarak sunulabilir.

---

### 3.2 Kombin Önerisi Motoru

**Nasıl Uygulanır — Tam Akış:**

1. Kullanıcı giriş yapar:
   - Nereye gidiyorum? (dropdown veya serbest metin)
   - Ruh halim nasıl? (minimal UI: 5 emoji)
2. Backend OpenWeatherMap'ten anlık hava verisini çeker.
3. **Claude Sonnet 4.6**'ya şu context gönderilir:
   - Kullanıcının tüm dolap itemları (JSON array)
   - Hava durumu (sıcaklık, durum)
   - Etkinlik türü
   - Ruh hali
   - Son 7 günde giyilenler (tekrar önermeyi önlemek için)
4. Claude 3 farklı kombin döndürür (item ID'leri ve gerekçesiyle).
5. UI bu kombin item ID'lerini Supabase'den çekip görselleri render eder.

**Kritik Optimizasyon — Prompt Caching:**
```python
# Kullanıcının tüm dolap verisi cache'lenir
# Sadece hava + etkinlik değişir her istekte
# Bu %70-80 token tasarrufu sağlar

system_prompt = """Sen Dolap AI'sın. Kullanıcının gardrobu:
{user_wardrobe_json}  # <-- Bu kısım cache'lenir
"""
```

**Teknik Not:** Claude API'nin prompt caching özelliği burada kritiktir. Dolap verisi 1000+ item'a çıkabilir, her istekte yeniden göndermek maliyetli olur. Supabase'de `cache_token` saklanabilir.

---

### 3.3 "Bu Kıyafeti Almalı Mıyım?" Özelliği

**En güçlü ve viral özellik. Tam uygulanabilir.**

**Akış:**
1. Kullanıcı fotoğraf yükler veya URL yapıştırır.
2. Claude Sonnet görseli + kullanıcının dolabını analiz eder.
3. Sonuç JSON:
   ```json
   {
     "decision": "AL|BEKLEME|ALMA",
     "confidence": 0.85,
     "similar_items_owned": ["item_id_1", "item_id_2"],
     "potential_combinations": 7,
     "combination_examples": [...],
     "price_analysis": "Bu fiyata 12 kez giyersen mantıklı",
     "reasoning": "Dolabında 2 benzer kıyafet var..."
   }
   ```
4. UI kararı görsel olarak sunar (büyük AL/BEKLEME/ALMA butonu + gerekçe).

**Fiyat Geçmişi Analizi:**
- Trendyol resmi API olmadan bu özellik kısıtlıdır.
- **Alternatif:** [Keepa](https://keepa.com) benzeri bir yapı için kendi fiyat geçmişi veritabanı oluşturulabilir (kullanıcılar fiyat girerken sistem kayıt tutar).
- Kısa vadede bu feature "Kullanıcı fiyat girir → maliyet/giyim hesapla" şeklinde basit tutulabilir.

---

### 3.4 Gardrop Analitiği

**Tam uygulanabilir. Saf hesaplama + görselleştirme.**

Supabase sorguları ile hesaplanır:
- En çok / en az giyilen: `ORDER BY wear_count`
- Renk dağılımı: `GROUP BY dominant_color`
- Toplam değer: `SUM(purchase_price)`
- Maliyet/giyim: `purchase_price / wear_count`

Frontend'de **Victory Native** veya **React Native Chart Kit** ile grafikler çizilir.

"Bunları sat" önerisi için rule-based mantık:
- 6+ ay hiç giyilmemiş
- Wear count = 0
- Sezon dışı + low formality overlap

---

### 3.5 Sosyal Özellikler

**Tam uygulanabilir. Supabase Row Level Security (RLS) ile güvenli şekilde yapılabilir.**

Arkadaş sistemi için:
```sql
CREATE TABLE friendships (
  user_id UUID,
  friend_id UUID,
  status TEXT, -- 'pending', 'accepted'
  created_at TIMESTAMPTZ
);

-- Kıyafet paylaşım izni
ALTER TABLE wardrobe_items ADD COLUMN is_shareable BOOLEAN DEFAULT FALSE;
ALTER TABLE wardrobe_items ADD COLUMN lendable BOOLEAN DEFAULT FALSE;
```

Kombin oylama için gerçek zamanlı güncelleme: **Supabase Realtime** kullanılır (WebSocket tabanlı, ekstra kurulum gerektirmez).

---

### 3.6 Fiyat Takibi & Bildirimler

**Kısmi uygulanabilir.**

- Kullanıcı ürün URL'si ekler veya manuel fiyat girer.
- **Expo Notifications** ile bildirim gönderilir.
- Trendyol fiyat scraping: teknik olarak mümkün ama Trendyol ToS'u ihlal edebilir. Resmi partnership olmadan riskli.
- **Güvenli Alternatif:** Kullanıcı fiyatı manuel ekler, sistem %20+ düşüş olursa hatırlatır.

---

## 4. Kullanılacak Araçlar & Teknoloji Stack'i

### 4.1 Frontend — Mobil Uygulama

| Araç | Versiyon | Kullanım Amacı | Maliyet |
|---|---|---|---|
| **React Native** | 0.74+ | Ana mobil framework | Ücretsiz |
| **Expo SDK** | 51+ | Build pipeline, native modüller | Ücretsiz (EAS Build ücretli) |
| **Expo Router** | v3 | Dosya tabanlı navigation | Ücretsiz |
| **React Native Reanimated** | 3.x | Smooth animasyonlar | Ücretsiz |
| **Expo Image Picker** | latest | Fotoğraf çekme/seçme | Ücretsiz |
| **Expo Camera** | latest | Kamera erişimi | Ücretsiz |
| **React Native Skia** | latest | Kombin canvas görselleştirme | Ücretsiz |
| **Victory Native** | latest | Analitik grafikler | Ücretsiz |
| **React Native MMKV** | latest | Lokal hızlı storage (cache) | Ücretsiz |
| **Zustand** | 4.x | State management | Ücretsiz |
| **TanStack Query** | 5.x | Server state, caching | Ücretsiz |
| **Zod** | 3.x | Schema validation | Ücretsiz |

### 4.2 Backend & Veritabanı

| Araç | Plan | Kullanım Amacı | Maliyet |
|---|---|---|---|
| **Supabase** | Free → Pro | DB, Auth, Storage, Realtime | $0 → $25/ay |
| **Supabase Auth** | Dahil | Kullanıcı kimlik doğrulama | Dahil |
| **Supabase Storage** | Dahil | Kıyafet görselleri | 5GB ücretsiz |
| **Supabase Edge Functions** | Dahil | Serverless API endpoints | 2M req/ay ücretsiz |
| **Supabase Realtime** | Dahil | Sosyal özellikler, anlık güncellemeler | Dahil |
| **PostgreSQL (via Supabase)** | Dahil | Ana veritabanı | Dahil |
| **pgvector (via Supabase)** | Dahil | Kıyafet benzerlik araması | Dahil |

### 4.3 Yapay Zeka & API'ler

| Araç | Model/Plan | Kullanım Amacı | Tahmini Maliyet |
|---|---|---|---|
| **Anthropic Claude API** | Haiku 4.5 | Fotoğraf analizi, metadata çıkarma | ~$0.001/istek |
| **Anthropic Claude API** | Sonnet 4.6 | Kombin önerisi, karar motoru | ~$0.005–0.007/istek |
| **Anthropic Prompt Caching** | Otomatik | Dolap verisi cache'i | %90'a kadar tasarruf |
| **Anthropic Batch API** | Async | Analitik, toplu işlemler | %50 indirimli |
| **Remove.bg API** | Free tier | Arka plan silme | 50/ay ücretsiz, $9/1000 |
| **OpenWeatherMap API** | Free tier | Hava durumu | 60 req/dk ücretsiz |

**Alternatif Arka Plan Silme Seçenekleri:**
- **Replicate + REMBG modeli**: Daha ucuz, kendi altyapında çalışır ($0.001/görsel)
- **Cloudflare Workers AI**: Edge'de çalışır, düşük latency
- **PhotoRoom API**: Remove.bg'ye alternatif, bazen daha temiz sonuç

### 4.4 Ödeme & Monetizasyon

| Araç | Kullanım Amacı | Maliyet |
|---|---|---|
| **RevenueCat** | iOS + Android abonelik yönetimi | $0 (ilk $2500/ay revenue) |
| **Superwall** | Paywall A/B testi ve optimizasyon | $0 (250 MAU'ya kadar) |
| **AdMob (Google)** | Reklam geliri | Revenue share |
| **Yandex Ads** | Türkiye odaklı reklam (AdMob alternatifi) | Revenue share |

### 4.5 Deployment & DevOps

| Araç | Kullanım Amacı | Maliyet |
|---|---|---|
| **EAS Build (Expo)** | iOS + Android build | $0 (limited) → $29/ay |
| **Vercel** | Edge functions, webhook'lar | $0 → $20/ay |
| **Sentry** | Crash reporting, error tracking | $0 (5K errors/ay) |
| **PostHog** | Product analytics, funnel analizi | $0 (1M events/ay) |
| **LogRocket (Mobile)** | Session replay, hata ayıklama | $0 (1K sessions/ay) |
| **GitHub Actions** | CI/CD pipeline | $0 (public) |

### 4.6 Geliştirme Araçları

| Araç | Kullanım Amacı |
|---|---|
| **TypeScript** | Tip güvenliği (zorunlu) |
| **ESLint + Prettier** | Kod kalitesi |
| **Biome** | Daha hızlı linting/formatting |
| **Maestro** | E2E mobil test otomasyonu |
| **Storybook (RN)** | UI component geliştirme |

---

## 5. AI Mimarisi — Detaylı Uygulama Planı

### 5.1 Anthropic SDK Entegrasyonu

```typescript
// lib/ai/claude.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Fotoğraf analizi — Haiku (ucuz + hızlı)
export async function analyzeClothingItem(imageBase64: string) {
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: imageBase64 },
          },
          {
            type: "text",
            text: `Bu kıyafeti analiz et. Türkçe olarak şu JSON'u döndür:
{
  "category": "üst/alt/dış_giyim/etek/elbise/ayakkabı/aksesuar",
  "colors": ["renk1", "renk2"],
  "dominant_color_hex": "#RRGGBB",
  "pattern": "düz/çizgili/kareli/çiçekli/baskılı",
  "fit": "slim/regular/oversize/crop",
  "fabric_estimate": "pamuk/polyester/denim/yün/ipek/bilinmiyor",
  "season": ["yaz","kış","ilkbahar","sonbahar"],
  "formality": "casual/smart_casual/business/formal/spor",
  "style_tags": ["tag1","tag2"]
}`,
          },
        ],
      },
    ],
  });
  return JSON.parse(response.content[0].text);
}
```

### 5.2 Kombin Önerisi — Prompt Caching ile

```typescript
// lib/ai/outfit-recommender.ts
export async function recommendOutfits(params: {
  wardrobe: WardrobeItem[];
  event: string;
  weather: WeatherData;
  mood: string;
  recentWorn: string[];
}) {
  const wardrobeJson = JSON.stringify(params.wardrobe);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: `Sen Dolap AI'sın. Kullanıcının gardrobu:\n${wardrobeJson}`,
        cache_control: { type: "ephemeral" }, // <-- Dolap verisi cache'lenir!
      },
    ],
    messages: [
      {
        role: "user",
        content: `Etkinlik: ${params.event}
Hava: ${params.weather.temp}°C, ${params.weather.description}
Ruh hali: ${params.mood}
Son giyilenler (önerme): ${params.recentWorn.join(", ")}

3 farklı kombin öner. Her biri için item ID'lerini ve kısa gerekçeyi JSON formatında döndür:
[{"items": ["id1","id2","id3"], "name": "Kombin adı", "reason": "..."}]`,
      },
    ],
  });

  return JSON.parse(response.content[0].text);
}
```

### 5.3 "Almalı Mıyım?" — Karar Motoru

```typescript
export async function shouldBuyDecision(params: {
  newItemImageBase64: string;
  wardrobe: WardrobeItem[];
  price: number;
}) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: [
      {
        type: "text",
        text: `Gardrop analizi uzmanısın. Kullanıcının mevcut dolabı:\n${JSON.stringify(params.wardrobe)}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: params.newItemImageBase64 },
          },
          {
            type: "text",
            text: `Bu kıyafet ${params.price}₺. Almalı mıyım?
JSON döndür:
{
  "decision": "AL|BEKLEME|ALMA",
  "confidence": 0.0-1.0,
  "similar_items_in_wardrobe": ["item_id"],
  "combination_count": sayı,
  "cost_per_wear_suggestion": "...",
  "main_reason": "Ana gerekçe (1 cümle)",
  "details": "Detaylı açıklama"
}`,
          },
        ],
      },
    ],
  });
  return JSON.parse(response.content[0].text);
}
```

### 5.4 pgvector ile Benzerlik Araması

Dolap büyüdükçe "benzer kıyafet var mı?" sorusunu Claude'a sormak yerine vektör araması daha verimlidir:

```sql
-- Supabase'de pgvector aktif et
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE wardrobe_items ADD COLUMN embedding vector(1536);

-- Benzer kıyafet arama
SELECT *, embedding <=> $1 AS distance
FROM wardrobe_items
WHERE user_id = $2
ORDER BY distance
LIMIT 5;
```

Embedding üretimi için: **text-embedding-3-small** (OpenAI, $0.02/1M token) veya Claude'un kendiyle embedding üretimi (metadata'yı stringe çevirip embed ettirme).

---

## 6. Aşamalı Geliştirme Planı (Sprint Bazlı)

### Aşama 1 — MVP Çekirdek (Hafta 1–8)

#### Sprint 1–2 (Hafta 1–2): Temel Altyapı
- [ ] Expo + React Native projesi kurulumu
- [ ] Supabase projesi: auth, DB şeması, storage bucket'ları
- [ ] Navigation yapısı (Expo Router)
- [ ] Design system: renkler, tipografi, temel bileşenler
- [ ] Authentication ekranları (kayıt, giriş, şifre sıfırlama)

#### Sprint 3–4 (Hafta 3–4): Fotoğraf & AI Analizi
- [ ] Kamera + galeri entegrasyonu (Expo Image Picker)
- [ ] Remove.bg API entegrasyonu
- [ ] Claude Haiku ile kıyafet metadata analizi
- [ ] Kıyafet ekleme akışı (çek → analiz → düzenle → kaydet)
- [ ] Supabase Storage'a görsel yükleme

#### Sprint 5–6 (Hafta 5–6): Dolap Görünümü
- [ ] Dolap grid görünümü
- [ ] Kategori + sezon filtresi
- [ ] Kıyafet detay sayfası
- [ ] Düzenleme + silme işlemleri
- [ ] Arama özelliği

#### Sprint 7–8 (Hafta 7–8): Kombin Önerisi
- [ ] OpenWeatherMap entegrasyonu
- [ ] Claude Sonnet kombin önerisi prompt'u
- [ ] Prompt caching implementasyonu
- [ ] Kombin UI tasarımı (3'lü kart)
- [ ] "Başka öner" infinite loop mantığı
- [ ] Kombin kaydetme + giyim sayacı güncelleme

**Aşama 1 Çıktısı:** Kullanıcı dolabını oluşturabilir, kombin alabilir. **Satılabilir ürün.**

---

### Aşama 2 — Karar Motoru (Hafta 9–12)

#### Sprint 9–10 (Hafta 9–10): "Almalı Mıyım?"
- [ ] Yeni kıyafet fotoğrafı yükleme UI'ı
- [ ] Claude Sonnet karar motoru
- [ ] Sonuç ekranı (büyük AL/BEKLEME/ALMA UI)
- [ ] Kombine giren itemların görseli
- [ ] Fiyat girişi + maliyet/giyim hesabı

#### Sprint 11–12 (Hafta 11–12): Etkinlik & Analitik
- [ ] "Şuraya gidiyorum" akışı
- [ ] Etkinlik + tarih + lokasyon input
- [ ] Takvim kaydı (Expo Calendar)
- [ ] Gardrop analitik dashboard
- [ ] Renk + kategori + marka pasta grafikleri
- [ ] "Bunları hiç giymiyorsun" listesi

**Aşama 2 Çıktısı:** Karar verme motoru + analitik hazır. **Premium abonelik değeri kanıtlandı.**

---

### Aşama 3 — Monetizasyon (Hafta 13–16)

#### Sprint 13–14 (Hafta 13–14): RevenueCat Entegrasyonu
- [ ] RevenueCat SDK entegrasyonu
- [ ] iOS + Android in-app purchase ürünleri tanımlama
- [ ] Ücretsiz / Premium feature gate'leri
- [ ] Paywall ekranı tasarımı (Superwall ile A/B testi)
- [ ] Webhook ile Supabase kullanıcı planı güncelleme

#### Sprint 15–16 (Hafta 15–16): Reklam & Fiyat Takibi
- [ ] AdMob entegrasyonu (ücretsiz kullanıcılar için banner)
- [ ] Manuel fiyat takibi listesi
- [ ] Push bildirim sistemi (Expo Notifications)
- [ ] Arka plan job: fiyat kontrolü (Supabase Edge Function + Cron)

**Aşama 3 Çıktısı:** Gelir akışı aktif.

---

### Aşama 4 — Sosyal (Hafta 17–22)

#### Sprint 17–18: Arkadaş Sistemi
- [ ] Kullanıcı arama + davet linki
- [ ] Arkadaşlık isteği sistemi (Supabase Realtime)
- [ ] Paylaşılan dolap görüntüleme (RLS ile korumalı)
- [ ] "Ödünç verebilirim" işaretleme

#### Sprint 19–20: Kombin Paylaşımı
- [ ] Kombin paylaşım kartı oluşturma (React Native Skia ile)
- [ ] Deep link entegrasyonu (uygulama içi yönlendirme)
- [ ] "Arkadaşına sor" push bildirimi
- [ ] Oylama mekanizması

#### Sprint 21–22: Viral Mekanikler
- [ ] "Arkadaşını davet et → 1 ay ücretsiz" sistemi
- [ ] Paylaşılabilir gardrop analitik kartı
- [ ] Branch.io (deep link + attribution tracking)

**Aşama 4 Çıktısı:** Viral büyüme mekanizması hazır.

---

## 7. Maliyet Analizi — Gerçekçi Bütçe

### Başlangıç (Ay 0–3): ~$0–50/ay

| Kalem | Maliyet |
|---|---|
| Supabase Free | $0 |
| Anthropic API (500 kullanıcı, ~100 req/gün) | ~$30–50 |
| Remove.bg (ücretsiz tier) | $0 |
| OpenWeatherMap (ücretsiz tier) | $0 |
| RevenueCat (ilk $2500'e kadar) | $0 |
| EAS Build (limited) | $0 |
| **Toplam** | **~$30–50/ay** |

### Büyüme (Ay 6): ~$150–250/ay (3.000 kullanıcı)

| Kalem | Maliyet |
|---|---|
| Supabase Pro | $25 |
| Anthropic API (~20K req/gün, prompt caching ile) | ~$80–100 |
| Remove.bg (Pro plan) | $9 |
| EAS Build (Production) | $29 |
| Sentry, PostHog (ücretsiz tier yeterli) | $0 |
| **Toplam** | **~$143–163/ay** |

### Ölçeklenme (Ay 12): ~$400–600/ay (10.000 kullanıcı)

| Kalem | Maliyet |
|---|---|
| Supabase Pro + addons | $50–100 |
| Anthropic API (Batch API optimizasyonu ile) | ~$200–300 |
| Remove.bg / Replicate REMBG | $30–50 |
| EAS + Vercel | $50–70 |
| **Toplam** | **~$330–520/ay** |

**Rapordaki $80–100 tahmininin gerçekçiliği:** 1.000 aktif kullanıcı için doğru sayılabilir, ancak her kullanıcının günde ortalama kaç AI isteği yaptığına göre değişir. Prompt caching aktif olmadan 2–3x daha pahalı olabilir.

---

## 8. Teknik Riskler & Çözüm Önerileri

### Risk 1: Claude API Yanıt Süresi

**Problem:** Vision + uzun dolap JSON'u = 3–8 saniye gecikme.  
**Çözüm:**
- Streaming API kullan (kullanıcı cevabın geldiğini hisseder)
- Dolap analizini arka planda yap (kullanıcı beklemez)
- Sonuçları Supabase'e cache'le (aynı kıyafet tekrar analiz edilmez)
- Skeleton UI ile bekleme deneyimini iyileştir

### Risk 2: Fotoğraf Boyutu & Bandwidth

**Problem:** Yüksek çözünürlüklü görseller Supabase Storage maliyetini artırır.  
**Çözüm:**
- Expo Image Manipulator ile yüklemeden önce boyutu küçült (max 800px, JPEG %80)
- Supabase Storage transformation URL'leri ile thumbnail otomatik üret
- WebP formatına dönüştür

### Risk 3: App Store Onayı

**Problem:** iOS App Store AI özelliklerine dikkatli bakar, yanlış karar önerileri sorun yaratabilir.  
**Çözüm:**
- Karar önerilerinde "Bu bir öneridir, son karar sizindir" disclaimer
- AI outputs için "powered by AI" labeling
- Privacy policy'de AI kullanımını açıkça belirt (KVKK + GDPR)

### Risk 4: Supabase Ücretsiz Plan Limitleri

**Problem:** 50MB DB, 5GB storage, 2GB bandwidth → hızla dolar.  
**Çözüm:**
- 50 beta kullanıcıyla bu limitlere ulaşılamaz
- Görselleri sıkıştır (user başına ortalama 100 kıyafet × 100KB = 10MB)
- Pro plan ($25/ay) ile 8GB storage, 250MB DB

### Risk 5: Offline Kullanım

**Problem:** İnternet olmadan uygulama çalışmaz.  
**Çözüm:**
- React Native MMKV ile dolap verisini locale cache'le
- Kombin önerileri için son 3 öneriyi cache'de tut
- "Offline mod" badge'i ekle

---

## 9. Trendyol & Dış Entegrasyonlar — Gerçeklik Kontrolü

### Trendyol Sipariş Geçmişi Import

**Durum: ⚠️ Resmi API Yok**

Trendyol'un kamuya açık bir API'si yoktur. Seçenekler:

| Yöntem | Uygulanabilirlik | Risk |
|---|---|---|
| Kullanıcı manuel CSV export | ✅ Trendyol bunu destekler | Sürtünme yüksek |
| Screen scraping (kullanıcı kendi hesabı) | ⚠️ Teknik olarak mümkün | ToS ihlali riski |
| Trendyol ile resmi ortaklık | ✅ En doğru yol | Zaman alır |
| Kullanıcı sipariş e-postalarını forward eder | ✅ Gmail entegrasyonu | Privacy concern |

**Kısa vadeli öneri:** Manuel "Bu ürünü daha önce aldım" akışı + Trendyol ürün URL'si yapıştırma ile otomatik metadata çekme (public product page scraping, ürün sayfası herkese açık).

### Trendyol Affiliate

**Durum: ✅ Uygulanabilir**

Trendyol'un [Affiliate Programı](https://affiliate.trendyol.com) mevcut. %2–8 komisyon. Ürün linklerini affiliate linke çevirmek için basit bir proxy endpoint yeterlidir.

### Zara / H&M Import

Bu markalar da resmi API sunmuyor. Manuel ekleme akışı + URL'den metadata parse etme geçerli çözüm.

---

## 10. Hukuki & KVKK Gereksinimleri

Bu bölüm göz ardı edilmemeli — özellikle görsel veri işlendiği için.

### KVKK Zorunlulukları

- **Açık Rıza Metni:** Kıyafet fotoğrafları kişisel veri sayılabilir, kullanıcıdan açık rıza alınmalı
- **Veri Saklama:** "Sunucuda değil cihazda tut" kararı ürün raporunda var → bu özelliği implement etmek maliyeti düşürür ve güven artırır
- **Veri Silme:** "Hesabımı sil" → 30 gün içinde tüm veri silinmeli (Supabase'de cascade delete)
- **Veri İşleme Envanteri:** Hangi veri, nerede, ne kadar saklandığı belgelenmeli

### App Store Gereksinimleri

- **Apple:** Kamera + Galeri erişimi için açıklamalı permission string (Türkçe + İngilizce)
- **Google Play:** Hassas izinler için Data Safety formu doldurulmalı
- **AI Disclosure:** Apple 2024'ten itibaren AI-generated content'i işaretlemeyi zorunlu kılabilir

### Ödeme & Abonelik

- **Fatura:** Türkiye'de dijital hizmet aboneliği için e-fatura zorunlu (RevenueCat bunu handle etmez, ayrı çözüm gerekebilir)
- **KDV:** Dijital hizmetlerde %18 KDV (App Store bu konuda aracı olur)

---

## 11. Ekip Gereksinimleri

### Minimum Uygulanabilir Ekip (Solo Developer Senaryosu)

Tek kişi tüm stack'i öğrenerek yapabilir ancak **süre 2x–3x uzar**.

| Rol | Zorunlu mu? | Alternatif |
|---|---|---|
| React Native Developer | ✅ Evet | Sen |
| Backend (Supabase) | ✅ Evet | Sen (Supabase low-code) |
| UI/UX Designer | ⚠️ Önemli | Figma Community şablonları + AI (v0.dev) |
| AI/Prompt Engineer | ✅ Evet | Sen |
| Marketing (TikTok) | ⚠️ Önemli | Kurucu yapabilir |

### İdeal Küçük Ekip (2–3 Kişi)

- **1 Fullstack RN Developer** (sen veya kiralanan)
- **1 UI/UX + Motion Designer** (kombin kartları, animasyonlar kritik)
- **1 Growth/Content** (TikTok içerik üretimi, influencer ilişkileri)

---

## 12. Başlangıç İçin En Kritik Adım

Ürün raporu doğru söylüyor: **"Bu döngü çalıştığında ürün satılabilir hale gelir"**

### Hafta 1'de Yapılacaklar (Öncelik Sırası)

```
1. Expo projesi kur: npx create-expo-app dolap-ai --template
2. Supabase projesi oluştur (5 dakika)
3. 3 tablo yarat: users, wardrobe_items, outfits
4. Tek ekran: fotoğraf çek → Remove.bg → Claude Haiku analiz → kaydet
5. Bunu 10 kişiye göster. Geri bildirim al.
```

### Doğrulama Metrikleri (İlk 30 Gün)

- [ ] 50 beta kullanıcı uygulamayı indirdi
- [ ] Ortalama kullanıcı 10+ kıyafet ekledi
- [ ] Günlük aktif kullanım oranı >%30
- [ ] En az 3 kişi "bunu satın alırım" dedi

---

## Özet Tablo

| Boyut | Değerlendirme |
|---|---|
| **Teknik Uygulanabilirlik** | ✅ Yüksek — tüm araçlar mevcut ve olgun |
| **Başlangıç Maliyeti** | ✅ Düşük — $0–50/ay ilk 3 ay |
| **En Zor Özellik** | ⚠️ Trendyol entegrasyonu (resmi API yok) |
| **En Hızlı Değer** | ✅ Kombin önerisi + "Almalı mıyım?" |
| **MVP Süresi** | 8 hafta (tek developer, full-time) |
| **Tam Ürün Süresi** | 22–24 hafta |
| **Pazar Zamanlaması** | ✅ Q4 2026 hedefi gerçekçi |
| **Ana Risk** | ⚠️ Kullanıcı edinimi — viral mekanikler kritik |

---

*Bu rapor Dolap_AI_Urun_Raporu v1.0 baz alınarak hazırlanmıştır. Tüm özellikler ve maliyetler Mayıs 2026 itibarıyla geçerli araç ve fiyatlarla değerlendirilmiştir.*
