import React, { useState, useEffect, useCallback } from 'react';
import { useOrg } from '../../lib/OrgContext';
import {
  fetchEstimates,
  createEstimate,
  updateEstimate,
  deleteEstimate,
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
  DialogFooter
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Plus, Edit2, Trash2, Send, X } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
  { value: 'revised', label: 'Revised' }
];

const STATUS_BADGES = {
  draft: 'bg-gray-600',
  sent: 'bg-blue-600',
  viewed: 'bg-indigo-600',
  accepted: 'bg-green-600',
  declined: 'bg-red-600',
  expired: 'bg-yellow-600',
  revised: 'bg-purple-600'
};

const ESIGN_STATUS_BADGES = {
  pending: 'bg-yellow-600 text-yellow-50',
  signed: 'bg-green-600 text-green-50',
  declined: 'bg-red-600 text-red-50'
};

const FILTER_TABS = ['All', 'Draft', 'Sent', 'Viewed', 'Accepted', 'Declined', 'Expired', 'Revised'];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value || 0);
};

const CustomerEstimates = () => {
  const { currentOrg } = useOrg();
  const [estimates, setEstimates] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState(null);
  const [formData, setFormData] = useState({
    estimate_number: '',
    title: '',
    description: '',
    contact_id: '',
    status: 'draft',
    valid_until: '',
    line_items: [{ description: '', quantity: 1, unit_price: 0, amount: 0 }],
    tax_rate: 0,
    discount_amount: 0,
    notes: ''
  });

  // Load estimates and contacts
  useEffect(() => {
    if (!currentOrg?.id) return;
    loadData();
  }, [currentOrg?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [estimatesData, contactsData] = await Promise.all([
        fetchEstimates(currentOrg.id),
        fetchContacts(currentOrg.id)
      ]);
      setEstimates(estimatesData || []);
      setContacts(contactsData || []);
    } catch (error) {
      toast.error('Failed to load estimates');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Generate next estimate number
  const getNextEstimateNumber = useCallback(() => {
    if (estimates.length === 0) return 'EST-001';
    const numbers = estimates
      .map((e) => {
        const match = e.estimate_number?.match(/EST-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .sort((a, b) => b - a);
    return `EST-${String(numbers[0] + 1).padStart(3, '0')}`;
  }, [estimates]);

  // Open dialog for new estimate
  const handleNewEstimate = () => {
    setEditingEstimate(null);
    setFormData({
      estimate_number: getNextEstimateNumber(),
      title: '',
      description: '',
      contact_id: '',
      status: 'draft',
      valid_until: '',
      line_items: [{ description: '', quantity: 1, unit_price: 0, amount: 0 }],
      tax_rate: 0,
      discount_amount: 0,
      notes: ''
    });
    setDialogOpen(true);
  };

  // Open dialog for editing
  const handleEditEstimate = (estimate) => {
    setEditingEstimate(estimate);
    setFormData({
      estimate_number: estimate.estimate_number,
      title: estimate.title,
      description: estimate.description || '',
      contact_id: estimate.contact_id || '',
      status: estimate.status,
      valid_until: estimate.valid_until ? estimate.valid_until.split('T')[0] : '',
      line_items: estimate.line_items || [{ description: '', quantity: 1, unit_price: 0, amount: 0 }],
      tax_rate: estimate.tax_rate || 0,
      discount_amount: estimate.discount_amount || 0,
      notes: estimate.notes || ''
    });
    setDialogOpen(true);
  };

  // Update form data
  const updateFormField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // Update line item
  const updateLineItem = (index, field, value) => {
    const newLineItems = [...formData.line_items];
    if (field === 'quantity' || field === 'unit_price') {
      newLineItems[index][field] = parseFloat(value) || 0;
      newLineItems[index].amount = newLineItems[index].quantity * newLineItems[index].unit_price;
    } else {
      newLineItems[index][field] = value;
    }
    setFormData((prev) => ({
      ...prev,
      line_items: newLineItems
    }));
  };

  // Add line item
  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        { description: '', quantity: 1, unit_price: 0, amount: 0 }
      ]
    }));
  };

  // Remove line item
  const removeLineItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = formData.line_items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const tax = (subtotal * (formData.tax_rate || 0)) / 100;
    const total = subtotal + tax - (formData.discount_amount || 0);
    return { subtotal, tax, total };
  };

  const { subtotal, tax, total } = calculateTotals();

  // Save estimate
  const handleSaveEstimate = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      const payload = {
        org_id: currentOrg.id,
        estimate_number: formData.estimate_number,
        title: formData.title,
        description: formData.description,
        contact_id: formData.contact_id || null,
        status: formData.status,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        line_items: formData.line_items,
        tax_rate: parseFloat(formData.tax_rate) || 0,
        discount_amount: parseFloat(formData.discount_amount) || 0,
        notes: formData.notes,
        subtotal,
        tax_amount: tax,
        total
      };

      if (editingEstimate) {
        await updateEstimate(editingEstimate.id, payload);
        toast.success('Estimate updated');
      } else {
        await createEstimate(payload);
        toast.success('Estimate created');
      }

      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save estimate');
      console.error(error);
    }
  };

  // Delete estimate
  const handleDeleteEstimate = async (id) => {
    if (!window.confirm('Are you sure you want to delete this estimate?')) return;

    try {
      await deleteEstimate(id);
      toast.success('Estimate deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete estimate');
      console.error(error);
    }
  };

  // Send estimate (update status to sent)
  const handleSendEstimate = async (estimate) => {
    try {
      await updateEstimate(estimate.id, {
        ...estimate,
        status: 'sent',
        sent_at: new Date().toISOString()
      });
      toast.success('Estimate sent');
      loadData();
    } catch (error) {
      toast.error('Failed to send estimate');
      console.error(error);
    }
  };

  // Filter estimates
  const filteredEstimates = estimates.filter((est) => {
    if (selectedFilter === 'All') return true;
    return est.status?.toLowerCase() === selectedFilter.toLowerCase();
  });

  // Calculate stats
  const stats = {
    total: estimates.length,
    pending: estimates.filter((e) => ['draft', 'sent'].includes(e.status)).length,
    accepted: estimates.filter((e) => e.status === 'accepted').length,
    totalValue: estimates.reduce((sum, e) => sum + (e.total || 0), 0),
    acceptanceRate:
      estimates.length > 0
        ? Math.round(
            (estimates.filter((e) => e.status === 'accepted').length / estimates.length) * 100
          )
        : 0
  };

  if (loading && estimates.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Loading estimates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Estimates</h1>
          <p className="mt-2 text-gray-400">Manage customer quotes and estimates</p>
        </div>
        <Button onClick={handleNewEstimate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          New Estimate
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-navy-900 border-navy-800 p-4">
          <p className="text-sm text-gray-400">Total Estimates</p>
          <p className="mt-1 text-2xl font-bold text-white">{stats.total}</p>
        </Card>
        <Card className="bg-navy-900 border-navy-800 p-4">
          <p className="text-sm text-gray-400">Pending</p>
          <p className="mt-1 text-2xl font-bold text-white">{stats.pending}</p>
        </Card>
        <Card className="bg-navy-900 border-navy-800 p-4">
          <p className="text-sm text-gray-400">Accepted</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{stats.accepted}</p>
        </Card>
        <Card className="bg-navy-900 border-navy-800 p-4">
          <p className="text-sm text-gray-400">Total Value</p>
          <p className="mt-1 text-2xl font-bold text-white">{formatCurrency(stats.totalValue)}</p>
        </Card>
        <Card className="bg-navy-900 border-navy-800 p-4">
          <p className="text-sm text-gray-400">Acceptance Rate</p>
          <p className="mt-1 text-2xl font-bold text-white">{stats.acceptanceRate}%</p>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-navy-800 pb-4">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedFilter(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedFilter === tab
                ? 'border-b-2 border-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Estimates Grid */}
      {filteredEstimates.length === 0 ? (
        <Card className="bg-navy-900 border-navy-800 p-8 text-center">
          <p className="text-gray-400">
            {estimates.length === 0
              ? 'No estimates yet. Create your first estimate to get started.'
              : `No estimates found in "${selectedFilter}" status.`}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEstimates.map((estimate) => {
            const contact = contacts.find((c) => c.id === estimate.contact_id);
            return (
              <Card key={estimate.id} className="bg-navy-900 border-navy-800 p-6 space-y-4">
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-mono text-gray-400">{estimate.estimate_number}</p>
                      <h3 className="mt-1 text-lg font-bold text-white">{estimate.title}</h3>
                    </div>
                    <Badge className={`${STATUS_BADGES[estimate.status]} whitespace-nowrap text-xs`}>
                      {estimate.status}
                    </Badge>
                  </div>
                  {contact && (
                    <p className="mt-2 text-sm text-gray-400">{contact.first_name} {contact.last_name}</p>
                  )}
                </div>

                {/* eSign Status */}
                {estimate.esign_status && (
                  <Badge className={`${ESIGN_STATUS_BADGES[estimate.esign_status]} text-xs w-fit`}>
                    {estimate.esign_status === 'pending' && 'Awaiting Signature'}
                    {estimate.esign_status === 'signed' && 'Signed'}
                    {estimate.esign_status === 'declined' && 'Signature Declined'}
                  </Badge>
                )}

                {/* Line Items Count */}
                <p className="text-sm text-gray-400">
                  {estimate.line_items?.length || 0} line item{estimate.line_items?.length !== 1 ? 's' : ''}
                </p>

                {/* Amounts */}
                <div className="border-t border-navy-800 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subtotal:</span>
                    <span className="text-white">{formatCurrency(estimate.subtotal)}</span>
                  </div>
                  {estimate.tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tax:</span>
                      <span className="text-white">{formatCurrency(estimate.tax_amount)}</span>
                    </div>
                  )}
                  {estimate.discount_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Discount:</span>
                      <span className="text-white">-{formatCurrency(estimate.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-navy-700 pt-2 font-bold">
                    <span className="text-white">Total:</span>
                    <span className="text-blue-400">{formatCurrency(estimate.total)}</span>
                  </div>
                </div>

                {/* Dates */}
                <div className="border-t border-navy-800 pt-4 space-y-1 text-xs text-gray-400">
                  {estimate.valid_until && (
                    <p>Valid until: {new Date(estimate.valid_until).toLocaleDateString()}</p>
                  )}
                  {estimate.sent_at && (
                    <p>Sent: {new Date(estimate.sent_at).toLocaleDateString()}</p>
                  )}
                  <p>Created: {new Date(estimate.created_at).toLocaleDateString()}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-navy-800 pt-4">
                  <Button
                    onClick={() => handleEditEstimate(estimate)}
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleDeleteEstimate(estimate.id)}
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {estimate.status === 'draft' && (
                    <Button
                      onClick={() => handleSendEstimate(estimate)}
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-blue-400 hover:text-blue-300"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-navy-950 border-navy-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingEstimate ? 'Edit Estimate' : 'New Estimate'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Estimate Number */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Estimate Number</label>
              <Input
                value={formData.estimate_number}
                onChange={(e) => updateFormField('estimate_number', e.target.value)}
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Title *</label>
              <Input
                value={formData.title}
                onChange={(e) => updateFormField('title', e.target.value)}
                placeholder="e.g., New HVAC System Installation"
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => updateFormField('description', e.target.value)}
                placeholder="Additional details about the estimate..."
                className="bg-navy-800 border-navy-700 text-white"
                rows={3}
              />
            </div>

            {/* Contact */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Contact</label>
              <select
                value={formData.contact_id}
                onChange={(e) => updateFormField('contact_id', e.target.value)}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2"
              >
                <option value="">Select a contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.first_name} {contact.last_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => updateFormField('status', e.target.value)}
                  className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Valid Until</label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => updateFormField('valid_until', e.target.value)}
                  className="bg-navy-800 border-navy-700 text-white"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="border-t border-navy-800 pt-4">
              <h4 className="text-sm font-bold text-white mb-3">Line Items</h4>
              <div className="space-y-3">
                {formData.line_items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      className="col-span-5 bg-navy-800 border-navy-700 text-white"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                      className="col-span-2 bg-navy-800 border-navy-700 text-white"
                    />
                    <Input
                      type="number"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)}
                      className="col-span-2 bg-navy-800 border-navy-700 text-white"
                    />
                    <div className="col-span-2 text-right">
                      <p className="text-sm text-gray-400">{formatCurrency(item.amount)}</p>
                    </div>
                    {formData.line_items.length > 1 && (
                      <button
                        onClick={() => removeLineItem(index)}
                        className="col-span-1 p-2 text-red-400 hover:text-red-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                onClick={addLineItem}
                variant="outline"
                size="sm"
                className="mt-3 w-full text-blue-400 border-blue-600 hover:bg-navy-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>
            </div>

            {/* Totals Section */}
            <div className="border-t border-navy-800 pt-4 space-y-3">
              <div className="text-sm space-y-2">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tax Rate (%)</label>
                  <Input
                    type="number"
                    value={formData.tax_rate}
                    onChange={(e) => updateFormField('tax_rate', e.target.value)}
                    placeholder="0"
                    className="bg-navy-800 border-navy-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Discount Amount</label>
                  <Input
                    type="number"
                    value={formData.discount_amount}
                    onChange={(e) => updateFormField('discount_amount', e.target.value)}
                    placeholder="0"
                    className="bg-navy-800 border-navy-700 text-white"
                  />
                </div>
              </div>

              <div className="text-sm space-y-2">
                {tax > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Tax:</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-navy-700 pt-2 font-bold text-white">
                  <span>Total:</span>
                  <span className="text-blue-400">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => updateFormField('notes', e.target.value)}
                placeholder="Additional notes, terms, or conditions..."
                className="bg-navy-800 border-navy-700 text-white"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-navy-800 pt-4">
            <Button
              onClick={() => setDialogOpen(false)}
              variant="outline"
              className="border-navy-700 text-gray-300 hover:bg-navy-800"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEstimate} className="bg-blue-600 hover:bg-blue-700">
              {editingEstimate ? 'Update Estimate' : 'Create Estimate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerEstimates;
