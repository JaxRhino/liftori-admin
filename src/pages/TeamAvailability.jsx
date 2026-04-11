/**
 * Team Availability Manager
 *
 * Lets team members set recurring weekly schedules + block off time.
 * Round-robin booking uses this data to compute open slots.
 *
 * Three sections:
 * 1. My Weekly Schedule — recurring day/time blocks
 * 2. Time Off / Blocks — specific dates or time ranges to block
 * 3. Team Overview — see everyone's schedule at a glance (admin only)
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
  Calendar, Clock, Plus, Trash2, User, Users, Shield,
  ToggleLeft, ToggleRight, CalendarOff, ChevronLeft, ChevronRight,
  Loader2, Sun, Moon, Coffee, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOT_DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '60 min' },
];
const SLOT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'sales', label: 'Sales Call' },
  { value: 'demo', label: 'Demo' },
  { value: 'interview', label: 'Interview' },
];

const TIME_OPTIONS = [];
for (let h = 6; h <= 21; h++) {
  for (let m = 0; m < 60; m += 15) {
    const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    TIME_OPTIONS.push({ value: val, label });
  }
}

export default function TeamAvailability() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('schedule');
  const [loading, setLoading] = useState(true);

  // Schedule data
  const [availability, setAvailability] = useState([]);
  const [timeOff, setTimeOff] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Add schedule form
  const [newDay, setNewDay] = useState(1); // Monday
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [newDuration, setNewDuration] = useState(60);
  const [newType, setNewType] = useState('all');
  const [quickSetup, setQuickSetup] = useState(false);
  const [quickDays, setQuickDays] = useState({ 1: true, 2: true, 3: true, 4: true, 5: true, 0: false, 6: false });

  // Time off form
  const [offDate, setOffDate] = useState('');
  const [offFullDay, setOffFullDay] = useState(true);
  const [offStart, setOffStart] = useState('09:00');
  const [offEnd, setOffEnd] = useState('17:00');
  const [offReason, setOffReason] = useState('');

  // Team view
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [availRes, offRes, membersRes] = await Promise.all([
        supabase.from('team_availability').select('*').order('day_of_week').order('start_time'),
        supabase.from('team_time_off').select('*').gte('date', new Date().toISOString().split('T')[0]).order('date'),
        supabase.from('profiles').select('id, full_name, email, role, avatar_url').in('role', ['admin', 'dev', 'team_member'])
      ]);

      if (availRes.error) throw availRes.error;
      if (offRes.error) throw offRes.error;

      setAvailability(availRes.data || []);
      setTimeOff(offRes.data || []);
      setTeamMembers(membersRes.data || []);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load availability data');
    } finally {
      setLoading(false);
    }
  }

  // ─── My schedule items ───
  const mySchedule = useMemo(() =>
    availability.filter(a => a.user_id === user?.id),
    [availability, user]
  );

  const myTimeOff = useMemo(() =>
    timeOff.filter(t => t.user_id === user?.id),
    [timeOff, user]
  );

  // ─── Add single schedule block ───
  async function addScheduleBlock() {
    if (newStart >= newEnd) {
      toast.error('End time must be after start time');
      return;
    }

    try {
      const { error } = await supabase.from('team_availability').insert({
        user_id: user.id,
        day_of_week: parseInt(newDay),
        start_time: newStart,
        end_time: newEnd,
        slot_duration_minutes: parseInt(newDuration),
        slot_type: newType,
      });
      if (error) throw error;
      toast.success(`Added ${DAY_NAMES[newDay]} ${formatTime(newStart)} - ${formatTime(newEnd)}`);
      fetchAll();
    } catch (err) {
      toast.error('Failed to add: ' + err.message);
    }
  }

  // ─── Quick setup: add same hours to multiple days ───
  async function quickSetupSchedule() {
    if (newStart >= newEnd) {
      toast.error('End time must be after start time');
      return;
    }

    const selectedDays = Object.entries(quickDays).filter(([, v]) => v).map(([k]) => parseInt(k));
    if (selectedDays.length === 0) {
      toast.error('Select at least one day');
      return;
    }

    const rows = selectedDays.map(day => ({
      user_id: user.id,
      day_of_week: day,
      start_time: newStart,
      end_time: newEnd,
      slot_duration_minutes: parseInt(newDuration),
      slot_type: newType,
    }));

    try {
      const { error } = await supabase.from('team_availability').insert(rows);
      if (error) throw error;
      toast.success(`Added schedule for ${selectedDays.length} days`);
      fetchAll();
      setQuickSetup(false);
    } catch (err) {
      toast.error('Failed: ' + err.message);
    }
  }

  // ─── Toggle active ───
  async function toggleActive(id, currentState) {
    try {
      const { error } = await supabase.from('team_availability')
        .update({ is_active: !currentState, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setAvailability(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentState } : a));
      toast.success(!currentState ? 'Activated' : 'Paused');
    } catch (err) {
      toast.error('Failed to toggle');
    }
  }

  // ─── Delete schedule block ───
  async function deleteBlock(id) {
    try {
      const { error } = await supabase.from('team_availability').delete().eq('id', id);
      if (error) throw error;
      setAvailability(prev => prev.filter(a => a.id !== id));
      toast.success('Removed');
    } catch (err) {
      toast.error('Failed to delete');
    }
  }

  // ─── Add time off ───
  async function addTimeOff() {
    if (!offDate) {
      toast.error('Select a date');
      return;
    }
    if (!offFullDay && offStart >= offEnd) {
      toast.error('End time must be after start time');
      return;
    }

    try {
      const { error } = await supabase.from('team_time_off').insert({
        user_id: user.id,
        date: offDate,
        start_time: offFullDay ? null : offStart,
        end_time: offFullDay ? null : offEnd,
        reason: offReason || null,
      });
      if (error) throw error;
      toast.success('Time off added');
      fetchAll();
      setOffDate('');
      setOffReason('');
    } catch (err) {
      toast.error('Failed: ' + err.message);
    }
  }

  // ─── Delete time off ───
  async function deleteTimeOff(id) {
    try {
      const { error } = await supabase.from('team_time_off').delete().eq('id', id);
      if (error) throw error;
      setTimeOff(prev => prev.filter(t => t.id !== id));
      toast.success('Removed');
    } catch (err) {
      toast.error('Failed to delete');
    }
  }

  // ─── Helpers ───
  function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // ─── Group schedule by day ───
  const scheduleByDay = useMemo(() => {
    const grouped = {};
    for (let i = 0; i < 7; i++) grouped[i] = [];
    mySchedule.forEach(s => {
      if (grouped[s.day_of_week]) grouped[s.day_of_week].push(s);
    });
    return grouped;
  }, [mySchedule]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
        <span className="ml-2 text-gray-400">Loading availability...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Availability</h1>
          <p className="text-gray-400 text-sm mt-1">Set your recurring schedule, block time off, and manage team coverage</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-3 py-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {mySchedule.filter(s => s.is_active).length} active blocks
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800/50 rounded-lg p-1 w-fit">
        {[
          { id: 'schedule', label: 'My Schedule', icon: Calendar },
          { id: 'timeoff', label: 'Time Off', icon: CalendarOff },
          { id: 'team', label: 'Team Overview', icon: Users },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-sky-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB: MY SCHEDULE                               */}
      {/* ═══════════════════════════════════════════════ */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          {/* Add Schedule Form */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-sky-400" />
                Add Availability
              </h2>
              <button
                onClick={() => setQuickSetup(!quickSetup)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  quickSetup
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                    : 'text-gray-400 border-gray-600 hover:border-gray-500'
                }`}
              >
                {quickSetup ? 'Single Day Mode' : 'Quick Setup (Multi-Day)'}
              </button>
            </div>

            {quickSetup ? (
              /* Quick setup: pick multiple days */
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Select Days</label>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 0].map(day => (
                      <button
                        key={day}
                        onClick={() => setQuickDays(prev => ({ ...prev, [day]: !prev[day] }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          quickDays[day]
                            ? 'bg-sky-500 text-white'
                            : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {DAY_SHORT[day]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Start Time</label>
                    <select value={newStart} onChange={e => setNewStart(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">End Time</label>
                    <select value={newEnd} onChange={e => setNewEnd(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Slot Duration</label>
                    <select value={newDuration} onChange={e => setNewDuration(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      {SLOT_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Type</label>
                    <select value={newType} onChange={e => setNewType(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      {SLOT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={quickSetupSchedule}
                  className="bg-sky-500 hover:bg-sky-600 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
                  Add to {Object.values(quickDays).filter(Boolean).length} Days
                </button>
              </div>
            ) : (
              /* Single day mode */
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Day</label>
                    <select value={newDay} onChange={e => setNewDay(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Start Time</label>
                    <select value={newStart} onChange={e => setNewStart(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">End Time</label>
                    <select value={newEnd} onChange={e => setNewEnd(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Slot Duration</label>
                    <select value={newDuration} onChange={e => setNewDuration(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      {SLOT_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Type</label>
                    <select value={newType} onChange={e => setNewType(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      {SLOT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={addScheduleBlock}
                  className="bg-sky-500 hover:bg-sky-600 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
                  Add Block
                </button>
              </div>
            )}
          </div>

          {/* Weekly Schedule Visual */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-sky-400" />
              My Weekly Schedule
            </h2>

            {mySchedule.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No availability set yet</p>
                <p className="text-gray-500 text-sm mt-1">Use Quick Setup above to set your default working hours</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 0].map(day => {
                  const blocks = scheduleByDay[day] || [];
                  if (blocks.length === 0) return (
                    <div key={day} className="flex items-center gap-3 py-2 px-3 rounded-lg">
                      <span className="text-gray-500 font-medium w-24 text-sm">{DAY_NAMES[day]}</span>
                      <span className="text-gray-600 text-sm">No availability</span>
                    </div>
                  );

                  return (
                    <div key={day} className="py-2 px-3 rounded-lg bg-gray-900/30">
                      <div className="flex items-start gap-3">
                        <span className="text-white font-medium w-24 text-sm pt-1">{DAY_NAMES[day]}</span>
                        <div className="flex-1 space-y-1.5">
                          {blocks.map(block => (
                            <div key={block.id} className="flex items-center gap-2 group">
                              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                                block.is_active
                                  ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                                  : 'bg-gray-700/30 text-gray-500 border border-gray-700/30'
                              }`}>
                                <Clock className="h-3.5 w-3.5" />
                                {formatTime(block.start_time)} - {formatTime(block.end_time)}
                                <span className="text-xs opacity-60">({block.slot_duration_minutes}min slots)</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${block.slot_type === 'all' ? 'bg-sky-500/20 text-sky-300' : 'bg-gray-700/50'}`}>{block.slot_type === 'all' ? 'All Types' : block.slot_type}</span>
                              </div>
                              <button
                                onClick={() => toggleActive(block.id, block.is_active)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                title={block.is_active ? 'Pause' : 'Activate'}
                              >
                                {block.is_active
                                  ? <ToggleRight className="h-5 w-5 text-green-400" />
                                  : <ToggleLeft className="h-5 w-5 text-gray-500" />
                                }
                              </button>
                              <button
                                onClick={() => deleteBlock(block.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB: TIME OFF                                  */}
      {/* ═══════════════════════════════════════════════ */}
      {activeTab === 'timeoff' && (
        <div className="space-y-6">
          {/* Add Time Off Form */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-orange-400" />
              Block Time Off
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Date</label>
                  <input type="date" value={offDate} onChange={e => setOffDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Duration</label>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setOffFullDay(true)}
                      className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${offFullDay ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'text-gray-400 border-gray-600'}`}>
                      Full Day
                    </button>
                    <button onClick={() => setOffFullDay(false)}
                      className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${!offFullDay ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'text-gray-400 border-gray-600'}`}>
                      Partial
                    </button>
                  </div>
                </div>
                {!offFullDay && (
                  <>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">From</label>
                      <select value={offStart} onChange={e => setOffStart(e.target.value)}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                        {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">To</label>
                      <select value={offEnd} onChange={e => setOffEnd(e.target.value)}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                        {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Reason (optional)</label>
                <input type="text" value={offReason} onChange={e => setOffReason(e.target.value)}
                  placeholder="PTO, doctor appointment, etc."
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500" />
              </div>
              <button onClick={addTimeOff}
                className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
                Block Time Off
              </button>
            </div>
          </div>

          {/* Upcoming Time Off List */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Upcoming Blocked Time</h2>
            {myTimeOff.length === 0 ? (
              <div className="text-center py-8">
                <CalendarOff className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No upcoming time off scheduled</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myTimeOff.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-gray-900/30 group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <CalendarOff className="h-5 w-5 text-orange-400" />
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">
                          {formatDateShort(item.date)}
                          {item.start_time && (
                            <span className="text-gray-400 font-normal ml-2">
                              {formatTime(item.start_time)} - {formatTime(item.end_time)}
                            </span>
                          )}
                          {!item.start_time && <span className="text-orange-400/60 text-xs ml-2">Full day</span>}
                        </div>
                        {item.reason && <p className="text-gray-500 text-xs">{item.reason}</p>}
                      </div>
                    </div>
                    <button onClick={() => deleteTimeOff(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB: TEAM OVERVIEW                             */}
      {/* ═══════════════════════════════════════════════ */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-400" />
              Team Schedule Overview
            </h2>

            {teamMembers.length === 0 ? (
              <p className="text-gray-400 text-sm">No team members found</p>
            ) : (
              <div className="space-y-4">
                {teamMembers.map(member => {
                  const memberSchedule = availability.filter(a => a.user_id === member.id && a.is_active);
                  const memberOff = timeOff.filter(t => t.user_id === member.id);

                  return (
                    <div key={member.id} className="border border-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                          <User className="h-4 w-4 text-sky-400" />
                        </div>
                        <div>
                          <span className="text-white font-medium text-sm">{member.full_name || member.email}</span>
                          <span className="text-gray-500 text-xs ml-2 capitalize">{member.role}</span>
                        </div>
                        <div className="ml-auto flex items-center gap-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            memberSchedule.length > 0
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-gray-700/50 text-gray-500 border border-gray-700'
                          }`}>
                            {memberSchedule.length > 0 ? `${memberSchedule.length} blocks` : 'No schedule'}
                          </span>
                          {memberOff.length > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              {memberOff.length} time off
                            </span>
                          )}
                        </div>
                      </div>

                      {memberSchedule.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {[1, 2, 3, 4, 5, 6, 0].map(day => {
                            const dayBlocks = memberSchedule.filter(s => s.day_of_week === day);
                            return (
                              <div key={day} className={`text-xs px-2 py-1 rounded ${
                                dayBlocks.length > 0
                                  ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                                  : 'bg-gray-800/50 text-gray-600 border border-gray-700/30'
                              }`}>
                                {DAY_SHORT[day]}
                                {dayBlocks.length > 0 && (
                                  <span className="ml-1 opacity-60">
                                    {formatTime(dayBlocks[0].start_time).replace(':00', '').replace(' ', '')}-{formatTime(dayBlocks[dayBlocks.length - 1].end_time).replace(':00', '').replace(' ', '')}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coverage Summary */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-400" />
              Coverage Summary
            </h2>
            <div className="grid grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map(day => {
                const dayActiveBlocks = availability.filter(a => a.day_of_week === day && a.is_active);
                const uniqueUsers = [...new Set(dayActiveBlocks.map(a => a.user_id))];
                return (
                  <div key={day} className="text-center p-3 rounded-lg bg-gray-900/30">
                    <div className="text-xs text-gray-400 mb-1">{DAY_SHORT[day]}</div>
                    <div className={`text-2xl font-bold ${
                      uniqueUsers.length === 0 ? 'text-red-400' :
                      uniqueUsers.length === 1 ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {uniqueUsers.length}
                    </div>
                    <div className="text-xs text-gray-500">
                      {uniqueUsers.length === 0 ? 'No coverage' :
                       uniqueUsers.length === 1 ? 'person' : 'people'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
