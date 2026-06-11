import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  fetchInvoice, fetchPaymentsForInvoice, createPayment, voidInvoice, updateInvoice,
  fetchJournalEntriesForSource, fetchCustomerEmail, fetchInvoiceEmails,
  sendInvoiceEmail, buildInvoiceEmailHtml,
} from '../../lib/financeService';
import {
  ArrowLeft, FileText, CreditCard, Loader, ExternalLink, User, Briefcase, AlertCircle, Trash2, Send, BookOpen, Mail, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

const STATUS = {
  draft:    { label: 'Draft',    cls: 'bg-gray-700 text-gray-300' },
  sent:     { label: 'Sent',     cls: 'bg-blue-600/20 text-blue-300 border border-blue-500/30' },
  partial:  { label: 'Partial',  cls: 'bg-amber-600/20 text-amber-300 border border-amber-500/30' },
  overdue:  { label: 'Overdue',  cls: 'bg-red-600/20 text-red-300 border border-red-500/30' },
  paid:     { label: 'Paid',     cls: 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' },
  voided:   { label: 'Voided',   cls: 'bg-gray-800 text-gray-500 border border-gray-700' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status || 'Unknown', cls: 'bg-gray-700 text-gray-300' };
  return <Badge className={s.cls}>{s.label}</Badge>;
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  // Wave F2.7e: send-email state
  const [emailHistory, setEmailHistory] = useState([]);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: '', cc: '', subject: '', message: '' });
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'check', reference_number: '', memo: '' });
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [voidDialog, setVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [inv, pays, journalData, emails] = await Promise.all([
        fetchInvoice(id),
        fetchPaymentsForInvoice(id),
        fetchJournalEntriesForSource('invoice', id),
        fetchInvoiceEmails(id),
      ]);
      setInvoice(inv);
      setPayments(pays || []);
      setJournalEntries(journalData);
      setEmailHistory(emails);
      if (inv?.customer_id) {
        try { setCustomerProfile(await fetchCustomerEmail(inv.customer_id)); } catch { /* non-fatal */ }
      }
    } catch (e) {
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleRecordPayment() {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      setPaySubmitting(true);
      await createPayment({
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        customer_name: invoice.customer_name,
        amount: parseFloat(payForm.amount),
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: payForm.payment_method,
        reference_number: payForm.reference_number,
        notes: payForm.memo,
      });
      toast.success('Payment recorded');
      setPayOpen(false);
      setPayForm({ amount: '', payment_method: 'check', reference_number: '', memo: '' });
      load();
    } catch (e) {
      toast.error('Failed to record payment');
    } finally {
      setPaySubmitting(false);
    }
  }

  async function handleVoid() {
    try {
      await voidInvoice(invoice.id, voidReason);
      toast.success('Invoice voided');
      setVoidDialog(false);
      setVoidReason('');
      load();
    } catch (e) {
      toast.error('Failed to void invoice');
    }
  }

  async function handleMarkSent() {
    try {
      const updated = await updateInvoice(invoice.id, { status: 'sent' });
      setInvoice(updated);
      toast.success('Invoice marked as sent');
    } catch {
      toast.error('Failed to mark as sent');
    }
  }

  function openSendEmail() {
    const to = customerProfile?.email || '';
    const subject = `Invoice ${invoice.invoice_number} from Liftori${invoice.total_amount ? ` — ${fmt(invoice.total_amount)}` : ''}`;
    const message = `Here is invoice ${invoice.invoice_number} for your records. The balance due is ${fmt(invoice.balance_due)}. Please let me know if you have any questions.`;
    setEmailForm({ to, cc: '', subject, message });
    setEmailOpen(true);
  }

  async function handleSendEmail() {
    if (!emailForm.to.trim()) { toast.error('Recipient email is required'); return; }
    if (!emailForm.subject.trim()) { toast.error('Subject is required'); return; }
    try {
      setEmailSubmitting(true);
      const html = buildInvoiceEmailHtml(invoice, { message: emailForm.message });
      await sendInvoiceEmail(invoice, {
        to: emailForm.to.trim(),
        cc: emailForm.cc.trim() || undefined,
        subject: emailForm.subject.trim(),
        html,
      });
      toast.success('Invoice email sent');
      setEmailOpen(false);
      // Refresh both history and invoice (status may have flipped to sent)
      load();
    } catch (e) {
      toast.error('Failed to send: ' + (e?.message || 'unknown error'));
    } finally {
      setEmailSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="w-6 h-6 animate-spin text-brand-blue" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl text-white font-semibold">Invoice not found</h2>
        <Link to="/admin/finance/invoices" className="text-brand-blue hover:underline mt-3 inline-block">
          Back to invoices
        </Link>
      </div>
    );
  }

  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const isDraft = invoice.status === 'draft';
  const isOpen = !['paid', 'voided'].includes(invoice.status);

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Top bar: back link + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/admin/finance/invoices" className="text-brand-blue hover:underline text-sm inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> All invoices
        </Link>
        <div className="flex gap-2">
          {isOpen && (
            <Button
              onClick={() => { setPayForm({ amount: String(invoice.balance_due || ''), payment_method: 'check', reference_number: '', memo: '' }); setPayOpen(true); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CreditCard className="w-4 h-4 mr-2" /> Record Payment
            </Button>
          )}
          {isOpen && (
            <Button
              onClick={openSendEmail}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              <Mail className="w-4 h-4 mr-2" /> Send Email
            </Button>
          )}
          {isDraft && (
            <Button
              onClick={handleMarkSent}
              variant="outline"
              className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Sent
            </Button>
          )}
          {isDraft && (
            <Button
              variant="outline"
              onClick={() => setVoidDialog(true)}
              className="border-red-500/40 text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Void
            </Button>
          )}
        </div>
      </div>

      {/* Header card */}
      <Card className="bg-navy-800 border-navy-700 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <FileText className="w-5 h-5 text-brand-blue" />
              <h1 className="text-2xl font-bold text-white">{invoice.invoice_number || '—'}</h1>
              <StatusBadge status={invoice.status} />
            </div>
            <div className="text-sm text-gray-400">Created {fmtDate(invoice.invoice_date)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Balance Due</div>
            <div className={`text-3xl font-bold ${Number(invoice.balance_due || 0) > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
              {fmt(invoice.balance_due)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-navy-700">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1 flex items-center gap-1.5">
              <User className="w-3 h-3" /> Customer
            </div>
            {invoice.customer_id ? (
              <Link to={`/admin/customers/${invoice.customer_id}`} className="text-brand-blue hover:underline text-sm font-medium inline-flex items-center gap-1">
                {invoice.customer_name || 'Unknown'} <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <div className="text-sm text-gray-400">{invoice.customer_name || '—'}</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1 flex items-center gap-1.5">
              <Briefcase className="w-3 h-3" /> Project
            </div>
            {invoice.project_id ? (
              <Link to={`/admin/projects/${invoice.project_id}`} className="text-brand-blue hover:underline text-sm font-medium inline-flex items-center gap-1">
                {invoice.project_name || 'Project'} <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <div className="text-sm text-gray-400">{invoice.project_name || '—'}</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Invoice Date</div>
            <div className="text-sm text-white">{fmtDate(invoice.invoice_date)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Due Date</div>
            <div className="text-sm text-white">{fmtDate(invoice.due_date)}</div>
          </div>
        </div>
      </Card>

      {/* Line items + totals */}
      <Card className="bg-navy-800 border-navy-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Line Items</h2>
        {lineItems.length === 0 ? (
          <div className="text-sm text-gray-400 italic">No line items.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Unit Price</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li, i) => {
                  const qty = Number(li.quantity || 0);
                  const unit = Number(li.unit_price || 0);
                  const total = qty * unit;
                  return (
                    <tr key={i} className="border-b border-navy-700/40">
                      <td className="px-3 py-2 text-white">{li.description || '—'}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{qty}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{fmt(unit)}</td>
                      <td className="px-3 py-2 text-right text-white font-medium">{fmt(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 pt-5 border-t border-navy-700 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>{fmt(invoice.subtotal)}</span></div>
            {Number(invoice.tax_amount || 0) > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Tax {invoice.tax_rate ? `(${invoice.tax_rate}%)` : ''}</span>
                <span>{fmt(invoice.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-semibold pt-1.5 border-t border-navy-700">
              <span>Total</span><span>{fmt(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between text-emerald-300">
              <span>Paid</span><span>{fmt(invoice.amount_paid)}</span>
            </div>
            <div className={`flex justify-between font-semibold ${Number(invoice.balance_due || 0) > 0 ? 'text-amber-300' : 'text-gray-500'}`}>
              <span>Balance Due</span><span>{fmt(invoice.balance_due)}</span>
            </div>
          </div>
        </div>

        {(invoice.notes || invoice.terms) && (
          <div className="grid md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-navy-700">
            {invoice.notes && (
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Notes</div>
                <div className="text-sm text-gray-300 whitespace-pre-wrap">{invoice.notes}</div>
              </div>
            )}
            {invoice.terms && (
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Terms</div>
                <div className="text-sm text-gray-300 whitespace-pre-wrap">{invoice.terms}</div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Applied payments */}
      <Card className="bg-navy-800 border-navy-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-brand-blue" /> Applied Payments
          <span className="text-xs text-gray-500 font-normal">({payments.length})</span>
        </h2>
        {payments.length === 0 ? (
          <div className="text-sm text-gray-400 italic">No payments applied yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Method</th>
                  <th className="px-3 py-2 text-left font-semibold">Reference</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-navy-700/40">
                    <td className="px-3 py-2">
                      <Link to={`/admin/finance/payments/${p.id}`} className="text-brand-blue hover:underline">
                        {p.payment_number || '—'}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-300">{fmtDate(p.payment_date)}</td>
                    <td className="px-3 py-2 text-gray-300 capitalize">{p.payment_method || '—'}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs font-mono">{p.reference_number || '—'}</td>
                    <td className="px-3 py-2 text-right text-emerald-300 font-medium">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Record Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-gray-400 text-xs">Amount</Label>
              <Input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white" min="0" step="0.01" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Method</Label>
              <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 text-white rounded-md px-3 py-2 text-sm">
                <option value="check">Check</option>
                <option value="ach">ACH</option>
                <option value="wire">Wire</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Reference #</Label>
              <Input value={payForm.reference_number} onChange={e => setPayForm({ ...payForm, reference_number: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white" placeholder="Optional" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Memo</Label>
              <Textarea value={payForm.memo} onChange={e => setPayForm({ ...payForm, memo: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white" rows={2} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={paySubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {paySubmitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void dialog */}
      {/* Wave F2.7e: Email History */}
      <Card className="bg-navy-800 border-navy-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-cyan-400" />
            Email History
          </h2>
          <Link to="/admin/comms/outbound-log" className="text-xs text-brand-blue hover:underline">All outbound &rarr;</Link>
        </div>
        {emailHistory.length === 0 ? (
          <div className="text-sm text-gray-500 italic">No emails sent for this invoice yet.</div>
        ) : (
          <div className="divide-y divide-navy-700">
            {emailHistory.map(em => (
              <div key={em.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate">{em.recipient_email}</span>
                    <Badge className={em.status === 'sent' || em.status === 'delivered' ? 'bg-emerald-600/20 text-emerald-300' : em.status === 'failed' || em.status === 'bounced' ? 'bg-rose-600/20 text-rose-300' : 'bg-gray-700 text-gray-300'}>{em.status}</Badge>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{em.subject}</div>
                  {em.error_message && <div className="text-[10px] text-rose-400 mt-0.5 truncate">{em.error_message}</div>}
                </div>
                <div className="text-xs text-gray-500 shrink-0">{fmtDate(em.sent_at)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Wave F2.7: Linked Journal Entries */}
      <Card className="bg-navy-800 border-navy-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-blue" />
            Journal Entries
          </h2>
          <Link to="/admin/finance/journal" className="text-xs text-brand-blue hover:underline">All journal &rarr;</Link>
        </div>
        {journalEntries.length === 0 ? (
          <div className="text-sm text-gray-500 italic">No journal entries linked to this invoice yet.</div>
        ) : (
          <div className="divide-y divide-navy-700">
            {journalEntries.map(je => (
              <div key={je.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-brand-blue font-medium text-sm">{je.entry_number || '\u2014'}</span>
                    <span className="text-xs text-gray-500">{fmtDate(je.transaction_date)}</span>
                    <Badge className={je.status === 'posted' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-gray-700 text-gray-300'}>{je.status}</Badge>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{je.description}</div>
                </div>
                <div className="text-sm text-white font-medium">{fmt(je.total_debits)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Wave F2.7e: Send Email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-cyan-400" /> Send Invoice Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {!customerProfile?.email && invoice.customer_id && (
              <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
                No email on file for this customer. Enter one manually or update the customer record in CRM.
              </div>
            )}
            <div>
              <Label className="text-gray-300 text-xs">To *</Label>
              <Input value={emailForm.to} onChange={e => setEmailForm({ ...emailForm, to: e.target.value })}
                placeholder="customer@example.com"
                className="bg-navy-800 border-navy-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs">CC (optional)</Label>
              <Input value={emailForm.cc} onChange={e => setEmailForm({ ...emailForm, cc: e.target.value })}
                placeholder="cc@example.com"
                className="bg-navy-800 border-navy-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs">Subject *</Label>
              <Input value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs">Personal message (goes above the invoice details)</Label>
              <Textarea value={emailForm.message} onChange={e => setEmailForm({ ...emailForm, message: e.target.value })}
                rows={4}
                className="bg-navy-800 border-navy-700 text-white mt-1" />
            </div>
            <div className="text-[10px] text-gray-500 leading-tight pt-1">
              From: Liftori &lt;sales@liftori.ai&gt; &middot; Invoice details, line items, totals, and balance due are appended automatically to the email body. {isDraft && <span className="text-cyan-300">Sending will also mark this invoice as Sent.</span>}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEmailOpen(false)}
              className="border-navy-700 text-white hover:bg-navy-700">Cancel</Button>
            <Button onClick={handleSendEmail} disabled={emailSubmitting}
              className="bg-cyan-600 hover:bg-cyan-700 text-white">
              {emailSubmitting ? <><Loader className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : <><Send className="w-4 h-4 mr-2" /> Send Now</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voidDialog} onOpenChange={setVoidDialog}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Void Invoice</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-300">
              This will mark <span className="text-white font-mono">{invoice.invoice_number}</span> as voided.
              It will not be deleted but won't count toward AR.
            </p>
            <div>
              <Label className="text-gray-400 text-xs">Reason (optional)</Label>
              <Textarea value={voidReason} onChange={e => setVoidReason(e.target.value)}
                className="bg-navy-800 border-navy-700 text-white" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialog(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleVoid} className="bg-red-600 hover:bg-red-700 text-white">Void Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
