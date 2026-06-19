// Shared SALES + OPERATIONS pipeline model.
//
// Liftori runs a deal as TWO connected boards:
//   SALES  (customer_product_lines.stage): New Lead -> Qualified -> Demo / Mockup ->
//          Demo Ready -> Estimate Sent -> Agreement Signed -> Won  (Lost is terminal).
//   OPS    (projects.status):  New Project -> In Review -> Planning -> Development ->
//          Testing -> Demo Ready -> Onboarding -> Active  (On Hold / Lost terminal).
//
// Handoff (both directions):
//   * A sales line flagged "build" sits at "Demo / Mockup" and spawns a project at
//     "New Project" so Ops can build the demo/mockup.
//   * When that project reaches "Demo Ready", the sales line flips to "Demo Ready"
//     and the rep presents/closes it.
//   * When the sales line is "Won", the project advances to "Onboarding" (new tenant
//     + onboarding for products, or delivery for custom builds).
//
// Legacy data used a single interleaved vocabulary; the normalizers below map those
// old strings onto the split model so code is correct before AND after migration.

// -- SALES board ----------------------------------------------------------------
export const SALES_STAGES = [
  'New Lead',
  'Qualified',
  'Demo / Mockup',
  'Demo Ready',
  'Estimate Sent',
  'Agreement Signed',
  'Won',
  'Lost',
]
// Open = not Won, not Lost.
export const SALES_OPEN = ['New Lead', 'Qualified', 'Demo / Mockup', 'Demo Ready', 'Estimate Sent', 'Agreement Signed']

export const SALES_STAGE_PROBABILITY = {
  'New Lead': 10,
  'Qualified': 25,
  'Demo / Mockup': 40,
  'Demo Ready': 55,
  'Estimate Sent': 70,
  'Agreement Signed': 90,
  'Won': 100,
  'Lost': 0,
}

