import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HubPage, Section, EmptyState, useCrmClient } from '../_shared'
import { MapPin, Save, RotateCcw, CheckCircle2, Trash2, Plus, Search, FileText, X, Spline, Download, Sparkles, RefreshCw } from 'lucide-react'
import {
  LINE_TYPES, lineColor, lineTypeLabel,
  ensureTurf, ensurePdf,
  facetPlanFt2, lineLengthFt, feetInches,
  computeMetrics, buildSummary, dominantPitchLabel,
  diagramSvg, diagramPngSet, materialLineItems, buildPdf, pdfFilename,
  pitchMult, pitchLabel,
} from './roofReport'

// =====================================================================
// CrmMeasure (v3) - RoofR-style aerial roof takeoff (Operations hub).
// MapLibre GL + Esri World Imagery + turf.js (CDN at runtime). Trace each
// roof plane (facet) with its own pitch, AND tag linear features (ridge,
// hip, valley, eave, rake, flashing) as polylines. Computes a full roof
// report: squares, pitched/flat split, area-by-pitch, predominant pitch,
// linear feet by type + drip edge, perimeter, waste. Saves to
// ops_measurements (template_type='aerial_roof'), generates a schematic
// diagram + branded PDF, and seeds an estimate with auto material lines.
//
// measurements jsonb structure (NEW): { facets:[...], lines:[...] }
//   facets: [{ section, pitch, pitch_label, coords:[[lng,lat]...] }]
//   lines:  [{ id, type, coords:[[lng,lat]...], length_ft }]
// Backward-compat: an old row's measurements is a plain ARRAY -> treated as
// facets (see reopen() + normalizeMeasurements in roofReport.js).
// =====================================================================

const PITCHES = Array.from({ length: 13 }, (_, r) => r) // 0/12 .. 12/12

const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js'
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css'

const MAP_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Imagery (c) Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
}

