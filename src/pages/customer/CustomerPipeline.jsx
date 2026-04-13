import React, { useState, useEffect } from 'react';
import { useOrg } from '../../lib/OrgContext';
import {
  fetchPipelineDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  fetchContacts
} from '../../lib/customerService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { LayoutGrid, Table2, Plus, Trash2, ChevronDown, Dot } from 'lucide-react';
import { toast } from 'sonner';

const stageConfig = {
  new_lead: { label: 'New Lead', color: 'bg-gray-600', order: 0 },
  contacted: { label: 'Contacted', color: 'bg-blue-600', order: 1 },
  site_visit: { label: 'Site Visit', color: 'bg-indigo-600', order: 2 },
  quoted: { label: 'Quoted', color: 'bg-purple-600', order: 3 },
  negotiating: { label: 'Negotiating', color: 'bg-yellow-600', order: 4 },
  won: { label: 'Won', color: 'bg-green-600', order: 5 },
  lost: { label: 'Lost', color: 'bg-red-600', order: 6 },
};

const temperatureConfig = {
  cold: { label: 'Cold', color: 'text-blue-400', dotColor: 'bg-blue-400' },
  warm: { label: 'Warm', color: 'text-yellow-400', dotColor: 'bg-yellow-400' },
  hot: { label: 'Hot', color: 'text-red-400', dotColor: 'bg-red-400' },
};

