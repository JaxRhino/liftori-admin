// AiPostGenerator: full-screen modal that calls generate-marketing-post and lets the
// user pick one of 3 AI-drafted variants, previewed as a Facebook post with an optional
// attached image. Quality controls (vibe, goal, hook style, platform, length, hashtags,
// and "write like these" examples) steer the draft. The picked variant fills the
// composer's content, card template, and media image.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import MediaLibrary from './MediaLibrary'

const CONTENT_TYPE_OPTIONS = [
  'Announcement', 'Product Launch', 'Tip / How-To', 'Behind the Scenes',
  'Promotion', 'Event', 'Testimonial', 'Question / Poll', 'Custom',
]
const VIBE_OPTIONS = [
  'Professional', 'Conversational', 'Bold & confident', 'Friendly & warm',
  'Inspirational', 'Playful', 'Educational', 'Urgent / limited-time',
]
const GOAL_OPTIONS = [
  'Get signups / waitlist', 'Drive app downloads', 'Get comments / engagement',
  'Brand awareness', 'Book a demo or call', 'Drive traffic to liftori.ai',
]
const HOOK_OPTIONS = [
  'Bold claim', 'Question', 'Surprising stat', 'Mini-story', 'Contrarian take', 'How we / how-to',
]
const PLATFORM_OPTIONS = [
  { v: 'facebook', l: 'Facebook' }, { v: 'linkedin', l: 'LinkedIn' },
  { v: 'instagram', l: 'Instagram' }, { v: 'x', l: 'X (Twitter)' },
]
const LENGTH_OPTIONS = [
  { v: 'short', l: 'Very short' }, { v: 'medium', l: 'Short' },
  { v: 'detailed', l: 'Detailed' }, { v: 'structured', l: 'Hook + 3 points + CTA' },
]
const HASHTAG_OPTIONS = [
  { v: '', l: 'Auto' }, { v: 'none', l: 'None' }, { v: 'few', l: 'A few (branded)' }, { v: 'discovery', l: 'Discovery set' },
]

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      {children}
    </div>
  )
}
const selectCls = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"

// Facebook-style preview so you see the post the way it publishes.
function PlatformPreview({ text, image }) {
  return (
    <div className="bg-white rounded-lg overflow-hidden text-slate-900 shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <div className="w-9 h-9 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-sm">L</div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">Liftori</div>
          <div className="text-[11px] text-slate-500">Just now · Sponsored</div>
        </div>
      </div>
      <div className="px-3 pb-3 text-sm whitespace-pre-wrap text-slate-800">{text}</div>
      {image && <img src={image} alt="" className="w-full max-h-80 object-cover" />}
      <div className="flex items-center justify-around border-t border-slate-200 text-slate-500 text-xs font-medium py-2">
        <span>Like</span>
        <span>Comment</span>
        <span>Share</span>
      </div>
    </div>
  )
}

