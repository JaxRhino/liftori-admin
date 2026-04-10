/**
 * Reusable avatar component that shows profile picture or initials fallback.
 * Used across Chat, Rally, GlobalHeader, and anywhere a user avatar is needed.
 */
export default function UserAvatar({ name, avatarUrl, size = 'md', className = '' }) {
  const sizes = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-20 h-20 text-2xl',
    call: 'w-24 h-24 text-3xl',
  }

  const sizeClass = sizes[size] || sizes.md
  const initials = (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'User'}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    )
  }

  return (
    <div className={`${sizeClass} rounded-full bg-brand-blue/20 flex items-center justify-center text-brand-blue font-bold select-none flex-shrink-0 ${className}`}>
      {initials}
    </div>
  )
}
