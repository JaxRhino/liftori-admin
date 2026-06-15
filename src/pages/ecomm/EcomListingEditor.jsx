// =====================================================================
// EcomListingEditor - THE FLAGSHIP FLOW for the thrift shop:
// photograph item -> AI drafts the listing -> publish to website +
// socials. Photos-first, thumb-zone action bar, mobile-first.
// Handles both /listings/new and /listings/:listingId. A draft row is
// created on the first photo upload so storage paths have a listing id.
// =====================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Camera, ChevronDown, ChevronLeft, ChevronRight,
  Loader2, Sparkles, Star, Trash2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useCrmClient, fmtMoney, StatusChip, LISTING_STATUS,
  PlatformIcon, PLATFORM_LABELS, SOCIAL_ACCOUNT_COLUMNS, logActivity,
} from './_ecomShared'

const CONDITION_OPTIONS = [
  { value: 'new_with_tags', label: 'New with tags' },
  { value: 'like_new',      label: 'Like new' },
  { value: 'excellent',     label: 'Excellent' },
  { value: 'very_good',     label: 'Very good' },
  { value: 'good',          label: 'Good' },
  { value: 'fair',          label: 'Fair' },
  { value: 'for_parts',     label: 'For parts / repair' },
]

const SOLD_CHANNELS = [
  { value: 'website',   label: 'Website' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'in_person', label: 'In person' },
  { value: 'other',     label: 'Other' },
]

const SHIPPING_PROFILES = ['small', 'medium', 'large', 'oversized', 'local_pickup']

// AI fields the draft endpoint can fill -> listing columns
const AI_FIELD_MAP = {
  title: 'title',
  description: 'description',
  item_story: 'item_story',
  price_suggestion: 'price',
  condition_rating: 'condition_rating',
  brand_maker: 'brand_maker',
  style_era: 'style_era',
  material: 'material',
  color: 'color',
}

function blankForm() {
  return {
    title: '', description: '', item_story: '',
    price: '', compare_at_price: '', cost: '',
    sku: '', quantity: 1, category_id: '', subcategory: '',
    style_era: '', brand_maker: '', material: '', color: '',
    dimensions: '', weight: '', condition_rating: '', condition_details: '',
    shipping_profile: '', tags: [], is_featured: false, published_to_website: true,
    seo_title: '', seo_description: '',
    status: 'draft', ai_generated: false, main_image_url: '',
    sold_price: null, sold_channel: null, sold_at: null, source: '',
  }
}

const toNum = (v) => (v === '' || v == null ? null : Number(v))

// Legacy/scan-imported listings store the photo only in listings.main_image_url
// with no listing_images rows. Surface that image so the editor shows the cover
// instead of an empty grid (the listings list already reads main_image_url).
function withMainFallback(imgs, mainUrl, title) {
  if (imgs && imgs.length) return imgs
  if (mainUrl) return [{ id: '__main__', image_url: mainUrl, alt_text: title || null, storage_path: null, sort_order: 0, __synthetic: true }]
  return []
}

// ---------- small local UI bits ----------
function EditorSection({ title, open, onToggle, children, hint }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div>
          <span className="text-white font-semibold text-sm">{title}</span>
          {hint && <span className="ml-2 text-xs text-gray-500">{hint}</span>}
        </div>
        {ChevronDown ? <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} /> : null}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  )
}

function Field({ label, children, half }) {
  return (
    <div className={half ? '' : 'col-span-2'}>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-navy-900 border border-navy-700 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-brand-blue/60'

function TagsInput({ tags, onChange }) {
  const [draft, setDraft] = useState('')
  function commit() {
    const t = draft.trim().replace(/,$/, '')
    if (t && !tags.includes(t)) onChange([...tags, t])
    setDraft('')
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 bg-brand-blue/15 text-brand-light text-xs px-2 py-1 rounded-full">
            {t}
            <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} className="hover:text-white" aria-label={`Remove ${t}`}>
              {X ? <X size={12} /> : 'x'}
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() } }}
        onBlur={commit}
        placeholder="Type a tag, press Enter"
        className={inputCls}
      />
    </div>
  )
}

