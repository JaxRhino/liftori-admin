import { useEffect, useState } from 'react'
import {
  listUtmLinks, createUtmLink, deleteUtmLink,
  buildUtmUrl, generateShortCode, formatInt,
} from '../../lib/marketingService'

const emptyForm = {
  destination_url: '', utm_source: '', utm_medium: '', utm_campaign: '',
  utm_term: '', utm_content: '', short_code: '',
}

export default function UTMBuilder() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])
  useEffect(() => {
    try { setPreview(form.destination_url ? buildUtmUrl(form) : '') } catch { setPreview('') }
  }, [form])

  async function load() {
    setLoading(true)
    try { const data = await listUtmLinks(); setRows(data || []) }
    catch (e) { console.error('UTM load:', e) }
    finally { setLoading(false) }
  }

  async function save() {
    if (!form.destination_url) { alert('Destination URL required'); return }
    if (!form.utm_source || !form.utm_medium || !form.utm_campaign) { alert('Source, medium, and campaign required'); return }
    try {
      const payload = { ...form, short_code: form.short_code || generateShortCode() }
      await createUtmLink(payload)
      setForm(emptyForm); load()
    } catch (e) { alert('Save failed: ' + e.message) }
  }

  async function remove(id) {
    if (!confirm('Delete this UTM link?')) return
    try { await deleteUtmLink(id); load() } catch (e) { alert(e.message) }
  }

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); alert('Copied!') }
    catch { alert('Copy failed') }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">UTM Builder</h1>
        <p className="text-sm text-gray-400 mt-1">Build tagged links for every campaign. Track source, medium, campaign, content, and term.</p>
      </div>

      <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Build a Link</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label><span className="text-xs text-gray-400 block mb-1">Destination URL *</span>
            <input className={inputCls} value={form.destination_url} onChange={e => setForm({...form, destination_url: e.target.value})} placeholder="https://liftori.ai/landing" />
          </label>
          <label><span className="text-xs text-gray-400 block mb-1">Short Code</span>
            <input className={inputCls} value={form.short_code} onChange={e => setForm({...form, short_code: e.target.value})} placeholder="auto-generated" />
          </label>
          <label><span className="text-xs text-gray-400 block mb-1">Source * (utm_source)</span>
            <input className={inputCls} value={form.utm_source} onChange={e => setForm({...form, utm_source: e.target.value})} placeholder="google, facebook, newsletter" />
          </label>
          <label><span className="text-xs text-gray-400 block mb-1">Medium * (utm_medium)</span>
            <input className={inputCls} value={form.utm_medium} onChange={e => setForm({...form, utm_medium: e.target.value})} placeholder="cpc, email, social" />
          </label>
          <label><span className="text-xs text-gray-400 block mb-1">Campaign * (utm_campaign)</span>
            <input className={inputCls} value={form.utm_campaign} onChange={e => setForm({...form, utm_campaign: e.target.value})} placeholder="spring_launch" />
          </label>
          <label><span className="text-xs text-gray-400 block mb-1">Term (utm_term)</span>
            <input className={inputCls} value={form.utm_term} onChange={e => setForm({...form, utm_term: e.target.value})} placeholder="ai+platform" />
          </label>
          <label className="md:col-span-2"><span className="text-xs text-gray-400 block mb-1">Content (utm_content)</span>
            <input className={inputCls} value={form.utm_content} onChange={e => setForm({...form, utm_content: e.target.value})} placeholder="cta_hero, email_button_v2" />
          </label>
        </div>

        {preview && (
          <div className="bg-navy-900/70 border border-navy-700 rounded-lg p-3">
            <p className="text-xs uppercase text-gray-400 mb-1">Preview</p>
            <p className="text-xs text-sky-300 break-all font-mono">{preview}</p>
            <button onClick={() => copyToClipboard(preview)} className="mt-2 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs">Copy URL</button>
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={save} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold">Save Link</button>
        </div>
      </div>

      <div className="rounded-xl bg-navy-800/50 border border-navy-700/50 overflow-hidden">
        <div className="p-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Saved Links</h2>
          <span className="text-xs text-gray-400">{formatInt(rows.length)} total</span>
        </div>
        {loading ? <p className="p-4 text-gray-400 text-sm">Loading…</p> :
         rows.length === 0 ? <p className="p-4 text-gray-500 text-sm">No UTM links yet.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-navy-900/60 text-[11px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left py-2 px-3">Campaign</th>
                <th className="text-left py-2 px-3">Source / Medium</th>
                <th className="text-left py-2 px-3">Destination</th>
                <th className="text-right py-2 px-3">Clicks</th>
                <th className="text-right py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const full = buildUtmUrl(r)
                return (
                  <tr key={r.id} className="border-t border-navy-700/40">
                    <td className="py-2 px-3 text-white">{r.utm_campaign}</td>
                    <td className="py-2 px-3 text-gray-300">{r.utm_source} / {r.utm_medium}</td>
                    <td className="py-2 px-3 text-gray-400 text-xs truncate max-w-xs">{r.destination_url}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{formatInt(r.click_count || 0)}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button onClick={() => copyToClipboard(full)} className="text-sky-400 hover:underline mr-3 text-xs">Copy</button>
                      <button onClick={() => remove(r.id)} className="text-rose-400 hover:underline text-xs">Del</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-navy-800 border border-navy-700 text-white text-sm rounded-md px-3 py-2'
