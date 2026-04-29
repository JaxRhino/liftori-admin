import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  cscSupabase, fmtDate, fmtDateTime, fmtMoney, relTime,
  CLEANING_STATUS_TONES, SEVERITY_TONES, QUOTE_STATUS_TONES, INVOICE_STATUS_TONES,
  FREQUENCY_LABELS, COOKING_VOLUME_LABELS,
} from '../../lib/cscClient'

const NFPA_CHECKLIST = [
  { key: 'canopy_cleaned', label: 'Canopy cleaned', section: 'Hood' },
  { key: 'duct_cleaned', label: 'Duct cleaned', section: 'Duct' },
  { key: 'fan_cleaned', label: 'Fan cleaned', section: 'Fan' },
  { key: 'plenum_cleaned', label: 'Plenum cleaned', section: 'Plenum' },
  { key: 'access_panels_verified', label: 'Access panels verified', section: 'Access' },
  { key: 'grease_depth_measured', label: 'Grease depth measured', section: 'Inspection' },
  { key: 'areas_documented', label: 'Inaccessible areas documented', section: 'Inspection' },
  { key: 'sticker_placed', label: 'NFPA 96 sticker placed', section: 'Output' },
]

const PHOTO_SLOTS = [
  { key: 'before_canopy', label: 'Before · canopy' },
  { key: 'after_canopy', label: 'After · canopy' },
  { key: 'before_duct', label: 'Before · duct' },
  { key: 'after_duct', label: 'After · duct' },
  { key: 'before_fan', label: 'Before · fan' },
  { key: 'after_fan', label: 'After · fan' },
  { key: 'before_plenum', label: 'Before · plenum' },
  { key: 'after_plenum', label: 'After · plenum' },
]

function Pill({ tone, children }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${tone}`}>{children}</span>
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{label}</div>
      <div className="text-sm text-white mt-0.5">{children}</div>
    </div>
  )
}

function QrPreview({ data, size = 96 }) {
  if (!data) return null
  // ASCII-only string is safe for the chart-server quoting
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=2`
  return <img src={url} alt="QR" width={size} height={size} className="rounded border border-white/10 bg-white p-1" />
}

