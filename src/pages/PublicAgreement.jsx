import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Public, no-auth agreement page. Customer reviews the contract and e-signs (typed signature).
// After the customer signs, Liftori countersigns from the admin to fully execute it.

export default function PublicAgreement() {
  const { token } = useParams()
  const [ag, setAg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [signing, setSigning] = useState(false)
  const [banner, setBanner] = useState(null)
  const [err, setErr] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_sales_agreement_by_token', { p_token: token })
    if (error || !data) { setNotFound(true); setLoading(false); return }
    setAg(data.agreement); setLoading(false)
  }, [token])
  useEffect(() => { load() }, [load])

  async function sign() {
    setErr(null)
    if (!name.trim()) { setErr('Please type your full name to sign.'); return }
    if (!agree) { setErr('Please check the box to agree.'); return }
    setSigning(true)
    try {
      const { data, error } = await supabase.rpc('sign_sales_agreement', { p_token: token, p_name: name.trim(), p_email: email.trim() || null, p_ip: null, p_user_agent: navigator.userAgent })
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'sign failed')
      await load()
      setBanner('Signed - thank you. Liftori will countersign to fully execute the agreement.')
    } catch (e) { setErr('Could not sign: ' + (e.message || 'error')) } finally { setSigning(false) }
  }

  if (loading) return <Shell><p className="py-20 text-center text-slate-500">Loading your agreement...</p></Shell>
  if (notFound) return <Shell><p className="py-20 text-center text-slate-500">This agreement link is invalid or has expired.</p></Shell>

  const signed = !!ag.signed_at || ['signed', 'countersigned'].includes(ag.status)
  const executed = !!ag.countersigned_at || ag.status === 'countersigned'

  return (
    <Shell>
      {banner && <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{banner}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-900 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold tracking-tight">LIFT<span className="text-sky-400">ORI</span></span>
            <span className="font-mono text-xs text-slate-300">{ag.agreement_number}</span>
          </div>
          <h1 className="mt-3 text-xl font-semibold">{ag.title}</h1>
          <p className="text-sm text-slate-300">Prepared for {ag.customer_name}{ag.valid_until ? ` - valid until ${new Date(ag.valid_until + 'T00:00:00').toLocaleDateString()}` : ''}</p>
        </div>
        <div className="max-h-[55vh] overflow-auto whitespace-pre-wrap p-6 text-[13px] leading-relaxed text-slate-700">{ag.body}</div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {executed ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">✓</div>
            <p className="font-semibold text-slate-900">Fully executed.</p>
            <p className="text-sm text-slate-500">Signed by {ag.signer_name}; countersigned by {ag.countersigner_name}.</p>
          </div>
        ) : signed ? (
          <div className="py-2 text-center">
            <p className="font-semibold text-slate-900">Signed - thank you.</p>
            <p className="text-sm text-slate-500">Signed by {ag.signer_name}. Liftori will countersign to fully execute this agreement.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-base font-semibold text-slate-900">Review &amp; sign</h2>
            <p className="mt-1 text-sm text-slate-500">Type your full name to sign. This is a legal electronic signature.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5" />
              <span>I have read and agree to this agreement, and I am authorized to sign on behalf of {ag.customer_name}.</span>
            </label>
            <button onClick={sign} disabled={signing} className="mt-4 w-full rounded-lg bg-slate-900 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{signing ? 'Signing...' : 'Sign agreement'}</button>
          </div>
        )}
        {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">Liftori, LLC - questions? Reply to the email this came from.</p>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  )
}
