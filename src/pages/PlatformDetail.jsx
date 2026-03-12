import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_OPTIONS = ['Live', 'In Build', 'On Hold', 'Completed', 'Cancelled']
const TYPE_OPTIONS = ['Web App', 'Mobile App', 'Business Platform', 'E-Commerce']

const STATUS_COLORS = {
  'Live': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'In Build': 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  'On Hold': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Completed': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Cancelled': 'bg-red-500/10 text-red-400 border-red-500/20'
}

export default function PlatformDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [platform, setPlatform] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newFeature, setNewFeature] = useState('')

  useEffect(() => { fetchPlatform() }, [id])

  async function fetchPlatform() {
    setLoading(true)
    const { data, error } = await supabase
      .from('platforms')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) {
      navigate('/admin/platforms')
      return
    }
    setPlatform(data)
    setForm(data)
    setLoading(false)
  }

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('platforms')
      .update({
        client_name: form.client_name,
        owner_name: form.owner_name,
        owner_email: form.owner_email,
        site_url: form.site_url,
        admin_url: form.admin_url,
        domain: form.domain,
        platform_type: form.platform_type,
        status: form.status,
        notes: form.notes,
        features: form.features,
        tech_stack: form.tech_stack,
        pages_count: form.pages_count,
        monthly_revenue: form.monthly_revenue,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    if (!error) {
      setPlatform({ ...platform, ...form })
      setEditing(false)
    }
    setSaving(false)
  }

  async function handleDelete() {
    const { error } = await supabase.from('platforms').delete().eq('id', id)
    if (!error) navigate('/admin/platforms')
  }

  function addFeature() {
    if (!newFeature.trim()) return
    update('features', [...(form.features || []), newFeature.trim()])
    setNewFeature('')
  }

  function removeFeature(index) {
    update('features', (form.features || []).filter((_, i) => i !== index))
  }

  function updateTechStack(key, value) {
    update('tech_stack', { ...(form.tech_stack || {}), [key]: value })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!platform) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Platform not found</h2>
          <Link to="/admin/platforms" className="text-brand-blue hover:underline">Back to Platforms</Link>
        </div>
      </div>
    )
  }

  const techStack = platform.tech_stack || {}
  const inputCls = "w-full bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"

  return (
    <div className="min-h-screen bg-navy-900 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link to="/admin/platforms" className="text-gray-500 hover:text-brand-blue transition-colors">Platforms</Link>
        <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-white">{platform.client_name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white">{platform.client_name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_COLORS[platform.status] || 'text-gray-400 border-gray-600'}`}>
              {platform.status}
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            {platform.owner_name && <span>{platform.owner_name}</span>}
            {platform.owner_email && <span className="text-gray-600"> — {platform.owner_email}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => { setForm(platform); setEditing(false) }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Edit
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors">
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Platform Details</h2>
            {editing ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Client Name</label>
                  <input className={inputCls} value={form.client_name || ''} onChange={e => update('client_name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Owner Name</label>
                  <input className={inputCls} value={form.owner_name || ''} onChange={e => update('owner_name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Owner Email</label>
                  <input className={inputCls} type="email" value={form.owner_email || ''} onChange={e => update('owner_email', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Platform Type</label>
                  <select className={inputCls} value={form.platform_type || 'Web App'} onChange={e => update('platform_type', e.target.value)}>
                    {TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select className={inputCls} value={form.status || 'In Build'} onChange={e => update('status', e.target.value)}>
                    {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Monthly Revenue (cents)</label>
                  <input className={inputCls} type="number" value={form.monthly_revenue || 0} onChange={e => update('monthly_revenue', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Type', platform.platform_type],
                  ['Owner', platform.owner_name || '—'],
                  ['Email', platform.owner_email || '—'],
                  ['Revenue', platform.monthly_revenue ? `$${(platform.monthly_revenue / 100).toLocaleString()}/mo` : '—'],
                  ['Pages', platform.pages_count || '—'],
                  ['Status', platform.status]
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
                    <p className="text-sm text-white mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Links Card */}
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Links & URLs</h2>
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Domain</label>
                  <input className={inputCls} value={form.domain || ''} onChange={e => update('domain', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Site URL</label>
                  <input className={inputCls} value={form.site_url || ''} onChange={e => update('site_url', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Admin URL</label>
                  <input className={inputCls} value={form.admin_url || ''} onChange={e => update('admin_url', e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  ['Domain', platform.domain],
                  ['Site URL', platform.site_url],
                  ['Admin URL', platform.admin_url]
                ].map(([label, url]) => url ? (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-navy-700/30 last:border-0">
                    <span className="text-sm text-gray-400">{label}</span>
                    {label === 'Domain' ? (
                      <span className="text-sm text-white font-mono">{url}</span>
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-brand-blue hover:text-brand-light transition-colors flex items-center gap-1 max-w-[280px] truncate">
                        {url.replace(/^https?:\/\/(www\.)?/, '')}
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    )}
                  </div>
                ) : null)}
                {!platform.domain && !platform.site_url && !platform.admin_url && (
                  <p className="text-sm text-gray-500">No URLs configured yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Features Card */}
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Features</h2>
            {editing ? (
              <div>
                <div className="flex gap-2 mb-3">
                  <input className={inputCls + ' flex-1'} value={newFeature} onChange={e => setNewFeature(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())} placeholder="Add a feature..." />
                  <button onClick={addFeature} className="px-3 py-2 bg-navy-700 hover:bg-navy-600 text-white text-sm rounded-lg transition-colors">Add</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(form.features || []).map((f, i) => (
                    <span key={i} onClick={() => removeFeature(i)}
                      className="text-xs bg-navy-700 text-gray-300 px-2.5 py-1 rounded-full cursor-pointer hover:bg-red-500/20 hover:text-red-400 transition-colors flex items-center gap-1">
                      {f}
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(platform.features || []).length > 0 ? platform.features.map((f, i) => (
                  <span key={i} className="text-xs bg-navy-700 text-gray-300 px-2.5 py-1 rounded-full">{f}</span>
                )) : <p className="text-sm text-gray-500">No features listed.</p>}
              </div>
            )}
          </div>

          {/* Tech Stack Card */}
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Tech Stack</h2>
            {editing ? (
              <div className="grid grid-cols-2 gap-4">
                {['frontend', 'backend', 'hosting', 'database', 'auth', 'storage'].map(key => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1 capitalize">{key}</label>
                    <input className={inputCls} value={(form.tech_stack || {})[key] || ''}
                      onChange={e => updateTechStack(key, e.target.value)} placeholder={key} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {Object.entries(techStack).filter(([, v]) => v).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-gray-500 capitalize">{key}</p>
                    <p className="text-sm text-white">{value}</p>
                  </div>
                ))}
                {Object.keys(techStack).filter(k => techStack[k]).length === 0 && (
                  <p className="text-sm text-gray-500 col-span-2">No tech stack info.</p>
                )}
              </div>
            )}
          </div>

          {/* Notes Card */}
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Notes</h2>
            {editing ? (
              <textarea className={inputCls} rows={4} value={form.notes || ''} onChange={e => update('notes', e.target.value)} placeholder="Notes about this platform..." />
            ) : (
              <p className="text-sm text-gray-400 whitespace-pre-wrap">{platform.notes || 'No notes.'}</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Info</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-sm text-white">{new Date(platform.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              {platform.updated_at && (
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm text-white">{new Date(platform.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              )}
              {platform.launched_at && (
                <div>
                  <p className="text-xs text-gray-500">Launched</p>
                  <p className="text-sm text-white">{new Date(platform.launched_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              )}
              {platform.monthly_revenue > 0 && (
                <div>
                  <p className="text-xs text-gray-500">Monthly Revenue</p>
                  <p className="text-lg font-bold text-brand-cyan">${(platform.monthly_revenue / 100).toLocaleString()}/mo</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {!editing && (platform.site_url || platform.admin_url) && (
            <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {platform.site_url && (
                  <a href={platform.site_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-navy-700/50 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    Visit Live Site
                  </a>
                )}
                {platform.admin_url && (
                  <a href={platform.admin_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-navy-700/50 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Open Admin Panel
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-800 border border-navy-700/50 rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-white mb-2">Delete Platform</h2>
            <p className="text-gray-400 text-sm mb-6">Are you sure you want to delete <strong className="text-white">{platform.client_name}</strong>? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
