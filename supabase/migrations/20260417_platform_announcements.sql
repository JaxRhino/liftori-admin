-- ═══════════════════════════════════════════════════════════════════════
-- PLATFORM ANNOUNCEMENTS — center-screen alerts with acknowledgment
-- ═══════════════════════════════════════════════════════════════════════
-- Founders (Ryan/Mike) post announcements that appear center-screen to
-- internal team members who match the audience targeting.
-- Users click "Understood" once to permanently dismiss.
-- Founders see a receipts list showing who's acked and who hasn't.
--
-- Targeting: all_team | department | individual
-- Templates: new_hire | feature_launch | company_update | pump_up | custom
-- Priority:  normal | important | urgent

-- ─── 1) Add department column to profiles (targeting support) ─────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department text;

CREATE INDEX IF NOT EXISTS idx_profiles_department
  ON public.profiles(department) WHERE department IS NOT NULL;

-- ─── 2) is_founder() helper — checks against the 4 founder emails ─────
CREATE OR REPLACE FUNCTION public.is_founder()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (
        LOWER(COALESCE(email, '')) IN (
          'ryan@liftori.ai', 'mike@liftori.ai',
          'rhinomarch78@gmail.com', '4sherpanation@gmail.com'
        )
        OR LOWER(COALESCE(personal_email, '')) IN (
          'ryan@liftori.ai', 'mike@liftori.ai',
          'rhinomarch78@gmail.com', '4sherpanation@gmail.com'
        )
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_founder() TO authenticated;

-- ─── 3) platform_announcements table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  template text CHECK (template IN ('new_hire', 'feature_launch', 'company_update', 'pump_up', 'custom')) DEFAULT 'custom',
  audience_type text NOT NULL CHECK (audience_type IN ('all_team', 'department', 'individual')) DEFAULT 'all_team',
  audience_departments text[] DEFAULT NULL,   -- only for audience_type='department'
  audience_user_ids uuid[] DEFAULT NULL,      -- only for audience_type='individual'
  priority text NOT NULL CHECK (priority IN ('normal', 'important', 'urgent')) DEFAULT 'normal',
  accent_color text DEFAULT 'sky',            -- tailwind color key for theming
  icon text DEFAULT NULL,                     -- lucide-react icon name (e.g. 'Sparkles')
  posted_by uuid REFERENCES auth.users(id) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz DEFAULT NULL,        -- optional auto-expire
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_active
  ON public.platform_announcements(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_announcements_posted_by
  ON public.platform_announcements(posted_by);
CREATE INDEX IF NOT EXISTS idx_platform_announcements_expires
  ON public.platform_announcements(expires_at) WHERE expires_at IS NOT NULL;

-- ─── 4) announcement_acknowledgments table ────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcement_acknowledgments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id uuid NOT NULL REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_acks_user
  ON public.announcement_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_acks_announcement
  ON public.announcement_acknowledgments(announcement_id);

-- ─── 5) RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_acknowledgments ENABLE ROW LEVEL SECURITY;

-- 5a) Announcements: founders full CRUD
CREATE POLICY "founders_all_announcements"
  ON public.platform_announcements
  FOR ALL
  USING (public.is_founder())
  WITH CHECK (public.is_founder());

-- 5b) Announcements: internal team reads announcements targeted at them
-- (customers excluded — this is an internal-only surface)
CREATE POLICY "team_read_targeted_announcements"
  ON public.platform_announcements
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.role, 'customer') <> 'customer'
    )
    AND (
      audience_type = 'all_team'
      OR (
        audience_type = 'department'
        AND audience_departments IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles p2
          WHERE p2.id = auth.uid()
            AND p2.department = ANY(audience_departments)
        )
      )
      OR (
        audience_type = 'individual'
        AND audience_user_ids IS NOT NULL
        AND auth.uid() = ANY(audience_user_ids)
      )
    )
  );

