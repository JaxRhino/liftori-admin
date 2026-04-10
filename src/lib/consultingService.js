// ===========================================
// Consulting Service Layer — Scripts, Scorecards,
// Transcripts, Tasks, Engagements
// ===========================================
import { supabase } from './supabase';

// ─── SCRIPTS / PLAYBOOKS ───────────────────────
export async function fetchScriptByTier(tier) {
  const { data, error } = await supabase
    .from('consulting_scripts')
    .select('*')
    .eq('engagement_tier', tier)
    .eq('is_active', true)
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function fetchAllScripts() {
  const { data, error } = await supabase
    .from('consulting_scripts')
    .select('*')
    .eq('is_active', true)
    .order('engagement_tier');
  if (error) throw error;
  return data || [];
}

// ─── SCRIPT PROGRESS ───────────────────────────
export async function fetchScriptProgress(appointmentId) {
  const { data, error } = await supabase
    .from('call_script_progress')
    .select('*')
    .eq('appointment_id', appointmentId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertScriptProgress(appointmentId, scriptId, consultantId, updates) {
  const { data: existing } = await supabase
    .from('call_script_progress')
    .select('id')
    .eq('appointment_id', appointmentId)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('call_script_progress')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('call_script_progress')
      .insert({
        appointment_id: appointmentId,
        script_id: scriptId,
        consultant_id: consultantId,
        ...updates,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

// ─── TRANSCRIPTS ───────────────────────────────
export async function fetchTranscript(appointmentId) {
  const { data, error } = await supabase
    .from('call_transcripts')
    .select('*')
    .eq('appointment_id', appointmentId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertTranscript(appointmentId, updates) {
  const { data: existing } = await supabase
    .from('call_transcripts')
    .select('id')
    .eq('appointment_id', appointmentId)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('call_transcripts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('call_transcripts')
      .insert({ appointment_id: appointmentId, ...updates })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

// ─── SCORECARDS ────────────────────────────────
export async function fetchScorecard(appointmentId) {
  const { data, error } = await supabase
    .from('call_scorecards')
    .select('*')
    .eq('appointment_id', appointmentId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createScorecard(scorecard) {
  const { data, error } = await supabase
    .from('call_scorecards')
    .insert(scorecard)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── CALL TASKS ────────────────────────────────
export async function fetchCallTasks(appointmentId) {
  const { data, error } = await supabase
    .from('call_tasks')
    .select('*')
    .eq('appointment_id', appointmentId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function createCallTask(task) {
  const { data, error } = await supabase
    .from('call_tasks')
    .insert(task)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleCallTask(taskId, isCompleted) {
  const updates = { is_completed: isCompleted };
  if (isCompleted) updates.completed_at = new Date().toISOString();
  else updates.completed_at = null;

  const { data, error } = await supabase
    .from('call_tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCallTask(taskId) {
  const { error } = await supabase
    .from('call_tasks')
    .delete()
    .eq('id', taskId);
  if (error) throw error;
}

// ─── AI ANALYSIS ───────────────────────────────
// Generates post-call AI summary and scorecard using Anthropic
const SUPABASE_URL = 'https://qlerfkdyslndjbaltkwo.supabase.co';

export async function generateAISummary(transcript, notes, appointment) {
  const prompt = `You are Sage, an AI business consultant assistant at Liftori. Analyze this consulting call and provide a structured summary.

**Client:** ${appointment.lead_name} (${appointment.company_name || 'Unknown company'})
**Interest:** ${appointment.primary_interest || 'General consulting'}
**Challenge:** ${appointment.biggest_challenge || 'Not specified'}

**Call Notes:**
${notes || 'No manual notes taken.'}

**Transcript:**
${transcript || 'No transcript available.'}

Respond in JSON format with these fields:
{
  "summary": "2-3 sentence summary of what was discussed and the outcome",
  "consultant_tasks": ["action items for the consultant"],
  "client_tasks": ["action items for the client"],
  "follow_up_recommendations": ["suggested next steps"],
  "identified_opportunities": ["potential upsell or service opportunities"],
  "strengths": ["what went well in this call"],
  "improvements": ["areas the consultant could improve"],
  "next_meeting_prep": ["things to prepare for the next session"],
  "client_health_signals": ["positive or negative indicators about the client relationship"],
  "overall_score": 8.5,
  "topic_coverage_score": 8.0,
  "client_engagement_score": 9.0
}

Be specific and actionable. Scores are 1-10.`;

  try {
    // Call via Supabase edge function (ai-chat or similar)
    // For now, use the OpenAI-compatible endpoint if available
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('No OpenAI API key found, skipping AI analysis');
      return null;
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error(`AI API error: ${res.status}`);
    const data = await res.json();
    const analysis = JSON.parse(data.choices[0].message.content);
    return analysis;
  } catch (err) {
    console.error('AI summary generation failed:', err);
    return null;
  }
}
