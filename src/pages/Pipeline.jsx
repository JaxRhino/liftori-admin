import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const SALES_STAGES = ['New Lead', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']
const STAGE_DOT = {
  'New Lead': 'bg-sky-400',
  'Contacted': 'bg-cyan-400',
  'Qualified': 'bg-indigo-400',
  'Proposal': 'bg-violet-400',
  'Negotiation': 'bg-amber-400',
  'Won': 'bg-emerald-400',
  'Lost': 'bg-red-400',
}
const TYPE_COLOR = {
  'CRM': 'bg-brand-blue/20 text-brand-blue',
  'Website': 'bg-emerald-500/20 text-emerald-400',
  'Custom Build': 'bg-violet-500/20 text-violet-400',
  'Consulting': 'bg-amber-500/20 text-amber-400',
}
const TYPES = ['all', 'CRM', 'Website', 'Custom Build', 'Consulting']
const money = n => '$' + (Number(n) || 0).toLocaleString()

function Stat({ label, value, accent }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent || 'text-white'}`}>{value}</p>
    </div>
  )
}

export default function Pipeline() {
  const { profile, user } = useAuth()
  const myId = profile?.id || user?.id
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)

  useEffect(() => { fetchLines() }, [])

  async function fetchLines() {
    setLoading(true)
    const { data, error } = await supabase
      .from('customer_product_lines')
      .select('*, customer:profiles!customer_product_lines_profile_id_fkey(id, full_name, company_name), owner:profiles!customer_product_lines_owner_id_fkey(full_name)')
      .order('updated_at', { ascending: false })
    if (error) console.error('pipeline fetch', error)
    setLines(data || [])
    setLoading(false)
  }

  async function assignToMe(line) {
    if (!myId) return
    setBusyId(line.id)
    try {
      const { error } = await supabase.from('customer_product_lines').update({ owner_id: myId, updated_at: new Date().toISOString() }).eq('id', line.id)
      if (error) throw error
      await fetchLines()
    } catch (e) { console.error(e); alert('Failed to assign') } finally { setBusyId(null) }
  }

  const filtered = lines.filter(l =>
    (typeFilter === 'all' || l.product_type === typeFilter) &&
    (ownerFilter === 'all' || (ownerFilter === 'mine' ? l.owner_id === myId : !l.owner_id))
  )
  const openLines = filtered.filter(l => l.stage !== 'Won' && l.stage !== 'Lost')
  const openValue = openLines.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0)
  const wonValue = filtered.filter(l => l.stage === 'Won').reduce((s, l) => s + (Number(l.estimated_value) || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Pipeline</h1>
          <p className="text-sm text-gray-400">{filtered.length} product line{filtered.length !== 1 ? 's' : ''} in play. A customer can run several at once; a won line opens an Operations project.</p>
        </div>
        <div className="flex bg-navy-800 rounded-lg p-0.5 border border-navy-600/50">
          {['all', 'mine', 'unassigned'].map(o => (
            <button key={o} onClick={() => setOwnerFilter(o)} className={`px-2.5 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${ownerFilter === o ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-400 hover:text-white'}`}>
              {o === 'mine' ? 'My Pipeline' : o}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400 hover:text-white'}`}>
            {t === 'all' ? 'All Types' : t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Open Lines" value={openLines.length} />
        <Stat label="Open Pipeline" value={money(openValue)} accent="text-brand-blue" />
        <Stat label="Won Value" value={money(wonValue)} accent="text-emerald-400" />
        <Stat label="Total Lines" value={filtered.length} />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400">No product lines yet.</p>
          <p className="text-xs text-gray-600 mt-1">Add CRM / Website / Custom Build / Consulting lines from a customer's Product Lines tab and they'll appear here.</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {SALES_STAGES.map(stage => {
            const items = filtered.filter(l => l.stage === stage)
            const val = items.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0)
            return (
              <div key={stage} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STAGE_DOT[stage]}`} />
                    <span className="text-sm font-semibold text-white">{stage}</span>
                    <span className="text-xs text-gray-500">{items.length}</span>
                  </div>
                  {val > 0 && <span className="text-xs text-gray-500">{money(val)}</span>}
                </div>
                <div className="space-y-2 min-h-[40px]">
                  {items.map(l => (
                    <div key={l.id} className="bg-navy-800 border border-navy-700/50 rounded-xl p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[l.product_type] || 'bg-gray-500/20 text-gray-400'}`}>{l.product_type}</span>
                        {l.estimated_value > 0 && <span className="text-[11px] text-emerald-400 font-semibold">{money(l.estimated_value)}</span>}
                      </div>
                      <Link to={`/admin/customers/${l.customer?.id || l.profile_id}`} className="block text-sm font-semibold text-white hover:text-brand-blue mt-1 truncate">
                        {l.customer?.company_name || l.customer?.full_name || 'Customer'}
                      </Link>
                      {l.customer?.company_name && l.customer?.full_name && <p className="text-[11px] text-gray-500 truncate">{l.customer.full_name}</p>}
                      {l.expected_close_date && <p className="text-[11px] text-gray-500 mt-1">Close {new Date(l.expected_close_date).toLocaleDateString()}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-gray-500">{l.owner?.full_name || (l.owner_id ? 'Assigned' : 'Unassigned')}</span>
                        {!l.owner_id && myId && (
                          <button onClick={() => assignToMe(l)} disabled={busyId === l.id} className="text-[11px] text-brand-blue hover:underline disabled:opacity-50">Assign to me</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
