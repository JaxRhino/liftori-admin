import React, { createContext, useState, useContext } from 'react';

const TooltipContext = createContext();

const TooltipProvider = ({ children }) => {
  const [tooltips, setTooltips] = useState({});

  const setTooltipOpen = (id, isOpen) => {
    setTooltips((prev) => ({ ...prev, [id]: isOpen }));
  };

  return (
    <TooltipContext.Provider value={{ tooltips, setTooltipOpen }}>
      {children}
    </TooltipContext.Provider>
  );
};

const Tooltip = ({ children, delayMs = 200 }) => {
  const [tooltipId] = useState(() => Math.random().toString(36).substr(2, 9));
  const context = useContext(TooltipContext);

  if (!context) {
    return <div>{children}</div>;
  }

  return (
    <div className="relative">
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { tooltipId, delayMs })
      )}
    </div>
  );
};

const TooltipTrigger = React.forwardRef(
  ({ children, tooltipId, delayMs = 200, asChild, ...props }, ref) => {
    const { setTooltipOpen } = useContext(TooltipContext) || {};
    const [timeoutId, setTimeoutId] = React.useState(null);

    const handleMouseEnter = () => {
      const timeout = setTimeout(() => {
        setTooltipOpen?.(tooltipId, true);
      }, delayMs);
      setTimeoutId(timeout);
    };

    const handleMouseLeave = () => {
      if (timeoutId) clearTimeout(timeoutId);
      setTooltipOpen?.(tooltipId, false);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      });
    }

    return (
      <div
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipTrigger.displayName = 'TooltipTrigger';

const TooltipContent = React.forwardRef(
  ({ children, className = '', tooltipId, side = 'top', sideOffset = 4, ...props }, ref) => {
    const context = useContext(TooltipContext);
    const isOpen = context?.tooltips[tooltipId];

    if (!isOpen) return null;

    const sideClasses = {
      top: 'bottom-full mb-2',
      bottom: 'top-full mt-2',
      left: 'right-full mr-2',
      right: 'left-full ml-2',
    };

    return (
      <div
        ref={ref}
        className={`absolute z-50 rounded-md bg-navy-900 px-2 py-1 text-xs text-gray-300 border border-navy-700/50 ${sideClasses[side]} whitespace-nowrap pointer-events-none ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
