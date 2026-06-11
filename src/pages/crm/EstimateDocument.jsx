import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCrm } from '../../contexts/CrmContext'
import { resolveTheme } from '../../lib/estimateThemes'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function normItem(it) {
  return {
    description: it.description || it.name || '',
    detail: (it.description && it.name) ? it.description : (it.detail || ''),
    qty: Number(it.qty != null ? it.qty : it.quantity) || 0,
    unit: it.unit || '',
    unit_price: Number(it.unit_price) || 0,
    group: it.group_name || it.category || 'Items',
    optional: !!it.is_optional,
  }
}

export default function EstimateDocument() {
  const { estimateId } = useParams()
  const navigate = useNavigate()
  const { client, orgSettings } = useCrm()
  const [est, setEst] = useState(null)
  const [contact, setContact] = useState(null)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [estimateId])

  async function load() {
    setLoading(true)
    const { data: e } = await client.from('customer_estimates').select('*').eq('id', estimateId).maybeSingle()
    setEst(e || null)
    if (e && e.contact_id) {
      const { data: c } = await client.from('customer_contacts').select('*').eq('id', e.contact_id).maybeSingle()
      setContact(c || null)
    }
    if (e && e.show_photos && Array.isArray(e.photo_ids) && e.photo_ids.length) {
      const { data: ph } = await client.from('customer_photos').select('*').in('id', e.photo_ids)
      const ordered = e.photo_ids.map((id) => (ph || []).find((p) => p.id === id)).filter(Boolean)
      const signed = await Promise.all(ordered.map(async (p) => {
        if (!p.storage_path) return { ...p, signedUrl: p.url || null }
        const { data: s } = await client.storage.from('customer-photos').createSignedUrl(p.storage_path, 3600)
        return { ...p, signedUrl: (s && s.signedUrl) || p.url || null }
      }))
      setPhotos(signed)
    } else { setPhotos([]) }
    setLoading(false)
  }

  const theme = useMemo(() => resolveTheme(est && est.theme_key, orgSettings || {}, est && est.accent_color), [est, orgSettings])
  const items = useMemo(() => (Array.isArray(est && est.line_items) ? est.line_items.map(normItem) : []), [est])
  const groups = useMemo(() => {
    const m = {}
    items.forEach((it) => { (m[it.group] = m[it.group] || []).push(it) })
    return Object.entries(m)
  }, [items])

  if (loading) return <div className="fixed inset-0 bg-white flex items-center justify-center text-slate-500">Loading estimate...</div>
  if (!est) return <div className="fixed inset-0 bg-white flex items-center justify-center text-slate-500">Estimate not found.</div>

  const org = orgSettings || {}
  const contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : ''
  const itemTotal = (it) => it.qty * it.unit_price

  return (
    <div className="fixed inset-0 z-50 overflow-auto" style={{ background: '#f1f5f9' }}>
      <style>{'@media print { body * { visibility: hidden !important; } #estimate-print, #estimate-print * { visibility: visible !important; } #estimate-print { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none; } .no-print { display: none !important; } }'}</style>

      <div className="no-print sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-navy-900 text-white">
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-gray-300 hover:text-white">&larr; Back</button>
        <span className="text-sm font-medium">Estimate {est.estimate_number || ''}</span>
        <button type="button" onClick={() => window.print()} className="text-sm px-3 py-1.5 rounded-lg bg-brand-cyan text-navy-900 font-medium">Print / PDF</button>
      </div>

      <div id="estimate-print" className="max-w-3xl mx-auto my-6 bg-white shadow-xl" style={{ color: theme.text }}>
        <div className="px-8 py-6 flex items-start justify-between" style={{ background: theme.headerBg, color: theme.headerText }}>
          <div className="flex items-center gap-3">
            {org.logo_url ? <img src={org.logo_url} alt="logo" className="h-12 w-auto object-contain" /> : null}
            <div>
              <div className="text-xl font-bold">{org.company_name || 'Your Company'}</div>
              <div className="text-xs opacity-80">{[org.company_address, org.company_city, org.company_state].filter(Boolean).join(', ')}</div>
              <div className="text-xs opacity-80">{[org.company_phone, org.company_email].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-wide">ESTIMATE</div>
            {est.estimate_number ? <div className="text-xs opacity-80">#{est.estimate_number}</div> : null}
            {est.valid_until ? <div className="text-xs opacity-80">Valid until {est.valid_until}</div> : null}
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="flex justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: theme.muted }}>Prepared for</div>
              <div className="font-semibold">{contactName || '—'}</div>
              {contact && contact.property_address ? <div className="text-sm" style={{ color: theme.muted }}>{[contact.property_address, contact.property_city, contact.property_state, contact.property_zip].filter(Boolean).join(', ')}</div> : null}
              {contact && contact.email ? <div className="text-sm" style={{ color: theme.muted }}>{contact.email}</div> : null}
              {contact && contact.phone ? <div className="text-sm" style={{ color: theme.muted }}>{contact.phone}</div> : null}
            </div>
            <div className="text-right">
              {est.title ? <div className="font-semibold">{est.title}</div> : null}
              {est.created_at ? <div className="text-sm" style={{ color: theme.muted }}>{new Date(est.created_at).toLocaleDateString()}</div> : null}
            </div>
          </div>

          {est.intro ? <p className="text-sm mb-6" style={{ color: theme.muted }}>{est.intro}</p> : null}

          {groups.map(([g, list]) => (
            <div key={g} className="mb-5">
              <div className="text-sm font-semibold mb-2 pb-1" style={{ borderBottom: '2px solid ' + theme.accent }}>{g}</div>
              <table className="w-full text-sm">
                <tbody>
                  {list.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid ' + theme.border }}>
                      <td className="py-2 pr-2">
                        <div className="font-medium">{it.description}{it.optional ? <span className="ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded" style={{ background: theme.border, color: theme.muted }}>Optional</span> : null}</div>
                        {it.detail ? <div className="text-xs" style={{ color: theme.muted }}>{it.detail}</div> : null}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap" style={{ color: theme.muted }}>{it.qty}{it.unit ? ' ' + it.unit : ''}</td>
                      <td className="py-2 px-2 text-right whitespace-nowrap" style={{ color: theme.muted }}>{money(it.unit_price)}</td>
                      <td className="py-2 pl-2 text-right whitespace-nowrap font-medium">{money(itemTotal(it))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="flex justify-end mt-4">
            <div className="w-64 text-sm">
              <div className="flex justify-between py-1"><span style={{ color: theme.muted }}>Subtotal</span><span>{money(est.subtotal)}</span></div>
              {Number(est.discount_amount) > 0 ? <div className="flex justify-between py-1"><span style={{ color: theme.muted }}>Discount</span><span>-{money(est.discount_amount)}</span></div> : null}
              {Number(est.tax_amount) > 0 ? <div className="flex justify-between py-1"><span style={{ color: theme.muted }}>Tax{est.tax_rate ? ' (' + est.tax_rate + '%)' : ''}</span><span>{money(est.tax_amount)}</span></div> : null}
              <div className="flex justify-between py-2 mt-1 text-base font-bold" style={{ borderTop: '2px solid ' + theme.accent, color: theme.accent }}><span>Total</span><span>{money(est.total)}</span></div>
            </div>
          </div>

          {est.show_photos && photos.length ? (
            <div className="mt-8">
              <div className="text-sm font-semibold mb-3 pb-1" style={{ borderBottom: '2px solid ' + theme.accent }}>Photos</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((p) => (
                  <figure key={p.id} className="text-xs">
                    {p.signedUrl ? <img src={p.signedUrl} alt={p.caption || ''} className="w-full h-40 object-cover rounded" style={{ border: '1px solid ' + theme.border }} /> : null}
                    {p.caption ? <figcaption className="mt-1" style={{ color: theme.muted }}>{p.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          {est.terms ? (
            <div className="mt-8">
              <div className="text-sm font-semibold mb-2 pb-1" style={{ borderBottom: '2px solid ' + theme.accent }}>Terms &amp; Conditions</div>
              <p className="text-xs whitespace-pre-wrap" style={{ color: theme.muted }}>{est.terms}</p>
            </div>
          ) : null}

          <div className="mt-10 pt-6" style={{ borderTop: '1px solid ' + theme.border }}>
            <div className="text-sm font-semibold mb-4">Acceptance</div>
            <div className="flex justify-between gap-8">
              <div className="flex-1">
                <div className="h-10" style={{ borderBottom: '1px solid ' + theme.text }}></div>
                <div className="text-xs mt-1" style={{ color: theme.muted }}>Signature {est.signer_name ? '— ' + est.signer_name : ''}</div>
              </div>
              <div className="flex-1">
                <div className="h-10" style={{ borderBottom: '1px solid ' + theme.text }}></div>
                <div className="text-xs mt-1" style={{ color: theme.muted }}>Date</div>
              </div>
            </div>
            {est.esign_status === 'signed' ? <div className="text-xs mt-3" style={{ color: theme.accent }}>Signed electronically{est.esign_signed_at ? ' on ' + new Date(est.esign_signed_at).toLocaleString() : ''}.</div> : null}
          </div>
        </div>

        <div className="px-8 py-4 text-center text-xs" style={{ color: theme.muted, borderTop: '1px solid ' + theme.border }}>
          {org.company_name || ''} {org.company_name ? '· ' : ''}Thank you for your business
        </div>
      </div>
    </div>
  )
}
