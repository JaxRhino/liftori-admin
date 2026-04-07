// =============================================================
// Finance Service Layer — Supabase backend
// Replaces FastAPI/MongoDB endpoints from Rhino-1 Finance Hub
// =============================================================
import { supabase } from './supabase';

function handleError(error, context) {
  console.error(`[Finance] ${context}:`, error);
  throw error;
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

async function nextNumber(table, prefix, numberField) {
  const { count } = await supabase.from(table).select('id', { count: 'exact', head: true });
  return `${prefix}-${String((count || 0) + 1).padStart(4, '0')}`;
}

// ── DASHBOARD ────────────────────────────────────────────────
export async function fetchFinanceSummary() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

  const [invoicesRes, paymentsRes, expensesRes, billsRes, pendingJERes] = await Promise.all([
    supabase.from('finance_invoices').select('status, total_amount, amount_paid, balance_due, invoice_date, due_date'),
    supabase.from('finance_payments').select('amount, payment_date').eq('status', 'posted'),
    supabase.from('finance_expenses').select('amount, expense_date'),
    supabase.from('finance_bills').select('status, total_amount, balance_due'),
    supabase.from('finance_journal_entries').select('id').eq('status', 'pending'),
  ]);

  const invoices = invoicesRes.data || [];
  const payments = paymentsRes.data || [];
  const expenses = expensesRes.data || [];
  const bills = billsRes.data || [];

  const totalAR = invoices
    .filter(i => !['paid', 'voided'].includes(i.status))
    .reduce((s, i) => s + (i.balance_due || 0), 0);
  const overdueAR = invoices
    .filter(i => !['paid', 'voided'].includes(i.status) && i.due_date && new Date(i.due_date) < now)
    .reduce((s, i) => s + (i.balance_due || 0), 0);

  const mtdRevenue = payments
    .filter(p => p.payment_date >= monthStart)
    .reduce((s, p) => s + (p.amount || 0), 0);
  const ytdRevenue = payments
    .filter(p => p.payment_date >= yearStart)
    .reduce((s, p) => s + (p.amount || 0), 0);
  const mtdExpenses = expenses
    .filter(e => e.expense_date >= monthStart)
    .reduce((s, e) => s + (e.amount || 0), 0);
  const openBills = bills
    .filter(b => !['paid', 'voided'].includes(b.status))
    .reduce((s, b) => s + (b.balance_due || 0), 0);

  return {
    accounts_receivable: { total: totalAR, overdue: overdueAR },
    revenue: { mtd: mtdRevenue, ytd: ytdRevenue },
    expenses: { mtd: mtdExpenses },
    accounts_payable: { total: openBills },
    pending_approvals: (pendingJERes.data || []).length,
    invoice_counts: {
      draft: invoices.filter(i => i.status === 'draft').length,
      open: invoices.filter(i => ['approved', 'posted', 'partial'].includes(i.status)).length,
      paid: invoices.filter(i => i.status === 'paid').length,
    },
  };
}

// ── CHART OF ACCOUNTS ────────────────────────────────────────
export async function fetchAccounts(includeInactive = false) {
  let q = supabase.from('finance_accounts').select('*').order('code');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) handleError(error, 'fetchAccounts');
  return data || [];
}

export async function createAccount(account) {
  const userId = await currentUserId();
  const { data, error } = await supabase.from('finance_accounts')
    .insert({ ...account, created_by: userId }).select().single();
  if (error) handleError(error, 'createAccount');
  return data;
}

export async function updateAccount(id, updates) {
  const { data, error } = await supabase.from('finance_accounts')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateAccount');
  return data;
}

export async function deleteAccount(id) {
  const { error } = await supabase.from('finance_accounts').delete().eq('id', id);
  if (error) handleError(error, 'deleteAccount');
}

// ── JOURNAL ENTRIES ─────────────────────────────────────────
export async function fetchJournalEntries({ status, limit = 50, offset = 0 } = {}) {
  let q = supabase.from('finance_journal_entries')
    .select('*', { count: 'exact' })
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error, count } = await q;
  if (error) handleError(error, 'fetchJournalEntries');
  return { data: data || [], count: count || 0 };
}

