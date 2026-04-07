-- =============================================================
-- Liftori Admin — Finance Hub + Communications Hub
-- Migration: 20260406_finance_comms.sql
-- Apply via: Supabase Dashboard > SQL Editor
-- =============================================================


-- ================================================================
-- FINANCE HUB TABLES
-- ================================================================

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS finance_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  account_type text NOT NULL CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','INCOME','COGS','EXPENSE')),
  sub_type text,
  parent_account_id uuid REFERENCES finance_accounts(id),
  is_active boolean DEFAULT true,
  is_system boolean DEFAULT false,
  is_header boolean DEFAULT false,
  current_balance numeric(15,2) DEFAULT 0,
  normal_balance text DEFAULT 'debit' CHECK (normal_balance IN ('debit','credit')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Journal Entries (double-entry ledger)
CREATE TABLE IF NOT EXISTS finance_journal_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_number text UNIQUE,
  reference text,
  transaction_date date NOT NULL,
  entry_date timestamptz DEFAULT now(),
  status text DEFAULT 'draft' CHECK (status IN ('draft','pending','posted','rejected','reversed')),
  source_type text,
  source_id uuid,
  is_reversal boolean DEFAULT false,
  reverses_entry_id uuid,
  reversed_by_entry_id uuid,
  description text NOT NULL,
  lines jsonb DEFAULT '[]',
  total_debits numeric(15,2) DEFAULT 0,
  total_credits numeric(15,2) DEFAULT 0,
  primary_project_id uuid,
  posted_at timestamptz,
  posted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Invoices (outgoing — customer billing)
CREATE TABLE IF NOT EXISTS finance_invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text UNIQUE,
  status text DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','posted','partial','paid','voided')),
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  customer_id uuid,
  customer_name text,
  project_id uuid,
  project_name text,
  subtotal numeric(15,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(15,2) DEFAULT 0,
  total_amount numeric(15,2) DEFAULT 0,
  amount_paid numeric(15,2) DEFAULT 0,
  balance_due numeric(15,2) DEFAULT 0,
  description text,
  memo text,
  line_items jsonb DEFAULT '[]',
  journal_entry_id uuid REFERENCES finance_journal_entries(id),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Payments (received from customers)
CREATE TABLE IF NOT EXISTS finance_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_number text UNIQUE,
  status text DEFAULT 'pending' CHECK (status IN ('pending','posted','voided')),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(15,2) NOT NULL,
  payment_method text DEFAULT 'check' CHECK (payment_method IN ('check','ach','wire','credit_card','cash','stripe','other')),
  reference_number text,
  customer_id uuid,
  customer_name text,
  invoice_id uuid REFERENCES finance_invoices(id),
  project_id uuid,
  project_name text,
  memo text,
  journal_entry_id uuid REFERENCES finance_journal_entries(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Expenses (internal spend)
CREATE TABLE IF NOT EXISTS finance_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_number text UNIQUE,
  status text DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','posted','voided')),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor_name text,
  category text,
  amount numeric(15,2) NOT NULL,
  account_id uuid REFERENCES finance_accounts(id),
  project_id uuid,
  project_name text,
  description text,
  receipt_url text,
  journal_entry_id uuid REFERENCES finance_journal_entries(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Bills (vendor invoices — money owed to vendors)
CREATE TABLE IF NOT EXISTS finance_bills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_number text UNIQUE,
  status text DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','posted','partial','paid','voided')),
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  vendor_name text,
  total_amount numeric(15,2) NOT NULL,
  amount_paid numeric(15,2) DEFAULT 0,
  balance_due numeric(15,2) DEFAULT 0,
  description text,
  memo text,
  line_items jsonb DEFAULT '[]',
  journal_entry_id uuid REFERENCES finance_journal_entries(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Commissions
CREATE TABLE IF NOT EXISTS finance_commissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','voided')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  agent_id uuid REFERENCES auth.users(id),
  agent_name text,
  gross_revenue numeric(15,2) DEFAULT 0,
  commission_rate numeric(6,4) DEFAULT 0,
  commission_amount numeric(15,2) DEFAULT 0,
  adjustments numeric(15,2) DEFAULT 0,
  net_commission numeric(15,2) DEFAULT 0,
  project_id uuid,
  project_name text,
  notes text,
  paid_at timestamptz,
  journal_entry_id uuid REFERENCES finance_journal_entries(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Budgets
CREATE TABLE IF NOT EXISTS finance_budgets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  fiscal_year integer NOT NULL,
  account_id uuid REFERENCES finance_accounts(id),
  account_name text,
  monthly_amounts jsonb DEFAULT '{}',
  annual_budget numeric(15,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Recurring Bills
CREATE TABLE IF NOT EXISTS finance_recurring_bills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  vendor_name text,
  amount numeric(15,2) NOT NULL,
  frequency text DEFAULT 'monthly' CHECK (frequency IN ('weekly','bi_weekly','monthly','quarterly','annually')),
  next_due_date date,
  account_id uuid REFERENCES finance_accounts(id),
  is_active boolean DEFAULT true,
  auto_post boolean DEFAULT false,
  last_generated_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);


-- ================================================================
-- FINANCE — ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_recurring_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_accounts_auth" ON finance_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "finance_journal_entries_auth" ON finance_journal_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "finance_invoices_auth" ON finance_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "finance_payments_auth" ON finance_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "finance_expenses_auth" ON finance_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "finance_bills_auth" ON finance_bills FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "finance_commissions_auth" ON finance_commissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "finance_budgets_auth" ON finance_budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "finance_recurring_bills_auth" ON finance_recurring_bills FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ================================================================
-- FINANCE — SEED DEFAULT CHART OF ACCOUNTS
-- ================================================================

INSERT INTO finance_accounts (code, name, account_type, sub_type, normal_balance, is_system) VALUES
  ('1000', 'Cash - Operating Account', 'ASSET', 'cash', 'debit', true),
  ('1010', 'Cash - Savings Account', 'ASSET', 'cash', 'debit', true),
  ('1100', 'Accounts Receivable', 'ASSET', 'accounts_receivable', 'debit', true),
  ('1200', 'Undeposited Funds', 'ASSET', 'undeposited_funds', 'debit', true),
  ('1500', 'Equipment', 'ASSET', 'fixed_asset', 'debit', false),
  ('2000', 'Accounts Payable', 'LIABILITY', 'accounts_payable', 'credit', true),
  ('2100', 'Credit Card Payable', 'LIABILITY', 'credit_card', 'credit', false),
  ('2200', 'Customer Deposits', 'LIABILITY', 'customer_deposits', 'credit', false),
  ('3000', 'Owner''s Equity', 'EQUITY', 'owners_equity', 'credit', true),
  ('3900', 'Retained Earnings', 'EQUITY', 'retained_earnings', 'credit', true),
  ('4000', 'Revenue - Services', 'INCOME', 'service_revenue', 'credit', true),
  ('4010', 'Revenue - Platform Sales', 'INCOME', 'sales_revenue', 'credit', false),
  ('4020', 'Revenue - Subscriptions', 'INCOME', 'sales_revenue', 'credit', false),
  ('4900', 'Other Income', 'INCOME', 'other_income', 'credit', false),
  ('5000', 'Subcontractors', 'COGS', 'subcontractors', 'debit', false),
  ('5100', 'Materials', 'COGS', 'materials', 'debit', false),
  ('6000', 'Payroll Expense', 'EXPENSE', 'payroll_expense', 'debit', false),
  ('6100', 'Marketing & Advertising', 'EXPENSE', 'marketing', 'debit', false),
  ('6200', 'Software & Subscriptions', 'EXPENSE', 'office_admin', 'debit', false),
  ('6300', 'Office & Admin', 'EXPENSE', 'office_admin', 'debit', false),
  ('6400', 'Professional Services', 'EXPENSE', 'other_expense', 'debit', false),
  ('6500', 'Travel & Vehicle', 'EXPENSE', 'vehicle', 'debit', false),
  ('6900', 'Other Expense', 'EXPENSE', 'other_expense', 'debit', false)
ON CONFLICT (code) DO NOTHING;


-- ================================================================
-- COMMUNICATIONS HUB TABLES
-- ================================================================

-- Conversations (unified inbox threads)
CREATE TABLE IF NOT EXISTS comms_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  project_id uuid,
  project_name text,
  subject text,
  bucket text DEFAULT 'general' CHECK (bucket IN ('lead_intake','production','service','marketing','general')),
  status text DEFAULT 'open' CHECK (status IN ('open','waiting','closed')),
  channel_type text DEFAULT 'internal' CHECK (channel_type IN ('sms','email','facebook','instagram','internal','call')),
  assigned_user_id uuid REFERENCES auth.users(id),
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer DEFAULT 0,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS comms_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES comms_conversations(id) ON DELETE CASCADE,
  direction text DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound','system')),
  channel text DEFAULT 'internal' CHECK (channel IN ('sms','email','facebook','instagram','internal','call','voicemail')),
  body text NOT NULL,
  sender_id uuid REFERENCES auth.users(id),
  sender_name text,
  external_id text,
  read_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Channels (configured integrations)
CREATE TABLE IF NOT EXISTS comms_channels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  channel_type text NOT NULL CHECK (channel_type IN ('sms','email','facebook','instagram','internal')),
  config jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Message Templates
CREATE TABLE IF NOT EXISTS comms_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  channel_type text NOT NULL,
  subject text,
  body text NOT NULL,
  variables text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Automations
CREATE TABLE IF NOT EXISTS comms_automations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  trigger_type text NOT NULL,
  channel_type text NOT NULL,
  template_id uuid REFERENCES comms_templates(id),
  conditions jsonb DEFAULT '{}',
  is_active boolean DEFAULT false,
  run_count integer DEFAULT 0,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);


-- ================================================================
-- COMMUNICATIONS — ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE comms_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comms_conversations_auth" ON comms_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "comms_messages_auth" ON comms_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "comms_channels_auth" ON comms_channels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "comms_templates_auth" ON comms_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "comms_automations_auth" ON comms_automations FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ================================================================
-- INDEXES for performance
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_finance_invoices_status ON finance_invoices(status);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_customer ON finance_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_date ON finance_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_payments_date ON finance_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_date ON finance_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_journal_status ON finance_journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_finance_journal_date ON finance_journal_entries(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_comms_conversations_status ON comms_conversations(status);
CREATE INDEX IF NOT EXISTS idx_comms_conversations_last_msg ON comms_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_messages_conv ON comms_messages(conversation_id, created_at DESC);
