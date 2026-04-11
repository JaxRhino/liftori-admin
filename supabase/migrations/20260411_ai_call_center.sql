-- ============================================================================
-- AI Call Center: Recordings, Callback Requests, Agent Enhancements
-- Date: 2026-04-11
-- ============================================================================

-- 1. Add recording columns to ai_conversations (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_conversations' AND column_name = 'recording_url') THEN
    ALTER TABLE ai_conversations ADD COLUMN recording_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_conversations' AND column_name = 'recording_sid') THEN
    ALTER TABLE ai_conversations ADD COLUMN recording_sid TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_conversations' AND column_name = 'recording_duration') THEN
    ALTER TABLE ai_conversations ADD COLUMN recording_duration INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_conversations' AND column_name = 'outcome') THEN
    ALTER TABLE ai_conversations ADD COLUMN outcome TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_conversations' AND column_name = 'summary') THEN
    ALTER TABLE ai_conversations ADD COLUMN summary TEXT;
  END IF;
END
$$;

-- 2. Create callback requests table (Speed to Lead queue)
CREATE TABLE IF NOT EXISTS cc_callback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company_name TEXT,
  reason TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'completed', 'expired')),
  source TEXT DEFAULT 'ai_call_center',
  call_sid TEXT,
  claimed_by UUID REFERENCES profiles(id),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast pending callback lookups
CREATE INDEX IF NOT EXISTS idx_callback_requests_status ON cc_callback_requests(status, urgency, created_at);
CREATE INDEX IF NOT EXISTS idx_callback_requests_created ON cc_callback_requests(created_at DESC);

-- 3. Add index on ai_conversations for dashboard queries
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created ON ai_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status ON ai_conversations(status);

-- 4. RLS policies for cc_callback_requests
ALTER TABLE cc_callback_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all callback requests
CREATE POLICY IF NOT EXISTS "callback_requests_select" ON cc_callback_requests
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to update (claim/complete)
CREATE POLICY IF NOT EXISTS "callback_requests_update" ON cc_callback_requests
  FOR UPDATE TO authenticated USING (true);

-- Allow service role to insert (from CF Worker)
CREATE POLICY IF NOT EXISTS "callback_requests_insert_service" ON cc_callback_requests
  FOR INSERT TO service_role WITH CHECK (true);

-- Allow anon to insert (CF Worker uses service key which bypasses RLS, but just in case)
CREATE POLICY IF NOT EXISTS "callback_requests_insert_anon" ON cc_callback_requests
  FOR INSERT TO anon WITH CHECK (true);
