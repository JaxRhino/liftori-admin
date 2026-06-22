// Estimate engine — auto-populates an estimate from a customer's wizard answers.
// Pure: given a flow_type, the collected answers (keyed by field key), and the
// estimate_pricing rows, it returns line items + monthly / one-time totals.

const SHORT = (label) => (label || '').replace(/\s*\(.*?\)\s*$/, '').replace(/\s*—.*$/, '').trim() || label

export function parseMoney(text) {
  if (!text) return null
  const nums = String(text).replace(/,/g, '').match(/\d+(\.\d+)?/g)
  if (!nums) return null
  const vals = nums.map(Number)
  return { low: vals[0], high: vals[1] || vals[0] }
}

export function computeEstimate(flowType, answers = {}, pricing = []) {
  const rows = pricing.filter((p) => p.scope === flowType && p.active !== false)
  const items = []
  let monthly = 0
  let oneTime = 0
  const add = (label, price, billing) => {
    const amt = Number(price) || 0
    if (billing === 'monthly') monthly += amt
    else if (billing === 'one_time') oneTime += amt
    items.push({ label, price: amt, billing })
  }

  if (flowType === 'crm') {
    const base = rows.find((r) => r.item_key === 'crm_base')
    if (base) add('CRM (base)', base.price, base.billing)
    const selected = Array.isArray(answers.add_ons) ? answers.add_ons : []
    rows
      .filter((r) => r.category === 'addon')
      .forEach((r) => { if (selected.includes(r.label)) add(SHORT(r.label), r.price, r.billing) })
  } else if (flowType === 'bolo') {
    const r = rows.find((rr) => rr.category === 'base' && rr.label === answers.plan)
    if (r) add(SHORT(r.label), r.price, r.billing)
  } else if (flowType === 'consulting') {
    const r = rows.find((rr) => rr.category === 'engagement' && rr.label === answers.engagement)
    if (r) add(r.label, r.price, r.billing)
  } else if (flowType === 'branding') {
    const base = rows.find((r) => r.item_key === 'branding_base')
    if (base) add('Branding & Logo', base.price, base.billing)
  } else if (['custom_build', 'website', 'online_store', 'book'].includes(flowType)) {
    const range = parseMoney(answers.budget)
    if (range) add('Estimated build (' + (answers.budget || '') + ')', range.low, 'one_time')
  }

  const quote = items.length === 0 || ['formation', 'insurance', 'marketing'].includes(flowType)
  return { items, monthly, oneTime, quote }
}

export function formatUSD(n) {
  return '$' + Number(n || 0).toLocaleString('en-US')
}
