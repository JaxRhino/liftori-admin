import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useOrg } from '../../lib/OrgContext';
import {
  fetchRocks,
  createRock,
  updateRock,
  updateRockProgress,
  deleteRock,
  fetchTeamUsers,
} from '../../lib/eosService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader,
} from 'lucide-react';
import { toast } from 'sonner';

// Generate dynamic quarters: current quarter + 3 past + 4 future
function generateQuarters() {
  const now = new Date();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();
  const quarters = [];
  // 3 quarters back + current + 4 ahead = 8 quarters
  for (let offset = -3; offset <= 4; offset++) {
    let q = currentQ + offset;
    let y = currentYear;
    while (q < 1) { q += 4; y--; }
    while (q > 4) { q -= 4; y++; }
    quarters.push(`Q${q} ${y}`);
  }
  return quarters;
}
const QUARTERS = generateQuarters();

const STATUS_CONFIG = {
  not_started: { color: 'bg-gray-500', label: 'Not Started', icon: Clock },
  on_track: { color: 'bg-green-500', label: 'On Track', icon: CheckCircle },
  at_risk: { color: 'bg-yellow-500', label: 'At Risk', icon: AlertCircle },
  off_track: { color: 'bg-red-500', label: 'Off Track', icon: AlertCircle },
  complete: { color: 'bg-blue-500', label: 'Complete', icon: CheckCircle },
};

function RockCard({ rock, onEdit, onDelete, compact = false }) {
  const statusConfig = STATUS_CONFIG[rock.status] || STATUS_CONFIG.not_started;
  const daysRemaining = Math.ceil(
    (new Date(rock.quarter_end) - new Date()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card className="bg-navy-800 border-navy-700 p-4 min-w-80 hover:bg-navy-750 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${statusConfig.color}`}
          ></div>
          <Badge className="bg-navy-700 text-xs">{statusConfig.label}</Badge>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(rock)}
            className="p-1 hover:bg-navy-700 rounded transition-colors"
          >
            <Edit2 className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
          <button
            onClick={() => onDelete(rock.id)}
            className="p-1 hover:bg-navy-700 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
          </button>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2">
        {rock.title}
      </h3>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progress</span>
          <span>{rock.progress || 0}%</span>
        </div>
        <div className="w-full bg-navy-700 rounded-full h-2">
          <div
            className="bg-brand-blue h-2 rounded-full transition-all"
            style={{ width: `${rock.progress || 0}%` }}
          ></div>
        </div>
      </div>

      <div className="flex justify-between items-center text-xs text-gray-400">
        <span>{rock.quarter}</span>
        <span>{daysRemaining > 0 ? `${daysRemaining}d left` : 'Expired'}</span>
      </div>
    </Card>
  );
}

function PersonColumn({ person, rocks, onEditRock, onDeleteRock }) {
  const displayName = person.full_name || person.name || person.email || 'Unknown';
  return (
    <div className="flex flex-col gap-4 min-w-96">
      <div className="flex items-center gap-3 px-4 py-3 bg-navy-850 rounded-lg">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-brand-blue text-navy-950 text-xs font-bold">
            {displayName.split(' ').map((n) => n[0]).join('') || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold text-white text-sm">{displayName}</h3>
          <p className="text-xs text-gray-400">{rocks.length} rocks</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {rocks.map((rock) => (
          <RockCard
            key={rock.id}
            rock={rock}
            onEdit={onEditRock}
            onDelete={onDeleteRock}
          />
        ))}
      </div>
    </div>
  );
}

function CreateRockDialog({ open, onOpenChange, onSubmit, teamUsers }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    owner_id: '',
    rock_type: 'company',
    quarter: QUARTERS[3],
    success_criteria: '',
  });

  const handleSubmit = async () => {
    if (!formData.title || !formData.owner_id) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      await onSubmit(formData);
      setFormData({
        title: '',
        description: '',
        owner_id: '',
        rock_type: 'company',
        quarter: QUARTERS[3],
        success_criteria: '',
      });
      onOpenChange(false);
      toast.success('Rock created successfully');
    } catch (error) {
      toast.error('Failed to create rock');
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-900 border-navy-700 text-white">
        <DialogHeader>
          <DialogTitle>Create a New Rock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Title *
            </label>
            <Input
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
              placeholder="Enter rock title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
              placeholder="Describe the rock"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Owner *
              </label>
              <select
                value={formData.owner_id}
                onChange={(e) =>
                  setFormData({ ...formData, owner_id: e.target.value })
                }
                className="w-full bg-navy-800 border border-navy-700 rounded text-white text-sm px-3 py-2"
              >
                <option value="">Select owner</option>
                {teamUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Type
              </label>
              <select
                value={formData.rock_type}
                onChange={(e) =>
                  setFormData({ ...formData, rock_type: e.target.value })
                }
                className="w-full bg-navy-800 border border-navy-700 rounded text-white text-sm px-3 py-2"
              >
                <option value="company">Company</option>
                <option value="department">Department</option>
                <option value="personal">Personal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Quarter
              </label>
              <select
                value={formData.quarter}
                onChange={(e) =>
                  setFormData({ ...formData, quarter: e.target.value })
                }
                className="w-full bg-navy-800 border border-navy-700 rounded text-white text-sm px-3 py-2"
              >
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Success Criteria
            </label>
            <Textarea
              value={formData.success_criteria}
              onChange={(e) =>
                setFormData({ ...formData, success_criteria: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
              placeholder="Define what success looks like"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-navy-700 text-white hover:bg-navy-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-brand-blue hover:bg-blue-600 text-white"
          >
            Create Rock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRockDialog({ rock, open, onOpenChange, onSubmit }) {
  const [formData, setFormData] = useState(rock || {});

  useEffect(() => {
    if (rock) {
      setFormData(rock);
    }
  }, [rock, open]);

  const handleSubmit = async () => {
    try {
      await onSubmit(rock.id, formData);
      onOpenChange(false);
      toast.success('Rock updated successfully');
    } catch (error) {
      toast.error('Failed to update rock');
      console.error(error);
    }
  };

  if (!rock) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-900 border-navy-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Rock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Title
            </label>
            <Input
              value={formData.title || ''}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Progress: {formData.progress || 0}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={formData.progress || 0}
              onChange={(e) =>
                setFormData({ ...formData, progress: parseInt(e.target.value) })
              }
              className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Status
            </label>
            <select
              value={formData.status || 'not_started'}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full bg-navy-800 border border-navy-700 rounded text-white text-sm px-3 py-2"
            >
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Success Criteria
            </label>
            <Textarea
              value={formData.success_criteria || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  success_criteria: e.target.value,
                })
              }
              className="bg-navy-800 border-navy-700 text-white"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-navy-700 text-white hover:bg-navy-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-brand-blue hover:bg-blue-600 text-white"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EOSRocks() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [rocks, setRocks] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [selectedQuarter, setSelectedQuarter] = useState(QUARTERS[3]); // Current quarter
  const [viewMode, setViewMode] = useState('all'); // 'my' or 'all'
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRock, setSelectedRock] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedQuarter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rocksData, usersData] = await Promise.all([
        fetchRocks(selectedQuarter, currentOrg?.id),
        fetchTeamUsers(),
      ]);
      setRocks(rocksData || []);
      setTeamUsers(usersData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load rocks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRock = async (formData) => {
    try {
      const newRock = await createRock(formData);
      setRocks([...rocks, newRock]);
      toast.success('Rock created successfully');
    } catch (error) {
      console.error('Failed to create rock:', error);
      throw error;
    }
  };

  const handleUpdateRock = async (rockId, formData) => {
    try {
      const updated = await updateRock(rockId, formData);
      setRocks(rocks.map((r) => (r.id === rockId ? updated : r)));
    } catch (error) {
      console.error('Failed to update rock:', error);
      throw error;
    }
  };

  const handleDeleteRock = async (rockId) => {
    try {
      await deleteRock(rockId);
      setRocks(rocks.filter((r) => r.id !== rockId));
      setDeleteConfirm(null);
      toast.success('Rock deleted');
    } catch (error) {
      console.error('Failed to delete rock:', error);
      toast.error('Failed to delete rock');
    }
  };

  const displayRocks =
    viewMode === 'my' ? rocks.filter((r) => r.owner_id === user?.id) : rocks;

  const groupedByOwner = teamUsers.reduce((acc, user) => {
    acc[user.id] = {
      ...user,
      rocks: displayRocks.filter((r) => r.owner_id === user.id),
    };
    return acc;
  }, {});

  const stats = {
    total: displayRocks.length,
    on_track: displayRocks.filter((r) => r.status === 'on_track').length,
    at_risk: displayRocks.filter((r) => r.status === 'at_risk').length,
    off_track: displayRocks.filter((r) => r.status === 'off_track').length,
    complete: displayRocks.filter((r) => r.status === 'complete').length,
  };

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">90-Day Rocks</h1>
          <div className="flex items-center gap-4">
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="bg-navy-800 border border-navy-700 rounded text-white px-4 py-2 text-sm"
            >
              {QUARTERS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-brand-blue hover:bg-blue-600 text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Rock
            </Button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              viewMode === 'all'
                ? 'bg-brand-blue text-white'
                : 'bg-navy-800 text-gray-400 hover:text-white'
            }`}
          >
            All Rocks
          </button>
          <button
            onClick={() => setViewMode('my')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              viewMode === 'my'
                ? 'bg-brand-blue text-white'
                : 'bg-navy-800 text-gray-400 hover:text-white'
            }`}
          >
            My Rocks
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Total</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </Card>
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">On Track</p>
            <p className="text-2xl font-bold text-green-400">{stats.on_track}</p>
          </Card>
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">At Risk</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.at_risk}</p>
          </Card>
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Off Track</p>
            <p className="text-2xl font-bold text-red-400">{stats.off_track}</p>
          </Card>
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Complete</p>
            <p className="text-2xl font-bold text-blue-400">{stats.complete}</p>
          </Card>
        </div>

        {/* Rocks Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-8 h-8 text-brand-blue animate-spin" />
          </div>
        ) : displayRocks.length === 0 ? (
          <Card className="bg-navy-800 border-navy-700 p-12 text-center">
            <p className="text-gray-400">No rocks found for this quarter</p>
          </Card>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-6">
              {Object.values(groupedByOwner).map((personData) => (
                <PersonColumn
                  key={personData.id}
                  person={personData}
                  rocks={personData.rocks}
                  onEditRock={(rock) => {
                    setSelectedRock(rock);
                    setEditDialogOpen(true);
                  }}
                  onDeleteRock={(rockId) => setDeleteConfirm(rockId)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateRockDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateRock}
        teamUsers={teamUsers}
      />

      <EditRockDialog
        rock={selectedRock}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleUpdateRock}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete Rock</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400">
            Are you sure you want to delete this rock? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="border-navy-700 text-white hover:bg-navy-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleDeleteRock(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