// Tailwind classes per sales stage (no purple/indigo per brand rules).
export const SALES_STAGE_COLORS = {
  'New Lead':         { dot: 'bg-sky-400',     bg: 'bg-sky-500/15',     text: 'text-sky-300' },
  'Qualified':        { dot: 'bg-cyan-400',    bg: 'bg-cyan-500/15',    text: 'text-cyan-300' },
  'Demo / Mockup':    { dot: 'bg-blue-400',    bg: 'bg-blue-500/15',    text: 'text-blue-300' },
  'Demo Ready':       { dot: 'bg-teal-400',    bg: 'bg-teal-500/15',    text: 'text-teal-300' },
  'Estimate Sent':    { dot: 'bg-amber-400',   bg: 'bg-amber-500/15',   text: 'text-amber-300' },
  'Agreement Signed': { dot: 'bg-lime-400',    bg: 'bg-lime-500/15',    text: 'text-lime-300' },
  'Won':              { dot: 'bg-emerald-400', bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  'Lost':             { dot: 'bg-rose-400',    bg: 'bg-rose-500/15',    text: 'text-rose-300' },
}

// Fulfillment path on a sales line: sell an existing product (demo) vs needs a build.
export const FULFILLMENT_PATHS = ['demo', 'build']

// -- OPERATIONS board -----------------------------------------------------------
export const OPS_STAGES = [
  'New Project',
  'In Review',
  'Planning',
  'Development',
  'Testing',
  'Demo Ready',
  'Onboarding',
  'Active',
]
export const OPS_TERMINAL = ['On Hold', 'Lost']
export const OPS_ALL = [...OPS_STAGES, ...OPS_TERMINAL]
// Build phase precedes the demo hand-back to sales.
export const OPS_BUILD_PHASE = ['New Project', 'In Review', 'Planning', 'Development', 'Testing']
// Delivery phase after the sale closes (Won).
export const OPS_DELIVERY = ['Onboarding', 'Active']

export const OPS_STAGE_COLORS = {
  'New Project':  { bg: 'bg-sky-500/20',     text: 'text-sky-400',     dot: 'bg-sky-400',     ring: 'ring-sky-500/40' },
  'In Review':    { bg: 'bg-cyan-500/20',    text: 'text-cyan-400',    dot: 'bg-cyan-400',    ring: 'ring-cyan-500/40' },
  'Planning':     { bg: 'bg-blue-500/20',    text: 'text-blue-400',    dot: 'bg-blue-400',    ring: 'ring-blue-500/40' },
  'Development':  { bg: 'bg-brand-blue/20',  text: 'text-brand-blue',  dot: 'bg-brand-blue',  ring: 'ring-brand-blue/40' },
  'Testing':      { bg: 'bg-amber-500/20',   text: 'text-amber-400',   dot: 'bg-amber-400',   ring: 'ring-amber-500/40' },
  'Demo Ready':   { bg: 'bg-teal-500/20',    text: 'text-teal-400',    dot: 'bg-teal-400',    ring: 'ring-teal-500/40' },
  'Onboarding':   { bg: 'bg-lime-500/20',    text: 'text-lime-400',    dot: 'bg-lime-400',    ring: 'ring-lime-500/40' },
  'Active':       { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400', ring: 'ring-emerald-500/40' },
  'On Hold':      { bg: 'bg-gray-500/20',    text: 'text-gray-400',    dot: 'bg-gray-500',    ring: 'ring-gray-600/40' },
  'Lost':         { bg: 'bg-rose-500/20',    text: 'text-rose-400',    dot: 'bg-rose-400',    ring: 'ring-rose-500/40' },
}

// Next stage for one-click advance on the ops board.
export const OPS_NEXT = {
  'New Project': 'In Review',
  'In Review': 'Planning',
  'Planning': 'Development',
  'Development': 'Testing',
  'Testing': 'Demo Ready',
  'Demo Ready': 'Onboarding',
  'Onboarding': 'Active',
}

// -- Normalizers (legacy interleaved vocab -> split model) ----------------------
const LEGACY_TO_SALES = {
  'New Lead': 'New Lead', 'Contacted': 'Qualified', 'Waitlist': 'Qualified', 'Qualified': 'Qualified',
  'Proposal': 'Estimate Sent', 'Negotiation': 'Agreement Signed',
  'Development': 'Demo / Mockup', 'Demo Ready': 'Demo Ready', 'Demo Scheduled': 'Demo Ready',
  'Estimating': 'Estimate Sent', 'Estimate Sent': 'Estimate Sent', 'Pending Payment': 'Agreement Signed',
  'Onboarding Scheduled': 'Won', 'Onboarding': 'Won', 'Buildout': 'Won', 'Active': 'Won', 'Payment Hold': 'Won',
  'Won': 'Won', 'Lost': 'Lost', 'Cancelled': 'Lost',
}
export function normalizeSalesStage(stage) {
  if (SALES_STAGES.includes(stage)) return stage
  return LEGACY_TO_SALES[stage] || 'New Lead'
}

const LEGACY_TO_OPS = {
  'New Lead': 'New Project', 'Waitlist': 'New Project', 'New Project': 'New Project',
  'In Review': 'In Review', 'Brief Review': 'In Review', 'Planning': 'Planning',
  'Development': 'Development', 'In Build': 'Development', 'Testing': 'Testing',
  'Demo Ready': 'Demo Ready', 'Demo Scheduled': 'Demo Ready',
  'Estimating': 'Demo Ready', 'Estimate Sent': 'Demo Ready', 'Pending Payment': 'Demo Ready',
  'Onboarding Scheduled': 'Onboarding', 'Onboarding': 'Onboarding', 'Buildout': 'Onboarding',
  'Active': 'Active', 'Launched': 'Active', 'Payment Hold': 'Active',
  'On Hold': 'On Hold', 'Cancelled': 'Lost', 'Lost': 'Lost',
}
export function normalizeOpsStage(status) {
  if (OPS_ALL.includes(status)) return status
  return LEGACY_TO_OPS[status] || 'New Project'
}

// -- Handoff mappers ------------------------------------------------------------
// Sales line change -> what status the linked project should take (null = leave it).
export function salesToOps(salesStage) {
  const s = normalizeSalesStage(salesStage)
  if (s === 'Won') return 'Onboarding'
  if (s === 'Lost') return 'Lost'
  return null // build-phase project owns its own status
}
// Project status change -> what stage the linked sales line should take (null = leave it).
export function opsToSales(opsStatus) {
  const s = normalizeOpsStage(opsStatus)
  if (s === 'Demo Ready') return 'Demo Ready'
  if (OPS_DELIVERY.includes(s)) return 'Won'
  if (s === 'Lost') return 'Lost'
  return null // build-phase statuses don't move the sales line (it sits at Demo / Mockup)
}

// -- Sales-line predicates (normalized) -----------------------------------------
export function isLost(item) {
  return normalizeSalesStage(item.stage) === 'Lost' || (!!item.lost_at && !item.won_at)
}
export function isWon(item) {
  return normalizeSalesStage(item.stage) === 'Won' || (!!item.won_at && !item.lost_at)
}
export function isOpen(item) {
  return !isLost(item) && !isWon(item)
}

export function stageProbability(item) {
  if (item.probability !== null && item.probability !== undefined && item.probability !== '') {
    return Number(item.probability)
  }
  return SALES_STAGE_PROBABILITY[normalizeSalesStage(item.stage)] ?? 0
}

// Total Contract Value: one-time setup + recurring over the term (defaults 12mo if MRR set).
export function lineTcv(line) {
  const setup = Number(line.estimated_value) || 0
  const mrr = Number(line.mrr) || 0
  const term = Number(line.term_months) || (mrr > 0 ? 12 : 0)
  return setup + mrr * term
}

export function customerValue(lines = []) {
  const open = lines.filter(isOpen)
  const notLost = lines.filter((l) => !isLost(l))
  const mrr = notLost.reduce((s, l) => s + (Number(l.mrr) || 0), 0)
  const arr = mrr * 12
  const openMrr = open.reduce((s, l) => s + (Number(l.mrr) || 0), 0)
  const projectedMrr = open.reduce((s, l) => s + (Number(l.mrr) || 0) * (stageProbability(l) / 100), 0)
  const projectedArr = projectedMrr * 12
  const activeMrr = lines.filter(isWon).reduce((s, l) => s + (Number(l.mrr) || 0), 0)
  const fullValue = notLost.reduce((s, l) => s + lineTcv(l), 0)
  return { mrr, arr, openMrr, projectedMrr, projectedArr, activeMrr, fullValue }
}

export function hasActiveProduct(lines = []) {
  return lines.some((l) => !isLost(l))
}

export function stageRank(stage) {
  return SALES_STAGES.indexOf(normalizeSalesStage(stage))
}

// Furthest-along sales stage among a customer's lines (Customers list badge).
export function currentStage(lines = []) {
  if (!lines.length) return null
  const live = lines.filter((l) => !isLost(l))
  const pool = live.length ? live : lines
  let best = null
  let bestRank = -2
  for (const l of pool) {
    const s = normalizeSalesStage(l.stage)
    const r = stageRank(s)
    if (r > bestRank) { bestRank = r; best = s }
  }
  return best
}

// -- Backward-compatible aliases (legacy import names) --------------------------
export const STAGE_PIPELINE = SALES_STAGES
export const WON_STAGES = ['Won']
export const ACTIVE_STAGES = ['Won']
export const STAGE_PROBABILITY = SALES_STAGE_PROBABILITY
