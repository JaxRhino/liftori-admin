-- 20260416_team_onboarding_unified_view.sql
-- Unifies manual team_onboarding records with auto-onboarded testers
-- so the /admin/team Onboarding tab shows BOTH.
--
-- Why: tester_enrollments + agreement_signatures were never being surfaced in
-- the Team Management page. Justin Trevisan completed full onboarding on
-- 2026-04-16 (NDA + contractor_1099 + contractor_role) but the tab was empty
-- because fetchOnboarding() only queried team_onboarding.
--
-- This view is READ-ONLY. The frontend gates toggling by the `source` column:
--   source = 'manual' → row comes from team_onboarding, toggles allowed
--   source = 'tester' → row derived from tester_enrollments, display-only

CREATE OR REPLACE VIEW public.v_team_onboarding_unified AS
-- Source 1: Manual onboardings (existing flow — Sales Rep, PM, etc.)
SELECT
  t.id,
  t.full_name,
  t.email,
  t.personal_email,
  t.phone,
  t.role,
  t.address,
  t.start_date,
  t.status,
  t.checklist,
  t.initiated_by,
  t.completed_at,
  t.created_at,
  t.updated_at,
  'manual'::text                      AS source,
  NULL::uuid                          AS user_id,
  NULL::uuid                          AS enrollment_id,
  NULL::timestamptz                   AS nda_signed_at,
  NULL::timestamptz                   AS contract_signed_at,
  NULL::timestamptz                   AS role_signed_at
FROM public.team_onboarding t

UNION ALL

-- Source 2: Tester program auto-onboardings
SELECT
  te.id                               AS id,
  COALESCE(p.full_name, p.email)      AS full_name,
  p.email                             AS email,
  NULL::text                          AS personal_email,
  NULL::text                          AS phone,
  'Tester'::text                      AS role,
  NULL::text                          AS address,
  te.enrolled_at::date                AS start_date,

  -- status: completed when all three agreement types are on file
  CASE WHEN sig.has_nda AND sig.has_1099 AND sig.has_role
       THEN 'completed' ELSE 'in_progress' END AS status,

  -- checklist: derive what we can from signatures + enrollment
  jsonb_build_object(
    'nda_sent',            true,
    'nda_signed',          sig.has_nda,
    'contract_sent',       true,
    'contract_signed',     sig.has_1099,
    'account_created',     true,
    'welcome_email',       true,
    'w9_received',         false,                          -- manual confirm still required
    'tools_provisioned',   true,
    'intro_meeting',       false,                          -- manual confirm still required
    'onboarding_complete', (sig.has_nda AND sig.has_1099 AND sig.has_role)
  ) AS checklist,

  te.enrolled_by                      AS initiated_by,
  CASE WHEN sig.has_nda AND sig.has_1099 AND sig.has_role
       THEN te.enrolled_at ELSE NULL END AS completed_at,
  te.enrolled_at                      AS created_at,
  te.updated_at                       AS updated_at,
  'tester'::text                      AS source,
  te.user_id                          AS user_id,
  te.id                               AS enrollment_id,
  sig.nda_signed_at,
  sig.contract_signed_at,
  sig.role_signed_at
FROM public.tester_enrollments te
JOIN public.profiles p ON p.id = te.user_id
LEFT JOIN LATERAL (
  SELECT
    BOOL_OR(agreement_type = 'nda')                                  AS has_nda,
    BOOL_OR(agreement_type IN ('1099', 'contractor_1099'))           AS has_1099,
    BOOL_OR(agreement_type = 'contractor_role')                      AS has_role,
    MAX(signed_at) FILTER (WHERE agreement_type = 'nda')             AS nda_signed_at,
    MAX(signed_at) FILTER (WHERE agreement_type IN ('1099', 'contractor_1099')) AS contract_signed_at,
    MAX(signed_at) FILTER (WHERE agreement_type = 'contractor_role') AS role_signed_at
  FROM public.agreement_signatures
  WHERE user_id = te.user_id
) sig ON true
WHERE te.ended_at IS NULL;

-- PostgREST needs explicit GRANT to surface the view via the REST API.
-- (Ryan's feedback memory: "new Supabase tables need explicit GRANT to
-- authenticated/anon, separate from RLS")
GRANT SELECT ON public.v_team_onboarding_unified TO authenticated;

-- Security invoker so the view respects the caller's RLS on underlying tables.
ALTER VIEW public.v_team_onboarding_unified SET (security_invoker = true);

COMMENT ON VIEW public.v_team_onboarding_unified IS
  'Unified onboarding feed for /admin/team → Onboarding tab. Combines manual team_onboarding rows with auto-derived rows from tester_enrollments + agreement_signatures. source column: manual|tester.';
