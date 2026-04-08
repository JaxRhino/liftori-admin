import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import {
  ArrowLeft, ArrowRight, Phone, Check, Loader2,
  Globe, Smartphone, Layout, ShoppingCart, BarChart3, Store,
  Building2, HelpCircle, Rocket, Shield, Clock, DollarSign,
  Database, Server, Calendar, User, Mail, Lock, ChevronRight,
  Sparkles, FileText, Bot, Palette, MessageSquare, CreditCard,
  Users, Briefcase, Zap, CheckCircle2
} from 'lucide-react';

// ─── CONSTANTS ───────────────────────────────────────────────

const PRODUCT_TYPES = [
  { id: 'web-app', label: 'Web App', icon: Globe, desc: 'Full web application' },
  { id: 'mobile-app', label: 'Mobile App', icon: Smartphone, desc: 'iOS & Android app' },
  { id: 'website', label: 'Website', icon: Layout, desc: 'Marketing or business site' },
  { id: 'ecommerce', label: 'E-Commerce', icon: ShoppingCart, desc: 'Online store' },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, desc: 'Analytics & reporting' },
  { id: 'marketplace', label: 'Marketplace', icon: Store, desc: 'Multi-vendor platform' },
];

const SUGGESTED_FEATURES = {
  'web-app': ['User Authentication', 'Admin Dashboard', 'API Integration', 'Real-time Chat', 'File Upload', 'Notifications', 'Search & Filters', 'Payment Processing'],
  'mobile-app': ['Push Notifications', 'Camera/Photo', 'GPS/Location', 'Offline Mode', 'Social Login', 'In-App Purchases', 'Biometric Auth', 'Chat/Messaging'],
  'website': ['Contact Form', 'Blog/CMS', 'SEO Optimization', 'Analytics', 'Newsletter Signup', 'Image Gallery', 'Testimonials', 'Social Media Links'],
  'ecommerce': ['Product Catalog', 'Shopping Cart', 'Payment Gateway', 'Order Tracking', 'Inventory Management', 'Reviews & Ratings', 'Discount Codes', 'Shipping Calculator'],
  'dashboard': ['Data Visualization', 'Export Reports', 'Role-Based Access', 'Real-time Updates', 'Custom Filters', 'Alerts & Thresholds', 'API Connections', 'Scheduled Reports'],
  'marketplace': ['Vendor Profiles', 'Product Listings', 'Commission System', 'Reviews', 'Search & Discovery', 'Messaging', 'Payment Split', 'Dispute Resolution'],
};

const TIMELINE_OPTIONS = [
  { id: 'asap', label: 'ASAP', desc: 'As soon as possible' },
  { id: '1-3-months', label: '1-3 Months', desc: 'Near term' },
  { id: '3-6-months', label: '3-6 Months', desc: 'Planning ahead' },
  { id: 'no-rush', label: 'No Rush', desc: 'When it\'s ready' },
];

const BUDGET_OPTIONS = [
  { id: 'under-2500', label: 'Under $2,500', tier: 'Starter' },
  { id: '2500-5000', label: '$2,500 - $5,000', tier: 'Starter' },
  { id: '5000-10000', label: '$5,000 - $10,000', tier: 'Growth' },
  { id: '10000-plus', label: '$10,000+', tier: 'Scale' },
];

const SECURITY_OPTIONS = [
  { id: 'standard', label: 'Standard', desc: 'SSL, encrypted data, secure auth' },
  { id: 'hipaa', label: 'HIPAA / Healthcare', desc: 'Medical data compliance' },
  { id: 'pci', label: 'PCI / Payments', desc: 'Credit card data handling' },
  { id: 'government', label: 'Government', desc: 'FedRAMP or similar' },
  { id: 'not-sure', label: 'Not Sure', desc: 'We\'ll figure it out together' },
];

// ─── STEP DEFINITIONS ────────────────────────────────────────

const STEPS = {
  // Shared
  WELCOME: 'welcome',
  CONTACT: 'contact',
  BUSINESS: 'business',
  BUSINESS_DETAILS: 'business_details',
  // Product path
  PRODUCT_TYPE: 'product_type',
  PRODUCT_DESCRIBE: 'product_describe',
  FEATURES: 'features',
  DATABASE: 'database',
  HOSTING: 'hosting',
  TIMELINE: 'timeline',
  SECURITY: 'security',
  BUDGET: 'budget',
  NDA: 'nda',
  REVIEW: 'review',
  // Consulting path
  CONSULT_DESCRIBE: 'consult_describe',
  CONSULT_SCHEDULE: 'consult_schedule',
  CONSULT_REVIEW: 'consult_review',
  // Done
  COMPLETE: 'complete',
};

