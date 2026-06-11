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
// Postgres date columns reject empty-string values ("invalid input syntax for
// type date"). Form components commonly send '' for unfilled date fields.
// Coerce '' -> null on the well-known date keys before any insert/update.
const DATE_KEYS = [
  'invoice_date', 'due_date', 'payment_date', 'expense_date',
  'entry_date', 'voided_at', 'bill_date', 'date_of_service',
];
function sanitizeDates(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const k of DATE_KEYS) {
    if (out[k] === '') out[k] = null;
  }
  return out;
}

// Wave F2.6c: defensive column whitelist for finance_expenses.
// Form payloads sometimes carry project_name / project_id keys that don't
// exist on the schema. Stripping them here keeps the Supabase REST layer
// happy without forcing every form to drop them explicitly.
const EXPENSE_COLS = new Set([
  'description', 'category', 'amount', 'expense_date',
  'account_id', 'vendor_name', 'receipt_url', 'status', 'notes',
]);
function pickExpenseCols(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).filter(([k]) => EXPENSE_COLS.has(k)));
}

// Wave F2.7 schema sweep: defensive whitelists for every finance table
// create/update fn. Kills the class-of-bug we hit five times in F2.
const INVOICE_COLS = new Set([
  'invoice_number', 'customer_id', 'customer_name', 'project_id', 'project_name',
  'invoice_date', 'due_date', 'status', 'line_items', 'subtotal', 'tax_rate',
  'tax_amount', 'total_amount', 'amount_paid', 'balance_due', 'notes', 'terms',
  'voided_at', 'void_reason',
]);
const PAYMENT_COLS = new Set([
  'payment_number', 'invoice_id', 'customer_id', 'customer_name', 'amount',
  'payment_date', 'payment_method', 'reference_number', 'status', 'notes',
]);
const BILL_COLS = new Set([
  'bill_number', 'vendor_name', 'vendor_id', 'bill_date', 'due_date', 'status',
  'line_items', 'subtotal', 'tax_amount', 'total_amount', 'amount_paid',
  'balance_due', 'notes',
]);
const BUDGET_COLS = new Set([
  'name', 'description', 'fiscal_year', 'period_type', 'account_id',
  'category', 'budget_data', 'total_amount', 'is_active',
]);
const JOURNAL_ENTRY_COLS = new Set([
  'entry_number', 'reference', 'transaction_date', 'entry_date', 'status',
  'source_type', 'source_id', 'is_reversal', 'reverses_entry_id',
  'reversed_by_entry_id', 'description', 'total_debits', 'total_credits',
  'primary_project_id', 'primary_project_name', 'approval_record_id',
  'posted_at', 'posted_by',
]);
function pickCols(allowed, obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).filter(([k]) => allowed.has(k)));
}
const pickInvoiceCols = (o) => pickCols(INVOICE_COLS, o);
const pickPaymentCols = (o) => pickCols(PAYMENT_COLS, o);
const pickBillCols = (o) => pickCols(BILL_COLS, o);
const pickBudgetCols = (o) => pickCols(BUDGET_COLS, o);
const pickJournalEntryCols = (o) => pickCols(JOURNAL_ENTRY_COLS, o);

