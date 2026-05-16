-- ============================================================
-- Migration 023: Security hardening
-- ============================================================

-- 1. Fix find_similar_wardrobe_items: enforce auth.uid(), return full rows
DROP FUNCTION IF EXISTS find_similar_wardrobe_items(vector, int);

CREATE OR REPLACE FUNCTION find_similar_wardrobe_items(
  query_embedding vector(512),
  match_count     int DEFAULT 8
)
RETURNS SETOF wardrobe_items
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wi.*
  FROM wardrobe_items wi
  WHERE
    wi.user_id = auth.uid()
    AND wi.is_active = TRUE
    AND wi.embedding IS NOT NULL
  ORDER BY wi.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION find_similar_wardrobe_items(vector, int) TO authenticated;

-- 2. RLS: wardrobe_items — friends can only see is_shareable=true items
-- Ensure RLS is enabled
ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;

-- Drop existing friend policy if any (recreate cleanly)
DROP POLICY IF EXISTS "friend_wardrobe_read" ON wardrobe_items;

CREATE POLICY "friend_wardrobe_read" ON wardrobe_items
FOR SELECT
USING (
  -- Owner can always see their own
  user_id = auth.uid()
  OR
  -- Friends can see shareable items only
  (
    is_shareable = true
    AND is_active = true
    AND user_id IN (
      SELECT addressee_id FROM friendships
      WHERE requester_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT requester_id FROM friendships
      WHERE addressee_id = auth.uid() AND status = 'accepted'
    )
  )
);

-- 3. profiles: prevent username enumeration — only authenticated users can search
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_search_authenticated" ON profiles;
CREATE POLICY "profiles_search_authenticated" ON profiles
FOR SELECT
USING (auth.role() = 'authenticated');

-- 4. outfits: share token index for faster lookup
CREATE INDEX IF NOT EXISTS idx_outfits_share_token
  ON outfits (share_token)
  WHERE share_token IS NOT NULL;

-- 5. loan_requests: owner can only manage their own items
ALTER TABLE loan_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_requests_owner_access" ON loan_requests;
CREATE POLICY "loan_requests_owner_access" ON loan_requests
FOR ALL
USING (
  owner_id = auth.uid() OR requester_id = auth.uid()
);

-- 6. notifications: users can only see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_owner_access" ON notifications;
CREATE POLICY "notifications_owner_access" ON notifications
FOR SELECT
USING (user_id = auth.uid());

-- Mark read: only the recipient can update
DROP POLICY IF EXISTS "notifications_mark_read" ON notifications;
CREATE POLICY "notifications_mark_read" ON notifications
FOR UPDATE
USING (user_id = auth.uid());
