import React from 'react';

const Alert = React.forwardRef(({ className = '', ...props }, ref) => (
  <div
    ref={ref}
    className={`relative w-full rounded-lg border border-navy-700/50 bg-navy-800 p-4 text-white ${className}`}
    role="alert"
    {...props}
  />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef(({ className = '', ...props }, ref) => (
  <h5
    ref={ref}
    className={`mb-1 font-medium leading-tight text-white ${className}`}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef(({ className = '', ...props }, ref) => (
  <div
    ref={ref}
    className={`text-sm text-gray-400 [&_p]:leading-relaxed ${className}`}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
