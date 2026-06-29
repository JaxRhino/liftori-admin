// ============================================================
// permissions.js — central RBAC catalog for the Liftori admin.
// Single source of truth for:
//   - PERMISSION_GROUPS  : the toggleable keys, rendered in Team > Permissions
//   - NAV_PERMISSION_MAP : nav label -> permission key (sidebar visibility)
//   - ROUTE_PERMISSION_MAP: /admin route prefix -> key (hard route guards)
//   - BYPASS_ROLES / ROLE_NAME_BY_CODE : role plumbing
//   - can() / canAny()   : permission checks (perms['*']===true = full bypass)
// Permissions are loaded per-user via the get_my_permissions() RPC (fail-closed).
// ============================================================

// Roles that bypass the permission map entirely (always see everything).
// Mirrored in the get_my_permissions() SQL function — keep in sync.
export const BYPASS_ROLES = ['super_admin', 'admin', 'dev', 'tester']

// profile.role (code) -> team_roles.name (where the permission map is stored)
export const ROLE_NAME_BY_CODE = {
  super_admin: 'CEO',
  admin: 'CEO',
  dev: 'Chief Developer',
  tester: 'Platform Tester',
  sales_director: 'Director of Sales',
  sales_rep: 'Sales Rep',
  affiliate: 'Affiliate',
  call_agent: 'Call Agent',
}

