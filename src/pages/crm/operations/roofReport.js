// =====================================================================
// roofReport.js - shared pure helpers for the RoofR-style roof takeoff.
// Imported by CrmMeasure.jsx (live build) and OperationsWorkOrders.jsx
// (saved-row regen). No React, no DOM-mount deps. The diagram/PDF helpers
// touch the DOM (canvas/jsPDF) only when called, so they stay importable
// in any context.
//
// CDN deps loaded lazily by the caller via ensureLibs():
//   - turf.js (window.turf)            -> length/area math
//   - jsPDF  (window.jspdf.jsPDF)      -> branded PDF
// =====================================================================

export const M2_TO_FT2 = 10.7639104
export const pitchMult = (rise) => Math.sqrt(1 + (Number(rise) / 12) * (Number(rise) / 12))
export const pitchLabel = (rise) => `${Number(rise) || 0}/12`

// Line types + brand-safe colors (NO purple).
export const LINE_TYPES = [
  { key: 'ridge',    label: 'Ridge',               color: '#2f6df6' },
  { key: 'hip',      label: 'Hip',                 color: '#f59e0b' },
  { key: 'valley',   label: 'Valley',              color: '#ef4444' },
  { key: 'eave',     label: 'Eave',                color: '#10b981' },
  { key: 'rake',     label: 'Rake',                color: '#eab308' },
  { key: 'flashing', label: 'Step/Wall Flashing',  color: '#38bdf8' },
]
export const lineColor = (type) => (LINE_TYPES.find((t) => t.key === type) || {}).color || '#94a3b8'
export const lineTypeLabel = (type) => (LINE_TYPES.find((t) => t.key === type) || {}).label || type

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
// plan (flat) ft2 of one closed facet (coords: [[lng,lat]...], no repeated last point)
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
// New rows store { facets:[...], lines:[...] }. This returns { facets, lines }.
export function normalizeMeasurements(measurements) {
  if (Array.isArray(measurements)) return { facets: measurements, lines: [] }
  if (measurements && typeof measurements === 'object') {
    return {
      facets: Array.isArray(measurements.facets) ? measurements.facets : [],
      lines: Array.isArray(measurements.lines) ? measurements.lines : [],
    }
  }
  return { facets: [], lines: [] }
}

// ---------- core metrics ----------
// facets: [{ section, pitch, pitch_label, coords:[[lng,lat]...] }]
// lines:  [{ id, type, coords:[[lng,lat]...], length_ft }]
// opts:   { waste_pct }
// Returns the full RoofR-style metric object (also the shape stored in summary
// PLUS the extra display fields). Pure - needs turf passed in.
export function computeMetrics(turf, facets, lines, opts) {
  const wasteRaw = opts && opts.waste_pct != null ? Number(opts.waste_pct) : 10
  const waste = Math.max(0, Math.min(40, isNaN(wasteRaw) ? 10 : wasteRaw))

  const realFacets = (facets || []).filter((f) => Array.isArray(f.coords) && f.coords.length >= 3)

  let plan = 0, sloped = 0, flat = 0, pitched = 0, perimeter = 0
  const byPitch = {} // pitch_label -> sloped ft2
  const areaWeights = {} // pitch_label -> sloped ft2 (for predominant)

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
    areaWeights[label] = (areaWeights[label] || 0) + s
  })

  // predominant pitch = label with the largest total sloped area
  let predominant = '', best = -1
  Object.entries(areaWeights).forEach(([label, a]) => { if (a > best) { best = a; predominant = label } })

  // squares (sloped, waste-adjusted, rounded up to 0.1)
  const slopedWithWaste = sloped * (1 + waste / 100)
  const squares = Math.ceil((slopedWithWaste / 100) * 10) / 10
  const pitchedSquares = Math.ceil((pitched * (1 + waste / 100) / 100) * 10) / 10
  const flatSquares = Math.ceil((flat * (1 + waste / 100) / 100) * 10) / 10

  // linear feet by type
  const lf = { ridge: 0, hip: 0, valley: 0, eave: 0, rake: 0, flashing: 0 }
  ;(lines || []).forEach((l) => {
    if (!l || !lf.hasOwnProperty(l.type)) return
    const len = l.length_ft != null ? Number(l.length_ft) : lineLengthFt(turf, l.coords)
    lf[l.type] += Number(len) || 0
  })
  const dripEdge = lf.eave + lf.rake

  // round byPitch values
  const areaByPitch = {}
  Object.entries(byPitch).forEach(([k, v]) => { areaByPitch[k] = Math.round(v) })

  return {
    plan_ft2: Math.round(plan),
    sloped_ft2: Math.round(sloped),
    squares,
    waste_pct: waste,
    facet_count: realFacets.length,
    perimeter_ft: Math.round(perimeter),
    predominant_pitch: predominant,
    areas: { flat_ft2: Math.round(flat), pitched_ft2: Math.round(pitched), flat_squares: flatSquares, pitched_squares: pitchedSquares },
    area_by_pitch: areaByPitch,
    linear: {
      ridge_ft: Math.round(lf.ridge),
      hip_ft: Math.round(lf.hip),
      valley_ft: Math.round(lf.valley),
      eave_ft: Math.round(lf.eave),
      rake_ft: Math.round(lf.rake),
      flashing_ft: Math.round(lf.flashing),
      drip_edge_ft: Math.round(dripEdge),
    },
  }
}

