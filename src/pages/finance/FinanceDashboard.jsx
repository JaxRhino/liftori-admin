import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { fetchFinanceSummary } from '../../lib/financeService';
import {
  DollarSign, FileText, CreditCard, TrendingUp, TrendingDown,
  AlertTriangle, Clock, ArrowRight, Loader, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);

function StatCard({ icon: Icon, label, value, sub, color = 'blue', onClick }) {
  const colors = {
    blue: 'text-brand-blue bg-brand-blue/10',
    green: 'text-green-400 bg-green-400/10',
    yellow: 'text-yellow-400 bg-yellow-400/10',
    red: 'text-red-400 bg-red-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
  };
  return (
    <Card
      className={`bg-navy-800 border-navy-700 p-5 ${onClick ? 'cursor-pointer hover:border-brand-blue/40 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
        {onClick && <ArrowRight className="w-4 h-4 text-gray-600 mt-1 flex-shrink-0" />}
      </div>
    </Card>
  );
}

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(refresh = false) {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setSummary(await fetchFinanceSummary());
    } catch {
      toast.error('Failed to load finance summary');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center">
      <Loader className="w-8 h-8 text-brand-blue animate-spin" />
    </div>
  );

  const s = summary || {};
  const ar = s.accounts_receivable || {};
  const rev = s.revenue || {};
  const exp = s.expenses || {};
  const ap = s.accounts_payable || {};
  const ic = s.invoice_counts || {};

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Finance Hub</h1>
            <p className="text-gray-400 mt-1 text-sm">Company-wide financial management</p>
          </div>
          <Button
            variant="outline"
            onClick={() => load(true)}
            disabled={refreshing}
            className="border-navy-700 text-gray-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={DollarSign} label="Accounts Receivable" value={fmt(ar.total)}
            sub={ar.overdue > 0 ? `${fmt(ar.overdue)} overdue` : 'All current'}
            color={ar.overdue > 0 ? 'red' : 'green'}
            onClick={() => navigate('/admin/finance/invoices')}
          />
          <StatCard
            icon={TrendingUp} label="Revenue MTD" value={fmt(rev.mtd)}
            sub={`YTD: ${fmt(rev.ytd)}`} color="green"
            onClick={() => navigate('/admin/finance/reports')}
          />
          <StatCard
            icon={TrendingDown} label="Expenses MTD" value={fmt(exp.mtd)}
            color="yellow" onClick={() => navigate('/admin/finance/expenses')}
          />
          <StatCard
            icon={CreditCard} label="Accounts Payable" value={fmt(ap.total)}
            sub="Outstanding bills" color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="bg-navy-800 border-navy-700 p-6 col-span-2">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-blue" />
              Invoice Overview
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Draft', value: ic.draft || 0, color: 'text-gray-400' },
                { label: 'Open', value: ic.open || 0, color: 'text-yellow-400' },
                { label: 'Paid', value: ic.paid || 0, color: 'text-green-400' },
              ].map(b => (
                <div key={b.label} className="text-center p-4 bg-navy-900 rounded-lg">
                  <p className={`text-3xl font-bold ${b.color}`}>{b.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{b.label}</p>
                </div>
              ))}
            </div>
            {ar.overdue > 0 && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400 flex-1">
                  <strong>{fmt(ar.overdue)}</strong> in overdue invoices
                </p>
                <Button size="sm" onClick={() => navigate('/admin/finance/invoices')}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs">
                  View
                </Button>
              </div>
            )}
          </Card>

          <Card className="bg-navy-800 border-navy-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="space-y-1">
              {[
                { label: 'New Invoice', icon: FileText, path: '/admin/finance/invoices' },
                { label: 'Record Payment', icon: CreditCard, path: '/admin/finance/payments' },
                { label: 'Log Expense', icon: TrendingDown, path: '/admin/finance/expenses' },
                { label: 'Journal Entry', icon: Clock, path: '/admin/finance/journal' },
                { label: 'P&L Report', icon: TrendingUp, path: '/admin/finance/reports' },
              ].map(item => (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-navy-700 transition-colors">
                  <item.icon className="w-4 h-4 text-gray-500" />
                  {item.label}
                  <ArrowRight className="w-3 h-3 text-gray-600 ml-auto" />
                </button>
              ))}
            </div>
          </Card>
        </div>

        {(s.pending_approvals || 0) > 0 && (
          <Card className="bg-yellow-500/10 border border-yellow-500/30 p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-400" />
              <p className="text-sm text-yellow-300 flex-1">
                <strong>{s.pending_approvals}</strong> journal {s.pending_approvals === 1 ? 'entry' : 'entries'} pending approval
              </p>
              <Button size="sm" onClick={() => navigate('/admin/finance/journal')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs">
                Review
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
