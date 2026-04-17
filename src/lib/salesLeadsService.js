/**
 * salesLeadsService — Liftori's own sales pipeline (not to be confused with
 * customerService.js which powers LABOS tenants' own sales pipelines).
 *
 * Three products, each with its own stage set. Stages are free-form text in
 * the DB; the canonical list per product lives here and is what the UI uses
 * to lay out Kanban columns, validate moves, and compute conversion.
 */
import { supabase } from './supabase'

// ─── Product catalog ────────────────────────────────────────────────
export const PRODUCTS = {
  labos: {
    key: 'labos',
    label: 'LABOS',
    longLabel: 'Liftori AI Business OS',
    description: 'SaaS subscription — tiered plans with AI departments.',
    color: 'sky',
    icon: 'cpu',
    hasMRR: true,
    hasOneTime: false,
  },
  consulting: {
    key: 'consulting',
    label: 'Consulting',
    longLabel: 'Business Consulting',
    description: 'Consulting-as-a-service — tiered packages, 1099 network, leadership QC.',
    color: 'amber',
    icon: 'briefcase',
    hasMRR: true,    // retainer packages
    hasOneTime: true, // engagement fees
  },
  custom_build: {
    key: 'custom_build',
    label: 'Custom Builds',
    longLabel: 'Custom App / Platform Builds',
    description: 'One-off project builds — Starter / Growth / Scale tiers with milestone payments.',
    color: 'violet',
    icon: 'code',
    hasMRR: false,   // optional managed services added later
    hasOneTime: true,
  },
}

export const PRODUCT_KEYS = ['labos', 'consulting', 'custom_build']

// ─── Per-product stage configs ──────────────────────────────────────
// Each stage list ends with two closed stages: 'won' and 'lost' (stable keys
// so closed-state queries don't need product awareness). All preceding
// stages are active. Keep keys snake_case and stable — labels are display only.
export const STAGES = {
  labos: [
    { key: 'demo_requested', label: 'Demo Requested', color: 'slate' },
    { key: 'trial',          label: 'Trial / Demo',    color: 'blue' },
    { key: 'proposal',       label: 'Proposal Sent',   color: 'indigo' },
    { key: 'negotiation',    label: 'Negotiation',     color: 'amber' },
    { key: 'won',            label: 'Won',             color: 'emerald' },
    { key: 'lost',           label: 'Lost',            color: 'rose' },
  ],
  consulting: [
    { key: 'intro_call',     label: 'Intro Call',       color: 'slate' },
    { key: 'discovery',      label: 'Discovery',        color: 'blue' },
    { key: 'proposal',       label: 'Proposal Sent',    color: 'indigo' },
    { key: 'contract',       label: 'Contract Sent',    color: 'amber' },
    { key: 'won',            label: 'Won',              color: 'emerald' },
    { key: 'lost',           label: 'Lost',             color: 'rose' },
  ],
  custom_build: [
    { key: 'discovery',      label: 'Discovery',        color: 'slate' },
    { key: 'scoping',        label: 'Scoping',          color: 'blue' },
    { key: 'quote',          label: 'Quote Sent',       color: 'indigo' },
    { key: 'contract',       label: 'Contract Signed',  color: 'amber' },
    { key: 'won',            label: 'Won',              color: 'emerald' },
    { key: 'lost',           label: 'Lost',             color: 'rose' },
  ],
}

export const SOURCES = [
  'inbound',
  'outbound',
  'referral',
  'affiliate',
  'event',
  'waitlist',
  'other',
]

export function stagesFor(productType) {
  return STAGES[productType] || []
}

export function stageMetaFor(productType, stageKey) {
  const list = stagesFor(productType)
  return list.find((s) => s.key === stageKey) || { key: stageKey, label: stageKey, color: 'slate' }
}

export function isClosedStage(stage) {
  return stage === 'won' || stage === 'lost'
}

// ─── CRUD ────────────────────────────────────────────────────────────
function err(e, label) {
  console.error(`[salesLeadsService] ${label}:`, e)
  throw e
}

export async function listLeads({ productType, stage, assignedTo, includeClosed = true } = {}) {
  let q = supabase
    .from('sales_leads')
    .select('*, assignee:assigned_to (id, full_name, email, avatar_url)')
    .order('stage_changed_at', { ascending: false })
  if (productType) q = q.eq('product_type', productType)
  if (stage) q = q.eq('stage', stage)
  if (assignedTo) q = q.eq('assigned_to', assignedTo)
  if (!includeClosed) q = q.not('stage', 'in', '(won,lost)')
  const { data, error } = await q
  if (error) err(error, 'listLeads')
  return data || []
}

