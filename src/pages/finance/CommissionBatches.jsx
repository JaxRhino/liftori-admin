import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { fetchCommissions, createCommission, updateCommission, deleteCommission } from '../../lib/financeService';
import { DollarSign, Plus, Loader, Edit2, Trash2, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

const STATUS_CLS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
  voided: 'bg-red-500/20 text-red-400',
};

const EMPTY = {
  agent_name: '', agent_email: '', period_start: '', period_end: '',
  gross_revenue: '', commission_rate: '10', adjustments: '0', notes: '',
};

export default function CommissionBatches() {
  const [commissions, setCommissions] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const PAGE = 25;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count: c } = await fetchCommissions({ status: statusFilter, limit: PAGE, offset: page * PAGE });
      setCommissions(data);
      setCount(c);
    } catch {
      toast.error('Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const calcCommission = (gross, rate) => ((parseFloat(gross) || 0) * (parseFloat(rate) || 0)) / 100;
  const calcNet = (gross, rate, adj) => calcCommission(gross, rate) + (parseFloat(adj) || 0);

  function openEdit(item) {
    setForm({
      agent_name: item.agent_name || '',
      agent_email: item.agent_email || '',
      period_start: item.period_start || '',
      period_end: item.period_end || '',
      gross_revenue: String(item.gross_revenue || ''),
      commission_rate: String(item.commission_rate || '10'),
      adjustments: String(item.adjustments || '0'),
      notes: item.notes || '',
    });
    setEditItem(item);
  }

  async function handleSave() {
    if (!form.agent_name || !form.gross_revenue) return toast.error('Agent name and gross revenue are required');
    try {
      setSubmitting(true);
      const payload = {
        ...form,
        gross_revenue: parseFloat(form.gross_revenue),
        commission_rate: parseFloat(form.commission_rate),
        commission_amount: calcCommission(form.gross_revenue, form.commission_rate),
        adjustments: parseFloat(form.adjustments) || 0,
      };
      if (editItem) {
        const updated = await updateCommission(editItem.id, payload);
        setCommissions(prev => prev.map(c => c.id === updated.id ? updated : c));
        toast.success('Commission updated');
        setEditItem(null);
      } else {
        const created = await createCommission({ ...payload, status: 'pending' });
        setCommissions(prev => [created, ...prev]);
        setCount(c => c + 1);
        toast.success('Commission created');
        setCreateOpen(false);
      }
      setForm(EMPTY);
    } catch {
      toast.error('Failed to save commission');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkPaid(item) {
    try {
      const updated = await updateCommission(item.id, {
        status: 'paid',
        paid_at: new Date().toISOString(),
      });
      setCommissions(prev => prev.map(c => c.id === updated.id ? updated : c));
      toast.success('Commission marked as paid');
    } catch {
      toast.error('Failed to update commission');
    }
  }

  async function handleDelete(id) {
    try {
      await deleteCommission(id);
      setCommissions(prev => prev.filter(c => c.id !== id));
      setCount(c => c - 1);
      setDeleteConfirm(null);
      toast.success('Commission deleted');
    } catch {
      toast.error('Failed to delete commission');
    }
  }

  const commissionForm = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-gray-300 text-xs">Agent Name *</Label>
          <Input value={form.agent_name} onChange={e => setForm({ ...form, agent_name: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="Sales agent name" />
        </div>
        <div>
          <Label className="text-gray-300 text-xs">Agent Email</Label>
          <Input type="email" value={form.agent_email} onChange={e => setForm({ ...form, agent_email: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="agent@example.com" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-gray-300 text-xs">Period Start</Label>
          <Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" />
        </div>
        <div>
          <Label className="text-gray-300 text-xs">Period End</Label>
          <Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-gray-300 text-xs">Gross Revenue *</Label>
          <Input type="number" value={form.gross_revenue} onChange={e => setForm({ ...form, gross_revenue: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" min="0" step="0.01" />
        </div>
        <div>
          <Label className="text-gray-300 text-xs">Commission Rate (%)</Label>
          <Input type="number" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" min="0" max="100" step="0.1" />
        </div>
      </div>
      <div>
        <Label className="text-gray-300 text-xs">Adjustments (+ or -)</Label>
        <Input type="number" value={form.adjustments} onChange={e => setForm({ ...form, adjustments: e.target.value })}
          className="bg-navy-800 border-navy-700 text-white mt-1" step="0.01" />
      </div>
      {form.gross_revenue && (
        <div className="bg-navy-900 rounded p-3 text-sm">
          <div className="flex justify-between text-gray-400 mb-1">
            <span>Commission ({form.commission_rate}%)</span>
            <span>{fmt(calcCommission(form.gross_revenue, form.commission_rate))}</span>
          </div>
          <div className="flex justify-between font-semibold text-white">
            <span>Net Commission</span>
            <span className="text-green-400">{fmt(calcNet(form.gross_revenue, form.commission_rate, form.adjustments))}</span>
          </div>
        </div>
      )}
      <div>
        <Label className="text-gray-300 text-xs">Notes</Label>
        <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
          className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="Optional notes" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DollarSign className="w-7 h-7 text-brand-blue" />
            <h1 className="text-2xl font-bold text-white">Commissions</h1>
          </div>
          <Button onClick={() => { setForm(EMPTY); setCreateOpen(true); }}
            className="bg-brand-blue hover:bg-blue-600 text-white flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Commission
          </Button>
        </div>

        <div className="mb-6">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">
            {['all', 'pending', 'approved', 'paid', 'voided'].map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        <Card className="bg-navy-800 border-navy-700">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="w-6 h-6 text-brand-blue animate-spin" />
            </div>
          ) : commissions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No commissions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-700">
                    {['Agent', 'Period', 'Gross Revenue', 'Rate', 'Commission', 'Adjustments', 'Net', 'Status', ''].map(h => (
                      <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {commissions.map(item => (
                    <tr key={item.id} className="border-b border-navy-700/50 hover:bg-navy-750">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{item.agent_name || '—'}</p>
                        {item.agent_email && <p className="text-gray-500 text-xs">{item.agent_email}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {item.period_start ? `${fmtDate(item.period_start)} – ${fmtDate(item.period_end)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{fmt(item.gross_revenue)}</td>
                      <td className="px-4 py-3 text-gray-400">{item.commission_rate}%</td>
                      <td className="px-4 py-3 text-blue-400">{fmt(item.commission_amount)}</td>
                      <td className="px-4 py-3 text-gray-400">{item.adjustments ? fmt(item.adjustments) : '—'}</td>
                      <td className="px-4 py-3 text-green-400 font-medium">{fmt(item.net_commission)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[item.status] || 'bg-gray-700 text-gray-300'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {item.status === 'approved' && (
                            <button onClick={() => handleMarkPaid(item)}
                              className="p-1.5 hover:bg-navy-700 rounded text-gray-400 hover:text-green-400" title="Mark Paid">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item.status !== 'paid' && (
                            <button onClick={() => openEdit(item)}
                              className="p-1.5 hover:bg-navy-700 rounded text-gray-400 hover:text-white" title="Edit">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => setDeleteConfirm(item)}
                            className="p-1.5 hover:bg-navy-700 rounded text-gray-400 hover:text-red-400" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
          <DialogHeader><DialogTitle>New Commission</DialogTitle></DialogHeader>
          {commissionForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-brand-blue hover:bg-blue-600 text-white">
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Create Commission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Edit Commission</DialogTitle></DialogHeader>
          {commissionForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-brand-blue hover:bg-blue-600 text-white">
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Delete Commission</DialogTitle></DialogHeader>
          <p className="text-gray-400 text-sm">Delete commission for <strong className="text-white">{deleteConfirm?.agent_name}</strong> — net {fmt(deleteConfirm?.net_commission)}?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={() => handleDelete(deleteConfirm?.id)} className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
