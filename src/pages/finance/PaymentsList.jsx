import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { fetchPayments, createPayment, deletePayment } from '../../lib/financeService';
import { CreditCard, Plus, Search, Loader, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

const METHODS = ['check', 'ach', 'wire', 'credit_card', 'cash', 'stripe', 'other'];

const EMPTY = {
  customer_name: '', payment_date: new Date().toISOString().split('T')[0],
  amount: '', payment_method: 'check', reference_number: '', memo: '',
};

export default function PaymentsList() {
  const [payments, setPayments] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const PAGE = 25;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count: c } = await fetchPayments({ search, limit: PAGE, offset: page * PAGE });
      setPayments(data);
      setCount(c);
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.customer_name || !form.amount) return toast.error('Customer name and amount are required');
    try {
      setSubmitting(true);
      const created = await createPayment({ ...form, amount: parseFloat(form.amount), status: 'posted' });
      setPayments(prev => [created, ...prev]);
      setCount(c => c + 1);
      setCreateOpen(false);
      setForm(EMPTY);
      toast.success('Payment recorded');
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deletePayment(id);
      setPayments(prev => prev.filter(p => p.id !== id));
      setCount(c => c - 1);
      setDeleteConfirm(null);
      toast.success('Payment deleted');
    } catch {
      toast.error('Failed to delete payment');
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <Button onClick={() => setCreateOpen(true)} className="bg-brand-blue hover:bg-blue-600 text-white flex items-center gap-2">
            <Plus className="w-4 h-4" /> Record Payment
          </Button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search payments..." className="bg-navy-800 border-navy-700 text-white pl-9 max-w-sm" />
        </div>

        <Card className="bg-navy-800 border-navy-700">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="w-6 h-6 text-brand-blue animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No payments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-700">
                    {['Payment #', 'Date', 'Customer', 'Amount', 'Method', 'Reference', 'Memo', ''].map(h => (
                      <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map(pmt => (
                    <tr key={pmt.id} className="border-b border-navy-700/50 hover:bg-navy-750">
                      <td className="px-4 py-3 text-brand-blue font-medium">{pmt.payment_number || '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{fmtDate(pmt.payment_date)}</td>
                      <td className="px-4 py-3 text-white">{pmt.customer_name || '—'}</td>
                      <td className="px-4 py-3 text-green-400 font-medium">{fmt(pmt.amount)}</td>
                      <td className="px-4 py-3 text-gray-400 capitalize">{pmt.payment_method?.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-gray-500">{pmt.reference_number || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{pmt.memo || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setDeleteConfirm(pmt)}
                          className="p-1.5 hover:bg-navy-700 rounded text-gray-500 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {count > PAGE && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">{count} total</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}
                className="border-navy-700 text-gray-400 hover:text-white">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-400 px-2 py-1">Page {page + 1}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE >= count}
                className="border-navy-700 text-gray-400 hover:text-white">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-xs">Customer *</Label>
                <Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  className="bg-navy-800 border-navy-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs">Date</Label>
                <Input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })}
                  className="bg-navy-800 border-navy-700 text-white mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-xs">Amount *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="bg-navy-800 border-navy-700 text-white mt-1" min="0" step="0.01" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs">Method</Label>
                <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}
                  className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm mt-1">
                  {METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-gray-300 text-xs">Reference #</Label>
              <Input value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="Check # / transaction ID" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs">Memo</Label>
              <Input value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-brand-blue hover:bg-blue-600 text-white">
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Delete Payment</DialogTitle></DialogHeader>
          <p className="text-gray-400 text-sm">Delete payment <strong className="text-white">{deleteConfirm?.payment_number}</strong> for {fmt(deleteConfirm?.amount)}?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={() => handleDelete(deleteConfirm?.id)} className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
