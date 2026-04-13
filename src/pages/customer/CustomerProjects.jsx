import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Calendar, DollarSign, Users } from 'lucide-react';
import { useOrg } from '../../lib/OrgContext';
import { fetchProjects, createProject, updateProject, deleteProject, fetchContacts } from '../../lib/customerService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';

const STATUS_COLORS = {
  pending: 'bg-gray-600/20 text-gray-400 border-gray-500/30',
  scheduled: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-green-600/20 text-green-400 border-green-500/30',
  on_hold: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-600/20 text-red-400 border-red-500/30',
};

const PRIORITY_COLORS = {
  low: 'bg-gray-600/20 text-gray-400 border-gray-500/30',
  normal: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  high: 'bg-orange-600/20 text-orange-400 border-orange-500/30',
  urgent: 'bg-red-600/20 text-red-400 border-red-500/30',
};

const STATUS_OPTIONS = ['pending', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'];
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];

export default function CustomerProjects() {
  const { currentOrg } = useOrg();
  const [projects, setProjects] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showDialog, setShowDialog] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectType: '',
    status: 'pending',
    priority: 'normal',
    contactId: '',
    jobAddress: '',
    city: '',
    state: '',
    zip: '',
    scheduledStart: '',
    scheduledEnd: '',
    estimatedValue: '',
    assignedCrew: '',
    tags: '',
    notes: '',
  });

  useEffect(() => {
    if (currentOrg?.id) {
      loadData();
    }
  }, [currentOrg?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, contactsData] = await Promise.all([
        fetchProjects(currentOrg.id),
        fetchContacts(currentOrg.id),
      ]);
      setProjects(projectsData || []);
      setContacts(contactsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = () => {
    setEditingProject(null);
    setFormData({
      title: '',
      description: '',
      projectType: '',
      status: 'pending',
      priority: 'normal',
      contactId: '',
      jobAddress: '',
      city: '',
      state: '',
      zip: '',
      scheduledStart: '',
      scheduledEnd: '',
      estimatedValue: '',
      assignedCrew: '',
      tags: '',
      notes: '',
    });
    setShowDialog(true);
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setFormData({
      title: project.title || '',
      description: project.description || '',
      projectType: project.projectType || '',
      status: project.status || 'pending',
      priority: project.priority || 'normal',
      contactId: project.contactId || '',
      jobAddress: project.jobAddress || '',
      city: project.city || '',
      state: project.state || '',
      zip: project.zip || '',
      scheduledStart: project.scheduledStart ? project.scheduledStart.split('T')[0] : '',
      scheduledEnd: project.scheduledEnd ? project.scheduledEnd.split('T')[0] : '',
      estimatedValue: project.estimatedValue || '',
      assignedCrew: project.assignedCrew || '',
      tags: Array.isArray(project.tags) ? project.tags.join(', ') : project.tags || '',
      notes: project.notes || '',
    });
    setShowDialog(true);
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await deleteProject(projectId);
      setProjects(projects.filter((p) => p.id !== projectId));
      toast.success('Project deleted');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  const handleSaveProject = async () => {
    if (!formData.title.trim()) {
      toast.error('Project title is required');
      return;
    }

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        projectType: formData.projectType,
        status: formData.status,
        priority: formData.priority,
        contactId: formData.contactId,
        jobAddress: formData.jobAddress,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        scheduledStart: formData.scheduledStart || null,
        scheduledEnd: formData.scheduledEnd || null,
        estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : 0,
        assignedCrew: formData.assignedCrew,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        notes: formData.notes,
      };

      if (editingProject) {
        await updateProject(editingProject.id, payload);
        toast.success('Project updated');
      } else {
        const newProject = await createProject(payload);
        toast.success('Project created');
      }

      setShowDialog(false);
      loadData();
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project');
    }
  };

  const getFilteredProjects = () => {
    let filtered = projects;

    if (activeFilter !== 'All') {
      const filterKey = activeFilter.toLowerCase().replace(' ', '_');
      filtered = filtered.filter((p) => p.status === filterKey);
    }

    return filtered;
  };

  const filteredProjects = getFilteredProjects();
  const totalProjects = projects.length;
  const scheduledCount = projects.filter((p) => p.status === 'scheduled').length;
  const inProgressCount = projects.filter((p) => p.status === 'in_progress').length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const totalValue = projects.reduce((sum, p) => sum + (p.estimatedValue || 0), 0);

  const getContactName = (contactId) => {
    const contact = contacts.find((c) => c.id === contactId);
    return contact ? `${contact.firstName} ${contact.lastName}` : 'Unassigned';
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusLabel = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  const getPriorityLabel = (priority) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  const getFilterCounts = (status) => {
    if (status === 'All') return projects.length;
    const key = status.toLowerCase().replace(' ', '_');
    return projects.filter((p) => p.status === key).length;
  };

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Projects</h1>
            <p className="mt-1 text-gray-400">Manage jobs and projects for your customers</p>
          </div>
          <Button onClick={handleAddProject} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="mb-6 grid grid-cols-5 gap-4">
          <Card className="border-navy-800 bg-navy-900 p-4">
            <p className="text-sm text-gray-400">Total Projects</p>
            <p className="mt-2 text-2xl font-bold text-white">{totalProjects}</p>
          </Card>
          <Card className="border-navy-800 bg-navy-900 p-4">
            <p className="text-sm text-gray-400">Scheduled</p>
            <p className="mt-2 text-2xl font-bold text-blue-400">{scheduledCount}</p>
          </Card>
          <Card className="border-navy-800 bg-navy-900 p-4">
            <p className="text-sm text-gray-400">In Progress</p>
            <p className="mt-2 text-2xl font-bold text-green-400">{inProgressCount}</p>
          </Card>
          <Card className="border-navy-800 bg-navy-900 p-4">
            <p className="text-sm text-gray-400">Completed</p>
            <p className="mt-2 text-2xl font-bold text-emerald-400">{completedCount}</p>
          </Card>
          <Card className="border-navy-800 bg-navy-900 p-4">
            <p className="text-sm text-gray-400">Total Value</p>
            <p className="mt-2 text-2xl font-bold text-white">${totalValue.toLocaleString()}</p>
          </Card>
        </div>

        {/* Status Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-3 border-b border-navy-800 pb-4">
          {['All', 'Pending', 'Scheduled', 'In Progress', 'On Hold', 'Completed', 'Cancelled'].map(
            (status) => (
              <button
                key={status}
                onClick={() => setActiveFilter(status)}
                className={`flex items-center gap-2 rounded px-3 py-1 text-sm font-medium transition ${
                  activeFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {status}
                <span className="text-xs opacity-75">({getFilterCounts(status)})</span>
              </button>
            ),
          )}
        </div>

        {/* Projects Grid */}
        {loading ? (
          <Card className="border-navy-800 bg-navy-900 p-8 text-center">
            <p className="text-gray-400">Loading projects...</p>
          </Card>
        ) : filteredProjects.length === 0 ? (
          <Card className="border-navy-800 bg-navy-900 p-12 text-center">
            <p className="mb-4 text-xl text-white">No projects yet</p>
            <p className="mb-6 text-gray-400">Create your first project to get started managing jobs.</p>
            <Button onClick={handleAddProject} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Create First Project
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className="border-navy-800 bg-navy-900 p-6 hover:border-navy-700 transition"
              >
                {/* Project Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">{project.title}</h3>
                    {project.projectType && (
                      <p className="mt-1 text-xs text-gray-500">{project.projectType}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditProject(project)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteProject(project.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Status & Priority Badges */}
                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge className={`border ${STATUS_COLORS[project.status] || STATUS_COLORS.pending}`}>
                    {getStatusLabel(project.status)}
                  </Badge>
                  <Badge className={`border ${PRIORITY_COLORS[project.priority] || PRIORITY_COLORS.normal}`}>
                    {getPriorityLabel(project.priority)}
                  </Badge>
                </div>

                {/* Customer & Address */}
                <div className="mb-4 space-y-2">
                  <p className="text-sm text-gray-400">
                    <span className="font-medium text-gray-300">Customer: </span>
                    {getContactName(project.contactId)}
                  </p>
                  {project.jobAddress && (
                    <div className="text-sm text-gray-400">
                      <p className="font-medium text-gray-300">{project.jobAddress}</p>
                      {[project.city, project.state, project.zip].filter(Boolean).length > 0 && (
                        <p>{[project.city, project.state, project.zip].filter(Boolean).join(', ')}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Dates & Value Row */}
                {(project.scheduledStart || project.scheduledEnd || project.estimatedValue) && (
                  <div className="mb-4 space-y-2 border-t border-navy-800 pt-4">
                    {(project.scheduledStart || project.scheduledEnd) && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {formatDate(project.scheduledStart)}
                          {project.scheduledEnd && ` - ${formatDate(project.scheduledEnd)}`}
                        </span>
                      </div>
                    )}
                    {project.estimatedValue > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <DollarSign className="h-4 w-4" />
                        <span>${project.estimatedValue.toLocaleString()}</span>
                      </div>
                    )}
                    {project.assignedCrew && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Users className="h-4 w-4" />
                        <span>{project.assignedCrew}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tags */}
                {project.tags && project.tags.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {project.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        className="border-navy-700 bg-navy-800 text-xs text-gray-300"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Notes Preview */}
                {project.notes && (
                  <div className="mb-4 border-t border-navy-800 pt-4">
                    <p className="text-xs font-medium text-gray-400 mb-2">Notes</p>
                    <p className="text-sm text-gray-400 line-clamp-2">{project.notes}</p>
                  </div>
                )}

                {/* Description Preview */}
                {project.description && (
                  <div className="border-t border-navy-800 pt-4">
                    <p className="text-xs font-medium text-gray-400 mb-2">Description</p>
                    <p className="text-sm text-gray-400 line-clamp-2">{project.description}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl border-navy-800 bg-navy-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingProject ? 'Edit Project' : 'Create New Project'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-sm font-medium text-gray-300">Project Title *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 border-navy-800 bg-navy-800 text-white"
                placeholder="e.g., AC Replacement, Roof Inspection"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-300">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 border-navy-800 bg-navy-800 text-white"
                placeholder="Project details and requirements..."
                rows={3}
              />
            </div>

            {/* Project Type */}
            <div>
              <label className="text-sm font-medium text-gray-300">Project Type</label>
              <Input
                value={formData.projectType}
                onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                className="mt-1 border-navy-800 bg-navy-800 text-white"
                placeholder="e.g., HVAC, Plumbing, Roofing"
              />
            </div>

            {/* Status & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="mt-1 w-full rounded border border-navy-800 bg-navy-800 px-3 py-2 text-white"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {getStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="mt-1 w-full rounded border border-navy-800 bg-navy-800 px-3 py-2 text-white"
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {getPriorityLabel(priority)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Customer Contact */}
            <div>
              <label className="text-sm font-medium text-gray-300">Customer</label>
              <select
                value={formData.contactId}
                onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                className="mt-1 w-full rounded border border-navy-800 bg-navy-800 px-3 py-2 text-white"
              >
                <option value="">Select a customer...</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </option>
                ))}
              </select>
            </div>

            {/* Job Address */}
            <div>
              <label className="text-sm font-medium text-gray-300">Job Address</label>
              <Input
                value={formData.jobAddress}
                onChange={(e) => setFormData({ ...formData, jobAddress: e.target.value })}
                className="mt-1 border-navy-800 bg-navy-800 text-white"
                placeholder="123 Main St"
              />
            </div>

            {/* City, State, Zip */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300">City</label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="mt-1 border-navy-800 bg-navy-800 text-white"
                  placeholder="Orlando"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">State</label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="mt-1 border-navy-800 bg-navy-800 text-white"
                  placeholder="FL"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Zip</label>
                <Input
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  className="mt-1 border-navy-800 bg-navy-800 text-white"
                  placeholder="32801"
                />
              </div>
            </div>

            {/* Scheduled Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Scheduled Start</label>
                <Input
                  type="date"
                  value={formData.scheduledStart}
                  onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                  className="mt-1 border-navy-800 bg-navy-800 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Scheduled End</label>
                <Input
                  type="date"
                  value={formData.scheduledEnd}
                  onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                  className="mt-1 border-navy-800 bg-navy-800 text-white"
                />
              </div>
            </div>

            {/* Estimated Value */}
            <div>
              <label className="text-sm font-medium text-gray-300">Estimated Value</label>
              <Input
                type="number"
                value={formData.estimatedValue}
                onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                className="mt-1 border-navy-800 bg-navy-800 text-white"
                placeholder="0.00"
                step="0.01"
              />
            </div>

            {/* Assigned Crew */}
            <div>
              <label className="text-sm font-medium text-gray-300">Assigned Crew</label>
              <Input
                value={formData.assignedCrew}
                onChange={(e) => setFormData({ ...formData, assignedCrew: e.target.value })}
                className="mt-1 border-navy-800 bg-navy-800 text-white"
                placeholder="e.g., Team A, John Smith"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium text-gray-300">Tags (comma separated)</label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="mt-1 border-navy-800 bg-navy-800 text-white"
                placeholder="urgent, warranty, follow-up"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-gray-300">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 border-navy-800 bg-navy-800 text-white"
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-navy-800 pt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-navy-700">
              Cancel
            </Button>
            <Button onClick={handleSaveProject} className="bg-blue-600 hover:bg-blue-700">
              {editingProject ? 'Update Project' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
