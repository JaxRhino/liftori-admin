import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Dropdown for picking a Liftori internal team member.
 * Filters out customers, testers, and pending_testers.
 *
 * Props:
 *  - value: current uuid (or null/empty for unassigned)
 *  - onChange(uuid|null): handler
 *  - placeholder: text shown when nothing is selected (e.g., "Sales rep…")
 *  - className: optional override
 *  - disabled: optional
 */

const INTERNAL_ROLES = ['admin', 'super_admin', 'dev', 'sales_director', 'sales_rep', 'consultant', 'call_agent']

let _cachedMembers = null
let _cachedAt = 0
const CACHE_MS = 60_000

async function fetchInternalTeam() {
  // Return cached list within 60s to avoid hammering the DB when many dropdowns mount.
  if (_cachedMembers && Date.now() - _cachedAt < CACHE_MS) {
    return _cachedMembers
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, title, avatar_url')
    .in('role', INTERNAL_ROLES)
    .order('full_name', { ascending: true, nullsFirst: false })
  if (error) {
    console.error('[TeamMemberSelect]', error)
    return []
  }
  _cachedMembers = data || []
  _cachedAt = Date.now()
  return _cachedMembers
}

export function invalidateTeamMemberCache() {
  _cachedMembers = null
  _cachedAt = 0
}

export default function TeamMemberSelect({ value, onChange, placeholder = 'Unassigned', className = '', disabled = false }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetchInternalTeam().then((list) => {
      if (mounted) {
        setMembers(list)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  const baseCls =
    'w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50'

  // Option styling — forces dark popup menu instead of browser-default white.
  const optCls = 'bg-slate-800 text-white'

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled || loading}
      className={`${baseCls} ${className}`}
    >
      <option value="" className={optCls}>
        {loading ? 'Loading team…' : `— ${placeholder} —`}
      </option>
      {members.map((m) => {
        const label = m.full_name || m.email || m.id.slice(0, 8)
        const tag = m.title || m.role
        return (
          <option key={m.id} value={m.id} className={optCls}>
            {label}{tag ? ` · ${tag}` : ''}
          </option>
        )
      })}
    </select>
  )
}

/**
 * Read-only display of an assigned team member by user_id.
 * Useful in detail panels / list views where we want a label, not a select.
 */
export function TeamMemberLabel({ userId, fallback = 'Unassigned', className = '' }) {
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(!!userId)
  useEffect(() => {
    let mounted = true
    if (!userId) { setMember(null); setLoading(false); return }
    fetchInternalTeam().then((list) => {
      if (mounted) {
        setMember(list.find((m) => m.id === userId) || null)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [userId])
  if (loading) return <span className={`text-gray-500 ${className}`}>…</span>
  if (!member) return <span className={`text-gray-500 italic ${className}`}>{fallback}</span>
  return (
    <span className={`text-white ${className}`}>
      {member.full_name || member.email}
      {member.title && <span className="text-gray-500 text-xs ml-1">· {member.title}</span>}
    </span>
  )
}
