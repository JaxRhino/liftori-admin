import { useEffect, useState, useCallback } from 'react'
import { cscSupabase } from '../../lib/cscClient'

function StatusDot({ status }) {
  const color = status === 'OK' ? 'bg-emerald-400' : status === 'INFO' ? 'bg-blue-400' : status === 'WARN' ? 'bg-amber-400' : 'bg-red-400'
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />
}

export default function DemoTools() {
  const [signals, setSignals] = useState([])
  const [overall, setOverall] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [lastReset, setLastReset] = useState(null)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await cscSupabase.rpc('csc_demo_health_check')
      if (error) throw error
      setSignals(data || [])
      const ov = (data || []).find(s => s.signal === 'overall_demo_ready')
      setOverall(ov)
      setError(null)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 10000)
    return () => clearInterval(t)
  }, [refresh])

  async function fireReset() {
    if (confirmInput !== 'RESET') return
    setResetting(true)
    try {
      const { data, error } = await cscSupabase.rpc('csc_reset_demo_state')
      if (error) throw error
      setLastReset({ ts: new Date(), receipt: data || [] })
      setShowConfirm(false)
      setConfirmInput('')
      await refresh()
    } catch (e) {
      alert('Reset failed: ' + (e.message || e))
    } finally {
      setResetting(false)
    }
  }

  const isPristine = overall?.status === 'OK'
  const flagged = signals.filter(s => s.status === 'NEEDS RESET' || s.status === 'ACTION')

  return (
    <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-violet-300/80 font-semibold flex items-center gap-1.5">
            <span>Demo Tools</span>
            <span className="text-white/30">·</span>
            <span className="text-white/50">internal</span>
          </div>
          <div className="text-base font-medium text-white mt-1">
            Dane rehearsal state
          </div>
          <div className="text-xs text-white/50 mt-0.5">
            Live state of the in-progress Dunkin' #418 cleaning. Reset between rehearsals to keep each pass pristine.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-white/40">Checking…</span>
          ) : isPristine ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              PRISTINE — ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
              STALE · {flagged.length} signal{flagged.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          Health check error: {error}
        </div>
      )}

      {!loading && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {signals.filter(s => s.signal !== 'overall_demo_ready').map(s => (
            <div key={s.signal} className="flex items-center gap-2 px-2 py-1.5 rounded bg-black/20 border border-white/5">
              <StatusDot status={s.status} />
              <span className="text-white/40 truncate">{s.signal.replace(/_/g, ' ')}</span>
              <span className="ml-auto text-white/70 font-mono text-[10px] truncate">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        {!showConfirm ? (
          <button onClick={() => setShowConfirm(true)} disabled={resetting || isPristine}
                  className="px-4 py-2 rounded text-sm font-medium bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {isPristine ? 'Already pristine' : 'Reset demo state'}
          </button>
        ) : (
          <>
            <input autoFocus value={confirmInput} onChange={e => setConfirmInput(e.target.value)}
                   placeholder="Type RESET to confirm" onKeyDown={e => e.key === 'Enter' && fireReset()}
                   className="px-3 py-2 bg-black/30 border border-violet-500/40 rounded text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-400 w-56" />
            <button onClick={fireReset} disabled={confirmInput !== 'RESET' || resetting}
                    className="px-3 py-2 rounded text-sm font-medium bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 transition-colors disabled:opacity-40">
              {resetting ? 'Resetting…' : 'Confirm reset'}
            </button>
            <button onClick={() => { setShowConfirm(false); setConfirmInput('') }}
                    className="px-3 py-2 rounded text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white/60">
              Cancel
            </button>
          </>
        )}
        <button onClick={refresh} disabled={loading}
                className="px-3 py-2 rounded text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 disabled:opacity-40">
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {lastReset && (
        <div className="mt-4 text-xs">
          <div className="text-emerald-300/80 font-medium mb-1">
            ✓ Reset fired {lastReset.ts.toLocaleTimeString()}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-white/50">
            {lastReset.receipt.map((r, i) => (
              <div key={i} className="font-mono text-[10px] truncate">
                {r.action}: <span className="text-white/80">{r.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