export async function getLead(id) {
  const { data, error } = await supabase
    .from('sales_leads')
    .select('*, assignee:assigned_to (id, full_name, email, avatar_url)')
    .eq('id', id)
    .single()
  if (error) err(error, 'getLead')
  return data
}

export async function createLead(payload, createdBy) {
  const insert = {
    product_type: payload.product_type,
    stage: payload.stage || stagesFor(payload.product_type)[0]?.key,
    title: payload.title,
    company_name: payload.company_name || null,
    contact_name: payload.contact_name || null,
    contact_email: payload.contact_email || null,
    contact_phone: payload.contact_phone || null,
    deal_value_cents: Math.round((Number(payload.deal_value) || 0) * 100),
    mrr_cents: Math.round((Number(payload.mrr) || 0) * 100),
    probability: payload.probability ?? 50,
    expected_close_date: payload.expected_close_date || null,
    source: payload.source || null,
    assigned_to: payload.assigned_to || null,
    next_action: payload.next_action || null,
    next_action_date: payload.next_action_date || null,
    description: payload.description || null,
    notes: payload.notes || null,
    tags: payload.tags || [],
    created_by: createdBy || null,
  }
  const { data, error } = await supabase
    .from('sales_leads')
    .insert(insert)
    .select('*, assignee:assigned_to (id, full_name, email, avatar_url)')
    .single()
  if (error) err(error, 'createLead')
  return data
}

export async function updateLead(id, patch) {
  const update = { ...patch }
  // Convert dollar amounts to cents if caller passed them
  if ('deal_value' in update) {
    update.deal_value_cents = Math.round((Number(update.deal_value) || 0) * 100)
    delete update.deal_value
  }
  if ('mrr' in update) {
    update.mrr_cents = Math.round((Number(update.mrr) || 0) * 100)
    delete update.mrr
  }
  const { data, error } = await supabase
    .from('sales_leads')
    .update(update)
    .eq('id', id)
    .select('*, assignee:assigned_to (id, full_name, email, avatar_url)')
    .single()
  if (error) err(error, 'updateLead')
  return data
}

export async function moveLeadStage(id, newStage, extra = {}) {
  const patch = { stage: newStage, ...extra }
  return updateLead(id, patch)
}

export async function deleteLead(id) {
  const { error } = await supabase.from('sales_leads').delete().eq('id', id)
  if (error) err(error, 'deleteLead')
}

// ─── Reporting helpers ──────────────────────────────────────────────
export function weightedValueCents(lead) {
  const oneTime = lead.deal_value_cents || 0
  const mrr = lead.mrr_cents || 0
  // Weighted = (one-time + 12mo of MRR) × probability (isClosed overrides to 100)
  const annualized = oneTime + mrr * 12
  const prob = isClosedStage(lead.stage) ? (lead.stage === 'won' ? 100 : 0) : (lead.probability ?? 0)
  return Math.round((annualized * prob) / 100)
}

export function formatMoney(cents) {
  const dollars = (cents || 0) / 100
  if (dollars >= 1000) return `$${Math.round(dollars).toLocaleString()}`
  return `$${dollars.toFixed(0)}`
}

export function summarize(leads) {
  const open = leads.filter((l) => !isClosedStage(l.stage))
  const won = leads.filter((l) => l.stage === 'won')
  const lost = leads.filter((l) => l.stage === 'lost')
  const openWeightedCents = open.reduce((sum, l) => sum + weightedValueCents(l), 0)
  const wonRevCents = won.reduce((sum, l) => sum + (l.deal_value_cents || 0) + (l.mrr_cents || 0) * 12, 0)
  const openPipelineCents = open.reduce((sum, l) => sum + (l.deal_value_cents || 0) + (l.mrr_cents || 0) * 12, 0)
  const closedCount = won.length + lost.length
  const winRate = closedCount > 0 ? Math.round((won.length / closedCount) * 100) : 0
  return {
    total: leads.length,
    openCount: open.length,
    wonCount: won.length,
    lostCount: lost.length,
    winRate,
    openWeightedCents,
    openPipelineCents,
    wonRevCents,
  }
}
