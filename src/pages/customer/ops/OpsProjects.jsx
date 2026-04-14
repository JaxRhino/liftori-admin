import React, { useState, useEffect } from 'react';
import { useOrg } from '../../../lib/OrgContext';
import { supabase } from '../../../lib/supabase';
import { fetchCrews } from '../../../lib/customerOpsService';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { toast } from 'sonner';
import {
  LayoutGrid,
  LayoutList,
  DollarSign,
  Plus,
  Search,
  Filter,
  ChevronRight,
  Calendar,
  MapPin,
  Users,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Eye,
  Edit,
  Trash2,
  X,
  ArrowRight,
  MoreVertical,
  Download,
} from 'lucide-react';

export default function OpsProjects() {
  const { currentOrg } = useOrg();
  const [projects, setProjects] = useState([]);
  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('board'); // board, table, financial
  const [selectedProject, setSelectedProject] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview'); // overview, financials, invoicing, timeline
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [crewFilter, setCrewFilter] = useState('all');

  // Dialog state
  const [showChangeOrderForm, setShowChangeOrderForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [changeOrderForm, setChangeOrderForm] = useState({ title: '', description: '', amount: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: '', method: 'cash', reference: '', notes: '' });

  // Edit state
  const [editingProject, setEditingProject] = useState(null);

  const statusList = ['pending', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'];
  const invoiceStatusList = ['not_invoiced', 'draft', 'sent', 'partial', 'paid', 'overdue', 'void'];

  // Fetch projects
  useEffect(() => {
    if (!currentOrg?.id) return;
    fetchProjects();
  }, [currentOrg?.id]);

  // Fetch crews
  useEffect(() => {
    if (!currentOrg?.id) return;
    loadCrews();
  }, [currentOrg?.id]);

  async function fetchProjects() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_projects')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  async function loadCrews() {
    try {
      const crewList = await fetchCrews(currentOrg.id);
      setCrews(crewList || []);
    } catch (err) {
      console.error('Error loading crews:', err);
    }
  }

  // Calculate financial stats
  function getFinancialStats() {
    const stats = {
      totalValue: 0,
      invoiced: 0,
      collected: 0,
      outstanding: 0,
      activeJobs: 0,
    };

    projects.forEach((p) => {
      const changeOrdersTotal = p.total_change_order_amount || 0;
      const projectValue = (p.estimated_value || 0) + changeOrdersTotal;
      stats.totalValue += projectValue;
      stats.invoiced += p.invoice_amount || 0;
      stats.collected += p.amount_paid || 0;
      stats.outstanding += (p.invoice_amount || 0) - (p.amount_paid || 0);
      if (p.status === 'in_progress') stats.activeJobs += 1;
    });

    return stats;
  }

  function handleOpenDetail(project) {
    setSelectedProject(project);
    setEditingProject({ ...project });
    setShowDetailDialog(true);
    setSelectedTab('overview');
  }

  async function handleSaveProject() {
    try {
      const { error } = await supabase
        .from('customer_projects')
        .update(editingProject)
        .eq('id', editingProject.id)
        .eq('org_id', currentOrg.id);

      if (error) throw error;
      toast.success('Project updated');
      fetchProjects();
      setShowDetailDialog(false);
    } catch (err) {
      console.error('Error saving project:', err);
      toast.error('Failed to save project');
    }
  }

  function handleAddChangeOrder() {
    if (!changeOrderForm.title || !changeOrderForm.amount) {
      toast.error('Title and amount required');
      return;
    }

    const newChangeOrder = {
      id: crypto.randomUUID(),
      title: changeOrderForm.title,
      description: changeOrderForm.description,
      amount: parseFloat(changeOrderForm.amount),
      status: 'pending',
      created_at: new Date().toISOString(),
      approved_at: null,
    };

    const currentOrders = editingProject.change_orders || [];
    const updatedOrders = [...currentOrders, newChangeOrder];
    const totalAmount = updatedOrders.reduce((sum, co) => sum + co.amount, 0);

    setEditingProject({
      ...editingProject,
      change_orders: updatedOrders,
      total_change_order_amount: totalAmount,
    });

    setChangeOrderForm({ title: '', description: '', amount: '' });
    setShowChangeOrderForm(false);
    toast.success('Change order added');
  }

  function handleRemoveChangeOrder(coId) {
    const updated = editingProject.change_orders.filter((co) => co.id !== coId);
    const totalAmount = updated.reduce((sum, co) => sum + co.amount, 0);

    setEditingProject({
      ...editingProject,
      change_orders: updated,
      total_change_order_amount: totalAmount,
    });
    toast.success('Change order removed');
  }

  function handleAddPayment() {
    if (!paymentForm.amount || !paymentForm.date) {
      toast.error('Amount and date required');
      return;
    }

    const newPayment = {
      id: crypto.randomUUID(),
      amount: parseFloat(paymentForm.amount),
      date: paymentForm.date,
      method: paymentForm.method,
      reference: paymentForm.reference,
      notes: paymentForm.notes,
    };

    const currentPayments = editingProject.payments || [];
    const updatedPayments = [...currentPayments, newPayment];
    const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);

    setEditingProject({
      ...editingProject,
      payments: updatedPayments,
      amount_paid: totalPaid,
    });

    setPaymentForm({ amount: '', date: '', method: 'cash', reference: '', notes: '' });
    setShowPaymentForm(false);
    toast.success('Payment recorded');
  }

  function handleRemovePayment(paymentId) {
    const updated = editingProject.payments.filter((p) => p.id !== paymentId);
    const totalPaid = updated.reduce((sum, p) => sum + p.amount, 0);

    setEditingProject({
      ...editingProject,
      payments: updated,
      amount_paid: totalPaid,
    });
    toast.success('Payment removed');
  }

  function handleMoveProject(projectId, newStatus) {
    const updated = projects.map((p) =>
      p.id === projectId ? { ...p, status: newStatus } : p
    );
    setProjects(updated);

    supabase
      .from('customer_projects')
      .update({ status: newStatus })
      .eq('id', projectId)
      .eq('org_id', currentOrg.id)
      .then((result) => {
        if (result.error) throw result.error;
        toast.success(`Moved to ${newStatus}`);
      })
      .catch((err) => {
        console.error('Error moving project:', err);
        toast.error('Failed to move project');
      });
  }

  function handleCreateInvoice(projectId) {
    const p = projects.find((pr) => pr.id === projectId);
    if (!p) return;

    const changeOrdersTotal = p.total_change_order_amount || 0;
    const invoiceAmount = (p.estimated_value || 0) + changeOrdersTotal;

    supabase
      .from('customer_projects')
      .update({
        invoice_status: 'draft',
        invoice_amount: invoiceAmount,
        invoice_number: `INV-${Date.now()}`,
      })
      .eq('id', projectId)
      .eq('org_id', currentOrg.id)
      .then((result) => {
        if (result.error) throw result.error;
        fetchProjects();
        toast.success('Invoice created');
      })
      .catch((err) => {
        console.error('Error creating invoice:', err);
        toast.error('Failed to create invoice');
      });
  }

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.job_address?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesInvoice = invoiceStatusFilter === 'all' || p.invoice_status === invoiceStatusFilter;
    const matchesCrew = crewFilter === 'all' || p.crew_id === crewFilter;
    return matchesSearch && matchesStatus && matchesInvoice && matchesCrew;
  });

  const stats = getFinancialStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-navy-900">
        <div className="text-white">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-navy-800 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Operations Projects</h1>
            <p className="text-sm text-gray-400 mt-1">Track jobs, crews, invoices, and payments</p>
          </div>
          <Button className="bg-sky-500 hover:bg-sky-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="p-6 grid grid-cols-5 gap-4 border-b border-white/10">
        <Card className="bg-navy-800 border-white/10 p-4">
          <div className="text-xs font-semibold text-gray-400 uppercase">Total Project Value</div>
          <div className="text-2xl font-bold text-white mt-2">${stats.totalValue.toLocaleString()}</div>
        </Card>
        <Card className="bg-navy-800 border-white/10 p-4">
          <div className="text-xs font-semibold text-gray-400 uppercase">Invoiced</div>
          <div className="text-2xl font-bold text-white mt-2">${stats.invoiced.toLocaleString()}</div>
        </Card>
        <Card className="bg-navy-800 border-white/10 p-4">
          <div className="text-xs font-semibold text-gray-400 uppercase">Collected</div>
          <div className="text-2xl font-bold text-green-400 mt-2">${stats.collected.toLocaleString()}</div>
        </Card>
        <Card className="bg-navy-800 border-white/10 p-4">
          <div className="text-xs font-semibold text-gray-400 uppercase">Outstanding</div>
          <div className={`text-2xl font-bold mt-2 ${stats.outstanding > 0 ? 'text-orange-400' : 'text-green-400'}`}>
            ${stats.outstanding.toLocaleString()}
          </div>
        </Card>
        <Card className="bg-navy-800 border-white/10 p-4">
          <div className="text-xs font-semibold text-gray-400 uppercase">Active Jobs</div>
          <div className="text-2xl font-bold text-sky-400 mt-2">{stats.activeJobs}</div>
        </Card>
      </div>

      {/* Controls */}
      <div className="p-6 border-b border-white/10 space-y-4">
        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            onClick={() => setViewMode('board')}
            variant={viewMode === 'board' ? 'default' : 'outline'}
            className={viewMode === 'board' ? 'bg-sky-500 text-white' : 'border-white/20'}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Board
          </Button>
          <Button
            onClick={() => setViewMode('table')}
            variant={viewMode === 'table' ? 'default' : 'outline'}
            className={viewMode === 'table' ? 'bg-sky-500 text-white' : 'border-white/20'}
          >
            <LayoutList className="w-4 h-4 mr-2" />
            Table
          </Button>
          <Button
            onClick={() => setViewMode('financial')}
            variant={viewMode === 'financial' ? 'default' : 'outline'}
            className={viewMode === 'financial' ? 'bg-sky-500 text-white' : 'border-white/20'}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Financial
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-navy-800 border-white/10 text-white placeholder-gray-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
            <Badge
              onClick={() => setStatusFilter('all')}
              className={`cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-sky-500 text-white'
                  : 'bg-navy-800 border border-white/10 text-gray-300'
              }`}
            >
              All Status
            </Badge>
            {statusList.map((status) => (
              <Badge
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`cursor-pointer capitalize ${
                  statusFilter === status
                    ? 'bg-sky-500 text-white'
                    : 'bg-navy-800 border border-white/10 text-gray-300'
                }`}
              >
                {status}
              </Badge>
            ))}
          </div>

          {/* Invoice Status Filter */}
          <div className="flex gap-2 flex-wrap">
            <Badge
              onClick={() => setInvoiceStatusFilter('all')}
              className={`cursor-pointer ${
                invoiceStatusFilter === 'all'
                  ? 'bg-sky-500 text-white'
                  : 'bg-navy-800 border border-white/10 text-gray-300'
              }`}
            >
              All Invoice
            </Badge>
            {['not_invoiced', 'draft', 'sent', 'paid'].map((status) => (
              <Badge
                key={status}
                onClick={() => setInvoiceStatusFilter(status)}
                className={`cursor-pointer capitalize ${
                  invoiceStatusFilter === status
                    ? 'bg-sky-500 text-white'
                    : 'bg-navy-800 border border-white/10 text-gray-300'
                }`}
              >
                {status}
              </Badge>
            ))}
          </div>

          {/* Crew Filter */}
          <select
            value={crewFilter}
            onChange={(e) => setCrewFilter(e.target.value)}
            className="px-3 py-1 rounded bg-navy-800 border border-white/10 text-sm text-white"
          >
            <option value="all">All Crews</option>
            {crews.map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {viewMode === 'board' && <BoardView projects={filteredProjects} onOpenDetail={handleOpenDetail} onMove={handleMoveProject} />}
        {viewMode === 'table' && <TableView projects={filteredProjects} onOpenDetail={handleOpenDetail} />}
        {viewMode === 'financial' && <FinancialView projects={filteredProjects} onOpenDetail={handleOpenDetail} />}
      </div>

      {/* Detail Dialog */}
      {showDetailDialog && editingProject && (
        <DetailDialog
          project={editingProject}
          crews={crews}
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          onClose={() => setShowDetailDialog(false)}
          onSave={handleSaveProject}
          onFieldChange={(field, value) =>
            setEditingProject({ ...editingProject, [field]: value })
          }
          // Change orders
          changeOrders={editingProject.change_orders || []}
          showChangeOrderForm={showChangeOrderForm}
          changeOrderForm={changeOrderForm}
          onChangeOrderFormChange={setChangeOrderForm}
          onAddChangeOrder={handleAddChangeOrder}
          onRemoveChangeOrder={handleRemoveChangeOrder}
          onShowChangeOrderForm={setShowChangeOrderForm}
          // Payments
          payments={editingProject.payments || []}
          showPaymentForm={showPaymentForm}
          paymentForm={paymentForm}
          onPaymentFormChange={setPaymentForm}
          onAddPayment={handleAddPayment}
          onRemovePayment={handleRemovePayment}
          onShowPaymentForm={setShowPaymentForm}
        />
      )}
    </div>
  );
}

