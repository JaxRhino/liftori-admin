import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'customer')
        .order('created_at', { ascending: false })

      if (error) throw error

      const customerIds = (profiles || []).map(p => p.id)
      const { data: projects } = await supabase
        .from('projects')
        .select('customer_id, status')
        .in('customer_id', customerIds)

      const projectMap = {}
      ;(projects || []).forEach(p => {
        if (!projectMap[p.customer_id]) projectMap[p.customer_id] = []
        projectMap[p.customer_id].push(p)
      })

      setCustomers((profiles || []).map(p => ({
        ...p,
        projects: projectMap[p.id] || []
      })))
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-gray-400 text-sm mt-1">{customers.length} total customers</p>
        </div>
        <Link to="/waitlist" className="btn-primary">Convert from Waitlist</Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <div className="card text-center py-16">
          <h3 className="text-lg font-semibold text-white mb-2">No customers yet</h3>
          <p className="text-gray-400 text-sm mb-6">Convert waitlist signups to create customer accounts.</p>
          <Link to="/waitlist" className="btn-primary inline-flex">Go to Waitlist</Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-700/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projects</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="px-4 py-3 text-sm font-medium text-white">{c.full_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{c.email}</td>
                  <td className="px-4 py-3 text-sm text-white">{c.projects.length}</td>
                  <td className="px-4 py-3 text-sm text-white">
                    {c.projects.filter(p => !['Launched', 'Cancelled', 'On Hold'].includes(p.status)).length}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
