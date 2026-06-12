// =====================================================================
// EcomSocial - connected social accounts, recent posts, and a
// "post a listing" picker that reuses the social-publish edge fn.
// NOTE: social_accounts is queried with an explicit column list -
// anon cannot select access_token. Never select('*') on it.
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { HubPage, Section } from '../crm/_shared'
import {
  useCrmClient, fmtDate, relTime, StatusChip, POST_STATUS,
  PlatformIcon, PLATFORM_LABELS, SOCIAL_PLATFORMS, SOCIAL_ACCOUNT_COLUMNS,
  ListingThumb,
} from './_ecomShared'

function tokenWarning(acc) {
  if (!acc.token_expires_at) return null
  const days = Math.floor((new Date(acc.token_expires_at).getTime() - Date.now()) / 86400000)
  if (days < 0) return { cls: 'bg-rose-500/15 border-rose-500/40 text-rose-300', msg: 'Connection expired - contact Liftori to reconnect' }
  if (days < 14) return { cls: 'bg-amber-500/15 border-amber-500/40 text-amber-300', msg: `Connection expires in ${days} day${days === 1 ? '' : 's'}` }
  return null
}

export default function EcomSocial() {
  const { client } = useCrmClient()
  const [accounts, setAccounts] = useState([])
  const [posts, setPosts] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickSearch, setPickSearch] = useState('')
  const [pickedListing, setPickedListing] = useState(null)
  const [pickedPlatforms, setPickedPlatforms] = useState([])
  const [posting, setPosting] = useState(false)
  const [results, setResults] = useState(null)

  async function load() {
    try {
      setLoading(true)
      const [accs, psts, lsts] = await Promise.all([
        client.from('social_accounts').select(SOCIAL_ACCOUNT_COLUMNS).order('connected_at', { ascending: false }),
        client.from('social_posts')
          .select('*, listing:listings(id,title,main_image_url)')
          .order('created_at', { ascending: false })
          .limit(25),
        client.from('listings').select('id,title,price,main_image_url,status').eq('status', 'active').order('created_at', { ascending: false }),
      ])
      if (accs.error) throw accs.error
      setAccounts(accs.data || [])
      setPosts(psts.data || [])
      setListings(lsts.data || [])
    } catch (e) {
      console.error('Error loading social hub:', e)
      toast.error('Failed to load social accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (client) load() /* eslint-disable-next-line */ }, [client])

  const connectedPlatforms = useMemo(() => accounts.filter(a => a.is_active).map(a => a.platform), [accounts])
  const unconnected = SOCIAL_PLATFORMS.filter(p => !accounts.some(a => a.platform === p))

  function openPicker() {
    setPickedListing(null)
    setPickedPlatforms(connectedPlatforms)
    setResults(null)
    setPickSearch('')
    setPickerOpen(true)
  }

  async function publishPick() {
    if (!pickedListing || !pickedPlatforms.length || posting) return
    setPosting(true)
    setResults(null)
    try {
      const { data, error } = await client.functions.invoke('social-publish', {
        body: { listing_id: pickedListing.id, platforms: pickedPlatforms },
      })
      if (error) throw error
      const res = data?.results || []
      setResults(res)
      const ok = res.filter(r => r.ok).length
      if (ok === res.length && ok > 0) toast.success('Posted to socials')
      else if (ok > 0) toast.warning('Some posts failed')
      else toast.error('Posting failed')
      load()
    } catch (e) {
      console.error('social-publish failed:', e)
      toast.error(e?.message ? `Posting failed: ${e.message}` : 'Posting failed - try again')
    } finally {
      setPosting(false)
    }
  }

  const pickFiltered = useMemo(() => {
    const q = pickSearch.trim().toLowerCase()
    if (!q) return listings
    return listings.filter(l => (l.title || '').toLowerCase().includes(q))
  }, [listings, pickSearch])

  if (loading) return <div className="p-6 text-gray-400">Loading social hub...</div>

  return (
    <HubPage
      title="Social"
      subtitle="Your shop's Facebook, Instagram and Pinterest presence"
      actions={
        connectedPlatforms.length > 0 && (
          <button onClick={openPicker} className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium">
            Post a listing
          </button>
        )
      }
    >
      {/* ACCOUNT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {accounts.map(acc => {
          const warn = tokenWarning(acc)
          return (
            <div key={acc.id} className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-blue/15 text-brand-blue flex items-center justify-center">
                  <PlatformIcon platform={acc.platform} className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{acc.account_name || PLATFORM_LABELS[acc.platform] || acc.platform}</div>
                  <div className="text-xs text-gray-500">{PLATFORM_LABELS[acc.platform] || acc.platform} · connected {fmtDate(acc.connected_at)}</div>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${acc.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`} title={acc.is_active ? 'Active' : 'Inactive'} />
              </div>
              {warn && (
                <div className={`mt-3 border rounded-lg px-3 py-2 text-xs ${warn.cls}`}>{warn.msg}</div>
              )}
            </div>
          )
        })}
        {unconnected.map(p => (
          <div key={p} className="bg-navy-800/50 border border-dashed border-navy-700/60 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-navy-700/40 text-gray-500 flex items-center justify-center">
                <PlatformIcon platform={p} className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-gray-400 font-medium">{PLATFORM_LABELS[p]}</div>
                <div className="text-xs text-gray-600">Not connected</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">Connection setup via Liftori team - drop us a note in Chat.</p>
          </div>
        ))}
      </div>

      {/* RECENT POSTS */}
      <Section title="Recent Posts">
        {posts.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            Nothing posted yet. Publish a listing, then share it from the editor or with "Post a listing" above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700/50">
                  <th className="px-4 py-2.5 text-left text-gray-400 font-semibold text-xs uppercase tracking-wider">Listing</th>
                  <th className="px-4 py-2.5 text-left text-gray-400 font-semibold text-xs uppercase tracking-wider">Platform</th>
                  <th className="px-4 py-2.5 text-left text-gray-400 font-semibold text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-gray-400 font-semibold text-xs uppercase tracking-wider hidden sm:table-cell">Posted</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(p => (
                  <tr key={p.id} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ListingThumb src={p.listing?.main_image_url} alt={p.listing?.title} className="w-9 h-9" />
                        <span className="text-white truncate max-w-[160px] sm:max-w-xs">{p.listing?.title || 'Deleted listing'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-gray-300">
                        <PlatformIcon platform={p.platform} className="w-4 h-4" />
                        <span className="hidden sm:inline">{PLATFORM_LABELS[p.platform] || p.platform}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusChip map={POST_STATUS} value={p.status} />
                      {p.status === 'failed' && p.error && (
                        <div className="text-[11px] text-rose-300/80 mt-1 max-w-[200px] truncate" title={p.error}>{p.error}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs hidden sm:table-cell">{p.posted_at ? relTime(p.posted_at) : relTime(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* POST A LISTING PICKER */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPickerOpen(false)} />
          <div className="relative w-full sm:max-w-lg max-h-[88vh] bg-navy-900 border border-navy-700/50 rounded-t-2xl sm:rounded-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-navy-700/50 flex items-center justify-between shrink-0">
              <h2 className="text-white font-semibold">Post a listing</h2>
              <button onClick={() => setPickerOpen(false)} className="text-gray-500 hover:text-white text-sm">Close</button>
            </div>
            <div className="p-5 overflow-y-auto">
              {/* platform checkboxes */}
              <div className="flex flex-wrap gap-2 mb-4">
                {connectedPlatforms.map(p => {
                  const checked = pickedPlatforms.includes(p)
                  return (
                    <button key={p} type="button"
                      onClick={() => setPickedPlatforms(prev => checked ? prev.filter(x => x !== p) : [...prev, p])}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${checked ? 'border-brand-blue bg-brand-blue/10 text-white' : 'border-navy-700 text-gray-400 hover:text-white'}`}>
                      <PlatformIcon platform={p} className="w-4 h-4" />
                      {PLATFORM_LABELS[p] || p}
                    </button>
                  )
                })}
              </div>
              {/* listing search + list */}
              <div className="relative mb-3">
                {Search ? <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /> : null}
                <input value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} placeholder="Search active listings..."
                  className="w-full bg-navy-800 border border-navy-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm placeholder-gray-500" />
              </div>
              {pickFiltered.length === 0 ? (
                <div className="text-sm text-gray-500 py-6 text-center">
                  No active listings to post. <Link to="../listings/new" relative="path" className="text-brand-blue">Create one</Link>.
                </div>
              ) : (
                <div className="space-y-1.5 mb-4 max-h-60 overflow-y-auto">
                  {pickFiltered.map(l => (
                    <button key={l.id} type="button" onClick={() => setPickedListing(l)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg border text-left transition ${pickedListing?.id === l.id ? 'border-brand-blue bg-brand-blue/10' : 'border-navy-700/50 hover:border-navy-600'}`}>
                      <ListingThumb src={l.main_image_url} alt={l.title} className="w-10 h-10" />
                      <span className="text-sm text-white truncate flex-1">{l.title || 'Untitled'}</span>
                      <span className="text-xs text-brand-cyan font-semibold shrink-0">${Number(l.price || 0).toFixed(0)}</span>
                    </button>
                  ))}
                </div>
              )}
              {results && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {results.map((r, i) => (
                    <span key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${r.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      <PlatformIcon platform={r.platform} className="w-3.5 h-3.5" />
                      {PLATFORM_LABELS[r.platform] || r.platform}: {r.ok ? 'posted' : (r.error || 'failed')}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={publishPick}
                disabled={!pickedListing || !pickedPlatforms.length || posting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                {posting ? (Loader2 ? <Loader2 size={15} className="animate-spin" /> : null) : null}
                {posting ? 'Posting...' : 'Post now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </HubPage>
  )
}
