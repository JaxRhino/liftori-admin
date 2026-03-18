import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const TOTAL_STEPS = 9
const BOOK_TOTAL_STEPS = 11

const STEPS = [
  { id: 1, title: 'Your Vision', subtitle: 'What do you want to build?' },
  { id: 2, title: 'Target Audience', subtitle: 'Who is this for?' },
  { id: 3, title: 'App Type', subtitle: 'What kind of product?' },
  { id: 4, title: 'Core Features', subtitle: 'What should it do?' },
  { id: 5, title: 'Design & Branding', subtitle: 'How should it look and feel?' },
  { id: 6, title: 'Pages & Content', subtitle: 'What pages or sections do you need?' },
  { id: 7, title: 'Business Context', subtitle: 'Tell us about your business' },
  { id: 8, title: 'Timeline & Budget', subtitle: 'When and how much?' },
  { id: 9, title: 'Review & Submit', subtitle: 'Confirm your project details' },
]

const BOOK_STEP_OVERRIDES = {
  4: { title: 'Your Path', subtitle: 'How can we help with your book?' },
  5: { title: 'Book Details', subtitle: 'Tell us about your book' },
  6: { title: 'Your Story', subtitle: 'The heart of your project' },
  7: { title: 'Cover Preferences', subtitle: 'How should your book look?' },
  8: { title: 'Publishing Help', subtitle: 'Do you want help publishing?' },
  9: { title: 'Your Estimate', subtitle: 'Review and approve your project estimate' },
  10: { title: 'Timeline & Budget', subtitle: 'When and how much?' },
  11: { title: 'Review & Submit', subtitle: 'Confirm your book project details' },
}

const CRM_STEP_OVERRIDES = {
  4: { title: 'CRM Features', subtitle: 'What does your CRM need to do?' },
  5: { title: 'Pipeline Setup', subtitle: 'How do your deals or contacts flow?' },
  6: { title: 'Data & Import', subtitle: 'What data do you already have?' },
  7: { title: 'Branding & Domain', subtitle: 'How should your CRM look and where will it live?' },
}

const WEB_STEP_OVERRIDES = {
  4: { title: 'Website Type', subtitle: 'What kind of website do you need?' },
  5: { title: 'Pages & Content', subtitle: "What pages and content are you working with?" },
  6: { title: 'Branding & Assets', subtitle: 'What brand materials do you have?' },
  7: { title: 'Delivery & Maintenance', subtitle: 'How do you want this delivered and supported?' },
}

function getStepInfo(step, appType) {
  if (appType === 'Book Writing App' && BOOK_STEP_OVERRIDES[step]) return BOOK_STEP_OVERRIDES[step]
  if (appType === 'CRM Builder' && CRM_STEP_OVERRIDES[step]) return CRM_STEP_OVERRIDES[step]
  if (appType === 'Website Builder' && WEB_STEP_OVERRIDES[step]) return WEB_STEP_OVERRIDES[step]
  return STEPS[step - 1] || STEPS[STEPS.length - 1]
}

// ─── APP TYPES ────────────────────────────────────────────────────────────────
const APP_TYPES = [
  { value: 'Web App', icon: '🌐', desc: 'Browser-based application' },
  { value: 'Mobile App', icon: '📱', desc: 'iOS and/or Android app' },
  { value: 'Business Platform', icon: '🏢', desc: 'Full business operating system' },
  { value: 'E-Commerce', icon: '🛒', desc: 'Online store with payments' },
  { value: 'Dashboard', icon: '📊', desc: 'Data visualization & analytics' },
  { value: 'Marketplace', icon: '🤝', desc: 'Multi-vendor platform' },
  { value: 'Book Writing App', icon: '📚', desc: 'AI-guided book creation & publishing', accent: 'amber' },
  { value: 'CRM Builder', icon: '🗂️', desc: 'Custom CRM built for your industry', accent: 'violet' },
  { value: 'Website Builder', icon: '✨', desc: 'Professional website — designed, launched & maintained', accent: 'emerald' },
]

// ─── BOOK CONSTANTS ───────────────────────────────────────────────────────────
const BOOK_PATHS = [
  { value: 'Write a New Book', icon: '✍️', desc: 'Start from scratch — AI guides you through every step' },
  { value: 'Finish & Publish', icon: '📖', desc: 'Pick up where you left off and get it published' },
]
const BOOK_GENRES = [
  'Fantasy', 'Science Fiction', 'Romance', 'Mystery / Thriller', 'Horror',
  'Historical Fiction', 'Literary Fiction', 'Self-Help', 'Business', 'Memoir / Biography',
  'True Crime', 'Health & Wellness', 'Parenting', 'Spirituality', "Children's", 'Young Adult', 'Other',
]
const COVER_STYLES = [
  { value: 'Modern & Minimal', desc: 'Clean, typography-forward design' },
  { value: 'Illustrated', desc: 'Hand-drawn or digital art' },
  { value: 'Photo-based', desc: 'Real photography with text overlay' },
  { value: 'Dark & Atmospheric', desc: 'Moody tones, dramatic imagery' },
  { value: 'Bright & Colorful', desc: 'Bold colors, eye-catching' },
  { value: 'Classic & Elegant', desc: 'Timeless, literary feel' },
]
const PUBLISHING_GOALS = [
  { value: 'Self-Publish (Amazon KDP, IngramSpark)', desc: 'Full control, faster to market' },
  { value: 'Traditional Publishing', desc: 'Query agents and major publishing houses' },
  { value: 'Personal Project', desc: 'For myself, friends, or family' },
  { value: 'Not Sure Yet', desc: "I'll figure that out later" },
]
const PUBLISHING_SERVICES = [
  { value: 'Cover Design', icon: '🎨', desc: 'Professional custom cover art' },
  { value: 'Editing & Proofreading', icon: '✏️', desc: 'Copy edit and proofread your manuscript' },
  { value: 'ISBN & Copyright Registration', icon: '📋', desc: 'Register your book and protect your IP' },
  { value: 'Distribution Setup', icon: '🌍', desc: 'Amazon, Barnes & Noble, Apple Books, and more' },
  { value: 'Author Website', icon: '🌐', desc: 'Professional site for your author brand' },
  { value: 'Launch Marketing Campaign', icon: '🚀', desc: 'Strategy and promotion for your launch day' },
]
const BOOK_BUDGET_RANGES = [
  { value: '$99 – $299', tier: 'Starter Kit', desc: 'AI writing prompts + self-serve template' },
  { value: '$1,500 – $2,500', tier: 'Starter', desc: 'Custom book writing app + AI assistant' },
  { value: '$3,000 – $5,000', tier: 'Growth', desc: 'Full platform — series, AI assistant, cover art' },
  { value: 'Not sure yet', tier: null, desc: 'Help me figure it out' },
]