// =====================================================================
export default function EcomListingEditor() {
  const { client, platformId } = useCrmClient()
  const { listingId } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  // The row id - either from the route, or created on first photo/save.
  const [id, setId] = useState(listingId || null)
  const [form, setForm] = useState(blankForm())
  const [images, setImages] = useState([])
  const [pending, setPending] = useState([]) // uploads in flight
  const [categories, setCategories] = useState([])
  const [socialAccounts, setSocialAccounts] = useState([])
  const [loading, setLoading] = useState(Boolean(listingId))
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [open, setOpen] = useState({ basics: true, pricing: true, details: false, settings: false, seo: false })
  const [showSocialPanel, setShowSocialPanel] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [posting, setPosting] = useState(false)
  const [postResults, setPostResults] = useState(null)
  const [soldOpen, setSoldOpen] = useState(false)
  const [soldForm, setSoldForm] = useState({ sold_price: '', sold_channel: 'website' })
  const [shareOpen, setShareOpen] = useState(false)

  // ---------- load ----------
  useEffect(() => {
    if (!client) return
    let active = true
    async function load() {
      try {
        const [cats, socials] = await Promise.all([
          client.from('categories').select('id,name').eq('is_active', true).order('sort_order'),
          client.from('social_accounts').select(SOCIAL_ACCOUNT_COLUMNS).eq('is_active', true),
        ])
        if (!active) return
        setCategories(cats.data || [])
        setSocialAccounts(socials.data || [])
        if (listingId) {
          const [{ data: row, error }, { data: imgs }] = await Promise.all([
            client.from('listings').select('*').eq('id', listingId).single(),
            client.from('listing_images').select('*').eq('listing_id', listingId).order('sort_order'),
          ])
          if (!active) return
          if (error) throw error
          setForm({
            ...blankForm(),
            ...row,
            price: row.price ?? '',
            compare_at_price: row.compare_at_price ?? '',
            cost: row.cost ?? '',
            quantity: row.quantity ?? 1,
            tags: Array.isArray(row.tags) ? row.tags : [],
          })
          setImages(withMainFallback(imgs, row.main_image_url, row.title))
          if (row.status === 'active') setShowSocialPanel(true)
        }
      } catch (e) {
        console.error('Error loading listing:', e)
        toast.error('Failed to load listing')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [client, listingId])

  useEffect(() => {
    // default the social checkboxes to all connected platforms
    setSelectedPlatforms(socialAccounts.map(a => a.platform))
  }, [socialAccounts])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  // ---------- share to facebook (manual) ----------
  function shareCaption() {
    const price = toNum(form.price) != null ? `$${Number(form.price).toFixed(2)}` : ''
    const url = form.slug ? `https://www.vjthriftfinds.com/product.html?slug=${form.slug}` : 'https://www.vjthriftfinds.com'
    const desc = (form.description || '').trim().replace(/\s+/g, ' ').slice(0, 220)
    const tags = (form.tags || []).slice(0, 6).map(t => '#' + String(t).replace(/[^a-z0-9]/gi, '')).filter(x => x.length > 2).join(' ')
    return [`${form.title}${price ? ` \u2014 ${price}` : ''}`, desc, `Shop it here: ${url}`, `#vjthriftfinds #thrifted #vintage ${tags}`.trim()].filter(Boolean).join('\n\n')
  }
  async function copyShareCaption() {
    try { await navigator.clipboard.writeText(shareCaption()); toast.success('Caption copied') }
    catch { toast.error('Could not copy - select the text and copy it manually') }
  }

  // ---------- create-on-first-photo ----------
  async function ensureListing() {
    if (id) return id
    const { data, error } = await client
      .from('listings')
      .insert({ title: form.title || 'New listing', status: 'draft', quantity: form.quantity || 1 })
      .select('id')
      .single()
    if (error) throw error
    setId(data.id)
    return data.id
  }

  // ---------- photos ----------
  async function refreshImages(lid) {
    const { data } = await client.from('listing_images').select('*').eq('listing_id', lid).order('sort_order')
    setImages(data || [])
    return data || []
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    let lid
    try {
      lid = await ensureListing()
    } catch (e) {
      console.error('Error creating draft listing:', e)
      toast.error('Could not start the listing - try again')
      return
    }
    const baseOrder = images.length
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const key = `${Date.now()}-${i}`
      const preview = URL.createObjectURL(file)
      setPending(p => [...p, { key, preview }])
      try {
        const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : 'jpg'
        const path = `${lid}/${Date.now()}-${i}.${ext || 'jpg'}`
        const { error: upErr } = await client.storage.from('listing-photos').upload(path, file)
        if (upErr) throw upErr
        const { data: pub } = client.storage.from('listing-photos').getPublicUrl(path)
        const url = pub?.publicUrl
        const { error: insErr } = await client.from('listing_images').insert({
          listing_id: lid, image_url: url, storage_path: path,
          sort_order: baseOrder + i, alt_text: form.title || null,
        })
        if (insErr) throw insErr
        if (!form.main_image_url && i === 0 && baseOrder === 0) {
          await client.from('listings').update({ main_image_url: url }).eq('id', lid)
          set('main_image_url', url)
        }
      } catch (e) {
        console.error('Photo upload failed:', e)
        toast.error('A photo failed to upload')
      } finally {
        setPending(p => p.filter(x => x.key !== key))
        URL.revokeObjectURL(preview)
      }
    }
    await refreshImages(lid)
  }

  async function setCover(img) {
    try {
      await client.from('listings').update({ main_image_url: img.image_url }).eq('id', id)
      set('main_image_url', img.image_url)
      toast.success('Cover photo set')
    } catch (e) {
      console.error('Error setting cover:', e)
      toast.error('Failed to set cover')
    }
  }

  async function moveImage(index, dir) {
    const target = index + dir
    if (target < 0 || target >= images.length) return
    const a = images[index], b = images[target]
    try {
      await Promise.all([
        client.from('listing_images').update({ sort_order: target }).eq('id', a.id),
        client.from('listing_images').update({ sort_order: index }).eq('id', b.id),
      ])
      await refreshImages(id)
    } catch (e) {
      console.error('Error reordering photos:', e)
      toast.error('Failed to reorder')
    }
  }

  async function deleteImage(img) {
    if (!window.confirm('Delete this photo?')) return
    try {
      if (img.storage_path) await client.storage.from('listing-photos').remove([img.storage_path])
      await client.from('listing_images').delete().eq('id', img.id)
      const rest = await refreshImages(id)
      if (form.main_image_url === img.image_url) {
        const next = rest[0]?.image_url || null
        await client.from('listings').update({ main_image_url: next }).eq('id', id)
        set('main_image_url', next || '')
      }
    } catch (e) {
      console.error('Error deleting photo:', e)
      toast.error('Failed to delete photo')
    }
  }

  // ---------- AI draft ----------
  async function draftWithAI() {
    if (!images.length || aiLoading) return
    setAiLoading(true)
    try {
      const { data, error } = await client.functions.invoke('ai-listing-draft', {
        body: {
          image_urls: images.map(i => i.image_url),
          hints: [form.title, form.brand_maker, form.category_id ? categories.find(c => c.id === form.category_id)?.name : null].filter(Boolean).join(' | ') || undefined,
        },
      })
      if (error) throw error
      if (!data) throw new Error('Empty AI response')

      // The edge function returns { ok, draft }; unwrap so older flat-field
      // reads (data.title, data.tags, ...) keep working either way.
      const draft = data.draft || data

      // Figure out which user-typed fields the AI wants to change.
      const conflicts = []
      const updates = {}
      Object.entries(AI_FIELD_MAP).forEach(([aiKey, formKey]) => {
        const aiVal = draft[aiKey]
        if (aiVal == null || aiVal === '') return
        const current = form[formKey]
        const empty = current === '' || current == null
        if (empty) updates[formKey] = aiVal
        else if (String(current) !== String(aiVal)) conflicts.push({ formKey, aiVal })
      })
      if (Array.isArray(draft.tags) && draft.tags.length) {
        if (!form.tags.length) updates.tags = draft.tags
        else updates.tags = Array.from(new Set([...form.tags, ...draft.tags]))
      }
      if (draft.category_hint && !form.category_id) {
        const match = categories.find(c => c.name.toLowerCase() === String(draft.category_hint).toLowerCase())
        if (match) updates.category_id = match.id
        else updates.subcategory = form.subcategory || draft.category_hint
      }
      if (conflicts.length > 0) {
        const names = conflicts.map(c => c.formKey.replace(/_/g, ' ')).join(', ')
        if (window.confirm(`AI suggests new values for fields you already filled (${names}). Overwrite them?`)) {
          conflicts.forEach(c => { updates[c.formKey] = c.aiVal })
        }
      }
      setForm(f => ({ ...f, ...updates, ai_generated: true }))
      toast.success('AI draft ready - review before publishing')
    } catch (e) {
      console.error('AI draft failed:', e)
      toast.error(e?.message ? `AI draft failed: ${e.message}` : 'AI draft failed - try again')
    } finally {
      setAiLoading(false)
    }
  }

  // ---------- save / publish ----------
  function buildPayload(extra = {}) {
    return {
      title: form.title || 'Untitled listing',
      description: form.description || null,
      item_story: form.item_story || null,
      price: toNum(form.price),
      compare_at_price: toNum(form.compare_at_price),
      cost: toNum(form.cost),
      sku: form.sku || null,
      quantity: Number(form.quantity) || 0,
      category_id: form.category_id || null,
      subcategory: form.subcategory || null,
      style_era: form.style_era || null,
      brand_maker: form.brand_maker || null,
      material: form.material || null,
      color: form.color || null,
      dimensions: form.dimensions || null,
      weight: form.weight || null,
      condition_rating: form.condition_rating || null,
      condition_details: form.condition_details || null,
      shipping_profile: form.shipping_profile || null,
      tags: form.tags,
      is_featured: Boolean(form.is_featured),
      published_to_website: form.published_to_website !== false,
      seo_title: form.seo_title || null,
      seo_description: form.seo_description || null,
      ai_generated: Boolean(form.ai_generated),
      source: form.source || null,
      updated_at: new Date().toISOString(),
      ...extra,
    }
  }

  async function save(extra = {}, successMsg = 'Draft saved') {
    setSaving(true)
    try {
      const lid = await ensureListing()
      const { error } = await client.from('listings').update(buildPayload(extra)).eq('id', lid)
      if (error) throw error
      if (extra.status) set('status', extra.status)
      Object.entries(extra).forEach(([k, v]) => { if (k in form) set(k, v) })
      toast.success(successMsg)
      return true
    } catch (e) {
      console.error('Error saving listing:', e)
      toast.error('Failed to save listing')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!form.title.trim()) { toast.error('Add a title before publishing'); setOpen(o => ({ ...o, basics: true })); return }
    if (toNum(form.price) == null) { toast.error('Set a price before publishing'); setOpen(o => ({ ...o, pricing: true })); return }
    const ok = await save({ status: 'active', published_website_at: new Date().toISOString() }, 'Published to website')
    if (ok) {
      setShowSocialPanel(true)
      logActivity(client, 'listing_published', 'listing', id, { title: form.title })
    }
  }

  async function markSold() {
    const price = toNum(soldForm.sold_price)
    if (price == null) { toast.error('Enter the sold price'); return }
    const ok = await save({
      status: 'sold',
      sold_at: new Date().toISOString(),
      sold_price: price,
      sold_channel: soldForm.sold_channel,
    }, 'Marked sold - congrats!')
    if (ok) {
      setForm(f => ({ ...f, sold_price: price, sold_channel: soldForm.sold_channel, sold_at: new Date().toISOString() }))
      setSoldOpen(false)
      logActivity(client, 'listing_sold', 'listing', id, { sold_price: price, sold_channel: soldForm.sold_channel })
    }
  }

  // ---------- social publish ----------
  async function postToSocials() {
    if (!selectedPlatforms.length || posting) return
    setPosting(true)
    setPostResults(null)
    try {
      const { data, error } = await client.functions.invoke('social-publish', {
        body: { listing_id: id, platforms: selectedPlatforms },
      })
      if (error) throw error
      const results = data?.results || []
      setPostResults(results)
      const okCount = results.filter(r => r.ok).length
      if (okCount === results.length && okCount > 0) toast.success('Posted to socials')
      else if (okCount > 0) toast.warning('Some posts failed - see details below')
      else toast.error('Social posting failed')
    } catch (e) {
      console.error('social-publish failed:', e)
      toast.error(e?.message ? `Posting failed: ${e.message}` : 'Posting failed - try again')
    } finally {
      setPosting(false)
    }
  }

  // ---------- derived ----------
  const profit = useMemo(() => {
    const p = toNum(form.price), c = toNum(form.cost)
    if (p == null) return null
    const net = p - (c || 0)
    const margin = p > 0 ? (net / p) * 100 : 0
    return { net, margin }
  }, [form.price, form.cost])

  const soldProfit = form.status === 'sold' && form.sold_price != null
    ? Number(form.sold_price) - Number(form.cost || 0)
    : null

  if (loading) return <div className="p-6 text-gray-400">Loading listing...</div>

  const isSold = form.status === 'sold'

  return (
    <div className="max-w-3xl mx-auto p-4 sm:px-6 sm:pt-6 pb-32">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(`/crm/${platformId}/listings`)} className="w-9 h-9 rounded-lg hover:bg-navy-800 flex items-center justify-center text-gray-400 hover:text-white" aria-label="Back to listings">
          {ArrowLeft ? <ArrowLeft size={18} /> : null}
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{listingId || id ? (form.title || 'Untitled listing') : 'New Listing'}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusChip map={LISTING_STATUS} value={form.status} />
            {form.ai_generated && (
              <span className="inline-flex items-center gap-1 text-[11px] text-brand-light">
                {Sparkles ? <Sparkles size={11} /> : null} AI draft - review before publishing
              </span>
            )}
          </div>
        </div>
        {(id || listingId) && form.status === 'active' && (
          <button onClick={() => setShareOpen(true)} className="px-3 py-2 bg-brand-blue/15 hover:bg-brand-blue/25 text-brand-light rounded-lg text-sm font-medium shrink-0">
            Share
          </button>
        )}
        {!isSold && (id || listingId) && form.status === 'active' && (
          <button onClick={() => { setSoldForm({ sold_price: form.price || '', sold_channel: 'website' }); setSoldOpen(true) }} className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 rounded-lg text-sm font-medium shrink-0">
            Mark Sold
          </button>
        )}
      </div>

      {/* SOLD BANNER */}
      {isSold && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
          <div className="text-emerald-300 font-semibold text-sm">Sold {form.sold_channel ? `via ${(SOLD_CHANNELS.find(c => c.value === form.sold_channel) || {}).label || form.sold_channel}` : ''} for {fmtMoney(form.sold_price)}</div>
          {soldProfit != null && (
            <div className="text-xs text-gray-400 mt-1">Profit: <span className={soldProfit >= 0 ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>{fmtMoney(soldProfit)}</span> after {fmtMoney(form.cost || 0)} cost</div>
          )}
        </div>
      )}

      {/* ================= PHOTOS FIRST ================= */}
      <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-sm">Photos</h2>
          <span className="text-xs text-gray-500">{images.length} photo{images.length === 1 ? '' : 's'}{form.main_image_url ? '' : images.length ? ' - tap a star to set cover' : ''}</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }} />
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((img, idx) => {
            const isCover = form.main_image_url === img.image_url
            return (
              <div key={img.id} className={`relative aspect-square rounded-lg overflow-hidden border ${isCover ? 'border-brand-blue' : 'border-navy-700/50'} group`}>
                <img src={img.image_url} alt={img.alt_text || ''} className="w-full h-full object-cover bg-navy-900" loading="lazy" />
                {isCover && <div className="absolute top-1 left-1 bg-brand-blue text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">COVER</div>}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1 flex items-center justify-between">
                  <div className="flex gap-0.5">
                    <button type="button" onClick={() => moveImage(idx, -1)} disabled={idx === 0} className="w-6 h-6 rounded bg-black/40 text-white flex items-center justify-center disabled:opacity-30" aria-label="Move left">
                      {ChevronLeft ? <ChevronLeft size={13} /> : '<'}
                    </button>
                    <button type="button" onClick={() => moveImage(idx, 1)} disabled={idx === images.length - 1} className="w-6 h-6 rounded bg-black/40 text-white flex items-center justify-center disabled:opacity-30" aria-label="Move right">
                      {ChevronRight ? <ChevronRight size={13} /> : '>'}
                    </button>
                  </div>
                  <div className="flex gap-0.5">
                    {!isCover && (
                      <button type="button" onClick={() => setCover(img)} className="w-6 h-6 rounded bg-black/40 text-amber-300 flex items-center justify-center" aria-label="Set as cover">
                        {Star ? <Star size={13} /> : '*'}
                      </button>
                    )}
                    <button type="button" onClick={() => deleteImage(img)} className="w-6 h-6 rounded bg-black/40 text-rose-300 flex items-center justify-center" aria-label="Delete photo">
                      {Trash2 ? <Trash2 size={13} /> : 'x'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {pending.map(p => (
            <div key={p.key} className="relative aspect-square rounded-lg overflow-hidden border border-navy-700/50">
              <img src={p.preview} alt="" className="w-full h-full object-cover opacity-50" />
              <div className="absolute inset-0 flex items-center justify-center">
                {Loader2 ? <Loader2 size={20} className="text-brand-blue animate-spin" /> : <span className="text-xs text-brand-blue">...</span>}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-navy-700 hover:border-brand-blue/60 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:text-brand-blue transition-colors"
          >
            {Camera ? <Camera size={22} /> : null}
            <span className="text-[11px] font-medium">{images.length ? 'Add more' : 'Add photos'}</span>
          </button>
        </div>

        {/* AI DRAFT BUTTON */}
        <button
          type="button"
          onClick={draftWithAI}
          disabled={!images.length || aiLoading}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-brand-blue to-brand-cyan text-white hover:opacity-90"
        >
          {aiLoading
            ? (Loader2 ? <Loader2 size={16} className="animate-spin" /> : null)
            : (Sparkles ? <Sparkles size={16} /> : null)}
          {aiLoading ? 'Drafting from your photos...' : 'Draft with AI'}
        </button>
        {!images.length && <p className="text-[11px] text-gray-500 text-center mt-1.5">Add at least one photo to draft with AI</p>}
      </div>

      {/* ================= SECTIONS ================= */}
      <div className="space-y-3">
        <EditorSection title="Basics" open={open.basics} onToggle={() => setOpen(o => ({ ...o, basics: !o.basics }))}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title">
              <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Vintage 70s suede fringe jacket" className={inputCls} />
            </Field>
            <Field label="Category" half>
              <select value={form.category_id || ''} onChange={(e) => set('category_id', e.target.value)} className={inputCls}>
                <option value="">Select...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Subcategory" half>
              <input value={form.subcategory || ''} onChange={(e) => set('subcategory', e.target.value)} placeholder="Jackets" className={inputCls} />
            </Field>
            <Field label="Brand / Maker" half>
              <input value={form.brand_maker || ''} onChange={(e) => set('brand_maker', e.target.value)} placeholder="Levi's" className={inputCls} />
            </Field>
            <Field label="Style / Era" half>
              <input value={form.style_era || ''} onChange={(e) => set('style_era', e.target.value)} placeholder="1970s boho" className={inputCls} />
            </Field>
            <Field label="Condition" half>
              <select value={form.condition_rating || ''} onChange={(e) => set('condition_rating', e.target.value)} className={inputCls}>
                <option value="">Select...</option>
                {form.condition_rating && !CONDITION_OPTIONS.some(c => c.value === form.condition_rating) && (
                  <option value={form.condition_rating}>{`Imported: ${form.condition_rating}`}</option>
                )}
                {CONDITION_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Condition details" half>
              <input value={form.condition_details || ''} onChange={(e) => set('condition_details', e.target.value)} placeholder="Small scuff on left sleeve" className={inputCls} />
            </Field>
          </div>
        </EditorSection>

        <EditorSection title="Pricing" open={open.pricing} onToggle={() => setOpen(o => ({ ...o, pricing: !o.pricing }))}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Price</label>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Compare at</label>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={form.compare_at_price} onChange={(e) => set('compare_at_price', e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Your cost</label>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={form.cost} onChange={(e) => set('cost', e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
          </div>
          {profit && (
            <div className="flex items-center justify-between bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2.5">
              <span className="text-xs text-gray-400">Profit if sold at price</span>
              <span className="text-sm font-semibold">
                <span className={profit.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{fmtMoney(profit.net)}</span>
                <span className="text-gray-500 font-normal ml-2">({profit.margin.toFixed(0)}% margin)</span>
              </span>
            </div>
          )}
        </EditorSection>

        <EditorSection title="Details" open={open.details} onToggle={() => setOpen(o => ({ ...o, details: !o.details }))}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Description">
              <textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} rows={4} placeholder="What is it, what makes it special, flaws to know about..." className={inputCls} />
            </Field>
            <Field label="Item story">
              <textarea value={form.item_story || ''} onChange={(e) => set('item_story', e.target.value)} rows={3} placeholder="Where it came from, the era, the vibe - shoppers love a story" className={inputCls} />
            </Field>
            <Field label="Material" half>
              <input value={form.material || ''} onChange={(e) => set('material', e.target.value)} placeholder="Genuine suede" className={inputCls} />
            </Field>
            <Field label="Color" half>
              <input value={form.color || ''} onChange={(e) => set('color', e.target.value)} placeholder="Tan" className={inputCls} />
            </Field>
            <Field label="Dimensions" half>
              <input value={form.dimensions || ''} onChange={(e) => set('dimensions', e.target.value)} placeholder={'22" pit to pit, 28" length'} className={inputCls} />
            </Field>
            <Field label="Weight" half>
              <input value={form.weight || ''} onChange={(e) => set('weight', e.target.value)} placeholder="2 lb" className={inputCls} />
            </Field>
            <Field label="Tags">
              <TagsInput tags={form.tags} onChange={(t) => set('tags', t)} />
            </Field>
          </div>
        </EditorSection>

        <EditorSection title="Settings" open={open.settings} onToggle={() => setOpen(o => ({ ...o, settings: !o.settings }))}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU" half>
              <div className="flex gap-2">
                <input value={form.sku || ''} onChange={(e) => set('sku', e.target.value)} placeholder="VJT-..." className={inputCls} />
                <button type="button" onClick={() => set('sku', `VJT-${(form.brand_maker || form.subcategory || 'ITEM').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'ITEM'}-${String(Date.now()).slice(-5)}`)} className="px-2.5 py-2 bg-navy-900 border border-navy-700 text-gray-400 hover:text-white rounded-lg text-xs shrink-0">
                  Suggest
                </button>
              </div>
            </Field>
            <Field label="Quantity" half>
              <input type="number" inputMode="numeric" min="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Shipping profile" half>
              <select value={form.shipping_profile || ''} onChange={(e) => set('shipping_profile', e.target.value)} className={inputCls}>
                <option value="">Select...</option>
                {SHIPPING_PROFILES.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Sourced from" half>
              <input value={form.source || ''} onChange={(e) => set('source', e.target.value)} placeholder="Estate sale, Riverside" className={inputCls} />
            </Field>
            <div className="col-span-2 flex items-center justify-between bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2.5">
              <div>
                <span className="text-sm text-gray-300">Show on website</span>
                <span className="block text-[11px] text-gray-500">When on, this listing appears on your storefront once published.</span>
              </div>
              <button type="button" onClick={() => set('published_to_website', form.published_to_website === false ? true : false)} className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${form.published_to_website !== false ? 'bg-brand-blue' : 'bg-navy-700'}`} aria-label="Toggle show on website">
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.published_to_website !== false ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="col-span-2 flex items-center justify-between bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2.5">
              <span className="text-sm text-gray-300">Feature on website</span>
              <button type="button" onClick={() => set('is_featured', !form.is_featured)} className={`w-10 h-6 rounded-full transition-colors relative ${form.is_featured ? 'bg-brand-blue' : 'bg-navy-700'}`} aria-label="Toggle featured">
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.is_featured ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="col-span-2">
              <button type="button" onClick={() => setOpen(o => ({ ...o, seo: !o.seo }))} className="text-xs text-gray-500 hover:text-gray-300">
                {open.seo ? 'Hide' : 'Show'} SEO fields
              </button>
              {open.seo && (
                <div className="mt-2 space-y-3">
                  <Field label="SEO title">
                    <input value={form.seo_title || ''} onChange={(e) => set('seo_title', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="SEO description">
                    <textarea value={form.seo_description || ''} onChange={(e) => set('seo_description', e.target.value)} rows={2} className={inputCls} />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </EditorSection>
      </div>

      {/* ================= POST TO SOCIALS ================= */}
      {showSocialPanel && form.status === 'active' && (
        <div className="mt-4 bg-navy-800 border border-brand-blue/30 rounded-xl p-4">
          <h2 className="text-white font-semibold text-sm mb-1">Post to socials</h2>
          <p className="text-xs text-gray-500 mb-3">Share this listing on your connected pages.</p>
          {socialAccounts.length === 0 ? (
            <p className="text-sm text-gray-400">No social accounts connected yet. Set them up in the Social hub.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {socialAccounts.map(acc => {
                  const checked = selectedPlatforms.includes(acc.platform)
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedPlatforms(p => checked ? p.filter(x => x !== acc.platform) : [...p, acc.platform])}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${checked ? 'border-brand-blue bg-brand-blue/10 text-white' : 'border-navy-700 text-gray-400 hover:text-white'}`}
                    >
                      <PlatformIcon platform={acc.platform} className="w-4 h-4" />
                      {PLATFORM_LABELS[acc.platform] || acc.platform}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={postToSocials}
                disabled={posting || !selectedPlatforms.length}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium disabled:opacity-40"
              >
                {posting ? (Loader2 ? <Loader2 size={15} className="animate-spin" /> : null) : null}
                {posting ? 'Posting...' : `Post to ${selectedPlatforms.length} platform${selectedPlatforms.length === 1 ? '' : 's'}`}
              </button>
              {postResults && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {postResults.map((r, i) => (
                    <span key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${r.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      <PlatformIcon platform={r.platform} className="w-3.5 h-3.5" />
                      {PLATFORM_LABELS[r.platform] || r.platform}: {r.ok ? 'posted' : (r.error || 'failed')}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ================= STICKY ACTION BAR (thumb zone) ================= */}
      {!isSold && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-navy-900/95 backdrop-blur border-t border-navy-700/50 p-3 sm:pl-[calc(env(safe-area-inset-left)+0.75rem)]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
          <div className="max-w-3xl mx-auto flex gap-2">
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-navy-800 border border-navy-700 hover:border-navy-600 text-gray-300 hover:text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={saving}
              className="flex-[1.4] px-4 py-3 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {form.status === 'active' ? 'Update Listing' : 'Publish'}
            </button>
          </div>
        </div>
      )}

      {/* ================= SHARE MODAL ================= */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShareOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-navy-900 border border-navy-700/50 rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-semibold mb-1">Share to Facebook</h2>
            <p className="text-xs text-gray-500 mb-4">Post this listing to your Facebook Page in three quick steps.</p>
            {form.main_image_url && (
              <div className="mb-3">
                <img src={form.main_image_url} alt="" className="w-full h-44 object-cover rounded-lg bg-navy-800" />
                <a href={form.main_image_url} target="_blank" rel="noreferrer" className="inline-block mt-1.5 text-xs text-brand-light hover:text-white">Open photo to save it</a>
              </div>
            )}
            <label className="block text-xs font-medium text-gray-400 mb-1">Caption</label>
            <textarea readOnly value={shareCaption()} rows={7} onFocus={(e) => e.target.select()} className={inputCls + ' resize-none'} />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={copyShareCaption} className="flex-1 px-4 py-2.5 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium">Copy caption</button>
              <a href="https://www.facebook.com" target="_blank" rel="noreferrer" className="flex-1 px-4 py-2.5 bg-navy-800 border border-navy-700 text-gray-200 hover:text-white rounded-lg text-sm font-medium text-center">Open Facebook</a>
            </div>
            <ol className="mt-4 text-xs text-gray-400 space-y-1 list-decimal list-inside">
              <li>Tap Copy caption and Open photo to save it.</li>
              <li>On your Facebook Page, start a post and add the saved photo.</li>
              <li>Paste the caption and post.</li>
            </ol>
            <button onClick={() => setShareOpen(false)} className="w-full mt-4 px-4 py-2.5 bg-navy-800 border border-navy-700 text-gray-300 rounded-lg text-sm">Close</button>
          </div>
        </div>
      )}

      {/* ================= MARK SOLD MODAL ================= */}
      {soldOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSoldOpen(false)} />
          <div className="relative w-full sm:max-w-sm bg-navy-900 border border-navy-700/50 rounded-t-2xl sm:rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Mark as sold</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Sold price</label>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={soldForm.sold_price} onChange={(e) => setSoldForm(f => ({ ...f, sold_price: e.target.value }))} className={inputCls} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Sold via</label>
                <select value={soldForm.sold_channel} onChange={(e) => setSoldForm(f => ({ ...f, sold_channel: e.target.value }))} className={inputCls}>
                  {SOLD_CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              {toNum(soldForm.sold_price) != null && (
                <div className="text-xs text-gray-400">
                  Profit: <span className="text-emerald-300 font-semibold">{fmtMoney(toNum(soldForm.sold_price) - Number(form.cost || 0))}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setSoldOpen(false)} className="flex-1 px-4 py-2.5 bg-navy-800 border border-navy-700 text-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={markSold} disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50">Confirm Sale</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