// Board View Component
function BoardView({ projects, onOpenDetail, onMove }) {
  const statuses = ['pending', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'];
  const statusColors = {
    pending: 'bg-gray-700',
    scheduled: 'bg-blue-700',
    in_progress: 'bg-sky-600',
    on_hold: 'bg-orange-700',
    completed: 'bg-green-700',
    cancelled: 'bg-red-700',
  };

  return (
    <div className="grid grid-cols-6 gap-4">
      {statuses.map((status) => {
        const columnProjects = projects.filter((p) => p.status === status);
        return (
          <div key={status} className="space-y-3">
            <div className="sticky top-0 z-10 bg-navy-900 pb-2">
              <div className={`${statusColors[status]} px-3 py-2 rounded font-semibold text-white text-sm capitalize`}>
                {status} ({columnProjects.length})
              </div>
            </div>

            <div className="space-y-3 min-h-96">
              {columnProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpenDetail={onOpenDetail}
                  onMove={onMove}
                  statuses={statuses}
                  status={status}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Project Card for Board
function ProjectCard({ project, onOpenDetail, onMove, statuses, status }) {
  const invoiceStatusBadgeColor = {
    not_invoiced: 'bg-gray-600',
    draft: 'bg-blue-600',
    sent: 'bg-purple-600',
    partial: 'bg-orange-600',
    paid: 'bg-green-600',
    overdue: 'bg-red-600',
    void: 'bg-gray-800',
  };

  const changeOrdersTotal = project.total_change_order_amount || 0;
  const projectValue = (project.estimated_value || 0) + changeOrdersTotal;

  return (
    <Card className="bg-navy-800 border-white/10 p-3 cursor-pointer hover:border-sky-500 transition">
      <div className="space-y-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-white truncate">{project.title}</h3>
            <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {project.job_city}, {project.job_state}
            </p>
          </div>
          <Badge className={`${invoiceStatusBadgeColor[project.invoice_status] || 'bg-gray-600'} text-white text-xs`}>
            {project.invoice_status?.replace(/_/g, ' ')}
          </Badge>
        </div>

        {/* Completion bar */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Progress</span>
            <span className="text-white font-semibold">{project.completion_percentage || 0}%</span>
          </div>
          <div className="w-full bg-navy-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full transition"
              style={{ width: `${project.completion_percentage || 0}%` }}
            />
          </div>
        </div>

        {/* Value */}
        <div className="text-sm font-semibold text-green-400">
          ${projectValue.toLocaleString()}
        </div>

        {/* Move dropdown */}
        <select
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            onMove(project.id, e.target.value);
          }}
          className="w-full px-2 py-1 text-xs rounded bg-navy-700 border border-white/10 text-white cursor-pointer"
          defaultValue={status}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              → {s}
            </option>
          ))}
        </select>

        {/* Open detail */}
        <Button
          onClick={() => onOpenDetail(project)}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white text-xs py-1"
        >
          <Eye className="w-3 h-3 mr-1" />
          Details
        </Button>
      </div>
    </Card>
  );
}

// Table View Component
function TableView({ projects, onOpenDetail }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-3 px-4 font-semibold text-gray-300">Project</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-300">Type</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-300">Status</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-300">Completion</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-300">Est. Value</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-300">Invoiced</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-300">Paid</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-300">Balance</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-300">Invoice Status</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-300">Action</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const changeOrdersTotal = p.total_change_order_amount || 0;
            const projectValue = (p.estimated_value || 0) + changeOrdersTotal;
            const balance = (p.invoice_amount || 0) - (p.amount_paid || 0);

            return (
              <tr key={p.id} className="border-b border-white/10 hover:bg-navy-800 transition">
                <td className="py-3 px-4">
                  <div className="font-semibold text-white">{p.title}</div>
                  <div className="text-xs text-gray-400">{p.job_address}</div>
                </td>
                <td className="py-3 px-4 text-gray-300 capitalize">{p.project_type}</td>
                <td className="py-3 px-4">
                  <Badge className="bg-navy-700 border border-white/20 text-white capitalize text-xs">
                    {p.status}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-12 bg-navy-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-sky-500 h-full"
                        style={{ width: `${p.completion_percentage || 0}%` }}
                      />
                    </div>
                    <span className="text-white font-semibold text-xs">{p.completion_percentage || 0}%</span>
                  </div>
                </td>
                <td className="py-3 px-4 font-semibold text-green-400">
                  ${projectValue.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-gray-300">
                  ${(p.invoice_amount || 0).toLocaleString()}
                </td>
                <td className="py-3 px-4 font-semibold text-white">
                  ${(p.amount_paid || 0).toLocaleString()}
                </td>
                <td className={`py-3 px-4 font-semibold ${balance > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                  ${balance.toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <Badge className="bg-navy-700 border border-white/20 text-white text-xs capitalize">
                    {(p.invoice_status || 'not_invoiced').replace(/_/g, ' ')}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <Button
                    onClick={() => onOpenDetail(p)}
                    className="bg-sky-500 hover:bg-sky-600 text-white text-xs"
                  >
                    View
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Financial View Component
function FinancialView({ projects, onOpenDetail }) {
  let totalOriginalEstimate = 0;
  let totalChangeOrders = 0;
  let totalInvoiced = 0;
  let totalPaid = 0;

  projects.forEach((p) => {
    totalOriginalEstimate += p.estimated_value || 0;
    totalChangeOrders += p.total_change_order_amount || 0;
    totalInvoiced += p.invoice_amount || 0;
    totalPaid += p.amount_paid || 0;
  });

  const totalRevised = totalOriginalEstimate + totalChangeOrders;
  const totalOutstanding = totalInvoiced - totalPaid;

  return (
    <div className="space-y-4">
      {projects.map((p) => {
        const changeOrdersTotal = p.total_change_order_amount || 0;
        const revisedTotal = (p.estimated_value || 0) + changeOrdersTotal;
        const balance = (p.invoice_amount || 0) - (p.amount_paid || 0);
        const invoiceStatusColor = {
          not_invoiced: 'border-l-4 border-l-gray-600',
          draft: 'border-l-4 border-l-blue-600',
          sent: 'border-l-4 border-l-purple-600',
          partial: 'border-l-4 border-l-orange-600',
          paid: 'border-l-4 border-l-green-600',
          overdue: 'border-l-4 border-l-red-600',
          void: 'border-l-4 border-l-gray-800',
        };

        return (
          <Card
            key={p.id}
            className={`bg-navy-800 border-white/10 p-4 ${invoiceStatusColor[p.invoice_status] || ''}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{p.title}</h3>
                <p className="text-sm text-gray-400">{p.job_address}</p>
              </div>
              <Button
                onClick={() => onOpenDetail(p)}
                className="bg-sky-500 hover:bg-sky-600 text-white text-xs"
              >
                <Edit className="w-3 h-3 mr-1" />
                Details
              </Button>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-4">
              <div className="bg-navy-900 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Original Estimate</div>
                <div className="text-lg font-bold text-white">${(p.estimated_value || 0).toLocaleString()}</div>
              </div>
              <div className="bg-navy-900 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Change Orders</div>
                <div className="text-lg font-bold text-orange-400">
                  {changeOrdersTotal > 0 ? '+' : ''}${changeOrdersTotal.toLocaleString()}
                </div>
              </div>
              <div className="bg-navy-900 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Revised Total</div>
                <div className="text-lg font-bold text-sky-400">${revisedTotal.toLocaleString()}</div>
              </div>
              <div className="bg-navy-900 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Amount Invoiced</div>
                <div className="text-lg font-bold text-white">${(p.invoice_amount || 0).toLocaleString()}</div>
              </div>
              <div className="bg-navy-900 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Amount Paid</div>
                <div className="text-lg font-bold text-green-400">${(p.amount_paid || 0).toLocaleString()}</div>
              </div>
            </div>

            {/* Payment Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Payment Progress</span>
                <span className={`font-semibold ${balance > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                  Balance: ${balance.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-navy-900 rounded-full h-2 overflow-hidden">
                <div
                  className={`${balance > 0 ? 'bg-orange-500' : 'bg-green-500'} h-full rounded-full transition`}
                  style={{ width: `${(p.amount_paid || 0) / (p.invoice_amount || 1) * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-400">
                {p.amount_paid && p.invoice_amount ? `${Math.round((p.amount_paid / p.invoice_amount) * 100)}% collected` : 'Not invoiced'}
              </div>
            </div>
          </Card>
        );
      })}

      {/* Totals */}
      <Card className="bg-navy-800 border-white/10 p-4 border-t-2 border-t-sky-500 mt-6">
        <h3 className="text-lg font-bold text-white mb-4">Portfolio Summary</h3>
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-navy-900 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">Total Estimate</div>
            <div className="text-lg font-bold text-white">${totalOriginalEstimate.toLocaleString()}</div>
          </div>
          <div className="bg-navy-900 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">Total Change Orders</div>
            <div className={`text-lg font-bold ${totalChangeOrders > 0 ? 'text-orange-400' : 'text-white'}`}>
              {totalChangeOrders > 0 ? '+' : ''}${totalChangeOrders.toLocaleString()}
            </div>
          </div>
          <div className="bg-navy-900 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">Total Revised</div>
            <div className="text-lg font-bold text-sky-400">${totalRevised.toLocaleString()}</div>
          </div>
          <div className="bg-navy-900 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">Total Invoiced</div>
            <div className="text-lg font-bold text-white">${totalInvoiced.toLocaleString()}</div>
          </div>
          <div className="bg-navy-900 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">Total Collected</div>
            <div className={`text-lg font-bold ${totalOutstanding > 0 ? 'text-orange-400' : 'text-green-400'}`}>
              ${totalPaid.toLocaleString()}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Detail Dialog Component
function DetailDialog({
  project,
  crews,
  selectedTab,
  onTabChange,
  onClose,
  onSave,
  onFieldChange,
  changeOrders,
  showChangeOrderForm,
  changeOrderForm,
  onChangeOrderFormChange,
  onAddChangeOrder,
  onRemoveChangeOrder,
  onShowChangeOrderForm,
  payments,
  showPaymentForm,
  paymentForm,
  onPaymentFormChange,
  onAddPayment,
  onRemovePayment,
  onShowPaymentForm,
}) {
  const changeOrdersTotal = (changeOrders || []).reduce((sum, co) => sum + co.amount, 0);
  const revisedTotal = (project.estimated_value || 0) + changeOrdersTotal;
  const balanceDue = (project.invoice_amount || 0) - (project.amount_paid || 0);

  const tabs = ['overview', 'financials', 'invoicing', 'timeline'];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-96 overflow-y-auto bg-navy-800 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">{project.title}</DialogTitle>
          <p className="text-sm text-gray-400">{project.job_address}</p>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition capitalize ${
                selectedTab === tab
                  ? 'border-b-sky-500 text-white'
                  : 'border-b-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-4 space-y-4">
          {selectedTab === 'overview' && (
            <OverviewTab project={project} crews={crews} onFieldChange={onFieldChange} />
          )}

          {selectedTab === 'financials' && (
            <FinancialsTab
              project={project}
              changeOrders={changeOrders}
              showChangeOrderForm={showChangeOrderForm}
              changeOrderForm={changeOrderForm}
              onChangeOrderFormChange={onChangeOrderFormChange}
              onAddChangeOrder={onAddChangeOrder}
              onRemoveChangeOrder={onRemoveChangeOrder}
              onShowChangeOrderForm={onShowChangeOrderForm}
              revisedTotal={revisedTotal}
              onFieldChange={onFieldChange}
            />
          )}

          {selectedTab === 'invoicing' && (
            <InvoicingTab
              project={project}
              payments={payments}
              showPaymentForm={showPaymentForm}
              paymentForm={paymentForm}
              onPaymentFormChange={onPaymentFormChange}
              onAddPayment={onAddPayment}
              onRemovePayment={onRemovePayment}
              onShowPaymentForm={onShowPaymentForm}
              balanceDue={balanceDue}
              onFieldChange={onFieldChange}
            />
          )}

          {selectedTab === 'timeline' && (
            <TimelineTab project={project} changeOrders={changeOrders} payments={payments} />
          )}
        </div>

        {/* Dialog Footer */}
        <DialogFooter className="mt-6">
          <Button onClick={onClose} variant="outline" className="border-white/20 text-white">
            Close
          </Button>
          <Button onClick={onSave} className="bg-sky-500 hover:bg-sky-600 text-white">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Overview Tab
function OverviewTab({ project, crews, onFieldChange }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-1">Description</label>
        <Textarea
          value={project.description || ''}
          onChange={(e) => onFieldChange('description', e.target.value)}
          className="bg-navy-900 border-white/10 text-white rounded"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Scheduled Start</label>
          <Input
            type="date"
            value={project.scheduled_start || ''}
            onChange={(e) => onFieldChange('scheduled_start', e.target.value)}
            className="bg-navy-900 border-white/10 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Scheduled End</label>
          <Input
            type="date"
            value={project.scheduled_end || ''}
            onChange={(e) => onFieldChange('scheduled_end', e.target.value)}
            className="bg-navy-900 border-white/10 text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Actual Start</label>
          <Input
            type="date"
            value={project.actual_start || ''}
            onChange={(e) => onFieldChange('actual_start', e.target.value)}
            className="bg-navy-900 border-white/10 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Actual End</label>
          <Input
            type="date"
            value={project.actual_end || ''}
            onChange={(e) => onFieldChange('actual_end', e.target.value)}
            className="bg-navy-900 border-white/10 text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-1">Assign Crew</label>
        <select
          value={project.crew_id || ''}
          onChange={(e) => onFieldChange('crew_id', e.target.value)}
          className="w-full px-3 py-2 rounded bg-navy-900 border-white/10 text-white"
        >
          <option value="">Select a crew</option>
          {crews.map((crew) => (
            <option key={crew.id} value={crew.id}>
              {crew.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Completion: {project.completion_percentage || 0}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={project.completion_percentage || 0}
          onChange={(e) => onFieldChange('completion_percentage', parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-1">Ops Notes</label>
        <Textarea
          value={project.ops_notes || ''}
          onChange={(e) => onFieldChange('ops_notes', e.target.value)}
          className="bg-navy-900 border-white/10 text-white rounded"
          rows={2}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={project.customer_signed_off || false}
          onChange={(e) => onFieldChange('customer_signed_off', e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <label className="text-sm font-semibold text-gray-300">Customer Signed Off</label>
      </div>

      {project.customer_signed_off && (
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Final Walkthrough Date</label>
          <Input
            type="date"
            value={project.final_walkthrough_date || ''}
            onChange={(e) => onFieldChange('final_walkthrough_date', e.target.value)}
            className="bg-navy-900 border-white/10 text-white"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-1">Warranty End Date</label>
        <Input
          type="date"
          value={project.warranty_end || ''}
          onChange={(e) => onFieldChange('warranty_end', e.target.value)}
          className="bg-navy-900 border-white/10 text-white"
        />
      </div>
    </div>
  );
}

// Financials Tab
function FinancialsTab({
  project,
  changeOrders,
  showChangeOrderForm,
  changeOrderForm,
  onChangeOrderFormChange,
  onAddChangeOrder,
  onRemoveChangeOrder,
  onShowChangeOrderForm,
  revisedTotal,
  onFieldChange,
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-navy-900 border-white/10 p-3">
          <div className="text-xs text-gray-400">Original Estimate</div>
          <div className="text-2xl font-bold text-white">${(project.estimated_value || 0).toLocaleString()}</div>
        </Card>
        <Card className="bg-navy-900 border-white/10 p-3">
          <div className="text-xs text-gray-400">Revised Total</div>
          <div className="text-2xl font-bold text-sky-400">${revisedTotal.toLocaleString()}</div>
        </Card>
      </div>

      {/* Change Orders */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-white">Change Orders</h4>
          <Button
            onClick={() => onShowChangeOrderForm(!showChangeOrderForm)}
            className="bg-sky-500 hover:bg-sky-600 text-white text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>

        {showChangeOrderForm && (
          <Card className="bg-navy-900 border-white/10 p-3 mb-3 space-y-2">
            <Input
              placeholder="CO Title"
              value={changeOrderForm.title}
              onChange={(e) => onChangeOrderFormChange({ ...changeOrderForm, title: e.target.value })}
              className="bg-navy-800 border-white/10 text-white text-sm"
            />
            <Textarea
              placeholder="Description"
              value={changeOrderForm.description}
              onChange={(e) => onChangeOrderFormChange({ ...changeOrderForm, description: e.target.value })}
              className="bg-navy-800 border-white/10 text-white text-sm"
              rows={2}
            />
            <Input
              placeholder="Amount"
              type="number"
              value={changeOrderForm.amount}
              onChange={(e) => onChangeOrderFormChange({ ...changeOrderForm, amount: e.target.value })}
              className="bg-navy-800 border-white/10 text-white text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={onAddChangeOrder} className="bg-green-600 hover:bg-green-700 text-white text-xs flex-1">
                Add CO
              </Button>
              <Button
                onClick={() => onShowChangeOrderForm(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white text-xs flex-1"
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {changeOrders.length > 0 ? (
          <div className="space-y-2">
            {changeOrders.map((co) => (
              <Card key={co.id} className="bg-navy-900 border-white/10 p-3 flex justify-between items-start">
                <div>
                  <div className="font-semibold text-white">{co.title}</div>
                  <div className="text-xs text-gray-400">{co.description}</div>
                  <Badge className={`mt-1 ${co.status === 'approved' ? 'bg-green-600' : 'bg-orange-600'} text-white text-xs`}>
                    {co.status}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-orange-400">${co.amount.toLocaleString()}</div>
                  <button
                    onClick={() => onRemoveChangeOrder(co.id)}
                    className="text-red-400 hover:text-red-300 text-xs mt-2"
                  >
                    Remove
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No change orders</div>
        )}
      </div>

      {/* Cost Breakdown */}
      <Card className="bg-navy-900 border-white/10 p-3 space-y-2">
        <h4 className="font-semibold text-white mb-2">Cost Breakdown</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Labor Cost</label>
            <Input
              type="number"
              value={project.labor_cost || 0}
              onChange={(e) => onFieldChange('labor_cost', parseFloat(e.target.value))}
              className="bg-navy-800 border-white/10 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Materials Cost</label>
            <Input
              type="number"
              value={project.materials_cost || 0}
              onChange={(e) => onFieldChange('materials_cost', parseFloat(e.target.value))}
              className="bg-navy-800 border-white/10 text-white text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Labor Hours</label>
          <Input
            type="number"
            value={project.labor_hours || 0}
            onChange={(e) => onFieldChange('labor_hours', parseFloat(e.target.value))}
            className="bg-navy-800 border-white/10 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Profit Margin %</label>
          <Input
            type="number"
            value={project.profit_margin || 0}
            onChange={(e) => onFieldChange('profit_margin', parseFloat(e.target.value))}
            className="bg-navy-800 border-white/10 text-white text-sm"
          />
        </div>
      </Card>
    </div>
  );
}

// Invoicing Tab
function InvoicingTab({
  project,
  payments,
  showPaymentForm,
  paymentForm,
  onPaymentFormChange,
  onAddPayment,
  onRemovePayment,
  onShowPaymentForm,
  balanceDue,
  onFieldChange,
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Invoice Number</label>
          <Input
            value={project.invoice_number || ''}
            onChange={(e) => onFieldChange('invoice_number', e.target.value)}
            className="bg-navy-900 border-white/10 text-white"
            placeholder="INV-001"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Invoice Status</label>
          <select
            value={project.invoice_status || 'not_invoiced'}
            onChange={(e) => onFieldChange('invoice_status', e.target.value)}
            className="w-full px-3 py-2 rounded bg-navy-900 border-white/10 text-white"
          >
            {['not_invoiced', 'draft', 'sent', 'partial', 'paid', 'overdue', 'void'].map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Invoice Amount</label>
          <Input
            type="number"
            value={project.invoice_amount || 0}
            onChange={(e) => onFieldChange('invoice_amount', parseFloat(e.target.value))}
            className="bg-navy-900 border-white/10 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">Payment Terms</label>
          <select
            value={project.payment_terms || 'due_on_completion'}
            onChange={(e) => onFieldChange('payment_terms', e.target.value)}
            className="w-full px-3 py-2 rounded bg-navy-900 border-white/10 text-white"
          >
            {['due_on_completion', 'net_15', 'net_30', 'net_60', '50_50_split', 'progress_billing', 'custom'].map((term) => (
              <option key={term} value={term}>
                {term.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Payment Progress */}
      <Card className="bg-navy-900 border-white/10 p-3">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Payment Progress</span>
          <span className="font-semibold text-white">${(project.amount_paid || 0).toLocaleString()} / ${(project.invoice_amount || 0).toLocaleString()}</span>
        </div>
        <div className="w-full bg-navy-800 rounded-full h-2 overflow-hidden">
          <div
            className={`${balanceDue > 0 ? 'bg-orange-500' : 'bg-green-500'} h-full rounded-full`}
            style={{ width: `${(project.amount_paid || 0) / (project.invoice_amount || 1) * 100}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-2">
          Balance Due: <span className={balanceDue > 0 ? 'text-orange-400' : 'text-green-400'}>${balanceDue.toLocaleString()}</span>
        </div>
      </Card>

      {/* Payments Log */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-white">Payments</h4>
          <Button
            onClick={() => onShowPaymentForm(!showPaymentForm)}
            className="bg-sky-500 hover:bg-sky-600 text-white text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Record
          </Button>
        </div>

        {showPaymentForm && (
          <Card className="bg-navy-900 border-white/10 p-3 mb-3 space-y-2">
            <Input
              placeholder="Amount"
              type="number"
              value={paymentForm.amount}
              onChange={(e) => onPaymentFormChange({ ...paymentForm, amount: e.target.value })}
              className="bg-navy-800 border-white/10 text-white text-sm"
            />
            <Input
              placeholder="Date"
              type="date"
              value={paymentForm.date}
              onChange={(e) => onPaymentFormChange({ ...paymentForm, date: e.target.value })}
              className="bg-navy-800 border-white/10 text-white text-sm"
            />
            <select
              value={paymentForm.method}
              onChange={(e) => onPaymentFormChange({ ...paymentForm, method: e.target.value })}
              className="w-full px-2 py-1 rounded bg-navy-800 border-white/10 text-white text-sm"
            >
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="card">Card</option>
              <option value="transfer">Transfer</option>
              <option value="financing">Financing</option>
            </select>
            <Input
              placeholder="Reference #"
              value={paymentForm.reference}
              onChange={(e) => onPaymentFormChange({ ...paymentForm, reference: e.target.value })}
              className="bg-navy-800 border-white/10 text-white text-sm"
            />
            <Textarea
              placeholder="Notes"
              value={paymentForm.notes}
              onChange={(e) => onPaymentFormChange({ ...paymentForm, notes: e.target.value })}
              className="bg-navy-800 border-white/10 text-white text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <Button onClick={onAddPayment} className="bg-green-600 hover:bg-green-700 text-white text-xs flex-1">
                Add Payment
              </Button>
              <Button
                onClick={() => onShowPaymentForm(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white text-xs flex-1"
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {payments.length > 0 ? (
          <div className="space-y-2">
            {payments.map((payment) => (
              <Card key={payment.id} className="bg-navy-900 border-white/10 p-3 flex justify-between items-start">
                <div>
                  <div className="font-semibold text-white">{payment.date} - {payment.method}</div>
                  {payment.reference && <div className="text-xs text-gray-400">Ref: {payment.reference}</div>}
                  {payment.notes && <div className="text-xs text-gray-400">{payment.notes}</div>}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-400">${payment.amount.toLocaleString()}</div>
                  <button
                    onClick={() => onRemovePayment(payment.id)}
                    className="text-red-400 hover:text-red-300 text-xs mt-2"
                  >
                    Remove
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No payments recorded</div>
        )}
      </div>
    </div>
  );
}

// Timeline Tab
function TimelineTab({ project, changeOrders, payments }) {
  const events = [];

  if (project.created_at) {
    events.push({
      date: new Date(project.created_at).toLocaleDateString(),
      title: 'Project Created',
      type: 'created',
    });
  }

  if (project.scheduled_start) {
    events.push({
      date: new Date(project.scheduled_start).toLocaleDateString(),
      title: 'Scheduled Start',
      type: 'scheduled',
    });
  }

  if (project.actual_start) {
    events.push({
      date: new Date(project.actual_start).toLocaleDateString(),
      title: 'Project Started',
      type: 'started',
    });
  }

  (changeOrders || []).forEach((co) => {
    if (co.created_at) {
      events.push({
        date: new Date(co.created_at).toLocaleDateString(),
        title: `Change Order: ${co.title}`,
        type: 'change_order',
        amount: co.amount,
      });
    }
  });

  (payments || []).forEach((payment) => {
    if (payment.date) {
      events.push({
        date: payment.date,
        title: `Payment Received`,
        type: 'payment',
        amount: payment.amount,
      });
    }
  });

  if (project.actual_end) {
    events.push({
      date: new Date(project.actual_end).toLocaleDateString(),
      title: 'Project Completed',
      type: 'completed',
    });
  }

  if (project.invoice_number) {
    events.push({
      date: project.created_at ? new Date(project.actual_end || project.created_at).toLocaleDateString() : '',
      title: 'Invoice Sent',
      type: 'invoiced',
    });
  }

  const sortedEvents = events.sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-4">
      {sortedEvents.length > 0 ? (
        <div className="relative">
          {sortedEvents.map((event, idx) => (
            <div key={idx} className="flex gap-4 mb-6">
              <div className="flex flex-col items-center">
                <div className={`w-4 h-4 rounded-full ${
                  event.type === 'completed' ? 'bg-green-500' :
                  event.type === 'payment' ? 'bg-green-400' :
                  event.type === 'change_order' ? 'bg-orange-400' :
                  'bg-sky-500'
                }`} />
                {idx < sortedEvents.length - 1 && (
                  <div className="w-0.5 h-12 bg-white/10 mt-4" />
                )}
              </div>
              <div className="flex-1 pt-0.5">
                <div className="font-semibold text-white">{event.title}</div>
                <div className="text-xs text-gray-400">{event.date}</div>
                {event.amount && (
                  <div className="text-sm font-semibold text-green-400 mt-1">
                    ${event.amount.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-400">No timeline events yet</div>
      )}
    </div>
  );
}
