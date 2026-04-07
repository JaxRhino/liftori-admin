import React from 'react';

const PresenceIndicator = ({ status, size = 'sm', showLabel = false, className = '' }) => {
  const sizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    dnd: 'bg-red-500',
    offline: 'bg-gray-400'
  };

  const statusLabels = {
    online: 'Online',
    away: 'Away',
    dnd: 'Do Not Disturb',
    offline: 'Offline'
  };

  const dotSize = sizeClasses[size] || sizeClasses.sm;
  const dotColor = statusColors[status] || statusColors.offline;
  const label = statusLabels[status] || 'Unknown';

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span 
        className={`rounded-full ${dotSize} ${dotColor} ${status === 'online' ? 'animate-pulse' : ''}`}
        title={label}
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground capitalize">{label}</span>
      )}
    </div>
  );
};

export default PresenceIndicator;
