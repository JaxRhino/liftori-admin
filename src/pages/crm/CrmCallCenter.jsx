import { HubPage, Section, StatCard, EmptyState } from './_shared'

export default function CrmCallCenter() {
  return (
    <HubPage title="Call Center" subtitle="Scale plan — inbound/outbound calling, speed-to-lead, and call logging">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Calls Today" value="—" />
        <StatCard label="Avg Speed to Lead" value="—" />
        <StatCard label="Connected" value="—" />
        <StatCard label="Voicemails" value="—" />
      </div>
      <Section title="Call Center">
        <div className="p-2">
          <EmptyState
            title="Call Center is part of your Scale plan"
            description="Built-in telephony, speed-to-lead routing, call recording, a live dialer, and voicemail drop for your team — wired directly into this CRM. This module is being built out for your tenant."
          />
        </div>
      </Section>
    </HubPage>
  )
}
