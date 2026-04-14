import AffiliateToolShell from './AffiliateToolShell'
export default function AffiliateScheduler() {
  return (
    <AffiliateToolShell
      icon="📅"
      title="Scheduler"
      tagline="Plan + auto-post across every platform"
      description="Queue content for Instagram, TikTok, YouTube Shorts, X, LinkedIn, and Pinterest from one calendar. Best-time-to-post suggestions based on your audience's active hours. Drag-drop week view."
      features={[
        'Multi-platform connection (IG, TikTok, YT Shorts, X, LinkedIn, Pinterest)',
        'Visual week/month calendar with drag-drop rescheduling',
        'Per-platform caption + hashtag variants',
        'Best-time-to-post recommendations (Creator+)',
        'Recurring post templates',
        'Approval workflows for agencies managing creators',
        'Failed-post retry + error logs',
        'Preview how post looks on each platform',
      ]}
      tierBreakdown={[
        { tier: 'Starter', headline: '1 account, 10 posts/mo', items: ['1 connected platform', '10 scheduled posts per month', 'Basic calendar view', 'Manual scheduling'] },
        { tier: 'Creator', headline: '5 accounts, unlimited posts', items: ['5 connected platforms', 'Unlimited scheduled posts', 'AI best-time suggestions', 'Cross-post with platform-optimized captions'] },
        { tier: 'Pro', headline: 'Agency-level', items: ['Unlimited platforms', 'Multi-brand management', 'Approval workflows', 'White-label exports'] },
      ]}
    />
  )
}
