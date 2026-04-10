/**
 * Consulting Appointments — Manage slots & view booked calls
 *
 * Two tabs:
 * 1. Upcoming Appointments - all booked calls with status, join button
 * 2. Manage Availability - add/remove time slots for booking
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
  Calendar, Clock, Plus, Trash2, User, Building2, Video,
  Search, Filter, ChevronRight, CheckCircle, XCircle,
  AlertTriangle, Phone, Loader2, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_BADGES = {
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  no_show: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  rescheduled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
};

const INTEREST_LABELS = {
  ai_strategy: 'AI Strategy',
  growth_planning: 'Growth Planning',
  eos_implementation: 'EOS Implementation',
  coaching: '1-on-1 Coaching',
  general: 'General'
};

export default function ConsultingAppointments() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('appointments');
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Slot creation
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('09:30');
  const [newSlotType, setNewSlotType] = useState('consulting');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkDays, setBulkDays] = useState({ mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false });
  const [bulkWeeks, setBulkWeeks] = useState(2);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [apptRes, slotsRes] = await Promise.all([
        supabase
          .from('consulting_appointments')
          .select('*')
          .order('appointment_date', { ascending: true }),
        supabase
          .from('consulting_slots')
          .select('*')
          .gte('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: true })
          .order('start_time', { ascending: true })
      ]);

      if (apptRes.error) throw apptRes.error;
      if (slotsRes.error) throw slotsRes.error;

      setAppointments(apptRes.data || []);
      setSlots(slotsRes.data || []);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  // Add a single slot
  async function addSlot() {
    if (!newSlotDate || !newSlotStart || !newSlotEnd) {
      toast.error('Fill in date, start, and end time');
      return;
    }

    try {
      const { error } = await supabase.from('consulting_slots').insert({
        consultant_id: user.id,
        date: newSlotDate,
        start_time: newSlotStart,
        end_time: newSlotEnd,
        slot_type: newSlotType
      });
      if (error) throw error;
      toast.success('Slot added');
      fetchData();
      setNewSlotDate('');
    } catch (err) {
      toast.error('Failed to add slot: ' + err.message);
    }
  }

  // Bulk add slots
  async function addBulkSlots() {
    if (!newSlotStart || !newSlotEnd) {
      toast.error('Set start and end times');
      return;
    }

    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const selectedDays = Object.entries(bulkDays).filter(([,v]) => v).map(([k]) => dayMap[k]);

    if (selectedDays.length === 0) {
      toast.error('Select at least one day');
      return;
    }

    const slotsToInsert = [];
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (bulkWeeks * 7));

    for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (selectedDays.includes(d.getDay())) {
        slotsToInsert.push({
          consultant_id: user.id,
          date: d.toISOString().split('T')[0],
          start_time: newSlotStart,
          end_time: newSlotEnd,
          slot_type: newSlotType
        });
      }
    }

    if (slotsToInsert.length === 0) {
      toast.error('No matching days found');
      return;
    }

    try {
      const { error } = await supabase.from('consulting_slots').insert(slotsToInsert);
      if (error) throw error;
      toast.success(`${slotsToInsert.length} slots added`);
      fetchData();
    } catch (err) {
      toast.error('Bulk add failed: ' + err.message);
    }
  }

  // Delete slot
  async function deleteSlot(slotId) {
    try {
      const { error } = await supabase.from('consulting_slots').delete().eq('id', slotId);
      if (error) throw error;
      setSlots(prev => prev.filter(s => s.id !== slotId));
      toast.success('Slot removed');
    } catch (err) {
      toast.error('Delete failed');
    }
  }

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    if (!search) return appointments;
    const q = search.toLowerCase();
    return appointments.filter(a =>
      a.lead_name?.toLowerCase().includes(q) ||
      a.lead_email?.toLowerCase().includes(q) ||
      a.company_name?.toLowerCase().includes(q)
    );
  }, [appointments, search]);

  // Stats
  const stats = useMemo(() => {
    const upcoming = appointments.filter(a => ['scheduled', 'confirmed'].includes(a.status));
    const today = appointments.filter(a => a.appointment_date === new Date().toISOString().split('T')[0]);
    const completed = appointments.filter(a => a.status === 'completed');
    const available = slots.filter(s => !s.is_booked);
    return { upcoming: upcoming.length, today: today.length, completed: completed.length, available: available.length };
  }, [appointments, slots]);

  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    let hr = parseInt(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    if (hr > 12) hr -= 12;
    if (hr === 0) hr = 12;
    return `${hr}:${m} ${ampm}`;
  }

  function formatDate(d) {
    if (!d) return '';
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Consulting Appointments</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your availability and view booked calls</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Today's Calls", value: stats.today, icon: Phone, color: 'text-orange-400 bg-orange-500/10' },
          { label: 'Upcoming', value: stats.upcoming, icon: Calendar, color: 'text-blue-400 bg-blue-500/10' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/10' },
          { label: 'Open Slots', value: stats.available, icon: Clock, color: 'text-purple-400 bg-purple-500/10' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{stat.label}</span>
              <div className={`p-1.5 rounded-lg ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800/30 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'appointments' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Appointments ({appointments.length})
        </button>
        <button
          onClick={() => setActiveTab('availability')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'availability' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Manage Availability ({slots.length})
        </button>
      </div>

      {/* APPOINTMENTS TAB */}
      {activeTab === 'appointments' && (
        <div>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or company..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Table */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Interest</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Temp</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      No appointments yet. Share liftori.ai/book to get bookings.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map(appt => (
                    <tr key={appt.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-500/15 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-purple-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{appt.lead_name}</p>
                            <p className="text-xs text-gray-500">{appt.company_name || appt.lead_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-300">{INTEREST_LABELS[appt.primary_interest] || 'General'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">{formatDate(appt.appointment_date)}</p>
                        <p className="text-xs text-gray-500">{formatTime(appt.appointment_start)} ET</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS_BADGES[appt.status] || STATUS_BADGES.scheduled}`}>
                          {appt.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {appt.lead_temperature ? (
                          <span className={`text-xs font-semibold capitalize ${
                            appt.lead_temperature === 'hot' ? 'text-red-400' :
                            appt.lead_temperature === 'warm' ? 'text-orange-400' :
                            appt.lead_temperature === 'cold' ? 'text-blue-400' : 'text-gray-500'
                          }`}>{appt.lead_temperature}</span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {['scheduled', 'confirmed', 'in_progress'].includes(appt.status) && (
                          <button
                            onClick={() => navigate(`/admin/sales-call/${appt.room_id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 rounded-lg text-xs font-semibold text-purple-400 hover:bg-purple-600/30 transition"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Join Call
                          </button>
                        )}
                        {appt.status === 'completed' && (
                          <button
                            onClick={() => navigate(`/admin/sales-call/${appt.room_id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Notes
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AVAILABILITY TAB */}
      {activeTab === 'availability' && (
        <div className="space-y-6">
          {/* Add Slot Form */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-400" />
                Add Available Time Slots
              </h3>
              <button
                onClick={() => setBulkMode(!bulkMode)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                  bulkMode ? 'bg-purple-600/20 text-purple-400' : 'bg-slate-700 text-gray-400 hover:text-white'
                }`}
              >
                {bulkMode ? 'Single Mode' : 'Bulk Mode'}
              </button>
            </div>

            {!bulkMode ? (
              /* Single slot */
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={newSlotDate}
                    onChange={e => setNewSlotDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start</label>
                  <input
                    type="time"
                    value={newSlotStart}
                    onChange={e => setNewSlotStart(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End</label>
                  <input
                    type="time"
                    value={newSlotEnd}
                    onChange={e => setNewSlotEnd(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select
                    value={newSlotType}
                    onChange={e => setNewSlotType(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="consulting">Consulting</option>
                    <option value="coaching">Coaching</option>
                    <option value="strategy">Strategy</option>
                  </select>
                </div>
                <button
                  onClick={addSlot}
                  className="px-5 py-2 bg-purple-600 rounded-lg text-sm font-semibold hover:bg-purple-700 transition"
                >
                  Add Slot
                </button>
              </div>
            ) : (
              /* Bulk mode */
              <div className="space-y-4">
                <div className="flex items-end gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newSlotStart}
                      onChange={e => setNewSlotStart(e.target.value)}
                      className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End Time</label>
                    <input
                      type="time"
                      value={newSlotEnd}
                      onChange={e => setNewSlotEnd(e.target.value)}
                      className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Weeks Out</label>
                    <select
                      value={bulkWeeks}
                      onChange={e => setBulkWeeks(parseInt(e.target.value))}
                      className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                    >
                      {[1,2,3,4,6,8].map(w => (
                        <option key={w} value={w}>{w} week{w > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Days</label>
                  <div className="flex gap-2">
                    {Object.entries(bulkDays).map(([day, active]) => (
                      <button
                        key={day}
                        onClick={() => setBulkDays(prev => ({ ...prev, [day]: !prev[day] }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition border ${
                          active ? 'bg-purple-600/20 border-purple-500/30 text-purple-400' : 'bg-slate-800 border-slate-700 text-gray-500'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={addBulkSlots}
                  className="px-5 py-2 bg-purple-600 rounded-lg text-sm font-semibold hover:bg-purple-700 transition"
                >
                  Generate Slots
                </button>
              </div>
            )}
          </div>

          {/* Existing Slots */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-gray-400">Upcoming Available Slots</h3>
            </div>
            {slots.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                No slots created yet. Add some above to start accepting bookings.
              </div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {slots.map(slot => (
                  <div key={slot.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/20 transition">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium">{formatDate(slot.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-slate-700/50 rounded capitalize text-gray-400">{slot.slot_type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {slot.is_booked ? (
                        <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Booked
                        </span>
                      ) : (
                        <button
                          onClick={() => deleteSlot(slot.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
