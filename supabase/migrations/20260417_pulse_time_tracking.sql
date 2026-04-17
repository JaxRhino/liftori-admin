-- ═══════════════════════════════════════════════════════════════════════
-- PULSE — Team time clock + leaderboard
-- ═══════════════════════════════════════════════════════════════════════
-- Every internal team member clocks in/out from the global header chip.
-- Sessions roll up into Today / Week / MTD / TTD totals on a public
-- leaderboard. Idle detection auto-ends sessions after 15 min.
-- Users can add "offline" entries for work done outside the platform.
-- Founders can edit any session; edits are logged to pulse_adjustments.
--
-- Gamification: streaks, tiers (Rookie/Regular/Operator/Vet/Legend),
-- weekly MVP, rank-change arrows. Customers never see any of this.

-- ─── 1) work_sessions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz DEFAULT NULL,                   -- NULL = currently on the clock
  duration_seconds integer DEFAULT NULL,               -- cached for fast aggregates
  source text NOT NULL DEFAULT 'header'
    CHECK (source IN ('header', 'auto', 'offline', 'admin_edit')),
  ended_reason text DEFAULT NULL
    CHECK (ended_reason IS NULL OR ended_reason IN (
      'manual', 'idle_timeout', 'browser_close', 'admin_edit', 'offline_entry'
    )),
  is_offline boolean NOT NULL DEFAULT false,           -- true = user added as offline work
  notes text DEFAULT NULL,                             -- required for offline entries
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Sanity: ended_at must be after started_at when present
  CONSTRAINT work_sessions_time_valid CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_work_sessions_user        ON public.work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_live        ON public.work_sessions(user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_sessions_started     ON public.work_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_week   ON public.work_sessions(user_id, started_at DESC);

-- Keep only ONE in-progress session per user (prevents double clock-in)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_work_sessions_open_per_user
  ON public.work_sessions(user_id) WHERE ended_at IS NULL;

-- Auto-compute duration_seconds when ended_at is set
CREATE OR REPLACE FUNCTION public.work_sessions_compute_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL THEN
    NEW.duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::int);
  ELSE
    NEW.duration_seconds = NULL;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_work_sessions_duration ON public.work_sessions;
CREATE TRIGGER trg_work_sessions_duration
  BEFORE INSERT OR UPDATE ON public.work_sessions
  FOR EACH ROW EXECUTE FUNCTION public.work_sessions_compute_duration();

-- ─── 2) pulse_adjustments (audit log for edits) ───────────────────────
CREATE TABLE IF NOT EXISTS public.pulse_adjustments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.work_sessions(id) ON DELETE SET NULL,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edited_by uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('edit', 'delete', 'create_offline')),
  reason text NOT NULL,
  before_state jsonb DEFAULT NULL,
  after_state jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pulse_adj_target  ON public.pulse_adjustments(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_adj_session ON public.pulse_adjustments(session_id);

-- ─── 3) RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.work_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_adjustments ENABLE ROW LEVEL SECURITY;

-- 3a) Team reads all sessions (full transparency — the point of Pulse)
CREATE POLICY "team_reads_all_sessions"
  ON public.work_sessions
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.role, 'customer') <> 'customer'
    )
  );

-- 3b) Users insert their own sessions (header clock-in + offline entries)
CREATE POLICY "users_insert_own_sessions"
  ON public.work_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 3c) Users update their own IN-PROGRESS session only (to clock out)
-- Platform-tracked completed sessions are immutable to the user.
CREATE POLICY "users_update_own_open_session"
  ON public.work_sessions
  FOR UPDATE
  USING (user_id = auth.uid() AND ended_at IS NULL)
  WITH CHECK (user_id = auth.uid());

-- 3d) Users can delete their own offline entries (not platform-tracked)
CREATE POLICY "users_delete_own_offline"
  ON public.work_sessions
  FOR DELETE
  USING (user_id = auth.uid() AND is_offline = true);

-- 3e) Founders: full CRUD on any session (for admin corrections)
CREATE POLICY "founders_all_sessions"
  ON public.work_sessions
  FOR ALL
  USING (public.is_founder())
  WITH CHECK (public.is_founder());

-- 3f) Adjustments log: team can read (transparency), founders write
CREATE POLICY "team_reads_adjustments"
  ON public.pulse_adjustments
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND COALESCE(p.role, 'customer') <> 'customer'
    )
  );

CREATE POLICY "founders_write_adjustments"
  ON public.pulse_adjustments
  FOR INSERT
  WITH CHECK (public.is_founder());

