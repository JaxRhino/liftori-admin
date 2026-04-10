import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Briefcase, Upload, CheckCircle, Loader2, ExternalLink } from 'lucide-react';

/**
 * Public Job Application Page
 * Accessible at /apply or /apply?ref=REFERRAL_CODE
 * No auth required — anyone can submit an application.
 */
export default function Apply() {
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';
  const positionParam = searchParams.get('position') || '';

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [referrerName, setReferrerName] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    position: positionParam,
    linkedin_url: '',
    portfolio_url: '',
    salary_expectation: '',
    availability: '',
    cover_note: '',
  });

  // Resolve referral code to name
  useEffect(() => {
    if (referralCode) {
      supabase
        .from('hiring_referrals')
        .select('user_name')
        .eq('referral_code', referralCode)
        .eq('is_active', true)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.user_name) setReferrerName(data.user_name);
        });
    }
  }, [referralCode]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.position) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      let resume_url = null;

      // Upload resume if provided
      if (resumeFile) {
        const ext = resumeFile.name.split('.').pop();
        const path = `resumes/applications/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('chat-files')
          .upload(path, resumeFile);
        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from('chat-files')
            .getPublicUrl(path);
          resume_url = urlData.publicUrl;
        }
      }

      const { error: insertErr } = await supabase.from('applicants').insert({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        position: form.position,
        linkedin_url: form.linkedin_url || null,
        portfolio_url: form.portfolio_url || null,
        salary_expectation: form.salary_expectation || null,
        availability: form.availability || null,
        resume_url,
        source: referralCode ? `Referral (${referrerName || referralCode})` : 'Website',
        referral_code: referralCode || null,
        stage: 'applied',
      });

      if (insertErr) throw insertErr;

      // Update referral stats if applicable
      if (referralCode) {
        await supabase.rpc('increment_referral_count', { code: referralCode }).catch(() => {
          // Non-critical — just log it
          console.log('Referral count increment skipped (RPC may not exist yet)');
        });
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Application error:', err);
      setError('Something went wrong. Please try again or contact us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#060B18] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Application Submitted!</h1>
          <p className="text-gray-400">
            Thanks for your interest in joining the Liftori team, {form.full_name}.
            We'll review your application and get back to you soon.
          </p>
          {referrerName && (
            <p className="text-sm text-sky-400">Referred by {referrerName}</p>
          )}
          <a href="https://liftori.ai" className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 text-sm">
            <ExternalLink className="h-4 w-4" /> Visit liftori.ai
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060B18]">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0B1120]">
        <div className="max-w-2xl mx-auto px-4 py-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Join Liftori</h1>
            <p className="text-sm text-gray-400">We're building the future of AI-powered business platforms</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {referrerName && (
          <div className="mb-6 bg-sky-500/10 border border-sky-500/20 rounded-lg p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-sky-500/20 rounded-full flex items-center justify-center">
              <Briefcase className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <p className="text-sm text-sky-300 font-medium">Referred by {referrerName}</p>
              <p className="text-xs text-gray-400">Your application will be prioritized</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Full Name *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-white/10 text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                  placeholder="Your full name"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-white/10 text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                  placeholder="you@email.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-white/10 text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Position *</label>
                <select
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-white/10 text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                  required
                >
                  <option value="">Select a position</option>
                  <option value="Sales Representative">Sales Representative</option>
                  <option value="Account Executive">Account Executive</option>
                  <option value="Frontend Developer">Frontend Developer</option>
                  <option value="Full Stack Developer">Full Stack Developer</option>
                  <option value="UI/UX Designer">UI/UX Designer</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Marketing Specialist">Marketing Specialist</option>
                  <option value="Customer Success">Customer Success</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Professional Info */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Professional Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">LinkedIn Profile</label>
                <input
                  type="url"
                  value={form.linkedin_url}
                  onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-white/10 text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Portfolio / Website</label>
                <input
                  type="url"
                  value={form.portfolio_url}
                  onChange={e => setForm(f => ({ ...f, portfolio_url: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-white/10 text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                  placeholder="https://yoursite.com"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Salary Expectation</label>
                <input
                  type="text"
                  value={form.salary_expectation}
                  onChange={e => setForm(f => ({ ...f, salary_expectation: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-white/10 text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                  placeholder="Commission-based, $80k base, etc."
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Availability</label>
                <input
                  type="text"
                  value={form.availability}
                  onChange={e => setForm(f => ({ ...f, availability: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-white/10 text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                  placeholder="Available now, 2 weeks notice..."
                />
              </div>
            </div>
          </div>

          {/* Resume Upload */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Resume</h2>
            <label className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-sky-500/50 transition-colors">
              <Upload className="h-5 w-5 text-gray-400" />
              <div className="text-sm">
                {resumeFile ? (
                  <span className="text-sky-400">{resumeFile.name}</span>
                ) : (
                  <span className="text-gray-400">Click to upload resume (PDF, DOC, DOCX)</span>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={e => setResumeFile(e.target.files[0] || null)}
              />
            </label>
          </div>

          {/* Cover Note */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Why Liftori?</h2>
            <textarea
              value={form.cover_note}
              onChange={e => setForm(f => ({ ...f, cover_note: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-white/10 text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none resize-none"
              rows={4}
              placeholder="Tell us why you'd be a great fit for the Liftori team..."
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            By submitting, you agree to allow Liftori to process your application data.
            We'll never share your information with third parties.
          </p>
        </form>
      </div>
    </div>
  );
}
