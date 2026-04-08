import React from 'react';

const ScrollArea = React.forwardRef(
  ({ className = '', children, orientation = 'vertical', ...props }, ref) => (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      <div
        className={
          orientation === 'vertical'
            ? 'overflow-y-auto overflow-x-hidden'
            : 'overflow-x-auto overflow-y-hidden'
        }
        style={{
          scrollbarWidth: 'auto',
          scrollbarColor: '#334155 transparent',
        }}
      >
        {children}
      </div>
    </div>
  )
);
ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };
