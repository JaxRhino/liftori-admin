import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', limit: 2200, color: 'from-purple-500 to-pink-500', textColor: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/30', icon: ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg> ) },
  { id: 'facebook', label: 'Facebook', limit: 63206, color: 'from-blue-600 to-blue-400', textColor: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', icon: ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> ) },
  { id: 'tiktok', label: 'TikTok', limit: 2200, color: 'from-slate-700 to-slate-500', textColor: 'text-slate-300', bgColor: 'bg-slate-700/30', borderColor: 'border-slate-500/30', icon: ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"/></svg> ) },
  { id: 'linkedin', label: 'LinkedIn', limit: 3000, color: 'from-sky-700 to-sky-500', textColor: 'text-sky-400', bgColor: 'bg-sky-500/10', borderColor: 'border-sky-500/30', icon: ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> ) },
  { id: 'x', label: 'X (Twitter)', limit: 280, color: 'from-gray-700 to-gray-500', textColor: 'text-gray-300', bgColor: 'bg-gray-700/30', borderColor: 'border-gray-500/30', icon: ( <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> ) },
]

const CONTENT_TYPES = ['Announcement', 'Product Launch', 'Tip / How-To', 'Behind the Scenes', 'Promotion', 'Event', 'Testimonial', 'Question / Poll', 'Custom']

// Wave A: Facebook is the only platform actually wired to publish. Others are
// kept selectable so the queue/UI is forward-compatible — they'll just stay in
// pending_approval until their respective edge functions ship.
const PUBLISHABLE_PLATFORMS = ['facebook']

