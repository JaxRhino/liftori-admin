import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PLATFORMS = [
  {
    id: 'instagram',
    label: 'Instagram',
    limit: 2200,
    color: 'from-purple-500 to-pink-500',
    textColor: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    limit: 63206,
    color: 'from-blue-600 to-blue-400',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    limit: 2200,
    color: 'from-slate-700 to-slate-500',
    textColor: 'text-slate-300',
    bgColor: 'bg-slate-700/30',
    borderColor: 'border-slate-500/30',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"/>
      </svg>
    ),
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    limit: 3000,
    color: 'from-sky-700 to-sky-500',
    textColor: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    limit: 280,
    color: 'from-gray-700 to-gray-500',
    textColor: 'text-gray-300',
    bgColor: 'bg-gray-700/30',
    borderColor: 'border-gray-500/30',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
]

const CONTENT_TYPES = ['Announcement', 'Product Launch', 'Tip / How-To', 'Behind the Scenes', 'Promotion', 'Event', 'Testimonial', 'Question / Poll', 'Custom']

const MOCK_POSTS = [
  { id: 1, content: '🚀 Big things are coming to Liftori! We\'re helping businesses launch faster than ever. Stay tuned.', platforms: ['instagram', 'linkedin'], scheduledFor: '2026-03-18T10:00', status: 'scheduled', contentType: 'Announcement' },
  { id: 2, content: 'Turn your app idea into reality in days, not months. That\'s the Liftori promise. 💡', platforms: ['x', 'facebook'], scheduledFor: '2026-03-17T14:00', status: 'scheduled', contentType: 'Promotion' },
  { id: 3, content: 'Congrats to VJ Thrift Finds on their new online store! Built and launched on Liftori. 🎉', platforms: ['instagram', 'facebook', 'linkedin'], scheduledFor: '2026-03-16T09:00', status: 'published', contentType: 'Testimonial' },
]

