import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Search, Phone, Mail, MapPin, Calendar } from 'lucide-react';
import { useOrg } from '../../lib/OrgContext';
import { fetchContacts, createContact, updateContact, deleteContact } from '../../lib/customerService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';

const CONTACT_TYPE_COLORS = {
  lead: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  prospect: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
  customer: 'bg-green-600/20 text-green-400 border-green-500/30',
  past_customer: 'bg-gray-600/20 text-gray-400 border-gray-500/30',
  referral: 'bg-purple-600/20 text-purple-400 border-purple-500/30',
  vendor: 'bg-orange-600/20 text-orange-400 border-orange-500/30',
};

const PROPERTY_TYPE_OPTIONS = ['residential', 'commercial', 'multi-family', 'hoa'];
const CONTACT_TYPE_OPTIONS = ['lead', 'prospect', 'customer', 'past_customer', 'referral', 'vendor'];

export default function CustomerContacts() {
  const { currentOrg } = useOrg();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    propertyAddress: '',
    city: '',
    state: '',
    zip: '',
    propertyType: 'residential',
    contactType: 'lead',
    leadSource: '',
    tags: '',
    notes: '',
  });

  useEffect(() => {
    if (currentOrg?.id) {
      loadContacts();
    }
  }, [currentOrg?.id]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await fetchContacts(currentOrg.id);
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = () => {
    setEditingContact(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      propertyAddress: '',
      city: '',
      state: '',
      zip: '',
      propertyType: 'residential',
      contactType: 'lead',
      leadSource: '',
      tags: '',
      notes: '',
    });
    setShowDialog(true);
  };

  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setFormData({
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      phone: contact.phone || '',
      propertyAddress: contact.propertyAddress || '',
      city: contact.city || '',
      state: contact.state || '',
      zip: contact.zip || '',
      propertyType: contact.propertyType || 'residential',
      contactType: contact.contactType || 'lead',
      leadSource: contact.leadSource || '',
      tags: contact.tags?.join(', ') || '',
      notes: contact.notes || '',
    });
    setShowDialog(true);
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    try {
      await deleteContact(currentOrg.id, contactId);
      setContacts(contacts.filter((c) => c.id !== contactId));
      toast.success('Contact deleted');
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    }
  };

  const handleSaveContact = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }

    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        propertyAddress: formData.propertyAddress,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        propertyType: formData.propertyType,
        contactType: formData.contactType,
        leadSource: formData.leadSource,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        notes: formData.notes,
      };

      if (editingContact) {
        await updateContact(currentOrg.id, editingContact.id, payload);
        toast.success('Contact updated');
      } else {
        await createContact(currentOrg.id, payload);
        toast.success('Contact created');
      }

      setShowDialog(false);
      loadContacts();
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Failed to save contact');
    }
  };

  const getFilteredContacts = () => {
    let filtered = contacts;

    if (activeFilter !== 'All') {
      const filterKey = activeFilter.toLowerCase().replace(' ', '_');
      filtered = filtered.filter((c) => c.contactType === filterKey);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term) ||
          c.phone?.toLowerCase().includes(term),
      );
    }

    return filtered;
  };

  const filteredContacts = getFilteredContacts();
  const totalContacts = contacts.length;
  const totalLeads = contacts.filter((c) => c.contactType === 'lead').length;
  const activeCustomers = contacts.filter((c) => c.contactType === 'customer').length;
  const totalLifetimeValue = contacts.reduce((sum, c) => sum + (c.lifetimeValue || 0), 0);

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const getPropertyTypeLabel = (type) => {
    return type ? type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ') : 'Unknown';
  };

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Contacts</h1>
            <p className="mt-1 text-gray-400">Manage all your customer and lead information</p>
          </div>
          <Button onClick={handleAddContact} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <Card className="border-navy-800 bg-navy-900 p-4">
            <p className="text-sm text-gray-400">Total Contacts</p>
            <p className="mt-2 text-2xl font-bold text-white">{totalContacts}</p>
          </Card>
          <Card className="border-navy-800 bg-navy-900 p-4">
            <p className="text-sm text-gray-400">Leads</p>
            <p className="mt-2 text-2xl font-bold text-blue-400">{totalLeads}</p>
          </Card>
          <Card className="border-navy-800 bg-navy-900 p-4">
            <p className="text-sm text-gray-400">Active Customers</p>
            <p className="mt-2 text-2xl font-bold text-green-400">{activeCustomers}</p>
          </Card>
          <Card className="border-navy-800 bg-navy-900 p-4">
            <p className="text-sm text-gray-400">Lifetime Value</p>
            <p className="mt-2 text-2xl font-bold text-white">${totalLifetimeValue.toLocaleString()}</p>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 flex flex-wrap gap-3 border-b border-navy-800 pb-4">
          {['All', 'Leads', 'Prospects', 'Customers', 'Past Customers', 'Referrals', 'Vendors'].map(
            (filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`rounded px-3 py-1 text-sm font-medium transition ${
                  activeFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {filter}
              </button>
            ),
          )}
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-navy-800 bg-navy-900 pl-10 text-white placeholder-gray-500"
            />
          </div>
        </div>

        {/* Contacts Table */}
        {loading ? (
          <Card className="border-navy-800 bg-navy-900 p-8 text-center">
            <p className="text-gray-400">Loading contacts...</p>
          </Card>
        ) : filteredContacts.length === 0 ? (
          <Card className="border-navy-800 bg-navy-900 p-12 text-center">
            <p className="mb-4 text-xl text-white">No contacts yet</p>
            <p className="mb-6 text-gray-400">Start building your contact list by adding your first contact.</p>
            <Button onClick={handleAddContact} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Add First Contact
            </Button>
          </Card>
        ) : (
          <Card className="border-navy-800 bg-navy-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-navy-800 bg-navy-950">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Contact Info</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Property</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Lead Source</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Last Contacted</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">LTV</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-navy-800 hover:bg-navy-800/50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 bg-blue-600">
                            <AvatarFallback className="text-white">
                              {getInitials(contact.firstName, contact.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {contact.firstName} {contact.lastName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={`border ${CONTACT_TYPE_COLORS[contact.contactType] || CONTACT_TYPE_COLORS.lead}`}>
                          {contact.contactType.charAt(0).toUpperCase() +
                            contact.contactType.slice(1).replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-sm">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-gray-400">
                              <Mail className="h-3 w-3" />
                              <a href={`mailto:${contact.email}`} className="hover:text-blue-400">
                                {contact.email}
                              </a>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-gray-400">
                              <Phone className="h-3 w-3" />
                              <a href={`tel:${contact.phone}`} className="hover:text-blue-400">
                                {contact.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {contact.propertyAddress && (
                            <div className="flex items-start gap-2 text-sm text-gray-400">
                              <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                              <div>
                                <p>{contact.propertyAddress}</p>
                                <p>
                                  {[contact.city, contact.state, contact.zip]
                                    .filter(Boolean)
                                    .join(', ')}
                                </p>
                              </div>
                            </div>
                          )}
                          {contact.propertyType && (
                            <Badge className="w-fit border-navy-700 bg-navy-800 text-gray-300">
                              {getPropertyTypeLabel(contact.propertyType)}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {contact.leadSource || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Calendar className="h-3 w-3" />
                          {formatDate(contact.lastContacted)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        ${(contact.lifetimeValue || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditContact(contact)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl border-navy-800 bg-navy-900">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingContact ? 'Edit Contact' : 'Add New Contact'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300">First Name *</label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="mt-1 border-navy-800 bg-navy-800 text-white"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Last Name *</label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="mt-1 border-navy-800 bg-navy-800 text-white"
                  placeholder="Smith"
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 border-navy-800 bg-navy-800 text-white"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Phone</label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 border-navy-800 bg-navy-800 text-white"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="text-sm font-medium text-gray-300">Property Address</label>
              <Input
                value={formData.propertyAddress}
                onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
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

            {/* Property & Contact Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Property Type</label>
                <select
                  value={formData.propertyType}
                  onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                  className="mt-1 w-full rounded border border-navy-800 bg-navy-800 px-3 py-2 text-white"
                >
                  {PROPERTY_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {getPropertyTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Contact Type</label>
                <select
                  value={formData.contactType}
                  onChange={(e) => setFormData({ ...formData, contactType: e.target.value })}
                  className="mt-1 w-full rounded border border-navy-800 bg-navy-800 px-3 py-2 text-white"
                >
                  {CONTACT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lead Source */}
            <div>
              <label className="text-sm font-medium text-gray-300">Lead Source</label>
              <Input
                value={formData.leadSource}
                onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                className="mt-1 border-navy-800 bg-navy-800 text-white"
                placeholder="Google Ads, Referral, etc."
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium text-gray-300">Tags (comma separated)</label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="mt-1 border-navy-800 bg-navy-800 text-white"
                placeholder="vip, premium, long-term"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-gray-300">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 border-navy-800 bg-navy-800 text-white"
                placeholder="Additional notes about this contact..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-navy-700">
              Cancel
            </Button>
            <Button onClick={handleSaveContact} className="bg-blue-600 hover:bg-blue-700">
              {editingContact ? 'Update Contact' : 'Create Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
