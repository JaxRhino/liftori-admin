import React, { useState, useEffect } from 'react';
import { useOrg } from '../../../lib/OrgContext';
import {
  fetchWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  getNextWONumber,
  fetchCrews
} from '../../../lib/customerOpsService';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  CheckCircle,
  AlertCircle,
  X,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const WORK_ORDER_CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'repair', label: 'Repair' },
  { id: 'installation', label: 'Installation' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'inspection', label: 'Inspection' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'warranty', label: 'Warranty' },
  { id: 'callback', label: 'Callback' }
];

const PRIORITY_LEVELS = [
  { id: 'low', label: 'Low', color: 'bg-gray-500' },
  { id: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { id: 'high', label: 'High', color: 'bg-orange-500' },
  { id: 'urgent', label: 'Urgent', color: 'bg-red-500' }
];

const STATUS_OPTIONS = [
  { id: 'pending', label: 'Pending', color: 'bg-gray-600' },
  { id: 'assigned', label: 'Assigned', color: 'bg-blue-600' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-sky-500' },
  { id: 'on_hold', label: 'On Hold', color: 'bg-amber-600' },
  { id: 'completed', label: 'Completed', color: 'bg-green-600' },
  { id: 'cancelled', label: 'Cancelled', color: 'bg-red-700' },
  { id: 'invoiced', label: 'Invoiced', color: 'bg-emerald-600' }
];

export default function OpsWorkOrders() {
  const { currentOrg } = useOrg();
  const [workOrders, setWorkOrders] = useState([]);
  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [nextWONumber, setNextWONumber] = useState(null);
  const [formData, setFormData] = useState(getEmptyFormData());

  useEffect(() => {
    if (currentOrg?.id) {
      loadData();
    }
  }, [currentOrg?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wos, crewList, woNumber] = await Promise.all([
        fetchWorkOrders(currentOrg.id),
        fetchCrews(currentOrg.id),
        getNextWONumber(currentOrg.id)
      ]);
      setWorkOrders(wos || []);
      setCrews(crewList || []);
      setNextWONumber(woNumber);
    } catch (error) {
      console.error('Error loading work orders:', error);
      toast.error('Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClick = async () => {
    const woNumber = await getNextWONumber(currentOrg.id);
    setNextWONumber(woNumber);
    setFormData({
      ...getEmptyFormData(),
      woNumber: woNumber
    });
    setSelectedWorkOrder(null);
    setIsCreateDialogOpen(true);
  };

  const handleEditClick = (wo) => {
    setFormData({
      woNumber: wo.woNumber,
      title: wo.title || '',
      description: wo.description || '',
      category: wo.category || '',
      priority: wo.priority || 'medium',
      address: wo.address || '',
      city: wo.city || '',
      state: wo.state || '',
      zip: wo.zip || '',
      assignedCrew: wo.assignedCrew || '',
      scheduledStart: wo.scheduledStart || '',
      scheduledEnd: wo.scheduledEnd || '',
      estimatedDuration: wo.estimatedDuration || '',
      estimatedCost: wo.estimatedCost || '',
      actualCost: wo.actualCost || '',
      customerNotes: wo.customerNotes || '',
      internalNotes: wo.internalNotes || '',
      checklist: wo.checklist || [],
      materials: wo.materials || [],
      status: wo.status || 'pending',
      completionNotes: wo.completionNotes || ''
    });
    setSelectedWorkOrder(wo);
    setIsCreateDialogOpen(true);
  };

  const handleDeleteClick = async (id) => {
    if (!window.confirm('Delete this work order? This cannot be undone.')) return;
    try {
      await deleteWorkOrder(id);
      setWorkOrders(workOrders.filter(wo => wo.id !== id));
      toast.success('Work order deleted');
    } catch (error) {
      console.error('Error deleting work order:', error);
      toast.error('Failed to delete work order');
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.category) {
      toast.error('Title and category are required');
      return;
    }

    try {
      let result;
      if (selectedWorkOrder) {
        result = await updateWorkOrder(selectedWorkOrder.id, formData);
        setWorkOrders(workOrders.map(wo => wo.id === selectedWorkOrder.id ? result : wo));
        toast.success('Work order updated');
      } else {
        result = await createWorkOrder(currentOrg.id, formData);
        setWorkOrders([...workOrders, result]);
        toast.success('Work order created');
      }
      setIsCreateDialogOpen(false);
      setFormData(getEmptyFormData());
      setSelectedWorkOrder(null);
    } catch (error) {
      console.error('Error saving work order:', error);
      toast.error('Failed to save work order');
    }
  };

  const handleStatusChange = async (woId, newStatus) => {
    try {
      const wo = workOrders.find(w => w.id === woId);
      const updated = await updateWorkOrder(woId, { ...wo, status: newStatus });
      setWorkOrders(workOrders.map(w => w.id === woId ? updated : w));
      toast.success(`Status changed to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleAddChecklistItem = () => {
    setFormData({
      ...formData,
      checklist: [...(formData.checklist || []), { id: Date.now(), text: '', completed: false }]
    });
  };

  const handleRemoveChecklistItem = (itemId) => {
    setFormData({
      ...formData,
      checklist: (formData.checklist || []).filter(item => item.id !== itemId)
    });
  };

  const handleChecklistItemChange = (itemId, field, value) => {
    setFormData({
      ...formData,
      checklist: (formData.checklist || []).map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    });
  };

  const handleAddMaterial = () => {
    setFormData({
      ...formData,
      materials: [...(formData.materials || []), { id: Date.now(), name: '', quantity: '', unitCost: '' }]
    });
  };

  const handleRemoveMaterial = (materialId) => {
    setFormData({
      ...formData,
      materials: (formData.materials || []).filter(mat => mat.id !== materialId)
    });
  };

  const handleMaterialChange = (materialId, field, value) => {
    setFormData({
      ...formData,
      materials: (formData.materials || []).map(mat =>
        mat.id === materialId ? { ...mat, [field]: value } : mat
      )
    });
  };

  const getFilteredWorkOrders = () => {
    return workOrders.filter(wo => {
      const matchesSearch = wo.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.woNumber?.includes(searchTerm) ||
        wo.address?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !selectedStatus || wo.status === selectedStatus;
      const matchesPriority = !selectedPriority || wo.priority === selectedPriority;
      const matchesCategory = !selectedCategory || wo.category === selectedCategory;
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });
  };

  const getStatValue = (type) => {
    switch (type) {
      case 'total':
        return workOrders.length;
      case 'pending':
        return workOrders.filter(wo => wo.status === 'pending').length;
      case 'inProgress':
        return workOrders.filter(wo => wo.status === 'in_progress').length;
      case 'completed':
        return workOrders.filter(wo => wo.status === 'completed').length;
      case 'urgent':
        return workOrders.filter(wo => wo.priority === 'urgent').length;
      default:
        return 0;
    }
  };

  const filteredWOs = getFilteredWorkOrders();
  const urgentCount = getStatValue('urgent');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-navy-900">
        <div className="text-white">Loading work orders...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Work Orders</h1>
            <p className="text-white/60">Manage home service jobs, crews, and scheduling</p>
          </div>
          <Button
            onClick={handleCreateClick}
            className="bg-sky-500 hover:bg-sky-400 text-navy-900 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Work Order
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <StatCard
            label="Total WOs"
            value={getStatValue('total')}
            icon={<CheckCircle className="w-5 h-5" />}
          />
          <StatCard
            label="Pending"
            value={getStatValue('pending')}
            icon={<AlertCircle className="w-5 h-5" />}
          />
          <StatCard
            label="In Progress"
            value={getStatValue('inProgress')}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            label="Completed"
            value={getStatValue('completed')}
            icon={<CheckCircle className="w-5 h-5" />}
          />
          <StatCard
            label="Urgent"
            value={getStatValue('urgent')}
            icon={<AlertCircle className="w-5 h-5" />}
            highlight={urgentCount > 0}
          />
        </div>

        {/* Filter Bar */}
        <Card className="bg-navy-800 border-white/10 p-4 mb-8">
          <div className="space-y-4">
            {/* Search */}
            <Input
              placeholder="Search by WO number, title, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-navy-900 border-white/10 text-white placeholder-white/40"
            />

            {/* Status Filter */}
            <div>
              <label className="text-sm font-semibold text-white/80 mb-2 block">Status</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedStatus(null)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    selectedStatus === null
                      ? 'bg-sky-500 text-navy-900'
                      : 'bg-navy-700 text-white/70 hover:text-white'
                  }`}
                >
                  All
                </button>
                {STATUS_OPTIONS.map(status => (
                  <button
                    key={status.id}
                    onClick={() => setSelectedStatus(status.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                      selectedStatus === status.id
                        ? `${status.color} text-white`
                        : 'bg-navy-700 text-white/70 hover:text-white'
                    }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="text-sm font-semibold text-white/80 mb-2 block">Priority</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedPriority(null)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    selectedPriority === null
                      ? 'bg-sky-500 text-navy-900'
                      : 'bg-navy-700 text-white/70 hover:text-white'
                  }`}
                >
                  All
                </button>
                {PRIORITY_LEVELS.map(priority => (
                  <button
                    key={priority.id}
                    onClick={() => setSelectedPriority(priority.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                      selectedPriority === priority.id
                        ? `${priority.color} text-white`
                        : 'bg-navy-700 text-white/70 hover:text-white'
                    }`}
                  >
                    {priority.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="text-sm font-semibold text-white/80 mb-2 block">Category</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    selectedCategory === null
                      ? 'bg-sky-500 text-navy-900'
                      : 'bg-navy-700 text-white/70 hover:text-white'
                  }`}
                >
                  All
                </button>
                {WORK_ORDER_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                      selectedCategory === cat.id
                        ? 'bg-sky-500 text-navy-900'
                        : 'bg-navy-700 text-white/70 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Work Orders List */}
        <div className="space-y-4">
          {filteredWOs.length === 0 ? (
            <Card className="bg-navy-800 border-white/10 p-8 text-center">
              <p className="text-white/60">No work orders found</p>
            </Card>
          ) : (
            filteredWOs.map(wo => (
              <WorkOrderCard
                key={wo.id}
                workOrder={wo}
                onEdit={() => handleEditClick(wo)}
                onDelete={() => handleDeleteClick(wo.id)}
                onViewDetails={() => {
                  setSelectedWorkOrder(wo);
                  setIsDetailDialogOpen(true);
                }}
                onStatusChange={(status) => handleStatusChange(wo.id, status)}
              />
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-navy-800 border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedWorkOrder ? 'Edit Work Order' : 'Create Work Order'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* WO Number (Read-only) */}
            <div>
              <label className="text-sm font-semibold mb-2 block">WO Number</label>
              <Input
                value={formData.woNumber || ''}
                disabled
                className="bg-navy-900 border-white/10 text-white/50 cursor-not-allowed"
              />
            </div>

            {/* Title */}
            <div>
              <label className="text-sm font-semibold mb-2 block">Title *</label>
              <Input
                placeholder="e.g., Roof Repair - Missing Shingles"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-navy-900 border-white/10 text-white placeholder-white/40"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-semibold mb-2 block">Description</label>
              <Textarea
                placeholder="Detailed description of the work..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                rows={3}
              />
            </div>

            {/* Category & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-navy-900 border border-white/10 rounded text-white px-3 py-2"
                >
                  <option value="">Select category...</option>
                  {WORK_ORDER_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full bg-navy-900 border border-white/10 rounded text-white px-3 py-2"
                >
                  {PRIORITY_LEVELS.map(priority => (
                    <option key={priority.id} value={priority.id}>{priority.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="text-sm font-semibold mb-2 block">Address</label>
              <Input
                placeholder="Street address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="bg-navy-900 border-white/10 text-white placeholder-white/40"
              />
            </div>

            {/* City, State, Zip */}
            <div className="grid grid-cols-3 gap-4">
              <Input
                placeholder="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="bg-navy-900 border-white/10 text-white placeholder-white/40"
              />
              <Input
                placeholder="State"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                maxLength="2"
              />
              <Input
                placeholder="ZIP"
                value={formData.zip}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                className="bg-navy-900 border-white/10 text-white placeholder-white/40"
              />
            </div>

            {/* Assigned Crew */}
            <div>
              <label className="text-sm font-semibold mb-2 block">Assigned Crew</label>
              <select
                value={formData.assignedCrew}
                onChange={(e) => setFormData({ ...formData, assignedCrew: e.target.value })}
                className="w-full bg-navy-900 border border-white/10 rounded text-white px-3 py-2"
              >
                <option value="">Unassigned</option>
                {crews.map(crew => (
                  <option key={crew.id} value={crew.id}>{crew.name}</option>
                ))}
              </select>
            </div>

            {/* Scheduled Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Scheduled Start</label>
                <Input
                  type="datetime-local"
                  value={formData.scheduledStart}
                  onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Scheduled End</label>
                <Input
                  type="datetime-local"
                  value={formData.scheduledEnd}
                  onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white"
                />
              </div>
            </div>

            {/* Duration & Costs */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Est. Duration (hrs)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.estimatedDuration}
                  onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Est. Cost</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.estimatedCost}
                  onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Actual Cost</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.actualCost}
                  onChange={(e) => setFormData({ ...formData, actualCost: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white"
                />
              </div>
            </div>

            {/* Customer & Internal Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Customer Notes</label>
                <Textarea
                  placeholder="Notes visible to customer..."
                  value={formData.customerNotes}
                  onChange={(e) => setFormData({ ...formData, customerNotes: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Internal Notes</label>
                <Textarea
                  placeholder="Internal crew notes..."
                  value={formData.internalNotes}
                  onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                  rows={2}
                />
              </div>
            </div>

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold">Checklist</label>
                <Button
                  onClick={handleAddChecklistItem}
                  variant="outline"
                  size="sm"
                  className="border-sky-500 text-sky-400 hover:bg-sky-500/10"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {(formData.checklist || []).map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => handleChecklistItemChange(item.id, 'completed', e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <Input
                      placeholder="Checklist item..."
                      value={item.text}
                      onChange={(e) => handleChecklistItemChange(item.id, 'text', e.target.value)}
                      className="flex-1 bg-navy-900 border-white/10 text-white placeholder-white/40"
                    />
                    <button
                      onClick={() => handleRemoveChecklistItem(item.id)}
                      className="p-2 hover:bg-red-500/20 rounded text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Materials */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold">Materials Used</label>
                <Button
                  onClick={handleAddMaterial}
                  variant="outline"
                  size="sm"
                  className="border-sky-500 text-sky-400 hover:bg-sky-500/10"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Material
                </Button>
              </div>
              <div className="space-y-3">
                {(formData.materials || []).map(material => (
                  <div key={material.id} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      placeholder="Material name"
                      value={material.name}
                      onChange={(e) => handleMaterialChange(material.id, 'name', e.target.value)}
                      className="col-span-5 bg-navy-900 border-white/10 text-white placeholder-white/40"
                    />
                    <Input
                      placeholder="Qty"
                      value={material.quantity}
                      onChange={(e) => handleMaterialChange(material.id, 'quantity', e.target.value)}
                      className="col-span-3 bg-navy-900 border-white/10 text-white placeholder-white/40"
                    />
                    <Input
                      placeholder="Unit Cost"
                      type="number"
                      value={material.unitCost}
                      onChange={(e) => handleMaterialChange(material.id, 'unitCost', e.target.value)}
                      className="col-span-3 bg-navy-900 border-white/10 text-white placeholder-white/40"
                    />
                    <button
                      onClick={() => handleRemoveMaterial(material.id)}
                      className="col-span-1 p-2 hover:bg-red-500/20 rounded text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Completion Notes (Edit only) */}
            {selectedWorkOrder && (
              <div>
                <label className="text-sm font-semibold mb-2 block">Completion Notes</label>
                <Textarea
                  placeholder="Final notes on completed work..."
                  value={formData.completionNotes}
                  onChange={(e) => setFormData({ ...formData, completionNotes: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                  rows={2}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              className="border-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-sky-500 hover:bg-sky-400 text-navy-900 font-semibold"
            >
              {selectedWorkOrder ? 'Update' : 'Create'} Work Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {selectedWorkOrder && (
        <WorkOrderDetailDialog
          workOrder={selectedWorkOrder}
          isOpen={isDetailDialogOpen}
          onClose={() => setIsDetailDialogOpen(false)}
          onStatusChange={(status) => handleStatusChange(selectedWorkOrder.id, status)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, highlight = false }) {
  return (
    <Card className={`bg-navy-800 border-white/10 p-4 ${highlight ? 'border-red-500/50 bg-red-500/5' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/60 text-sm">{label}</p>
          <p className={`text-3xl font-bold ${highlight ? 'text-red-400' : 'text-white'}`}>{value}</p>
        </div>
        <div className={highlight ? 'text-red-400' : 'text-sky-400'}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function WorkOrderCard({ workOrder, onEdit, onDelete, onViewDetails, onStatusChange }) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusOption = STATUS_OPTIONS.find(s => s.id === workOrder.status);
  const priorityOption = PRIORITY_LEVELS.find(p => p.id === workOrder.priority);
  const categoryOption = WORK_ORDER_CATEGORIES.find(c => c.id === workOrder.category);

  return (
    <Card className="bg-navy-800 border-white/10 p-5 hover:border-white/20 transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">{workOrder.woNumber}</h3>
            {categoryOption && (
              <Badge variant="outline" className="border-sky-500/30 text-sky-400">
                {categoryOption.label}
              </Badge>
            )}
            {priorityOption && (
              <Badge className={`text-white ${priorityOption.color}`}>
                {priorityOption.label}
              </Badge>
            )}
          </div>
          <p className="text-white/80 font-medium mb-3">{workOrder.title}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
            {workOrder.address && (
              <div className="flex items-center gap-2 text-white/60">
                <MapPin className="w-4 h-4 text-sky-400" />
                <span>{workOrder.address}, {workOrder.city}</span>
              </div>
            )}
            {workOrder.assignedCrew && (
              <div className="flex items-center gap-2 text-white/60">
                <Users className="w-4 h-4 text-sky-400" />
                <span>{workOrder.assignedCrew}</span>
              </div>
            )}
            {workOrder.scheduledStart && (
              <div className="flex items-center gap-2 text-white/60">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span>{new Date(workOrder.scheduledStart).toLocaleDateString()}</span>
              </div>
            )}
            {workOrder.estimatedCost && (
              <div className="flex items-center gap-2 text-white/60">
                <DollarSign className="w-4 h-4 text-sky-400" />
                <span>${parseFloat(workOrder.estimatedCost).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 ml-4">
          <Button
            onClick={onEdit}
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white hover:bg-white/5"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            onClick={onDelete}
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Status & Actions Row */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          {statusOption && (
            <Badge className={`text-white ${statusOption.color}`}>
              {statusOption.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              variant="outline"
              size="sm"
              className="border-white/10 text-white/80 hover:text-white"
            >
              Change Status
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            {showStatusMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-navy-900 border border-white/10 rounded shadow-lg z-10">
                {STATUS_OPTIONS.map(status => (
                  <button
                    key={status.id}
                    onClick={() => {
                      onStatusChange(status.id);
                      setShowStatusMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 border-b border-white/5 last:border-0"
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            onClick={onViewDetails}
            variant="outline"
            size="sm"
            className="border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
          >
            View Details
          </Button>
        </div>
      </div>
    </Card>
  );
}

function WorkOrderDetailDialog({ workOrder, isOpen, onClose, onStatusChange }) {
  const statusOption = STATUS_OPTIONS.find(s => s.id === workOrder.status);
  const priorityOption = PRIORITY_LEVELS.find(p => p.id === workOrder.priority);
  const categoryOption = WORK_ORDER_CATEGORIES.find(c => c.id === workOrder.category);
  const checklistItems = workOrder.checklist || [];
  const completedItems = checklistItems.filter(item => item.completed).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-navy-800 border-white/10 text-white max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{workOrder.woNumber}</span>
            {categoryOption && (
              <Badge variant="outline" className="border-sky-500/30 text-sky-400">
                {categoryOption.label}
              </Badge>
            )}
            {priorityOption && (
              <Badge className={`text-white ${priorityOption.color}`}>
                {priorityOption.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Header Info */}
          <div>
            <h3 className="text-2xl font-bold mb-2">{workOrder.title}</h3>
            <p className="text-white/60">{workOrder.description}</p>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-4 bg-navy-900 rounded border border-white/10">
            <div>
              <p className="text-sm text-white/60 mb-1">Current Status</p>
              <div className="flex items-center gap-2">
                {statusOption && (
                  <Badge className={`text-white ${statusOption.color}`}>
                    {statusOption.label}
                  </Badge>
                )}
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => {
                  const nextStatus = STATUS_OPTIONS[
                    (STATUS_OPTIONS.findIndex(s => s.id === workOrder.status) + 1) % STATUS_OPTIONS.length
                  ];
                  onStatusChange(nextStatus.id);
                }}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-navy-900 rounded font-semibold text-sm"
              >
                Move to Next Stage
              </button>
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-white/60 mb-1">Address</p>
              <p className="text-white font-medium">
                {workOrder.address && `${workOrder.address}, ${workOrder.city}, ${workOrder.state} ${workOrder.zip}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-white/60 mb-1">Assigned Crew</p>
              <p className="text-white font-medium">{workOrder.assignedCrew || 'Unassigned'}</p>
            </div>
          </div>

          {/* Scheduling */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-white/60 mb-1">Scheduled Start</p>
              <p className="text-white font-medium">
                {workOrder.scheduledStart ? new Date(workOrder.scheduledStart).toLocaleString() : 'Not scheduled'}
              </p>
            </div>
            <div>
              <p className="text-sm text-white/60 mb-1">Scheduled End</p>
              <p className="text-white font-medium">
                {workOrder.scheduledEnd ? new Date(workOrder.scheduledEnd).toLocaleString() : 'Not scheduled'}
              </p>
            </div>
          </div>

          {/* Duration & Costs */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-navy-900 rounded border border-white/10">
            <div>
              <p className="text-sm text-white/60 mb-1">Est. Duration</p>
              <p className="text-lg font-bold text-white">{workOrder.estimatedDuration || '0'} hrs</p>
            </div>
            <div>
              <p className="text-sm text-white/60 mb-1">Est. Cost</p>
              <p className="text-lg font-bold text-sky-400">${parseFloat(workOrder.estimatedCost || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-white/60 mb-1">Actual Cost</p>
              <p className="text-lg font-bold text-white">${parseFloat(workOrder.actualCost || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Notes */}
          {(workOrder.customerNotes || workOrder.internalNotes) && (
            <div className="space-y-3">
              {workOrder.customerNotes && (
                <div>
                  <p className="text-sm text-white/60 mb-2 font-semibold">Customer Notes</p>
                  <p className="text-white/80 bg-navy-900 p-3 rounded border border-white/10">
                    {workOrder.customerNotes}
                  </p>
                </div>
              )}
              {workOrder.internalNotes && (
                <div>
                  <p className="text-sm text-white/60 mb-2 font-semibold">Internal Notes</p>
                  <p className="text-white/80 bg-navy-900 p-3 rounded border border-white/10">
                    {workOrder.internalNotes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Checklist */}
          {checklistItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-white/60 font-semibold">Checklist Progress</p>
                <p className="text-sm text-white font-medium">
                  {completedItems} / {checklistItems.length}
                </p>
              </div>
              <div className="bg-navy-900 rounded border border-white/10 p-4 space-y-2">
                {checklistItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled
                      className="w-4 h-4 rounded"
                    />
                    <span className={item.completed ? 'text-white/50 line-through' : 'text-white'}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materials */}
          {(workOrder.materials || []).length > 0 && (
            <div>
              <p className="text-sm text-white/60 mb-3 font-semibold">Materials Used</p>
              <div className="bg-navy-900 rounded border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-2 text-white/60">Material</th>
                      <th className="text-left px-4 py-2 text-white/60">Qty</th>
                      <th className="text-right px-4 py-2 text-white/60">Unit Cost</th>
                      <th className="text-right px-4 py-2 text-white/60">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(workOrder.materials || []).map((mat, idx) => (
                      <tr key={idx} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-2 text-white">{mat.name}</td>
                        <td className="px-4 py-2 text-white">{mat.quantity}</td>
                        <td className="text-right px-4 py-2 text-white">${parseFloat(mat.unitCost || 0).toFixed(2)}</td>
                        <td className="text-right px-4 py-2 text-sky-400 font-medium">
                          ${(parseFloat(mat.quantity || 0) * parseFloat(mat.unitCost || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Completion Notes */}
          {workOrder.completionNotes && (
            <div>
              <p className="text-sm text-white/60 mb-2 font-semibold">Completion Notes</p>
              <p className="text-white/80 bg-navy-900 p-3 rounded border border-white/10">
                {workOrder.completionNotes}
              </p>
            </div>
          )}

          {/* Photo Placeholders */}
          <div>
            <p className="text-sm text-white/60 mb-3 font-semibold">Photos</p>
            <div className="grid grid-cols-3 gap-3">
              {['Before', 'During', 'After'].map(label => (
                <div
                  key={label}
                  className="aspect-square bg-navy-900 border border-white/10 rounded flex items-center justify-center text-white/40"
                >
                  <div className="text-center">
                    <p className="text-sm">{label}</p>
                    <p className="text-xs text-white/20">No photo</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/10"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getEmptyFormData() {
  return {
    woNumber: '',
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    address: '',
    city: '',
    state: '',
    zip: '',
    assignedCrew: '',
    scheduledStart: '',
    scheduledEnd: '',
    estimatedDuration: '',
    estimatedCost: '',
    actualCost: '',
    customerNotes: '',
    internalNotes: '',
    checklist: [],
    materials: [],
    status: 'pending',
    completionNotes: ''
  };
}
