import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Public, no-auth landing page for a Liftori sales rep (/r/:slug).
// Informational product showcase (NO pricing) + lead capture -> submit_rep_lead.
// Premium dark techno-futurist design on the Liftori brand palette.
// Brand: navy #060B18 / blue #0EA5E9 / light #7DD3FC / ice #E0F7FF.

const ICONS = {
  web: 'M2.25 12.76V6.6A2.25 2.25 0 014.5 4.35h15a2.25 2.25 0 012.25 2.25v6.16M2.25 12.76v4.64A2.25 2.25 0 004.5 19.65h15a2.25 2.25 0 002.25-2.25v-4.64M2.25 12.76h19.5M5.4 7.5h.008v.008H5.4V7.5zm2.1 0h.008v.008H7.5V7.5z',
  store: 'M3 3h2.4l1.2 12.6a1.8 1.8 0 001.8 1.62h8.7a1.8 1.8 0 001.77-1.47L20.4 7.5H6M9 21a.9.9 0 100-1.8.9.9 0 000 1.8zm8.4 0a.9.9 0 100-1.8.9.9 0 000 1.8z',
  crm: 'M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6zm3 1.5h6m-6 3.75h10.5m-10.5 3.75h7.5',
  mobile: 'M9 3.75h6A1.5 1.5 0 0116.5 5.25v13.5A1.5 1.5 0 0115 20.25H9a1.5 1.5 0 01-1.5-1.5V5.25A1.5 1.5 0 019 3.75zm1.5 13.5h3',
  ai: 'M12 2.25c.69 0 1.25.56 1.25 1.25v1.06a6.76 6.76 0 015.19 5.19h1.06a1.25 1.25 0 010 2.5h-1.06a6.76 6.76 0 01-5.19 5.19v1.06a1.25 1.25 0 01-2.5 0v-1.06A6.76 6.76 0 015.56 12.5H4.5a1.25 1.25 0 010-2.5h1.06A6.76 6.76 0 0110.75 4.81V3.75c0-.69.56-1.5 1.25-1.5zM12 9.5A2.5 2.5 0 1012 14.5 2.5 2.5 0 0012 9.5z',
  booking: 'M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 5.25h15A1.5 1.5 0 0121 6.75v12.75A1.5 1.5 0 0119.5 21h-15A1.5 1.5 0 013 19.5V6.75A1.5 1.5 0 014.5 5.25zM8 12.75h.008v.008H8v-.008zm4 0h.008v.008H12v-.008zm4 0h.008v.008H16v-.008z',
  growth: 'M2.25 18 9 11.25l3.75 3.75 9-9M21 6h-3.75M21 6v3.75',
  custom: 'M11.42 15.17 8.83 12.6m0 0L6.24 15.17m2.59-2.57v9m6.34-13.74a4.5 4.5 0 11-6.36 0 4.5 4.5 0 016.36 0z',
  brand: 'M9.53 16.12a3 3 0 01-5.66-1.33L4.5 3.75l11.04 5.16M9.53 16.12 17 21l3.75-7.5L9.53 16.12z',
  consult: 'M16.5 10.5a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm-9.75 9.75a6.75 6.75 0 0113.5 0',
}

