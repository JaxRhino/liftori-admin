import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cscSupabase } from '../../lib/cscClient'

const SAMPLE_QR = '4BD68761BOFF'

function Stat({ value, label }) {
  return (
    <div>
      <div className="text-3xl font-heading text-orange-300">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/50 mt-1">{label}</div>
    </div>
  )
}

function Step({ num, title, body }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
        <span className="text-orange-300 font-bold">{num}</span>
      </div>
      <div>
        <div className="text-white font-medium">{title}</div>
        <div className="text-sm text-white/60 mt-1">{body}</div>
      </div>
    </div>
  )
}

export default function CscAhjLanding() {
  const [jurisdictions, setJurisdictions] = useState([])

  useEffect(() => {
    (async () => {
      const { data } = await cscSupabase
        .from('csc_ahj_jurisdictions')
        .select('id, name, state, city, slug')
        .order('state').order('name')
      setJurisdictions(data || [])
    })()
  }, [])

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/8 to-violet-500/5 p-8 md:p-12">
        <div className="text-xs uppercase tracking-wider text-orange-300/80 font-bold">For Authorities Having Jurisdiction</div>
        <h1 className="text-4xl md:text-5xl font-heading text-white mt-3 leading-tight">
          Scan a sticker.<br />
          See the cert.<br />
          <span className="text-orange-300">No login.</span>
        </h1>
        <p className="text-base md:text-lg text-white/70 mt-5 max-w-2xl">
          Every restaurant under contract with a CSC-KEC contractor wears a tamper-evident NFPA 96 sticker. Point your phone camera at the QR code and the cert opens in two seconds — full grease readings, last cleaned date, frequency tier, technician, AHJ jurisdiction.
        </p>
        <p className="text-sm text-white/50 mt-3 max-w-2xl">
          Free for fire marshals, code officials, and inspectors. No account, no app, no friction.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={`/csc/verify/${SAMPLE_QR}`} target="_blank" rel="noopener noreferrer"
             className="px-5 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-200 rounded-lg text-sm font-medium transition-colors">
            Try a sample verify →
          </a>
          <a href="#jurisdictions"
             className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg text-sm font-medium transition-colors">
            Open your jurisdiction portal
          </a>
        </div>
      </div>

      {/* Jurisdiction directory — the live portals */}
      <section id="jurisdictions">
        <h2 className="text-sm uppercase tracking-wider text-orange-300/80 font-bold mb-4">Jurisdiction compliance portals</h2>
        <p className="text-sm text-white/50 mb-5 max-w-2xl">
          Each portal lists every enrolled foodservice location in that jurisdiction with live NFPA 96 compliance status — current, expiring, or overdue. Free for AHJs, always.
        </p>
        {jurisdictions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">Loading jurisdictions…</div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {jurisdictions.map(j => (
              <Link key={j.id} to={`/csc/ahj/${j.slug}`}
                className="group rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-orange-500/30 p-4 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="text-white font-medium">{j.name}</div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">{j.state}</span>
                </div>
                <div className="text-xs text-white/40 mt-1">{j.city ? `${j.city}, ${j.state}` : j.state} · View compliance roster →</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* What you see when you scan */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-orange-300/80 font-bold mb-4">What you see when you scan</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Stat value="✓" label="Compliance status" />
            <div className="text-xs text-white/50 mt-3">Plain English: Current, Expiring Soon, Expired. No NFPA jargon required.</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Stat value="0.125" label="Grease threshold reading" />
            <div className="text-xs text-white/50 mt-3">Pre and post measurements with NFPA 96 §11.4 reference. Threshold violations flagged red.</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Stat value="6 mo" label="Frequency cycle" />
            <div className="text-xs text-white/50 mt-3">Monthly / Quarterly / Semi-annual / Annual per Table 11.4 cooking-volume class.</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Stat value="PDF" label="Full cert document" />
            <div className="text-xs text-white/50 mt-3">Downloadable AHJ-ready cert: tech, supervisor, manager signature, ANSI/IKECA C10 reference, photo evidence.</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-orange-300/80 font-bold mb-6">How it works</h2>
        <div className="space-y-5 max-w-2xl">
          <Step num="1" title="Scan the sticker" body="Open your phone camera. Point at the QR on the hood-mounted sticker. Cert page opens automatically — no login, no app install." />
          <Step num="2" title="Verify the record" body="See the cert number, issue date, next-due date, grease readings, frequency tier, technician name, manager signature. Color-coded compliance status at the top." />
          <Step num="3" title="Download or file" body="Tap to download the full PDF. Forward it to your records system, print it, or email it to insurance — same document the contractor filed with the cleaning." />
        </div>
      </section>

      {/* Why this is different */}
      <section className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-6 md:p-8">
        <h2 className="text-sm uppercase tracking-wider text-blue-300/80 font-bold mb-4">Why this matters for your jurisdiction</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm text-white/80">
          <div>
            <div className="text-white font-medium mb-2">Tampering becomes a fire-code violation.</div>
            <p className="text-white/60">Stickers are tamper-evident. Removing or replacing one is documented and queryable. Operators who skip cleanings can't fake the record — it's in the database, not in their filing cabinet.</p>
          </div>
          <div>
            <div className="text-white font-medium mb-2">Inspections take seconds, not minutes.</div>
            <p className="text-white/60">Walk into a restaurant. Look up. Scan. Done. The compliance question is answered before you finish your coffee. No paperwork to chase.</p>
          </div>
          <div>
            <div className="text-white font-medium mb-2">Defensible audit trail after a fire.</div>
            <p className="text-white/60">When NFPA 96 documentation matters most — post-incident investigation — every cleaning has a timestamped record with photos, grease readings, and tech attestation. Insurance carriers and fire marshals get the same trustworthy data.</p>
          </div>
          <div>
            <div className="text-white font-medium mb-2">Free, forever, for AHJs.</div>
            <p className="text-white/60">CSC-KEC contractors pay the platform fee. Fire marshals, code officials, and inspectors use it at no cost. Always. We don't monetize jurisdictional access.</p>
          </div>
        </div>
      </section>

      {/* Footnote */}
      <div className="rounded-lg border border-white/5 bg-black/20 p-4 text-[11px] text-white/40">
        Built in compliance with NFPA 96 (2024) and ANSI/IKECA C10-2021. The verify endpoint is read-only. We never share AHJ usage data with contractors. Tampering with a posted sticker is documented in the database and is a fire-code violation in every state we serve.
      </div>
    </div>
  )
}
