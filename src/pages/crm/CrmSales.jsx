import { useEffect, useMemo, useState } from 'react'
import { HubPage, StatCard, Section, EmptyState, useCrmClient } from './_shared'
import CustomerPhotos from '../../components/crm/CustomerPhotos'
import { themeOptions } from '../../lib/estimateThemes'

// ---------- formatters ----------
const fmtCents = (c) =>
  ((Number(c) || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const daysSince = (d) => {
  if (!d) return '-'
  const ms = Date.now() - new Date(d).getTime()
  const days = Math.floor(ms / 86400000)
  return days <= 0 ? 'today' : `${days}d`
}

// ---------- local primitives ----------
function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`bg-navy-800 border border-navy-700/60 rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40">{footer}</div>}
      </div>
    </div>
  )
}

function Drawer({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/50" />
      <div
        className="w-full sm:w-[480px] bg-navy-800 border-l border-navy-700/50 h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between sticky top-0 bg-navy-800 z-10">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-navy-700/50 bg-navy-900/40 sticky bottom-0">{footer}</div>}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder, rows }) {
  const base = 'w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan'
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      {rows ? (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={base} />
      ) : (
        <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </label>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan"
      >
        <option value="">-</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition ${
        active
          ? 'bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan'
          : 'bg-navy-900/40 border-navy-700/60 text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function TabBtn({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
        active
          ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/40'
          : 'text-gray-400 hover:text-white border border-transparent'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy-700/60">{count}</span>
      )}
    </button>
  )
}

function TempBadge({ temp }) {
  const map = { hot: 'bg-red-500/20 text-red-300', warm: 'bg-amber-500/20 text-amber-300', cold: 'bg-sky-500/20 text-sky-300' }
  if (!temp) return null
  return <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${map[temp] || 'bg-navy-700/60 text-gray-300'}`}>{temp}</span>
}

