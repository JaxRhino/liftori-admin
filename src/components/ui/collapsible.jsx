import React, { createContext, useState, useContext } from 'react';

const CollapsibleContext = createContext();

const Collapsible = ({ open, onOpenChange, children }) => {
  const [isOpen, setIsOpen] = useState(open || false);

  const handleOpenChange = (newOpen) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <CollapsibleContext.Provider value={{ isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </CollapsibleContext.Provider>
  );
};

const CollapsibleTrigger = React.forwardRef(({ className = '', children, ...props }, ref) => {
  const { isOpen, onOpenChange } = useContext(CollapsibleContext);

  return (
    <button
      ref={ref}
      onClick={() => onOpenChange(!isOpen)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-navy-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 text-sm hover:bg-navy-700/50 text-gray-300 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

const CollapsibleContent = React.forwardRef(({ className = '', children, ...props }, ref) => {
  const { isOpen } = useContext(CollapsibleContext);

  if (!isOpen) return null;

  return (
    <div ref={ref} className={`overflow-hidden ${className}`} {...props}>
      {children}
    </div>
  );
});
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