// Brand-colored scene illustrations for the flagship product cards.
const ART = {
  web: '<svg viewBox="0 0 400 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="lgweb" cx="50%" cy="20%" r="80%"><stop offset="0%" stop-color="rgba(14,165,233,.32)"/><stop offset="100%" stop-color="rgba(14,165,233,0)"/></radialGradient></defs><rect width="400" height="180" fill="url(#lgweb)"/><rect x="70" y="26" width="260" height="128" rx="12" fill="rgba(14,165,233,.07)" stroke="#38BDF8" stroke-opacity=".55" stroke-width="2"/><line x1="70" y1="50" x2="330" y2="50" stroke="#38BDF8" stroke-opacity=".35" stroke-width="2"/><circle cx="84" cy="38" r="3" fill="#7DD3FC"/><circle cx="96" cy="38" r="3" fill="#0EA5E9"/><circle cx="108" cy="38" r="3" fill="#38BDF8"/><rect x="86" y="66" width="120" height="14" rx="4" fill="#E0F7FF" opacity=".85"/><rect x="86" y="88" width="170" height="7" rx="3" fill="#7DD3FC" opacity=".5"/><rect x="86" y="100" width="150" height="7" rx="3" fill="#7DD3FC" opacity=".4"/><rect x="86" y="120" width="74" height="20" rx="6" fill="#0EA5E9"/><rect x="232" y="64" width="78" height="78" rx="8" fill="rgba(56,189,248,.18)" stroke="#38BDF8" stroke-opacity=".5" stroke-width="2"/><path d="M292 142 l18 7 l-7 4 l8 9 l-5 4 l-8 -9 l-6 6 z" fill="#E0F7FF"/></svg>',
  store: '<svg viewBox="0 0 400 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="lgsto" cx="45%" cy="22%" r="78%"><stop offset="0%" stop-color="rgba(56,189,248,.3)"/><stop offset="100%" stop-color="rgba(56,189,248,0)"/></radialGradient></defs><rect width="400" height="180" fill="url(#lgsto)"/><rect x="60" y="40" width="72" height="72" rx="10" fill="rgba(14,165,233,.1)" stroke="#38BDF8" stroke-opacity=".45" stroke-width="2"/><circle cx="96" cy="70" r="16" fill="#7DD3FC" opacity=".6"/><rect x="78" y="92" width="36" height="6" rx="3" fill="#0EA5E9"/><rect x="144" y="40" width="72" height="72" rx="10" fill="rgba(14,165,233,.06)" stroke="#38BDF8" stroke-opacity=".35" stroke-width="2"/><g stroke="#E0F7FF" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M250 56 h14 l10 56 h62 l12 -40 h-76"/></g><circle cx="284" cy="128" r="7" fill="#E0F7FF"/><circle cx="332" cy="128" r="7" fill="#E0F7FF"/><g transform="translate(300,40) rotate(12)"><rect x="0" y="0" width="44" height="24" rx="5" fill="#0EA5E9"/><circle cx="10" cy="12" r="3.5" fill="#06121f"/></g></svg>',
  mobile: '<svg viewBox="0 0 400 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="lgmob" cx="50%" cy="22%" r="78%"><stop offset="0%" stop-color="rgba(14,165,233,.32)"/><stop offset="100%" stop-color="rgba(14,165,233,0)"/></radialGradient></defs><rect width="400" height="180" fill="url(#lgmob)"/><rect x="150" y="22" width="100" height="152" rx="16" fill="rgba(14,165,233,.08)" stroke="#38BDF8" stroke-opacity=".55" stroke-width="2.5"/><rect x="186" y="30" width="28" height="5" rx="2.5" fill="#38BDF8" opacity=".5"/><rect x="164" y="48" width="72" height="34" rx="8" fill="#0EA5E9" opacity=".8"/><rect x="164" y="90" width="33" height="33" rx="7" fill="#7DD3FC"/><rect x="203" y="90" width="33" height="33" rx="7" fill="#38BDF8"/><rect x="164" y="129" width="33" height="20" rx="6" fill="#7DD3FC" opacity=".6"/><rect x="203" y="129" width="33" height="20" rx="6" fill="#7DD3FC" opacity=".6"/><rect x="84" y="64" width="42" height="42" rx="11" fill="rgba(56,189,248,.2)" stroke="#38BDF8" stroke-opacity=".5" stroke-width="2"/><rect x="282" y="94" width="38" height="38" rx="10" fill="rgba(125,211,252,.18)" stroke="#7DD3FC" stroke-opacity=".5" stroke-width="2"/></svg>',
  ai: '<svg viewBox="0 0 400 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="lgai" cx="55%" cy="20%" r="80%"><stop offset="0%" stop-color="rgba(56,189,248,.32)"/><stop offset="100%" stop-color="rgba(56,189,248,0)"/></radialGradient></defs><rect width="400" height="180" fill="url(#lgai)"/><g stroke="#38BDF8" stroke-opacity=".4" stroke-width="2"><line x1="250" y1="50" x2="310" y2="40"/><line x1="250" y1="50" x2="300" y2="100"/><line x1="310" y1="40" x2="352" y2="84"/><line x1="300" y1="100" x2="352" y2="84"/><line x1="300" y1="100" x2="322" y2="140"/></g><g fill="#7DD3FC"><circle cx="250" cy="50" r="7"/><circle cx="310" cy="40" r="6" fill="#0EA5E9"/><circle cx="300" cy="100" r="8" fill="#38BDF8"/><circle cx="352" cy="84" r="6"/><circle cx="322" cy="140" r="6" fill="#E0F7FF"/></g><path d="M60 50 h120 a12 12 0 0 1 12 12 v40 a12 12 0 0 1 -12 12 h-76 l-26 22 v-22 h-18 a12 12 0 0 1 -12 -12 v-40 a12 12 0 0 1 12 -12 z" fill="rgba(14,165,233,.1)" stroke="#38BDF8" stroke-opacity=".5" stroke-width="2"/><rect x="76" y="68" width="90" height="7" rx="3" fill="#7DD3FC" opacity=".6"/><rect x="76" y="84" width="64" height="7" rx="3" fill="#7DD3FC" opacity=".45"/><g transform="translate(154,38)" fill="#E0F7FF"><path d="M0 -11 L2.7 -2.7 L11 0 L2.7 2.7 L0 11 L-2.7 2.7 L-11 0 L-2.7 -2.7 Z"/></g></svg>',
  booking: '<svg viewBox="0 0 400 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="lgbok" cx="45%" cy="22%" r="78%"><stop offset="0%" stop-color="rgba(14,165,233,.3)"/><stop offset="100%" stop-color="rgba(14,165,233,0)"/></radialGradient></defs><rect width="400" height="180" fill="url(#lgbok)"/><rect x="80" y="34" width="170" height="118" rx="12" fill="rgba(14,165,233,.07)" stroke="#38BDF8" stroke-opacity=".55" stroke-width="2"/><line x1="80" y1="62" x2="250" y2="62" stroke="#38BDF8" stroke-opacity=".4" stroke-width="2"/><line x1="108" y1="28" x2="108" y2="44" stroke="#7DD3FC" stroke-width="3" stroke-linecap="round"/><line x1="222" y1="28" x2="222" y2="44" stroke="#7DD3FC" stroke-width="3" stroke-linecap="round"/><g fill="#7DD3FC" opacity=".5"><rect x="96" y="76" width="20" height="16" rx="3"/><rect x="126" y="76" width="20" height="16" rx="3"/><rect x="156" y="76" width="20" height="16" rx="3"/><rect x="186" y="76" width="20" height="16" rx="3"/><rect x="96" y="100" width="20" height="16" rx="3"/><rect x="156" y="100" width="20" height="16" rx="3"/><rect x="186" y="100" width="20" height="16" rx="3"/></g><rect x="126" y="100" width="20" height="16" rx="3" fill="#0EA5E9"/><g transform="translate(302,108)"><circle r="34" fill="rgba(8,15,30,.6)" stroke="#38BDF8" stroke-width="2.5"/><line x1="0" y1="0" x2="0" y2="-20" stroke="#E0F7FF" stroke-width="3" stroke-linecap="round"/><line x1="0" y1="0" x2="15" y2="6" stroke="#E0F7FF" stroke-width="3" stroke-linecap="round"/><circle r="3" fill="#E0F7FF"/></g></svg>',
  growth: '<svg viewBox="0 0 400 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="lggro" cx="40%" cy="24%" r="80%"><stop offset="0%" stop-color="rgba(56,189,248,.3)"/><stop offset="100%" stop-color="rgba(56,189,248,0)"/></radialGradient></defs><rect width="400" height="180" fill="url(#lggro)"/><rect x="80" y="110" width="26" height="44" rx="4" fill="#0EA5E9"/><rect x="116" y="90" width="26" height="64" rx="4" fill="#38BDF8"/><rect x="152" y="68" width="26" height="86" rx="4" fill="#7DD3FC"/><rect x="188" y="46" width="26" height="108" rx="4" fill="#E0F7FF" opacity=".9"/><path d="M70 120 L120 96 L150 104 L210 56" fill="none" stroke="#E0F7FF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M192 50 l20 2 l-4 19" fill="none" stroke="#E0F7FF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><g transform="translate(286,58)"><path d="M0 20 l46 -20 v56 l-46 -20 z" fill="rgba(14,165,233,.25)" stroke="#38BDF8" stroke-width="2.5" stroke-linejoin="round"/><rect x="-16" y="14" width="18" height="28" rx="4" fill="#0EA5E9"/><path d="M52 22 q14 14 0 28" fill="none" stroke="#7DD3FC" stroke-width="3" stroke-linecap="round"/></g></svg>',
  brand: '<svg viewBox="0 0 400 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="lgbra" cx="40%" cy="24%" r="80%"><stop offset="0%" stop-color="rgba(125,211,252,.3)"/><stop offset="100%" stop-color="rgba(125,211,252,0)"/></radialGradient></defs><rect width="400" height="180" fill="url(#lgbra)"/><circle cx="110" cy="72" r="30" fill="#0EA5E9"/><circle cx="150" cy="102" r="26" fill="#38BDF8"/><circle cx="96" cy="116" r="22" fill="#7DD3FC"/><circle cx="160" cy="56" r="16" fill="#E0F7FF"/><g transform="translate(248,38)" stroke="#E0F7FF" stroke-width="3" fill="rgba(14,165,233,.12)" stroke-linecap="round" stroke-linejoin="round"><path d="M0 84 l8 -28 l54 -54 a8 8 0 0 1 12 12 l-54 54 z"/><line x1="54" y1="8" x2="66" y2="20"/></g><rect x="300" y="110" width="20" height="40" rx="4" fill="#0EA5E9"/><rect x="324" y="110" width="20" height="40" rx="4" fill="#38BDF8"/><rect x="348" y="110" width="20" height="40" rx="4" fill="#7DD3FC"/></svg>',
  crm: '<svg viewBox="0 0 400 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="lgcrm" cx="62%" cy="22%" r="72%"><stop offset="0%" stop-color="rgba(14,165,233,.38)"/><stop offset="100%" stop-color="rgba(14,165,233,0)"/></radialGradient></defs><rect width="400" height="180" fill="url(#lgcrm)"/><rect x="150" y="22" width="222" height="118" rx="11" fill="rgba(14,165,233,.08)" stroke="#38BDF8" stroke-opacity=".5" stroke-width="2"/><line x1="150" y1="46" x2="372" y2="46" stroke="#38BDF8" stroke-opacity=".3" stroke-width="2"/><circle cx="164" cy="34" r="3" fill="#7DD3FC"/><circle cx="176" cy="34" r="3" fill="#0EA5E9"/><g fill="#0EA5E9"><rect x="172" y="104" width="15" height="28" rx="3"/><rect x="196" y="90" width="15" height="42" rx="3"/><rect x="220" y="76" width="15" height="56" rx="3" fill="#38BDF8"/><rect x="244" y="96" width="15" height="36" rx="3"/><rect x="268" y="68" width="15" height="64" rx="3" fill="#7DD3FC"/></g><polyline points="300,118 318,98 334,106 352,80 368,88" fill="none" stroke="#E0F7FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="352" cy="80" r="3.5" fill="#E0F7FF"/><g><circle cx="44" cy="94" r="16" fill="#38BDF8"/><rect x="24" y="116" width="40" height="56" rx="20" fill="#38BDF8"/><circle cx="92" cy="106" r="13" fill="#0EA5E9"/><rect x="76" y="126" width="32" height="50" rx="16" fill="#0EA5E9"/><circle cx="126" cy="112" r="11" fill="#7DD3FC" opacity=".85"/><rect x="112" y="130" width="28" height="46" rx="14" fill="#7DD3FC" opacity=".85"/></g></svg>',
  custom: '<svg viewBox="0 0 400 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="lgcus" cx="42%" cy="24%" r="76%"><stop offset="0%" stop-color="rgba(56,189,248,.34)"/><stop offset="100%" stop-color="rgba(56,189,248,0)"/></radialGradient></defs><rect width="400" height="180" fill="url(#lgcus)"/><rect x="36" y="28" width="190" height="112" rx="11" fill="rgba(14,165,233,.08)" stroke="#38BDF8" stroke-opacity=".5" stroke-width="2"/><line x1="36" y1="50" x2="226" y2="50" stroke="#38BDF8" stroke-opacity=".3" stroke-width="2"/><circle cx="50" cy="39" r="3" fill="#7DD3FC"/><circle cx="62" cy="39" r="3" fill="#0EA5E9"/><path d="M120 72 l-22 22 l22 22" fill="none" stroke="#7DD3FC" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M160 72 l22 22 l-22 22" fill="none" stroke="#7DD3FC" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="146" y1="66" x2="136" y2="122" stroke="#0EA5E9" stroke-width="4.5" stroke-linecap="round"/><g><rect x="252" y="92" width="36" height="36" rx="7" fill="#0EA5E9"/><rect x="296" y="92" width="36" height="36" rx="7" fill="#38BDF8"/><rect x="274" y="50" width="36" height="36" rx="7" fill="#7DD3FC"/></g><g transform="translate(350,116)" stroke="#E0F7FF" stroke-width="3" fill="none"><circle r="15"/><line x1="0" y1="-22" x2="0" y2="-15"/><line x1="0" y1="15" x2="0" y2="22"/><line x1="-22" y1="0" x2="-15" y2="0"/><line x1="15" y1="0" x2="22" y2="0"/></g><circle cx="350" cy="116" r="5" fill="#E0F7FF"/><g><circle cx="60" cy="150" r="14" fill="#0EA5E9"/><rect x="42" y="170" width="36" height="44" rx="18" fill="#0EA5E9"/></g></svg>',
  consult: '<svg viewBox="0 0 400 180" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="lgcon" cx="60%" cy="22%" r="74%"><stop offset="0%" stop-color="rgba(125,211,252,.30)"/><stop offset="100%" stop-color="rgba(125,211,252,0)"/></radialGradient></defs><rect width="400" height="180" fill="url(#lgcon)"/><rect x="156" y="24" width="212" height="112" rx="11" fill="rgba(14,165,233,.08)" stroke="#38BDF8" stroke-opacity=".5" stroke-width="2"/><polyline points="176,116 214,92 244,100 290,64 338,50" fill="none" stroke="#7DD3FC" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M320 48 l20 1 l-4 19" fill="none" stroke="#7DD3FC" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="214" cy="92" r="4" fill="#0EA5E9"/><circle cx="290" cy="64" r="4" fill="#38BDF8"/><g transform="translate(74,54)"><circle r="13" fill="rgba(224,247,255,.12)" stroke="#E0F7FF" stroke-width="3"/><circle r="4" fill="#E0F7FF"/><line x1="-5" y1="17" x2="5" y2="17" stroke="#E0F7FF" stroke-width="3" stroke-linecap="round"/><line x1="-3" y1="22" x2="3" y2="22" stroke="#E0F7FF" stroke-width="3" stroke-linecap="round"/></g><g><circle cx="44" cy="100" r="16" fill="#38BDF8"/><rect x="24" y="122" width="40" height="54" rx="20" fill="#38BDF8"/><circle cx="92" cy="110" r="13" fill="#0EA5E9"/><rect x="76" y="130" width="32" height="46" rx="16" fill="#0EA5E9"/><circle cx="126" cy="116" r="11" fill="#7DD3FC" opacity=".85"/><rect x="112" y="134" width="28" height="42" rx="14" fill="#7DD3FC" opacity=".85"/></g></svg>',
}

