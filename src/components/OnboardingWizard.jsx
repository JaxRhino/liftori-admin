import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Shield, FileText, User, CheckCircle2, ArrowRight, Download, PenTool } from 'lucide-react';

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
  const [ndaScrolledToBottom, setNdaScrolledToBottom] = useState(false);
  const [contractScrolledToBottom, setContractScrolledToBottom] = useState(false);
  const [signingNDA, setSigningNDA] = useState(false);
  const [signingContract, setSigningContract] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    personal_email: profile?.personal_email || '',
  });
  const [saving, setSaving] = useState(false);
  const [onboardingRecord, setOnboardingRecord] = useState(null);

  useEffect(() => {
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

  async function recordSignature(agreementType) {
    if (previewMode) return;
    try {
      const { error } = await supabase.from('agreement_signatures').insert({
        user_id: user.id,
        agreement_type: agreementType,
        full_name: profile?.full_name || user.email,
        email: user.email,
        signed_at: new Date().toISOString(),
        user_agent: navigator.userAgent,
        agreement_version: '1.0',
      });
      if (error && error.code !== '23505') throw error; // ignore duplicate
    } catch (err) {
      console.error('Error recording signature:', err);
    }
  }

  async function handleAcceptNDA() {
    setSigningNDA(true);
    try {
      await recordSignature('nda');
      setNdaAccepted(true);
      if (!previewMode) await updateOnboardingStep('nda_signed');
      setCurrentStep(2);
    } finally {
      setSigningNDA(false);
    }
  }

  async function handleAcceptContract() {
    setSigningContract(true);
    try {
      await recordSignature('1099');
      setContractAccepted(true);
      if (!previewMode) await updateOnboardingStep('contract_signed');
      setCurrentStep(3);
    } finally {
      setSigningContract(false);
    }
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

  // Shared PDF viewer + signature step
  function AgreementStep({ type, title, subtitle, pdfUrl, docxUrl, accepted, onAccept, signing, iconColor, iconBg, scrolledToBottom, setScrolledToBottom }) {
    const handlePdfScroll = (e) => {
      // For iframe we can't detect scroll, so we use a timer approach
    };

    return (
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
            <FileText size={20} className={iconColor} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="text-gray-500 text-sm">{subtitle}</p>
          </div>
          <a
            href={docxUrl}
            download
            className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-xs font-medium transition bg-sky-500/10 px-3 py-1.5 rounded-lg"
          >
            <Download size={14} />
            Download .docx
          </a>
        </div>

        {/* PDF Viewer */}
        <div className="rounded-lg border border-slate-600/50 overflow-hidden mb-4 bg-white">
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=0&view=FitH`}
            className="w-full"
            style={{ height: '400px' }}
            title={title}
          />
        </div>

        {/* Digital Signature Section */}
        <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <PenTool size={16} className="text-sky-400" />
            <h3 className="text-white font-semibold text-sm">Digital Signature</h3>
          </div>

          {/* Agreement checkbox */}
          <button
            type="button"
            onClick={() => {
              if (type === 'nda') setNdaAccepted(!ndaAccepted);
              else setContractAccepted(!contractAccepted);
            }}
            className={`flex items-start gap-3 p-3 rounded-lg w-full text-left transition-all cursor-pointer border-2 ${
              accepted
                ? 'bg-sky-500/10 border-sky-500'
                : 'bg-slate-700/20 border-slate-600/50 hover:border-slate-500'
            }`}
          >
            <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${
              accepted ? 'bg-sky-500 border-sky-500' : 'bg-slate-700 border-slate-500'
            }`}>
              {accepted && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <span className="text-gray-300 text-sm">
                {type === 'nda'
                  ? 'I have read and agree to the Liftori AI Non-Disclosure Agreement. I understand that violation may result in injunctive relief, $50,000 liquidated damages per occurrence, and recovery of attorney\'s fees.'
                  : 'I have read and agree to the Liftori AI Independent Contractor Agreement. I understand I am engaged as an independent contractor and am responsible for my own tax obligations.'
                }
              </span>
              {accepted && (
                <div className="mt-2 flex items-center gap-2 text-xs text-sky-400">
                  <PenTool size={12} />
                  <span>
                    Signing as <strong>{profile?.full_name || user?.email}</strong> ({user?.email}) on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentStep(type === 'nda' ? 0 : 1)}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg text-sm font-medium transition"
          >
            Back
          </button>
          <button
            onClick={onAccept}
            disabled={!accepted || signing}
            className="flex-1 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition"
          >
            {signing ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Recording Signature...
              </>
            ) : (
              <>
                Sign & Continue
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
        {!accepted && (
          <p className="text-amber-400/70 text-xs text-center mt-3">Read the agreement above and check the box to sign digitally</p>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center overflow-y-auto">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900/20" />

      <div className="relative w-full max-w-3xl mx-4 my-8">
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
        <div className="flex items-center justify-center gap-2 mb-6">
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
                You'll review and digitally sign our agreements, then set up your profile.
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
            <AgreementStep
              type="nda"
              title="Non-Disclosure Agreement"
              subtitle="Step 1 of 3 — Review and digitally sign the NDA"
              pdfUrl="/templates/liftori-nda.pdf"
              docxUrl="/templates/liftori-nda-template.docx"
              accepted={ndaAccepted}
              onAccept={handleAcceptNDA}
              signing={signingNDA}
              iconColor="text-amber-400"
              iconBg="bg-amber-500/20"
              scrolledToBottom={ndaScrolledToBottom}
              setScrolledToBottom={setNdaScrolledToBottom}
            />
          )}

          {/* ─── 1099 CONTRACT STEP ─── */}
          {currentStep === 2 && (
            <AgreementStep
              type="1099"
              title="Independent Contractor Agreement"
              subtitle="Step 2 of 3 — Review and digitally sign the 1099 agreement"
              pdfUrl="/templates/liftori-1099-agreement.pdf"
              docxUrl="/templates/liftori-1099-agreement-template.docx"
              accepted={contractAccepted}
              onAccept={handleAcceptContract}
              signing={signingContract}
              iconColor="text-purple-400"
              iconBg="bg-purple-500/20"
              scrolledToBottom={contractScrolledToBottom}
              setScrolledToBottom={setContractScrolledToBottom}
            />
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
              <p className="text-gray-500 mb-4 max-w-md mx-auto">
                Your agreements have been digitally signed and recorded. Your profile is ready.
                You now have access to the platform based on your assigned role.
              </p>
              <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-4 mb-6 max-w-sm mx-auto text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Signed Agreements</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span className="text-gray-300">Non-Disclosure Agreement</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span className="text-gray-300">Independent Contractor Agreement</span>
                  </div>
                </div>
              </div>
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
