// =====================================================================
// OperationsTeam — invite and manage the customer's team.
// Each teammate gets their own login (Wave B finalizes magic-link delivery).
// Live: reads profiles + writes team_invites. Copy-link is functional,
// email delivery ships with the auth-bridge edge function.
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import { Users, Plus, Mail, X, Check, Copy, MoreHorizontal, Shield, Briefcase, Package, Truck, Eye, Clock, Trash2 } from 'lucide-react'
import { HubPage, useLabosClient } from '../_shared'

const ROLES = [
  { key: 'owner', label: 'Owner', description: 'Full access to everything', icon: Shield, tone: 'amber' },
  { key: 'manager', label: 'Manager', description: 'Run the shop — edit all listings, orders, and team', icon: Briefcase, tone: 'blue' },
  { key: 'lister', label: 'Lister', description: 'Create and edit listings', icon: Package, tone: 'purple' },
  { key: 'packer', label: 'Packer', description: 'View orders, print labels, mark as shipped', icon: Truck, tone: 'sky' },
  { key: 'viewer', label: 'Viewer', description: 'Read-only access to dashboards and reports', icon: Eye, tone: 'gray' },
]

const ROLE_TONE = {
  owner: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  manager: 'bg-brand-blue/15 text-brand-blue border-brand-blue/30',
  lister: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  packer: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  staff: 'bg-navy-700 text-gray-300 border-navy-600',
  admin: 'bg-brand-blue/15 text-brand-blue border-brand-blue/30',
  viewer: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
}

