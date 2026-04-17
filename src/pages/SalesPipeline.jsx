/**
 * SalesPipeline — Liftori's own sales pipeline at /admin/pipeline.
 *
 * Three products with per-product stages:
 *   LABOS        — SaaS subscription (MRR-heavy)
 *   Consulting   — Business consulting (hybrid MRR + one-time)
 *   Custom Build — Project builds (one-time, milestone-based)
 *
 * UI:
 *   - Product tabs at top (All / LABOS / Consulting / Custom Builds)
 *   - Summary stats row (open count, weighted pipeline, won revenue, win rate)
 *   - Kanban view by stage (per-product; "All" stacks three kanban rails)
 *   - Click-to-advance or dropdown-move (no drag/drop in v1)
 *   - Add / edit lead dialog with product-aware fields
 *
 * Not to be confused with customer/CustomerPipeline.jsx which powers multi-
 * tenant LABOS customers' own sales orgs.
 */
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import {
  PRODUCTS,
  PRODUCT_KEYS,
  SOURCES,
  STAGES,
  stagesFor,
  stageMetaFor,
  isClosedStage,
  listLeads,
  createLead,
  updateLead,
  deleteLead,
  moveLeadStage,
  weightedValueCents,
  formatMoney,
  summarize,
} from '../lib/salesLeadsService'
import { fetchUsers } from '../lib/chatService'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { Plus, Trash2, Edit2, ChevronRight, DollarSign, Clock, User } from 'lucide-react'
import { toast } from 'sonner'

const STAGE_COLOR_CLASSES = {
  slate:   'bg-slate-700/40 text-slate-300 border-slate-600',
  blue:    'bg-blue-900/40 text-blue-300 border-blue-700',
  indigo:  'bg-indigo-900/40 text-indigo-300 border-indigo-700',
  amber:   'bg-amber-900/40 text-amber-300 border-amber-700',
  emerald: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
  rose:    'bg-rose-900/40 text-rose-300 border-rose-700',
}

const PRODUCT_PILL_CLASSES = {
  sky:    'bg-sky-500/15 text-sky-400 border-sky-500/30',
  amber:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
}

function centsToDollars(cents) {
  return cents ? String((cents / 100).toFixed(0)) : ''
}

