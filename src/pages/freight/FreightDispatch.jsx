import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// Dispatch lifecycle for an own-fleet load
const STAGES = ['dispatched', 'at_pickup', 'picked_up', 'en_route', 'delivered']
const DISPATCH_STATUS = {
  dispatched: { label: 'Dispatched', dot: 'bg-sky-400', cls: 'bg-sky-500/10 text-sky-300' },
  at_pickup: { label: 'At Pickup', dot: 'bg-amber-400', cls: 'bg-amber-500/10 text-amber-300' },
  picked_up: { label: 'Loaded', dot: 'bg-indigo-400', cls: 'bg-indigo-500/10 text-indigo-300' },
  en_route: { label: 'En Route', dot: 'bg-violet-400', cls: 'bg-violet-500/10 text-violet-300' },
  delivered: { label: 'Delivered', dot: 'bg-emerald-400', cls: 'bg-emerald-500/10 text-emerald-300' },
}
const TRUCK_STATUS = {
  active: { label: 'Active', dot: 'bg-emerald-400', cls: 'bg-emerald-500/10 text-emerald-400' },
  in_shop: { label: 'In Shop', dot: 'bg-amber-400', cls: 'bg-amber-500/10 text-amber-400' },
  out_of_service: { label: 'Out of Service', dot: 'bg-red-400', cls: 'bg-red-500/10 text-red-400' },
}

const money = (v) => (v == null ? '—' : '$' + Number(v).toLocaleString())
const route = (l) => `${l.origin_city || '?'}, ${l.origin_state || '?'} → ${l.dest_city || '?'}, ${l.dest_state || '?'}`
const nextStage = (s) => STAGES[Math.min(STAGES.indexOf(s) + 1, STAGES.length - 1)]

