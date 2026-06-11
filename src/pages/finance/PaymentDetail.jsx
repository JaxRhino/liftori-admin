import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { fetchPayment, fetchInvoice, deletePayment } from '../../lib/financeService';
import {
  ArrowLeft, CreditCard, Loader, ExternalLink, User, FileText,
  AlertCircle, Trash2, Hash,
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

const STATUS = {
  pending:   { label: 'Pending',   cls: 'bg-amber-600/20 text-amber-300 border border-amber-500/30' },
  completed: { label: 'Completed', cls: 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' },
  cleared:   { label: 'Cleared',   cls: 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' },
  bounced:   { label: 'Bounced',   cls: 'bg-red-600/20 text-red-300 border border-red-500/30' },
  voided:    { label: 'Voided',    cls: 'bg-gray-800 text-gray-500 border border-gray-700' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status || 'Recorded', cls: 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' };
  return <Badge className={s.cls}>{s.label}</Badge>;
}

export default function PaymentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const pmt = await fetchPayment(id);
      setPayment(pmt);
      if (pmt?.invoice_id) {
        try {
          const inv = await fetchInvoice(pmt.invoice_id);
          setInvoice(inv);
        } catch {
          setInvoice(null);
        }
      } else {
        setInvoice(null);
      }
    } catch (e) {
      toast.error('Failed to load payment');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    try {
      await deletePayment(payment.id);
      toast.success('Payment deleted');
      setDeleteOpen(false);
      navigate(invoice ? `/admin/finance/invoices/${invoice.id}` : '/admin/finance/payments');
    } catch {
      toast.error('Failed to delete payment');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="w-6 h-6 animate-spin text-brand-blue" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl text-white font-semibold">Payment not found</h2>
        <Link to="/admin/finance/payments" className="text-brand-blue hover:underline mt-3 inline-block">
          Back to payments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Top bar: back link + delete */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/admin/finance/payments" className="text-brand-blue hover:underline text-sm inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> All payments
        </Link>
        <Button
          variant="outline"
          onClick={() => setDeleteOpen(true)}
          className="border-red-500/40 text-red-300 hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4 mr-2" /> Delete
        </Button>
      </div>

      {/* Header card */}
      <Card className="bg-navy-800 border-navy-700 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <CreditCard className="w-5 h-5 text-brand-blue" />
              <h1 className="text-2xl font-bold text-white">{payment.payment_number || '—'}</h1>
              <StatusBadge status={payment.status} />
            </div>
            <div className="text-sm text-gray-400">Recorded {fmtDate(payment.payment_date)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Amount</div>
            <div className="text-3xl font-bold text-emerald-300">{fmt(payment.amount)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-navy-700">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1 flex items-center gap-1.5">
              <User className="w-3 h-3" /> Customer
            </div>
            {payment.customer_id ? (
              <Link to={`/admin/customers/${payment.customer_id}`} className="text-brand-blue hover:underline text-sm font-medium inline-flex items-center gap-1">
                {payment.customer_name || 'Unknown'} <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <div className="text-sm text-gray-400">{payment.customer_name || '—'}</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Method</div>
            <div className="text-sm text-white capitalize">{payment.payment_method || '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1 flex items-center gap-1.5">
              <Hash className="w-3 h-3" /> Reference
            </div>
            <div className="text-sm text-gray-300 font-mono">{payment.reference_number || '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Payment Date</div>
            <div className="text-sm text-white">{fmtDate(payment.payment_date)}</div>
          </div>
        </div>
      </Card>

      {/* Applied to invoice — the link-loop close */}
      <Card className="bg-navy-800 border-navy-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-blue" /> Applied To
        </h2>
        {payment.invoice_id && invoice ? (
          <Link
            to={`/admin/finance/invoices/${invoice.id}`}
            className="block rounded-lg border border-navy-700 hover:border-brand-blue/50 bg-navy-900/50 hover:bg-navy-900 p-4 transition-colors group"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white group-hover:text-brand-blue transition-colors">
                    {invoice.invoice_number || 'Invoice'}
                  </h3>
                  <StatusBadge status={invoice.status} />
                  <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-brand-blue transition-colors" />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {invoice.customer_name || '—'}
                  {invoice.project_name ? ` · ${invoice.project_name}` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Invoice Total</div>
                <div className="text-lg font-bold text-white">{fmt(invoice.total_amount)}</div>
                {Number(invoice.balance_due || 0) > 0 ? (
                  <div className="text-xs text-amber-300">Balance {fmt(invoice.balance_due)}</div>
                ) : (
                  <div className="text-xs text-emerald-300">Fully paid</div>
                )}
              </div>
            </div>
          </Link>
        ) : payment.invoice_id ? (
          <div className="text-sm text-gray-400 italic">
            Linked to invoice <span className="font-mono text-xs text-gray-500">{payment.invoice_id}</span> (not loaded — may have been deleted).
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic">No invoice applied — this payment was recorded standalone.</div>
        )}
      </Card>

      {/* Notes */}
      {payment.notes && (
        <Card className="bg-navy-800 border-navy-700 p-6">
          <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Notes</div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap">{payment.notes}</div>
        </Card>
      )}

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Payment</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-300">
              Delete payment <span className="text-white font-mono">{payment.payment_number}</span> for {fmt(payment.amount)}?
            </p>
            {invoice && (
              <p className="text-xs text-amber-300">
                Note: this is applied to invoice {invoice.invoice_number}. Deleting will not automatically adjust that invoice's amount_paid / balance_due.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
