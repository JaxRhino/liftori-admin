import AffiliateToolShell from './AffiliateToolShell'
export default function AffiliateLibrary() {
  return (
    <AffiliateToolShell
      icon="📚"
      title="Content Library"
      tagline="Store all your media, assets, and branded templates"
      description="Centralized storage for photos, videos, templates, brand assets, and proven content. Search by tag, filter by type, drag into the Content Creator or Scheduler. Includes Liftori's FTC disclosure templates pre-loaded."
      features={[
        'Upload media: photos, videos, audio, PDFs, documents',
        'Auto-tagging with AI (Creator+): detects faces, products, locations',
        'Smart search — find any asset by keyword or tag',
        'Branded templates: color palette, logo, typography presets',
        'FTC disclosure templates pre-loaded (Liftori affiliate-compliant copy)',
        'Proven content archive — save high-performing posts with their stats',
        'Share with collaborators (Creator+)',
        'Version history on templates',
      ]}
      tierBreakdown={[
        { tier: 'Starter', headline: '500 MB + templates', items: ['500 MB storage', 'Template library access', 'Basic search', 'Liftori FTC templates included'] },
        { tier: 'Creator', headline: '10 GB + AI tagging', items: ['10 GB storage', 'AI auto-tagging', 'Smart search', 'Share with team'] },
        { tier: 'Pro', headline: 'Unlimited + DAM', items: ['Unlimited storage', 'Full Digital Asset Management', 'Version control', 'Brand governance'] },
      ]}
    />
  )
}