// Build the persisted summary object (extends the legacy keys, additive).
export function buildSummary(metrics) {
  return {
    plan_ft2: metrics.plan_ft2,
    sloped_ft2: metrics.sloped_ft2,
    squares: metrics.squares,
    waste_pct: metrics.waste_pct,
    facet_count: metrics.facet_count,
    perimeter_ft: metrics.perimeter_ft,
    predominant_pitch: metrics.predominant_pitch,
    areas: metrics.areas,
    area_by_pitch: metrics.area_by_pitch,
    linear: metrics.linear,
  }
}

// Dominant pitch label across facets, weighted by count (kept for the estimate
// measurements.pitch seed, matching legacy CrmMeasure behavior fallback).
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

// ---------- local projection for the schematic ----------
// Project [lng,lat] -> screen-ish x,y (web-mercator-ish, equal-area enough at a
// roof's scale). Fits all geometry into a w x h box with padding.
function project(coords, w, h, pad) {
  const pts = []
  coords.forEach((arr) => arr.forEach((c) => pts.push(c)))
  if (!pts.length) return { facetXY: [], lineXY: [], scale: 1 }
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
    return [offX + (x - minX) * scale, offY + (maxY - y) * scale] // flip Y
  }
  return { map, scale }
}

// ---------- schematic diagram as an SVG string ----------
// facets/lines in lng/lat. Returns an <svg> string (themeable via inline fills).
export function diagramSvg(facets, lines, metrics, opts) {
  const w = (opts && opts.w) || 640
  const h = (opts && opts.h) || 440
  const pad = (opts && opts.pad) || 28
  const bg = (opts && opts.bg) || '#0b1220'
  const realFacets = (facets || []).filter((f) => Array.isArray(f.coords) && f.coords.length >= 3)
  const realLines = (lines || []).filter((l) => Array.isArray(l.coords) && l.coords.length >= 2)
  const allRings = [
    ...realFacets.map((f) => f.coords),
    ...realLines.map((l) => l.coords),
  ]
  if (!allRings.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/><text x="${w / 2}" y="${h / 2}" fill="#64748b" font-family="sans-serif" font-size="14" text-anchor="middle">No geometry to diagram</text></svg>`
  }
  const { map } = project(allRings, w, h, pad)
  const facetPolys = realFacets.map((f) => {
    const pts = f.coords.map((c) => { const [x, y] = map(c); return `${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')
    return `<polygon points="${pts}" fill="#1d4ed8" fill-opacity="0.18" stroke="#3b82f6" stroke-width="1.4"/>`
  }).join('')
  const linePaths = realLines.map((l) => {
    const d = l.coords.map((c, i) => { const [x, y] = map(c); return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')
    return `<path d="${d}" fill="none" stroke="${lineColor(l.type)}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`
  }).join('')
  const sq = metrics ? metrics.squares : 0
  const ridge = metrics ? metrics.linear.ridge_ft : 0
  const valley = metrics ? metrics.linear.valley_ft : 0
  const drip = metrics ? metrics.linear.drip_edge_ft : 0
  // legend chips for used types
  const usedTypes = LINE_TYPES.filter((t) => realLines.some((l) => l.type === t.key))
  const legend = usedTypes.map((t, i) => {
    const lx = pad, ly = h - pad - (usedTypes.length - i) * 16 + 4
    return `<rect x="${lx}" y="${ly - 8}" width="14" height="3" rx="1.5" fill="${t.color}"/><text x="${lx + 20}" y="${ly - 3}" fill="#cbd5e1" font-family="sans-serif" font-size="10">${t.label}</text>`
  }).join('')
  const caption = `<text x="${w - pad}" y="${pad}" fill="#e2e8f0" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="end">${sq.toFixed ? sq.toFixed(1) : sq} squares</text>` +
    `<text x="${w - pad}" y="${pad + 16}" fill="#94a3b8" font-family="sans-serif" font-size="10" text-anchor="end">Ridge ${ridge} LF | Valley ${valley} LF | Drip ${drip} LF</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${facetPolys}${linePaths}${legend}${caption}</svg>`
}

// ---------- diagram as a PNG dataURL (offscreen canvas) ----------
// White-background variant for PDF embedding. Returns a data:image/png URL.
export function diagramPng(facets, lines, metrics, opts) {
  if (typeof document === 'undefined') return null
  const w = (opts && opts.w) || 640
  const h = (opts && opts.h) || 440
  const pad = (opts && opts.pad) || 28
  const realFacets = (facets || []).filter((f) => Array.isArray(f.coords) && f.coords.length >= 3)
  const realLines = (lines || []).filter((l) => Array.isArray(l.coords) && l.coords.length >= 2)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  const allRings = [...realFacets.map((f) => f.coords), ...realLines.map((l) => l.coords)]
  if (!allRings.length) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No geometry', w / 2, h / 2)
    return canvas.toDataURL('image/png')
  }
  const { map } = project(allRings, w, h, pad)
  // facets
  realFacets.forEach((f) => {
    ctx.beginPath()
    f.coords.forEach((c, i) => { const [x, y] = map(c); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
    ctx.closePath()
    ctx.fillStyle = 'rgba(37,99,235,0.12)'
    ctx.fill()
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 1.4
    ctx.stroke()
  })
  // lines
  realLines.forEach((l) => {
    ctx.beginPath()
    l.coords.forEach((c, i) => { const [x, y] = map(c); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
    ctx.strokeStyle = lineColor(l.type)
    ctx.lineWidth = 2.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  })
  // legend
  const usedTypes = LINE_TYPES.filter((t) => realLines.some((l) => l.type === t.key))
  usedTypes.forEach((t, i) => {
    const ly = h - pad - (usedTypes.length - i) * 16 + 4
    ctx.fillStyle = t.color
    ctx.fillRect(pad, ly - 8, 14, 3)
    ctx.fillStyle = '#334155'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(t.label, pad + 20, ly - 2)
  })
  // caption
  if (metrics) {
    ctx.fillStyle = '#0f172a'
    ctx.font = '700 13px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${metrics.squares.toFixed ? metrics.squares.toFixed(1) : metrics.squares} squares`, w - pad, pad + 4)
    ctx.fillStyle = '#64748b'
    ctx.font = '10px sans-serif'
    ctx.fillText(`Ridge ${metrics.linear.ridge_ft} LF | Valley ${metrics.linear.valley_ft} LF | Drip ${metrics.linear.drip_edge_ft} LF`, w - pad, pad + 20)
  }
  return canvas.toDataURL('image/png')
}

// ---------- auto material line items for the estimate ----------
// Returns items in the EXACT shape CrmEstimateDetail expects:
//   { id, description, qty, unit, unit_cost, per_square? }
// per_square:true items auto-fill qty from adjusted squares in the estimate UI.
// LF items carry a real qty + unit 'LF', per_square:false. unit_cost defaults 0
// (rep prices) unless a matching estimate_products row is supplied via productByName.
export function materialLineItems(metrics, productByName) {
  const rid = () => Math.random().toString(36).slice(2, 10)
  const lin = metrics.linear || {}
  const cost = (name) => {
    if (!productByName) return 0
    const p = productByName[String(name).toLowerCase()]
    return p && p.cost != null ? Number(p.cost) || 0 : 0
  }
  const items = []
  // per-square items
  items.push({ id: rid(), description: 'Shingles', qty: 1, unit: 'sq', unit_cost: cost('shingles'), per_square: true })
  items.push({ id: rid(), description: 'Underlayment', qty: 1, unit: 'sq', unit_cost: cost('underlayment'), per_square: true })
  // LF items (only push when > 0 except the common ones; keep zeros omitted)
  const pushLF = (desc, qty, key) => {
    const q = Number(qty) || 0
    if (q <= 0 && key !== 'always') return
    items.push({ id: rid(), description: desc, qty: q, unit: 'LF', unit_cost: cost(desc), per_square: false })
  }
  pushLF('Starter strip', lin.eave_ft, 'opt')
  pushLF('Drip edge', lin.drip_edge_ft, 'opt')
  pushLF('Ridge cap', (Number(lin.ridge_ft) || 0) + (Number(lin.hip_ft) || 0), 'opt')
  pushLF('Valley metal', lin.valley_ft, 'opt')
  pushLF('Ice & water (eaves)', lin.eave_ft, 'opt')
  if ((Number(lin.flashing_ft) || 0) > 0) pushLF('Step flashing', lin.flashing_ft, 'opt')
  return items
}

// ---------- branded one/two-page PDF ----------
// jsPDF = the jsPDF constructor (from ensurePdf()). row = a saved/derived obj:
//   { title, address, customerName, created_at }
// metrics = computeMetrics output. pngDataUrl = diagramPng() output (or null).
// companyName = tenant/platform display name. Returns the jsPDF doc (caller saves).
export function buildPdf(jsPDF, { row, metrics, pngDataUrl, companyName }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const BLUE = [47, 109, 246]
  const DARK = [15, 23, 42]
  const GRAY = [100, 116, 139]
  let y = 0

  // header band
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2])
  doc.rect(0, 0, W, 64, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(String(companyName || 'Roof Report'), 40, 30)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text('Roof Measurement Report', 40, 50)
  y = 88

  // property block
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(row && row.title ? String(row.title) : 'Aerial roof measurement', 40, y)
  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  const dateStr = row && row.created_at ? new Date(row.created_at).toLocaleDateString() : new Date().toLocaleDateString()
  if (row && row.address) { doc.text(String(row.address), 40, y); y += 13 }
  if (row && row.customerName) { doc.text('Customer: ' + String(row.customerName), 40, y); y += 13 }
  doc.text('Date: ' + dateStr, 40, y)
  y += 18

  // diagram
  if (pngDataUrl) {
    const imgW = W - 80
    const imgH = imgW * (440 / 640)
    try { doc.addImage(pngDataUrl, 'PNG', 40, y, imgW, imgH) } catch (e) { /* ignore */ }
    y += imgH + 18
  }

  // metrics table (simple two-column rows; no autotable dep)
  const lin = metrics.linear || {}
  const areas = metrics.areas || {}
  const rows = [
    ['Total squares', `${metrics.squares} sq`],
    ['Total sloped area', `${metrics.sloped_ft2.toLocaleString()} ft2`],
    ['Total plan area', `${metrics.plan_ft2.toLocaleString()} ft2`],
    ['Pitched area', `${(areas.pitched_ft2 || 0).toLocaleString()} ft2 (${areas.pitched_squares || 0} sq)`],
    ['Flat / low-slope area', `${(areas.flat_ft2 || 0).toLocaleString()} ft2 (${areas.flat_squares || 0} sq)`],
    ['Predominant pitch', metrics.predominant_pitch || '-'],
    ['Facets', String(metrics.facet_count)],
    ['Perimeter', `${metrics.perimeter_ft.toLocaleString()} ft`],
    ['Waste', `${metrics.waste_pct}%`],
    ['Ridge', `${lin.ridge_ft || 0} LF`],
    ['Hip', `${lin.hip_ft || 0} LF`],
    ['Valley', `${lin.valley_ft || 0} LF`],
    ['Eave', `${lin.eave_ft || 0} LF`],
    ['Rake', `${lin.rake_ft || 0} LF`],
    ['Drip edge (eave + rake)', `${lin.drip_edge_ft || 0} LF`],
    ['Step / wall flashing', `${lin.flashing_ft || 0} LF`],
  ]
  // area-by-pitch lines
  const abp = metrics.area_by_pitch || {}
  Object.keys(abp).sort().forEach((k) => rows.push([`Area @ ${k}`, `${Number(abp[k]).toLocaleString()} ft2`]))

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text('Measurements', 40, y)
  y += 8
  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2])
  doc.setLineWidth(1.2)
  doc.line(40, y, W - 40, y)
  y += 14

  const pageH = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  rows.forEach(([k, v]) => {
    if (y > pageH - 50) { doc.addPage(); y = 50 }
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
    doc.text(String(k), 44, y)
    doc.setTextColor(DARK[0], DARK[1], DARK[2])
    doc.text(String(v), W - 44, y, { align: 'right' })
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(44, y + 4, W - 44, y + 4)
    y += 18
  })

  return doc
}

// Convenience: filename from a row.
export function pdfFilename(row) {
  const base = (row && (row.address || row.title)) ? String(row.address || row.title) : (row && row.id ? String(row.id) : 'report')
  const slug = base.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'report'
  return `Roof-Report-${slug}.pdf`
}
