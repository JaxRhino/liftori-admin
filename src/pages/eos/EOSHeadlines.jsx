import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useOrg } from '../../lib/OrgContext';
import {
  fetchHeadlines,
  createHeadline,
  updateHeadline,
  deleteHeadline,
  addHeadlineReaction,
  addHeadlineComment,
  fetchTeamUsers,
} from '../../lib/eosService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Avatar } from '../../components/ui/avatar';
import {
  Trophy,
  Target,
  Award,
  ThumbsUp,
  Megaphone,
  Plus,
  Heart,
  MessageCircle,
  Trash2,
  Link as LinkIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  'All',
  'Customer Win',
  'Milestone',
  'Recognition',
  'Rock Complete',
  'General',
];

const CATEGORY_CONFIG = {
  'Customer Win': { icon: Trophy, color: 'bg-green-900/30 border-green-700', textColor: 'text-green-400' },
  Milestone: { icon: Target, color: 'bg-blue-900/30 border-blue-700', textColor: 'text-blue-400' },
  Recognition: { icon: Award, color: 'bg-purple-900/30 border-purple-700', textColor: 'text-purple-400' },
  'Rock Complete': { icon: ThumbsUp, color: 'bg-orange-900/30 border-orange-700', textColor: 'text-orange-400' },
  General: { icon: Megaphone, color: 'bg-gray-800/30 border-gray-700', textColor: 'text-gray-400' },
};

const EMOJI_REACTIONS = ['❤️', '🎉', '👍', '🎯'];

