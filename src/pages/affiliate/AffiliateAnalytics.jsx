import AffiliateToolShell from './AffiliateToolShell'
export default function AffiliateAnalytics() {
  return (
    <AffiliateToolShell
      icon="📊"
      title="Analytics"
      tagline="Your entire audience, one dashboard"
      description="Connect Instagram, TikTok, YouTube, X, and LinkedIn — see followers, engagement, reach, and revenue in one unified view. Creator tier adds AI insights that tell you why posts worked or didn't. Pro tier includes quarterly growth audits."
      features={[
        'Unified stats across IG, TikTok, YT, X, LinkedIn, Pinterest',
        'Follower growth trends (daily, weekly, monthly)',
        'Top-performing posts by platform',
        'Audience demographics cross-platform',
        'Best-time-to-post heatmap (when YOUR audience is active)',
        'AI performance insights (Creator+) — "this post underperformed because..."',
        'Revenue attribution — which post drove which commission',
        'UTM link generator + click tracking',
      ]}
      tierBreakdown={[
        { tier: 'Starter', headline: '1 platform', items: ['1 connected platform', 'Basic growth stats', 'Top 10 posts', 'UTM builder'] },
        { tier: 'Creator', headline: 'Unlimited + AI insights', items: ['All platforms', 'AI performance breakdowns', 'Cross-platform demographics', 'Revenue attribution'] },
        { tier: 'Pro', headline: 'Strategic reporting', items: ['Quarterly growth audits', 'Benchmarked vs peers', 'Custom KPI dashboards', 'Board-ready exports'] },
      ]}
    />
  )
}
