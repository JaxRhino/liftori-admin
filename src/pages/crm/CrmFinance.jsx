import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from './_shared'

// ---------- formatters ----------
const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const todayISO = () => new Date().toISOString().slice(0, 10)
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const monthStart = () => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString() }

const genInvoiceNumber = () => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const seq = Math.floor(1000 + Math.random() * 8999)
  return `INV-${yyyy}-${mm}-${seq}`
}
const genBillNumber = () => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const seq = Math.floor(1000 + Math.random() * 8999)
  return `BILL-${yyyy}-${mm}-${seq}`
}
const genPaymentNumber = () => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const seq = Math.floor(1000 + Math.random() * 8999)
  return `PAY-${yyyy}-${mm}-${seq}`
}

// ---------- local primitives ----------
function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`bg-navy-800 border border-navy-700/60 rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40">{footer}</div>}
      </div>
    </div>
  )
}

function Drawer({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/50" />
      <div
        className="w-full sm:w-[560px] bg-navy-800 border-l border-navy-700/50 h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between sticky top-0 bg-navy-800 z-10">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40 sticky bottom-0">{footer}</div>}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder, rows, step }) {
  const base = 'w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan'
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      {rows ? (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={base} />
      ) : (
        <input type={type} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </label>
  )
}

function Select({ label, value, onChange, options, placeholder }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan"
      >
        <option value="">{placeholder || '-'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition ${
        active
          ? 'bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan'
          : 'bg-navy-900/40 border-navy-700/60 text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function TabBtn({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
        active
          ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40'
          : 'text-gray-400 hover:text-white border border-transparent'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy-700/60">{count}</span>
      )}
    </button>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="flex justify-between py-2 border-b border-navy-700/30 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-white text-right">{children}</span>
    </div>
  )
}

function StatusBadge({ status, kind }) {
  const map = {
    invoice: {
      draft: 'bg-gray-500/20 text-gray-300',
      sent: 'bg-sky-500/20 text-sky-300',
      partial: 'bg-amber-500/20 text-amber-300',
      paid: 'bg-emerald-500/20 text-emerald-300',
      overdue: 'bg-rose-500/20 text-rose-300',
      void: 'bg-navy-700/60 text-gray-400 line-through',
    },
    bill: {
      draft: 'bg-gray-500/20 text-gray-300',
      received: 'bg-sky-500/20 text-sky-300',
      scheduled: 'bg-amber-500/20 text-amber-300',
      paid: 'bg-emerald-500/20 text-emerald-300',
      overdue: 'bg-rose-500/20 text-rose-300',
      void: 'bg-navy-700/60 text-gray-400 line-through',
    },
    payment: {
      pending: 'bg-amber-500/20 text-amber-300',
      completed: 'bg-emerald-500/20 text-emerald-300',
      failed: 'bg-rose-500/20 text-rose-300',
      refunded: 'bg-sky-500/20 text-sky-300',
    },
    expense: {
      pending: 'bg-amber-500/20 text-amber-300',
      approved: 'bg-sky-500/20 text-sky-300',
      paid: 'bg-emerald-500/20 text-emerald-300',
      rejected: 'bg-rose-500/20 text-rose-300',
    },
  }
  const cls = (map[kind] && map[kind][status]) || 'bg-navy-700/60 text-gray-300'
  return <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${cls}`}>{status}</span>
}

