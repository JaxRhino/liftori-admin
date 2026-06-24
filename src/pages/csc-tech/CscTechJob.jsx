import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cscSupabase, CSC_URL, CSC_ANON, fmtDateTime, fmtDate, fmtMoney, SEVERITY_TONES, QUOTE_STATUS_TONES, CLEANING_STATUS_TONES } from '../../lib/cscClient'

const CHECKLIST = [
  { key: 'canopy_cleaned', label: 'Canopy cleaned' },
  { key: 'duct_cleaned', label: 'Duct cleaned' },
  { key: 'fan_cleaned', label: 'Fan cleaned' },
  { key: 'plenum_cleaned', label: 'Plenum cleaned' },
  { key: 'access_panels_verified', label: 'Access panels verified' },
  { key: 'grease_depth_measured', label: 'Grease depth measured' },
  { key: 'areas_documented', label: 'Inaccessible areas documented' },
  { key: 'sticker_placed', label: 'NFPA 96 sticker placed' },
]

const PHOTO_SLOTS = [
  { key: 'before_canopy', label: 'Before canopy' },
  { key: 'after_canopy', label: 'After canopy' },
  { key: 'before_duct', label: 'Before duct' },
  { key: 'after_duct', label: 'After duct' },
  { key: 'before_fan', label: 'Before fan' },
  { key: 'after_fan', label: 'After fan' },
  { key: 'before_plenum', label: 'Before plenum' },
  { key: 'after_plenum', label: 'After plenum' },
]