function Pill({ map, status }) {
  const s = map[status] || { label: status, dot: 'bg-gray-500', cls: 'bg-gray-500/10 text-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

export default function FreightDispatch() {
  const [trucks, setTrucks] = useState([])
  const [drivers, setDrivers] = useState([])
  const [trailers, setTrailers] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [loads, setLoads] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [assign, setAssign] = useState(null) // { load }
  const [form, setForm] = useState({ truck_id: '', trailer_id: '', driver_id: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [tk, dr, tl, ds, ld] = await Promise.all([
        supabase.from('freight_trucks').select('*').order('unit_number'),
        supabase.from('freight_drivers').select('*').order('last_name'),
        supabase.from('freight_trailers').select('*').order('unit_number'),
        supabase.from('freight_dispatches').select('*').order('created_at', { ascending: false }),
        supabase.from('freight_loads').select('*, freight_shippers(company_name)').order('pickup_date'),
      ])
      setTrucks(tk.data || [])
      setDrivers(dr.data || [])
      setTrailers(tl.data || [])
      setDispatches(ds.data || [])
      setLoads(ld.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const brokerId = () => trucks[0]?.broker_id || drivers[0]?.broker_id
  const driverName = (id) => { const d = drivers.find(x => x.id === id); return d ? `${d.first_name} ${d.last_name}` : null }
  const loadFor = (id) => loads.find(l => l.id === id)

  // Active dispatch (not delivered) for a given truck
  const activeDispatchForTruck = (truckId) =>
    dispatches.find(d => d.truck_id === truckId && d.current_status !== 'delivered')

  // Loads still needing a truck (covered/posted but not on own fleet)
  const dispatchedLoadIds = new Set(dispatches.filter(d => d.current_status !== 'delivered').map(d => d.load_id))
  const loadsToCover = loads.filter(l =>
    ['posted', 'bidding', 'booked', 'accepted'].includes(l.status) && !dispatchedLoadIds.has(l.id))

  const activeTrucks = trucks.filter(t => t.status === 'active')
  const onLoad = activeTrucks.filter(t => activeDispatchForTruck(t.id))
  const available = activeTrucks.filter(t => t.assigned_driver_id && !activeDispatchForTruck(t.id))

  const stats = [
    { label: 'Power Units', value: activeTrucks.length, color: 'text-white' },
    { label: 'On a Load', value: onLoad.length, color: 'text-violet-300' },
    { label: 'Available', value: available.length, color: 'text-emerald-400' },
    { label: 'Loads to Cover', value: loadsToCover.length, color: 'text-amber-400' },
  ]

  function openAssign(load) {
    setErr('')
    const firstTruck = available[0] || activeTrucks.find(t => t.assigned_driver_id) || activeTrucks[0]
    setForm({
      truck_id: firstTruck?.id || '',
      trailer_id: trailers.find(t => t.status === 'active')?.id || '',
      driver_id: firstTruck?.assigned_driver_id || '',
    })
    setAssign({ load })
  }

  function onTruckPick(truckId) {
    const t = trucks.find(x => x.id === truckId)
    setForm(f => ({ ...f, truck_id: truckId, driver_id: t?.assigned_driver_id || f.driver_id }))
  }

  async function confirmAssign() {
    setErr('')
    if (!form.truck_id) return setErr('Pick a truck')
    if (!form.driver_id) return setErr('Pick a driver')
    setSaving(true)
    try {
      const load = assign.load
      const truck = trucks.find(t => t.id === form.truck_id)
      const trailer = trailers.find(t => t.id === form.trailer_id)
      const driver = drivers.find(d => d.id === form.driver_id)
      const { error } = await supabase.from('freight_dispatches').insert({
        load_id: load.id,
        broker_id: brokerId(),
        driver_id: driver?.id || null,
        truck_id: truck?.id || null,
        trailer_id: trailer?.id || null,
        driver_name: driver ? `${driver.first_name} ${driver.last_name}` : null,
        driver_phone: driver?.phone || null,
        truck_number: truck?.unit_number || null,
        trailer_number: trailer?.unit_number || null,
        carrier_name: 'BHF Logistics',
        carrier_mc: 'MC-1184792',
        is_own_fleet: true,
        current_status: 'dispatched',
        pickup_eta: load.pickup_date ? `${load.pickup_date}T08:00:00` : null,
        delivery_eta: load.delivery_date ? `${load.delivery_date}T15:00:00` : null,
      })
      if (error) throw error
      // Mark the brokered load as covered by our own fleet (zero re-key combo handoff)
      if (['posted', 'bidding', 'accepted'].includes(load.status)) {
        await supabase.from('freight_loads').update({ status: 'booked', booked_at: new Date().toISOString() }).eq('id', load.id)
      }
      setAssign(null)
      await loadAll()
    } catch (e) {
      setErr(e.message || 'Could not assign')
    } finally {
      setSaving(false)
    }
  }

  async function advance(d) {
    setBusyId(d.id)
    try {
      const next = nextStage(d.current_status)
      const patch = { current_status: next, updated_at: new Date().toISOString() }
      if (next === 'en_route' && !d.actual_pickup) patch.actual_pickup = new Date().toISOString()
      if (next === 'delivered') {
        patch.actual_delivery = new Date().toISOString()
        if (d.load_id) await supabase.from('freight_loads').update({ status: 'complete', completed_at: new Date().toISOString() }).eq('id', d.load_id)
      } else if (d.load_id && (next === 'picked_up' || next === 'en_route')) {
        await supabase.from('freight_loads').update({ status: 'en_route' }).eq('id', d.load_id)
      }
      const { error } = await supabase.from('freight_dispatches').update(patch).eq('id', d.id)
      if (error) throw error
      await loadAll()
    } catch (e) {
      console.error(e)
    } finally {
      setBusyId(null)
    }
  }

  async function unassign(d) {
    if (!window.confirm('Release this truck and put the load back in the cover queue?')) return
    setBusyId(d.id)
    try {
      await supabase.from('freight_dispatches').delete().eq('id', d.id)
      if (d.load_id) await supabase.from('freight_loads').update({ status: 'posted', booked_at: null }).eq('id', d.load_id)
      await loadAll()
    } catch (e) {
      console.error(e)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            <h1 className="text-xl font-bold text-white">Dispatch Board</h1>
          </div>
          <p className="text-sm text-gray-400">Cover brokered loads with BHF Logistics trucks — one record, zero re-key.</p>
        </div>
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

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Loads to cover */}
          <div className="xl:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Loads to Cover</h2>
              <span className="text-xs text-gray-500">{loadsToCover.length}</span>
            </div>
            <div className="space-y-3">
              {loadsToCover.length === 0 ? (
                <div className="bg-navy-800 border border-navy-700/50 rounded-xl py-10 text-center">
                  <p className="text-gray-400 text-sm font-medium">All loads covered</p>
                  <p className="text-gray-600 text-xs mt-1">Brokered loads ready for a truck show up here</p>
                </div>
              ) : loadsToCover.map(l => (
                <div key={l.id} className="bg-navy-800 border border-navy-700/50 rounded-xl p-4 hover:border-brand-blue/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{route(l)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {l.freight_shippers?.company_name || '—'} · {(l.equipment_type || '').replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-emerald-400 whitespace-nowrap">{money(l.shipper_rate || l.final_rate)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-500">
                      {l.pickup_date ? 'PU ' + new Date(l.pickup_date).toLocaleDateString() : 'PU TBD'}
                      {l.miles ? ` · ${Number(l.miles).toLocaleString()} mi` : ''}
                    </span>
                    <button onClick={() => openAssign(l)} className="px-3 py-1.5 bg-brand-blue text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors">
                      Assign to Fleet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fleet board */}
          <div className="xl:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Fleet Board</h2>
              <span className="text-xs text-gray-500">{activeTrucks.length} power units</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeTrucks.map(t => {
                const d = activeDispatchForTruck(t.id)
                const ld = d ? loadFor(d.load_id) : null
                return (
                  <div key={t.id} className={`bg-navy-800 border rounded-xl p-4 ${d ? 'border-violet-500/30' : 'border-navy-700/50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Truck {t.unit_number}</span>
                        {t.assigned_driver_id && <span className="text-xs text-gray-500">· {driverName(t.assigned_driver_id) || 'Driver'}</span>}
                      </div>
                      {d ? <Pill map={DISPATCH_STATUS} status={d.current_status} /> : <Pill map={TRUCK_STATUS} status="active" />}
                    </div>

                    {d ? (
                      <>
                        <div className="mt-3 pt-3 border-t border-navy-700/40">
                          <p className="text-sm font-medium text-white">{ld ? route(ld) : 'Load'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {ld?.freight_shippers?.company_name || ''}
                            {d.trailer_number ? ` · Trailer ${d.trailer_number}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {d.current_status !== 'delivered' && (
                            <button disabled={busyId === d.id} onClick={() => advance(d)} className="px-3 py-1.5 bg-brand-blue text-white rounded-lg text-xs font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors">
                              {busyId === d.id ? '…' : `Mark ${DISPATCH_STATUS[nextStage(d.current_status)]?.label}`}
                            </button>
                          )}
                          <button disabled={busyId === d.id} onClick={() => unassign(d)} className="px-3 py-1.5 border border-navy-600 text-gray-400 rounded-lg text-xs font-medium hover:text-white hover:border-red-500/40 disabled:opacity-50 transition-colors">
                            Release
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-navy-700/40 flex items-center justify-between">
                        <span className="text-xs text-gray-500">{t.assigned_driver_id ? 'Available for dispatch' : 'No driver assigned'}</span>
                        <span className="text-xs text-emerald-400 font-medium">Empty</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assign && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700/50">
              <h2 className="text-base font-semibold text-white">Assign to Fleet</h2>
              <button onClick={() => setAssign(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-navy-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-navy-900 border border-navy-700/50 rounded-lg p-3">
                <p className="text-sm font-semibold text-white">{route(assign.load)}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {assign.load.freight_shippers?.company_name || '—'} · {money(assign.load.shipper_rate || assign.load.final_rate)}
                  {assign.load.equipment_type ? ` · ${assign.load.equipment_type.replace(/_/g, ' ')}` : ''}
                </p>
              </div>
              <Field label="Truck">
                <select value={form.truck_id} onChange={e => onTruckPick(e.target.value)} className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white focus:outline-none focus:border-brand-blue/60">
                  <option value="">Select truck…</option>
                  {activeTrucks.filter(t => t.assigned_driver_id && !activeDispatchForTruck(t.id)).map(t => (
                    <option key={t.id} value={t.id}>Truck {t.unit_number} — {driverName(t.assigned_driver_id)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Driver">
                <select value={form.driver_id} onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))} className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white focus:outline-none focus:border-brand-blue/60">
                  <option value="">Select driver…</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
                </select>
              </Field>
              <Field label="Trailer">
                <select value={form.trailer_id} onChange={e => setForm(f => ({ ...f, trailer_id: e.target.value }))} className="w-full px-3 py-2.5 bg-navy-900 border border-navy-600 rounded-lg text-sm text-white focus:outline-none focus:border-brand-blue/60">
                  <option value="">Select trailer…</option>
                  {trailers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>Trailer {t.unit_number} — {t.trailer_type}</option>)}
                </select>
              </Field>
              {err && <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{err}</div>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-navy-700/50">
              <button onClick={() => setAssign(null)} className="px-4 py-2 border border-navy-600 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={confirmAssign} disabled={saving} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors">{saving ? 'Assigning…' : 'Dispatch Load'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