-- ─── 4) PostgREST GRANTs ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_sessions     TO authenticated;
GRANT SELECT, INSERT                 ON public.pulse_adjustments TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 5) start_session — idempotent clock-in ───────────────────────────
CREATE OR REPLACE FUNCTION public.start_session()
RETURNS public.work_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing public.work_sessions;
  v_new      public.work_sessions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to clock in';
  END IF;

  -- Internal team only
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND COALESCE(role, 'customer') <> 'customer'
  ) THEN
    RAISE EXCEPTION 'Only internal team members can use the clock';
  END IF;

  -- If already clocked in, return the existing session (idempotent)
  SELECT * INTO v_existing
  FROM public.work_sessions
  WHERE user_id = auth.uid() AND ended_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.work_sessions (user_id, source)
  VALUES (auth.uid(), 'header')
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;
GRANT EXECUTE ON FUNCTION public.start_session() TO authenticated;

-- ─── 6) end_session — idempotent clock-out ────────────────────────────
CREATE OR REPLACE FUNCTION public.end_session(
  p_reason text DEFAULT 'manual'
)
RETURNS public.work_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session public.work_sessions;
  v_end_at  timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT * INTO v_session
  FROM public.work_sessions
  WHERE user_id = auth.uid() AND ended_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL; -- nothing to end, idempotent
  END IF;

  -- Min session length: 60s. Shorter = treat as bogus, delete instead.
  IF EXTRACT(EPOCH FROM (v_end_at - v_session.started_at)) < 60 THEN
    DELETE FROM public.work_sessions WHERE id = v_session.id;
    RETURN NULL;
  END IF;

  -- Max session length: 12h. Longer = auto-split at 12h and mark as idle_timeout.
  IF EXTRACT(EPOCH FROM (v_end_at - v_session.started_at)) > 12 * 3600 THEN
    v_end_at := v_session.started_at + INTERVAL '12 hours';
    p_reason := 'idle_timeout';
  END IF;

  UPDATE public.work_sessions
     SET ended_at = v_end_at,
         ended_reason = COALESCE(p_reason, 'manual')
   WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;
GRANT EXECUTE ON FUNCTION public.end_session(text) TO authenticated;

-- ─── 7) add_offline_session — user logs offline work ──────────────────
CREATE OR REPLACE FUNCTION public.add_offline_session(
  p_started_at timestamptz,
  p_ended_at   timestamptz,
  p_notes      text
)
RETURNS public.work_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session public.work_sessions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF p_ended_at <= p_started_at THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;
  IF EXTRACT(EPOCH FROM (p_ended_at - p_started_at)) > 12 * 3600 THEN
    RAISE EXCEPTION 'Offline entry cannot exceed 12 hours — split into multiple entries';
  END IF;
  IF p_notes IS NULL OR LENGTH(TRIM(p_notes)) < 3 THEN
    RAISE EXCEPTION 'Notes are required for offline entries (describe what you worked on)';
  END IF;

  INSERT INTO public.work_sessions
    (user_id, started_at, ended_at, source, ended_reason, is_offline, notes)
  VALUES
    (auth.uid(), p_started_at, p_ended_at, 'offline', 'offline_entry', true, TRIM(p_notes))
  RETURNING * INTO v_session;

  -- Log the creation so there's an audit trail (offline = trust-based)
  INSERT INTO public.pulse_adjustments
    (session_id, target_user_id, edited_by, action, reason, after_state)
  VALUES
    (v_session.id, auth.uid(), auth.uid(), 'create_offline', TRIM(p_notes), to_jsonb(v_session));

  RETURN v_session;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_offline_session(timestamptz, timestamptz, text) TO authenticated;

-- ─── 8) edit_session — founder-only time correction ───────────────────
CREATE OR REPLACE FUNCTION public.edit_session(
  p_session_id  uuid,
  p_started_at  timestamptz,
  p_ended_at    timestamptz,
  p_reason      text
)
RETURNS public.work_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before public.work_sessions;
  v_after  public.work_sessions;
BEGIN
  IF NOT public.is_founder() THEN
    RAISE EXCEPTION 'Only founders can edit sessions';
  END IF;
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Reason is required for edits';
  END IF;
  IF p_ended_at <= p_started_at THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;

  SELECT * INTO v_before FROM public.work_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  UPDATE public.work_sessions
     SET started_at = p_started_at,
         ended_at   = p_ended_at,
         source     = 'admin_edit',
         ended_reason = 'admin_edit'
   WHERE id = p_session_id
  RETURNING * INTO v_after;

  INSERT INTO public.pulse_adjustments
    (session_id, target_user_id, edited_by, action, reason, before_state, after_state)
  VALUES
    (p_session_id, v_before.user_id, auth.uid(), 'edit', TRIM(p_reason), to_jsonb(v_before), to_jsonb(v_after));

  RETURN v_after;
