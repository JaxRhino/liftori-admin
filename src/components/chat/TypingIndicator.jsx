import React from 'react'

/**
 * Messenger-style "… is typing" indicator.
 * Three bouncing bubbles inside a chat bubble shell.
 *
 * Usage: <TypingIndicator users={[{id, name}]} />
 */
export default function TypingIndicator({ users = [], compact = false }) {
  if (!users || users.length === 0) return null

  const label =
    users.length === 1
      ? `${users[0].name || 'Someone'} is typing`
      : users.length === 2
      ? `${users[0].name} and ${users[1].name} are typing`
      : `${users.length} people are typing`

  return (
    <div
      className={`inline-flex items-center gap-2 ${
        compact ? '' : 'bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2'
      }`}
      title={label}
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <span className="flex gap-1 items-end" aria-hidden="true">
        <span
          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '1s' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: '150ms', animationDuration: '1s' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: '300ms', animationDuration: '1s' }}
        />
      </span>
    </div>
  )
}
