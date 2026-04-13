import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useOrg } from '../../lib/OrgContext';
import {
  fetchIssues,
  createIssue,
  updateIssue,
  deleteIssue,
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
  AlertCircle,
  MessageSquare,
  CheckCircle,
  Archive,
  Loader,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  identified: { color: 'border-l-orange-500', badge: 'bg-orange-500/20 text-orange-400', label: 'Identified' },
  in_discussion: { color: 'border-l-blue-500', badge: 'bg-blue-500/20 text-blue-400', label: 'Discussing' },
  solved: { color: 'border-l-green-500', badge: 'bg-green-500/20 text-green-400', label: 'Solved' },
  archived: { color: 'border-l-gray-500', badge: 'bg-gray-500/20 text-gray-400', label: 'Archived' },
};

const PRIORITY_CONFIG = {
  high: { color: 'bg-red-500/20 text-red-400', label: 'High' },
  medium: { color: 'bg-yellow-500/20 text-yellow-400', label: 'Medium' },
  low: { color: 'bg-green-500/20 text-green-400', label: 'Low' },
};

function IssueCard({ issue, onEdit, onDelete }) {
  const statusConfig = STATUS_CONFIG[issue.status] || STATUS_CONFIG.identified;
  const priorityConfig = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium;

  const daysOld = Math.floor(
    (new Date() - new Date(issue.created_at)) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card className={`bg-navy-800 border-l-4 ${statusConfig.color} border-r border-t border-b border-navy-700 p-4 min-w-80 hover:bg-navy-750 transition-colors`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge className={priorityConfig.color}>
            {priorityConfig.label}
          </Badge>
          <Badge className={statusConfig.badge}>
            {statusConfig.label}
          </Badge>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(issue)}
            className="p-1 hover:bg-navy-700 rounded transition-colors"
          >
            <Edit2 className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
          <button
            onClick={() => onDelete(issue.id)}
            className="p-1 hover:bg-navy-700 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
          </button>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2">
        {issue.title}
      </h3>

      {issue.description && (
        <p className="text-xs text-gray-400 mb-3 line-clamp-2">
          {issue.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        {issue.department && (
          <span className="bg-navy-700 px-2 py-1 rounded">
            {issue.department}
          </span>
        )}
        <span>{daysOld} days old</span>
      </div>
    </Card>
  );
}

function PersonColumn({ person, issues, onEditIssue, onDeleteIssue }) {
  return (
    <div className="flex flex-col gap-4 min-w-96">
      <div className="flex items-center gap-3 px-4 py-3 bg-navy-850 rounded-lg">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-brand-blue text-navy-950 text-xs font-bold">
            {person.name?.split(' ').map((n) => n[0]).join('') || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold text-white text-sm">{person.name}</h3>
          <p className="text-xs text-gray-400">{issues.length} issues</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onEdit={onEditIssue}
            onDelete={onDeleteIssue}
          />
        ))}
      </div>
    </div>
  );
}

function CreateIssueDialog({ open, onOpenChange, onSubmit, teamUsers }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    owner_id: '',
    department: '',
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
        priority: 'medium',
        owner_id: '',
        department: '',
      });
      onOpenChange(false);
      toast.success('Issue created successfully');
    } catch (error) {
      toast.error('Failed to create issue');
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-900 border-navy-700 text-white">
        <DialogHeader>
          <DialogTitle>Create a New Issue</DialogTitle>
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
              placeholder="What's the issue?"
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
              placeholder="Provide more context"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Priority *
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value })
                }
                className="w-full bg-navy-800 border border-navy-700 rounded text-white text-sm px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Department
            </label>
            <Input
              value={formData.department}
              onChange={(e) =>
                setFormData({ ...formData, department: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
              placeholder="e.g., Engineering, Sales"
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
            Create Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditIssueDialog({ issue, open, onOpenChange, onSubmit }) {
  const [formData, setFormData] = useState(issue || {});
  const [comments, setComments] = useState('');

  useEffect(() => {
    if (issue) {
      setFormData(issue);
    }
  }, [issue, open]);

  const handleSubmit = async () => {
    try {
      await onSubmit(issue.id, formData);
      onOpenChange(false);
      toast.success('Issue updated successfully');
    } catch (error) {
      toast.error('Failed to update issue');
      console.error(error);
    }
  };

  if (!issue) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-900 border-navy-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Issue</DialogTitle>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status || 'identified'}
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
                Priority
              </label>
              <select
                value={formData.priority || 'medium'}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value })
                }
                className="w-full bg-navy-800 border border-navy-700 rounded text-white text-sm px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Comments
            </label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="bg-navy-800 border-navy-700 text-white"
              placeholder="Add a comment"
              rows={3}
            />
          </div>

          <div className="bg-navy-800 rounded p-3 text-sm text-gray-400">
            <p className="font-medium text-white mb-1">Issue Details</p>
            <p>Created: {new Date(formData.created_at || '').toLocaleDateString()}</p>
            {formData.department && <p>Department: {formData.department}</p>}
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

export default function EOSIssues() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [issues, setIssues] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [issuesData, usersData] = await Promise.all([
        fetchIssues(statusFilter === 'all' ? null : statusFilter, currentOrg?.id),
        fetchTeamUsers(),
      ]);
      setIssues(issuesData || []);
      setTeamUsers(usersData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIssue = async (formData) => {
    try {
      const newIssue = await createIssue(formData);
      setIssues([...issues, newIssue]);
      toast.success('Issue created successfully');
    } catch (error) {
      console.error('Failed to create issue:', error);
      throw error;
    }
  };

  const handleUpdateIssue = async (issueId, formData) => {
    try {
      const updated = await updateIssue(issueId, formData);
      setIssues(issues.map((i) => (i.id === issueId ? updated : i)));
    } catch (error) {
      console.error('Failed to update issue:', error);
      throw error;
    }
  };

  const handleDeleteIssue = async (issueId) => {
    try {
      await deleteIssue(issueId);
      setIssues(issues.filter((i) => i.id !== issueId));
      setDeleteConfirm(null);
      toast.success('Issue deleted');
    } catch (error) {
      console.error('Failed to delete issue:', error);
      toast.error('Failed to delete issue');
    }
  };

  const groupedByOwner = teamUsers.reduce((acc, user) => {
    acc[user.id] = {
      ...user,
      issues: issues.filter((i) => i.owner_id === user.id),
    };
    return acc;
  }, {});

  const stats = {
    total: issues.length,
    identified: issues.filter((i) => i.status === 'identified').length,
    discussing: issues.filter((i) => i.status === 'in_discussion').length,
    solved: issues.filter((i) => i.status === 'solved').length,
  };

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Issues (IDS)</h1>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-brand-blue hover:bg-blue-600 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Issue
          </Button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'identified', label: 'Open' },
            { value: 'in_discussion', label: 'Discussing' },
            { value: 'solved', label: 'Solved' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-4 py-2 rounded text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === filter.value
                  ? 'bg-brand-blue text-white'
                  : 'bg-navy-800 text-gray-400 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Total</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </Card>
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Identified</p>
            <p className="text-2xl font-bold text-orange-400">{stats.identified}</p>
          </Card>
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Discussing</p>
            <p className="text-2xl font-bold text-blue-400">{stats.discussing}</p>
          </Card>
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Solved</p>
            <p className="text-2xl font-bold text-green-400">{stats.solved}</p>
          </Card>
        </div>

        {/* Issues Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-8 h-8 text-brand-blue animate-spin" />
          </div>
        ) : issues.length === 0 ? (
          <Card className="bg-navy-800 border-navy-700 p-12 text-center">
            <p className="text-gray-400">No issues found</p>
          </Card>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-6">
              {Object.values(groupedByOwner).map((personData) => (
                <PersonColumn
                  key={personData.id}
                  person={personData}
                  issues={personData.issues}
                  onEditIssue={(issue) => {
                    setSelectedIssue(issue);
                    setEditDialogOpen(true);
                  }}
                  onDeleteIssue={(issueId) => setDeleteConfirm(issueId)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateIssueDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateIssue}
        teamUsers={teamUsers}
      />

      <EditIssueDialog
        issue={selectedIssue}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleUpdateIssue}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete Issue</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400">
            Are you sure you want to delete this issue? This action cannot be undone.
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
              onClick={() => handleDeleteIssue(deleteConfirm)}
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