END;
$$;
GRANT EXECUTE ON FUNCTION public.edit_session(uuid, timestamptz, timestamptz, text) TO authenticated;

-- ─── 9) delete_session — founder-only ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_session_admin(
  p_session_id uuid,
  p_reason     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before public.work_sessions;
BEGIN
  IF NOT public.is_founder() THEN
    RAISE EXCEPTION 'Only founders can delete sessions';
  END IF;
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Reason is required for deletes';
  END IF;

  SELECT * INTO v_before FROM public.work_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.pulse_adjustments
    (session_id, target_user_id, edited_by, action, reason, before_state)
  VALUES
    (NULL, v_before.user_id, auth.uid(), 'delete', TRIM(p_reason), to_jsonb(v_before));

  DELETE FROM public.work_sessions WHERE id = p_session_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_session_admin(uuid, text) TO authenticated;

-- ─── 10) reap_idle_sessions — housekeeping sweep ──────────────────────
-- Called periodically (e.g., every 5 min) from the client or a cron.
-- Any open session with no activity in 15 min gets auto-ended.
-- NOTE: "activity" is approximated by the session's own updated_at —
-- useClock hook heartbeats that column every minute while active.
CREATE OR REPLACE FUNCTION public.reap_idle_sessions(
  p_idle_minutes integer DEFAULT 15
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reaped integer;
BEGIN
  WITH reaped AS (
    UPDATE public.work_sessions
       SET ended_at = updated_at,
           ended_reason = 'idle_timeout'
     WHERE ended_at IS NULL
       AND updated_at < now() - (p_idle_minutes || ' minutes')::interval
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_reaped FROM reaped;

  RETURN v_reaped;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reap_idle_sessions(integer) TO authenticated;

-- ─── 11) heartbeat — bumps updated_at on the current user's open session
CREATE OR REPLACE FUNCTION public.pulse_heartbeat()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.work_sessions
     SET updated_at = now()
   WHERE user_id = auth.uid() AND ended_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.pulse_heartbeat() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 12) v_pulse_live_now — who's currently on the clock ──────────────
CREATE OR REPLACE VIEW public.v_pulse_live_now AS
SELECT
  ws.id              AS session_id,
  ws.user_id,
  ws.started_at,
  EXTRACT(EPOCH FROM (now() - ws.started_at))::int AS running_seconds,
  p.full_name,
  p.email,
  p.role,
  p.department,
  p.avatar_url
FROM public.work_sessions ws
JOIN public.profiles p ON p.id = ws.user_id
WHERE ws.ended_at IS NULL
  AND COALESCE(p.role, 'customer') <> 'customer'
ORDER BY ws.started_at ASC;

GRANT SELECT ON public.v_pulse_live_now TO authenticated;

-- ─── 13) v_pulse_weekly — current week per user ───────────────────────
-- ISO week (Mon-Sun). Uses date_trunc('week', ...) which starts on Monday.
CREATE OR REPLACE VIEW public.v_pulse_weekly AS
WITH week_bounds AS (
  SELECT date_trunc('week', now()) AS week_start,
         date_trunc('week', now()) + INTERVAL '7 days' AS week_end
),
team AS (
  SELECT id, full_name, email, role, department, avatar_url
  FROM public.profiles
  WHERE COALESCE(role, 'customer') <> 'customer'
)
SELECT
  t.id AS user_id,
  t.full_name, t.email, t.role, t.department, t.avatar_url,
  COALESCE(SUM(
    CASE WHEN ws.ended_at IS NULL
         THEN EXTRACT(EPOCH FROM (now() - GREATEST(ws.started_at, wb.week_start)))
         ELSE EXTRACT(EPOCH FROM (LEAST(ws.ended_at, wb.week_end) - GREATEST(ws.started_at, wb.week_start)))
    END
  ), 0)::int AS weekly_seconds
FROM team t
CROSS JOIN week_bounds wb
LEFT JOIN public.work_sessions ws
       ON ws.user_id = t.id
      AND ws.started_at < wb.week_end
      AND COALESCE(ws.ended_at, now()) > wb.week_start
GROUP BY t.id, t.full_name, t.email, t.role, t.department, t.avatar_url;

GRANT SELECT ON public.v_pulse_weekly TO authenticated;

