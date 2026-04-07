import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { fetchFinanceSummary } from '../../lib/financeService';
import InvoicesList from './InvoicesList';
import PaymentsList from './PaymentsList';
import ExpensesList from './ExpensesList';
import BillsList from './BillsList';
import CommissionBatches from './CommissionBatches';
import BudgetManager from './BudgetManager';
import AgingReport from './AgingReport';
import ChartOfAccounts from './ChartOfAccounts';
import JournalEntries from './JournalEntries';
import FinancialReports from './FinancialReports';
import {
  FileText, DollarSign, TrendingDown, BookOpen, BarChart3,
  Receipt, Users, PieChart, Clock, Scale,
} from 'lucide-react';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'payments', label: 'Payments', icon: DollarSign },
  { id: 'expenses', label: 'Expenses', icon: TrendingDown },
  { id: 'bills', label: 'Bills (AP)', icon: Receipt },
  { id: 'commissions', label: 'Commissions', icon: Users },
  { id: 'budgets', label: 'Budgets', icon: PieChart },
  { id: 'aging', label: 'Aging', icon: Clock },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'reports', label: 'Reports', icon: Scale },
  { id: 'accounts', label: 'Chart of Accounts', icon: BarChart3 },
];

export default function FinanceHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true });
  }, [activeTab, setSearchParams]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchFinanceSummary().then(setSummary).catch(console.error);
    }
  }, [activeTab]);

  const renderDashboard = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white">Finance Hub</h1>
        <p className="text-gray-400 mt-2">Invoices, payments, expenses, commissions, and financial reports</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Accounts Receivable', value: summary?.accounts_receivable?.total, sub: `${fmt(summary?.accounts_receivable?.overdue)} overdue`, color: 'text-blue-400' },
          { label: 'Revenue (MTD)', value: summary?.revenue?.mtd, sub: `${fmt(summary?.revenue?.ytd)} YTD`, color: 'text-green-400' },
          { label: 'Expenses (MTD)', value: summary?.expenses?.mtd, sub: '', color: 'text-red-400' },
          { label: 'Accounts Payable', value: summary?.accounts_payable?.total, sub: `${summary?.pending_approvals || 0} pending approvals`, color: 'text-yellow-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-navy-800/80 border border-navy-700 rounded-lg p-5">
            <p className="text-gray-400 text-xs font-medium">{stat.label}</p>
            <p className={`text-2xl font-bold mt-2 ${stat.color}`}>{fmt(stat.value)}</p>
            {stat.sub && <p className="text-xs text-gray-500 mt-1">{stat.sub}</p>}
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {TABS.slice(1).map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="bg-navy-800/50 border border-navy-700 hover:border-brand-blue rounded-lg p-4 text-left transition-colors group">
                <Icon size={20} className="text-brand-blue mb-2 group-hover:text-blue-400" />
                <h3 className="text-white text-sm font-medium">{tab.label}</h3>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-navy-800/50 border border-navy-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">Invoice Status</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Draft', value: summary?.invoice_counts?.draft || 0, color: 'text-gray-400' },
            { label: 'Open', value: summary?.invoice_counts?.open || 0, color: 'text-blue-400' },
            { label: 'Paid', value: summary?.invoice_counts?.paid || 0, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label}>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-navy-800/50 border-b border-navy-700 rounded-none w-full justify-start px-4 overflow-x-auto flex-nowrap">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id}
                className="flex items-center gap-1.5 text-gray-400 hover:text-white data-[state=active]:text-brand-blue data-[state=active]:border-b-2 data-[state=active]:border-brand-blue rounded-none border-b-2 border-transparent whitespace-nowrap">
                <Icon size={15} />
                <span className="text-xs">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="p-8">
          <TabsContent value="dashboard" className="mt-0">{renderDashboard()}</TabsContent>
          <TabsContent value="invoices" className="mt-0"><InvoicesList /></TabsContent>
          <TabsContent value="payments" className="mt-0"><PaymentsList /></TabsContent>
          <TabsContent value="expenses" className="mt-0"><ExpensesList /></TabsContent>
          <TabsContent value="bills" className="mt-0"><BillsList /></TabsContent>
          <TabsContent value="commis