-- Featured social posts (TikTok, Instagram, custom)
-- Admin pins specific posts to display on the homepage
CREATE TABLE IF NOT EXISTS featured_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'custom')),
  post_url text NOT NULL,
  thumbnail_url text,
  caption text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE featured_posts ENABLE ROW LEVEL SECURITY;

-- Public can read active posts
CREATE POLICY "Public read active featured posts" ON featured_posts
  FOR SELECT USING (is_active = true);

-- Admins can manage
CREATE POLICY "Admins manage featured posts" ON featured_posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_featured_posts_platform_order
  ON featured_posts(platform, sort_order) WHERE is_active = true;
