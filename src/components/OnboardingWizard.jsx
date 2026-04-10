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
                  <p><span className="text-white font-medium">Confidential Information:</span> All proprietary information including source code, algorithms, client data, business strategies, pricing models, and platform architecture.</p>
                  <p><span className="text-white font-medium">Non-Solicitation:</span> You agree not to solicit Liftori clients or team members for 2 years after leaving.</p>
                  <p><span className="text-white font-medium">Non-Compete:</span> 1-year restriction within the AI/SaaS web development agency space post-termination.</p>
                  <p><span className="text-white font-medium">IP Protection:</span> All work product created during engagement belongs exclusively to Liftori AI LLC.</p>
                  <p><span className="text-white font-medium">Duration:</span> Obligations survive for 5 years after termination of the relationship.</p>
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

              <div className="flex items-start gap-3 mb-6 p-4 bg-slate-700/20 rounded-lg">
                <input
                  type="checkbox"
                  id="nda-accept"
                  checked={ndaAccepted}
                  onChange={e => setNdaAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded accent-sky-500"
                />
                <label htmlFor="nda-accept" className="text-gray-300 text-sm cursor-pointer">
                  I have read and agree to the Liftori AI Non-Disclosure Agreement. I understand that violation of this agreement may result in legal action including injunctive relief and liquidated damages.
                </label>
              </div>

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
                  <p><span className="text-white font-medium">Contractor Status:</span> You are an independent contractor, not an employee. You are responsible for your own taxes and do not receive employee benefits.</p>
                  <p><span className="text-white font-medium">Compensation:</span> Payment terms, rates, and schedules will be outlined in your role-specific addendum.</p>
                  <p><span className="text-white font-medium">Intellectual Property:</span> All work product, code, designs, and documentation created during engagement are owned by Liftori AI LLC.</p>
                  <p><span className="text-white font-medium">Tax Obligations:</span> You will provide a W-9 and will receive a 1099-NEC for tax purposes.</p>
                  <p><span className="text-white font-medium">Termination:</span> Either party may terminate with 14 days notice. Immediate termination for breach of NDA or misconduct.</p>
                  <p><span className="text-white font-medium">Dispute Resolution:</span> Mediation first, then binding arbitration in Florida.</p>
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

              <div className="flex items-start gap-3 mb-6 p-4 bg-slate-700/20 rounded-lg">
                <input
                  type="checkbox"
                  id="contract-accept"
                  checked={contractAccepted}
                  onChange={e => setContractAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded accent-sky-500"
                />
                <label htmlFor="contract-accept" className="text-gray-300 text-sm cursor-pointer">
                  I have read and agree to the Liftori AI Independent Contractor Agreement. I understand I am engaged as an independent contractor and am responsible for my own tax obligations.
                </label>
              </div>

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
