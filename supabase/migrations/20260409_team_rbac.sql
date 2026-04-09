-- ══════════════════════════════════════════════════════════════════════════════
-- Team RBAC Migration — Roles, Invites, Activity Log
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
  role TEXT DEFAULT 'Sales',
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

-- 4. Add status column to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_team_roles_name ON team_roles(name);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON team_invites(status);
CREATE INDEX IF NOT EXISTS idx_team_activity_log_created ON team_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_activity_log_actor ON team_activity_log(actor_id);

-- 6. Seed default system roles
INSERT INTO team_roles (name, description, color, is_system, permissions) VALUES
  ('Admin', 'Full platform access — manage team, settings, billing, and all features', 'bg-red-500', true, '{
    "sales.lead_hunter": true, "sales.pipeline": true, "sales.estimates": true, "sales.agreements": true, "sales.commissions": true,
    "ops.dashboard": true, "ops.team": true, "ops.wizard": true, "ops.plans": true, "ops.discount_codes": true,
    "projects.view": true, "projects.manage": true, "clients.view": true, "clients.manage": true, "platforms.manage": true,
    "marketing.dashboard": true, "marketing.campaigns": true, "marketing.content": true,
    "finance.dashboard": true, "finance.invoices": true, "finance.reports": true,
    "comms.chat": true, "comms.rally": true, "comms.support": true,
    "system.settings": true, "system.billing": true, "system.integrations": true
  }'::jsonb),
  ('Manager', 'Manage projects, clients, and team members. No billing or system settings', 'bg-amber-500', true, '{
    "sales.lead_hunter": true, "sales.pipeline": true, "sales.estimates": true, "sales.agreements": true, "sales.commissions": true,
    "ops.dashboard": true, "ops.wizard": true,
    "projects.view": true, "projects.manage": true, "clients.view": true, "clients.manage": true, "platforms.manage": true,
    "marketing.dashboard": true, "marketing.campaigns": true, "marketing.content": true,
    "finance.dashboard": true, "finance.invoices": true,
    "comms.chat": true, "comms.rally": true, "comms.support": true,
    "system.settings": true
  }'::jsonb),
  ('Sales', 'Access Sales Hub, Lead Hunter, pipeline, estimates, and commissions', 'bg-sky-500', true, '{
    "sales.lead_hunter": true, "sales.pipeline": true, "sales.estimates": true, "sales.agreements": true, "sales.commissions": true,
    "projects.view": true, "clients.view": true,
    "comms.chat": true, "comms.rally": true
  }'::jsonb),
  ('Support', 'Access support tickets, client chat, and project updates', 'bg-emerald-500', true, '{
    "projects.view": true, "clients.view": true,
    "comms.chat": true, "comms.rally": true, "comms.support": true
  }'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 7. RLS Policies
ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_activity_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access for team management tables
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

-- Managers can read roles and activity, but not modify
CREATE POLICY "Manager read team_roles" ON team_roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

CREATE POLICY "Manager read team_activity_log" ON team_activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );
