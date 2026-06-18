import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Plus, Play, LogIn, Eye, Trash2, Video, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { useOrg } from '../../lib/OrgContext';
import { fetchMeetings, fetchTeamUsers, createMeeting, deleteMeeting } from '../../lib/eosService';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { createRallyLink } from '../../lib/videoService';

export default function EOSL10Meetings() {
  const navigate = useNavigate();
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    scheduled_date: '',
    duration_minutes: 60,
    facilitator: '',
    attendees: [],
    is_video: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [meetingsData, usersData] = await Promise.all([
        fetchMeetings(currentOrg?.id),
        fetchTeamUsers(),
      ]);
      setMeetings(meetingsData || []);
      setTeamUsers(usersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeeting = async () => {
    if (!formData.title || !formData.scheduled_date || !formData.facilitator) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // Mint a reusable Liftori video room when this is a video meeting
      let meetingUrl = null;
      if (formData.is_video) {
        try {
          const link = await createRallyLink(
            { label: formData.title, linkType: 'recurring', maxGuests: 25 },
            user?.id
          );
          meetingUrl = `${window.location.origin}/rally/join/${link.code}`;
        } catch (linkErr) {
          console.error('Error creating video room:', linkErr);
          toast.error('Could not create video link — meeting saved without one');
        }
      }

      const meeting = await createMeeting({
        title: formData.title,
        scheduled_date: formData.scheduled_date,
        duration_minutes: parseInt(formData.duration_minutes),
        facilitator_id: formData.facilitator,
        attendees: formData.attendees,
        team_ids: formData.attendees,
        video_enabled: formData.is_video,
        is_in_person: !formData.is_video,
        meeting_url: meetingUrl,
        org_id: currentOrg?.id || null,
        created_by: user?.id || null,
        status: 'scheduled',
      });

      // Add to the in-app Liftori calendar so attendees can join from there
      try {
        const start = new Date(formData.scheduled_date);
        const end = new Date(start.getTime() + parseInt(formData.duration_minutes) * 60000);
        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
        const attendeeNames = formData.attendees
          .map((id) => teamUsers.find((u) => u.id === id)?.name)
          .filter(Boolean)
          .join(', ');
        await supabase.from('admin_calendar_events').insert([{
          title: formData.title,
          description: [
            formData.is_video ? 'Video L10 meeting' : 'In-person L10 meeting',
            attendeeNames ? `Attendees: ${attendeeNames}` : null,
          ].filter(Boolean).join('\n'),
          start_date: dateStr,
          start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
          end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
          all_day: false,
          color: 'blue',
          meeting_url: meetingUrl,
          eos_meeting_id: meeting?.id || null,
          user_id: user?.id || null,
        }]);
      } catch (calErr) {
        console.error('Error adding to calendar:', calErr);
      }

      toast.success('Meeting scheduled');
      setDialogOpen(false);
      setFormData({
        title: '',
        scheduled_date: '',
        duration_minutes: 60,
        facilitator: '',
        attendees: [],
        is_video: true,
      });
      await loadData();
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast.error('Failed to create meeting');
    }
  };

  const handleDeleteMeeting = async (meetingId) => {
    if (window.confirm('Are you sure you want to delete this meeting?')) {
      try {
        await supabase.from('admin_calendar_events').delete().eq('eos_meeting_id', meetingId);
        await deleteMeeting(meetingId);
        toast.success('Meeting deleted');
        await loadData();
      } catch (error) {
        console.error('Error deleting meeting:', error);
        toast.error('Failed to delete meeting');
      }
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      scheduled: { bg: 'bg-blue-600', text: 'Scheduled' },
      in_progress: { bg: 'bg-green-600', text: 'In Progress' },
      complete: { bg: 'bg-gray-600', text: 'Complete' },
      cancelled: { bg: 'bg-red-600', text: 'Cancelled' },
    };
    const config = statusConfig[status] || statusConfig.scheduled;
    return <Badge className={`${config.bg} text-white`}>{config.text}</Badge>;
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
           ' at ' +
           date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const facilitatorName = (facilitatorId) => {
    const user = teamUsers.find(u => u.id === facilitatorId);
    return user ? user.name : 'Unknown';
  };

  const getAttendeeAvatars = (attendeeIds) => {
    if (!attendeeIds || attendeeIds.length === 0) return [];
    const attendees = attendeeIds.slice(0, 5).map(id => teamUsers.find(u => u.id === id)).filter(Boolean);
    return attendees;
  };

  const sortedMeetings = [...meetings].sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-950">
        <p className="text-gray-400">Loading meetings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">L10 Meetings</h1>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Schedule Meeting
          </Button>
        </div>

        {/* Meetings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedMeetings.map((meeting) => (
            <Card key={meeting.id} className="bg-navy-900 border-navy-800 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">{meeting.title}</h3>
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                    <Calendar className="w-4 h-4" />
                    {formatDateTime(meeting.scheduled_date)}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Clock className="w-4 h-4" />
                    {meeting.duration_minutes} minutes
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-sm mt-2">
                    {meeting.is_in_person ? <MapPin className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    {meeting.is_in_person ? 'In person' : 'Video'}
                  </div>
                </div>
                <div className="ml-4">
                  {getStatusBadge(meeting.status)}
                </div>
              </div>

              <div className="mb-4 pb-4 border-t border-navy-800">
                <p className="text-sm text-gray-400 mt-3">
                  Facilitator: <span className="text-white font-medium">{facilitatorName(meeting.facilitator_id)}</span>
                </p>
              </div>

              {/* Attendee Avatars */}
              {getAttendeeAvatars(meeting.attendees).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-2">Attendees</p>
                  <div className="flex items-center gap-1">
                    {getAttendeeAvatars(meeting.attendees).map((attendee) => (
                      <Avatar key={attendee.id} className="w-8 h-8 bg-navy-800">
                        <AvatarFallback className="text-xs bg-blue-600 text-white">
                          {attendee.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {meeting.attendees && meeting.attendees.length > 5 && (
                      <span className="text-xs text-gray-400 ml-2">+{meeting.attendees.length - 5}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-navy-800">
                {meeting.meeting_url && (
                  <Button
                    onClick={() => window.open(meeting.meeting_url, '_blank', 'noopener')}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                  >
                    <Video className="w-3 h-3 mr-1" />
                    Join Meeting
                  </Button>
                )}
                {meeting.status === 'scheduled' && (
                  <Button
                    onClick={() => navigate(`/admin/eos/meetings/${meeting.id}`)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white flex-1"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Start
                  </Button>
                )}
                {meeting.status === 'in_progress' && (
                  <Button
                    onClick={() => navigate(`/admin/eos/meetings/${meeting.id}`)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                  >
                    <LogIn className="w-3 h-3 mr-1" />
                    Join
                  </Button>
                )}
                {meeting.status === 'complete' && (
                  <Button
                    onClick={() => navigate(`/admin/eos/meetings/${meeting.id}`)}
                    size="sm"
                    className="bg-gray-600 hover:bg-gray-700 text-white flex-1"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </Button>
                )}
                <Button
                  onClick={() => handleDeleteMeeting(meeting.id)}
                  size="sm"
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-900/20"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {sortedMeetings.length === 0 && (
          <Card className="bg-navy-900 border-navy-800 p-12 text-center">
            <p className="text-gray-400 mb-4">No meetings scheduled yet</p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Schedule Your First Meeting
            </Button>
          </Card>
        )}
      </div>

      {/* Create Meeting Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-navy-900 border-navy-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule New L10 Meeting</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Meeting Title</label>
              <Input
                placeholder="e.g., Weekly L10"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Scheduled Date & Time</label>
              <Input
                type="datetime-local"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Duration</label>
              <select
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-md px-3 py-2"
              >
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">120 minutes</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_video}
                  onChange={(e) => setFormData({ ...formData, is_video: e.target.checked })}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm font-medium">Video meeting (uncheck for in person)</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                {formData.is_video
                  ? 'A Liftori video link will be created and added to the calendar.'
                  : 'No video link \u2014 this is an in-person meeting.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Facilitator</label>
              <select
                value={formData.facilitator}
                onChange={(e) => setFormData({ ...formData, facilitator: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-md px-3 py-2"
              >
                <option value="">Select facilitator...</option>
                {teamUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Attendees</label>
              <div className="bg-navy-800 border border-navy-700 rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {teamUsers.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 cursor-pointer hover:text-blue-400">
                    <input
                      type="checkbox"
                      checked={formData.attendees.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            attendees: [...formData.attendees, user.id],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            attendees: formData.attendees.filter(id => id !== user.id),
                          });
                        }
                      }}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    <span className="text-sm">{user.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              onClick={() => setDialogOpen(false)}
              variant="outline"
              className="border-navy-700 text-gray-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateMeeting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
