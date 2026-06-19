// ═══════════════════════════════════════════════════════════════════════
// Liftori Products registry
// ───────────────────────────────────────────────────────────────────────
// Single source of truth for the unified Products hub (/admin/products).
// Every CRM, web app, and mobile app Liftori builds is ONE product here.
// A product may have a CRM/system (systemUrl) AND a mobile app (app) — both
// live inside its ProductDetail tabs, so nothing scatters across the sidebar.
//
// Products with no DB/app yet still get a full product page — their App tab
// renders an honest "not provisioned" empty state with a paste-a-URL bar.
// ═══════════════════════════════════════════════════════════════════════

// Mobile-app config shape (consumed by <AppPreviewPane/>):
//   { previewUrl, status, note, eas:{...}, repo:{...}, channels:[...] }
// A product with app:null shows the App tab as a planned/empty preview.

const CHANNELS = [
  { key: 'preview', label: 'Preview', description: 'Sideloaded testers — Ryan + Mike + crew', tint: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20' },
  { key: 'production', label: 'Production', description: 'Live customers — Play / App Store builds', tint: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { key: 'development', label: 'Development', description: 'Dev client w/ Metro bundler', tint: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
]

export const PRODUCTS = [
  {
    slug: 'roofx',
    name: 'RoofX',
    tagline: 'Roofing CRM + field app — sales, jobs, estimates & sign',
    category: 'CRM + App',
    status: 'live',
    systemLabel: 'Open CRM',
    systemUrl: '/crm/6be83acc-d777-439c-becf-a41fb77614aa/dashboard',
    liveSite: 'https://roofx.liftori.ai',
    stack: ['Liftori CRM shell', 'Supabase', 'Expo / React Native', 'Vercel'],
    description:
      'RoofX is a full roofing CRM on the Liftori tenant shell paired with a field-crew mobile app. Office runs the CRM (sales pipeline, work orders, estimates, scheduling); crews run the RoofX app for jobs, photos, estimates and on-site signature capture.',
    whatsBuilt: [
      'Tenant CRM (Sales + Operations hubs) live at roofx.liftori.ai',
      'RoofX mobile field app on the Liftori CRM mobile shell',
      'Estimates + on-site signature flow',
      'Owner login + crew logins',
    ],
    scope:
      'Roofing vertical of the Liftori CRM. Sales-to-ops handoff, estimate builder with margins, work-order scheduling, and a field app for crews. Mobile shares the tenant Supabase project.',
    notes: 'Tenant CRM runs on the anon key today (see tenant-crm-no-auth blocker); owner-auth bridge pending before broad rollout.',
    app: {
      status: 'live',
      previewUrl: import.meta.env.VITE_ROOFX_PREVIEW_URL || 'https://roofx-app.liftori.ai',
      note: 'RoofX tenant on the Liftori CRM mobile shell.',
      eas: { projectId: '', account: 'rhinomarch', expoSlug: 'liftori-crm-mobile' },
      repo: { org: 'JaxRhino', name: 'liftori-crm-mobile', branch: 'main' },
      channels: CHANNELS,
    },
  },
  {
    slug: 'csc-services',
    name: 'CSC Services',
    tagline: 'KEC hood & duct CRM + Liftori-Hood field app',
    category: 'CRM + App',
    status: 'live',
    systemLabel: 'Open CRM',
    systemUrl: '/crm/88888888-0002-0000-0000-000000000001/dashboard',
    liveSite: 'https://www.cleanmyducts.com',
    stack: ['Liftori CRM shell (KEC hubs)', 'Supabase', 'Expo / React Native', 'Vercel'],
    description:
      'CSC Services Hood & Duct — the flagship LABOS-KEC tenant. Kitchen-exhaust cleaning CRM with certificates, deficiencies and an AHJ portal, paired with the Liftori-Hood field-technician app.',
    whatsBuilt: [
      'KEC CRM tenant (cleanings, certificates, deficiencies, AHJ portal)',
      'Liftori-Hood field app (Wave 0 scaffold, web preview)',
      'IKECA-aligned KEC hubs',
    ],
    scope:
      'KEC vertical of the Liftori CRM for CSC Services. NFPA 96 certificates, deficiency tracking, compliance reporting, and a technician app for on-site cleaning + cert capture.',
    notes: 'Native Hood app build pending; web preview only for now. CSC re-provisioned onto the base CRM tenant.',
    app: {
      status: 'planned',
      previewUrl: import.meta.env.VITE_LIFTORI_HOOD_PREVIEW_URL || 'https://hood.liftori.ai',
      note: 'KEC field-technician app (CSC Field). Wave 0 scaffold — web preview only; native build pending.',
      eas: { projectId: '', account: 'rhinomarch', expoSlug: 'liftori-hood' },
      repo: { org: 'JaxRhino', name: 'liftori-crm-mobile', branch: 'main' },
      channels: CHANNELS,
    },
  },
  {
    slug: 'apex-hvac',
    name: 'Apex HVAC',
    tagline: 'HVAC / mechanical services CRM (demo tenant)',
    category: 'CRM',
    status: 'demo',
    systemLabel: 'Open CRM',
    systemUrl: '/crm/e3286192-580d-4478-8b88-7d44fd9f4de0/dashboard',
    liveSite: null,
    stack: ['Liftori CRM shell', 'Supabase', 'Vercel'],
    description:
      'Apex HVAC is the HVAC / mechanical-services demo tenant on the Liftori CRM. Carries two custom sales pipelines (install + service) on top of the standard Sales and Operations hubs.',
    whatsBuilt: [
      'HVAC CRM demo tenant',
      'Two custom sales pipelines (install + service)',
      'Standard Sales + Operations hubs',
    ],
    scope:
      'HVAC vertical demo used for sales walkthroughs. A field app on the shared CRM mobile shell is the natural next add — the App tab is built and ready for when it ships.',
    notes: 'Demo tenant. No mobile app provisioned yet.',
    app: null,
  },
  {
    slug: 'vj-thrift-finds',
    name: 'VJ Thrift Finds',
    tagline: 'Vintage / thrift e-commerce storefront + admin',
    category: 'E-Commerce',
    status: 'live',
    systemLabel: 'Open Admin',
    systemUrl: '/crm/bfd355a4-17f4-4c7a-8450-b91063b6292b/dashboard',
    liveSite: 'https://www.vjthriftfinds.com',
    stack: ['Liftori e-commerce CRM', 'Supabase', 'Vercel'],
    description:
      "Liftori's first client platform — Vanessa's vintage / thrift storefront with a photo-first listing flow, AI draft descriptions, and a full e-commerce admin. Showcase build for the ecommerce CRM variant.",
    whatsBuilt: [
      'Storefront at vjthriftfinds.com',
      'E-commerce CRM admin (listings, orders, customers, social)',
      'Photo-first scan-to-list + AI draft',
      'Client DM channel to the Liftori team',
    ],
    scope:
      'Ecommerce variant of the Liftori CRM. Storefront + admin + Supabase catalog. A buyer/seller mobile app is a future add — the App tab is built and ready.',
    notes: 'Storefront cutover edits were blocked on the GitHub BlobEditor bug; DB side done.',
    app: null,
  },
  {
    slug: 'bolo-go',
    name: 'BOLO Go',
    tagline: 'Reseller / operator mobile app — Android (iOS soon)',
    category: 'Mobile App',
    status: 'live',
    systemLabel: null,
    systemUrl: null,
    liveSite: 'https://bolo.liftori.ai',
    stack: ['Expo / React Native', 'Supabase', 'EAS'],
    description:
      'BOLO Go is the reseller / operator mobile app — scanner, listings, and orders for resellers. App-first product; no CRM surface. Liftori takes an 8% platform fee on BOLO Go sales.',
    whatsBuilt: [
      'Scanner / listings / orders screens',
      'Reseller community feed',
      'Platform-fee system (8% cut)',
      'Android build (iOS coming)',
    ],
    scope:
      'Standalone reseller app. Feature-complete; remaining launch work pinned on Stripe-live + store submission.',
    notes: 'liftop repo is private — grab the signed APK from EAS builds. iOS coming soon.',
    app: {
      status: 'live',
      previewUrl: import.meta.env.VITE_BOLO_GO_PREVIEW_URL || 'https://bolo.liftori.ai',
      note: 'Android only — iOS coming soon.',
      eas: { projectId: '308f99c6-f70f-4244-b910-276275fe46a8', account: 'rhinomarch', expoSlug: 'liftop' },
      repo: { org: 'JaxRhino', name: 'liftop', branch: 'main', private: true },
      channels: CHANNELS,
    },
  },
  {
    slug: 'liftori-app',
    name: 'Liftori App',
    tagline: 'Internal Liftori mobile companion — Expo + RN',
    category: 'Mobile App',
    status: 'live',
    systemLabel: null,
    systemUrl: null,
    liveSite: 'https://app.liftori.ai',
    stack: ['Expo / React Native', 'Supabase', 'EAS'],
    description:
      "Liftori's internal mobile companion — Home Pulse metrics, team chat, and the full EOS suite (Scorecard, Rocks, Issues, To-Dos, Headlines, L10, V/TO, Accountability Chart) for the founding team on the go.",
    whatsBuilt: [
      'Home Pulse metrics',
      'Team chat (DMs + channels)',
      'Full EOS suite incl. L10 meeting runner',
      'Web preview at app.liftori.ai',
    ],
    scope:
      'Internal daily-driver app for the Liftori team. EAS production = AAB, preview = APK; OTA on every push to main.',
    notes: 'Internal-only. Not a customer product.',
    app: {
      status: 'live',
      previewUrl:
        import.meta.env.VITE_LIFTORI_APP_PREVIEW_URL ||
        import.meta.env.VITE_MOBILE_PREVIEW_URL ||
        'https://app.liftori.ai',
      eas: {
        projectId: 'b6c52b3d-9864-4839-b480-49cb95d5e354',
        account: 'rhinomarch',
        expoSlug: 'liftori-mobile',
        appVersion: '0.1.0',
        runtimePolicy: 'appVersion',
        iosBundle: 'ai.liftori.mobile',
        androidPackage: 'ai.liftori.mobile',
      },
      repo: { org: 'JaxRhino', name: 'liftori-mobile', branch: 'main' },
      channels: CHANNELS,
    },
  },
  {
    slug: 'liftori-freight',
    name: 'Liftori-Freight',
    tagline: 'Freight OS — broker cockpit + carrier / fleet',
    category: 'System',
    status: 'live',
    systemLabel: 'Open System',
    systemUrl: '/admin/freight',
    liveSite: null,
    stack: ['liftori-admin (React + Vite)', 'Supabase (freight_* tables)', 'Vercel'],
    description:
      "Liftori's own freight operating system — a broker cockpit plus carrier / fleet & maintenance, with an AI email-to-load engine on the roadmap. First customer: BIH/BHF (25 trucks, all 53ft dry van).",
    whatsBuilt: [
      'Broker cockpit (shippers, loads, commissions)',
      'Fleet + maintenance',
      'Dispatch / combo bridge + AI email-to-load (next)',
    ],
    scope:
      'Mode-driven freight OS behind the /admin/freight route. 12-wave plan; AI email-to-load is the centerpiece. A dispatcher / driver mobile app is a future add — the App tab is built and ready.',
    notes: 'Tracked as an In-House Build (codename freight), ~42% complete.',
    app: null,
  },
  {
    slug: 'lawncare',
    name: 'Lawncare CRM',
    tagline: 'Lawncare / landscaping vertical — not provisioned yet',
    category: 'CRM',
    status: 'planned',
    systemLabel: 'Provision Tenant',
    systemUrl: '/admin/new-tenant',
    liveSite: null,
    stack: ['Liftori CRM shell', 'Supabase', 'Vercel'],
    description:
      'Lawncare / landscaping vertical of the Liftori CRM. Not provisioned yet — this product page is built and ready so the build can be scoped and a tenant spun up on demand.',
    whatsBuilt: [],
    scope: 'Standard Liftori CRM (Sales + Operations) tuned for lawncare: recurring service routes, seasonal scheduling, crew dispatch, and a field app on the shared CRM mobile shell.',
    notes: 'No tenant DB yet. Provision via New Tenant when a customer signs.',
    app: null,
  },
  {
    slug: 'tree-services',
    name: 'Tree Services CRM',
    tagline: 'Tree services vertical — not provisioned yet',
    category: 'CRM',
    status: 'planned',
    systemLabel: 'Provision Tenant',
    systemUrl: '/admin/new-tenant',
    liveSite: null,
    stack: ['Liftori CRM shell', 'Supabase', 'Vercel'],
    description:
      'Tree-services vertical of the Liftori CRM. Not provisioned yet — page is built and ready for scoping and on-demand tenant spin-up.',
    whatsBuilt: [],
    scope: 'Standard Liftori CRM tuned for tree services: estimates with risk/access notes, crew + equipment scheduling, and a field app on the shared CRM mobile shell.',
    notes: 'No tenant DB yet. Provision via New Tenant when a customer signs.',
    app: null,
  },
  {
    slug: 'junk-removal',
    name: 'Junk Removal CRM',
    tagline: 'Junk removal vertical — not provisioned yet',
    category: 'CRM',
    status: 'planned',
    systemLabel: 'Provision Tenant',
    systemUrl: '/admin/new-tenant',
    liveSite: null,
    stack: ['Liftori CRM shell', 'Supabase', 'Vercel'],
    description:
      'Junk-removal vertical of the Liftori CRM. Not provisioned yet — page is built and ready for scoping and on-demand tenant spin-up.',
    whatsBuilt: [],
    scope: 'Standard Liftori CRM tuned for junk removal: volume-based estimates, route + truck scheduling, and a field app on the shared CRM mobile shell.',
    notes: 'No tenant DB yet. Provision via New Tenant when a customer signs.',
    app: null,
  },
  {
    slug: 'home-improvement',
    name: 'Home Improvement CRM',
    tagline: 'Home improvement vertical — not provisioned yet',
    category: 'CRM',
    status: 'planned',
    systemLabel: 'Provision Tenant',
    systemUrl: '/admin/new-tenant',
    liveSite: null,
    stack: ['Liftori CRM shell', 'Supabase', 'Vercel'],
    description:
      'Home-improvement vertical of the Liftori CRM. Not provisioned yet — page is built and ready for scoping and on-demand tenant spin-up.',
    whatsBuilt: [],
    scope: 'Standard Liftori CRM tuned for home improvement: project estimates, sub-contractor scheduling, change orders, and a field app on the shared CRM mobile shell.',
    notes: 'No tenant DB yet. Provision via New Tenant when a customer signs.',
    app: null,
  },
]

export function getProduct(slug) {
  return PRODUCTS.find((p) => p.slug === slug) || null
}

export const CATEGORY_TINT = {
  'CRM + App': 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  CRM: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  'Mobile App': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'E-Commerce': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  System: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

export const STATUS_TINT = {
  live: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  demo: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  planned: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}
