// =====================================================================
// LabosMarketing — the customer's social growth engine.
// Hero metrics, Post Composer, Content Library, Connected Accounts,
// Scheduled Posts, Share-a-Listing. Built to feel like a polished
// marketing suite, not a placeholder.
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import {
  Megaphone, Image as ImageIcon, Calendar, TrendingUp, Sparkles, Plus, Share2,
  Link2, Mail, Check, X,
  Camera, Upload, Clock, Eye, Heart, MessageCircle, Zap, ChevronRight, ArrowUpRight
} from 'lucide-react'
import { HubPage, useLabosClient } from './_shared'

// Brand icons (Facebook/Instagram/YouTube/Twitter) were removed from lucide-react
// in 2024 for trademark reasons. We render branded text-initial badges instead —
// cleaner look anyway, and zero licensing risk.
const PLATFORMS = [
  { key: 'facebook',  name: 'Facebook',       initials: 'Fb', color: 'bg-[#1877F2]',                                                        hint: 'Pages + Groups' },
  { key: 'instagram', name: 'Instagram',      initials: 'Ig', color: 'bg-gradient-to-br from-fuchsia-500 via-red-500 to-amber-500',         hint: 'Feed + Stories' },
  { key: 'tiktok',    name: 'TikTok',         initials: 'Tt', color: 'bg-black border border-white/20',                                     hint: 'Short video'    },
  { key: 'pinterest', name: 'Pinterest',      initials: 'Pn', color: 'bg-[#E60023]',                                                        hint: 'Pins + Boards'  },
  { key: 'twitter',   name: 'X / Twitter',    initials: 'X',  color: 'bg-black border border-white/20',                                     hint: 'Posts + Threads'},
  { key: 'youtube',   name: 'YouTube Shorts', initials: 'Yt', color: 'bg-[#FF0000]',                                                        hint: 'Shorts + Videos'},
]

function PlatformBadge({ platform, size = 'md', className = '' }) {
  const sizing = size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-14 w-14 text-base' : 'h-11 w-11 text-xs'
  return (
    <div className={`${sizing} ${platform.color} rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${className}`}>
      {platform.initials}
    </div>
  )
}