// Form components in the finance section commonly use `memo` and `description`
// keys that don't match Postgres column names on the finance_* tables. Map
// memo -> notes (preserves the user's typed text) and drop `description`
// (no top-level column for it; line items have their own `description` field
// inside the line_items jsonb).
function mapFormToSchema(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  // Fold memo -> notes when both keys are present. This is universal across
  // finance forms (invoice form sends memo; bills/payments map to notes too).
  if ('memo' in out) {
    if (out.memo && !out.notes) out.notes = out.memo;
    delete out.memo;
  }
  // Wave F2.7b: previously this also dropped `description` to handle the
  // invoice form (invoices have no description column). That was over-broad -
  // expenses, budgets, journal_entries all DO have description. The per-table
  // whitelists added in F2.7 (pickInvoiceCols et al.) now drop description
  // for tables that don't have it, so this delete is redundant and harmful
  // for tables that do.
  return out;
}


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
  // Wave F2.7: embed lines so the expand-view in JournalEntries.jsx populates.
  let q = supabase.from('finance_journal_entries')
    .select('*, lines:finance_journal_lines(*)', { count: 'exact' })
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
  const sanitized = mapFormToSchema(sanitizeDates(entry));
  // Wave F2.7: lines are a separate table (finance_journal_lines) - extract first,
  // whitelist the entry payload, insert entry, then bulk-insert lines.
  const lines = Array.isArray(sanitized.lines) ? sanitized.lines : [];
  const entryRow = pickJournalEntryCols(sanitized);
  const { data, error } = await supabase.from('finance_journal_entries')
    .insert({ ...entryRow, entry_number: entryNumber, created_by: userId }).select().single();
  if (error) handleError(error, 'createJournalEntry');
  if (lines.length > 0 && data) {
    const lineRows = lines.map(l => ({
      journal_entry_id: data.id,
      account_id: l.account_id || null,
      account_code: l.account_code || null,
      account_name: l.account_name || null,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      description: l.description || null,
      project_id: l.project_id || null,
      project_name: l.project_name || null,
      department: l.department || null,
    }));
    const { error: lineErr } = await supabase.from('finance_journal_lines').insert(lineRows);
    if (lineErr) handleError(lineErr, 'createJournalEntry.lines');
  }
  // Re-fetch with lines embedded so the caller gets a complete object
  return await fetchJournalEntry(data.id);
}

// Wave F2.7: single-entry fetch with lines embedded via FK join.
export async function fetchJournalEntry(id) {
  const { data, error } = await supabase.from('finance_journal_entries')
    .select('*, lines:finance_journal_lines(*)').eq('id', id).single();
  if (error) handleError(error, 'fetchJournalEntry');
  return data;
}

// Wave F2.7: polymorphic source -> journal cross-link.
// Returns posted/draft entries that reference this source row.
export async function fetchJournalEntriesForSource(sourceType, sourceId) {
  if (!sourceType || !sourceId) return [];
  const { data, error } = await supabase.from('finance_journal_entries')
    .select('id, entry_number, transaction_date, status, description, total_debits, total_credits')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .order('transaction_date', { ascending: false });
  if (error) handleError(error, 'fetchJournalEntriesForSource');
  return data || [];
}

export async function updateJournalEntry(id, updates) {
  const sanitized = pickJournalEntryCols(mapFormToSchema(sanitizeDates(updates)));
  const { data, error } = await supabase.from('finance_journal_entries')
    .update({ ...sanitized, updated_at: new Date().toISOString() }).eq('id', id).select().single();
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
  const sanitized = pickInvoiceCols(mapFormToSchema(sanitizeDates(invoice)));
  if (!sanitized.status) sanitized.status = 'draft';
  const { data, error } = await supabase.from('finance_invoices')
    .insert({ ...sanitized, invoice_number: invoiceNumber, created_by: userId }).select().single();
  if (error) handleError(error, 'createInvoice');
  return data;
}

export async function updateInvoice(id, updates) {
  const sanitized = pickInvoiceCols(mapFormToSchema(sanitizeDates(updates)));
  const { data, error } = await supabase.from('finance_invoices')
    .update({ ...sanitized, updated_at: new Date().toISOString() }).eq('id', id).select().single();
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
  payment = pickPaymentCols(mapFormToSchema(sanitizeDates(payment)));
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
  // Note: finance_expenses has no expense_number column (unlike finance_invoices
  // and finance_payments). Display layer derives a label from description/vendor.
  const cleaned = pickExpenseCols(mapFormToSchema(sanitizeDates(expense)));
  const { data, error } = await supabase.from('finance_expenses')
    .insert({ ...cleaned, created_by: userId }).select().single();
  if (error) handleError(error, 'createExpense');
  return data;
}