function Section({ title, hint, children, sticky }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {sticky && <span className="text-[10px] uppercase tracking-wider text-orange-300/80">{sticky}</span>}
      </div>
      {hint && <div className="text-[11px] text-white/40 mt-0.5">{hint}</div>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function Pill({ tone, children }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${tone}`}>{children}</span>
}

export default function CscTechJob() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1) // 1=overview, 2=photos+defects, 3=closeout
  const [checklist, setChecklist] = useState({})
  const [photos, setPhotos] = useState({}) // slot -> URL placeholder
  const [grease, setGrease] = useState({ pre: '', post: '' })
  const [areas, setAreas] = useState('')
  const [signName, setSignName] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(null)
  const [uploadingSlot, setUploadingSlot] = useState(null)
  const [defPhotoFile, setDefPhotoFile] = useState(null)

  async function callField(payload) {
    const resp = await fetch(CSC_URL + '/functions/v1/csc-field', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CSC_ANON}` },
      body: JSON.stringify(payload),
    })
    return resp.json()
  }
  async function uploadToBucket(file, prefix) {
    const ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${id}/${prefix}-${Date.now()}.${ext}`
    const { error } = await cscSupabase.storage.from('cleaning-photos').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
    if (error) throw error
    return cscSupabase.storage.from('cleaning-photos').getPublicUrl(path).data.publicUrl
  }

  // Add new deficiency form state
  const [defForm, setDefForm] = useState({ open: false, title: '', severity: 'minor', nfpa_code_ref: 'NFPA 96', quote_amount: '', quote_description: '' })

  useEffect(() => { fetchJob() }, [id])
  async function fetchJob() {
    setLoading(true)
    const [j, p, d] = await Promise.all([
      cscSupabase.from('csc_cleanings').select('*, restaurant:csc_restaurants(*, ahj:csc_ahj_jurisdictions(name, state))').eq('id', id).single(),
      cscSupabase.from('csc_cleaning_photos').select('*').eq('cleaning_id', id),
      cscSupabase.from('csc_deficiencies').select('*').eq('cleaning_id', id).order('severity'),
    ])
    if (j.error) { setLoading(false); return }
    const c = j.data
    setData({ cleaning: c, photos: p.data || [], deficiencies: d.data || [] })
    setChecklist(c.checklist || {})
    setGrease({
      pre: c.grease_depth_pre_inches ?? '',
      post: c.grease_depth_post_inches ?? '',
    })
    setAreas(c.areas_not_accessible || '')
    setSignName(c.signature_manager_name || '')
    // Map existing photos
    const slotMap = {}
    ;(p.data || []).forEach(ph => { if (ph.required_slot) slotMap[ph.required_slot] = ph.storage_url })
    setPhotos(slotMap)
    setLoading(false)
  }

  async function toggleCheck(key) {
    const next = { ...checklist, [key]: !checklist[key] }
    setChecklist(next)
    await cscSupabase.from('csc_cleanings').update({ checklist: next }).eq('id', id)
  }

  async function capturePhoto(slot, file) {
    if (!file) return
    setUploadingSlot(slot)
    try {
      const url = await uploadToBucket(file, slot)
      const res = await callField({ action: 'add_photo', cleaning_id: id, slot, url, caption: `${slot} ${new Date().toLocaleString()}` })
      if (!res.ok) throw new Error(res.error || 'save failed')
      setPhotos(prev => ({ ...prev, [slot]: url }))
    } catch (e) { alert('Photo failed: ' + (e.message || e)) }
    finally { setUploadingSlot(null) }
  }

  async function addDeficiency() {
    if (!defForm.title.trim()) return
    setBusy(true)
    try {
      let photo_url = null
      if (defPhotoFile) photo_url = await uploadToBucket(defPhotoFile, 'deficiency')
      const res = await callField({
        action: 'add_deficiency', cleaning_id: id, restaurant_id: data.cleaning.restaurant_id,
        title: defForm.title.trim(), severity: defForm.severity, nfpa_code_ref: defForm.nfpa_code_ref || null,
        quote_amount: defForm.quote_amount || null, quote_description: defForm.quote_description || null, photo_url,
      })
      if (!res.ok) throw new Error(res.error || 'save failed')
      setDefForm({ open: false, title: '', severity: 'minor', nfpa_code_ref: 'NFPA 96', quote_amount: '', quote_description: '' })
      setDefPhotoFile(null)
      fetchJob()
    } catch (e) { alert('Could not add deficiency: ' + (e.message || e)) }
    finally { setBusy(false) }
  }

  async function closeOut() {
    if (!signName.trim()) { alert('Manager name required'); return }
    if (!grease.pre || !grease.post) { alert('Pre + post grease readings required'); return }
    setBusy(true)
    try {
      // 1. Close out server-side: cleaning complete + cert + sticker mint (service role)
      const out = await callField({
        action: 'close_out', cleaning_id: id,
        grease_pre: Number(grease.pre), grease_post: Number(grease.post),
        signature_name: signName.trim(), areas: areas || null, checklist,
      })
      if (!out.ok) throw new Error(out.error || 'close-out failed')

      // 2. Generate the branded NFPA 96 certificate PDF
      const resp = await fetch(CSC_URL + '/functions/v1/generate-csc-cert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CSC_ANON}` },
        body: JSON.stringify({ cleaning_id: id, force: true }),
      })
      const certResp = resp.ok ? await resp.json() : null

      setSuccess({
        cert_id: out.cert_id,
        cert_number: out.cert_number,
        qr: out.qr_code,
        pdf_url: certResp?.pdf_url,
        verify_url: certResp?.verify_url,
      })
    } catch (e) {
      alert('Close-out failed: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="text-white/40 text-center py-8">Loading job…</div>
  if (!data) return <div className="text-white/40 text-center py-8">Job not found.</div>

  const { cleaning: c, deficiencies } = data
  const r = c.restaurant
  const photoCount = Object.keys(photos).length
  const checkCount = Object.values(checklist).filter(Boolean).length
  const exceeded = grease.pre && Number(grease.pre) >= 0.125

  // SUCCESS overlay
  if (success) {
    return (
      <div className="space-y-4 text-center pt-8">
        <div className="text-5xl">✓</div>
        <h2 className="text-2xl font-heading text-emerald-300">Job closed out.</h2>
        <div className="text-sm text-white/60">Certificate <span className="font-mono text-white">{success.cert_number}</span> issued.</div>
        <div className="text-xs text-white/40">QR <span className="font-mono text-orange-300">{success.qr}</span></div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-left text-sm space-y-2">
          <div className="flex items-center gap-2"><span className="text-emerald-300">✓</span><span>NFPA 96 cert PDF generated</span></div>
          <div className="flex items-center gap-2"><span className="text-emerald-300">✓</span><span>Sticker QR minted &amp; placed</span></div>
          <div className="flex items-center gap-2"><span className="text-emerald-300">✓</span><span>Restaurant compliance updated (next due auto-set)</span></div>
          <div className="flex items-center gap-2"><span className="text-emerald-300">✓</span><span>Customer portal &amp; AHJ verify page now live</span></div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          {success.pdf_url && (
            <a href={success.pdf_url} target="_blank" rel="noopener noreferrer"
               className="px-4 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-200 rounded font-medium">
              View certificate PDF
            </a>
          )}
          {success.verify_url && (
            <a href={success.verify_url} target="_blank" rel="noopener noreferrer"
               className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded">
              See public verify page
            </a>
          )}
          <button onClick={() => navigate('/csc/tech')}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 rounded">
            Back to job list
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/csc/tech" className="text-xs text-orange-300 hover:text-orange-200">← Jobs</Link>

      {/* Site header */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="text-base font-semibold text-white">{r?.name}</div>
            <div className="text-xs text-white/50">{r?.address_line1} · {r?.city}, {r?.state}</div>
            <div className="text-[11px] text-white/40 mt-1">{r?.hood_count} hood{r?.hood_count !== 1 ? 's' : ''} · {(r?.frequency_tier || '').replace('_','-')}</div>
          </div>
          <Pill tone={CLEANING_STATUS_TONES[c.status]}>{c.status.replace('_',' ')}</Pill>
        </div>
        {r?.rooftop_access_notes && (
          <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            ⚠ Site note: {r.rooftop_access_notes}
          </div>
        )}
        {r?.contact_name && (
          <div className="mt-2 text-[11px] text-white/40">
            On-site: {r.contact_name} {r.contact_role ? `(${r.contact_role})` : ''} · {r.phone || '—'}
          </div>
        )}
      </div>

      {/* Step tabs */}
      <div className="grid grid-cols-3 gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
        {[
          { n: 1, label: 'Active', desc: `${checkCount}/8 done` },
          { n: 2, label: 'Photos & Defects', desc: `${photoCount}/8 photos · ${deficiencies.length} def` },
          { n: 3, label: 'Close-out', desc: 'sign + finish' },
        ].map(s => (
          <button key={s.n} onClick={() => setStep(s.n)}
                  className={`text-center py-2 px-2 rounded text-[11px] font-medium ${step === s.n ? 'bg-orange-500/20 text-orange-200 border border-orange-500/40' : 'text-white/50'}`}>
            <div>{s.label}</div>
            <div className="text-[10px] opacity-70 mt-0.5">{s.desc}</div>
          </button>
        ))}
      </div>

      {/* STEP 1: NFPA checklist + grease readings + prior open deficiencies */}
      {step === 1 && (
        <>
          <Section title="NFPA 96 Checklist" hint="Tap each item as you complete it.">
            <div className="space-y-2">
              {CHECKLIST.map(item => {
                const done = !!checklist[item.key]
                return (
                  <button key={item.key} onClick={() => toggleCheck(item.key)} className="w-full flex items-center gap-3 px-3 py-3 rounded border border-white/5 hover:bg-white/5 active:bg-white/10 text-left">
                    <span className={`w-6 h-6 rounded flex items-center justify-center text-sm ${done ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 border border-white/10 text-white/30'}`}>{done ? '✓' : ''}</span>
                    <span className={`text-sm ${done ? 'text-white' : 'text-white/70'}`}>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Grease Depth (NFPA 96 §11.4)" hint="Threshold 0.125 in. - service required when exceeded.">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-white/60">
                Pre (inches)
                <input type="number" step="0.001" inputMode="decimal" value={grease.pre} onChange={e => setGrease(g => ({ ...g, pre: e.target.value }))}
                       className={`mt-1 w-full px-3 py-2 bg-black/30 border rounded text-white text-sm ${exceeded ? 'border-red-500/50 text-red-300 font-semibold' : 'border-white/10'}`} />
              </label>
              <label className="text-xs text-white/60">
                Post (inches)
                <input type="number" step="0.001" inputMode="decimal" value={grease.post} onChange={e => setGrease(g => ({ ...g, post: e.target.value }))}
                       className="mt-1 w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm" />
              </label>
            </div>
            {exceeded && <div className="mt-2 text-[11px] text-red-300">⚠ Pre-cleaning depth exceeds NFPA threshold — service performed in compliance.</div>}
          </Section>

          {deficiencies.filter(d => ['open','quoted'].includes(d.quote_status)).length > 0 && (
            <Section title="Open from Previous Visit" hint="Inspect these areas and update status.">
              <div className="space-y-2">
                {deficiencies.filter(d => ['open','quoted'].includes(d.quote_status)).map(d => (
                  <div key={d.id} className="rounded border border-white/5 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1"><Pill tone={SEVERITY_TONES[d.severity]}>{d.severity}</Pill></div>
                        <div className="text-sm text-white mt-1">{d.title}</div>
                      </div>
                      <Pill tone={QUOTE_STATUS_TONES[d.quote_status]}>{d.quote_status}</Pill>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {/* STEP 2: photo grid + add-deficiency */}
      {step === 2 && (
        <>
          <Section title="Required Photo Grid" hint="8 NFPA 96 photos. Tap a slot to capture.">
            <div className="grid grid-cols-2 gap-2">
              {PHOTO_SLOTS.map(slot => {
                const url = photos[slot.key]
                return (
                  <label key={slot.key}
                          className="aspect-square rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center text-center p-2 overflow-hidden cursor-pointer">
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                           onChange={e => capturePhoto(slot.key, e.target.files?.[0])} />
                    {url ? (
                      <img src={url} alt={slot.label} className="w-full h-full object-cover" />
                    ) : uploadingSlot === slot.key ? (
                      <div className="text-[11px] text-orange-300">Uploading...</div>
                    ) : (
                      <>
                        <div className="text-[10px] uppercase tracking-wider text-white/50">{slot.label}</div>
                        <div className="text-[10px] text-white/30 mt-0.5">tap to add photo</div>
                      </>
                    )}
                  </label>
                )
              })}
            </div>
            <div className="text-[10px] text-white/30 mt-2">Tap a slot to take a photo with your device camera. Photos attach to the certificate and the customer portal.</div>
          </Section>

          <Section title="Deficiencies Logged" hint="Issues found that need quoting or follow-up.">
            <div className="space-y-2">
              {deficiencies.length === 0 && <div className="text-xs text-white/40 italic">None yet.</div>}
              {deficiencies.map(d => (
                <div key={d.id} className="rounded border border-white/5 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Pill tone={SEVERITY_TONES[d.severity]}>{d.severity}</Pill>
                        {d.nfpa_code_ref && <span className="text-[10px] text-white/40">{d.nfpa_code_ref}</span>}
                      </div>
                      <div className="text-sm text-white mt-1">{d.title}</div>
                    </div>
                    {d.quote_amount && <div className="text-sm text-white">{fmtMoney(d.quote_amount)}</div>}
                  </div>
                </div>
              ))}
            </div>

            {!defForm.open ? (
              <button onClick={() => setDefForm(f => ({ ...f, open: true }))} className="mt-3 w-full px-3 py-2 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-200 rounded text-sm font-medium">+ Log new deficiency</button>
            ) : (
              <div className="mt-3 space-y-2 rounded border border-orange-500/30 bg-orange-500/5 p-3">
                <input value={defForm.title} onChange={e => setDefForm(f => ({...f, title: e.target.value}))} placeholder="Title (e.g. Cracked grease cup)" className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm" />
                <select value={defForm.severity} onChange={e => setDefForm(f => ({...f, severity: e.target.value}))} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm">
                  <option value="critical">Critical</option><option value="major">Major</option><option value="minor">Minor</option><option value="observation">Observation</option>
                </select>
                <input value={defForm.nfpa_code_ref} onChange={e => setDefForm(f => ({...f, nfpa_code_ref: e.target.value}))} placeholder="NFPA code reference" className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm" />
                <input type="number" step="0.01" inputMode="decimal" value={defForm.quote_amount} onChange={e => setDefForm(f => ({...f, quote_amount: e.target.value}))} placeholder="Quote $ (optional)" className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm" />
                <textarea value={defForm.quote_description} onChange={e => setDefForm(f => ({...f, quote_description: e.target.value}))} placeholder="Repair scope (what we'd do)" className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm" rows="2" />
                <label className="block text-[11px] text-white/50">Photo (optional)
                  <input type="file" accept="image/*" capture="environment" onChange={e => setDefPhotoFile(e.target.files?.[0] || null)} className="mt-1 w-full text-xs text-white/70 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-orange-500/20 file:text-orange-200" />
                  {defPhotoFile && <span className="text-[10px] text-emerald-300">{defPhotoFile.name} ready</span>}
                </label>
                <div className="flex gap-2">
                  <button onClick={addDeficiency} disabled={busy || !defForm.title.trim()} className="flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 rounded text-sm font-medium disabled:opacity-50">{busy ? '…' : 'Save'}</button>
                  <button onClick={() => setDefForm({ open: false, title: '', severity: 'minor', nfpa_code_ref: 'NFPA 96', quote_amount: '', quote_description: '' })} className="px-3 py-2 bg-white/5 border border-white/10 text-white/70 rounded text-sm">Cancel</button>
                </div>
              </div>
            )}
          </Section>
        </>
      )}

      {/* STEP 3: close-out — areas + signature + finish */}
      {step === 3 && (
        <>
          <Section title="Close-out Summary" hint="Verify before submitting — this fires the cert PDF + portal update + invoice.">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-white/60">NFPA checklist</span><span className={checkCount === 8 ? 'text-emerald-300' : 'text-amber-300'}>{checkCount} of 8</span></div>
              <div className="flex items-center justify-between"><span className="text-white/60">Photos</span><span className={photoCount >= 8 ? 'text-emerald-300' : 'text-amber-300'}>{photoCount} of 8</span></div>
              <div className="flex items-center justify-between"><span className="text-white/60">Grease pre / post</span><span className={grease.pre && grease.post ? 'text-emerald-300' : 'text-red-300'}>{grease.pre || '?'} / {grease.post || '?'}</span></div>
              <div className="flex items-center justify-between"><span className="text-white/60">Deficiencies logged</span><span className="text-white">{deficiencies.length}</span></div>
            </div>
          </Section>

          <Section title="Areas Not Accessible (NFPA 96)" hint="Document any section you couldn't clean and why.">
            <textarea value={areas} onChange={e => setAreas(e.target.value)} rows="3" placeholder="e.g. Plenum behind walk-in - access blocked"
                      className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm" />
          </Section>

          <Section title="On-site Manager Signature" hint="Type the manager's name to acknowledge service.">
            <input value={signName} onChange={e => setSignName(e.target.value)} placeholder="e.g. Mark Vendetti"
                   className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white text-sm" />
          </Section>
        </>
      )}

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur border-t border-white/10 px-4 py-3 z-20">
        <div className="max-w-md mx-auto flex gap-2">
          {step > 1 && <button onClick={() => setStep(step - 1)} className="px-4 py-3 bg-white/5 border border-white/10 text-white/70 rounded font-medium">← Back</button>}
          {step < 3 && <button onClick={() => setStep(step + 1)} className="flex-1 px-4 py-3 bg-orange-500/20 border border-orange-500/40 text-orange-200 rounded font-semibold">Continue →</button>}
          {step === 3 && (
            <button onClick={closeOut} disabled={busy || !signName.trim() || !grease.pre || !grease.post}
                    className="flex-1 px-4 py-3 bg-emerald-500/30 border border-emerald-500/50 text-emerald-100 rounded font-semibold disabled:opacity-40">
              {busy ? 'Closing out…' : 'Submit & Issue Cert'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