// ---------- enums ----------
const INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void']
const BILL_STATUSES = ['draft', 'received', 'scheduled', 'paid', 'overdue', 'void']
const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded']
const EXPENSE_STATUSES = ['pending', 'approved', 'paid', 'rejected']
const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense']
const PAYMENT_METHODS = ['cash', 'check', 'card', 'ach', 'wire', 'other']
const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']
const RECURRING_TYPES = ['invoice', 'bill', 'expense']
const PERIOD_TYPES = ['monthly', 'quarterly', 'yearly']

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function CrmFinance() {
  const { client, platform } = useCrmClient()
  const [tab, setTab] = useState('overview')

  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [bills, setBills] = useState([])
  const [expenses, setExpenses] = useState([])
  const [accounts, setAccounts] = useState([])
  const [recurring, setRecurring] = useState([])
  const [budgets, setBudgets] = useState([])
  const [transactions, setTransactions] = useState([])
  const [contacts, setContacts] = useState([])
  const [wonJobs, setWonJobs] = useState([])
  const [fromJobOpen, setFromJobOpen] = useState(false)

  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [loadingBills, setLoadingBills] = useState(true)
  const [loadingExpenses, setLoadingExpenses] = useState(true)
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [loadingRecurring, setLoadingRecurring] = useState(true)
  const [loadingBudgets, setLoadingBudgets] = useState(true)
  const [loadingTransactions, setLoadingTransactions] = useState(true)

  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false)
  const [newBillOpen, setNewBillOpen] = useState(false)
  const [newExpenseOpen, setNewExpenseOpen] = useState(false)
  const [newAccountOpen, setNewAccountOpen] = useState(false)
  const [newRecurringOpen, setNewRecurringOpen] = useState(false)
  const [newBudgetOpen, setNewBudgetOpen] = useState(false)

  const [invoiceDrawer, setInvoiceDrawer] = useState(null)
  const [paymentDrawer, setPaymentDrawer] = useState(null)
  const [billDrawer, setBillDrawer] = useState(null)
  const [expenseDrawer, setExpenseDrawer] = useState(null)
  const [accountDrawer, setAccountDrawer] = useState(null)
  const [recurringDrawer, setRecurringDrawer] = useState(null)
  const [budgetDrawer, setBudgetDrawer] = useState(null)

  async function loadInvoices() {
    if (!client) return
    setLoadingInvoices(true)
    try {
      const { data, error } = await client.from('finance_invoices').select('*').order('invoice_date', { ascending: false }).limit(400)
      if (error) throw error
      setInvoices(data || [])
    } catch (e) { console.error('[CrmFinance] loadInvoices', e) } finally { setLoadingInvoices(false) }
  }
  async function loadPayments() {
    if (!client) return
    setLoadingPayments(true)
    try {
      const { data, error } = await client.from('finance_payments').select('*').order('payment_date', { ascending: false }).limit(400)
      if (error) throw error
      setPayments(data || [])
    } catch (e) { console.error('[CrmFinance] loadPayments', e) } finally { setLoadingPayments(false) }
  }
  async function loadBills() {
    if (!client) return
    setLoadingBills(true)
    try {
      const { data, error } = await client.from('finance_bills').select('*').order('bill_date', { ascending: false }).limit(400)
      if (error) throw error
      setBills(data || [])
    } catch (e) { console.error('[CrmFinance] loadBills', e) } finally { setLoadingBills(false) }
  }
  async function loadExpenses() {
    if (!client) return
    setLoadingExpenses(true)
    try {
      const { data, error } = await client.from('finance_expenses').select('*').order('expense_date', { ascending: false }).limit(400)
      if (error) throw error
      setExpenses(data || [])
    } catch (e) { console.error('[CrmFinance] loadExpenses', e) } finally { setLoadingExpenses(false) }
  }
  async function loadAccounts() {
    if (!client) return
    setLoadingAccounts(true)
    try {
      const { data, error } = await client.from('finance_accounts').select('*').order('display_order', { ascending: true }).order('code', { ascending: true })
      if (error) throw error
      setAccounts(data || [])
    } catch (e) { console.error('[CrmFinance] loadAccounts', e) } finally { setLoadingAccounts(false) }
  }
  async function loadRecurring() {
    if (!client) return
    setLoadingRecurring(true)
    try {
      const { data, error } = await client.from('finance_recurring').select('*').order('next_date', { ascending: true })
      if (error) throw error
      setRecurring(data || [])
    } catch (e) { console.error('[CrmFinance] loadRecurring', e) } finally { setLoadingRecurring(false) }
  }
  async function loadBudgets() {
    if (!client) return
    setLoadingBudgets(true)
    try {
      const { data, error } = await client.from('finance_budgets').select('*').order('fiscal_year', { ascending: false })
      if (error) throw error
      setBudgets(data || [])
    } catch (e) { console.error('[CrmFinance] loadBudgets', e) } finally { setLoadingBudgets(false) }
  }
  async function loadTransactions() {
    if (!client) return
    setLoadingTransactions(true)
    try {
      const { data, error } = await client.from('finance_transactions').select('*').order('transaction_date', { ascending: false }).limit(50)
      if (error) throw error
      setTransactions(data || [])
    } catch (e) { console.error('[CrmFinance] loadTransactions', e) } finally { setLoadingTransactions(false) }
  }
  async function loadContacts() {
    if (!client) return
    try {
      const { data } = await client.from('customer_contacts').select('id, first_name, last_name, email').limit(500)
      setContacts(data || [])
    } catch (e) { console.error('[CrmFinance] loadContacts', e) }
  }

  async function loadWonJobs() {
    try {
      const { data } = await client.from('customer_pipeline')
        .select('id, title, deal_value, contact_id, stage, customer_contacts(first_name, last_name)')
        .in('stage', ['won', 'ops']).order('updated_at', { ascending: false }).limit(200)
      setWonJobs(data || [])
    } catch (e) { console.error('[CrmFinance] loadWonJobs', e) }
  }

  async function generateMilestoneInvoices({ job, splits }) {
    if (!client || !job) return
    const total = Number(job.deal_value) || 0
    const c = job.customer_contacts
    const cname = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : (job.title || '')
    const today = new Date().toISOString().slice(0, 10)
    const rows = (splits || []).filter((sp) => Number(sp.pct) > 0).map((sp) => {
      const amount = Math.round(total * (Number(sp.pct) || 0)) / 100
      return {
        invoice_number: genInvoiceNumber(),
        customer_id: job.contact_id || null,
        customer_name: cname || null,
        project_name: job.title || null,
        invoice_date: today,
        due_date: today,
        status: 'draft',
        line_items: [{ name: `${sp.label} — ${job.title || 'job'}`, description: `${sp.pct}% of ${'$' + total.toLocaleString()}`, quantity: 1, unit_price: amount, amount }],
        subtotal: amount, tax_rate: 0, tax_amount: 0, total_amount: amount, amount_paid: 0, balance_due: amount,
        terms: `${sp.label} milestone`,
      }
    })
    if (!rows.length) { alert('Add at least one milestone with a percentage.'); return }
    const { error } = await client.from('finance_invoices').insert(rows)
    if (error) { alert('Generate failed: ' + error.message); return }
    setFromJobOpen(false); loadInvoices()
  }

  useEffect(() => {
    if (!client) return
    loadInvoices(); loadPayments(); loadBills(); loadExpenses()
    loadAccounts(); loadRecurring(); loadBudgets(); loadTransactions(); loadContacts(); loadWonJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  const accountById = useMemo(() => { const m = new Map(); for (const a of accounts) m.set(a.id, a); return m }, [accounts])
  const invoiceById = useMemo(() => { const m = new Map(); for (const i of invoices) m.set(i.id, i); return m }, [invoices])

  const stats = useMemo(() => {
    const arOutstanding = invoices
      .filter((i) => !['paid', 'void'].includes(i.status))
      .reduce((s, i) => s + Number(i.balance_due || 0), 0)
    const apOutstanding = bills
      .filter((b) => !['paid', 'void'].includes(b.status))
      .reduce((s, b) => s + Number(b.balance_due || 0), 0)
    const cashOnHand = accounts
      .filter((a) => {
        if (a.account_type !== 'asset') return false
        if (a.sub_type === 'cash') return true
        if (!a.sub_type && (a.code === '1000' || a.code === '1100')) return true
        return false
      })
      .reduce((s, a) => s + Number(a.current_balance || 0), 0)
    const ms = monthStart()
    const revenueMTD = invoices
      .filter((i) => i.status === 'paid' && i.invoice_date && new Date(i.invoice_date) >= new Date(ms))
      .reduce((s, i) => s + Number(i.total_amount || 0), 0)
    const expensesMTD = expenses
      .filter((e) => e.status === 'approved' && e.expense_date && new Date(e.expense_date) >= new Date(ms))
      .reduce((s, e) => s + Number(e.amount || 0), 0)
    const profitMTD = revenueMTD - expensesMTD
    return { arOutstanding, apOutstanding, cashOnHand, revenueMTD, expensesMTD, profitMTD }
  }, [invoices, bills, accounts, expenses])

  return (
    <HubPage
      title="Finance"
      subtitle={`Full general ledger, AR, AP, expenses, and budgets${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="AR Outstanding" value={fmtMoney(stats.arOutstanding)} accent="text-amber-400" hint="Open invoices" />
        <StatCard label="AP Outstanding" value={fmtMoney(stats.apOutstanding)} accent="text-rose-400" hint="Bills to pay" />
        <StatCard label="Cash on Hand" value={fmtMoney(stats.cashOnHand)} accent="text-brand-cyan" hint="Asset cash accounts" />
        <StatCard label="Revenue MTD" value={fmtMoney(stats.revenueMTD)} accent="text-emerald-400" hint="Paid invoices this month" />
        <StatCard label="Expenses MTD" value={fmtMoney(stats.expensesMTD)} accent="text-rose-400" hint="Approved expenses this month" />
        <StatCard label="Profit MTD" value={fmtMoney(stats.profitMTD)} accent={stats.profitMTD >= 0 ? 'text-emerald-400' : 'text-rose-400'} hint="Revenue minus expenses" />
      </div>

      <div className="mb-5">
        <div className="md:hidden">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="overview">Overview</option>
            <option value="invoices">Invoices</option>
            <option value="payments">Payments</option>
            <option value="bills">Bills</option>
            <option value="expenses">Expenses</option>
            <option value="accounts">Chart of Accounts</option>
            <option value="recurring">Recurring</option>
            <option value="budgets">Budgets</option>
          </select>
        </div>
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabBtn>
          <TabBtn active={tab === 'invoices'} onClick={() => setTab('invoices')} count={invoices.length}>Invoices</TabBtn>
          <TabBtn active={tab === 'payments'} onClick={() => setTab('payments')} count={payments.length}>Payments</TabBtn>
          <TabBtn active={tab === 'bills'} onClick={() => setTab('bills')} count={bills.length}>Bills</TabBtn>
          <TabBtn active={tab === 'expenses'} onClick={() => setTab('expenses')} count={expenses.length}>Expenses</TabBtn>
          <TabBtn active={tab === 'accounts'} onClick={() => setTab('accounts')} count={accounts.length}>Chart of Accounts</TabBtn>
          <TabBtn active={tab === 'recurring'} onClick={() => setTab('recurring')} count={recurring.length}>Recurring</TabBtn>
          <TabBtn active={tab === 'budgets'} onClick={() => setTab('budgets')} count={budgets.length}>Budgets</TabBtn>
        </div>
      </div>

      {tab === 'overview' && (
        <OverviewTab
          invoices={invoices}
          bills={bills}
          transactions={transactions}
          payments={payments}
          expenses={expenses}
          loading={loadingInvoices || loadingBills || loadingTransactions}
        />
      )}
      {tab === 'invoices' && (
        <InvoicesTab
          invoices={invoices}
          loading={loadingInvoices}
          onOpenNew={() => setNewInvoiceOpen(true)}
          onOpenFromJob={() => setFromJobOpen(true)}
          onRow={setInvoiceDrawer}
        />
      )}
      {tab === 'payments' && (
        <PaymentsTab
          payments={payments}
          invoiceById={invoiceById}
          loading={loadingPayments}
          onRow={setPaymentDrawer}
        />
      )}
      {tab === 'bills' && (
        <BillsTab
          bills={bills}
          loading={loadingBills}
          onOpenNew={() => setNewBillOpen(true)}
          onRow={setBillDrawer}
        />
      )}
      {tab === 'expenses' && (
        <ExpensesTab
          expenses={expenses}
          accounts={accounts}
          loading={loadingExpenses}
          onOpenNew={() => setNewExpenseOpen(true)}
          onRow={setExpenseDrawer}
        />
      )}
      {tab === 'accounts' && (
        <AccountsTab
          accounts={accounts}
          loading={loadingAccounts}
          onOpenNew={() => setNewAccountOpen(true)}
          onRow={setAccountDrawer}
        />
      )}
      {tab === 'recurring' && (
        <RecurringTab
          recurring={recurring}
          loading={loadingRecurring}
          onOpenNew={() => setNewRecurringOpen(true)}
          onRow={setRecurringDrawer}
          client={client}
          onChanged={loadRecurring}
        />
      )}
      {tab === 'budgets' && (
        <BudgetsTab
          budgets={budgets}
          accountById={accountById}
          expenses={expenses}
          loading={loadingBudgets}
          onOpenNew={() => setNewBudgetOpen(true)}
          onRow={setBudgetDrawer}
        />
      )}

      <NewInvoiceModal open={newInvoiceOpen} onClose={() => setNewInvoiceOpen(false)} client={client} contacts={contacts} onSaved={() => { setNewInvoiceOpen(false); loadInvoices() }} />
      <FromJobModal open={fromJobOpen} onClose={() => setFromJobOpen(false)} jobs={wonJobs} onGenerate={generateMilestoneInvoices} />
      <NewBillModal open={newBillOpen} onClose={() => setNewBillOpen(false)} client={client} onSaved={() => { setNewBillOpen(false); loadBills() }} />
      <NewExpenseModal open={newExpenseOpen} onClose={() => setNewExpenseOpen(false)} client={client} accounts={accounts} onSaved={() => { setNewExpenseOpen(false); loadExpenses() }} />
      <NewAccountModal open={newAccountOpen} onClose={() => setNewAccountOpen(false)} client={client} accounts={accounts} onSaved={() => { setNewAccountOpen(false); loadAccounts() }} />
      <NewRecurringModal open={newRecurringOpen} onClose={() => setNewRecurringOpen(false)} client={client} accounts={accounts} contacts={contacts} onSaved={() => { setNewRecurringOpen(false); loadRecurring() }} />
      <NewBudgetModal open={newBudgetOpen} onClose={() => setNewBudgetOpen(false)} client={client} accounts={accounts} onSaved={() => { setNewBudgetOpen(false); loadBudgets() }} />

      <InvoiceDrawer invoice={invoiceDrawer} onClose={() => setInvoiceDrawer(null)} client={client} payments={payments} onChanged={() => { loadInvoices(); loadPayments() }} />
      <PaymentDrawer payment={paymentDrawer} onClose={() => setPaymentDrawer(null)} client={client} invoiceById={invoiceById} onChanged={loadPayments} />
      <BillDrawer bill={billDrawer} onClose={() => setBillDrawer(null)} client={client} onChanged={loadBills} />
      <ExpenseDrawer expense={expenseDrawer} onClose={() => setExpenseDrawer(null)} client={client} accountById={accountById} onChanged={loadExpenses} />
      <AccountDrawer account={accountDrawer} onClose={() => setAccountDrawer(null)} client={client} onChanged={loadAccounts} />
      <RecurringDrawer rec={recurringDrawer} onClose={() => setRecurringDrawer(null)} client={client} onChanged={loadRecurring} />
      <BudgetDrawer budget={budgetDrawer} onClose={() => setBudgetDrawer(null)} client={client} accountById={accountById} expenses={expenses} onChanged={loadBudgets} />
    </HubPage>
  )
}

// ===========================================================================
//                              TAB: OVERVIEW
// ===========================================================================
function OverviewTab({ invoices, bills, transactions, payments, expenses, loading }) {
  const today = new Date()
  const overdueInvoices = useMemo(() => {
    return invoices
      .filter((i) => {
        if (i.status === 'overdue') return true
        if (i.status === 'sent' && i.due_date && new Date(i.due_date) < today) return true
        return false
      })
      .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))
      .slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices])

  const upcomingBills = useMemo(() => {
    return bills
      .filter((b) => ['received', 'scheduled'].includes(b.status) && Number(b.balance_due || 0) > 0)
      .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))
      .slice(0, 5)
  }, [bills])

  const recentActivity = useMemo(() => {
    const items = []
    for (const t of transactions.slice(0, 20)) {
      items.push({ kind: 'transaction', id: 't_' + t.id, date: t.transaction_date, label: t.description || t.transaction_number, amount: t.total_amount, sub: t.transaction_type })
    }
    for (const p of payments.slice(0, 20)) {
      items.push({ kind: 'payment', id: 'p_' + p.id, date: p.payment_date, label: `Payment from ${p.customer_name || '-'}`, amount: p.amount, sub: p.payment_method })
    }
    for (const e of expenses.slice(0, 20)) {
      items.push({ kind: 'expense', id: 'e_' + e.id, date: e.expense_date, label: e.description, amount: -Number(e.amount || 0), sub: e.category })
    }
    return items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 10)
  }, [transactions, payments, expenses])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Cash Flow">
        <div className="p-6 text-center">
          <div className="text-sm text-gray-400">Your current cash position is summarized in the stat cards above. Detailed cash-flow charts are coming soon.</div>
        </div>
      </Section>

      <Section title="Recent Activity">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : recentActivity.length === 0 ? (
          <EmptyState title="No recent activity" description="Transactions, payments, and expenses will appear here." />
        ) : (
          <ul className="divide-y divide-navy-700/50">
            {recentActivity.map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">{a.label || '-'}</div>
                  <div className="text-xs text-gray-500 capitalize">{a.kind} {a.sub ? `- ${a.sub}` : ''}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm ${Number(a.amount) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtMoney(a.amount)}</div>
                  <div className="text-[11px] text-gray-500">{fmtDate(a.date)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Top Overdue Invoices">
        {overdueInvoices.length === 0 ? (
          <EmptyState title="Nothing overdue" description="You're all caught up." />
        ) : (
          <ul className="divide-y divide-navy-700/50">
            {overdueInvoices.map((i) => (
              <li key={i.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">{i.invoice_number}</div>
                  <div className="text-xs text-gray-500">{i.customer_name || '-'}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-rose-400">{fmtMoney(i.balance_due)}</div>
                  <div className="text-[11px] text-gray-500">Due {fmtDate(i.due_date)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Upcoming Bills">
        {upcomingBills.length === 0 ? (
          <EmptyState title="No upcoming bills" description="Bills waiting to be paid will show here." />
        ) : (
          <ul className="divide-y divide-navy-700/50">
            {upcomingBills.map((b) => (
              <li key={b.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">{b.bill_number}</div>
                  <div className="text-xs text-gray-500">{b.vendor_name || '-'}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-amber-400">{fmtMoney(b.balance_due)}</div>
                  <div className="text-[11px] text-gray-500">Due {fmtDate(b.due_date)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

// ===========================================================================
//                              TAB: INVOICES
// ===========================================================================
function InvoicesTab({ invoices, loading, onOpenNew, onOpenFromJob, onRow }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false
      if (q) {
        const blob = `${i.invoice_number || ''} ${i.customer_name || ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [invoices, statusFilter, search])

  return (
    <Section
      title="Invoices"
      right={
        <>
          {onOpenFromJob && (
            <button onClick={onOpenFromJob} className="bg-navy-800 hover:bg-navy-700 text-gray-200 border border-navy-700 text-xs px-3 py-1.5 rounded-lg mr-2">
              From job
            </button>
          )}
          <button onClick={onOpenNew} className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg">
            + New Invoice
          </button>
        </>
      }
    >
      <div className="px-5 py-3 border-b border-navy-700/50 flex flex-wrap items-center gap-2">
        <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</Chip>
        {INVOICE_STATUSES.map((s) => (
          <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</Chip>
        ))}
        <div className="flex-1 min-w-[180px] ml-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice number or customer..."
            className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
          />
        </div>
      </div>
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading invoices...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Create your first one to start billing customers."
          cta={
            <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + New Invoice
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-navy-900/40 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Invoice #</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Due</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Paid</th>
                <th className="px-4 py-2 text-right">Balance</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/30">
              {filtered.map((i) => (
                <tr key={i.id} onClick={() => onRow(i)} className="cursor-pointer hover:bg-navy-700/30">
                  <td className="px-4 py-2 text-white">{i.invoice_number}</td>
                  <td className="px-4 py-2 text-gray-300">{i.customer_name || '-'}</td>
                  <td className="px-4 py-2 text-gray-400">{fmtDate(i.invoice_date)}</td>
                  <td className="px-4 py-2 text-gray-400">{fmtDate(i.due_date)}</td>
                  <td className="px-4 py-2 text-right text-white">{fmtMoney(i.total_amount)}</td>
                  <td className="px-4 py-2 text-right text-emerald-400">{fmtMoney(i.amount_paid)}</td>
                  <td className="px-4 py-2 text-right text-amber-400">{fmtMoney(i.balance_due)}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge kind="invoice" status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                              TAB: PAYMENTS
// ===========================================================================
function PaymentsTab({ payments, invoiceById, loading, onRow }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const filtered = useMemo(() => payments.filter((p) => statusFilter === 'all' ? true : p.status === statusFilter), [payments, statusFilter])
  return (
    <Section title="Payments">
      <div className="px-5 py-3 border-b border-navy-700/50 flex flex-wrap items-center gap-2">
        <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</Chip>
        {PAYMENT_STATUSES.map((s) => (
          <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</Chip>
        ))}
      </div>
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading payments...</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No payments yet" description="Record a payment from the Invoices tab." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-navy-900/40 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Payment #</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Invoice</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-left">Method</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/30">
              {filtered.map((p) => {
                const inv = invoiceById.get(p.invoice_id)
                return (
                  <tr key={p.id} onClick={() => onRow(p)} className="cursor-pointer hover:bg-navy-700/30">
                    <td className="px-4 py-2 text-white">{p.payment_number}</td>
                    <td className="px-4 py-2 text-gray-400">{fmtDate(p.payment_date)}</td>
                    <td className="px-4 py-2 text-gray-300">{p.customer_name || '-'}</td>
                    <td className="px-4 py-2 text-gray-300">{inv?.invoice_number || '-'}</td>
                    <td className="px-4 py-2 text-right text-emerald-400">{fmtMoney(p.amount)}</td>
                    <td className="px-4 py-2 text-gray-300 capitalize">{p.payment_method || '-'}</td>
                    <td className="px-4 py-2 text-center"><StatusBadge kind="payment" status={p.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                              TAB: BILLS
// ===========================================================================
function BillsTab({ bills, loading, onOpenNew, onRow }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const filtered = useMemo(() => bills.filter((b) => statusFilter === 'all' ? true : b.status === statusFilter), [bills, statusFilter])
  return (
    <Section
      title="Bills (AP)"
      right={
        <button onClick={onOpenNew} className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg">
          + New Bill
        </button>
      }
    >
      <div className="px-5 py-3 border-b border-navy-700/50 flex flex-wrap items-center gap-2">
        <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</Chip>
        {BILL_STATUSES.map((s) => (
          <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</Chip>
        ))}
      </div>
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading bills...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No bills yet"
          description="Track what you owe vendors here."
          cta={
            <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + New Bill
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-navy-900/40 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Bill #</th>
                <th className="px-4 py-2 text-left">Vendor</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Due</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Balance</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/30">
              {filtered.map((b) => (
                <tr key={b.id} onClick={() => onRow(b)} className="cursor-pointer hover:bg-navy-700/30">
                  <td className="px-4 py-2 text-white">{b.bill_number}</td>
                  <td className="px-4 py-2 text-gray-300">{b.vendor_name || '-'}</td>
                  <td className="px-4 py-2 text-gray-400">{fmtDate(b.bill_date)}</td>
                  <td className="px-4 py-2 text-gray-400">{fmtDate(b.due_date)}</td>
                  <td className="px-4 py-2 text-right text-white">{fmtMoney(b.total_amount)}</td>
                  <td className="px-4 py-2 text-right text-amber-400">{fmtMoney(b.balance_due)}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge kind="bill" status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                              TAB: EXPENSES
// ===========================================================================
function ExpensesTab({ expenses, accounts, loading, onOpenNew, onRow }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const categories = useMemo(() => {
    const set = new Set()
    for (const e of expenses) if (e.category) set.add(e.category)
    return Array.from(set).sort()
  }, [expenses])
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      return true
    })
  }, [expenses, statusFilter, categoryFilter])

  return (
    <Section
      title="Expenses"
      right={
        <button onClick={onOpenNew} className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg">
          + New Expense
        </button>
      }
    >
      <div className="px-5 py-3 border-b border-navy-700/50 flex flex-wrap items-center gap-2">
        <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All status</Chip>
        {EXPENSE_STATUSES.map((s) => (
          <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</Chip>
        ))}
        <span className="text-gray-600 mx-1">|</span>
        <Chip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>All cats</Chip>
        {categories.map((c) => (
          <Chip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>{c}</Chip>
        ))}
      </div>
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading expenses...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          description="Log expenses to track spending and reimbursements."
          cta={
            <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + New Expense
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-navy-900/40 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Vendor</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-center">Receipt</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/30">
              {filtered.map((e) => (
                <tr key={e.id} onClick={() => onRow(e)} className="cursor-pointer hover:bg-navy-700/30">
                  <td className="px-4 py-2 text-gray-400">{fmtDate(e.expense_date)}</td>
                  <td className="px-4 py-2 text-white">{e.description || '-'}</td>
                  <td className="px-4 py-2 text-gray-300">{e.category || '-'}</td>
                  <td className="px-4 py-2 text-gray-300">{e.vendor_name || '-'}</td>
                  <td className="px-4 py-2 text-right text-rose-400">{fmtMoney(e.amount)}</td>
                  <td className="px-4 py-2 text-center">{e.receipt_url ? <span className="text-brand-cyan">v</span> : <span className="text-gray-600">-</span>}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge kind="expense" status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                              TAB: CHART OF ACCOUNTS
// ===========================================================================
function AccountsTab({ accounts, loading, onOpenNew, onRow }) {
  const grouped = useMemo(() => {
    const g = {}
    for (const t of ACCOUNT_TYPES) g[t] = []
    for (const a of accounts) {
      if (g[a.account_type]) g[a.account_type].push(a)
    }
    return g
  }, [accounts])

  return (
    <Section
      title="Chart of Accounts"
      right={
        <button onClick={onOpenNew} className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg">
          + New Account
        </button>
      }
    >
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <EmptyState title="Chart of accounts is empty" description="Default accounts will be seeded with the tenant template." />
      ) : (
        <div className="divide-y divide-navy-700/50">
          {ACCOUNT_TYPES.map((type) => {
            const list = grouped[type] || []
            if (list.length === 0) return null
            return (
              <div key={type}>
                <div className="px-5 py-2 bg-navy-900/40 text-xs uppercase tracking-wider text-brand-blue">{type}</div>
                <ul className="divide-y divide-navy-700/30">
                  {list.map((a) => (
                    <li
                      key={a.id}
                      onClick={() => onRow(a)}
                      className={`px-5 py-2 flex items-center justify-between cursor-pointer hover:bg-navy-700/30 ${!a.is_active ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-500 w-12">{a.code}</span>
                        <div>
                          <div className="text-sm text-white">{a.name}</div>
                          {a.sub_type && <div className="text-[11px] text-gray-500">{a.sub_type}</div>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white">{fmtMoney(a.current_balance)}</div>
                        <div className="text-[11px] text-gray-500">{a.normal_balance || '-'}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                              TAB: RECURRING
// ===========================================================================
function RecurringTab({ recurring, loading, onOpenNew, onRow, client, onChanged }) {
  async function toggleActive(rec) {
    if (!client) return
    try {
      await client.from('finance_recurring').update({ is_active: !rec.is_active }).eq('id', rec.id)
      onChanged && onChanged()
    } catch (e) { console.error(e) }
  }
  return (
    <Section
      title="Recurring"
      right={
        <button onClick={onOpenNew} className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg">
          + New Recurring
        </button>
      }
    >
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading recurring...</div>
      ) : recurring.length === 0 ? (
        <EmptyState
          title="No recurring schedules"
          description="Set up recurring invoices, bills, or expenses to automate routine work."
          cta={
            <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + New Recurring
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-navy-900/40 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Frequency</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-left">Next</th>
                <th className="px-4 py-2 text-left">Last Generated</th>
                <th className="px-4 py-2 text-center">Active</th>
                <th className="px-4 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/30">
              {recurring.map((r) => (
                <tr key={r.id} className="hover:bg-navy-700/30">
                  <td className="px-4 py-2 text-white cursor-pointer" onClick={() => onRow(r)}>{r.name}</td>
                  <td className="px-4 py-2 text-gray-300 capitalize">{r.transaction_type}</td>
                  <td className="px-4 py-2 text-gray-300 capitalize">{r.frequency}</td>
                  <td className="px-4 py-2 text-right text-white">{fmtMoney(r.amount)}</td>
                  <td className="px-4 py-2 text-gray-400">{fmtDate(r.next_date)}</td>
                  <td className="px-4 py-2 text-gray-500">{fmtDate(r.last_generated_at)}</td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => toggleActive(r)} className={`text-xs px-2 py-0.5 rounded ${r.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-navy-700/60 text-gray-400'}`}>
                      {r.is_active ? 'on' : 'off'}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => alert('Automatic recurring generation is coming soon. For now, you can add entries manually.')}
                      className="text-xs text-brand-cyan hover:underline"
                    >
                      Generate Now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                              TAB: BUDGETS
// ===========================================================================
function BudgetsTab({ budgets, accountById, expenses, loading, onOpenNew, onRow }) {
  function currentPeriodActual(budget) {
    const acct = accountById.get(budget.account_id)
    if (!acct) return 0
    const ms = monthStart()
    return expenses
      .filter((e) => e.account_id === budget.account_id && e.expense_date && new Date(e.expense_date) >= new Date(ms))
      .reduce((s, e) => s + Number(e.amount || 0), 0)
  }
  return (
    <Section
      title="Budgets"
      right={
        <button onClick={onOpenNew} className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg">
          + New Budget
        </button>
      }
    >
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading budgets...</div>
      ) : budgets.length === 0 ? (
        <EmptyState
          title="No budgets defined"
          description="Set spending budgets per account to track against actuals."
          cta={
            <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + New Budget
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {budgets.map((b) => {
            const acct = accountById.get(b.account_id)
            const total = Number(b.total_amount || 0)
            const actual = currentPeriodActual(b)
            const pct = total > 0 ? Math.min(100, Math.round((actual / total) * 100)) : 0
            const over = actual > total
            return (
              <button
                key={b.id}
                onClick={() => onRow(b)}
                className="text-left bg-navy-900/40 border border-navy-700/50 rounded-lg p-4 hover:border-brand-cyan/40 transition"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-sm text-white font-medium">{b.name}</div>
                  <div className="text-[11px] text-gray-500">{b.fiscal_year}</div>
                </div>
                <div className="text-xs text-gray-400 mb-2">{acct?.name || '-'} - {b.period_type}</div>
                <div className="text-xs text-gray-500 mb-1">{fmtMoney(actual)} of {fmtMoney(total)}</div>
                <div className="h-2 bg-navy-700/60 rounded">
                  <div
                    className={`h-2 rounded ${over ? 'bg-rose-500' : 'bg-brand-cyan'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                         LINE ITEM EDITOR (shared)
// ===========================================================================
function LineItemEditor({ items, setItems }) {
  function update(idx, key, value) {
    const next = items.map((it, i) => {
      if (i !== idx) return it
      const merged = { ...it, [key]: value }
      const qty = Number(merged.qty || 0)
      const price = Number(merged.unit_price || 0)
      merged.amount = +(qty * price).toFixed(2)
      return merged
    })
    setItems(next)
  }
  function addRow() {
    setItems([...items, { description: '', qty: 1, unit_price: 0, amount: 0 }])
  }
  function removeRow(idx) {
    setItems(items.filter((_, i) => i !== idx))
  }
  return (
    <div className="border border-navy-700/50 rounded-lg overflow-hidden mb-3">
      <div className="px-3 py-2 bg-navy-900/40 text-xs uppercase tracking-wider text-gray-400 flex items-center justify-between">
        <span>Line items</span>
        <button onClick={addRow} className="text-brand-cyan text-xs">+ Row</button>
      </div>
      <div className="divide-y divide-navy-700/30">
        {items.length === 0 && <div className="px-3 py-3 text-xs text-gray-500">No line items. Click + Row.</div>}
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 p-2 items-center">
            <input
              value={it.description || ''}
              onChange={(e) => update(i, 'description', e.target.value)}
              placeholder="Description"
              className="col-span-6 bg-navy-900/60 border border-navy-700/60 rounded px-2 py-1 text-xs text-white placeholder-gray-500"
            />
            <input
              type="number"
              value={it.qty ?? 1}
              onChange={(e) => update(i, 'qty', e.target.value)}
              placeholder="Qty"
              className="col-span-2 bg-navy-900/60 border border-navy-700/60 rounded px-2 py-1 text-xs text-white"
            />
            <input
              type="number"
              step="0.01"
              value={it.unit_price ?? 0}
              onChange={(e) => update(i, 'unit_price', e.target.value)}
              placeholder="Price"
              className="col-span-2 bg-navy-900/60 border border-navy-700/60 rounded px-2 py-1 text-xs text-white"
            />
            <div className="col-span-1 text-right text-xs text-white">{fmtMoney(it.amount)}</div>
            <button onClick={() => removeRow(i)} className="col-span-1 text-rose-400 text-xs">x</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function totalsFromItems(items, taxRate) {
  const subtotal = items.reduce((s, it) => s + Number(it.amount || 0), 0)
  const tax = subtotal * (Number(taxRate || 0) / 100)
  const total = subtotal + tax
  return { subtotal: +subtotal.toFixed(2), tax: +tax.toFixed(2), total: +total.toFixed(2) }
}

// ===========================================================================
//                             NEW INVOICE MODAL
// ===========================================================================
function FromJobModal({ open, onClose, jobs, onGenerate }) {
  const [jobId, setJobId] = useState('')
  const [splits, setSplits] = useState([{ label: 'Deposit', pct: 50 }, { label: 'Progress', pct: 40 }, { label: 'Final', pct: 10 }])
  useEffect(() => { if (open) { setJobId(''); setSplits([{ label: 'Deposit', pct: 50 }, { label: 'Progress', pct: 40 }, { label: 'Final', pct: 10 }]) } }, [open])
  if (!open) return null
  const job = (jobs || []).find((j) => j.id === jobId)
  const total = Number(job?.deal_value) || 0
  const pctSum = splits.reduce((t, sp) => t + (Number(sp.pct) || 0), 0)
  const money = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-navy-900 border border-navy-800 rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-semibold mb-1">Generate invoices from a won job</h3>
        <p className="text-xs text-gray-500 mb-4">Splits the job value into deposit / progress / final draft invoices.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Won job</label>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">
              <option value="">Select a won job...</option>
              {(jobs || []).map((j) => <option key={j.id} value={j.id}>{j.title} — {money(j.deal_value)}</option>)}
            </select>
          </div>
          {job && <div className="text-sm text-gray-300">Job value: <span className="text-white font-semibold">{money(total)}</span></div>}
          <div className="space-y-2">
            {splits.map((sp, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input value={sp.label} onChange={(e) => { const d = [...splits]; d[i] = { ...sp, label: e.target.value }; setSplits(d) }} className="col-span-5 bg-navy-800 border border-navy-700 text-white rounded px-2 py-1.5 text-sm" />
                <div className="col-span-3 flex items-center gap-1"><input type="number" min="0" value={sp.pct} onChange={(e) => { const d = [...splits]; d[i] = { ...sp, pct: e.target.value }; setSplits(d) }} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-2 py-1.5 text-sm text-right" /><span className="text-gray-400 text-sm">%</span></div>
                <div className="col-span-3 text-right text-sm text-gray-300">{money(total * (Number(sp.pct) || 0) / 100)}</div>
                <button onClick={() => setSplits(splits.filter((_, j) => j !== i))} className="col-span-1 text-gray-500 hover:text-red-400">×</button>
              </div>
            ))}
            <button onClick={() => setSplits([...splits, { label: 'Milestone', pct: 0 }])} className="text-xs text-brand-blue hover:text-brand-blue/80">+ Add milestone</button>
          </div>
          <div className={'text-xs ' + (Math.round(pctSum) === 100 ? 'text-gray-500' : 'text-amber-400')}>Splits total {pctSum}%{Math.round(pctSum) === 100 ? '' : ' (should be 100%)'}</div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm border border-navy-700 text-gray-300">Cancel</button>
          <button onClick={() => onGenerate({ job, splits })} disabled={!job} className="px-3 py-2 rounded-lg text-sm bg-brand-blue hover:bg-brand-blue/90 text-white disabled:opacity-50">Generate invoices</button>
        </div>
      </div>
    </div>
  )
}

function NewInvoiceModal({ open, onClose, client, contacts, onSaved }) {
  const [customerId, setCustomerId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState(plusDays(30))
  const [items, setItems] = useState([{ description: '', qty: 1, unit_price: 0, amount: 0 }])
  const [taxRate, setTaxRate] = useState(0)
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('Net 30')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCustomerId(''); setInvoiceDate(todayISO()); setDueDate(plusDays(30))
    setItems([{ description: '', qty: 1, unit_price: 0, amount: 0 }])
    setTaxRate(0); setNotes(''); setTerms('Net 30')
  }, [open])

  const totals = totalsFromItems(items, taxRate)
  const customerName = useMemo(() => {
    const c = contacts.find((x) => x.id === customerId)
    return c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : ''
  }, [customerId, contacts])

  async function save() {
    if (!client) return
    setSaving(true)
    try {
      const row = {
        invoice_number: genInvoiceNumber(),
        customer_id: customerId || null,
        customer_name: customerName || null,
        invoice_date: invoiceDate,
        due_date: dueDate,
        status: 'draft',
        line_items: items,
        subtotal: totals.subtotal,
        tax_rate: Number(taxRate || 0),
        tax_amount: totals.tax,
        total_amount: totals.total,
        amount_paid: 0,
        balance_due: totals.total,
        notes,
        terms,
      }
      const { error } = await client.from('finance_invoices').insert(row)
      if (error) throw error
      onSaved && onSaved()
    } catch (e) { console.error(e); alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Invoice"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Create draft'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Select label="Customer" value={customerId} onChange={setCustomerId} options={contacts.map((c) => ({ value: c.id, label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || c.id }))} />
        <Input label="Tax rate (%)" type="number" step="0.01" value={taxRate} onChange={setTaxRate} />
        <Input label="Invoice date" type="date" value={invoiceDate} onChange={setInvoiceDate} />
        <Input label="Due date" type="date" value={dueDate} onChange={setDueDate} />
      </div>
      <LineItemEditor items={items} setItems={setItems} />
      <div className="grid grid-cols-3 gap-3 text-sm bg-navy-900/40 rounded-lg p-3 mb-3">
        <div><div className="text-xs text-gray-400">Subtotal</div><div className="text-white">{fmtMoney(totals.subtotal)}</div></div>
        <div><div className="text-xs text-gray-400">Tax</div><div className="text-white">{fmtMoney(totals.tax)}</div></div>
        <div><div className="text-xs text-gray-400">Total</div><div className="text-brand-cyan font-semibold">{fmtMoney(totals.total)}</div></div>
      </div>
      <Input label="Terms" value={terms} onChange={setTerms} />
      <Input label="Notes" value={notes} onChange={setNotes} rows={2} />
    </Modal>
  )
}

// ===========================================================================
//                              NEW BILL MODAL
// ===========================================================================
function NewBillModal({ open, onClose, client, onSaved }) {
  const [vendorName, setVendorName] = useState('')
  const [billDate, setBillDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState(plusDays(30))
  const [items, setItems] = useState([{ description: '', qty: 1, unit_price: 0, amount: 0 }])
  const [taxRate, setTaxRate] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setVendorName(''); setBillDate(todayISO()); setDueDate(plusDays(30))
    setItems([{ description: '', qty: 1, unit_price: 0, amount: 0 }]); setTaxRate(0); setNotes('')
  }, [open])

  const totals = totalsFromItems(items, taxRate)
  async function save() {
    if (!client) return
    setSaving(true)
    try {
      const row = {
        bill_number: genBillNumber(),
        vendor_name: vendorName,
        bill_date: billDate,
        due_date: dueDate,
        status: 'received',
        line_items: items,
        subtotal: totals.subtotal,
        tax_amount: totals.tax,
        total_amount: totals.total,
        amount_paid: 0,
        balance_due: totals.total,
        notes,
      }
      const { error } = await client.from('finance_bills').insert(row)
      if (error) throw error
      onSaved && onSaved()
    } catch (e) { console.error(e); alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Bill"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Create bill'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input label="Vendor name" value={vendorName} onChange={setVendorName} />
        <Input label="Tax rate (%)" type="number" step="0.01" value={taxRate} onChange={setTaxRate} />
        <Input label="Bill date" type="date" value={billDate} onChange={setBillDate} />
        <Input label="Due date" type="date" value={dueDate} onChange={setDueDate} />
      </div>
      <LineItemEditor items={items} setItems={setItems} />
      <div className="grid grid-cols-3 gap-3 text-sm bg-navy-900/40 rounded-lg p-3 mb-3">
        <div><div className="text-xs text-gray-400">Subtotal</div><div className="text-white">{fmtMoney(totals.subtotal)}</div></div>
        <div><div className="text-xs text-gray-400">Tax</div><div className="text-white">{fmtMoney(totals.tax)}</div></div>
        <div><div className="text-xs text-gray-400">Total</div><div className="text-brand-cyan font-semibold">{fmtMoney(totals.total)}</div></div>
      </div>
      <Input label="Notes" value={notes} onChange={setNotes} rows={2} />
    </Modal>
  )
}

// ===========================================================================
//                            NEW EXPENSE MODAL
// ===========================================================================
function NewExpenseModal({ open, onClose, client, accounts, onSaved }) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(todayISO())
  const [vendorName, setVendorName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDescription(''); setCategory(''); setAmount(''); setExpenseDate(todayISO())
    setVendorName(''); setAccountId(''); setReceiptUrl(''); setNotes('')
  }, [open])

  const expenseAccounts = accounts.filter((a) => a.account_type === 'expense' && a.is_active !== false)

  async function save() {
    if (!client) return
    setSaving(true)
    try {
      const row = {
        description, category, amount: Number(amount || 0),
        expense_date: expenseDate, vendor_name: vendorName,
        account_id: accountId || null, receipt_url: receiptUrl || null,
        status: 'pending', notes,
      }
      const { error } = await client.from('finance_expenses').insert(row)
      if (error) throw error
      onSaved && onSaved()
    } catch (e) { console.error(e); alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Expense"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Log expense'}
          </button>
        </div>
      }
    >
      <Input label="Description" value={description} onChange={setDescription} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Category" value={category} onChange={setCategory} placeholder="Fuel, supplies, etc." />
        <Input label="Amount" type="number" step="0.01" value={amount} onChange={setAmount} />
        <Input label="Date" type="date" value={expenseDate} onChange={setExpenseDate} />
        <Input label="Vendor" value={vendorName} onChange={setVendorName} />
      </div>
      <Select label="Account" value={accountId} onChange={setAccountId} options={expenseAccounts.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }))} />
      <Input label="Receipt URL" value={receiptUrl} onChange={setReceiptUrl} placeholder="https://..." />
      <Input label="Notes" value={notes} onChange={setNotes} rows={2} />
    </Modal>
  )
}

// ===========================================================================
//                            NEW ACCOUNT MODAL
// ===========================================================================
function NewAccountModal({ open, onClose, client, accounts, onSaved }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState('asset')
  const [subType, setSubType] = useState('')
  const [parentId, setParentId] = useState('')
  const [normalBalance, setNormalBalance] = useState('debit')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCode(''); setName(''); setAccountType('asset'); setSubType('')
    setParentId(''); setNormalBalance('debit'); setDescription('')
  }, [open])

  async function save() {
    if (!client) return
    setSaving(true)
    try {
      const row = {
        code, name, account_type: accountType, sub_type: subType || null,
        parent_account_id: parentId || null, normal_balance: normalBalance,
        description, is_active: true, current_balance: 0,
      }
      const { error } = await client.from('finance_accounts').insert(row)
      if (error) throw error
      onSaved && onSaved()
    } catch (e) { console.error(e); alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Account"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Create account'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input label="Code" value={code} onChange={setCode} placeholder="1000" />
        <Input label="Name" value={name} onChange={setName} placeholder="Cash" />
        <Select label="Type" value={accountType} onChange={setAccountType} options={ACCOUNT_TYPES.map((t) => ({ value: t, label: t }))} />
        <Input label="Sub-type" value={subType} onChange={setSubType} placeholder="cash, ar, etc." />
        <Select label="Parent" value={parentId} onChange={setParentId} options={accounts.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }))} />
        <Select label="Normal balance" value={normalBalance} onChange={setNormalBalance} options={[{ value: 'debit', label: 'debit' }, { value: 'credit', label: 'credit' }]} />
      </div>
      <Input label="Description" value={description} onChange={setDescription} rows={2} />
    </Modal>
  )
}

// ===========================================================================
//                          NEW RECURRING MODAL
// ===========================================================================
function NewRecurringModal({ open, onClose, client, accounts, contacts, onSaved }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [transactionType, setTransactionType] = useState('invoice')
  const [frequency, setFrequency] = useState('monthly')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [contactId, setContactId] = useState('')
  const [nextDate, setNextDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [templateData, setTemplateData] = useState('{}')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(''); setDescription(''); setTransactionType('invoice'); setFrequency('monthly')
    setAmount(''); setAccountId(''); setContactId(''); setNextDate(todayISO()); setEndDate(''); setTemplateData('{}')
  }, [open])

  async function save() {
    if (!client) return
    setSaving(true)
    try {
      let parsedTemplate = {}
      try { parsedTemplate = JSON.parse(templateData || '{}') } catch (_e) { parsedTemplate = {} }
      const contact = contacts.find((c) => c.id === contactId)
      const row = {
        name, description, transaction_type: transactionType, frequency,
        amount: Number(amount || 0),
        account_id: accountId || null,
        contact_id: contactId || null,
        contact_name: contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : null,
        next_date: nextDate, end_date: endDate || null,
        is_active: true, auto_post: false,
        template_data: parsedTemplate,
      }
      const { error } = await client.from('finance_recurring').insert(row)
      if (error) throw error
      onSaved && onSaved()
    } catch (e) { console.error(e); alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Recurring"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Create'}
          </button>
        </div>
      }
    >
      <Input label="Name" value={name} onChange={setName} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Type" value={transactionType} onChange={setTransactionType} options={RECURRING_TYPES.map((t) => ({ value: t, label: t }))} />
        <Select label="Frequency" value={frequency} onChange={setFrequency} options={FREQUENCIES.map((f) => ({ value: f, label: f }))} />
        <Input label="Amount" type="number" step="0.01" value={amount} onChange={setAmount} />
        <Select label="Account" value={accountId} onChange={setAccountId} options={accounts.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }))} />
        <Select label="Contact" value={contactId} onChange={setContactId} options={contacts.map((c) => ({ value: c.id, label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || c.id }))} />
        <Input label="Next date" type="date" value={nextDate} onChange={setNextDate} />
        <Input label="End date (optional)" type="date" value={endDate} onChange={setEndDate} />
      </div>
      <Input label="Description" value={description} onChange={setDescription} rows={2} />
      <Input label="Template data (JSON)" value={templateData} onChange={setTemplateData} rows={4} placeholder='{"line_items": [...]}' />
    </Modal>
  )
}

// ===========================================================================
//                            NEW BUDGET MODAL
// ===========================================================================
function NewBudgetModal({ open, onClose, client, accounts, onSaved }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const [periodType, setPeriodType] = useState('monthly')
  const [accountId, setAccountId] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [periods, setPeriods] = useState(Array(12).fill(0))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(''); setDescription(''); setFiscalYear(new Date().getFullYear())
    setPeriodType('monthly'); setAccountId(''); setTotalAmount('')
    setPeriods(Array(12).fill(0))
  }, [open])

  useEffect(() => {
    if (periodType === 'monthly') setPeriods(Array(12).fill(0))
    else if (periodType === 'quarterly') setPeriods(Array(4).fill(0))
    else setPeriods([0])
  }, [periodType])

  function updatePeriod(idx, value) {
    setPeriods(periods.map((p, i) => i === idx ? Number(value || 0) : p))
  }

  async function save() {
    if (!client) return
    setSaving(true)
    try {
      const sum = periods.reduce((s, p) => s + Number(p || 0), 0)
      const row = {
        name, description, fiscal_year: Number(fiscalYear), period_type: periodType,
        account_id: accountId || null,
        budget_data: { periods },
        total_amount: Number(totalAmount || sum),
        is_active: true,
      }
      const { error } = await client.from('finance_budgets').insert(row)
      if (error) throw error
      onSaved && onSaved()
    } catch (e) { console.error(e); alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  const periodLabels = periodType === 'monthly'
    ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    : periodType === 'quarterly' ? ['Q1','Q2','Q3','Q4'] : ['Year']

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Budget"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Create budget'}
          </button>
        </div>
      }
    >
      <Input label="Name" value={name} onChange={setName} />
      <div className="grid grid-cols-3 gap-3">
        <Input label="Fiscal year" type="number" value={fiscalYear} onChange={setFiscalYear} />
        <Select label="Period type" value={periodType} onChange={setPeriodType} options={PERIOD_TYPES.map((p) => ({ value: p, label: p }))} />
        <Input label="Total" type="number" step="0.01" value={totalAmount} onChange={setTotalAmount} />
      </div>
      <Select label="Account" value={accountId} onChange={setAccountId} options={accounts.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }))} />
      <Input label="Description" value={description} onChange={setDescription} rows={2} />
      <div className="border border-navy-700/50 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-navy-900/40 text-xs uppercase tracking-wider text-gray-400">Per-period amounts</div>
        <div className="grid grid-cols-4 gap-2 p-3">
          {periodLabels.map((lbl, i) => (
            <label key={lbl} className="block">
              <span className="block text-xs text-gray-400 mb-1">{lbl}</span>
              <input
                type="number"
                step="0.01"
                value={periods[i] || 0}
                onChange={(e) => updatePeriod(i, e.target.value)}
                className="w-full bg-navy-900/60 border border-navy-700/60 rounded px-2 py-1 text-xs text-white"
              />
            </label>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ===========================================================================
//                              INVOICE DRAWER
// ===========================================================================
function InvoiceDrawer({ invoice, onClose, client, payments, onChanged }) {
  const [tab, setTab] = useState('detail')
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')

  useEffect(() => { if (invoice) setTab('detail') }, [invoice])

  const myPayments = useMemo(() => (invoice ? payments.filter((p) => p.invoice_id === invoice.id) : []), [invoice, payments])

  async function markSent() {
    if (!client || !invoice) return
    try {
      await client.from('finance_invoices').update({ status: 'sent' }).eq('id', invoice.id)
      onChanged && onChanged(); onClose()
    } catch (e) { console.error(e); alert('Failed: ' + e.message) }
  }
  async function markPaid() {
    if (!client || !invoice) return
    try {
      await client.from('finance_invoices').update({ status: 'paid', amount_paid: invoice.total_amount, balance_due: 0 }).eq('id', invoice.id)
      onChanged && onChanged(); onClose()
    } catch (e) { console.error(e); alert('Failed: ' + e.message) }
  }
  async function voidInvoice() {
    if (!client || !invoice) return
    try {
      await client.from('finance_invoices').update({ status: 'void', voided_at: new Date().toISOString(), void_reason: voidReason }).eq('id', invoice.id)
      onChanged && onChanged(); onClose()
    } catch (e) { console.error(e); alert('Failed: ' + e.message) }
  }

  if (!invoice) return null

  return (
    <Drawer open onClose={onClose} title={`Invoice ${invoice.invoice_number}`}>
      <div className="flex items-center gap-2 mb-4">
        <TabBtn active={tab === 'detail'} onClick={() => setTab('detail')}>Detail</TabBtn>
        <TabBtn active={tab === 'payments'} onClick={() => setTab('payments')} count={myPayments.length}>Payments</TabBtn>
        <TabBtn active={tab === 'activity'} onClick={() => setTab('activity')}>Activity</TabBtn>
      </div>

      {tab === 'detail' && (
        <div>
          <div className="bg-navy-900/40 rounded-lg p-3 mb-4">
            <DetailRow label="Customer">{invoice.customer_name || '-'}</DetailRow>
            <DetailRow label="Invoice date">{fmtDate(invoice.invoice_date)}</DetailRow>
            <DetailRow label="Due date">{fmtDate(invoice.due_date)}</DetailRow>
            <DetailRow label="Status"><StatusBadge kind="invoice" status={invoice.status} /></DetailRow>
            <DetailRow label="Total">{fmtMoney(invoice.total_amount)}</DetailRow>
            <DetailRow label="Paid">{fmtMoney(invoice.amount_paid)}</DetailRow>
            <DetailRow label="Balance">{fmtMoney(invoice.balance_due)}</DetailRow>
          </div>
          {Array.isArray(invoice.line_items) && invoice.line_items.length > 0 && (
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Line items</div>
              <ul className="divide-y divide-navy-700/30 border border-navy-700/40 rounded-lg overflow-hidden">
                {invoice.line_items.map((it, i) => (
                  <li key={i} className="px-3 py-2 flex justify-between text-sm">
                    <span className="text-white">{it.description || '-'}</span>
                    <span className="text-gray-400">{it.qty} x {fmtMoney(it.unit_price)} = {fmtMoney(it.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {invoice.notes && <div className="text-xs text-gray-400 mb-3"><span className="uppercase">Notes: </span>{invoice.notes}</div>}
          <div className="flex flex-wrap gap-2">
            {invoice.status === 'draft' && (
              <button onClick={markSent} className="bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs px-3 py-1.5 rounded-lg">Mark Sent</button>
            )}
            {!['paid', 'void'].includes(invoice.status) && (
              <button onClick={markPaid} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-3 py-1.5 rounded-lg">Mark Paid</button>
            )}
            {!['void'].includes(invoice.status) && (
              <button onClick={() => setVoidOpen(true)} className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs px-3 py-1.5 rounded-lg">Void</button>
            )}
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div>
          <div className="flex justify-end mb-2">
            <button onClick={() => setRecordPaymentOpen(true)} className="bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg">+ Record Payment</button>
          </div>
          {myPayments.length === 0 ? (
            <EmptyState title="No payments yet" description="Record the first payment against this invoice." />
          ) : (
            <ul className="divide-y divide-navy-700/30 border border-navy-700/40 rounded-lg overflow-hidden">
              {myPayments.map((p) => (
                <li key={p.id} className="px-3 py-2 flex justify-between text-sm">
                  <div>
                    <div className="text-white">{p.payment_number}</div>
                    <div className="text-xs text-gray-500">{fmtDate(p.payment_date)} - {p.payment_method}</div>
                  </div>
                  <div className="text-emerald-400">{fmtMoney(p.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="text-xs text-gray-500">No activity recorded yet. Changes to this record will appear here.</div>
      )}

      <RecordPaymentModal
        open={recordPaymentOpen}
        onClose={() => setRecordPaymentOpen(false)}
        invoice={invoice}
        client={client}
        onSaved={() => { setRecordPaymentOpen(false); onChanged && onChanged() }}
      />

      <Modal
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        title="Void invoice"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setVoidOpen(false)} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
            <button onClick={() => { setVoidOpen(false); voidInvoice() }} className="bg-rose-500 text-white text-sm px-4 py-1.5 rounded-lg">Confirm Void</button>
          </div>
        }
      >
        <Input label="Reason" value={voidReason} onChange={setVoidReason} rows={3} placeholder="Why is this invoice being voided?" />
      </Modal>
    </Drawer>
  )
}

function RecordPaymentModal({ open, onClose, invoice, client, onSaved }) {
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayISO())
  const [method, setMethod] = useState('card')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !invoice) return
    setAmount(invoice.balance_due || ''); setPaymentDate(todayISO())
    setMethod('card'); setReference(''); setNotes('')
  }, [open, invoice])

  async function save() {
    if (!client || !invoice) return
    setSaving(true)
    try {
      const payAmt = Number(amount || 0)
      const paymentRow = {
        payment_number: genPaymentNumber(),
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        customer_name: invoice.customer_name,
        amount: payAmt,
        payment_date: paymentDate,
        payment_method: method,
        reference_number: reference,
        status: 'completed',
        notes,
      }
      const { error: pe } = await client.from('finance_payments').insert(paymentRow)
      if (pe) throw pe
      const newPaid = Number(invoice.amount_paid || 0) + payAmt
      const newBalance = Math.max(0, Number(invoice.total_amount || 0) - newPaid)
      const newStatus = newBalance <= 0 ? 'paid' : 'partial'
      const { error: ie } = await client.from('finance_invoices').update({
        amount_paid: newPaid, balance_due: newBalance, status: newStatus,
      }).eq('id', invoice.id)
      if (ie) throw ie
      onSaved && onSaved()
    } catch (e) { console.error(e); alert('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Record'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input label="Amount" type="number" step="0.01" value={amount} onChange={setAmount} />
        <Input label="Date" type="date" value={paymentDate} onChange={setPaymentDate} />
        <Select label="Method" value={method} onChange={setMethod} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
        <Input label="Reference #" value={reference} onChange={setReference} />
      </div>
      <Input label="Notes" value={notes} onChange={setNotes} rows={2} />
    </Modal>
  )
}

// ===========================================================================
//                              PAYMENT DRAWER
// ===========================================================================
function PaymentDrawer({ payment, onClose, client, invoiceById, onChanged }) {
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!payment) return
    setReference(payment.reference_number || ''); setNotes(payment.notes || '')
  }, [payment])

  if (!payment) return null
  const inv = invoiceById.get(payment.invoice_id)

  async function save() {
    if (!client) return
    setSaving(true)
    try {
      await client.from('finance_payments').update({ reference_number: reference, notes }).eq('id', payment.id)
      onChanged && onChanged(); onClose()
    } catch (e) { console.error(e); alert('Failed: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Payment ${payment.payment_number}`}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="bg-navy-900/40 rounded-lg p-3 mb-4">
        <DetailRow label="Date">{fmtDate(payment.payment_date)}</DetailRow>
        <DetailRow label="Customer">{payment.customer_name || '-'}</DetailRow>
        <DetailRow label="Invoice">{inv?.invoice_number || '-'}</DetailRow>
        <DetailRow label="Amount">{fmtMoney(payment.amount)}</DetailRow>
        <DetailRow label="Method">{payment.payment_method}</DetailRow>
        <DetailRow label="Status"><StatusBadge kind="payment" status={payment.status} /></DetailRow>
      </div>
      <Input label="Reference #" value={reference} onChange={setReference} />
      <Input label="Notes" value={notes} onChange={setNotes} rows={3} />
    </Drawer>
  )
}

// ===========================================================================
//                                BILL DRAWER
// ===========================================================================
function BillDrawer({ bill, onClose, client, onChanged }) {
  if (!bill) return null
  async function markScheduled() {
    try { await client.from('finance_bills').update({ status: 'scheduled' }).eq('id', bill.id); onChanged && onChanged(); onClose() } catch (e) { alert(e.message) }
  }
  async function markPaid() {
    try { await client.from('finance_bills').update({ status: 'paid', amount_paid: bill.total_amount, balance_due: 0 }).eq('id', bill.id); onChanged && onChanged(); onClose() } catch (e) { alert(e.message) }
  }
  async function voidBill() {
    if (!confirm('Void this bill?')) return
    try { await client.from('finance_bills').update({ status: 'void', voided_at: new Date().toISOString() }).eq('id', bill.id); onChanged && onChanged(); onClose() } catch (e) { alert(e.message) }
  }
  return (
    <Drawer open onClose={onClose} title={`Bill ${bill.bill_number}`}>
      <div className="bg-navy-900/40 rounded-lg p-3 mb-4">
        <DetailRow label="Vendor">{bill.vendor_name || '-'}</DetailRow>
        <DetailRow label="Bill date">{fmtDate(bill.bill_date)}</DetailRow>
        <DetailRow label="Due date">{fmtDate(bill.due_date)}</DetailRow>
        <DetailRow label="Status"><StatusBadge kind="bill" status={bill.status} /></DetailRow>
        <DetailRow label="Total">{fmtMoney(bill.total_amount)}</DetailRow>
        <DetailRow label="Paid">{fmtMoney(bill.amount_paid)}</DetailRow>
        <DetailRow label="Balance">{fmtMoney(bill.balance_due)}</DetailRow>
      </div>
      {Array.isArray(bill.line_items) && bill.line_items.length > 0 && (
        <div className="mb-4">
          <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Line items</div>
          <ul className="divide-y divide-navy-700/30 border border-navy-700/40 rounded-lg overflow-hidden">
            {bill.line_items.map((it, i) => (
              <li key={i} className="px-3 py-2 flex justify-between text-sm">
                <span className="text-white">{it.description || '-'}</span>
                <span className="text-gray-400">{it.qty} x {fmtMoney(it.unit_price)} = {fmtMoney(it.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {bill.notes && <div className="text-xs text-gray-400 mb-3"><span className="uppercase">Notes: </span>{bill.notes}</div>}
      <div className="flex flex-wrap gap-2">
        {['draft', 'received'].includes(bill.status) && (
          <button onClick={markScheduled} className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-3 py-1.5 rounded-lg">Mark Scheduled</button>
        )}
        {!['paid', 'void'].includes(bill.status) && (
          <button onClick={markPaid} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-3 py-1.5 rounded-lg">Mark Paid</button>
        )}
        {!['void'].includes(bill.status) && (
          <button onClick={voidBill} className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs px-3 py-1.5 rounded-lg">Void</button>
        )}
      </div>
    </Drawer>
  )
}

// ===========================================================================
//                              EXPENSE DRAWER
// ===========================================================================
function ExpenseDrawer({ expense, onClose, client, accountById, onChanged }) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!expense) return
    setDescription(expense.description || ''); setCategory(expense.category || '')
    setAmount(expense.amount ?? ''); setExpenseDate(expense.expense_date?.slice(0, 10) || '')
    setVendorName(expense.vendor_name || ''); setReceiptUrl(expense.receipt_url || '')
    setNotes(expense.notes || '')
  }, [expense])

  if (!expense) return null
  const acct = accountById.get(expense.account_id)

  async function save() {
    setSaving(true)
    try {
      await client.from('finance_expenses').update({
        description, category, amount: Number(amount || 0),
        expense_date: expenseDate, vendor_name: vendorName,
        receipt_url: receiptUrl || null, notes,
      }).eq('id', expense.id)
      onChanged && onChanged(); onClose()
    } catch (e) { console.error(e); alert('Failed: ' + e.message) }
    finally { setSaving(false) }
  }
  async function approve() {
    try { await client.from('finance_expenses').update({ status: 'approved' }).eq('id', expense.id); onChanged && onChanged(); onClose() } catch (e) { alert(e.message) }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Expense"
      footer={
        <div className="flex justify-end gap-2">
          {expense.status === 'pending' && (
            <button onClick={approve} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-sm px-3 py-1.5 rounded-lg">Approve</button>
          )}
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="bg-navy-900/40 rounded-lg p-3 mb-4">
        <DetailRow label="Account">{acct ? `${acct.code} - ${acct.name}` : '-'}</DetailRow>
        <DetailRow label="Status"><StatusBadge kind="expense" status={expense.status} /></DetailRow>
      </div>
      <Input label="Description" value={description} onChange={setDescription} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Category" value={category} onChange={setCategory} />
        <Input label="Amount" type="number" step="0.01" value={amount} onChange={setAmount} />
        <Input label="Date" type="date" value={expenseDate} onChange={setExpenseDate} />
        <Input label="Vendor" value={vendorName} onChange={setVendorName} />
      </div>
      <Input label="Receipt URL" value={receiptUrl} onChange={setReceiptUrl} />
      <Input label="Notes" value={notes} onChange={setNotes} rows={3} />
    </Drawer>
  )
}

// ===========================================================================
//                              ACCOUNT DRAWER
// ===========================================================================
function AccountDrawer({ account, onClose, client, onChanged }) {
  const [isActive, setIsActive] = useState(true)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!account) return
    setIsActive(account.is_active !== false); setDescription(account.description || '')
  }, [account])

  if (!account) return null

  async function save() {
    setSaving(true)
    try {
      await client.from('finance_accounts').update({ is_active: isActive, description }).eq('id', account.id)
      onChanged && onChanged(); onClose()
    } catch (e) { console.error(e); alert('Failed: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`${account.code} - ${account.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="bg-navy-900/40 rounded-lg p-3 mb-4">
        <DetailRow label="Type">{account.account_type}</DetailRow>
        <DetailRow label="Sub-type">{account.sub_type || '-'}</DetailRow>
        <DetailRow label="Normal balance">{account.normal_balance || '-'}</DetailRow>
        <DetailRow label="Current balance">{fmtMoney(account.current_balance)}</DetailRow>
        <DetailRow label="As of">{fmtDate(account.balance_as_of)}</DetailRow>
        <DetailRow label="System">{account.is_system ? 'yes' : 'no'}</DetailRow>
      </div>
      <Select label="Active" value={isActive ? 'true' : 'false'} onChange={(v) => setIsActive(v === 'true')} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} />
      <Input label="Description" value={description} onChange={setDescription} rows={3} />
      <div className="text-xs text-gray-500 mt-4">Transactions for this account will appear here as they post.</div>
    </Drawer>
  )
}

// ===========================================================================
//                           RECURRING DRAWER
// ===========================================================================
function RecurringDrawer({ rec, onClose, client, onChanged }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!rec) return
    setName(rec.name || ''); setAmount(rec.amount ?? '')
    setNextDate(rec.next_date?.slice(0, 10) || '')
    setEndDate(rec.end_date?.slice(0, 10) || '')
    setIsActive(rec.is_active !== false)
  }, [rec])

  if (!rec) return null

  async function save() {
    setSaving(true)
    try {
      await client.from('finance_recurring').update({
        name, amount: Number(amount || 0), next_date: nextDate,
        end_date: endDate || null, is_active: isActive,
      }).eq('id', rec.id)
      onChanged && onChanged(); onClose()
    } catch (e) { console.error(e); alert('Failed: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Recurring"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="bg-navy-900/40 rounded-lg p-3 mb-4">
        <DetailRow label="Type">{rec.transaction_type}</DetailRow>
        <DetailRow label="Frequency">{rec.frequency}</DetailRow>
        <DetailRow label="Last generated">{fmtDate(rec.last_generated_at)}</DetailRow>
      </div>
      <Input label="Name" value={name} onChange={setName} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Amount" type="number" step="0.01" value={amount} onChange={setAmount} />
        <Select label="Active" value={isActive ? 'true' : 'false'} onChange={(v) => setIsActive(v === 'true')} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} />
        <Input label="Next date" type="date" value={nextDate} onChange={setNextDate} />
        <Input label="End date" type="date" value={endDate} onChange={setEndDate} />
      </div>
      <div className="text-xs text-gray-500 mt-4">Automatic recurring generation is coming soon. You can add entries manually for now.</div>
    </Drawer>
  )
}

// ===========================================================================
//                            BUDGET DRAWER
// ===========================================================================
function BudgetDrawer({ budget, onClose, client, accountById, expenses, onChanged }) {
  const [name, setName] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!budget) return
    setName(budget.name || ''); setTotalAmount(budget.total_amount ?? '')
    setIsActive(budget.is_active !== false)
  }, [budget])

  if (!budget) return null

  const acct = accountById.get(budget.account_id)
  const periods = (budget.budget_data && Array.isArray(budget.budget_data.periods)) ? budget.budget_data.periods : []
  const labels = budget.period_type === 'monthly'
    ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    : budget.period_type === 'quarterly' ? ['Q1','Q2','Q3','Q4'] : ['Year']

  async function save() {
    setSaving(true)
    try {
      await client.from('finance_budgets').update({
        name, total_amount: Number(totalAmount || 0), is_active: isActive,
      }).eq('id', budget.id)
      onChanged && onChanged(); onClose()
    } catch (e) { console.error(e); alert('Failed: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={budget.name}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
          <button disabled={saving} onClick={save} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="bg-navy-900/40 rounded-lg p-3 mb-4">
        <DetailRow label="Account">{acct ? `${acct.code} - ${acct.name}` : '-'}</DetailRow>
        <DetailRow label="Fiscal year">{budget.fiscal_year}</DetailRow>
        <DetailRow label="Period type">{budget.period_type}</DetailRow>
      </div>
      <Input label="Name" value={name} onChange={setName} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Total" type="number" step="0.01" value={totalAmount} onChange={setTotalAmount} />
        <Select label="Active" value={isActive ? 'true' : 'false'} onChange={(v) => setIsActive(v === 'true')} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} />
      </div>
      {periods.length > 0 && (
        <div className="border border-navy-700/50 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-navy-900/40 text-xs uppercase tracking-wider text-gray-400">Periods</div>
          <ul className="divide-y divide-navy-700/30">
            {periods.map((p, i) => (
              <li key={i} className="px-3 py-2 flex justify-between text-sm">
                <span className="text-gray-400">{labels[i] || `Period ${i + 1}`}</span>
                <span className="text-white">{fmtMoney(p)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  )
}