export async function createJournalEntry(entry) {
  const userId = await currentUserId();
  const entryNumber = await nextNumber('finance_journal_entries', 'JE');
  const { data, error } = await supabase.from('finance_journal_entries')
    .insert({ ...entry, entry_number: entryNumber, created_by: userId }).select().single();
  if (error) handleError(error, 'createJournalEntry');
  return data;
}

export async function updateJournalEntry(id, updates) {
  const { data, error } = await supabase.from('finance_journal_entries')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateJournalEntry');
  return data;
}

export async function postJournalEntry(id) {
  const userId = await currentUserId();
  return updateJournalEntry(id, {
    status: 'posted',
    posted_at: new Date().toISOString(),
    posted_by: userId,
  });
}

export async function deleteJournalEntry(id) {
  const { error } = await supabase.from('finance_journal_entries').delete().eq('id', id);
  if (error) handleError(error, 'deleteJournalEntry');
}

// ── INVOICES ─────────────────────────────────────────────────
export async function fetchInvoices({ status, search, limit = 50, offset = 0 } = {}) {
  let q = supabase.from('finance_invoices')
    .select('*', { count: 'exact' })
    .order('invoice_date', { ascending: false })
    .range(offset, offset + limit - 1);
  if (status && status !== 'all') q = q.eq('status', status);
  if (search) q = q.or(`invoice_number.ilike.%${search}%,customer_name.ilike.%${search}%,project_name.ilike.%${search}%`);
  const { data, error, count } = await q;
  if (error) handleError(error, 'fetchInvoices');
  return { data: data || [], count: count || 0 };
}

export async function createInvoice(invoice) {
  const userId = await currentUserId();
  const invoiceNumber = await nextNumber('finance_invoices', 'INV');
  const { data, error } = await supabase.from('finance_invoices')
    .insert({ ...invoice, invoice_number: invoiceNumber, created_by: userId }).select().single();
  if (error) handleError(error, 'createInvoice');
  return data;
}

export async function updateInvoice(id, updates) {
  const { data, error } = await supabase.from('finance_invoices')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateInvoice');
  return data;
}

export async function voidInvoice(id, reason = '') {
  return updateInvoice(id, {
    status: 'voided',
    voided_at: new Date().toISOString(),
    void_reason: reason,
  });
}

export async function deleteInvoice(id) {
  const { error } = await supabase.from('finance_invoices').delete().eq('id', id);
  if (error) handleError(error, 'deleteInvoice');
}

