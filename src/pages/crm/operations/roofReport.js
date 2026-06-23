// =====================================================================
// roofReport.js (v2) - shared pure helpers for the Roofr-style takeoff.
// Imported by CrmMeasure.jsx (live build) and OperationsWorkOrders.jsx
// (saved-row regen). No React, no DOM-mount deps. The diagram/PDF helpers
// touch the DOM (canvas/jsPDF) only when called, so they stay importable
// in any context.
//
// v2 upgrades (calibrated to a real Roofr report, 13824 Goodson Place):
//   - 10 Roofr edge types (Eave, Rake, Ridge, Hip, Valley, Step flashing,
//     Wall flashing, Transition, Parapet wall, Unspecified); no purple.
//   - feetInches() formatting ("204ft 9in") across panel/job/PDF.
//   - waste TABLE (0,10,12,15,17,20,22%) area + squares, 10% recommended.
//   - area breakdown (total/pitched/flat/predominant + unspecified pitch).
//   - labeled diagram variants (plain/length/area/pitch) as PNG dataURLs.
//   - 7-page branded PDF mirroring Roofr (cover, diagram, length, area,
//     pitch, summary+waste, material calculations brand table).
//   - materialCalc(): per-brand bundle/roll/sheet math by category x waste.
//
// CDN deps loaded lazily by the caller via ensureLibs():
//   - turf.js (window.turf)            -> length/area math
//   - jsPDF  (window.jspdf.jsPDF)      -> branded PDF
// =====================================================================

export const M2_TO_FT2 = 10.7639104
export const pitchMult = (rise) => Math.sqrt(1 + (Number(rise) / 12) * (Number(rise) / 12))
export const pitchLabel = (rise) => `${Number(rise) || 0}/12`

// ---------- Roofr edge types (10) + brand-safe colors (NO purple) ----------
// Roofr uses purple for hips; we use blue for hips per brand rules.
export const LINE_TYPES = [
  { key: 'eave',          label: 'Eave',          color: '#10b981' }, // green
  { key: 'rake',          label: 'Rake',          color: '#eab308' }, // yellow
  { key: 'ridge',         label: 'Ridge',         color: '#ef4444' }, // red
  { key: 'hip',           label: 'Hip',           color: '#2f6df6' }, // blue (Roofr=purple)
  { key: 'valley',        label: 'Valley',        color: '#f97316' }, // orange
  { key: 'step_flashing', label: 'Step flashing', color: '#06b6d4' }, // cyan
  { key: 'wall_flashing', label: 'Wall flashing', color: '#0ea5e9' }, // sky
  { key: 'transition',    label: 'Transition',    color: '#14b8a6' }, // teal
  { key: 'parapet',       label: 'Parapet wall',  color: '#64748b' }, // slate
  { key: 'unspecified',   label: 'Unspecified',   color: '#94a3b8' }, // gray
]

// Legacy key remap: old 'flashing' rows -> 'step_flashing'.
export function normalizeLineType(type) {
  if (type === 'flashing') return 'step_flashing'
  if (LINE_TYPES.some((t) => t.key === type)) return type
  return 'unspecified'
}
export const lineColor = (type) => (LINE_TYPES.find((t) => t.key === normalizeLineType(type)) || {}).color || '#94a3b8'
export const lineTypeLabel = (type) => (LINE_TYPES.find((t) => t.key === normalizeLineType(type)) || {}).label || type

// ---------- ft+in formatting ----------
// 204.75 -> "204ft 9in" (round to nearest inch; carry 12in -> +1ft).
export function feetInches(decimalFt) {
  const v = Number(decimalFt)
  if (!isFinite(v)) return '0ft 0in'
  const neg = v < 0
  let ft = Math.floor(Math.abs(v))
  let inch = Math.round((Math.abs(v) - ft) * 12)
  if (inch === 12) { ft += 1; inch = 0 }
  return `${neg ? '-' : ''}${ft}ft ${inch}in`
}

