-- ============================================================
-- COMMUNICATIONS HUB MIGRATION
-- Run this in Supabase Dashboard → SQL Editor
-- Project: qlerfkdyslndjbaltkwo
-- ============================================================

-- 1. Conversations (SMS/unified threads)
CREATE TABLE IF NOT EXISTS comms_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES profiles(id),
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  bucket TEXT NOT NULL DEFAULT 'general' CHECK (bucket IN ('lead_intake', 'production', 'service', 'marketing', 'general')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'closed')),
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email', 'chat')),
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES profiles(id),
  project_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Messages (individual messages in a conversation)
CREATE TABLE IF NOT EXISTS comms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES comms_conversations(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email', 'chat')),
  status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'received')),
  sent_by UUID REFERENCES profiles(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Channels (internal team communication channels)
CREATE TABLE IF NOT EXISTS comms_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  channel_type TEXT NOT NULL DEFAULT 'team' CHECK (channel_type IN ('team', 'client_dm', 'broadcast')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  members JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Templates (message templates for quick replies)
CREATE TABLE IF NOT EXISTS comms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('lead_intake', 'follow_up', 'appointment', 'payment', 'general', 'marketing')),
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email', 'both')),
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Automations (automated message sequences)
CREATE TABLE IF NOT EXISTS comms_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('new_lead', 'status_change', 'payment_received', 'project_milestone', 'scheduled', 'manual')),
  trigger_config JSONB DEFAULT '{}',
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT false,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comms_conversations_customer ON comms_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_comms_conversations_status ON comms_conversations(status);
CREATE INDEX IF NOT EXISTS idx_comms_conversations_bucket ON comms_conversations(bucket);
CREATE INDEX IF NOT EXISTS idx_comms_conversations_updated ON comms_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_messages_conversation ON comms_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_comms_messages_sent_at ON comms_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_templates_category ON comms_templates(category);
CREATE INDEX IF NOT EXISTS idx_comms_automations_active ON comms_automations(is_active);

-- RLS Policies (admin only)
ALTER TABLE comms_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access comms_conversations" ON comms_conversations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access comms_messages" ON comms_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access comms_channels" ON comms_channels FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access comms_templates" ON comms_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access comms_automations" ON comms_automations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed default templates
INSERT INTO comms_templates (name, body, category, channel) VALUES
  ('Welcome New Lead', 'Hi {{name}}! Thanks for reaching out to Liftori. I''m Ryan and I''d love to learn more about your project. When is a good time to chat?', 'lead_intake', 'sms'),
  ('Follow Up - No Response', 'Hi {{name}}, just following up on our previous conversation about your project. Still interested in connecting?', 'follow_up', 'sms'),
  ('Project Milestone', 'Great news, {{name}}! We''ve hit a milestone on your project. Here''s the update: {{milestone}}', 'appointment', 'sms'),
  ('Payment Received', 'Hi {{name}}, we''ve received your payment of {{amount}}. Thank you! Your project continues on schedule.', 'payment', 'sms')
ON CONFLICT DO NOTHING;