// ── PAYMENTS ─────────────────────────────────────────────────
export async function fetchPayments({ search, limit = 50, offset = 0 } = {}) {
  let q = supabase.from('finance_payments')
    .select('*', { count: 'exact' })
    .order('payment_date', { ascending: false })
    .range(offset, offset + limit - 1);
  if (search) q = q.or(`payment_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
  const { data, error, count } = await q;
  if (error) handleError(error, 'fetchPayments');
  return { data: data || [], count: count || 0 };
}

export async function createPayment(payment) {
  const userId = await currentUserId();
  const paymentNumber = await nextNumber('finance_payments', 'PMT');
  const { data, error } = await supabase.from('finance_payments')
    .insert({ ...payment, payment_number: paymentNumber, created_by: userId }).select().single();
  if (error) handleError(error, 'createPayment');

  // Update linked invoice balance
  if (payment.invoice_id && data) {
    const { data: inv } = await supabase.from('finance_invoices')
      .select('total_amount, amount_paid').eq('id', payment.invoice_id).single();
    if (inv) {
      const newPaid = (inv.amount_paid || 0) + payment.amount;
      const balanceDue = Math.max(0, (inv.total_amount || 0) - newPaid);
      await supabase.from('finance_invoices').update({
        amount_paid: newPaid,
        balance_due: balanceDue,
        status: balanceDue <= 0 ? 'paid' : 'partial',
        updated_at: new Date().toISOString(),
      }).eq('id', payment.invoice_id);
    }
  }
  return data;
}

export async function deletePayment(id) {
  const { error } = await supabase.from('finance_payments').delete().eq('id', id);
  if (error) handleError(error, 'deletePayment');
}

// ── EXPENSES ─────────────────────────────────────────────────
export async function fetchExpenses({ search, limit = 50, offset = 0 } = {}) {
  let q = supabase.from('finance_expenses')
    .select('*', { count: 'exact' })
    .order('expense_date', { ascending: false })
    .range(offset, offset + limit - 1);
  if (search) q = q.or(`vendor_name.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`);
  const { data, error, count } = await q;
  if (error) handleError(error, 'fetchExpenses');
  return { data: data || [], count: count || 0 };
}

export async function createExpense(expense) {
  const userId = await currentUserId();
  const expenseNumber = await nextNumber('finance_expenses', 'EXP');
  const { data, error } = await supabase.from('finance_expenses')
    .insert({ ...expense, expense_number: expenseNumber, created_by: userId }).select().single();
  if (error) handleError(error, 'createExpense');
  return data;
}

export async function updateExpense(id, updates) {
  const { data, error } = await supabase.from('finance_expenses')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateExpense');
  return data;
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('finance_expenses').delete().eq('id', id);
  if (error) handleError(error, 'deleteExpense');
}

// ── COMMISSIONS ──────────────────────────────────────────────
export async function fetchCommissions({ status, limit = 50, offset = 0 } = {}) {
  let q = supabase.from('finance_commissions')
    .select('*', { count: 'exact' })
    .order('period_end', { ascending: false })
    .range(offset, offset + limit - 1);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error, count } = await q;
  if (error) handleError(error, 'fetchCommissions');
  return { data: data || [], count: count || 0 };
}

export async function createCommission(commission) {
  const userId = await currentUserId();
  const net = (commission.commission_amount || 0) + (commission.adjustments || 0);
  const { data, error } = await supabase.from('finance_commissions')
    .insert({ ...commission, net_commission: net, created_by: userId }).select().single();
  if (error) handleError(error, 'createCommission');
  return data;
}

export async function updateCommission(id, updates) {
  const { data, error } = await supabase.from('finance_commissions')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateCommission');
  return data;
}

export async function deleteCommission(id) {
  const { error } = await supabase.from('finance_commissions').delete().eq('id', id);
  if (error) handleError(error, 'deleteCommission');
}

// ── REPORTS ──────────────────────────────────────────────────
export async function fetchProfitLoss(startDate, endDate) {
  const [revenueRes, expenseRes] = await Promise.all([
    supabase.from('finance_invoices').select('total_amount').eq('status', 'paid')
      .gte('invoice_date', startDate).lte('invoice_date', endDate),
    supabase.from('finance_expenses').select('amount, category')
      .gte('expense_date', startDate).lte('expense_date', endDate),
  ]);

  const revenue = (revenueRes.data || []).reduce((s, r) => s + (r.total_amount || 0), 0);
  const expenses = expenseRes.data || [];
  const cogs = expenses.filter(e => ['subcontractors', 'materials', 'labor'].includes(e.category))
    .reduce((s, e) => s + (e.amount || 0), 0);
  const opex = expenses.filter(e => !['subcontractors', 'materials', 'labor'].includes(e.category))
    .reduce((s, e) => s + (e.amount || 0), 0);
  const grossProfit = revenue - cogs;
  const netIncome = grossProfit - opex;

  return {
    revenue, cogs, gross_profit: grossProfit,
    gross_margin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    operating_expenses: opex, net_income: netIncome,
    net_margin: revenue > 0 ? (netIncome / revenue) * 100 : 0,
    period: { start: startDate, end: endDate },
  };
}

export async function fetchAgingReport() {
  const now = new Date();
  const { data, error } = await supabase.from('finance_invoices')
    .select('id, invoice_number, customer_name, total_amount, amount_paid, balance_due, due_date, invoice_date')
    .not('status', 'in', '(paid,voided)').gt('balance_due', 0).order('due_date');
  if (error) handleError(error, 'fetchAgingReport');

  const buckets = { current: [], days_1_30: [], days_31_60: [], days_61_90: [], over_90: [] };
  (data || []).forEach(inv => {
    const days = Math.floor((now - new Date(inv.due_date)) / 86400000);
    if (days <= 0) buckets.current.push(inv);
    else if (days <= 30) buckets.days_1_30.push(inv);
    else if (days <= 60) buckets.days_31_60.push(inv);
    else if (days <= 90) buckets.days_61_90.push(inv);
    else buckets.over_90.push(inv);
  });
  return buckets;
}