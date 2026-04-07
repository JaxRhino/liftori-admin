import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { fetchAccountabilityChart, fetchTeamUsers, saveAccountabilityChart } from '../../lib/eosService';

const DEPARTMENT_COLORS = {
  leadership: 'bg-purple-600',
  sales: 'bg-green-600',
  operations: 'bg-blue-600',
  marketing: 'bg-pink-600',
  support: 'bg-orange-600',
  admin: 'bg-gray-600',
};

const DEPARTMENT_NAMES = {
  leadership: 'Leadership',
  sales: 'Sales',
  operations: 'Operations',
  marketing: 'Marketing',
  support: 'Support',
  admin: 'Admin',
};

export default function EOSAccountabilityChart() {
  const [seats, setSeats] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState(null);
  const [formData, setFormData] = useState({
    id: null,
    title: '',
    department: 'leadership',
    person_id: '',
    roles: [],
    gets_it: false,
    wants_it: false,
    capacity: false,
    reports_to: null,
  });

  const [newRoleInput, setNewRoleInput] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [chartData, usersData] = await Promise.all([
        fetchAccountabilityChart(),
        fetchTeamUsers(),
      ]);
      setSeats(chartData || []);
      setTeamUsers(usersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load accountability chart');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (seat = null) => {
    if (seat) {
      setEditingSeat(seat);
      setFormData({
        id: seat.id,
        title: seat.title,
        department: seat.department || 'leadership',
        person_id: seat.person_id || '',
        roles: seat.roles || [],
        gets_it: seat.gets_it || false,
        wants_it: seat.wants_it || false,
        capacity: seat.capacity || false,
        reports_to: seat.reports_to || null,
      });
    } else {
      setEditingSeat(null);
      setFormData({
        id: null,
        title: '',
        department: 'leadership',
        person_id: '',
        roles: [],
        gets_it: false,
        wants_it: false,
        capacity: false,
        reports_to: null,
      });
    }
    setNewRoleInput('');
    setDialogOpen(true);
  };

  const handleAddRole = () => {
    if (newRoleInput.trim()) {
      if (formData.roles.length < 5) {
        setFormData({
          ...formData,
          roles: [...formData.roles, newRoleInput.trim()],
        });
        setNewRoleInput('');
      } else {
        toast.error('Maximum 5 roles per seat');
      }
    }
  };

  const handleRemoveRole = (index) => {
    setFormData({
      ...formData,
      roles: formData.roles.filter((_, i) => i !== index),
    });
  };

  const handleSaveSeat = async () => {
    if (!formData.title) {
      toast.error('Please enter a seat title');
      return;
    }

    try {
      const newSeats = editingSeat
        ? seats.map((s) => (s.id === formData.id ? formData : s))
        : [...seats, { ...formData, id: Date.now().toString() }];

      await saveAccountabilityChart(newSeats);
      toast.success(editingSeat ? 'Seat updated' : 'Seat added');
      setDialogOpen(false);
      setSeats(newSeats);
    } catch (error) {
      console.error('Error saving seat:', error);
      toast.error('Failed to save seat');
    }
  };

  const handleDeleteSeat = async (seatId) => {
    if (window.confirm('Are you sure you want to remove this seat?')) {
      try {
        const newSeats = seats.filter((s) => s.id !== seatId);
        await saveAccountabilityChart(newSeats);
        toast.success('Seat removed');
        setSeats(newSeats);
      } catch (error) {
        console.error('Error deleting seat:', error);
        toast.error('Failed to remove seat');
      }
    }
  };

  const getPersonName = (personId) => {
    if (!personId) return 'Vacant';
    const user = teamUsers.find((u) => u.id === personId);
    return user ? user.name : 'Unknown';
  };

  const getPersonAvatar = (personId) => {
    if (!personId) return null;
    const user = teamUsers.find((u) => u.id === personId);
    return user;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-950">
        <p className="text-gray-400">Loading accountability chart...</p>
      </div>
    );
  }

  // Group seats by hierarchy level (reports_to)
  const topLevelSeats = seats.filter((s) => !s.reports_to);
  const seatsMap = new Map(seats.map((s) => [s.id, s]));

  const getDirectReports = (seatId) => {
    return seats.filter((s) => s.reports_to === seatId);
  };

  const SeatCard = ({ seat, level = 0 }) => {
    const person = getPersonAvatar(seat.person_id);
    const directReports = getDirectReports(seat.id);

    return (
      <div key={seat.id} style={{ marginLeft: `${level * 24}px` }} className="mb-4">
        <Card className="bg-navy-900 border-navy-800 p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">{seat.title}</h3>
              <Badge className={`${DEPARTMENT_COLORS[seat.department] || DEPARTMENT_COLORS.admin} text-white mt-2`}>
                {DEPARTMENT_NAMES[seat.department] || 'Department'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleOpenDialog(seat)}
                size="sm"
                variant="outline"
                className="border-blue-600 text-blue-400 hover:bg-blue-900/20"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                onClick={() => handleDeleteSeat(seat.id)}
                size="sm"
                variant="outline"
                className="border-red-600 text-red-400 hover:bg-red-900/20"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Person */}
          <div className="mb-4 pb-4 border-t border-navy-800">
            <p className="text-xs text-gray-400 mt-3 mb-2">Assigned To</p>
            <div className="flex items-center gap-2">
              {person ? (
                <>
                  <Avatar className="w-8 h-8 bg-blue-600">
                    <AvatarFallback className="text-xs text-white">
                      {person.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-white font-medium">{person.name}</span>
                </>
              ) : (
                <span className="text-gray-400 italic">Vacant</span>
              )}
            </div>
          </div>

          {/* GWC Score */}
          <div className="mb-4 pb-4 border-t border-navy-800">
            <p className="text-xs text-gray-400 mt-3 mb-2">GWC Score</p>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer hover:text-blue-400">
                <input
                  type="checkbox"
                  checked={seat.gets_it}
                  onChange={(e) => {
                    const updatedSeats = seats.map((s) =>
                      s.id === seat.id ? { ...s, gets_it: e.target.checked } : s
                    );
                    setSeats(updatedSeats);
                  }}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm text-gray-400">Gets it</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-blue-400">
                <input
                  type="checkbox"
                  checked={seat.wants_it}
                  onChange={(e) => {
                    const updatedSeats = seats.map((s) =>
                      s.id === seat.id ? { ...s, wants_it: e.target.checked } : s
                    );
                    setSeats(updatedSeats);
                  }}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm text-gray-400">Wants it</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-blue-400">
                <input
                  type="checkbox"
                  checked={seat.capacity}
                  onChange={(e) => {
                    const updatedSeats = seats.map((s) =>
                      s.id === seat.id ? { ...s, capacity: e.target.checked } : s
                    );
                    setSeats(updatedSeats);
                  }}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm text-gray-400">Capacity</span>
              </label>
            </div>
          </div>

          {/* Roles */}
          {seat.roles && seat.roles.length > 0 && (
            <div className="pt-4 border-t border-navy-800">
              <p className="text-xs text-gray-400 mb-2 uppercase">Key Responsibilities</p>
              <ul className="space-y-1">
                {seat.roles.map((role, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex items-center gap-2">
                    <span className="text-blue-400">•</span>
                    {role}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Direct Reports */}
        {directReports.length > 0 && (
          <div className="mt-4 ml-6 border-l-2 border-navy-800 pl-4">
            {directReports.map((report) => (
              <SeatCard key={report.id} seat={report} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Accountability Chart</h1>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Seat
          </Button>
        </div>

        {/* Seats Tree */}
        {seats.length === 0 ? (
          <Card className="bg-navy-900 border-navy-800 p-12 text-center">
            <p className="text-gray-400 mb-4">No seats defined yet</p>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create Your First Seat
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {topLevelSeats.map((seat) => (
              <SeatCard key={seat.id} seat={seat} level={0} />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Seat Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-navy-900 border-navy-800 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSeat ? 'Edit Seat' : 'Add Seat'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Seat Title</label>
              <Input
                placeholder="e.g., CEO, Sales Manager, Developer"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-md px-3 py-2"
              >
                {Object.entries(DEPARTMENT_NAMES).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Assigned Person</label>
              <select
                value={formData.person_id}
                onChange={(e) => setFormData({ ...formData, person_id: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-md px-3 py-2"
              >
                <option value="">Vacant</option>
                {teamUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Key Responsibilities</label>
              <div className="space-y-2 mb-3">
                {formData.roles.map((role, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-md px-3 py-2">
                    <span className="flex-1 text-sm">{role}</span>
                    <button
                      onClick={() => handleRemoveRole(idx)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              {formData.roles.length < 5 && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a responsibility..."
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddRole()}
                    className="bg-navy-800 border-navy-700 text-white placeholder-gray-500 flex-1"
                  />
                  <Button
                    onClick={handleAddRole}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Add
                  </Button>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {formData.roles.length}/5 roles added
              </p>
            </div>

            <div className="pt-4 border-t border-navy-700">
              <label className="block text-sm font-medium mb-3">GWC Assessment</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer hover:text-blue-400">
                  <input
                    type="checkbox"
                    checked={formData.gets_it}
                    onChange={(e) => setFormData({ ...formData, gets_it: e.target.checked })}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm">Gets it (understands the role)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-blue-400">
                  <input
                    type="checkbox"
                    checked={formData.wants_it}
                    onChange={(e) => setFormData({ ...formData, wants_it: e.target.checked })}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm">Wants it (committed to role)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-blue-400">
                  <input
                    type="checkbox"
                    checked={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.checked })}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm">Capacity (has time for role)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Reports To</label>
              <select
                value={formData.reports_to || ''}
                onChange={(e) => setFormData({ ...formData, reports_to: e.target.value || null })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-md px-3 py-2"
              >
                <option value="">Top Level</option>
                {seats
                  .filter((s) => s.id !== formData.id)
                  .map((seat) => (
                    <option key={seat.id} value={seat.id}>
                      {seat.title}
                    </option>
                  ))}
              </select>
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
              onClick={handleSaveSeat}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {editingSeat ? 'Update' : 'Create'} Seat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