// Curated, informational product showcase — NO prices. We learn the need, then quote.
const PRODUCTS = [
  { key: 'web', icon: 'web', name: 'Marketing Websites', blurb: 'Fast, beautiful sites built to turn visitors into customers.', span: 'lg:col-span-2 lg:row-span-2', featured: true },
  { key: 'crm', icon: 'crm', name: 'Business Platforms & CRM', blurb: 'Run sales, operations, and customers in one connected system.', span: 'lg:col-span-2', featured: true },
  { key: 'store', icon: 'store', name: 'Online Stores', blurb: 'Sell anything with a storefront engineered to convert.' },
  { key: 'mobile', icon: 'mobile', name: 'Mobile Apps', blurb: 'Native-feel apps and marketplaces your customers love.' },
  { key: 'ai', icon: 'ai', name: 'AI Tools & Assistants', blurb: 'Chatbots and AI agents working for you around the clock.' },
  { key: 'booking', icon: 'booking', name: 'Booking & Scheduling', blurb: 'Let customers book you 24/7, hands-free.' },
  { key: 'growth', icon: 'growth', name: 'Marketing & Growth', blurb: 'Campaigns, content, and automation that scale.' },
  { key: 'custom', icon: 'custom', name: 'Custom Builds', blurb: 'Anything you can picture — built to spec.' },
  { key: 'brand', icon: 'brand', name: 'Branding & Identity', blurb: 'Logo, brand, and a launch-ready look.' },
  { key: 'consult', icon: 'consult', name: 'Consulting & Operations', blurb: 'Strategy and systems from operators who build.' },
]

