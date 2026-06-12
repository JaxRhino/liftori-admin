import React, { useState, useEffect, useMemo } from 'react';
import { useCrmClient } from './_shared';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ChevronLeft, ChevronRight, Pencil, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';

// Operations > Crew Availability
// Shows each crew's weekly working hours (ops_crews.weekly_availability)
// alongside this week's scheduled jobs (ops_schedule) so a dispatcher can
// see at a glance who has room to take more work.

const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' },
];
const DEFAULT_WK = {
  mon: { on: true, start: '08:00', end: '17:00' }, tue: { on: true, start: '08:00', end: '17:00' },
  wed: { on: true, start: '08:00', end: '17:00' }, thu: { on: true, start: '08:00', end: '17:00' },
  fri: { on: true, start: '08:00', end: '17:00' }, sat: { on: false, start: '08:00', end: '17:00' },
  sun: { on: false, start: '08:00', end: '17:00' },
};

function startOfWeek(d) {
  const x = new Date(d); const day = (x.getDay() + 6) % 7; // Mon=0
  x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - day); return x;
}
const fmtRange = (s, e) => `${(s || '').slice(0, 5)}–${(e || '').slice(0, 5)}`;

export default function CrmCrewAvailability() {
  const { client } = useCrmClient();
  const [crews, setCrews] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [editing, setEditing] = useState(null);

  const weekEnd = useMemo(() => { const e = new Date(weekStart); e.setDate(e.getDate() + 7); return e; }, [weekStart]);
  const weekDates = useMemo(() => DAYS.map((_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client, weekStart]);

  async function load() {
    try {
      setLoading(true);
      const safe = (p) => p.then(r => r.data || []).catch(() => []);
      const [cr, ev] = await Promise.all([
        safe(client.from('ops_crews').select('*').order('name')),
        safe(client.from('ops_schedule').select('*').gte('start_time', weekStart.toISOString()).lt('start_time', weekEnd.toISOString())),
      ]);
      setCrews(cr); setEvents(ev);
    } catch (e) { console.error(e); toast.error('Failed to load crew availability'); }
    finally { setLoading(false); }
  }

  const eventsFor = (crewId, dayIdx) => {
    const day = weekDates[dayIdx];
    return events.filter(ev => ev.crew_id === crewId && ev.start_time && new Date(ev.start_time).toDateString() === day.toDateString());
  };

  async function saveHours(crewId, wk) {
    try {
      const { error } = await client.from('ops_crews').update({ weekly_availability: wk }).eq('id', crewId);
      if (error) throw error;
      setCrews(cs => cs.map(c => c.id === crewId ? { ...c, weekly_availability: wk } : c));
      toast.success('Availability updated'); setEditing(null);
    } catch (e) { console.error(e); toast.error('Could not save'); }
  }

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(weekEnd - 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  if (loading) return <div className="p-6 text-gray-400">Loading crew availability...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users size={22} /> Crew Availability</h1>
          <p className="text-gray-400 text-sm mt-1">Working hours and booked jobs by crew — spot open capacity to schedule.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }} className="p-2 rounded bg-navy-800 text-gray-300 hover:text-white"><ChevronLeft size={18} /></button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="px-3 py-2 rounded bg-navy-800 text-gray-300 hover:text-white text-sm">This Week</button>
          <span className="text-sm text-white font-medium w-40 text-center">{weekLabel}</span>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }} className="p-2 rounded bg-navy-800 text-gray-300 hover:text-white"><ChevronRight size={18} /></button>
        </div>
      </div>

      {crews.length === 0 ? (
        <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">No crews yet. Add crews under Operations &gt; Crews.</Card>
      ) : (
        <Card className="bg-navy-900 border-navy-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-navy-800">
                  <th className="px-4 py-3 text-left text-gray-400 font-semibold sticky left-0 bg-navy-900 min-w-[180px]">Crew</th>
                  {DAYS.map((d, i) => (
                    <th key={d.key} className="px-3 py-3 text-center text-gray-400 font-semibold min-w-[120px]">
                      {d.label}<div className="text-[10px] text-gray-600 font-normal">{weekDates[i].getDate()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crews.map(crew => {
                  const wk = crew.weekly_availability || DEFAULT_WK;
                  return (
                    <tr key={crew.id} className="border-b border-navy-800 align-top">
                      <td className="px-4 py-3 sticky left-0 bg-navy-900">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: crew.color || '#0ea5e9' }} />
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">{crew.name}</div>
                            <div className="text-[11px] text-gray-500 truncate">{(crew.specialties || []).join(', ') || crew.vehicle || ''}</div>
                          </div>
                          <button onClick={() => setEditing({ id: crew.id, wk: { ...DEFAULT_WK, ...wk } })} className="ml-auto text-gray-500 hover:text-brand-blue" title="Edit hours"><Pencil size={14} /></button>
                        </div>
                      </td>
                      {DAYS.map((d, i) => {
                        const day = wk[d.key] || { on: false };
                        const evs = eventsFor(crew.id, i);
                        const off = !day.on;
                        const busy = evs.length;
                        const tone = off ? 'bg-navy-950/60 text-gray-600' : busy >= (crew.max_capacity || 3) ? 'bg-red-500/10 text-red-300 border border-red-500/30' : busy > 0 ? 'bg-amber-500/10 text-amber-200 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30';
                        return (
                          <td key={d.key} className="px-2 py-2 text-center">
                            <div className={`rounded-lg px-2 py-2 text-xs ${tone}`}>
                              {off ? 'Off' : (
                                <>
                                  <div className="flex items-center justify-center gap-1 text-[11px] opacity-90"><Clock size={11} />{fmtRange(day.start, day.end)}</div>
                                  <div className="mt-1 font-semibold">{busy === 0 ? 'Open' : `${busy} job${busy > 1 ? 's' : ''}`}</div>
                                  {evs.slice(0, 2).map(ev => <div key={ev.id} className="truncate text-[10px] opacity-80 mt-0.5">{ev.title || 'Job'}</div>)}
                                </>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500/30 border border-emerald-500/40" /> Open</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-500/30 border border-amber-500/40" /> Partially booked</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500/30 border border-red-500/40" /> At capacity</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-navy-950 border border-navy-700" /> Off</span>
      </div>

      {editing && <HoursEditor editing={editing} onClose={() => setEditing(null)} onSave={(wk) => saveHours(editing.id, wk)} />}
    </div>
  );
}

function HoursEditor({ editing, onClose, onSave }) {
  const [wk, setWk] = useState(editing.wk);
  const upd = (k, patch) => setWk(w => ({ ...w, [k]: { ...w[k], ...patch } }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-navy-900 border border-navy-700 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-navy-800">
          <h3 className="text-white font-semibold">Weekly Working Hours</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 space-y-2">
          {DAYS.map(d => {
            const day = wk[d.key] || { on: false, start: '08:00', end: '17:00' };
            return (
              <div key={d.key} className="flex items-center gap-2">
                <label className="flex items-center gap-2 w-20 text-sm text-gray-300">
                  <input type="checkbox" checked={!!day.on} onChange={e => upd(d.key, { on: e.target.checked })} /> {d.label}
                </label>
                <input type="time" value={day.start} disabled={!day.on} onChange={e => upd(d.key, { start: e.target.value })} className="bg-navy-800 border border-navy-700 text-white rounded px-2 py-1 text-sm disabled:opacity-40" />
                <span className="text-gray-500">to</span>
                <input type="time" value={day.end} disabled={!day.on} onChange={e => upd(d.key, { end: e.target.value })} className="bg-navy-800 border border-navy-700 text-white rounded px-2 py-1 text-sm disabled:opacity-40" />
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-navy-800">
          <Button onClick={onClose} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</Button>
          <Button onClick={() => onSave(wk)} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Save</Button>
        </div>
      </div>
    </div>
  );
}
