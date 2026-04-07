import React from 'react';

const Badge = React.forwardRef(
  ({ className = '', variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'border border-brand-blue bg-brand-blue/10 text-brand-blue',
      secondary: 'border border-navy-600 bg-navy-700 text-gray-300',
      outline: 'border border-navy-600 text-gray-300',
      destructive: 'border border-red-600 bg-red-600/10 text-red-400',
    };

    return (
      <div
        ref={ref}
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:ring-offset-navy-900 ${variants[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge };
