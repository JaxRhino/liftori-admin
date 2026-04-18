// ===========================================
// Video Call Helpers — Outbound call utilities
// Rally link creation, reminder emails, shared
// across Consulting Appointments + Call Center
// ===========================================
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

// ─── Create Outbound Rally Link ───────────────────────────────
// Creates a one-time rally link for an outbound video call to a lead
export async function createOutboundRallyLink(userId, label = 'Outbound Call') {
  const { data, error } = await supabase
    .from('rally_links')
    .insert({
      created_by: userId,
      label,
      link_type: 'one_time',
      max_guests: 1,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry
    })
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    joinUrl: `https://liftori.ai/rally/join/${data.code}`,
  };
}

// ─── Send Call Reminder Email ─────────────────────────────────
// Sends a branded "Your call is ready" email with the video join link
export async function sendCallReminderEmail({ to, leadName, joinUrl, consultantName = 'our team' }) {
  const firstName = leadName?.split(' ')[0] || 'there';

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
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#6366f1);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:28px;line-height:1;">&#9654;</span>
        </div>
        <h1 style="color:white;font-size:24px;margin:0 0 4px;">Your Video Call is Ready</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0;">Hi ${firstName}, ${consultantName} is waiting for you</p>
      </div>

      <div style="color:#cbd5e1;font-size:15px;line-height:1.7;">
        <p style="margin:0 0 16px;">Click the button below to join your video call. No downloads or sign-up required — it works right in your browser.</p>

        <div style="background-color:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:16px;margin:0 0 24px;">
          <div style="text-align:center;">
            <div style="color:#a78bfa;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Video Call</div>
            <div style="color:white;font-size:15px;">Powered by Liftori Video Chat</div>
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0 16px;">
        <a href="${joinUrl}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#6366f1);color:white;font-size:16px;font-weight:600;text-decoration:none;padding:14px 48px;border-radius:10px;letter-spacing:0.3px;">
          Join Video Call
        </a>
      </div>
      <p style="text-align:center;color:#64748b;font-size:12px;margin:0;">This link is single-use and expires in 24 hours</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#475569;font-size:12px;line-height:1.6;">
      <p style="margin:0 0 4px;">Sent by Sage from Liftori</p>
      <p style="margin:0;">
        <a href="https://liftori.ai" style="color:#0ea5e9;text-decoration:none;">liftori.ai</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  await sendEmail({
    to,
    subject: `Your video call with ${consultantName} is ready — join now`,
    html,
    from: 'Sage from Liftori <sage@liftori.ai>',
  });
}

// ─── Send Consulting Reminder Email ───────────────────────────
// Reminder for a booked consulting appointment with existing room_id
export async function sendConsultingReminderEmail({ to, leadName, roomId, appointmentDate, appointmentTime, consultantName = 'our team' }) {
  const firstName = leadName?.split(' ')[0] || 'there';
  const joinUrl = `https://liftori.ai/call/${roomId}`;

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
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#6366f1);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:28px;line-height:1;">&#9654;</span>
        </div>
        <h1 style="color:white;font-size:24px;margin:0 0 4px;">Your Consulting Call is Starting</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0;">Hi ${firstName}, ${consultantName} is ready for you</p>
      </div>

      <div style="color:#cbd5e1;font-size:15px;line-height:1.7;">
        <p style="margin:0 0 16px;">This is a friendly reminder that your scheduled consulting call is ready to begin. Click below to join the video call.</p>

        ${appointmentDate ? `
        <div style="background-color:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:16px;margin:0 0 24px;">
          <div style="text-align:center;">
            <div style="color:#818cf8;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Scheduled Call</div>
            <div style="color:white;font-size:18px;font-weight:600;">${appointmentDate}${appointmentTime ? ` at ${appointmentTime}` : ''}</div>
          </div>
        </div>` : ''}
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0 16px;">
        <a href="${joinUrl}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#6366f1);color:white;font-size:16px;font-weight:600;text-decoration:none;padding:14px 48px;border-radius:10px;letter-spacing:0.3px;">
          Join Video Call
        </a>
      </div>
      <p style="text-align:center;color:#64748b;font-size:12px;margin:0;">No downloads required — works in your browser</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#475569;font-size:12px;line-height:1.6;">
      <p style="margin:0 0 4px;">Sent by Sage from Liftori</p>
      <p style="margin:0;">
        <a href="https://liftori.ai" style="color:#0ea5e9;text-decoration:none;">liftori.ai</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  await sendEmail({
    to,
    subject: `Reminder: Your consulting call with ${consultantName} is starting now`,
    html,
    from: 'Sage from Liftori <sage@liftori.ai>',
  });
}