const STEPS = [
  { n: '01', t: 'Tell us your idea', d: 'Share what you want to build — in plain English.' },
  { n: '02', t: 'We map the plan', d: 'A clear scope, the right build, and a path to launch.' },
  { n: '03', t: 'Design you approve', d: 'See it before we build it. Nothing ships without your yes.' },
  { n: '04', t: 'Launch & support', d: 'We go live and keep it running and growing.' },
]

// Flagship Liftori products — hover to reveal what's inside (NO pricing).
const LIFTORI_PRODUCTS = [
  {
    key: 'crm', icon: 'crm', name: 'Liftori CRM',
    tag: 'Your whole business in one platform.',
    desc: 'A modern, AI-native platform that runs sales, operations, finance, and customers — tailored to how you actually work.',
    points: ['Sales pipeline, estimates & e-sign', 'Operations, scheduling & jobs', 'Marketing, finance & client portals', 'AI assistants built right in'],
  },
  {
    key: 'custom', icon: 'custom', name: 'Custom Builds',
    tag: 'If you can picture it, we can build it.',
    desc: 'Bespoke software, websites, apps, and integrations designed around your exact goals — no templates, no limits.',
    points: ['Websites & online stores', 'Mobile & web apps', 'APIs & integrations', 'One-of-a-kind internal tools'],
  },
  {
    key: 'consult', icon: 'consult', name: 'Business Consulting',
    tag: 'Strategy & systems from operators who build.',
    desc: 'Hands-on guidance to streamline operations, install the right systems, and scale — from people who run businesses, not just advise them.',
    points: ['Operational audits & playbooks', 'Systems & automation strategy', 'Fractional ops leadership', 'EOS / process implementation'],
  },
]

