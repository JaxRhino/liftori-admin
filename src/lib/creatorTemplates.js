/**
 * Creator content templates — curated library of proven formats.
 * Each template: key, category, platform, name, body (with {{placeholders}}), hint.
 * Placeholders get replaced during the Fill flow.
 */

export const TEMPLATE_CATEGORIES = [
  { key: 'hook',           label: 'Hooks',          icon: '🎣' },
  { key: 'caption',        label: 'Captions',       icon: '💬' },
  { key: 'script',         label: 'Scripts',        icon: '🎬' },
  { key: 'cta',            label: 'CTAs',           icon: '👉' },
  { key: 'thumbnail_copy', label: 'Thumbnail copy', icon: '🎨' },
  { key: 'email',          label: 'Emails',         icon: '📧' },
  { key: 'bio',            label: 'Bio',            icon: '🪪' },
  { key: 'thread',         label: 'X threads',      icon: '🧵' },
]

export const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', char_limit: 2200 },
  { key: 'tiktok',    label: 'TikTok',    char_limit: 2200 },
  { key: 'youtube',   label: 'YouTube',   char_limit: 5000 },
  { key: 'shorts',    label: 'YT Shorts', char_limit: 100 },
  { key: 'x',         label: 'X / Twitter', char_limit: 280 },
  { key: 'linkedin',  label: 'LinkedIn',  char_limit: 3000 },
  { key: 'email',     label: 'Email',     char_limit: null },
  { key: 'blog',      label: 'Blog',      char_limit: null },
]

