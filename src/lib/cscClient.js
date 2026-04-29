// =====================================================================
// CSC Services LABOS-KEC client
// Demo phase: csc_* tables on VJ's Supabase (zymgttmngwxkobmdgdia).
// Migrate to dedicated liftori-csc-labos project once Pro greenlit;
// only this file changes.
// =====================================================================
import { createClient } from '@supabase/supabase-js'

const CSC_URL = import.meta.env.VITE_CSC_SUPABASE_URL || 'https://zymgttmngwxkobmdgdia.supabase.co'
const CSC_ANON = import.meta.env.VITE_CSC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bWd0dG1uZ3d4a29ibWRnZGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzcxMDMsImV4cCI6MjA5MjI1MzEwM30.rhfz_Io8k1-LzwVIOWjw119G919yqpJLFnLcF7sid9I'

export const cscSupabase = createClient(CSC_URL, CSC_ANON, {
  auth: { storageKey: 'csc-labos-kec', persistSession: true, autoRefreshToken: true },
})

export const FREQUENCY_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', semi_annual: 'Semi-annual', annual: 'Annual' }
export const COOKING_VOLUME_LABELS = { solid_fuel: 'Solid fuel', high_volume: 'High volume', moderate_volume: 'Moderate volume', low_volume: 'Low volume' }
export const SEVERITY_TONES = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/40',
  major: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  minor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  observation: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
}
export const QUOTE_STATUS_TONES = {
  open: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  quoted: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  declined: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
  completed: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  expired: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
}
export const INVOICE_STATUS_TONES = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  sent: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  viewed: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  partial: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  paid: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  overdue: 'bg-red-500/20 text-red-300 border-red-500/40',
  void: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
}
export const CLEANING_STATUS_TONES = {
  scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  en_route: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  in_progress: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  missed: 'bg-red-500/20 text-red-300 border-red-500/40',
  cancelled: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
}

export function fmtMoney(amt) {
  if (amt == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt)
}
export function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export function fmtDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
export function relTime(ts) {
  if (!ts) return '—'
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 0) {
    const fwd = Math.abs(diff)
    if (fwd < 86400) return `in ${Math.round(fwd / 3600)}h`
    return `in ${Math.round(fwd / 86400)}d`
  }
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
