import React, { createContext, useState, useContext } from 'react';

const TabsContext = createContext();

const Tabs = ({ value, onValueChange, defaultValue = '', children, className = '' }) => {
  const [activeTab, setActiveTab] = useState(value || defaultValue);

  const handleValueChange = (newValue) => {
    setActiveTab(newValue);
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeTab, onValueChange: handleValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

const TabsList = React.forwardRef(({ className = '', ...props }, ref) => {
  const { activeTab } = useContext(TabsContext) || {};

  return (
    <div
      ref={ref}
      className={`inline-flex h-10 items-center justify-center rounded-md bg-navy-700 p-1 text-gray-400 ${className}`}
      {...props}
    />
  );
});
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef(({ value, className = '', children, ...props }, ref) => {
  const { activeTab, onValueChange } = useContext(TabsContext);

  const isActive = activeTab === value;

  return (
    <button
      ref={ref}
      onClick={() => onValueChange(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-navy-900 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? 'bg-navy-800 text-white shadow-sm'
          : 'text-gray-400 hover:text-gray-300'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef(
  ({ value, className = '', children, ...props }, ref) => {
    const { activeTab } = useContext(TabsContext);

    if (activeTab !== value) return null;

    return (
      <div
        ref={ref}
        className={`mt-2 ring-offset-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
