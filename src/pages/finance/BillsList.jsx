import { useState, useEffect } from 'react';
import { fetchBills, createBill, updateBill, recordBillPayment } from '../../lib/financeService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Plus, Search, DollarSign, Loader } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  draft: 'bg-gray-500',
  posted: 'bg-blue-500',
  partial: 'bg-yellow-500',
  paid: 'bg-green-500',
  voided: 'bg-red-500',
};

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

export default function BillsList() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [form, setForm] = useState({
    vendor_name: '', bill_date: new Date().toISOString().split('T')[0],
    due_date: '', subtotal: '', tax_amount: '0', notes: '', line_items: [],
  });

  useEffect(() => { load(); }, [statusFilter]);

  async function load() {
    try {
      setLoading(true);
      const data = await fetchBills({ status: statusFilter, search });
      setBills(data || []);
    } catch (e) {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.vendor_name || !form.subtotal) {
      toast.error('Vendor name and amount are required');
      return;
    }
    try {
      const total = parseFloat(form.subtotal) + parseFloat(form.tax_amount || 0);
      await createBill({ ...form, total, subtotal: parseFloat(form.subtotal), tax_amount: parseFloat(form.tax_amount || 0) });
      toast.success('Bill created');
      setCreateOpen(false);
      setForm({ vendor_name: '', bill_date: new Date().toISOString().split('T')[0], due_date: '', subtotal: '', tax_amount: '0', notes: '', line_items: [] });
      load();
    } catch (e) {
      toast.error('Failed to create bill');
    }
  }

  async function handlePay() {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await recordBillPayment(selectedBill.id, parseFloat(payAmount));
      toast.success('Payment recorded');
      setPayOpen(false);
      setSelectedBill(null);
      setPayAmount('');
      load();
    } catch (e) {
      toast.error('Failed to record payment');
    }
  }

  const filtered = bills.filter(b =>
    !search || b.vendor_name?.toLowerCase().includes(search.toLowerCase()) || b.bill_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Bills (AP)</h2>
        <Button onClick={() => setCreateOpen(true)} className="bg-brand-blue hover:bg-blue-600 text-white gap-2">
          <Plus className="w-4 h-4" /> New Bill
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder="Search bills..." className="pl-9 bg-navy-800 border-navy-700 text-white" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-navy-800 border border-navy-700 rounded text-white px-3 py-2 text-sm">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="voided">Voided</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader className="w-6 h-6 text-brand-blue animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-navy-800 border-navy-700 p-12 text-center text-gray-400">No bills found</Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-navy-700">
                <th className="text-left pb-3 font-medium">Bill #</th>
                <th className="text-left pb-3 font-medium">Vendor</th>
                <th className="text-left pb-3 font-medium">Date</th>
                <th className="text-left pb-3 font-medium">Due</th>
                <th className="text-right pb-3 font-medium">Total</th>
                <th className="text-right pb-3 font-medium">Balance</th>
                <th className="text-left pb-3 font-medium">Status</th>
                <th className="text-left pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {filtered.map(bill => (
                <tr key={bill.id} className="text-white hover:bg-navy-800/50">
                  <td className="py-3 font-mono text-xs text-gray-300">{bill.bill_number}</td>
                  <td className="py-3 font-medium">{bill.vendor_name}</td>
                  <td className="py-3 text-gray-300">{bill.bill_date}</td>
                  <td className="py-3 text-gray-300">{bill.due_date || '—'}</td>
                  <td className="py-3 text-right">{fmt(bill.total)}</td>
                  <td className="py-3 text-right text-yellow-400">{fmt(bill.balance_due)}</td>
                  <td className="py-3">
                    <Badge className={`${STATUS_COLORS[bill.status]} text-white text-xs`}>{bill.status}</Badge>
                  </td>
                  <td className="py-3">
                    {!['paid', 'voided'].includes(bill.status) && (
                      <Button size="sm" variant="outline" className="border-navy-600 text-gray-300 hover:text-white text-xs gap-1"
                        onClick={() => { setSelectedBill(bill); setPayAmount(String(bill.balance_due)); setPayOpen(true); }}>
                        <DollarSign className="w-3 h-3" /> Pay
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>New Bill</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Vendor Name *</label>
              <Input value={form.vendor_name} onChange={e => setForm({ ...form, vendor_name: e.target.value })} className="bg-navy-800 border-navy-700 text-white" placeholder="Vendor name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Bill Date</label>
                <Input type="date" value={form.bill_date} onChange={e => setForm({ ...form, bill_date: e.target.value })} className="bg-navy-800 border-navy-700 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="bg-navy-800 border-navy-700 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Subtotal *</label>
                <Input type="number" step="0.01" value={form.subtotal} onChange={e => setForm({ ...form, subtotal: e.target.value })} className="bg-navy-800 border-navy-700 text-white" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tax</label>
                <Input type="number" step="0.01" value={form.tax_amount} onChange={e => setForm({ ...form, tax_amount: e.target.value })} className="bg-navy-800 border-navy-700 text-white" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-navy-800 border-navy-700 text-white" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleCreate} className="bg-brand-blue hover:bg-blue-600 text-white">Create Bill</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Record Payment — {selectedBill?.vendor_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-400">Balance due: <span className="text-yellow-400 font-semibold">{fmt(selectedBill?.balance_due)}</span></div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Payment Amount *</label>
              <Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="bg-navy-800 border-navy-700 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handlePay} className="bg-green-600 hover:bg-green-700 text-white">Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
