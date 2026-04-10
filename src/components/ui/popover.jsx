import React, { createContext, useState, useContext, useRef, useEffect } from 'react';

const PopoverContext = createContext();

const Popover = ({ open, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const containerRef = useRef(null);

  // Support controlled mode
  const isOpen = open !== undefined ? open : internalOpen;

  const handleOpenChange = (newOpen) => {
    setInternalOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  // Close on click outside the entire popover container (trigger + content)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        handleOpenChange(false);
      }
    };

    // Use setTimeout to avoid the current click event from triggering close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <PopoverContext.Provider value={{ isOpen, onOpenChange: handleOpenChange }}>
      <div ref={containerRef} className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  );
};

const PopoverTrigger = React.forwardRef(({ asChild, className = '', children, ...props }, ref) => {
  const { isOpen, onOpenChange } = useContext(PopoverContext);

  const handleClick = (e) => {
    e.stopPropagation();
    onOpenChange(!isOpen);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ref,
      onClick: (e) => {
        e.stopPropagation();
        onOpenChange(!isOpen);
        children.props.onClick?.(e);
      },
      ...props,
    });
  }

  return (
    <button ref={ref} onClick={handleClick} className={className} {...props}>
      {children}
    </button>
  );
});
PopoverTrigger.displayName = 'PopoverTrigger';

const PopoverContent = React.forwardRef(({ className = '', side = 'bottom', align = 'center', children, ...props }, ref) => {
  const { isOpen } = useContext(PopoverContext);

  if (!isOpen) return null;

  const positionClasses = {
    'bottom-center': 'top-full mt-2 left-1/2 -translate-x-1/2',
    'bottom-start': 'top-full mt-2 left-0',
    'bottom-end': 'top-full mt-2 right-0',
    'top-center': 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    'top-start': 'bottom-full mb-2 left-0',
    'top-end': 'bottom-full mb-2 right-0',
  };

  const posKey = `${side}-${align}`;

  return (
    <div
      ref={ref}
      className={`absolute z-[100] w-72 rounded-md border border-navy-700/50 bg-navy-800 p-4 text-white shadow-lg ${positionClasses[posKey] || positionClasses['bottom-center']} ${className}`}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
});
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverTrigger, PopoverContent };
