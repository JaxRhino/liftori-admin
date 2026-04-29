import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { cscSupabase, fmtDate, fmtDateTime, relTime } from '../../lib/cscClient'

function StatusBadge({ status, label, hint }) {
  const tones = {
    valid: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-400' },
    expiring: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-300', dot: 'bg-amber-400' },
    expired: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-300', dot: 'bg-red-400' },
    unknown: { bg: 'bg-zinc-500/20', border: 'border-zinc-500/40', text: 'text-zinc-300', dot: 'bg-zinc-400' },
  }
  const t = tones[status] || tones.unknown
  return (
    <div className={`rounded-lg border ${t.border} ${t.bg} px-4 py-3`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${t.dot} animate-pulse`}></span>
        <span className={`text-sm font-semibold uppercase tracking-wider ${t.text}`}>{label}</span>
      </div>
      {hint && <div className="text-xs text-white/60 mt-1">{hint}</div>}
    </div>
  )
}

export default function CscVerify() {
  const { qr } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: cert, error: certErr } = await cscSupabase
        .from('csc_certificates')
        .select('*, restaurant:csc_restaurants(name, address_line1, city, state, zip, frequency_tier, hood_count, last_cleaned_at, next_due_at, ahj:csc_ahj_jurisdictions(name, state)), cleaning:csc_cleanings(completed_at, tech_name, supervisor_name, grease_depth_pre_inches, grease_depth_post_inches, exceeded_threshold, areas_not_accessible)')
        .eq('qr_code', qr)
        .maybeSingle()
      if (certErr) { setError(certErr.message); setLoading(false); return }
      setData(cert)
      setLoading(false)
    })()
  }, [qr])

  if (loading) return <div className="text-white/40 text-center py-12">Verifying certificate…</div>
  if (error) return <div className="text-red-300 text-center py-12">Error: {error}</div>
  if (!data) return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-8 text-center">
      <div className="text-2xl">⚠</div>
      <div className="text-lg font-semibold text-red-300 mt-2">Certificate not found</div>
      <div className="text-sm text-white/60 mt-2">QR code <span className="font-mono text-white">{qr}</span> is not registered in the LABOS-KEC compliance system.</div>
      <div className="text-xs text-white/40 mt-4">If you are an AHJ official and believe this is in error, contact CSC Services at info@cleanmyducts.com.</div>
    </div>
  )

  const now = Date.now()
  const expiresMs = new Date(data.expires_at).getTime()
  const daysToExpiry = (expiresMs - now) / (1000 * 60 * 60 * 24)
  let status = 'valid', label = 'CURRENT & COMPLIANT', hint = `Cleaning is current. Next service due ${fmtDate(data.expires_at)}.`
  if (daysToExpiry < 0) { status = 'expired'; label = 'EXPIRED'; hint = `Cleaning was due ${fmtDate(data.expires_at)} (${Math.abs(Math.round(daysToExpiry))} days ago).` }
  else if (daysToExpiry < 14) { status = 'expiring'; label = 'EXPIRING SOON'; hint = `Cleaning due in ${Math.round(daysToExpiry)} days.` }

  const r = data.restaurant
  const c = data.cleaning

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-orange-300/80 font-semibold">Compliance Verification</div>
        <h1 className="text-3xl font-heading text-white mt-1">{r?.name}</h1>
        <div className="text-sm text-white/60 mt-1">{r?.address_line1} · {r?.city}, {r?.state} {r?.zip}</div>
      </div>

      <StatusBadge status={status} label={label} hint={hint} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Certificate Number</div>
          <div className="font-mono text-lg text-white mt-1">{data.cert_number}</div>
          <div className="text-xs text-white/50 mt-2">QR <span className="font-mono text-orange-300">{data.qr_code}</span></div>
          <div className="text-xs text-white/40 mt-1">{data.ansi_iks_refs?.[0] || 'ANSI/IKECA C10-2021'}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Service Window</div>
          <div className="text-sm text-white mt-1"><span className="text-white/40">Last cleaned:</span> {fmtDate(c?.completed_at || data.issued_at)}</div>
          <div className="text-sm text-white"><span className="text-white/40">Next due:</span> {fmtDate(data.expires_at)}</div>
          <div className="text-sm text-white"><span className="text-white/40">Frequency:</span> {(r?.frequency_tier || '').replace('_', '-')}</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-semibold text-white">Service Documentation</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3 text-sm">
          <div><div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Technician</div><div className="text-white mt-0.5">{c?.tech_name || '—'}</div></div>
          <div><div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Supervisor</div><div className="text-white mt-0.5">{c?.supervisor_name || '—'}</div></div>
          <div><div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Hood Count</div><div className="text-white mt-0.5">{r?.hood_count || '—'}</div></div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Grease Pre</div>
            <div className={`mt-0.5 ${c?.exceeded_threshold ? 'text-red-300' : 'text-white'}`}>{c?.grease_depth_pre_inches != null ? `${Number(c.grease_depth_pre_inches).toFixed(3)}"` : '—'}</div>
          </div>
          <div><div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Grease Post</div><div className="text-emerald-300/90 mt-0.5">{c?.grease_depth_post_inches != null ? `${Number(c.grease_depth_post_inches).toFixed(3)}"` : '—'}</div></div>
          <div><div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">NFPA Threshold</div><div className="text-white/60 mt-0.5">0.125"</div></div>
        </div>
        {c?.areas_not_accessible && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="text-[10px] uppercase tracking-wider text-amber-300/80 font-semibold">Areas Not Accessible</div>
            <div className="text-sm text-white/80 mt-1">{c.areas_not_accessible}</div>
          </div>
        )}
      </div>

      {r?.ahj?.name && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
          <div className="text-[10px] uppercase tracking-wider text-blue-300/80 font-semibold">Authority Having Jurisdiction</div>
          <div className="text-white mt-1">{r.ahj.name}{r.ahj.state ? ` · ${r.ahj.state}` : ''}</div>
          <div className="text-xs text-white/40 mt-1">This certificate has been issued for jurisdictional review.</div>
        </div>
      )}

      {data.pdf_url && (
        <div className="flex justify-center pt-2">
          <a href={data.pdf_url} target="_blank" rel="noopener noreferrer"
             className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-200 rounded-lg font-medium transition-colors">
            Download Full Certificate (PDF)
          </a>
        </div>
      )}

      <div className="rounded-lg border border-white/5 bg-black/20 p-4 text-[11px] text-white/40">
        Issued {fmtDateTime(data.issued_at)} · This compliance certificate is verified against the LABOS-KEC NFPA 96 ledger.
        Tampering with a posted sticker is a fire-code violation.
      </div>
    </div>
  )
}
