import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import React, { useState, useEffect, useRef } from 'react'
import IncomingCallModal from './IncomingCallModal'
import GlobalHeader from './GlobalHeader'
import VideoCallRoom from './VideoCallRoom'
import OnboardingWizard from './OnboardingWizard'

const freightNavItems = [
  {
    label: 'Overview', path: '/admin/freight', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    )
  },
  {
    label: 'Sales Profiles', path: '/admin/freight/sales-profiles', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
      </svg>
    )
  },
  {
    label: 'Shippers', path: '/admin/freight/shippers', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    )
  },
  {
    label: 'Loads', path: '/admin/freight/loads', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    )
  },
  {
    label: 'Commissions', path: '/admin/freight/commissions', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    )
  },
]

const toolItems = [
  {
    label: 'Tasks', path: '/admin/tasks', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    label: 'Notes', path: '/admin/notes', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      </svg>
    )
  },
  {
    label: 'Calendar', path: '/admin/calendar', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    )
  },
]

const leadHunterSubItems = [
  { label: 'Dashboard', path: '/admin/lead-hunter' },
  { label: 'Search', path: '/admin/lead-hunter/search' },
  { label: 'Lists', path: '/admin/lead-hunter/lists' },
  { label: 'Sequences', path: '/admin/lead-hunter/sequences' },
  { label: 'Signals', path: '/admin/lead-hunter/signals' },
  { label: 'Settings', path: '/admin/lead-hunter/settings' },
]

const salesHubItems = [
  {
    label: 'Lead Hunter', path: '/admin/lead-hunter', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    subItems: leadHunterSubItems
  },
  {
    label: 'Customers', path: '/admin/customers', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    )
  },
  {
    label: 'Projects', path: '/admin/projects', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    )
  },
  {
    label: 'Pipeline', path: '/admin/pipeline', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    )
  },
  {
    label: 'Estimates', path: '/admin/estimates', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
      </svg>
    )
  },
  {
    label: 'Agreements', path: '/admin/agreements', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  },
  {
    label: 'Commissions', path: '/admin/commissions', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    label: 'Waitlist', path: '/admin/waitlist', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    )
  },
  {
    label: 'Platforms', path: '/admin/platforms', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    )
  },
]

const opsItems = [
  {
    label: 'Ops Dashboard', path: '/admin/ops-dashboard', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    )
  },
  {
    label: 'Wizard', path: '/admin/wizard', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    )
  },
  {
    label: 'Affiliates', path: '/admin/affiliates', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.061a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
      </svg>
    )
  },
  {
    label: 'Discount Codes', path: '/admin/discount-codes', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    )
  },
  {
    label: 'Plans', path: '/admin/plans', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    )
  },
  {
    label: 'Team', path: '/admin/team', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    )
  },
  {
    label: 'Work Queue', path: '/admin/work-queue', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152-6.135 1.125 1.125 0 00-1.14-1.068l-.738.004c-.532.003-1.072-.095-1.551-.348-.354-.186-.752-.28-1.126-.28h-1c-.374 0-.772.094-1.126.28-.479.253-1.02.351-1.551.348l-.738-.004a1.125 1.125 0 00-1.14 1.068 23.91 23.91 0 01-1.152 6.135C9.353 13.258 12.117 12.75 12 12.75z" />
      </svg>
    )
  },
  {
    label: 'Company Docs', path: '/admin/company-docs', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  },
  {
    label: 'HR Hub', path: '/admin/hr-hub', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    )
  },
]