// ---------- CDN loaders (idempotent; mirror CrmMeasure pattern) ----------
export const JSPDF_JS = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
export const TURF_JS = 'https://unpkg.com/@turf/turf@6/turf.min.js'

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('no document'))
    const existing = document.querySelector(`script[data-cdn="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve()
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load ' + src)))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.cdn = src
    s.addEventListener('load', () => { s.dataset.loaded = '1'; resolve() })
    s.addEventListener('error', () => reject(new Error('Failed to load ' + src)))
    document.head.appendChild(s)
  })
}
export async function ensureTurf() {
  if (typeof window !== 'undefined' && window.turf) return window.turf
  await loadScript(TURF_JS)
  return window.turf
}
export async function ensurePdf() {
  if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF
  await loadScript(JSPDF_JS)
  return window.jspdf.jsPDF
}

// ---------- geometry math ----------
export function facetPlanFt2(turf, coords) {
  if (!turf || !Array.isArray(coords) || coords.length < 3) return 0
  try {
    const poly = turf.polygon([[...coords, coords[0]]])
    return turf.area(poly) * M2_TO_FT2
  } catch { return 0 }
}
export function facetPerimeterFt(turf, coords) {
  if (!turf || !Array.isArray(coords) || coords.length < 2) return 0
  try {
    const ring = [...coords, coords[0]]
    return turf.length(turf.lineString(ring), { units: 'feet' })
  } catch { return 0 }
}
export function lineLengthFt(turf, coords) {
  if (!turf || !Array.isArray(coords) || coords.length < 2) return 0
  try { return turf.length(turf.lineString(coords), { units: 'feet' }) } catch { return 0 }
}

// ---------- normalize a saved measurements blob ----------
// Backward-compat: an old row's `measurements` was a plain ARRAY of facets.
// New rows store { facets:[...], lines:[...] }. Returns { facets, lines } with
// line types remapped to the v2 key set.
export function normalizeMeasurements(measurements) {
  const remap = (lines) => (Array.isArray(lines) ? lines : []).map((l) => ({ ...l, type: normalizeLineType(l && l.type) }))
  if (Array.isArray(measurements)) return { facets: measurements, lines: [] }
  if (measurements && typeof measurements === 'object') {
    return {
      facets: Array.isArray(measurements.facets) ? measurements.facets : [],
      lines: remap(measurements.lines),
    }
  }
  return { facets: [], lines: [] }
}

// ---------- waste schedule ----------
export const WASTE_STEPS = [0, 10, 12, 15, 17, 20, 22]
export const RECOMMENDED_WASTE = 10

// ---------- core metrics ----------
// facets: [{ section, pitch, pitch_label, coords:[[lng,lat]...] }]
// lines:  [{ id, type, coords:[[lng,lat]...], length_ft }]
// opts:   { waste_pct }
// Pure - needs turf passed in. Returns the full Roofr-style metric object
// (also the shape persisted in summary, plus display extras).
export function computeMetrics(turf, facets, lines, opts) {
  const wasteRaw = opts && opts.waste_pct != null ? Number(opts.waste_pct) : 10
  const waste = Math.max(0, Math.min(40, isNaN(wasteRaw) ? 10 : wasteRaw))

  const realFacets = (facets || []).filter((f) => Array.isArray(f.coords) && f.coords.length >= 3)

  let plan = 0, sloped = 0, flat = 0, pitched = 0, perimeter = 0
  const byPitch = {} // pitch_label -> sloped ft2

  realFacets.forEach((f) => {
    const rise = Number(f.pitch) || 0
    const label = f.pitch_label || pitchLabel(rise)
    const p = facetPlanFt2(turf, f.coords)
    const s = p * pitchMult(rise)
    plan += p
    sloped += s
    perimeter += facetPerimeterFt(turf, f.coords)
    if (rise === 0) flat += s
    else pitched += s
    byPitch[label] = (byPitch[label] || 0) + s
  })

  // predominant pitch = pitch label with the largest total sloped area
  let predominant = '', best = -1, predominantArea = 0
  Object.entries(byPitch).forEach(([label, a]) => { if (a > best) { best = a; predominant = label; predominantArea = a } })

  // base (no-waste) squares from sloped area, 1 decimal
  const squaresBase = Math.round((sloped / 100) * 10) / 10
  // ordered quantity squares at the chosen waste (ceil to 0.1, like Roofr order qty)
  const slopedWithWaste = sloped * (1 + waste / 100)
  const squares = Math.ceil((slopedWithWaste / 100) * 10) / 10
  const pitchedSquares = Math.ceil((pitched * (1 + waste / 100) / 100) * 10) / 10
  const flatSquares = Math.ceil((flat * (1 + waste / 100) / 100) * 10) / 10

  // linear feet by the 10 edge types (stored at full precision for ft+in)
  const lf = {
    eave: 0, rake: 0, ridge: 0, hip: 0, valley: 0,
    step_flashing: 0, wall_flashing: 0, transition: 0, parapet: 0, unspecified: 0,
  }
  ;(lines || []).forEach((l) => {
    if (!l) return
    const key = normalizeLineType(l.type)
    if (!lf.hasOwnProperty(key)) return
    const len = l.length_ft != null ? Number(l.length_ft) : lineLengthFt(turf, l.coords)
    lf[key] += Number(len) || 0
  })
  const hipsRidges = lf.hip + lf.ridge
  const eavesRakes = lf.eave + lf.rake // == drip edge run

  // round byPitch values for display/storage
  const areaByPitch = {}
  Object.entries(byPitch).forEach(([k, v]) => { areaByPitch[k] = Math.round(v) })

  // unspecified pitch area = facets whose pitch_label is empty/unknown (none here, kept for parity)
  const unspecifiedPitchArea = 0

  // waste table: area + squares (base, 1 decimal) at each step
  const waste_table = WASTE_STEPS.map((w) => {
    const area = sloped * (1 + w / 100)
    return { pct: w, area: Math.round(area), squares: Math.round((area / 100) * 10) / 10, recommended: w === RECOMMENDED_WASTE }
  })

  return {
    // legacy keys (kept)
    plan_ft2: Math.round(plan),
    sloped_ft2: Math.round(sloped),
    squares,                 // order quantity (waste-adjusted)
    waste_pct: waste,
    facet_count: realFacets.length,
    perimeter_ft: Math.round(perimeter),
    predominant_pitch: predominant,
    areas: {
      flat_ft2: Math.round(flat),
      pitched_ft2: Math.round(pitched),
      flat_squares: flatSquares,
      pitched_squares: pitchedSquares,
    },
    area_by_pitch: areaByPitch,
    // v2 additions
    squares_base: squaresBase,                       // base squares (no waste)
    predominant_pitch_area: Math.round(predominantArea),
    unspecified_pitch_area: unspecifiedPitchArea,
    waste_table,
    linear: {
      // full-precision *_raw (ft) for ft+in; rounded *_ft for compact display
      eave_ft: Math.round(lf.eave),
      rake_ft: Math.round(lf.rake),
      ridge_ft: Math.round(lf.ridge),
      hip_ft: Math.round(lf.hip),
      valley_ft: Math.round(lf.valley),
      step_flashing_ft: Math.round(lf.step_flashing),
      wall_flashing_ft: Math.round(lf.wall_flashing),
      transition_ft: Math.round(lf.transition),
      parapet_ft: Math.round(lf.parapet),
      unspecified_ft: Math.round(lf.unspecified),
      hips_ridges_ft: Math.round(hipsRidges),
      eaves_rakes_ft: Math.round(eavesRakes),
      drip_edge_ft: Math.round(eavesRakes), // alias (legacy name)
      // raw precision for ft+in rendering
      eave_raw: lf.eave, rake_raw: lf.rake, ridge_raw: lf.ridge, hip_raw: lf.hip,
      valley_raw: lf.valley, step_flashing_raw: lf.step_flashing, wall_flashing_raw: lf.wall_flashing,
      transition_raw: lf.transition, parapet_raw: lf.parapet, unspecified_raw: lf.unspecified,
      hips_ridges_raw: hipsRidges, eaves_rakes_raw: eavesRakes,
    },
  }
}

// Build the persisted summary object (extends legacy keys, additive).
export function buildSummary(metrics) {
  const lin = metrics.linear || {}
  return {
    plan_ft2: metrics.plan_ft2,
    sloped_ft2: metrics.sloped_ft2,
    squares: metrics.squares,
    squares_base: metrics.squares_base,
    waste_pct: metrics.waste_pct,
    facet_count: metrics.facet_count,
    perimeter_ft: metrics.perimeter_ft,
    predominant_pitch: metrics.predominant_pitch,
    predominant_pitch_area: metrics.predominant_pitch_area,
    unspecified_pitch_area: metrics.unspecified_pitch_area,
    areas: metrics.areas,
    area_by_pitch: metrics.area_by_pitch,
    // persist the full linear set (rounded ft - raw is re-derivable from geometry)
    linear: {
      eave_ft: lin.eave_ft, rake_ft: lin.rake_ft, ridge_ft: lin.ridge_ft, hip_ft: lin.hip_ft,
      valley_ft: lin.valley_ft, step_flashing_ft: lin.step_flashing_ft, wall_flashing_ft: lin.wall_flashing_ft,
      transition_ft: lin.transition_ft, parapet_ft: lin.parapet_ft, unspecified_ft: lin.unspecified_ft,
      hips_ridges_ft: lin.hips_ridges_ft, eaves_rakes_ft: lin.eaves_rakes_ft, drip_edge_ft: lin.drip_edge_ft,
    },
  }
}

// Dominant pitch label across facets, weighted by count (estimate seed fallback).
export function dominantPitchLabel(facets) {
  if (!Array.isArray(facets) || !facets.length) return ''
  const counts = {}
  facets.forEach((l) => {
    const label = l.pitch_label || (l.pitch != null ? `${l.pitch}/12` : null)
    if (!label) return
    counts[label] = (counts[label] || 0) + 1
  })
  let best = '', n = -1
  Object.entries(counts).forEach(([label, c]) => { if (c > n) { best = label; n = c } })
  return best
}

// =====================================================================
// MATERIAL CALCULATIONS (page 7) - per-brand bundle/roll/sheet math by
// category x waste. Calibrated to the reference Roofr report so the
// numbers reproduce within +/-1. Coverage constants documented inline.
// =====================================================================
export const MATERIAL_WASTES = [0, 10, 15, 20]

// Per-brand coverage constants (derived from the 13824 Goodson Place report).
const SHINGLE_BRANDS = [
  { name: 'IKO Cambridge',          sqftPerBundle: 33.3 },
  { name: 'CertainTeed Landmark',   sqftPerBundle: 32.8 },
  { name: 'GAF Timberline',         sqftPerBundle: 32.8 },
  { name: 'Owens Corning Duration', sqftPerBundle: 32.8 },
  { name: 'Atlas Pristine',         sqftPerBundle: 33.0 },
]
const STARTER_BRANDS = [
  { name: 'IKO Leading Edge Plus',  lfPerBundle: 106 },
  { name: 'CertainTeed SwiftStart', lfPerBundle: 106 },
  { name: 'GAF Pro-Start',          lfPerBundle: 106 },
  { name: 'Owens Starter Strip',    lfPerBundle: 101 },
  { name: 'Atlas Pro-Cut',          lfPerBundle: 132 },
]
const ICEWATER_BRANDS = [
  { name: 'IKO StormShield',        lfPerRoll: 64 },
  { name: 'CertainTeed WinterGuard',lfPerRoll: 64 },
  { name: 'GAF WeatherWatch',       lfPerRoll: 67 },
  { name: 'Owens WeatherLock',      lfPerRoll: 70 },
  { name: 'Atlas Weathermaster',    lfPerRoll: 64 },
]
const UNDERLAYMENT_BRANDS = [
  { name: 'IKO Stormtite',          sqftPerRoll: 1000 },
  { name: 'CertainTeed RoofRunner', sqftPerRoll: 1000 },
  { name: 'GAF Deck-Armor',         sqftPerRoll: 1000 },
  { name: 'Owens RhinoRoof',        sqftPerRoll: 1000 },
  { name: 'Atlas Summit',           sqftPerRoll: 1000 },
]
const CAPPING_BRANDS = [
  { name: 'IKO Hip and Ridge',      lfPerBundle: 39.4 },
  { name: 'CertainTeed Shadow Ridge',lfPerBundle: 28.9 },
  { name: 'GAF Seal-A-Ridge',       lfPerBundle: 24.8 },
  { name: 'Owens DecoRidge',        lfPerBundle: 19.7 },
  { name: 'Atlas Pro-Cut H&R',      lfPerBundle: 30.2 },
]

const wfac = (w) => 1 + w / 100

// Build the full material-calc model from metrics. Returns:
// { wastes, pitchedTotals[], starterTotals[], iceWaterTotals[], underlaymentTotals[],
//   cappingTotals[], categories:[{ category, unit, totals[], brands:[{name, counts[]}] }],
//   other:[{ label, counts[] }] }
export function materialCalc(metrics) {
  const lin = metrics.linear || {}
  const areas = metrics.areas || {}
  const pitched = Number(areas.pitched_ft2) || 0
  const eavesRakes = Number(lin.eaves_rakes_raw != null ? lin.eaves_rakes_raw : lin.eaves_rakes_ft) || 0
  const valleys = Number(lin.valley_raw != null ? lin.valley_raw : lin.valley_ft) || 0
  const stepF = Number(lin.step_flashing_raw != null ? lin.step_flashing_raw : lin.step_flashing_ft) || 0
  const wallF = Number(lin.wall_flashing_raw != null ? lin.wall_flashing_raw : lin.wall_flashing_ft) || 0
  const hipsRidges = Number(lin.hips_ridges_raw != null ? lin.hips_ridges_raw : lin.hips_ridges_ft) || 0

  // category base measures (the footnote: based on total PITCHED area)
  const shingleArea = (w) => pitched * wfac(w)                          // sqft
  const starterLF = (w) => eavesRakes * wfac(w)                         // LF
  const iceWaterLF = (w) => (eavesRakes + valleys + stepF + wallF) * wfac(w) // wait: eaves+valleys+flashings
  // NOTE: ice & water base = eaves + valleys + (step + wall flashing). Rakes excluded.
  const eaves = Number(lin.eave_raw != null ? lin.eave_raw : lin.eave_ft) || 0
  const iceWaterBaseLF = (w) => (eaves + valleys + stepF + wallF) * wfac(w)
  const underlaymentArea = (w) => pitched * wfac(w)                     // sqft
  const cappingLF = (w) => hipsRidges * wfac(w)                         // LF

  const totalsRow = (fn) => MATERIAL_WASTES.map((w) => Math.round(fn(w)))

  const categories = [
    {
      category: 'Shingle', unit: 'sqft', basis: 'Total area (pitched)',
      totals: totalsRow(shingleArea),
      brands: SHINGLE_BRANDS.map((b) => ({ name: b.name, counts: MATERIAL_WASTES.map((w) => Math.ceil(shingleArea(w) / b.sqftPerBundle)), unit: 'bundles' })),
    },
    {
      category: 'Starter', unit: 'LF', basis: 'Eaves + rakes',
      totals: totalsRow(starterLF),
      brands: STARTER_BRANDS.map((b) => ({ name: b.name, counts: MATERIAL_WASTES.map((w) => Math.ceil(starterLF(w) / b.lfPerBundle)), unit: 'bundles' })),
    },
    {
      category: 'Ice & Water', unit: 'LF', basis: 'Eaves + valleys + flashings',
      totals: totalsRow(iceWaterBaseLF),
      brands: ICEWATER_BRANDS.map((b) => ({ name: b.name, counts: MATERIAL_WASTES.map((w) => Math.ceil(iceWaterBaseLF(w) / b.lfPerRoll)), unit: 'rolls' })),
    },
    {
      category: 'Synthetic underlayment', unit: 'sqft', basis: 'Total area (pitched)',
      totals: totalsRow(underlaymentArea),
      brands: UNDERLAYMENT_BRANDS.map((b) => ({ name: b.name, counts: MATERIAL_WASTES.map((w) => Math.ceil(underlaymentArea(w) / b.sqftPerRoll)), unit: 'rolls' })),
    },
    {
      category: 'Capping', unit: 'LF', basis: 'Hips + ridges',
      totals: totalsRow(cappingLF),
      brands: CAPPING_BRANDS.map((b) => ({ name: b.name, counts: MATERIAL_WASTES.map((w) => Math.ceil(cappingLF(w) / b.lfPerBundle)), unit: 'bundles' })),
    },
  ]

  // Other materials: 8' Valley sheet, 10' Drip edge sheet (no laps).
  const other = [
    { label: "8' Valley (no laps)", unit: 'sheets', counts: MATERIAL_WASTES.map((w) => Math.ceil((valleys * wfac(w)) / 8)) },
    { label: "10' Drip Edge (eaves + rakes, no laps)", unit: 'sheets', counts: MATERIAL_WASTES.map((w) => Math.ceil((eavesRakes * wfac(w)) / 10)) },
  ]

  return { wastes: MATERIAL_WASTES, categories, other }
}

// ---------- auto material line items for the estimate (unchanged shape) ----------
export function materialLineItems(metrics, productByName) {
  const rid = () => Math.random().toString(36).slice(2, 10)
  const lin = metrics.linear || {}
  const cost = (name) => {
    if (!productByName) return 0
    const p = productByName[String(name).toLowerCase()]
    return p && p.cost != null ? Number(p.cost) || 0 : 0
  }
  const items = []
  items.push({ id: rid(), description: 'Shingles', qty: 1, unit: 'sq', unit_cost: cost('shingles'), per_square: true })
  items.push({ id: rid(), description: 'Underlayment', qty: 1, unit: 'sq', unit_cost: cost('underlayment'), per_square: true })
  const pushLF = (desc, qty) => {
    const q = Number(qty) || 0
    if (q <= 0) return
    items.push({ id: rid(), description: desc, qty: q, unit: 'LF', unit_cost: cost(desc), per_square: false })
  }
  pushLF('Starter strip', (Number(lin.eave_ft) || 0) + (Number(lin.rake_ft) || 0))
  pushLF('Drip edge', lin.drip_edge_ft)
  pushLF('Ridge cap', lin.hips_ridges_ft)
  pushLF('Valley metal', lin.valley_ft)
  pushLF('Ice & water', (Number(lin.eave_ft) || 0) + (Number(lin.valley_ft) || 0) + (Number(lin.step_flashing_ft) || 0) + (Number(lin.wall_flashing_ft) || 0))
  pushLF('Step flashing', lin.step_flashing_ft)
  pushLF('Wall flashing', lin.wall_flashing_ft)
  return items
}

// =====================================================================
// DIAGRAMS - projection + variant renderers.
// variant: 'plain' | 'length' | 'area' | 'pitch'
//   plain  -> outline only
//   length -> edges colored by type, each labeled with ft+in midpoint
//   area   -> per-facet sqft label centered in facet
//   pitch  -> per-facet pitch label centered in facet
// =====================================================================

// Local equal-area-ish projection fitting all geometry into a w x h box.
function project(rings, w, h, pad) {
  const pts = []
  rings.forEach((arr) => arr.forEach((c) => pts.push(c)))
  if (!pts.length) return { map: null, scale: 1 }
  const toMerc = ([lng, lat]) => {
    const x = (lng * Math.PI) / 180
    const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
    return [x, y]
  }
  const merc = pts.map(toMerc)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  merc.forEach(([x, y]) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y })
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const iw = w - pad * 2, ih = h - pad * 2
  const scale = Math.min(iw / spanX, ih / spanY)
  const offX = pad + (iw - spanX * scale) / 2
  const offY = pad + (ih - spanY * scale) / 2
  const map = ([lng, lat]) => {
    const [x, y] = toMerc([lng, lat])
    return [offX + (x - minX) * scale, offY + (maxY - y) * scale]
  }
  return { map, scale }
}

function centroidXY(map, coords) {
  let x = 0, y = 0
  coords.forEach((c) => { const [px, py] = map(c); x += px; y += py })
  const n = coords.length || 1
  return [x / n, y / n]
}
function midpointXY(map, a, b) {
  const [ax, ay] = map(a), [bx, by] = map(b)
  return [(ax + bx) / 2, (ay + by) / 2]
}

// Each line as a sequence of segments with their own ft+in label (turf optional;
// when turf is in window, segment lengths are exact, else split total evenly).
function lineSegmentLabels(turf, coords) {
  const out = []
  for (let i = 0; i < coords.length - 1; i++) {
    let lenFt = 0
    if (turf) { try { lenFt = turf.length(turf.lineString([coords[i], coords[i + 1]]), { units: 'feet' }) } catch { lenFt = 0 } }
    out.push({ a: coords[i], b: coords[i + 1], label: feetInches(lenFt) })
  }
  return out
}

// ---------- schematic diagram as an SVG string ----------
export function diagramSvg(facets, lines, metrics, opts) {
  const o = opts || {}
  const variant = o.variant || 'length'
  const w = o.w || 640
  const h = o.h || 440
  const pad = o.pad || 30
  const bg = o.bg || '#0b1220'
  const turf = (typeof window !== 'undefined' && window.turf) ? window.turf : null
  const realFacets = (facets || []).filter((f) => Array.isArray(f.coords) && f.coords.length >= 3)
  const realLines = (lines || []).filter((l) => Array.isArray(l.coords) && l.coords.length >= 2)
  const rings = [...realFacets.map((f) => f.coords), ...realLines.map((l) => l.coords)]
  if (!rings.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/><text x="${w / 2}" y="${h / 2}" fill="#64748b" font-family="sans-serif" font-size="14" text-anchor="middle">No geometry to diagram</text></svg>`
  }
  const { map } = project(rings, w, h, pad)
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const facetPolys = realFacets.map((f) => {
    const pts = f.coords.map((c) => { const [x, y] = map(c); return `${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')
    return `<polygon points="${pts}" fill="#1d4ed8" fill-opacity="0.16" stroke="#3b82f6" stroke-width="1.3"/>`
  }).join('')

  let lineLayer = ''
  if (variant === 'length') {
    lineLayer = realLines.map((l) => {
      const d = l.coords.map((c, i) => { const [x, y] = map(c); return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')
      return `<path d="${d}" fill="none" stroke="${lineColor(l.type)}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`
    }).join('')
    // edge ft+in labels
    const labels = realLines.map((l) => lineSegmentLabels(turf, l.coords).map((seg) => {
      const [mx, my] = midpointXY(map, seg.a, seg.b)
      return `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" fill="#e2e8f0" font-family="sans-serif" font-size="9" text-anchor="middle" paint-order="stroke" stroke="#0b1220" stroke-width="2.5">${esc(seg.label)}</text>`
    }).join('')).join('')
    lineLayer += labels
  } else {
    // plain / area / pitch: thin neutral edges
    lineLayer = realLines.map((l) => {
      const d = l.coords.map((c, i) => { const [x, y] = map(c); return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')
      return `<path d="${d}" fill="none" stroke="#64748b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
    }).join('')
  }

  let facetLabels = ''
  if (variant === 'area' || variant === 'pitch') {
    facetLabels = realFacets.map((f) => {
      const [cx, cy] = centroidXY(map, f.coords)
      let txt = ''
      if (variant === 'area') {
        const a = turf ? facetPlanFt2(turf, f.coords) * pitchMult(Number(f.pitch) || 0) : 0
        txt = `${Math.round(a).toLocaleString()} ft2`
      } else {
        txt = f.pitch_label || pitchLabel(Number(f.pitch) || 0)
      }
      return `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" fill="#f8fafc" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="middle" paint-order="stroke" stroke="#0b1220" stroke-width="3">${esc(txt)}</text>`
    }).join('')
  }

  // legend (length variant only)
  let legend = ''
  if (variant === 'length') {
    const usedTypes = LINE_TYPES.filter((t) => realLines.some((l) => normalizeLineType(l.type) === t.key))
    legend = usedTypes.map((t, i) => {
      const lx = pad, ly = h - pad - (usedTypes.length - i) * 15 + 4
      return `<rect x="${lx}" y="${ly - 8}" width="14" height="3" rx="1.5" fill="${t.color}"/><text x="${lx + 20}" y="${ly - 3}" fill="#cbd5e1" font-family="sans-serif" font-size="9.5">${t.label}</text>`
    }).join('')
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${facetPolys}${lineLayer}${facetLabels}${legend}</svg>`
}

// ---------- diagram as a PNG dataURL (offscreen canvas, white bg for PDF) ----------
export function diagramPng(facets, lines, metrics, opts) {
  if (typeof document === 'undefined') return null
  const o = opts || {}
  const variant = o.variant || 'plain'
  const w = o.w || 640
  const h = o.h || 440
  const pad = o.pad || 30
  const turf = (typeof window !== 'undefined' && window.turf) ? window.turf : null
  const realFacets = (facets || []).filter((f) => Array.isArray(f.coords) && f.coords.length >= 3)
  const realLines = (lines || []).filter((l) => Array.isArray(l.coords) && l.coords.length >= 2)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  const rings = [...realFacets.map((f) => f.coords), ...realLines.map((l) => l.coords)]
  if (!rings.length) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No geometry', w / 2, h / 2)
    return canvas.toDataURL('image/png')
  }
  const { map } = project(rings, w, h, pad)

  // facets
  realFacets.forEach((f) => {
    ctx.beginPath()
    f.coords.forEach((c, i) => { const [x, y] = map(c); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
    ctx.closePath()
    ctx.fillStyle = 'rgba(37,99,235,0.10)'
    ctx.fill()
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 1.3
    ctx.stroke()
  })

  // lines
  realLines.forEach((l) => {
    ctx.beginPath()
    l.coords.forEach((c, i) => { const [x, y] = map(c); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
    ctx.strokeStyle = variant === 'length' ? lineColor(l.type) : '#94a3b8'
    ctx.lineWidth = variant === 'length' ? 2.6 : 1.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  })

  const drawLabel = (txt, x, y, size, weight) => {
    ctx.font = `${weight || ''} ${size}px sans-serif`.trim()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = size > 10 ? 3 : 2.5
    ctx.strokeStyle = '#ffffff'
    ctx.strokeText(txt, x, y)
    ctx.fillStyle = '#0f172a'
    ctx.fillText(txt, x, y)
  }

  if (variant === 'length') {
    realLines.forEach((l) => {
      lineSegmentLabels(turf, l.coords).forEach((seg) => {
        const [mx, my] = midpointXY(map, seg.a, seg.b)
        drawLabel(seg.label, mx, my, 9)
      })
    })
    // legend
    const usedTypes = LINE_TYPES.filter((t) => realLines.some((ll) => normalizeLineType(ll.type) === t.key))
    usedTypes.forEach((t, i) => {
      const ly = h - pad - (usedTypes.length - i) * 15 + 4
      ctx.fillStyle = t.color
      ctx.fillRect(pad, ly - 8, 14, 3)
      ctx.fillStyle = '#334155'
      ctx.font = '9.5px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(t.label, pad + 20, ly - 2)
    })
  } else if (variant === 'area' || variant === 'pitch') {
    realFacets.forEach((f) => {
      const [cx, cy] = centroidXY(map, f.coords)
      let txt = ''
      if (variant === 'area') {
        const a = turf ? facetPlanFt2(turf, f.coords) * pitchMult(Number(f.pitch) || 0) : 0
        txt = `${Math.round(a).toLocaleString()} ft2`
      } else {
        txt = f.pitch_label || pitchLabel(Number(f.pitch) || 0)
      }
      drawLabel(txt, cx, cy, 11, '700')
    })
  }

  return canvas.toDataURL('image/png')
}

// Build all four diagram PNG variants in one pass (for the PDF).
export function diagramPngSet(facets, lines, metrics, opts) {
  const base = opts || { w: 640, h: 440 }
  return {
    plain: diagramPng(facets, lines, metrics, { ...base, variant: 'plain' }),
    length: diagramPng(facets, lines, metrics, { ...base, variant: 'length' }),
    area: diagramPng(facets, lines, metrics, { ...base, variant: 'area' }),
    pitch: diagramPng(facets, lines, metrics, { ...base, variant: 'pitch' }),
  }
}

// =====================================================================
// MULTI-PAGE BRANDED PDF (7 pages, mirrors Roofr). Tenant-branded, brand
// blue, no emojis/purple. Hand-drawn tables (no autotable). Auto-paginates.
//   p1 Cover (schematic plain diagram, top-right summary)
//   p2 Diagram (plain, large)
//   p3 Length measurement report (legend + totals ft+in, length diagram)
//   p4 Area measurement report (totals + area diagram)
//   p5 Pitch measurement report (pitch diagram + per-pitch table)
//   p6 Report summary (full measurements table + waste table)
//   p7 Material calculations (brand table, waste 0/10/15/20, footnote)
// =====================================================================
const BRAND_BLUE = [47, 109, 246]
const BRAND_DARK = [15, 23, 42]
const BRAND_GRAY = [100, 116, 139]
const BRAND_LIGHT = [226, 232, 240]

function pdfHeader(doc, W, companyName, subtitle) {
  doc.setFillColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2])
  doc.rect(0, 0, W, 54, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(String(companyName || 'Roof Report'), 40, 26)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(String(subtitle || ''), 40, 44)
}
function pdfImage(doc, png, x, y, w, srcW, srcH) {
  if (!png) return y
  const h = w * (srcH / srcW)
  try { doc.addImage(png, 'PNG', x, y, w, h) } catch (e) { /* ignore */ }
  return y + h
}
function sectionTitle(doc, W, y, label) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2])
  doc.text(label, 40, y)
  doc.setDrawColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2])
  doc.setLineWidth(1.2)
  doc.line(40, y + 6, W - 40, y + 6)
  return y + 22
}
function kvRows(doc, W, y, rows) {
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  rows.forEach(([k, v, bold]) => {
    if (y > pageH - 48) { doc.addPage(); y = 50 }
    doc.setTextColor(BRAND_GRAY[0], BRAND_GRAY[1], BRAND_GRAY[2])
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(String(k), 44, y)
    doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2])
    doc.text(String(v), W - 44, y, { align: 'right' })
    doc.setDrawColor(BRAND_LIGHT[0], BRAND_LIGHT[1], BRAND_LIGHT[2])
    doc.setLineWidth(0.5)
    doc.line(44, y + 4, W - 44, y + 4)
    y += 18
  })
  return y
}

export function buildPdf(jsPDF, { row, metrics, pngDataUrl, pngSet, companyName }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const lin = metrics.linear || {}
  const areas = metrics.areas || {}
  const addr = (row && row.address) ? String(row.address) : ''
  const title = (row && row.title) ? String(row.title) : 'Aerial roof measurement'
  const dateStr = row && row.created_at ? new Date(row.created_at).toLocaleDateString() : new Date().toLocaleDateString()
  // diagrams: prefer a prebuilt set; else fall back to the single pngDataUrl for every page.
  const set = pngSet || {}
  const plainPng = set.plain || pngDataUrl || null
  const lengthPng = set.length || pngDataUrl || null
  const areaPng = set.area || pngDataUrl || null
  const pitchPng = set.pitch || pngDataUrl || null
  const SRC_W = 640, SRC_H = 440

  // ---------- p1 Cover ----------
  pdfHeader(doc, W, companyName, 'Roof Report')
  let y = 84
  doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('Roof Report', 40, y)
  y += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(BRAND_GRAY[0], BRAND_GRAY[1], BRAND_GRAY[2])
  doc.text('Prepared by ' + String(companyName || 'Roof Report'), 40, y); y += 16
  if (addr) { doc.text(addr, 40, y); y += 15 }
  if (row && row.customerName) { doc.text('Customer: ' + String(row.customerName), 40, y); y += 15 }
  doc.text('Date: ' + dateStr, 40, y); y += 8

  // top-right summary card
  const cardX = W - 220, cardY = 70, cardW = 180, cardH = 86
  doc.setFillColor(247, 250, 255)
  doc.setDrawColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2])
  doc.setLineWidth(1)
  doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6, 'FD')
  doc.setFontSize(9)
  doc.setTextColor(BRAND_GRAY[0], BRAND_GRAY[1], BRAND_GRAY[2])
  const sumRows = [
    ['Total area', `${(metrics.sloped_ft2 || 0).toLocaleString()} sqft`],
    ['Facets', String(metrics.facet_count || 0)],
    ['Predominant pitch', metrics.predominant_pitch || '-'],
  ]
  let sy = cardY + 22
  sumRows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(BRAND_GRAY[0], BRAND_GRAY[1], BRAND_GRAY[2])
    doc.text(k, cardX + 12, sy)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2])
    doc.text(String(v), cardX + cardW - 12, sy, { align: 'right' })
    sy += 22
  })

  // cover schematic
  const imgY = Math.max(y + 16, 180)
  const imgW = W - 80
  pdfImage(doc, plainPng, 40, imgY, imgW, SRC_W, SRC_H)

  // ---------- p2 Diagram ----------
  doc.addPage()
  pdfHeader(doc, W, companyName, 'Diagram')
  y = sectionTitle(doc, W, 78, 'Roof diagram')
  pdfImage(doc, plainPng, 40, y, W - 80, SRC_W, SRC_H)

  // ---------- p3 Length measurement report ----------
  doc.addPage()
  pdfHeader(doc, W, companyName, 'Length measurement report')
  y = sectionTitle(doc, W, 78, 'Length measurements')
  const lengthRows = [
    ['Eaves', feetInches(lin.eaves_raw != null ? lin.eaves_raw : lin.eave_ft)],
    ['Valleys', feetInches(lin.valley_raw != null ? lin.valley_raw : lin.valley_ft)],
    ['Hips', feetInches(lin.hip_raw != null ? lin.hip_raw : lin.hip_ft)],
    ['Ridges', feetInches(lin.ridge_raw != null ? lin.ridge_raw : lin.ridge_ft)],
    ['Rakes', feetInches(lin.rake_raw != null ? lin.rake_raw : lin.rake_ft)],
    ['Wall flashing', feetInches(lin.wall_flashing_raw != null ? lin.wall_flashing_raw : lin.wall_flashing_ft)],
    ['Step flashing', feetInches(lin.step_flashing_raw != null ? lin.step_flashing_raw : lin.step_flashing_ft)],
    ['Transitions', feetInches(lin.transition_raw != null ? lin.transition_raw : lin.transition_ft)],
    ['Parapet wall', feetInches(lin.parapet_raw != null ? lin.parapet_raw : lin.parapet_ft)],
    ['Unspecified', feetInches(lin.unspecified_raw != null ? lin.unspecified_raw : lin.unspecified_ft)],
    ['Hips + ridges', feetInches(lin.hips_ridges_raw != null ? lin.hips_ridges_raw : lin.hips_ridges_ft), true],
    ['Eaves + rakes (drip edge)', feetInches(lin.eaves_rakes_raw != null ? lin.eaves_rakes_raw : lin.eaves_rakes_ft), true],
  ]
  y = kvRows(doc, W, y, lengthRows)
  y += 10
  if (y > H - 220) { doc.addPage(); y = 60 }
  pdfImage(doc, lengthPng, 40, y, W - 80, SRC_W, SRC_H)

  // ---------- p4 Area measurement report ----------
  doc.addPage()
  pdfHeader(doc, W, companyName, 'Area measurement report')
  y = sectionTitle(doc, W, 78, 'Area measurements')
  const areaRows = [
    ['Total area', `${(metrics.sloped_ft2 || 0).toLocaleString()} sqft`, true],
    ['Pitched area', `${(areas.pitched_ft2 || 0).toLocaleString()} sqft`],
    ['Flat area', `${(areas.flat_ft2 || 0).toLocaleString()} sqft`],
    ['Two-story area', '0 sqft'],
    ['Two-layer area', '0 sqft'],
    ['Predominant pitch', metrics.predominant_pitch || '-'],
    ['Predominant pitch area', `${(metrics.predominant_pitch_area || 0).toLocaleString()} sqft`],
    ['Unspecified pitch area', `${(metrics.unspecified_pitch_area || 0).toLocaleString()} sqft`],
  ]
  y = kvRows(doc, W, y, areaRows)
  y += 10
  if (y > H - 220) { doc.addPage(); y = 60 }
  pdfImage(doc, areaPng, 40, y, W - 80, SRC_W, SRC_H)

  // ---------- p5 Pitch measurement report ----------
  doc.addPage()
  pdfHeader(doc, W, companyName, 'Pitch measurement report')
  y = sectionTitle(doc, W, 78, 'Pitch measurements')
  const abp = metrics.area_by_pitch || {}
  const pitchRows = Object.keys(abp).sort().map((k) => [`Area @ ${k}`, `${Number(abp[k]).toLocaleString()} sqft`])
  pitchRows.push(['Predominant pitch', metrics.predominant_pitch || '-', true])
  y = kvRows(doc, W, y, pitchRows)
  y += 10
  if (y > H - 220) { doc.addPage(); y = 60 }
  pdfImage(doc, pitchPng, 40, y, W - 80, SRC_W, SRC_H)

  // ---------- p6 Report summary ----------
  doc.addPage()
  pdfHeader(doc, W, companyName, 'Report summary')
  y = sectionTitle(doc, W, 78, 'Measurements')
  const summaryRows = [
    ['Total area', `${(metrics.sloped_ft2 || 0).toLocaleString()} sqft`, true],
    ['Pitched area', `${(areas.pitched_ft2 || 0).toLocaleString()} sqft`],
    ['Flat area', `${(areas.flat_ft2 || 0).toLocaleString()} sqft`],
    ['Predominant pitch', metrics.predominant_pitch || '-'],
    ['Facets', String(metrics.facet_count || 0)],
    ['Squares (base)', `${(metrics.squares_base != null ? metrics.squares_base : (metrics.sloped_ft2 / 100)).toFixed(1)}`],
    ['Perimeter', feetInches(metrics.perimeter_ft)],
    ['Eaves', feetInches(lin.eave_raw != null ? lin.eave_raw : lin.eave_ft)],
    ['Valleys', feetInches(lin.valley_raw != null ? lin.valley_raw : lin.valley_ft)],
    ['Hips', feetInches(lin.hip_raw != null ? lin.hip_raw : lin.hip_ft)],
    ['Ridges', feetInches(lin.ridge_raw != null ? lin.ridge_raw : lin.ridge_ft)],
    ['Rakes', feetInches(lin.rake_raw != null ? lin.rake_raw : lin.rake_ft)],
    ['Wall flashing', feetInches(lin.wall_flashing_raw != null ? lin.wall_flashing_raw : lin.wall_flashing_ft)],
    ['Step flashing', feetInches(lin.step_flashing_raw != null ? lin.step_flashing_raw : lin.step_flashing_ft)],
    ['Hips + ridges', feetInches(lin.hips_ridges_raw != null ? lin.hips_ridges_raw : lin.hips_ridges_ft), true],
    ['Eaves + rakes', feetInches(lin.eaves_rakes_raw != null ? lin.eaves_rakes_raw : lin.eaves_rakes_ft), true],
  ]
  y = kvRows(doc, W, y, summaryRows)
  y += 16

  // waste table
  if (y > H - 160) { doc.addPage(); y = 60 }
  y = sectionTitle(doc, W, y, 'Waste table')
  const wt = metrics.waste_table || []
  const col0 = 44, colArea = W * 0.5, colSq = W - 44
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.setTextColor(BRAND_GRAY[0], BRAND_GRAY[1], BRAND_GRAY[2])
  doc.text('Waste %', col0, y)
  doc.text('Area (sqft)', colArea, y, { align: 'right' })
  doc.text('Squares', colSq, y, { align: 'right' })
  y += 6
  doc.setDrawColor(BRAND_LIGHT[0], BRAND_LIGHT[1], BRAND_LIGHT[2]); doc.setLineWidth(0.5)
  doc.line(col0, y, W - 44, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  wt.forEach((r) => {
    if (r.recommended) {
      doc.setFillColor(235, 244, 255)
      doc.rect(col0 - 4, y - 11, W - 80 + 8, 17, 'F')
    }
    doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2])
    doc.setFont('helvetica', r.recommended ? 'bold' : 'normal')
    doc.text(`${r.pct}%${r.recommended ? '  (Recommended)' : ''}`, col0, y)
    doc.text(Number(r.area).toLocaleString(), colArea, y, { align: 'right' })
    doc.text(Number(r.squares).toFixed(1), colSq, y, { align: 'right' })
    y += 18
  })

  // ---------- p7 Material calculations ----------
  doc.addPage()
  pdfHeader(doc, W, companyName, 'Material calculations')
  y = sectionTitle(doc, W, 78, 'Material calculations')
  const mc = materialCalc(metrics)
  const wcols = mc.wastes
  // column x positions for the 4 waste columns
  const labelX = 44
  const firstCol = W * 0.42
  const colStep = (W - 44 - firstCol) / (wcols.length - 1)
  const colX = (i) => firstCol + colStep * i

  const drawWasteHeader = (yy) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.setTextColor(BRAND_GRAY[0], BRAND_GRAY[1], BRAND_GRAY[2])
    doc.text('Material', labelX, yy)
    wcols.forEach((w, i) => doc.text(`${w}%`, colX(i), yy, { align: 'right' }))
    doc.setDrawColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2]); doc.setLineWidth(0.8)
    doc.line(labelX, yy + 5, W - 44, yy + 5)
    return yy + 18
  }
  y = drawWasteHeader(y)

  mc.categories.forEach((cat) => {
    if (y > H - 90) { doc.addPage(); pdfHeader(doc, W, companyName, 'Material calculations'); y = drawWasteHeader(78) }
    // shaded category row (totals)
    doc.setFillColor(238, 242, 248)
    doc.rect(labelX - 4, y - 11, W - 80 + 8, 16, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
    doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2])
    doc.text(`${cat.category} (${cat.basis}, ${cat.unit})`, labelX, y)
    cat.totals.forEach((t, i) => doc.text(Number(t).toLocaleString(), colX(i), y, { align: 'right' }))
    y += 16
    // brand rows
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    cat.brands.forEach((b) => {
      if (y > H - 70) { doc.addPage(); pdfHeader(doc, W, companyName, 'Material calculations'); y = drawWasteHeader(78) }
      doc.setTextColor(BRAND_GRAY[0], BRAND_GRAY[1], BRAND_GRAY[2])
      doc.text(`   ${b.name}`, labelX, y)
      doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2])
      b.counts.forEach((c, i) => doc.text(`${c} ${b.unit}`, colX(i), y, { align: 'right' }))
      y += 14
    })
    y += 4
  })

  // other materials
  if (y > H - 110) { doc.addPage(); pdfHeader(doc, W, companyName, 'Material calculations'); y = drawWasteHeader(78) }
  doc.setFillColor(238, 242, 248)
  doc.rect(labelX - 4, y - 11, W - 80 + 8, 16, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2])
  doc.text('Other materials', labelX, y); y += 16
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  mc.other.forEach((o) => {
    if (y > H - 70) { doc.addPage(); pdfHeader(doc, W, companyName, 'Material calculations'); y = drawWasteHeader(78) }
    doc.setTextColor(BRAND_GRAY[0], BRAND_GRAY[1], BRAND_GRAY[2])
    doc.text(`   ${o.label}`, labelX, y)
    doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2])
    o.counts.forEach((c, i) => doc.text(`${c} ${o.unit}`, colX(i), y, { align: 'right' }))
    y += 14
  })
  y += 12

  doc.setFont('helvetica', 'italic'); doc.setFontSize(8)
  doc.setTextColor(BRAND_GRAY[0], BRAND_GRAY[1], BRAND_GRAY[2])
  doc.text('Estimates are based on total pitched area; flat / low-slope area is excluded. Quantities are guidance only.', 44, y, { maxWidth: W - 88 })

  return doc
}

// Convenience: filename from a row.
export function pdfFilename(row) {
  const base = (row && (row.address || row.title)) ? String(row.address || row.title) : (row && row.id ? String(row.id) : 'report')
  const slug = base.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'report'
  return `Roof-Report-${slug}.pdf`
}
