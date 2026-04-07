import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { fetchAccounts, createAccount, updateAccount, deleteAccount } from '../../lib/financeService';
import { BookOpen, Plus, Edit2, Trash2, Loader } from 'lucide-react';
import { toast } from 'sonner';

const TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'COGS', 'EXPENSE'];
const TYPE_COLORS = {
  ASSET: 'text-blue-400', LIABILITY: 'text-red-400', EQUITY: 'text-purple-400',
  INCOME: 'text-green-400', COGS: 'text-orange-400', EXPENSE: 'text-yellow-400',
};

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
const EMPTY = { code: '', name: '', description: '', account_type: 'ASSET', sub_type: '', normal_balance: 'debit', is_active: true };

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setAccounts(await fetchAccounts(showInactive));
    } catch {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [showInactive]);

  function openEdit(acct) {
    setForm({
      code: acct.code, name: acct.name, description: acct.description || '',
      account_type: acct.account_type, sub_type: acct.sub_type || '',
      normal_balance: acct.normal_balance, is_active: acct.is_active,
    });
    setEditAccount(acct);
  }

  async function handleSave() {
    if (!form.code || !form.name) return toast.error('Code and name are required');
    try {
      setSubmitting(true);
      if (editAccount) {
        const updated = await updateAccount(editAccount.id, form);
        setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a));
        toast.success('Account updated');
        setEditAccount(null);
      } else {
        const created = await createAccount(form);
        setAccounts(prev => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)));
        toast.success('Account created');
        setCreateOpen(false);
      }
      setForm(EMPTY);
    } catch (err) {
      toast.error(err?.message?.includes('unique') ? 'Account code already exists' : 'Failed to save account');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
      setDeleteConfirm(null);
      toast.success('Account deleted');
    } catch {
      toast.error('Cannot delete — account may have transactions');
    }
  }

  const grouped = TYPES.reduce((acc, type) => {
    acc[type] = accounts.filter(a => a.account_type === type);
    return acc;
  }, {});

  const accountForm = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-gray-300 text-xs">Account Code *</Label>
          <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="e.g. 1000" />
        </div>
        <div>
          <Label className="text-gray-300 text-xs">Account Type *</Label>
          <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}
            className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm mt-1">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Label className="text-gray-300 text-xs">Account Name *</Label>
        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="e.g. Cash - Operating Account" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-gray-300 text-xs">Normal Balance</Label>
          <select value={form.normal_balance} onChange={e => setForm({ ...form, normal_balance: e.target.value })}
            className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm mt-1">
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <div>
          <Label className="text-gray-300 text-xs">Sub-Type</Label>
          <Input value={form.sub_type} onChange={e => setForm({ ...form, sub_type: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="e.g. cash, accounts_receivable" />
        </div>
      </div>
      <div>
        <Label className="text-gray-300 text-xs">Description</Label>
        <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="bg-navy-800 border-navy-700 text-white mt-1" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-brand-blue" />
            <h1 className="text-2xl font-bold text-white">Chart of Accounts</h1>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
                className="rounded border-navy-700" />
              Show inactive
            </label>
            <Button onClick={() => { setForm(EMPTY); setCreateOpen(true); }}
              className="bg-brand-blue hover:bg-blue-600 text-white flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Account
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-6 h-6 text-brand-blue animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {TYPES.map(type => {
              const typeAccounts = grouped[type] || [];
              if (typeAccounts.length === 0) return null;
              return (
                <Card key={type} className="bg-navy-800 border-navy-700 overflow-hidden">
                  <div className="px-4 py-3 bg-navy-900 border-b border-navy-700 flex items-center justify-between">
                    <h2 className={`text-sm font-semibold uppercase tracking-wide ${TYPE_COLORS[type]}`}>{type}</h2>
                    <span className="text-xs text-gray-500">{typeAccounts.length} accounts</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-700">
                        {['Code', 'Name', 'Sub-Type', 'Balance', 'Normal', 'Status', ''].map(h => (
                          <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {typeAccounts.map(acct => (
                        <tr key={acct.id} className="border-b border-navy-700/40 hover:bg-navy-750">
                          <td className="px-4 py-2.5 text-brand-blue font-mono text-xs">{acct.code}</td>
                          <td className="px-4 py-2.5 text-white">
                            {acct.name}
                            {acct.is_system && <span className="ml-2 text-xs text-gray-600">(system)</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{acct.sub_type || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-300 text-xs">{fmt(acct.current_balance)}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs capitalize">{acct.normal_balance}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${acct.is_active ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                              {acct.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {!acct.is_system && (
                              <div className="flex gap-1">
                                <button onClick={() => openEdit(acct)}
                                  className="p-1 hover:bg-navy-700 rounded text-gray-500 hover:text-white">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setDeleteConfirm(acct)}
                                  className="p-1 hover:bg-navy-700 rounded text-gray-500 hover:text-red-400">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
          {accountForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-brand-blue hover:bg-blue-600 text-white">
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAccount} onOpenChange={() => setEditAccount(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {accountForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccount(null)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-brand-blue hover:bg-blue-600 text-white">
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Delete Account</DialogTitle></DialogHeader>
          <p className="text-gray-400 text-sm">Delete account <strong className="text-white">{deleteConfirm?.code} — {deleteConfirm?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={() => handleDelete(deleteConfirm?.id)} className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
