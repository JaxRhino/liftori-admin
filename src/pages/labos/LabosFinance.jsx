import { useEffect, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useLabosClient } from './_shared'

export default function LabosFinance() {
  const { client } = useLabosClient()
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!client) return
    async function load() {
      setLoading(true)
      const [{ data: inv }, { data: exp }] = await Promise.all([
        client.from('invoices').select('*').order('created_at', { ascending: false }).limit(25),
        client.from('expenses').select('*').order('expense_date', { ascending: false }).limit(25),
      ])
      setInvoices(inv || [])
      setExpenses(exp || [])
      setLoading(false)
    }
    load()
  }, [client])

  const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total || 0), 0)
  const outstanding = invoices.filter(i => ['sent','overdue'].includes(i.status)).reduce((s, i) => s + Number(i.total || 0), 0)
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const net = paid - expenseTotal

  return (
    <HubPage title="Finance" subtitle="Invoices, expenses, cash flow">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Paid (total)" value={`$${paid.toLocaleString(undefined,{minimumFractionDigits:2})}`} accent="text-emerald-400" />
        <StatCard label="Outstanding" value={`$${outstanding.toLocaleString(undefined,{minimumFractionDigits:2})}`} accent="text-amber-400" />
        <StatCard label="Expenses" value={`$${expenseTotal.toLocaleString(undefined,{minimumFractionDigits:2})}`} accent="text-red-400" />
        <StatCard label="Net" value={`$${net.toLocaleString(undefined,{minimumFractionDigits:2})}`} accent={net >= 0 ? 'text-brand-cyan' : 'text-red-400'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Invoices">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading...</div>
          ) : invoices.length === 0 ? (
            <EmptyState title="No invoices yet" description="Create an invoice to bill a customer." />
          ) : (
            <ul className="divide-y divide-navy-700/50">
              {invoices.slice(0, 10).map(i => (
                <li key={i.id} className="px-5 py-3">
                  <div className="flex justify-between">
                    <div className="text-sm text-white font-medium">{i.invoice_number}</div>
                    <span className="text-xs text-gray-400 capitalize">{i.status}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{i.customer_name} · ${Number(i.total).toFixed(2)}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Expenses">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading...</div>
          ) : expenses.length === 0 ? (
            <EmptyState title="No expenses logged" description="Track business expenses to see net cash flow." />
          ) : (
            <ul className="divide-y divide-navy-700/50">
              {expenses.slice(0, 10).map(e => (
                <li key={e.id} className="px-5 py-3 flex justify-between">
                  <div>
                    <div className="text-sm text-white">{e.vendor}</div>
                    <div className="text-xs text-gray-500">{e.category || '—'} · {new Date(e.expense_date).toLocaleDateString()}</div>
                  </div>
                  <div className="text-sm text-red-400">-${Number(e.amount).toFixed(2)}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </HubPage>
  )
}