-- 5c) Acks: founders see all
CREATE POLICY "founders_all_acks"
  ON public.announcement_acknowledgments
  FOR ALL
  USING (public.is_founder())
  WITH CHECK (public.is_founder());

-- 5d) Acks: users insert their own ack (only for themselves)
CREATE POLICY "users_insert_own_ack"
  ON public.announcement_acknowledgments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 5e) Acks: users read their own acks
CREATE POLICY "users_read_own_acks"
  ON public.announcement_acknowledgments
  FOR SELECT
  USING (user_id = auth.uid());

-- ─── 6) PostgREST GRANTs ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_announcements TO authenticated;
GRANT SELECT, INSERT ON public.announcement_acknowledgments TO authenticated;

-- ─── 7) Updated_at trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_platform_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS platform_announcements_updated_at ON public.platform_announcements;
CREATE TRIGGER platform_announcements_updated_at
  BEFORE UPDATE ON public.platform_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_platform_announcements_updated_at();

-- ─── 8) RPC: get_active_announcements_for_me ──────────────────────────
-- Returns announcements the current user can see and hasn't acked yet,
-- sorted by priority then recency. Used by the center-screen modal.
CREATE OR REPLACE FUNCTION public.get_active_announcements_for_me()
RETURNS SETOF public.platform_announcements
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT a.*
  FROM public.platform_announcements a
  WHERE a.is_active = true
    AND (a.expires_at IS NULL OR a.expires_at > now())
    AND NOT EXISTS (
      SELECT 1 FROM public.announcement_acknowledgments ack
      WHERE ack.announcement_id = a.id AND ack.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.role, 'customer') <> 'customer'
    )
    AND (
      a.audience_type = 'all_team'
      OR (a.audience_type = 'department' AND a.audience_departments IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles p2
        WHERE p2.id = auth.uid() AND p2.department = ANY(a.audience_departments)
      ))
      OR (a.audience_type = 'individual' AND a.audience_user_ids IS NOT NULL AND auth.uid() = ANY(a.audience_user_ids))
    )
  ORDER BY
    CASE a.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
    a.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_active_announcements_for_me() TO authenticated;

-- ─── 9) RPC: get_announcement_recipients ──────────────────────────────
-- Founder-only. Returns the full list of targeted users with ack status.
-- Used by the Announcement Center recipient drawer.
CREATE OR REPLACE FUNCTION public.get_announcement_recipients(p_announcement_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  role text,
  department text,
  avatar_url text,
  acknowledged_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF NOT public.is_founder() THEN
    RAISE EXCEPTION 'Only founders can list announcement recipients';
  END IF;

  RETURN QUERY
  WITH ann AS (
    SELECT * FROM public.platform_announcements WHERE id = p_announcement_id
  ),
  targeted AS (
    SELECT p.id AS uid, p.full_name, p.email, p.role, p.department, p.avatar_url
    FROM public.profiles p, ann
    WHERE COALESCE(p.role, 'customer') <> 'customer'
      AND (
        ann.audience_type = 'all_team'
        OR (ann.audience_type = 'department' AND ann.audience_departments IS NOT NULL
            AND p.department = ANY(ann.audience_departments))
        OR (ann.audience_type = 'individual' AND ann.audience_user_ids IS NOT NULL
            AND p.id = ANY(ann.audience_user_ids))
      )
  )
  SELECT t.uid, t.full_name, t.email, t.role, t.department, t.avatar_url,
         ack.acknowledged_at
  FROM targeted t
  LEFT JOIN public.announcement_acknowledgments ack
    ON ack.announcement_id = p_announcement_id AND ack.user_id = t.uid
  ORDER BY (ack.acknowledged_at IS NULL) DESC, t.full_name NULLS LAST;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_announcement_recipients(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- DONE. To verify:
--   SELECT public.is_founder();
--   SELECT * FROM public.get_active_announcements_for_me();
-- ═══════════════════════════════════════════════════════════════════════