-- ─── 14) v_pulse_week_daily — 7-bar breakdown for sparkline ───────────
CREATE OR REPLACE VIEW public.v_pulse_week_daily AS
WITH week_bounds AS (
  SELECT date_trunc('week', now()) AS week_start
),
days AS (
  SELECT generate_series(0, 6) AS offset_days
),
team AS (
  SELECT id FROM public.profiles WHERE COALESCE(role, 'customer') <> 'customer'
)
SELECT
  t.id AS user_id,
  d.offset_days AS day_index,                 -- 0=Mon, 6=Sun
  wb.week_start + (d.offset_days || ' days')::interval AS day_start,
  COALESCE(SUM(
    CASE WHEN ws.ended_at IS NULL
         THEN EXTRACT(EPOCH FROM (
           LEAST(now(), wb.week_start + ((d.offset_days + 1) || ' days')::interval)
           - GREATEST(ws.started_at, wb.week_start + (d.offset_days || ' days')::interval)
         ))
         ELSE EXTRACT(EPOCH FROM (
           LEAST(ws.ended_at, wb.week_start + ((d.offset_days + 1) || ' days')::interval)
           - GREATEST(ws.started_at, wb.week_start + (d.offset_days || ' days')::interval)
         ))
    END
  ), 0)::int AS day_seconds
FROM team t
CROSS JOIN week_bounds wb
CROSS JOIN days d
LEFT JOIN public.work_sessions ws
       ON ws.user_id = t.id
      AND ws.started_at < wb.week_start + ((d.offset_days + 1) || ' days')::interval
      AND COALESCE(ws.ended_at, now()) > wb.week_start + (d.offset_days || ' days')::interval
GROUP BY t.id, d.offset_days, wb.week_start;

GRANT SELECT ON public.v_pulse_week_daily TO authenticated;

-- ─── 15) v_pulse_all_time — MTD + TTD + streak ────────────────────────
CREATE OR REPLACE VIEW public.v_pulse_all_time AS
WITH team AS (
  SELECT id, full_name, email, role, department, avatar_url
  FROM public.profiles
  WHERE COALESCE(role, 'customer') <> 'customer'
),
-- Rollup totals
totals AS (
  SELECT
    ws.user_id,
    COALESCE(SUM(
      CASE WHEN ws.started_at >= date_trunc('month', now())
           THEN COALESCE(ws.duration_seconds,
                EXTRACT(EPOCH FROM (COALESCE(ws.ended_at, now()) - ws.started_at))::int)
           ELSE 0
      END
    ), 0)::int AS mtd_seconds,
    COALESCE(SUM(
      COALESCE(ws.duration_seconds,
               EXTRACT(EPOCH FROM (COALESCE(ws.ended_at, now()) - ws.started_at))::int)
    ), 0)::int AS ttd_seconds
  FROM public.work_sessions ws
  GROUP BY ws.user_id
),
-- Streak calculation: distinct days with sessions, consecutive backwards from today
days_active AS (
  SELECT DISTINCT user_id, date_trunc('day', started_at)::date AS d
  FROM public.work_sessions
),
streaks AS (
  SELECT
    t.id AS user_id,
    (
      WITH run AS (
        SELECT gs.n,
               EXISTS (SELECT 1 FROM days_active da
                       WHERE da.user_id = t.id AND da.d = (current_date - gs.n)) AS has_day
        FROM generate_series(0, 365) gs(n)
      ),
      first_gap AS (
        SELECT MIN(n) AS first_missing FROM run WHERE has_day = false
      )
      SELECT COALESCE((SELECT first_missing FROM first_gap), 366)
    )::int AS current_streak
  FROM team t
)
SELECT
  t.id AS user_id,
  t.full_name, t.email, t.role, t.department, t.avatar_url,
  COALESCE(tot.mtd_seconds, 0) AS mtd_seconds,
  COALESCE(tot.ttd_seconds, 0) AS ttd_seconds,
  COALESCE(s.current_streak, 0) AS current_streak,
  CASE
    WHEN COALESCE(tot.ttd_seconds, 0) >= 1000 * 3600 THEN 'legend'
    WHEN COALESCE(tot.ttd_seconds, 0) >=  500 * 3600 THEN 'vet'
    WHEN COALESCE(tot.ttd_seconds, 0) >=  200 * 3600 THEN 'operator'
    WHEN COALESCE(tot.ttd_seconds, 0) >=   40 * 3600 THEN 'regular'
    ELSE 'rookie'
  END AS tier,
  LOWER(COALESCE(t.email, '')) IN (
    'ryan@liftori.ai', 'mike@liftori.ai',
    'rhinomarch78@gmail.com', '4sherpanation@gmail.com'
  ) AS is_founder
FROM team t
LEFT JOIN totals  tot ON tot.user_id = t.id
LEFT JOIN streaks s   ON s.user_id   = t.id;

GRANT SELECT ON public.v_pulse_all_time TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- DONE. Verify:
--   SELECT * FROM public.v_pulse_live_now;
--   SELECT * FROM public.v_pulse_weekly ORDER BY weekly_seconds DESC;
--   SELECT * FROM public.v_pulse_all_time ORDER BY ttd_seconds DESC;
-- ═══════════════════════════════════════════════════════════════════════