export default function Marketing() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('composer')
  const [postContent, setPostContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState(['facebook'])
  const [contentType, setContentType] = useState('Announcement')
  const [scheduledFor, setScheduledFor] = useState('')

  // Queue state
  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [actionError, setActionError] = useState('')

  // Traffic metrics state
  const [trafficLoading, setTrafficLoading] = useState(true)
  const [pageViews, setPageViews] = useState([])
  const [totalViews, setTotalViews] = useState(0)
  const [topPages, setTopPages] = useState([])
  const [recentViews, setRecentViews] = useState([])

  // Blog management state
  const [blogPosts, setBlogPosts] = useState([])
  const [blogLoading, setBlogLoading] = useState(false)
  const [blogMode, setBlogMode] = useState('list')
  const [blogForm, setBlogForm] = useState({ title: '', slug: '', excerpt: '', content: '', tags: '', status: 'draft' })
  const [blogSaving, setBlogSaving] = useState(false)
  const [blogEditId, setBlogEditId] = useState(null)

  const fetchPosts = useCallback(async () => {
    setPostsLoading(true)
    try {
      const { data, error } = await supabase
        .from('marketing_posts')
        .select('id, content, content_type, platforms, status, scheduled_for, published_at, platform_post_ids, error_message, created_at, ai_generated, source_type')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setPosts(data || [])
    } catch (err) {
      console.error('fetchPosts:', err)
    } finally {
      setPostsLoading(false)
    }
  }, [])

  // Initial load + refresh queue when user opens the queue tab
  useEffect(() => { fetchPosts() }, [fetchPosts])
  useEffect(() => { if (activeTab === 'queue') fetchPosts() }, [activeTab, fetchPosts])
  useEffect(() => { if (activeTab === 'traffic') fetchTrafficData() }, [activeTab])
  useEffect(() => { if (activeTab === 'blog') fetchBlogPosts() }, [activeTab])

  async function fetchTrafficData() {
    setTrafficLoading(true)
    try {
      const { data, error } = await supabase
        .from('page_views')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      const views = data || []
      setPageViews(views)
      setTotalViews(views.length)
      const pageCounts = {}
      views.forEach(v => {
        const page = v.page || '/'
        pageCounts[page] = (pageCounts[page] || 0) + 1
      })
      const sorted = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([page, count]) => ({ page, count }))
      setTopPages(sorted)
      setRecentViews(views.slice(0, 20))
    } catch (err) {
      console.error('Error fetching page views:', err)
    } finally {
      setTrafficLoading(false)
    }
  }

  async function fetchBlogPosts() {
    setBlogLoading(true)
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id,title,slug,excerpt,author,author_role,tags,status,published_at,content')
        .order('created_at', { ascending: false })
      if (error) throw error
      setBlogPosts(data || [])
    } catch (e) {
      console.error('fetchBlogPosts:', e)
    } finally {
      setBlogLoading(false)
    }
  }

  async function saveBlogPost() {
    if (!blogForm.title || !blogForm.slug) return
    setBlogSaving(true)
    const tags = blogForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    const payload = {
      title: blogForm.title,
      slug: blogForm.slug,
      excerpt: blogForm.excerpt,
      content: blogForm.content,
      tags,
      status: blogForm.status,
      published_at: blogForm.status === 'published' ? new Date().toISOString() : null,
    }
    try {
      if (blogMode === 'create') {
        await supabase.from('blog_posts').insert([payload])
      } else {
        await supabase.from('blog_posts').update(payload).eq('id', blogEditId)
      }
      await fetchBlogPosts()
      setBlogMode('list')
    } catch (e) {
      console.error('saveBlogPost:', e)
    } finally {
      setBlogSaving(false)
    }
  }

  async function deleteBlogPost(id) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    await supabase.from('blog_posts').delete().eq('id', id)
    await fetchBlogPosts()
  }

  async function toggleBlogStatus(post) {
    const newStatus = post.status === 'published' ? 'draft' : 'published'
    await supabase.from('blog_posts').update({
      status: newStatus,
      published_at: newStatus === 'published' ? new Date().toISOString() : null,
    }).eq('id', post.id)
    await fetchBlogPosts()
  }

  function togglePlatform(platformId) {
    setSelectedPlatforms(prev =>
      prev.includes(platformId) ? prev.filter(p => p !== platformId) : [...prev, platformId]
    )
  }

  function getCharLimit() {
    const selected = PLATFORMS.filter(p => selectedPlatforms.includes(p.id))
    if (selected.length === 0) return 2200
    return Math.min(...selected.map(p => p.limit))
  }

  function getCharColor() {
    const limit = getCharLimit()
    const remaining = limit - postContent.length
    if (remaining < 0) return 'text-red-400'
    if (remaining < limit * 0.1) return 'text-yellow-400'
    return 'text-slate-400'
  }

  async function handleSchedulePost() {
    if (!postContent.trim() || selectedPlatforms.length === 0) return
    setSaving(true)
    setSaveSuccess('')
    try {
      const payload = {
        content: postContent.trim(),
        content_type: contentType,
        platforms: selectedPlatforms,
        status: 'pending_approval',
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        created_by: user?.id ?? null,
        ai_generated: false,
        source_type: 'manual',
      }
      const { error } = await supabase.from('marketing_posts').insert([payload])
      if (error) throw error
      setPostContent('')
      setScheduledFor('')
      setSaveSuccess('Added to queue — pending your approval before it publishes.')
      await fetchPosts()
      setTimeout(() => setSaveSuccess(''), 4000)
    } catch (err) {
      console.error('handleSchedulePost:', err)
      setSaveSuccess(`Error: ${err.message || 'failed to save'}`)
    } finally {
      setSaving(false)
    }
  }

  async function approveAndPublish(post) {
    if (!post?.id) return
    setActioningId(post.id)
    setActionError('')
    try {
      // Pull fresh access_token to ensure Authorization header is attached
      // (avoids the functions.invoke JWT drop pitfall on stale sessions)
      const { data: sessionRes } = await supabase.auth.getSession()
      const accessToken = sessionRes?.session?.access_token
      if (!accessToken) throw new Error('Not signed in')

      const fnUrl = `${supabase.supabaseUrl}/functions/v1/publish-to-facebook`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ post_id: post.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `Publish failed (${res.status})`)
      }
      await fetchPosts()
    } catch (err) {
      console.error('approveAndPublish:', err)
      setActionError(`${post.id.slice(0, 8)}: ${err.message}`)
    } finally {
      setActioningId(null)
    }
  }

  async function rejectPost(post) {
    if (!post?.id) return
    const reason = window.prompt('Reason for rejecting (optional):', '') ?? ''
    setActioningId(post.id)
    try {
      await supabase.from('marketing_posts').update({
        status: 'rejected',
        rejected_reason: reason || null,
      }).eq('id', post.id)
      await fetchPosts()
    } finally {
      setActioningId(null)
    }
  }

  async function deletePost(post) {
    if (!post?.id) return
    if (!window.confirm('Delete this post permanently?')) return
    setActioningId(post.id)
    try {
      await supabase.from('marketing_posts').delete().eq('id', post.id)
      await fetchPosts()
    } finally {
      setActioningId(null)
    }
  }

  async function retryPost(post) {
    // Reset to pending so the operator can re-approve
    setActioningId(post.id)
    try {
      await supabase.from('marketing_posts').update({
        status: 'pending_approval',
        error_message: null,
      }).eq('id', post.id)
      await fetchPosts()
    } finally {
      setActioningId(null)
    }
  }

  function formatScheduled(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  function getPlatformObj(id) {
    return PLATFORMS.find(p => p.id === id)
  }

  function fbPostUrl(platformIds) {
    const fbId = platformIds?.facebook
    if (!fbId) return null
    const parts = String(fbId).split('_')
    if (parts.length !== 2) return `https://www.facebook.com/${fbId}`
    return `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`
  }

  const limit = getCharLimit()
  const remaining = limit - postContent.length

  // Queue groupings
  const pendingPosts = posts.filter(p => p.status === 'pending_approval')
  const scheduledPosts = posts.filter(p => p.status === 'scheduled' || p.status === 'approved')
  const publishedPosts = posts.filter(p => p.status === 'published')
  const failedPosts = posts.filter(p => p.status === 'failed')
  const rejectedPosts = posts.filter(p => p.status === 'rejected')

  // Traffic helpers
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayViews = pageViews.filter(v => new Date(v.created_at) >= today).length
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayViews = pageViews.filter(v => {
    const d = new Date(v.created_at)
    return d >= yesterday && d < today
  }).length

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Marketing</h1>
        <p className="text-slate-400 text-sm mt-1">Compose social posts, approve before publish, track web traffic and blog content</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-lg p-1 w-fit">
        {[
          { id: 'composer', label: 'Content Composer' },
          { id: 'queue', label: `Post Queue${pendingPosts.length ? ` (${pendingPosts.length})` : ''}` },
          { id: 'traffic', label: 'Web Traffic' },
          { id: 'blog', label: 'Blog' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* COMPOSER TAB */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-medium text-slate-300 mb-2">Content Type</label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map(type => (
                  <button key={type} onClick={() => setContentType(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      contentType === type ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}>{type}</button>
                ))}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-medium text-slate-300 mb-2">Post Content</label>
              <textarea value={postContent} onChange={e => setPostContent(e.target.value)}
                placeholder={`Write your ${contentType.toLowerCase()} post here...\n\nTip: Use emojis to increase engagement 🚀`}
                rows={8}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none" />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-slate-500">
                  {selectedPlatforms.length > 0
                    ? `Shortest limit: ${getPlatformObj(selectedPlatforms.reduce((a, b) => (getPlatformObj(a)?.limit || 9999) < (getPlatformObj(b)?.limit || 9999) ? a : b))?.label} (${limit.toLocaleString()} chars)`
                    : 'Select platforms to see limits'}
                </span>
                <span className={`text-xs font-mono ${getCharColor()}`}>
                  {remaining < 0 ? `${Math.abs(remaining)} over limit` : `${remaining.toLocaleString()} remaining`}
                </span>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-medium text-slate-300 mb-2">Schedule (optional)</label>
              <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-sky-500" />
              <p className="text-xs text-slate-500 mt-1">Leave blank to publish immediately on approval. (Cron-based scheduling lands in Wave C.)</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSchedulePost}
                disabled={!postContent.trim() || selectedPlatforms.length === 0 || remaining < 0 || saving}
                className="flex-1 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm">
                {saving ? 'Adding to Queue...' : 'Add to Queue'}
              </button>
              <button onClick={() => { setPostContent(''); setScheduledFor(''); setContentType('Announcement') }}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">Clear</button>
            </div>
            {saveSuccess && (
              <div className={`rounded-lg p-3 text-sm border ${
                saveSuccess.startsWith('Error')
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-green-500/10 border-green-500/30 text-green-400'
              }`}>
                {saveSuccess.startsWith('Error') ? '✗ ' : '✓ '}{saveSuccess}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-medium text-slate-300 mb-3">Publish To</label>
              <div className="space-y-2">
                {PLATFORMS.map(platform => {
                  const isPublishable = PUBLISHABLE_PLATFORMS.includes(platform.id)
                  const isSelected = selectedPlatforms.includes(platform.id)
                  return (
                    <button key={platform.id} onClick={() => togglePlatform(platform.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        isSelected
                          ? `${platform.bgColor} ${platform.borderColor} ${platform.textColor}`
                          : 'bg-slate-900/30 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      <div className={isSelected ? platform.textColor : 'text-slate-500'}>{platform.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium flex items-center gap-2">
                          {platform.label}
                          {!isPublishable && (
                            <span className="text-[10px] uppercase tracking-wide bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">soon</span>
                          )}
                        </div>
                        <div className="text-xs opacity-60">{platform.limit.toLocaleString()} char limit</div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-current bg-current' : 'border-slate-600'
                      }`}>
                        {isSelected && (
                          <svg className="w-2 h-2 text-white" viewBox="0 0 8 8" fill="currentColor">
                            <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-3 leading-snug">
                Wave A wires <span className="text-blue-400">Facebook</span> live. Other platforms queue but won't publish yet.
              </p>
            </div>
            {postContent && (
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="text-sm font-medium text-slate-300 mb-2">Preview</div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">L</div>
                    <div>
                      <div className="text-xs font-medium text-white">Liftori</div>
                      <div className="text-xs text-slate-500">@liftori.ai</div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">{postContent}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POST QUEUE TAB */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {actionError && (
            <div className="rounded-lg p-3 text-sm border bg-red-500/10 border-red-500/30 text-red-400">
              ✗ {actionError}
            </div>
          )}

          {postsLoading ? (
            <div className="text-slate-400 text-sm">Loading queue…</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3">📬</div>
              <div className="font-medium">No posts in queue</div>
              <div className="text-sm mt-1">Compose a post to get started</div>
            </div>
          ) : (
            <>
              <QueueSection
                title="Pending Approval"
                count={pendingPosts.length}
                tone="amber"
                emptyText="No posts waiting for approval"
                posts={pendingPosts}
                actioningId={actioningId}
                getPlatformObj={getPlatformObj}
                formatScheduled={formatScheduled}
                fbPostUrl={fbPostUrl}
                actions={(post) => (
                  <>
                    <button
                      onClick={() => approveAndPublish(post)}
                      disabled={actioningId === post.id || !post.platforms?.includes('facebook')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium transition-colors">
                      {actioningId === post.id ? 'Publishing…' : 'Approve & Publish'}
                    </button>
                    <button
                      onClick={() => rejectPost(post)}
                      disabled={actioningId === post.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors">
                      Reject
                    </button>
                    <button
                      onClick={() => deletePost(post)}
                      disabled={actioningId === post.id}
                      className="text-xs px-2 py-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                      Delete
                    </button>
                  </>
                )}
              />

              <QueueSection
                title="Scheduled / Approved"
                count={scheduledPosts.length}
                tone="sky"
                emptyText="Nothing scheduled. (Wave C will add cron-driven auto-publish.)"
                posts={scheduledPosts}
                actioningId={actioningId}
                getPlatformObj={getPlatformObj}
                formatScheduled={formatScheduled}
                fbPostUrl={fbPostUrl}
                actions={(post) => (
                  <button
                    onClick={() => deletePost(post)}
                    disabled={actioningId === post.id}
                    className="text-xs px-2 py-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                    Cancel
                  </button>
                )}
              />

              <QueueSection
                title="Published"
                count={publishedPosts.length}
                tone="emerald"
                emptyText="No posts published yet"
                posts={publishedPosts}
                actioningId={actioningId}
                getPlatformObj={getPlatformObj}
                formatScheduled={formatScheduled}
                fbPostUrl={fbPostUrl}
                showPublishedAt
                actions={(post) => {
                  const url = fbPostUrl(post.platform_post_ids)
                  return url ? (
                    <a href={url} target="_blank" rel="noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors">
                      View on Facebook ↗
                    </a>
                  ) : null
                }}
              />

              <QueueSection
                title="Failed"
                count={failedPosts.length}
                tone="rose"
                emptyText="No failed posts"
                posts={failedPosts}
                actioningId={actioningId}
                getPlatformObj={getPlatformObj}
                formatScheduled={formatScheduled}
                fbPostUrl={fbPostUrl}
                showError
                actions={(post) => (
                  <>
                    <button
                      onClick={() => retryPost(post)}
                      disabled={actioningId === post.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-white font-medium transition-colors">
                      Send back to Pending
                    </button>
                    <button
                      onClick={() => deletePost(post)}
                      disabled={actioningId === post.id}
                      className="text-xs px-2 py-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                      Delete
                    </button>
                  </>
                )}
              />

              {rejectedPosts.length > 0 && (
                <QueueSection
                  title="Rejected"
                  count={rejectedPosts.length}
                  tone="slate"
                  emptyText=""
                  posts={rejectedPosts}
                  actioningId={actioningId}
                  getPlatformObj={getPlatformObj}
                  formatScheduled={formatScheduled}
                  fbPostUrl={fbPostUrl}
                  actions={(post) => (
                    <button
                      onClick={() => deletePost(post)}
                      disabled={actioningId === post.id}
                      className="text-xs px-2 py-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                      Delete
                    </button>
                  )}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* TRAFFIC TAB */}
      {activeTab === 'traffic' && (
        <div className="space-y-6">
          {trafficLoading ? (
            <div className="text-slate-400 text-sm">Loading traffic data...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Page Views', value: totalViews.toLocaleString(), sub: 'All time (last 500)' },
                  { label: 'Views Today', value: todayViews.toLocaleString(), sub: `${yesterdayViews} yesterday` },
                  { label: 'Unique Pages', value: topPages.length.toString(), sub: 'Distinct routes tracked' },
                  { label: 'Most Visited', value: topPages[0]?.page || '—', sub: topPages[0] ? `${topPages[0].count} views` : 'No data', mono: true },
                ].map((card, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <div className="text-xs text-slate-400 mb-1">{card.label}</div>
                    <div className={`text-xl font-bold text-white truncate ${card.mono ? 'font-mono text-sm' : ''}`}>{card.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{card.sub}</div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="p-4 border-b border-slate-700/50">
                  <h3 className="font-semibold text-white">Top Pages</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Most visited routes across liftori.ai</p>
                </div>
                {topPages.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">No page view data available</div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {topPages.map((row, i) => {
                      const pct = totalViews > 0 ? Math.round((row.count / totalViews) * 100) : 0
                      return (
                        <div key={i} className="px-4 py-3 flex items-center gap-4">
                          <span className="text-xs text-slate-500 w-5 text-right">{i + 1}</span>
                          <span className="font-mono text-sm text-sky-400 flex-1 truncate">{row.page}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-slate-700 rounded-full h-1.5">
                              <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-sm text-white font-medium w-12 text-right">{row.count.toLocaleString()}</span>
                            <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="p-4 border-b border-slate-700/50">
                  <h3 className="font-semibold text-white">Recent Visits</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Last 20 page view events</p>
                </div>
                {recentViews.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">No recent visits</div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {recentViews.map((view, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-4">
                        <span className="font-mono text-sm text-sky-400 truncate flex-1">{view.page || '/'}</span>
                        {view.referrer && (
                          <span className="text-xs text-slate-500 truncate max-w-[140px] hidden md:block">from {view.referrer}</span>
                        )}
                        <span className="text-xs text-slate-500 shrink-0">
                          {new Date(view.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* BLOG TAB */}
      {activeTab === 'blog' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Blog Posts</h2>
              <p className="text-slate-400 text-sm mt-1">Manage posts published to liftori.ai/blog</p>
            </div>
            <button
              onClick={() => { setBlogMode('create'); setBlogForm({ title: '', slug: '', excerpt: '', content: '', tags: '', status: 'draft' }) }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >+ New Post</button>
          </div>

          {blogMode !== 'list' && (
            <div className="bg-[#0D1424] border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="text-white font-semibold">{blogMode === 'create' ? 'New Post' : 'Edit Post'}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Title</label>
                  <input value={blogForm.title}
                    onChange={e => { const v = e.target.value; setBlogForm(f => ({ ...f, title: v, slug: blogMode === 'create' ? v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : f.slug })) }}
                    placeholder="Post title"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Slug</label>
                  <input value={blogForm.slug}
                    onChange={e => setBlogForm(f => ({ ...f, slug: e.target.value }))}
                    placeholder="post-url-slug"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Excerpt</label>
                <input value={blogForm.excerpt}
                  onChange={e => setBlogForm(f => ({ ...f, excerpt: e.target.value }))}
                  placeholder="Short description for post cards"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Content (HTML)</label>
                <textarea value={blogForm.content}
                  onChange={e => setBlogForm(f => ({ ...f, content: e.target.value }))}
                  rows={10} placeholder="<p>Write your post content here...</p>"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Tags (comma-separated)</label>
                  <input value={blogForm.tags}
                    onChange={e => setBlogForm(f => ({ ...f, tags: e.target.value }))}
                    placeholder="mission, product, update"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Status</label>
                  <select value={blogForm.status}
                    onChange={e => setBlogForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-[#0D1424] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveBlogPost} disabled={blogSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
                  {blogSaving ? 'Saving...' : blogMode === 'create' ? 'Create Post' : 'Save Changes'}
                </button>
                <button onClick={() => setBlogMode('list')} className="text-slate-400 hover:text-white px-4 py-2 text-sm transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {blogMode === 'list' && (
            <div className="space-y-3">
              {blogLoading ? (
                <div className="text-center py-12 text-slate-400">Loading posts...</div>
              ) : blogPosts.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No posts yet — click <strong className="text-white">+ New Post</strong> to get started.
                </div>
              ) : (
                blogPosts.map(post => (
                  <div key={post.id} className="bg-[#0D1424] border border-white/10 rounded-xl p-5 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${post.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                          {post.status}
                        </span>
                        <span className="text-slate-500 text-xs font-mono">
                          {post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Draft'}
                        </span>
                      </div>
                      <div className="text-white font-semibold truncate">{post.title}</div>
                      <div className="text-slate-400 text-sm mt-0.5 truncate">{post.excerpt}</div>
                      {post.tags?.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {post.tags.map(t => <span key={t} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">{t}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mt-1">
                      <button onClick={() => toggleBlogStatus(post)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${post.status === 'published' ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}>
                        {post.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button onClick={() => { setBlogMode('edit'); setBlogEditId(post.id); setBlogForm({ title: post.title, slug: post.slug, excerpt: post.excerpt || '', content: post.content || '', tags: (post.tags || []).join(', '), status: post.status }) }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white transition-colors">Edit</button>
                      <button onClick={() => deleteBlogPost(post.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function QueueSection({ title, count, tone, emptyText, posts, actioningId, getPlatformObj, formatScheduled, fbPostUrl, showPublishedAt, showError, actions }) {
  const toneMap = {
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    slate: 'text-slate-400 bg-slate-700/30 border-slate-600/30',
  }
  return (
    <section>
      <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
        {title}
        <span className={`text-xs px-2 py-0.5 rounded-full border ${toneMap[tone] || toneMap.slate}`}>{count}</span>
      </h3>
      {posts.length === 0 ? (
        emptyText ? <p className="text-xs text-slate-500 mb-4">{emptyText}</p> : null
      ) : (
        <div className="space-y-3 mb-4">
          {posts.map(post => {
            const postPlatforms = (post.platforms || []).map(id => getPlatformObj(id)).filter(Boolean)
            return (
              <div key={post.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {postPlatforms.map(p => (
                        <span key={p.id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${p.bgColor} ${p.textColor} border ${p.borderColor}`}>
                          {p.icon} {p.label}
                        </span>
                      ))}
                      <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">{post.content_type}</span>
                      {post.ai_generated && (
                        <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full">AI</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words line-clamp-4">{post.content}</p>
                    {showError && post.error_message && (
                      <div className="mt-2 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg px-2 py-1.5 font-mono">
                        {post.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs text-slate-500">
                      {showPublishedAt && post.published_at
                        ? `Published ${formatScheduled(post.published_at)}`
                        : post.scheduled_for
                          ? `Scheduled ${formatScheduled(post.scheduled_for)}`
                          : `Created ${formatScheduled(post.created_at)}`}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {actions ? actions(post) : null}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
