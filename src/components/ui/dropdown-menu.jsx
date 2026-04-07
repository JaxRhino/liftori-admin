import React, { createContext, useState, useContext, useRef, useEffect } from 'react';

const DropdownMenuContext = createContext();

const DropdownMenu = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen, menuRef }}>
      <div ref={menuRef} className="relative inline-block">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

const DropdownMenuTrigger = React.forwardRef(
  ({ asChild, children, ...props }, ref) => {
    const { isOpen, setIsOpen } = useContext(DropdownMenuContext);

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onClick: (e) => {
          setIsOpen(!isOpen);
          children.props.onClick?.(e);
        },
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        onClick={() => setIsOpen(!isOpen)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

const DropdownMenuContent = React.forwardRef(
  ({ className = '', children, align = 'start', sideOffset = 4, ...props }, ref) => {
    const { isOpen } = useContext(DropdownMenuContext);

    if (!isOpen) return null;

    const alignClasses = {
      start: 'left-0',
      end: 'right-0',
      center: 'left-1/2 -translate-x-1/2',
    };

    return (
      <div
        ref={ref}
        className={`absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-navy-700/50 bg-navy-800 p-1 text-white shadow-md ${alignClasses[align]} ${className}`}
        style={{ top: `calc(100% + ${sideOffset}px)` }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

const DropdownMenuItem = React.forwardRef(
  ({ className = '', inset, onClick, disabled = false, ...props }, ref) => {
    const { setIsOpen } = useContext(DropdownMenuContext);

    const handleClick = (e) => {
      if (!disabled) {
        onClick?.(e);
        setIsOpen(false);
      }
    };

    return (
      <div
        ref={ref}
        onClick={handleClick}
        className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-navy-700 focus:bg-navy-700 focus-visible:outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${
          inset ? 'pl-8' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        {...props}
      />
    );
  }
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuCheckboxItem = React.forwardRef(
  ({ className = '', checked, onCheckedChange, ...props }, ref) => {
    const { setIsOpen } = useContext(DropdownMenuContext);

    const handleClick = () => {
      onCheckedChange?.(!checked);
      setIsOpen(false);
    };

    return (
      <div
        ref={ref}
        onClick={handleClick}
        className={`relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-navy-700 focus:bg-navy-700 focus-visible:outline-none ${className}`}
        {...props}
      >
        {checked && (
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
        )}
      </div>
    );
  }
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

const DropdownMenuLabel = React.forwardRef(
  ({ className = '', inset, ...props }, ref) => (
    <div
      ref={ref}
      className={`px-2 py-1.5 text-xs font-medium text-gray-500 ${inset ? 'pl-8' : ''} ${className}`}
      {...props}
    />
  )
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

const DropdownMenuSeparator = React.forwardRef(({ className = '', ...props }, ref) => (
  <div
    ref={ref}
    className={`-mx-1 my-1 h-px bg-navy-700/50 ${className}`}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenuShortcut = ({ className = '', ...props }) => (
  <span className={`ml-auto text-xs tracking-widest text-gray-500 ${className}`} {...props} />
);
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
};
