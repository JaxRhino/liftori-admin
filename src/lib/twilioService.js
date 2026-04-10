// ===========================================
// Twilio Voice SDK Service Layer
// Browser-based calling via @twilio/voice-sdk
// ===========================================
import { Device } from '@twilio/voice-sdk';
import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qlerfkdyslndjbaltkwo.supabase.co';

let device = null;
let activeConnection = null;
let listeners = {};

// ─── EVENT SYSTEM ──────────────────────────────
export function onTwilioEvent(event, callback) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
  return () => {
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  };
}

function emit(event, data) {
  (listeners[event] || []).forEach(cb => {
    try { cb(data); } catch (e) { console.error(`[Twilio] Event handler error (${event}):`, e); }
  });
}

// ─── TOKEN ─────────────────────────────────────
async function fetchToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/twilio-token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZXJma2R5c2xuZGpiYWx0a3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTQ5OTgsImV4cCI6MjA4ODQ5MDk5OH0.3yrxJBvVNlE-Gx7VcxjMIqsS1XbJBYVTLq6zfMPLtHA',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Token fetch failed' }));
    throw new Error(err.error || 'Failed to get Twilio token');
  }

  return res.json();
}

// ─── DEVICE MANAGEMENT ─────────────────────────
export async function initializeTwilioDevice() {
  try {
    const { token, identity } = await fetchToken();

    if (device) {
      device.destroy();
    }

    device = new Device(token, {
      logLevel: 1, // warnings only
      codecPreferences: ['opus', 'pcmu'],
      edge: 'ashburn',
    });

    // Register the device so it can receive incoming calls
    device.register();

    // ── Incoming call ──
    device.on('incoming', (call) => {
      const from = call.parameters?.From || call.customParameters?.get('From') || '';
      console.log('[Twilio] Incoming call from:', from);

      // Ignore phantom/registration events with no caller info
      if (!from) {
        console.log('[Twilio] Ignoring incoming event with no From — likely a registration ping');
        return;
      }

      activeConnection = call;

      // Detect internal extension calls (from client:identity)
      const isInternal = from.startsWith('client:') ||
        call.customParameters?.get('department') === 'internal';
      const callerUserId = call.customParameters?.get('callerUserId') || '';
      const callerName = call.customParameters?.get('callerName') || '';
      const callerAvatar = call.customParameters?.get('callerAvatar') || '';

      emit('incoming', {
        callSid: call.parameters?.CallSid,
        from,
        to: call.parameters?.To,
        call,
        isInternal,
        callerUserId,
        callerName,
        callerAvatar,
      });

      call.on('accept', () => {
        emit('accepted', { callSid: call.parameters.CallSid });
      });

      call.on('disconnect', () => {
        activeConnection = null;
        emit('disconnected', { callSid: call.parameters.CallSid });
      });

      call.on('cancel', () => {
        activeConnection = null;
        emit('cancelled', { callSid: call.parameters.CallSid });
      });

      call.on('reject', () => {
        activeConnection = null;
        emit('rejected', { callSid: call.parameters.CallSid });
      });

      // Safety: some Twilio Dial timeouts don't fire cancel cleanly
      // Listen for the underlying connection closing
      call.on('error', () => {
        activeConnection = null;
        emit('cancelled', { callSid: call.parameters?.CallSid });
      });
    });

    // ── Device events ──
    device.on('registered', () => {
      console.log('[Twilio] Device registered, ready for calls');
      emit('ready', { identity });
    });

    device.on('unregistered', () => {
      console.log('[Twilio] Device unregistered');
      emit('offline', {});
    });

    device.on('error', (error) => {
      console.error('[Twilio] Device error:', error);
      emit('error', { error: error.message || 'Unknown error' });
    });

    device.on('tokenWillExpire', async () => {
      console.log('[Twilio] Token expiring, refreshing...');
      try {
        const { token: newToken } = await fetchToken();
        device.updateToken(newToken);
      } catch (err) {
        console.error('[Twilio] Token refresh failed:', err);
        emit('error', { error: 'Token refresh failed' });
      }
    });

    return { identity, device };
  } catch (err) {
    console.error('[Twilio] Device initialization failed:', err);
    throw err;
  }
}

