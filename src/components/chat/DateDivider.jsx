import React from 'react';

const DateDivider = ({ date }) => {
  const formatDate = (dateString) => {
    const messageDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time parts for comparison
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    messageDate.setHours(0, 0, 0, 0);

    if (messageDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  return (
    <div className="flex items-center gap-4 my-4">
      <div className="flex-1 h-px bg-border"></div>
      <div className="text-xs font-medium text-muted-foreground px-3 py-1 bg-muted rounded-full">
        {formatDate(date)}
      </div>
      <div className="flex-1 h-px bg-border"></div>
    </div>
  );
};

export default DateDivider;
