import React, { useState, useEffect, useMemo } from 'react';
import { useCrmClient } from './_shared';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

// Generic base Customers page. Reads the impersonated tenant's OWN DB via
// useCrmClient() (NOT a hardcoded client), so every industry shows its own
// customer_contacts.

const typeConfig = {
  customer: { label: 'Customer', color: 'bg-emerald-500/20 text-emerald-300' },
  lead:     { label: 'Lead',     color: 'bg-blue-500/20 text-blue-300' },
  prospect: { label: 'Prospect', color: 'bg-amber-500/20 text-amber-300' },
  vendor:   { label: 'Vendor',   color: 'bg-purple-500/20 text-purple-300' },
};

function blankForm() {
  return {
    first_name: '', last_name: '', email: '', phone: '',
    contact_type: 'customer', property_city: '', property_state: '',
    lead_source: '', notes: '',
  };
}

export default function CrmCustomers() {
  const { client } = useCrmClient();
  const navigate = useNavigate();
  const { platformId } = useParams();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm());

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client]);

  const load = async () => {
    try {
      setLoading(true);
      const { data, error } = await client.from('customer_contacts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setContacts(data || []);
    } catch (e) {
      console.error('Error loading customers:', e);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const name = (c) => c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter(c => {
      if (typeFilter !== 'all' && (c.contact_type || 'customer') !== typeFilter) return false;
      if (!q) return true;
      return [name(c), c.email, c.phone, c.property_city].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });
  }, [contacts, search, typeFilter]);

  const handleNew = () => { setEditing(null); setForm(blankForm()); setIsDialogOpen(true); };
  const handleEdit = (c) => {
    setEditing(c);
    setForm({
      first_name: c.first_name || '', last_name: c.last_name || '', email: c.email || '', phone: c.phone || '',
      contact_type: c.contact_type || 'customer', property_city: c.property_city || '', property_state: c.property_state || '',
      lead_source: c.lead_source || '', notes: c.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) { toast.error('Enter a first or last name'); return; }
    try {
      const payload = { ...form };
      if (editing) {
        const { error } = await client.from('customer_contacts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
        if (error) throw error;
        toast.success('Customer updated');
      } else {
        const { error } = await client.from('customer_contacts').insert(payload);
        if (error) throw error;
        toast.success('Customer added');
      }
      setIsDialogOpen(false);
      load();
    } catch (e) {
      console.error('Error saving customer:', e);
      toast.error('Failed to save customer');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    try {
      const { error } = await client.from('customer_contacts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Customer deleted');
      load();
    } catch (e) {
      console.error('Error deleting customer:', e);
      toast.error('Failed to delete customer');
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading customers...</div>;

  const counts = {
    all: contacts.length,
    customer: contacts.filter(c => (c.contact_type || 'customer') === 'customer').length,
    lead: contacts.filter(c => c.contact_type === 'lead').length,
  };

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      <div className="max-w-full">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-3xl font-bold text-white">Customers</h1>
          <Button onClick={handleNew} className="bg-brand-blue hover:bg-brand-blue/90 text-white flex items-center gap-2"><Plus size={18} /> New Customer</Button>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, city..."
              className="w-full bg-navy-900 border border-navy-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm placeholder-gray-500" />
          </div>
          <div className="flex items-center gap-1">
            {[['all', `All (${counts.all})`], ['customer', `Customers (${counts.customer})`], ['lead', `Leads (${counts.lead})`]].map(([k, lbl]) => (
              <button key={k} onClick={() => setTypeFilter(k)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${typeFilter === k ? 'border-brand-blue text-brand-blue bg-brand-blue/10' : 'border-navy-700 text-gray-400 hover:text-white'}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">No customers yet. Add your first one.</div>
        ) : (
          <Card className="bg-navy-900 border-navy-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-800">
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Name</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Type</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Email</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Phone</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">City</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-semibold">Lifetime Value</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const t = typeConfig[c.contact_type] || typeConfig.customer;
                    return (
                      <tr key={c.id} className="border-b border-navy-800 hover:bg-navy-800/50 transition">
                        <td className="px-4 py-3"><button onClick={() => navigate(`/crm/${platformId}/customers/${c.id}`)} className="text-white font-medium hover:text-brand-blue transition text-left">{name(c)}</button></td>
                        <td className="px-4 py-3"><Badge className={`${t.color} text-xs`}>{t.label}</Badge></td>
                        <td className="px-4 py-3 text-gray-400">{c.email}</td>
                        <td className="px-4 py-3 text-gray-400">{c.phone}</td>
                        <td className="px-4 py-3 text-gray-400">{[c.property_city, c.property_state].filter(Boolean).join(', ')}</td>
                        <td className="px-4 py-3 text-white text-right font-medium">${(Number(c.lifetime_value) || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => handleEdit(c)} className="px-2 py-1 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue rounded text-xs transition">Edit</button>
                            <button onClick={() => handleDelete(c.id)} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs transition">Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-navy-900 border-navy-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? 'Edit Customer' : 'New Customer'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">First Name</label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" placeholder="Jane" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Last Name</label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" placeholder="Doe" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" placeholder="jane@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" placeholder="(555) 555-5555" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Type</label>
                  <select value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                    {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Lead Source</label>
                  <Input value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })} className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" placeholder="referral, google..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">City</label>
                  <Input value={form.property_city} onChange={(e) => setForm({ ...form, property_city: e.target.value })} className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" placeholder="Jacksonville" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">State</label>
                  <Input value={form.property_state} onChange={(e) => setForm({ ...form, property_state: e.target.value })} className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" placeholder="FL" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Notes</label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-navy-800 border-navy-700 text-white placeholder-gray-500 min-h-20" placeholder="Notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-navy-700 text-gray-400 hover:text-white">Cancel</Button>
              <Button onClick={handleSave} className="bg-brand-blue hover:bg-brand-blue/90 text-white">{editing ? 'Update' : 'Add Customer'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