// ---------- runtime CDN loader (idempotent) ----------
function loadScript(src) {
  return new Promise((resolve, reject) => {
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
function loadCss(href) {
  if (document.querySelector(`link[data-cdn="${href}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  l.dataset.cdn = href
  document.head.appendChild(l)
}
async function ensureMapLibs() {
  loadCss(MAPLIBRE_CSS)
  if (!window.maplibregl) await loadScript(MAPLIBRE_JS)
  await ensureTurf()
}

const fc = (features) => ({ type: 'FeatureCollection', features })
const contactLabel = (c) => [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id

// ---------- Solar auto-detect (Google Solar API via deployed edge fn) ----------
const SOLAR_FN_URL = 'https://qlerfkdyslndjbaltkwo.supabase.co/functions/v1/solar-roof'

// Convert an azimuth in degrees (0=N, 90=E, 180=S, 270=W) to an 8-point compass label.
function azimuthToCompass(deg) {
  const d = Number(deg)
  if (!isFinite(d)) return '-'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const idx = Math.round((((d % 360) + 360) % 360) / 45) % 8
  return dirs[idx]
}
// "7.4/12" or 7.4 -> "7/12" (round to nearest whole x/12 for the headline).
function roundPitchLabel(pitch) {
  if (pitch == null) return '-'
  let n = pitch
  if (typeof pitch === 'string') {
    const m = pitch.match(/-?\d+(\.\d+)?/)
    n = m ? parseFloat(m[0]) : NaN
  }
  n = Number(n)
  if (!isFinite(n)) return typeof pitch === 'string' ? pitch : '-'
  return `${Math.round(n)}/12`
}
// Count closed, valid (>=3 pt) facets in the live facets state.
const realFacetCount = (facets) => (facets || []).filter((f) => f.closed && Array.isArray(f.pts) && f.pts.length >= 3).length

// Persisted summary.solar shape (additive). Keeps the raw reliable metrics +
// the area estimate; `used_for_area` records whether the operator knowingly
// adopted the Solar area as the report number (only true on a no-trace save).
function buildSolarSummary(s, usedForArea) {
  if (!s) return null
  return {
    area_ft2: Number(s.area_ft2) || 0,
    squares: Number(s.squares) || 0,
    facet_count: Number(s.facet_count) || 0,
    predominant_pitch: s.predominant_pitch || null,
    pitched_ft2: Number(s.pitched_ft2) || 0,
    flat_ft2: Number(s.flat_ft2) || 0,
    segments: Array.isArray(s.segments) ? s.segments : [],
    imagery_date: s.imagery_date || null,
    imagery_quality: s.imagery_quality || null,
    used_for_area: !!usedForArea,
  }
}

// Format a Solar imagery_date {year,month,day} -> "Mar 2024" (day omitted if absent).
function solarImageryDate(d) {
  if (!d || d.year == null) return null
  const mo = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const m = Number(d.month) >= 1 && Number(d.month) <= 12 ? mo[Number(d.month)] : ''
  return [m, d.year].filter(Boolean).join(' ')
}

export default function CrmMeasure() {
  const { client, platform } = useCrmClient()
  const navigate = useNavigate()
  const { platformId } = useParams()

  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const drawingRef = useRef(false)      // facet draw active
  const lineDrawingRef = useRef(false)  // line draw active
  const lineTypeRef = useRef('ridge')   // current line type for active line
  const facetsRef = useRef([])          // [{id,pts:[[lng,lat]],pitch,closed}]
  const linesRef = useRef([])           // [{id,type,pts:[[lng,lat]],closed}]
  const idRef = useRef(0)

  const [ready, setReady] = useState(false)
  const [loadErr, setLoadErr] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const [lineDrawing, setLineDrawing] = useState(false)
  const [lineType, setLineType] = useState('ridge')
  const [facets, setFacets] = useState([])
  const [lines, setLines] = useState([])
  const [waste, setWaste] = useState(10)
  const [zoomHint, setZoomHint] = useState('Find an address to begin')

  // address search + autocomplete
  const [addr, setAddr] = useState('')
  const [title, setTitle] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const suggestTimer = useRef(null)

  // contact picker (optional)
  const [contacts, setContacts] = useState([])
  const [contactId, setContactId] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [contactMenuOpen, setContactMenuOpen] = useState(false)
  const contactBoxRef = useRef(null)

  // saved measurements
  const [saved, setSaved] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [creatingId, setCreatingId] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  // Solar auto-detect (Google Solar API). `solar` = last successful result;
  // `solarUsed` = the user knowingly adopted Solar area into the report metrics
  // (only allowed when no facets are traced -- traced area always wins).
  const [solar, setSolar] = useState(null)
  const [solarBusy, setSolarBusy] = useState(false)
  const [solarMsg, setSolarMsg] = useState(null)
  const [solarUsed, setSolarUsed] = useState(false)
  const [hasPin, setHasPin] = useState(false) // true once an address pin is dropped (reactive gate for Solar)

  const companyName = (platform && (platform.name || platform.company_name)) || 'Roof Report'

  // ---------- init map ----------
  useEffect(() => {
    let cancelled = false
    ensureMapLibs()
      .then(() => {
        if (cancelled || mapRef.current || !mapEl.current) return
        const maplibregl = window.maplibregl
        const map = new maplibregl.Map({
          container: mapEl.current,
          style: MAP_STYLE,
          center: [-81.6557, 30.3322],
          zoom: 11,
          maxZoom: 21,
          attributionControl: true,
        })
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
        map.on('load', () => {
          map.addSource('facets', { type: 'geojson', data: fc([]) })
          map.addLayer({
            id: 'facet-fill', type: 'fill', source: 'facets',
            paint: { 'fill-color': ['case', ['get', 'active'], '#2f6df6', '#34d399'], 'fill-opacity': 0.32 },
          })
          map.addLayer({
            id: 'facet-line', type: 'line', source: 'facets',
            paint: { 'line-color': ['case', ['get', 'active'], '#2f6df6', '#34d399'], 'line-width': 2.5 },
          })
          map.addSource('lines', { type: 'geojson', data: fc([]) })
          map.addLayer({
            id: 'line-stroke', type: 'line', source: 'lines',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'active'], 4, 3] },
          })
          map.addSource('verts', { type: 'geojson', data: fc([]) })
          map.addLayer({
            id: 'vert', type: 'circle', source: 'verts',
            paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#2f6df6', 'circle-stroke-width': 2.5 },
          })
          mapRef.current = map
          setReady(true)
        })
        map.on('click', onMapClick)
        map.on('zoom', () => {
          const z = map.getZoom()
          setZoomHint(z < 18 ? 'Zoom in closer to trace accurately' : 'Ready to trace')
        })
      })
      .catch((e) => setLoadErr(e.message || 'Map libraries failed to load'))
    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- load contacts ----------
  useEffect(() => {
    let cancelled = false
    if (!client) return
    ;(async () => {
      const { data } = await client
        .from('customer_contacts')
        .select('id, first_name, last_name, email')
        .order('created_at', { ascending: false })
        .limit(500)
      if (!cancelled) setContacts(data || [])
    })()
    return () => { cancelled = true }
  }, [client])

  useEffect(() => {
    function onDoc(e) {
      if (contactBoxRef.current && !contactBoxRef.current.contains(e.target)) setContactMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) || null,
    [contacts, contactId],
  )
  const contactMatches = useMemo(() => {
    const q = contactSearch.trim().toLowerCase()
    const list = q
      ? contacts.filter((c) => contactLabel(c).toLowerCase().includes(q) || String(c.email || '').toLowerCase().includes(q))
      : contacts
    return list.slice(0, 30)
  }, [contacts, contactSearch])

  // ---------- load saved ----------
  async function loadSaved() {
    if (!client) return
    const { data, error } = await client
      .from('ops_measurements')
      .select('id, title, address, status, summary, measurements, created_at, template_type, contact_id, project_id')
      .eq('template_type', 'aerial_roof')
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error) setSaved(data || [])
  }
  useEffect(() => { loadSaved() }, [client]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- map source sync ----------
  function syncMap() {
    const map = mapRef.current
    if (!map || !map.getSource('facets')) return
    const polys = [], verts = [], lineFeats = []
    facetsRef.current.forEach((f) => {
      const active = !f.closed
      if (f.pts.length >= 2) {
        if (f.closed && f.pts.length >= 3) {
          polys.push({ type: 'Feature', properties: { active }, geometry: { type: 'Polygon', coordinates: [[...f.pts, f.pts[0]]] } })
        } else {
          polys.push({ type: 'Feature', properties: { active }, geometry: { type: 'LineString', coordinates: f.pts.slice() } })
        }
      }
      if (active) f.pts.forEach((p) => verts.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }))
    })
    linesRef.current.forEach((l) => {
      const active = !l.closed
      if (l.pts.length >= 2) {
        lineFeats.push({ type: 'Feature', properties: { color: lineColor(l.type), active }, geometry: { type: 'LineString', coordinates: l.pts.slice() } })
      }
      if (active) l.pts.forEach((p) => verts.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }))
    })
    map.getSource('facets').setData(fc(polys))
    map.getSource('lines').setData(fc(lineFeats))
    map.getSource('verts').setData(fc(verts))
    setFacets(facetsRef.current.map((f) => ({ ...f, pts: f.pts.slice() })))
    setLines(linesRef.current.map((l) => ({ ...l, pts: l.pts.slice() })))
  }

  function activeFacet() { return facetsRef.current.find((f) => !f.closed) || null }
  function activeLine() { return linesRef.current.find((l) => !l.closed) || null }

  function onMapClick(e) {
    if (lineDrawingRef.current) {
      const al = activeLine()
      if (!al) return
      al.pts.push([e.lngLat.lng, e.lngLat.lat])
      syncMap()
      return
    }
    if (!drawingRef.current) return
    const af = activeFacet()
    if (!af) return
    af.pts.push([e.lngLat.lng, e.lngLat.lat])
    syncMap()
  }

  // ---------- facet draw controls ----------
  function addSection() {
    if (lineDrawingRef.current) finishLine() // mutually exclusive
    setConfirmOpen(false)
    facetsRef.current.push({ id: ++idRef.current, pitch: 6, pts: [], closed: false })
    drawingRef.current = true
    setDrawing(true)
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = 'crosshair'
    syncMap()
  }
  function undoPoint() {
    if (lineDrawingRef.current) {
      const al = activeLine()
      if (al && al.pts.length) { al.pts.pop(); syncMap() }
      return
    }
    const af = activeFacet()
    if (af && af.pts.length) { af.pts.pop(); syncMap() }
  }
  function doneSection() {
    const af = activeFacet()
    if (!af || af.pts.length < 3) return
    af.closed = true
    drawingRef.current = false
    setDrawing(false)
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = ''
    syncMap()
  }
  function deleteFacet(id) {
    facetsRef.current = facetsRef.current.filter((f) => f.id !== id)
    syncMap()
  }
  function setFacetPitch(id, rise) {
    const f = facetsRef.current.find((x) => x.id === id)
    if (f) { f.pitch = rise; syncMap() }
  }

  // ---------- line draw controls ----------
  function addLine() {
    if (drawingRef.current) doneSection() // close any open facet
    setConfirmOpen(false)
    lineTypeRef.current = lineType
    linesRef.current.push({ id: ++idRef.current, type: lineType, pts: [], closed: false })
    lineDrawingRef.current = true
    setLineDrawing(true)
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = 'crosshair'
    syncMap()
  }
  function finishLine() {
    const al = activeLine()
    if (al) {
      if (al.pts.length < 2) {
        // drop a degenerate line
        linesRef.current = linesRef.current.filter((l) => l.id !== al.id)
      } else {
        al.closed = true
      }
    }
    lineDrawingRef.current = false
    setLineDrawing(false)
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = ''
    syncMap()
  }
  function deleteLine(id) {
    linesRef.current = linesRef.current.filter((l) => l.id !== id)
    syncMap()
  }

  function clearAll() {
    facetsRef.current = []
    linesRef.current = []
    drawingRef.current = false
    lineDrawingRef.current = false
    setDrawing(false)
    setLineDrawing(false)
    setSolar(null)
    setSolarUsed(false)
    setSolarMsg(null)
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = ''
    syncMap()
  }

  // ---------- build facet/line plain objects (for metrics + save) ----------
  function facetObjects() {
    return facetsRef.current
      .filter((f) => f.closed && f.pts.length >= 3)
      .map((f, i) => ({ section: i + 1, pitch: f.pitch, pitch_label: pitchLabel(f.pitch), coords: f.pts.slice() }))
  }
  function lineObjects() {
    const turf = window.turf
    return linesRef.current
      .filter((l) => l.closed && l.pts.length >= 2)
      .map((l) => ({ id: l.id, type: l.type, coords: l.pts.slice(), length_ft: Math.round(lineLengthFt(turf, l.pts)) }))
  }

  // ---------- metrics (full roof report) ----------
  const metrics = useMemo(() => {
    const turf = window.turf
    if (!turf) return null
    const facetObjs = facets
      .filter((f) => f.closed && f.pts.length >= 3)
      .map((f, i) => ({ section: i + 1, pitch: f.pitch, pitch_label: pitchLabel(f.pitch), coords: f.pts }))
    const lineObjs = lines
      .filter((l) => l.closed && l.pts.length >= 2)
      .map((l) => ({ id: l.id, type: l.type, coords: l.pts, length_ft: lineLengthFt(turf, l.pts) }))
    return computeMetrics(turf, facetObjs, lineObjs, { waste_pct: waste })
  }, [facets, lines, waste])

  const hasMetrics = !!(metrics && metrics.facet_count > 0)
  const hasTrace = realFacetCount(facets) > 0

  // Build a metrics-shaped object from a Solar result so the existing report
  // panel can render Solar's reliable numbers when the user adopts them (no
  // trace). Solar gives no linear edges -> linear stays empty (manual only).
  function solarToMetrics(s) {
    if (!s) return null
    const sloped = Math.round(Number(s.area_ft2) || 0)
    const pitched = Math.round(Number(s.pitched_ft2) || 0)
    const flat = Math.round(Number(s.flat_ft2) || 0)
    const squares = Number(s.squares) || Math.round((sloped / 100) * 10) / 10
    const wasteN = Math.max(0, Math.min(40, Number(waste) || 0))
    const emptyLin = {
      eave_ft: 0, rake_ft: 0, ridge_ft: 0, hip_ft: 0, valley_ft: 0,
      step_flashing_ft: 0, wall_flashing_ft: 0, transition_ft: 0, parapet_ft: 0, unspecified_ft: 0,
      hips_ridges_ft: 0, eaves_rakes_ft: 0, drip_edge_ft: 0,
    }
    return {
      plan_ft2: sloped,
      sloped_ft2: sloped,
      squares,
      waste_pct: wasteN,
      facet_count: Number(s.facet_count) || 0,
      perimeter_ft: 0,
      predominant_pitch: roundPitchLabel(s.predominant_pitch),
      areas: {
        flat_ft2: flat,
        pitched_ft2: pitched,
        flat_squares: Math.round((flat / 100) * 10) / 10,
        pitched_squares: Math.round((pitched / 100) * 10) / 10,
      },
      area_by_pitch: {},
      squares_base: Math.round((sloped / 100) * 10) / 10,
      predominant_pitch_area: pitched,
      unspecified_pitch_area: 0,
      waste_table: [],
      linear: { ...emptyLin, eave_raw: 0, rake_raw: 0, ridge_raw: 0, hip_raw: 0, valley_raw: 0, step_flashing_raw: 0, wall_flashing_raw: 0, transition_raw: 0, parapet_raw: 0, unspecified_raw: 0, hips_ridges_raw: 0, eaves_rakes_raw: 0 },
      _solar_estimate: true,
    }
  }

  // What the report PANEL renders: traced metrics win whenever a facet exists.
  // Only with NO trace and an explicit "Use Solar area" do we show Solar numbers.
  const solarMetrics = useMemo(() => solarToMetrics(solar), [solar, waste]) // eslint-disable-line react-hooks/exhaustive-deps
  const displayMetrics = (hasTrace ? metrics : (solarUsed && solarMetrics ? solarMetrics : metrics))
  const displaySolarEstimate = !!(displayMetrics && displayMetrics._solar_estimate)

  // schematic SVG (live)
  const liveSvg = useMemo(() => {
    if (!hasMetrics) return null
    const turf = window.turf
    const facetObjs = facets.filter((f) => f.closed && f.pts.length >= 3).map((f) => ({ coords: f.pts, pitch: f.pitch }))
    const lineObjs = lines.filter((l) => l.closed && l.pts.length >= 2).map((l) => ({ type: l.type, coords: l.pts }))
    return diagramSvg(facetObjs, lineObjs, metrics, { w: 520, h: 320, variant: 'length' })
  }, [facets, lines, metrics, hasMetrics])

  // ---------- geocoding (Nominatim) ----------
  async function geocode(q, limit = 5) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=${limit}&q=${encodeURIComponent(q)}`
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    return r.json()
  }
  function onAddrChange(v) {
    setAddr(v)
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (!v.trim() || v.trim().length < 4) { setSuggestions([]); return }
    suggestTimer.current = setTimeout(async () => {
      try {
        const j = await geocode(v.trim(), 5)
        setSuggestions(Array.isArray(j) ? j : [])
      } catch { setSuggestions([]) }
    }, 350)
  }
  function placePin(lng, lat) {
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [lng, lat], zoom: 19.5, speed: 1.6 })
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = new window.maplibregl.Marker({ color: '#2f6df6', draggable: true })
      .setLngLat([lng, lat])
      .addTo(map)
    setHasPin(true)
    setConfirmOpen(true)
  }
  function chooseSuggestion(s) {
    setAddr(s.display_name)
    setSuggestions([])
    if (!title) setTitle(s.display_name.split(',').slice(0, 2).join(',').trim())
    placePin(+s.lon, +s.lat)
  }
  async function doSearch() {
    const q = addr.trim()
    if (!q) return
    setSearching(true); setSuggestions([])
    try {
      const j = await geocode(q, 1)
      if (Array.isArray(j) && j.length) {
        if (!title) setTitle(j[0].display_name.split(',').slice(0, 2).join(',').trim())
        placePin(+j[0].lon, +j[0].lat)
      }
    } catch { /* swallow */ }
    setSearching(false)
  }
  function confirmLocation() {
    setConfirmOpen(false)
    const map = mapRef.current
    if (map && markerRef.current) {
      const ll = markerRef.current.getLngLat()
      map.flyTo({ center: [ll.lng, ll.lat], zoom: 20, speed: 1.2 })
    }
  }

  // ---------- Solar auto-detect ----------
  // Calls the deployed edge fn with the CURRENT pin location. Fills reliable
  // metrics (facets/pitch/pitched-flat); area stays an explicit ESTIMATE.
  async function detectSolar() {
    const mk = markerRef.current
    if (!mk) { setSolarMsg('Find an address and drop the pin first.'); return }
    const ll = mk.getLngLat()
    setSolarBusy(true); setSolarMsg(null)
    try {
      const r = await fetch(SOLAR_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: ll.lat, lng: ll.lng }),
      })
      let j = null
      try { j = await r.json() } catch { j = null }
      if (j && j.found) {
        setSolar(j)
        setSolarUsed(false) // never auto-adopt area; user opts in
        setSolarMsg(null)
      } else if (j && j.found === false) {
        setSolar(null)
        setSolarMsg("Auto-detect is not available at this location. Trace the roof manually.")
      } else if (j && j.needs_key) {
        setSolar(null)
        setSolarMsg("Auto-detect is not configured yet (missing API key).")
      } else if (j && j.error) {
        setSolar(null)
        setSolarMsg('Auto-detect failed: ' + String(j.error))
      } else {
        setSolar(null)
        setSolarMsg('Auto-detect failed. Try again or trace manually.')
      }
    } catch (e) {
      setSolar(null)
      setSolarMsg(e.message || 'Auto-detect failed.')
    } finally {
      setSolarBusy(false)
    }
  }

  // Adopt Solar area/squares/pitched/flat into the report metrics. Only offered
  // when NO facets are traced (traced area is always authoritative otherwise).
  function useSolarArea() {
    if (!solar || hasTrace) return
    setSolarUsed(true)
    setSolarMsg(null)
  }

  async function resolveProjectId(cid) {
    if (!cid || !client) return null
    try {
      const { data } = await client
        .from('customer_projects')
        .select('id')
        .eq('contact_id', cid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data?.id || null
    } catch { return null }
  }

  // ---------- save ----------
  async function save() {
    if (!client) return
    const facetObjs = facetObjects()
    const lineObjs = lineObjects()
    // Two valid save paths:
    //  (a) traced facets -> traced metrics are authoritative.
    //  (b) NO trace but the operator adopted Solar area -> Solar-only save.
    const solarOnly = !facetObjs.length && solarUsed && !!solarMetrics
    if (!facetObjs.length && !solarOnly) {
      setSaveMsg('Trace at least one roof section, or run auto-detect and use the estimated area.')
      return
    }
    setSaving(true); setSaveMsg(null)
    try {
      const turf = window.turf
      let summary
      if (solarOnly) {
        // Build summary from the Solar-derived metrics (no manual geometry).
        summary = buildSummary(solarMetrics)
        summary.solar = buildSolarSummary(solar, true)
      } else {
        const m = computeMetrics(turf, facetObjs, lineObjs, { waste_pct: waste })
        summary = buildSummary(m)
        // Solar provenance (additive, optional). Reliable metrics + the area
        // ESTIMATE are persisted for reference; used_for_area is false here
        // because traced area is authoritative when facets exist.
        if (solar) summary.solar = buildSolarSummary(solar, false)
      }
      const userRes = await client.auth.getUser()
      const uid = userRes?.data?.user?.id || null
      const projectId = contactId ? await resolveProjectId(contactId) : null
      const { error } = await client.from('ops_measurements').insert({
        title: (title.trim() || addr.trim() || 'Aerial roof measurement'),
        template_type: 'aerial_roof',
        status: 'measured',
        address: addr.trim() || null,
        contact_id: contactId || null,
        project_id: projectId,
        measurements: { facets: facetObjs, lines: lineObjs },
        summary,
        photos: [],
        diagrams: [],
        measured_by: uid,
        measured_at: new Date().toISOString(),
      })
      if (error) throw error
      setSaveMsg('Saved.')
      loadSaved()
    } catch (e) {
      setSaveMsg(e.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  // ---------- download PDF (live) ----------
  async function downloadPdf() {
    if (!hasMetrics) return
    setPdfBusy(true)
    try {
      const jsPDF = await ensurePdf()
      const facetObjs = facetObjects()
      const lineObjs = lineObjects()
      const pngSet = diagramPngSet(facetObjs, lineObjs, metrics, { w: 640, h: 440 })
      const row = {
        title: title.trim() || addr.trim() || 'Aerial roof measurement',
        address: addr.trim() || '',
        customerName: selectedContact ? contactLabel(selectedContact) : '',
        created_at: new Date().toISOString(),
      }
      const doc = buildPdf(jsPDF, { row, metrics, pngSet, companyName })
      doc.save(pdfFilename(row))
    } catch (e) {
      setSaveMsg(e.message || 'PDF export failed.')
    } finally {
      setPdfBusy(false)
    }
  }

  // ---------- create estimate from a measurement ----------
  async function createEstimateFrom({ cid, projectId, metricsObj, facetObjs, label }) {
    if (!client) return
    if (!cid) { setSaveMsg('Select a contact first to create an estimate.'); return }
    setCreatingId(label)
    try {
      const en = 'EST-' + Date.now().toString().slice(-6)
      const rid = () => Math.random().toString(36).slice(2, 10)
      const seed = [
        { id: rid(), title: 'Materials', enabled: true, items: [] },
        { id: rid(), title: 'Labor', enabled: true, items: [] },
        { id: rid(), title: 'Fees', enabled: true, items: [] },
      ]
      let margin = 50
      let productByName = {}
      try {
        const { data: st } = await client.from('estimate_settings').select('default_gross_margin').limit(1).maybeSingle()
        if (st && st.default_gross_margin != null) margin = st.default_gross_margin
        const { data: prods } = await client.from('estimate_products').select('*').eq('is_active', true).eq('in_default_template', true).order('name', { ascending: true })
        ;(prods || []).forEach((pr) => {
          productByName[String(pr.name).toLowerCase()] = pr
          const item = { id: rid(), description: pr.name, qty: 1, unit: pr.unit || '', unit_cost: Number(pr.cost) || 0 }
          ;(pr.item_type === 'labor' ? seed[1] : seed[0]).items.push(item)
        })
      } catch (seedErr) { console.error(seedErr) }

      // append auto roof material lines into Materials (seed[0])
      if (metricsObj) {
        const matItems = materialLineItems(metricsObj, productByName)
        seed[0].items.push(...matItems)
      }

      const squares = Number(metricsObj?.squares) || 0
      const wastePct = metricsObj?.waste_pct != null ? Number(metricsObj.waste_pct) : 0
      const meas = {
        squares,
        waste_pct: wastePct,
        pitch: metricsObj?.predominant_pitch || dominantPitchLabel(facetObjs),
        layers: 1,
        stories: 1,
      }

      const payload = {
        contact_id: cid,
        project_id: projectId || null,
        estimate_number: en,
        title: 'New Estimate',
        status: 'draft',
        sections: seed,
        gross_margin: margin,
        measurements: meas,
      }
      const { data, error } = await client.from('customer_estimates').insert(payload).select().single()
      if (error) throw error
      navigate('/crm/' + platformId + '/estimates/' + data.id)
    } catch (e) {
      console.error(e)
      setSaveMsg(e.message || 'Could not create estimate.')
    } finally {
      setCreatingId(null)
    }
  }

  async function createEstimateFromCurrent() {
    const facetObjs = facetObjects()
    if (!facetObjs.length) { setSaveMsg('Trace at least one roof section first.'); return }
    if (!contactId) { setSaveMsg('Select a contact first to create an estimate.'); return }
    const turf = window.turf
    const m = computeMetrics(turf, facetObjs, lineObjects(), { waste_pct: waste })
    const projectId = await resolveProjectId(contactId)
    await createEstimateFrom({ cid: contactId, projectId, metricsObj: m, facetObjs, label: 'current' })
  }

  async function createEstimateFromRow(row, e) {
    if (e) e.stopPropagation()
    const cid = row.contact_id || contactId
    if (!cid) { setSaveMsg('This measurement has no contact. Reopen it, pick a contact, and re-save first.'); return }
    const projectId = row.project_id || (await resolveProjectId(cid))
    const turf = window.turf
    // Prefer the saved summary metrics; if missing linear, recompute from geometry.
    const sm = row.summary || {}
    const norm = (Array.isArray(row.measurements)
      ? { facets: row.measurements, lines: [] }
      : { facets: (row.measurements && row.measurements.facets) || [], lines: (row.measurements && row.measurements.lines) || [] })
    let m = sm.linear ? sm : null
    if (!m && turf) m = computeMetrics(turf, norm.facets, norm.lines, { waste_pct: sm.waste_pct != null ? sm.waste_pct : 10 })
    if (!m) m = { squares: sm.squares || 0, waste_pct: sm.waste_pct || 0, predominant_pitch: sm.predominant_pitch || '', linear: sm.linear || {} }
    await createEstimateFrom({ cid, projectId, metricsObj: m, facetObjs: norm.facets, label: row.id })
  }

  // ---------- PDF from a saved row ----------
  async function downloadRowPdf(row, e) {
    if (e) e.stopPropagation()
    setPdfBusy(true)
    try {
      const jsPDF = await ensurePdf()
      const turf = await ensureTurf()
      const norm = (Array.isArray(row.measurements)
        ? { facets: row.measurements, lines: [] }
        : { facets: (row.measurements && row.measurements.facets) || [], lines: (row.measurements && row.measurements.lines) || [] })
      const sm = row.summary || {}
      // For PDF fidelity (ft+in + per-facet area labels) recompute from geometry so
      // raw line lengths + facet areas are present even for older summary-only rows.
      let m = computeMetrics(turf, norm.facets, norm.lines, { waste_pct: sm.waste_pct != null ? sm.waste_pct : 10 })
      const pngSet = diagramPngSet(norm.facets, norm.lines, m, { w: 640, h: 440 })
      const cust = contacts.find((c) => c.id === row.contact_id)
      const rowObj = {
        title: row.title || 'Aerial roof measurement',
        address: row.address || '',
        customerName: cust ? contactLabel(cust) : '',
        created_at: row.created_at,
        id: row.id,
      }
      const doc = buildPdf(jsPDF, { row: rowObj, metrics: m, pngSet, companyName })
      doc.save(pdfFilename(rowObj))
    } catch (err) {
      setSaveMsg(err.message || 'PDF export failed.')
    } finally {
      setPdfBusy(false)
    }
  }

  // ---------- reopen a saved measurement ----------
  // Backward-compat: old rows store measurements as a plain ARRAY (facets only);
  // new rows store { facets, lines }. Both reopen cleanly.
  function reopen(row) {
    clearAll()
    const norm = (Array.isArray(row.measurements)
      ? { facets: row.measurements, lines: [] }
      : { facets: (row.measurements && row.measurements.facets) || [], lines: (row.measurements && row.measurements.lines) || [] })
    facetsRef.current = norm.facets
      .filter((l) => Array.isArray(l.coords) && l.coords.length >= 3)
      .map((l) => ({ id: ++idRef.current, pitch: Number(l.pitch) || 6, pts: l.coords.map((c) => [c[0], c[1]]), closed: true }))
    linesRef.current = norm.lines
      .filter((l) => Array.isArray(l.coords) && l.coords.length >= 2)
      .map((l) => ({ id: ++idRef.current, type: l.type || 'ridge', pts: l.coords.map((c) => [c[0], c[1]]), closed: true }))
    setTitle(row.title || '')
    setAddr(row.address || '')
    if (row.contact_id) { setContactId(row.contact_id); setContactSearch('') }
    if (row.summary?.waste_pct != null) setWaste(row.summary.waste_pct)
    // Restore Solar provenance (reference card). If it was the area source and
    // there is no traced geometry, re-adopt it so the panel shows Solar numbers.
    const sol = row.summary?.solar
    if (sol) {
      setSolar({
        found: true,
        area_ft2: sol.area_ft2, whole_roof_ft2: sol.area_ft2, squares: sol.squares,
        facet_count: sol.facet_count, predominant_pitch: sol.predominant_pitch,
        pitched_ft2: sol.pitched_ft2, flat_ft2: sol.flat_ft2,
        segments: Array.isArray(sol.segments) ? sol.segments : [],
        imagery_date: sol.imagery_date || null, imagery_quality: sol.imagery_quality || null,
      })
      if (sol.used_for_area && facetsRef.current.length === 0) setSolarUsed(true)
    }
    syncMap()
    const first = facetsRef.current[0] || linesRef.current[0]
    if (first && mapRef.current) {
      const c = first.pts[0]
      mapRef.current.flyTo({ center: [c[0], c[1]], zoom: 19.5, speed: 1.4 })
    }
  }

  const realFacets = facets.filter((f) => f.closed && f.pts.length >= 3)
  const realLines = lines.filter((l) => l.closed && l.pts.length >= 2)
  const af = facets.find((f) => !f.closed)
  const lin = metrics ? metrics.linear : {}          // edges = MANUAL only
  const areas = metrics ? metrics.areas : {}
  // Summary header numbers can reflect adopted Solar area (no-trace case).
  const dm = displayMetrics
  const dmAreas = dm ? dm.areas : {}
  const canSave = realFacets.length > 0 || (solarUsed && !!solarMetrics)

  return (
    <HubPage
      title="Roof Measure"
      subtitle="Trace each roof plane, tag ridge/hip/valley/eave lines, and build a full takeoff report."
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPdf}
            disabled={pdfBusy || !hasMetrics}
            title={hasMetrics ? 'Download a branded PDF report' : 'Trace a roof first'}
            className="inline-flex items-center gap-2 bg-navy-800 border border-navy-700/60 hover:bg-navy-700/50 disabled:opacity-40 text-gray-200 text-sm font-medium px-3.5 py-2 rounded-lg"
          >
            <Download size={16} /> {pdfBusy ? 'Building...' : 'Download report (PDF)'}
          </button>
          <button
            onClick={createEstimateFromCurrent}
            disabled={!!creatingId || !realFacets.length || !contactId}
            title={!contactId ? 'Pick a contact above to enable' : 'Create a pre-priced estimate draft'}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-600/90 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <FileText size={16} /> {creatingId === 'current' ? 'Creating...' : 'Create estimate'}
          </button>
          <button
            onClick={save}
            disabled={saving || !canSave}
            className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save measurement'}
          </button>
        </div>
      }
    >
      {loadErr && (
        <div className="mb-4 bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-lg px-4 py-3">
          {loadErr}
        </div>
      )}

      {/* address search + contact picker */}
      <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={addr}
                onChange={(e) => onAddrChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }}
                placeholder="Enter a property address"
                className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue"
              />
            </div>
            <button
              onClick={doSearch}
              disabled={searching}
              className="inline-flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              <MapPin size={15} /> {searching ? '...' : 'Find'}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute z-30 mt-1 left-0 right-0 bg-navy-800 border border-navy-700/60 rounded-lg overflow-hidden shadow-xl">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => chooseSuggestion(s)}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-brand-blue/20 border-b border-navy-700/40 last:border-0"
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Measurement title (optional)"
          className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue"
        />

        <div className="relative" ref={contactBoxRef}>
          {selectedContact ? (
            <div className="flex items-center justify-between w-full bg-navy-900/60 border border-navy-700/60 rounded-lg pl-3 pr-2 py-2">
              <span className="text-sm text-white truncate">{contactLabel(selectedContact)}</span>
              <button
                onClick={() => { setContactId(''); setContactSearch(''); setContactMenuOpen(false) }}
                className="text-gray-400 hover:text-white shrink-0 ml-2"
                title="Clear contact"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={contactSearch}
                onChange={(e) => { setContactSearch(e.target.value); setContactMenuOpen(true) }}
                onFocus={() => setContactMenuOpen(true)}
                placeholder="Link a customer (optional)"
                className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue"
              />
            </div>
          )}
          {contactMenuOpen && !selectedContact && (
            <div className="absolute z-30 mt-1 left-0 right-0 max-h-64 overflow-auto bg-navy-800 border border-navy-700/60 rounded-lg shadow-xl">
              {contactMatches.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No matching customers</div>
              ) : (
                contactMatches.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setContactId(c.id); setContactMenuOpen(false); setContactSearch('') }}
                    className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-brand-blue/20 border-b border-navy-700/40 last:border-0"
                  >
                    <span className="text-white">{contactLabel(c)}</span>
                    {c.email ? <span className="text-xs text-gray-500 ml-2">{c.email}</span> : null}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MAP */}
        <div className="lg:col-span-2">
          <div className="relative bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
            <div ref={mapEl} className="w-full" style={{ height: '520px' }} />
            {confirmOpen && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-navy-900/95 border border-navy-700/60 rounded-full pl-4 pr-2 py-1.5 shadow-lg">
                <span className="text-xs text-gray-200">Drag the pin onto the correct roof</span>
                <button onClick={confirmLocation} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                  Confirm location
                </button>
              </div>
            )}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-xs text-gray-300 bg-navy-900/80 border border-navy-700/50 rounded-full px-3 py-1">
              {lineDrawing ? `Drawing ${lineTypeLabel(lineType)} - tap vertices, then Finish line` : drawing ? 'Tracing - tap each corner of one plane' : zoomHint}
            </div>
          </div>

          {/* facet draw toolbar */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={addSection} disabled={!ready || drawing || lineDrawing} className="inline-flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-40 text-white text-sm font-medium px-3.5 py-2 rounded-lg">
              <Plus size={15} /> Add roof section
            </button>
            <button onClick={undoPoint} disabled={!drawing && !lineDrawing} className="inline-flex items-center gap-1.5 bg-navy-800 border border-navy-700/60 hover:bg-navy-700/50 disabled:opacity-40 text-gray-200 text-sm px-3.5 py-2 rounded-lg">
              <RotateCcw size={15} /> Undo point
            </button>
            <button onClick={doneSection} disabled={!af || af.pts.length < 3} className="inline-flex items-center gap-1.5 bg-navy-800 border border-navy-700/60 hover:bg-navy-700/50 disabled:opacity-40 text-gray-200 text-sm px-3.5 py-2 rounded-lg">
              <CheckCircle2 size={15} /> Done section
            </button>
            <button onClick={clearAll} disabled={!facets.length && !lines.length} className="inline-flex items-center gap-1.5 bg-navy-800 border border-navy-700/60 hover:bg-navy-700/50 disabled:opacity-40 text-gray-400 text-sm px-3.5 py-2 rounded-lg">
              <Trash2 size={15} /> Clear all
            </button>
            <button
              onClick={detectSolar}
              disabled={solarBusy || !hasPin}
              title={hasPin ? 'Auto-detect roof metrics from aerial imagery' : 'Find an address and drop the pin first'}
              className="inline-flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-40 text-white text-sm font-medium px-3.5 py-2 rounded-lg"
            >
              {solarBusy ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {solarBusy ? 'Detecting...' : 'Auto-detect roof'}
            </button>
          </div>

          {/* line takeoff toolbar */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={lineType}
              onChange={(e) => setLineType(e.target.value)}
              disabled={lineDrawing}
              className="bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue disabled:opacity-50"
            >
              {LINE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            {!lineDrawing ? (
              <button onClick={addLine} disabled={!ready || drawing} className="inline-flex items-center gap-1.5 bg-navy-800 border border-navy-700/60 hover:bg-navy-700/50 disabled:opacity-40 text-gray-200 text-sm px-3.5 py-2 rounded-lg">
                <Spline size={15} /> Add line
              </button>
            ) : (
              <button onClick={finishLine} className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-600/90 text-white text-sm font-medium px-3.5 py-2 rounded-lg">
                <CheckCircle2 size={15} /> Finish line
              </button>
            )}
            {/* legend */}
            <div className="flex flex-wrap items-center gap-3 ml-1">
              {LINE_TYPES.map((t) => (
                <span key={t.key} className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="inline-block w-4 h-1 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* PANEL */}
        <div className="space-y-4">
          {/* roof report summary */}
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Waste factor</span>
              <span className="flex items-center gap-1 text-sm text-white">
                <input
                  type="number" min="0" max="40" step="1" value={waste}
                  onChange={(e) => setWaste(e.target.value)}
                  className="w-16 bg-navy-900/60 border border-navy-700/60 rounded px-2 py-1 text-right text-white focus:outline-none focus:border-brand-blue"
                /> %
              </span>
            </div>
            {displaySolarEstimate && (
              <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-light bg-brand-blue/15 border border-brand-blue/30 rounded-full px-2.5 py-1">
                <Sparkles size={12} /> Estimated area (verify by tracing)
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-navy-700/50 pt-3">
              <span className="text-xs text-gray-400">Sloped surface</span>
              <span className="text-2xl font-bold text-white">{(dm ? dm.sloped_ft2 : 0).toLocaleString()}<span className="text-sm text-gray-400 ml-1">ft2</span></span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xs text-gray-400">Order quantity</span>
              <span className="text-2xl font-bold text-emerald-400">{(dm ? Number(dm.squares) : 0).toFixed(1)}<span className="text-sm text-gray-400 ml-1">sq</span></span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-navy-900/50 rounded-lg px-3 py-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Pitched</div>
                <div className="text-sm text-gray-200">{(dmAreas.pitched_ft2 || 0).toLocaleString()} ft2</div>
                <div className="text-[10px] text-gray-500">{(dmAreas.pitched_squares || 0).toFixed ? (dmAreas.pitched_squares || 0).toFixed(1) : dmAreas.pitched_squares} sq</div>
              </div>
              <div className="bg-navy-900/50 rounded-lg px-3 py-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Flat / low</div>
                <div className="text-sm text-gray-200">{(dmAreas.flat_ft2 || 0).toLocaleString()} ft2</div>
                <div className="text-[10px] text-gray-500">{(dmAreas.flat_squares || 0).toFixed ? (dmAreas.flat_squares || 0).toFixed(1) : dmAreas.flat_squares} sq</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Plan {(dm ? dm.plan_ft2 : 0).toLocaleString()} ft2 - {dm ? dm.facet_count : 0} facet{(dm && dm.facet_count === 1) ? '' : 's'} - perimeter {(dm ? dm.perimeter_ft : 0).toLocaleString()} ft - predominant {(dm && dm.predominant_pitch) || '-'}
            </p>
            {saveMsg && <p className="text-xs mt-2 text-gray-300">{saveMsg}</p>}
          </div>

          {/* Solar auto-detect card */}
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
                <Sparkles size={14} className="text-brand-light" /> Roof auto-detect
              </span>
              <button
                onClick={detectSolar}
                disabled={solarBusy || !hasPin}
                title={hasPin ? 'Auto-detect roof metrics from aerial imagery' : 'Find an address and drop the pin first'}
                className="inline-flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
              >
                {solarBusy ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {solarBusy ? 'Detecting...' : (solar ? 'Re-detect' : 'Auto-detect roof')}
              </button>
            </div>

            {!solar && !solarMsg && (
              <p className="text-xs text-gray-500">
                Drop a pin, then auto-detect facet count, pitch, and pitched/flat split from aerial imagery. Area is an estimate - trace facets for an authoritative number.
              </p>
            )}
            {solarMsg && <p className="text-xs text-gray-300">{solarMsg}</p>}

            {solar && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-navy-900/50 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Facets</div>
                    <div className="text-sm text-gray-200">{Number(solar.facet_count) || 0}</div>
                  </div>
                  <div className="bg-navy-900/50 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Predominant pitch</div>
                    <div className="text-sm text-gray-200">
                      {roundPitchLabel(solar.predominant_pitch)}
                      {solar.predominant_pitch ? <span className="text-[10px] text-gray-500 ml-1">({solar.predominant_pitch})</span> : null}
                    </div>
                  </div>
                  <div className="bg-navy-900/50 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Pitched</div>
                    <div className="text-sm text-gray-200">{(Number(solar.pitched_ft2) || 0).toLocaleString()} ft2</div>
                  </div>
                  <div className="bg-navy-900/50 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">Flat / low</div>
                    <div className="text-sm text-gray-200">{(Number(solar.flat_ft2) || 0).toLocaleString()} ft2</div>
                  </div>
                </div>

                <div className="bg-brand-blue/10 border border-brand-blue/25 rounded-lg px-3 py-2.5">
                  <div className="text-sm text-brand-light font-semibold">
                    Estimated area: {(Number(solar.area_ft2) || 0).toLocaleString()} sqft
                    <span className="text-gray-300 font-normal"> (~{(Number(solar.squares) || 0).toFixed(1)} sq)</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Verify by tracing - auto-detected area runs ~14% high vs trade measurements.
                  </div>
                </div>

                {Array.isArray(solar.segments) && solar.segments.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Segments (orientation / pitch / area)</div>
                    <div className="space-y-1 text-sm max-h-44 overflow-auto pr-1">
                      {solar.segments.map((sg, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-gray-400">
                            <span className="text-gray-200">{azimuthToCompass(sg.azimuth_deg)}</span>
                            <span className="text-gray-500 ml-2">{sg.pitch_x12 != null ? `${Number(sg.pitch_x12).toFixed(1)}/12` : '-'}</span>
                            {sg.pitch_deg != null ? <span className="text-gray-600 ml-1">({Number(sg.pitch_deg).toFixed(0)} deg)</span> : null}
                          </span>
                          <span className="text-gray-300">{(Number(sg.area_ft2) || 0).toLocaleString()} ft2</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-navy-700/50 pt-2">
                  <span>{solarImageryDate(solar.imagery_date) ? `Imagery ${solarImageryDate(solar.imagery_date)}` : 'Imagery date n/a'}</span>
                  <span className="capitalize">{solar.imagery_quality ? String(solar.imagery_quality).toLowerCase() + ' quality' : ''}</span>
                </div>

                {/* adoption / comparison */}
                {!hasTrace ? (
                  solarUsed ? (
                    <button
                      onClick={() => setSolarUsed(false)}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-navy-900/60 border border-navy-700/60 hover:bg-navy-700/50 text-gray-200 text-xs font-medium px-3 py-2 rounded-lg"
                    >
                      <X size={13} /> Estimated area in use - revert
                    </button>
                  ) : (
                    <button
                      onClick={useSolarArea}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-600/90 text-white text-xs font-semibold px-3 py-2 rounded-lg"
                    >
                      <CheckCircle2 size={13} /> Use estimated area (fast)
                    </button>
                  )
                ) : (
                  <div className="text-[11px] text-gray-500 bg-navy-900/40 rounded-lg px-3 py-2">
                    Traced area is authoritative ({(metrics ? metrics.sloped_ft2 : 0).toLocaleString()} ft2).
                    {(() => {
                      const traced = metrics ? metrics.sloped_ft2 : 0
                      const sol = Number(solar.area_ft2) || 0
                      if (!traced || !sol) return null
                      const delta = sol - traced
                      const pct = (delta / traced) * 100
                      return <span className="text-gray-400"> Auto-detect {delta >= 0 ? '+' : ''}{delta.toLocaleString()} ft2 ({pct >= 0 ? '+' : ''}{pct.toFixed(0)}%).</span>
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* length report - all 10 edge types in ft+in */}
          <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-5">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Length report</div>
            <div className="space-y-1.5 text-sm">
              {[
                ['eave', 'Eaves', lin.eave_raw, lin.eave_ft],
                ['valley', 'Valleys', lin.valley_raw, lin.valley_ft],
                ['hip', 'Hips', lin.hip_raw, lin.hip_ft],
                ['ridge', 'Ridges', lin.ridge_raw, lin.ridge_ft],
                ['rake', 'Rakes', lin.rake_raw, lin.rake_ft],
                ['wall_flashing', 'Wall flashing', lin.wall_flashing_raw, lin.wall_flashing_ft],
                ['step_flashing', 'Step flashing', lin.step_flashing_raw, lin.step_flashing_ft],
                ['transition', 'Transitions', lin.transition_raw, lin.transition_ft],
                ['parapet', 'Parapet wall', lin.parapet_raw, lin.parapet_ft],
                ['unspecified', 'Unspecified', lin.unspecified_raw, lin.unspecified_ft],
              ].map(([k, label, raw, ft]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-gray-400">
                    <span className="inline-block w-3 h-1 rounded-full" style={{ backgroundColor: lineColor(k) }} />
                    {label}
                  </span>
                  <span className="text-gray-200">{feetInches(raw != null ? raw : (ft || 0))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-navy-700/50 pt-1.5 mt-1.5">
                <span className="text-gray-400">Hips + ridges</span>
                <span className="text-white font-semibold">{feetInches(lin.hips_ridges_raw != null ? lin.hips_ridges_raw : (lin.hips_ridges_ft || 0))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Eaves + rakes (drip edge)</span>
                <span className="text-white font-semibold">{feetInches(lin.eaves_rakes_raw != null ? lin.eaves_rakes_raw : (lin.eaves_rakes_ft || 0))}</span>
              </div>
            </div>
          </div>

          {/* area report */}
          {metrics && (
            <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Area report</div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total area</span>
                  <span className="text-white font-semibold">{(metrics.sloped_ft2 || 0).toLocaleString()} ft2</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Pitched area</span>
                  <span className="text-gray-200">{(areas.pitched_ft2 || 0).toLocaleString()} ft2</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Flat / low-slope area</span>
                  <span className="text-gray-200">{(areas.flat_ft2 || 0).toLocaleString()} ft2</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Predominant pitch</span>
                  <span className="text-gray-200">{metrics.predominant_pitch || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Predominant pitch area</span>
                  <span className="text-gray-200">{(metrics.predominant_pitch_area || 0).toLocaleString()} ft2</span>
                </div>
              </div>
            </div>
          )}

          {/* waste table */}
          {metrics && Array.isArray(metrics.waste_table) && metrics.waste_table.length > 0 && (
            <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Waste table</div>
              <div className="grid grid-cols-3 text-[11px] text-gray-500 uppercase tracking-wider pb-1.5 border-b border-navy-700/50">
                <span>Waste</span>
                <span className="text-right">Area</span>
                <span className="text-right">Squares</span>
              </div>
              <div className="text-sm">
                {metrics.waste_table.map((r) => (
                  <div
                    key={r.pct}
                    className={`grid grid-cols-3 py-1.5 ${r.recommended ? 'bg-brand-blue/10 -mx-2 px-2 rounded' : ''}`}
                  >
                    <span className={r.recommended ? 'text-brand-light font-semibold' : 'text-gray-400'}>
                      {r.pct}%{r.recommended ? ' *' : ''}
                    </span>
                    <span className="text-right text-gray-200">{Number(r.area).toLocaleString()}</span>
                    <span className="text-right text-gray-200">{Number(r.squares).toFixed(1)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-2">* Recommended waste factor</p>
            </div>
          )}

          {/* area by pitch */}
          {metrics && Object.keys(metrics.area_by_pitch || {}).length > 0 && (
            <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Area by pitch</div>
              <div className="space-y-1.5 text-sm">
                {Object.keys(metrics.area_by_pitch).sort().map((k) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-gray-400">{k}</span>
                    <span className="text-gray-200">{Number(metrics.area_by_pitch[k]).toLocaleString()} ft2</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* schematic diagram */}
          {liveSvg && (
            <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-3">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 px-2">Schematic</div>
              <div className="rounded-lg overflow-hidden" dangerouslySetInnerHTML={{ __html: liveSvg }} />
            </div>
          )}

          {/* sections */}
          <Section title="Sections">
            {realFacets.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No sections yet" description="Trace each roof plane separately so each can carry its own pitch." />
              </div>
            ) : (
              <div className="divide-y divide-navy-700/50">
                {realFacets.map((f, i) => {
                  const plan = window.turf ? facetPlanFt2(window.turf, f.pts) : 0
                  const surf = plan * pitchMult(f.pitch)
                  return (
                    <div key={f.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-white">Section <span className="text-brand-blue">{i + 1}</span></span>
                        <button onClick={() => deleteFacet(f.id)} className="text-xs text-gray-400 hover:text-red-300">Delete</button>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-400">Pitch</span>
                        <select
                          value={f.pitch}
                          onChange={(e) => setFacetPitch(f.id, Number(e.target.value))}
                          className="bg-navy-900/60 border border-navy-700/60 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-brand-blue"
                        >
                          {PITCHES.map((r) => <option key={r} value={r}>{pitchLabel(r)}</option>)}
                        </select>
                        <span className="text-xs text-gray-500">x {pitchMult(f.pitch).toFixed(3)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Plan area</span><span className="text-gray-200">{Math.round(plan).toLocaleString()} ft2</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                        <span>Sloped surface</span><span className="text-gray-200">{Math.round(surf).toLocaleString()} ft2</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* lines */}
          <Section title="Lines">
            {realLines.length === 0 ? (
              <div className="px-5 py-4 text-sm text-gray-500">No lines yet. Pick a type, tap Add line, trace, then Finish line.</div>
            ) : (
              <div className="divide-y divide-navy-700/50">
                {realLines.map((l) => {
                  const len = window.turf ? lineLengthFt(window.turf, l.pts) : 0
                  return (
                    <div key={l.id} className="px-5 py-2.5 flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-sm text-gray-200">
                        <span className="inline-block w-3 h-1 rounded-full" style={{ backgroundColor: lineColor(l.type) }} />
                        {lineTypeLabel(l.type)}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-sm text-gray-300">{Math.round(len).toLocaleString()} LF</span>
                        <button onClick={() => deleteLine(l.id)} className="text-xs text-gray-400 hover:text-red-300">Delete</button>
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* saved */}
          <Section title="Saved measurements">
            {saved.length === 0 ? (
              <div className="px-5 py-4 text-sm text-gray-500">No saved aerial measurements yet.</div>
            ) : (
              <div className="divide-y divide-navy-700/50">
                {saved.map((row) => (
                  <div key={row.id} className="px-5 py-3 hover:bg-navy-700/30">
                    <button onClick={() => reopen(row)} className="block w-full text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white truncate">{row.title || 'Untitled'}</span>
                        <span className="text-xs text-emerald-400 shrink-0 ml-2">{row.summary?.squares ?? '-'} sq</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {row.address || 'No address'} - {new Date(row.created_at).toLocaleDateString()}
                      </div>
                    </button>
                    <div className="mt-2 flex items-center gap-4">
                      <button
                        onClick={(e) => createEstimateFromRow(row, e)}
                        disabled={creatingId === row.id}
                        title={row.contact_id ? 'Create a pre-priced estimate draft' : 'Reopen, pick a contact, and re-save to enable'}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                      >
                        <FileText size={13} /> {creatingId === row.id ? 'Creating...' : 'Create estimate'}
                      </button>
                      <button
                        onClick={(e) => downloadRowPdf(row, e)}
                        disabled={pdfBusy}
                        title="Download a branded PDF report"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:text-brand-light disabled:opacity-50"
                      >
                        <Download size={13} /> PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </HubPage>
  )
}
