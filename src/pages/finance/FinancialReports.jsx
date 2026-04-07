import { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { fetchProfitLoss, fetchAgingReport } from '../../lib/financeService';
import { BarChart3, Loader, TrendingUp, TrendingDown, DollarSign, FileText } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
const fmtPct = (v) => `${(v || 0).toFixed(1)}%`;

function PLRow({ label, value, indent = false, bold = false, color }) {
  return (
    <div className={`flex justify-between py-1.5 ${indent ? 'pl-4' : ''} ${bold ? 'font-semibold text-white border-t border-navy-700 mt-1 pt-2' : 'text-gray-300'}`}>
      <span>{label}</span>
      <span className={color || (value < 0 ? 'text-red-400' : 'text-gray-300')}>{fmt(value)}</span>
    </div>
  );
}

export default function FinancialReports() {
  const now = new Date();
  const [activeReport, setActiveReport] = useState('pl');
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [plData, setPlData] = useState(null);
  const [agingData, setAgingData] = useState(null);

  async function runReport() {
    try {
      setLoading(true);
      if (activeReport === 'pl') {
        setPlData(await fetchProfitLoss(startDate, endDate));
      } else if (activeReport === 'aging') {
        setAgingData(await fetchAgingReport());
      }
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  }

  const agingTotal = (bucket) => (agingData?.[bucket] || []).reduce((s, i) => s + (i.balance_due || 0), 0);

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-7 h-7 text-brand-blue" />
          <h1 className="text-2xl font-bold text-white">Financial Reports</h1>
        </div>

        {/* Report Type */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'pl', label: 'Profit & Loss' },
            { id: 'aging', label: 'Aging Report' },
          ].map(r => (
            <button key={r.id} onClick={() => { setActiveReport(r.id); setPlData(null); setAgingData(null); }}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeReport === r.id ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400 hover:text-white'}`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Date Range (P&L only) */}
        {activeReport === 'pl' && (
          <Card className="bg-navy-800 border-navy-700 p-5 mb-6">
            <div className="flex items-end gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Start Date</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="bg-navy-900 border-navy-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">End Date</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="bg-navy-900 border-navy-700 text-white" />
              </div>
              <div className="flex gap-2 ml-auto">
                {[
                  { label: 'MTD', fn: () => { const d = new Date(); setStartDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]); setEndDate(d.toISOString().split('T')[0]); } },
                  { label: 'YTD', fn: () => { const d = new Date(); setStartDate(new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0]); setEndDate(d.toISOString().split('T')[0]); } },
                ].map(p => (
                  <Button key={p.label} size="sm" variant="outline" onClick={p.fn}
                    className="border-navy-700 text-gray-400 hover:text-white text-xs">{p.label}</Button>
                ))}
              </div>
            </div>
          </Card>
        )}

        <Button onClick={runReport} disabled={loading} className="bg-brand-blue hover:bg-blue-600 text-white mb-6">
          {loading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <BarChart3 className="w-4 h-4 mr-2" />}
          Generate Report
        </Button>

        {/* P&L Report */}
        {activeReport === 'pl' && plData && (
          <Card className="bg-navy-800 border-navy-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Profit & Loss</h2>
            <p className="text-xs text-gray-500 mb-6">
              {new Date(plData.period.start).toLocaleDateString()} — {new Date(plData.period.end).toLocaleDateString()}
            </p>

            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Income</p>
              <PLRow label="Total Revenue" value={plData.revenue} color="text-green-400" />
              <div className="h-px bg-navy-700 my-3" />

              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Cost of Goods Sold</p>
              <PLRow label="Cost of Services" value={plData.cogs} indent />
              <PLRow label="Gross Profit" value={plData.gross_profit} bold color={plData.gross_profit >= 0 ? 'text-green-400' : 'text-red-400'} />
              <p className="text-xs text-gray-500 text-right pr-1 mt-0.5">Margin: {fmtPct(plData.gross_margin)}</p>
              <div className="h-px bg-navy-700 my-3" />

              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Operating Expenses</p>
              <PLRow label="Total Operating Expenses" value={plData.operating_expenses} indent />
              <div className="h-px bg-navy-700 my-3" />

              <PLRow label="Net Income" value={plData.net_income} bold color={plData.net_income >= 0 ? 'text-green-400' : 'text-red-400'} />
              <p className="text-xs text-gray-500 text-right pr-1 mt-0.5">Net Margin: {fmtPct(plData.net_margin)}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mt-8">
              {[
                { label: 'Revenue', value: plData.revenue, icon: TrendingUp, color: 'text-green-400' },
                { label: 'Expenses', value: plData.cogs + plData.operating_expenses, icon: TrendingDown, color: 'text-red-400' },
                { label: 'Net Income', value: plData.net_income, icon: DollarSign, color: plData.net_income >= 0 ? 'text-green-400' : 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="bg-navy-900 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                    <span className="text-xs text-gray-500">{s.label}</span>
                  </div>
                  <p className={`text-xl font-bold ${s.color}`}>{fmt(s.value)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Aging Report */}
        {activeReport === 'aging' && agingData && (
          <Card className="bg-navy-800 border-navy-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Accounts Receivable Aging</h2>
            {[
              { key: 'current', label: 'Current (not yet due)' },
              { key: 'days_1_30', label: '1-30 Days Overdue' },
              { key: 'days_31_60', label: '31-60 Days Overdue' },
              { key: 'days_61_90', label: '61-90 Days Overdue' },
              { key: 'over_90', label: 'Over 90 Days Overdue' },
            ].map(({ key, label }) => {
              const items = agingData[key] || [];
              const total = agingTotal(key);
              if (items.length === 0) return null;
              return (
                <div key={key} className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">{label}</span>
                    <span className={`text-sm font-bold ${key === 'current' ? 'text-white' : 'text-red-400'}`}>{fmt(total)}</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left py-1">Invoice #</th>
                        <th className="text-left py-1">Customer</th>
                        <th className="text-right py-1">Total</th>
                        <th className="text-right py-1">Balance Due</th>
                        <th className="text-right py-1">Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(inv => (
                        <tr key={inv.id} className="border-t border-navy-700">
                          <td className="py-1.5 text-brand-blue">{inv.invoice_number}</td>
                          <td className="py-1.5 text-gray-300">{inv.customer_name}</td>
                          <td className="py-1.5 text-right text-gray-400">{fmt(inv.total_amount)}</td>
                          <td className="py-1.5 text-right text-white font-medium">{fmt(inv.balance_due)}</td>
                          <td className="py-1.5 text-right text-gray-400">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            <div className="border-t border-navy-600 pt-3 flex justify-between">
              <span className="text-sm font-semibold text-white">Total Outstanding</span>
              <span className="text-sm font-bold text-red-400">
                {fmt(['current', 'days_1_30', 'days_31_60', 'days_61_90', 'over_90'].reduce((s, k) => s + agingTotal(k), 0))}
              </span>
            </div>
          </Card>
        )}

        {!plData && !agingData && !loading && (
          <Card className="bg-navy-800 border-navy-700 p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400">Select a report type and click Generate</p>
          </Card>
        )}
      </div>
    </div>
  );
}
