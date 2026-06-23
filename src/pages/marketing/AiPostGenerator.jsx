// AiPostGenerator: modal that calls generate-marketing-post edge function and lets
// the user pick one of 3 AI-drafted variants. The picked variant fills the parent's
// post content + suggested card template. No DB writes — purely a draft picker.
//
// Two modes (prop `mode`):
//   'generate' (default) — draft new posts from a topic + steering dropdowns
//   'improve'            — rewrite an existing post (prop `baseContent`) using typed
//                          commands + the same steering dropdowns ("Update with AI")

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const CONTENT_TYPE_OPTIONS = [
  'Announcement', 'Product Launch', 'Tip / How-To', 'Behind the Scenes',
  'Promotion', 'Event', 'Testimonial', 'Question / Poll', 'Custom',
]
const GOAL_OPTIONS = [
  ['', 'Auto'],
  ['build awareness', 'Awareness'],
  ['drive engagement (comments, shares)', 'Engagement'],
  ['drive clicks / traffic to the link', 'Clicks / traffic'],
  ['drive signups or leads', 'Signups / leads'],
  ['drive job applications', 'Hiring / applications'],
  ['build brand trust / authority', 'Brand trust'],
]
const HOOK_OPTIONS = [
  ['', 'Auto'],
  ['a bold claim', 'Bold claim'],
  ['a question', 'Question'],
  ['a surprising stat', 'Surprising stat'],
  ['a short story', 'Short story'],
  ['a contrarian take', 'Contrarian take'],
  ['a direct, clear statement', 'Direct & clear'],
]
const LENGTH_OPTIONS = [
  ['', 'Auto'],
  ['short', 'Very short'],
  ['medium', 'Short'],
  ['detailed', 'Detailed'],
  ['structured', 'Hook + 3 points + CTA'],
]
const HASHTAG_OPTIONS = [
  ['', 'Auto'],
  ['none', 'None'],
  ['few', 'Few (branded)'],
  ['discovery', 'Discovery (4-6)'],
]
const PLATFORM_OPTIONS = [
  ['facebook', 'Facebook'],
  ['linkedin', 'LinkedIn'],
  ['instagram', 'Instagram'],
  ['x', 'X (Twitter)'],
]

const SELECT_CLS = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500'

export default function AiPostGenerator({ isOpen, onClose, onPickVariant, mode = 'generate', baseContent = '' }) {
  const improve = mode === 'improve'
  const [contentType, setContentType] = useState('Announcement')
  const [customPrompt, setCustomPrompt] = useState('')
  const [instruction, setInstruction] = useState('')
  const [sourceType, setSourceType] = useState('manual')
  const [goal, setGoal] = useState('')
  const [hookStyle, setHookStyle] = useState('')
  const [length, setLength] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [platform, setPlatform] = useState('facebook')
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
          mode,
          base_content: improve ? (baseContent || '') : undefined,
          instruction: improve ? (instruction || undefined) : undefined,
          content_type: contentType,
          source_type: !improve && sourceType !== 'manual' ? sourceType : undefined,
          custom_prompt: !improve ? (customPrompt || undefined) : undefined,
          goal: goal || undefined,
          hook_style: hookStyle || undefined,
          length: length || undefined,
          hashtags: hashtags || undefined,
          platform: platform || undefined,
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
    setInstruction('')
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
              <span className="text-violet-400">✨</span> {improve ? 'Update with AI' : 'AI post generator'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {improve
                ? 'Claude rewrites your post using your commands + the controls below. Pick the version you like.'
                : 'Claude drafts 3 variants. Pick one. You still approve before publish.'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Improve mode: show the current post being improved */}
        {improve && (
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-1 block">Current post</label>
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {baseContent ? baseContent : <span className="text-slate-500">No content yet.</span>}
            </div>
          </div>
        )}

        {/* Improve mode: typed commands */}
        {improve && (
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-1 block">What should change? (commands)</label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Make it punchier and shorter. Add a clear call to apply. Lead with the commission upside. Drop the corporate tone."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>
        )}

        {/* Steering dropdowns (both modes) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {!improve && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Content type</label>
              <select value={contentType} onChange={(e) => setContentType(e.target.value)} className={SELECT_CLS}>
                {CONTENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={SELECT_CLS}>
              {PLATFORM_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Goal</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className={SELECT_CLS}>
              {GOAL_OPTIONS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Hook style</label>
            <select value={hookStyle} onChange={(e) => setHookStyle(e.target.value)} className={SELECT_CLS}>
              {HOOK_OPTIONS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Length</label>
            <select value={length} onChange={(e) => setLength(e.target.value)} className={SELECT_CLS}>
              {LENGTH_OPTIONS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Hashtags</label>
            <select value={hashtags} onChange={(e) => setHashtags(e.target.value)} className={SELECT_CLS}>
              {HASHTAG_OPTIONS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Generate mode: topic + context */}
        {!improve && (
          <>
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Pull context from</label>
              <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={SELECT_CLS + ' md:w-1/2'}>
                <option value="manual">Just my topic below</option>
                <option value="customer_win">Most recent client launch</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">What's the post about? (optional)</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. We're hiring a remote, commission-only CRM sales rep. Want it to attract closers, not order-takers."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>
          </>
        )}

        <div className="flex gap-2 mb-4">
          <button
            onClick={generate}
            disabled={loading || (improve && !baseContent)}
            className="bg-violet-500 hover:bg-violet-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Working…' : (improve ? 'Improve — 3 versions' : 'Generate 3 variants')}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {variants.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              {improve ? 'Pick the rewrite you want' : 'Pick one — fills your composer'}
            </div>
            {variants.map((v, i) => (
              <div key={i} className="bg-slate-800/70 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wide text-violet-400">{improve ? 'Version' : 'Variant'} {i + 1}</span>
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
                    {improve ? 'Use this version →' : 'Use this variant →'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && variants.length === 0 && !error && (
          <div className="text-center py-8 text-slate-500 text-sm">
            {improve ? 'Add a command or set the controls, then Improve.' : 'Click "Generate 3 variants" to start'}
          </div>
        )}
      </div>
    </div>
  )
}
