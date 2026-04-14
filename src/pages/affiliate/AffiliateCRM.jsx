import AffiliateToolShell from './AffiliateToolShell'
export default function AffiliateCRM() {
  return (
    <AffiliateToolShell
      icon="💼"
      title="Brand CRM"
      tagline="Your sponsor pipeline + rate card + deal templates in one place"
      description="Track every brand conversation from first outreach to signed deal. Keep rate cards, media kits, and contract templates organized. Creator tier adds AI pitch writer — paste a brand's website URL, get a tailored outreach email."
      features={[
        'Contact pipeline: lead → pitched → negotiating → booked → paid',
        'Brand profiles: industry, budget range, prior collabs, contact info',
        'Rate card generator — calculated from your engagement stats',
        'Media kit builder with 1-click PDF export',
        'Contract template library (influencer, UGC, ambassador, affiliate)',
        'Deal tracker with milestones + payment schedule',
        'AI pitch writer (Creator+) — customized email per brand',
        'Legal review queue (Pro) — flagged contracts reviewed by Liftori legal',
      ]}
      tierBreakdown={[
        { tier: 'Starter', headline: '10 contacts + templates', items: ['Up to 10 brand contacts', 'Basic pipeline tracker', 'Rate card templates', 'Generic contract starters'] },
        { tier: 'Creator', headline: 'Unlimited + AI pitches', items: ['Unlimited contacts', 'AI pitch writer', 'AI rate calculator', 'Media kit builder'] },
        { tier: 'Pro', headline: 'Full-service legal', items: ['Contract review by Liftori legal', 'Negotiation coaching', 'Dispute support', 'Enterprise brand introductions'] },
      ]}
    />
  )
}
