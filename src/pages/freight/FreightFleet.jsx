import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const TRUCK_STATUS = {
  active: { label: 'Active', dot: 'bg-emerald-400', cls: 'bg-emerald-500/10 text-emerald-400' },
  in_shop: { label: 'In Shop', dot: 'bg-amber-400', cls: 'bg-amber-500/10 text-amber-400' },
  out_of_service: { label: 'Out of Service', dot: 'bg-red-400', cls: 'bg-red-500/10 text-red-400' },
}

const MAINT_STATUS = {
  open: 'bg-red-500/10 text-red-400',
  scheduled: 'bg-amber-500/10 text-amber-400',
  in_progress: 'bg-sky-500/10 text-sky-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
}

function StatusPill({ map, status }) {
  const s = map[status] || { label: status, dot: 'bg-gray-500', cls: 'bg-gray-500/10 text-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

const EMPTY_TRUCK = { unit_number: '', year: '', make: '', model: '', vin: '', plate: '', plate_state: 'FL', status: 'active', odometer: '', notes: '' }
const EMPTY_TRAILER = { unit_number: '', trailer_type: '53 Dry Van', year: '', make: '', vin: '', plate: '', plate_state: 'FL', status: 'active', notes: '' }
const EMPTY_SERVICE = { asset_kind: 'truck', asset_id: '', service_type: 'PM', description: '', status: 'open', vendor: '', cost: '', odometer: '', scheduled_date: '', completed_date: '' }

export default function FreightFleet() {
  const [tab, setTab] = useState('trucks')
  const [trucks, setTrucks] = useState([])
  const [trailers, setTrailers] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // 'truck' | 'trailer' | 'service'
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [tk, tr, mt] = await Promise.all([
        supabase.from('freight_trucks').select('*').order('unit_number'),
        supabase.from('freight_trailers').select('*').order('unit_number'),
        supabase.from('freight_maintenance').select('*').order('created_at', { ascending: false }),
      ])
      setTrucks(tk.data || [])
      setTrailers(tr.data || [])
      setMaintenance(mt.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function openModal(kind) {
    setFormError('')
    if (kind === 'truck') setForm(EMPTY_TRUCK)
    else if (kind === 'trailer') setForm(EMPTY_TRAILER)
    else setForm({ ...EMPTY_SERVICE, asset_id: trucks[0]?.id || '' })
    setModal(kind)
  }

  function closeModal() { setModal(null); setForm({}); setFormError('') }
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  async function getBrokerId() {
    if (trucks[0]?.broker_id) return trucks[0].broker_id
    if (trailers[0]?.broker_id) return trailers[0].broker_id
    const { data } = await supabase.from('freight_brokers').select('id').limit(1).single()
    return data?.id
  }

  async function handleSave() {
    setFormError('')
    setSaving(true)
    try {
      const broker_id = await getBrokerId()
      if (modal === 'truck') {
        if (!form.unit_number.trim()) throw new Error('Unit number is required')
        const { error } = await supabase.from('freight_trucks').insert({
          broker_id, unit_number: form.unit_number.trim(), year: form.year ? parseInt(form.year) : null,
          make: form.make.trim() || null, model: form.model.trim() || null, vin: form.vin.trim() || null,
          plate: form.plate.trim() || null, plate_state: form.plate_state.trim().toUpperCase() || null,
          status: form.status, odometer: form.odometer ? parseInt(form.odometer) : null, notes: form.notes.trim() || null,
        })
        if (error) throw error
      } else if (modal === 'trailer') {
        if (!form.unit_number.trim()) throw new Error('Unit number is required')
        const { error } = await supabase.from('freight_trailers').insert({
          broker_id, unit_number: form.unit_number.trim(), trailer_type: form.trailer_type.trim() || '53 Dry Van',
          year: form.year ? parseInt(form.year) : null, make: form.make.trim() || null, vin: form.vin.trim() || null,
          plate: form.plate.trim() || null, plate_state: form.plate_state.trim().toUpperCase() || null,
          status: form.status, notes: form.notes.trim() || null,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.from('freight_maintenance').insert({
          broker_id,
          truck_id: form.asset_kind === 'truck' ? (form.asset_id || null) : null,
          trailer_id: form.asset_kind === 'trailer' ? (form.asset_id || null) : null,
          service_type: form.service_type, description: form.description.trim() || null, status: form.status,
          vendor: form.vendor.trim() || null, cost: form.cost ? parseFloat(form.cost) : null,
          odometer: form.odometer ? parseInt(form.odometer) : null,
          scheduled_date: form.scheduled_date || null, completed_date: form.completed_date || null,
        })
        if (error) throw error
      }
      closeModal()
      await loadAll()
    } catch (e) {
      setFormError(e.message || 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  const assetLabel = (m) => {
    if (m.truck_id) { const t = trucks.find(x => x.id === m.truck_id); return t ? `Truck ${t.unit_number}` : 'Truck' }
    if (m.trailer_id) { const t = trailers.find(x => x.id === m.trailer_id); return t ? `Trailer ${t.unit_number}` : 'Trailer' }
    return '—'
  }

  const q = search.toLowerCase()
  const fTrucks = trucks.filter(t => !q || [t.unit_number, t.make, t.model, t.vin, t.plate].some(v => v?.toLowerCase().includes(q)))
  const fTrailers = trailers.filter(t => !q || [t.unit_number, t.make, t.trailer_type, t.plate].some(v => v?.toLowerCase().includes(q)))
  const fMaint = maintenance.filter(m => !q || [m.service_type, m.description, m.vendor, assetLabel(m)].some(v => v?.toLowerCase().includes(q)))

  const stats = [
    { label: 'Power Units', value: trucks.length, color: 'text-white' },
    { label: 'Trailers', value: trailers.length, color: 'text-white' },
    { label: 'In Shop', value: trucks.filter(t => t.status === 'in_shop').length + trailers.filter(t => t.status === 'in_shop').length, color: 'text-amber-400' },
    { label: 'Open Maintenance', value: maintenance.filter(m => m.status !== 'completed').length, color: 'text-red-400' },
  ]

  const tabs = [
    { key: 'trucks', label: `Trucks (${trucks.length})` },
    { key: 'trailers', label: `Trailers (${trailers.length})` },
    { key: 'maintenance', label: `Maintenance (${maintenance.length})` },
  ]

  const addBtn = { trucks: ['truck', 'Add Truck'], trailers: ['trailer', 'Add Trailer'], maintenance: ['service', 'Log Service'] }[tab]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            <h1 className="text-xl font-bold text-white">Fleet</h1>
          </div>
          <p className="text-sm text-gray-400">Trucks, trailers, and maintenance for BHF Logistics</p>
        </div>
        <button onClick={() => openModal(addBtn[0])} className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          {addBtn[1]}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-navy-800 border border-navy-700/50 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 bg-navy-800 border border-navy-700/50 rounded-lg p-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Search fleet…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-4 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            {tab === 'trucks' && (
              <table className="w-full">
                <thead><tr className="border-b border-navy-700/50">{['Unit', 'Year / Make / Model', 'VIN', 'Plate', 'Odometer', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {fTrucks.map(t => (
                    <tr key={t.id} className="border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20">
                      <td className="px-4 py-3 text-sm font-semibold text-white">{t.unit_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{[t.year, t.make, t.model].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{t.vin || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{t.plate ? `${t.plate} ${t.plate_state || ''}`.trim() : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{t.odometer ? t.odometer.toLocaleString() + ' mi' : '—'}</td>
                      <td className="px-4 py-3"><StatusPill map={TRUCK_STATUS} status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'trailers' && (
              <table className="w-full">
                <thead><tr className="border-b border-navy-700/50">{['Unit', 'Type', 'Year / Make', 'Plate', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {fTrailers.map(t => (
                    <tr key={t.id} className="border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20">
                      <td className="px-4 py-3 text-sm font-semibold text-white">{t.unit_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{t.trailer_type || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{[t.year, t.make].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{t.plate ? `${t.plate} ${t.plate_state || ''}`.trim() : '—'}</td>
                      <td className="px-4 py-3"><StatusPill map={TRUCK_STATUS} status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'maintenance' && (
              <table className="w-full">
                <thead><tr className="border-b border-navy-700/50">{['Asset', 'Service', 'Description', 'Vendor', 'Scheduled', 'Cost', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {fMaint.map(m => (
                    <tr key={m.id} className="border-b border-navy-700/30 last:border-0 hover:bg-navy-700/20">
                      <td className="px-4 py-3 text-sm font-semibold text-white">{assetLabel(m)}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{m.service_type}</td>
                      <td className="px-4 py-3 text-sm text-gray-400 max-w-[280px] truncate">{m.description || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{m.vendor || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{m.completed_date || m.scheduled_date || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{m.cost != null ? '$' + Number(m.cost).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${MAINT_STATUS[m.status] || 'bg-gray-500/10 text-gray-400'}`}>{m.status.replace('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Add modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700/50">
              <h2 className="text-base font-semibold text-white">{modal === 'truck' ? 'Add Truck' : modal === 'trailer' ? 'Add Trailer' : 'Log Service'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-navy-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-4">
              {modal === 'truck' && (<>
                <Input label="Unit Number *" value={form.unit_number} onChange={v => f('unit_number', v)} />
                <Input label="Year" value={form.year} onChange={v => f('year', v)} />
                <Input label="Make" value={form.make} onChange={v => f('make', v)} />
                <Input label="Model" value={form.model} onChange={v => f('model', v)} />
                <Input label="VIN" value={form.vin} onChange={v => f('vin', v)} span />
                <Input label="Plate" value={form.plate} onChange={v => f('plate', v)} />
                <Input label="Odometer" value={form.odometer} onChange={v => f('odometer', v)} />
                <Select label="Status" value={form.status} onChange={v => f('status', v)} options={[['active', 'Active'], ['in_shop', 'In Shop'], ['out_of_service', 'Out of Service']]} />
              </>)}
              {modal === 'trailer' && (<>
                <Input label="Unit Number *" value={form.unit_number} onChange={v => f('unit_number', v)} />
                <Input label="Type" value={form.trailer_type} onChange={v => f('trailer_type', v)} />
                <Input label="Year" value={form.year} onChange={v => f('year', v)} />
                <Input label="Make" value={form.make} onChange={v => f('make', v)} />
                <Input label="VIN" value={form.vin} onChange={v => f('vin', v)} span />
                <Input label="Plate" value={form.plate} onChange={v => f('plate', v)} />
                <Select label="Status" value={form.status} onChange={v => f('status', v)} options={[['active', 'Active'], ['in_shop', 'In Shop'], ['out_of_service', 'Out of Service']]} />
              </>)}
              {modal === 'service' && (<>
                <Select label="Asset Type" value={form.asset_kind} onChange={v => f('asset_kind', v) || f('asset_id', '')} options={[['truck', 'Truck'], ['trailer', 'Trailer']]} />
                <Select label="Unit" value={form.asset_id} onChange={v => f('asset_id', v)} options={(form.asset_kind === 'trailer' ? trailers : trucks).map(a => [a.id, a.unit_number])} />
                <Select label="Service Type" value={form.service_type} onChange={v => f('service_type', v)} options={[['PM', 'PM'], ['Repair', 'Repair'], ['Inspection', 'Inspection'], ['Tire', 'Tire'], ['DVIR', 'DVIR']]} />
                <Select label="Status" value={form.status} onChange={v => f('status', v)} options={[['open', 'Open'], ['scheduled', 'Scheduled'], ['in_progress', 'In Progress'], ['completed', 'Completed']]} />
                <Input label="Description" value={form.description} onChange={v => f('description', v)} span />
                <Input label="Vendor" value={form.vendor} onChange={v => f('vendor', v)} />
                <Input label="Cost" value={form.cost} onChange={v => f('cost', v)} />
                <Input label="Scheduled Date" value={form.scheduled_date} onChange={v => f('scheduled_date', v)} type="date" />
                <Input label="Completed Date" value={form.completed_date} onChange={v => f('completed_date', v)} type="date" />
              </>)}
              {formError && <div className="col-span-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{formError}</div>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-navy-700/50">
              <button onClick={closeModal} className="px-4 py-2 border border-navy-600 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Input({ label, value, onChange, span, type = 'text' }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue/60" />
    </div>
  )
}

function Select({ label, value, onChange, options, span }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white focus:outline-none focus:border-brand-blue/60">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}
