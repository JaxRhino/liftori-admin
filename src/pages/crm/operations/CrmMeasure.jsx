import { useEffect, useMemo, useRef, useState } from 'react'
import { HubPage, Section, EmptyState, useCrmClient } from '../_shared'
import { MapPin, Save, RotateCcw, CheckCircle2, Trash2, Plus, Search } from 'lucide-react'

// =====================================================================
// CrmMeasure - Aerial roof measurement tool (Operations hub).
// MapLibre GL + Esri World Imagery + turf.js (all CDN-loaded at runtime,
// since none are bundled deps). Trace each roof plane, set its pitch, and
// the page computes plan ft2 / sloped surface ft2 / order squares.
// Saves to ops_measurements on the per-tenant client (useCrmClient).
// =====================================================================

const M2_TO_FT2 = 10.7639104
const PITCHES = Array.from({ length: 13 }, (_, r) => r) // 0/12 .. 12/12
const pitchMult = (rise) => Math.sqrt(1 + (rise / 12) * (rise / 12))
const pitchLabel = (rise) => `${rise}/12`

const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js'
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css'
const TURF_JS = 'https://unpkg.com/@turf/turf@6/turf.min.js'

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
  if (!window.turf) await loadScript(TURF_JS)
}

const fc = (features) => ({ type: 'FeatureCollection', features })

// plan (flat) ft2 of one closed facet using turf
function facetPlanFt2(turf, f) {
  if (!f.closed || f.pts.length < 3) return 0
  const poly = turf.polygon([[...f.pts, f.pts[0]]])
  return turf.area(poly) * M2_TO_FT2
}

export default function CrmMeasure() {
  const { client } = useCrmClient()

  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const drawingRef = useRef(false)
  const facetsRef = useRef([]) // [{id,pts:[[lng,lat]],pitch,closed}]
  const idRef = useRef(0)

  const [ready, setReady] = useState(false)
  const [loadErr, setLoadErr] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const [facets, setFacets] = useState([]) // mirror for render
  const [waste, setWaste] = useState(10)
  const [zoomHint, setZoomHint] = useState('Find an address to begin')

  // address search + autocomplete
  const [addr, setAddr] = useState('')
  const [title, setTitle] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const suggestTimer = useRef(null)

  // saved measurements
  const [saved, setSaved] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

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

  // ---------- load saved ----------
  async function loadSaved() {
    if (!client) return
    const { data, error } = await client
      .from('ops_measurements')
      .select('id, title, address, status, summary, measurements, created_at, template_type')
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
    const polys = [], verts = []
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
    map.getSource('facets').setData(fc(polys))
    map.getSource('verts').setData(fc(verts))
    setFacets(facetsRef.current.map((f) => ({ ...f, pts: f.pts.slice() })))
  }

  function activeFacet() { return facetsRef.current.find((f) => !f.closed) || null }

  function onMapClick(e) {
    if (!drawingRef.current) return
    const af = activeFacet()
    if (!af) return
    af.pts.push([e.lngLat.lng, e.lngLat.lat])
    syncMap()
  }

  // ---------- draw controls ----------
  function addSection() {
    setConfirmOpen(false)
    facetsRef.current.push({ id: ++idRef.current, pitch: 6, pts: [], closed: false })
    drawingRef.current = true
    setDrawing(true)
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = 'crosshair'
    syncMap()
  }
  function undoPoint() {
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
  function clearAll() {
    facetsRef.current = []
    drawingRef.current = false
    setDrawing(false)
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = ''
    syncMap()
  }

  // ---------- totals ----------
  const totals = useMemo(() => {
    const turf = window.turf
    const real = facets.filter((f) => f.closed && f.pts.length >= 3)
    let plan = 0, surf = 0
    if (turf) {
      real.forEach((f) => {
        const p = facetPlanFt2(turf, f)
        plan += p
        surf += p * pitchMult(f.pitch)
      })
    }
    const w = Math.max(0, Math.min(40, Number(waste) || 0))
    const withWaste = surf * (1 + w / 100)
    const squares = Math.ceil((withWaste / 100) * 10) / 10
    return { plan, surf, squares, facetCount: real.length, waste: w }
  }, [facets, waste])

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

  // ---------- save ----------
  async function save() {
    if (!client) return
    const real = facetsRef.current.filter((f) => f.closed && f.pts.length >= 3)
    if (!real.length) { setSaveMsg('Trace at least one roof section first.'); return }
    setSaving(true); setSaveMsg(null)
    try {
      const userRes = await client.auth.getUser()
      const uid = userRes?.data?.user?.id || null
      const summary = {
        plan_ft2: Math.round(totals.plan),
        sloped_ft2: Math.round(totals.surf),
        squares: totals.squares,
        waste_pct: totals.waste,
        facet_count: totals.facetCount,
      }
      const measurements = real.map((f, i) => ({
        section: i + 1,
        pitch: f.pitch,
        pitch_label: pitchLabel(f.pitch),
        coords: f.pts,
      }))
      const { error } = await client.from('ops_measurements').insert({
        title: (title.trim() || addr.trim() || 'Aerial roof measurement'),
        template_type: 'aerial_roof',
        status: 'measured',
        address: addr.trim() || null,
        measurements,
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

  // ---------- reopen a saved measurement ----------
  function reopen(row) {
    clearAll()
    const lines = Array.isArray(row.measurements) ? row.measurements : []
    facetsRef.current = lines
      .filter((l) => Array.isArray(l.coords) && l.coords.length >= 3)
      .map((l) => ({ id: ++idRef.current, pitch: Number(l.pitch) || 6, pts: l.coords.map((c) => [c[0], c[1]]), closed: true }))
    setTitle(row.title || '')
    setAddr(row.address || '')
    if (row.summary?.waste_pct != null) setWaste(row.summary.waste_pct)
    syncMap()
    const first = facetsRef.current[0]
    if (first && mapRef.current) {
      const c = first.pts[0]
      mapRef.current.flyTo({ center: [c[0], c[1]], zoom: 19.5, speed: 1.4 })
    }
  }

  const realFacets = facets.filter((f) => f.closed && f.pts.length >= 3)
  const af = facets.find((f) => !f.closed)

  return (
    <HubPage
      title="Roof Measure"
      subtitle="Trace each roof plane on aerial imagery, set pitch, and get order squares."
      actions={
        <button
          onClick={save}
          disabled={saving || !realFacets.length}
          className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Save size={16} /> {saving ? 'Saving...' : 'Save measurement'}
        </button>
      }
    >
      {loadErr && (
        <div className="mb-4 bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-lg px-4 py-3">
          {loadErr}
        </div>
      )}

      {/* address search */}
      <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
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
              {drawing ? 'Tracing - tap each corner of one plane' : zoomHint}
            </div>
          </div>

          {/* draw toolbar */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={addSection} disabled={!ready || drawing} className="inline-flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-40 text-white text-sm font-medium px-3.5 py-2 rounded-lg">
              <Plus size={15} /> Add roof section
            </button>
            <button onClick={undoPoint} disabled={!af || !af.pts.length} className="inline-flex items-center gap-1.5 bg-navy-800 border border-navy-700/60 hover:bg-navy-700/50 disabled:opacity-40 text-gray-200 text-sm px-3.5 py-2 rounded-lg">
              <RotateCcw size={15} /> Undo point
            </button>
            <button onClick={doneSection} disabled={!af || af.pts.length < 3} className="inline-flex items-center gap-1.5 bg-navy-800 border border-navy-700/60 hover:bg-navy-700/50 disabled:opacity-40 text-gray-200 text-sm px-3.5 py-2 rounded-lg">
              <CheckCircle2 size={15} /> Done section
            </button>
            <button onClick={clearAll} disabled={!facets.length} className="inline-flex items-center gap-1.5 bg-navy-800 border border-navy-700/60 hover:bg-navy-700/50 disabled:opacity-40 text-gray-400 text-sm px-3.5 py-2 rounded-lg">
              <Trash2 size={15} /> Clear all
            </button>
          </div>
        </div>

        {/* PANEL */}
        <div className="space-y-4">
          {/* totals */}
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
            <div className="flex items-baseline justify-between border-t border-navy-700/50 pt-3">
              <span className="text-xs text-gray-400">Sloped surface</span>
              <span className="text-2xl font-bold text-white">{Math.round(totals.surf).toLocaleString()}<span className="text-sm text-gray-400 ml-1">ft2</span></span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xs text-gray-400">Order quantity</span>
              <span className="text-2xl font-bold text-emerald-400">{totals.squares.toFixed(1)}<span className="text-sm text-gray-400 ml-1">sq</span></span>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Plan area {Math.round(totals.plan).toLocaleString()} ft2 - {totals.facetCount} section{totals.facetCount === 1 ? '' : 's'} - incl. {totals.waste}% waste
            </p>
            {saveMsg && <p className="text-xs mt-2 text-gray-300">{saveMsg}</p>}
          </div>

          {/* sections */}
          <Section title="Sections">
            {realFacets.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No sections yet" description="Trace each roof plane separately so each can carry its own pitch." />
              </div>
            ) : (
              <div className="divide-y divide-navy-700/50">
                {realFacets.map((f, i) => {
                  const plan = window.turf ? facetPlanFt2(window.turf, f) : 0
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

          {/* saved */}
          <Section title="Saved measurements">
            {saved.length === 0 ? (
              <div className="px-5 py-4 text-sm text-gray-500">No saved aerial measurements yet.</div>
            ) : (
              <div className="divide-y divide-navy-700/50">
                {saved.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => reopen(row)}
                    className="block w-full text-left px-5 py-3 hover:bg-navy-700/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white truncate">{row.title || 'Untitled'}</span>
                      <span className="text-xs text-emerald-400 shrink-0 ml-2">{row.summary?.squares ?? '-'} sq</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {row.address || 'No address'} - {new Date(row.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </HubPage>
  )
}
