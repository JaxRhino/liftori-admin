// Shared customer value + pipeline helpers.
//
// Sales and delivery are ONE interleaved lifecycle for Liftori: dev/demo work often
// happens before the sale closes, so a single canonical pipeline (mirroring the
// Operations STATUS_PIPELINE in Projects.jsx) is used everywhere — product lines,
// the customer detail header, and the Customers list — instead of separate
// sales-stage / crm_stage vocabularies.

export const STAGE_PIPELINE = [
  'New Lead',
  'Waitlist',
  'Development',
  'Demo Ready',
  'Demo Scheduled',
  'Estimating',
  'Estimate Sent',
  'Pending Payment',
  'Onboarding Scheduled',
  'Buildout',
  'Active',
  'Payment Hold',
  'Lost',
]

// Stages from the win point onward (deal is closed/won and in delivery or live).
export const WON_STAGES = ['Onboarding Scheduled', 'Buildout', 'Active', 'Payment Hold']
// Stages that count as an active/live customer (drives the "Active" header tile).
export const ACTIVE_STAGES = ['Onboarding Scheduled', 'Buildout', 'Active', 'Payment Hold']

// Default win probability by stage. A manually-set probability on a line overrides this.
export const STAGE_PROBABILITY = {
  'New Lead': 10,
  'Waitlist': 10,
  'Development': 20,
  'Demo Ready': 35,
  'Demo Scheduled': 45,
  'Estimating': 55,
  'Estimate Sent': 65,
  'Pending Payment': 85,
  'Onboarding Scheduled': 100,
  'Buildout': 100,
  'Active': 100,
  'Payment Hold': 100,
  'Lost': 0,
}

export function isLost(item) {
  return item.stage === 'Lost' || !!item.lost_at
}

export function isWon(item) {
  // Tolerates legacy stage === 'Won' and the won_at timestamp.
  return WON_STAGES.includes(item.stage) || item.stage === 'Won' || !!item.won_at
}

export function isOpen(item) {
  return !isLost(item) && !isWon(item)
}

export function stageProbability(item) {
  if (item.probability !== null && item.probability !== undefined && item.probability !== '') {
    return Number(item.probability)
  }
  if (item.stage === 'Won') return 100
  return STAGE_PROBABILITY[item.stage] ?? 0
}

// Total Contract Value for a single line: one-time setup + recurring over the term.
// term defaults to 12 months when an MRR is set but the term is blank.
export function lineTcv(line) {
  const setup = Number(line.estimated_value) || 0
  const mrr = Number(line.mrr) || 0
  const term = Number(line.term_months) || (mrr > 0 ? 12 : 0)
  return setup + mrr * term
}

// Roll a customer's product lines into headline value metrics.
export function customerValue(lines = []) {
  const open = lines.filter(isOpen)
  const notLost = lines.filter((l) => !isLost(l))
  const projectedMrr = open.reduce((s, l) => s + (Number(l.mrr) || 0) * (stageProbability(l) / 100), 0)
  const projectedArr = projectedMrr * 12
  const activeMrr = lines.filter(isWon).reduce((s, l) => s + (Number(l.mrr) || 0), 0)
  const fullValue = notLost.reduce((s, l) => s + lineTcv(l), 0)
  return { projectedMrr, projectedArr, activeMrr, fullValue }
}

export function stageRank(stage) {
  return STAGE_PIPELINE.indexOf(stage)
}

// Furthest-along stage among a customer's lines, for the Customers list badge.
// Lost-only customers fall back to showing Lost.
export function currentStage(lines = []) {
  if (!lines.length) return null
  const live = lines.filter((l) => !isLost(l))
  const pool = live.length ? live : lines
  let best = null
  let bestRank = -2
  for (const l of pool) {
    const stage = l.stage === 'Won' ? 'Onboarding Scheduled' : l.stage
    const r = stageRank(stage)
    if (r > bestRank) {
      bestRank = r
      best = stage
    }
  }
  return best
}