const marketingHubItems = [
  {
    label: 'Dashboard', path: '/admin/marketing', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    )
  },
  {
    label: 'Marketing Tracker', path: '/admin/marketing/tracker', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    )
  },
  {
    label: 'Ad Manager', path: '/admin/marketing/ads', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    )
  },
  {
    label: 'On Pace Tracking', path: '/admin/marketing/on-pace', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    )
  },
  {
    label: 'Content Creator', path: '/admin/marketing/content', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      </svg>
    )
  },
  {
    label: 'Scheduler', path: '/admin/marketing/scheduler', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    )
  },
  {
    label: 'Customer Map', path: '/admin/marketing/customer-map', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    )
  },
  {
    label: 'SEO Manager', path: '/admin/marketing/seo', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    )
  },
  {
    label: 'Email Campaigns', path: '/admin/marketing/email', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    )
  },
  {
    label: 'Analytics', path: '/admin/marketing/analytics', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    )
  },
  {
    label: 'Social Listening', path: '/admin/marketing/social-listening', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
      </svg>
    )
  },
  {
    label: 'UTM Builder', path: '/admin/marketing/utm-builder', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.061a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
      </svg>
    )
  },
  {
    label: 'A/B Testing', path: '/admin/marketing/ab-testing', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    )
  },
  {
    label: 'Audience Segments', path: '/admin/marketing/audience-segments', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    )
  },
]

const MARKETING_HUB_ICON = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
  </svg>
)

const OPS_ICON = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
)

const SALES_HUB_ICON = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
  </svg>
)

const TOOLS_ICON = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
  </svg>
)

const navItems = [
  {
    label: 'Dashboard', path: '/admin', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    )
  },
  {
    label: 'Call Center', path: '/admin/call-center', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    )
  },
  {
    label: 'Marketing', path: '/admin/marketing', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
      </svg>
    )
  },
  {
    label: 'Comms',
    path: '/admin/comms',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    )
  },
  {
    label: 'Chat', path: '/admin/chat', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    )
  },
  {
    label: 'Rally', path: '/admin/rally', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    )
  },
  {
    label: 'EOS', path: '/admin/eos', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    )
  },
  {
    label: 'Finance', path: '/admin/finance', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    )
  },
  {
    label: 'Support Tickets', path: '/admin/support-tickets', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    )
  },
  {
    label: 'Settings', path: '/admin/settings', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
]

