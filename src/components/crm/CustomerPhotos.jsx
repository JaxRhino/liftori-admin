import { useEffect, useMemo, useRef, useState } from 'react'
import { useCrm } from '../../contexts/CrmContext'

// Customer/job photo documentation. Uploads to the private 'customer-photos'
// bucket, records rows in customer_photos, and shows a stage-grouped gallery
// (aerial / damage / progress / completion, etc.). Photos can be pulled into
// estimates (see the estimate builder).
const CATEGORIES = ['aerial', 'damage', 'before', 'progress', 'after', 'completion', 'measurement', 'vent', 'roof', 'general']
const CAT_LABEL = { aerial: 'Aerial', damage: 'Damage', before: 'Before', progress: 'Progress', after: 'After', completion: 'Completion', measurement: 'Measurement', vent: 'Vents', roof: 'Roof', general: 'General' }
const lbl = (c) => CAT_LABEL[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : 'General')

export default function CustomerPhotos({ contactId, workOrderId = null, pipelineId = null }) {
  const { client } = useCrm()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [upCat, setUpCat] = useState('general')
  const [filter, setFilter] = useState('all')
  const fileRef = useRef(null)

  useEffect(() => { if (contactId || pipelineId) load() }, [contactId, pipelineId])

  async function load() {
    setLoading(true)
    let q = client.from('customer_photos').select('*')
    if (pipelineId) q = q.eq('pipeline_id', pipelineId)
    else q = q.eq('contact_id', contactId)
    const { data } = await q
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    const rows = data || []
    const signed = await Promise.all(rows.map(async (p) => {
      if (!p.storage_path) return { ...p, signedUrl: p.url || null }
      const { data: s } = await client.storage.from('customer-photos').createSignedUrl(p.storage_path, 3600)
      return { ...p, signedUrl: (s && s.signedUrl) || p.url || null }
    }))
    setPhotos(signed)
    setLoading(false)
  }

  async function onFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = (contactId || pipelineId || 'job') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext
      const { error: upErr } = await client.storage
        .from('customer-photos')
        .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })
      if (upErr) { console.error('photo upload failed', upErr); continue }
      await client.from('customer_photos').insert({
        contact_id: contactId || null,
        pipeline_id: pipelineId || null,
        work_order_id: workOrderId,
        storage_path: path,
        caption: '',
        category: upCat,
      })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  function setLocal(id, patch) { setPhotos((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))) }
  async function persist(id, patch) { await client.from('customer_photos').update(patch).eq('id', id) }
  async function remove(id, storagePath) {
    if (!window.confirm('Delete this photo?')) return
    await client.from('customer_photos').delete().eq('id', id)
    if (storagePath) await client.storage.from('customer-photos').remove([storagePath])
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  const counts = useMemo(() => {
    const m = {}
    for (const p of photos) { const c = p.category || 'general'; m[c] = (m[c] || 0) + 1 }
    return m
  }, [photos])

  // Categories present, in documentation order, plus any unknown ones at the end.
  const presentCats = useMemo(() => {
    const known = CATEGORIES.filter((c) => counts[c])
    const extra = Object.keys(counts).filter((c) => !CATEGORIES.includes(c))
    return [...known, ...extra]
  }, [counts])

  const visibleCats = filter === 'all' ? presentCats : presentCats.filter((c) => c === filter)

  function PhotoCard({ p }) {
    return (
      <div className="bg-navy-900/40 border border-navy-700/50 rounded-lg overflow-hidden">
        <div className="aspect-square bg-navy-950">
          {p.signedUrl && <img src={p.signedUrl} alt={p.caption || 'customer photo'} className="w-full h-full object-cover" />}
        </div>
        <div className="p-2 space-y-1">
          <input
            value={p.caption || ''}
            onChange={(e) => setLocal(p.id, { caption: e.target.value })}
            onBlur={(e) => persist(p.id, { caption: e.target.value })}
            placeholder="Caption..."
            className="w-full bg-navy-800 border border-navy-700/50 rounded px-2 py-1 text-xs text-white placeholder-gray-500"
          />
          <div className="flex items-center justify-between gap-1">
            <select
              value={p.category || 'general'}
              onChange={(e) => { setLocal(p.id, { category: e.target.value }); persist(p.id, { category: e.target.value }) }}
              className="bg-navy-800 border border-navy-700/50 rounded px-1 py-1 text-[11px] text-gray-300"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{lbl(c)}</option>)}
            </select>
            <button type="button" onClick={() => remove(p.id, p.storage_path)} className="text-[11px] text-red-400 hover:text-red-300 px-1">Delete</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Photo Documentation</h3>
        <div className="flex items-center gap-2">
          <select value={upCat} onChange={(e) => setUpCat(e.target.value)} title="Tag uploads as" className="text-xs bg-navy-800 border border-navy-700/50 rounded-lg px-2 py-1.5 text-gray-200">
            {CATEGORIES.map((c) => <option key={c} value={c}>{lbl(c)}</option>)}
          </select>
          <button type="button" onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading}
            className="text-xs px-3 py-1.5 rounded-lg bg-brand-cyan text-navy-900 font-medium disabled:opacity-50">
            {uploading ? 'Uploading...' : '+ Add photos'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
        </div>
      </div>

      {/* Filter chips */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')} label={`All · ${photos.length}`} />
          {presentCats.map((c) => <Chip key={c} active={filter === c} onClick={() => setFilter(c)} label={`${lbl(c)} · ${counts[c]}`} />)}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : photos.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No photos yet. Tag uploads by stage (aerial, damage, progress, completion) — they group into galleries here and can be attached to estimates.
        </p>
      ) : (
        <div className="space-y-5">
          {visibleCats.map((c) => (
            <div key={c}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-cyan">{lbl(c)}</span>
                <span className="text-[11px] text-gray-500">{counts[c]}</span>
                <div className="flex-1 h-px bg-navy-700/50" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.filter((p) => (p.category || 'general') === c).map((p) => <PhotoCard key={p.id} p={p} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick}
      className={'text-[11px] px-2.5 py-1 rounded-full border transition ' + (active ? 'bg-brand-cyan text-navy-900 border-brand-cyan font-medium' : 'border-navy-700 text-gray-400 hover:text-white')}>
      {label}
    </button>
  )
}