// ─── MAIN COMPONENT ──────────────────────────────────────────

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdminTest = searchParams.get('test') === 'true';

  // Current step
  const [step, setStep] = useState(STEPS.WELCOME);
  const [history, setHistory] = useState([]);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);

  // Loading / error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Callback request
  const [callbackRequested, setCallbackRequested] = useState(false);

  // ─── Form Data ───
  const [formData, setFormData] = useState({
    // Contact
    full_name: '',
    email: '',
    phone: '',
    password: '',
    // Business
    has_business: null, // 'yes' | 'no' | 'need-help'
    company_name: '',
    industry: '',
    company_website: '',
    // Path
    path: null, // 'product' | 'consulting' | 'callback'
    // Product
    product_type: '',
    product_description: '',
    features: [],
    custom_features: '',
    needs_database: null, // 'yes' | 'no' | 'not-sure'
    database_description: '',
    hosting: '', // 'liftori' | 'self-host' | 'not-sure'
    timeline: '',
    security: '',
    budget: '',
    needs_financing: null, // 'yes' | 'no'
    // Consulting
    consulting_description: '',
    consulting_tools: '',
    appointment_date: '',
    appointment_time: '',
    consultant: '', // 'ryan' | 'mike'
    // NDA
    nda_accepted: false,
    nda_accepted_at: null,
    // Referral
    referral_code: searchParams.get('ref') || '',
  });

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
      }
    };
    checkSession();
  }, []);

  // ─── Navigation ───
  const goTo = (nextStep) => {
    setHistory(prev => [...prev, step]);
    setStep(nextStep);
    setError('');
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setStep(prev);
      setError('');
    }
  };

  const updateForm = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ─── Account Creation ───
  const createAccount = async () => {
    setLoading(true);
    setError('');
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.full_name }
        }
      });
      if (authError) throw authError;

      const uid = authData.user.id;

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: uid,
          email: formData.email,
          full_name: formData.full_name,
          role: 'customer',
        });
      if (profileError) throw profileError;

      setIsAuthenticated(true);
      setUserId(uid);
      return uid;
    } catch (err) {
      if (err.message?.includes('already registered')) {
        // Try signing in instead
        try {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });
          if (signInError) throw signInError;
          setIsAuthenticated(true);
          setUserId(signInData.user.id);
          return signInData.user.id;
        } catch (signInErr) {
          setError('This email is already registered. Please check your password.');
          return null;
        }
      }
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ─── Submit Wizard ───
  const submitWizard = async () => {
    setLoading(true);
    setError('');
    try {
      const uid = userId;
      if (!uid) throw new Error('No authenticated user');

      // Determine project type and status
      const isConsulting = formData.path === 'consulting';
      const projectType = isConsulting ? 'Business Consulting' :
        PRODUCT_TYPES.find(p => p.id === formData.product_type)?.label || formData.product_type;

      // Determine tier from budget
      const budgetTier = BUDGET_OPTIONS.find(b => b.id === formData.budget)?.tier || 'Starter';

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          customer_id: uid,
          name: isConsulting ? 'Business Consulting' : `${projectType} Project`,
          project_type: projectType,
          status: 'Waitlist',
          tier: isConsulting ? 'Growth' : budgetTier,
          brief: isConsulting ? formData.consulting_description : formData.product_description,
          features: formData.features,
          vibe: formData.security,
          timeline_pref: formData.timeline,
          budget_range: formData.budget,
        })
        .select()
        .single();
      if (projectError) throw projectError;

      // Save wizard submission
      const { error: wizardError } = await supabase
        .from('wizard_submissions')
        .insert({
          customer_id: uid,
          project_id: project.id,
          step_data: {
            ...formData,
            password: undefined, // Never store password
            wizard_type: 'onboarding',
            completed_at: new Date().toISOString(),
          },
          completed: true,
          submitted_at: new Date().toISOString(),
        });
      if (wizardError) console.error('Wizard submission error:', wizardError);

      // Send notification email to ops
      try {
        await supabase.functions.invoke('welcome-email', {
          body: {
            name: 'Liftori Ops',
            email: 'ryan@liftori.ai',
            subject: `New ${isConsulting ? 'Consulting' : 'Project'} Submission: ${formData.full_name}`,
            custom_message: `New onboarding wizard submission from ${formData.full_name} (${formData.email}).\n\nType: ${projectType}\nBudget: ${formData.budget || 'N/A'}\nTimeline: ${formData.timeline || 'N/A'}\nCallback Requested: ${callbackRequested ? 'YES' : 'No'}\n\nCheck admin dashboard for details.`,
          }
        });
      } catch (emailErr) {
        console.error('Notification email failed:', emailErr);
      }

      goTo(STEPS.COMPLETE);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Request Callback ───
  const requestCallback = async () => {
    setCallbackRequested(true);
    // If we have contact info, save it immediately
    if (formData.email || formData.phone) {
      try {
        // Pipe into Call Center — Speed to Lead
        await supabase.from('cc_speed_to_lead').insert({
          lead_name: formData.full_name || formData.email || 'Onboarding Callback',
          phone_number: formData.phone || '',
          email: formData.email || '',
          source: 'onboarding_wizard',
          status: 'new',
          notes: `Callback requested during onboarding wizard at step: ${step}.\nPath: ${formData.path || 'not yet chosen'}\nCompany: ${formData.company_name || 'N/A'}`,
          received_at: new Date().toISOString(),
        });

        // Also save to waitlist for backup tracking
        await supabase.from('waitlist_signups').insert({
          full_name: formData.full_name || 'Callback Request',
          email: formData.email,
          build_idea: 'CALLBACK REQUESTED - Customer wants to speak with a human',
        });

        // Notify ops via email
        await supabase.functions.invoke('welcome-email', {
          body: {
            name: 'Liftori Ops',
            email: 'ryan@liftori.ai',
            subject: `CALLBACK REQUEST: ${formData.full_name || formData.email}`,
            custom_message: `Customer requested a callback.\n\nName: ${formData.full_name}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nStep: ${step}\n\nThis lead has been added to the Call Center queue.`,
          }
        });
      } catch (err) {
        console.error('Callback notification failed:', err);
      }
    }
  };

  // ─── Step Progress ───
  const getStepNumber = () => {
    const productSteps = [STEPS.WELCOME, STEPS.CONTACT, STEPS.BUSINESS, STEPS.PRODUCT_TYPE, STEPS.PRODUCT_DESCRIBE, STEPS.FEATURES, STEPS.DATABASE, STEPS.HOSTING, STEPS.TIMELINE, STEPS.SECURITY, STEPS.BUDGET, STEPS.NDA, STEPS.REVIEW];
    const consultSteps = [STEPS.WELCOME, STEPS.CONTACT, STEPS.BUSINESS, STEPS.CONSULT_DESCRIBE, STEPS.CONSULT_SCHEDULE, STEPS.NDA, STEPS.CONSULT_REVIEW];
    const steps = formData.path === 'consulting' ? consultSteps : productSteps;
    const idx = steps.indexOf(step);
    return { current: idx + 1, total: steps.length };
  };

  const progress = getStepNumber();

  // ─── RENDER ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#060B18] flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#060B18] via-[#0a1628] to-[#060B18]" />
      <div className="fixed inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl">
        {/* Progress Bar */}
        {step !== STEPS.WELCOME && step !== STEPS.COMPLETE && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Step {progress.current} of {progress.total}</span>
              {isAdminTest && <span className="text-yellow-400">TEST MODE</span>}
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-[#0d1829] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header with back button */}
          {step !== STEPS.WELCOME && step !== STEPS.COMPLETE && (
            <div className="flex items-center justify-between px-6 pt-5">
              <button onClick={goBack} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm">
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={requestCallback}
                className={`flex items-center gap-1.5 text-sm transition-colors ${callbackRequested ? 'text-green-400' : 'text-sky-400 hover:text-sky-300'}`}
                disabled={callbackRequested}
              >
                <Phone className="h-3.5 w-3.5" />
                {callbackRequested ? 'Callback Requested' : 'Talk to a Human'}
              </button>
            </div>
          )}

          {/* Step Content */}
          <div className="p-6 md:p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: WELCOME                                  */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.WELCOME && (
              <div className="text-center">
                <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  LIFTORI
                </h1>
                <div className="mb-6">
                  <p className="text-sky-400 font-semibold text-lg mb-1">Get added to the waitlist now!</p>
                  <p className="text-gray-400 mb-2">We're launching soon — be the first to know.</p>
                  <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-full px-4 py-1.5 text-sky-300 text-sm">
                    <Sparkles className="h-4 w-4" />
                    Some may win a free platform, on us!
                  </div>
                </div>

                <p className="text-gray-500 text-sm mb-6">Tell us what you're looking for and we'll be in touch with more information.</p>

                <div className="space-y-3">
                  <WizardButton
                    icon={Rocket}
                    label="Build a Digital Product"
                    desc="Web app, mobile app, website, e-commerce, dashboard"
                    onClick={() => { updateForm('path', 'product'); goTo(STEPS.CONTACT); }}
                  />
                  <WizardButton
                    icon={Briefcase}
                    label="Business Consulting"
                    desc="AI automation audit, process improvement, strategy"
                    onClick={() => { updateForm('path', 'consulting'); goTo(STEPS.CONTACT); }}
                  />
                  <WizardButton
                    icon={Phone}
                    label="Not Sure — Talk to Someone"
                    desc="Get a callback from our team"
                    onClick={() => { updateForm('path', 'callback'); goTo(STEPS.CONTACT); }}
                    variant="outline"
                  />
                </div>

                <p className="text-gray-500 text-xs mt-6">
                  Already have an account? <a href="/login" className="text-sky-400 hover:text-sky-300">Sign in</a>
                </p>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: CONTACT INFO                             */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.CONTACT && (
              <div>
                <StepHeader
                  icon={User}
                  title="Let's Get to Know You"
                  subtitle="Create your account to get started"
                />
                <div className="space-y-4">
                  <WizardInput
                    label="Full Name"
                    value={formData.full_name}
                    onChange={v => updateForm('full_name', v)}
                    placeholder="John Smith"
                    icon={User}
                  />
                  <WizardInput
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={v => updateForm('email', v)}
                    placeholder="john@company.com"
                    icon={Mail}
                  />
                  <WizardInput
                    label="Phone"
                    type="tel"
                    value={formData.phone}
                    onChange={v => updateForm('phone', v)}
                    placeholder="(555) 123-4567"
                    icon={Phone}
                  />
                  {!isAuthenticated && (
                    <WizardInput
                      label="Create Password"
                      type="password"
                      value={formData.password}
                      onChange={v => updateForm('password', v)}
                      placeholder="Minimum 6 characters"
                      icon={Lock}
                    />
                  )}
                  <Button
                    className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-semibold text-base"
                    disabled={!formData.full_name || !formData.email || (!isAuthenticated && formData.password.length < 6) || loading}
                    onClick={async () => {
                      if (!isAuthenticated) {
                        const uid = await createAccount();
                        if (!uid) return;
                      }
                      if (formData.path === 'callback') {
                        await requestCallback();
                        goTo(STEPS.COMPLETE);
                      } else {
                        goTo(STEPS.BUSINESS);
                      }
                    }}
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      <>
                        {isAuthenticated ? 'Continue' : 'Create Account & Continue'}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: BUSINESS INFO                            */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.BUSINESS && (
              <div>
                <StepHeader
                  icon={Building2}
                  title="Business Information"
                  subtitle="Do you have a registered business?"
                />
                <div className="space-y-3">
                  <WizardButton
                    icon={Building2}
                    label="Yes, I Have a Business"
                    desc="I'll provide my company details"
                    onClick={() => { updateForm('has_business', 'yes'); goTo(STEPS.BUSINESS_DETAILS); }}
                  />
                  <WizardButton
                    icon={HelpCircle}
                    label="No Business Yet"
                    desc="That's okay — we can still build"
                    onClick={() => {
                      updateForm('has_business', 'no');
                      goTo(formData.path === 'consulting' ? STEPS.CONSULT_DESCRIBE : STEPS.PRODUCT_TYPE);
                    }}
                  />
                  <WizardButton
                    icon={Sparkles}
                    label="Need Help Forming One"
                    desc="We partner with ZenBusiness for easy LLC setup"
                    onClick={() => { updateForm('has_business', 'need-help'); goTo(STEPS.BUSINESS_DETAILS); }}
                    highlight
                  />
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: BUSINESS DETAILS                         */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.BUSINESS_DETAILS && (
              <div>
                <StepHeader
                  icon={Building2}
                  title={formData.has_business === 'need-help' ? 'Company Formation' : 'Company Details'}
                  subtitle={formData.has_business === 'need-help'
                    ? 'Tell us what you have in mind — we\'ll help with the rest'
                    : 'Tell us about your business'
                  }
                />
                {formData.has_business === 'need-help' && (
                  <div className="mb-4 p-4 bg-sky-500/10 border border-sky-500/20 rounded-lg">
                    <p className="text-sky-300 text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 shrink-0" />
                      We partner with <strong>ZenBusiness</strong> for fast, affordable LLC formation. We'll connect you after this wizard.
                    </p>
                  </div>
                )}
                <div className="space-y-4">
                  <WizardInput
                    label={formData.has_business === 'need-help' ? 'Desired Company Name' : 'Company Name'}
                    value={formData.company_name}
                    onChange={v => updateForm('company_name', v)}
                    placeholder="Acme Inc."
                    icon={Building2}
                  />
                  <WizardInput
                    label="Industry"
                    value={formData.industry}
                    onChange={v => updateForm('industry', v)}
                    placeholder="e.g. Healthcare, Retail, Tech, Construction"
                    icon={Briefcase}
                  />
                  {formData.has_business === 'yes' && (
                    <WizardInput
                      label="Website (optional)"
                      value={formData.company_website}
                      onChange={v => updateForm('company_website', v)}
                      placeholder="https://yourcompany.com"
                      icon={Globe}
                    />
                  )}
                  <Button
                    className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                    onClick={() => goTo(formData.path === 'consulting' ? STEPS.CONSULT_DESCRIBE : STEPS.PRODUCT_TYPE)}
                    disabled={!formData.company_name}
                  >
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: PRODUCT TYPE                             */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.PRODUCT_TYPE && (
              <div>
                <StepHeader
                  icon={Layout}
                  title="What Are You Building?"
                  subtitle="Select the type of digital product"
                />
                <div className="grid grid-cols-2 gap-3">
                  {PRODUCT_TYPES.map(pt => (
                    <button
                      key={pt.id}
                      onClick={() => { updateForm('product_type', pt.id); goTo(STEPS.PRODUCT_DESCRIBE); }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center hover:border-sky-500 hover:bg-sky-500/5 ${
                        formData.product_type === pt.id
                          ? 'border-sky-500 bg-sky-500/10'
                          : 'border-gray-700 bg-gray-800/30'
                      }`}
                    >
                      <pt.icon className="h-8 w-8 text-sky-400" />
                      <span className="text-white font-medium text-sm">{pt.label}</span>
                      <span className="text-gray-400 text-xs">{pt.desc}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { updateForm('product_type', 'other'); goTo(STEPS.PRODUCT_DESCRIBE); }}
                  className="w-full mt-3 p-3 rounded-xl border border-gray-700 bg-gray-800/30 text-gray-400 hover:border-sky-500 hover:text-white transition-all text-sm"
                >
                  Something else — I'll describe it
                </button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: DESCRIBE PRODUCT                         */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.PRODUCT_DESCRIBE && (
              <div>
                <StepHeader
                  icon={FileText}
                  title="Describe Your Product"
                  subtitle="What does it do? Who is it for? What problem does it solve?"
                />
                <div className="space-y-4">
                  <Textarea
                    value={formData.product_description}
                    onChange={e => updateForm('product_description', e.target.value)}
                    placeholder="Tell us about your vision. The more detail, the better our estimate..."
                    className="min-h-[160px] bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-sky-500"
                  />
                  <Button
                    className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                    onClick={() => goTo(STEPS.FEATURES)}
                    disabled={!formData.product_description}
                  >
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: FEATURES                                 */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.FEATURES && (
              <div>
                <StepHeader
                  icon={Zap}
                  title="Features"
                  subtitle="Select features you need or add your own"
                />
                <div className="flex flex-wrap gap-2 mb-4">
                  {(SUGGESTED_FEATURES[formData.product_type] || SUGGESTED_FEATURES['web-app']).map(feature => (
                    <button
                      key={feature}
                      onClick={() => {
                        const features = formData.features.includes(feature)
                          ? formData.features.filter(f => f !== feature)
                          : [...formData.features, feature];
                        updateForm('features', features);
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        formData.features.includes(feature)
                          ? 'bg-sky-500 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {formData.features.includes(feature) && <Check className="h-3 w-3 inline mr-1" />}
                      {feature}
                    </button>
                  ))}
                </div>
                <WizardInput
                  label="Other features (optional)"
                  value={formData.custom_features}
                  onChange={v => updateForm('custom_features', v)}
                  placeholder="Describe any custom features..."
                  icon={Sparkles}
                />
                <Button
                  className="w-full h-12 mt-4 bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                  onClick={() => goTo(STEPS.DATABASE)}
                >
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: DATABASE                                 */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.DATABASE && (
              <div>
                <StepHeader
                  icon={Database}
                  title="Database Needs"
                  subtitle="Will your product need to store and manage data?"
                />
                <div className="space-y-3">
                  <WizardButton
                    icon={Database}
                    label="Yes, Needs a Database"
                    desc="Users, products, orders, content, etc."
                    onClick={() => { updateForm('needs_database', 'yes'); }}
                    selected={formData.needs_database === 'yes'}
                  />
                  <WizardButton
                    icon={Layout}
                    label="No Database Needed"
                    desc="Static content, simple landing page"
                    onClick={() => { updateForm('needs_database', 'no'); goTo(STEPS.HOSTING); }}
                  />
                  <WizardButton
                    icon={HelpCircle}
                    label="Not Sure"
                    desc="We'll figure it out together"
                    onClick={() => { updateForm('needs_database', 'not-sure'); goTo(STEPS.HOSTING); }}
                    variant="outline"
                  />
                </div>
                {formData.needs_database === 'yes' && (
                  <div className="mt-4 space-y-4">
                    <Textarea
                      value={formData.database_description}
                      onChange={e => updateForm('database_description', e.target.value)}
                      placeholder="What kind of data? Users, products, transactions, documents, analytics..."
                      className="min-h-[100px] bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-sky-500"
                    />
                    <Button
                      className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                      onClick={() => goTo(STEPS.HOSTING)}
                    >
                      Continue <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: HOSTING                                  */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.HOSTING && (
              <div>
                <StepHeader
                  icon={Server}
                  title="Implementation Plan"
                  subtitle="How do you want your product hosted and managed?"
                />
                <div className="space-y-3">
                  <WizardButton
                    icon={Rocket}
                    label="Liftori Manages Everything"
                    desc="We build, host, maintain, and support — you focus on your business"
                    onClick={() => { updateForm('hosting', 'liftori'); goTo(STEPS.TIMELINE); }}
                    highlight
                  />
                  <WizardButton
                    icon={Server}
                    label="I Want to Self-Host"
                    desc="We build it, you run it on your own infrastructure"
                    onClick={() => { updateForm('hosting', 'self-host'); goTo(STEPS.TIMELINE); }}
                  />
                  <WizardButton
                    icon={HelpCircle}
                    label="Not Sure Yet"
                    desc="We can discuss this during the project"
                    onClick={() => { updateForm('hosting', 'not-sure'); goTo(STEPS.TIMELINE); }}
                    variant="outline"
                  />
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: TIMELINE                                 */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.TIMELINE && (
              <div>
                <StepHeader
                  icon={Clock}
                  title="Timeline"
                  subtitle="When do you need this built?"
                />
                <div className="grid grid-cols-2 gap-3">
                  {TIMELINE_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { updateForm('timeline', opt.id); goTo(STEPS.SECURITY); }}
                      className="flex flex-col items-center gap-1 p-4 rounded-xl border border-gray-700 bg-gray-800/30 hover:border-sky-500 hover:bg-sky-500/5 transition-all"
                    >
                      <Clock className="h-6 w-6 text-sky-400" />
                      <span className="text-white font-medium">{opt.label}</span>
                      <span className="text-gray-400 text-xs">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: SECURITY                                 */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.SECURITY && (
              <div>
                <StepHeader
                  icon={Shield}
                  title="Data & Security"
                  subtitle="Any special security or compliance requirements?"
                />
                <div className="space-y-3">
                  {SECURITY_OPTIONS.map(opt => (
                    <WizardButton
                      key={opt.id}
                      icon={Shield}
                      label={opt.label}
                      desc={opt.desc}
                      onClick={() => { updateForm('security', opt.id); goTo(STEPS.BUDGET); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: BUDGET                                   */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.BUDGET && (
              <div>
                <StepHeader
                  icon={DollarSign}
                  title="Budget"
                  subtitle="What's your budget range for this project?"
                />
                <div className="space-y-3 mb-4">
                  {BUDGET_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => updateForm('budget', opt.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                        formData.budget === opt.id
                          ? 'border-sky-500 bg-sky-500/10'
                          : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <DollarSign className={`h-5 w-5 ${formData.budget === opt.id ? 'text-sky-400' : 'text-gray-500'}`} />
                        <span className="text-white font-medium">{opt.label}</span>
                      </div>
                      <span className="text-xs text-gray-400">{opt.tier} tier</span>
                    </button>
                  ))}
                </div>

                {formData.budget && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-300 text-sm mb-3">Do you need financing?</p>
                      <div className="flex gap-3">
                        <Button
                          variant={formData.needs_financing === 'yes' ? 'default' : 'outline'}
                          className={formData.needs_financing === 'yes' ? 'bg-sky-500 flex-1' : 'flex-1 border-gray-700 text-gray-300'}
                          onClick={() => updateForm('needs_financing', 'yes')}
                        >
                          Yes, Interested
                        </Button>
                        <Button
                          variant={formData.needs_financing === 'no' ? 'default' : 'outline'}
                          className={formData.needs_financing === 'no' ? 'bg-sky-500 flex-1' : 'flex-1 border-gray-700 text-gray-300'}
                          onClick={() => updateForm('needs_financing', 'no')}
                        >
                          No Thanks
                        </Button>
                      </div>
                    </div>
                    {formData.needs_financing !== null && (
                      <Button
                        className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                        onClick={() => goTo(STEPS.NDA)}
                      >
                        Continue <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: NDA                                      */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.NDA && (
              <div>
                <StepHeader
                  icon={FileText}
                  title="Non-Disclosure Agreement"
                  subtitle="Protect your idea — we take confidentiality seriously"
                />
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-4 max-h-48 overflow-y-auto text-sm text-gray-300 leading-relaxed">
                  <p className="font-semibold text-white mb-2">MUTUAL NON-DISCLOSURE AGREEMENT</p>
                  <p className="mb-2">This Mutual Non-Disclosure Agreement ("Agreement") is entered into between Liftori, LLC ("Company") and you ("Client") as of the date of acceptance below.</p>
                  <p className="mb-2"><strong>1. Confidential Information.</strong> Each party agrees to keep confidential all proprietary information shared during the course of project discussions, scoping, development, and delivery.</p>
                  <p className="mb-2"><strong>2. Non-Disclosure.</strong> Neither party shall disclose the other party's confidential information to any third party without prior written consent.</p>
                  <p className="mb-2"><strong>3. Use Restriction.</strong> Confidential information shall only be used for the purpose of evaluating and executing the project scope discussed.</p>
                  <p className="mb-2"><strong>4. Duration.</strong> This agreement remains in effect for two (2) years from the date of acceptance.</p>
                  <p className="mb-2"><strong>5. Exceptions.</strong> Information that is publicly available, independently developed, or legally required to be disclosed is exempt.</p>
                  <p><strong>6. Governing Law.</strong> This agreement is governed by the laws of the State of Florida.</p>
                </div>
                <div className="flex items-start gap-3 mb-4">
                  <Checkbox
                    id="nda-accept"
                    checked={formData.nda_accepted}
                    onCheckedChange={(checked) => {
                      updateForm('nda_accepted', checked);
                      if (checked) updateForm('nda_accepted_at', new Date().toISOString());
                    }}
                    className="mt-1"
                  />
                  <label htmlFor="nda-accept" className="text-sm text-gray-300 cursor-pointer">
                    I have read and agree to the Mutual Non-Disclosure Agreement. I understand that both parties are bound by these terms.
                  </label>
                </div>
                <Button
                  className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                  disabled={!formData.nda_accepted}
                  onClick={() => goTo(formData.path === 'consulting' ? STEPS.CONSULT_REVIEW : STEPS.REVIEW)}
                >
                  Accept & Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: REVIEW (Product)                         */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.REVIEW && (
              <div>
                <StepHeader
                  icon={CheckCircle2}
                  title="Review Your Project"
                  subtitle="Make sure everything looks right before submitting"
                />
                <div className="space-y-3 mb-6">
                  <ReviewItem label="Name" value={formData.full_name} />
                  <ReviewItem label="Email" value={formData.email} />
                  <ReviewItem label="Phone" value={formData.phone} />
                  <ReviewItem label="Company" value={formData.company_name || 'Not provided'} />
                  <ReviewItem label="Industry" value={formData.industry || 'Not provided'} />
                  <ReviewItem label="Product Type" value={PRODUCT_TYPES.find(p => p.id === formData.product_type)?.label || formData.product_type} />
                  <ReviewItem label="Description" value={formData.product_description} truncate />
                  <ReviewItem label="Features" value={formData.features.join(', ') || 'None selected'} />
                  <ReviewItem label="Database" value={formData.needs_database === 'yes' ? 'Yes' : formData.needs_database === 'no' ? 'No' : 'Not sure'} />
                  <ReviewItem label="Hosting" value={formData.hosting === 'liftori' ? 'Liftori Managed' : formData.hosting === 'self-host' ? 'Self-Hosted' : 'Undecided'} />
                  <ReviewItem label="Timeline" value={TIMELINE_OPTIONS.find(t => t.id === formData.timeline)?.label || formData.timeline} />
                  <ReviewItem label="Security" value={SECURITY_OPTIONS.find(s => s.id === formData.security)?.label || formData.security} />
                  <ReviewItem label="Budget" value={BUDGET_OPTIONS.find(b => b.id === formData.budget)?.label || formData.budget} />
                  <ReviewItem label="Financing" value={formData.needs_financing === 'yes' ? 'Interested' : 'Not needed'} />
                  <ReviewItem label="NDA" value={formData.nda_accepted ? 'Accepted' : 'Not accepted'} />
                </div>
                <Button
                  className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-semibold text-lg"
                  disabled={loading}
                  onClick={submitWizard}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Submit Project
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: CONSULTING - DESCRIBE                    */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.CONSULT_DESCRIBE && (
              <div>
                <StepHeader
                  icon={MessageSquare}
                  title="Tell Us About Your Business"
                  subtitle="What challenges are you facing? How can we help?"
                />
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">What issues or inefficiencies are you experiencing?</label>
                    <Textarea
                      value={formData.consulting_description}
                      onChange={e => updateForm('consulting_description', e.target.value)}
                      placeholder="Describe your current pain points, manual processes, or areas where you think AI and automation could help..."
                      className="min-h-[120px] bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">What tools or software do you currently use?</label>
                    <Textarea
                      value={formData.consulting_tools}
                      onChange={e => updateForm('consulting_tools', e.target.value)}
                      placeholder="e.g. QuickBooks, Salesforce, Excel spreadsheets, manual paperwork..."
                      className="min-h-[80px] bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-sky-500"
                    />
                  </div>
                  <Button
                    className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                    onClick={() => goTo(STEPS.CONSULT_SCHEDULE)}
                    disabled={!formData.consulting_description}
                  >
                    Continue to Scheduling <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: CONSULTING - SCHEDULE                    */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.CONSULT_SCHEDULE && (
              <div>
                <StepHeader
                  icon={Calendar}
                  title="Schedule a Consultation"
                  subtitle="Pick a time to meet with our team"
                />
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-3">Who would you like to meet with?</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => updateForm('consultant', 'ryan')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                          formData.consultant === 'ryan' ? 'border-sky-500 bg-sky-500/10' : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full bg-sky-500/20 flex items-center justify-center">
                          <User className="h-6 w-6 text-sky-400" />
                        </div>
                        <span className="text-white font-medium">Ryan March</span>
                        <span className="text-gray-400 text-xs">CEO & Tech Lead</span>
                      </button>
                      <button
                        onClick={() => updateForm('consultant', 'mike')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                          formData.consultant === 'mike' ? 'border-sky-500 bg-sky-500/10' : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full bg-sky-500/20 flex items-center justify-center">
                          <User className="h-6 w-6 text-sky-400" />
                        </div>
                        <span className="text-white font-medium">Mike Lydon</span>
                        <span className="text-gray-400 text-xs">Business Development</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Preferred Date</label>
                    <Input
                      type="date"
                      value={formData.appointment_date}
                      onChange={e => updateForm('appointment_date', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="bg-gray-800/50 border-gray-700 text-white focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Preferred Time</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM'].map(time => (
                        <button
                          key={time}
                          onClick={() => updateForm('appointment_time', time)}
                          className={`p-2 rounded-lg text-sm font-medium transition-all ${
                            formData.appointment_time === time
                              ? 'bg-sky-500 text-white'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button
                    className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                    onClick={() => goTo(STEPS.NDA)}
                    disabled={!formData.consultant || !formData.appointment_date || !formData.appointment_time}
                  >
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: CONSULTING REVIEW                        */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.CONSULT_REVIEW && (
              <div>
                <StepHeader
                  icon={CheckCircle2}
                  title="Review Your Consultation"
                  subtitle="Confirm your details before booking"
                />
                <div className="space-y-3 mb-6">
                  <ReviewItem label="Name" value={formData.full_name} />
                  <ReviewItem label="Email" value={formData.email} />
                  <ReviewItem label="Phone" value={formData.phone} />
                  <ReviewItem label="Company" value={formData.company_name || 'Not provided'} />
                  <ReviewItem label="Challenges" value={formData.consulting_description} truncate />
                  <ReviewItem label="Current Tools" value={formData.consulting_tools || 'Not provided'} />
                  <ReviewItem label="Consultant" value={formData.consultant === 'ryan' ? 'Ryan March' : 'Mike Lydon'} />
                  <ReviewItem label="Date" value={formData.appointment_date} />
                  <ReviewItem label="Time" value={formData.appointment_time} />
                  <ReviewItem label="NDA" value={formData.nda_accepted ? 'Accepted' : 'Not accepted'} />
                </div>
                <Button
                  className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-semibold text-lg"
                  disabled={loading}
                  onClick={submitWizard}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      <Calendar className="h-5 w-5 mr-2" />
                      Book Consultation
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP: COMPLETE                                 */}
            {/* ═══════════════════════════════════════════════ */}
            {step === STEPS.COMPLETE && (
              <div className="text-center py-6">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-sky-500/20 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-sky-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  You're on the Waitlist!
                </h2>
                <p className="text-gray-400 mb-2">
                  Thanks, {formData.full_name?.split(' ')[0] || 'there'}! We've got your details and you're officially on the list.
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  {formData.path === 'consulting'
                    ? 'One of our consultants will reach out to schedule a conversation with you.'
                    : formData.path === 'callback'
                    ? 'A member of our team will reach out to you shortly.'
                    : 'We\'ll be in touch soon with more information about your project and next steps.'
                  }
                </p>
                <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-full px-4 py-1.5 text-sky-300 text-sm mb-6">
                  <Sparkles className="h-4 w-4" />
                  You could be one of our free platform winners!
                </div>
                <div className="space-y-3">
                  <Button
                    className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                    onClick={() => navigate('/portal')}
                  >
                    Go to Your Dashboard <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <button
                    onClick={() => window.location.href = 'https://www.liftori.ai'}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Return to liftori.ai
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-4">
          Powered by Liftori — Lift Your Idea
        </p>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────

function StepHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-sky-400" />
        </div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      {subtitle && <p className="text-gray-400 text-sm ml-[52px]">{subtitle}</p>}
    </div>
  );
}

function WizardButton({ icon: Icon, label, desc, onClick, variant, highlight, selected }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
        selected
          ? 'border-sky-500 bg-sky-500/10'
          : highlight
          ? 'border-sky-500/50 bg-sky-500/5 hover:bg-sky-500/10 hover:border-sky-500'
          : variant === 'outline'
          ? 'border-gray-700 bg-transparent hover:bg-gray-800/50 hover:border-gray-600'
          : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/60 hover:border-gray-600'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        selected || highlight ? 'bg-sky-500/20' : 'bg-gray-800'
      }`}>
        <Icon className={`h-5 w-5 ${selected || highlight ? 'text-sky-400' : 'text-gray-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium">{label}</p>
        {desc && <p className="text-gray-400 text-sm">{desc}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
    </button>
  );
}

function WizardInput({ label, value, onChange, placeholder, type = 'text', icon: Icon }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        )}
        <Input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-sky-500 h-11 ${Icon ? 'pl-10' : ''}`}
        />
      </div>
    </div>
  );
}

function ReviewItem({ label, value, truncate }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-800">
      <span className="text-gray-400 text-sm shrink-0">{label}</span>
      <span className={`text-white text-sm text-right ${truncate ? 'line-clamp-2' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}
