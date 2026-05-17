-- ============================================================
-- Migration 025: New features — outfit diary, fit notes,
--                body profile, brand wishlist
-- ============================================================

-- 1. outfit_diary: daily outfit logging ("Ne giydim?")
CREATE TABLE IF NOT EXISTS outfit_diary (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worn_at     date        NOT NULL,
  outfit_id   uuid        REFERENCES outfits(id) ON DELETE SET NULL,
  item_ids    uuid[]      NOT NULL DEFAULT '{}',
  photo_url   text,
  mood        text,
  weather_desc text,
  rating      smallint    CHECK (rating BETWEEN 1 AND 5),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, worn_at)
);

CREATE INDEX IF NOT EXISTS idx_outfit_diary_user_date
  ON outfit_diary (user_id, worn_at DESC);

ALTER TABLE outfit_diary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diary_owner" ON outfit_diary
FOR ALL USING (user_id = auth.uid());

-- 2. fit_note: per-item fit notes ("bana büyük geldi" etc.)
ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS fit_note text;

-- 3. outfit_rating: star rating stored on diary (already in outfit_diary.rating)
--    Also add to wardrobe_items for quick access (wear satisfaction)
ALTER TABLE wardrobe_items
  ADD COLUMN IF NOT EXISTS last_rating smallint CHECK (last_rating BETWEEN 1 AND 5);

-- 4. body_profile: height, weight, usual sizes stored as JSONB on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS body_profile jsonb NOT NULL DEFAULT '{}';

-- 5. brand_wishlist: track brands for sale alerts
CREATE TABLE IF NOT EXISTS brand_wishlist (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name  text        NOT NULL,
  store_url   text,
  notify_on_sale boolean  NOT NULL DEFAULT true,
  last_notified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, brand_name)
);

CREATE INDEX IF NOT EXISTS idx_brand_wishlist_user
  ON brand_wishlist (user_id);

ALTER TABLE brand_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_wishlist_owner" ON brand_wishlist
FOR ALL USING (user_id = auth.uid());

-- 6. style_chat_history: conversation history for Style Chat
CREATE TABLE IF NOT EXISTS style_chat_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user','assistant')),
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_chat_user_time
  ON style_chat_history (user_id, created_at DESC);

ALTER TABLE style_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_owner" ON style_chat_history
FOR ALL USING (user_id = auth.uid());
