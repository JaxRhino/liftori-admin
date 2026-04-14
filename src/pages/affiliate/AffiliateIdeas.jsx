import AffiliateToolShell from './AffiliateToolShell'
export default function AffiliateIdeas() {
  return (
    <AffiliateToolShell
      icon="💡"
      title="Ideas Generator"
      tagline="Never run out of content to make"
      description="Get fresh content ideas tailored to your niche every day. Starter tier pulls from a curated library of 5,000+ proven ideas. Creator tier adds AI generation that factors in trending topics on your platforms right now + your past best-performers."
      features={[
        'Daily content idea feed, filterable by platform + niche',
        'Trending topic radar (Creator+) — what\'s hot on TikTok/YT this week',
        'Competitor watch — see top 10 creators in your niche + what\'s working',
        'AI idea generator (Creator+) — custom prompts based on your audience',
        'Hook + format + CTA packaged together for each idea',
        'Save ideas to your content calendar in one click',
        'Niche-specific templates (fitness, finance, travel, food, tech, etc.)',
        '"Build a series" mode — AI creates a 7-part content arc from one topic',
      ]}
      tierBreakdown={[
        { tier: 'Starter', headline: '10 ideas/mo from library', items: ['10 ideas per month', 'Curated niche library', 'Manual filtering', 'Save to calendar'] },
        { tier: 'Creator', headline: 'Unlimited + AI + trends', items: ['Unlimited ideas', 'AI custom generator', 'Trend radar', 'Competitor watch'] },
        { tier: 'Pro', headline: 'Strategy-level', items: ['Content strategy audits', 'Personalized 90-day content plan', 'Quarterly trend briefings', 'Content consultant review'] },
      ]}
    />
  )
}
