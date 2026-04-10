import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ─── Public Interview Scheduler ─────────────────────────────────
// Accessible at /schedule-interview/:token (no auth required)
export default function ScheduleInterview() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tokenData, setTokenData] = useState(null);
  const [applicant, setApplicant] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookedSlot, setBookedSlot] = useState(null);

  useEffect(() => {
    validateTokenAndLoad();
  }, [token]);

  async function validateTokenAndLoad() {
    try {
      // Validate token
      const { data: tkn, error: tknErr } = await supabase
        .from('interview_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (tknErr || !tkn) {
        setError('Invalid or expired scheduling link. Please contact Liftori for a new link.');
        return;
      }

      if (tkn.used_at) {
        setError('This scheduling link has already been used. If you need to reschedule, please contact us.');
        return;
      }

      if (new Date(tkn.expires_at) < new Date()) {
        setError('This scheduling link has expired. Please contact Liftori for a new link.');
        return;
      }

      setTokenData(tkn);

      // Get applicant info
      const { data: app } = await supabase
        .from('applicants')
        .select('id, full_name, email, position')
        .eq('id', tkn.applicant_id)
        .single();

      if (!app) {
        setError('Application not found.');
        return;
      }
      setApplicant(app);

      // Get available slots (future dates, not fully booked)
      const today = new Date().toISOString().split('T')[0];
      const { data: availableSlots } = await supabase
        .from('interview_slots')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      // Filter out fully booked slots
      const open = (availableSlots || []).filter(s => s.current_bookings < s.max_bookings);
      setSlots(open);
    } catch (err) {
      console.error('Error loading scheduler:', err);
      setError('Something went wrong. Please try again or contact Liftori.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBook() {
    if (!selectedSlot || !tokenData || !applicant) return;
    setBooking(true);

    try {
      // Insert the scheduled interview
      const { error: bookErr } = await supabase
        .from('scheduled_interviews')
        .insert({
          applicant_id: applicant.id,
          slot_id: selectedSlot.id,
          token_id: tokenData.id,
          status: 'scheduled',
        });
      if (bookErr) throw bookErr;

      // Increment booking count on slot
      const { error: slotErr } = await supabase
        .from('interview_slots')
        .update({ current_bookings: selectedSlot.current_bookings + 1 })
        .eq('id', selectedSlot.id);
      if (slotErr) throw slotErr;

      // Mark token as used
      const { error: tokenErr } = await supabase
        .from('interview_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);
      if (tokenErr) throw tokenErr;

      // Update applicant stage to interview + timestamp
      await supabase
        .from('applicants')
        .update({
          stage: 'interview',
          interview_scheduled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicant.id);

      // Send confirmation email via edge function
      try {
        const dateStr = new Date(selectedSlot.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const startStr = formatTime(selectedSlot.start_time);
        const endStr = formatTime(selectedSlot.end_time);

        const SUPABASE_URL = 'https://qlerfkdyslndjbaltkwo.supabase.co';
        await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: applicant.email,
            subject: `Interview confirmed for ${dateStr} — ${applicant.position} at Liftori`,
            from: 'Sage from Liftori <sage@liftori.ai>',
            html: buildConfirmationEmail(applicant, dateStr, startStr, endStr),
          }),
        });
      } catch (emailErr) {
        console.error('Confirmation email failed (non-blocking):', emailErr);
      }

      setBookedSlot(selectedSlot);
      setBooked(true);
    } catch (err) {
      console.error('Booking error:', err);
      alert('Failed to book interview. Please try again.');
    } finally {
      setBooking(false);
    }
  }

  // Group slots by date for display
  const slotsByDate = {};
  slots.forEach(slot => {
    const key = slot.date;
    if (!slotsByDate[key]) slotsByDate[key] = [];
    slotsByDate[key].push(slot);
  });

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.loader}>
            <div style={styles.spinner} />
            <p style={{ color: '#94a3b8', marginTop: 16 }}>Loading scheduler...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h1 style={{ color: 'white', fontSize: 22, marginBottom: 8 }}>Link Unavailable</h1>
              <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.6 }}>{error}</p>
              <a href="https://liftori.ai" style={styles.link}>Visit Liftori</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (booked) {
    const dateStr = new Date(bookedSlot.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <h1 style={{ color: 'white', fontSize: 24, marginBottom: 8 }}>Interview Scheduled!</h1>
              <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 24 }}>You are all set, {applicant.full_name.split(' ')[0]}!</p>

              <div style={styles.confirmBox}>
                <div style={{ color: '#818cf8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Your Interview</div>
                <div style={{ color: 'white', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{dateStr}</div>
                <div style={{ color: '#a5b4fc', fontSize: 16 }}>{formatTime(bookedSlot.start_time)} — {formatTime(bookedSlot.end_time)}</div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>Position: {applicant.position}</div>
              </div>

              <p style={{ color: '#64748b', fontSize: 13, marginTop: 24 }}>A confirmation email has been sent to {applicant.email}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={styles.logo}>
            <span style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>Liftori</span>
          </div>
        </div>

        <div style={styles.card}>
          {/* Greeting */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ color: 'white', fontSize: 24, margin: '0 0 4px' }}>Schedule Your Interview</h1>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>
              Hi {applicant.full_name.split(' ')[0]}! Pick a time that works best for you.
            </p>
          </div>

          {/* Position Badge */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span style={styles.badge}>{applicant.position}</span>
          </div>

          {slots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <p style={{ color: '#94a3b8', fontSize: 15 }}>No interview slots are currently available.</p>
              <p style={{ color: '#64748b', fontSize: 13 }}>Please check back soon or contact us at <a href="mailto:hr@liftori.ai" style={{ color: '#0ea5e9' }}>hr@liftori.ai</a></p>
            </div>
          ) : (
            <>
              {/* Slot Selection */}
              <div style={{ marginBottom: 24 }}>
                {Object.entries(slotsByDate).map(([date, dateSlots]) => {
                  const dateObj = new Date(date + 'T12:00:00');
                  const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

                  return (
                    <div key={date} style={{ marginBottom: 20 }}>
                      <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {dayLabel}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {dateSlots.map(slot => {
                          const isSelected = selectedSlot?.id === slot.id;
                          return (
                            <button
                              key={slot.id}
                              onClick={() => setSelectedSlot(slot)}
                              style={{
                                ...styles.slotBtn,
                                ...(isSelected ? styles.slotBtnActive : {}),
                              }}
                            >
                              {formatTime(slot.start_time)} — {formatTime(slot.end_time)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Book Button */}
              <button
                onClick={handleBook}
                disabled={!selectedSlot || booking}
                style={{
                  ...styles.bookBtn,
                  opacity: (!selectedSlot || booking) ? 0.5 : 1,
                  cursor: (!selectedSlot || booking) ? 'not-allowed' : 'pointer',
                }}
              >
                {booking ? 'Booking...' : selectedSlot ? 'Confirm Interview' : 'Select a Time Slot'}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24, color: '#475569', fontSize: 12 }}>
          <p style={{ margin: 0 }}>Powered by Sage at <a href="https://liftori.ai" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Liftori</a></p>
        </div>
      </div>
    </div>
  );
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function buildConfirmationEmail(applicant, dateStr, startStr, endStr) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0B1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:12px 24px;border-radius:12px;">
      <span style="color:white;font-size:24px;font-weight:700;">Liftori</span>
    </div>
  </div>
  <div style="background-color:#1a2332;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:40px;margin-bottom:24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:8px;">📅</div>
      <h1 style="color:white;font-size:24px;margin:0 0 4px;">Interview Confirmed!</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0;">You are all set, ${applicant.full_name.split(' ')[0]}</p>
    </div>
    <div style="color:#cbd5e1;font-size:15px;line-height:1.7;">
      <p style="margin:0 0 16px;">Great news — your interview has been scheduled:</p>
      <div style="background-color:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:20px;margin:0 0 24px;text-align:center;">
        <div style="color:#818cf8;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Your Interview</div>
        <div style="color:white;font-size:20px;font-weight:600;margin-bottom:4px;">${dateStr}</div>
        <div style="color:#a5b4fc;font-size:16px;">${startStr} — ${endStr}</div>
        <div style="color:#94a3b8;font-size:13px;margin-top:8px;">Position: ${applicant.position}</div>
      </div>
      <p style="margin:0 0 16px;">A few tips:</p>
      <ul style="margin:0;padding-left:20px;">
        <li style="margin-bottom:8px;">Be yourself — we value authenticity</li>
        <li style="margin-bottom:8px;">Come ready to share your experience and goals</li>
        <li style="margin-bottom:8px;">Have questions ready — this is a two-way conversation</li>
      </ul>
    </div>
  </div>
  <div style="text-align:center;color:#475569;font-size:12px;line-height:1.6;">
    <p style="margin:0 0 4px;">Sent by Sage</p>
    <p style="margin:0;">Liftori — <a href="https://liftori.ai" style="color:#0ea5e9;text-decoration:none;">liftori.ai</a></p>
  </div>
</div>
</body></html>`;
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#0B1120',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    maxWidth: 520,
    width: '100%',
  },
  logo: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    padding: '12px 24px',
    borderRadius: 12,
  },
  card: {
    backgroundColor: '#1a2332',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.1)',
    padding: 32,
  },
  badge: {
    display: 'inline-block',
    backgroundColor: 'rgba(14,165,233,0.15)',
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 16px',
    borderRadius: 20,
    border: '1px solid rgba(14,165,233,0.3)',
  },
  confirmBox: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 12,
    padding: 20,
    textAlign: 'center',
    margin: '0 auto',
    maxWidth: 300,
  },
  slotBtn: {
    padding: '10px 16px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#e2e8f0',
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  slotBtnActive: {
    backgroundColor: 'rgba(14,165,233,0.2)',
    borderColor: '#0ea5e9',
    color: '#38bdf8',
  },
  bookBtn: {
    width: '100%',
    padding: '14px 0',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    color: 'white',
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: 0.3,
  },
  link: {
    display: 'inline-block',
    marginTop: 20,
    color: '#0ea5e9',
    textDecoration: 'none',
    fontSize: 14,
  },
  loader: {
    textAlign: 'center',
    padding: 60,
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#0ea5e9',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 1s linear infinite',
  },
};
