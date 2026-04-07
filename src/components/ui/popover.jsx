import React, { createContext, useState, useContext, useRef, useEffect } from 'react';

const PopoverContext = createContext();

const Popover = ({ open, onOpenChange, children }) => {
  const [isOpen, setIsOpen] = useState(open || false);

  const handleOpenChange = (newOpen) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <PopoverContext.Provider value={{ isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </PopoverContext.Provider>
  );
};

const PopoverTrigger = React.forwardRef(({ asChild, className = '', children, ...props }, ref) => {
  const { isOpen, onOpenChange } = useContext(PopoverContext);

  const handleClick = (e) => {
    onOpenChange(!isOpen);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ref,
      onClick: handleClick,
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

const PopoverContent = React.forwardRef(({ className = '', children, ...props }, ref) => {
  const { isOpen, onOpenChange } = useContext(PopoverContext);
  const contentRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contentRef.current && !contentRef.current.contains(e.target)) {
        onOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onOpenChange]);

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className={`absolute z-50 w-72 rounded-md border border-navy-700/50 bg-navy-800 p-4 text-white shadow-lg ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverTrigger, PopoverContent };