// ─── CRM CONSTANTS ────────────────────────────────────────────────────────────
const CRM_INDUSTRIES = [
  'Real Estate', 'Healthcare / Medical', 'Legal Services', 'Insurance',
  'Financial Services', 'Construction / Contracting', 'Retail / E-Commerce',
  'SaaS / Technology', 'Marketing Agency', 'Non-Profit', 'Recruiting / Staffing',
  'Consulting', 'Property Management', 'Automotive', 'Other',
]
const CRM_FEATURES = [
  { value: 'Contact Management', icon: '👤', desc: 'Store and organize all contacts and companies' },
  { value: 'Lead Pipeline', icon: '🔄', desc: 'Visual deal stages from lead to close' },
  { value: 'Task & Activity Tracking', icon: '✅', desc: 'Follow-ups, calls, emails, meetings' },
  { value: 'Email Integration', icon: '📧', desc: 'Log and send emails from the CRM' },
  { value: 'Document Storage', icon: '📁', desc: 'Attach contracts, proposals, and files' },
  { value: 'Reporting & Analytics', icon: '📊', desc: 'Sales forecasts, conversion rates, KPIs' },
  { value: 'Automated Follow-ups', icon: '🤖', desc: 'Trigger reminders and emails automatically' },
  { value: 'Mobile App Access', icon: '📱', desc: 'Full CRM on iOS and Android' },
  { value: 'Team Collaboration', icon: '👥', desc: 'Assign leads, notes, and tasks to team members' },
  { value: 'Client Portal', icon: '🔐', desc: 'Let clients log in to view their project or proposal' },
  { value: 'Calendar & Scheduling', icon: '📅', desc: 'Integrated booking and calendar sync' },
  { value: 'SMS / Text Messaging', icon: '💬', desc: 'Text clients directly from the CRM' },
  { value: 'Custom Fields', icon: '🔧', desc: 'Tailor the CRM to your exact data model' },
  { value: 'Invoicing & Payments', icon: '💳', desc: 'Send invoices and collect payments' },
  { value: 'Lead Capture Forms', icon: '📋', desc: 'Embeddable forms that feed into the CRM' },
]
const DEFAULT_PIPELINE_STAGES = {
  'Real Estate': ['New Lead', 'Initial Contact', 'Showing Scheduled', 'Offer Made', 'Under Contract', 'Closed'],
  'Healthcare / Medical': ['New Patient', 'Intake', 'Appointment Scheduled', 'Consultation', 'Treatment Plan', 'Active Patient'],
  'Legal Services': ['Inquiry', 'Consultation', 'Retainer Signed', 'Case Active', 'Resolution', 'Closed'],
  'Insurance': ['New Lead', 'Needs Analysis', 'Quote Sent', 'Application', 'Policy Issued', 'Renewal'],
  'Financial Services': ['Prospect', 'Discovery Call', 'Proposal Sent', 'Under Review', 'Client Onboarded', 'Active'],
  'Construction / Contracting': ['Lead', 'Site Visit', 'Estimate Sent', 'Contract Signed', 'In Progress', 'Complete'],
  'General': ['New Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'],
}
const CRM_DOMAIN_OPTIONS = [
  { value: 'Use a Liftori subdomain', icon: '🔗', desc: 'e.g., yourcrm.liftori.app — fast setup, no extra cost' },
  { value: 'Use my own domain', icon: '🌐', desc: 'Connect a domain you already own' },
  { value: 'Get a new domain (Liftori handles it)', icon: '🛒', desc: "We'll register and connect a domain for you (~$15/yr)" },
]
const CRM_DESIGN_STYLES = [
  { value: 'Clean & Professional', desc: 'White backgrounds, subtle grays, enterprise feel' },
  { value: 'Dark Mode', desc: 'Dark UI, easy on the eyes, modern tech look' },
  { value: 'Brand-Matched', desc: "We'll match your existing brand colors and fonts" },
  { value: 'Bold & Energetic', desc: 'Colorful, high-contrast, sales-team energy' },
]

// ─── WEBSITE BUILDER CONSTANTS ────────────────────────────────────────────────
const WEBSITE_TYPES = [
  { value: 'Business / Company Site', icon: '🏢', desc: 'Showcase your business, services, and team' },
  { value: 'Portfolio / Creative', icon: '🎨', desc: 'Show off your work and attract clients' },
  { value: 'Landing Page / Funnel', icon: '🎯', desc: 'Single-page focused on one offer or CTA' },
  { value: 'Restaurant / Food', icon: '🍽️', desc: 'Menu, reservations, and location' },
  { value: 'Blog / Content Site', icon: '✍️', desc: 'Publish articles, news, and thought leadership' },
  { value: 'Non-Profit / Organization', icon: '❤️', desc: 'Mission, donations, and community' },
  { value: 'Event / Conference', icon: '🎟️', desc: 'Schedule, speakers, and registration' },
  { value: 'Personal / Professional Brand', icon: '⭐', desc: 'Your personal brand, bio, and contact' },
]
const WEBSITE_PAGES = [
  'Home', 'About Us', 'Services / Offerings', 'Portfolio / Work', 'Team / Staff',
  'Blog / News', 'Contact', 'Pricing', 'FAQ', 'Testimonials / Reviews',
  'Gallery / Media', 'Events', 'Booking / Appointments', 'Privacy Policy / Legal',
]
const WEBSITE_ASSETS = [
  { value: 'Logo file', icon: '🖼️' },
  { value: 'Brand colors / style guide', icon: '🎨' },
  { value: 'Existing photos or images', icon: '📷' },
  { value: 'Written copy / text', icon: '📝' },
  { value: 'Existing website to replace', icon: '🔄' },
  { value: 'Social media profiles', icon: '📱' },
  { value: 'Videos', icon: '🎬' },
]
const WEBSITE_DELIVERY_OPTIONS = [
  { value: 'Build & Hand Over', icon: '📦', desc: "We build it, hand you the files — you manage it yourself" },
  { value: 'Build, Launch & Host', icon: '🚀', desc: 'We build, deploy, and host it — you focus on your business' },
  { value: 'Build, Launch, Host & Maintain', icon: '🛡️', desc: 'Full service: includes 10 free major updates/year + ongoing support' },
]
const WEBSITE_UPDATE_PLANS = [
  { value: 'Pay Per Update', desc: 'Pay per individual update or revision as needed' },
  { value: 'Basic Maintenance ($49/mo)', desc: 'Up to 3 updates/mo, security patches, backups' },
  { value: 'Growth Maintenance ($99/mo)', desc: 'Unlimited small updates, priority support, monthly report' },
  { value: 'Full Service ($199/mo)', desc: 'Unlimited updates, SEO monitoring, analytics, quarterly strategy call' },
]

// ─── TECH STACK CONSTANTS ─────────────────────────────────────────────────────
const TECH_STACK_OPTIONS = [
  { value: 'AI Suggested (Recommended)', icon: '🤖', desc: "Let us choose the best stack — optimized for your project's needs and delivery speed" },
  { value: 'React + Node.js', icon: '⚛️', desc: 'Modern, scalable web app stack' },
  { value: 'React Native', icon: '📱', desc: 'Cross-platform iOS & Android from one codebase' },
  { value: 'Next.js + Supabase', icon: '▲', desc: 'Full-stack React with serverless backend' },
  { value: 'Flutter', icon: '🐦', desc: 'High-performance native iOS & Android' },
  { value: 'Vue.js', icon: '🌿', desc: 'Lightweight progressive web framework' },
  { value: 'WordPress / Webflow', icon: '🌐', desc: 'CMS-based, easy to manage content' },
  { value: 'I have specific requirements', icon: '🔧', desc: "Tell us what you need — we'll make it work" },
]

// ─── GENERIC CONSTANTS ────────────────────────────────────────────────────────
const FEATURE_OPTIONS = [
  'User authentication & accounts', 'Admin dashboard', 'Payment processing',
  'Real-time messaging / chat', 'Email notifications', 'File uploads & storage',
  'Search & filtering', 'Analytics & reporting', 'API integrations',
  'AI / automation features', 'Booking / scheduling', 'Reviews & ratings',
  'Social features (follows, likes)', 'Multi-language support', 'Mobile-responsive design',
]
const DESIGN_VIBES = [
  { value: 'Modern & Minimal', desc: 'Clean lines, lots of whitespace, subtle animations' },
  { value: 'Bold & Vibrant', desc: 'Strong colors, large typography, high energy' },
  { value: 'Professional & Corporate', desc: 'Polished, trustworthy, enterprise feel' },
  { value: 'Playful & Creative', desc: 'Fun, colorful, unique personality' },
  { value: 'Dark & Sleek', desc: 'Dark mode first, techy, premium feel' },
  { value: 'Warm & Friendly', desc: 'Approachable, soft colors, inviting' },
]
const PAGE_OPTIONS = [
  'Homepage / Landing page', 'About page', 'Contact page', 'Pricing page',
  'Product / Service listings', 'User profile pages', 'Settings / Account page',
  'Blog / Content section', 'FAQ page', 'Checkout / Cart', 'Admin panel', 'Customer portal / Dashboard',
]
const BUDGET_RANGES = [
  { value: '$2,500 – $5,000', tier: 'Starter' },
  { value: '$5,000 – $10,000', tier: 'Growth' },
  { value: '$10,000 – $25,000', tier: 'Scale' },
  { value: '$25,000+', tier: 'Enterprise' },
  { value: 'Not sure yet', tier: null },
]
const WEBSITE_BUDGET_RANGES = [
  { value: '$499 – $999', tier: 'Basic', desc: 'Simple 1–5 page site' },
  { value: '$1,500 – $3,000', tier: 'Standard', desc: 'Full business site, up to 10 pages' },
  { value: '$3,000 – $6,000', tier: 'Premium', desc: 'Custom design, animations, integrations' },
  { value: '$6,000+', tier: 'Enterprise', desc: 'Large site, custom functionality, ongoing retainer' },
  { value: 'Not sure yet', tier: null, desc: 'Help me figure it out' },
]
const TIMELINES = [
  { value: 'ASAP (2-4 weeks)', desc: 'Fast-track delivery' },
  { value: '1-2 months', desc: 'Standard timeline' },
  { value: '2-3 months', desc: 'Complex build' },
  { value: 'Flexible', desc: 'No hard deadline' },
]

