import AffiliateToolShell from './AffiliateToolShell'
export default function AffiliateInventory() {
  return (
    <AffiliateToolShell
      icon="📦"
      title="Inventory"
      tagline="Track merch, digital products, and physical fulfillment"
      description="For creators selling merch, digital products, or branded goods — keep stock counts, low-stock alerts, supplier info, and fulfillment status in one place. Integrates with Shopify, Printful, and print-on-demand providers (Creator+)."
      features={[
        'Product catalog with SKUs, variants, cost/price',
        'Real-time stock counts + low-stock alerts',
        'Sales tracker — which product is moving',
        'Supplier contacts + order history',
        'Shopify/Printful/Gelato sync (Creator+)',
        'Automated reorder triggers',
        'Profit margin per product',
        'Multi-warehouse / drop-ship support (Pro)',
      ]}
      tierBreakdown={[
        { tier: 'Starter', headline: 'Manual inventory', items: ['Up to 25 SKUs', 'Manual count + update', 'Low-stock alerts', 'Sales log'] },
        { tier: 'Creator', headline: 'Integrated fulfillment', items: ['Unlimited SKUs', 'Shopify/Printful sync', 'Auto-reorder', 'Margin analysis'] },
        { tier: 'Pro', headline: 'Operations-grade', items: ['Multi-warehouse', 'Drop-ship coordination', 'API access', 'Dedicated fulfillment support'] },
      ]}
    />
  )
}