export function destroyTwilioDevice() {
  try {
    if (activeConnection) {
      activeConnection.disconnect();
      activeConnection = null;
    }
  } catch (e) {
    console.warn('[Twilio] Error disconnecting active call:', e);
  }
  try {
    if (device) {
      device.removeAllListeners();
      device.unregister();
      device.destroy();
      device = null;
    }
  } catch (e) {
    console.warn('[Twilio] Error destroying device:', e);
  }
  // DO NOT wipe listeners — other components (GlobalPhoneCallPopup) may still
  // be subscribed and will re-use them when the device is re-created.
  // Each subscriber manages its own cleanup via the unsub function from onTwilioEvent.
}

// ─── CALL ACTIONS ──────────────────────────────

export async function makeOutboundCall(toNumber, agentId, callerId, department = 'sales') {
  if (!device) throw new Error('Twilio device not initialized');

  const call = await device.connect({
    params: {
      outbound: 'true',
      toNumber,
      agentId,
      callerId: callerId || '+19044428970',
      department,
    },
  });

  activeConnection = call;

  call.on('accept', () => emit('callStarted', { callSid: call.parameters?.CallSid }));
  call.on('disconnect', () => {
    activeConnection = null;
    emit('callEnded', { callSid: call.parameters?.CallSid });
  });
  call.on('cancel', () => {
    activeConnection = null;
    emit('callEnded', { callSid: call.parameters?.CallSid });
  });

  return call;
}

// Internal extension call — browser-to-browser via Twilio Client identity
export async function callExtension(targetIdentity, agentId, callerInfo = {}) {
  if (!device) throw new Error('Twilio device not initialized');

  const call = await device.connect({
    params: {
      outbound: 'true',
      toNumber: `client:${targetIdentity}`,
      agentId: agentId || '',
      callerId: '+19044428970',
      department: 'internal',
      callerUserId: callerInfo.userId || '',
      callerName: callerInfo.name || '',
      callerAvatar: callerInfo.avatarUrl || '',
    },
  });

  activeConnection = call;

  call.on('accept', () => emit('callStarted', { callSid: call.parameters?.CallSid }));
  call.on('disconnect', () => {
    activeConnection = null;
    emit('callEnded', { callSid: call.parameters?.CallSid, declineReason: call.customParameters?.get('declineReason') || '' });
  });
  call.on('cancel', () => {
    activeConnection = null;
    emit('callEnded', { callSid: call.parameters?.CallSid });
  });

  return call;
}

export function acceptIncomingCall() {
  if (activeConnection && typeof activeConnection.accept === 'function') {
    activeConnection.accept();
    return true;
  }
  return false;
}

export function rejectIncomingCall() {
  if (activeConnection && typeof activeConnection.reject === 'function') {
    activeConnection.reject();
    activeConnection = null;
    return true;
  }
  return false;
}

export function hangupCall() {
  if (activeConnection) {
    activeConnection.disconnect();
    activeConnection = null;
    return true;
  }
  return false;
}

export function muteCall(muted) {
  if (activeConnection) {
    activeConnection.mute(muted);
    return true;
  }
  return false;
}

export function sendDigit(digit) {
  if (activeConnection) {
    activeConnection.sendDigits(digit);
    return true;
  }
  return false;
}

export function getActiveConnection() {
  return activeConnection;
}

export function isDeviceReady() {
  return device?.state === 'registered';
}

// ─── SMS (via Edge Function) ───────────────────

export async function sendSMS(to, body, fromNumber) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/twilio-sms-send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZXJma2R5c2xuZGpiYWx0a3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTQ5OTgsImV4cCI6MjA4ODQ5MDk5OH0.3yrxJBvVNlE-Gx7VcxjMIqsS1XbJBYVTLq6zfMPLtHA',
    },
    body: JSON.stringify({ to, body, from: fromNumber }),
  });

  if (!res.ok) throw new Error('SMS send failed');
  return res.json();
}

// ─── SMS FETCH ─────────────────────────────────

export async function fetchSMSHistory(limit = 50) {
  const { data, error } = await supabase
    .from('cc_sms')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
