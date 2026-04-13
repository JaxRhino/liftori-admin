import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useOrg } from '../../lib/OrgContext';
import {
  fetchTodos,
  createTodo,
  updateTodo,
  completeTodo,
  reopenTodo,
  deleteTodo,
  fetchTeamUsers,
} from '../../lib/eosService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Calendar,
  Loader,
} from 'lucide-react';
import { toast } from 'sonner';

const PRIORITY_CONFIG = {
  high: { color: 'bg-red-500/20 text-red-400', label: 'High' },
  medium: { color: 'bg-yellow-500/20 text-yellow-400', label: 'Medium' },
  low: { color: 'bg-green-500/20 text-green-400', label: 'Low' },
};

function getSmartDateLabel(dueDate) {
  if (!dueDate) return 'No due date';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays > 0) return `${diffDays} days`;

  return due.toLocaleDateString();
}

function isDueToday(dueDate) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due.getTime() === today.getTime();
}

function isOverdue(dueDate) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function TodoCard({ todo, onEdit, onDelete, onToggleComplete }) {
  const priorityConfig = PRIORITY_CONFIG[todo.priority] || PRIORITY_CONFIG.medium;
  const isCompleted = todo.status === 'complete';
  const dueDateLabel = getSmartDateLabel(todo.due_date);
  const overdue = isOverdue(todo.due_date);
  const dueToday = isDueToday(todo.due_date);

  return (
    <Card className={`bg-navy-800 border-navy-700 p-4 min-w-80 hover:bg-navy-750 transition-colors ${
      isCompleted ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggleComplete(todo.id, !isCompleted)}
          className="mt-1 p-0 hover:bg-navy-700 rounded transition-colors"
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-brand-blue" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400 hover:text-white" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className={`text-sm font-semibold line-clamp-2 ${
              isCompleted ? 'text-gray-500 line-through' : 'text-white'
            }`}>
              {todo.task}
            </h3>
            <div className="flex gap-1 ml-2 flex-shrink-0">
              <button
                onClick={() => onEdit(todo)}
                className="p-1 hover:bg-navy-700 rounded transition-colors"
                disabled={isCompleted}
              >
                <Edit2 className="w-4 h-4 text-gray-400 hover:text-white" />
              </button>
              <button
                onClick={() => onDelete(todo.id)}
                className="p-1 hover:bg-navy-700 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
              </button>
            </div>
          </div>

          {todo.description && !isCompleted && (
            <p className="text-xs text-gray-400 mb-2 line-clamp-2">
              {todo.description}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={priorityConfig.color}>
              {priorityConfig.label}
            </Badge>
            <div className={`flex items-center gap-1 text-xs font-medium ${
              overdue ? 'text-red-400' : dueToday ? 'text-yellow-400' : 'text-gray-400'
            }`}>
              <Calendar className="w-3 h-3" />
              <span>{dueDateLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function PersonColumn({ person, todos, onEditTodo, onDeleteTodo, onToggleComplete }) {
  return (
    <div className="flex flex-col gap-4 min-w-96">
      <div className="flex items-center gap-3 px-4 py-3 bg-navy-850 rounded-lg">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-brand-blue text-navy-950 text-xs font-bold">
            {person.name?.split(' ').map((n) => n[0]).join('') || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold text-white text-sm">{person.name}</h3>
          <p className="text-xs text-gray-400">
            {todos.filter((t) => t.status !== 'complete').length} open
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {todos.map((todo) => (
          <TodoCard
            key={todo.id}
            todo={todo}
            onEdit={onEditTodo}
            onDelete={onDeleteTodo}
            onToggleComplete={onToggleComplete}
          />
        ))}
      </div>
    </div>
  );
}

function CreateTodoDialog({ open, onOpenChange, onSubmit, teamUsers }) {
  const [formData, setFormData] = useState({
    task: '',
    description: '',
    owner_id: '',
    due_date: '',
    priority: 'medium',
  });

  const handleSubmit = async () => {
    if (!formData.task || !formData.owner_id) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      await onSubmit(formData);
      setFormData({
        task: '',
        description: '',
        owner_id: '',
        due_date: '',
        priority: 'medium',
      });
      onOpenChange(false);
      toast.success('Todo created successfully');
    } catch (error) {
      toast.error('Failed to create todo');
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-900 border-navy-700 text-white">
        <DialogHeader>
          <DialogTitle>Create a New Todo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Task *
            </label>
            <Input
              value={formData.task}
              onChange={(e) =>
                setFormData({ ...formData, task: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
              placeholder="What needs to be done?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
              placeholder="Add more context"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Owner *
              </label>
              <select
                value={formData.owner_id}
                onChange={(e) =>
                  setFormData({ ...formData, owner_id: e.target.value })
                }
                className="w-full bg-navy-800 border border-navy-700 rounded text-white text-sm px-3 py-2"
              >
                <option value="">Select owner</option>
                {teamUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value })
                }
                className="w-full bg-navy-800 border border-navy-700 rounded text-white text-sm px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Due Date
            </label>
            <Input
              type="date"
              value={formData.due_date}
              onChange={(e) =>
                setFormData({ ...formData, due_date: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-navy-700 text-white hover:bg-navy-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-brand-blue hover:bg-blue-600 text-white"
          >
            Create Todo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTodoDialog({ todo, open, onOpenChange, onSubmit }) {
  const [formData, setFormData] = useState(todo || {});

  useEffect(() => {
    if (todo) {
      setFormData(todo);
    }
  }, [todo, open]);

  const handleSubmit = async () => {
    try {
      await onSubmit(todo.id, formData);
      onOpenChange(false);
      toast.success('Todo updated successfully');
    } catch (error) {
      toast.error('Failed to update todo');
      console.error(error);
    }
  };

  if (!todo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-900 border-navy-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Todo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Task
            </label>
            <Input
              value={formData.task || ''}
              onChange={(e) =>
                setFormData({ ...formData, task: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="bg-navy-800 border-navy-700 text-white"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={formData.priority || 'medium'}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value })
                }
                className="w-full bg-navy-800 border border-navy-700 rounded text-white text-sm px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Due Date
              </label>
              <Input
                type="date"
                value={formData.due_date || ''}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
                className="bg-navy-800 border-navy-700 text-white"
              />
            </div>
          </div>

          {formData.subtasks && formData.subtasks.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Subtasks
              </label>
              <div className="space-y-2 bg-navy-800 rounded p-3">
                {formData.subtasks.map((subtask, idx) => (
                  <div key={idx} className="text-sm text-gray-300">
                    {subtask}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-navy-700 text-white hover:bg-navy-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-brand-blue hover:bg-blue-600 text-white"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EOSTodos() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [todos, setTodos] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'open', 'complete'
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [todosData, usersData] = await Promise.all([
        fetchTodos(statusFilter === 'all' ? null : statusFilter, currentOrg?.id),
        fetchTeamUsers(),
      ]);
      setTodos(todosData || []);
      setTeamUsers(usersData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load todos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTodo = async (formData) => {
    try {
      const newTodo = await createTodo(formData);
      setTodos([...todos, newTodo]);
      toast.success('Todo created successfully');
    } catch (error) {
      console.error('Failed to create todo:', error);
      throw error;
    }
  };

  const handleUpdateTodo = async (todoId, formData) => {
    try {
      const updated = await updateTodo(todoId, formData);
      setTodos(todos.map((t) => (t.id === todoId ? updated : t)));
    } catch (error) {
      console.error('Failed to update todo:', error);
      throw error;
    }
  };

  const handleToggleComplete = async (todoId, isComplete) => {
    try {
      if (isComplete) {
        const updated = await completeTodo(todoId);
        setTodos(todos.map((t) => (t.id === todoId ? updated : t)));
        toast.success('Todo completed');
      } else {
        const updated = await reopenTodo(todoId);
        setTodos(todos.map((t) => (t.id === todoId ? updated : t)));
        toast.success('Todo reopened');
      }
    } catch (error) {
      console.error('Failed to toggle todo:', error);
      toast.error('Failed to update todo');
    }
  };

  const handleDeleteTodo = async (todoId) => {
    try {
      await deleteTodo(todoId);
      setTodos(todos.filter((t) => t.id !== todoId));
      setDeleteConfirm(null);
      toast.success('Todo deleted');
    } catch (error) {
      console.error('Failed to delete todo:', error);
      toast.error('Failed to delete todo');
    }
  };

  const displayTodos =
    statusFilter === 'all'
      ? todos
      : statusFilter === 'open'
        ? todos.filter((t) => t.status !== 'complete')
        : todos.filter((t) => t.status === 'complete');

  const groupedByOwner = teamUsers.reduce((acc, user) => {
    acc[user.id] = {
      ...user,
      todos: displayTodos.filter((t) => t.owner_id === user.id),
    };
    return acc;
  }, {});

  const overdueTodos = displayTodos.filter((t) => isOverdue(t.due_date) && t.status !== 'complete');
  const dueTodayTodos = displayTodos.filter((t) => isDueToday(t.due_date) && t.status !== 'complete');

  const stats = {
    total: displayTodos.length,
    open: displayTodos.filter((t) => t.status !== 'complete').length,
    completed: displayTodos.filter((t) => t.status === 'complete').length,
    overdue: overdueTodos.length,
    dueToday: dueTodayTodos.length,
  };

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Weekly To-Dos</h1>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-brand-blue hover:bg-blue-600 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Todo
          </Button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mb-8">
          {[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'complete', label: 'Complete' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                statusFilter === filter.value
                  ? 'bg-brand-blue text-white'
                  : 'bg-navy-800 text-gray-400 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Total</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </Card>
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Open</p>
            <p className="text-2xl font-bold text-blue-400">{stats.open}</p>
          </Card>
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Completed</p>
            <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
          </Card>
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Overdue</p>
            <p className="text-2xl font-bold text-red-400">{stats.overdue}</p>
          </Card>
          <Card className="bg-navy-800 border-navy-700 p-4">
            <p className="text-gray-400 text-xs font-medium">Due Today</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.dueToday}</p>
          </Card>
        </div>

        {/* Todos Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-8 h-8 text-brand-blue animate-spin" />
          </div>
        ) : displayTodos.length === 0 ? (
          <Card className="bg-navy-800 border-navy-700 p-12 text-center">
            <p className="text-gray-400">No todos found</p>
          </Card>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-6">
              {Object.values(groupedByOwner).map((personData) => (
                <PersonColumn
                  key={personData.id}
                  person={personData}
                  todos={personData.todos}
                  onEditTodo={(todo) => {
                    setSelectedTodo(todo);
                    setEditDialogOpen(true);
                  }}
                  onDeleteTodo={(todoId) => setDeleteConfirm(todoId)}
                  onToggleComplete={handleToggleComplete}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateTodoDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateTodo}
        teamUsers={teamUsers}
      />

      <EditTodoDialog
        todo={selectedTodo}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleUpdateTodo}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete Todo</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400">
            Are you sure you want to delete this todo? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="border-navy-700 text-white hover:bg-navy-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleDeleteTodo(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
