import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import {
  fetchPeriods,
  fetchPeriodAllocations,
  fetchEnrollments,
  enrollTester,
  endEnrollment,
  createPeriod,
  closePeriod,
  markPeriodPaid,
  markAllocationPaid,
  formatCurrency,
  formatDuration,
} from '../../lib/timeTrackingService'
import InviteTesterModal from './InviteTesterModal'

const STATUS_COLORS = {
  open: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  closed: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  cancelled: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

export default function CommissionsTab({ userId, userLookup, isSuperAdmin }) {
  const [periods, setPeriods] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [allocations, setAllocations] = useState([])
  const [showNewPeriod, setShowNewPeriod] = useState(false)
  const [showEnroll, setShowEnroll] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, e] = await Promise.all([fetchPeriods({ limit: 24 }), fetchEnrollments()])
      setPeriods(p)
      setEnrollments(e)
      if (p.length && !selectedPeriod) setSelectedPeriod(p[0])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load commissions')
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod])

  useEffect(() => { load() }, []) // eslint-disable-line

  useEffect(() => {
    if (!selectedPeriod?.id) { setAllocations([]); return }
    fetchPeriodAllocations(selectedPeriod.id).then(setAllocations).catch(console.error)
  }, [selectedPeriod?.id])

  async function handleClose() {
    if (!selectedPeriod || !window.confirm('Close this period and compute payouts?')) return
    try {
      await closePeriod(selectedPeriod.id, userId)
      toast.success('Period closed')
      load()
    } catch {
      toast.error('Close failed')
    }
  }

  async function handleMarkPaid() {
    if (!selectedPeriod || !window.confirm('Mark entire period paid?')) return
    try {
      await markPeriodPaid(selectedPeriod.id)
      toast.success('Period marked paid')
      load()
    } catch {
      toast.error('Update failed')
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500 py-8 text-center">Loading commissions…</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Periods list */}
      <div className="lg:col-span-1 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">Periods</h3>
          {isSuperAdmin && (
            <button
              onClick={() => setShowNewPeriod(true)}
              className="text-xs px-2.5 py-1 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue rounded-md font-medium"
            >
              + New
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {periods.length === 0 && (
            <div className="text-xs text-gray-500 italic">No periods yet. Click + New to create the first one.</div>
          )}
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPeriod(p)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedPeriod?.id === p.id
                  ? 'bg-navy-800 border-brand-blue/50'
                  : 'bg-navy-800/40 border-navy-700/40 hover:bg-navy-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">
                  {p.period_start} → {p.period_end}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold border ${STATUS_COLORS[p.status]}`}>
                  {p.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Pool: <span className="text-emerald-400 font-semibold">{formatCurrency(p.pool_amount)}</span></span>
                <span className="text-gray-500">{p.qualifying_tester_count || 0} qual.</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Period detail */}
      <div className="lg:col-span-2 space-y-3">
        {selectedPeriod ? (
          <>
            <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Period detail</div>
                  <div className="text-lg font-bold">{selectedPeriod.period_start} → {selectedPeriod.period_end}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded uppercase font-semibold border ${STATUS_COLORS[selectedPeriod.status]}`}>
                  {selectedPeriod.status}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Net profit" value={formatCurrency(selectedPeriod.net_profit)} />
                <Metric label="Rate" value={`${(Number(selectedPeriod.commission_rate) * 100).toFixed(1)}%`} />
                <Metric label="Pool" value={formatCurrency(selectedPeriod.pool_amount)} />
                <Metric label="Per tester" value={formatCurrency(selectedPeriod.per_tester_amount || 0)} />
              </div>
              {isSuperAdmin && (
                <div className="flex items-center gap-2 pt-2 border-t border-navy-700/50">
                  {selectedPeriod.status === 'open' && (
                    <button onClick={handleClose} className="px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 rounded-md text-xs font-medium">
                      Close period (compute splits)
                    </button>
                  )}
                  {selectedPeriod.status === 'closed' && (
                    <button onClick={handleMarkPaid} className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-md text-xs font-medium">
                      Mark period paid
                    </button>
                  )}
                  <span className="text-xs text-gray-500 ml-auto">
                    Min hours to qualify: {selectedPeriod.min_hours_to_qualify}
                  </span>
                </div>
              )}
              {selectedPeriod.notes && (
                <div className="text-xs text-gray-400 italic border-t border-navy-700/50 pt-2">{selectedPeriod.notes}</div>
              )}
            </div>

            {/* Allocations */}
            <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-navy-700/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">Allocations ({allocations.length})</h3>
              </div>
              <table className="w-full">
                <thead className="bg-navy-800">
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2 font-semibold">Tester</th>
                    <th className="px-4 py-2 font-semibold">Hours</th>
                    <th className="px-4 py-2 font-semibold">Qualified</th>
                    <th className="px-4 py-2 font-semibold">Share</th>
                    <th className="px-4 py-2 font-semibold">Paid</th>
                    {isSuperAdmin && <th className="px-4 py-2 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700/40">
                  {allocations.length === 0 ? (
                    <tr><td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-8 text-center text-sm text-gray-500">
                      {selectedPeriod.status === 'open' ? 'Close the period to compute allocations.' : 'No allocations.'}
                    </td></tr>
                  ) : (
                    allocations.map((a) => (
                      <AllocationRow
                        key={a.id}
                        allocation={a}
                        userLookup={userLookup}
                        isSuperAdmin={isSuperAdmin}
                        onChanged={() => fetchPeriodAllocations(selectedPeriod.id).then(setAllocations)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500 py-12 text-center">Select a period.</div>
        )}
      </div>

      {/* Active enrollments at the bottom */}
      {isSuperAdmin && (
        <div className="lg:col-span-3 bg-navy-800/50 border border-navy-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-gray-300">Active testers ({enrollments.length})</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInvite(true)}
                className="text-xs px-2.5 py-1 bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/40 text-pink-300 rounded-md font-medium"
                title="Invite a new tester via Sage email"
              >
                + Invite tester (email)
              </button>
              <button
                onClick={() => setShowEnroll(true)}
                className="text-xs px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-md font-medium"
                title="Enroll an existing team member directly"
              >
                + Enroll existing
              </button>
            </div>
          </div>
          {enrollments.length === 0 ? (
            <div className="text-xs text-gray-500 italic">No active testers. Click + Enroll tester to add the first.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {enrollments.map((e) => (
                <EnrollmentRow
                  key={e.id}
                  enrollment={e}
                  user={userLookup[e.user_id]}
                  onChanged={load}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showNewPeriod && (
        <NewPeriodModal userId={userId} onClose={() => setShowNewPeriod(false)} onCreated={() => { setShowNewPeriod(false); load() }} />
      )}
      {showEnroll && (
        <EnrollTesterModal
          userId={userId}
          existingEnrollments={enrollments}
          onClose={() => setShowEnroll(false)}
          onEnrolled={() => { setShowEnroll(false); load() }}
        />
      )}
      {showInvite && (
        <InviteTesterModal
          invitedBy={userId}
          onClose={() => setShowInvite(false)}
          onCreated={() => { setShowInvite(false); load() }}
        />
      )}
    </div>
  )
}

function EnrollmentRow({ enrollment, user, onChanged }) {
  const [busy, setBusy] = useState(false)
  async function unenroll() {
    if (!window.confirm(`End ${user?.full_name || user?.email || 'this tester'}'s enrollment? They will stop accruing commission from now.`)) return
    setBusy(true)
    try {
      await endEnrollment(enrollment.id)
      toast.success('Enrollment ended')
      onChanged()
    } catch {
      toast.error('Update failed')
    } finally { setBusy(false) }
  }
  return (
    <div className="flex items-center justify-between p-2 bg-navy-900/40 rounded">
      <div>
        <div className="text-sm text-white">{user?.full_name || user?.email || enrollment.user_id.slice(0, 8)}</div>
        <div className="text-[10px] text-gray-500">
          Enrolled {new Date(enrollment.enrolled_at).toLocaleDateString()} · rate {(Number(enrollment.commission_rate) * 100).toFixed(1)}% · min {enrollment.min_hours_per_period}h
        </div>
      </div>
      <button
        onClick={unenroll}
        disabled={busy}
        className="text-[10px] text-gray-500 hover:text-rose-400 disabled:opacity-50"
        title="End enrollment"
      >
        End
      </button>
    </div>
  )
}

function EnrollTesterModal({ userId, existingEnrollments, onClose, onEnrolled }) {
  const [profiles, setProfiles] = useState([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [rate, setRate] = useState('0.05')
  const [minHours, setMinHours] = useState('10')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const enrolledIds = new Set(existingEnrollments.map((e) => e.user_id))
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, title, avatar_url')
          .neq('role', 'customer')
          .order('full_name', { ascending: true })
        if (error) throw error
        setProfiles((data || []).filter((p) => !enrolledIds.has(p.id)))
      } catch (err) {
        console.error(err)
        toast.error('Failed to load team')
      } finally { setLoading(false) }
    })()
  }, [existingEnrollments])

  const filtered = profiles.filter((p) => {
    if (!search) return true
    const hay = `${p.full_name || ''} ${p.email || ''} ${p.title || ''}`.toLowerCase()
    return hay.includes(search.toLowerCase())
  })

  async function submit(e) {
    e.preventDefault()
    if (!selectedId) { toast.error('Pick a team member'); return }
    setSaving(true)
    try {
      await enrollTester({
        userId: selectedId,
        commissionRate: Number(rate),
        minHoursPerPeriod: Number(minHours),
        notes: notes.trim() || null,
        enrolledBy: userId,
      })
      toast.success('Tester enrolled')
      onEnrolled()
    } catch (err) {
      console.error(err)
      toast.error(err?.message?.includes('duplicate') ? 'Already enrolled' : 'Enroll failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-auto py-10 px-4">
      <form onSubmit={submit} className="bg-navy-900 border border-navy-700/50 rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <div>
            <h2 className="text-lg font-semibold">Enroll new tester</h2>
            <p className="text-xs text-gray-500 mt-0.5">Pick an existing team member. They become eligible for the next commission period.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team by name, email, title…"
            className="w-full bg-navy-800 border border-navy-700/50 rounded-md px-3 py-2 text-sm"
          />
          <div className="max-h-64 overflow-y-auto border border-navy-700/40 rounded-md divide-y divide-navy-700/40">
            {loading ? (
              <div className="p-4 text-center text-xs text-gray-500">Loading team…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500">
                {profiles.length === 0
                  ? 'Every team member is already enrolled. Add new members in HR Hub.'
                  : 'No matches for that search.'}
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-navy-800 transition ${
                    selectedId === p.id ? 'bg-navy-800' : ''
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${selectedId === p.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-navy-700 text-gray-400'}`}>
                    {(p.full_name || p.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{p.full_name || '(no name)'}</div>
                    <div className="text-[10px] text-gray-500 truncate">{p.email} · {p.title || p.role}</div>
                  </div>
                  {selectedId === p.id && (
                    <span className="text-[10px] font-semibold uppercase text-emerald-400">Selected</span>
                  )}
                </button>
              ))
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase font-semibold text-gray-500">Commission rate (0–1)</span>
              <input type="number" step="0.01" min="0" max="1" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase font-semibold text-gray-500">Min hours / period</span>
              <input type="number" step="0.5" min="0" value={minHours} onChange={(e) => setMinHours(e.target.value)} className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] uppercase font-semibold text-gray-500">Notes (optional)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g., Hired specifically as QA — reports to Ryan" className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded px-3 py-2 text-sm" />
          </label>
          <div className="text-xs text-gray-500 italic">
            Default: 5% of monthly net profit pool, must clock at least {minHours} hours/period to qualify.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-navy-700/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button type="submit" disabled={saving || !selectedId} className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm font-medium disabled:opacity-50">
            {saving ? 'Enrolling…' : 'Enroll tester'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
      <div className="text-base font-bold mt-0.5 text-white tabular-nums">{value}</div>
    </div>
  )
}

function AllocationRow({ allocation, userLookup, isSuperAdmin, onChanged }) {
  const u = userLookup[allocation.user_id]
  async function pay() {
    const ref = window.prompt('Payment reference (check #, ACH ID, etc.):')
    if (!ref) return
    try {
      await markAllocationPaid(allocation.id, { paymentMethod: 'manual', paymentReference: ref })
      toast.success('Marked paid')
      onChanged()
    } catch {
      toast.error('Update failed')
    }
  }
  return (
    <tr>
      <td className="px-4 py-2.5 text-sm text-white">{u?.full_name || u?.email || allocation.user_id.slice(0, 8)}</td>
      <td className="px-4 py-2.5 text-sm text-gray-300 tabular-nums">{Number(allocation.hours_logged).toFixed(2)}</td>
      <td className="px-4 py-2.5">
        {allocation.qualified
          ? <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Yes</span>
          : <span className="text-xs px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400">No</span>}
      </td>
      <td className="px-4 py-2.5 text-sm text-emerald-400 font-semibold tabular-nums">{formatCurrency(allocation.share_amount)}</td>
      <td className="px-4 py-2.5">
        {allocation.paid
          ? <span className="text-xs text-emerald-400">Paid {allocation.payment_reference ? `(${allocation.payment_reference})` : ''}</span>
          : <span className="text-xs text-gray-500">—</span>}
      </td>
      {isSuperAdmin && (
        <td className="px-4 py-2.5 text-right">
          {!allocation.paid && allocation.qualified && (
            <button onClick={pay} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
              Mark paid
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

function NewPeriodModal({ userId, onClose, onCreated }) {
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const fmt = (d) => d.toISOString().slice(0, 10)

  const [start, setStart] = useState(fmt(firstOfMonth))
  const [end, setEnd] = useState(fmt(lastOfMonth))
  const [netProfit, setNetProfit] = useState('')
  const [rate, setRate] = useState('0.05')
  const [minHours, setMinHours] = useState('10')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!netProfit || isNaN(Number(netProfit))) { toast.error('Net profit required'); return }
    setSaving(true)
    try {
      await createPeriod({
        periodStart: start,
        periodEnd: end,
        netProfit: Number(netProfit),
        commissionRate: Number(rate),
        minHoursToQualify: Number(minHours),
        notes: notes.trim() || null,
        createdBy: userId,
      })
      toast.success('Period created')
      onCreated()
    } catch (err) {
      console.error(err)
      toast.error(err?.message?.includes('duplicate') ? 'Period dates conflict with existing one' : 'Save failed')
    } finally { setSaving(false) }
  }

  const previewPool = Number(netProfit || 0) * Number(rate || 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-auto py-10 px-4">
      <form onSubmit={submit} className="bg-navy-900 border border-navy-700/50 rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
          <h2 className="text-lg font-semibold">New commission period</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase font-semibold text-gray-500">Start</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase font-semibold text-gray-500">End</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] uppercase font-semibold text-gray-500">Net profit ($) — Ryan enters this</span>
            <input type="number" step="0.01" value={netProfit} onChange={(e) => setNetProfit(e.target.value)} required className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded px-3 py-2 text-sm" placeholder="0.00" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase font-semibold text-gray-500">Commission rate (0–1)</span>
              <input type="number" step="0.01" min="0" max="1" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase font-semibold text-gray-500">Min hours to qualify</span>
              <input type="number" step="0.5" min="0" value={minHours} onChange={(e) => setMinHours(e.target.value)} className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] uppercase font-semibold text-gray-500">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full mt-1 bg-navy-800 border border-navy-700/50 rounded px-3 py-2 text-sm" />
          </label>
          {netProfit && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
              Pool: <span className="font-bold">{formatCurrency(previewPool)}</span>
              <span className="text-xs text-gray-400 ml-2">({(Number(rate) * 100).toFixed(1)}% of {formatCurrency(Number(netProfit))})</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-navy-700/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Create period'}
          </button>
        </div>
      </form>
    </div>
  )
}
