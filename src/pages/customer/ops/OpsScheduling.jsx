import React, { useState, useEffect, useMemo } from 'react';
import { useOrg } from '../../../lib/OrgContext';
import { fetchSchedule, createScheduleEvent, updateScheduleEvent, deleteScheduleEvent, fetchCrews } from '../../../lib/customerOpsService';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, Clock, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';

const EVENT_TYPES = {
  job: { label: 'Job', color: '#0EA5E9' },
  meeting: { label: 'Meeting', color: '#8B5CF6' },
  break: { label: 'Break', color: '#F59E0B' },
  travel: { label: 'Travel', color: '#6B7280' },
  training: { label: 'Training', color: '#10B981' },
  off: { label: 'Off', color: '#EF4444' },
  holiday: { label: 'Holiday', color: '#EC4899' },
  callback: { label: 'Callback', color: '#F97316' },
};

const RECURRING_OPTIONS = [
  { value: 'none', label: 'No Repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6am-8pm

export default function OpsScheduling() {
  const { currentOrg } = useOrg();
  const [viewMode, setViewMode] = useState('week'); // week, day, list
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState([]);
  const [crews, setCrews] = useState([]);
  const [selectedCrews, setSelectedCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    eventType: 'job',
    crewId: '',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '17:00',
    allDay: false,
    recurring: 'none',
    recurringEndDate: '',
    address: '',
    notes: '',
    color: '#0EA5E9',
  });

  // Load schedule and crews
  useEffect(() => {
    if (!currentOrg?.id) return;
    loadData();
  }, [currentOrg?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [scheduleData, crewsData] = await Promise.all([
        fetchSchedule(currentOrg.id),
        fetchCrews(currentOrg.id),
      ]);
      setSchedule(scheduleData || []);
      setCrews(crewsData || []);
      if (crewsData?.length > 0) {
        setSelectedCrews(crewsData.map((c) => c.id));
      }
    } catch (error) {
      console.error('Failed to load schedule:', error);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  // Get week start (Monday)
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const weekStart = getWeekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter schedule by selected crews
  const filteredSchedule = useMemo(() => {
    return schedule.filter((event) => selectedCrews.includes(event.crewId));
  }, [schedule, selectedCrews]);

  // Get events for a specific date
  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return filteredSchedule.filter((event) => {
      const eventStart = new Date(event.startDate).toISOString().split('T')[0];
      const eventEnd = new Date(event.endDate).toISOString().split('T')[0];
      return dateStr >= eventStart && dateStr <= eventEnd;
    });
  };

  // Get crew availability for selected day
  const getCrewAvailability = () => {
    const selectedDate = currentDate.toISOString().split('T')[0];
    return crews.map((crew) => {
      const crewEvents = filteredSchedule.filter(
        (event) =>
          event.crewId === crew.id &&
          new Date(event.startDate).toISOString().split('T')[0] === selectedDate
      );
      const jobEvents = crewEvents.filter((e) => e.eventType === 'job');
      const totalHours = crewEvents.reduce((sum, e) => {
        const start = new Date(e.startDate);
        const end = new Date(e.endDate);
        return sum + (end - start) / (1000 * 60 * 60);
      }, 0);
      return {
        id: crew.id,
        name: crew.name,
        jobCount: jobEvents.length,
        hoursBooked: totalHours,
        isAvailable: jobEvents.length < 3 && totalHours < 8,
      };
    });
  };

  // Handle dialog open/close
  const handleNewEvent = (startDate = currentDate) => {
    const dateStr = startDate.toISOString().split('T')[0];
    setEditingEvent(null);
    setFormData({
      title: '',
      eventType: 'job',
      crewId: crews[0]?.id || '',
      startDate: dateStr,
      startTime: '09:00',
      endDate: dateStr,
      endTime: '17:00',
      allDay: false,
      recurring: 'none',
      recurringEndDate: '',
      address: '',
      notes: '',
      color: EVENT_TYPES.job.color,
    });
    setDialogOpen(true);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      eventType: event.eventType,
      crewId: event.crewId,
      startDate: event.startDate.split('T')[0],
      startTime: event.startDate.split('T')[1]?.slice(0, 5) || '09:00',
      endDate: event.endDate.split('T')[0],
      endTime: event.endDate.split('T')[1]?.slice(0, 5) || '17:00',
      allDay: event.allDay || false,
      recurring: event.recurring || 'none',
      recurringEndDate: event.recurringEndDate || '',
      address: event.address || '',
      notes: event.notes || '',
      color: event.color || EVENT_TYPES[event.eventType]?.color || '#0EA5E9',
    });
    setDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    try {
      if (!formData.title || !formData.crewId) {
        toast.error('Title and crew are required');
        return;
      }

      const eventData = {
        ...formData,
        orgId: currentOrg.id,
      };

      if (editingEvent) {
        await updateScheduleEvent(currentOrg.id, editingEvent.id, eventData);
        toast.success('Event updated');
      } else {
        await createScheduleEvent(currentOrg.id, eventData);
        toast.success('Event created');
      }

      setDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Failed to save event:', error);
      toast.error('Failed to save event');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Delete this event?')) return;
    try {
      await deleteScheduleEvent(currentOrg.id, eventId);
      toast.success('Event deleted');
      await loadData();
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error('Failed to delete event');
    }
  };

  const handleNavigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const toggleCrewFilter = (crewId) => {
    setSelectedCrews((prev) =>
      prev.includes(crewId)
        ? prev.filter((id) => id !== crewId)
        : [...prev, crewId]
    );
  };

  const toggleAllCrews = () => {
    if (selectedCrews.length === crews.length) {
      setSelectedCrews([]);
    } else {
      setSelectedCrews(crews.map((c) => c.id));
    }
  };

  // Format date range for header
  const formatWeekRange = () => {
    const start = weekStart;
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `Week of ${start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-900">
        <div className="text-white">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Scheduling & Availability</h1>
          <p className="text-white/60">Manage crew schedules and availability</p>
        </div>

        {/* View Toggle & Navigation */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              onClick={() => setViewMode('week')}
              className="border-white/10 text-white"
            >
              Week View
            </Button>
            <Button
              variant={viewMode === 'day' ? 'default' : 'outline'}
              onClick={() => setViewMode('day')}
              className="border-white/10 text-white"
            >
              Day View
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
              className="border-white/10 text-white"
            >
              List View
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNavigateWeek(-1)}
              className="border-white/10 text-white px-2"
            >
              <ChevronLeft size={18} />
            </Button>
            <span className="text-white text-sm font-medium min-w-[200px] text-center">
              {formatWeekRange()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNavigateWeek(1)}
              className="border-white/10 text-white px-2"
            >
              <ChevronRight size={18} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="border-white/10 text-white"
            >
              Today
            </Button>
          </div>

          <Button
            onClick={() => handleNewEvent()}
            className="bg-sky-500 hover:bg-sky-600 text-white"
          >
            <Plus size={18} className="mr-2" />
            New Event
          </Button>
        </div>

        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {viewMode === 'week' && (
              <WeekView
                weekDays={weekDays}
                today={today}
                getEventsForDate={getEventsForDate}
                onEventClick={handleEditEvent}
                onDateClick={handleNewEvent}
              />
            )}
            {viewMode === 'day' && (
              <DayView
                currentDate={currentDate}
                filteredSchedule={filteredSchedule}
                crews={crews}
                onEventClick={handleEditEvent}
              />
            )}
            {viewMode === 'list' && (
              <ListView
                events={filteredSchedule}
                crews={crews}
                onEventClick={handleEditEvent}
                onDeleteClick={handleDeleteEvent}
              />
            )}
          </div>

          {/* Right Sidebar - Crew Availability */}
          <div className="w-80">
            <Card className="bg-navy-800 border-white/10">
              <div className="p-4 border-b border-white/10">
                <h3 className="text-white font-semibold mb-3">Crew Availability</h3>
                <p className="text-white/60 text-sm mb-3">
                  {currentDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllCrews}
                  className="w-full border-white/10 text-white text-xs mb-3"
                >
                  {selectedCrews.length === crews.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {getCrewAvailability().map((crew) => (
                  <div
                    key={crew.id}
                    className="p-3 bg-navy-900 rounded border border-white/10 cursor-pointer hover:border-sky-500/30 transition-colors"
                    onClick={() => toggleCrewFilter(crew.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{crew.name}</p>
                        <p className="text-white/60 text-xs">
                          {crew.jobCount} job{crew.jobCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Badge
                        variant={crew.isAvailable ? 'default' : 'secondary'}
                        className={
                          crew.isAvailable
                            ? 'bg-green-500/20 text-green-400 text-xs'
                            : 'bg-red-500/20 text-red-400 text-xs'
                        }
                      >
                        {crew.isAvailable ? 'Available' : 'Booked'}
                      </Badge>
                    </div>
                    <p className="text-white/60 text-xs">
                      {crew.hoursBooked.toFixed(1)} hrs booked
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Create/Edit Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-navy-800 border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingEvent ? 'Edit Event' : 'Create Event'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-white/80 text-sm font-medium block mb-1">
                Event Title
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Install New AC Unit"
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            {/* Event Type & Crew */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/80 text-sm font-medium block mb-1">
                  Event Type
                </label>
                <select
                  value={formData.eventType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setFormData({
                      ...formData,
                      eventType: newType,
                      color: EVENT_TYPES[newType]?.color || '#0EA5E9',
                    });
                  }}
                  className="w-full bg-navy-900 border border-white/10 text-white rounded px-3 py-2 text-sm"
                >
                  {Object.entries(EVENT_TYPES).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white/80 text-sm font-medium block mb-1">
                  Assign to Crew
                </label>
                <select
                  value={formData.crewId}
                  onChange={(e) => setFormData({ ...formData, crewId: e.target.value })}
                  className="w-full bg-navy-900 border border-white/10 text-white rounded px-3 py-2 text-sm"
                >
                  <option value="">Select crew...</option>
                  {crews.map((crew) => (
                    <option key={crew.id} value={crew.id}>
                      {crew.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/80 text-sm font-medium block mb-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-white/80 text-sm font-medium block mb-1">
                  Start Time
                </label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white"
                  disabled={formData.allDay}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/80 text-sm font-medium block mb-1">
                  End Date
                </label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-white/80 text-sm font-medium block mb-1">
                  End Time
                </label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white"
                  disabled={formData.allDay}
                />
              </div>
            </div>

            {/* All Day Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allDay"
                checked={formData.allDay}
                onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                className="w-4 h-4 rounded border-white/10 bg-navy-900"
              />
              <label htmlFor="allDay" className="text-white/80 text-sm">
                All Day Event
              </label>
            </div>

            {/* Recurring */}
            <div>
              <label className="text-white/80 text-sm font-medium block mb-1">
                Repeat
              </label>
              <select
                value={formData.recurring}
                onChange={(e) => setFormData({ ...formData, recurring: e.target.value })}
                className="w-full bg-navy-900 border border-white/10 text-white rounded px-3 py-2 text-sm"
              >
                {RECURRING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.recurring !== 'none' && (
              <div>
                <label className="text-white/80 text-sm font-medium block mb-1">
                  Repeat Until (Date)
                </label>
                <Input
                  type="date"
                  value={formData.recurringEndDate}
                  onChange={(e) =>
                    setFormData({ ...formData, recurringEndDate: e.target.value })
                  }
                  className="bg-navy-900 border-white/10 text-white"
                />
              </div>
            )}

            {/* Address */}
            <div>
              <label className="text-white/80 text-sm font-medium block mb-1">
                Address (Optional)
              </label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Job location"
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-white/80 text-sm font-medium block mb-1">
                Notes (Optional)
              </label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional details..."
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40 resize-none"
                rows={3}
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="text-white/80 text-sm font-medium block mb-2">
                Event Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {Object.values(EVENT_TYPES).map((type, idx) => (
                  <button
                    key={idx}
                    onClick={() => setFormData({ ...formData, color: type.color })}
                    className={`w-8 h-8 rounded border-2 transition-all ${
                      formData.color === type.color
                        ? 'border-white'
                        : 'border-white/20'
                    }`}
                    style={{ backgroundColor: type.color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            {editingEvent && (
              <Button
                variant="destructive"
                onClick={() => {
                  handleDeleteEvent(editingEvent.id);
                  setDialogOpen(false);
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEvent} className="bg-sky-500 hover:bg-sky-600">
              {editingEvent ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Week View Component
function WeekView({ weekDays, today, getEventsForDate, onEventClick, onDateClick }) {
  const getDayEvents = (date) => {
    const events = getEventsForDate(date);
    // Sort by start time
    return events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  };

  const isToday = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  };

  return (
    <Card className="bg-navy-800 border-white/10 p-4">
      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {weekDays.map((date, idx) => (
          <div
            key={idx}
            className={`p-3 rounded text-center border ${
              isToday(date)
                ? 'bg-sky-500/20 border-sky-500/50'
                : 'bg-navy-900 border-white/10'
            }`}
          >
            <p className="text-white/60 text-xs font-medium">
              {date.toLocaleDateString('en-US', { weekday: 'short' })}
            </p>
            <p className={`text-lg font-bold ${isToday(date) ? 'text-sky-400' : 'text-white'}`}>
              {date.getDate()}
            </p>
          </div>
        ))}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-7 gap-2 auto-rows-max">
        {weekDays.map((date, dayIdx) => (
          <div
            key={dayIdx}
            onClick={() => onDateClick(date)}
            className={`min-h-32 rounded border-2 p-2 cursor-pointer transition-all ${
              isToday(date)
                ? 'border-sky-500/30 bg-navy-900'
                : 'border-white/10 bg-navy-900 hover:border-sky-500/20'
            }`}
          >
            <div className="space-y-1">
              {getDayEvents(date).map((event, idx) => (
                <EventBlock
                  key={idx}
                  event={event}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Day View Component
function DayView({ currentDate, filteredSchedule, crews, onEventClick }) {
  const dateStr = currentDate.toISOString().split('T')[0];
  const dayEvents = filteredSchedule.filter(
    (event) =>
      new Date(event.startDate).toISOString().split('T')[0] === dateStr ||
      (new Date(event.endDate).toISOString().split('T')[0] >= dateStr &&
        new Date(event.startDate).toISOString().split('T')[0] <= dateStr)
  );

  const crewLanes = crews.map((crew) => ({
    crew,
    events: dayEvents.filter((e) => e.crewId === crew.id),
  }));

  const getEventPosition = (event) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const hour = start.getHours();
    const minute = start.getMinutes();
    const duration = (end - start) / (1000 * 60 * 60);
    return { top: `${(hour - 6) * 60 + minute}px`, height: `${duration * 60}px` };
  };

  return (
    <Card className="bg-navy-800 border-white/10 p-4">
      <p className="text-white/60 text-sm mb-4">
        {currentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>

      <div className="space-y-4">
        {crewLanes.map((lane) => (
          <div key={lane.crew.id} className="border border-white/10 rounded overflow-hidden">
            <div className="bg-navy-900 p-3 border-b border-white/10">
              <p className="text-white font-medium">{lane.crew.name}</p>
            </div>

            <div className="relative bg-navy-900 h-96 overflow-y-auto">
              {HOURS.map((hour) => (
                <div key={hour} className="flex border-t border-white/5 h-16">
                  <div className="w-12 px-2 py-1 text-white/40 text-xs font-medium sticky left-0 bg-navy-900">
                    {hour > 12 ? hour - 12 : hour}
                    {hour >= 12 ? 'p' : 'a'}
                  </div>
                  <div className="flex-1 relative" />
                </div>
              ))}

              {lane.events.map((event) => (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  style={{
                    ...getEventPosition(event),
                    backgroundColor: event.color,
                  }}
                  className="absolute left-14 right-2 rounded p-2 cursor-pointer hover:opacity-80 transition-opacity text-white text-xs font-medium overflow-hidden"
                >
                  <p className="truncate">{event.title}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// List View Component
function ListView({ events, crews, onEventClick, onDeleteClick }) {
  const [sortField, setSortField] = useState('startDate');
  const [sortOrder, setSortOrder] = useState('asc');

  const crewMap = Object.fromEntries(crews.map((c) => [c.id, c.name]));

  const sortedEvents = [...events].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <Card className="bg-navy-800 border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th
                onClick={() => toggleSort('startDate')}
                className="px-4 py-3 text-left text-white/80 font-semibold cursor-pointer hover:text-white"
              >
                Date
              </th>
              <th
                onClick={() => toggleSort('startDate')}
                className="px-4 py-3 text-left text-white/80 font-semibold cursor-pointer hover:text-white"
              >
                Time
              </th>
              <th
                onClick={() => toggleSort('title')}
                className="px-4 py-3 text-left text-white/80 font-semibold cursor-pointer hover:text-white"
              >
                Title
              </th>
              <th
                onClick={() => toggleSort('eventType')}
                className="px-4 py-3 text-left text-white/80 font-semibold cursor-pointer hover:text-white"
              >
                Type
              </th>
              <th
                onClick={() => toggleSort('crewId')}
                className="px-4 py-3 text-left text-white/80 font-semibold cursor-pointer hover:text-white"
              >
                Crew
              </th>
              <th className="px-4 py-3 text-left text-white/80 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedEvents.map((event) => (
              <tr key={event.id} className="border-b border-white/10 hover:bg-navy-900 transition">
                <td className="px-4 py-3 text-white/80">
                  {new Date(event.startDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3 text-white/80">
                  {event.allDay
                    ? 'All day'
                    : `${new Date(event.startDate)
                        .toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })
                        .toLowerCase()}`}
                </td>
                <td className="px-4 py-3 text-white font-medium">{event.title}</td>
                <td className="px-4 py-3">
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: EVENT_TYPES[event.eventType]?.color || '#0EA5E9',
                      color: '#fff',
                    }}
                  >
                    {EVENT_TYPES[event.eventType]?.label || event.eventType}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-white/80">{crewMap[event.crewId]}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button
                    onClick={() => onEventClick(event)}
                    className="p-1 text-white/60 hover:text-sky-400 transition"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onDeleteClick(event.id)}
                    className="p-1 text-white/60 hover:text-red-400 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedEvents.length === 0 && (
        <div className="p-8 text-center text-white/60">
          No events scheduled
        </div>
      )}
    </Card>
  );
}

// Event Block Component
function EventBlock({ event, onClick }) {
  const eventColor = event.color || EVENT_TYPES[event.eventType]?.color || '#0EA5E9';
  const startTime = new Date(event.startDate).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: eventColor }}
      className="p-1.5 rounded text-white text-xs cursor-pointer hover:opacity-80 transition-opacity"
    >
      <p className="font-semibold truncate">{event.title}</p>
      <p className="text-white/80 truncate text-xs">{startTime}</p>
      {event.crewId && <p className="text-white/70 truncate text-xs">{event.crewId}</p>}
    </div>
  );
}