export default function LabosMarketing() {
  const { client } = useLabosClient()
  const [campaigns, setCampaigns] = useState([])
  const [subs, setSubs] = useState({ total: 0, last30: 0 })
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const [showShareListing, setShowShareListing] = useState(false)

  useEffect(() => {
    if (!client) return
    async function load() {
      setLoading(true)
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
      const [{ data: c }, { count: subTotal }, { count: subRecent }, { data: p }] = await Promise.all([
        client.from('marketing_campaigns').select('*').order('created_at', { ascending: false }).limit(20),
        client.from('email_subscribers').select('*', { count: 'exact', head: true }).is('unsubscribed_at', null),
        client.from('email_subscribers').select('*', { count: 'exact', head: true }).gte('subscribed_at', since).is('unsubscribed_at', null),
        client.from('products').select('id,title,price,main_image_url,status').eq('status', 'published').limit(8),
      ])
      setCampaigns(c || [])
      setSubs({ total: subTotal || 0, last30: subRecent || 0 })
      setProducts(p || [])
      setLoading(false)
    }
    load()
  }, [client])

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length

  return (
    <HubPage
      title="Marketing"
      subtitle="Grow your shop with one-click posts, a content library, and listing share cards"
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setShowShareListing(true)}
            className="inline-flex items-center gap-2 bg-navy-800 hover:bg-navy-700 border border-navy-700/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share a Listing
          </button>
          <button
            onClick={() => setShowComposer(true)}
            className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Post
          </button>
        </div>
      }
    >
      {/* Hero metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricTile icon={<Megaphone className="w-5 h-5" />} label="Active Campaigns" value={activeCampaigns} tone="blue" />
        <MetricTile icon={<Mail className="w-5 h-5" />} label="Email Subscribers" value={subs.total} tone="emerald" hint={subs.last30 > 0 ? `+${subs.last30} in 30d` : null} />
        <MetricTile icon={<ImageIcon className="w-5 h-5" />} label="Content Library" value="—" tone="purple" hint="Upload coming Wave B" />
        <MetricTile icon={<Calendar className="w-5 h-5" />} label="Scheduled Posts" value="0" tone="amber" hint="Connect accounts to schedule" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Post Composer preview */}
        <div className="lg:col-span-2 bg-gradient-to-br from-brand-blue/10 via-brand-blue/5 to-transparent border border-brand-blue/20 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-brand-blue" />
                </div>
                <h3 className="text-white font-semibold text-lg">Post Composer</h3>
              </div>
              <p className="text-sm text-gray-400 mt-1.5 max-w-md">
                Write once, post everywhere. Pick your platforms, add photos, let AI write captions that sell.
              </p>
            </div>
            <button
              onClick={() => setShowComposer(true)}
              className="text-xs text-brand-blue hover:text-brand-cyan flex items-center gap-1"
            >
              Open composer <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {PLATFORMS.map(p => (
              <div key={p.key} className="flex items-center gap-1.5 bg-navy-800/60 border border-navy-700/50 rounded-full pl-1 pr-2.5 py-0.5 text-xs text-gray-400">
                <div className={`w-5 h-5 rounded-full ${p.color} flex items-center justify-center text-[8px] font-bold text-white`}>
                  {p.initials}
                </div>
                <span>{p.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowComposer(true)}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue/90 text-white px-5 py-3 rounded-xl text-sm font-medium transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Create your next post
          </button>
        </div>

        {/* AI Assist callout */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-white font-semibold">AI Marketing Assistant</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4 flex-1">
            Generates captions, hashtags, and branded visuals from your product photos. Ships with Wave C.
          </p>
          <div className="space-y-2">
            <MiniCheck label="Platform-specific captions" />
            <MiniCheck label="Auto-hashtag research" />
            <MiniCheck label="Branded share cards" />
            <MiniCheck label="Best-time-to-post suggestions" />
          </div>
        </div>
      </div>

      {/* Connected accounts */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Connected Accounts
          </h3>
          <span className="text-xs text-gray-500">0 of {PLATFORMS.length} connected</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PLATFORMS.map(p => (
            <div key={p.key} className="bg-navy-800 border border-navy-700/50 rounded-xl p-4 hover:border-navy-600 transition-colors">
              <PlatformBadge platform={p} size="md" className="mb-3" />
              <div className="text-sm text-white font-medium">{p.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{p.hint}</div>
              <button
                disabled
                className="mt-3 w-full text-xs font-medium px-3 py-1.5 rounded-lg bg-navy-700/60 text-gray-400 cursor-not-allowed"
                title="OAuth integration ships in Wave D"
              >
                Connect · Soon
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Meta (Facebook + Instagram) OAuth and scheduled posting ship in Wave D.
        </p>
      </div>

      {/* Content Library */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Content Library
          </h3>
          <button disabled className="text-xs text-gray-500 flex items-center gap-1 cursor-not-allowed">
            <Upload className="w-3.5 h-3.5" />
            Upload · Wave B
          </button>
        </div>
        {products.length === 0 ? (
          <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-10 text-center">
            <Camera className="w-10 h-10 mx-auto text-gray-600 mb-3" />
            <div className="text-sm text-white font-medium mb-1">Your content hub</div>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Upload lifestyle shots, store branding, and behind-the-scenes clips. Tag them by theme so any teammate can grab the right asset in seconds.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-500 mb-3">Your published listings — ready-made post material.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {products.map(p => (
                <div key={p.id} className="aspect-square bg-navy-800 border border-navy-700/50 rounded-lg overflow-hidden relative group">
                  {p.main_image_url ? (
                    <img src={p.main_image_url} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-gray-600" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <div className="text-xs text-white truncate font-medium">{p.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scheduled posts */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Scheduled Posts
          </h3>
          <span className="text-xs text-gray-500">This week</span>
        </div>
        <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-10 text-center">
          <Calendar className="w-10 h-10 mx-auto text-gray-600 mb-3" />
          <div className="text-sm text-white font-medium mb-1">Nothing scheduled</div>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Queue up posts for the week ahead. We'll publish them at the best time for your audience.
          </p>
        </div>
      </div>

      {/* Campaigns table */}
      {campaigns.length > 0 && (
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4" />
            Campaigns
          </h3>
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-navy-700/50">
                  <th className="text-left px-5 py-2 font-medium">Name</th>
                  <th className="text-left px-5 py-2 font-medium">Channel</th>
                  <th className="text-left px-5 py-2 font-medium">Status</th>
                  <th className="text-right px-5 py-2 font-medium">Spend</th>
                  <th className="text-right px-5 py-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/50">
                {campaigns.map(c => (
                  <tr key={c.id} className="hover:bg-navy-900/40">
                    <td className="px-5 py-2.5 text-white">{c.name}</td>
                    <td className="px-5 py-2.5 text-gray-400 capitalize">{c.channel?.replace('_',' ')}</td>
                    <td className="px-5 py-2.5 text-gray-400 capitalize">{c.status}</td>
                    <td className="px-5 py-2.5 text-right text-gray-300">${Number(c.spend || 0).toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-right text-brand-cyan">${Number(c.revenue_attributed || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showComposer && <ComposerModal onClose={() => setShowComposer(false)} />}
      {showShareListing && <ShareListingModal products={products} onClose={() => setShowShareListing(false)} />}
    </HubPage>
  )
}

function MetricTile({ icon, label, value, tone = 'gray', hint }) {
  const tones = {
    blue: 'text-brand-blue bg-brand-blue/10 border-brand-blue/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    gray: 'text-gray-300 bg-navy-700/40 border-navy-700/50',
  }
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${tones[tone]}`}>{icon}</div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">{label}</div>
        {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
      </div>
    </div>
  )
}

function MiniCheck({ label }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-300">
      <Check className="w-3.5 h-3.5 text-emerald-400" />
      {label}
    </div>
  )
}

// ---------------------------------------------------------------------
// Composer (preview-only for now — post sending ships in Wave D)
// ---------------------------------------------------------------------
function ComposerModal({ onClose }) {
  const [selected, setSelected] = useState(new Set(['instagram','facebook']))
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  function toggle(key) {
    const next = new Set(selected)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelected(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full max-w-2xl bg-navy-900 border-l border-navy-700/50 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700/50 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">New Post</h2>
            <p className="text-xs text-gray-500 mt-0.5">Compose once, publish across every connected platform.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-navy-800 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Platforms */}
          <div>
            <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-2">Post to</label>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map(p => {
                const active = selected.has(p.key)
                return (
                  <button
                    key={p.key}
                    onClick={() => toggle(p.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                      active ? 'bg-brand-blue/10 border-brand-blue/50 text-white' : 'bg-navy-800 border-navy-700/50 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded ${p.color} flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white`}>
                      {p.initials}
                    </div>
                    <span className="text-xs">{p.name}</span>
                    {active && <Check className="w-3.5 h-3.5 text-brand-blue ml-auto" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-2">Image or video</label>
            <div className="flex gap-3">
              <div className="w-32 h-32 bg-navy-800 border border-dashed border-navy-700/60 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-gray-600">
                    <Camera className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-[10px]">Preview</span>
                  </div>
                )}
              </div>
              <input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="Paste image URL or upload in Wave B"
                className="flex-1 bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
              />
            </div>
          </div>

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">Caption</label>
              <button disabled className="text-xs text-gray-500 flex items-center gap-1 cursor-not-allowed">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Generate with AI · Wave C
              </button>
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={5}
              placeholder="Just added to the shop — vintage 90s Levi's denim jacket in great condition. Size M. DM to claim!"
              className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50 resize-y"
            />
            <div className="flex items-center justify-between mt-1.5 text-xs">
              <span className="text-gray-500">{caption.length} chars</span>
              <span className="text-gray-500">Instagram: 2,200 · Twitter: 280</span>
            </div>
          </div>

          {/* Preview */}
          {(selected.size > 0 && (caption || imageUrl)) && (
            <div>
              <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-2">Preview</label>
              <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-blue to-brand-cyan" />
                  <div>
                    <div className="text-sm text-white font-semibold">Your Shop</div>
                    <div className="text-xs text-gray-500">Just now</div>
                  </div>
                </div>
                {imageUrl && (
                  <div className="aspect-square bg-navy-900 rounded-lg overflow-hidden mb-3">
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="text-sm text-gray-300 whitespace-pre-wrap">{caption || 'Your caption will appear here...'}</div>
                <div className="flex items-center gap-4 mt-3 text-gray-500">
                  <Heart className="w-4 h-4" />
                  <MessageCircle className="w-4 h-4" />
                  <Share2 className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-navy-900 border-t border-navy-700/50 px-5 py-3 flex items-center justify-between gap-2">
          <div className="text-xs text-amber-300/80 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Connect platforms to publish — ships Wave D
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Save draft</button>
            <button
              disabled
              className="inline-flex items-center gap-2 bg-navy-700 text-gray-500 px-5 py-2 rounded-lg text-sm font-medium cursor-not-allowed"
            >
              Publish · Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Share-a-Listing modal — branded share card for a specific product
// ---------------------------------------------------------------------
function ShareListingModal({ products, onClose }) {
  const [picked, setPicked] = useState(null)
  const [copied, setCopied] = useState(false)

  function copyLink(p) {
    const url = `${window.location.origin}/vj/product/${p.id}`
    navigator.clipboard.writeText(url)
    setCopied(p.id)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-3xl bg-navy-900 border border-navy-700/50 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-navy-700/50 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">Share a Listing</h2>
            <p className="text-xs text-gray-500 mt-0.5">Pick a product — we'll generate a branded share card.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-navy-800 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {!picked ? (
            products.length === 0 ? (
              <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-12 text-center">
                <ImageIcon className="w-10 h-10 mx-auto text-gray-600 mb-2" />
                <div className="text-sm text-gray-400">No published listings yet.</div>
                <p className="text-xs text-gray-500 mt-1">Publish a listing in Inventory first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPicked(p)}
                    className="group text-left bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden hover:border-brand-blue/50 transition-all"
                  >
                    <div className="aspect-square bg-navy-900 relative overflow-hidden">
                      {p.main_image_url ? (
                        <img src={p.main_image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-600" /></div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-sm text-white truncate">{p.title}</div>
                      <div className="text-sm text-brand-cyan mt-0.5">${Number(p.price).toFixed(2)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div>
              <button onClick={() => setPicked(null)} className="text-xs text-brand-blue hover:text-brand-cyan mb-4">← Pick a different listing</button>
              <div className="bg-gradient-to-br from-brand-blue/20 via-brand-blue/10 to-brand-cyan/10 border border-brand-blue/30 rounded-2xl overflow-hidden">
                <div className="aspect-square bg-navy-900 relative">
                  {picked.main_image_url && <img src={picked.main_image_url} alt={picked.title} className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-transparent to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5">
                    <div className="text-2xl font-bold text-white leading-tight mb-1">{picked.title}</div>
                    <div className="text-3xl font-bold text-brand-cyan">${Number(picked.price).toFixed(2)}</div>
                    <div className="mt-3 text-xs text-white/70 uppercase tracking-wider">VJ Thrift Finds · shop now</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => copyLink(picked)}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
                >
                  {copied === picked.id ? <><Check className="w-4 h-4" />Link copied</> : <><Link2 className="w-4 h-4" />Copy share link</>}
                </button>
                <button
                  disabled
                  className="inline-flex items-center gap-2 bg-navy-700 text-gray-500 px-4 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed"
                >
                  <Share2 className="w-4 h-4" />
                  Post · Wave D
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Download as branded image for Stories + auto-post via connected accounts — Wave C/D.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
