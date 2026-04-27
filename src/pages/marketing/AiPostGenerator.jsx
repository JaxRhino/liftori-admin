// AiPostGenerator: modal that calls generate-marketing-post edge function and lets
// the user pick one of 3 AI-drafted variants. The picked variant fills the parent's
// post content + suggested card template. No DB writes — purely a draft picker.

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const CONTENT_TYPE_OPTIONS = [
  'Announcement', 'Product Launch', 'Tip / How-To', 'Behind the Scenes',
  'Promotion', 'Event', 'Testimonial', 'Question / Poll', 'Custom',
]

export default function AiPostGenerator({ isOpen, onClose, onPickVariant }) {
  const [contentType, setContentType] = useState('Announcement')
  const [customPrompt, setCustomPrompt] = useState('')
  const [sourceType, setSourceType] = useState('manual')
  const [loading, setLoading] = useState(false)
  const [variants, setVariants] = useState([])
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function generate() {
    setLoading(true)
    setError('')
    setVariants([])
    try {
      const { data: sessionRes } = await supabase.auth.getSession()
      const accessToken = sessionRes?.session?.access_token
      if (!accessToken) throw new Error('Not signed in')

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
          custom_prompt: customPrompt || undefined,
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
    })
    setVariants([])
    setCustomPrompt('')
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-violet-400">✨</span> AI post generator
            </h2>
            <p className="text-xs text-slate-400 mt-1">Claude drafts 3 variants. Pick one. You still approve before publish.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Content type</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
            >
              {CONTENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Pull context from</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
            >
              <option value="manual">Just my topic below</option>
              <option value="customer_win">Most recent client launch</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-slate-400 mb-1 block">What's the post about? (optional)</label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g. We just launched VJ Thrift Finds — first real customer platform. Want to celebrate their go-live without sounding salesy."
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
          />
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={generate}
            disabled={loading}
            className="bg-violet-500 hover:bg-violet-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Drafting…' : 'Generate 3 variants'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm mb-4">
            ✗ {error}
          </div>
        )}

        {variants.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Pick one — fills your composer</div>
            {variants.map((v, i) => (
              <div key={i} className="bg-slate-800/70 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wide text-violet-400">Variant {i + 1}</span>
                  {v.suggested_card_template && (
                    <span className="text-[10px] uppercase bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                      card: {v.suggested_card_template}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{v.content}</p>
                {Array.isArray(v.hashtags) && v.hashtags.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {v.hashtags.map(h => (
                      <span key={h} className="text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                        #{h}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => pick(v)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Use this variant →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && variants.length === 0 && !error && (
          <div className="text-center py-8 text-slate-500 text-sm">
            <div className="text-3xl mb-2">✦</div>
            <div>Click "Generate 3 variants" to start</div>
          </div>
        )}
      </div>
    </div>
  )
}
