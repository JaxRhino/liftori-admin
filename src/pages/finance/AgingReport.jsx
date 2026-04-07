import { useState, useEffect } from 'react';
import { fetchARAgingReport } from '../../lib/financeService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

const BUCKETS = [
  { key: 'current', label: 'Current', color: 'text-green-400' },
  { key: 'd30', label: '1–30 Days', color: 'text-yellow-400' },
  { key: 'd60', label: '31–60 Days', color: 'text-orange-400' },
  { key: 'd90', label: '61–90 Days', color: 'text-red-400' },
  { key: 'd120', label: '90+ Days', color: 'text-red-600' },
];

export default function AgingReport() {
  const [aging, setAging] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('current');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await fetchARAgingReport();
      setAging(data);
    } catch (e) {
      toast.error('Failed to load aging report');
    } finally {
      setLoading(false);
    }
  }

  const totals = aging
    ? BUCKETS.reduce((acc, b) => {
        acc[b.key] = (aging[b.key] || []).reduce((s, i) => s + (i.balance || 0), 0);
        return acc;
      }, {})
    : {};

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
  const currentItems = aging?.[activeTab] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">AR Aging Report</h2>
          <p className="text-gray-400 text-sm">Accounts Receivable by aging bucket</p>
        </div>
        <Button onClick={load} variant="outline" className="border-navy-700 text-gray-300 hover:text-white gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader className="w-6 h-6 text-brand-blue animate-spin" /></div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-5 gap-3">
            {BUCKETS.map(b => (
              <Card key={b.key} className={`bg-navy-800 border-navy-700 p-4 cursor-pointer transition-colors ${activeTab === b.key ? 'border-brand-blue' : ''}`}
                onClick={() => setActiveTab(b.key)}>
                <p className="text-gray-400 text-xs font-medium">{b.label}</p>
                <p className={`text-xl font-bold mt-1 ${b.color}`}>{fmt(totals[b.key])}</p>
                <p className="text-xs text-gray-500">{(aging[b.key] || []).length} invoices</p>
              </Card>
            ))}
          </div>

          <Card className="bg-navy-800 border-navy-700 p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Total Outstanding AR</span>
              <span className="text-white font-bold text-xl">{fmt(grandTotal)}</span>
            </div>
          </Card>

          {/* Bucket Detail */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">
              {BUCKETS.find(b => b.key === activeTab)?.label} — {currentItems.length} invoices
            </h3>
            {currentItems.length === 0 ? (
              <Card className="bg-navy-800 border-navy-700 p-8 text-center text-gray-400">No invoices in this bucket</Card>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-navy-700">
                      <th className="text-left pb-3 font-medium">Invoice #</th>
                      <th className="text-left pb-3 font-medium">Customer</th>
                      <th className="text-left pb-3 font-medium">Issue Date</th>
                      <th className="text-left pb-3 font-medium">Due Date</th>
                      <th className="text-right pb-3 font-medium">Total</th>
                      <th className="text-right pb-3 font-medium">Balance</th>
                      <th className="text-right pb-3 font-medium">Days Over</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/50">
                    {currentItems.map(inv => (
                      <tr key={inv.id} className="text-white hover:bg-navy-800/50">
                        <td className="py-3 font-mono text-xs text-gray-300">{inv.invoice_number}</td>
                        <td className="py-3">{inv.profiles?.full_name || '—'}</td>
                        <td className="py-3 text-gray-300">{inv.issue_date}</td>
                        <td className="py-3 text-gray-300">{inv.due_date || '—'}</td>
                        <td className="py-3 text-right">{fmt(inv.total)}</td>
                        <td className="py-3 text-right text-yellow-400">{fmt(inv.balance)}</td>
                        <td className="py-3 text-right text-red-400">{inv.daysOverdue > 0 ? `${inv.daysOverdue}d` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
