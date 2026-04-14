import AffiliateToolShell from './AffiliateToolShell'

export default function AffiliateContent() {
  return (
    <AffiliateToolShell
      icon="✍️"
      title="Content Creator"
      tagline="Write captions, scripts, hooks — with or without AI help"
      description="A full writing workspace built for creators. Start with a template, customize the hook + CTA, then push directly to Scheduler or copy to your platform. Creator tier unlocks AI generation for captions, scripts, and hooks trained on proven viral formulas."
      features={[
        'Caption templates — 100+ proven hook + body + CTA formulas',
        'Script outlines — intro, value, CTA frameworks for TikTok, YouTube Shorts, Reels',
        'Hook library — 500+ high-retention openers, filterable by niche',
        'CTA generator — niche-specific calls to action',
        'Title + thumbnail copy pairs for YouTube',
        'Brand voice training (Creator tier) — upload 5 examples, AI matches',
        'AI caption generator (Creator tier) — 10 variants per post',
        'Repurpose mode — take 1 long-form, get 5 short-form drafts (Creator+)',
      ]}
      tierBreakdown={[
        { tier: 'Starter', headline: 'Template library access', items: ['100+ caption templates', '500+ hook library', 'Manual writing workspace', 'Save & organize drafts'] },
        { tier: 'Creator', headline: 'AI-powered writing', items: ['AI caption generator', 'AI hook rewriter', 'Brand voice training', '50 AI generations/mo'] },
        { tier: 'Pro', headline: 'Unlimited + coaching', items: ['Unlimited AI generations', 'Dedicated writing coach review', 'Custom voice model', 'Priority queue'] },
      ]}
    />
  )
}