// Full catalog. Existing keys (in use by stored role maps) are preserved;
// new surfaces get new keys. Grouped to match the sidebar.
export const PERMISSION_GROUPS = [
  {
    group: 'Dashboard & Call Center',
    permissions: [
      { key: 'dashboard.view', label: 'Dashboard', description: 'Main admin dashboard and metrics' },
      { key: 'call_center.access', label: 'Call Center', description: 'Call center, voicemails, call lists, AI agents' },
    ],
  },
  {
    group: 'Sales Hub',
    permissions: [
      { key: 'sales.products', label: 'Products (demo)', description: 'Browse Liftori products available to sell + demos' },
      { key: 'sales.lead_hunter', label: 'Lead Hunter', description: 'Search, enrich, and manage leads' },
      { key: 'sales.customers', label: 'Customers', description: 'View and manage customer accounts' },
      { key: 'sales.pipeline', label: 'Pipeline', description: 'View and manage the deal pipeline' },
      { key: 'sales.estimates', label: 'Estimates', description: 'Create and send estimates' },
      { key: 'sales.agreements', label: 'Agreements', description: 'Manage client agreements' },
      { key: 'sales.commissions', label: 'Commissions', description: 'View commission reports' },
      { key: 'sales.waitlist', label: 'Waitlist', description: 'Manage the waitlist signups' },
      { key: 'sales.investors', label: 'Investors', description: 'Investor pipeline and updates' },
    ],
  },
  {
    group: 'Projects & Platforms',
    permissions: [
      { key: 'projects.view', label: 'View Projects', description: 'See project list and details' },
      { key: 'projects.manage', label: 'Manage Projects', description: 'Create, edit, and update projects' },
      { key: 'platforms.manage', label: 'Manage Platforms', description: 'Deploy and manage client sites' },
    ],
  },
  {
    group: 'Marketing',
    permissions: [
      { key: 'marketing.dashboard', label: 'Marketing Dashboard', description: 'View marketing analytics' },
      { key: 'marketing.campaigns', label: 'Campaigns', description: 'Create and manage campaigns' },
      { key: 'marketing.content', label: 'Content Creator', description: 'Create marketing content' },
    ],
  },
  {
    group: 'Communications',
    permissions: [
      { key: 'comms.hub', label: 'Comms Hub', description: 'Access the communications hub' },
      { key: 'comms.chat', label: 'Chat', description: 'Send and receive messages' },
      { key: 'comms.rally', label: 'Video Chat', description: 'Join and host video calls' },
      { key: 'comms.support', label: 'Support Tickets', description: 'Manage support tickets' },
    ],
  },
  {
    group: 'EOS',
    permissions: [
      { key: 'eos.dashboard', label: 'EOS Dashboard', description: 'EOS overview and leadership' },
      { key: 'eos.scorecard', label: 'Scorecard', description: 'View and update the scorecard' },
      { key: 'eos.rocks', label: 'Rocks', description: 'Quarterly rocks and goals' },
      { key: 'eos.meetings', label: 'L10 Meetings', description: 'Join and manage L10 meetings' },
      { key: 'eos.issues', label: 'Issues & Todos', description: 'Issues, todos, and headlines' },
    ],
  },
  {
    group: 'Finance',
    permissions: [
      { key: 'finance.dashboard', label: 'Finance Dashboard', description: 'Financial overview' },
      { key: 'finance.invoices', label: 'Invoices & Payments', description: 'Invoices, payments, expenses' },
      { key: 'finance.reports', label: 'Financial Reports', description: 'Journal, reports, accounts, commissions' },
    ],
  },
  {
    group: 'Operations',
    permissions: [
      { key: 'ops.dashboard', label: 'Ops Dashboard', description: 'Operations overview' },
      { key: 'ops.measurement_requests', label: 'Measurement Requests', description: 'Roof report / measurement queue' },
      { key: 'ops.projects', label: 'Ops Projects', description: 'Operations project board' },
      { key: 'ops.affiliates', label: 'Affiliates', description: 'Manage affiliates' },
      { key: 'ops.discount_codes', label: 'Discount Codes', description: 'Create and manage discounts' },
      { key: 'ops.plans', label: 'Plans', description: 'Manage subscription plans' },
      { key: 'ops.cost_tracker', label: 'Cost Tracker', description: 'Operating costs, subscriptions, investments' },
      { key: 'ops.platform_fees', label: 'Platform Fees', description: 'Platform fee settings' },
      { key: 'ops.team', label: 'Team Management', description: 'Invite users, roles, onboarding' },
      { key: 'ops.pulse', label: 'Pulse', description: 'Platform pulse metrics' },
      { key: 'ops.leadership_qc', label: 'Leadership QC', description: 'Leadership quality control' },
      { key: 'ops.hr_hub', label: 'HR Hub', description: 'HR hub' },
      { key: 'ops.company_docs', label: 'Company Docs', description: 'Internal company documents' },
      { key: 'ops.wizard', label: 'Wizard Builder', description: 'Build onboarding wizards' },
    ],
  },
  {
    group: 'Builds',
    permissions: [
      { key: 'builds.custom_builds', label: 'Custom Builds', description: 'Customer custom build workspaces' },
      { key: 'builds.in_house', label: 'In-House Builds', description: 'Internal build workspaces' },
      { key: 'builds.products', label: 'Products Hub', description: 'Liftori product registry + workspaces' },
      { key: 'builds.feature_library', label: 'Feature Library', description: 'Feature knowledge base' },
    ],
  },
  {
    group: 'Dev Lab',
    permissions: [
      { key: 'devlab.dashboard', label: 'Dev Lab', description: 'Dev Lab dashboard' },
      { key: 'devlab.dev_team', label: 'Dev Team', description: 'Autonomous dev team workspace' },
      { key: 'devlab.testing', label: 'Testing', description: 'Testing dashboards' },
      { key: 'devlab.work_queue', label: 'Work Queue', description: 'Build work queue' },
      { key: 'devlab.new_tenant', label: 'New Tenant', description: 'Provision a new CRM tenant' },
      { key: 'devlab.liftori_build', label: 'Liftori Build', description: 'Liftori platform build console' },
    ],
  },
  {
    group: 'Verticals',
    permissions: [
      { key: 'freight.access', label: 'Freight', description: 'BIH Logistics freight hub' },
      { key: 'csc.access', label: 'CSC Services', description: 'CSC Services hood-cleaning hub' },
      { key: 'consulting.access', label: 'Consulting', description: 'Consulting appointments and clients' },
      { key: 'crm.access', label: 'Tenant CRMs', description: 'Open client CRM backends' },
    ],
  },
  {
    group: 'Tools',
    permissions: [
      { key: 'tools.tasks', label: 'Tasks', description: 'Personal and team tasks' },
      { key: 'tools.notes', label: 'Notes', description: 'Create and manage notes' },
      { key: 'tools.calendar', label: 'Calendar', description: 'View and manage the calendar' },
    ],
  },
  {
    group: 'System',
    permissions: [
      { key: 'system.settings', label: 'Profile & Settings', description: 'Edit profile, picture, notifications' },
      { key: 'liftori_settings.access', label: 'Liftori Settings', description: 'Internal CRM library, automations, templates' },
      { key: 'system.billing', label: 'Billing', description: 'Billing and subscriptions' },
      { key: 'system.integrations', label: 'Integrations', description: 'Third-party integrations' },
    ],
  },
]

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key))

// Top-level / section nav label -> permission key.
export const NAV_PERMISSION_MAP = {
  'Dashboard': 'dashboard.view',
  'Marketing': 'marketing.dashboard',
  'Call Center': 'call_center.access',
  'Communications': 'comms.hub',
  'Chat': 'comms.chat',
  'EOS': 'eos.dashboard',
  'Finance': 'finance.dashboard',
  'Liftori Settings': 'liftori_settings.access',
  // Sales Hub items
  'Products': 'sales.products',
  'Lead Hunter': 'sales.lead_hunter',
  'Customers': 'sales.customers',
  'Pipeline': 'sales.pipeline',
  'Estimates': 'sales.estimates',
  'Agreements': 'sales.agreements',
  'Commissions': 'sales.commissions',
  'Investors': 'sales.investors',
  'Waitlist': 'sales.waitlist',
  // Tools
  'Tasks': 'tools.tasks',
  'Notes': 'tools.notes',
  'Calendar': 'tools.calendar',
  'Video Chat': 'comms.rally',
  'Company Docs': 'ops.company_docs',
  'Settings': 'system.settings',
  // Ops items
  'Ops Dashboard': 'ops.dashboard',
  'Measurement Requests': 'ops.measurement_requests',
  'Affiliates': 'ops.affiliates',
  'Discount Codes': 'ops.discount_codes',
  'Plans': 'ops.plans',
  'Cost Tracker': 'ops.cost_tracker',
  'Platform Fees': 'ops.platform_fees',
  'Team': 'ops.team',
  'Pulse': 'ops.pulse',
  'Leadership QC': 'ops.leadership_qc',
  'HR Hub': 'ops.hr_hub',
  // Builds / Dev Lab
  'Custom Builds': 'builds.custom_builds',
  'Feature Library': 'builds.feature_library',
  'Dev Lab Dashboard': 'devlab.dashboard',
  'Dev Team': 'devlab.dev_team',
  'Testing': 'devlab.testing',
  'Work Queue': 'devlab.work_queue',
  'Wizard': 'ops.wizard',
  'New Tenant': 'devlab.new_tenant',
  'Liftori': 'devlab.liftori_build',
  'Support Tickets': 'comms.support',
  'Customer Portal': 'projects.view',
}

