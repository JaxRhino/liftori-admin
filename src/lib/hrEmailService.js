import { supabase } from './supabase';

const SUPABASE_URL = 'https://qlerfkdyslndjbaltkwo.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ─── Send email via Edge Function ─────────────────────────────
async function sendEmail({ to, subject, html, from }) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ to, subject, html, from }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Email send failed');
  return data;
}

// ─── Generate Interview Token ──────────────────────────────────
export async function createInterviewToken(applicantId) {
  const token = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
  const expires = new Date();
  expires.setDate(expires.getDate() + 7); // 7-day expiry

  const { data, error } = await supabase
    .from('interview_tokens')
    .insert({
      applicant_id: applicantId,
      token,
      expires_at: expires.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Welcome Email (sent when applicant is added) ──────────────
export async function sendApplicantWelcomeEmail(applicant, schedulingToken) {
  const schedulingUrl = `${window.location.origin}/schedule-interview/${schedulingToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0B1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:12px 24px;border-radius:12px;">
        <span style="color:white;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Liftori</span>
      </div>
    </div>

    <!-- Main Card -->
    <div style="background-color:#1a2332;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:40px;margin-bottom:24px;">
      <!-- Sage Avatar + Greeting -->
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#8b5cf6);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:28px;">✨</span>
        </div>
        <h1 style="color:white;font-size:24px;margin:0 0 4px;">Welcome, ${applicant.full_name}!</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0;">A message from Sage, your AI assistant at Liftori</p>
      </div>

      <div style="color:#cbd5e1;font-size:15px;line-height:1.7;">
        <p style="margin:0 0 16px;">Hi ${applicant.full_name.split(' ')[0]},</p>

        <p style="margin:0 0 16px;">I am so excited to welcome you to the Liftori application process! I am Sage, the AI that helps power everything at Liftori, and I will be your guide through this journey.</p>

        <p style="margin:0 0 16px;">We received your application for <strong style="color:white;">${applicant.position}</strong> and we are genuinely thrilled about your interest. At Liftori, we are building the future of AI-powered business solutions, and every person who joins our team plays a critical role in that mission.</p>

        <p style="margin:0 0 16px;">Here is what happens next:</p>

        <div style="background-color:rgba(14,165,233,0.1);border-left:3px solid #0ea5e9;border-radius:0 8px 8px 0;padding:16px;margin:0 0 24px;">
          <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
            <span style="background:#0ea5e9;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-right:12px;flex-shrink:0;">1</span>
            <span style="color:#e2e8f0;"><strong style="color:white;">Schedule Your Interview</strong> — Pick a time that works for you using the link below</span>
          </div>
          <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
            <span style="background:#6366f1;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-right:12px;flex-shrink:0;">2</span>
            <span style="color:#e2e8f0;"><strong style="color:white;">Meet the Team</strong> — Have a conversation with our leadership</span>
          </div>
          <div style="display:flex;align-items:flex-start;">
            <span style="background:#10b981;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin-right:12px;flex-shrink:0;">3</span>
            <span style="color:#e2e8f0;"><strong style="color:white;">Get Started</strong> — If approved, you will receive your platform access and onboarding</span>
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0 16px;">
        <a href="${schedulingUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:white;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:10px;letter-spacing:0.3px;">
          Schedule Your Interview
        </a>
      </div>
      <p style="text-align:center;color:#64748b;font-size:12px;margin:0;">This link expires in 7 days</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#475569;font-size:12px;line-height:1.6;">
      <p style="margin:0 0 4px;">Sent with care by Sage</p>
      <p style="margin:0 0 4px;">Liftori — AI-Powered Business Solutions</p>
      <p style="margin:0;">
        <a href="https://liftori.ai" style="color:#0ea5e9;text-decoration:none;">liftori.ai</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  await sendEmail({
    to: applicant.email,
    subject: `Welcome to Liftori, ${applicant.full_name.split(' ')[0]}! Let's schedule your interview`,
    html,
    from: 'Sage from Liftori <sage@liftori.ai>',
  });

  // Mark email sent on applicant record
  await supabase
    .from('applicants')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', applicant.id);
}

// ─── Approval Email (platform login + onboarding) ──────────────
export async function sendApprovalEmail(applicant) {
  const loginUrl = 'https://admin.liftori.ai/login';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0B1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:12px 24px;border-radius:12px;">
        <span style="color:white;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Liftori</span>
      </div>
    </div>

    <!-- Main Card -->
    <div style="background-color:#1a2332;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:40px;margin-bottom:24px;">
      <!-- Celebration -->
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;margin-bottom:8px;">🎉</div>
        <h1 style="color:white;font-size:28px;margin:0 0 4px;">You are In, ${applicant.full_name.split(' ')[0]}!</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0;">Welcome to the Liftori team</p>
      </div>

      <div style="color:#cbd5e1;font-size:15px;line-height:1.7;">
        <p style="margin:0 0 16px;">Hi ${applicant.full_name.split(' ')[0]},</p>

        <p style="margin:0 0 16px;">Incredible news — you have been <strong style="color:#10b981;">approved</strong> to join the Liftori team as a <strong style="color:white;">${applicant.position}</strong>! We are so pumped to have you on board.</p>

        <p style="margin:0 0 16px;">Your platform access is ready. Click below to log in and start your onboarding — I will walk you through everything you need to know.</p>

        <div style="background-color:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:20px;margin:24px 0;">
          <h3 style="color:#10b981;font-size:14px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Your Login Details</h3>
          <div style="color:#e2e8f0;font-size:14px;">
            <p style="margin:0 0 8px;"><strong>Email:</strong> ${applicant.email}</p>
            <p style="margin:0;"><strong>Password:</strong> A temporary password has been sent separately, or use the "Forgot Password" link to set your own.</p>
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0 16px;">
        <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#0ea5e9);color:white;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:10px;letter-spacing:0.3px;">
          Log In to Liftori
        </a>
      </div>

      <div style="color:#cbd5e1;font-size:15px;line-height:1.7;margin-top:24px;">
        <p style="margin:0 0 16px;">A few things to get excited about:</p>
        <ul style="margin:0 0 16px;padding-left:20px;">
          <li style="margin-bottom:8px;">Access to our full AI-powered platform</li>
          <li style="margin-bottom:8px;">Your own team dashboard and tools</li>
          <li style="margin-bottom:8px;">Team chat &amp; Video Chat — our internal communication hub</li>
          <li style="margin-bottom:8px;">Direct access to me (Sage) for anything you need</li>
        </ul>
        <p style="margin:0;">Let us build something amazing together.</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#475569;font-size:12px;line-height:1.6;">
      <p style="margin:0 0 4px;">Sent with excitement by Sage</p>
      <p style="margin:0 0 4px;">Liftori — AI-Powered Business Solutions</p>
      <p style="margin:0;">
        <a href="https://liftori.ai" style="color:#0ea5e9;text-decoration:none;">liftori.ai</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  await sendEmail({
    to: applicant.email,
    subject: `You're approved! Welcome to the Liftori team, ${applicant.full_name.split(' ')[0]}`,
    html,
    from: 'Sage from Liftori <sage@liftori.ai>',
  });

  // Mark onboarding triggered
  await supabase
    .from('applicants')
    .update({ onboarding_triggered_at: new Date().toISOString() })
    .eq('id', applicant.id);
}

// ─── Interview Confirmation Email ──────────────────────────────
export async function sendInterviewConfirmationEmail(applicant, slot) {
  const dateStr = new Date(slot.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const startStr = formatTime(slot.start_time);
  const endStr = formatTime(slot.end_time);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0B1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:12px 24px;border-radius:12px;">
        <span style="color:white;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Liftori</span>
      </div>
    </div>

    <!-- Main Card -->
    <div style="background-color:#1a2332;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:40px;margin-bottom:24px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;margin-bottom:8px;">📅</div>
        <h1 style="color:white;font-size:24px;margin:0 0 4px;">Interview Confirmed!</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0;">You are all set, ${applicant.full_name.split(' ')[0]}</p>
      </div>

      <div style="color:#cbd5e1;font-size:15px;line-height:1.7;">
        <p style="margin:0 0 16px;">Great news — your interview has been scheduled! Here are the details:</p>

        <div style="background-color:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:20px;margin:0 0 24px;">
          <div style="text-align:center;">
            <div style="color:#818cf8;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Your Interview</div>
            <div style="color:white;font-size:20px;font-weight:600;margin-bottom:4px;">${dateStr}</div>
            <div style="color:#a5b4fc;font-size:16px;">${startStr} — ${endStr}</div>
            <div style="color:#94a3b8;font-size:13px;margin-top:8px;">Position: ${applicant.position}</div>
          </div>
        </div>

        <p style="margin:0 0 16px;">A few tips to help you shine:</p>
        <ul style="margin:0;padding-left:20px;">
          <li style="margin-bottom:8px;">Be yourself — we value authenticity</li>
          <li style="margin-bottom:8px;">Come ready to share your experience and goals</li>
          <li style="margin-bottom:8px;">Have questions ready — this is a two-way conversation</li>
        </ul>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#475569;font-size:12px;line-height:1.6;">
      <p style="margin:0 0 4px;">Sent by Sage</p>
      <p style="margin:0 0 4px;">Liftori — AI-Powered Business Solutions</p>
      <p style="margin:0;"><a href="https://liftori.ai" style="color:#0ea5e9;text-decoration:none;">liftori.ai</a></p>
    </div>
  </div>
</body>
</html>`;

  await sendEmail({
    to: applicant.email,
    subject: `Interview confirmed for ${dateStr} — ${applicant.position} at Liftori`,
    html,
    from: 'Sage from Liftori <sage@liftori.ai>',
  });

  // Update applicant
  await supabase
    .from('applicants')
    .update({ interview_scheduled_at: new Date().toISOString() })
    .eq('id', applicant.id);
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}
