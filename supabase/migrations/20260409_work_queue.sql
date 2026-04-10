-- ============================================
-- Work Queue: Bug Reports, Feature Requests, Feedback
-- ============================================

CREATE TABLE IF NOT EXISTS work_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'feedback')),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix')),
  page TEXT,
  steps_to_reproduce TEXT,
  reported_by UUID REFERENCES auth.users(id),
  reporter_name TEXT,
  reporter_email TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_work_queue_status ON work_queue(status);
CREATE INDEX IF NOT EXISTS idx_work_queue_type ON work_queue(type);
CREATE INDEX IF NOT EXISTS idx_work_queue_priority ON work_queue(priority);
CREATE INDEX IF NOT EXISTS idx_work_queue_reported_by ON work_queue(reported_by);

-- RLS
ALTER TABLE work_queue ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_full_access_work_queue" ON work_queue
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Team members can insert (submit reports)
CREATE POLICY "team_insert_work_queue" ON work_queue
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'customer')
  );

-- Team members can read all items
CREATE POLICY "team_read_work_queue" ON work_queue
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'customer')
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_work_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_queue_updated_at
  BEFORE UPDATE ON work_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_work_queue_updated_at();
