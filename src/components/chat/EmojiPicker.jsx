import React, { useState } from 'react';
import { Smile } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';

const COMMON_EMOJIS = [
  '👍', '❤️', '😊', '😂', '🎉', '🔥', '👏', '✅',
  '💯', '🚀', '👀', '🤔', '😍', '🙌', '💪', '⭐',
  '✨', '🎯', '💡', '📌', '⚡', '🌟', '🎨', '🏆'
];

const EmojiPicker = ({ onSelect, trigger, onOpenChange: onOpenChangeProp }) => {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen) => {
    setOpen(isOpen);
    onOpenChangeProp?.(isOpen);
  };

  const handleSelect = (emoji) => {
    onSelect(emoji);
    handleOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Smile className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <div className="grid grid-cols-8 gap-1">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSelect(emoji)}
              className="text-2xl hover:bg-accent rounded p-2 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