export default function CscJobDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [regen, setRegen] = useState(false)
  const [error, setError] = useState(null)

  async function fetchAll() {
    setLoading(true)
    setError(null)
    const [c, p, d, cert, sticker, inv] = await Promise.all([
      cscSupabase.from('csc_cleanings')
        .select('*, restaurant:csc_restaurants(*, chain:csc_chain_groups(name), ahj:csc_ahj_jurisdictions(name, state, contact_name, contact_email))')
        .eq('id', id).single(),
      cscSupabase.from('csc_cleaning_photos').select('*').eq('cleaning_id', id).order('photo_order'),
      cscSupabase.from('csc_deficiencies').select('*').eq('cleaning_id', id).order('severity'),
      cscSupabase.from('csc_certificates').select('*').eq('cleaning_id', id).maybeSingle(),
      cscSupabase.from('csc_stickers').select('*').eq('cleaning_id', id).maybeSingle(),
      cscSupabase.from('csc_invoices').select('*, line_items:csc_invoice_line_items(*)').eq('id', '00000000-0000-0000-0000-000000000000'), // placeholder, refetch by cleaning's invoice_id
    ])
    if (c.error) { setError(c.error.message); setLoading(false); return }
    let invoice = null
    if (c.data?.invoice_id) {
      const { data: invRow } = await cscSupabase.from('csc_invoices').select('*, line_items:csc_invoice_line_items(*)').eq('id', c.data.invoice_id).single()
      invoice = invRow
    }
    setData({ cleaning: c.data, photos: p.data || [], deficiencies: d.data || [], cert: cert.data, sticker: sticker.data, invoice })
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [id])

  async function regenerateCert() {
    setRegen(true)
    try {
      const url = (import.meta.env.VITE_CSC_SUPABASE_URL || 'https://zymgttmngwxkobmdgdia.supabase.co') + '/functions/v1/generate-csc-cert'
      const anon = (import.meta.env.VITE_CSC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bWd0dG1uZ3d4a29ibWRnZGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzcxMDMsImV4cCI6MjA5MjI1MzEwM30.rhfz_Io8k1-LzwVIOWjw119G919yqpJLFnLcF7sid9I')
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anon}` },
        body: JSON.stringify({ cleaning_id: id, force: true }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      await fetchAll()
    } catch (e) {
      alert('Cert regenerate failed: ' + (e.message || e))
    } finally {
      setRegen(false)
    }
  }

  const photosByslot = useMemo(() => {
    const m = {}
    ;(data?.photos || []).forEach(p => { if (p.required_slot) m[p.required_slot] = p })
    return m
  }, [data])

  if (loading) return <div className="text-white/40 p-6">Loading job…</div>
  if (error) return <div className="text-red-300 p-6">Error loading job: {error}</div>
  if (!data) return <div className="text-white/40 p-6">Job not found.</div>

  const { cleaning: c, photos, deficiencies, cert, sticker, invoice } = data
  const r = c.restaurant
  const exceeded = c.exceeded_threshold || (c.grease_depth_pre_inches && Number(c.grease_depth_pre_inches) >= 0.125)

  return (
    <div className="space-y-6">
      {/* Top: account banner + status */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link to="/admin/csc/jobs" className="text-xs text-orange-300 hover:text-orange-200">← Back to jobs</Link>
            <div className="text-2xl font-heading text-white mt-1">{r?.name}</div>
            <div className="text-sm text-white/60 mt-0.5">
              {r?.address_line1}{r?.address_line1 ? ' · ' : ''}{r?.city}, {r?.state} {r?.zip}
            </div>
            <div className="text-xs text-white/40 mt-1">
              {r?.chain?.name && <span>{r.chain.name} · </span>}
              {COOKING_VOLUME_LABELS[r?.cooking_volume]} · {FREQUENCY_LABELS[r?.frequency_tier]} · {r?.hood_count} hood{r?.hood_count !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="text-right space-y-2">
            <Pill tone={CLEANING_STATUS_TONES[c.status]}>{c.status.replace('_', ' ')}</Pill>
            <div className="text-xs text-white/50">Scheduled {fmtDateTime(c.scheduled_at)}</div>
            {c.completed_at && <div className="text-xs text-emerald-300/80">Completed {fmtDateTime(c.completed_at)}</div>}
          </div>
        </div>
      </div>

      {/* Cert + sticker row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mini-certificate card — visually styled to read as the actual document */}
        <div className="rounded-xl border border-orange-500/20 bg-gradient-to-br from-navy-900/60 to-navy-800/40 overflow-hidden">
          <div className="h-1 bg-orange-500" />
          {!cert ? (
            <div className="p-5">
              <div className="text-[10px] uppercase tracking-wider text-orange-300 font-semibold">NFPA 96 Certificate</div>
              <div className="text-white/40 text-sm mt-2">No cert issued yet — close out the job to generate.</div>
            </div>
          ) : (
            <>
              <div className="px-5 pt-4 pb-3 border-b border-white/5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-orange-300 font-bold">NFPA 96 Certificate</div>
                  <div className="font-mono text-2xl text-white mt-0.5 tracking-tight">{cert.cert_number}</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30 mt-0.5">ANSI/IKECA C10-2021</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Compliance</div>
                  <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Verified</span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Issued</div>
                  <div className="text-sm text-white mt-0.5">{fmtDate(cert.issued_at)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Next Due</div>
                  <div className="text-sm text-white mt-0.5">{fmtDate(cert.expires_at)}</div>
                </div>
                <div className="row-span-2 flex justify-end">
                  <div className="text-center">
                    <QrPreview data={cert.public_verify_url || cert.qr_code} size={144} />
                    <div className="text-[9px] text-white/40 uppercase tracking-wider mt-1.5">Scan to verify</div>
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">QR</div>
                  <div className="font-mono text-xs text-orange-300 mt-0.5">{cert.qr_code}</div>
                </div>
              </div>

              {/* Inline photo evidence strip */}
              {photos.length > 0 && (
                <div className="px-5 pb-3">
                  <div className="text-[9px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">Photo Evidence</div>
                  <div className="flex gap-1.5">
                    {['before_canopy', 'after_canopy', 'before_duct', 'after_duct'].map(slot => {
                      const p = photosByslot[slot]
                      return (
                        <div key={slot} className="flex-1 aspect-square rounded border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                          {p ? (
                            <img src={p.thumbnail_url || p.storage_url} alt={slot} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[8px] text-white/20">—</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="px-5 py-3 border-t border-white/5 bg-black/20 flex flex-wrap gap-2">
                {cert.pdf_url && (
                  <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer"
                     className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-200 text-sm rounded transition-colors font-medium">
                    Open PDF →
                  </a>
                )}
                {cert.public_verify_url && (
                  <a href={cert.public_verify_url} target="_blank" rel="noopener noreferrer"
                     className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm rounded transition-colors">
                    Public verify
                  </a>
                )}
                <button onClick={regenerateCert} disabled={regen}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm rounded transition-colors disabled:opacity-50 ml-auto">
                  {regen ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-blue-300 font-semibold">Sticker</div>
              {sticker ? (
                <>
                  <div className="font-mono text-lg text-white mt-1">QR {sticker.qr_code}</div>
                  <div className="text-xs text-white/60 mt-1 capitalize">Placed {fmtDate(sticker.placed_at)} · {(sticker.hood_location || '').replace('_', ' ')}</div>
                  <div className="text-xs text-white/40 mt-0.5">Batch <span className="font-mono">{sticker.batch_number || '—'}</span></div>
                </>
              ) : <div className="text-white/40 text-sm mt-1">No sticker placed yet.</div>}
            </div>
            {sticker && <QrPreview data={`https://admin.liftori.ai/csc/verify/${sticker.qr_code}`} size={108} />}
          </div>
          {sticker && (
            <div className="mt-3 text-[11px] text-white/40">
              Fire-marshal scan path: /csc/verify/{sticker.qr_code}
            </div>
          )}
        </div>
      </div>

      {/* NFPA 96 checklist + grease depth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white">NFPA 96 Checklist</h3>
          <div className="mt-3 space-y-2">
            {NFPA_CHECKLIST.map(item => {
              const done = c.checklist?.[item.key] === true
              return (
                <div key={item.key} className="flex items-center gap-3 text-sm">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-xs ${done ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-white/30 border border-white/10'}`}>
                    {done ? '✓' : '·'}
                  </span>
                  <span className={done ? 'text-white' : 'text-white/40'}>{item.label}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-white/30">{item.section}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white">Grease Depth (NFPA 96 §11.4)</h3>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <Field label="Pre-cleaning">
              <span className={exceeded ? 'text-red-300 font-semibold' : ''}>
                {c.grease_depth_pre_inches != null ? `${Number(c.grease_depth_pre_inches).toFixed(3)}"` : '—'}
              </span>
            </Field>
            <Field label="Post-cleaning"><span className="text-emerald-300/90">{c.grease_depth_post_inches != null ? `${Number(c.grease_depth_post_inches).toFixed(3)}"` : '—'}</span></Field>
            <Field label="NFPA threshold"><span className="text-white/60">0.125"</span></Field>
          </div>
          {exceeded && (
            <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              ⚠ Pre-cleaning measurement exceeded NFPA 96 threshold — service was performed in compliance, frequency tier upgrade recommended.
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
            <Field label="Technician">{c.tech_name || '—'}</Field>
            <Field label="Supervisor">{c.supervisor_name || '—'}</Field>
            <Field label="Manager attestation">{c.signature_manager_name || '—'}</Field>
            <Field label="Signed at">{c.signature_at ? fmtDateTime(c.signature_at) : '—'}</Field>
          </div>
        </div>
      </div>

      {/* Photo grid */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Required Photo Grid (NFPA 96)</h3>
          <span className="text-xs text-white/40">{photos.length} of {PHOTO_SLOTS.length} captured</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          {PHOTO_SLOTS.map(slot => {
            const photo = photosByslot[slot.key]
            return (
              <div key={slot.key} className="aspect-square rounded-lg border border-white/10 bg-white/5 flex flex-col items-center justify-center text-center p-2">
                {photo ? (
                  <img src={photo.thumbnail_url || photo.storage_url} alt={slot.label} className="w-full h-full object-cover rounded" />
                ) : (
                  <>
                    <div className="text-2xl text-white/20">📷</div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{slot.label}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">missing</div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Deficiencies */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Deficiencies on this job</h3>
          <Link to="/admin/csc/deficiencies" className="text-xs text-orange-300 hover:text-orange-200">All deficiencies →</Link>
        </div>
        {deficiencies.length === 0 ? (
          <div className="px-5 py-6 text-sm text-white/40">No deficiencies logged for this cleaning.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {deficiencies.map(d => (
              <div key={d.id} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Pill tone={SEVERITY_TONES[d.severity]}>{d.severity}</Pill>
                    {d.nfpa_code_ref && <span className="text-[11px] text-white/40">{d.nfpa_code_ref}</span>}
                  </div>
                  <div className="text-sm text-white mt-1">{d.title}</div>
                  {d.description && <div className="text-xs text-white/40 mt-0.5">{d.description}</div>}
                  {d.declined_reason && <div className="text-[11px] text-zinc-400 italic mt-1">Declined: {d.declined_reason}</div>}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <Pill tone={QUOTE_STATUS_TONES[d.quote_status]}>{d.quote_status}</Pill>
                  <div className="text-sm text-white/80">{fmtMoney(d.quote_amount)}</div>
                  {d.approved_by_name && <div className="text-[10px] text-emerald-300/80">approved by {d.approved_by_name}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Areas not accessible + invoice */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white">Areas Not Accessible</h3>
          <div className="text-sm text-white/70 mt-2">
            {c.areas_not_accessible || <span className="text-emerald-300/70">All areas accessed and cleaned ✓</span>}
          </div>
          <div className="mt-3 text-xs text-white/40 italic">
            NFPA 96 requires documenting any area not cleaned and why.
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white">Invoice</h3>
          {invoice ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-white">{invoice.invoice_number}</span>
                <Pill tone={INVOICE_STATUS_TONES[invoice.status]}>{invoice.status}</Pill>
              </div>
              <div className="text-xs text-white/50">Issued {fmtDate(invoice.issue_date)} · Due {fmtDate(invoice.due_date)}</div>
              <div className="text-xs text-white/40 space-y-0.5 pt-2 border-t border-white/5">
                {(invoice.line_items || []).map(li => (
                  <div key={li.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{li.description}</span>
                    <span className="text-white/60">{fmtMoney(li.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-sm">
                <span className="text-white/40">Total</span>
                <span className="text-white font-semibold">{fmtMoney(invoice.total_amount)}</span>
              </div>
            </div>
          ) : (
            <div className="text-white/40 text-sm mt-2">Not invoiced yet.</div>
          )}
        </div>
      </div>

      {/* AHJ context — relevant for the Dane demo */}
      {r?.ahj && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white">Authority Having Jurisdiction</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <Field label="AHJ">{r.ahj.name}</Field>
            <Field label="State">{r.ahj.state}</Field>
            {r.ahj.contact_name && <Field label="Contact">{r.ahj.contact_name}</Field>}
            {r.ahj.contact_email && <Field label="Email"><a href={`mailto:${r.ahj.contact_email}`} className="text-blue-300/80 hover:text-blue-200">{r.ahj.contact_email}</a></Field>}
          </div>
        </div>
      )}
    </div>
  )
}
