import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

const money = (c) => '$' + ((Number(c) || 0) / 100).toFixed(2)
const dt = (d) => d ? new Date(d).toLocaleString() : '-'

const STATUS_TONE = {
  pending: 'bg-amber-500/20 text-amber-300',
  in_progress: 'bg-blue-500/20 text-blue-300',
  delivered: 'bg-emerald-500/20 text-emerald-300',
  cancelled: 'bg-red-500/20 text-red-300',
}

// Live countdown to the 6-hour SLA due time.
function Countdown({ due, status }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (status === 'delivered' || status === 'cancelled') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [status])
  if (status === 'delivered') return <span className="text-emerald-400">Delivered</span>
  if (status === 'cancelled') return <span className="text-gray-500">Cancelled</span>
  if (!due) return <span className="text-gray-500">-</span>
  const ms = new Date(due).getTime() - now
  const over = ms < 0
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3600000)
  const m = Math.floor((abs % 3600000) / 60000)
  const sec = Math.floor((abs % 60000) / 1000)
  const label = `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
  const tone = over ? 'text-red-400' : (ms < 3600000 ? 'text-amber-400' : 'text-emerald-400')
  return <span className={'font-mono ' + tone}>{over ? 'OVERDUE ' : ''}{label}</span>
}

export default function MeasurementRequests() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('roof_report_requests')
        .select('*')
        .order('requested_at', { ascending: true })
      if (error) throw error
      setRows(data || [])
    } catch (e) { console.error(e); toast.error('Failed to load requests') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = rows.filter(r => {
    if (filter === 'all') return true
    if (filter === 'open') return r.status === 'pending' || r.status === 'in_progress'
    return r.status === filter
  })
  const openCount = rows.filter(r => r.status === 'pending' || r.status === 'in_progress').length
  const overdue = rows.filter(r => (r.status === 'pending' || r.status === 'in_progress') && new Date(r.due_at).getTime() < Date.now()).length

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Measurement Requests</h1>
          <p className="text-gray-400 text-sm mt-1">Liftori roof report fulfillment queue. $15 per report, 6-hour SLA. Clock starts when the customer submits.</p>
        </div>
        <button onClick={load} className="bg-navy-700 hover:bg-navy-600 text-white text-sm px-3 py-2 rounded-lg">Refresh</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-4"><div className="text-gray-400 text-xs uppercase">Open</div><div className="text-2xl font-bold text-white">{openCount}</div></div>
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-4"><div className="text-gray-400 text-xs uppercase">Overdue</div><div className={'text-2xl font-bold ' + (overdue ? 'text-red-400' : 'text-white')}>{overdue}</div></div>
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-4"><div className="text-gray-400 text-xs uppercase">Delivered</div><div className="text-2xl font-bold text-white">{rows.filter(r => r.status === 'delivered').length}</div></div>
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-4"><div className="text-gray-400 text-xs uppercase">Total</div><div className="text-2xl font-bold text-white">{rows.length}</div></div>
      </div>

      <div className="flex items-center gap-1 mb-4">
        {[['open', 'Open'], ['pending', 'Pending'], ['in_progress', 'In Progress'], ['delivered', 'Delivered'], ['all', 'All']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={'px-3 py-1.5 rounded-lg text-sm font-medium ' + (filter === k ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-300 hover:text-white')}>{l}</button>
        ))}
      </div>

      <div className="bg-navy-900 border border-navy-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-800 text-left text-gray-400">
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Platform</th>
                <th className="px-4 py-3 font-semibold">Requested</th>
                <th className="px-4 py-3 font-semibold">Time Left (6h SLA)</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Loading...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No requests.</td></tr>}
              {!loading && filtered.map(r => (
                <tr key={r.id} onClick={() => navigate('/admin/measurement-requests/' + r.id)} className="border-b border-navy-800 hover:bg-navy-800/50 cursor-pointer">
                  <td className="px-4 py-3 text-white font-medium">{r.title || 'Untitled'}</td>
                  <td className="px-4 py-3 text-gray-300">{r.customer_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-300">{r.platform_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-400">{dt(r.requested_at)}</td>
                  <td className="px-4 py-3"><Countdown due={r.due_at} status={r.status} /></td>
                  <td className="px-4 py-3"><span className={'text-xs px-2 py-1 rounded ' + (STATUS_TONE[r.status] || 'bg-gray-500/20 text-gray-300')}>{r.status}</span></td>
                  <td className="px-4 py-3 text-right text-white">{money(r.price_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


// ===== Measurements Lab (placeholder, opened from the queue) =====

const dt2 = (d) => d ? new Date(d).toLocaleString() : '-'
const money2 = (c) => '$' + ((Number(c) || 0) / 100).toFixed(2)

function Clock({ due, status }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (status === 'delivered' || status === 'cancelled') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [status])
  if (status === 'delivered') return <span className="text-emerald-400 font-mono">Delivered</span>
  if (status === 'cancelled') return <span className="text-gray-500 font-mono">Cancelled</span>
  if (!due) return <span className="text-gray-500">-</span>
  const ms = new Date(due).getTime() - now
  const over = ms < 0, abs = Math.abs(ms)
  const h = Math.floor(abs / 3600000), m = Math.floor((abs % 3600000) / 60000), s = Math.floor((abs % 60000) / 1000)
  const tone = over ? 'text-red-400' : (ms < 3600000 ? 'text-amber-400' : 'text-emerald-400')
  return <span className={'font-mono text-lg ' + tone}>{over ? 'OVERDUE ' : ''}{h}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s</span>
}

function KV({ k, v }) {
  return (
    <div className="flex justify-between gap-3 text-sm border-b border-navy-800 pb-2">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-200 text-right">{v || '-'}</span>
    </div>
  )
}

export function MeasurementLab() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [req, setReq] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reportUrl, setReportUrl] = useState('')

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('roof_report_requests').select('*').eq('id', id).single()
      if (error) throw error
      setReq(data); setReportUrl(data.report_url || '')
    } catch (e) { console.error(e); toast.error('Failed to load request') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])

  async function setStatus(status, extra = {}) {
    try {
      setSaving(true)
      const patch = { status, updated_at: new Date().toISOString(), ...extra }
      const { error } = await supabase.from('roof_report_requests').update(patch).eq('id', id)
      if (error) throw error
      setReq(prev => ({ ...prev, ...patch }))
      toast.success('Updated')
    } catch (e) { console.error(e); toast.error('Update failed') } finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>
  if (!req) return <div className="p-6 text-gray-400">Request not found. <button onClick={() => navigate('/admin/measurement-requests')} className="text-brand-blue">Back to queue</button></div>

  const structures = Array.isArray(req.secondary_structures) ? req.secondary_structures : []

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <button onClick={() => navigate('/admin/measurement-requests')} className="text-sm text-brand-blue hover:text-brand-cyan mb-1">&larr; Measurement Requests</button>
          <h1 className="text-2xl font-bold text-white">Measurements Lab</h1>
          <p className="text-gray-400 text-sm mt-1">{req.title || 'Untitled'} - {req.customer_name || ''} - {req.platform_name || ''}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400 uppercase">6h SLA</div>
          <Clock due={req.due_at} status={req.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-navy-900 border border-navy-800 rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-semibold text-white mb-3">Request Details</h3>
          <KV k="Status" v={req.status} />
          <KV k="Price" v={money2(req.price_cents)} />
          <KV k="Property Address" v={req.property_address} />
          <KV k="Location" v={req.lat != null ? `${req.lat}, ${req.lng}` : '-'} />
          <KV k="Waste Factor" v={req.waste_factor != null ? req.waste_factor + '%' : '-'} />
          <KV k="Manufacturer" v={req.material_manufacturer} />
          <KV k="Desired Color" v={req.desired_roof_color} />
          <KV k="3D Render" v={req.want_3d_render ? 'Requested' : 'No'} />
          <KV k="Requested" v={dt2(req.requested_at)} />
          <KV k="Due" v={dt2(req.due_at)} />
          <div className="pt-2">
            <div className="text-xs text-gray-500 mb-1">Secondary structures</div>
            {structures.length === 0 ? <div className="text-sm text-gray-400">None</div> : (
              <ul className="text-sm text-gray-200 list-disc list-inside">{structures.map((st, i) => <li key={i}>{st.name || st}</li>)}</ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-navy-900 border border-dashed border-navy-700 rounded-xl p-10 text-center">
            <h3 className="text-white font-semibold mb-1">Measurement Lab tools</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto">Placeholder. Aerial trace, facet/pitch capture, material takeoff, and the 3D color render in the customer's selected roof color will be built here. Patent-safe approach to be iterated.</p>
          </div>

          <div className="bg-navy-900 border border-navy-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Fulfillment</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatus('in_progress')} disabled={saving} className="bg-navy-700 hover:bg-navy-600 text-white text-sm px-3 py-2 rounded-lg">Start (In Progress)</button>
              <button onClick={() => setStatus('pending')} disabled={saving} className="bg-navy-700 hover:bg-navy-600 text-white text-sm px-3 py-2 rounded-lg">Reset to Pending</button>
              <button onClick={() => setStatus('cancelled')} disabled={saving} className="bg-navy-700 hover:bg-red-600 text-white text-sm px-3 py-2 rounded-lg">Cancel</button>
            </div>
            <div className="flex items-end gap-2 pt-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Report URL (deliverable)</label>
                <input value={reportUrl} onChange={e => setReportUrl(e.target.value)} placeholder="https://..." className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm" />
              </div>
              <button onClick={() => setStatus('delivered', { report_url: reportUrl || null, delivered_at: new Date().toISOString() })} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm px-4 py-2 rounded-lg whitespace-nowrap">Mark Delivered</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
