import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { fetchInvoices, createInvoice, updateInvoice, voidInvoice, deleteInvoice, createPayment } from '../../lib/financeService';
import {
  FileText, Plus, Search, Loader, Edit2, Trash2, CreditCard,
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle, X,
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

const STATUS = {
  draft: { label: 'Draft', cls: 'bg-gray-700 text-gray-300' },
  pending_approval: { label: 'Pending', cls: 'bg-yellow-500/20 text-yellow-400' },
  approved: { label: 'Approved', cls: 'bg-blue-500/20 text-blue-400' },
  posted: { label: 'Posted', cls: 'bg-indigo-500/20 text-indigo-400' },
  partial: { label: 'Partial', cls: 'bg-orange-500/20 text-orange-400' },
  paid: { label: 'Paid', cls: 'bg-green-500/20 text-green-400' },
  voided: { label: 'Voided', cls: 'bg-red-500/20 text-red-400' },
};

const EMPTY_FORM = {
  customer_name: '', project_name: '', invoice_date: new Date().toISOString().split('T')[0],
  due_date: '', description: '', memo: '', tax_rate: 0,
  line_items: [{ description: '', quantity: 1, unit_price: 0 }],
};

function calcTotals(lineItems, taxRate) {
  const subtotal = lineItems.reduce((s, li) => s + ((li.quantity || 0) * (li.unit_price || 0)), 0);
  const taxAmount = subtotal * ((taxRate || 0) / 100);
  return { subtotal, tax_amount: taxAmount, total_amount: subtotal + taxAmount };
}

export default function InvoicesList() {
  const [invoices, setInvoices] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [payInvoice, setPayInvoice] = useState(null);
  const [voidDialog, setVoidDialog] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'check', reference_number: '', memo: '' });
  const [submitting, setSubmitting] = useState(false);
  const PAGE = 25;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count: c } = await fetchInvoices({ status: statusFilter, search, limit: PAGE, offset: page * PAGE });
      setInvoices(data);
      setCount(c);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => { load(); }, [load]);

  function openEdit(inv) {
    setForm({
      customer_name: inv.customer_name || '',
      project_name: inv.project_name || '',
      invoice_date: inv.invoice_date || new Date().toISOString().split('T')[0],
      due_date: inv.due_date || '',
      description: inv.description || '',
      memo: inv.memo || '',
      tax_rate: inv.tax_rate || 0,
      line_items: inv.line_items?.length ? inv.line_items : [{ description: '', quantity: 1, unit_price: 0 }],
    });
    setEditInvoice(inv);
  }

  async function handleSave() {
    if (!form.customer_name) return toast.error('Customer name is required');
    try {
      setSubmitting(true);
      const totals = calcTotals(form.line_items, form.tax_rate);
      const payload = { ...form, ...totals, balance_due: totals.total_amount };
      if (editInvoice) {
        const updated = await updateInvoice(editInvoice.id, payload);
        setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i));
        toast.success('Invoice updated');
        setEditInvoice(null);
      } else {
        const created = await createInvoice(payload);
        setInvoices(prev => [created, ...prev]);
        setCount(c => c + 1);
        toast.success('Invoice created');
        setCreateOpen(false);
      }
      setForm(EMPTY_FORM);
    } catch {
      toast.error('Failed to save invoice');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayment() {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return toast.error('Enter a valid amount');
    try {
      setSubmitting(true);
      await createPayment({
        invoice_id: payInvoice.id,
        customer_name: payInvoice.customer_name,
        customer_id: payInvoice.customer_id,
        project_id: payInvoice.project_id,
        amount: parseFloat(payForm.amount),
        payment_method: payForm.payment_method,
        reference_number: payForm.reference_number,
        memo: payForm.memo,
        payment_date: new Date().toISOString().split('T')[0],
        status: 'posted',
      });
      toast.success('Payment recorded');
      setPayInvoice(null);
      setPayForm({ amount: '', payment_method: 'check', reference_number: '', memo: '' });
      load();
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVoid(inv) {
    try {
      await voidInvoice(inv.id, 'Voided by admin');
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'voided' } : i));
      toast.success('Invoice voided');
      setVoidDialog(null);
    } catch {
      toast.error('Failed to void invoice');
    }
  }

  async function handleDelete(id) {
    try {
      await deleteInvoice(id);
      setInvoices(prev => prev.filter(i => i.id !== id));
      setCount(c => c - 1);
      toast.success('Invoice deleted');
    } catch {
      toast.error('Failed to delete invoice');
    }
  }

  function updateLineItem(idx, field, value) {
    const items = [...form.line_items];
    items[idx] = { ...items[idx], [field]: field === 'description' ? value : parseFloat(value) || 0 };
    setForm({ ...form, line_items: items });
  }

  const invoiceForm = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-300 text-xs">Customer Name *</Label>
          <Input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="Customer name" />
        </div>
        <div>
          <Label className="text-gray-300 text-xs">Project</Label>
          <Input value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="Project name" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-300 text-xs">Invoice Date</Label>
          <Input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" />
        </div>
        <div>
          <Label className="text-gray-300 text-xs">Due Date</Label>
          <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
            className="bg-navy-800 border-navy-700 text-white mt-1" />
        </div>
      </div>

      <div>
        <Label className="text-gray-300 text-xs mb-2 block">Line Items</Label>
        <div className="space-y-2">
          {form.line_items.map((li, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Input value={li.description} onChange={e => updateLineItem(idx, 'description', e.target.value)}
                placeholder="Description" className="bg-navy-800 border-navy-700 text-white col-span-6 text-sm" />
              <Input type="number" value={li.quantity} onChange={e => updateLineItem(idx, 'quantity', e.target.value)}
                placeholder="Qty" className="bg-navy-800 border-navy-700 text-white col-span-2 text-sm" min="0" />
              <Input type="number" value={li.unit_price} onChange={e => updateLineItem(idx, 'unit_price', e.target.value)}
                placeholder="Price" className="bg-navy-800 border-navy-700 text-white col-span-3 text-sm" min="0" step="0.01" />
              <button onClick={() => setForm({ ...form, line_items: form.line_items.filter((_, i) => i !== idx) })}
                className="col-span-1 text-gray-500 hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setForm({ ...form, line_items: [...form.line_items, { description: '', quantity: 1, unit_price: 0 }] })}
          className="mt-2 border-navy-700 text-gray-400 hover:text-white text-xs">
          + Add Line
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-300 text-xs">Tax Rate (%)</Label>
          <Input type="number" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
            className="bg-navy-800 border-navy-700 text-white mt-1" min="0" max="100" step="0.1" />
        </div>
        <div className="flex flex-col justify-end">
          <div className="bg-navy-900 rounded p-3 text-sm">
            {(() => { const t = calcTotals(form.line_items, form.tax_rate); return (
              <>
                <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>{fmt(t.subtotal)}</span></div>
                <div className="flex justify-between text-gray-400"><span>Tax</span><span>{fmt(t.tax_amount)}</span></div>
                <div className="flex justify-between text-white font-bold mt-1"><span>Total</span><span>{fmt(t.total_amount)}</span></div>
              </>
            ); })()}
          </div>
        </div>
      </div>

      <div>
        <Label className="text-gray-300 text-xs">Memo</Label>
        <Textarea value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })}
          className="bg-navy-800 border-navy-700 text-white mt-1" rows={2} placeholder="Optional notes" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <Button onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}
            className="bg-brand-blue hover:bg-blue-600 text-white flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Invoice
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search invoices..." className="bg-navy-800 border-navy-700 text-white pl-9" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">
            <option value="all">All Status</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <Card className="bg-navy-800 border-navy-700">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="w-6 h-6 text-brand-blue animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-700">
                    {['Invoice #', 'Customer', 'Project', 'Date', 'Due', 'Total', 'Balance', 'Status', ''].map(h => (
                      <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const s = STATUS[inv.status] || STATUS.draft;
                    const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && !['paid', 'voided'].includes(inv.status);
                    return (
                      <tr key={inv.id} className="border-b border-navy-700/50 hover:bg-navy-750">
                        <td className="px-4 py-3 text-brand-blue font-medium">{inv.invoice_number || '—'}</td>
                        <td className="px-4 py-3 text-white">{inv.customer_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-400">{inv.project_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-400">{fmtDate(inv.invoice_date)}</td>
                        <td className={`px-4 py-3 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                          {fmtDate(inv.due_date)}
                          {isOverdue && <AlertCircle className="inline w-3 h-3 ml-1" />}
                        </td>
                        <td className="px-4 py-3 text-white">{fmt(inv.total_amount)}</td>
                        <td className="px-4 py-3 text-gray-300">{fmt(inv.balance_due)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {!['paid', 'voided'].includes(inv.status) && (
                              <button onClick={() => { setPayInvoice(inv); setPayForm({ amount: String(inv.balance_due || ''), payment_method: 'check', reference_number: '', memo: '' }); }}
                                className="p-1.5 hover:bg-navy-700 rounded text-gray-400 hover:text-green-400" title="Record Payment">
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {inv.status === 'draft' && (
                              <button onClick={() => openEdit(inv)} className="p-1.5 hover:bg-navy-700 rounded text-gray-400 hover:text-white">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {inv.status === 'draft' && (
                              <button onClick={() => setVoidDialog(inv)} className="p-1.5 hover:bg-navy-700 rounded text-gray-400 hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
              <span className="text-sm text-gray-400 px-2 py-1">Page {page + 1} of {Math.ceil(count / PAGE)}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE >= count}
                className="border-navy-700 text-gray-400 hover:text-white">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
          {invoiceForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-brand-blue hover:bg-blue-600 text-white">
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editInvoice} onOpenChange={() => setEditInvoice(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Invoice</DialogTitle></DialogHeader>
          {invoiceForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInvoice(null)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-brand-blue hover:bg-blue-600 text-white">
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={!!payInvoice} onOpenChange={() => setPayInvoice(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader>
            <DialogTitle>Record Payment — {payInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-navy-800 rounded text-sm">
              <div className="flex justify-between text-gray-400"><span>Invoice Total</span><span>{fmt(payInvoice?.total_amount)}</span></div>
              <div className="flex justify-between text-gray-400"><span>Amount Paid</span><span>{fmt(payInvoice?.amount_paid)}</span></div>
              <div className="flex justify-between text-white font-semibold mt-1 border-t border-navy-700 pt-1">
                <span>Balance Due</span><span>{fmt(payInvoice?.balance_due)}</span>
              </div>
            </div>
            <div>
              <Label className="text-gray-300 text-xs">Payment Amount *</Label>
              <Input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white mt-1" min="0" step="0.01" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-xs">Method</Label>
                <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                  className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm mt-1">
                  {['check', 'ach', 'wire', 'credit_card', 'cash', 'stripe', 'other'].map(m => (
                    <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-gray-300 text-xs">Reference #</Label>
                <Input value={payForm.reference_number} onChange={e => setPayForm({ ...payForm, reference_number: e.target.value })}
                  className="bg-navy-800 border-navy-700 text-white mt-1" placeholder="Check # / Ref" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayInvoice(null)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handlePayment} disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white">
              {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Confirm */}
      <Dialog open={!!voidDialog} onOpenChange={() => setVoidDialog(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Delete Invoice</DialogTitle></DialogHeader>
          <p className="text-gray-400 text-sm">Delete invoice <strong className="text-white">{voidDialog?.invoice_number}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialog(null)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={() => handleDelete(voidDialog?.id)} className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
