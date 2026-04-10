-- ══════════════════════════════════════════════════════════════════════════════
-- Team RBAC Migration — Roles, Invites, Onboarding, Activity Log
-- Date: 2026-04-09
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Team Roles table — stores role definitions with granular permissions
CREATE TABLE IF NOT EXISTS team_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT 'bg-sky-500',
  is_system BOOLEAN DEFAULT false,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Team Invites table — pending invitations
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'Sales Rep',
  invited_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Team Activity Log — audit trail for team management actions
CREATE TABLE IF NOT EXISTS team_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_name TEXT,
  action TEXT NOT NULL,
  target_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Team Onboarding — tracks full onboarding process per team member
CREATE TABLE IF NOT EXISTS team_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  personal_email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  address TEXT,
  start_date DATE,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  checklist JSONB DEFAULT '{}',
  initiated_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Add status and onboarding_complete columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN status TEXT DEFAULT 'active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'onboarding_complete'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_complete BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'personal_email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN personal_email TEXT;
  END IF;
END $$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_team_roles_name ON team_roles(name);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON team_invites(status);
CREATE INDEX IF NOT EXISTS idx_team_activity_log_created ON team_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_activity_log_actor ON team_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_team_onboarding_email ON team_onboarding(email);
CREATE INDEX IF NOT EXISTS idx_team_onboarding_status ON team_onboarding(status);

-- 7. Seed default system roles (updated to match Liftori team structure)
INSERT INTO team_roles (name, description, color, is_system, permissions) VALUES
  ('CEO', 'Executive leadership — full platform access, strategic oversight, final approvals', 'bg-purple-500', true,
    '{"dashboard.view":true,"call_center.access":true,"sales.lead_hunter":true,"sales.customers":true,"sales.pipeline":true,"sales.estimates":true,"sales.agreements":true,"sales.commissions":true,"sales.waitlist":true,"projects.view":true,"projects.manage":true,"platforms.manage":true,"marketing.dashboard":true,"marketing.campaigns":true,"marketing.content":true,"comms.hub":true,"comms.chat":true,"comms.rally":true,"comms.support":true,"eos.dashboard":true,"eos.scorecard":true,"eos.rocks":true,"eos.meetings":true,"eos.issues":true,"finance.dashboard":true,"finance.invoices":true,"finance.reports":true,"tools.tasks":true,"tools.notes":true,"tools.calendar":true,"ops.dashboard":true,"ops.team":true,"ops.wizard":true,"ops.plans":true,"ops.discount_codes":true,"system.settings":true,"system.billing":true,"system.integrations":true}'::jsonb),
  ('Chief Developer', 'Technical leadership — full platform access, codebase authority, infrastructure management', 'bg-red-500', true,
    '{"dashboard.view":true,"call_center.access":true,"sales.lead_hunter":true,"sales.customers":true,"sales.pipeline":true,"sales.estimates":true,"sales.agreements":true,"sales.commissions":true,"sales.waitlist":true,"projects.view":true,"projects.manage":true,"platforms.manage":true,"marketing.dashboard":true,"marketing.campaigns":true,"marketing.content":true,"comms.hub":true,"comms.chat":true,"comms.rally":true,"comms.support":true,"eos.dashboard":true,"eos.scorecard":true,"eos.rocks":true,"eos.meetings":true,"eos.issues":true,"finance.dashboard":true,"finance.invoices":true,"finance.reports":true,"tools.tasks":true,"tools.notes":true,"tools.calendar":true,"ops.dashboard":true,"ops.team":true,"ops.wizard":true,"ops.plans":true,"ops.discount_codes":true,"system.settings":true,"system.billing":true,"system.integrations":true}'::jsonb),
  ('Director of Sales', 'Sales leadership — manage sales team, pipeline oversight, commission structures, client strategy', 'bg-amber-500', true,
    '{"dashboard.view":true,"call_center.access":true,"sales.lead_hunter":true,"sales.customers":true,"sales.pipeline":true,"sales.estimates":true,"sales.agreements":true,"sales.commissions":true,"sales.waitlist":true,"projects.view":true,"projects.manage":true,"platforms.manage":true,"marketing.dashboard":true,"marketing.campaigns":true,"marketing.content":true,"comms.hub":true,"comms.chat":true,"comms.rally":true,"comms.support":true,"eos.dashboard":true,"eos.scorecard":true,"eos.rocks":true,"eos.meetings":true,"eos.issues":true,"tools.tasks":true,"tools.notes":true,"tools.calendar":true,"system.settings":true}'::jsonb),
  ('Sales Rep', 'Sales execution — Lead Hunter, pipeline, estimates, agreements, commissions', 'bg-sky-500', true,
    '{"dashboard.view":true,"call_center.access":true,"sales.lead_hunter":true,"sales.customers":true,"sales.pipeline":true,"sales.estimates":true,"sales.agreements":true,"sales.commissions":true,"sales.waitlist":true,"projects.view":true,"comms.hub":true,"comms.chat":true,"comms.rally":true,"eos.dashboard":true,"eos.scorecard":true,"eos.rocks":true,"eos.meetings":true,"eos.issues":true,"tools.tasks":true,"tools.notes":true,"tools.calendar":true,"system.settings":true}'::jsonb),
  ('Affiliate', 'External partner — referral tracking, commission visibility, limited platform access', 'bg-emerald-500', true,
    '{"dashboard.view":true,"sales.commissions":true,"comms.chat":true,"system.settings":true}'::jsonb),
  ('Platform Tester', 'QA and testing — access client platforms for testing, bug reporting, no admin settings', 'bg-pink-500', true,
    '{"dashboard.view":true,"projects.view":true,"platforms.manage":true,"comms.chat":true,"comms.rally":true,"comms.support":true,"tools.tasks":true,"tools.notes":true,"system.settings":true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 8. RLS Policies
ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_onboarding ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access to team_roles" ON team_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin full access to team_invites" ON team_invites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin full access to team_activity_log" ON team_activity_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin full access to team_onboarding" ON team_onboarding
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Team members can read their own onboarding record
CREATE POLICY "Members read own onboarding" ON team_onboarding
  FOR SELECT USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );
