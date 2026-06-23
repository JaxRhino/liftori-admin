import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

// PUBLIC homeowner portal (no auth). Resolves the tenant's Supabase routing via
// the get_crm_proposal_routing RPC on the main DB, then shows the customer's
// project status, proposals (view & sign), invoices, photos, documents and
// warranties — keyed by contact_id. Read-only; light customer-facing theme.

const money = (v) => '$' + (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
const cap = (s) => (s || '').toString().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const PROD_STEPS = ['scheduled', 'material_delivered', 'tear_off', 'dry_in', 'complete', 'inspected']
const INV_TONE = { paid: 'bg-emerald-100 text-emerald-700', partial: 'bg-amber-100 text-amber-700', sent: 'bg-blue-100 text-blue-700', overdue: 'bg-red-100 text-red-700', draft: 'bg-slate-100 text-slate-600', void: 'bg-slate-100 text-slate-400' }

export default function CrmPortal() {
  const { platformId, contactId } = useParams()
  const [accent, setAccent] = useState('#2563eb')
  const [org, setOrg] = useState(null)
  const [contact, setContact] = useState(null)
  const [deals, setDeals] = useState([])
  const [jobs, setJobs] = useState([])
  const [estimates, setEstimates] = useState([])
  const [invoices, setInvoices] = useState([])
  const [photos, setPhotos] = useState([])
  const [agreements, setAgreements] = useState([])
  const [warranties, setWarranties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { boot(); /* eslint-disable-next-line */ }, [platformId, contactId])
  async function boot() {
    try {
      setLoading(true)
      const { data: routes, error: rErr } = await supabase.rpc('get_crm_proposal_routing', { p_platform_id: platformId })
      if (rErr) throw rErr
      const route = Array.isArray(routes) ? routes[0] : routes
      if (!route || !route.supabase_url) throw new Error('Portal not found')
      const tc = createClient(route.supabase_url, route.supabase_publishable_key, { auth: { persistSession: false } })
      const safe = (p) => p.then((r) => r).catch(() => ({ data: null }))
      const [c, o, dl, jb, es, iv, ph, ag, wr] = await Promise.all([
        safe(tc.from('customer_contacts').select('*').eq('id', contactId).maybeSingle()),
        safe(tc.from('org_settings').select('*').limit(1).maybeSingle()),
        safe(tc.from('customer_pipeline').select('id, title, stage, deal_value, service_type, expected_close_date').eq('contact_id', contactId).order('created_at', { ascending: false })),
        safe(tc.from('ops_work_orders').select('id, title, work_order_number, status, production_stage, scheduled_start').eq('contact_id', contactId).order('created_at', { ascending: false })),
        safe(tc.from('customer_estimates').select('id, title, status, total, esign_status, proposal_group_id, tier, tier_recommended').eq('contact_id', contactId).order('created_at', { ascending: false })),
        safe(tc.from('finance_invoices').select('id, invoice_number, invoice_date, due_date, status, total_amount, balance_due').eq('customer_id', contactId).order('invoice_date', { ascending: false })),
        safe(tc.from('customer_photos').select('id, url, caption, category').eq('contact_id', contactId).order('sort_order', { ascending: true })),
        safe(tc.from('customer_agreements').select('id, title, status, esign_status, total_value').eq('contact_id', contactId).order('created_at', { ascending: false })),
        safe(tc.from('warranties').select('id, warranty_type, provider, product, expiration_date, status').eq('contact_id', contactId).order('expiration_date', { ascending: true })),
      ])
      if (!c.data) throw new Error('Portal not found')
      setContact(c.data); setOrg(o.data || null)
      if (o.data && o.data.accent_color) setAccent(o.data.accent_color)
      setDeals(dl.data || []); setJobs(jb.data || []); setEstimates(es.data || [])
      setInvoices(iv.data || []); setPhotos((ph.data || []).filter((p) => p.url)); setAgreements(ag.data || []); setWarranties(wr.data || [])
    } catch (e) { console.error(e); setError(e.message || 'Unable to load portal') }
    finally { setLoading(false) }
  }

  const companyName = (org && org.company_name) || 'Your Contractor'
  const custName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : ''
  const groupProposals = useMemo(() => {
    // collapse tiered estimates to one entry per proposal group
    const seen = new Set(); const out = []
    for (const e of estimates) {
      if (e.proposal_group_id) { if (seen.has(e.proposal_group_id)) continue; seen.add(e.proposal_group_id) }
      out.push(e)
    }
    return out
  }, [estimates])

  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /></div>
  if (error) return <div className="min-h-screen bg-slate-100 flex items-center justify-center px-6"><div className="text-center"><div className="text-slate-800 text-xl font-semibold mb-2">Portal unavailable</div><div className="text-slate-500">{error}</div></div></div>

  const Card = ({ title, children }) => (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">{title}</h2>
      {children}
    </section>
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="max-w-4xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {org && org.logo_url ? <img src={org.logo_url} alt="" className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200" /> : <div className="w-12 h-12 rounded-lg text-white font-bold text-lg flex items-center justify-center" style={{ background: accent }}>{companyName.charAt(0)}</div>}
            <div>
              <div className="font-semibold text-lg text-slate-900">{companyName}</div>
              <div className="text-xs text-slate-500">Customer Portal</div>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-medium text-slate-900">{custName || '—'}</div>
            {contact && contact.property_address ? <div className="text-xs text-slate-500">{[contact.property_address, contact.property_city].filter(Boolean).join(', ')}</div> : null}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-6">Welcome{custName ? `, ${contact.first_name}` : ''}</h1>

        {/* Project status */}
        {(jobs.length > 0 || deals.length > 0) && (
          <Card title="Project status">
            {jobs.map((j) => {
              const idx = PROD_STEPS.indexOf((j.production_stage || '').toLowerCase())
              return (
                <div key={j.id} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-slate-900">{j.title || 'Roofing project'}</div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{cap(j.status)}</span>
                  </div>
                  {idx >= 0 && (
                    <div className="flex items-center gap-1">
                      {PROD_STEPS.map((s, i) => (
                        <div key={s} className="flex-1">
                          <div className="h-1.5 rounded-full" style={{ background: i <= idx ? accent : '#e2e8f0' }} />
                          <div className={'text-[10px] mt-1 ' + (i <= idx ? 'text-slate-600' : 'text-slate-400')}>{cap(s)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {jobs.length === 0 && deals.map((d) => (
              <div key={d.id} className="flex items-center justify-between mb-2 last:mb-0">
                <div className="font-medium text-slate-900">{d.title || cap(d.service_type) || 'Your project'}</div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{cap(d.stage)}</span>
              </div>
            ))}
          </Card>
        )}

        {/* Proposals */}
        {groupProposals.length > 0 && (
          <Card title="Your proposals">
            <div className="space-y-2">
              {groupProposals.map((e) => {
                const signed = e.esign_status === 'signed' || e.status === 'accepted'
                const href = e.proposal_group_id ? `/proposal/${platformId}/${e.proposal_group_id}` : null
                return (
                  <div key={e.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3">
                    <div>
                      <div className="font-medium text-slate-900">{e.title || 'Proposal'}</div>
                      <div className="text-xs text-slate-500">{e.total ? money(e.total) : ''}{signed ? ' · Accepted' : ''}</div>
                    </div>
                    {signed ? <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">Signed</span>
                      : href ? <a href={href} className="text-sm font-medium text-white px-3 py-1.5 rounded-lg" style={{ background: accent }}>View &amp; sign</a>
                      : <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{cap(e.status)}</span>}
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Invoices */}
        {invoices.length > 0 && (
          <Card title="Invoices">
            <div className="space-y-2">
              {invoices.map((iv) => (
                <div key={iv.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3">
                  <div>
                    <div className="font-medium text-slate-900">{iv.invoice_number || 'Invoice'}</div>
                    <div className="text-xs text-slate-500">{fmtDate(iv.invoice_date)}{iv.due_date ? ` · due ${fmtDate(iv.due_date)}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{money(iv.total_amount)}</div>
                    <span className={'text-[11px] px-2 py-0.5 rounded-full ' + (INV_TONE[iv.status] || 'bg-slate-100 text-slate-600')}>{cap(iv.status)}{Number(iv.balance_due) > 0 && iv.status !== 'paid' ? ` · ${money(iv.balance_due)} due` : ''}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">To make a payment, please contact {companyName}.</p>
          </Card>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <Card title="Photos">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((p) => (
                <figure key={p.id} className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={p.url} alt={p.caption || ''} className="w-full h-32 object-cover" loading="lazy" />
                  {p.caption ? <figcaption className="text-[11px] text-slate-500 px-2 py-1 truncate">{p.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </Card>
        )}

        {/* Documents & warranties */}
        {(agreements.length > 0 || warranties.length > 0) && (
          <Card title="Documents & warranties">
            <div className="space-y-2">
              {agreements.map((a) => (
                <div key={a.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3">
                  <div className="font-medium text-slate-900">{a.title || 'Agreement'}</div>
                  <span className={'text-xs px-2.5 py-1 rounded-full ' + (a.esign_status === 'signed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>{a.esign_status === 'signed' ? 'Signed' : cap(a.status || 'Pending')}</span>
                </div>
              ))}
              {warranties.map((w) => (
                <div key={w.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3">
                  <div>
                    <div className="font-medium text-slate-900">{[w.provider, w.product].filter(Boolean).join(' · ') || cap(w.warranty_type) + ' warranty'}</div>
                    <div className="text-xs text-slate-500">{cap(w.warranty_type)} warranty{w.expiration_date ? ` · expires ${fmtDate(w.expiration_date)}` : ''}</div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">{cap(w.status || 'active')}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {jobs.length === 0 && deals.length === 0 && groupProposals.length === 0 && invoices.length === 0 && photos.length === 0 && agreements.length === 0 && warranties.length === 0 && (
          <Card title="Nothing here yet"><p className="text-sm text-slate-500">Your project details will appear here as work progresses.</p></Card>
        )}

        <div className="mt-8 text-center text-xs text-slate-400">Powered by Liftori</div>
      </div>
    </div>
  )
}
