import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Hash, 
  Paperclip, 
  Link, 
  Pin,
  MessageSquare,
  X,
  ChevronDown
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

const AdvancedSearch = ({ isOpen, onClose, channels = [], users = [], onResultClick }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasFiles, setHasFiles] = useState(false);
  const [hasLinks, setHasLinks] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [inThread, setInThread] = useState(false);

  const handleSearch = async () => {
    const hasChannelFilter = selectedChannel && selectedChannel !== 'all';
    const hasUserFilter = selectedUser && selectedUser !== 'all';

    if (!query && !hasChannelFilter && !hasUserFilter && !startDate && !endDate && !hasFiles && !hasLinks && !isPinned && !inThread) {
      toast.error('Please enter a search query or select filters');
      return;
    }

    setLoading(true);
    try {
      let searchQuery = supabase.from('chat_messages').select('*');

      if (query) {
        searchQuery = searchQuery.ilike('content', `%${query}%`);
      }

      if (hasChannelFilter) {
        searchQuery = searchQuery.eq('channel_id', selectedChannel);
      }

      if (hasUserFilter) {
        searchQuery = searchQuery.eq('sender_id', selectedUser);
      }

      if (startDate) {
        searchQuery = searchQuery.gte('created_at', startDate);
      }

      if (endDate) {
        const endDatePlus = new Date(endDate);
        endDatePlus.setDate(endDatePlus.getDate() + 1);
        searchQuery = searchQuery.lt('created_at', endDatePlus.toISOString());
      }

      if (isPinned) {
        searchQuery = searchQuery.eq('is_pinned', true);
      }

      if (inThread) {
        searchQuery = searchQuery.not('parent_message_id', 'is', null);
      }

      const { data, error, count } = await searchQuery.order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with channel and sender info
      const enrichedResults = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: channel } = await supabase
            .from('chat_channels')
            .select('name')
            .eq('id', msg.channel_id)
            .single();

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', msg.sender_id)
            .single();

          return {
            ...msg,
            channel_name: channel?.name || 'Unknown',
            sender_name: profile?.full_name || 'Unknown'
          };
        })
      );

      setResults(enrichedResults);
      setTotal(enrichedResults.length);
    } catch (error) {
      toast.error('Search failed');
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedChannel('');
    setSelectedUser('');
    setStartDate('');
    setEndDate('');
    setHasFiles(false);
    setHasLinks(false);
    setIsPinned(false);
    setInThread(false);
    setResults([]);
    setTotal(0);
  };

  const activeFilterCount = [
    selectedChannel && selectedChannel !== 'all',
    selectedUser && selectedUser !== 'all',
    startDate,
    endDate,
    hasFiles,
    hasLinks,
    isPinned,
    inThread
  ].filter(Boolean).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Advanced Search
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Filters */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary">{activeFilterCount}</Badge>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Channel Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    Channel
                  </Label>
                  <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                    <SelectTrigger>
                      <SelectValue placeholder="All channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All channels</SelectItem>
                      {channels.map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          #{ch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* User Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    From User
                  </Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Anyone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Anyone</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    From Date
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    To Date
                  </Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                {/* Checkboxes */}
                <div className="col-span-2 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={hasFiles} onCheckedChange={setHasFiles} />
                    <Paperclip className="h-4 w-4" />
                    <span className="text-sm">Has files</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={hasLinks} onCheckedChange={setHasLinks} />
                    <Link className="h-4 w-4" />
                    <span className="text-sm">Has links</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={isPinned} onCheckedChange={setIsPinned} />
                    <Pin className="h-4 w-4" />
                    <span className="text-sm">Pinned</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={inThread} onCheckedChange={setInThread} />
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm">In thread</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear filters
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {results.length > 0 && (
              <p className="text-sm text-muted-foreground mb-3">
                Found {total} result{total !== 1 ? 's' : ''}
              </p>
            )}
            
            <div className="space-y-2">
              {results.length === 0 && query && !loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No messages found</p>
                </div>
              ) : (
                results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => {
                      onResultClick && onResultClick(result);
                      onClose();
                    }}
                    className="w-full text-left p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {result.sender_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{result.sender_name}</span>
                          <span className="text-xs text-muted-foreground">
                            in #{result.channel_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(result.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {result.content}
                        </p>
                        {result.attachments?.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {result.attachments.length} file(s)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedSearch;
