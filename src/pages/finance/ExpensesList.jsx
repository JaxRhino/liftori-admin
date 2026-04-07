import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { fetchExpenses, createExpense, updateExpense, deleteExpense } from '../../lib/financeService';
import { TrendingDown, Plus, Search, Loader, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

const CATEGORIES = [
  'marketing', 'software', 'office', 'payroll', 'subcontractors',
  'materials', 'travel', 'professional_services', 'equipment', 'other',
];

const STATUS_CLS = {
  draft: 'bg-gray-700 text-gray-300',
  pending_approval: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-blue-500/20 text-blue-400',
  posted: 'bg-green-500/20 text-green-400',
  voided: 'bg-red-500/20 text-red-400',
};

const EMPTY = {
  vendor_name: '', category: 'other', expense_date: new Date().toISOString().split('T')[0],
  amount: '', project_name: '', description: '',
};

export default function ExpensesList() {
  const [expenses, setExpenses] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const PAGE = 25;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count: c } = await fetchExpenses({ search, limit: PAGE, offset: page * PAGE });
      setExpenses(data);
      setCount(c);
    } catch {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  function openEdit(exp) {
    setForm({
      vendor_name: exp.vendor_name || '',
      category: exp.category || 'other',
      expense_date: exp.expense_date || new Date().toISOString().split('T')[0],
      amount: String(exp.amount || ''),
      project_name: exp.project_name || '',
      description: exp.description || '',
    });
    setEditExpense(exp);
  }

  async function handleSave() {
    if (!form.amount || !form.vendor_name) return toast.error('Vendor and amount are required');
    try {
      setSubmitting(true);
      const payload = { ...form, amount: parseFloat(form.amount) };
      if (editExpense) {
        const updated = await updateExpense(editExpense.id, payload);
        setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
        toast.success('Expense updated');
        setEditExpense(null);
      } else {
        const created = await createExpense({ ...payload, status: 'posted' });
        setExpenses(prev => [created, ...prev]);
        setCount(c => c + 1);
        toast.success('Expense logged');
        setCreateOpen(false);
      }
      setForm(EMPTY);
    } catch {
      toast.error('Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
      setCount(c => c - 1);
      setDeleteConfirm(null);
      toast.success('Expense deleted');
    } catch {
      toast.error('Failed to delete expense');
    }
  }

  const expenseForm = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-gray-300 text-xs">Vendor *</Label>
          <Input value={form.vendor_name} onChange={e => setForm({ ...form, vendor_name: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="Vendor name" />
        </div>
        <div>
          <Label className="text-gray-300 text-xs">Date</Label>
          <Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })}
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
          <Label className="text-gray-300 text-xs">Category</Label>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm mt-1">
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Label className="text-gray-300 text-xs">Project</Label>
        <Input value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })}
          className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="Project name (optional)" />
      </div>
      <div>
        <Label className="text-gray-300 text-xs">Description</Label>
        <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="What was this for?" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <Button onClick={() => { setForm(EMPTY); setCreateOpen(true); }}
            className="bg-brand-blue hover:bg-blue-600 text-white flex items-center gap-2">
            <Plus className="w-4 h-4" /> Log Expense
          </Button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search expenses..." className="bg-navy-800 border-navy-700 text-white pl-9 max-w-sm" />
        </div>

        <Card className="bg-navy-800 border-navy-700">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="w-6 h-6 text-brand-blue animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No expenses found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-700">
                    {['Exp #', 'Date', 'Vendor', 'Category', 'Amount', 'Project', 'Description', 'Status', ''].map(h => (
                      <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id} className="border-b border-navy-700/50 hover:bg-navy-750">
                      <td className="px-4 py-3 text-brand-blue font-medium">{exp.expense_number || '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{fmtDate(exp.expense_date)}</td>
                      <td className="px-4 py-3 text-white">{exp.vendor_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 capitalize">{exp.category?.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-red-400 font-medium">{fmt(exp.amount)}</td>
                      <td className="px-4 py-3 text-gray-400">{exp.project_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{exp.description || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[exp.status] || 'bg-gray-700 text-gray-300'}`}>
                          {exp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(exp)} className="p-1.5 hover:bg-navy-700 rounded text-gray-400 hover:text-white">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteConfirm(exp)} className="p-1.5 hover:bg-navy-700 rounded text-gray-400 hover:text-red-400">
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
          <DialogHeader><DialogTitle>Log Expense</DialogTitle></DialogHeader>
          {expenseForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-brand-blue hover:bg-blue-600 text-white">
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editExpense} onOpenChange={() => setEditExpense(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
          {expenseForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExpense(null)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-brand-blue hover:bg-blue-600 text-white">
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Delete Expense</DialogTitle></DialogHeader>
          <p className="text-gray-400 text-sm">Delete this expense of <strong className="text-white">{fmt(deleteConfirm?.amount)}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={() => handleDelete(deleteConfirm?.id)} className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