export default function SalesPipeline() {
  const { user } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeProduct, setActiveProduct] = useState('all') // all | labos | consulting | custom_build
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const rows = await listLeads()
      setLeads(rows)
    } catch (e) {
      toast.error('Failed to load pipeline: ' + (e.message || 'unknown'))
    } finally {
      setLoading(false)
    }
  }

  // Team roster for the "Assigned to" picker — loaded lazily the first time
  // the add-lead dialog opens.
  useEffect(() => {
    if (!dialogOpen || teamMembers.length > 0) return
    fetchUsers()
      .then(({ users }) => setTeamMembers(users || []))
      .catch((e) => console.error('fetchUsers for pipeline dialog', e))
  }, [dialogOpen, teamMembers.length])

  const filteredLeads = useMemo(() => {
    if (activeProduct === 'all') return leads
    return leads.filter((l) => l.product_type === activeProduct)
  }, [leads, activeProduct])

  const stats = useMemo(() => summarize(filteredLeads), [filteredLeads])

  const openNew = (productType = null) => {
    setEditingLead({
      product_type: productType || (activeProduct !== 'all' ? activeProduct : 'custom_build'),
      stage: '',
      title: '',
      company_name: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      deal_value: '',
      mrr: '',
      probability: 50,
      expected_close_date: '',
      source: 'inbound',
      assigned_to: '',
      next_action: '',
      next_action_date: '',
      description: '',
      notes: '',
    })
    setDialogOpen(true)
  }

  const openEdit = (lead) => {
    setEditingLead({
      ...lead,
      deal_value: centsToDollars(lead.deal_value_cents),
      mrr: centsToDollars(lead.mrr_cents),
      assigned_to: lead.assigned_to || '',
      source: lead.source || 'inbound',
      expected_close_date: lead.expected_close_date || '',
      next_action_date: lead.next_action_date || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      if (!editingLead.title?.trim()) { toast.error('Title is required'); return }
      if (!editingLead.product_type) { toast.error('Product is required'); return }
      if (editingLead.id) {
        await updateLead(editingLead.id, editingLead)
        toast.success('Lead updated')
      } else {
        await createLead(editingLead, user?.id)
        toast.success('Lead created')
      }
      setDialogOpen(false)
      setEditingLead(null)
      load()
    } catch (e) {
      toast.error('Save failed: ' + (e.message || 'unknown'))
    }
  }

  const handleDelete = async () => {
    if (!editingLead?.id) return
    if (!window.confirm('Delete this lead? This cannot be undone.')) return
    try {
      await deleteLead(editingLead.id)
      toast.success('Lead deleted')
      setDialogOpen(false)
      setEditingLead(null)
      load()
    } catch (e) {
      toast.error('Delete failed: ' + (e.message || 'unknown'))
    }
  }

  const handleMove = async (lead, newStage) => {
    try {
      await moveLeadStage(lead.id, newStage)
      setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage: newStage } : l))
      toast.success(`Moved to ${stageMetaFor(lead.product_type, newStage).label}`)
    } catch (e) {
      toast.error('Move failed: ' + (e.message || 'unknown'))
    }
  }

  const productsToShow = activeProduct === 'all' ? PRODUCT_KEYS : [activeProduct]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sales Pipeline</h1>
          <p className="text-sm text-gray-400 mt-1">
            Track deals across LABOS, Consulting, and Custom Builds
          </p>
        </div>
        <Button
          onClick={() => openNew()}
          className="bg-sky-500 hover:bg-sky-600 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Lead
        </Button>
      </div>

      {/* Product tabs */}
      <div className="flex items-center gap-2 flex-wrap border-b border-navy-700/50 pb-0 -mb-px">
        {['all', ...PRODUCT_KEYS].map((key) => {
          const isActive = activeProduct === key
          const product = PRODUCTS[key]
          const label = key === 'all' ? 'All Products' : product?.label
          const count = key === 'all' ? leads.length : leads.filter((l) => l.product_type === key).length
          return (
            <button
              key={key}
              onClick={() => setActiveProduct(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${isActive ? 'bg-sky-500/20' : 'bg-navy-800'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Open Deals" value={stats.openCount} sublabel={`${stats.total} total`} />
        <StatCard label="Open Pipeline" value={formatMoney(stats.openPipelineCents)} sublabel={`Annualized`} />
        <StatCard label="Weighted" value={formatMoney(stats.openWeightedCents)} sublabel={`× probability`} />
        <StatCard label="Win Rate" value={`${stats.winRate}%`} sublabel={`${stats.wonCount}W / ${stats.lostCount}L`} />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-gray-400">Loading pipeline…</div>
      )}

      {/* Kanban(s) */}
      {!loading && productsToShow.map((productKey) => {
        const product = PRODUCTS[productKey]
        const productLeads = filteredLeads.filter((l) => l.product_type === productKey)
        const stages = stagesFor(productKey)
        return (
          <div key={productKey} className="space-y-2">
            {activeProduct === 'all' && (
              <div className="flex items-center gap-3 pt-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded border text-xs font-semibold ${PRODUCT_PILL_CLASSES[product.color]}`}>
                  {product.label}
                </span>
                <span className="text-xs text-gray-500">{product.description}</span>
                <button
                  onClick={() => openNew(productKey)}
                  className="text-xs text-sky-400 hover:text-sky-300 ml-auto"
                >
                  + Add {product.label} lead
                </button>
              </div>
            )}
            <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3 overflow-x-auto pb-2">
              {stages.map((stage) => {
                const stageLeads = productLeads.filter((l) => l.stage === stage.key)
                const colorClasses = STAGE_COLOR_CLASSES[stage.color] || STAGE_COLOR_CLASSES.slate
                return (
                  <div key={stage.key} className="bg-navy-900/40 rounded-lg border border-navy-700/50 flex flex-col min-h-[200px]">
                    <div className={`px-3 py-2 border-b border-navy-700/50 flex items-center justify-between ${colorClasses} rounded-t-lg`}>
                      <span className="text-xs font-semibold uppercase tracking-wide">{stage.label}</span>
                      <span className="text-xs opacity-70">{stageLeads.length}</span>
                    </div>
                    <div className="p-2 space-y-2 flex-1">
                      {stageLeads.length === 0 && (
                        <div className="text-[11px] text-gray-600 text-center py-4">No deals</div>
                      )}
                      {stageLeads.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          stages={stages}
                          onEdit={() => openEdit(lead)}
                          onMove={(newStage) => handleMove(lead, newStage)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Add/Edit dialog */}
      {dialogOpen && editingLead && (
        <LeadDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditingLead(null) }}
          lead={editingLead}
          onChange={(patch) => setEditingLead((l) => ({ ...l, ...patch }))}
          onSave={handleSave}
          onDelete={editingLead.id ? handleDelete : null}
          teamMembers={teamMembers}
        />
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────

function StatCard({ label, value, sublabel }) {
  return (
    <div className="bg-navy-800/60 border border-navy-700/50 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
      {sublabel && <div className="text-[11px] text-gray-500 mt-0.5">{sublabel}</div>}
    </div>
  )
}

function LeadCard({ lead, stages, onEdit, onMove }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const meta = stageMetaFor(lead.product_type, lead.stage)
  const product = PRODUCTS[lead.product_type]
  const value = weightedValueCents(lead)

  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-md p-2.5 hover:border-navy-600 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={onEdit}
          className="text-left text-sm font-medium text-white hover:text-sky-300 transition-colors line-clamp-2"
        >
          {lead.title}
        </button>
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-sky-400 flex-shrink-0"
          title="Edit"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {lead.company_name && (
        <div className="text-xs text-gray-400 mt-0.5 truncate">{lead.company_name}</div>
      )}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {(lead.deal_value_cents > 0 || lead.mrr_cents > 0) && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            <DollarSign className="w-3 h-3" />
            {formatMoney(lead.deal_value_cents)}
            {lead.mrr_cents > 0 && <span className="opacity-70">+{formatMoney(lead.mrr_cents)}/mo</span>}
          </span>
        )}
        {!isClosedStage(lead.stage) && lead.probability != null && (
          <span className="text-[11px] text-gray-400">{lead.probability}%</span>
        )}
        {lead.expected_close_date && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500">
            <Clock className="w-3 h-3" />
            {new Date(lead.expected_close_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      {lead.assignee && (
        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-gray-500">
          <User className="w-3 h-3" />
          <span className="truncate">{lead.assignee.full_name || lead.assignee.email}</span>
        </div>
      )}

      {/* Move menu */}
      <div className="relative mt-2 pt-2 border-t border-navy-700/30">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center justify-between text-[11px] text-gray-500 hover:text-sky-400 transition-colors"
        >
          Move stage…
          <ChevronRight className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-90' : ''}`} />
        </button>
        {menuOpen && (
          <div className="mt-1 space-y-0.5">
            {stages.filter((s) => s.key !== lead.stage).map((s) => (
              <button
                key={s.key}
                onClick={() => { setMenuOpen(false); onMove(s.key) }}
                className="w-full text-left px-2 py-1 text-[11px] text-gray-300 hover:bg-navy-700/50 rounded transition-colors"
              >
                → {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LeadDialog({ open, onClose, lead, onChange, onSave, onDelete, teamMembers }) {
  const product = PRODUCTS[lead.product_type]
  const stages = stagesFor(lead.product_type)
  const isEdit = !!lead.id

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-navy-900 border-navy-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{isEdit ? 'Edit Lead' : 'New Lead'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Product + stage */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Product">
              <select
                value={lead.product_type}
                onChange={(e) => onChange({ product_type: e.target.value, stage: stagesFor(e.target.value)[0]?.key })}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {PRODUCT_KEYS.map((k) => (
                  <option key={k} value={k}>{PRODUCTS[k].label}</option>
                ))}
              </select>
            </Field>
            <Field label="Stage">
              <select
                value={lead.stage || stages[0]?.key || ''}
                onChange={(e) => onChange({ stage: e.target.value })}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {stages.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Title */}
          <Field label="Deal Title *">
            <Input
              value={lead.title || ''}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="e.g. Acme Corp — Custom e-commerce build"
              className="bg-navy-800 border-navy-700 text-white"
            />
          </Field>

          {/* Company + contact */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company">
              <Input
                value={lead.company_name || ''}
                onChange={(e) => onChange({ company_name: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white"
              />
            </Field>
            <Field label="Contact Name">
              <Input
                value={lead.contact_name || ''}
                onChange={(e) => onChange({ contact_name: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact Email">
              <Input
                type="email"
                value={lead.contact_email || ''}
                onChange={(e) => onChange({ contact_email: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white"
              />
            </Field>
            <Field label="Contact Phone">
              <Input
                value={lead.contact_phone || ''}
                onChange={(e) => onChange({ contact_phone: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white"
              />
            </Field>
          </div>

          {/* Commercial */}
          <div className="grid grid-cols-2 gap-3">
            {product?.hasOneTime && (
              <Field label="Deal Value ($)">
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={lead.deal_value || ''}
                  onChange={(e) => onChange({ deal_value: e.target.value })}
                  placeholder="0"
                  className="bg-navy-800 border-navy-700 text-white"
                />
              </Field>
            )}
            {product?.hasMRR && (
              <Field label="MRR ($/mo)">
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={lead.mrr || ''}
                  onChange={(e) => onChange({ mrr: e.target.value })}
                  placeholder="0"
                  className="bg-navy-800 border-navy-700 text-white"
                />
              </Field>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Probability (%)">
              <Input
                type="number"
                min="0"
                max="100"
                step="5"
                value={lead.probability ?? 50}
                onChange={(e) => onChange({ probability: Number(e.target.value) })}
                className="bg-navy-800 border-navy-700 text-white"
              />
            </Field>
            <Field label="Expected Close">
              <Input
                type="date"
                value={lead.expected_close_date || ''}
                onChange={(e) => onChange({ expected_close_date: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white"
              />
            </Field>
          </div>

          {/* Assignment + source */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assigned To">
              <select
                value={lead.assigned_to || ''}
                onChange={(e) => onChange({ assigned_to: e.target.value || null })}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">— Unassigned —</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select
                value={lead.source || 'inbound'}
                onChange={(e) => onChange({ source: e.target.value })}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Next action */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Next Action">
              <Input
                value={lead.next_action || ''}
                onChange={(e) => onChange({ next_action: e.target.value })}
                placeholder="e.g. Follow up on quote"
                className="bg-navy-800 border-navy-700 text-white"
              />
            </Field>
            <Field label="Next Action Date">
              <Input
                type="date"
                value={lead.next_action_date || ''}
                onChange={(e) => onChange({ next_action_date: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white"
              />
            </Field>
          </div>

          {/* Notes */}
          <Field label="Notes">
            <Textarea
              rows={3}
              value={lead.notes || ''}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Context, meeting notes, objections, etc."
              className="bg-navy-800 border-navy-700 text-white"
            />
          </Field>

          {lead.stage === 'lost' && (
            <Field label="Lost Reason">
              <Input
                value={lead.lost_reason || ''}
                onChange={(e) => onChange({ lost_reason: e.target.value })}
                placeholder="Budget / Competitor / Timing / ..."
                className="bg-navy-800 border-navy-700 text-white"
              />
            </Field>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            {onDelete && (
              <Button
                variant="outline"
                onClick={onDelete}
                className="text-rose-400 border-rose-900 hover:bg-rose-900/30"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="border-navy-700 text-gray-300 hover:bg-navy-800">
              Cancel
            </Button>
            <Button onClick={onSave} className="bg-sky-500 hover:bg-sky-600 text-white">
              {isEdit ? 'Save Changes' : 'Create Lead'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}