// Route prefix -> permission key, for hard guards. Longest prefix wins.
// Paths not listed are unguarded (any admin-area user may open).
export const ROUTE_PERMISSION_MAP = {
  '/admin/marketing': 'marketing.dashboard',
  '/admin/finance': 'finance.dashboard',
  '/admin/call-center': 'call_center.access',
  '/admin/voicemails': 'call_center.access',
  '/admin/cc-team': 'call_center.access',
  '/admin/call-lists': 'call_center.access',
  '/admin/ai-agents': 'call_center.access',
  '/admin/eos': 'eos.dashboard',
  '/admin/comms': 'comms.hub',
  '/admin/chat': 'comms.chat',
  '/admin/rally': 'comms.rally',
  '/admin/support-tickets': 'comms.support',
  '/admin/liftori-settings': 'liftori_settings.access',
  '/admin/lead-hunter': 'sales.lead_hunter',
  '/admin/customers': 'sales.customers',
  '/admin/pipeline': 'sales.pipeline',
  '/admin/estimates': 'sales.estimates',
  '/admin/agreements': 'sales.agreements',
  '/admin/commissions': 'sales.commissions',
  '/admin/waitlist': 'sales.waitlist',
  '/admin/investors': 'sales.investors',
  '/admin/projects': 'projects.view',
  '/admin/platforms': 'platforms.manage',
  '/admin/ops-dashboard': 'ops.dashboard',
  '/admin/ops/': 'ops.dashboard',
  '/admin/measurement-requests': 'ops.measurement_requests',
  '/admin/affiliates': 'ops.affiliates',
  '/admin/discount-codes': 'ops.discount_codes',
  '/admin/plans': 'ops.plans',
  '/admin/cost-tracker': 'ops.cost_tracker',
  '/admin/platform-fees': 'ops.platform_fees',
  '/admin/team': 'ops.team',
  '/admin/pulse': 'ops.pulse',
  '/admin/leadership-qc': 'ops.leadership_qc',
  '/admin/hr-hub': 'ops.hr_hub',
  '/admin/company-docs': 'ops.company_docs',
  '/admin/wizard': 'ops.wizard',
  '/admin/custom-builds': 'builds.custom_builds',
  '/admin/in-house-builds': 'builds.in_house',
  '/admin/products': 'builds.products',
  '/admin/feature-library': 'builds.feature_library',
  '/admin/dev-lab': 'devlab.dashboard',
  '/admin/dev-team': 'devlab.dev_team',
  '/admin/testing': 'devlab.testing',
  '/admin/work-queue': 'devlab.work_queue',
  '/admin/new-tenant': 'devlab.new_tenant',
  '/admin/liftori': 'devlab.liftori_build',
  '/admin/freight': 'freight.access',
  '/admin/csc': 'csc.access',
  '/admin/consulting': 'consulting.access',
  '/admin/sales-products': 'sales.products',
  '/admin/tasks': 'tools.tasks',
  '/admin/notes': 'tools.notes',
  '/admin/calendar': 'tools.calendar',
}

// Routes only founders (super_admin via email allowlist) may open.
export const FOUNDER_ONLY_ROUTE_PREFIXES = ['/admin/super-admin']

export function can(perms, key) {
  if (!perms) return false
  if (perms['*'] === true) return true
  if (!key) return true
  return perms[key] === true
}

export function canAny(perms, keys) {
  if (perms && perms['*'] === true) return true
  return (keys || []).some(k => can(perms, k))
}

// Resolve the gating key for a pathname using the longest matching prefix.
export function permKeyForPath(pathname) {
  let best = null
  for (const prefix in ROUTE_PERMISSION_MAP) {
    if (pathname === prefix || pathname.startsWith(prefix)) {
      if (!best || prefix.length > best.length) best = prefix
    }
  }
  return best ? ROUTE_PERMISSION_MAP[best] : null
}
