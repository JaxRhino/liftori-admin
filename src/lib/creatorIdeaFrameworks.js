/**
 * Creator idea frameworks — proven systems for generating
 * endless content ideas from a niche. Each framework has prompts
 * that turn into titles when filled with the creator's niche/topic.
 */

export const CONTENT_PILLARS = [
  { key: 'educate',     label: 'Educate',     icon: '📚', desc: 'Teach your audience something they can use' },
  { key: 'entertain',   label: 'Entertain',   icon: '🎭', desc: 'Make them laugh, gasp, feel something' },
  { key: 'inspire',     label: 'Inspire',     icon: '✨', desc: 'Stories, transformations, what\'s possible' },
  { key: 'promote',     label: 'Promote',     icon: '📣', desc: 'Your offer, product, or affiliate link' },
  { key: 'community',   label: 'Community',   icon: '👥', desc: 'Questions, polls, behind-the-scenes' },
]

export const IDEA_FRAMEWORKS = [
  {
    key: 'pain_points',
    name: 'Pain Points',
    pillar: 'educate',
    hint: 'List the problems your audience faces, then create a post solving each one.',
    prompts: [
      'The #1 mistake {{audience}} make with {{topic}}',
      'Why your {{topic}} isn\'t working (and the 3 fixes)',
      '{{audience}}: stop doing this {{thing}} — here\'s what works',
      'The silent killer of {{outcome}}: {{thing}}',
      'I see this {{topic}} mistake every week — don\'t make it',
    ],
  },
  {
    key: 'dreams',
    name: 'Aspirational',
    pillar: 'inspire',
    hint: 'Your audience has goals. Show them how to hit them.',
    prompts: [
      'How to {{outcome}} in {{timeframe}} (no {{common_barrier}})',
      'The roadmap to {{outcome}} I wish I had 5 years ago',
      '{{audience}} who {{outcome}}: here\'s exactly what they did',
      'What {{outcome}} actually looks like (not the Instagram version)',
      '{{number}} steps to {{outcome}} — copy this',
    ],
  },
  {
    key: 'behind_scenes',
    name: 'Behind the Scenes',
    pillar: 'community',
    hint: 'People follow people. Show your process, not just your results.',
    prompts: [
      'A day in my life as {{role}}',
      'How I {{routine}} (the unfiltered version)',
      'My setup / workflow / stack for {{task}}',
      '{{timeframe}} ago vs. today — the receipts',
      'The boring stuff nobody shows about {{niche}}',
    ],
  },
  {
    key: 'contrarian',
    name: 'Contrarian Takes',
    pillar: 'educate',
    hint: 'Disagree with conventional wisdom in your niche. Highly shareable.',
    prompts: [
      'Unpopular opinion: {{common_belief}} is wrong. Here\'s why.',
      'Everyone says {{common_advice}}. I disagree — do this instead.',
      'The {{niche}} advice I\'ve been ignoring for years',
      'Why most {{topic}} advice doesn\'t work',
      'I\'m going to ruffle feathers: {{hot_take}}',
    ],
  },
  {
    key: 'mistakes',
    name: 'Mistakes + Lessons',
    pillar: 'educate',
    hint: 'Your failures are your most relatable content.',
    prompts: [
      'I wasted {{amount}} on {{thing}} so you don\'t have to',
      'The biggest {{topic}} mistake I\'ve ever made',
      '{{number}} things I got wrong my first year in {{niche}}',
      'What I\'d tell my {{time_ago}} self about {{topic}}',
      'The {{thing}} I used to do (and why I stopped)',
    ],
  },
  {
    key: 'framework',
    name: 'Signature Framework',
    pillar: 'educate',
    hint: 'Name a process. Naming it makes it teachable and memorable.',
    prompts: [
      'My {{number}}-step {{topic}} system (I call it the {{name}})',
      'The {{letter_acronym}} Framework for {{outcome}}',
      'Why the {{name}} Method works when others fail',
      'I built a system for {{task}} — here\'s how it works',
      'Steal my {{topic}} workflow — {{number}} steps',
    ],
  },
  {
    key: 'question',
    name: 'FAQ Mining',
    pillar: 'educate',
    hint: 'Every DM and comment is a content idea. Answer them publicly.',
    prompts: [
      '"How do I {{task}}?" — full answer',
      '"Is {{thing}} worth it?" — honest take',
      '{{audience}} ask me this constantly: {{question}}',
      'The {{topic}} question I get every single week',
      'Reply to @someone\'s DM about {{topic}}',
    ],
  },
  {
    key: 'trend',
    name: 'Trend Hijack',
    pillar: 'entertain',
    hint: 'Take a trending format and apply it to your niche.',
    prompts: [
      '"Tell me you\'re {{type_of_person}} without telling me you\'re {{type_of_person}}"',
      'POV: you just {{situation}}',
      '"Rating {{things}} on a scale of {{scale}}"',
      'Trending sound + {{niche}} hot take',
      '{{pop_culture_reference}} but for {{niche}}',
    ],
  },
  {
    key: 'listicle',
    name: 'High-Save Lists',
    pillar: 'educate',
    hint: 'Lists get saved. Saves signal value to the algorithm.',
    prompts: [
      '{{number}} {{niche}} tools I use every day',
      '{{number}} things {{audience}} should do before {{outcome}}',
      '{{number}} underrated {{topic}} tips',
      '{{number}} {{niche}} books that changed how I think',
      '{{number}} red flags in {{topic}}',
    ],
  },
  {
    key: 'transformation',
    name: 'Transformation',
    pillar: 'inspire',
    hint: 'Before/after posts — yours or someone else\'s.',
    prompts: [
      'From {{starting_point}} to {{outcome}} in {{timeframe}}',
      'My {{topic}} then vs. now',
      'How {{name}} went from {{before}} to {{after}}',
      'The moment I realized I needed to change my {{topic}}',
      'If I could go back to my first {{role}} day…',
    ],
  },
  {
    key: 'promote_case',
    name: 'Case Study Promo',
    pillar: 'promote',
    hint: 'Show, don\'t sell. Results + process = conversions.',
    prompts: [
      'How {{customer}} used {{product}} to {{outcome}}',
      'The exact {{resource}} that got me {{result}}',
      'I used {{product}} for {{timeframe}} — here\'s what happened',
      'Tools that actually work: my {{niche}} stack',
      'Why I recommend {{product}} (affiliate link in bio)',
    ],
  },
  {
    key: 'poll',
    name: 'Engagement Bait (the good kind)',
    pillar: 'community',
    hint: 'Low-effort posts that spike comments and saves.',
    prompts: [
      '{{thing_a}} or {{thing_b}}? Drop your answer 👇',
      'This or that: {{niche}} edition',
      'What\'s your biggest {{topic}} struggle right now?',
      'Rate this {{thing}} from 1-10',
      'Would you rather: {{option_a}} or {{option_b}}?',
    ],
  },
]

/** Fill prompt placeholders with values. Unfilled ones stay visible. */
export function fillPrompt(prompt, values = {}) {
  return prompt.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key) => {
    const v = values[key]
    return v && v.toString().trim() ? v : `{{${key}}}`
  })
}
