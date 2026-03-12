import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSignups: 0,
    todaySignups: 0,
    totalProjects: 0,
    activeProjects: 0,
    totalAffiliates: 0,
    totalCustomers: 0
  })
  const [recentSignups, setRecentSignups] = useState([])
  const [recentProjects, setRecentProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      const today = new Date().toISOString().split('T')[0]

      const [
        { count: totalSignups },
        { count: todaySignups },
        { count: totalProjects },
        { count: activeProjects },
        { count: totalAffiliates },
        { count: totalCustomers },
        { data: signups },
        { data: projects }
      ] = await Promise.all([
        supabase.from('waitlist_signups').select('*', { count: 'exact', head: true }),
        supabase.from('waitlist_signups').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }).in('status', ['In Build', 'QA', 'Design Approval', 'Brief Review']),
        supabase.from('affiliates').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('waitlist_signups').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('projects').select('*, profiles!projects_customer_id_fkey(full_name, email)').order('created_at', { ascending: false }).limit(5)
      ])

      setStats({
        totalSignups: totalSignups || 0,
        todaySignups: todaySignups || 0,
        totalProjects: totalProjects || 0,
        activeProjects: activeProjects || 0,
        totalAffiliates: totalAffiliates || 0,
        totalCustomers: totalCustomers || 0
      })
      setRecentSignups(signups || [])
      setRecentProjects(projects || [])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Overview of your Liftori operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Waitlist" value={stats.totalSignups} color="blue" />
        <StatCard label="Today" value={stats.todaySignups} color="cyan" />
        <StatCard label="Projects" value={stats.totalProjects} color="purple" />
        <StatCard label="Active Builds" value={stats.activeProjects} color="green" />
        <StatCard label="Affiliates" value={stats.totalAffiliates} color="orange" />
        <StatCard label="Customers" value={stats.totalCustomers} color="pink" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Waitlist Signups */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Signups</h2>
            <Link to="/admin/waitlist" className="text-brand-blue text-sm hover:underline">View all</Link>
          </div>
          {recentSignups.length === 0 ? (
            <p className="text-gray-500 text-sm">No signups yet</p>
          ) : (
            <div className="space-y-3">
              {recentSignups.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-navy-700/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{s.full_name || 'Anonymous'}</p>
                    <p className="text-xs text-gray-500">{s.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{new Date(s.created_at).toLocaleDateString()}</p>
                    {s.referral_code && (
                      <span className="badge bg-brand-blue/10 text-brand-blue mt-1">ref: {s.referral_code}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Projects */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Projects</h2>
            <Link to="/admin/projects" className="text-brand-blue text-sm hover:underline">View all</Link>
          </div>
          {recentProjects.length === 0 ? (
            <p className="text-gray-500 text-sm">No projects yet. <Link to="/admin/waitlist" className="text-brand-blue hover:underline">Convert a waitlist signup</Link> to get started.</p>
          ) : (
            <div className="space-y-3">
              {recentProjects.map(p => (
                <Link key={p.id} to={`/admin/projects/${p.id}`} className="flex items-center justify-between py-2 border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20 -mx-2 px-2 rounded-lg transition-colors">
                  <div>
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.profiles?.full_name || 'Unassigned'}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colorMap = {
    blue: 'text-brand-blue',
    cyan: 'text-brand-cyan',
    purple: 'text-purple-400',
    green: 'text-emerald-400',
    orange: 'text-orange-400',
    pink: 'text-pink-400'
  }

  return (
    <div className="stat-card">
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] || 'text-white'}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  const statusColors = {
    'Wizard Complete': 'bg-gray-500/20 text-gray-400',
    'Brief Review': 'bg-yellow-500/20 text-yellow-400',
    'Design Approval': 'bg-purple-500/20 text-purple-400',
    'In Build': 'bg-brand-blue/20 text-brand-blue',
    'QA': 'bg-orange-500/20 text-orange-400',
    'Launched': 'bg-emerald-500/20 text-emerald-400',
    'On Hold': 'bg-gray-500/20 text-gray-500',
    'Cancelled': 'bg-red-500/20 text-red-400'
  }

  return (
    <span className={`badge ${statusColors[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status}
    </span>
  )
}
