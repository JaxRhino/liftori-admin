export default function Agreements() {
  const capabilities = [
    {
      title: 'E-Signature Workflow',
      description: 'Send contracts for legally binding electronic signature. Multi-party signing with ordered or parallel workflows. Signers get email + SMS reminders until complete. Full audit trail with IP, timestamp, and device metadata.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      ),
    },
    {
      title: 'Smart Contract Builder',
      description: 'Drag-and-drop contract builder with reusable clause library. Insert dynamic fields (client name, project scope, pricing, dates) that auto-populate from project data. Version control on every edit.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      title: 'Terms & Conditions Engine',
      description: 'Maintain a master T&C library covering scope of work, payment terms, IP ownership, confidentiality, liability limits, cancellation policy, and dispute resolution. Attach standard or custom terms to any agreement.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
    },
    {
      title: 'Template Library',
      description: 'Pre-built templates for every stage: NDAs, SOWs, MSAs, project agreements, change orders, SLAs, and freelancer/subcontractor contracts. Clone, customize, and save as your own templates.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
        </svg>
      ),
    },
    {
      title: 'Milestone-Linked Payments',
      description: 'Bind agreement sections to project milestones and payment triggers. When a milestone is marked complete, the corresponding invoice auto-generates. Supports 50/40/10, net-30, retainer, and custom schedules.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
    },
    {
      title: 'Approval & Negotiation Flow',
      description: 'Clients can accept, request changes, or add comments inline before signing. Track every revision. Auto-notify your team when a client responds. No more back-and-forth email chains.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      ),
    },
    {
      title: 'Compliance & Legal Vault',
      description: 'Every signed agreement stored with tamper-proof audit trail. Download certified PDF copies anytime. Automatic expiration alerts for renewals. ESIGN Act and UETA compliant.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
    {
      title: 'Wizard Integration',
      description: 'Agreements auto-generate from wizard submissions. When a client completes the project wizard and approves their estimate, the agreement pre-populates with scope, timeline, pricing, and terms — ready to sign.',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
      ),
    },
  ]

  const templateTypes = [
    { name: 'Master Service Agreement (MSA)', desc: 'Umbrella contract covering all work between Liftori and a client', status: 'Core' },
    { name: 'Statement of Work (SOW)', desc: 'Project-specific scope, deliverables, timeline, and pricing', status: 'Core' },
    { name: 'Non-Disclosure Agreement (NDA)', desc: 'Mutual or one-way confidentiality protection', status: 'Core' },
    { name: 'Change Order', desc: 'Scope modifications with updated pricing and timeline', status: 'Core' },
    { name: 'Service Level Agreement (SLA)', desc: 'Uptime, support response times, and managed service terms', status: 'Growth' },
    { name: 'Subcontractor Agreement', desc: 'Terms for freelancers and subcontractors working on builds', status: 'Growth' },
    { name: 'Affiliate Agreement', desc: 'Commission structures, referral terms, and payout schedules', status: 'Growth' },
    { name: 'White-Label License', desc: 'Licensing terms for franchise/operator model deployments', status: 'Scale' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Agreements</h1>
            <p className="text-gray-400 text-sm">Contracts, E-Signatures & Legal Document Management</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Coming Soon
          </span>
        </div>
        <p className="text-gray-500 text-sm max-w-2xl mt-4">
          Generate, send, and track legally binding agreements from inside Liftori. From initial NDA through
          final SOW, every contract auto-populates from your project data, routes through e-signature,
          and locks into a tamper-proof legal vault. No more PDFs over email.
        </p>
      </div>

      {/* Capabilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {capabilities.map((cap, i) => (
          <div key={i} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5 hover:border-navy-600/50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                {cap.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">{cap.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{cap.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Agreement Lifecycle */}
      <div className="bg-navy-800/30 border border-navy-700/30 rounded-xl p-6 mb-10">
        <h2 className="text-lg font-semibold text-white mb-5">Agreement Lifecycle</h2>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {[
            { step: '01', title: 'Draft', desc: 'Build or select template', color: 'text-gray-400' },
            { step: '02', title: 'Review', desc: 'Internal approval', color: 'text-yellow-400' },
            { step: '03', title: 'Sent', desc: 'Client receives link', color: 'text-sky-400' },
            { step: '04', title: 'Negotiate', desc: 'Comments & revisions', color: 'text-purple-400' },
            { step: '05', title: 'Signed', desc: 'E-signature complete', color: 'text-brand-blue' },
            { step: '06', title: 'Active', desc: 'Stored in legal vault', color: 'text-emerald-400' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className={`text-xl font-bold ${item.color} opacity-40 mb-1`}>{item.step}</div>
              <h4 className="text-xs font-medium text-white mb-0.5">{item.title}</h4>
              <p className="text-[10px] text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Template Library Preview */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Template Library</h2>
        <div className="space-y-2">
          {templateTypes.map((t, i) => (
            <div key={i} className="bg-navy-800/50 border border-navy-700/50 rounded-lg px-5 py-3.5 flex items-center gap-4">
              <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{t.name}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                t.status === 'Core' ? 'bg-brand-blue/10 text-brand-blue' :
                t.status === 'Growth' ? 'bg-purple-500/10 text-purple-400' :
                'bg-amber-500/10 text-amber-400'
              }`}>{t.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Key Terms Section */}
      <div className="bg-navy-800/30 border border-navy-700/30 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Standard Terms Coverage</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Scope of Work', desc: 'Deliverables, exclusions, acceptance criteria' },
            { label: 'Payment Terms', desc: '50/40/10 milestones, net-30, retainers' },
            { label: 'IP Ownership', desc: 'Work-for-hire, license grants, open source' },
            { label: 'Confidentiality', desc: 'Mutual NDA, data handling, retention' },
            { label: 'Liability & Indemnity', desc: 'Cap limits, warranty disclaimers' },
            { label: 'Cancellation', desc: 'Kill fees, notice periods, refund policy' },
            { label: 'Dispute Resolution', desc: 'Mediation, arbitration, jurisdiction' },
            { label: 'Managed Services', desc: 'SLA terms, support hours, uptime guarantees' },
          ].map((term, i) => (
            <div key={i} className="bg-navy-800/50 border border-navy-700/30 rounded-lg p-3">
              <p className="text-xs font-medium text-white mb-0.5">{term.label}</p>
              <p className="text-[10px] text-gray-500">{term.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