export default function AiPostGenerator({ isOpen, onClose, onPickVariant }) {
  const [contentType, setContentType] = useState('Announcement')
  const [postVibe, setPostVibe] = useState('')
  const [goal, setGoal] = useState('')
  const [hookStyle, setHookStyle] = useState('')
  const [platform, setPlatform] = useState('facebook')
  const [length, setLength] = useState('medium')
  const [hashtags, setHashtags] = useState('')
  const [examples, setExamples] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [sourceType, setSourceType] = useState('manual')
  const [productSlug, setProductSlug] = useState('')
  const [products, setProducts] = useState([])
  const [selectedImage, setSelectedImage] = useState('')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [variants, setVariants] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('marketing_products')
        .select('name, slug')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (!cancelled) setProducts(data || [])
    })()
    return () => { cancelled = true }
  }, [isOpen])

  if (!isOpen) return null

  const selectedProduct = products.find(p => p.slug === productSlug) || null

  async function generate() {
    setLoading(true)
    setError('')
    setVariants([])
    try {
      const { data: sessionRes } = await supabase.auth.getSession()
      const accessToken = sessionRes?.session?.access_token
      if (!accessToken) throw new Error('Not signed in')

      const vibeNote = postVibe ? `Tone/vibe: ${postVibe}.` : ''
      const composedPrompt = [vibeNote, customPrompt].filter(Boolean).join(' ').trim() || undefined

      const fnUrl = `${supabase.supabaseUrl}/functions/v1/generate-marketing-post`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          content_type: contentType,
          source_type: sourceType === 'manual' ? undefined : sourceType,
          product_slug: productSlug || undefined,
          custom_prompt: composedPrompt,
          goal: goal || undefined,
          hook_style: hookStyle || undefined,
          platform,
          length,
          hashtags: hashtags || undefined,
          examples: examples.trim() || undefined,
          num_variants: 3,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setVariants(json.variants || [])
    } catch (err) {
      setError(err.message || 'Failed to generate')
    } finally {
      setLoading(false)
    }
  }

  function pick(variant) {
    onPickVariant?.({
      content: variant.content,
      content_type: contentType,
      suggested_card_template: variant.suggested_card_template || 'announcement',
      hashtags: variant.hashtags || [],
      image: selectedImage || '',
    })
    setVariants([])
    setCustomPrompt('')
    setSelectedImage('')
    onClose?.()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 p-3 sm:p-5" onClick={onClose}>
        <button
          onClick={onClose}
          className="fixed top-4 right-5 z-[60] text-slate-300 hover:text-white text-3xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
        <div
          className="bg-slate-900 border border-slate-700 rounded-2xl w-full h-full overflow-y-auto p-6 md:p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-6 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-white">AI post generator</h2>
            <p className="text-xs text-slate-400 mt-1">Claude drafts 3 variants previewed as they'll publish. Pick one. You still approve before publish.</p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Field label="Content type">
                <select value={contentType} onChange={(e) => setContentType(e.target.value)} className={selectCls}>
                  {CONTENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Post vibe">
                <select value={postVibe} onChange={(e) => setPostVibe(e.target.value)} className={selectCls}>
                  <option value="">Brand default voice</option>
                  {VIBE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="Promote which product?">
                <select value={productSlug} onChange={(e) => setProductSlug(e.target.value)} className={selectCls}>
                  <option value="">No specific product</option>
                  {products.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Pull context from">
                <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={selectCls}>
                  <option value="manual">Just my topic below</option>
                  <option value="customer_win">Most recent client launch</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <Field label="Goal">
                <select value={goal} onChange={(e) => setGoal(e.target.value)} className={selectCls}>
                  <option value="">No specific goal</option>
                  {GOAL_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Hook style">
                <select value={hookStyle} onChange={(e) => setHookStyle(e.target.value)} className={selectCls}>
                  <option value="">Let AI choose</option>
                  {HOOK_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
              <Field label="Platform">
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={selectCls}>
                  {PLATFORM_OPTIONS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </Field>
              <Field label="Length">
                <select value={length} onChange={(e) => setLength(e.target.value)} className={selectCls}>
                  {LENGTH_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </Field>
              <Field label="Hashtags">
                <select value={hashtags} onChange={(e) => setHashtags(e.target.value)} className={selectCls}>
                  {HASHTAG_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </Field>
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Write like these (optional) — paste 1-2 posts you love; the AI imitates the voice</label>
              <textarea
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                placeholder="Paste a couple of example posts whose style you want to match..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">What's the post about? (optional)</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Promote BOLO Go to resellers — fast scan-to-list, built-in storefront. Confident, not salesy."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
              />
              {selectedProduct && (
                <p className="text-[11px] text-sky-400 mt-1.5">
                  Writing as the maker of {selectedProduct.name} — it's treated as our own product, not a client.
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Image (optional)</label>
              {selectedImage ? (
                <div className="flex items-center gap-3">
                  <img src={selectedImage} alt="selected" className="w-20 h-20 object-cover rounded-lg border border-slate-700" />
                  <button onClick={() => setLibraryOpen(true)} className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">Change image</button>
                  <button onClick={() => setSelectedImage('')} className="text-slate-400 hover:text-red-400 text-sm">Remove</button>
                </div>
              ) : (
                <button onClick={() => setLibraryOpen(true)} className="w-full border border-dashed border-slate-600 hover:border-sky-500 text-slate-300 text-sm rounded-lg py-3 transition-colors">
                  Add image — pick from library, make a variant, generate, or upload
                </button>
              )}
            </div>

            <div className="flex gap-2 mb-6">
              <button onClick={generate} disabled={loading} className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors">
                {loading ? 'Drafting…' : 'Generate 3 variants'}
              </button>
              <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm mb-4">{error}</div>
            )}
          </div>

          {variants.length > 0 && (
            <div className="mt-2">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">Pick one — fills your composer (preview shown as it publishes)</div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                {variants.map((v, i) => (
                  <div key={i} className="bg-slate-800/70 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase tracking-wide text-sky-400">Variant {i + 1}</span>
                      {v.suggested_card_template && (
                        <span className="text-[10px] uppercase bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">card: {v.suggested_card_template}</span>
                      )}
                    </div>
                    <PlatformPreview text={v.content} image={selectedImage} />
                    {Array.isArray(v.hashtags) && v.hashtags.length > 0 && (
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {v.hashtags.map(h => (
                          <span key={h} className="text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">#{h}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end mt-3">
                      <button onClick={() => pick(v)} className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors">Use this variant →</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && variants.length === 0 && !error && (
            <div className="text-center py-10 text-slate-500 text-sm">Click "Generate 3 variants" to start</div>
          )}
        </div>
      </div>

      <MediaLibrary
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={(url) => { setSelectedImage(url); setLibraryOpen(false) }}
      />
    </>
  )
}
