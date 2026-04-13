import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { useOrg } from '../../lib/OrgContext';
import {
  fetchAgreements,
  createAgreement,
  updateAgreement,
  deleteAgreement,
  fetchContacts
} from '../../lib/customerService';

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

const AGREEMENT_TYPES = [
  { value: 'service', label: 'Service Agreement', color: 'bg-blue-600' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-green-600' },
  { value: 'warranty', label: 'Warranty', color: 'bg-purple-600' },
  { value: 'subscription', label: 'Subscription', color: 'bg-indigo-600' },
  { value: 'one_time', label: 'One-Time', color: 'bg-gray-600' },
];

const STATUS_COLORS = {
  draft: 'bg-gray-600',
  sent: 'bg-blue-600',
  active: 'bg-green-600',
  completed: 'bg-emerald-600',
  cancelled: 'bg-red-600',
  expired: 'bg-yellow-600',
};

const ESIGN_STATUS_COLORS = {
  pending: 'bg-yellow-600 text-yellow-100',
  signed: 'bg-green-600 text-green-100',
  declined: 'bg-red-600 text-red-100',
};

export default function CustomerAgreements() {
  const { currentOrg } = useOrg();
  const [agreements, setAgreements] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    number: '',
    title: '',
    description: '',
    type: 'service',
    contact_id: '',
    status: 'draft',
    total_value: '',
    payment_terms: '',
    start_date: '',
    end_date: '',
    scope_of_work: '',
    terms_text: '',
    notes: '',
    esign_status: 'none',
  });

  // Load agreements and contacts
  useEffect(() => {
    if (!currentOrg?.id) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [agmts, ctcts] = await Promise.all([
          fetchAgreements(currentOrg.id),
          fetchContacts(currentOrg.id),
        ]);
        setAgreements(agmts || []);
        setContacts(ctcts || []);
      } catch (error) {
        toast.error('Failed to load agreements');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentOrg?.id]);

  // Generate next agreement number
  const generateNextNumber = () => {
    if (agreements.length === 0) return 'AGR-001';
    const numbers = agreements
      .map(a => parseInt(a.number?.split('-')[1] || 0))
      .sort((a, b) => b - a);
    return `AGR-${String(numbers[0] + 1).padStart(3, '0')}`;
  };

  // Handle dialog open for new agreement
  const handleNewAgreement = () => {
    setEditingId(null);
    setFormData({
      number: generateNextNumber(),
      title: '',
      description: '',
      type: 'service',
      contact_id: '',
      status: 'draft',
      total_value: '',
      payment_terms: '',
      start_date: '',
      end_date: '',
      scope_of_work: '',
      terms_text: '',
      notes: '',
      esign_status: 'none',
    });
    setOpenDialog(true);
  };

  // Handle dialog open for edit
  const handleEdit = (agreement) => {
    setEditingId(agreement.id);
    setFormData(agreement);
    setOpenDialog(true);
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      if (editingId) {
        await updateAgreement(currentOrg.id, editingId, formData);
        toast.success('Agreement updated');
      } else {
        await createAgreement(currentOrg.id, formData);
        toast.success('Agreement created');
      }

      const updated = await fetchAgreements(currentOrg.id);
      setAgreements(updated || []);
      setOpenDialog(false);
    } catch (error) {
      toast.error('Failed to save agreement');
      console.error(error);
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this agreement?')) return;

    try {
      await deleteAgreement(currentOrg.id, id);
      setAgreements(agreements.filter(a => a.id !== id));
      toast.success('Agreement deleted');
    } catch (error) {
      toast.error('Failed to delete agreement');
      console.error(error);
    }
  };

  // Handle send for signature
  const handleSendForSignature = async (agreement) => {
    try {
      await updateAgreement(currentOrg.id, agreement.id, {
        ...agreement,
        status: 'sent',
        esign_status: 'pending',
      });
      const updated = await fetchAgreements(currentOrg.id);
      setAgreements(updated || []);
      toast.success('Agreement sent for signature');
    } catch (error) {
      toast.error('Failed to send agreement');
      console.error(error);
    }
  };

  // Filter agreements
  const filtered =
    activeFilter === 'all'
      ? agreements
      : agreements.filter(a => a.status === activeFilter);

  // Calculate stats
  const stats = {
    total: agreements.length,
    active: agreements.filter(a => a.status === 'active').length,
    pendingSignature: agreements.filter(
      a => a.esign_status === 'pending'
    ).length,
    totalValue: agreements.reduce((sum, a) => sum + (parseFloat(a.total_value) || 0), 0),
    expiringSoon: agreements.filter(a => {
      if (!a.end_date) return false;
      const daysUntilExpiry = Math.ceil(
        (new Date(a.end_date) - new Date()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    }).length,
  };

  const getTypeColor = (type) => {
    const found = AGREEMENT_TYPES.find(t => t.value === type);
    return found?.color || 'bg-gray-600';
  };

  const getTypeName = (type) => {
    const found = AGREEMENT_TYPES.find(t => t.value === type);
    return found?.label || type;
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact?.name || contactId || '—';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading agreements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Agreements</h1>
        <Button
          onClick={handleNewAgreement}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Agreement
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-navy-900 border-navy-800">
          <div className="text-gray-400 text-sm">Total Agreements</div>
          <div className="text-2xl font-bold text-white mt-2">{stats.total}</div>
        </Card>
        <Card className="bg-navy-900 border-navy-800">
          <div className="text-gray-400 text-sm">Active</div>
          <div className="text-2xl font-bold text-green-400 mt-2">{stats.active}</div>
        </Card>
        <Card className="bg-navy-900 border-navy-800">
          <div className="text-gray-400 text-sm">Pending Signature</div>
          <div className="text-2xl font-bold text-yellow-400 mt-2">{stats.pendingSignature}</div>
        </Card>
        <Card className="bg-navy-900 border-navy-800">
          <div className="text-gray-400 text-sm">Total Value</div>
          <div className="text-2xl font-bold text-white mt-2">
            ${(stats.totalValue / 1000).toFixed(0)}K
          </div>
        </Card>
        <Card className="bg-navy-900 border-navy-800">
          <div className="text-gray-400 text-sm">Expiring Soon</div>
          <div className="text-2xl font-bold text-orange-400 mt-2">{stats.expiringSoon}</div>
        </Card>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 border-b border-navy-800 overflow-x-auto pb-4">
        {['all', 'draft', 'sent', 'active', 'completed', 'cancelled', 'expired'].map(
          status => (
            <button
              key={status}
              onClick={() => setActiveFilter(status)}
              className={`px-4 py-2 font-medium whitespace-nowrap transition-colors ${
                activeFilter === status
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          )
        )}
      </div>

      {/* Agreements List */}
      {filtered.length === 0 ? (
        <Card className="bg-navy-900 border-navy-800 py-12 text-center">
          <p className="text-gray-400 mb-4">No agreements yet</p>
          <Button
            onClick={handleNewAgreement}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Create First Agreement
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map(agreement => (
            <Card
              key={agreement.id}
              className="bg-navy-900 border-navy-800 p-6 hover:border-navy-700 transition-colors"
            >
              <div className="space-y-4">
                {/* Top Row: Number, Title, Type Badge, Status Badge */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-mono text-gray-400">
                        {agreement.number}
                      </span>
                      <h3 className="text-lg font-semibold text-white">
                        {agreement.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${getTypeColor(agreement.type)} text-white text-xs`}>
                        {getTypeName(agreement.type)}
                      </Badge>
                      <Badge className={`${STATUS_COLORS[agreement.status] || 'bg-gray-600'} text-white text-xs`}>
                        {agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1)}
                      </Badge>
                      {agreement.esign_status && agreement.esign_status !== 'none' && (
                        <Badge className={`${ESIGN_STATUS_COLORS[agreement.esign_status] || 'bg-gray-600'} text-xs`}>
                          {agreement.esign_status === 'pending'
                            ? 'Awaiting Signature'
                            : agreement.esign_status === 'signed'
                            ? 'Signed'
                            : 'Declined'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Contact & Value */}
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">
                      {getContactName(agreement.contact_id)}
                    </p>
                    <p className="text-xl font-bold text-white">
                      ${parseFloat(agreement.total_value || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                </div>

                {/* Middle Row: Payment Terms, Dates */}
                <div className="grid grid-cols-3 gap-4 py-3 border-t border-b border-navy-800">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Payment Terms</p>
                    <p className="text-sm text-gray-300 mt-1">
                      {agreement.payment_terms || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Duration</p>
                    <p className="text-sm text-gray-300 mt-1">
                      {agreement.start_date && agreement.end_date
                        ? `${new Date(agreement.start_date).toLocaleDateString()} — ${new Date(
                            agreement.end_date
                          ).toLocaleDateString()}`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Scope</p>
                    <p className="text-sm text-gray-300 mt-1 line-clamp-1">
                      {agreement.scope_of_work ? agreement.scope_of_work.substring(0, 50) : '—'}
                    </p>
                  </div>
                </div>

                {/* Description preview */}
                {agreement.description && (
                  <p className="text-sm text-gray-400 line-clamp-2">
                    {agreement.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(agreement)}
                      variant="outline"
                      className="border-navy-700 text-gray-400 hover:text-white hover:bg-navy-800"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(agreement.id)}
                      variant="outline"
                      className="border-navy-700 text-gray-400 hover:text-red-400 hover:bg-navy-800"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>

                  {(agreement.status === 'draft' || agreement.status === 'sent') &&
                    agreement.esign_status !== 'signed' && (
                      <Button
                        onClick={() => handleSendForSignature(agreement)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send for Signature
                      </Button>
                    )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="bg-navy-900 border-navy-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingId ? 'Edit Agreement' : 'New Agreement'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Agreement Number */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Agreement Number
              </label>
              <Input
                value={formData.number}
                onChange={e =>
                  setFormData({ ...formData, number: e.target.value })
                }
                className="bg-navy-800 border-navy-700 text-white"
                placeholder="AGR-001"
              />
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <Input
                value={formData.title}
                onChange={e =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="bg-navy-800 border-navy-700 text-white"
                placeholder="e.g. HVAC Service Agreement"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={e =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="bg-navy-800 border-navy-700 text-white"
                placeholder="Brief description of the agreement"
              />
            </div>

            {/* Type & Contact */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={e =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-white"
                >
                  {AGREEMENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Contact
                </label>
                <select
                  value={formData.contact_id}
                  onChange={e =>
                    setFormData({ ...formData, contact_id: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-white"
                >
                  <option value="">Select contact</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status & eSign Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={e =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-white"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  eSign Status
                </label>
                <select
                  value={formData.esign_status}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      esign_status: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-white"
                >
                  <option value="none">None</option>
                  <option value="pending">Pending</option>
                  <option value="signed">Signed</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
            </div>

            {/* Value & Payment Terms */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Total Value ($)
                </label>
                <Input
                  type="number"
                  value={formData.total_value}
                  onChange={e =>
                    setFormData({ ...formData, total_value: e.target.value })
                  }
                  className="bg-navy-800 border-navy-700 text-white"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Payment Terms
                </label>
                <Input
                  value={formData.payment_terms}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      payment_terms: e.target.value,
                    })
                  }
                  className="bg-navy-800 border-navy-700 text-white"
                  placeholder="e.g. Net 30"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={e =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  className="bg-navy-800 border-navy-700 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  End Date
                </label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={e =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  className="bg-navy-800 border-navy-700 text-white"
                />
              </div>
            </div>

            {/* Scope of Work */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Scope of Work
              </label>
              <Textarea
                value={formData.scope_of_work}
                onChange={e =>
                  setFormData({ ...formData, scope_of_work: e.target.value })
                }
                className="bg-navy-800 border-navy-700 text-white h-32"
                placeholder="Detailed scope of work..."
              />
            </div>

            {/* Terms Text */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Terms & Conditions
              </label>
              <Textarea
                value={formData.terms_text}
                onChange={e =>
                  setFormData({ ...formData, terms_text: e.target.value })
                }
                className="bg-navy-800 border-navy-700 text-white h-32"
                placeholder="Full contract terms..."
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Notes
              </label>
              <Textarea
                value={formData.notes}
                onChange={e =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="bg-navy-800 border-navy-700 text-white"
                placeholder="Internal notes..."
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              onClick={() => setOpenDialog(false)}
              variant="outline"
              className="border-navy-700 text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {editingId ? 'Update' : 'Create'} Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
