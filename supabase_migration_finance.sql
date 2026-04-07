-- ============================================================
-- FINANCE HUB MIGRATION
-- Run this in Supabase Dashboard → SQL Editor
-- Project: qlerfkdyslndjbaltkwo
-- ============================================================

-- 1. Chart of Accounts
CREATE TABLE IF NOT EXISTS finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'COGS', 'EXPENSE')),
  subtype TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Journal Entries (double-entry ledger)
CREATE TABLE IF NOT EXISTS finance_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
  source_type TEXT CHECK (source_type IN ('invoice', 'payment', 'expense', 'bill', 'manual', 'reversal')),
  source_id UUID,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Journal Lines (debit/credit entries)
CREATE TABLE IF NOT EXISTS finance_journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES finance_journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES finance_accounts(id),
  description TEXT,
  debit NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Invoices (AR)
CREATE TABLE IF NOT EXISTS finance_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES profiles(id),
  project_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'partial', 'paid', 'voided')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(12,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  notes TEXT,
  line_items JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Payments (AR payments received)
CREATE TABLE IF NOT EXISTS finance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL UNIQUE,
  invoice_id UUID REFERENCES finance_invoices(id),
  customer_id UUID REFERENCES profiles(id),
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'credit_card', 'stripe', 'other')),
  reference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'voided')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Expenses
CREATE TABLE IF NOT EXISTS finance_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'credit_card',
  vendor TEXT,
  description TEXT,
  project_id UUID,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'posted')),
  submitted_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Bills (AP - vendor bills)
CREATE TABLE IF NOT EXISTS finance_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'partial', 'paid', 'voided')),
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(12,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  notes TEXT,
  line_items JSONB NOT NULL DEFAULT '[]',
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_frequency TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Commissions
CREATE TABLE IF NOT EXISTS finance_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'paid', 'rejected')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  gross_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  records JSONB NOT NULL DEFAULT '[]',
  submitted_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Budgets
CREATE TABLE IF NOT EXISTS finance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  account_id UUID REFERENCES finance_accounts(id),
  account_name TEXT NOT NULL,
  monthly_amounts JSONB NOT NULL DEFAULT '{}',
  annual_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  variance NUMERIC(12,2) GENERATED ALWAYS AS (annual_total - actual_total) STORED,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_finance_journal_entries_date ON finance_journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_finance_journal_entries_status ON finance_journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_finance_journal_lines_entry ON finance_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_customer ON finance_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_status ON finance_invoices(status);
CREATE INDEX IF NOT EXISTS idx_finance_payments_invoice ON finance_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_status ON finance_expenses(status);
CREATE INDEX IF NOT EXISTS idx_finance_bills_status ON finance_bills(status);
CREATE INDEX IF NOT EXISTS idx_finance_commissions_status ON finance_commissions(status);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_year ON finance_budgets(fiscal_year);

-- RLS Policies (admin only)
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;

-- Admin-only access for all finance tables
CREATE POLICY "Admin access finance_accounts" ON finance_accounts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access finance_journal_entries" ON finance_journal_entries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access finance_journal_lines" ON finance_journal_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access finance_invoices" ON finance_invoices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access finance_payments" ON finance_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access finance_expenses" ON finance_expenses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access finance_bills" ON finance_bills FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access finance_commissions" ON finance_commissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin access finance_budgets" ON finance_budgets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed default Chart of Accounts
INSERT INTO finance_accounts (code, name, type, subtype) VALUES
  ('1000', 'Cash & Bank', 'ASSET', 'current'),
  ('1100', 'Accounts Receivable', 'ASSET', 'current'),
  ('1200', 'Undeposited Funds', 'ASSET', 'current'),
  ('1500', 'Property & Equipment', 'ASSET', 'fixed'),
  ('2000', 'Accounts Payable', 'LIABILITY', 'current'),
  ('2100', 'Credit Cards Payable', 'LIABILITY', 'current'),
  ('2200', 'Deferred Revenue', 'LIABILITY', 'current'),
  ('3000', 'Owner Equity', 'EQUITY', NULL),
  ('3100', 'Retained Earnings', 'EQUITY', NULL),
  ('4000', 'Project Revenue', 'INCOME', NULL),
  ('4100', 'Managed Services Revenue', 'INCOME', NULL),
  ('4200', 'Affiliate Commission Revenue', 'INCOME', NULL),
  ('5000', 'Direct Labor', 'COGS', NULL),
  ('5100', 'Software & Tools (COGS)', 'COGS', NULL),
  ('6000', 'Salaries & Wages', 'EXPENSE', NULL),
  ('6100', 'Rent & Office', 'EXPENSE', NULL),
  ('6200', 'Marketing & Advertising', 'EXPENSE', NULL),
  ('6300', 'Software Subscriptions', 'EXPENSE', NULL),
  ('6400', 'Professional Services', 'EXPENSE', NULL),
  ('6500', 'Travel & Entertainment', 'EXPENSE', NULL),
  ('6600', 'Utilities', 'EXPENSE', NULL),
  ('6700', 'Insurance', 'EXPENSE', NULL),
  ('6800', 'Depreciation', 'EXPENSE', NULL),
  ('6900', 'Miscellaneous', 'EXPENSE', NULL)
ON CONFLICT (code) DO NOTHING;