export default function CustomerPipeline() {
  const { currentOrg } = useOrg();
  const [viewMode, setViewMode] = useState('kanban'); // kanban or table
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [sortColumn, setSortColumn] = useState('title');
  const [sortDirection, setSortDirection] = useState('asc');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contact_id: '',
    stage: 'new_lead',
    deal_value: '',
    probability: 50,
    lead_temperature: 'warm',
    service_type: '',
    expected_close_date: '',
    tags: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [currentOrg?.id]);

  const loadData = async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      const [dealsData, contactsData] = await Promise.all([
        fetchPipelineDeals(currentOrg.id),
        fetchContacts(currentOrg.id),
      ]);
      setDeals(dealsData || []);
      setContacts(contactsData || []);
    } catch (error) {
      console.error('Error loading pipeline data:', error);
      toast.error('Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  };

  const handleNewDeal = () => {
    setEditingDeal(null);
    setFormData({
      title: '',
      description: '',
      contact_id: '',
      stage: 'new_lead',
      deal_value: '',
      probability: 50,
      lead_temperature: 'warm',
      service_type: '',
      expected_close_date: '',
      tags: '',
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const handleEditDeal = (deal) => {
    setEditingDeal(deal);
    setFormData({
      title: deal.title || '',
      description: deal.description || '',
      contact_id: deal.contact_id || '',
      stage: deal.stage || 'new_lead',
      deal_value: deal.deal_value || '',
      probability: deal.probability || 50,
      lead_temperature: deal.lead_temperature || 'warm',
      service_type: deal.service_type || '',
      expected_close_date: deal.expected_close_date || '',
      tags: deal.tags?.join(', ') || '',
      notes: deal.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSaveDeal = async () => {
    if (!formData.title.trim()) {
      toast.error('Deal title is required');
      return;
    }
    if (!formData.contact_id) {
      toast.error('Please select a contact');
      return;
    }

    try {
      const payload = {
        ...formData,
        deal_value: parseFloat(formData.deal_value) || 0,
        probability: parseInt(formData.probability) || 0,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
      };

      if (editingDeal) {
        await updateDeal(currentOrg.id, editingDeal.id, payload);
        toast.success('Deal updated');
      } else {
        await createDeal(currentOrg.id, payload);
        toast.success('Deal created');
      }

      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving deal:', error);
      toast.error('Failed to save deal');
    }
  };

  const handleDeleteDeal = async (dealId) => {
    if (!window.confirm('Delete this deal?')) return;
    try {
      await deleteDeal(currentOrg.id, dealId);
      toast.success('Deal deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting deal:', error);
      toast.error('Failed to delete deal');
    }
  };

  const handleMoveStage = async (dealId, newStage) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;
    try {
      await updateDeal(currentOrg.id, dealId, { ...deal, stage: newStage });
      toast.success('Deal moved');
      loadData();
    } catch (error) {
      console.error('Error moving deal:', error);
      toast.error('Failed to move deal');
    }
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact?.name || 'Unknown';
  };

  // Calculate stats
  const stats = {
    total: deals.length,
    pipelineValue: deals.reduce((sum, d) => sum + (d.deal_value || 0), 0),
    weightedValue: deals.reduce((sum, d) => {
      const prob = (d.probability || 0) / 100;
      return sum + ((d.deal_value || 0) * prob);
    }, 0),
    wonThisMonth: deals.filter(d => d.stage === 'won').length,
    winRate: deals.length > 0
      ? Math.round((deals.filter(d => d.stage === 'won').length / deals.length) * 100)
      : 0,
  };

  // Group deals by stage
  const dealsByStage = Object.keys(stageConfig).reduce((acc, stage) => {
    acc[stage] = deals.filter(d => d.stage === stage);
    return acc;
  }, {});

  if (loading) {
    return <div className="p-6 text-gray-400">Loading pipeline...</div>;
  }

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      <div className="max-w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Pipeline</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded transition ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white'
                  : 'bg-navy-800 text-gray-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={20} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded transition ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-navy-800 text-gray-400 hover:text-white'
              }`}
            >
              <Table2 size={20} />
            </button>
            <Button
              onClick={handleNewDeal}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Plus size={18} />
              New Deal
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <Card className="bg-navy-900 border-navy-800 p-4">
            <div className="text-gray-400 text-sm mb-1">Total Deals</div>
            <div className="text-white text-2xl font-bold">{stats.total}</div>
          </Card>
          <Card className="bg-navy-900 border-navy-800 p-4">
            <div className="text-gray-400 text-sm mb-1">Pipeline Value</div>
            <div className="text-white text-2xl font-bold">
              ${(stats.pipelineValue / 1000).toFixed(0)}K
            </div>
          </Card>
          <Card className="bg-navy-900 border-navy-800 p-4">
            <div className="text-gray-400 text-sm mb-1">Weighted Value</div>
            <div className="text-white text-2xl font-bold">
              ${(stats.weightedValue / 1000).toFixed(0)}K
            </div>
          </Card>
          <Card className="bg-navy-900 border-navy-800 p-4">
            <div className="text-gray-400 text-sm mb-1">Won This Month</div>
            <div className="text-white text-2xl font-bold">{stats.wonThisMonth}</div>
          </Card>
          <Card className="bg-navy-900 border-navy-800 p-4">
            <div className="text-gray-400 text-sm mb-1">Win Rate</div>
            <div className="text-white text-2xl font-bold">{stats.winRate}%</div>
          </Card>
        </div>

        {/* Content */}
        {viewMode === 'kanban' ? (
          <KanbanView
            dealsByStage={dealsByStage}
            stageConfig={stageConfig}
            temperatureConfig={temperatureConfig}
            getContactName={getContactName}
            onEditDeal={handleEditDeal}
            onMoveStage={handleMoveStage}
            onDeleteDeal={handleDeleteDeal}
          />
        ) : (
          <TableView
            deals={deals}
            stageConfig={stageConfig}
            temperatureConfig={temperatureConfig}
            getContactName={getContactName}
            onEditDeal={handleEditDeal}
            onDeleteDeal={handleDeleteDeal}
            sortColumn={sortColumn}
            setSortColumn={setSortColumn}
            sortDirection={sortDirection}
            setSortDirection={setSortDirection}
          />
        )}

        {/* Add/Edit Deal Dialog */}
        <DealDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          formData={formData}
          setFormData={setFormData}
          contacts={contacts}
          stageConfig={stageConfig}
          temperatureConfig={temperatureConfig}
          isEditing={!!editingDeal}
          onSave={handleSaveDeal}
        />
      </div>
    </div>
  );
}

function KanbanView({
  dealsByStage,
  stageConfig,
  temperatureConfig,
  getContactName,
  onEditDeal,
  onMoveStage,
  onDeleteDeal,
}) {
  if (Object.values(dealsByStage).every(arr => arr.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No deals yet. Create your first deal to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="inline-flex gap-4 min-w-full pr-4">
        {Object.entries(stageConfig).map(([stageKey, stageInfo]) => {
          const stageDeal = dealsByStage[stageKey] || [];
          const stageValue = stageDeal.reduce((sum, d) => sum + (d.deal_value || 0), 0);

          return (
            <div
              key={stageKey}
              className="flex-shrink-0 w-64 flex flex-col bg-navy-900 rounded-lg border border-navy-800 overflow-hidden"
            >
              {/* Column Header */}
              <div className={`${stageInfo.color} p-4 text-white font-semibold`}>
                <div className="flex justify-between items-start mb-2">
                  <div>{stageInfo.label}</div>
                  <div className="text-sm font-normal text-white/80">
                    {stageDeal.length}
                  </div>
                </div>
                <div className="text-sm text-white/80">
                  ${(stageValue / 1000).toFixed(0)}K
                </div>
              </div>

              {/* Deal Cards */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 max-h-[600px]">
                {stageDeal.length > 0 ? (
                  stageDeal.map(deal => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      stageConfig={stageConfig}
                      temperatureConfig={temperatureConfig}
                      getContactName={getContactName}
                      onEdit={() => onEditDeal(deal)}
                      onMove={(newStage) => onMoveStage(deal.id, newStage)}
                      onDelete={() => onDeleteDeal(deal.id)}
                    />
                  ))
                ) : (
                  <div className="text-gray-500 text-sm py-8 text-center">
                    No deals
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  stageConfig,
  temperatureConfig,
  getContactName,
  onEdit,
  onMove,
  onDelete,
}) {
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const tempConfig = temperatureConfig[deal.lead_temperature] || temperatureConfig.warm;

  return (
    <Card className="bg-navy-800 border-navy-700 p-3 cursor-pointer hover:border-blue-500/50 transition">
      <div onClick={onEdit} className="mb-2">
        <h4 className="font-semibold text-white truncate text-sm">
          {deal.title}
        </h4>
        <p className="text-gray-400 text-xs truncate">
          {getContactName(deal.contact_id)}
        </p>
      </div>

      {deal.service_type && (
        <Badge className="bg-blue-600/20 text-blue-300 text-xs mb-2">
          {deal.service_type}
        </Badge>
      )}

      <div className="space-y-2 text-xs mb-3">
        <div className="flex justify-between text-white">
          <span>${(deal.deal_value || 0).toLocaleString()}</span>
          <span className="text-gray-400">{deal.probability || 0}%</span>
        </div>
        <div className="flex items-center gap-1">
          <Dot className={`${tempConfig.dotColor}`} size={16} />
          <span className={`${tempConfig.color}`}>{tempConfig.label}</span>
        </div>
        {deal.expected_close_date && (
          <div className="text-gray-400">
            Close: {new Date(deal.expected_close_date).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <button
            onClick={() => setMoveMenuOpen(!moveMenuOpen)}
            className="w-full px-2 py-1 rounded text-xs bg-navy-700 hover:bg-navy-600 text-gray-300 flex items-center justify-center gap-1"
          >
            Move <ChevronDown size={14} />
          </button>
          {moveMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-navy-700 border border-navy-600 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
              {Object.entries(stageConfig).map(([stageKey, info]) => (
                <button
                  key={stageKey}
                  onClick={() => {
                    onMove(stageKey);
                    setMoveMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-navy-600 text-gray-300"
                >
                  {info.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-600/20 text-red-400 transition"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  );
}

function TableView({
  deals,
  stageConfig,
  temperatureConfig,
  getContactName,
  onEditDeal,
  onDeleteDeal,
  sortColumn,
  setSortColumn,
  sortDirection,
  setSortDirection,
}) {
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedDeals = [...deals].sort((a, b) => {
    let aVal = a[sortColumn] || '';
    let bVal = b[sortColumn] || '';

    if (sortColumn === 'deal_value') {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else if (sortColumn === 'probability') {
      aVal = parseInt(aVal) || 0;
      bVal = parseInt(bVal) || 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  if (deals.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No deals yet. Create your first deal to get started.
      </div>
    );
  }

  return (
    <Card className="bg-navy-900 border-navy-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-800">
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">
                <button
                  onClick={() => handleSort('title')}
                  className="hover:text-white transition"
                >
                  Title {sortColumn === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">
                <button
                  onClick={() => handleSort('stage')}
                  className="hover:text-white transition"
                >
                  Stage {sortColumn === 'stage' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">
                Service Type
              </th>
              <th className="px-4 py-3 text-right text-gray-400 font-semibold">
                <button
                  onClick={() => handleSort('deal_value')}
                  className="hover:text-white transition"
                >
                  Value {sortColumn === 'deal_value' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="px-4 py-3 text-right text-gray-400 font-semibold">
                <button
                  onClick={() => handleSort('probability')}
                  className="hover:text-white transition"
                >
                  Prob % {sortColumn === 'probability' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">
                Temp
              </th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">
                Close Date
              </th>
              <th className="px-4 py-3 text-right text-gray-400 font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedDeals.map(deal => {
              const stageInfo = stageConfig[deal.stage];
              const tempInfo = temperatureConfig[deal.lead_temperature];

              return (
                <tr
                  key={deal.id}
                  className="border-b border-navy-800 hover:bg-navy-800/50 transition"
                >
                  <td className="px-4 py-3 text-white font-medium truncate max-w-xs">
                    {deal.title}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {getContactName(deal.contact_id)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`${stageInfo?.color} text-white text-xs`}>
                      {stageInfo?.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{deal.service_type}</td>
                  <td className="px-4 py-3 text-white text-right font-medium">
                    ${(deal.deal_value || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-white text-right">
                    {deal.probability || 0}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Dot className={`${tempInfo?.dotColor}`} size={16} />
                      <span className={`${tempInfo?.color} text-xs`}>
                        {tempInfo?.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {deal.expected_close_date
                      ? new Date(deal.expected_close_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => onEditDeal(deal)}
                        className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded text-xs transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDeleteDeal(deal.id)}
                        className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DealDialog({
  isOpen,
  onOpenChange,
  formData,
  setFormData,
  contacts,
  stageConfig,
  temperatureConfig,
  isEditing,
  onSave,
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-900 border-navy-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Deal' : 'Create New Deal'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Deal Title *
            </label>
            <Input
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g. HVAC System Upgrade"
              className="bg-navy-800 border-navy-700 text-white placeholder-gray-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Description
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Deal details..."
              className="bg-navy-800 border-navy-700 text-white placeholder-gray-500 min-h-24"
            />
          </div>

          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Contact *
            </label>
            <select
              value={formData.contact_id}
              onChange={(e) =>
                setFormData({ ...formData, contact_id: e.target.value })
              }
              className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2"
            >
              <option value="">Select a contact...</option>
              {contacts.map(contact => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Stage */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Stage
              </label>
              <select
                value={formData.stage}
                onChange={(e) =>
                  setFormData({ ...formData, stage: e.target.value })
                }
                className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2"
              >
                {Object.entries(stageConfig).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Lead Temperature
              </label>
              <select
                value={formData.lead_temperature}
                onChange={(e) =>
                  setFormData({ ...formData, lead_temperature: e.target.value })
                }
                className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2"
              >
                {Object.entries(temperatureConfig).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Deal Value */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Deal Value ($)
              </label>
              <Input
                type="number"
                value={formData.deal_value}
                onChange={(e) =>
                  setFormData({ ...formData, deal_value: e.target.value })
                }
                placeholder="0"
                className="bg-navy-800 border-navy-700 text-white placeholder-gray-500"
              />
            </div>

            {/* Probability */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Probability (%) - {formData.probability}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.probability}
                onChange={(e) =>
                  setFormData({ ...formData, probability: e.target.value })
                }
                className="w-full h-2 bg-navy-800 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Service Type
            </label>
            <Input
              value={formData.service_type}
              onChange={(e) =>
                setFormData({ ...formData, service_type: e.target.value })
              }
              placeholder="e.g. HVAC Install, Roof Repair"
              className="bg-navy-800 border-navy-700 text-white placeholder-gray-500"
            />
          </div>

          {/* Expected Close Date */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Expected Close Date
            </label>
            <Input
              type="date"
              value={formData.expected_close_date}
              onChange={(e) =>
                setFormData({ ...formData, expected_close_date: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Tags (comma separated)
            </label>
            <Input
              value={formData.tags}
              onChange={(e) =>
                setFormData({ ...formData, tags: e.target.value })
              }
              placeholder="e.g. residential, high-priority"
              className="bg-navy-800 border-navy-700 text-white placeholder-gray-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Notes
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional notes..."
              className="bg-navy-800 border-navy-700 text-white placeholder-gray-500 min-h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-navy-700 text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isEditing ? 'Update Deal' : 'Create Deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
