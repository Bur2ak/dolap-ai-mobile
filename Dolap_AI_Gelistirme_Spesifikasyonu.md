# Dolap AI — Tam Geliştirme Spesifikasyonu

> Bu doküman, Dolap AI uygulamasını sıfırdan geliştirmek için gereken her teknik detayı içerir.
> Marketing, iş modeli ve pazar analizi bu dokümana dahil değildir — yalnızca geliştirme.

---

## İÇİNDEKİLER

1. [Proje Genel Bakış](#1-proje-genel-bakış)
2. [Tech Stack & Bağımlılıklar](#2-tech-stack--bağımlılıklar)
3. [Klasör Yapısı](#3-klasör-yapısı)
4. [Environment Variables](#4-environment-variables)
5. [Veritabanı Şeması](#5-veritabanı-şeması)
6. [RLS Politikaları](#6-rls-politikaları)
7. [Storage Bucket'ları](#7-storage-bucketları)
8. [TypeScript Tipleri](#8-typescript-tipleri)
9. [Authentication](#9-authentication)
10. [Navigasyon Yapısı](#10-navigasyon-yapısı)
11. [Ekranlar — Tam Spesifikasyon](#11-ekranlar--tam-spesifikasyon)
12. [Supabase Edge Functions](#12-supabase-edge-functions)
13. [AI Entegrasyonu — Tüm Prompt'lar](#13-ai-entegrasyonu--tüm-promptlar)
14. [Arka Plan Silme](#14-arka-plan-silme)
15. [Hava Durumu Entegrasyonu](#15-hava-durumu-entegrasyonu)
16. [Push Bildirimleri](#16-push-bildirimleri)
17. [Abonelik & Ödeme (RevenueCat)](#17-abonelik--ödeme-revenuecat)
18. [Freemium Gate Mantığı](#18-freemium-gate-mantığı)
19. [Analytics (PostHog)](#19-analytics-posthog)
20. [Hata İzleme (Sentry)](#20-hata-i̇zleme-sentry)
21. [Cloudflare R2 Kurulumu](#21-cloudflare-r2-kurulumu)
22. [Build & Deploy](#22-build--deploy)
23. [Geliştirme Sırası (Sprint Planı)](#23-geliştirme-sırası-sprint-planı)

---

## 1. Proje Genel Bakış

**Uygulama Adı:** Dolap AI  
**Platform:** iOS & Android (React Native / Expo)  
**Dil:** TypeScript (strict mode)  
**Backend:** Supabase (PostgreSQL + Edge Functions + Storage + Auth + Realtime)  
**AI:** Anthropic Claude API + Google Gemini API  
**İş Modeli:** Freemium + Abonelik (RevenueCat)

### Temel Özellikler
1. Dijital dolap oluşturma (fotoğraf → AI analiz → metadata)
2. Kombin önerisi (hava durumu + etkinlik + ruh hali bazlı)
3. "Bu kıyafeti almalı mıyım?" karar motoru
4. "Şuraya gidiyorum" etkinlik planlayıcısı
5. Gardrop analitiği (maliyet/giyim, renk dağılımı, vs.)
6. Sosyal özellikler (arkadaş dolabı, kombin paylaşımı)
7. Fiyat takibi & indirim bildirimleri

---

## 2. Tech Stack & Bağımlılıklar

### Proje Başlatma
```bash
npx create-expo-app@latest dolap-ai --template blank-typescript
cd dolap-ai
```

### package.json — Tüm Bağımlılıklar

```json
{
  "name": "dolap-ai",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "lint": "eslint . --ext .ts,.tsx",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "expo-status-bar": "~1.12.1",
    "expo-camera": "~15.0.0",
    "expo-image-picker": "~15.0.0",
    "expo-image-manipulator": "~12.0.0",
    "expo-location": "~17.0.0",
    "expo-calendar": "~13.0.0",
    "expo-notifications": "~0.28.0",
    "expo-device": "~6.0.0",
    "expo-constants": "~16.0.0",
    "expo-file-system": "~17.0.0",
    "expo-media-library": "~16.0.0",
    "expo-haptics": "~13.0.0",
    "expo-blur": "~13.0.0",
    "expo-linear-gradient": "~13.0.0",
    "expo-secure-store": "~13.0.0",
    "expo-web-browser": "~13.0.0",
    "react": "18.2.0",
    "react-native": "0.74.5",
    "react-native-reanimated": "~3.10.0",
    "react-native-gesture-handler": "~2.16.0",
    "react-native-safe-area-context": "4.10.1",
    "react-native-screens": "3.31.1",
    "react-native-mmkv": "^2.12.2",
    "react-native-skia": "^1.3.0",
    "@shopify/react-native-skia": "^1.3.0",
    "victory-native": "^41.0.0",
    "react-native-svg": "15.2.0",
    "@supabase/supabase-js": "^2.43.0",
    "@anthropic-ai/sdk": "^0.24.0",
    "zustand": "^4.5.2",
    "@tanstack/react-query": "^5.40.0",
    "zod": "^3.23.8",
    "react-hook-form": "^7.51.5",
    "@hookform/resolvers": "^3.6.0",
    "react-native-purchases": "^7.31.0",
    "@posthog/react-native": "^3.3.3",
    "@sentry/react-native": "~5.22.0",
    "date-fns": "^3.6.0",
    "date-fns-tz": "^3.1.3",
    "react-native-fast-image": "^8.6.3",
    "react-native-image-zoom-viewer": "^3.0.1",
    "react-native-bottom-sheet": "^4.6.4",
    "@gorhom/bottom-sheet": "^4.6.4",
    "react-native-flash-message": "^0.4.2",
    "react-native-skeleton-placeholder": "^5.2.4",
    "react-native-share": "^10.2.1",
    "react-native-view-shot": "^3.8.0",
    "react-native-qrcode-svg": "^6.3.0",
    "react-native-masked-text": "^1.13.0",
    "react-native-url-polyfill": "^2.0.0",
    "@react-native-async-storage/async-storage": "1.23.1",
    "react-native-confetti-cannon": "^1.5.2",
    "nanoid": "^5.0.7",
    "axios": "^1.7.2"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.2.79",
    "@types/react-native": "~0.73.0",
    "typescript": "^5.3.3",
    "eslint": "^8.57.0",
    "eslint-config-expo": "~7.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "prettier": "^3.2.5"
  }
}
```

### app.json (Expo Config)

```json
{
  "expo": {
    "name": "Dolap AI",
    "slug": "dolap-ai",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0A0A0A"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.dolapai.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "Kıyafetlerinizi gardırobunuza eklemek için kameranıza erişmemiz gerekiyor.",
        "NSPhotoLibraryUsageDescription": "Kıyafet fotoğraflarınızı seçmek için fotoğraf kitaplığınıza erişmemiz gerekiyor.",
        "NSLocationWhenInUseUsageDescription": "Hava durumuna göre kombin önerisi sunmak için konumunuza erişmemiz gerekiyor.",
        "NSCalendarsUsageDescription": "Etkinlik planlarınızı takviminize kaydetmek için takvime erişmemiz gerekiyor."
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0A0A0A"
      },
      "package": "com.dolapai.app",
      "versionCode": 1,
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "READ_CALENDAR",
        "WRITE_CALENDAR"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-camera",
      "expo-image-picker",
      "expo-location",
      "expo-calendar",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#0A0A0A"
        }
      ],
      "@sentry/react-native/expo"
    ],
    "scheme": "dolapai",
    "extra": {
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID"
      },
      "router": {
        "origin": false
      }
    }
  }
}
```

---

## 3. Klasör Yapısı

```
dolap-ai/
├── app/                          # Expo Router — ekranlar
│   ├── (auth)/                   # Auth grubu (tab bar yok)
│   │   ├── _layout.tsx
│   │   ├── onboarding.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/                   # Ana tab navigasyon
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Dolap (wardrobe)
│   │   ├── outfit.tsx            # Kombin önerisi
│   │   ├── analytics.tsx         # Analitik
│   │   └── profile.tsx           # Profil
│   ├── item/
│   │   ├── [id].tsx              # Kıyafet detay
│   │   └── add.tsx               # Kıyafet ekleme
│   ├── outfit/
│   │   ├── [id].tsx              # Kombin detay
│   │   └── result.tsx            # Kombin sonuç
│   ├── buy-decision/
│   │   ├── index.tsx             # "Almalı mıyım?" ana
│   │   └── result.tsx            # Karar sonucu
│   ├── event/
│   │   ├── index.tsx             # "Şuraya gidiyorum"
│   │   └── result.tsx            # Etkinlik kombini
│   ├── social/
│   │   ├── friends.tsx           # Arkadaş listesi
│   │   ├── [userId].tsx          # Arkadaş dolabı
│   │   └── invite.tsx            # Davet ekranı
│   ├── price-tracking/
│   │   └── index.tsx             # Fiyat takibi
│   ├── settings/
│   │   ├── index.tsx             # Ayarlar
│   │   ├── account.tsx           # Hesap
│   │   ├── notifications.tsx     # Bildirim tercihleri
│   │   ├── privacy.tsx           # Gizlilik
│   │   └── subscription.tsx      # Abonelik
│   ├── paywall.tsx               # Premium paywall
│   ├── _layout.tsx               # Root layout
│   └── +not-found.tsx
├── components/
│   ├── ui/                       # Temel UI bileşenleri
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Text.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Skeleton.tsx
│   │   ├── BottomSheet.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   ├── Divider.tsx
│   │   └── EmptyState.tsx
│   ├── wardrobe/
│   │   ├── WardrobeGrid.tsx
│   │   ├── WardrobeItem.tsx
│   │   ├── WardrobeItemCard.tsx
│   │   ├── CategoryFilter.tsx
│   │   ├── SeasonFilter.tsx
│   │   ├── AddItemSheet.tsx
│   │   └── ItemMetadataForm.tsx
│   ├── outfit/
│   │   ├── OutfitCard.tsx
│   │   ├── OutfitCanvas.tsx      # Kıyafet birleşimi görseli
│   │   ├── OutfitSuggestion.tsx
│   │   ├── MoodSelector.tsx
│   │   ├── EventSelector.tsx
│   │   └── WeatherBadge.tsx
│   ├── analytics/
│   │   ├── ColorChart.tsx
│   │   ├── CategoryChart.tsx
│   │   ├── WearCountList.tsx
│   │   ├── CostPerWear.tsx
│   │   └── MonthlySpending.tsx
│   ├── social/
│   │   ├── FriendCard.tsx
│   │   ├── FriendRequest.tsx
│   │   └── ShareCard.tsx         # Paylaşılabilir kombin kartı
│   └── shared/
│       ├── Header.tsx
│       ├── LoadingOverlay.tsx
│       ├── AILoadingAnimation.tsx
│       └── PremiumGate.tsx
├── lib/
│   ├── supabase.ts               # Supabase client
│   ├── ai/
│   │   ├── claude.ts             # Anthropic client + fonksiyonlar
│   │   ├── gemini.ts             # Google Gemini client
│   │   ├── prompts.ts            # Tüm prompt'lar
│   │   └── types.ts              # AI response tipleri
│   ├── api/
│   │   ├── wardrobe.ts           # Wardrobe CRUD
│   │   ├── outfits.ts            # Outfit işlemleri
│   │   ├── users.ts              # Kullanıcı işlemleri
│   │   ├── social.ts             # Sosyal işlemler
│   │   ├── price-tracking.ts     # Fiyat takibi
│   │   └── notifications.ts      # Bildirim işlemleri
│   ├── storage/
│   │   ├── r2.ts                 # Cloudflare R2 upload/delete
│   │   └── image.ts              # Görsel işleme (resize, compress)
│   ├── weather.ts                # OpenWeatherMap
│   ├── background-removal.ts     # Replicate REMBG
│   ├── revenuecat.ts             # RevenueCat kurulum
│   ├── analytics.ts              # PostHog
│   ├── sentry.ts                 # Sentry
│   └── notifications.ts          # Expo Notifications
├── stores/
│   ├── authStore.ts              # Zustand — kullanıcı + session
│   ├── wardrobeStore.ts          # Zustand — dolap state
│   ├── outfitStore.ts            # Zustand — kombin state
│   └── subscriptionStore.ts      # Zustand — premium durumu
├── hooks/
│   ├── useWardrobe.ts
│   ├── useOutfitRecommendation.ts
│   ├── useBuyDecision.ts
│   ├── useWeather.ts
│   ├── useSubscription.ts
│   ├── useImagePicker.ts
│   └── useAnalytics.ts
├── constants/
│   ├── colors.ts                 # Renk paleti
│   ├── typography.ts             # Font tanımları
│   ├── spacing.ts                # Spacing scale
│   ├── categories.ts             # Kıyafet kategorileri
│   ├── seasons.ts                # Sezon listesi
│   └── events.ts                 # Etkinlik tipleri
├── utils/
│   ├── formatters.ts             # Para, tarih formatları
│   ├── validators.ts             # Form validasyonları
│   ├── imageUtils.ts             # Görsel yardımcıları
│   └── colorUtils.ts             # Renk analiz yardımcıları
├── types/
│   └── index.ts                  # Tüm TypeScript tipleri
├── assets/
│   ├── icon.png
│   ├── splash.png
│   ├── adaptive-icon.png
│   ├── notification-icon.png
│   └── fonts/
│       ├── Inter-Regular.ttf
│       ├── Inter-Medium.ttf
│       ├── Inter-SemiBold.ttf
│       └── Inter-Bold.ttf
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── functions/
│       ├── analyze-clothing/
│       │   └── index.ts
│       ├── recommend-outfit/
│       │   └── index.ts
│       ├── buy-decision/
│       │   └── index.ts
│       ├── price-check/
│       │   └── index.ts
│       └── send-notification/
│           └── index.ts
├── .env.local
├── tsconfig.json
├── babel.config.js
└── eas.json
```

---

## 4. Environment Variables

```bash
# .env.local

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Sadece Edge Functions'ta

# AI
ANTHROPIC_API_KEY=sk-ant-...          # Edge Functions'ta
GOOGLE_GEMINI_API_KEY=AIza...         # Edge Functions'ta

# Storage
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
EXPO_PUBLIC_R2_PUBLIC_URL=https://pub-xxx.r2.dev  # Public bucket URL

# Arka Plan Silme
REPLICATE_API_TOKEN=r8_...

# Hava Durumu
EXPO_PUBLIC_OPENWEATHER_API_KEY=...

# RevenueCat
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...

# PostHog
EXPO_PUBLIC_POSTHOG_API_KEY=phc_...
EXPO_PUBLIC_POSTHOG_HOST=https://eu.posthog.com

# Sentry
EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

---

## 5. Veritabanı Şeması

Supabase SQL Editor'da çalıştırılacak tam migration:

```sql
-- =============================================
-- 001_initial_schema.sql
-- =============================================

-- UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================
-- PROFILES
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'family')),
  subscription_expires_at TIMESTAMPTZ,
  revenuecat_customer_id TEXT,
  push_token TEXT,
  notification_preferences JSONB DEFAULT '{
    "outfit_reminder": true,
    "price_drops": true,
    "friend_requests": true,
    "outfit_votes": true
  }'::jsonb,
  privacy_settings JSONB DEFAULT '{
    "wardrobe_visible": false,
    "allow_friend_requests": true
  }'::jsonb,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- WARDROBE ITEMS
-- =============================================
CREATE TABLE wardrobe_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Görsel
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- AI tarafından çıkarılan metadata
  category TEXT NOT NULL CHECK (category IN (
    'üst', 'alt', 'elbise', 'etek', 'dış_giyim',
    'ayakkabı', 'çanta', 'aksesuar', 'iç_giyim', 'spor', 'diğer'
  )),
  subcategory TEXT,
  colors JSONB DEFAULT '[]'::jsonb,           -- ["lacivert", "beyaz"]
  dominant_color_hex TEXT,                    -- "#1A237E"
  pattern TEXT CHECK (pattern IN (
    'düz', 'çizgili', 'kareli', 'çiçekli', 'baskılı',
    'desenli', 'noktalı', 'kamuflaj', 'diğer'
  )),
  fit TEXT CHECK (fit IN (
    'slim', 'regular', 'oversize', 'crop', 'fitted', 'loose', 'diğer'
  )),
  fabric_estimate TEXT,
  season TEXT[] DEFAULT '{}',                 -- ['yaz', 'ilkbahar']
  formality TEXT CHECK (formality IN (
    'spor', 'casual', 'smart_casual', 'business', 'formal', 'parti'
  )),
  style_tags TEXT[] DEFAULT '{}',             -- ['minimalist', 'klasik']
  
  -- Kullanıcı tarafından girilen bilgiler
  brand TEXT,
  purchase_price DECIMAL(10, 2),
  purchase_date DATE,
  notes TEXT,
  
  -- İstatistikler
  wear_count INTEGER DEFAULT 0,
  last_worn DATE,
  
  -- Durum
  is_active BOOLEAN DEFAULT TRUE,            -- FALSE = satıldı/bağışlandı
  is_shareable BOOLEAN DEFAULT FALSE,
  is_lendable BOOLEAN DEFAULT FALSE,
  
  -- Benzerlik araması için vektör
  embedding vector(512),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wardrobe_items_user_id ON wardrobe_items(user_id);
CREATE INDEX idx_wardrobe_items_category ON wardrobe_items(category);
CREATE INDEX idx_wardrobe_items_active ON wardrobe_items(user_id, is_active);
CREATE INDEX idx_wardrobe_items_embedding ON wardrobe_items USING ivfflat (embedding vector_cosine_ops);

-- =============================================
-- OUTFITS (Kaydedilen kombinler)
-- =============================================
CREATE TABLE outfits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT,
  event_type TEXT,
  occasion TEXT,
  weather_temp INTEGER,
  weather_description TEXT,
  mood TEXT,
  ai_reasoning TEXT,
  worn_at DATE,
  is_favorite BOOLEAN DEFAULT FALSE,
  share_image_url TEXT,               -- Paylaşım kartı görseli
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outfits_user_id ON outfits(user_id);

-- =============================================
-- OUTFIT ITEMS (Kombin <-> Kıyafet birleşimi)
-- =============================================
CREATE TABLE outfit_items (
  outfit_id UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  position INTEGER,
  PRIMARY KEY (outfit_id, item_id)
);

-- =============================================
-- EVENTS (Şuraya gidiyorum)
-- =============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES outfits(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  notes TEXT,
  calendar_event_id TEXT,             -- Expo Calendar event ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_user_id ON events(user_id);

-- =============================================
-- PRICE TRACKING (Fiyat takibi)
-- =============================================
CREATE TABLE price_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_url TEXT,
  product_image_url TEXT,
  current_price DECIMAL(10, 2),
  target_price DECIMAL(10, 2),
  initial_price DECIMAL(10, 2),
  price_history JSONB DEFAULT '[]'::jsonb,  -- [{price, date}]
  store TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_checked TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_tracking_user_id ON price_tracking(user_id);

-- =============================================
-- FRIENDSHIPS
-- =============================================
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);

-- =============================================
-- OUTFIT VOTES (Kombin oylaması)
-- =============================================
CREATE TABLE outfit_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outfit_id UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote TEXT CHECK (vote IN ('yes', 'no', 'love')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(outfit_id, voter_id)
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'friend_request', 'outfit_vote', 'price_drop',
    'outfit_reminder', 'lend_request', 'system'
  )),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);

-- =============================================
-- BUY DECISIONS (Geçmiş kararlar)
-- =============================================
CREATE TABLE buy_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_image_url TEXT,
  product_name TEXT,
  price DECIMAL(10, 2),
  decision TEXT CHECK (decision IN ('AL', 'BEKLEME', 'ALMA')),
  confidence DECIMAL(3, 2),
  similar_items JSONB DEFAULT '[]'::jsonb,
  combination_count INTEGER,
  ai_reasoning TEXT,
  user_final_action TEXT CHECK (user_final_action IN ('bought', 'skipped', 'saved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Profil otomatik oluşturma (auth.users'dan sonra)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Wear count güncelleme (kombin giyildiğinde)
CREATE OR REPLACE FUNCTION update_wear_count(outfit_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE wardrobe_items
  SET
    wear_count = wear_count + 1,
    last_worn = CURRENT_DATE,
    updated_at = NOW()
  WHERE id IN (
    SELECT item_id FROM outfit_items WHERE outfit_id = outfit_id_param
  );
  
  UPDATE outfits
  SET worn_at = CURRENT_DATE
  WHERE id = outfit_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated_at otomatik güncellemesi
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_wardrobe_items_updated_at
  BEFORE UPDATE ON wardrobe_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 6. RLS Politikaları

```sql
-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi profilini görebilir"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Kullanıcı kendi profilini güncelleyebilir"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Arkadaşlar profil görebilir
CREATE POLICY "Arkadaşlar profil görebilir"
  ON profiles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = id)
        OR
        (addressee_id = auth.uid() AND requester_id = id)
      )
    )
  );

-- WARDROBE ITEMS
ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi kıyafetlerini yönetebilir"
  ON wardrobe_items FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Arkadaşlar paylaşılan kıyafetleri görebilir"
  ON wardrobe_items FOR SELECT USING (
    is_shareable = TRUE
    AND EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = user_id)
        OR
        (addressee_id = auth.uid() AND requester_id = user_id)
      )
    )
  );

-- OUTFITS
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi kombinlerini yönetebilir"
  ON outfits FOR ALL USING (auth.uid() = user_id);

-- FRIENDSHIPS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi arkadaşlıklarını görebilir"
  ON friendships FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = addressee_id
  );

CREATE POLICY "Kullanıcı arkadaşlık isteği gönderebilir"
  ON friendships FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Kullanıcı kendi arkadaşlık durumunu güncelleyebilir"
  ON friendships FOR UPDATE USING (
    auth.uid() = requester_id OR auth.uid() = addressee_id
  );

-- NOTIFICATIONS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi bildirimlerini görebilir"
  ON notifications FOR ALL USING (auth.uid() = user_id);

-- PRICE TRACKING
ALTER TABLE price_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi takip listesini yönetebilir"
  ON price_tracking FOR ALL USING (auth.uid() = user_id);

-- BUY DECISIONS
ALTER TABLE buy_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi kararlarını yönetebilir"
  ON buy_decisions FOR ALL USING (auth.uid() = user_id);
```

---

## 7. Storage Bucket'ları

```sql
-- Supabase Storage bucket oluşturma (Dashboard > Storage > New Bucket)
-- Veya SQL ile:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('wardrobe-images', 'wardrobe-images', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('profile-avatars', 'profile-avatars', TRUE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('outfit-shares', 'outfit-shares', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- Storage RLS
CREATE POLICY "Kullanıcı kendi görsellerini yükleyebilir"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'wardrobe-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Herkes public görselleri görebilir"
  ON storage.objects FOR SELECT USING (bucket_id = 'wardrobe-images');

CREATE POLICY "Kullanıcı kendi görsellerini silebilir"
  ON storage.objects FOR DELETE USING (
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## 8. TypeScript Tipleri

```typescript
// types/index.ts

export type SubscriptionTier = 'free' | 'premium' | 'family';

export type ClothingCategory =
  | 'üst' | 'alt' | 'elbise' | 'etek' | 'dış_giyim'
  | 'ayakkabı' | 'çanta' | 'aksesuar' | 'iç_giyim' | 'spor' | 'diğer';

export type ClothingPattern =
  | 'düz' | 'çizgili' | 'kareli' | 'çiçekli' | 'baskılı'
  | 'desenli' | 'noktalı' | 'kamuflaj' | 'diğer';

export type ClothingFit =
  | 'slim' | 'regular' | 'oversize' | 'crop' | 'fitted' | 'loose' | 'diğer';

export type ClothingFormality =
  | 'spor' | 'casual' | 'smart_casual' | 'business' | 'formal' | 'parti';

export type Season = 'ilkbahar' | 'yaz' | 'sonbahar' | 'kış';

export type BuyDecision = 'AL' | 'BEKLEME' | 'ALMA';

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  push_token: string | null;
  notification_preferences: {
    outfit_reminder: boolean;
    price_drops: boolean;
    friend_requests: boolean;
    outfit_votes: boolean;
  };
  privacy_settings: {
    wardrobe_visible: boolean;
    allow_friend_requests: boolean;
  };
  onboarding_completed: boolean;
  created_at: string;
}

export interface WardrobeItem {
  id: string;
  user_id: string;
  image_url: string;
  thumbnail_url: string | null;
  category: ClothingCategory;
  subcategory: string | null;
  colors: string[];
  dominant_color_hex: string | null;
  pattern: ClothingPattern | null;
  fit: ClothingFit | null;
  fabric_estimate: string | null;
  season: Season[];
  formality: ClothingFormality | null;
  style_tags: string[];
  brand: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  notes: string | null;
  wear_count: number;
  last_worn: string | null;
  is_active: boolean;
  is_shareable: boolean;
  is_lendable: boolean;
  created_at: string;
  updated_at: string;
}

export interface Outfit {
  id: string;
  user_id: string;
  name: string | null;
  event_type: string | null;
  occasion: string | null;
  weather_temp: number | null;
  weather_description: string | null;
  mood: string | null;
  ai_reasoning: string | null;
  worn_at: string | null;
  is_favorite: boolean;
  share_image_url: string | null;
  items?: WardrobeItem[];
  created_at: string;
}

export interface Event {
  id: string;
  user_id: string;
  outfit_id: string | null;
  outfit?: Outfit;
  title: string;
  event_type: string;
  event_date: string;
  location: string | null;
  notes: string | null;
  created_at: string;
}

export interface PriceTracking {
  id: string;
  user_id: string;
  product_name: string;
  product_url: string | null;
  product_image_url: string | null;
  current_price: number | null;
  target_price: number | null;
  initial_price: number | null;
  price_history: Array<{ price: number; date: string }>;
  store: string | null;
  is_active: boolean;
  last_checked: string | null;
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  requester?: Profile;
  addressee?: Profile;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'friend_request' | 'outfit_vote' | 'price_drop' | 'outfit_reminder' | 'lend_request' | 'system';
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  sent_at: string;
}

export interface BuyDecisionRecord {
  id: string;
  user_id: string;
  product_image_url: string | null;
  product_name: string | null;
  price: number | null;
  decision: BuyDecision;
  confidence: number;
  similar_items: string[];
  combination_count: number;
  ai_reasoning: string;
  created_at: string;
}

// AI Response tipleri
export interface ClothingAnalysisResult {
  category: ClothingCategory;
  subcategory: string;
  colors: string[];
  dominant_color_hex: string;
  pattern: ClothingPattern;
  fit: ClothingFit;
  fabric_estimate: string;
  season: Season[];
  formality: ClothingFormality;
  style_tags: string[];
}

export interface OutfitSuggestion {
  items: string[];
  name: string;
  reason: string;
  occasion_match: number;
  weather_suitable: boolean;
}

export interface BuyDecisionResult {
  decision: BuyDecision;
  confidence: number;
  similar_items_in_wardrobe: string[];
  combination_count: number;
  cost_per_wear_suggestion: string;
  main_reason: string;
  details: string;
  discount_advice: string | null;
}

// Weather
export interface WeatherData {
  temp: number;
  feels_like: number;
  description: string;
  icon: string;
  humidity: number;
  city: string;
}

// Analitik
export interface WardrobeAnalytics {
  total_items: number;
  total_value: number;
  most_worn: WardrobeItem[];
  never_worn: WardrobeItem[];
  color_distribution: Array<{ color: string; hex: string; count: number }>;
  category_distribution: Array<{ category: string; count: number }>;
  brand_distribution: Array<{ brand: string; count: number }>;
  avg_cost_per_wear: number;
  monthly_spending: Array<{ month: string; amount: number }>;
  suggestions_to_remove: WardrobeItem[];
}
```

---

## 9. Authentication

### Supabase Client Kurulumu

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { MMKV } from 'react-native-mmkv';
import 'react-native-url-polyfill/auto';

const storage = new MMKV();

const mmkvStorage = {
  setItem: (key: string, value: string) => storage.set(key, value),
  getItem: (key: string) => storage.getString(key) ?? null,
  removeItem: (key: string) => storage.delete(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: mmkvStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

### Auth Store (Zustand)

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthState {
  session: any | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await get().fetchProfile();
  },

  signUp: async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  fetchProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (data) set({ profile: data });
  },

  updateProfile: async (updates) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update(updates).eq('id', user.id);
    set(state => ({ profile: { ...state.profile!, ...updates } }));
  },
}));
```

### Root Layout — Session Kontrolü

```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, isLoading, fetchProfile } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      useAuthStore.setState({ session, isLoading: false });
      if (session) fetchProfile();
      SplashScreen.hideAsync();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      useAuthStore.setState({ session });
      if (session) fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/onboarding');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
```

---

## 10. Navigasyon Yapısı

```
Root Stack
├── (auth) group
│   ├── onboarding      → Kayıt öncesi 3 slide tanıtım
│   ├── login           → Email + şifre girişi
│   ├── register        → Kayıt formu
│   └── forgot-password → Şifre sıfırlama
│
├── (tabs) group — Ana uygulama
│   ├── index (Dolap)   → Kıyafet grid + filtreler
│   ├── outfit          → Kombin önerisi ana ekranı
│   ├── analytics       → Analitik dashboard
│   └── profile         → Profil + ayarlar
│
├── item/add            → Kıyafet ekleme (kamera/galeri)
├── item/[id]           → Kıyafet detay + düzenleme
├── outfit/[id]         → Kombin detay
├── outfit/result       → AI kombin sonuçları
├── buy-decision/index  → "Almalı mıyım?" giriş
├── buy-decision/result → Karar sonucu
├── event/index         → "Şuraya gidiyorum" form
├── event/result        → Etkinlik kombini
├── social/friends      → Arkadaş listesi
├── social/[userId]     → Arkadaş dolabı
├── social/invite       → Davet linki
├── price-tracking      → Fiyat takip listesi
├── settings/*          → Ayarlar alt sayfaları
└── paywall             → Premium satış ekranı
```

### Tab Bar Konfigürasyonu

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      tabBarStyle: {
        backgroundColor: COLORS.background,
        borderTopColor: COLORS.border,
        height: 88,
        paddingBottom: 28,
      },
      headerShown: false,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dolabım',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shirt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="outfit"
        options={{
          title: 'Kombin',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analiz',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## 11. Ekranlar — Tam Spesifikasyon

### 11.1 Onboarding (app/(auth)/onboarding.tsx)

3 slide carousel:
- **Slide 1:** "Dolabını dijitalleştir" — Kıyafet fotoğrafı çekme animasyonu
- **Slide 2:** "AI kombini yap" — Kombin öneri animasyonu
- **Slide 3:** "Alışverişini zekice yönet" — Karar motoru animasyonu

Alt butonlar: "Giriş Yap" | "Kayıt Ol"

---

### 11.2 Dolap Ana Ekranı (app/(tabs)/index.tsx)

**Header:**
- Sol: "Dolabım" başlığı + kıyafet sayısı badge
- Sağ: Arama ikonu + Filtre ikonu + "+" (kıyafet ekle) butonu

**Filtre Satırı (yatay scroll):**
- Tümü | Üst | Alt | Elbise | Dış Giyim | Ayakkabı | Aksesuar
- Sezon filtresi: Tümü | İlkbahar | Yaz | Sonbahar | Kış

**Grid (2 kolon, masonry layout):**
- `WardrobeItemCard`: görsel, kategori badge, wear count
- Boş durum: "İlk kıyafetini ekle" CTA

**FAB (Floating Action Button):**
- Basınca alt sheet açılır: "Fotoğraf Çek" | "Galeriden Seç"

---

### 11.3 Kıyafet Ekleme (app/item/add.tsx)

**Adım 1 — Görsel Seçimi:**
- Kamera preview veya galeri seçici
- "Çek" butonu

**Adım 2 — Arka Plan Silme:**
- Loading: "AI kıyafetin arka planını siliyor..."
- Sonuç: Sol orijinal, sağ işlenmiş görsel
- "Devam Et" | "Yeniden Çek"

**Adım 3 — AI Analizi:**
- Loading: "Kıyafetin analiz ediliyor..."
- Spinner + animasyon

**Adım 4 — Metadata Formu:**
- Tüm AI-çıkarılan alanlar doldurulmuş gösterilir
- Kullanıcı düzenleyebilir
- Zorunlu: kategori
- Opsiyonel: marka, fiyat, satın alma tarihi, notlar
- "Dolaba Ekle" butonu

---

### 11.4 Kıyafet Detay (app/item/[id].tsx)

**Üst kısım:** Büyük kıyafet görseli
**Alt kısım (scroll):**
- Metadata kartları (renk, kategori, mevsim, formality)
- "Bu Kıyafetle Yapılan Kombinler" — yatay scroll
- "Giydim" butonu (wear count++)
- İstatistik: Kaç kez giyildi | Maliyet/giyim | Son giyilme
- "Paylaş" | "Ödünç Ver" | "Sil" aksiyonları

---

### 11.5 Kombin Ana Ekranı (app/(tabs)/outfit.tsx)

**Hava Durumu Kartı:** Sıcaklık + açıklama + ikon (konum izni alındıysa)

**Kombin Formu:**
- "Nereye gidiyorsun?" — büyük chip'ler:
  - İş | Buluşma | Alışveriş | Spor | Gece Çıkması | Düğün | Diğer
- "Ruh halin nasıl?" — 5 emoji seçici:
  - 😌 Rahat | ✨ Şık | 🔥 Dikkat Çekici | 🤍 Minimal | 💪 Enerjik
- "Kombin Öner" CTA butonu

**Sonuç Bölümü (scroll):**
- 3 `OutfitCard` — her biri kıyafet görselleri + AI gerekçesi
- "Başka Öner" butonu (infinite)
- "Kaydet" | "Bugün Giydim" aksiyonları

---

### 11.6 "Almalı Mıyım?" (app/buy-decision/index.tsx)

**Giriş:**
- Büyük kamera/galeri seçici
- Fiyat giriş alanı (opsiyonel)
- "Analiz Et" CTA

**Yükleme:** Animasyonlu AI loading overlay

---

### 11.7 Karar Sonucu (app/buy-decision/result.tsx)

**Büyük karar badge'i:** AL (yeşil) | BEKLEME (turuncu) | ALMA (kırmızı)

**Detay Kartları:**
- Confidence bar (%85 gibi)
- "Dolabında şunlara benziyor:" — item görselleri
- "Bu kıyafetle X kombin yapabilirsin" — örnek kombinler
- Maliyet/giyim hesabı
- AI gerekçesi (uzun metin)

**Alt Aksiyonlar:** "Kaydet" | "Arkadaşa Sor" | "Kapat"

---

### 11.8 "Şuraya Gidiyorum" (app/event/index.tsx)

**Form:**
- Etkinlik adı (text input)
- Etkinlik tipi (chip'ler): Düğün | İş Görüşmesi | Doğum Günü | Festival | Spor | Tatil | Diğer
- Tarih & saat seçici
- Lokasyon (opsiyonel, harita ile)
- "Kombin Bul" CTA

---

### 11.9 Etkinlik Kombini (app/event/result.tsx)

- Seçilen etkinlik bilgisi başlıkta
- Hava durumu tahmini (tarih bazlı)
- 3 kombin önerisi
- "Takvime Ekle" butonu (Expo Calendar)
- "Kaydet" butonu

---

### 11.10 Analitik (app/(tabs)/analytics.tsx)

**Özet Kartlar:**
- Toplam kıyafet sayısı
- Toplam gardrop değeri (₺)
- Ortalama maliyet/giyim
- Aylık harcama

**Grafikler (Victory Native):**
- Renk Dağılımı: Donut chart
- Kategori Dağılımı: Bar chart
- Aylık Harcama: Line chart
- Marka Dağılımı: Horizontal bar

**Listeler:**
- En çok giyilenler (top 5)
- Hiç giyilmeyenler → "Sat veya Bağışla" CTA (premium)
- Wear efficiency sıralaması

---

### 11.11 Profil (app/(tabs)/profile.tsx)

**Üst:** Avatar + isim + abonelik badge
**Menü:**
- Arkadaşlarım
- Fiyat Takibi
- Bildirim Ayarları
- Hesap Ayarları
- Aboneliğim
- Gizlilik Politikası
- Çıkış Yap

**Premium Banner (ücretsiz kullanıcılar için):** "Premium'a Geç" CTA

---

### 11.12 Paywall (app/paywall.tsx)

**Başlık:** "Dolap AI Premium"

**Özellik Listesi:**
- ✓ Sınırsız kıyafet
- ✓ Sınırsız kombin önerisi
- ✓ Fiyat takibi & indirim bildirimleri
- ✓ Gardrop analizi & "sat/bağışla" önerisi
- ✓ Arkadaş dolabı
- ✓ Etkinlik planlayıcısı

**Fiyat Seçenekleri:**
- Aylık: ₺79/ay (RevenueCat product ID: `premium_monthly`)
- Yıllık: ₺599/yıl → **en popüler badge** (product ID: `premium_yearly`)

**Alt:** "Gizlilik Politikası" | "Kullanım Şartları" | "Aboneliği Geri Yükle"

---

## 12. Supabase Edge Functions

### 12.1 analyze-clothing

```typescript
// supabase/functions/analyze-clothing/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { imageBase64, mimeType } = await req.json();

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': Deno.env.get('GOOGLE_GEMINI_API_KEY')!,
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            text: `Bu kıyafeti analiz et. YALNIZCA aşağıdaki JSON formatında yanıt ver, başka hiçbir metin ekleme:
{
  "category": "üst|alt|elbise|etek|dış_giyim|ayakkabı|çanta|aksesuar|iç_giyim|spor|diğer",
  "subcategory": "string (gömlek, tişört, jean, palto vb.)",
  "colors": ["renk1", "renk2"],
  "dominant_color_hex": "#RRGGBB",
  "pattern": "düz|çizgili|kareli|çiçekli|baskılı|desenli|noktalı|kamuflaj|diğer",
  "fit": "slim|regular|oversize|crop|fitted|loose|diğer",
  "fabric_estimate": "pamuk|polyester|denim|yün|ipek|keten|kadife|diğer",
  "season": ["ilkbahar|yaz|sonbahar|kış"],
  "formality": "spor|casual|smart_casual|business|formal|parti",
  "style_tags": ["tag1", "tag2", "tag3"]
}`,
          },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
    }),
  });

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const result = JSON.parse(jsonMatch![0]);

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 12.2 recommend-outfit

```typescript
// supabase/functions/recommend-outfit/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Anthropic from 'npm:@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

serve(async (req) => {
  const { wardrobe, event, weather, mood, recentlyWorn } = await req.json();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: `Sen Dolap AI'sın — Türkçe konuşan, moda konusunda uzman bir stilist asistansın.

Kullanıcının gardrobu (JSON):
${JSON.stringify(wardrobe, null, 0)}

Son 7 günde giyilenler (tekrar önerme): ${JSON.stringify(recentlyWorn)}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Lütfen 3 farklı kombin öner.

Bilgiler:
- Etkinlik: ${event}
- Hava: ${weather.temp}°C, ${weather.description}
- Ruh hali: ${mood}

Kurallar:
1. Sadece gardroptaki item ID'lerini kullan
2. Her kombin 2-4 parça içersin
3. Hava durumuna ve etkinliğe uygun olsun
4. Son giyilenleri tekrar önerme

YALNIZCA şu JSON formatını döndür, başka hiçbir metin ekleme:
[
  {
    "items": ["uuid1", "uuid2", "uuid3"],
    "name": "Kombin adı",
    "reason": "Neden bu kombin (max 2 cümle)"
  }
]`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const suggestions = JSON.parse(jsonMatch![0]);

  return new Response(JSON.stringify(suggestions), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 12.3 buy-decision

```typescript
// supabase/functions/buy-decision/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Anthropic from 'npm:@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

serve(async (req) => {
  const { imageBase64, mimeType, wardrobe, price } = await req.json();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1200,
    system: [
      {
        type: 'text',
        text: `Sen Dolap AI'sın — kıyafet satın alma kararlarında uzman bir Türkçe danışmansın.

Kullanıcının mevcut dolabı:
${JSON.stringify(wardrobe, null, 0)}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType || 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Bu kıyafeti almalı mıyım? Fiyatı: ${price ? `${price}₺` : 'belirtilmedi'}

YALNIZCA şu JSON formatını döndür:
{
  "decision": "AL|BEKLEME|ALMA",
  "confidence": 0.85,
  "similar_items_in_wardrobe": ["item_id_1"],
  "combination_count": 5,
  "cost_per_wear_suggestion": "Bu fiyata 10 kez giyersen mantıklı olur",
  "main_reason": "Tek cümle ana gerekçe",
  "details": "2-3 cümle detaylı açıklama",
  "discount_advice": "İndirim beklenmeli mi? (null veya string)"
}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const result = JSON.parse(jsonMatch![0]);

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 12.4 price-check (Cron Job)

```typescript
// supabase/functions/price-check/index.ts
// Bu fonksiyon Supabase Cron ile günde 2 kez çalışır
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Aktif takipleri çek
  const { data: trackings } = await supabase
    .from('price_tracking')
    .select('*, profiles(push_token)')
    .eq('is_active', true)
    .not('product_url', 'is', null);

  for (const tracking of trackings ?? []) {
    // Şimdilik sadece manuel fiyat kontrolü için bildirim gönder
    // Gerçek scraping Trendyol partnership sonrası eklenebilir
    
    if (tracking.current_price && tracking.target_price) {
      if (tracking.current_price <= tracking.target_price) {
        // Hedef fiyata ulaşıldı — bildirim gönder
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: tracking.user_id,
            push_token: tracking.profiles?.push_token,
            title: '🎉 Fiyat düştü!',
            body: `${tracking.product_name} hedef fiyatınıza ulaştı!`,
            data: { type: 'price_drop', tracking_id: tracking.id },
          }),
        });
      }
    }
  }

  return new Response('OK');
});
```

---

## 13. AI Entegrasyonu — Tüm Prompt'lar

### 13.1 Kıyafet Analiz Prompt'u (Gemini Flash)

```
Sen bir kıyafet analiz uzmanısın.
Bu kıyafeti analiz et. YALNIZCA JSON döndür, açıklama ekleme.

{
  "category": "üst|alt|elbise|etek|dış_giyim|ayakkabı|çanta|aksesuar|spor|diğer",
  "subcategory": "string",
  "colors": ["renk1", "renk2"],  // Türkçe renk adları
  "dominant_color_hex": "#RRGGBB",
  "pattern": "düz|çizgili|kareli|çiçekli|baskılı|desenli|noktalı|diğer",
  "fit": "slim|regular|oversize|crop|fitted|loose|diğer",
  "fabric_estimate": "pamuk|polyester|denim|yün|ipek|keten|diğer",
  "season": ["ilkbahar|yaz|sonbahar|kış"],  // birden fazla olabilir
  "formality": "spor|casual|smart_casual|business|formal|parti",
  "style_tags": ["minimalist", "klasik", "trendy"]  // max 3 tag
}
```

### 13.2 Kombin Önerisi Prompt'u (Claude Haiku, cache'li)

```
System (CACHED):
Sen Dolap AI'sın — Türkçe konuşan stilist.
Kullanıcı gardrobu: [JSON]
Son giyilenler: [ID listesi]

User:
Etkinlik: [event]
Hava: [temp]°C, [description]
Ruh hali: [mood]

3 kombin öner. Sadece JSON:
[{"items":["id1","id2"],"name":"string","reason":"string"}]
```

### 13.3 "Almalı Mıyım?" Prompt'u (Claude Haiku, cache'li + görsel)

```
System (CACHED):
Kıyafet satın alma danışmanısın.
Kullanıcı dolabı: [JSON]

User + Image:
Bu kıyafet [fiyat]₺. Almalı mıyım?
JSON döndür:
{
  "decision": "AL|BEKLEME|ALMA",
  "confidence": float,
  "similar_items_in_wardrobe": [ids],
  "combination_count": int,
  "cost_per_wear_suggestion": "string",
  "main_reason": "string",
  "details": "string",
  "discount_advice": "string|null"
}
```

### 13.4 Etkinlik Kombini Prompt'u (Claude Haiku, cache'li)

```
System (CACHED):
Etkinlik stilisti asistansın.
Kullanıcı dolabı: [JSON]

User:
Etkinlik: [title]
Tip: [event_type]
Tarih: [date]
Hava tahmini: [temp]°C
Lokasyon: [location]

3 uygun kombin öner. JSON:
[{"items":[ids],"name":"string","reason":"string","formality_match":"string"}]
```

### 13.5 Gardrop Analiz Prompt'u (Batch API ile)

```
Kullanıcının gardrop verisini analiz et.
Veriler: [full wardrobe JSON with wear stats]

Şu analizleri yap:
1. En az kullanılan 5 kıyafet (6+ ay giyilmemiş)
2. Dolaptaki boşluklar ("sana göre şu kategoride eksik var: ...")
3. En verimli 3 kıyafet (maliyet/giyim oranı)
4. Renk uyumu genel puanı (1-10)

JSON:
{
  "least_used": [ids],
  "wardrobe_gaps": ["string"],
  "most_efficient": [ids],
  "color_harmony_score": int,
  "suggestions": ["string"]
}
```

---

## 14. Arka Plan Silme

### Replicate REMBG Entegrasyonu

```typescript
// lib/background-removal.ts
import * as FileSystem from 'expo-file-system';

export async function removeBackground(imageUri: string): Promise<string> {
  // Görseli base64'e çevir
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Replicate API'ye gönder
  const initResponse = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003',
      input: {
        image: `data:image/jpeg;base64,${base64}`,
      },
    }),
  });

  const prediction = await initResponse.json();

  // Sonucu bekle (polling)
  let result = prediction;
  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const pollResponse = await fetch(
      `https://api.replicate.com/v1/predictions/${result.id}`,
      { headers: { 'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}` } }
    );
    result = await pollResponse.json();
  }

  if (result.status === 'failed') {
    throw new Error('Arka plan silme başarısız');
  }

  // Sonuç URL'sini lokal dosyaya indir
  const outputUrl = result.output;
  const localPath = `${FileSystem.cacheDirectory}bg-removed-${Date.now()}.png`;
  await FileSystem.downloadAsync(outputUrl, localPath);

  return localPath;
}
```

### Görsel Boyut Optimizasyonu

```typescript
// lib/storage/image.ts
import * as ImageManipulator from 'expo-image-manipulator';

export async function optimizeImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  return result.uri;
}

export async function createThumbnail(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 200 } }],
    {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  return result.uri;
}
```

---

## 15. Hava Durumu Entegrasyonu

```typescript
// lib/weather.ts
import * as Location from 'expo-location';
import type { WeatherData } from '@/types';

export async function getCurrentWeather(): Promise<WeatherData | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY}&units=metric&lang=tr`
    );

    const data = await response.json();

    return {
      temp: Math.round(data.main.temp),
      feels_like: Math.round(data.main.feels_like),
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      humidity: data.main.humidity,
      city: data.name,
    };
  } catch {
    return null;
  }
}

export async function getForecast(date: Date): Promise<WeatherData | null> {
  // 5 günlük tahmin için (etkinlik kombini)
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY}&units=metric&lang=tr&cnt=40`
    );

    const data = await response.json();
    const targetTime = date.getTime();
    const closestForecast = data.list.reduce((prev: any, curr: any) => {
      return Math.abs(curr.dt * 1000 - targetTime) < Math.abs(prev.dt * 1000 - targetTime) ? curr : prev;
    });

    return {
      temp: Math.round(closestForecast.main.temp),
      feels_like: Math.round(closestForecast.main.feels_like),
      description: closestForecast.weather[0].description,
      icon: closestForecast.weather[0].icon,
      humidity: closestForecast.main.humidity,
      city: '',
    };
  } catch {
    return null;
  }
}
```

---

## 16. Push Bildirimleri

### Kurulum

```typescript
// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: 'YOUR_EAS_PROJECT_ID',
  })).data;

  // Token'ı Supabase'e kaydet
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', user.id);
  }

  return token;
}

export async function scheduleOutfitReminder() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Bugün ne giyeceksin? 👗',
      body: 'Dolap AI sana harika bir kombin önerisinde bulunmak istiyor!',
      data: { screen: '/(tabs)/outfit' },
    },
    trigger: {
      hour: 8,
      minute: 0,
      repeats: true,
    },
  });
}

export async function cancelOutfitReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
```

---

## 17. Abonelik & Ödeme (RevenueCat)

### Kurulum

```typescript
// lib/revenuecat.ts
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

export function initializeRevenueCat() {
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({
    apiKey: Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY!,
  });
}

export async function getOfferings() {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePackage(packageItem: any) {
  const { customerInfo } = await Purchases.purchasePackage(packageItem);
  return customerInfo;
}

export async function restorePurchases() {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo;
}

export async function getCustomerInfo() {
  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo;
}

export function isPremium(customerInfo: any): boolean {
  return (
    customerInfo.entitlements.active['premium'] !== undefined ||
    customerInfo.entitlements.active['family'] !== undefined
  );
}
```

### RevenueCat Webhook → Supabase

```typescript
// supabase/functions/revenuecat-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const payload = await req.json();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { event } = payload;
  const userId = event.app_user_id;
  const eventType = event.type;

  const tierMap: Record<string, string> = {
    'INITIAL_PURCHASE': 'premium',
    'RENEWAL': 'premium',
    'PRODUCT_CHANGE': 'premium',
    'CANCELLATION': 'free',
    'EXPIRATION': 'free',
  };

  const productId = event.product_id;
  const isFamilyPlan = productId?.includes('family');
  const tier = isFamilyPlan ? 'family' : (tierMap[eventType] ?? 'free');

  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  await supabase
    .from('profiles')
    .update({
      subscription_tier: tier,
      subscription_expires_at: expiresAt,
    })
    .eq('revenuecat_customer_id', userId);

  return new Response('OK');
});
```

---

## 18. Freemium Gate Mantığı

```typescript
// constants/limits.ts
export const FREE_LIMITS = {
  MAX_WARDROBE_ITEMS: 30,
  DAILY_OUTFIT_SUGGESTIONS: 3,
  BUY_DECISIONS_PER_MONTH: 5,
  PRICE_TRACKING_ITEMS: 3,
  FRIENDS: 0,                    // Sosyal özellikler premium
  ANALYTICS_FULL: false,
  EVENT_PLANNING: false,
};

export const PREMIUM_LIMITS = {
  MAX_WARDROBE_ITEMS: Infinity,
  DAILY_OUTFIT_SUGGESTIONS: Infinity,
  BUY_DECISIONS_PER_MONTH: Infinity,
  PRICE_TRACKING_ITEMS: Infinity,
  FRIENDS: Infinity,
  ANALYTICS_FULL: true,
  EVENT_PLANNING: true,
};
```

```typescript
// hooks/useSubscription.ts
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { getCustomerInfo, isPremium } from '@/lib/revenuecat';
import { FREE_LIMITS, PREMIUM_LIMITS } from '@/constants/limits';

export function useSubscription() {
  const { profile } = useAuthStore();
  const { setPremium } = useSubscriptionStore();

  const premium = profile?.subscription_tier !== 'free';
  const limits = premium ? PREMIUM_LIMITS : FREE_LIMITS;

  const checkGate = (feature: keyof typeof FREE_LIMITS): boolean => {
    if (premium) return true;
    const limit = FREE_LIMITS[feature];
    if (typeof limit === 'boolean') return limit;
    return true; // sayısal limitler için ayrı kontrol gerekir
  };

  return { premium, limits, checkGate };
}
```

```typescript
// components/shared/PremiumGate.tsx
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSubscription } from '@/hooks/useSubscription';
import Button from '@/components/ui/Button';
import Text from '@/components/ui/Text';

interface Props {
  feature: string;
  children: React.ReactNode;
}

export default function PremiumGate({ feature, children }: Props) {
  const { premium } = useSubscription();

  if (premium) return <>{children}</>;

  return (
    <View style={{ alignItems: 'center', padding: 24 }}>
      <Text variant="h3">✨ Premium Özellik</Text>
      <Text variant="body" style={{ textAlign: 'center', marginTop: 8 }}>
        {feature} özelliği Premium üyelere özeldir.
      </Text>
      <Button
        title="Premium'a Geç"
        onPress={() => router.push('/paywall')}
        style={{ marginTop: 16 }}
      />
    </View>
  );
}
```

---

## 19. Analytics (PostHog)

```typescript
// lib/analytics.ts
import PostHog from '@posthog/react-native';

export const posthog = new PostHog(
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY!,
  { host: process.env.EXPO_PUBLIC_POSTHOG_HOST }
);

// Takip edilecek eventler
export const EVENTS = {
  // Auth
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',

  // Wardrobe
  ITEM_ADDED: 'item_added',
  ITEM_DELETED: 'item_deleted',
  WARDROBE_VIEWED: 'wardrobe_viewed',

  // Outfit
  OUTFIT_REQUESTED: 'outfit_requested',
  OUTFIT_SAVED: 'outfit_saved',
  OUTFIT_WORN: 'outfit_worn',
  OUTFIT_SHARED: 'outfit_shared',

  // Buy Decision
  BUY_DECISION_STARTED: 'buy_decision_started',
  BUY_DECISION_COMPLETED: 'buy_decision_completed',

  // Monetization
  PAYWALL_VIEWED: 'paywall_viewed',
  PURCHASE_STARTED: 'purchase_started',
  PURCHASE_COMPLETED: 'purchase_completed',

  // Social
  FRIEND_ADDED: 'friend_added',
  OUTFIT_VOTE_CAST: 'outfit_vote_cast',
} as const;

export function track(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

export function identify(userId: string, properties?: Record<string, unknown>) {
  posthog.identify(userId, properties);
}
```

---

## 20. Hata İzleme (Sentry)

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/react-native';

export function initSentry() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
  });
}

export function setUserContext(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email });
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}
```

---

## 21. Cloudflare R2 Kurulumu

```typescript
// lib/storage/r2.ts
import * as FileSystem from 'expo-file-system';

const R2_BASE_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL!;

export async function uploadToR2(
  localUri: string,
  path: string,   // örn: "userId/wardrobe/itemId.jpg"
  mimeType = 'image/jpeg'
): Promise<string> {
  const uploadUrl = await getPresignedUploadUrl(path, mimeType);

  const blob = await (await fetch(localUri)).blob();

  await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': mimeType },
  });

  return `${R2_BASE_URL}/${path}`;
}

async function getPresignedUploadUrl(path: string, mimeType: string): Promise<string> {
  // Supabase Edge Function üzerinden presigned URL al
  const { data, error } = await fetch('/functions/v1/get-upload-url', {
    method: 'POST',
    body: JSON.stringify({ path, mimeType }),
  }).then(r => r.json());

  return data.url;
}

export async function deleteFromR2(path: string): Promise<void> {
  await fetch('/functions/v1/delete-file', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}
```

---

## 22. Build & Deploy

### eas.json

```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "production": {
      "ios": {
        "autoIncrement": true
      },
      "android": {
        "autoIncrement": true,
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "YOUR_APP_STORE_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### Build Komutları

```bash
# Development build (simulator)
eas build --profile development --platform ios

# Preview build (gerçek cihaz, internal test)
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# App Store + Google Play'e gönder
eas submit --profile production --platform all
```

### Supabase Edge Functions Deploy

```bash
# Tüm fonksiyonları deploy et
supabase functions deploy analyze-clothing
supabase functions deploy recommend-outfit
supabase functions deploy buy-decision
supabase functions deploy price-check
supabase functions deploy send-notification
supabase functions deploy revenuecat-webhook

# Secrets ayarla
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set GOOGLE_GEMINI_API_KEY=AIza...
supabase secrets set REPLICATE_API_TOKEN=r8_...
```

### Supabase Cron Job (Fiyat Kontrolü)

```sql
-- Supabase Dashboard > Database > Extensions > pg_cron aktif et
SELECT cron.schedule(
  'price-check-job',
  '0 9,21 * * *',   -- Günde 2 kez: 09:00 ve 21:00
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/price-check',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

---

## 23. Geliştirme Sırası (Sprint Planı)

### Faz 1 — Temel (Hafta 1–4)

**Hafta 1: Altyapı**
- [ ] Expo projesi kur, tüm paketleri yükle
- [ ] Supabase projesi: tablolar, RLS, storage bucket'ları
- [ ] Auth akışı: giriş, kayıt, onboarding ekranları
- [ ] Tab navigasyon iskelet yapısı
- [ ] Design tokens: renkler, tipografi, spacing
- [ ] Temel UI bileşenleri: Button, Input, Text, Card

**Hafta 2: Kıyafet Ekleme**
- [ ] Kamera + galeri entegrasyonu
- [ ] Görsel optimizasyon (resize, compress)
- [ ] Replicate REMBG arka plan silme
- [ ] Gemini Flash kıyafet analizi (Edge Function)
- [ ] Metadata formu + Supabase'e kaydetme
- [ ] R2 görsel yükleme

**Hafta 3: Dolap Ekranı**
- [ ] WardrobeGrid bileşeni (2 kolon, masonry)
- [ ] Kategori + sezon filtresi
- [ ] Kıyafet detay ekranı
- [ ] Düzenleme + silme
- [ ] Arama özelliği
- [ ] Boş durum + loading skeleton

**Hafta 4: Kombin Önerisi**
- [ ] OpenWeatherMap entegrasyonu (konum izni)
- [ ] Kombin formu (etkinlik + ruh hali seçici)
- [ ] Claude Haiku Edge Function (prompt caching)
- [ ] Kombin sonuç UI (3 kart)
- [ ] "Başka Öner" sonsuz döngü
- [ ] Kombin kaydetme + wear count güncelleme

**→ Faz 1 Çıktısı: Çalışan MVP. Göster, test et, geri bildirim al.**

---

### Faz 2 — Karar Motoru (Hafta 5–8)

**Hafta 5–6: "Almalı Mıyım?"**
- [ ] Görsel yükleme akışı
- [ ] Claude Haiku karar motoru Edge Function
- [ ] Sonuç ekranı (karar badge + detaylar)
- [ ] Benzer kıyafet gösterimi
- [ ] Karar geçmişi kaydetme

**Hafta 7–8: Etkinlik & Analitik**
- [ ] "Şuraya Gidiyorum" form ekranı
- [ ] Etkinlik kombini Edge Function
- [ ] Takvime kaydetme (Expo Calendar)
- [ ] Analitik dashboard (Victory Native grafikler)
- [ ] Maliyet/giyim hesabı
- [ ] "Bunları hiç giymiyorsun" listesi

---

### Faz 3 — Monetizasyon (Hafta 9–12)

**Hafta 9–10: RevenueCat**
- [ ] RevenueCat SDK entegrasyonu
- [ ] App Store + Google Play ürünleri tanımla
- [ ] Paywall ekranı tasarımı ve implementasyonu
- [ ] Premium feature gate'leri
- [ ] Webhook → Supabase tier güncelleme

**Hafta 11–12: Bildirimler & Fiyat Takibi**
- [ ] Expo Notifications kurulumu
- [ ] Push token kaydetme
- [ ] Sabah kombin hatırlatıcısı (08:00)
- [ ] Fiyat takip listesi CRUD ekranı
- [ ] Price-check cron job
- [ ] Bildirim tercihleri ayarları

---

### Faz 4 — Sosyal (Hafta 13–18)

**Hafta 13–14: Arkadaş Sistemi**
- [ ] Kullanıcı arama (username ile)
- [ ] Arkadaşlık isteği gönderme/kabul etme
- [ ] Supabase Realtime ile anlık güncelleme
- [ ] Davet linki (deep link, Branch.io)

**Hafta 15–16: Paylaşılan Dolap**
- [ ] Arkadaş dolabı görüntüleme (RLS)
- [ ] "Ödünç verebilirim" işaretleme
- [ ] Arkadaşa kombin sorarma

**Hafta 17–18: Kombin Paylaşımı & Viral**
- [ ] Kombin paylaşım kartı (React Native Skia)
- [ ] Arkadaş oylama sistemi
- [ ] "Arkadaşını davet et → 1 ay ücretsiz" sistemi
- [ ] App Store / Google Play final hazırlık

---

### Önemli Notlar

1. **Prompt Caching zorunlu:** Kombin ve karar fonksiyonlarında kullanıcı dolap verisi her zaman `cache_control: { type: "ephemeral" }` ile işaretlenmeli. Yoksa maliyet 3x artar.

2. **Görsel pipeline:** Upload sırası şöyle olmalı: `cihaz → optimize (800px, JPEG %80) → arka plan sil → R2'ye yükle → URL Supabase'e kaydet`. Hiçbir zaman orijinal görseli doğrudan yükleme.

3. **Offline mode:** `react-native-mmkv` ile son 30 kıyafet ve son 3 kombin öneri lokale cache'lenmeli. İnternet yoksa bu veri gösterilmeli.

4. **Error handling:** Her Edge Function çağrısında retry mantığı olmalı (max 3 deneme, exponential backoff). AI hataları kullanıcıya "Tekrar dene" olarak gösterilmeli.

5. **Görsel lazy loading:** `react-native-fast-image` ile tüm kıyafet görselleri cache'lenmeli. `priority="normal"` ile yüklenmeli.

6. **KVKK:** Kayıt akışında "Kişisel Verilerin İşlenmesi" onay checkbox'ı zorunlu. Hesap silme: 30 gün içinde tüm veriler (DB + R2 görseller) cascade silinmeli.

7. **Freemium limiti kontrol sırası:** Kıyafet eklemeden önce `wardrobe_items` count kontrolü yapılmalı. Limit aşılırsa direkt paywall açılmalı.

8. **RevenueCat entitlement adı:** `premium` olarak tanımla. Hem aylık hem yıllık plan aynı entitlement'ı açmalı.

---

*Bu doküman Dolap AI v1.0 için hazırlanmıştır. Tüm bölümler eksiksiz implement edildiğinde tam fonksiyonel bir uygulama ortaya çıkar.*
