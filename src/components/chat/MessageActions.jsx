import React, { useState } from 'react';
import { MoreVertical, Edit, Trash2, Reply, Smile, Pin, Copy, Flag } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';

const MessageActions = ({ 
  message, 
  currentUserId, 
  onEdit, 
  onDelete, 
  onReply, 
  onReact, 
  onPin,
  onCopyLink 
}) => {
  const isOwner = message.sender_id === currentUserId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onReact(message)}>
          <Smile className="mr-2 h-4 w-4" />
          Add reaction
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onReply(message)}>
          <Reply className="mr-2 h-4 w-4" />
          Reply in thread
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPin(message)}>
          <Pin className="mr-2 h-4 w-4" />
          {message.pinned ? 'Unpin message' : 'Pin message'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCopyLink(message)}>
          <Copy className="mr-2 h-4 w-4" />
          Copy link
        </DropdownMenuItem>
        
        {isOwner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(message)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit message
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(message)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete message
            </DropdownMenuItem>
          </>
        )}
        
        {!isOwner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-muted-foreground">
              <Flag className="mr-2 h-4 w-4" />
              Report message
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MessageActions;
