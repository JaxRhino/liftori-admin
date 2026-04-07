import React from 'react';

const Separator = React.forwardRef(
  ({ className = '', orientation = 'horizontal', decorative = true, ...props }, ref) => {
    const isHorizontal = orientation === 'horizontal';

    return (
      <div
        ref={ref}
        className={`shrink-0 bg-navy-700/50 ${
          isHorizontal
            ? 'h-[1px] w-full'
            : 'h-full w-[1px]'
        } ${className}`}
        {...(decorative ? { role: 'none' } : { role: 'separator', 'aria-orientation': orientation })}
        {...props}
      />
    );
  }
);
Separator.displayName = 'Separator';

export { Separator };