// ---------- stage definitions ----------
const PIPELINE_STAGES = [
  { key: 'new', label: 'New' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
]

const LEAD_STAGES = ['new', 'contacted', 'qualified', 'nurturing', 'converted', 'lost']
const ESTIMATE_STATUSES = ['draft', 'sent', 'approved', 'declined', 'expired']
const AGREEMENT_STATUSES = ['draft', 'sent', 'signed', 'active', 'completed', 'cancelled']
const CONTACT_TYPES = ['lead', 'customer', 'past_customer']

// ===========================================================================
//                                MAIN PAGE
// ===========================================================================
export default function CrmSales() {
  const { client, platform } = useCrmClient()
  const [tab, setTab] = useState('pipeline')

  // ---- data state ----
  const [pipeline, setPipeline] = useState([])
  const [leads, setLeads] = useState([])
  const [contacts, setContacts] = useState([])
  const [estimates, setEstimates] = useState([])
  const [agreements, setAgreements] = useState([])

  // ---- loading state per tab ----
  const [loadingPipeline, setLoadingPipeline] = useState(true)
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [loadingEstimates, setLoadingEstimates] = useState(true)
  const [loadingAgreements, setLoadingAgreements] = useState(true)

  // ---- modal/drawer state ----
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [newContactOpen, setNewContactOpen] = useState(false)
  const [newEstimateOpen, setNewEstimateOpen] = useState(false)
  const [newAgreementOpen, setNewAgreementOpen] = useState(false)

  const [dealDrawer, setDealDrawer] = useState(null)
  const [leadDrawer, setLeadDrawer] = useState(null)
  const [contactDrawer, setContactDrawer] = useState(null)
  const [estimateDrawer, setEstimateDrawer] = useState(null)
  const [agreementDrawer, setAgreementDrawer] = useState(null)

  // ---- loaders ----
  async function loadPipeline() {
    if (!client) return
    setLoadingPipeline(true)
    try {
      const { data, error } = await client
        .from('customer_pipeline')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setPipeline(data || [])
    } catch (e) {
      console.error('[CrmSales] loadPipeline', e)
    } finally {
      setLoadingPipeline(false)
    }
  }

  async function loadLeads() {
    if (!client) return
    setLoadingLeads(true)
    try {
      const { data, error } = await client
        .from('sales_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setLeads(data || [])
    } catch (e) {
      console.error('[CrmSales] loadLeads', e)
    } finally {
      setLoadingLeads(false)
    }
  }

  async function loadContacts() {
    if (!client) return
    setLoadingContacts(true)
    try {
      const { data, error } = await client
        .from('customer_contacts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setContacts(data || [])
    } catch (e) {
      console.error('[CrmSales] loadContacts', e)
    } finally {
      setLoadingContacts(false)
    }
  }

  async function loadEstimates() {
    if (!client) return
    setLoadingEstimates(true)
    try {
      const { data, error } = await client
        .from('customer_estimates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setEstimates(data || [])
    } catch (e) {
      console.error('[CrmSales] loadEstimates', e)
    } finally {
      setLoadingEstimates(false)
    }
  }

  async function loadAgreements() {
    if (!client) return
    setLoadingAgreements(true)
    try {
      const { data, error } = await client
        .from('customer_agreements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setAgreements(data || [])
    } catch (e) {
      console.error('[CrmSales] loadAgreements', e)
    } finally {
      setLoadingAgreements(false)
    }
  }

  useEffect(() => {
    if (!client) return
    loadPipeline()
    loadLeads()
    loadContacts()
    loadEstimates()
    loadAgreements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  // ---- contact lookup helper ----
  const contactById = useMemo(() => {
    const m = new Map()
    for (const c of contacts) m.set(c.id, c)
    return m
  }, [contacts])

  function contactName(id) {
    const c = contactById.get(id)
    if (!c) return '-'
    return `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || '-'
  }

  // ---- computed stats ----
  const stats = useMemo(() => {
    const pipelineValue = pipeline
      .filter((d) => !['won', 'lost'].includes(d.stage))
      .reduce((s, d) => s + Number(d.deal_value || 0), 0)
    const openLeads = leads.filter((l) => !['converted', 'lost'].includes(l.stage)).length
    const estimatesPending = estimates.filter(
      (e) => ['sent', 'draft'].includes(e.status) && e.esign_status !== 'signed'
    ).length
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const mtdWon = pipeline
      .filter((d) => d.stage === 'won' && d.won_date && new Date(d.won_date) >= monthStart)
      .reduce((s, d) => s + Number(d.deal_value || 0), 0)
    return { pipelineValue, openLeads, estimatesPending, mtdWon }
  }, [pipeline, leads, estimates])

  // ===========================================================================
  //                              RENDER
  // ===========================================================================
  return (
    <HubPage
      title="Sales"
      subtitle={`Run your pipeline, qualify leads, and close work${platform?.clientName ? ` for ${platform.clientName}` : ''}`}
    >
      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Pipeline Value" value={fmtMoney(stats.pipelineValue)} accent="text-brand-cyan" />
        <StatCard label="Open Leads" value={stats.openLeads} accent="text-brand-blue" />
        <StatCard label="Estimates Pending" value={stats.estimatesPending} accent="text-amber-400" />
        <StatCard label="MTD Won" value={fmtMoney(stats.mtdWon)} accent="text-emerald-400" />
      </div>

      {/* tabs - dropdown on mobile, buttons on desktop */}
      <div className="mb-5">
        <div className="md:hidden">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="pipeline">Pipeline</option>
            <option value="leads">Leads</option>
            <option value="contacts">Contacts</option>
            <option value="estimates">Estimates</option>
            <option value="agreements">Agreements</option>
          </select>
        </div>
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          <TabBtn active={tab === 'pipeline'} onClick={() => setTab('pipeline')} count={pipeline.length}>Pipeline</TabBtn>
          <TabBtn active={tab === 'leads'} onClick={() => setTab('leads')} count={leads.length}>Leads</TabBtn>
          <TabBtn active={tab === 'contacts'} onClick={() => setTab('contacts')} count={contacts.length}>Contacts</TabBtn>
          <TabBtn active={tab === 'estimates'} onClick={() => setTab('estimates')} count={estimates.length}>Estimates</TabBtn>
          <TabBtn active={tab === 'agreements'} onClick={() => setTab('agreements')} count={agreements.length}>Agreements</TabBtn>
        </div>
      </div>

      {tab === 'pipeline' && (
        <PipelineTab
          client={client}
          pipeline={pipeline}
          loading={loadingPipeline}
          onOpenNew={() => setNewDealOpen(true)}
          onCard={(d) => setDealDrawer(d)}
        />
      )}

      {tab === 'leads' && (
        <LeadsTab
          leads={leads}
          loading={loadingLeads}
          onOpenNew={() => setNewLeadOpen(true)}
          onRow={(l) => setLeadDrawer(l)}
        />
      )}

      {tab === 'contacts' && (
        <ContactsTab
          contacts={contacts}
          loading={loadingContacts}
          onOpenNew={() => setNewContactOpen(true)}
          onRow={(c) => setContactDrawer(c)}
        />
      )}

      {tab === 'estimates' && (
        <EstimatesTab
          estimates={estimates}
          loading={loadingEstimates}
          contactName={contactName}
          onOpenNew={() => setNewEstimateOpen(true)}
          onRow={(e) => setEstimateDrawer(e)}
        />
      )}

      {tab === 'agreements' && (
        <AgreementsTab
          agreements={agreements}
          loading={loadingAgreements}
          contactName={contactName}
          onOpenNew={() => setNewAgreementOpen(true)}
          onRow={(a) => setAgreementDrawer(a)}
        />
      )}

      {/* ----- modals ----- */}
      <NewDealModal
        open={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        client={client}
        contacts={contacts}
        onSaved={() => { setNewDealOpen(false); loadPipeline() }}
      />
      <NewLeadModal
        open={newLeadOpen}
        onClose={() => setNewLeadOpen(false)}
        client={client}
        onSaved={() => { setNewLeadOpen(false); loadLeads() }}
      />
      <NewContactModal
        open={newContactOpen}
        onClose={() => setNewContactOpen(false)}
        client={client}
        onSaved={() => { setNewContactOpen(false); loadContacts() }}
      />
      <NewEstimateModal
        open={newEstimateOpen}
        onClose={() => setNewEstimateOpen(false)}
        client={client}
        contacts={contacts}
        onSaved={() => { setNewEstimateOpen(false); loadEstimates() }}
      />
      <NewAgreementModal
        open={newAgreementOpen}
        onClose={() => setNewAgreementOpen(false)}
        client={client}
        contacts={contacts}
        onSaved={() => { setNewAgreementOpen(false); loadAgreements() }}
      />

      {/* ----- drawers ----- */}
      <DealDrawer
        deal={dealDrawer}
        onClose={() => setDealDrawer(null)}
        client={client}
        contactName={contactName}
        onChanged={() => { setDealDrawer(null); loadPipeline() }}
      />
      <LeadDrawer
        lead={leadDrawer}
        onClose={() => setLeadDrawer(null)}
        client={client}
        onChanged={() => { setLeadDrawer(null); loadLeads(); loadPipeline() }}
      />
      <ContactDrawer
        contact={contactDrawer}
        onClose={() => setContactDrawer(null)}
        client={client}
        pipeline={pipeline}
        estimates={estimates}
        agreements={agreements}
      />
      <EstimateDrawer
        estimate={estimateDrawer}
        onClose={() => setEstimateDrawer(null)}
        client={client}
        contactName={contactName}
        onChanged={() => { setEstimateDrawer(null); loadEstimates(); loadAgreements() }}
      />
      <AgreementDrawer
        agreement={agreementDrawer}
        onClose={() => setAgreementDrawer(null)}
        client={client}
        contactName={contactName}
        onChanged={() => { setAgreementDrawer(null); loadAgreements() }}
      />
    </HubPage>
  )
}

// ===========================================================================
//                            TAB: PIPELINE
// ===========================================================================
function PipelineTab({ pipeline, loading, onOpenNew, onCard }) {
  const grouped = useMemo(() => {
    const g = {}
    for (const s of PIPELINE_STAGES) g[s.key] = []
    for (const d of pipeline) {
      const k = g[d.stage] ? d.stage : 'new'
      g[k].push(d)
    }
    return g
  }, [pipeline])

  return (
    <Section
      title="Pipeline"
      right={
        <button
          onClick={onOpenNew}
          className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg"
        >
          + New Deal
        </button>
      }
    >
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading pipeline...</div>
      ) : pipeline.length === 0 ? (
        <EmptyState
          title="No deals in pipeline"
          description="Drop in your first deal to track it through new -> qualified -> proposal -> negotiation -> won."
          cta={
            <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
              + New Deal
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto p-4">
          <div className="flex gap-3 min-w-[1000px]">
            {PIPELINE_STAGES.map((s) => {
              const cards = grouped[s.key] || []
              const total = cards.reduce((sum, c) => sum + Number(c.deal_value || 0), 0)
              return (
                <div key={s.key} className="w-64 flex-shrink-0 bg-navy-900/40 border border-navy-700/40 rounded-lg">
                  <div className="px-3 py-2 border-b border-navy-700/40">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{s.label}</div>
                    <div className="text-sm text-white font-medium">{fmtMoney(total)}</div>
                    <div className="text-[10px] text-gray-500">{cards.length} deal{cards.length === 1 ? '' : 's'}</div>
                  </div>
                  <div className="p-2 space-y-2 min-h-[60px]">
                    {cards.length === 0 && (
                      <div className="text-[11px] text-gray-600 text-center py-4">No deals</div>
                    )}
                    {cards.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => onCard(d)}
                        className="w-full text-left bg-navy-800 border border-navy-700/50 rounded-lg p-3 hover:border-brand-cyan/40 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm text-white font-medium line-clamp-2">{d.title || '(untitled)'}</div>
                          <TempBadge temp={d.lead_temperature} />
                        </div>
                        <div className="text-xs text-brand-cyan mt-1">{fmtMoney(d.deal_value)}</div>
                        <div className="text-[11px] text-gray-500 mt-1 flex justify-between">
                          <span>{d.probability ? `${d.probability}%` : '-'}</span>
                          <span>{d.expected_close_date ? fmtDate(d.expected_close_date) : ''}</span>
                        </div>
                        {d.service_type && (
                          <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{d.service_type}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                              TAB: LEADS
// ===========================================================================
function LeadsTab({ leads, loading, onOpenNew, onRow }) {
  const [stageFilter, setStageFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (stageFilter !== 'all' && l.stage !== stageFilter) return false
      if (q) {
        const blob = `${l.contact_name || ''} ${l.company_name || ''} ${l.contact_email || ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [leads, stageFilter, search])

  return (
    <Section
      title="Leads"
      right={
        <button
          onClick={onOpenNew}
          className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg"
        >
          + New Lead
        </button>
      }
    >
      <div className="px-5 py-3 border-b border-navy-700/50 flex flex-wrap items-center gap-2">
        <Chip active={stageFilter === 'all'} onClick={() => setStageFilter('all')}>All</Chip>
        {LEAD_STAGES.map((s) => (
          <Chip key={s} active={stageFilter === s} onClick={() => setStageFilter(s)}>{s}</Chip>
        ))}
        <div className="flex-1 min-w-[180px] ml-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, email..."
            className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
          />
        </div>
      </div>
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading leads...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No leads match"
          description={leads.length === 0 ? 'Capture inbound interest, log a referral, or import a list to get started.' : 'Try a different stage or clear the search.'}
          cta={
            leads.length === 0 ? (
              <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
                + New Lead
              </button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider bg-navy-900/30">
              <tr>
                <th className="text-left px-4 py-2">Contact</th>
                <th className="text-left px-4 py-2">Company</th>
                <th className="text-left px-4 py-2">Stage</th>
                <th className="text-right px-4 py-2">Value</th>
                <th className="text-right px-4 py-2">Prob</th>
                <th className="text-left px-4 py-2">Next Action</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-left px-4 py-2">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {filtered.map((l) => (
                <tr key={l.id} onClick={() => onRow(l)} className="cursor-pointer hover:bg-navy-700/30">
                  <td className="px-4 py-2 text-white">{l.contact_name || '-'}</td>
                  <td className="px-4 py-2 text-gray-300">{l.company_name || '-'}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-navy-700/50 text-gray-300 capitalize">{l.stage || '-'}</span></td>
                  <td className="px-4 py-2 text-right text-brand-cyan">{fmtCents(l.deal_value_cents)}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{l.probability != null ? `${l.probability}%` : '-'}</td>
                  <td className="px-4 py-2 text-gray-300">{l.next_action_date ? fmtDate(l.next_action_date) : '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{l.source || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{daysSince(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                             TAB: CONTACTS
// ===========================================================================
function ContactsTab({ contacts, loading, onOpenNew, onRow }) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      if (typeFilter !== 'all' && c.contact_type !== typeFilter) return false
      if (q) {
        const blob = `${c.first_name || ''} ${c.last_name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [contacts, typeFilter, search])

  return (
    <Section
      title="Contacts"
      right={
        <button
          onClick={onOpenNew}
          className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg"
        >
          + New Contact
        </button>
      }
    >
      <div className="px-5 py-3 border-b border-navy-700/50 flex flex-wrap items-center gap-2">
        <Chip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All</Chip>
        {CONTACT_TYPES.map((t) => (
          <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>{t.replace('_', ' ')}</Chip>
        ))}
        <div className="flex-1 min-w-[180px] ml-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone..."
            className="w-full bg-navy-900/60 border border-navy-700/60 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan"
          />
        </div>
      </div>
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No contacts match"
          description={contacts.length === 0 ? 'Add a contact to start tracking customer history, properties, and lifetime value.' : 'Try a different type or clear the search.'}
          cta={
            contacts.length === 0 ? (
              <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
                + New Contact
              </button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider bg-navy-900/30">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Phone</th>
                <th className="text-left px-4 py-2">Property</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-right px-4 py-2">LTV</th>
                <th className="text-left px-4 py-2">Last Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => onRow(c)} className="cursor-pointer hover:bg-navy-700/30">
                  <td className="px-4 py-2 text-white">{`${c.first_name || ''} ${c.last_name || ''}`.trim() || '-'}</td>
                  <td className="px-4 py-2 text-gray-300">{c.email || '-'}</td>
                  <td className="px-4 py-2 text-gray-300">{c.phone || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{[c.property_city, c.property_state].filter(Boolean).join(', ') || '-'}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-navy-700/50 text-gray-300 capitalize">{(c.contact_type || '-').replace('_', ' ')}</span></td>
                  <td className="px-4 py-2 text-right text-emerald-400">{c.lifetime_value ? fmtMoney(c.lifetime_value) : '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{c.last_contacted_at ? fmtDate(c.last_contacted_at) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                            TAB: ESTIMATES
// ===========================================================================
function EstimatesTab({ estimates, loading, contactName, onOpenNew, onRow }) {
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return estimates
    return estimates.filter((e) => e.status === statusFilter)
  }, [estimates, statusFilter])

  return (
    <Section
      title="Estimates"
      right={
        <button
          onClick={onOpenNew}
          className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg"
        >
          + New Estimate
        </button>
      }
    >
      <div className="px-5 py-3 border-b border-navy-700/50 flex flex-wrap items-center gap-2">
        <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</Chip>
        {ESTIMATE_STATUSES.map((s) => (
          <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</Chip>
        ))}
      </div>
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading estimates...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No estimates yet"
          description="Build an estimate from line items, send it to a customer, and track approval."
          cta={
            estimates.length === 0 ? (
              <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
                + New Estimate
              </button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider bg-navy-900/30">
              <tr>
                <th className="text-left px-4 py-2">#</th>
                <th className="text-left px-4 py-2">Contact</th>
                <th className="text-left px-4 py-2">Title</th>
                <th className="text-right px-4 py-2">Total</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">e-Sign</th>
                <th className="text-left px-4 py-2">Valid Until</th>
                <th className="text-left px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {filtered.map((e) => (
                <tr key={e.id} onClick={() => onRow(e)} className="cursor-pointer hover:bg-navy-700/30">
                  <td className="px-4 py-2 text-white">{e.estimate_number || '-'}</td>
                  <td className="px-4 py-2 text-gray-300">{contactName(e.contact_id)}</td>
                  <td className="px-4 py-2 text-gray-300">{e.title || '-'}</td>
                  <td className="px-4 py-2 text-right text-brand-cyan">{fmtMoney(e.total)}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-navy-700/50 text-gray-300 capitalize">{e.status || '-'}</span></td>
                  <td className="px-4 py-2 text-gray-300 capitalize">{e.esign_status || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{e.valid_until ? fmtDate(e.valid_until) : '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{fmtDate(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                           TAB: AGREEMENTS
// ===========================================================================
function AgreementsTab({ agreements, loading, contactName, onOpenNew, onRow }) {
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return agreements
    return agreements.filter((a) => a.status === statusFilter)
  }, [agreements, statusFilter])

  return (
    <Section
      title="Agreements"
      right={
        <button
          onClick={onOpenNew}
          className="bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs px-3 py-1.5 rounded-lg"
        >
          + New Agreement
        </button>
      }
    >
      <div className="px-5 py-3 border-b border-navy-700/50 flex flex-wrap items-center gap-2">
        <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</Chip>
        {AGREEMENT_STATUSES.map((s) => (
          <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</Chip>
        ))}
      </div>
      {loading ? (
        <div className="p-6 text-sm text-gray-500">Loading agreements...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No agreements yet"
          description="Convert an approved estimate into an agreement to lock in scope, terms, and signatures."
          cta={
            agreements.length === 0 ? (
              <button onClick={onOpenNew} className="bg-brand-cyan text-navy-900 text-sm px-4 py-2 rounded-lg font-medium">
                + New Agreement
              </button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider bg-navy-900/30">
              <tr>
                <th className="text-left px-4 py-2">#</th>
                <th className="text-left px-4 py-2">Contact</th>
                <th className="text-left px-4 py-2">Title</th>
                <th className="text-right px-4 py-2">Total</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">e-Sign</th>
                <th className="text-left px-4 py-2">Start</th>
                <th className="text-left px-4 py-2">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {filtered.map((a) => (
                <tr key={a.id} onClick={() => onRow(a)} className="cursor-pointer hover:bg-navy-700/30">
                  <td className="px-4 py-2 text-white">{a.agreement_number || '-'}</td>
                  <td className="px-4 py-2 text-gray-300">{contactName(a.contact_id)}</td>
                  <td className="px-4 py-2 text-gray-300">{a.title || '-'}</td>
                  <td className="px-4 py-2 text-right text-brand-cyan">{fmtMoney(a.total_value)}</td>
                  <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-navy-700/50 text-gray-300 capitalize">{a.status || '-'}</span></td>
                  <td className="px-4 py-2 text-gray-300 capitalize">{a.esign_status || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{a.start_date ? fmtDate(a.start_date) : '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{a.end_date ? fmtDate(a.end_date) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ===========================================================================
//                           MODALS - NEW DEAL
// ===========================================================================
function NewDealModal({ open, onClose, client, contacts, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm({ stage: 'new' }) }, [open])

  async function submit() {
    if (!client) return
    setSaving(true)
    try {
      const payload = {
        contact_id: form.contact_id || null,
        title: form.title || null,
        stage: form.stage || 'new',
        deal_value: form.deal_value ? Number(form.deal_value) : null,
        expected_close_date: form.expected_close_date || null,
        service_type: form.service_type || null,
        notes: form.notes || null,
      }
      const { error } = await client.from('customer_pipeline').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[NewDealModal] submit', e)
      alert('Could not save deal: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Deal"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Deal'}
          </button>
        </div>
      }
    >
      <Select
        label="Contact"
        value={form.contact_id}
        onChange={(v) => setForm({ ...form, contact_id: v })}
        options={contacts.map((c) => ({
          value: c.id,
          label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || c.id,
        }))}
      />
      <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Roof tear-off and replacement" />
      <Input label="Deal Value (USD)" type="number" value={form.deal_value} onChange={(v) => setForm({ ...form, deal_value: v })} />
      <Select
        label="Stage"
        value={form.stage}
        onChange={(v) => setForm({ ...form, stage: v })}
        options={PIPELINE_STAGES.map((s) => ({ value: s.key, label: s.label }))}
      />
      <Input label="Expected Close" type="date" value={form.expected_close_date} onChange={(v) => setForm({ ...form, expected_close_date: v })} />
      <Input label="Service Type" value={form.service_type} onChange={(v) => setForm({ ...form, service_type: v })} placeholder="install, repair, maintenance..." />
      <Input label="Notes" rows={3} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
    </Modal>
  )
}

// ===========================================================================
//                           MODALS - NEW LEAD
// ===========================================================================
function NewLeadModal({ open, onClose, client, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (open) { setForm({ stage: 'new' }); setError('') } }, [open])

  async function submit() {
    if (!client) return
    const hasName = (form.title || form.company_name || form.contact_name || '').trim()
    if (!hasName) { setError('Add a title, company, or contact name before saving.'); return }
    setError('')
    setSaving(true)
    try {
      const payload = {
        title: form.title || null,
        company_name: form.company_name || null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        product_type: form.product_type || null,
        stage: form.stage || 'new',
        deal_value_cents: form.deal_value
          ? Math.round(Number(form.deal_value) * 100)
          : null,
        probability: form.probability ? Number(form.probability) : null,
        expected_close_date: form.expected_close_date || null,
        source: form.source || null,
        next_action: form.next_action || null,
        next_action_date: form.next_action_date || null,
        description: form.description || null,
      }
      const { error } = await client.from('sales_leads').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[NewLeadModal] submit', e)
      alert('Could not save lead: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Lead"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Lead'}
          </button>
        </div>
      }
    >
      {error && <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
      {error && <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <Input label="Company" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} />
        <Input label="Contact Name" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
        <Input label="Contact Email" value={form.contact_email} onChange={(v) => setForm({ ...form, contact_email: v })} />
        <Input label="Contact Phone" value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} />
        <Input label="Product / Service Type" value={form.product_type} onChange={(v) => setForm({ ...form, product_type: v })} />
        <Select
          label="Stage"
          value={form.stage}
          onChange={(v) => setForm({ ...form, stage: v })}
          options={LEAD_STAGES.map((s) => ({ value: s, label: s }))}
        />
        <Input label="Deal Value (USD)" type="number" value={form.deal_value} onChange={(v) => setForm({ ...form, deal_value: v })} />
        <Input label="Probability %" type="number" value={form.probability} onChange={(v) => setForm({ ...form, probability: v })} />
        <Input label="Expected Close" type="date" value={form.expected_close_date} onChange={(v) => setForm({ ...form, expected_close_date: v })} />
        <Input label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} placeholder="referral, web, ads..." />
        <Input label="Next Action" value={form.next_action} onChange={(v) => setForm({ ...form, next_action: v })} />
        <Input label="Next Action Date" type="date" value={form.next_action_date} onChange={(v) => setForm({ ...form, next_action_date: v })} />
      </div>
      <Input label="Description" rows={3} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
    </Modal>
  )
}

// ===========================================================================
//                         MODALS - NEW CONTACT
// ===========================================================================
function NewContactModal({ open, onClose, client, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm({ contact_type: 'lead' }) }, [open])

  async function submit() {
    if (!client) return
    setSaving(true)
    try {
      const payload = {
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        email: form.email || null,
        phone: form.phone || null,
        property_address: form.property_address || null,
        property_city: form.property_city || null,
        property_state: form.property_state || null,
        property_zip: form.property_zip || null,
        property_type: form.property_type || null,
        contact_type: form.contact_type || 'lead',
        lead_source: form.lead_source || null,
        notes: form.notes || null,
      }
      const { error } = await client.from('customer_contacts').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[NewContactModal] submit', e)
      alert('Could not save contact: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Contact"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Contact'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Input label="First Name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
        <Input label="Last Name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
        <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Input label="Property Address" value={form.property_address} onChange={(v) => setForm({ ...form, property_address: v })} />
        <Input label="City" value={form.property_city} onChange={(v) => setForm({ ...form, property_city: v })} />
        <Input label="State" value={form.property_state} onChange={(v) => setForm({ ...form, property_state: v })} />
        <Input label="Zip" value={form.property_zip} onChange={(v) => setForm({ ...form, property_zip: v })} />
        <Input label="Property Type" value={form.property_type} onChange={(v) => setForm({ ...form, property_type: v })} placeholder="residential, commercial..." />
        <Select
          label="Contact Type"
          value={form.contact_type}
          onChange={(v) => setForm({ ...form, contact_type: v })}
          options={CONTACT_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
        />
        <Input label="Lead Source" value={form.lead_source} onChange={(v) => setForm({ ...form, lead_source: v })} />
      </div>
      <Input label="Notes" rows={3} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
    </Modal>
  )
}

// ===========================================================================
//                         MODALS - NEW ESTIMATE
// ===========================================================================
function NewEstimateModal({ open, onClose, client, contacts, onSaved }) {
  const [form, setForm] = useState({})
  const [lineItems, setLineItems] = useState([{ description: '', qty: 1, unit_price: 0 }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ status: 'draft', tax_rate: 0, discount_amount: 0 })
      setLineItems([{ description: '', qty: 1, unit_price: 0 }])
    }
  }, [open])

  const [templates, setTemplates] = useState([])
  const [photos, setPhotos] = useState([])
  const [extra, setExtra] = useState({ template_id: '', theme_key: 'classic', show_photos: true, photo_ids: [], terms: '' })

  useEffect(() => {
    if (!open) return
    setExtra({ template_id: '', theme_key: 'classic', show_photos: true, photo_ids: [], terms: '' })
    client.from('estimate_templates').select('*').eq('is_active', true).order('name').then(({ data }) => setTemplates(data || []))
  }, [open])

  useEffect(() => {
    if (!open || !form.contact_id) { setPhotos([]); return }
    client.from('customer_photos').select('*').eq('contact_id', form.contact_id).order('created_at', { ascending: false }).then(({ data }) => setPhotos(data || []))
  }, [open, form.contact_id])

  async function applyTemplate(tid) {
    setExtra((x) => ({ ...x, template_id: tid }))
    if (!tid) return
    const tpl = templates.find((t) => t.id === tid)
    const { data: its } = await client.from('estimate_template_items').select('*').eq('template_id', tid).order('step_order')
    if (its && its.length) {
      setLineItems(its.map((it) => ({ description: it.name, qty: Number(it.quantity) || 1, unit_price: Number(it.unit_price) || 0, unit: it.unit || '', group_name: it.group_name || null, is_optional: !!it.is_optional })))
    }
    if (tpl) setExtra((x) => ({ ...x, template_id: tid, theme_key: tpl.theme_key || 'classic', show_photos: tpl.show_photos !== false, terms: tpl.default_terms || '' }))
  }

  function togglePhoto(id) {
    setExtra((x) => ({ ...x, photo_ids: x.photo_ids.includes(id) ? x.photo_ids.filter((p) => p !== id) : [...x.photo_ids, id] }))
  }

  function updateItem(i, k, v) {
    const next = lineItems.slice()
    next[i] = { ...next[i], [k]: v }
    setLineItems(next)
  }
  function addItem() {
    setLineItems([...lineItems, { description: '', qty: 1, unit_price: 0 }])
  }
  function removeItem(i) {
    setLineItems(lineItems.filter((_, idx) => idx !== i))
  }

  const subtotal = lineItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
  const taxAmount = subtotal * ((Number(form.tax_rate) || 0) / 100)
  const total = subtotal + taxAmount - (Number(form.discount_amount) || 0)

  async function submit() {
    if (!client) return
    setSaving(true)
    try {
      const payload = {
        contact_id: form.contact_id || null,
        title: form.title || null,
        line_items: lineItems,
        theme_key: extra.theme_key,
        show_photos: extra.show_photos,
        photo_ids: extra.photo_ids,
        terms: extra.terms || null,
        subtotal,
        tax_rate: Number(form.tax_rate) || 0,
        tax_amount: taxAmount,
        discount_amount: Number(form.discount_amount) || 0,
        total,
        status: form.status || 'draft',
        valid_until: form.valid_until || null,
        notes: form.notes || null,
      }
      const { error } = await client.from('customer_estimates').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[NewEstimateModal] submit', e)
      alert('Could not save estimate: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Estimate"
      wide
      footer={
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-300">Total <span className="text-brand-cyan font-semibold">{fmtMoney(total)}</span></div>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
            <button
              onClick={submit}
              disabled={saving}
              className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Estimate'}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Select
          label="Contact"
          value={form.contact_id}
          onChange={(v) => setForm({ ...form, contact_id: v })}
          options={contacts.map((c) => ({
            value: c.id,
            label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || c.id,
          }))}
        />
        <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <Input label="Tax Rate %" type="number" value={form.tax_rate} onChange={(v) => setForm({ ...form, tax_rate: v })} />
        <Input label="Discount (USD)" type="number" value={form.discount_amount} onChange={(v) => setForm({ ...form, discount_amount: v })} />
        <Input label="Valid Until" type="date" value={form.valid_until} onChange={(v) => setForm({ ...form, valid_until: v })} />
        <Select
          label="Status"
          value={form.status}
          onChange={(v) => setForm({ ...form, status: v })}
          options={ESTIMATE_STATUSES.map((s) => ({ value: s, label: s }))}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-gray-400">Start from template</label>
          <select value={extra.template_id} onChange={(e) => applyTemplate(e.target.value)} className="w-full mt-1 bg-navy-900 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">None &mdash; blank estimate</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-gray-400">Theme</label>
          <select value={extra.theme_key} onChange={(e) => setExtra((x) => ({ ...x, theme_key: e.target.value }))} className="w-full mt-1 bg-navy-900 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white">
            {themeOptions().map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {photos.length ? (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs uppercase tracking-wider text-gray-400">Photos ({extra.photo_ids.length} selected)</label>
            <label className="text-xs text-gray-300 flex items-center gap-1"><input type="checkbox" checked={extra.show_photos} onChange={(e) => setExtra((x) => ({ ...x, show_photos: e.target.checked }))} /> Show on estimate</label>
          </div>
          <div className="max-h-32 overflow-auto space-y-1 border border-navy-700/50 rounded-lg p-2">
            {photos.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={extra.photo_ids.includes(p.id)} onChange={() => togglePhoto(p.id)} />
                <span>{p.caption || p.category || 'Photo'}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-3">
        <label className="text-xs uppercase tracking-wider text-gray-400">Terms &amp; Conditions</label>
        <textarea value={extra.terms} onChange={(e) => setExtra((x) => ({ ...x, terms: e.target.value }))} rows={3} placeholder="Payment terms, warranty, etc." className="w-full mt-1 bg-navy-900 border border-navy-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />
      </div>

      <div className="mt-3 mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-gray-400">Line Items</span>
        <button onClick={addItem} className="text-xs text-brand-cyan hover:underline">+ Add line</button>
      </div>
      <div className="space-y-2 mb-3">
        {lineItems.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center bg-navy-900/40 border border-navy-700/40 rounded-lg p-2">
            <input
              value={it.description}
              onChange={(e) => updateItem(i, 'description', e.target.value)}
              placeholder="Description"
              className="col-span-6 bg-navy-900/60 border border-navy-700/60 rounded px-2 py-1 text-sm text-white"
            />
            <input
              type="number"
              value={it.qty}
              onChange={(e) => updateItem(i, 'qty', e.target.value)}
              placeholder="Qty"
              className="col-span-2 bg-navy-900/60 border border-navy-700/60 rounded px-2 py-1 text-sm text-white text-right"
            />
            <input
              type="number"
              value={it.unit_price}
              onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
              placeholder="Unit $"
              className="col-span-3 bg-navy-900/60 border border-navy-700/60 rounded px-2 py-1 text-sm text-white text-right"
            />
            <button onClick={() => removeItem(i)} className="col-span-1 text-gray-500 hover:text-red-400 text-xs">x</button>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 flex justify-between border-t border-navy-700/40 pt-2">
        <span>Subtotal</span><span className="text-white">{fmtMoney(subtotal)}</span>
      </div>
      <div className="text-xs text-gray-400 flex justify-between">
        <span>Tax</span><span className="text-white">{fmtMoney(taxAmount)}</span>
      </div>
      <div className="text-xs text-gray-400 flex justify-between">
        <span>Discount</span><span className="text-white">-{fmtMoney(form.discount_amount || 0)}</span>
      </div>

      <Input label="Notes" rows={3} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
    </Modal>
  )
}

// ===========================================================================
//                         MODALS - NEW AGREEMENT
// ===========================================================================
function NewAgreementModal({ open, onClose, client, contacts, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm({ status: 'draft' }) }, [open])

  async function submit() {
    if (!client) return
    setSaving(true)
    try {
      const payload = {
        contact_id: form.contact_id || null,
        title: form.title || null,
        agreement_type: form.agreement_type || null,
        terms_text: form.terms_text || null,
        scope_of_work: form.scope_of_work || null,
        total_value: form.total_value ? Number(form.total_value) : null,
        payment_terms: form.payment_terms || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status || 'draft',
        notes: form.notes || null,
      }
      const { error } = await client.from('customer_agreements').insert(payload)
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error('[NewAgreementModal] submit', e)
      alert('Could not save agreement: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Agreement"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Agreement'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Select
          label="Contact"
          value={form.contact_id}
          onChange={(v) => setForm({ ...form, contact_id: v })}
          options={contacts.map((c) => ({
            value: c.id,
            label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || c.id,
          }))}
        />
        <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <Input label="Agreement Type" value={form.agreement_type} onChange={(v) => setForm({ ...form, agreement_type: v })} placeholder="service, maintenance, install..." />
        <Input label="Total Value (USD)" type="number" value={form.total_value} onChange={(v) => setForm({ ...form, total_value: v })} />
        <Input label="Payment Terms" value={form.payment_terms} onChange={(v) => setForm({ ...form, payment_terms: v })} placeholder="net 30, 50/50, monthly..." />
        <Select
          label="Status"
          value={form.status}
          onChange={(v) => setForm({ ...form, status: v })}
          options={AGREEMENT_STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <Input label="Start Date" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
        <Input label="End Date" type="date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
      </div>
      <Input label="Scope of Work" rows={4} value={form.scope_of_work} onChange={(v) => setForm({ ...form, scope_of_work: v })} />
      <Input label="Terms" rows={4} value={form.terms_text} onChange={(v) => setForm({ ...form, terms_text: v })} />
      <Input label="Notes" rows={2} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
    </Modal>
  )
}

// ===========================================================================
//                          DRAWER: DEAL
// ===========================================================================
function DealDrawer({ deal, onClose, client, contactName, onChanged }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (deal) setForm(deal) }, [deal])

  if (!deal) return null

  async function save() {
    setSaving(true)
    try {
      const patch = {
        title: form.title || null,
        stage: form.stage,
        deal_value: form.deal_value ? Number(form.deal_value) : null,
        probability: form.probability ? Number(form.probability) : null,
        expected_close_date: form.expected_close_date || null,
        lead_temperature: form.lead_temperature || null,
        service_type: form.service_type || null,
        notes: form.notes || null,
      }
      if (form.stage === 'won' && !form.won_date) patch.won_date = new Date().toISOString().slice(0, 10)
      if (form.stage === 'lost' && !form.lost_date) patch.lost_date = new Date().toISOString().slice(0, 10)
      const { error } = await client.from('customer_pipeline').update(patch).eq('id', deal.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[DealDrawer] save', e)
      alert('Save failed: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={!!deal}
      onClose={onClose}
      title={deal.title || 'Deal'}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3 py-1.5 text-gray-400 hover:text-white">Close</button>
          <button onClick={save} disabled={saving} className="bg-brand-cyan text-navy-900 text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      }
    >
      <div className="text-xs text-gray-500 mb-3">{contactName(deal.contact_id)}</div>
      <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
      <Select label="Stage" value={form.stage} onChange={(v) => setForm({ ...form, stage: v })} options={PIPELINE_STAGES.map((s) => ({ value: s.key, label: s.label }))} />
      <Input label="Deal Value (USD)" type="number" value={form.deal_value} onChange={(v) => setForm({ ...form, deal_value: v })} />
      <Input label="Probability %" type="number" value={form.probability} onChange={(v) => setForm({ ...form, probability: v })} />
      <Input label="Expected Close" type="date" value={form.expected_close_date} onChange={(v) => setForm({ ...form, expected_close_date: v })} />
      <Select label="Temperature" value={form.lead_temperature} onChange={(v) => setForm({ ...form, lead_temperature: v })} options={[{ value: 'hot', label: 'hot' }, { value: 'warm', label: 'warm' }, { value: 'cold', label: 'cold' }]} />
      <Input label="Service Type" value={form.service_type} onChange={(v) => setForm({ ...form, service_type: v })} />
      <Input label="Notes" rows={4} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
      {form.stage === 'lost' && (
        <Input label="Lost Reason" value={form.lost_reason} onChange={(v) => setForm({ ...form, lost_reason: v })} />
      )}
    </Drawer>
  )
}

// ===========================================================================
//                          DRAWER: LEAD
// ===========================================================================
function LeadDrawer({ lead, onClose, client, onChanged }) {
  const [busy, setBusy] = useState(false)
  if (!lead) return null

  async function convert() {
    setBusy(true)
    try {
      const newDeal = {
        title: lead.title || `${lead.contact_name || ''} - converted`.trim(),
        deal_value: lead.deal_value_cents ? lead.deal_value_cents / 100 : null,
        probability: lead.probability || null,
        expected_close_date: lead.expected_close_date || null,
        stage: 'new',
        service_type: lead.product_type || null,
        notes: lead.notes || lead.description || null,
      }
      const { data: created, error: insErr } = await client
        .from('customer_pipeline')
        .insert(newDeal)
        .select('id')
        .single()
      if (insErr) throw insErr
      const { error: updErr } = await client
        .from('sales_leads')
        .update({
          stage: 'converted',
          converted_to_type: 'pipeline',
          converted_to_id: created.id,
        })
        .eq('id', lead.id)
      if (updErr) throw updErr
      onChanged()
    } catch (e) {
      console.error('[LeadDrawer] convert', e)
      alert('Could not convert lead: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function markLost() {
    const reason = prompt('Lost reason (optional)')
    setBusy(true)
    try {
      const { error } = await client
        .from('sales_leads')
        .update({ stage: 'lost', lost_reason: reason || null })
        .eq('id', lead.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[LeadDrawer] markLost', e)
      alert('Could not mark lost: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={!!lead}
      onClose={onClose}
      title={lead.contact_name || lead.title || 'Lead'}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={markLost} disabled={busy} className="text-xs px-3 py-1.5 text-red-300 border border-red-500/40 rounded-lg hover:bg-red-500/10">
            Mark Lost
          </button>
          <button onClick={convert} disabled={busy} className="text-xs px-3 py-1.5 bg-brand-cyan text-navy-900 rounded-lg font-medium">
            {busy ? 'Working...' : 'Convert to Deal'}
          </button>
        </div>
      }
    >
      <DetailRow label="Company" value={lead.company_name} />
      <DetailRow label="Email" value={lead.contact_email} />
      <DetailRow label="Phone" value={lead.contact_phone} />
      <DetailRow label="Stage" value={lead.stage} />
      <DetailRow label="Value" value={fmtCents(lead.deal_value_cents)} />
      <DetailRow label="Probability" value={lead.probability != null ? `${lead.probability}%` : '-'} />
      <DetailRow label="Source" value={lead.source} />
      <DetailRow label="Next Action" value={lead.next_action} />
      <DetailRow label="Next Action Date" value={lead.next_action_date ? fmtDate(lead.next_action_date) : '-'} />
      <DetailRow label="Expected Close" value={lead.expected_close_date ? fmtDate(lead.expected_close_date) : '-'} />
      <DetailRow label="Created" value={fmtDate(lead.created_at)} />
      {lead.description && (
        <div className="mt-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Description</div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap">{lead.description}</div>
        </div>
      )}
      {lead.notes && (
        <div className="mt-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap">{lead.notes}</div>
        </div>
      )}
    </Drawer>
  )
}

// ===========================================================================
//                         DRAWER: CONTACT
// ===========================================================================
function ContactDrawer({ contact, onClose, pipeline, estimates, agreements }) {
  if (!contact) return null
  const relatedDeals = pipeline.filter((d) => d.contact_id === contact.id)
  const relatedEstimates = estimates.filter((e) => e.contact_id === contact.id).slice(0, 5)
  const relatedAgreements = agreements.filter((a) => a.contact_id === contact.id).slice(0, 5)

  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email || 'Contact'

  return (
    <Drawer open={!!contact} onClose={onClose} title={fullName}>
      <DetailRow label="Email" value={contact.email} />
      <DetailRow label="Phone" value={contact.phone} />
      <DetailRow label="Type" value={contact.contact_type} />
      <DetailRow label="Lead Source" value={contact.lead_source} />
      <DetailRow label="Property" value={[contact.property_address, contact.property_city, contact.property_state, contact.property_zip].filter(Boolean).join(', ')} />
      <DetailRow label="Property Type" value={contact.property_type} />
      <DetailRow label="Lifetime Value" value={contact.lifetime_value ? fmtMoney(contact.lifetime_value) : '-'} />
      <DetailRow label="Last Contact" value={contact.last_contacted_at ? fmtDate(contact.last_contacted_at) : '-'} />

      <div className="mt-4">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Pipeline Deals ({relatedDeals.length})</div>
        {relatedDeals.length === 0 ? (
          <div className="text-xs text-gray-500">None.</div>
        ) : (
          <ul className="space-y-1">
            {relatedDeals.slice(0, 5).map((d) => (
              <li key={d.id} className="text-sm text-gray-300 flex justify-between">
                <span>{d.title || '(untitled)'}</span>
                <span className="text-brand-cyan">{fmtMoney(d.deal_value)} <span className="text-gray-500">/ {d.stage}</span></span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CustomerPhotos contactId={contact.id} />

      <div className="mt-4">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Recent Estimates ({relatedEstimates.length})</div>
        {relatedEstimates.length === 0 ? (
          <div className="text-xs text-gray-500">None.</div>
        ) : (
          <ul className="space-y-1">
            {relatedEstimates.map((e) => (
              <li key={e.id} className="text-sm text-gray-300 flex justify-between">
                <span>{e.estimate_number || '-'} {e.title ? `- ${e.title}` : ''}</span>
                <span className="text-brand-cyan">{fmtMoney(e.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Recent Agreements ({relatedAgreements.length})</div>
        {relatedAgreements.length === 0 ? (
          <div className="text-xs text-gray-500">None.</div>
        ) : (
          <ul className="space-y-1">
            {relatedAgreements.map((a) => (
              <li key={a.id} className="text-sm text-gray-300 flex justify-between">
                <span>{a.agreement_number || '-'} {a.title ? `- ${a.title}` : ''}</span>
                <span className="text-brand-cyan">{fmtMoney(a.total_value)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {contact.notes && (
        <div className="mt-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap">{contact.notes}</div>
        </div>
      )}
    </Drawer>
  )
}

// ===========================================================================
//                         DRAWER: ESTIMATE
// ===========================================================================
function EstimateDrawer({ estimate, onClose, client, contactName, onChanged }) {
  const [busy, setBusy] = useState(false)
  if (!estimate) return null

  async function sendToCustomer() {
    // Send via e-sign / email is a no-op placeholder for Wave G (e-sign integration)
    setBusy(true)
    try {
      const { error } = await client
        .from('customer_estimates')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', estimate.id)
      if (error) throw error
      alert('Marked as sent. (Actual email/e-sign delivery ships in Wave G.)')
      onChanged()
    } catch (e) {
      console.error('[EstimateDrawer] sendToCustomer', e)
      alert('Send failed: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function convertToAgreement() {
    setBusy(true)
    try {
      const payload = {
        contact_id: estimate.contact_id,
        estimate_id: estimate.id,
        title: estimate.title,
        total_value: estimate.total,
        status: 'draft',
        scope_of_work: (estimate.line_items || []).map((it) => `- ${it.description || ''} (${it.qty} x ${it.unit_price})`).join('\n'),
        notes: estimate.notes,
      }
      const { error } = await client.from('customer_agreements').insert(payload)
      if (error) throw error
      alert('Agreement draft created from estimate.')
      onChanged()
    } catch (e) {
      console.error('[EstimateDrawer] convertToAgreement', e)
      alert('Convert failed: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const items = Array.isArray(estimate.line_items) ? estimate.line_items : []

  return (
    <Drawer
      open={!!estimate}
      onClose={onClose}
      title={estimate.estimate_number || 'Estimate'}
      footer={
        <div className="flex justify-end gap-2">
          <a href={window.location.pathname.split('/sales')[0] + '/estimate/' + estimate.id} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 border border-navy-700/60 text-gray-300 rounded-lg hover:text-white">View / Print</a>
          <button onClick={sendToCustomer} disabled={busy} className="text-xs px-3 py-1.5 border border-navy-700/60 text-gray-300 rounded-lg hover:text-white">
            Send to Customer
          </button>
          <button onClick={convertToAgreement} disabled={busy} className="text-xs px-3 py-1.5 bg-brand-cyan text-navy-900 rounded-lg font-medium">
            Convert to Agreement
          </button>
        </div>
      }
    >
      <DetailRow label="Contact" value={contactName(estimate.contact_id)} />
      <DetailRow label="Title" value={estimate.title} />
      <DetailRow label="Status" value={estimate.status} />
      <DetailRow label="e-Sign" value={estimate.esign_status} />
      <DetailRow label="Valid Until" value={estimate.valid_until ? fmtDate(estimate.valid_until) : '-'} />
      <DetailRow label="Sent" value={estimate.sent_at ? fmtDate(estimate.sent_at) : '-'} />

      <div className="mt-3">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Line Items</div>
        <table className="w-full text-xs">
          <thead className="text-gray-500">
            <tr>
              <th className="text-left py-1">Description</th>
              <th className="text-right py-1">Qty</th>
              <th className="text-right py-1">Unit</th>
              <th className="text-right py-1">Line</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {items.length === 0 ? (
              <tr><td colSpan={4} className="text-gray-500 py-2">No line items.</td></tr>
            ) : items.map((it, i) => (
              <tr key={i} className="border-t border-navy-700/40">
                <td className="py-1">{it.description || '-'}</td>
                <td className="py-1 text-right">{it.qty}</td>
                <td className="py-1 text-right">{fmtMoney(it.unit_price)}</td>
                <td className="py-1 text-right">{fmtMoney((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-gray-400 space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span className="text-white">{fmtMoney(estimate.subtotal)}</span></div>
        <div className="flex justify-between"><span>Tax ({estimate.tax_rate || 0}%)</span><span className="text-white">{fmtMoney(estimate.tax_amount)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span className="text-white">-{fmtMoney(estimate.discount_amount)}</span></div>
        <div className="flex justify-between text-sm pt-1 border-t border-navy-700/40 mt-1"><span className="text-white">Total</span><span className="text-brand-cyan font-semibold">{fmtMoney(estimate.total)}</span></div>
      </div>

      {estimate.notes && (
        <div className="mt-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap">{estimate.notes}</div>
        </div>
      )}
    </Drawer>
  )
}

// ===========================================================================
//                         DRAWER: AGREEMENT
// ===========================================================================
function AgreementDrawer({ agreement, onClose, client, contactName, onChanged }) {
  const [busy, setBusy] = useState(false)
  if (!agreement) return null

  async function sendForEsign() {
    // Send for e-sign is a no-op placeholder for Wave G (DocuSign/HelloSign integration)
    setBusy(true)
    try {
      const { error } = await client
        .from('customer_agreements')
        .update({ status: 'sent', esign_sent_at: new Date().toISOString(), esign_status: 'pending' })
        .eq('id', agreement.id)
      if (error) throw error
      alert('Marked as sent. (Actual e-sign delivery ships in Wave G.)')
      onChanged()
    } catch (e) {
      console.error('[AgreementDrawer] sendForEsign', e)
      alert('Send failed: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function markActive() {
    setBusy(true)
    try {
      const { error } = await client
        .from('customer_agreements')
        .update({ status: 'active' })
        .eq('id', agreement.id)
      if (error) throw error
      onChanged()
    } catch (e) {
      console.error('[AgreementDrawer] markActive', e)
      alert('Update failed: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={!!agreement}
      onClose={onClose}
      title={agreement.agreement_number || 'Agreement'}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={sendForEsign} disabled={busy} className="text-xs px-3 py-1.5 border border-navy-700/60 text-gray-300 rounded-lg hover:text-white">
            Send for e-Sign
          </button>
          <button onClick={markActive} disabled={busy} className="text-xs px-3 py-1.5 bg-brand-cyan text-navy-900 rounded-lg font-medium">
            Mark Active
          </button>
        </div>
      }
    >
      <DetailRow label="Contact" value={contactName(agreement.contact_id)} />
      <DetailRow label="Title" value={agreement.title} />
      <DetailRow label="Type" value={agreement.agreement_type} />
      <DetailRow label="Status" value={agreement.status} />
      <DetailRow label="e-Sign" value={agreement.esign_status} />
      <DetailRow label="Total" value={fmtMoney(agreement.total_value)} />
      <DetailRow label="Payment Terms" value={agreement.payment_terms} />
      <DetailRow label="Start" value={agreement.start_date ? fmtDate(agreement.start_date) : '-'} />
      <DetailRow label="End" value={agreement.end_date ? fmtDate(agreement.end_date) : '-'} />

      {agreement.scope_of_work && (
        <div className="mt-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Scope of Work</div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap">{agreement.scope_of_work}</div>
        </div>
      )}
      {agreement.terms_text && (
        <div className="mt-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Terms</div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap">{agreement.terms_text}</div>
        </div>
      )}
      {agreement.notes && (
        <div className="mt-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notes</div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap">{agreement.notes}</div>
        </div>
      )}
    </Drawer>
  )
}

// ---------- detail row primitive ----------
function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between py-1 border-b border-navy-700/30 text-sm">
      <span className="text-xs uppercase tracking-wider text-gray-500">{label}</span>
      <span className="text-gray-200 text-right">{value || '-'}</span>
    </div>
  )
}
