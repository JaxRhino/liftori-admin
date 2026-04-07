import React, { useState } from 'react';

const Avatar = React.forwardRef(({ className = '', ...props }, ref) => (
  <div
    ref={ref}
    className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-navy-700 ${className}`}
    {...props}
  />
));
Avatar.displayName = 'Avatar';

const AvatarImage = React.forwardRef(({ src, alt, ...props }, ref) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <img
      ref={ref}
      alt={alt}
      src={src}
      onLoad={() => setIsLoaded(true)}
      className={`aspect-square h-full w-full object-cover ${!isLoaded ? 'hidden' : ''}`}
      {...props}
    />
  );
});
AvatarImage.displayName = 'AvatarImage';

const AvatarFallback = React.forwardRef(({ className = '', ...props }, ref) => (
  <div
    ref={ref}
    className={`flex h-full w-full items-center justify-center bg-navy-700 text-xs font-medium text-gray-300 ${className}`}
    {...props}
  />
));
AvatarFallback.displayName = 'AvatarFallback';

export { Avatar, AvatarImage, AvatarFallback };
