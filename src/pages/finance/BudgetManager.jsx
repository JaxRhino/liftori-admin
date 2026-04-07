import { useState, useEffect } from 'react';
import { fetchBudgets, createBudget, updateBudget, fetchAccounts } from '../../lib/financeService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Plus, Loader, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BudgetManager() {
  const [budgets, setBudgets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ account_id: '', account_name: '', annual_total: '' });

  useEffect(() => { load(); }, [fiscalYear]);

  async function load() {
    try {
      setLoading(true);
      const [budgetData, acctData] = await Promise.all([
        fetchBudgets({ fiscalYear }),
        fetchAccounts(),
      ]);
      setBudgets(budgetData || []);
      setAccounts(acctData || []);
    } catch (e) {
      toast.error('Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.account_id || !form.annual_total) {
      toast.error('Account and annual total are required');
      return;
    }
    const acct = accounts.find(a => a.id === form.account_id);
    try {
      await createBudget({
        account_id: form.account_id,
        account_name: acct?.name || form.account_name,
        fiscal_year: fiscalYear,
        annual_total: parseFloat(form.annual_total),
        monthly_amounts: {},
      });
      toast.success('Budget created');
      setCreateOpen(false);
      setForm({ account_id: '', account_name: '', annual_total: '' });
      load();
    } catch (e) {
      toast.error('Failed to create budget');
    }
  }

  const totalBudgeted = budgets.reduce((s, b) => s + (b.annual_total || 0), 0);
  const totalActual = budgets.reduce((s, b) => s + (b.actual_total || 0), 0);
  const totalVariance = totalBudgeted - totalActual;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Budget Manager</h2>
          <p className="text-gray-400 text-sm">Budget vs. Actual Analysis</p>
        </div>
        <div className="flex gap-3">
          <select value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))}
            className="bg-navy-800 border border-navy-700 rounded text-white px-3 py-2 text-sm">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button onClick={() => setCreateOpen(true)} className="bg-brand-blue hover:bg-blue-600 text-white gap-2">
            <Plus className="w-4 h-4" /> Add Budget Line
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-navy-800 border-navy-700 p-4">
          <p className="text-gray-400 text-xs font-medium">Total Budgeted</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(totalBudgeted)}</p>
        </Card>
        <Card className="bg-navy-800 border-navy-700 p-4">
          <p className="text-gray-400 text-xs font-medium">Total Actual</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(totalActual)}</p>
        </Card>
        <Card className="bg-navy-800 border-navy-700 p-4">
          <p className="text-gray-400 text-xs font-medium">Variance</p>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(Math.abs(totalVariance))}</p>
            {totalVariance >= 0 ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
          </div>
          <p className="text-xs text-gray-400">{totalVariance >= 0 ? 'Under budget' : 'Over budget'}</p>
        </Card>
      </div>

      {/* Budget Lines Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader className="w-6 h-6 text-brand-blue animate-spin" /></div>
      ) : budgets.length === 0 ? (
        <Card className="bg-navy-800 border-navy-700 p-12 text-center text-gray-400">
          No budget lines for FY {fiscalYear}. Add your first budget line.
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-navy-700">
                <th className="text-left pb-3 font-medium">Account</th>
                <th className="text-right pb-3 font-medium">Budget</th>
                <th className="text-right pb-3 font-medium">Actual</th>
                <th className="text-right pb-3 font-medium">Variance</th>
                <th className="text-right pb-3 font-medium">% Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {budgets.map(b => {
                const variance = (b.annual_total || 0) - (b.actual_total || 0);
                const pctUsed = b.annual_total > 0 ? Math.min(((b.actual_total || 0) / b.annual_total) * 100, 100) : 0;
                return (
                  <tr key={b.id} className="text-white hover:bg-navy-800/50">
                    <td className="py-3">
                      <div className="font-medium">{b.account_name}</div>
                      {b.finance_accounts && <div className="text-xs text-gray-400">{b.finance_accounts.code}</div>}
                    </td>
                    <td className="py-3 text-right">{fmt(b.annual_total)}</td>
                    <td className="py-3 text-right">{fmt(b.actual_total)}</td>
                    <td className={`py-3 text-right font-medium ${variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(Math.abs(variance))}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-navy-700 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${pctUsed > 90 ? 'bg-red-500' : pctUsed > 75 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pctUsed}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{pctUsed.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Add Budget Line — FY {fiscalYear}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Account *</label>
              <select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 rounded text-white text-sm px-3 py-2">
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Annual Budget *</label>
              <Input type="number" step="0.01" value={form.annual_total} onChange={e => setForm({ ...form, annual_total: e.target.value })} className="bg-navy-800 border-navy-700 text-white" placeholder="0.00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleCreate} className="bg-brand-blue hover:bg-blue-600 text-white">Add Line</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
