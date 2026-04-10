import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Smile } from 'lucide-react';
import { Button } from '../ui/button';

const EMOJI_CATEGORIES = {
  'Reactions': [
    '👍', '👎', '❤️', '🔥', '💯', '🎉', '🙌', '👏',
    '💪', '🚀', '⭐', '✨', '🏆', '🎯', '⚡', '✅',
    '❌', '👀', '🤝', '🫡', '🤙', '💥', '🙏', '🤘',
  ],
  'Hype': [
    '💣', '🧨', '🎆', '🎇', '🪩', '🥳', '🤩',
    '😎', '🤑', '💰', '📈', '🆙', '💎', '👑', '🦁',
    '🐐', '🏅', '🥇', '🏋️', '⚔️', '🛡️', '🧗', '🎸',
  ],
  'Faces': [
    '😊', '😂', '🤣', '😍', '🥰', '😘', '😜', '🤪',
    '😤', '😈', '🤔', '🧐', '😏', '🫠', '😮', '😱',
    '🥹', '😅', '😬', '🫣', '🤫', '🤐', '😴', '🤯',
  ],
  'Work': [
    '💡', '📌', '🎨', '🔧', '🔨', '⚙️', '🛠️', '📝',
    '📊', '📋', '🗂️', '📁', '💻', '🖥️', '⌨️', '🔍',
    '📦', '🏗️', '🧱', '🪜', '📐', '🧪', '🔬', '📡',
  ],
  'Hands': [
    '👆', '👇', '👈', '👉', '✌️', '🤞', '🫶', '❤️‍🔥',
    '💅', '🤲', '👐', '🫰', '🤌', '✊', '👊', '🤜',
    '🤛', '🖐️', '👋', '🫵', '☝️', '🖖', '🫱', '🫲',
  ],
  'Fun': [
    '🍕', '🍺', '☕', '🧃', '🎮', '🎲', '🎧', '🎵',
    '🌈', '☀️', '🌊', '🍀', '🌶️', '🧊', '💊', '🔑',
    '🎁', '🪄', '🧲', '🏠', '🚗', '✈️', '🛸', '🌍',
  ],
};

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '💯', '🎉', '🚀', '😂', '👀', '🙌', '💪'];

const PICKER_WIDTH = 320;
const PICKER_HEIGHT = 400;

const EmojiPicker = ({ onSelect, trigger, onOpenChange: onOpenChangeProp }) => {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Reactions');
  const [pickerStyle, setPickerStyle] = useState({});
  const triggerRef = useRef(null);

  const handleOpenChange = useCallback((isOpen) => {
    setOpen(isOpen);
    onOpenChangeProp?.(isOpen);
    if (!isOpen) {
      setActiveCategory('Reactions');
    }
  }, [onOpenChangeProp]);

  const handleSelect = (emoji) => {
    onSelect(emoji);
    handleOpenChange(false);
  };

  // Calculate position relative to viewport using the trigger button
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;

      let top, left;

      // Vertical: prefer above if not enough space below
      if (spaceBelow < PICKER_HEIGHT + 8 && spaceAbove > PICKER_HEIGHT + 8) {
        top = rect.top - PICKER_HEIGHT - 8;
      } else if (spaceBelow >= PICKER_HEIGHT + 8) {
        top = rect.bottom + 8;
      } else {
        // Neither fits perfectly, go above and let it scroll
        top = Math.max(8, rect.top - PICKER_HEIGHT - 8);
      }

      // Horizontal: align right edge to trigger right edge, or left if no room
      if (rect.right >= PICKER_WIDTH) {
        left = rect.right - PICKER_WIDTH;
      } else {
        left = Math.max(8, rect.left);
      }

      setPickerStyle({ top, left });
    }
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      // Check if click is inside the portal picker
      const picker = document.getElementById('emoji-picker-portal');
      if (picker && picker.contains(e.target)) return;
      handleOpenChange(false);
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') handleOpenChange(false);
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, handleOpenChange]);

  const categoryNames = Object.keys(EMOJI_CATEGORIES);

  const pickerContent = open ? createPortal(
    <div
      id="emoji-picker-portal"
      className="fixed z-[9999] rounded-lg border border-navy-700/50 bg-navy-800 shadow-2xl"
      style={{
        top: pickerStyle.top,
        left: pickerStyle.left,
        width: PICKER_WIDTH,
      }}
    >
      {/* Quick Reactions Bar */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-navy-700/50">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={`quick-${emoji}`}
            onClick={() => handleSelect(emoji)}
            className="text-lg hover:bg-navy-700 rounded p-1 transition-colors flex-shrink-0"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto px-1 py-1 border-b border-navy-700/50 gap-0.5">
        {categoryNames.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-1 text-xs rounded whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-sky-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-navy-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="p-2 max-h-[260px] overflow-y-auto">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATEGORIES[activeCategory].map((emoji, idx) => (
            <button
              key={`${activeCategory}-${emoji}-${idx}`}
              onClick={() => handleSelect(emoji)}
              className="text-2xl hover:bg-navy-700 rounded p-1.5 transition-colors flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          handleOpenChange(!open);
        }}
        className="inline-flex cursor-pointer"
      >
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Smile className="h-4 w-4" />
          </Button>
        )}
      </div>
      {pickerContent}
    </>
  );
};

export default EmojiPicker;