// ─── ACCENT HELPERS ───────────────────────────────────────────────────────────
function getAccentClasses(appType, selected = false) {
  const map = {
    'Book Writing App': selected
      ? 'border-amber-400 bg-amber-400/10 text-amber-400'
      : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-amber-400/40',
    'CRM Builder': selected
      ? 'border-violet-400 bg-violet-400/10 text-violet-400'
      : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-violet-400/40',
    'Website Builder': selected
      ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
      : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-emerald-400/40',
  }
  return map[appType] || (selected
    ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
    : 'border-navy-600 bg-navy-800/50 text-gray-400 hover:border-navy-500')
}

function getButtonClass(appType) {
  if (appType === 'Book Writing App') return 'bg-amber-500 hover:bg-amber-400'
  if (appType === 'CRM Builder') return 'bg-violet-600 hover:bg-violet-500'
  if (appType === 'Website Builder') return 'bg-emerald-600 hover:bg-emerald-500'
  return 'bg-brand-blue hover:bg-brand-blue/90'
}

function getProgressClass(appType) {
  if (appType === 'Book Writing App') return 'bg-amber-400'
  if (appType === 'CRM Builder') return 'bg-violet-500'
  if (appType === 'Website Builder') return 'bg-emerald-500'
  return 'bg-brand-blue'
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PortalWizard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // ─── New fields (redesign spec) ─────────────────────────────────────────────
  const [discountCode, setDiscountCode]         = useState('')
  const [discountValidating, setDiscountValidating] = useState(false)
  const [discountResult, setDiscountResult]     = useState(null) // null | { valid, pct, code }
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)

  const [form, setForm] = useState({
    // Step 1
    project_name: '', elevator_pitch: '', problem_solved: '',
    // Step 2
    target_audience: '', audience_type: '', industry: '',
    // Step 3
    app_type: '',
    // Generic step 4
    features: [], custom_features: '',
    // Generic step 5
    vibe: '', color_preference: '', reference_sites: '',
    // Generic step 6
    pages: [], custom_pages: '', integrations: '',
    // Generic step 7
    business_stage: '', revenue_model: '', competitors: '',
    // Timeline & Budget (step 8 generic / step 10 book)
    timeline: '', budget_range: '', launch_date: '', additional_notes: '',

    // ── Book fields ──
    book_path: '',
    book_title: '', book_genre: '', book_type: '', book_series: '', series_name: '',
    synopsis: '', manuscript_status: '', estimated_chapters: '', estimated_length: '',
    cover_style: '', cover_color_preference: '', reference_covers: '', publishing_goal: '',
    publishing_help: '',           // 'Yes' | 'No'
    publishing_services: [],       // selected publishing add-ons
    estimate_approved: false,

    // ── CRM fields ──
    crm_industry: '',
    crm_features: [],
    crm_pipeline_name: '',
    crm_pipeline_stages: [],
    crm_custom_stages: '',
    crm_has_existing_data: '',
    crm_import_source: '',
    crm_team_size: '',
    crm_design_style: '',
    crm_domain_option: '',
    crm_own_domain: '',

    // ── Tech Stack (Web App / Mobile App) ──
    tech_stack_pref: '',
    tech_stack_custom: '',

    // ── Website Builder fields ──
    website_type: '',
    website_pages: [],
    website_custom_pages: '',
    website_has_logo: '',
    website_assets: [],
    website_existing_url: '',
    website_asset_notes: '',
    website_delivery: '',
    website_update_plan: '',
    website_hosting_notes: '',
  })

  const isBook = form.app_type === 'Book Writing App'
  const isCRM = form.app_type === 'CRM Builder'
  const isWeb = form.app_type === 'Website Builder'
  const totalSteps = isBook ? BOOK_TOTAL_STEPS : TOTAL_STEPS
  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }
  function toggleArrayItem(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }))
  }

  function canProceed() {
    switch (step) {
      case 1: return form.project_name.trim() && form.elevator_pitch.trim()
      case 2: return form.target_audience.trim()
      case 3: return !!form.app_type
      case 4:
        if (isBook) return !!form.book_path
        if (isCRM) return form.crm_features.length > 0
        if (isWeb) return !!form.website_type
        return form.features.length > 0 || form.custom_features.trim()
      case 5:
        if (isBook) return form.book_title.trim() && form.book_genre && form.book_type && form.book_series
        if (isCRM) return form.crm_pipeline_stages.length > 0 || form.crm_custom_stages.trim()
        if (isWeb) return form.website_pages.length > 0
        return !!form.vibe
      case 6:
        if (isBook) return form.synopsis.trim()
        if (isCRM) return !!form.crm_has_existing_data
        if (isWeb) return true // assets optional
        return form.pages.length > 0
      case 7:
        if (isBook) return !!form.publishing_goal
        if (isCRM) return !!form.crm_domain_option
        if (isWeb) return !!form.website_delivery
        return !!form.business_stage
      case 8:
        if (isBook) return !!form.publishing_help
        return form.budget_range && form.timeline // generic timeline/budget
      case 9:
        if (isBook) return form.estimate_approved === true
        return agreementAccepted // generic review — must accept agreement
      case 10:
        if (isBook) return form.budget_range && form.timeline
        return true
      case 11: return agreementAccepted // book review — must accept agreement
      default: return true
    }
  }

  async function handleSubmit() {
    if (!user?.id) {
      setError('Your session has expired. Please refresh the page and log in again.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      let allFeatures = []
      let brief = ''
      let projectName = form.project_name
      let projectStatus = 'Pending Estimate' // all wizard submissions go to Pending Estimate now

      if (isBook) {
        projectName = form.book_title || form.project_name
        projectStatus = 'Pending Estimate'
        allFeatures = [
          `Book Path: ${form.book_path}`,
          `Genre: ${form.book_genre}`,
          `Type: ${form.book_type}`,
          `Format: ${form.book_series}`,
          form.series_name ? `Series: ${form.series_name}` : null,
          form.publishing_goal ? `Publishing Goal: ${form.publishing_goal}` : null,
          form.cover_style ? `Cover Style: ${form.cover_style}` : null,
          form.publishing_help === 'Yes' ? `Publishing Help: Yes — ${form.publishing_services.join(', ')}` : 'Publishing Help: No',
        ].filter(Boolean)
        brief = [
          form.elevator_pitch,
          `Book: "${form.book_title}" —  ${form.book_type} / ${form.book_genre}`,
          form.book_series === 'Part of a Series' && form.series_name ? `Series: ${form.series_name}` : null,
          `Path: ${form.book_path}`,
          form.manuscript_status ? `Manuscript Status: ${form.manuscript_status}` : null,
          form.synopsis ? `Synopsis: ${form.synopsis}` : null,
          form.estimated_chapters ? `Estimated Chapters: ${form.estimated_chapters}` : null,
          form.estimated_length ? `Estimated Length: ${form.estimated_length}` : null,
          form.publishing_goal ? `Publishing Goal: ${form.publishing_goal}` : null,
          form.cover_style ? `Cover Style: ${form.cover_style}` : null,
          form.publishing_help === 'Yes' ? `Publishing Services Requested: ${form.publishing_services.join(', ')}` : null,
          form.target_audience ? `Target Reader: ${form.target_audience}` : null,
          form.additional_notes ? `Notes: ${form.additional_notes}` : null,
        ].filter(Boolean).join('\n\n')
      } else if (isCRM) {
        allFeatures = form.crm_features
        brief = [
          form.elevator_pitch,
          form.crm_industry ? `Industry: ${form.crm_industry}` : null,
          `Pipeline: ${form.crm_pipeline_name || 'Default'}`,
          form.crm_pipeline_stages.length ? `Pipeline Stages: ${form.crm_pipeline_stages.join(' → ')}` : null,
          form.crm_custom_stages ? `Custom Stages: ${form.crm_custom_stages}` : null,
          `Existing Data: ${form.crm_has_existing_data}`,
          form.crm_import_source ? `Import Source: ${form.crm_import_source}` : null,
          form.crm_team_size ? `Team Size: ${form.crm_team_size}` : null,
          `Domain: ${form.crm_domain_option}`,
          form.crm_own_domain ? `Domain Name: ${form.crm_own_domain}` : null,
          form.crm_design_style ? `Design Style: ${form.crm_design_style}` : null,
          form.additional_notes ? `Notes: ${form.additional_notes}` : null,
        ].filter(Boolean).join('\n\n')
      } else if (isWeb) {
        allFeatures = [
          form.website_type,
          ...form.website_pages,
          form.website_delivery,
          form.website_update_plan,
        ].filter(Boolean)
        brief = [
          form.elevator_pitch,
          `Website Type: ${form.website_type}`,
          form.website_pages.length ? `Pages: ${form.website_pages.join(', ')}` : null,
          form.website_assets.length ? `Assets Available: ${form.website_assets.join(', ')}` : null,
          form.website_existing_url ? `Existing Site: ${form.website_existing_url}` : null,
          form.website_asset_notes ? `Asset Notes: ${form.website_asset_notes}` : null,
          `Delivery: ${form.website_delivery}`,
          form.website_update_plan ? `Maintenance Plan: ${form.website_update_plan}` : null,
          form.website_hosting_notes ? `Hosting Notes: ${form.website_hosting_notes}` : null,
          form.additional_notes ? `Notes: ${form.additional_notes}` : null,
        ].filter(Boolean).join('\n\n')
      } else {
        allFeatures = [
          ...form.features,
          ...form.custom_features.split('\n').map(f => f.trim()).filter(Boolean),
        ]
        brief = [
          form.elevator_pitch,
          form.problem_solved && `Problem: ${form.problem_solved}`,
          form.target_audience && `Audience: ${form.target_audience}${form.audience_type ? ` (${form.audience_type})` : ''}`,
          form.industry && `Industry: ${form.industry}`,
          form.reference_sites && `References: ${form.reference_sites}`,
          form.integrations && `Integrations: ${form.integrations}`,
          form.competitors && `Competitors: ${form.competitors}`,
          form.tech_stack_pref && `Tech Stack: ${form.tech_stack_pref}${form.tech_stack_custom ? ` — ${form.tech_stack_custom}` : ''}`,
          form.additional_notes && `Notes: ${form.additional_notes}`,
        ].filter(Boolean).join('\n\n')
      }

      const allBudgets = [...BUDGET_RANGES, ...BOOK_BUDGET_RANGES, ...WEBSITE_BUDGET_RANGES]
      const budgetEntry = allBudgets.find(b => b.value === form.budget_range)
      const tier = budgetEntry?.tier || 'Starter'

      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({
          customer_id: user.id,
          name: projectName,
          project_type: form.app_type,
          status: projectStatus,
          tier: tier === 'Enterprise' ? 'Scale' : (tier || 'Starter'),
          brief,
          features: allFeatures,
          vibe: isBook ? form.cover_style : (isWeb ? form.website_type : form.vibe),
          timeline_pref: form.timeline,
          budget_range: form.budget_range,
          progress: 0,
          // New fields from redesign spec
          discount_code_used:    discountResult?.valid ? discountCode.trim().toUpperCase() : null,
          agreement_accepted_at: agreementAccepted ? new Date().toISOString() : null,
          marketing_consent:     marketingConsent,
        })
        .select()
        .single()
      if (projErr) throw projErr

      const { error: wizErr } = await supabase
        .from('wizard_submissions')
        .insert({
          customer_id: user.id,
          project_id: project.id,
          step_data: form,
          completed: true,
          submitted_at: new Date().toISOString(),
        })
      if (wizErr) console.error('Wizard submission save error:', wizErr)

      navigate('/portal/project')
    } catch (err) {
      console.error('Submit error:', err)
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── DISCOUNT CODE VALIDATION ────────────────────────────────────────────────
  async function validateDiscountCode() {
    const code = discountCode.trim().toUpperCase()
    if (!code) return
    setDiscountValidating(true)
    setDiscountResult(null)
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('id, discount_pct, max_uses, use_count, expires_at, is_active')
        .eq('code', code)
        .single()
      if (error || !data) {
        setDiscountResult({ valid: false })
        return
      }
      const expired = data.expires_at && new Date(data.expires_at) < new Date()
      const maxedOut = data.max_uses && data.use_count >= data.max_uses
      if (!data.is_active || expired || maxedOut) {
        setDiscountResult({ valid: false })
        return
      }
      setDiscountResult({ valid: true, pct: data.discount_pct, code })
    } catch {
      setDiscountResult({ valid: false })
    } finally {
      setDiscountValidating(false)
    }
  }

  // ─── STEP RENDERER ──────────────────────────────────────────────────────────
  function renderStep() {
    switch (step) {

      // ── STEP 1: VISION ──────────────────────────────────────────────────────
      case 1: return (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isBook ? 'Book Project Name *' : 'Project Name *'}
            </label>
            <input type="text" value={form.project_name} onChange={e => update('project_name', e.target.value)}
              placeholder={isBook ? 'e.g., The Last Lighthouse, My Memoir' : 'e.g., FitTrack Pro, QuickInvoice'}
              className="input-field" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isBook ? 'What is this book about? *' : 'Elevator Pitch *'}
            </label>
            <textarea value={form.elevator_pitch} onChange={e => update('elevator_pitch', e.target.value)}
              placeholder={isBook
                ? 'In a few sentences, describe your book — the concept, the story, or the idea you want to bring to life...'
                : 'In 1-3 sentences, describe what you want to build and why it matters...'
              }
              className="input-field min-h-[120px] resize-y" rows={4} />
          </div>
          {!isBook && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">What problem does it solve?</label>
              <textarea value={form.problem_solved} onChange={e => update('problem_solved', e.target.value)}
                placeholder="What pain point or gap are you addressing?"
                className="input-field min-h-[100px] resize-y" rows={3} />
            </div>
          )}
        </div>
      )

      // ── STEP 2: AUDIENCE ────────────────────────────────────────────────────
      case 2: return (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isBook ? 'Who is your target reader? *' : 'Who is your target audience? *'}
            </label>
            <textarea value={form.target_audience} onChange={e => update('target_audience', e.target.value)}
              placeholder={isBook
                ? 'Describe your ideal reader — age, interests, what they love to read...'
                : 'Describe your ideal users — age, profession, habits, needs...'
              }
              className="input-field min-h-[100px] resize-y" rows={3} autoFocus />
          </div>
          {!isBook && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Audience Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['B2C (Consumers)', 'B2B (Businesses)', 'B2B2C (Both)', 'Internal Team'].map(type => (
                  <button key={type} onClick={() => update('audience_type', type)}
                    className={`p-3 rounded-lg border text-sm font-medium text-center transition-all ${getAccentClasses(form.app_type, form.audience_type === type)}`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isBook ? 'Genre / Category' : isCRM ? 'Your Industry' : 'Industry / Vertical'}
            </label>
            {isCRM ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CRM_INDUSTRIES.map(ind => (
                  <button key={ind} onClick={() => update('industry', ind)}
                    className={`p-2.5 rounded-lg border text-sm text-center transition-all ${getAccentClasses(form.app_type, form.industry === ind)}`}>
                    {ind}
                  </button>
                ))}
              </div>
            ) : (
              <input type="text" value={form.industry} onChange={e => update('industry', e.target.value)}
                placeholder={isBook ? 'e.g., Fantasy, Romance, Business, Self-Help...' : 'e.g., Fitness, Healthcare, Real Estate...'}
                className="input-field" />
            )}
          </div>
        </div>
      )

      // ── STEP 3: APP TYPE ────────────────────────────────────────────────────
      case 3: return (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Select the type that best describes your project *</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {APP_TYPES.map(type => {
              const isSelected = form.app_type === type.value
              const hasAccent = type.accent
              return (
                <button key={type.value} onClick={() => update('app_type', type.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${getAccentClasses(type.value, isSelected)}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div className="flex-1">
                      <p className={`font-medium ${isSelected ? '' : 'text-white'}`}>{type.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{type.desc}</p>
                    </div>
                    {hasAccent && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        type.accent === 'amber' ? 'bg-amber-400/20 text-amber-400' :
                        type.accent === 'violet' ? 'bg-violet-400/20 text-violet-400' :
                        'bg-emerald-400/20 text-emerald-400'
                      }`}>NEW</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )

      // ── STEP 4 ──────────────────────────────────────────────────────────────
      case 4:
        if (isBook) return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">How can we help with your book? *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BOOK_PATHS.map(path => (
                <button key={path.value} onClick={() => update('book_path', path.value)}
                  className={`p-6 rounded-xl border text-left transition-all ${getAccentClasses('Book Writing App', form.book_path === path.value)}`}>
                  <div className="text-3xl mb-3">{path.icon}</div>
                  <p className={`font-semibold text-base ${form.book_path === path.value ? 'text-amber-400' : 'text-white'}`}>{path.value}</p>
                  <p className="text-sm text-gray-400 mt-1">{path.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )
        if (isCRM) return (
          <div className="space-y-5">
            {form.industry && (
              <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-sm text-violet-300">
                💡 Suggested for <strong>{form.industry}</strong>: {(DEFAULT_PIPELINE_STAGES[form.industry] || DEFAULT_PIPELINE_STAGES['General']).join(' → ')}
              </div>
            )}
            <div>
              <p className="text-sm text-gray-400 mb-3">Select all features your CRM needs *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CRM_FEATURES.map(f => (
                  <button key={f.value} onClick={() => toggleArrayItem('crm_features', f.value)}
                    className={`p-3 rounded-lg border text-sm text-left transition-all flex items-start gap-3 ${getAccentClasses('CRM Builder', form.crm_features.includes(f.value))}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${form.crm_features.includes(f.value) ? 'bg-violet-500' : 'border border-navy-500'}`}>
                      {form.crm_features.includes(f.value) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                    </div>
                    <div>
                      <span className="font-medium">{f.icon} {f.value}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
        if (isWeb) return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-3">What kind of website do you need? *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {WEBSITE_TYPES.map(t => (
                <button key={t.value} onClick={() => update('website_type', t.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${getAccentClasses('Website Builder', form.website_type === t.value)}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <p className={`font-medium text-sm ${form.website_type === t.value ? 'text-emerald-400' : 'text-white'}`}>{t.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
        // Generic
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">Select all features you need *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FEATURE_OPTIONS.map(feat => (
                  <button key={feat} onClick={() => toggleArrayItem('features', feat)}
                    className={`p-3 rounded-lg border text-sm text-left transition-all flex items-center gap-3 ${getAccentClasses(form.app_type, form.features.includes(feat))}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${form.features.includes(feat) ? 'bg-brand-blue' : 'border border-navy-500'}`}>
                      {form.features.includes(feat) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                    </div>
                    {feat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Any other features? (one per line)</label>
              <textarea value={form.custom_features} onChange={e => update('custom_features', e.target.value)}
                placeholder="Describe any custom features not listed above..."
                className="input-field min-h-[80px] resize-y" rows={3} />
            </div>
          </div>
        )

      // ── STEP 5 ──────────────────────────────────────────────────────────────
      case 5:
        if (isBook) return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Book Title *</label>
              <input type="text" value={form.book_title} onChange={e => update('book_title', e.target.value)}
                placeholder="Working title is fine — you can change it later" className="input-field" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Fiction or Non-Fiction? *</label>
              <div className="grid grid-cols-2 gap-3">
                {['Fiction', 'Non-Fiction'].map(type => (
                  <button key={type} onClick={() => update('book_type', type)}
                    className={`p-4 rounded-lg border text-center font-medium transition-all ${getAccentClasses('Book Writing App', form.book_type === type)}`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Genre *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BOOK_GENRES.map(genre => (
                  <button key={genre} onClick={() => update('book_genre', genre)}
                    className={`p-2.5 rounded-lg border text-sm text-center transition-all ${getAccentClasses('Book Writing App', form.book_genre === genre)}`}>
                    {genre}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Single book or part of a series? *</label>
              <div className="grid grid-cols-2 gap-3">
                {['Single Book', 'Part of a Series'].map(s => (
                  <button key={s} onClick={() => update('book_series', s)}
                    className={`p-4 rounded-lg border text-center font-medium transition-all ${getAccentClasses('Book Writing App', form.book_series === s)}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {form.book_series === 'Part of a Series' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Series Name</label>
                <input type="text" value={form.series_name} onChange={e => update('series_name', e.target.value)}
                  placeholder="e.g., The Ember Chronicles, Book 1 of 3" className="input-field" />
              </div>
            )}
          </div>
        )
        if (isCRM) {
          const suggested = DEFAULT_PIPELINE_STAGES[form.industry] || DEFAULT_PIPELINE_STAGES['General']
          return (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Pipeline Name</label>
                <input type="text" value={form.crm_pipeline_name} onChange={e => update('crm_pipeline_name', e.target.value)}
                  placeholder='e.g., "Sales Pipeline", "Client Journey", "Deal Flow"' className="input-field" />
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Select your pipeline stages *</p>
                <p className="text-xs text-gray-500 mb-3">
                  {form.industry ? `Suggested stages for ${form.industry}:` : 'Choose stages or type your own below.'}
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {suggested.map(s => (
                    <button key={s} onClick={() => toggleArrayItem('crm_pipeline_stages', s)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${getAccentClasses('CRM Builder', form.crm_pipeline_stages.includes(s))}`}>
                      {s}
                    </button>
                  ))}
                </div>
                {form.crm_pipeline_stages.length > 0 && (
                  <div className="p-3 rounded-lg bg-navy-800/50 border border-navy-700/50 text-sm text-gray-300">
                    Your pipeline: <span className="text-violet-400">{form.crm_pipeline_stages.join(' → ')}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Custom stages (one per line)</label>
                <textarea value={form.crm_custom_stages} onChange={e => update('crm_custom_stages', e.target.value)}
                  placeholder="Any stages not listed above..." className="input-field resize-y" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Team size</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Just me', '2-5', '6-20', '20+'].map(s => (
                    <button key={s} onClick={() => update('crm_team_size', s)}
                      className={`p-3 rounded-lg border text-sm text-center font-medium transition-all ${getAccentClasses('CRM Builder', form.crm_team_size === s)}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        }
        if (isWeb) return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">Select the pages you need *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {WEBSITE_PAGES.map(pg => (
                  <button key={pg} onClick={() => toggleArrayItem('website_pages', pg)}
                    className={`p-3 rounded-lg border text-sm text-left transition-all flex items-center gap-3 ${getAccentClasses('Website Builder', form.website_pages.includes(pg))}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${form.website_pages.includes(pg) ? 'bg-emerald-500' : 'border border-navy-500'}`}>
                      {form.website_pages.includes(pg) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                    </div>
                    {pg}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Any other pages?</label>
              <textarea value={form.website_custom_pages} onChange={e => update('website_custom_pages', e.target.value)}
                placeholder="Any other pages or sections you need..." className="input-field resize-y" rows={2} />
            </div>
          </div>
        )
        // Generic design
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">Pick a design vibe *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DESIGN_VIBES.map(v => (
                  <button key={v.value} onClick={() => update('vibe', v.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${getAccentClasses(form.app_type, form.vibe === v.value)}`}>
                    <p className={`font-medium text-sm ${form.vibe === v.value ? 'text-brand-blue' : 'text-white'}`}>{v.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{v.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Color preferences</label>
              <input type="text" value={form.color_preference} onChange={e => update('color_preference', e.target.value)}
                placeholder="e.g., Blues and whites, Earth tones, Match my brand..." className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Any reference sites you like?</label>
              <textarea value={form.reference_sites} onChange={e => update('reference_sites', e.target.value)}
                placeholder="Paste URLs of websites or apps whose design you admire..." className="input-field min-h-[80px] resize-y" rows={3} />
            </div>
            {(form.app_type === 'Web App' || form.app_type === 'Mobile App') && (
              <div>
                <p className="text-sm text-gray-400 mb-1">Tech stack preference</p>
                <p className="text-xs text-gray-500 mb-3">Do you have a preferred technology, or should we choose the best fit for your project?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TECH_STACK_OPTIONS.map(t => (
                    <button key={t.value} onClick={() => update('tech_stack_pref', t.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${getAccentClasses(form.app_type, form.tech_stack_pref === t.value)}`}>
                      <p className={`font-medium text-sm ${form.tech_stack_pref === t.value ? 'text-brand-blue' : 'text-white'}`}>{t.icon} {t.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
                {form.tech_stack_pref === 'I have specific requirements' && (
                  <textarea value={form.tech_stack_custom} onChange={e => update('tech_stack_custom', e.target.value)}
                    placeholder="Describe your tech stack requirements in detail..."
                    className="input-field resize-y mt-3" rows={3} />
                )}
              </div>
            )}
          </div>
        )

      // ── STEP 6 ──────────────────────────────────────────────────────────────
      case 6:
        if (isBook) return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {form.book_path === 'Finish & Publish' ? 'Where are you in your manuscript? *' : 'What is your book about? *'}
              </label>
              <textarea value={form.synopsis} onChange={e => update('synopsis', e.target.value)}
                placeholder={form.book_path === 'Finish & Publish'
                  ? 'Describe where you are — how many chapters done, what still needs writing, what you need help with...'
                  : 'Give us a synopsis or concept — even a rough idea works. This helps us build the right writing tools for your story.'
                }
                className="input-field min-h-[140px] resize-y" rows={5} autoFocus />
            </div>
            {form.book_path === 'Finish & Publish' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Current manuscript status</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { value: 'Partial draft (under 50%)', desc: 'Just getting started' },
                    { value: 'Halfway there (50-75%)', desc: 'Good progress, need to finish' },
                    { value: 'Nearly done (75-99%)', desc: 'Final stretch' },
                    { value: 'Complete, needs editing', desc: 'First draft done' },
                  ].map(s => (
                    <button key={s.value} onClick={() => update('manuscript_status', s.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${getAccentClasses('Book Writing App', form.manuscript_status === s.value)}`}>
                      <p className={`font-medium text-sm ${form.manuscript_status === s.value ? 'text-amber-400' : 'text-white'}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Estimated chapters</label>
                <input type="text" value={form.estimated_chapters} onChange={e => update('estimated_chapters', e.target.value)}
                  placeholder="e.g., 20, Not sure" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Estimated length</label>
                <input type="text" value={form.estimated_length} onChange={e => update('estimated_length', e.target.value)}
                  placeholder="e.g., 80,000 words, 300 pages" className="input-field" />
              </div>
            </div>
          </div>
        )
        if (isCRM) return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Do you have existing customer/contact data to import? *</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { value: 'Yes — I have a spreadsheet', icon: '📊' },
                  { value: 'Yes — from another CRM', icon: '🔄' },
                  { value: 'No — starting fresh', icon: '🆕' },
                ].map(o => (
                  <button key={o.value} onClick={() => update('crm_has_existing_data', o.value)}
                    className={`p-4 rounded-lg border text-center transition-all ${getAccentClasses('CRM Builder', form.crm_has_existing_data === o.value)}`}>
                    <div className="text-2xl mb-2">{o.icon}</div>
                    <p className={`text-sm font-medium ${form.crm_has_existing_data === o.value ? 'text-violet-400' : 'text-white'}`}>{o.value}</p>
                  </button>
                ))}
              </div>
            </div>
            {form.crm_has_existing_data && form.crm_has_existing_data !== 'No — starting fresh' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {form.crm_has_existing_data === 'Yes — from another CRM' ? 'Which CRM are you coming from?' : 'Describe your data'}
                </label>
                <input type="text" value={form.crm_import_source} onChange={e => update('crm_import_source', e.target.value)}
                  placeholder={form.crm_has_existing_data === 'Yes — from another CRM' ? 'e.g., Salesforce, HubSpot, Zoho, spreadsheet' : 'e.g., ~500 contacts in Excel, columns: Name, Email, Phone, Status'}
                  className="input-field" />
              </div>
            )}
          </div>
        )
        if (isWeb) return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">What brand assets do you already have? (select all that apply)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WEBSITE_ASSETS.map(a => (
                  <button key={a.value} onClick={() => toggleArrayItem('website_assets', a.value)}
                    className={`p-3 rounded-lg border text-sm text-left transition-all flex items-center gap-2 ${getAccentClasses('Website Builder', form.website_assets.includes(a.value))}`}>
                    <span>{a.icon}</span> {a.value}
                  </button>
                ))}
              </div>
            </div>
            {form.website_assets.includes('Existing website to replace') && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Current website URL</label>
                <input type="text" value={form.website_existing_url} onChange={e => update('website_existing_url', e.target.value)}
                  placeholder="https://yoursite.com" className="input-field" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Anything else about your assets or content?</label>
              <textarea value={form.website_asset_notes} onChange={e => update('website_asset_notes', e.target.value)}
                placeholder="e.g., I have photos from a photographer, my logo is in SVG format, I need help writing copy..."
                className="input-field resize-y" rows={3} />
            </div>
          </div>
        )
        // Generic pages
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">Select pages / sections you need *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PAGE_OPTIONS.map(pg => (
                  <button key={pg} onClick={() => toggleArrayItem('pages', pg)}
                    className={`p-3 rounded-lg border text-sm text-left transition-all flex items-center gap-3 ${getAccentClasses(form.app_type, form.pages.includes(pg))}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${form.pages.includes(pg) ? 'bg-brand-blue' : 'border border-navy-500'}`}>
                      {form.pages.includes(pg) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                    </div>
                    {pg}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Additional pages (one per line)</label>
              <textarea value={form.custom_pages} onChange={e => update('custom_pages', e.target.value)}
                placeholder="Any other pages or sections..." className="input-field resize-y" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Third-party integrations needed?</label>
              <textarea value={form.integrations} onChange={e => update('integrations', e.target.value)}
                placeholder="e.g., Stripe payments, Google Maps, Mailchimp..." className="input-field resize-y" rows={2} />
            </div>
          </div>
        )

      // ── STEP 7 ──────────────────────────────────────────────────────────────
      case 7:
        if (isBook) return (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-400 mb-3">Cover style *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {COVER_STYLES.map(s => (
                  <button key={s.value} onClick={() => update('cover_style', s.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${getAccentClasses('Book Writing App', form.cover_style === s.value)}`}>
                    <p className={`font-medium text-sm ${form.cover_style === s.value ? 'text-amber-400' : 'text-white'}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Cover color palette</label>
              <input type="text" value={form.cover_color_preference} onChange={e => update('cover_color_preference', e.target.value)}
                placeholder="e.g., Deep blues and golds, Muted pastels, Black and red..." className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Reference covers you love</label>
              <textarea value={form.reference_covers} onChange={e => update('reference_covers', e.target.value)}
                placeholder="Name any book covers whose style you admire..." className="input-field resize-y" rows={2} />
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-3">Publishing goal *</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PUBLISHING_GOALS.map(g => (
                  <button key={g.value} onClick={() => update('publishing_goal', g.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${getAccentClasses('Book Writing App', form.publishing_goal === g.value)}`}>
                    <p className={`font-medium text-sm ${form.publishing_goal === g.value ? 'text-amber-400' : 'text-white'}`}>{g.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{g.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
        if (isCRM) return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Design style</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CRM_DESIGN_STYLES.map(s => (
                  <button key={s.value} onClick={() => update('crm_design_style', s.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${getAccentClasses('CRM Builder', form.crm_design_style === s.value)}`}>
                    <p className={`font-medium text-sm ${form.crm_design_style === s.value ? 'text-violet-400' : 'text-white'}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Where will your CRM live? *</label>
              <div className="grid grid-cols-1 gap-3">
                {CRM_DOMAIN_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => update('crm_domain_option', o.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${getAccentClasses('CRM Builder', form.crm_domain_option === o.value)}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{o.icon}</span>
                      <div>
                        <p className={`font-medium text-sm ${form.crm_domain_option === o.value ? 'text-violet-400' : 'text-white'}`}>{o.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{o.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {(form.crm_domain_option === 'Use my own domain') && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Your domain name</label>
                <input type="text" value={form.crm_own_domain} onChange={e => update('crm_own_domain', e.target.value)}
                  placeholder="e.g., mycrm.company.com" className="input-field" />
              </div>
            )}
          </div>
        )
        if (isWeb) return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">How do you want this delivered? *</label>
              <div className="grid grid-cols-1 gap-3">
                {WEBSITE_DELIVERY_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => update('website_delivery', o.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${getAccentClasses('Website Builder', form.website_delivery === o.value)}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{o.icon}</span>
                      <div>
                        <p className={`font-medium text-sm ${form.website_delivery === o.value ? 'text-emerald-400' : 'text-white'}`}>{o.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{o.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {(form.website_delivery === 'Build, Launch & Host' || form.website_delivery === 'Build, Launch, Host & Maintain') && (
              <>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300">
                  ✅ Includes <strong>10 free major updates per year</strong>. Additional updates available via maintenance plan or per-update pricing.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Ongoing maintenance plan</label>
                  <div className="grid grid-cols-1 gap-2">
                    {WEBSITE_UPDATE_PLANS.map(p => (
                      <button key={p.value} onClick={() => update('website_update_plan', p.value)}
                        className={`p-3 rounded-lg border text-left transition-all ${getAccentClasses('Website Builder', form.website_update_plan === p.value)}`}>
                        <p className={`font-medium text-sm ${form.website_update_plan === p.value ? 'text-emerald-400' : 'text-white'}`}>{p.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Domain / Hosting notes</label>
              <input type="text" value={form.website_hosting_notes} onChange={e => update('website_hosting_notes', e.target.value)}
                placeholder="e.g., I already have a domain at GoDaddy, I need Liftori to register one, I use Cloudflare..."
                className="input-field" />
            </div>
          </div>
        )
        // Generic business
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Business stage *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'Just an idea', desc: 'I have a concept but no business yet' },
                  { value: 'Side project', desc: 'Working on it alongside my day job' },
                  { value: 'New business', desc: 'Recently launched or launching soon' },
                  { value: 'Established business', desc: 'Operating business adding a digital product' },
                ].map(stage => (
                  <button key={stage.value} onClick={() => update('business_stage', stage.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${getAccentClasses(form.app_type, form.business_stage === stage.value)}`}>
                    <p className={`font-medium text-sm ${form.business_stage === stage.value ? 'text-brand-blue' : 'text-white'}`}>{stage.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stage.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">How will this make money?</label>
              <input type="text" value={form.revenue_model} onChange={e => update('revenue_model', e.target.value)}
                placeholder="e.g., Subscriptions, One-time sales, Marketplace commissions..." className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Who are your competitors?</label>
              <textarea value={form.competitors} onChange={e => update('competitors', e.target.value)}
                placeholder="Name any existing products or companies doing something similar..." className="input-field resize-y" rows={2} />
            </div>
          </div>
        )

      // ── STEP 8 ──────────────────────────────────────────────────────────────
      // Books: Publishing Help | All others: Timeline & Budget
      case 8:
        if (isBook) return (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-amber-400/5 border border-amber-400/20 text-center">
              <div className="text-4xl mb-3">📖</div>
              <h3 className="text-white font-semibold text-lg">Do you want help publishing your book?</h3>
              <p className="text-sm text-gray-400 mt-1">We offer professional publishing services — you choose what you need.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {['Yes, I want publishing help', 'No, I\'ll handle it myself'].map(opt => (
                <button key={opt} onClick={() => update('publishing_help', opt)}
                  className={`p-5 rounded-xl border text-center font-medium transition-all ${getAccentClasses('Book Writing App', form.publishing_help === opt)}`}>
                  <div className="text-2xl mb-2">{opt.startsWith('Yes') ? '🚀' : '👋'}</div>
                  <p className={`text-sm ${form.publishing_help === opt ? 'text-amber-400' : 'text-white'}`}>{opt}</p>
                </button>
              ))}
            </div>
            {form.publishing_help === 'Yes, I want publishing help' && (
              <div>
                <p className="text-sm text-gray-400 mb-3">Which services are you interested in? (select all that apply)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PUBLISHING_SERVICES.map(s => (
                    <button key={s.value} onClick={() => toggleArrayItem('publishing_services', s.value)}
                      className={`p-4 rounded-lg border text-left transition-all ${getAccentClasses('Book Writing App', form.publishing_services.includes(s.value))}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{s.icon}</span>
                        <div>
                          <p className={`font-medium text-sm ${form.publishing_services.includes(s.value) ? 'text-amber-400' : 'text-white'}`}>{s.value}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
        // Generic (all non-book): Timeline & Budget
        return renderTimelineBudget()

      // ── STEP 9 ──────────────────────────────────────────────────────────────
      // Books: Estimate Review | All others: Review & Submit
      case 9:
        if (isBook) return renderBookEstimate()
        return renderReview()

      // ── STEPS 10-11 (BOOKS ONLY) ─────────────────────────────────────────
      case 10:
        if (isBook) return renderTimelineBudget()
        return null
      case 11:
        if (isBook) return renderReview()
        return null

      default: return null
    }
  }

  function renderTimelineBudget() {
    const budgets = isBook ? BOOK_BUDGET_RANGES : isWeb ? WEBSITE_BUDGET_RANGES : BUDGET_RANGES
    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Timeline *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TIMELINES.map(t => (
              <button key={t.value} onClick={() => update('timeline', t.value)}
                className={`p-4 rounded-lg border text-left transition-all ${getAccentClasses(form.app_type, form.timeline === t.value)}`}>
                <p className={`font-medium text-sm ${form.timeline === t.value ? '' : 'text-white'}`}>{t.value}</p>
                <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Budget range *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {budgets.map(b => (
              <button key={b.value} onClick={() => update('budget_range', b.value)}
                className={`p-3 rounded-lg border text-left transition-all ${getAccentClasses(form.app_type, form.budget_range === b.value)}`}>
                <p className={`font-medium text-sm ${form.budget_range === b.value ? '' : 'text-white'}`}>{b.value}</p>
                {b.tier && <p className="text-xs text-gray-500 mt-0.5">{b.tier}{b.desc ? ` — ${b.desc}` : ''}</p>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Target launch / completion date</label>
          <input type="date" value={form.launch_date} onChange={e => update('launch_date', e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Anything else we should know?</label>
          <textarea value={form.additional_notes} onChange={e => update('additional_notes', e.target.value)}
            placeholder="Special requirements, constraints, context..." className="input-field resize-y" rows={3} />
        </div>
      </div>
    )
  }

  function renderBookEstimate() {
    const budgetEntry = BOOK_BUDGET_RANGES.find(b => b.value === form.budget_range)
    const estimateRange = budgetEntry?.value || 'To be calculated by our team'
    const includesList = [
      'Custom AI-powered book writing platform',
      form.book_path === 'Write a New Book' ? 'Chapter-by-chapter writing assistant' : 'Manuscript editing and completion tools',
      form.book_genre ? `Genre-optimized tools for ${form.book_genre}` : null,
      form.book_series === 'Part of a Series' ? 'Series management and continuity tracking' : null,
      form.cover_style ? `Cover design concept (${form.cover_style} style)` : 'Cover design consultation',
      form.publishing_help === 'Yes, I want publishing help' && form.publishing_services.length
        ? `Publishing services: ${form.publishing_services.join(', ')}` : null,
      'Secure cloud hosting for your writing platform',
      'Ongoing support during your build',
    ].filter(Boolean)

    return (
      <div className="space-y-5">
        <div className="p-4 rounded-xl bg-amber-400/5 border border-amber-400/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">📋 Project Summary</h3>
            <span className="text-xs bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full">
              {form.book_path || 'Book Project'}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-gray-300"><span className="text-gray-500">Book:</span> {form.book_title || form.project_name}</p>
            <p className="text-gray-300"><span className="text-gray-500">Type:</span> {form.book_type} — {form.book_genre}</p>
            {form.book_series && <p className="text-gray-300"><span className="text-gray-500">Format:</span> {form.book_series}{form.series_name ? ` (${form.series_name})` : ''}</p>}
            {form.publishing_goal && <p className="text-gray-300"><span className="text-gray-500">Publishing goal:</span> {form.publishing_goal}</p>}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-navy-800/70 border border-navy-700/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">💰 Estimated Investment</h3>
            {estimateRange !== 'To be calculated by our team' && (
              <span className="text-lg font-bold text-amber-400">{estimateRange}</span>
            )}
          </div>
          <p className="text-sm text-gray-400 mb-4">
            {estimateRange === 'To be calculated by our team'
              ? "Based on your project details, our team will calculate your custom estimate and send it to you within 24 hours."
              : "Based on your selected budget range. A formal estimate with itemized costs will be sent to you within 24 hours."
            }
          </p>
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">What's included:</p>
          <ul className="space-y-1.5">
            {includesList.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 rounded-xl bg-navy-800/50 border border-navy-700/50 text-sm text-gray-400">
          <p>💳 <strong className="text-white">Payment flow:</strong> After reviewing your estimate, a <strong className="text-amber-400">50% deposit</strong> is required to begin your build. The remaining 50% is due upon delivery. Your book will not be generated or published until the deposit is received.</p>
        </div>

        <div>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={form.estimate_approved}
              onChange={e => update('estimate_approved', e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-amber-400 text-amber-500 focus:ring-amber-400 cursor-pointer"
            />
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              I understand this estimate and agree that a <strong className="text-amber-400">50% deposit</strong> will be required before my book project begins. I'm ready to move forward. *
            </span>
          </label>
          {!form.estimate_approved && (
            <p className="text-xs text-gray-500 mt-2 ml-8">Please check the box above to continue.</p>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>
        )}
      </div>
    )
  }

  function renderReview() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-400 mb-4">Review your details before submitting.</p>
        <ReviewSection title="Vision">
          <ReviewItem label={isBook ? 'Book Title' : 'Project Name'} value={isBook ? form.book_title || form.project_name : form.project_name} />
          <ReviewItem label={isBook ? 'Concept' : 'Pitch'} value={form.elevator_pitch} />
        </ReviewSection>
        <ReviewSection title="Audience & Type">
          <ReviewItem label={isBook ? 'Target Reader' : 'Target Audience'} value={form.target_audience} />
          <ReviewItem label="Type" value={form.app_type} />
          {form.industry && <ReviewItem label="Industry / Genre" value={form.industry} />}
        </ReviewSection>
        {isBook && (
          <>
            <ReviewSection title="Book Details">
              <ReviewItem label="Type" value={form.book_type} />
              <ReviewItem label="Genre" value={form.book_genre} />
              <ReviewItem label="Format" value={form.book_series} />
              {form.series_name && <ReviewItem label="Series" value={form.series_name} />}
              <ReviewItem label="Path" value={form.book_path} />
            </ReviewSection>
            <ReviewSection title="Story">
              <ReviewItem label="Synopsis" value={form.synopsis} />
            </ReviewSection>
            <ReviewSection title="Cover & Publishing">
              <ReviewItem label="Cover Style" value={form.cover_style} />
              <ReviewItem label="Publishing Goal" value={form.publishing_goal} />
              <ReviewItem label="Publishing Help" value={form.publishing_help} />
              {form.publishing_services.length > 0 && (
                <ReviewItem label="Services" value={form.publishing_services.join(', ')} />
              )}
            </ReviewSection>
          </>
        )}
        {isCRM && (
          <>
            <ReviewSection title="CRM Setup">
              {form.crm_features.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-1">Features</p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.crm_features.map(f => (
                      <span key={f} className="text-xs bg-navy-700 text-gray-300 px-2 py-1 rounded-full">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              <ReviewItem label="Pipeline" value={form.crm_pipeline_stages.join(' → ')} />
              <ReviewItem label="Domain" value={form.crm_domain_option} />
            </ReviewSection>
          </>
        )}
        {isWeb && (
          <ReviewSection title="Website">
            <ReviewItem label="Type" value={form.website_type} />
            {form.website_pages.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">Pages</p>
                <div className="flex flex-wrap gap-1.5">
                  {form.website_pages.map(p => (
                    <span key={p} className="text-xs bg-navy-700 text-gray-300 px-2 py-1 rounded-full">{p}</span>
                  ))}
                </div>
              </div>
            )}
            <ReviewItem label="Delivery" value={form.website_delivery} />
            {form.website_update_plan && <ReviewItem label="Maintenance" value={form.website_update_plan} />}
          </ReviewSection>
        )}
        {!isBook && !isCRM && !isWeb && (
          <ReviewSection title="Features & Design">
            {form.features.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">Features</p>
                <div className="flex flex-wrap gap-1.5">
                  {form.features.map(f => <span key={f} className="text-xs bg-navy-700 text-gray-300 px-2 py-1 rounded-full">{f}</span>)}
                </div>
              </div>
            )}
            <ReviewItem label="Design Vibe" value={form.vibe} />
          </ReviewSection>
        )}
        <ReviewSection title="Timeline & Budget">
          <ReviewItem label="Timeline" value={form.timeline} />
          <ReviewItem label="Budget" value={form.budget_range} />
          {form.launch_date && <ReviewItem label="Target Date" value={form.launch_date} />}
        </ReviewSection>

        {/* ── ESTIMATE MESSAGE ─────────────────────────────────────────────── */}
        <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sky-400 text-base">🌋</span>
            <h3 className="text-white font-semibold text-sm">Your Project Estimate</h3>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            Your project estimate will be sent to you shortly. Our team will review your project
            details, calculate the build cost, and send you a formal estimate via email.
            A <strong className="text-white">50% deposit</strong> is required to begin your build.
          </p>
        </div>

        {/* ── DISCOUNT CODE ────────────────────────────────────────────────── */}
        <div className="p-4 rounded-xl bg-navy-800/60 border border-navy-700/50 space-y-3">
          <h3 className="text-white font-semibold text-sm">Have a discount code?</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={discountCode}
              onChange={e => { setDiscountCode(e.target.value.toUpperCase()); setDiscountResult(null) }}
              onKeyDown={e => { if (e.key === 'Enter') validateDiscountCode() }}
              placeholder="e.g. EARLYBIRD90"
              className="flex-1 bg-navy-900/80 border border-navy-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="button"
              onClick={validateDiscountCode}
              disabled={!discountCode.trim() || discountValidating}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {discountValidating ? '…' : 'Apply'}
            </button>
          </div>
          {discountResult?.valid && (
            <p className="text-sm text-emerald-400 flex items-center gap-1.5">
              ✓ Code applied — <strong>{discountResult.pct}% discount</strong> will be reflected in your estimate.
            </p>
          )}
          {discountResult?.valid === false && (
            <p className="text-sm text-red-400">That code isn't valid or has expired. Check the code and try again.</p>
          )}
        </div>

        {/* ── MARKETING CONSENT ────────────────────────────────────────────── */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={e => setMarketingConsent(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-navy-600 text-sky-500 focus:ring-sky-500 shrink-0"
          />
          <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
            May we feature your project in our marketing materials, blog posts, and case studies?{' '}
            <span className="text-gray-500">(Optional)</span>
          </span>
        </label>

        {/* ── AGREEMENT ────────────────────────────────────────────────────── */}
        <div className={`p-4 rounded-xl border transition-colors ${
          agreementAccepted ? 'border-sky-500/50 bg-sky-500/5' : 'border-navy-600 bg-navy-800/40'
        }`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreementAccepted}
              onChange={e => setAgreementAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-navy-600 text-sky-500 focus:ring-sky-500 shrink-0"
            />
            <span className="text-sm text-gray-300 leading-relaxed">
              I agree to Liftori's{' '}
              <a href="https://liftori.ai/terms" target="_blank" rel="noopener noreferrer"
                className="text-sky-400 hover:underline">Terms of Service</a>{' '}
              and{' '}
              <a href="https://liftori.ai/service-agreement" target="_blank" rel="noopener noreferrer"
                className="text-sky-400 hover:underline">Service Agreement</a>.{' '}
              <span className="text-gray-500">Required to submit.</span>
            </span>
          </label>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>
        )}
      </div>
    )
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  const stepInfo = getStepInfo(step, form.app_type)
  const isLastStep = step === totalSteps
  const btnClass = getButtonClass(form.app_type)
  const progressClass = getProgressClass(form.app_type)

  const headerMeta = {
    'Book Writing App': { emoji: '📚', label: 'Book Writing App', sub: "Tell us about your book and we'll build you a custom writing platform" },
    'CRM Builder': { emoji: '🗂️', label: 'CRM Builder', sub: "Tell us about your business and we'll build your perfect CRM" },
    'Website Builder': { emoji: '✨', label: 'Website Builder', sub: "Tell us about your site and we'll design, build, and launch it for you" },
  }
  const meta = headerMeta[form.app_type]

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {meta ? `${meta.emoji} ${meta.label}` : 'Start Your Project'}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {meta ? meta.sub : "Tell us about your idea and we'll bring it to life"}
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Step {step} of {totalSteps}</span>
          <span>{Math.round((step / totalSteps) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${progressClass}`}
            style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">{stepInfo.title}</h2>
        <p className="text-sm text-gray-400">{stepInfo.subtitle}</p>
      </div>

      <div className="card mb-6">
        {renderStep()}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => step === 1 ? navigate('/portal') : setStep(step - 1)}
          className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors">
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        {!isLastStep ? (
          <button onClick={() => setStep(step + 1)} disabled={!canProceed()}
            className={`px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${btnClass}`}>
            Continue
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting || !canProceed()}
            className={`px-8 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${btnClass}`}>
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
            ) : (
              isBook ? '🚀 Submit My Book Project' : isWeb ? '✨ Submit My Website Project' : isCRM ? '🗂️ Submit My CRM Project' : 'Submit Project'
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function ReviewSection({ title, children }) {
  return (
    <div className="p-4 rounded-lg bg-navy-800/50 border border-navy-700/50">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}

function ReviewItem({ label, value }) {
  if (!value) return null
  return (
    <div className="mb-2 last:mb-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  )
}
