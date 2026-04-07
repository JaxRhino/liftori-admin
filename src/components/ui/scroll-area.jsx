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
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgb(55, 65, 81) transparent',
        }}
      >
        <style>
          {`
            ::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }
            ::-webkit-scrollbar-track {
              background: transparent;
            }
            ::-webkit-scrollbar-thumb {
              background: rgb(55, 65, 81);
              border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb:hover {
              background: rgb(75, 85, 99);
            }
          `}
        </style>
        {children}
      </div>
    </div>
  )
);
ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };
