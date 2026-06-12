import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCrmClient } from './_shared';
import { Card } from '../../components/ui/card';
import { MapPin, Briefcase, User } from 'lucide-react';
import { toast } from 'sonner';

// Operations > Job Map
// Drops a pin for every job (ops_work_orders) and customer (customer_contacts)
// that has lat/lng. Leaflet + OpenStreetMap are loaded from CDN at runtime so
// no API key or extra npm dependency is required.

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    let s = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (s) { s.addEventListener('load', () => resolve(window.L)); s.addEventListener('error', reject); return; }
    s = document.createElement('script');
    s.src = LEAFLET_JS; s.async = true;
    s.onload = () => resolve(window.L); s.onerror = reject;
    document.body.appendChild(s);
  });
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

export default function CrmJobMap() {
  const { client } = useCrmClient();
  const [jobs, setJobs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [show, setShow] = useState({ jobs: true, customers: true });
  const [loading, setLoading] = useState(true);
  const [mapErr, setMapErr] = useState(false);
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client]);

  async function load() {
    try {
      setLoading(true);
      const safe = (p) => p.then(r => r.data || []).catch(() => []);
      const [jb, ct] = await Promise.all([
        safe(client.from('ops_work_orders').select('id,title,work_order_number,status,address,city,state,lat,lng,estimated_cost')),
        safe(client.from('customer_contacts').select('id,first_name,last_name,property_address,property_city,property_state,lat,lng')),
      ]);
      setJobs(jb); setContacts(ct);
    } catch (e) { console.error(e); toast.error('Failed to load map data'); }
    finally { setLoading(false); }
  }

  const pins = useMemo(() => {
    const out = [];
    if (show.jobs) jobs.forEach(j => { const lat = num(j.lat), lng = num(j.lng); if (lat != null && lng != null) out.push({ kind: 'job', id: j.id, lat, lng, title: j.title || j.work_order_number || 'Job', sub: [j.address, j.city, j.state].filter(Boolean).join(', '), status: j.status }); });
    if (show.customers) contacts.forEach(c => { const lat = num(c.lat), lng = num(c.lng); if (lat != null && lng != null) out.push({ kind: 'customer', id: c.id, lat, lng, title: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer', sub: [c.property_address, c.property_city, c.property_state].filter(Boolean).join(', ') }); });
    return out;
  }, [jobs, contacts, show]);

  // init / refresh map
  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    loadLeaflet().then(L => {
      if (cancelled || !mapRef.current) return;
      if (!mapObj.current) {
        mapObj.current = L.map(mapRef.current, { scrollWheelZoom: true }).setView([30.33, -81.66], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapObj.current);
        layerRef.current = L.layerGroup().addTo(mapObj.current);
      }
      layerRef.current.clearLayers();
      const bounds = [];
      pins.forEach(p => {
        const color = p.kind === 'job' ? '#0ea5e9' : '#a855f7';
        const marker = L.circleMarker([p.lat, p.lng], { radius: 8, color, fillColor: color, fillOpacity: 0.85, weight: 2 });
        marker.bindPopup(`<strong>${p.title}</strong><br/>${p.sub || ''}${p.status ? '<br/>Status: ' + p.status : ''}`);
        marker.addTo(layerRef.current);
        bounds.push([p.lat, p.lng]);
      });
      if (bounds.length) { try { mapObj.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 }); } catch (e) {} }
      setTimeout(() => { try { mapObj.current.invalidateSize(); } catch (e) {} }, 150);
    }).catch(() => setMapErr(true));
    return () => { cancelled = true; };
  }, [pins, loading]);

  if (loading) return <div className="p-6 text-gray-400">Loading job map...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><MapPin size={22} /> Job Map</h1>
          <p className="text-gray-400 text-sm mt-1">{pins.length} location{pins.length !== 1 ? 's' : ''} pinned.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShow(s => ({ ...s, jobs: !s.jobs }))} className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-1.5 ${show.jobs ? 'border-brand-blue text-brand-blue bg-brand-blue/10' : 'border-navy-700 text-gray-400'}`}><Briefcase size={14} /> Jobs</button>
          <button onClick={() => setShow(s => ({ ...s, customers: !s.customers }))} className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-1.5 ${show.customers ? 'border-purple-400 text-purple-300 bg-purple-500/10' : 'border-navy-700 text-gray-400'}`}><User size={14} /> Customers</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="bg-navy-900 border-navy-800 overflow-hidden lg:col-span-3">
          {mapErr ? (
            <div className="h-[600px] flex items-center justify-center text-gray-400 text-sm p-6 text-center">Map couldn't load (offline?). The pinned locations are listed alongside.</div>
          ) : (
            <div ref={mapRef} style={{ height: 600, width: '100%' }} className="bg-navy-950" />
          )}
        </Card>
        <Card className="bg-navy-900 border-navy-800 p-3 max-h-[600px] overflow-y-auto">
          <h3 className="text-sm font-semibold text-white mb-2 px-1">Locations</h3>
          {pins.length === 0 ? (
            <p className="text-xs text-gray-500 px-1">No pinned locations yet. Add lat/lng to jobs or customers.</p>
          ) : pins.map(p => (
            <div key={p.kind + p.id} className="px-2 py-2 rounded hover:bg-navy-800/60 cursor-pointer" onClick={() => { if (mapObj.current) mapObj.current.setView([p.lat, p.lng], 14); }}>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: p.kind === 'job' ? '#0ea5e9' : '#a855f7' }} />
                <span className="text-sm text-white truncate">{p.title}</span>
              </div>
              {p.sub && <div className="text-[11px] text-gray-500 ml-4 truncate">{p.sub}</div>}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
