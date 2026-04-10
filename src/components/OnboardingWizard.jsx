import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Shield, FileText, User, CheckCircle2, ArrowRight, Download, Upload, Camera } from 'lucide-react';

const STEPS = [
  { id: 'welcome', label: 'Welcome', icon: Shield },
  { id: 'nda', label: 'NDA Agreement', icon: FileText },
  { id: 'contract', label: '1099 Agreement', icon: FileText },
  { id: 'profile', label: 'Set Up Profile', icon: User },
  { id: 'complete', label: 'All Set!', icon: CheckCircle2 },
];

export default function OnboardingWizard({ onComplete, previewMode = false }) {
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    personal_email: profile?.personal_email || '',
  });
  const [saving, setSaving] = useState(false);
  const [onboardingRecord, setOnboardingRecord] = useState(null);

  useEffect(() => {
    // Check if there's an onboarding record for this user
    fetchOnboardingRecord();
  }, [user]);

  async function fetchOnboardingRecord() {
    if (!user?.email) return;
    try {
      const { data } = await supabase
        .from('team_onboarding')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      if (data) setOnboardingRecord(data);
    } catch (err) {
      console.error('Error fetching onboarding record:', err);
    }
  }

  async function updateOnboardingStep(stepKey, value = true) {
    if (previewMode || !onboardingRecord) return;
    try {
      const updatedChecklist = { ...onboardingRecord.checklist, [stepKey]: value };
      await supabase
        .from('team_onboarding')
        .update({ checklist: updatedChecklist })
        .eq('id', onboardingRecord.id);
      setOnboardingRecord({ ...onboardingRecord, checklist: updatedChecklist });
    } catch (err) {
      console.error('Error updating onboarding step:', err);
    }
  }

  async function handleAcceptNDA() {
    setNdaAccepted(true);
    if (!previewMode) await updateOnboardingStep('nda_signed');
    setCurrentStep(2);
  }

  async function handleAcceptContract() {
    setContractAccepted(true);
    if (!previewMode) await updateOnboardingStep('contract_signed');
    setCurrentStep(3);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!previewMode) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: profileForm.full_name,
            phone: profileForm.phone,
            personal_email: profileForm.personal_email,
          })
          .eq('id', user.id);
        if (error) throw error;
      }
      setCurrentStep(4);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    try {
      if (!previewMode) {
        await supabase
          .from('profiles')
          .update({ onboarding_complete: true })
          .eq('id', user.id);
      }

      if (!previewMode && onboardingRecord) {
        await updateOnboardingStep('account_created');
        await updateOnboardingStep('onboarding_complete');
      }

      onComplete();
    } catch (err) {
      console.error('Error completing onboarding:', err);
    }
  }

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900/20" />

      <div className="relative w-full max-w-2xl mx-4">
        {/* Preview Mode Banner */}
        {previewMode && (
          <div className="flex items-center justify-between mb-4 bg-amber-500/20 border border-amber-500/40 rounded-lg px-4 py-2">
            <span className="text-amber-300 text-sm font-medium">Preview Mode — this is what new team members will see</span>
            <button
              onClick={onComplete}
              className="text-amber-300 hover:text-white text-sm font-medium px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded transition"
            >
              Exit Preview
            </button>
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                i < currentStep ? 'bg-emerald-500 text-white' :
                i === currentStep ? 'bg-sky-500 text-white' :
                'bg-slate-700 text-gray-500'
              }`}>
                {i < currentStep ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${i < currentStep ? 'bg-emerald-500' : 'bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* ─── WELCOME STEP ─── */}
          {currentStep === 0 && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-sky-500/20 flex items-center justify-center mx-auto mb-6">
                <Shield size={32} className="text-sky-400" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-3">Welcome to Liftori AI</h1>
              <p className="text-gray-400 text-lg mb-2">
                {profile?.full_name ? `Hey ${profile.full_name.split(' ')[0]}!` : 'Welcome aboard!'}
              </p>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Before you get started, we need to complete a few quick steps to get your account set up.
                This includes reviewing and accepting our agreements and setting up your profile.
              </p>
              <button
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-8 py-3 rounded-lg font-medium transition text-lg"
              >
                Let's Go
                <ArrowRight size={20} />
              </button>
            </div>
          )}

          {/* ─── NDA STEP ─── */}
          {currentStep === 1 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <FileText size={20} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Non-Disclosure Agreement</h2>
                  <p className="text-gray-500 text-sm">Step 1 of 3 — Review and accept the NDA</p>
                </div>
              </div>

              <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-5 mb-6 max-h-64 overflow-y-auto">
                <h3 className="text-white font-semibold mb-3">Key Terms</h3>
                <div className="space-y-3 text-sm text-gray-400">
                  <p><span className="text-white font-medium">Confidential Information:</span> All non-public, proprietary, or trade secret information — including source code, algorithms, system architecture, APIs, database schemas, client data, business strategies, pricing models, financial data, product roadmaps, and internal communications.</p>
                  <p><span className="text-white font-medium">Non-Disclosure:</span> You may not disclose, publish, or reveal any Confidential Information to any third party at any time during or after your engagement. Violations may result in immediate legal action.</p>
                  <p><span className="text-white font-medium">No Reverse Engineering:</span> You may not reverse engineer, decompile, or derive source code from any Company software, prototypes, or materials.</p>
                  <p><span className="text-white font-medium">IP Ownership:</span> All work product, code, designs, and documentation created during your engagement are the sole and exclusive property of Liftori AI LLC, including all intellectual property rights. You irrevocably assign all rights to the Company.</p>
                  <p><span className="text-white font-medium">Non-Solicitation (24 months):</span> You may not solicit, recruit, or divert any Liftori clients, prospective clients, employees, or contractors for 24 months after termination.</p>
                  <p><span className="text-white font-medium">Non-Compete (12 months):</span> You may not engage in, own, or provide services to any directly competing AI-powered web development agency or substantially similar business within the United States for 12 months after termination.</p>
                  <p><span className="text-white font-medium">Remedies:</span> Breach may result in injunctive relief, $50,000 liquidated damages per occurrence, plus actual damages and attorney's fees.</p>
                  <p><span className="text-white font-medium">Duration:</span> Confidentiality obligations survive for 5 years. Dispute resolution via mediation then binding arbitration in Florida.</p>
                </div>
              </div>

              <a
                href="/templates/liftori-nda-template.docx"
                download
                className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 text-sm font-medium mb-6 transition"
              >
                <Download size={16} />
                Download Full NDA Document
              </a>

              <button
                type="button"
                onClick={() => setNdaAccepted(!ndaAccepted)}
                className={`flex items-start gap-3 mb-6 p-4 rounded-lg w-full text-left transition-all cursor-pointer border-2 ${
                  ndaAccepted
                    ? 'bg-sky-500/10 border-sky-500'
                    : 'bg-slate-700/20 border-slate-600/50 hover:border-slate-500'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                  ndaAccepted
                    ? 'bg-sky-500 border-sky-500'
                    : 'bg-slate-700 border-slate-500'
                }`}>
                  {ndaAccepted && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-gray-300 text-sm">
                  I have read and agree to the Liftori AI Non-Disclosure Agreement. I understand that violation of this agreement may result in legal action including injunctive relief and liquidated damages.
                </span>
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(0)}
                  className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm font-medium transition"
                >
                  Back
                </button>
                <button
                  onClick={handleAcceptNDA}
                  disabled={!ndaAccepted}
                  className="flex-1 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition"
                >
                  Accept & Continue
                  <ArrowRight size={16} />
                </button>
              </div>
              {!ndaAccepted && (
                <p className="text-amber-400/70 text-xs text-center mt-3">Check the agreement box above to continue</p>
              )}
            </div>
          )}

          {/* ─── 1099 CONTRACT STEP ─── */}
          {currentStep === 2 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <FileText size={20} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Independent Contractor Agreement</h2>
                  <p className="text-gray-500 text-sm">Step 2 of 3 — Review and accept the 1099 agreement</p>
                </div>
              </div>

              <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-5 mb-6 max-h-64 overflow-y-auto">
                <h3 className="text-white font-semibold mb-3">Key Terms</h3>
                <div className="space-y-3 text-sm text-gray-400">
                  <p><span className="text-white font-medium">Independent Contractor Status:</span> You are an independent contractor, not an employee, partner, or agent. You are solely responsible for all federal, state, and local taxes including self-employment taxes. You are not entitled to any employee benefits.</p>
                  <p><span className="text-white font-medium">Compensation & Invoicing:</span> Rates, payment schedule, and scope are defined in Exhibit A. Invoices must be submitted bi-weekly/monthly. Payment within 15 business days of approved invoice. Expenses over $100 require pre-approval.</p>
                  <p><span className="text-white font-medium">W-9 & 1099-NEC:</span> You must provide a completed W-9 before receiving any payment. A 1099-NEC will be issued for annual compensation exceeding $600.</p>
                  <p><span className="text-white font-medium">Intellectual Property:</span> All work product, code, designs, inventions, and documentation created during engagement are the sole and exclusive property of Liftori AI LLC as "work made for hire." You irrevocably assign all rights including copyrights, patents, and trade secrets.</p>
                  <p><span className="text-white font-medium">Confidentiality:</span> The NDA executed alongside this agreement is incorporated by reference. You must not use Company systems for personal purposes, must encrypt any Company data on personal devices, and must delete all Company data from personal devices within 5 business days of termination.</p>
                  <p><span className="text-white font-medium">Termination:</span> Either party may terminate with 14 days' written notice. Immediate termination for: breach of agreement/NDA, gross negligence, fraud, dishonesty, or felony conviction. You must provide up to 10 days of transition assistance upon termination.</p>
                  <p><span className="text-white font-medium">Indemnification:</span> You agree to indemnify and hold harmless Liftori AI LLC from claims arising from your breach, negligence, or IP infringement.</p>
                  <p><span className="text-white font-medium">Dispute Resolution:</span> Good faith negotiation, then mediation, then binding arbitration in Florida. Prevailing party recovers attorney's fees.</p>
                </div>
              </div>

              <a
                href="/templates/liftori-1099-agreement-template.docx"
                download
                className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 text-sm font-medium mb-6 transition"
              >
                <Download size={16} />
                Download Full 1099 Agreement
              </a>

              <button
                type="button"
                onClick={() => setContractAccepted(!contractAccepted)}
                className={`flex items-start gap-3 mb-6 p-4 rounded-lg w-full text-left transition-all cursor-pointer border-2 ${
                  contractAccepted
                    ? 'bg-sky-500/10 border-sky-500'
                    : 'bg-slate-700/20 border-slate-600/50 hover:border-slate-500'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                  contractAccepted
                    ? 'bg-sky-500 border-sky-500'
                    : 'bg-slate-700 border-slate-500'
                }`}>
                  {contractAccepted && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-gray-300 text-sm">
                  I have read and agree to the Liftori AI Independent Contractor Agreement. I understand I am engaged as an independent contractor and am responsible for my own tax obligations.
                </span>
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm font-medium transition"
                >
                  Back
                </button>
                <button
                  onClick={handleAcceptContract}
                  disabled={!contractAccepted}
                  className="flex-1 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition"
                >
                  Accept & Continue
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ─── PROFILE SETUP STEP ─── */}
          {currentStep === 3 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <User size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Set Up Your Profile</h2>
                  <p className="text-gray-500 text-sm">Step 3 of 3 — Tell us about yourself</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profileForm.full_name}
                    onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    required
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="555-123-4567"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-1">Personal Email</label>
                    <input
                      type="email"
                      value={profileForm.personal_email}
                      onChange={e => setProfileForm({ ...profileForm, personal_email: e.target.value })}
                      placeholder="you@personal.com"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="text-gray-500 text-xs mt-2">
                  You can update your profile picture and notification settings later in your account settings.
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm font-medium transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !profileForm.full_name}
                    className="flex-1 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white py-2.5 rounded-lg text-sm font-medium transition"
                  >
                    {saving ? 'Saving...' : 'Save & Continue'}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ─── COMPLETE STEP ─── */}
          {currentStep === 4 && (
            <div className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-emerald-400" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-3">You're All Set!</h1>
              <p className="text-gray-400 text-lg mb-2">Welcome to the Liftori AI team.</p>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Your agreements are on file and your profile is ready. You now have access to the platform
                based on your assigned role. Let's get to work!
              </p>
              <button
                onClick={handleComplete}
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-lg font-medium transition text-lg"
              >
                Enter Liftori
                <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          Liftori AI LLC — Confidential
        </p>
      </div>
    </div>
  );
}