const STYLE_ID = 'lo-rep-landing-style'
function injectAssets() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap'
  document.head.appendChild(link)
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .lo-root{font-family:'DM Sans',ui-sans-serif,system-ui,sans-serif;}
    .lo-display{font-family:'Bebas Neue',sans-serif;letter-spacing:.012em;line-height:.92;}
    .lo-mono{font-family:'DM Mono',ui-monospace,monospace;}
    .lo-grad{background:linear-gradient(100deg,#7DD3FC 0%,#0EA5E9 45%,#38BDF8 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}
    .lo-fadeup{opacity:0;transform:translateY(20px);animation:loFadeUp .9s cubic-bezier(.2,.7,.2,1) forwards;}
    @keyframes loFadeUp{to{opacity:1;transform:none}}
    @keyframes loFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-26px)}}
    @keyframes loDrift{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-18px)}}
    .lo-orb{position:absolute;border-radius:9999px;filter:blur(70px);pointer-events:none;}
    .lo-card{transition:transform .35s cubic-bezier(.2,.7,.2,1),border-color .35s,box-shadow .35s,background .35s;}
    .lo-card:hover{transform:translateY(-6px);border-color:rgba(14,165,233,.5);box-shadow:0 24px 60px -28px rgba(14,165,233,.55);}
    .lo-grid-bg{background-image:linear-gradient(rgba(125,211,252,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(125,211,252,.06) 1px,transparent 1px);background-size:64px 64px;}
    .lo-input{width:100%;border-radius:.75rem;border:1px solid rgba(125,211,252,.18);background:rgba(8,15,30,.6);padding:.7rem .9rem;font-size:.9rem;color:#E0F7FF;outline:none;transition:border-color .2s,box-shadow .2s;}
    .lo-input::placeholder{color:#5b7088;}
    .lo-input:focus{border-color:#0EA5E9;box-shadow:0 0 0 3px rgba(14,165,233,.18);}
    .lo-label{display:block;font-size:.72rem;font-weight:600;letter-spacing:.02em;color:#9fb6cc;margin-bottom:.4rem;text-transform:uppercase;}
    @media (prefers-reduced-motion:reduce){.lo-fadeup{animation:none;opacity:1;transform:none}.lo-orb{animation:none!important}}
    .lo-prod{position:relative;overflow:hidden;border-radius:1rem;border:1px solid rgba(125,211,252,.14);background:linear-gradient(160deg,rgba(14,165,233,.06),rgba(255,255,255,.02));transition:transform .4s cubic-bezier(.2,.7,.2,1),border-color .4s,box-shadow .4s;outline:none;}
    .lo-prod:hover{transform:translateY(-8px);border-color:rgba(14,165,233,.55);box-shadow:0 30px 70px -30px rgba(14,165,233,.6);}
    .lo-prod-reveal{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:2rem;background:linear-gradient(160deg,rgba(8,15,30,.985),rgba(5,10,22,.99));box-shadow:inset 0 2px 0 rgba(14,165,233,.55);opacity:0;transform:translateY(16px);transition:opacity .4s,transform .4s;pointer-events:none;}
    .lo-prod:hover .lo-prod-reveal,.lo-prod:focus-within .lo-prod-reveal{opacity:1;transform:none;pointer-events:auto;}
    @media (hover:none){.lo-prod-reveal{position:static;opacity:1;transform:none;background:none;padding:0 2rem 2rem;}.lo-prod-hint{display:none;}}
  `
  document.head.appendChild(style)
}

const Wordmark = ({ className = '', tone = 'light' }) => (
  <span className={`lo-display ${className}`}>
    <span style={{ color: tone === 'dark' ? '#0b1220' : '#fff' }}>LIFT</span><span style={{ color: '#0EA5E9' }}>ORI</span>
  </span>
)

export default function PublicRepLanding() {
  const { slug } = useParams()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => { injectAssets() }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_rep_landing', { p_slug: slug })
      if (!alive) return
      if (error || !data) { setNotFound(true); setLoading(false); return }
      setData(data)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [slug])

  const rep = data?.rep
  const firstName = (rep?.display_name || '').trim().split(' ')[0] || 'us'
  const repBio = rep?.bio || `${rep?.display_name || 'Your Liftori specialist'} partners with business owners to turn ideas into live, working products — handling everything from the first conversation through launch, backed by the full Liftori build team.`

  if (loading) {
    return (
      <div className="lo-root min-h-screen flex items-center justify-center" style={{ background: '#060B18' }}>
        <div className="h-9 w-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0EA5E9', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="lo-root min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#060B18' }}>
        <Wordmark className="text-4xl" />
        <p className="mt-6 text-slate-400">This page isn’t available.</p>
        <a href="https://www.liftori.ai" className="mt-4 text-sm" style={{ color: '#38BDF8' }}>Go to liftori.ai</a>
      </div>
    )
  }

  return (
    <div className="lo-root relative min-h-screen overflow-hidden text-white" style={{ background: '#060B18' }}>
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 lo-grid-bg" style={{ maskImage: 'radial-gradient(circle at 50% 0%, black, transparent 75%)', WebkitMaskImage: 'radial-gradient(circle at 50% 0%, black, transparent 75%)' }} />
      <div className="lo-orb" style={{ top: '-120px', left: '-80px', width: '460px', height: '460px', background: 'rgba(14,165,233,.35)', animation: 'loDrift 14s ease-in-out infinite' }} />
      <div className="lo-orb" style={{ top: '180px', right: '-120px', width: '420px', height: '420px', background: 'rgba(125,211,252,.22)', animation: 'loFloat 12s ease-in-out infinite' }} />
      <div className="lo-orb" style={{ bottom: '-160px', left: '20%', width: '520px', height: '520px', background: 'rgba(56,189,248,.16)', animation: 'loDrift 18s ease-in-out infinite' }} />

      <div className="relative">
        {/* Header — minimal, no nav (higher conversion) */}
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-8">
          <Wordmark className="text-2xl" />
          <a href="#request" className="rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition hover:bg-white/5" style={{ borderColor: 'rgba(125,211,252,.25)', color: '#cfe9fb' }}>
            Request a build
          </a>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="lo-fadeup max-w-4xl">
            <p className="lo-mono text-xs font-medium uppercase tracking-[0.32em]" style={{ color: '#38BDF8' }}>
              {rep?.title || 'Liftori Solutions Specialist'}
            </p>
            <h1 className="lo-display lo-grad mt-6 text-[clamp(3rem,9vw,7rem)]">
              {rep?.headline || 'Custom software that lifts your business'}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-300/90 md:text-xl">
              {rep?.subheadline || 'Websites, stores, apps, CRMs, and AI tools — designed to impress, built to convert, and launched fast. Tell us what you need and we’ll bring it to life.'}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a href="#request" className="group relative overflow-hidden rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition" style={{ background: 'linear-gradient(100deg,#0EA5E9,#38BDF8)', boxShadow: '0 14px 40px -12px rgba(14,165,233,.6)' }}>
                Start your project
              </a>
              <a href="#build" className="rounded-full border px-7 py-3.5 text-sm font-semibold transition hover:bg-white/5" style={{ borderColor: 'rgba(125,211,252,.28)', color: '#cfe9fb' }}>
                See what we build
              </a>
            </div>
          </div>
        </section>

        {/* Liftori products — flagship, hover to reveal */}
        <section id="products" className="mx-auto max-w-6xl px-6 pt-8 pb-4">
          <div className="mb-10">
            <p className="lo-mono text-xs uppercase tracking-[0.32em]" style={{ color: '#38BDF8' }}>Liftori products</p>
            <h2 className="lo-display mt-3 text-5xl md:text-6xl">SIGNATURE SOLUTIONS</h2>
            <p className="mt-4 max-w-xl text-sm text-slate-400">The three ways businesses grow with Liftori. Hover any card to see what’s inside.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {LIFTORI_PRODUCTS.map((p) => (
              <div key={p.key} tabIndex={0} className="lo-prod group min-h-[380px] md:min-h-[420px]">
                <div className="flex h-full flex-col">
                  <div className="relative h-40 w-full overflow-hidden">
                    <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: ART[p.key] }} />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16" style={{ background: 'linear-gradient(to top, rgba(8,13,28,.92), transparent)' }} />
                  </div>
                  <div className="flex flex-1 flex-col px-7 pb-7 pt-4">
                    <h3 className="text-2xl font-bold text-white">{p.name}</h3>
                    <p className="mt-2 text-sm text-slate-400">{p.tag}</p>
                    <span className="lo-prod-hint lo-mono mt-auto pt-6 text-[11px] uppercase tracking-[0.28em]" style={{ color: '#38BDF8' }}>Hover for details</span>
                  </div>
                </div>
                <div className="lo-prod-reveal">
                  <h3 className="text-xl font-bold text-white">{p.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{p.desc}</p>
                  <ul className="mt-4 space-y-1.5">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-[13px] text-slate-200">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#38BDF8' }} />
                        {pt}
                      </li>
                    ))}
                  </ul>
                  <a href="#request" className="mt-5 inline-block text-sm font-semibold" style={{ color: '#7DD3FC' }}>Ask {firstName} about it</a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What we build — bento grid, NO pricing */}
        <section id="build" className="mx-auto max-w-6xl px-6 pb-8">
          <div className="mb-10">
            <p className="lo-mono text-xs uppercase tracking-[0.32em]" style={{ color: '#38BDF8' }}>What we build</p>
            <h2 className="lo-display mt-3 text-5xl md:text-6xl">ONE TEAM. ANY BUILD.</h2>
            <p className="mt-4 max-w-xl text-sm text-slate-400">From a single landing page to a full platform — pick what fits, or tell us your idea and we’ll scope it.</p>
          </div>

          <div className="grid auto-rows-[180px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRODUCTS.map((p) => (
              <div key={p.key}
                className={`lo-card group relative flex flex-col justify-end overflow-hidden rounded-2xl border p-6 ${p.span || ''}`}
                style={{ borderColor: 'rgba(125,211,252,.14)' }}>
                <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: ART[p.icon] }} />
                <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(6,11,24,.95) 24%, rgba(6,11,24,.55) 64%, rgba(6,11,24,.32))' }} />
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: 'rgba(14,165,233,.3)', filter: 'blur(40px)' }} />
                <div className="relative">
                  <h3 className={`font-semibold text-white ${p.featured ? 'text-2xl' : 'text-base'}`}>{p.name}</h3>
                  <p className={`mt-1.5 text-slate-300 ${p.featured ? 'text-sm max-w-xs' : 'text-[13px]'}`}>{p.blurb}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <p className="lo-mono text-center text-xs uppercase tracking-[0.32em]" style={{ color: '#38BDF8' }}>How it works</p>
          <h2 className="lo-display mt-3 text-center text-5xl md:text-6xl">FROM IDEA TO LIVE</h2>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="lo-card rounded-2xl border p-6" style={{ borderColor: 'rgba(125,211,252,.14)', background: 'rgba(255,255,255,.025)' }}>
                <span className="lo-display lo-grad text-5xl">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold text-white">{s.t}</h3>
                <p className="mt-1.5 text-sm text-slate-400">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Meet your specialist */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="overflow-hidden rounded-3xl border" style={{ borderColor: 'rgba(125,211,252,.16)', background: 'linear-gradient(150deg,rgba(8,15,30,.7),rgba(14,165,233,.06))' }}>
            <div className="grid items-center gap-10 p-8 md:grid-cols-[260px_1fr] md:p-12">
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                {rep?.photo_url ? (
                  <img src={rep.photo_url} alt={rep?.display_name || 'Liftori specialist'} className="h-40 w-40 rounded-2xl object-cover" style={{ border: '1px solid rgba(125,211,252,.25)' }} />
                ) : (
                  <div className="lo-display flex h-40 w-40 items-center justify-center rounded-2xl text-7xl" style={{ background: 'linear-gradient(140deg,#0EA5E9,#38BDF8)', color: '#02101f' }}>
                    {(rep?.display_name || 'L').slice(0, 1)}
                  </div>
                )}
                <p className="mt-5 text-xl font-semibold text-white">{rep?.display_name || 'Your Liftori specialist'}</p>
                <p className="text-sm" style={{ color: '#7DD3FC' }}>{rep?.title || 'Liftori Solutions Specialist'}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  {rep?.email && <a href={`mailto:${rep.email}`} className="rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'rgba(125,211,252,.22)', color: '#cfe9fb' }}>Email me</a>}
                  {rep?.phone && <a href={`tel:${rep.phone}`} className="rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'rgba(125,211,252,.22)', color: '#cfe9fb' }}>Call me</a>}
                  {rep?.booking_url && <a href={rep.booking_url} target="_blank" rel="noreferrer" className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'rgba(14,165,233,.18)', color: '#cfe9fb' }}>Book a call</a>}
                </div>
              </div>
              <div>
                <p className="lo-mono text-xs uppercase tracking-[0.32em]" style={{ color: '#38BDF8' }}>Meet your specialist</p>
                <h2 className="lo-display mt-3 text-5xl md:text-6xl">WORK WITH {firstName}</h2>
                <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-slate-300/90">{repBio}</p>
                <a href="#request" className="mt-8 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white transition" style={{ background: 'linear-gradient(100deg,#0EA5E9,#38BDF8)', boxShadow: '0 14px 40px -16px rgba(14,165,233,.6)' }}>
                  Work with {firstName}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Why Liftori */}
        <section className="mx-auto max-w-6xl px-6 pb-8">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ['Built fast', 'AI-native delivery means weeks, not months — without cutting corners.'],
              ['Truly custom', 'No cookie-cutter templates. Designed around your brand and your goals.'],
              ['Supported for the long run', 'We launch it, run it, and keep improving it as you grow.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border p-7" style={{ borderColor: 'rgba(125,211,252,.14)', background: 'linear-gradient(160deg,rgba(14,165,233,.08),transparent)' }}>
                <h3 className="text-lg font-semibold" style={{ color: '#E0F7FF' }}>{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Request a build */}
        <section id="request" className="mx-auto max-w-6xl px-6 py-24">
          <div className="overflow-hidden rounded-3xl border" style={{ borderColor: 'rgba(125,211,252,.18)', background: 'linear-gradient(150deg,rgba(14,165,233,.12),rgba(8,15,30,.6))' }}>
            <div className="grid gap-10 p-8 md:grid-cols-2 md:p-12">
              <div className="flex flex-col justify-center">
                <p className="lo-mono text-xs uppercase tracking-[0.32em]" style={{ color: '#38BDF8' }}>Let’s build it</p>
                <h2 className="lo-display mt-4 text-5xl md:text-6xl">TELL US WHAT<br/>YOU’RE PICTURING</h2>
                <p className="mt-5 max-w-md text-slate-300/90">
                  Share your idea and {rep?.display_name || 'your Liftori specialist'} will reach out personally with a plan tailored to you. No pressure, no obligation.
                </p>
                {rep?.display_name && (
                  <div className="mt-8 flex items-center gap-3 rounded-2xl border p-4" style={{ borderColor: 'rgba(125,211,252,.16)', background: 'rgba(8,15,30,.5)' }}>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold" style={{ background: 'linear-gradient(140deg,#0EA5E9,#38BDF8)', color: '#02101f' }}>
                      {(rep.display_name || 'L').slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{rep.display_name}</p>
                      <p className="truncate text-xs text-slate-400">
                        {rep.email ? <a href={`mailto:${rep.email}`} style={{ color: '#7DD3FC' }}>{rep.email}</a> : 'Your Liftori specialist'}
                        {rep.phone && <span> · {rep.phone}</span>}
                      </p>
                    </div>
                    {rep.booking_url && (
                      <a href={rep.booking_url} target="_blank" rel="noreferrer" className="ml-auto whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'rgba(14,165,233,.18)', color: '#cfe9fb' }}>Book a call</a>
                    )}
                  </div>
                )}
              </div>
              <LeadForm slug={slug} repName={rep?.display_name} />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mx-auto max-w-6xl px-6 pb-12">
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-8" style={{ borderColor: 'rgba(125,211,252,.12)' }}>
            <Wordmark className="text-xl" />
            <p className="text-xs text-slate-500">Built by Liftori — Lift Your Idea.</p>
            <a href="https://www.liftori.ai" className="text-sm" style={{ color: '#7DD3FC' }}>liftori.ai</a>
          </div>
        </footer>
      </div>
    </div>
  )
}

function LeadForm({ slug, repName }) {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', company: '',
    product_interest: '', biggest_need: '', budget_range: '', how_heard: '',
  })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!form.full_name.trim() || !form.email.trim()) { setError('Name and email are required.'); return }
    setSending(true)
    try {
      const { data, error } = await supabase.rpc('submit_rep_lead', {
        p_slug: slug,
        p_full_name: form.full_name,
        p_email: form.email,
        p_phone: form.phone || null,
        p_company: form.company || null,
        p_product_interest: form.product_interest || null,
        p_biggest_need: form.biggest_need || null,
        p_budget_range: form.budget_range || null,
        p_how_heard: form.how_heard || null,
      })
      if (error) throw error
      if (!data?.ok) throw new Error('Something went wrong')
      setDone(true)
    } catch (err) {
      setError(err?.message || 'Could not send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border p-10 text-center" style={{ borderColor: 'rgba(125,211,252,.2)', background: 'rgba(8,15,30,.6)' }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'linear-gradient(140deg,#0EA5E9,#38BDF8)' }}>
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="#02101f"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
        </div>
        <h3 className="lo-display mt-5 text-3xl text-white">YOU’RE IN</h3>
        <p className="mt-2 text-sm text-slate-300">
          {repName || 'Your Liftori specialist'} will be in touch shortly with next steps. Keep an eye on your inbox.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border p-6 md:p-7" style={{ borderColor: 'rgba(125,211,252,.18)', background: 'rgba(8,15,30,.55)' }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="lo-label">Full name *</label>
          <input className="lo-input" value={form.full_name} onChange={set('full_name')} placeholder="Jane Smith" />
        </div>
        <div>
          <label className="lo-label">Email *</label>
          <input type="email" className="lo-input" value={form.email} onChange={set('email')} placeholder="jane@company.com" />
        </div>
        <div>
          <label className="lo-label">Phone</label>
          <input className="lo-input" value={form.phone} onChange={set('phone')} placeholder="(904) 555-0100" />
        </div>
        <div>
          <label className="lo-label">Company</label>
          <input className="lo-input" value={form.company} onChange={set('company')} placeholder="Acme Co." />
        </div>
      </div>

      <div className="mt-4">
        <label className="lo-label">What are you looking to build?</label>
        <select className="lo-input" value={form.product_interest} onChange={set('product_interest')}>
          <option value="">Select an option…</option>
          {PRODUCTS.map(p => <option key={p.key} value={p.name}>{p.name}</option>)}
          <option value="Not sure yet — help me choose">Not sure yet — help me choose</option>
        </select>
      </div>

      <div className="mt-4">
        <label className="lo-label">Tell us about your project</label>
        <textarea rows={3} className="lo-input" value={form.biggest_need} onChange={set('biggest_need')}
          placeholder="What are you trying to accomplish? The more you share, the better we can help." />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="lo-label">Timeline / budget (optional)</label>
          <input className="lo-input" value={form.budget_range} onChange={set('budget_range')} placeholder="e.g. ASAP, this quarter, flexible" />
        </div>
        <div>
          <label className="lo-label">How did you hear about us?</label>
          <input className="lo-input" value={form.how_heard} onChange={set('how_heard')} placeholder="Referral, social, search…" />
        </div>
      </div>

      {error && <p className="mt-4 text-sm" style={{ color: '#fca5a5' }}>{error}</p>}

      <button type="submit" disabled={sending}
        className="mt-6 w-full rounded-full px-6 py-3.5 text-sm font-semibold text-white transition disabled:opacity-60"
        style={{ background: 'linear-gradient(100deg,#0EA5E9,#38BDF8)', boxShadow: '0 14px 40px -14px rgba(14,165,233,.65)' }}>
        {sending ? 'Sending…' : 'Request my build'}
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">
        By submitting you agree to be contacted by Liftori about your request.
      </p>
    </form>
  )
}
