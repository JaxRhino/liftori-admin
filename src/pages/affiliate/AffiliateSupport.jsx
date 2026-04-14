import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const STATUS_COLORS = {
  open: 'bg-sky-500/15 text-sky-300',
  in_progress: 'bg-amber-500/15 text-amber-300',
  resolved: 'bg-emerald-500/15 text-emerald-300',
  closed: 'bg-slate-500/15 text-slate-400',
}
const PRIORITY_COLORS = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-orange-400',
  urgent: 'text-rose-400',
}

export default function AffiliateSupport() {
  const { user, profile } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ subject: '', priority: 'medium', description: '' })

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setTickets(data || [])
    } catch (e) {
      console.error(e); toast.error('Failed to load tickets')
    } finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function submit(e) {
    e.preventDefault()
    if (!form.subject.trim() || !form.description.trim()) return
    try {
      await supabase.from('support_tickets').insert({
        customer_id: user.id,
        subject: form.subject.trim(),
        description: `[Creator Platform] ${form.description.trim()}`,
        priority: form.priority,
        status: 'open',
      })
      setForm({ subject: '', priority: 'medium', description: '' })
      setShowForm(false)
      toast.success('Ticket submitted — we\'ll get back to you')
      load()
    } catch (err) { console.error(err); toast.error('Submit failed') }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">🆘 Support</h1>
          <p className="text-sm text-gray-400">Open a ticket and the Liftori team will respond. Urgent issues ping Ryan directly.</p>
        </div>
        <button onClick={() => setShowForm((x) => !x)} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium">
          {showForm ? 'Cancel' : '+ New ticket'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 space-y-3">
          <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required placeholder="Subject — short summary of the issue" className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white">
            {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>Priority: {p}</option>)}
          </select>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={5} placeholder="Describe the issue, what you expected, what's happening, and what you've tried." required className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          <button type="submit" className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium">Submit ticket</button>
        </form>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading…</div>
        ) : tickets.length === 0 ? (
          <div className="text-center text-gray-500 py-12 italic">No tickets yet. Need help? Open one above.</div>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                <span className={`text-xs uppercase font-bold ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{t.subject}</div>
                  <div className="text-xs text-gray-400 mt-1 line-clamp-2">{t.description}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{new Date(t.created_at).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
