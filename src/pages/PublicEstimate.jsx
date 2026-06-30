import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Public, no-auth estimate page. Customer reviews the line items, signs (typed e-signature),
// then pays the 50% deposit via live Stripe Checkout. On return we verify payment server-side.

const usd = (n) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function PublicEstimate() {
  const { token } = useParams()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [signing, setSigning] = useState(false)
  const [paying, setPaying] = useState(false)
  const [banner, setBanner] = useState(null)
  const [err, setErr] = useState(null)

  const load = useCallback(async () => {
    const { data: res, error } = await supabase.rpc('get_sales_estimate_by_token', { p_token: token })
    if (error || !res) { setNotFound(true); setLoading(false); return }
    setData(res)
    if (res.estimate?.customer_name && !name) setName('')
    setLoading(false)
  }, [token]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  // Handle Stripe return
  useEffect(() => {
    const dep = params.get('deposit')
    if (!dep) return
    if (dep === 'cancelled') { setBanner({ kind: 'warn', msg: 'Deposit payment was cancelled. You can try again below.' }); cleanParams(); return }
    if (dep === 'success') {
      (async () => {
        const sid = params.get('sid')
        await supabase.functions.invoke('estimate-deposit-verify', { body: { token, sid } })
        await load()
        setBanner({ kind: 'ok', msg: 'Deposit received — thank you! We are kicking off your project.' })
        cleanParams()
      })()
    }
  }, [params]) // eslint-disable-line

  function cleanParams() { params.delete('deposit'); params.delete('sid'); setParams(params, { replace: true }) }

  async function sign() {
    setErr(null)
    if (!name.trim()) { setErr('Please type your full name to sign.'); return }
    if (!agree) { setErr('Please check the box to agree.'); return }
    setSigning(true)
    try {
      const { data: res, error } = await supabase.rpc('sign_sales_estimate', {
        p_token: token, p_name: name.trim(), p_email: email.trim() || null, p_ip: null,
        p_user_agent: navigator.userAgent, p_snapshot: snapshot(data),
      })
      if (error || !res?.ok) throw new Error(res?.error || error?.message || 'sign failed')
      await load()
      setBanner({ kind: 'ok', msg: 'Signed — thank you! Pay your 50% deposit below to get started.' })
    } catch (e) { setErr('Could not sign: ' + (e.message || 'error')) } finally { setSigning(false) }
  }

  async function payDeposit() {
    setErr(null); setPaying(true)
    try {
      const { data: res, error } = await supabase.functions.invoke('estimate-deposit-checkout', { body: { token } })
      if (error) throw new Error(error.message)
      if (res?.url) { window.location.href = res.url; return }
      if (res?.already) { await load(); return }
      throw new Error(res?.error || 'could not start checkout')
    } catch (e) { setErr('Could not start payment: ' + (e.message || 'error')); setPaying(false) }
  }

  if (loading) return <Shell><p className="text-center text-slate-500 py-20">Loading your estimate...</p></Shell>
  if (notFound) return <Shell><p className="text-center text-slate-500 py-20">This estimate link is invalid or has expired.</p></Shell>

  const e = data.estimate
  const items = data.items || []
  const onetime = items.filter(i => i.billing !== 'monthly').reduce((s, i) => s + Number(i.line_total || 0), 0)
  const monthly = items.filter(i => i.billing === 'monthly').reduce((s, i) => s + Number(i.line_total || 0), 0)
  const signed = !!e.signed_at || e.status === 'signed' || e.status === 'deposit_paid'
  const paid = !!e.deposit_paid_at || e.status === 'deposit_paid'

  return (
    <Shell>
      {banner && (
        <div className={`mb-5 rounded-lg px-4 py-3 text-sm ${banner.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>{banner.msg}</div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold tracking-tight">LIFT<span className="text-sky-400">ORI</span></span>
            <span className="text-xs text-slate-300 font-mono">{e.estimate_number}</span>
          </div>
          <h1 className="mt-3 text-xl font-semibold">{e.title || 'Your estimate'}</h1>
          <p className="text-sm text-slate-300">Prepared for {e.customer_name}{e.valid_until ? ` · valid until ${new Date(e.valid_until + 'T00:00:00').toLocaleDateString()}` : ''}</p>
        </div>

        <div className="p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2">Item</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Price</th><th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(i => (
                <tr key={i.id}>
                  <td className="py-2.5 text-slate-800">{i.name}{i.billing === 'monthly' && <span className="ml-1 text-xs text-slate-400">monthly</span>}</td>
                  <td className="py-2.5 text-right text-slate-600">{i.qty}</td>
                  <td className="py-2.5 text-right text-slate-600">{usd(i.unit_price)}</td>
                  <td className="py-2.5 text-right font-medium text-slate-900">{usd(i.line_total)}{i.billing === 'monthly' ? '/mo' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-600"><span>One-time total</span><span className="font-medium text-slate-900">{usd(onetime)}</span></div>
            {monthly > 0 && <div className="flex justify-between text-slate-600"><span>Monthly</span><span className="font-medium text-slate-900">{usd(monthly)}/mo</span></div>}
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base"><span className="font-semibold text-slate-900">50% deposit to start</span><span className="font-bold text-sky-600">{usd(e.deposit_amount)}</span></div>
          </div>

          {e.notes && <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{e.notes}</p>}
        </div>
      </div>

      {/* Sign + pay */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {paid ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-2xl">✓</div>
            <p className="font-semibold text-slate-900">Deposit paid — you're all set.</p>
            <p className="text-sm text-slate-500">Signed by {e.signer_name}. Our team will reach out to kick things off.</p>
          </div>
        ) : signed ? (
          <div>
            <p className="text-sm text-slate-600">Signed by <span className="font-medium text-slate-900">{e.signer_name}</span>. Pay your 50% deposit to get started.</p>
            <button onClick={payDeposit} disabled={paying} className="mt-4 w-full rounded-lg bg-sky-600 py-3 font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
              {paying ? 'Starting secure checkout...' : `Pay ${usd(e.deposit_amount)} deposit`}
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">Secure payment via Stripe.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-base font-semibold text-slate-900">Review &amp; sign</h2>
            <p className="mt-1 text-sm text-slate-500">Type your full name to accept this estimate. This is a legal electronic signature.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input value={name} onChange={e2 => setName(e2.target.value)} placeholder="Your full name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={email} onChange={e2 => setEmail(e2.target.value)} placeholder="Your email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={agree} onChange={e2 => setAgree(e2.target.checked)} className="mt-0.5" />
              <span>I agree to this estimate and authorize a 50% deposit of {usd(e.deposit_amount)} to begin work.</span>
            </label>
            <button onClick={sign} disabled={signing} className="mt-4 w-full rounded-lg bg-slate-900 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
              {signing ? 'Signing...' : 'Sign estimate'}
            </button>
          </div>
        )}
        {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">Liftori · questions? Reply to the email this came from.</p>
    </Shell>
  )
}

function snapshot(data) {
  try {
    const e = data.estimate, items = data.items || []
    const lines = items.map(i => `${i.qty} x ${i.name} @ ${i.unit_price}${i.billing === 'monthly' ? '/mo' : ''} = ${i.line_total}`).join('\n')
    return `${e.estimate_number} - ${e.title}\nCustomer: ${e.customer_name}\n${lines}\nDeposit: ${e.deposit_amount}`
  } catch { return null }
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  )
}