export const TEMPLATES = [
  // ─── HOOKS ───────────────────────────────────────────────────
  {
    key: 'hook_contrarian',
    category: 'hook',
    platform: 'any',
    name: 'The Contrarian',
    hint: 'Disagree with conventional wisdom. Grabs attention immediately.',
    body: `Everyone says you need {{common_advice}}.
That's wrong.
Here's what actually works: {{your_take}}.`,
  },
  {
    key: 'hook_secret',
    category: 'hook',
    platform: 'any',
    name: 'The Secret Reveal',
    hint: 'Promise insider knowledge. Works best when the "secret" is actually useful.',
    body: `The thing nobody tells you about {{topic}}:

{{the_secret}}

Took me {{timeframe}} to figure this out.`,
  },
  {
    key: 'hook_mistake',
    category: 'hook',
    platform: 'any',
    name: 'The Public Mistake',
    hint: 'Admit a specific failure + the lesson. High relatability.',
    body: `I wasted {{amount}} on {{thing}} because I didn't know {{lesson}}.

Don't be me. Here's what I learned:`,
  },
  {
    key: 'hook_number',
    category: 'hook',
    platform: 'any',
    name: 'The Specific Number',
    hint: 'Specificity beats vagueness. Use odd numbers for authenticity.',
    body: `{{number}} {{things}} that {{outcome}} (in under {{time_frame}})`,
  },
  {
    key: 'hook_question',
    category: 'hook',
    platform: 'any',
    name: 'The Open Loop',
    hint: 'Ask the question your audience is already asking themselves.',
    body: `Why do {{target_audience}} always {{problem}}?

Here's the answer nobody talks about:`,
  },
  {
    key: 'hook_stop',
    category: 'hook',
    platform: 'tiktok',
    name: 'The Interrupt',
    hint: 'Pattern interrupt. Works on short-form video platforms.',
    body: `STOP {{common_action}}.

You're doing it backwards. Here's what to do instead.`,
  },

  // ─── CAPTIONS ───────────────────────────────────────────────────
  {
    key: 'caption_before_after',
    category: 'caption',
    platform: 'instagram',
    name: 'Before / After',
    hint: 'Classic transformation. Works for any niche.',
    body: `{{timeframe}} ago I was {{before_state}}.

Today I'm {{after_state}}.

The three things that changed everything:
1. {{change_1}}
2. {{change_2}}
3. {{change_3}}

Which one is your biggest unlock? 👇`,
  },
  {
    key: 'caption_list',
    category: 'caption',
    platform: 'instagram',
    name: 'Value List',
    hint: 'High-saves format. Each list item should be actionable.',
    body: `{{N}} {{topic}} tips I wish I knew sooner:

1. {{tip_1}}
2. {{tip_2}}
3. {{tip_3}}
4. {{tip_4}}
5. {{tip_5}}

Save this for later. Which one are you trying first? 💾`,
  },
  {
    key: 'caption_story',
    category: 'caption',
    platform: 'linkedin',
    name: 'Short Story',
    hint: 'LinkedIn loves personal stories with a business lesson.',
    body: `{{hook_line}}

Here's what happened:

{{story}}

The lesson:
{{takeaway}}

What's your take on this?`,
  },
  {
    key: 'caption_question',
    category: 'caption',
    platform: 'instagram',
    name: 'Engagement Question',
    hint: 'Boost comments. Ask a question your audience has strong opinions about.',
    body: `Real talk: {{controversial_observation}}

Am I wrong? Drop your take below 👇

{{hashtags}}`,
  },

  // ─── SCRIPTS ───────────────────────────────────────────────────
  {
    key: 'script_short_form',
    category: 'script',
    platform: 'tiktok',
    name: 'Short-form Script (30-60s)',
    hint: 'Tight structure: hook 3s, value 40s, CTA 5s.',
    body: `[0-3s HOOK]
{{attention_grab}}

[3-10s PROMISE]
In the next {{duration}} I'm going to {{what_they_learn}}.

[10-45s VALUE]
{{point_1}}

{{point_2}}

{{point_3}}

[45-55s CTA]
{{call_to_action}}

[55-60s LOOP]
{{reason_to_rewatch}}`,
  },
  {
    key: 'script_talking_head',
    category: 'script',
    platform: 'youtube',
    name: 'YouTube Long-form (5-10 min)',
    hint: 'Retention-optimized structure with open loops.',
    body: `[INTRO — 0:00-0:30]
{{hook}}
In this video: {{what_youll_cover}}

[PROBLEM — 0:30-1:30]
{{setup_the_pain}}

[AGITATE — 1:30-2:30]
{{why_it_matters}}

[SOLUTION — 2:30-6:00]
Step 1: {{step_1}}
Step 2: {{step_2}}
Step 3: {{step_3}}

[PROOF — 6:00-7:30]
{{social_proof_or_results}}

[CTA — 7:30-8:00]
{{subscribe_or_next_action}}

[OUTRO — 8:00-end]
{{close}}`,
  },

  // ─── CTAs ───────────────────────────────────────────────────
  {
    key: 'cta_link_in_bio',
    category: 'cta',
    platform: 'instagram',
    name: 'Link in Bio',
    hint: 'Drive traffic off-platform without losing reach.',
    body: `👉 Full {{resource_type}} is in my bio.
(Link: {{your_link}})

Save this post so you don't lose it.`,
  },
  {
    key: 'cta_affiliate',
    category: 'cta',
    platform: 'any',
    name: 'Affiliate (FTC-compliant)',
    hint: 'Always disclose. Required by FTC and your Liftori Creator Agreement.',
    body: `I built this with {{product}} — it's the tool I wish I'd had 2 years ago.

My link: {{your_referral_link}}
(Affiliate — I get a small commission if you sign up. I only recommend tools I use daily.)`,
  },
  {
    key: 'cta_email',
    category: 'cta',
    platform: 'any',
    name: 'Newsletter signup',
    hint: 'Own your audience. Email always wins.',
    body: `Want more like this?
My weekly {{topic}} newsletter drops every {{day}}.

Subscribe: {{newsletter_link}}`,
  },

  // ─── THUMBNAIL COPY ─────────────────────────────────────────
  {
    key: 'thumbnail_contrast',
    category: 'thumbnail_copy',
    platform: 'youtube',
    name: 'Contrast Pair',
    hint: '2-3 words on thumbnail. Build pattern interrupt.',
    body: `Thumbnail text: "{{before_word}} VS {{after_word}}"
Face expression: {{surprise/confusion/excited}}
Arrow pointing to: {{detail}}`,
  },
  {
    key: 'thumbnail_shock',
    category: 'thumbnail_copy',
    platform: 'youtube',
    name: 'Specific Number',
    hint: 'Pair a specific number with a shocking modifier.',
    body: `Thumbnail text: "{{number}} {{thing}}"
Subtitle (small): "{{modifier}}"
Example: "$12,847" / "in 30 days"`,
  },

  // ─── EMAILS ───────────────────────────────────────────────────
  {
    key: 'email_pitch',
    category: 'email',
    platform: 'email',
    name: 'Brand Deal Pitch',
    hint: 'Cold pitch to a brand. Keep it under 150 words.',
    body: `Subject: {{your_handle}} × {{brand_name}} — collab idea

Hi {{first_name}},

I'm {{your_name}} — I create content about {{your_niche}} for {{audience_size}} people on {{primary_platform}}.

I've been using {{brand_name}} for {{timeframe}} and genuinely love it. I'd love to put together a {{content_format}} highlighting {{specific_product}}.

Quick stats on my audience:
• {{audience_demographic_1}}
• {{engagement_rate}}% engagement (above niche avg)
• Previous sponsored posts averaged {{past_result}}

I have rates attached. Happy to jump on a quick call if it's a fit.

{{your_name}}
{{your_email}} · {{your_socials}}`,
  },
  {
    key: 'email_thank_you',
    category: 'email',
    platform: 'email',
    name: 'Post-collab thank you',
    hint: 'Always follow up. Opens the door to repeat deals.',
    body: `Subject: Thanks for the collab — wrap-up

Hi {{first_name}},

The {{content_format}} went live and is performing well. Initial 48h:
• {{metric_1}}
• {{metric_2}}
• {{metric_3}}

I'll send the full report in a week.

Really enjoyed working together. If {{brand_name}} has anything coming up next quarter, I'd love to be considered.

Thanks again,
{{your_name}}`,
  },

  // ─── BIO ───────────────────────────────────────────────────
  {
    key: 'bio_specific',
    category: 'bio',
    platform: 'instagram',
    name: 'Specific bio',
    hint: 'Who, what, proof, CTA. Under 150 chars.',
    body: `I help {{target_audience}} {{outcome}} | {{proof_point}} | ⬇️ {{cta}}`,
  },

  // ─── X THREADS ───────────────────────────────────────────────────
  {
    key: 'thread_framework',
    category: 'thread',
    platform: 'x',
    name: 'Framework Thread',
    hint: '7-10 tweets. One idea per tweet. Bold opener.',
    body: `1/ {{bold_claim_or_framework_name}}

A {{step_count}}-step system for {{outcome}}.

Thread 🧵👇

2/ {{step_1_name}}

{{step_1_detail}}

3/ {{step_2_name}}

{{step_2_detail}}

4/ {{step_3_name}}

{{step_3_detail}}

5/ {{step_4_name}}

{{step_4_detail}}

6/ {{step_5_name}}

{{step_5_detail}}

7/ TL;DR:
1. {{step_1_name}}
2. {{step_2_name}}
3. {{step_3_name}}
4. {{step_4_name}}
5. {{step_5_name}}

8/ If this helped, like + RT the first tweet to help someone else.

Follow @{{your_handle}} for more {{your_niche}} breakdowns.`,
  },
]

/** Extract all {{placeholder}} tokens from a template body. */
export function extractPlaceholders(body) {
  const set = new Set()
  const re = /\{\{([a-z0-9_]+)\}\}/gi
  let m
  while ((m = re.exec(body)) !== null) set.add(m[1])
  return Array.from(set)
}

/** Replace {{placeholders}} with values from a map. Unfilled placeholders stay visible. */
export function fillTemplate(body, values = {}) {
  return body.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key) => {
    const v = values[key]
    return v && v.toString().trim() ? v : `{{${key}}}`
  })
}