export default function OperationsTeam() {
  const { client, platform } = useLabosClient()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  async function load() {
    if (!client) return
    setLoading(true)
    const [m, i] = await Promise.all([
      client.from('profiles').select('*').order('created_at', { ascending: true }),
      client.from('team_invites').select('*').order('invited_at', { ascending: false }),
    ])
    setMembers(m.data || [])
    setInvites(i.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [client])

  const pendingInvites = useMemo(() => invites.filter(i => i.status === 'pending' && new Date(i.expires_at) > new Date()), [invites])
  const historyInvites = useMemo(() => invites.filter(i => i.status !== 'pending' || new Date(i.expires_at) <= new Date()), [invites])

  async function revokeInvite(inviteId) {
    await client.from('team_invites').update({ status: 'revoked' }).eq('id', inviteId)
    load()
  }

  return (
    <HubPage
      title="Team"
      subtitle="Invite the people who help you run the shop. Each teammate gets their own login."
      actions={
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Invite Teammate
        </button>
      }
    >
      {/* Role legend */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mb-6">
        {ROLES.map(r => {
          const Icon = r.icon
          return (
            <div key={r.key} className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-white font-medium">{r.label}</div>
                <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{r.description}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Active members */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" />
            Active Teammates
            <span className="text-xs text-gray-500 font-normal">({members.length})</span>
          </h3>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-navy-800 border border-navy-700/50 rounded-xl animate-pulse" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-8 text-center">
            <Users className="w-8 h-8 mx-auto text-gray-600 mb-2" />
            <div className="text-sm text-gray-400">No teammates yet — just you running the shop.</div>
            <button
              onClick={() => setShowInvite(true)}
              className="mt-3 inline-flex items-center gap-2 text-brand-blue hover:text-brand-cyan text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Invite your first teammate
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map(m => <MemberCard key={m.id} member={m} />)}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="mb-6">
          <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            Pending Invites
            <span className="text-xs text-gray-500 font-normal">({pendingInvites.length})</span>
          </h3>
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
            <ul className="divide-y divide-navy-700/50">
              {pendingInvites.map(inv => (
                <InviteRow key={inv.id} invite={inv} onRevoke={() => revokeInvite(inv.id)} platform={platform} />
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Invite history */}
      {historyInvites.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-300 font-medium mb-2">
            Invite history ({historyInvites.length})
          </summary>
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden mt-2">
            <ul className="divide-y divide-navy-700/50">
              {historyInvites.slice(0, 10).map(inv => (
                <li key={inv.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-300">{inv.email}</span>
                    <span className="text-gray-600 mx-2">·</span>
                    <span className="text-gray-500 capitalize">{inv.role}</span>
                  </div>
                  <span className="text-gray-500 capitalize">{inv.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {showInvite && (
        <InviteModal
          client={client}
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); load() }}
        />
      )}
    </HubPage>
  )
}

function MemberCard({ member }) {
  const initials = (member.full_name || member.email || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  const roleTone = ROLE_TONE[member.role] || ROLE_TONE.staff
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
        {member.avatar_url ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" /> : initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-white font-medium truncate">{member.full_name || member.email}</div>
        <div className="text-xs text-gray-500 truncate">{member.email}</div>
        {member.role && (
          <span className={`inline-block mt-1.5 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${roleTone}`}>
            {member.role}
          </span>
        )}
      </div>
    </div>
  )
}

function InviteRow({ invite, onRevoke, platform }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://admin.liftori.ai'
  const link = `${origin}/invite/${invite.token}?platform=${platform?.id || ''}`

  function copy() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const daysLeft = Math.max(0, Math.floor((new Date(invite.expires_at) - Date.now()) / (1000 * 60 * 60 * 24)))
  const roleTone = ROLE_TONE[invite.role] || ROLE_TONE.staff

  return (
    <li className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-full bg-navy-700/60 flex items-center justify-center text-gray-400">
          <Mail className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-white font-medium truncate">{invite.full_name || invite.email}</div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 truncate">{invite.email}</span>
            <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${roleTone}`}>{invite.role}</span>
            <span className="text-xs text-gray-500">Expires in {daysLeft}d</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-navy-700/60 hover:bg-navy-700 text-gray-300 hover:text-white rounded-lg transition-colors"
        >
          {copied ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy link</>}
        </button>
        <button
          onClick={onRevoke}
          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Revoke invite"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  )
}

function InviteModal({ client, onClose, onInvited }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('lister')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    if (!email.trim() || !email.includes('@')) { setError('Valid email required'); return }
    setSaving(true)
    setError('')
    try {
      const { data: { user } } = await client.auth.getUser()
      const { error: e } = await client.from('team_invites').insert({
        email: email.trim().toLowerCase(),
        full_name: fullName.trim() || null,
        role,
        message: message.trim() || null,
        invited_by: user?.id || null,
      })
      if (e) throw e
      onInvited()
    } catch (e) {
      setError(e.message || 'Failed to create invite')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-navy-900 border border-navy-700/50 rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-navy-700/50 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">Invite a teammate</h2>
            <p className="text-xs text-gray-500 mt-0.5">They'll get their own login once they accept.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-navy-800 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <Label>Email *</Label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="teammate@example.com"
              className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
            />
          </div>

          <div>
            <Label>Name <span className="text-gray-500 font-normal">(optional)</span></Label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Alex Rivera"
              className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
            />
          </div>

          <div>
            <Label>Role</Label>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map(r => {
                const Icon = r.icon
                const active = role === r.key
                return (
                  <button
                    key={r.key}
                    onClick={() => setRole(r.key)}
                    className={`flex items-start gap-3 text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      active ? 'bg-brand-blue/10 border-brand-blue/50' : 'bg-navy-800 border-navy-700/50 hover:border-navy-600'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? 'text-brand-blue' : 'text-gray-400'}`} />
                    <div>
                      <div className={`text-sm font-medium ${active ? 'text-white' : 'text-gray-300'}`}>{r.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{r.description}</div>
                    </div>
                    {active && <Check className="w-4 h-4 text-brand-blue ml-auto mt-0.5" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label>Personal message <span className="text-gray-500 font-normal">(optional)</span></Label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={2}
              placeholder="Welcome aboard! Excited to have you help run the shop."
              className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50 resize-y"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3 text-xs text-amber-200/80 flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Invite lands in the pending queue with a 14-day expiry. Copy the invite link to share with them directly.
              Email delivery + magic-link login ships in the next update.
            </span>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-navy-700/50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={send}
            disabled={saving || !email.trim()}
            className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            {saving ? 'Creating...' : <><Mail className="w-4 h-4" />Send Invite</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function Label({ children }) {
  return <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">{children}</label>
}