export default function EOSHeadlines() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [headlines, setHeadlines] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCreateHeadline, setShowCreateHeadline] = useState(false);
  const [showViewHeadline, setShowViewHeadline] = useState(false);
  const [selectedHeadline, setSelectedHeadline] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [newHeadline, setNewHeadline] = useState({
    message: '',
    category: 'General',
    link_url: '',
  });

  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [headlinesData, usersData] = await Promise.all([
          fetchHeadlines(null, currentOrg?.id),
          fetchTeamUsers(),
        ]);
        setHeadlines(headlinesData || []);
        setTeamUsers(usersData || []);
      } catch (error) {
        console.error('Error loading headlines:', error);
        toast.error('Failed to load headlines');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentOrg?.id]);

  const handleCreateHeadline = async () => {
    if (!newHeadline.message || !newHeadline.category) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const created = await createHeadline({
        message: newHeadline.message,
        category: newHeadline.category,
        link_url: newHeadline.link_url || null,
        author_id: user?.id,
      });
      setHeadlines([created, ...headlines]);
      setNewHeadline({ message: '', category: 'General', link_url: '' });
      setShowCreateHeadline(false);
      toast.success('Headline created');
    } catch (error) {
      console.error('Error creating headline:', error);
      toast.error('Failed to create headline');
    }
  };

  const handleDeleteHeadline = async () => {
    if (!selectedHeadline) return;

    try {
      await deleteHeadline(selectedHeadline.id);
      setHeadlines(headlines.filter((h) => h.id !== selectedHeadline.id));
      setShowViewHeadline(false);
      setShowDeleteConfirm(false);
      setSelectedHeadline(null);
      toast.success('Headline deleted');
    } catch (error) {
      console.error('Error deleting headline:', error);
      toast.error('Failed to delete headline');
    }
  };

  const handleAddReaction = async (emoji) => {
    if (!selectedHeadline) return;

    try {
      await addHeadlineReaction(selectedHeadline.id, emoji);
      const updated = await fetchHeadlines(null, currentOrg?.id).then((h) => h.find((x) => x.id === selectedHeadline.id));
      if (updated) {
        setSelectedHeadline(updated);
        setHeadlines(headlines.map((h) => (h.id === updated.id ? updated : h)));
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleAddComment = async () => {
    if (!selectedHeadline || !commentText) return;

    try {
      await addHeadlineComment(selectedHeadline.id, {
        text: commentText,
        author_id: user?.id,
      });
      const updated = await fetchHeadlines(null, currentOrg?.id).then((h) => h.find((x) => x.id === selectedHeadline.id));
      if (updated) {
        setSelectedHeadline(updated);
        setHeadlines(headlines.map((h) => (h.id === updated.id ? updated : h)));
      }
      setCommentText('');
      toast.success('Comment added');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const getAuthorName = (authorId) => {
    const author = teamUsers.find((u) => u.id === authorId);
    return author?.full_name || 'Unknown';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredHeadlines =
    selectedCategory === 'All'
      ? headlines
      : headlines.filter((h) => h.category === selectedCategory);

  const HeadlineCard = ({ headline }) => {
    const config = CATEGORY_CONFIG[headline.category] || CATEGORY_CONFIG['General'];
    const IconComponent = config.icon;

    return (
      <Card
        onClick={() => {
          setSelectedHeadline(headline);
          setShowViewHeadline(true);
        }}
        className={`border p-6 cursor-pointer hover:border-blue-500 transition-all ${config.color}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconComponent className={`w-5 h-5 ${config.textColor}`} />
            <Badge className={`${config.color} border ${config.textColor}`}>
              {headline.category}
            </Badge>
          </div>
        </div>

        <p className="text-white font-medium mb-4 line-clamp-2">{headline.message}</p>

        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span>{getAuthorName(headline.author_id)}</span>
            <span>{formatDate(headline.created_at)}</span>
          </div>
          <div className="flex items-center gap-3">
            {headline.reactions && Object.keys(headline.reactions).length > 0 && (
              <span>{Object.values(headline.reactions).reduce((a, b) => a + b, 0)} reactions</span>
            )}
            {headline.comments && headline.comments.length > 0 && (
              <span>{headline.comments.length} comments</span>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">Headlines</h1>
          <Button
            onClick={() => {
              setNewHeadline({ message: '', category: 'General', link_url: '' });
              setShowCreateHeadline(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Headline
          </Button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-8 border-b border-gray-700 pb-0 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-3 font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Headlines Grid */}
        {loading ? (
          <div className="text-center text-gray-400">Loading headlines...</div>
        ) : filteredHeadlines.length === 0 ? (
          <div className="text-center text-gray-400">No headlines found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHeadlines.map((headline) => (
              <HeadlineCard key={headline.id} headline={headline} />
            ))}
          </div>
        )}
      </div>

      {/* Create Headline Dialog */}
      <Dialog open={showCreateHeadline} onOpenChange={setShowCreateHeadline}>
        <DialogContent className="bg-navy-900 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Headline</DialogTitle>
            <DialogDescription className="text-gray-400">
              Share a company win, milestone, or recognition
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <Textarea
                value={newHeadline.message}
                onChange={(e) => setNewHeadline({ ...newHeadline, message: e.target.value })}
                className="bg-navy-800 border-gray-700 text-white min-h-24"
                placeholder="Share your headline..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={newHeadline.category}
                  onChange={(e) => setNewHeadline({ ...newHeadline, category: e.target.value })}
                  className="w-full bg-navy-800 border border-gray-700 text-white px-3 py-2 rounded"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Link (Optional)</label>
                <Input
                  type="url"
                  value={newHeadline.link_url}
                  onChange={(e) => setNewHeadline({ ...newHeadline, link_url: e.target.value })}
                  className="bg-navy-800 border-gray-700 text-white"
                  placeholder="https://example.com"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button
                onClick={() => setShowCreateHeadline(false)}
                variant="outline"
                className="border-gray-700 text-white hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateHeadline}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Headline Dialog */}
      <Dialog open={showViewHeadline} onOpenChange={setShowViewHeadline}>
        <DialogContent className="bg-navy-900 border-gray-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedHeadline && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const config = CATEGORY_CONFIG[selectedHeadline.category] || CATEGORY_CONFIG['General'];
                      const IconComponent = config.icon;
                      return (
                        <>
                          <IconComponent className={`w-5 h-5 ${config.textColor}`} />
                          <Badge className={`${config.color} border ${config.textColor}`}>
                            {selectedHeadline.category}
                          </Badge>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {user?.id === selectedHeadline.author_id && (
                      <button
                        onClick={() => {
                          setShowViewHeadline(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setShowViewHeadline(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Message */}
                <div>
                  <p className="text-lg text-white leading-relaxed">{selectedHeadline.message}</p>
                </div>

                {/* Link */}
                {selectedHeadline.link_url && (
                  <a
                    href={selectedHeadline.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    <LinkIcon className="w-4 h-4" />
                    {selectedHeadline.link_url}
                  </a>
                )}

                {/* Author & Date */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
                  <Avatar className="w-8 h-8 bg-blue-600">
                    {getAuthorName(selectedHeadline.author_id)
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {getAuthorName(selectedHeadline.author_id)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(selectedHeadline.created_at)}
                    </p>
                  </div>
                </div>

                {/* Reactions */}
                <div className="space-y-3 pt-4 border-t border-gray-700">
                  <p className="text-sm font-medium">Reactions</p>
                  <div className="flex gap-2 flex-wrap">
                    {EMOJI_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleAddReaction(emoji)}
                        className="px-3 py-2 bg-navy-800 hover:bg-navy-700 border border-gray-700 rounded text-sm transition-all"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {selectedHeadline.reactions && Object.keys(selectedHeadline.reactions).length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-3">
                      {Object.entries(selectedHeadline.reactions).map(([emoji, count]) => (
                        <Badge key={emoji} className="bg-blue-900 border-blue-700">
                          {emoji} {count}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Comments */}
                <div className="space-y-3 pt-4 border-t border-gray-700">
                  <p className="text-sm font-medium">Comments</p>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {selectedHeadline.comments && selectedHeadline.comments.length > 0 ? (
                      selectedHeadline.comments.map((comment, idx) => (
                        <div key={idx} className="bg-navy-800 p-3 rounded border border-gray-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar className="w-6 h-6 bg-blue-600 text-xs">
                              {getAuthorName(comment.author_id)
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </Avatar>
                            <p className="text-sm font-medium text-white">
                              {getAuthorName(comment.author_id)}
                            </p>
                          </div>
                          <p className="text-sm text-gray-300">{comment.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">No comments yet</p>
                    )}
                  </div>

                  {/* Add Comment */}
                  <div className="flex gap-2 pt-3 border-t border-gray-700">
                    <Input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddComment();
                        }
                      }}
                      className="bg-navy-800 border-gray-700 text-white text-sm"
                      placeholder="Add a comment..."
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={!commentText}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-navy-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete Headline?</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete this headline? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => setShowDeleteConfirm(false)}
              variant="outline"
              className="border-gray-700 text-white hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteHeadline}
              className="bg-red-900 hover:bg-red-800 text-white"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
