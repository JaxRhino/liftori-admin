import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { fetchJournalEntries, createJournalEntry, postJournalEntry, deleteJournalEntry, fetchAccounts } from '../../lib/financeService';
import { BookOpen, Plus, Search, Loader, CheckCircle, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

const STATUS_CLS = {
  draft: 'bg-gray-700 text-gray-300',
  pending: 'bg-yellow-500/20 text-yellow-400',
  posted: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  reversed: 'bg-purple-500/20 text-purple-400',
};

const EMPTY_LINE = { account_id: '', account_name: '', debit: '', credit: '', description: '' };
const EMPTY_FORM = {
  transaction_date: new Date().toISOString().split('T')[0],
  description: '', reference: '',
  lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }],
};

function calcBalance(lines) {
  const totalDebits = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  return { totalDebits, totalCredits, balanced: Math.abs(totalDebits - totalCredits) < 0.01 };
}

export default function JournalEntries() {
  const [entries, setEntries] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const PAGE = 25;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data, count: c }, accts] = await Promise.all([
        fetchJournalEntries({ status: statusFilter, limit: PAGE, offset: page * PAGE }),
        accounts.length ? Promise.resolve(accounts) : fetchAccounts(),
      ]);
      setEntries(data);
      setCount(c);
      if (!accounts.length) setAccounts(accts);
    } catch {
      toast.error('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  function updateLine(idx, field, value) {
    const lines = [...form.lines];
    if (field === 'account_id') {
      const acct = accounts.find(a => a.id === value);
      lines[idx] = { ...lines[idx], account_id: value, account_name: acct?.name || '' };
    } else {
      lines[idx] = { ...lines[idx], [field]: value };
    }
    setForm({ ...form, lines });
  }

  async function handleCreate() {
    const { totalDebits, totalCredits, balanced } = calcBalance(form.lines);
    if (!form.description) return toast.error('Description is required');
    if (!balanced) return toast.error(`Entry not balanced: Debits ${fmt(totalDebits)} ≠ Credits ${fmt(totalCredits)}`);
    const validLines = form.lines.filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) return toast.error('At least 2 lines required');

    try {
      setSubmitting(true);
      const lines = validLines.map(l => ({
        ...l,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      }));
      const created = await createJournalEntry({
        ...form,
        lines,
        total_debits: totalDebits,
        total_credits: totalCredits,
        status: 'draft',
      });
      setEntries(prev => [created, ...prev]);
      setCount(c => c + 1);
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast.success('Journal entry created');
    } catch {
      toast.error('Failed to create journal entry');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost(id) {
    try {
      const updated = await postJournalEntry(id);
      setEntries(prev => prev.map(e => e.id === id ? updated : e));
      toast.success('Journal entry posted');
    } catch {
      toast.error('Failed to post journal entry');
    }
  }

  async function handleDelete(id) {
    try {
      await deleteJournalEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      setCount(c => c - 1);
      toast.success('Journal entry deleted');
    } catch {
      toast.error('Failed to delete journal entry');
    }
  }

  const { totalDebits, totalCredits, balanced } = calcBalance(form.lines);

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Journal Entries</h1>
          <Button onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}
            className="bg-brand-blue hover:bg-blue-600 text-white flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Entry
          </Button>
        </div>

        <div className="mb-6">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">
            {['all', 'draft', 'pending', 'posted', 'rejected', 'reversed'].map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        <Card className="bg-navy-800 border-navy-700">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="w-6 h-6 text-brand-blue animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No journal entries found</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-700">
              {entries.map(entry => (
                <div key={entry.id}>
                  <div
                    className="flex items-center gap-4 px-4 py-3 hover:bg-navy-750 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-brand-blue font-medium text-sm">{entry.entry_number || '—'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[entry.status] || ''}`}>
                          {entry.status}
                        </span>
                        <span className="text-gray-400 text-xs">{fmtDate(entry.transaction_date)}</span>
                      </div>
                      <p className="text-white text-sm mt-0.5 truncate">{entry.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm font-medium">{fmt(entry.total_debits)}</p>
                      <p className="text-gray-500 text-xs">{entry.reference || ''}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {entry.status === 'draft' && (
                        <>
                          <button onClick={e => { e.stopPropagation(); handlePost(entry.id); }}
                            className="p-1.5 hover:bg-navy-700 rounded text-gray-400 hover:text-green-400" title="Post">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                            className="p-1.5 hover:bg-navy-700 rounded text-gray-400 hover:text-red-400" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {expandedId === entry.id && (
                    <div className="px-4 pb-4 bg-navy-900">
                      <table className="w-full text-xs mt-2">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left py-1.5 font-medium">Account</th>
                            <th className="text-right py-1.5 font-medium">Debit</th>
                            <th className="text-right py-1.5 font-medium">Credit</th>
                            <th className="text-left py-1.5 font-medium pl-4">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(entry.lines || []).map((line, i) => (
                            <tr key={i} className="border-t border-navy-700">
                              <td className="py-1.5 text-gray-300">{line.account_name || line.account_code || line.account_id}</td>
                              <td className="py-1.5 text-right text-white">{line.debit > 0 ? fmt(line.debit) : ''}</td>
                              <td className="py-1.5 text-right text-gray-400">{line.credit > 0 ? fmt(line.credit) : ''}</td>
                              <td className="py-1.5 pl-4 text-gray-500">{line.description || ''}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-navy-600 font-semibold">
                            <td className="py-1.5 text-gray-400">Total</td>
                            <td className="py-1.5 text-right text-white">{fmt(entry.total_debits)}</td>
                            <td className="py-1.5 text-right text-gray-300">{fmt(entry.total_credits)}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
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
        <DialogContent className="bg-navy-900 border-navy-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-xs">Date *</Label>
                <Input type="date" value={form.transaction_date}
                  onChange={e => setForm({ ...form, transaction_date: e.target.value })}
                  className="bg-navy-800 border-navy-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300 text-xs">Reference</Label>
                <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })}
                  className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="Check #, invoice #, etc." />
              </div>
            </div>
            <div>
              <Label className="text-gray-300 text-xs">Description *</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="What is this entry for?" />
            </div>

            <div>
              <Label className="text-gray-300 text-xs mb-2 block">Lines (must balance)</Label>
              <div className="space-y-2">
                {form.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <select value={line.account_id} onChange={e => updateLine(idx, 'account_id', e.target.value)}
                      className="bg-navy-800 border border-navy-700 text-white rounded px-2 py-1.5 text-xs col-span-4">
                      <option value="">Select account</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                    <Input type="number" value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)}
                      placeholder="Debit" className="bg-navy-800 border-navy-700 text-white col-span-3 text-xs" min="0" step="0.01" />
                    <Input type="number" value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)}
                      placeholder="Credit" className="bg-navy-800 border-navy-700 text-white col-span-3 text-xs" min="0" step="0.01" />
                    <Input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)}
                      placeholder="Memo" className="bg-navy-800 border-navy-700 text-white col-span-1 text-xs" />
                    <button onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}
                      className="col-span-1 text-gray-500 hover:text-red-400" disabled={form.lines.length <= 2}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline"
                onClick={() => setForm({ ...form, lines: [...form.lines, { ...EMPTY_LINE }] })}
                className="mt-2 border-navy-700 text-gray-400 hover:text-white text-xs">
                + Add Line
              </Button>
              <div className={`mt-3 p-2 rounded text-xs flex justify-between items-center ${balanced ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                <span>{balanced ? '✓ Balanced' : '✗ Not balanced'}</span>
                <span>Debits: {fmt(totalDebits)} | Credits: {fmt(totalCredits)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || !balanced} className="bg-brand-blue hover:bg-blue-600 text-white">
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Create Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
