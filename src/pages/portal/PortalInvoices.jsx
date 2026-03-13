import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

export default function PortalInvoices() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchInvoices()
  }, [user])

  async function fetchInvoices() {
    try {
      const { data } = await supabase
        .from('invoices')
        .select('*, projects(name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      setInvoices(data || [])
    } catch (err) {
      console.error('Error fetching invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  function getStatusBadge(status) {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      paid: 'bg-green-500/20 text-green-400',
      overdue: 'bg-red-500/20 text-red-400',
      cancelled: 'bg-gray-500/20 text-gray-500'
    }
    return styles[status] || styles.pending
  }

  function formatCurrency(cents) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100)
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount_cents, 0)
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount_cents, 0)
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.amount_cents, 0)

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Invoices & Billing</h1>
        <p className="text-gray-400 text-sm mt-1">View payment history and outstanding invoices</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Paid</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{formatCurrency(totalPending)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overdue</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{formatCurrency(totalOverdue)}</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-400">No invoices yet</h2>
          <p className="text-gray-600 text-sm mt-2">Invoices will appear here when your project milestones trigger payments</p>
        </div>
      ) : (
        <div className="card overflow-hidden !p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-700/50 text-left">
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Project</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="table-row">
                  <td className="px-6 py-4">
                    <p className="text-sm text-white">{inv.description}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{formatDate(inv.created_at)}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{inv.projects?.name || '—'}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-white">{formatCurrency(inv.amount_cents)}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${getStatusBadge(inv.status)}`}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{formatDate(inv.due_date)}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{formatDate(inv.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
