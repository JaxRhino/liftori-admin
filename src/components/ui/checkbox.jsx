import React from 'react';

const Checkbox = React.forwardRef(
  ({ className = '', checked, onChange, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={`h-4 w-4 cursor-pointer rounded border border-navy-700/50 bg-navy-900 text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-navy-800 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  )
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
