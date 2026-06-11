import { useEffect, useRef, useState } from 'react'
import { useCrm } from '../../contexts/CrmContext'

// Customer/job photo library. Uploads to the private 'customer-photos'
// bucket, records rows in customer_photos, and shows a captioned gallery.
// These photos can be pulled into estimates (see the estimate builder).
const CATEGORIES = ['general', 'damage', 'before', 'after', 'vent', 'measurement', 'roof']

export default function CustomerPhotos({ contactId, workOrderId = null }) {
  const { client } = useCrm()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { if (contactId) load() }, [contactId])

  async function load() {
    setLoading(true)
    const { data } = await client
      .from('customer_photos')
      .select('*')
      .eq('contact_id', contactId)
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
      const path = contactId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext
      const { error: upErr } = await client.storage
        .from('customer-photos')
        .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })
      if (upErr) { console.error('photo upload failed', upErr); continue }
      await client.from('customer_photos').insert({
        contact_id: contactId,
        work_order_id: workOrderId,
        storage_path: path,
        caption: '',
        category: 'general',
      })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  function setLocal(id, patch) {
    setPhotos((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  async function persist(id, patch) {
    await client.from('customer_photos').update(patch).eq('id', id)
  }

  async function remove(id, storagePath) {
    if (!window.confirm('Delete this photo?')) return
    await client.from('customer_photos').delete().eq('id', id)
    if (storagePath) await client.storage.from('customer-photos').remove([storagePath])
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Photos</h3>
        <button
          type="button"
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={uploading}
          className="text-xs px-3 py-1.5 rounded-lg bg-brand-cyan text-navy-900 font-medium disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : '+ Add photos'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : photos.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No photos yet. Add job photos (damage, vents, before/after) — they can be attached to estimates.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="bg-navy-900/40 border border-navy-700/50 rounded-lg overflow-hidden">
              <div className="aspect-square bg-navy-950">
                {p.signedUrl && (
                  <img src={p.signedUrl} alt={p.caption || 'customer photo'} className="w-full h-full object-cover" />
                )}
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
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => remove(p.id, p.storage_path)}
                    className="text-[11px] text-red-400 hover:text-red-300 px-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