export async function updateExpense(id, updates) {
  const sanitized = pickExpenseCols(mapFormToSchema(sanitizeDates(updates)));
  const { data, error } = await supabase.from('finance_expenses')
    .update({ ...sanitized, updated_at: new Date().toISOString() }).eq('id', id).select().single();
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
// ── ALIAS ────────────────────────────────────────────────────
// AgingReport.jsx imports under the longer "fetchARAgingReport" name; the
// underlying logic lives in fetchAgingReport defined above. Alias so both
// names resolve to the same function.
export const fetchARAgingReport = fetchAgingReport;

// ── BILLS (AP) ───────────────────────────────────────────────
export async function fetchBills({ status, search, limit = 100 } = {}) {
  let q = supabase.from('finance_bills')
    .select('*')
    .order('bill_date', { ascending: false })
    .limit(limit);
  if (status && status !== 'all') q = q.eq('status', status);
  if (search) q = q.or(`bill_number.ilike.%${search}%,vendor_name.ilike.%${search}%`);
  const { data, error } = await q;
  if (error) handleError(error, 'fetchBills');
  return data || [];
}

export async function createBill(bill) {
  const userId = await currentUserId();
  const billNumber = await nextNumber('finance_bills', 'BILL');
  bill = pickBillCols(mapFormToSchema(sanitizeDates(bill)));
  const {
    vendor_name, vendor_id, bill_date, due_date, status = 'draft',
    line_items = [], subtotal = 0, tax_amount = 0, notes = '', total,
  } = bill;
  const total_amount = total ?? (Number(subtotal) + Number(tax_amount));
  const { data, error } = await supabase.from('finance_bills')
    .insert({
      bill_number: billNumber,
      vendor_name, vendor_id, bill_date, due_date, status,
      line_items, subtotal, tax_amount, total_amount,
      amount_paid: 0, balance_due: total_amount,
      notes, created_by: userId,
    })
    .select().single();
  if (error) handleError(error, 'createBill');
  return data;
}

export async function updateBill(id, updates) {
  const sanitized = pickBillCols(mapFormToSchema(sanitizeDates(updates)));
  const { data, error } = await supabase.from('finance_bills')
    .update({ ...sanitized, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) handleError(error, 'updateBill');
  return data;
}

export async function recordBillPayment(billId, amount) {
  // Reads current totals, increments amount_paid, decrements balance_due,
  // and flips status to 'paid' when the balance reaches zero (else 'partial').
  const { data: bill, error: e1 } = await supabase.from('finance_bills')
    .select('amount_paid, total_amount').eq('id', billId).single();
  if (e1) handleError(e1, 'recordBillPayment.fetch');
  const newPaid = Number(bill.amount_paid || 0) + Number(amount);
  const newBalance = Number(bill.total_amount || 0) - newPaid;
  const newStatus = newBalance <= 0 ? 'paid' : 'partial';
  const { data, error } = await supabase.from('finance_bills')
    .update({
      amount_paid: newPaid,
      balance_due: Math.max(0, newBalance),
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', billId).select().single();
  if (error) handleError(error, 'recordBillPayment.update');
  return data;
}

// ── BUDGETS ──────────────────────────────────────────────────
export async function fetchBudgets({ fiscalYear } = {}) {
  let q = supabase.from('finance_budgets')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (fiscalYear) q = q.eq('fiscal_year', fiscalYear);
  const { data, error } = await q;
  if (error) handleError(error, 'fetchBudgets');
  return data || [];
}

// Wave F2.6: enrich budgets with actual expense totals for variance display.
// Match expenses to budgets by category (case-insensitive trim) within the
// budget's fiscal_year date range. Returns same shape as fetchBudgets but
// with `actual_total` populated on each row.
export async function fetchBudgetVariance({ fiscalYear } = {}) {
  const year = fiscalYear || new Date().getFullYear();
  const [budgetsRes, expensesRes] = await Promise.all([
    supabase.from('finance_budgets')
      .select('*')
      .eq('is_active', true)
      .eq('fiscal_year', year)
      .order('total_amount', { ascending: false }),
    supabase.from('finance_expenses')
      .select('category, amount, status, expense_date')
      .gte('expense_date', `${year}-01-01`)
      .lte('expense_date', `${year}-12-31`),
  ]);
  if (budgetsRes.error) handleError(budgetsRes.error, 'fetchBudgetVariance.budgets');
  if (expensesRes.error) handleError(expensesRes.error, 'fetchBudgetVariance.expenses');

  // Sum expenses by lowercased+trimmed category; skip voided.
  const totalsByCat = (expensesRes.data || []).reduce((acc, e) => {
    if (e.status === 'voided') return acc;
    const key = (e.category || '').toLowerCase().trim();
    acc[key] = (acc[key] || 0) + Number(e.amount || 0);
    return acc;
  }, {});

  return (budgetsRes.data || []).map(b => ({
    ...b,
    actual_total: totalsByCat[(b.category || '').toLowerCase().trim()] || 0,
  }));
}

export async function createBudget(budget) {
  const userId = await currentUserId();
  const {
    account_id, account_name, fiscal_year, annual_total,
    monthly_amounts = {}, period_type = 'monthly',
    name, description = '', category = '',
  } = budget;
  // Derive a name when the caller hasn't supplied one — schema requires NOT NULL.
  const computedName = name || (account_name ? `${account_name} FY${fiscal_year}` : `Budget FY${fiscal_year}`);
  const { data, error } = await supabase.from('finance_budgets')
    .insert({
      name: computedName,
      description,
      fiscal_year,
      period_type,
      account_id,
      category: category || account_name || '',
      budget_data: monthly_amounts,
      total_amount: annual_total,
      is_active: true,
      created_by: userId,
    })
    .select().single();
  if (error) handleError(error, 'createBudget');
  return data;
}

export async function updateBudget(id, updates) {
  const sanitized = pickBudgetCols(mapFormToSchema(sanitizeDates(updates)));
  const { data, error } = await supabase.from('finance_budgets')
    .update({ ...sanitized, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) handleError(error, 'updateBudget');
  return data;
}

// ── INVOICE DETAIL FETCHERS (Wave F2.2) ──────────────────────
export async function fetchInvoice(id) {
  const { data, error } = await supabase.from('finance_invoices')
    .select('*').eq('id', id).single();
  if (error) handleError(error, 'fetchInvoice');
  return data;
}

export async function fetchPaymentsForInvoice(invoiceId) {
  const { data, error } = await supabase.from('finance_payments')
    .select('*').eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: false });
  if (error) handleError(error, 'fetchPaymentsForInvoice');
  return data || [];
}

// ── PAYMENT DETAIL FETCHER (Wave F2.3) ───────────────────────
export async function fetchPayment(id) {
  const { data, error } = await supabase.from('finance_payments')
    .select('*').eq('id', id).single();
  if (error) handleError(error, 'fetchPayment');
  return data;
}

// ── DASHBOARD WIDGET FETCHERS (Wave F2.4) ────────────────────
export async function fetchTopOverdueInvoices(limit = 5) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.from('finance_invoices')
    .select('id, invoice_number, customer_name, total_amount, balance_due, due_date, status')
    .not('status', 'in', '(paid,voided)')
    .gt('balance_due', 0)
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(limit);
  if (error) handleError(error, 'fetchTopOverdueInvoices');
  return data || [];
}

export async function fetchRecentFinanceActivity(limit = 8) {
  // Pull recent rows from invoices + payments + expenses, merge by created_at,
  // return a unified feed for the dashboard's Recent Activity widget.
  const [invRes, payRes, expRes] = await Promise.all([
    supabase.from('finance_invoices')
      .select('id, invoice_number, customer_name, total_amount, status, created_at')
      .order('created_at', { ascending: false }).limit(limit),
    supabase.from('finance_payments')
      .select('id, payment_number, customer_name, amount, invoice_id, created_at')
      .order('created_at', { ascending: false }).limit(limit),
    supabase.from('finance_expenses')
      .select('id, description, vendor_name, amount, created_at')
      .order('created_at', { ascending: false }).limit(limit),
  ]);
  if (invRes.error) handleError(invRes.error, 'fetchRecentFinanceActivity.invoices');
  if (payRes.error) handleError(payRes.error, 'fetchRecentFinanceActivity.payments');
  if (expRes.error) handleError(expRes.error, 'fetchRecentFinanceActivity.expenses');

  const items = [
    ...(invRes.data || []).map(r => ({
      kind: 'invoice', id: r.id, number: r.invoice_number, label: r.customer_name || 'Unknown',
      amount: r.total_amount, status: r.status, ts: r.created_at,
      to: `/admin/finance/invoices/${r.id}`,
    })),
    ...(payRes.data || []).map(r => ({
      kind: 'payment', id: r.id, number: r.payment_number, label: r.customer_name || 'Customer',
      amount: r.amount, status: 'recorded', ts: r.created_at,
      to: `/admin/finance/payments/${r.id}`,
    })),
    ...(expRes.data || []).map(r => ({
      kind: 'expense', id: r.id, number: r.description || 'Expense', label: r.vendor_name || 'expense',
      amount: r.amount, status: 'logged', ts: r.created_at,
      to: `/admin/finance/expenses`,
    })),
  ];
  items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  return items.slice(0, limit);
}