export default function Marketing() {
  const [activeTab, setActiveTab] = useState('composer')
  const [postContent, setPostContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram', 'linkedin'])
  const [contentType, setContentType] = useState('Announcement')
  const [scheduledFor, setScheduledFor] = useState('')
  const [posts, setPosts] = useState(MOCK_POSTS)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Traffic metrics state
  const [trafficLoading, setTrafficLoading] = useState(true)
  const [pageViews, setPageViews] = useState([])
  const [totalViews, setTotalViews] = useState(0)
  const [topPages, setTopPages] = useState([])
  const [recentViews, setRecentViews] = useState([])

  useEffect(() => {
    if (activeTab === 'traffic') {

  const [blogPosts, setBlogPosts] = useState([]);
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogMode, setBlogMode] = useState('list');
  const [blogForm, setBlogForm] = useState({ title:'', slug:'', excerpt:'', content:'', tags:'', status:'draft' });
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogEditId, setBlogEditId] = useState(null);      fetchTrafficData()
    }
  }, [activeTab])

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

      // Aggregate top pages
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

  function togglePlatform(platformId) {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
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
    // In a real implementation, this would write to a social_posts table
    // For now, add to local state as mock
    const newPost = {
      id: Date.now(),
      content: postContent,
      platforms: selectedPlatforms,
      scheduledFor: scheduledFor || new Date(Date.now() + 3600000).toISOString().slice(0, 16),
      status: 'scheduled',
      contentType,
    }
    setPosts(prev => [newPost, ...prev])
    setPostContent('')
    setScheduledFor('')
    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  function formatScheduled(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  function getPlatformObj(id) {
    return PLATFORMS.find(p => p.id === id)
  }

  const limit = getCharLimit()
  const remaining = limit - postContent.length

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
        <p className="text-slate-400 text-sm mt-1">Social content builder and web traffic analytics</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-lg p-1 w-fit">
        {[
          { id: 'composer', label: 'Content Composer' },
          { id: 'queue', label: 'Post Queue' },
          { id: 'traffic', label: 'Web Traffic' },
        
        { id: 'blog', label: 'Blog' },].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── COMPOSER TAB ─── */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — Composer */}
          <div className="lg:col-span-2 space-y-4">
            {/* Content Type */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-medium text-slate-300 mb-2">Content Type</label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setContentType(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      contentType === type
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Compose Area */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-medium text-slate-300 mb-2">Post Content</label>
              <textarea
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                placeholder={`Write your ${contentType.toLowerCase()} post here...\n\nTip: Use emojis to increase engagement 🚀`}
                rows={8}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-slate-500">
                  {selectedPlatforms.length > 0
                    ? `Shortest limit: ${getPlatformObj(selectedPlatforms.reduce((a, b) =>
                        (getPlatformObj(a)?.limit || 9999) < (getPlatformObj(b)?.limit || 9999) ? a : b
                      ))?.label} (${limit.toLocaleString()} chars)`
                    : 'Select platforms to see limits'}
                </span>
                <span className={`text-xs font-mono ${getCharColor()}`}>
                  {remaining < 0 ? `${Math.abs(remaining)} over limit` : `${remaining.toLocaleString()} remaining`}
                </span>
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-medium text-slate-300 mb-2">Schedule (optional)</label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={e => setScheduledFor(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
              />
              <p className="text-xs text-slate-500 mt-1">Leave blank to post now (manual publish)</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSchedulePost}
                disabled={!postContent.trim() || selectedPlatforms.length === 0 || remaining < 0 || saving}
                className="flex-1 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
              >
                {saving ? 'Adding to Queue...' : scheduledFor ? 'Schedule Post' : 'Add to Queue'}
              </button>
              <button
                onClick={() => { setPostContent(''); setScheduledFor(''); setContentType('Announcement') }}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
              >
                Clear
              </button>
            </div>

            {saveSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">
                ✓ Post added to queue successfully
              </div>
            )}
          </div>

          {/* Right — Platform Selection + Preview */}
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <label className="block text-sm font-medium text-slate-300 mb-3">Publish To</label>
              <div className="space-y-2">
                {PLATFORMS.map(platform => (
                  <button
                    key={platform.id}
                    onClick={() => togglePlatform(platform.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      selectedPlatforms.includes(platform.id)
                        ? `${platform.bgColor} ${platform.borderColor} ${platform.textColor}`
                        : 'bg-slate-900/30 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className={`${selectedPlatforms.includes(platform.id) ? platform.textColor : 'text-slate-500'}`}>
                      {platform.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{platform.label}</div>
                      <div className="text-xs opacity-60">{platform.limit.toLocaleString()} char limit</div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedPlatforms.includes(platform.id)
                        ? 'border-current bg-current'
                        : 'border-slate-600'
                    }`}>
                      {selectedPlatforms.includes(platform.id) && (
                        <svg className="w-2 h-2 text-white" viewBox="0 0 8 8" fill="currentColor">
                          <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview card */}
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

      {/* ─── POST QUEUE TAB ─── */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3">📬</div>
              <div className="font-medium">No posts in queue</div>
              <div className="text-sm mt-1">Compose a post to get started</div>
            </div>
          ) : (
            posts.map(post => {
              const postPlatforms = post.platforms.map(id => getPlatformObj(id)).filter(Boolean)
              return (
                <div key={post.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {postPlatforms.map(p => (
                          <span key={p.id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${p.bgColor} ${p.textColor} border ${p.borderColor}`}>
                            {p.icon}
                            {p.label}
                          </span>
                        ))}
                        <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
                          {post.contentType}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed line-clamp-3">{post.content}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        post.status === 'published'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                          : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                      }`}>
                        {post.status === 'published' ? '✓ Published' : '⏰ Scheduled'}
                      </span>
                      <span className="text-xs text-slate-500">{formatScheduled(post.scheduledFor)}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ─── TRAFFIC TAB ─── */}
      {activeTab === 'traffic' && (
        <div className="space-y-6">
          {trafficLoading ? (
            <div className="text-slate-400 text-sm">Loading traffic data...</div>
          ) : (
            <>
              {/* Stat Cards */}
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

              {/* Top Pages Table */}
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

  // ── BLOG MANAGEMENT ──
  const fetchBlogPosts = async () => {
    setBlogLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id,title,slug,excerpt,author,author_role,tags,status,published_at,content')
        .order('created_at', { ascending: false });
      if (!error) setBlogPosts(data || []);
    } catch(e) { console.error('fetchBlogPosts:', e); }
    setBlogLoading(false);
  };

  const saveBlogPost = async () => {
    if (!blogForm.title || !blogForm.slug) return;
    setBlogSaving(true);
    const tags = blogForm.tags.split(',').map(t => t.trim()).filter(Boolean);
    const payload = {
      title: blogForm.title, slug: blogForm.slug,
      excerpt: blogForm.excerpt, content: blogForm.content, tags,
      status: blogForm.status,
      published_at: blogForm.status === 'published' ? new Date().toISOString() : null,
    };
    try {
      if (blogMode === 'create') {
        await supabase.from('blog_posts').insert([payload]);
      } else {
        await supabase.from('blog_posts').update(payload).eq('id', blogEditId);
      }
      await fetchBlogPosts();
      setBlogMode('list');
    } catch(e) { console.error('saveBlogPost:', e); }
    setBlogSaving(false);
  };

  const deleteBlogPost = async (id) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    await supabase.from('blog_posts').delete().eq('id', id);
    await fetchBlogPosts();
  };

  const toggleBlogStatus = async (post) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    await supabase.from('blog_posts').update({
      status: newStatus,
      published_at: newStatus === 'published' ? new Date().toISOString() : null,
    }).eq('id', post.id);
    await fetchBlogPosts();
  };

  React.useEffect(() => { if (activeTab === 'blog') fetchBlogPosts(); }, [activeTab]);
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
      {activeTab === 'blog' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Blog Posts</h2>
              <p className="text-slate-400 text-sm mt-1">Manage posts published to liftori.ai/blog</p>
            </div>
            <button
              onClick={() => { setBlogMode('create'); setBlogForm({ title:'', slug:'', excerpt:'', content:'', tags:'', status:'draft' }); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >+ New Post</button>
          </div>

          {blogMode !== 'list' && (
            <div className="bg-[#0D1424] border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="text-white font-semibold">{blogMode === 'create' ? 'New Post' : 'Edit Post'}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Title</label>
                  <input value={blogForm.title} onChange={e => { const v = e.target.value; setBlogForm(f => ({ ...f, title: v, slug: blogMode === 'create' ? v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') : f.slug })); }} placeholder="Post title" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Slug</label>
                  <input value={blogForm.slug} onChange={e => setBlogForm(f => ({ ...f, slug: e.target.value }))} placeholder="post-url-slug" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Excerpt</label>
                <input value={blogForm.excerpt} onChange={e => setBlogForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Short description for post cards" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Content (HTML)</label>
                <textarea value={blogForm.content} onChange={e => setBlogForm(f => ({ ...f, content: e.target.value }))} rows={10} placeholder="<p>Write your post content here...</p>" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Tags (comma-separated)</label>
                  <input value={blogForm.tags} onChange={e => setBlogForm(f => ({ ...f, tags: e.target.value }))} placeholder="mission, product, update" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Status</label>
                  <select value={blogForm.status} onChange={e => setBlogForm(f => ({ ...f, status: e.target.value }))} className="w-full bg-[#0D1424] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveBlogPost} disabled={blogSaving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
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
                <div className="text-center py-12 text-slate-400">No posts yet — click <strong className="text-white">+ New Post</strong> to get started.</div>
              ) : blogPosts.map(post => (
                <div key={post.id} className="bg-[#0D1424] border border-white/10 rounded-xl p-5 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${post.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>{post.status}</span>
                      <span className="text-slate-500 text-xs font-mono">{post.published_at ? new Date(post.published_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Draft'}</span>
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
                    <button onClick={() => toggleBlogStatus(post)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${post.status === 'published' ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}>
                      {post.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <button onClick={() => { setBlogMode('edit'); setBlogEditId(post.id); setBlogForm({ title:post.title, slug:post.slug, excerpt:post.excerpt||'', content:post.content||'', tags:(post.tags||[]).join(', '), status:post.status }); }} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white transition-colors">Edit</button>
                    <button onClick={() => deleteBlogPost(post.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
              </div>

              {/* Recent Activity */}
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
                          <span className="text-xs text-slate-500 truncate max-w-[140px] hidden md:block">
                            from {view.referrer}
                          </span>
                        )}
                        <span className="text-xs text-slate-500 shrink-0">
                          {new Date(view.created_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric',
                            hour: 'numeric', minute: '2-digit'
                          })}
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
    </div>
  )
}
