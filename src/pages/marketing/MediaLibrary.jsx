// MediaLibrary: pick image(s) for a social post from the marketing-media library,
// upload, generate a fresh one with AI, or make an AI variant of an existing image.
// Supports single OR multiple selection (pass `multiple`). onSelect returns a single
// URL string in single mode, or an array of URLs in multiple mode.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export default function MediaLibrary({ isOpen, onClose, onSelect, multiple = false }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')        // '' | 'upload' | 'generate' | 'variant'
  const [error, setError] = useState('')
  const [prompt, setPrompt] = useState('')
  const [selected, setSelected] = useState([])   // array of selected item objects
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('marketing_media')
      .select('id, name, public_url, source, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(120)
    if (error) setError(error.message)
    setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setSelected([])
    load()
  }, [isOpen, load])

  if (!isOpen) return null

  const isSelected = (it) => selected.some(s => s.id === it.id)
  function toggle(it) {
    setSelected(prev => {
      if (multiple) {
        return prev.some(s => s.id === it.id) ? prev.filter(s => s.id !== it.id) : [...prev, it]
      }
      return prev.length === 1 && prev[0].id === it.id ? [] : [it]
    })
  }
  const variantSource = selected.length ? selected[selected.length - 1] : null

  async function callImageFn(body) {
    const { data: sessionRes } = await supabase.auth.getSession()
    const accessToken = sessionRes?.session?.access_token
    if (!accessToken) throw new Error('Not signed in')
    const res = await fetch(`${supabase.supabaseUrl}/functions/v1/marketing-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`)
    return json
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (file) {
      e.target.value = ''
      setBusy('upload')
      setError('')
      try {
        const ext = (file.name.split('.').pop() || 'png').toLowerCase()
        const path = `upload/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage.from('marketing-media').upload(path, file, { contentType: file.type || 'image/png', upsert: false })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('marketing-media').getPublicUrl(path)
        const { error: insErr } = await supabase.from('marketing_media').insert({
          name: file.name.slice(0, 160), bucket_path: path, public_url: pub.publicUrl, source: 'upload', mime: file.type || null,
        })
        if (insErr) throw insErr
        await load()
      } catch (err) {
        setError(err.message || 'Upload failed')
      } finally {
        setBusy('')
      }
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) { setError('Describe the image you want to generate.'); return }
    setBusy('generate')
    setError('')
    try {
      await callImageFn({ mode: 'generate', prompt })
      setPrompt('')
      await load()
    } catch (err) {
      setError(err.message || 'Generate failed')
    } finally {
      setBusy('')
    }
  }

  async function handleVariant() {
    if (!variantSource) return
    setBusy('variant')
    setError('')
    try {
      await callImageFn({ mode: 'variant', image_url: variantSource.public_url, prompt: prompt || undefined })
      await load()
    } catch (err) {
      setError(err.message || 'Variant failed')
    } finally {
      setBusy('')
    }
  }

  function useSelected() {
    if (!selected.length) return
    const urls = selected.map(s => s.public_url)
    onSelect?.(multiple ? urls : urls[0])
  }

  const working = busy !== ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Image library</h2>
            <p className="text-xs text-slate-400 mt-1">
              {multiple ? 'Select one or more images for your post' : 'Pick an image for your post'} — or upload, generate a fresh one, or make an AI variant.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 mb-4">
          <label className="text-xs text-slate-400 mb-1 block">Generate a new image / describe a variant</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="e.g. A reseller scanning a thrift find with a phone, clean studio look, Liftori blue accents"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <button onClick={handleGenerate} disabled={working} className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
              {busy === 'generate' ? 'Generating…' : 'Generate with AI'}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={working} className="bg-slate-700 hover:bg-slate-600 disabled:text-slate-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
              {busy === 'upload' ? 'Uploading…' : 'Upload image'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm mb-4">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-10 text-slate-500 text-sm">Loading library…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">No images yet. Upload one or generate with AI above.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((it) => {
              const sel = isSelected(it)
              const order = sel ? selected.findIndex(s => s.id === it.id) + 1 : null
              return (
                <button
                  key={it.id}
                  onClick={() => toggle(it)}
                  className={`group relative rounded-lg overflow-hidden border-2 transition-colors ${sel ? 'border-sky-500' : 'border-slate-700 hover:border-slate-500'}`}
                >
                  <img src={it.public_url} alt={it.name || 'media'} className="w-full h-28 object-cover bg-slate-800" loading="lazy" />
                  <span className="absolute top-1 left-1 text-[10px] uppercase bg-black/60 text-slate-200 px-1.5 py-0.5 rounded">{it.source}</span>
                  {sel && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-sky-500 text-white text-[11px] font-bold flex items-center justify-center">
                      {multiple ? order : '✓'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {selected.length > 0 && (
          <div className="sticky bottom-0 mt-4 -mx-6 -mb-6 px-6 py-3 bg-slate-900/95 border-t border-slate-700 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 mr-auto truncate max-w-[35%]">
              {multiple ? `${selected.length} selected` : (selected[0].name || 'image')}
            </span>
            <button onClick={handleVariant} disabled={working} className="bg-slate-700 hover:bg-slate-600 disabled:text-slate-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
              {busy === 'variant' ? 'Making variant…' : 'Make AI variant'}
            </button>
            <button onClick={useSelected} disabled={working} className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
              {multiple ? `Use ${selected.length} image${selected.length > 1 ? 's' : ''} →` : 'Use this image →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