export default function AdminLayout() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Scroll to top on route change
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [location.pathname])

  const isSalesHubRoute = ['/admin/customers', '/admin/projects', '/admin/pipeline', '/admin/platforms', '/admin/lead-hunter', '/admin/estimates', '/admin/agreements', '/admin/commissions', '/admin/waitlist'].some(p => location.pathname.startsWith(p))
  const [salesHubOpen, setSalesHubOpen] = useState(isSalesHubRoute)
  const isLeadHunterRoute = location.pathname.startsWith('/admin/lead-hunter')
  const [leadHunterOpen, setLeadHunterOpen] = useState(isLeadHunterRoute)
  const isOpsRoute = ['/admin/ops-dashboard', '/admin/wizard', '/admin/affiliates', '/admin/discount-codes', '/admin/plans', '/admin/team', '/admin/work-queue', '/admin/company-docs', '/admin/hr-hub'].some(p => location.pathname.startsWith(p))
  const [opsOpen, setOpsOpen] = useState(isOpsRoute)
  const isMarketingRoute = location.pathname.startsWith('/admin/marketing')
  const [marketingOpen, setMarketingOpen] = useState(isMarketingRoute)
  const isToolsRoute = ['/admin/tasks', '/admin/notes', '/admin/calendar'].some(p => location.pathname.startsWith(p))
  const [toolsOpen, setToolsOpen] = useState(isToolsRoute)
  const isFreightRoute = location.pathname.startsWith('/admin/freight')
  const [freightOpen, setFreightOpen] = useState(isFreightRoute)
  const isBuildsRoute = location.pathname.startsWith('/admin/builds')
  const [buildsOpen, setBuildsOpen] = useState(isBuildsRoute)
  const isEOSRoute = location.pathname.startsWith('/admin/eos')
  const [eosOpen, setEosOpen] = useState(isEOSRoute)
  const isFinanceRoute = location.pathname.startsWith('/admin/finance')
  const [financeOpen, setFinanceOpen] = useState(isFinanceRoute)
  const isCommsRoute = location.pathname.startsWith('/admin/comms')
  const [commsOpen, setCommsOpen] = useState(isCommsRoute)

  // Onboarding gate — non-admin, non-customer users must complete onboarding first
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const needsOnboarding = profile &&
    profile.role !== 'admin' &&
    profile.role !== 'customer' &&
    !profile.onboarding_complete &&
    !onboardingDismissed

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (needsOnboarding) {
    return <OnboardingWizard onComplete={() => setOnboardingDismissed(true)} />
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} bg-navy-800 border-r border-navy-700/50 flex flex-col transition-all duration-200`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-navy-700/50">
          <span className="font-display text-2xl tracking-wider text-white">
            {sidebarOpen ? 'LIFTORI' : 'L'}
          </span>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d={sidebarOpen ? "M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" : "M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5"} />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item, idx) => (
            <React.Fragment key={item.path}>
              {['Marketing', 'EOS', 'Finance', 'Comms'].includes(item.label) ? (
                <button
                  onClick={() => {
                    if (item.label === 'Marketing') { if (sidebarOpen) setMarketingOpen(o => !o); else navigate('/admin/marketing'); }
                    else if (item.label === 'EOS') { if (sidebarOpen) setEosOpen(o => !o); else navigate('/admin/eos'); }
                    else if (item.label === 'Finance') { if (sidebarOpen) setFinanceOpen(o => !o); else navigate('/admin/finance'); }
                    else if (item.label === 'Comms') { if (sidebarOpen) setCommsOpen(o => !o); else navigate('/admin/comms'); }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${(item.label === 'Marketing' && isMarketingRoute) || (item.label === 'EOS' && isEOSRoute) || (item.label === 'Finance' && isFinanceRoute) || (item.label === 'Comms' && isCommsRoute)
                      ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-400 hover:text-white hover:bg-navy-700/50'}`}>
                  {item.icon}
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <svg className={`w-4 h-4 transition-transform ${
                        (item.label === 'Marketing' && marketingOpen) || (item.label === 'EOS' && eosOpen) || (item.label === 'Finance' && financeOpen) || (item.label === 'Comms' && commsOpen) ? 'rotate-180' : ''
                      }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </>
                  )}
                </button>
              ) : (
              <NavLink to={item.path} end={item.path === '/admin'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                    ? 'bg-brand-blue/10 text-brand-blue'
                    : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                  }`
                }>
                {item.icon}
                {sidebarOpen && <span>{item.label}</span>}
              </NavLink>
              )}

              {/* Marketing Hub sub-nav */}
              {item.label === 'Marketing' && (<>
                {sidebarOpen && marketingOpen && (
                  <div className="ml-3 pl-3 border-l border-white/10 mt-1 space-y-0.5">
                    {marketingHubItems.map(sub => (
                      <NavLink key={sub.path} to={sub.path} end={sub.path === '/admin/marketing'}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                            ? 'bg-brand-blue/10 text-brand-blue'
                            : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                          }`
                        }>
                        {sub.icon}
                        <span>{sub.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </>)}

              {/* EOS sub-nav — inserted after EOS nav item */}
              {item.label === 'EOS' && (<>
                {sidebarOpen && eosOpen && (
                  <div className="ml-3 pl-3 border-l border-white/10 mt-1 space-y-0.5">
                    {[
                      { label: 'EOS Hub', path: '/admin/eos' },
                      { label: 'L10 Meetings', path: '/admin/eos/meetings' },
                      { label: 'Scorecard', path: '/admin/eos/scorecard' },
                      { label: 'Rocks', path: '/admin/eos/rocks' },
                      { label: 'Issues (IDS)', path: '/admin/eos/issues' },
                      { label: 'To-Dos', path: '/admin/eos/todos' },
                      { label: 'Headlines', path: '/admin/eos/headlines' },
                      { label: 'Accountability', path: '/admin/eos/accountability' },
                      { label: 'V/TO', path: '/admin/eos/vto' },
                      { label: 'Leadership', path: '/admin/eos/leadership' },
                    ].map(sub => (
                      <NavLink key={sub.path} to={sub.path} end={sub.path === '/admin/eos'}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                            ? 'bg-brand-blue/10 text-brand-blue'
                            : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                          }`
                        }>
                        <span>{sub.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </>)}

              {/* Finance sub-nav */}
              {item.label === 'Finance' && (<>
                {sidebarOpen && financeOpen && (
                  <div className="ml-3 pl-3 border-l border-white/10 mt-1 space-y-0.5">
                    {[
                      { label: 'Dashboard', path: '/admin/finance' },
                      { label: 'Invoices', path: '/admin/finance/invoices' },
                      { label: 'Payments', path: '/admin/finance/payments' },
                      { label: 'Expenses', path: '/admin/finance/expenses' },
                      { label: 'Journal Entries', path: '/admin/finance/journal' },
                      { label: 'Reports', path: '/admin/finance/reports' },
                      { label: 'Commissions', path: '/admin/finance/commissions' },
                      { label: 'Chart of Accounts', path: '/admin/finance/accounts' },
                    ].map(sub => (
                      <NavLink key={sub.path} to={sub.path} end={sub.path === '/admin/finance'}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                            ? 'bg-brand-blue/10 text-brand-blue'
                            : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                          }`
                        }>
                        <span>{sub.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </>)}

              {/* Comms sub-nav */}
              {item.label === 'Comms' && (<>
                {sidebarOpen && commsOpen && (
                  <div className="ml-3 pl-3 border-l border-white/10 mt-1 space-y-0.5">
                    {[
                      { label: 'Inbox', path: '/admin/comms' },
                      { label: 'Channels', path: '/admin/comms/channels' },
                      { label: 'Automations', path: '/admin/comms/automations' },
                    ].map(sub => (
                      <NavLink key={sub.path} to={sub.path} end={sub.path === '/admin/comms'}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                            ? 'bg-brand-blue/10 text-brand-blue'
                            : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                          }`
                        }>
                        <span>{sub.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </>)}

              {/* Sales Hub dropdown — inserted right after Call Center */}
              {item.label === 'Call Center' && (<>
                <div>
                  <button
                    onClick={() => { if (sidebarOpen) setSalesHubOpen(o => !o); else navigate('/admin/customers') }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${isSalesHubRoute ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-400 hover:text-white hover:bg-navy-700/50'}`}>
                    {SALES_HUB_ICON}
                    {sidebarOpen && (
                      <>
                        <span className="flex-1 text-left">Sales Hub</span>
                        <svg className={`w-4 h-4 transition-transform ${salesHubOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </>
                    )}
                  </button>
                  {sidebarOpen && salesHubOpen && (
                    <div className="ml-3 pl-3 border-l border-white/10 mt-1 space-y-0.5">
                      {salesHubItems.map(sub => (
                        <React.Fragment key={sub.path}>
                          {sub.subItems ? (
                            <>
                              <button
                                onClick={() => { setLeadHunterOpen(o => !o); navigate(sub.path); }}
                                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${isLeadHunterRoute
                                  ? 'bg-brand-blue/10 text-brand-blue'
                                  : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                                }`}>
                                {sub.icon}
                                <span className="flex-1 text-left">{sub.label}</span>
                                <svg className={`w-3 h-3 transition-transform ${leadHunterOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                              {leadHunterOpen && (
                                <div className="ml-3 pl-3 border-l border-white/10 space-y-0.5">
                                  {sub.subItems.map(subItem => (
                                    <NavLink key={subItem.path} to={subItem.path} end={subItem.path === '/admin/lead-hunter'}
                                      className={({ isActive }) =>
                                        `flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${isActive
                                          ? 'text-brand-blue bg-brand-blue/5'
                                          : 'text-gray-500 hover:text-gray-300 hover:bg-navy-700/30'
                                        }`
                                      }>
                                      <span>{subItem.label}</span>
                                    </NavLink>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <NavLink to={sub.path}
                              className={({ isActive }) =>
                                `flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                                  ? 'bg-brand-blue/10 text-brand-blue'
                                  : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                                }`
                              }>
                              {sub.icon}
                              <span>{sub.label}</span>
                            </NavLink>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                  {!sidebarOpen && (
                    <div className="space-y-0.5 mt-0.5">
                      {salesHubItems.map(sub => (
                        <NavLink key={sub.path} to={sub.path}
                          className={({ isActive }) =>
                            `flex items-center justify-center px-3 py-2 rounded-lg text-xs transition-colors ${isActive
                              ? 'bg-brand-blue/10 text-brand-blue'
                              : 'text-gray-500 hover:text-white hover:bg-navy-700/50'
                            }`
                          }
                          title={sub.label}>
                          {sub.icon}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>

                {/* Operations dropdown — right after Sales Hub */}
                <div>
                  <button
                    onClick={() => { if (sidebarOpen) setOpsOpen(o => !o); else navigate('/admin/wizard') }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isOpsRoute ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-400 hover:text-white hover:bg-navy-700/50'}`}>
                    {OPS_ICON}
                    {sidebarOpen && (
                      <>
                        <span className="flex-1 text-left">Operations</span>
                        <svg className={`w-4 h-4 transition-transform ${opsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </>
                    )}
                  </button>
                  {sidebarOpen && opsOpen && (
                    <div className="ml-3 pl-3 border-l border-white/10 mt-1 space-y-0.5">
                      {opsItems.map(sub => (
                        <NavLink key={sub.path} to={sub.path}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                              ? 'bg-brand-blue/10 text-brand-blue'
                              : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                            }`
                          }>
                          {sub.icon}
                          <span>{sub.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                  {!sidebarOpen && (
                    <div className="space-y-0.5 mt-0.5">
                      {opsItems.map(sub => (
                        <NavLink key={sub.path} to={sub.path}
                          className={({ isActive }) =>
                            `flex items-center justify-center px-3 py-2 rounded-lg text-xs transition-colors ${isActive
                              ? 'bg-brand-blue/10 text-brand-blue'
                              : 'text-gray-500 hover:text-white hover:bg-navy-700/50'
                            }`
                          }
                          title={sub.label}>
                          {sub.icon}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              </>)}
            </React.Fragment>
          ))}

          {/* Tools group */}
          <div className="pt-1">
            {sidebarOpen && (
              <p className="text-xs text-slate-600 uppercase tracking-widest px-3 mb-1 mt-2">Tools</p>
            )}
            <button
              onClick={() => { if (sidebarOpen) setToolsOpen(o => !o); else navigate('/admin/tasks') }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isToolsRoute ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-400 hover:text-white hover:bg-navy-700/50'}`}>
              {TOOLS_ICON}
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">Tools</span>
                  <svg className={`w-4 h-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </>
              )}
            </button>
            {sidebarOpen && toolsOpen && (
              <div className="ml-3 pl-3 border-l border-white/10 mt-1 space-y-0.5">
                {toolItems.map(item => (
                  <NavLink key={item.path} to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                        ? 'bg-brand-blue/10 text-brand-blue'
                        : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                      }`
                    }>
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
            {!sidebarOpen && (
              <div className="space-y-0.5 mt-0.5">
                {toolItems.map(item => (
                  <NavLink key={item.path} to={item.path}
                    className={({ isActive }) =>
                      `flex items-center justify-center px-3 py-2 rounded-lg text-xs transition-colors ${isActive
                        ? 'bg-brand-blue/10 text-brand-blue'
                        : 'text-gray-500 hover:text-white hover:bg-navy-700/50'
                      }`
                    }
                    title={item.label}>
                    {item.icon}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* In-House Builds */}
          <div className="pt-1">
            {sidebarOpen && (
              <p className="text-xs text-slate-600 uppercase tracking-widest px-3 mb-1 mt-2">Internal</p>
            )}
            <NavLink
              to="/admin/builds"
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive || isBuildsRoute ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                }`
              }
              title="In-House Builds">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 3.024c-.604.34-1.287-.198-1.049-.855l1.583-4.375a1.125 1.125 0 00-.312-1.237L2.77 8.975a.75.75 0 01.428-1.32l4.625-.28a1.125 1.125 0 001.007-.686l1.794-4.327a.75.75 0 011.352 0l1.794 4.327c.157.378.51.644.92.686l4.625.28a.75.75 0 01.428 1.32l-3.488 2.752a1.125 1.125 0 00-.312 1.237l1.583 4.375c.238.657-.445 1.195-1.049.855L12.58 15.17a1.125 1.125 0 00-1.16 0z" />
              </svg>
              {sidebarOpen && <span className="flex-1 text-left">In-House Builds</span>}
            </NavLink>
          </div>

          {/* Freight AI */}
          <div className="pt-1">
            {sidebarOpen && (
              <p className="text-xs text-slate-600 uppercase tracking-widest px-3 mb-1 mt-2">Client Platforms</p>
            )}
            <button
              onClick={() => { if (sidebarOpen) setFreightOpen(o => !o); else navigate('/admin/freight') }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isFreightRoute ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
              }`}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">Freight AI</span>
                  <svg className={`w-4 h-4 transition-transform ${freightOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </>
              )}
            </button>
            {sidebarOpen && freightOpen && (
              <div className="ml-3 pl-3 border-l border-white/10 mt-1 space-y-0.5">
                {freightNavItems.map(item => (
                  <NavLink key={item.path} to={item.path} end={item.path === '/admin/freight'}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                        ? 'bg-brand-blue/10 text-brand-blue'
                        : 'text-gray-400 hover:text-white hover:bg-navy-700/50'
                      }`
                    }>
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
            {!sidebarOpen && (
              <NavLink to="/admin/freight"
                className={({ isActive }) =>
                  `flex items-center justify-center px-3 py-2 rounded-lg text-xs transition-colors ${isActive
                    ? 'bg-brand-blue/10 text-brand-blue'
                    : 'text-gray-500 hover:text-white hover:bg-navy-700/50'
                  }`
                }
                title="Freight AI">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
              </NavLink>
            )}
          </div>

          {/* Client Portals */}
          <div className="pt-1">
            {sidebarOpen && (
              <p className="text-xs text-slate-600 uppercase tracking-widest px-3 mb-1 mt-2">Portals</p>
            )}
            <NavLink
              to="/portal"
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'text-white bg-navy-700/70' : 'text-gray-400 hover:text-white hover:bg-navy-700/50'}`}
              title="VJ Portal">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {sidebarOpen && <span className="flex-1">Portal</span>}
            </NavLink>
            <a
              href="https://www.vjthriftfinds.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-navy-700/50"
              title="Customer Platforms">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              {sidebarOpen && <span className="flex-1">Customer Platforms</span>}
              {sidebarOpen && (
                <svg className="w-3 h-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              )}
            </a>
          </div>
        </nav>

      </aside>

      {/* Main content area with global header */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />
        <main ref={mainRef} className="flex-1 overflow-auto bg-navy-950">
          <div className="p-0">
            <Outlet context={{ sidebarOpen }} />
          </div>
        </main>
      </div>

      {/* Global video call overlays */}
      <IncomingCallModal />
      <VideoCallRoom />
    </div>
  )
}
