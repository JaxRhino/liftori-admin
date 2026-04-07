import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchScorecardMetrics,
  createScorecardMetric,
  updateScorecardMetric,
  updateMetricValue,
  deleteScorecardMetric,
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
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['All', 'Sales', 'Operations', 'Financial'];
const CATEGORY_COLORS = {
  Sales: 'bg-blue-900/30 border-blue-700',
  Operations: 'bg-green-900/30 border-green-700',
  Financial: 'bg-purple-900/30 border-purple-700',
};

export default function EOSScorecard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [showUpdateValue, setShowUpdateValue] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingMetric, setEditingMetric] = useState(null);
  const [selectedMetricForValue, setSelectedMetricForValue] = useState(null);

  const [newMetric, setNewMetric] = useState({
    name: '',
    description: '',
    owner_id: '',
    category: 'Sales',
    measurement_type: 'number',
    goal: '',
    thresholds: { green_min: '', yellow_min: '', red_max: '' },
  });

  const [newValue, setNewValue] = useState({
    value: '',
    notes: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [metricsData, usersData] = await Promise.all([
          fetchScorecardMetrics(),
          fetchTeamUsers(),
        ]);
        setMetrics(metricsData || []);
        setTeamUsers(usersData || []);
      } catch (error) {
        console.error('Error loading scorecard data:', error);
        toast.error('Failed to load scorecard data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const metricsData = await fetchScorecardMetrics();
      setMetrics(metricsData || []);
      toast.success('Scorecard refreshed');
    } catch (error) {
      console.error('Error refreshing scorecard:', error);
      toast.error('Failed to refresh scorecard');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMetric = async () => {
    if (!newMetric.name || !newMetric.owner_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const created = await createScorecardMetric(newMetric);
      setMetrics([...metrics, created]);
      setNewMetric({
        name: '',
        description: '',
        owner_id: '',
        category: 'Sales',
        measurement_type: 'number',
        goal: '',
        thresholds: { green_min: '', yellow_min: '', red_max: '' },
      });
      setShowAddMetric(false);
      toast.success('Metric created');
    } catch (error) {
      console.error('Error creating metric:', error);
      toast.error('Failed to create metric');
    }
  };

  const handleEditMetric = (metric) => {
    setEditingMetric(metric);
    setNewMetric({
      name: metric.name,
      description: metric.description || '',
      owner_id: metric.owner_id,
      category: metric.category,
      measurement_type: metric.measurement_type || 'number',
      goal: metric.goal || '',
      thresholds: metric.thresholds || { green_min: '', yellow_min: '', red_max: '' },
    });
    setShowAddMetric(true);
  };

  const handleSaveMetric = async () => {
    if (!newMetric.name || !newMetric.owner_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingMetric) {
        const updated = await updateScorecardMetric(editingMetric.id, newMetric);
        setMetrics(metrics.map((m) => (m.id === editingMetric.id ? updated : m)));
        toast.success('Metric updated');
      } else {
        await handleAddMetric();
        return;
      }
      setEditingMetric(null);
      setShowAddMetric(false);
    } catch (error) {
      console.error('Error saving metric:', error);
      toast.error('Failed to save metric');
    }
  };

  const handleUpdateValue = async () => {
    if (!selectedMetricForValue || !newValue.value) {
      toast.error('Please enter a value');
      return;
    }

    try {
      const updated = await updateMetricValue(selectedMetricForValue.id, {
        value: parseFloat(newValue.value),
        notes: newValue.notes,
      });
      setMetrics(metrics.map((m) => (m.id === selectedMetricForValue.id ? updated : m)));
      setNewValue({ value: '', notes: '' });
      setShowUpdateValue(false);
      setSelectedMetricForValue(null);
      toast.success('Metric value updated');
    } catch (error) {
      console.error('Error updating value:', error);
      toast.error('Failed to update metric value');
    }
  };

  const handleDeleteMetric = async () => {
    if (!editingMetric) return;

    try {
      await deleteScorecardMetric(editingMetric.id);
      setMetrics(metrics.filter((m) => m.id !== editingMetric.id));
      setShowDeleteConfirm(false);
      setEditingMetric(null);
      toast.success('Metric deleted');
    } catch (error) {
      console.error('Error deleting metric:', error);
      toast.error('Failed to delete metric');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'green':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'yellow':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'red':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Minus className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'green':
        return 'bg-green-900/20 border-green-700';
      case 'yellow':
        return 'bg-yellow-900/20 border-yellow-700';
      case 'red':
        return 'bg-red-900/20 border-red-700';
      default:
        return 'bg-gray-800/30 border-gray-700';
    }
  };

  const ownerName = (ownerId) => {
    const owner = teamUsers.find((u) => u.id === ownerId);
    return owner?.full_name || 'Unknown';
  };

  const filteredMetrics =
    selectedCategory === 'All'
      ? metrics
      : metrics.filter((m) => m.category === selectedCategory);

  const countByStatus = {
    green: metrics.filter((m) => m.status === 'green').length,
    yellow: metrics.filter((m) => m.status === 'yellow').length,
    red: metrics.filter((m) => m.status === 'red').length,
  };

  const groupedMetrics = {};
  filteredMetrics.forEach((metric) => {
    if (!groupedMetrics[metric.category]) {
      groupedMetrics[metric.category] = [];
    }
    groupedMetrics[metric.category].push(metric);
  });

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">EOS Scorecard</h1>
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              disabled={loading}
              variant="outline"
              className="border-gray-700 text-white hover:bg-gray-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => {
                setEditingMetric(null);
                setNewMetric({
                  name: '',
                  description: '',
                  owner_id: '',
                  category: 'Sales',
                  measurement_type: 'number',
                  goal: '',
                  thresholds: { green_min: '', yellow_min: '', red_max: '' },
                });
                setShowAddMetric(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Metric
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-navy-900 border-gray-700 p-6">
            <p className="text-gray-400 text-sm mb-2">Total Metrics</p>
            <p className="text-3xl font-bold text-white">{metrics.length}</p>
          </Card>
          <Card className="bg-green-900/20 border-green-700 p-6">
            <p className="text-gray-400 text-sm mb-2">On Track</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-green-400">{countByStatus.green}</p>
              <CheckCircle2 className="w-6 h-6 text-green-400 mb-1" />
            </div>
          </Card>
          <Card className="bg-yellow-900/20 border-yellow-700 p-6">
            <p className="text-gray-400 text-sm mb-2">Warning</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-yellow-400">{countByStatus.yellow}</p>
              <AlertCircle className="w-6 h-6 text-yellow-400 mb-1" />
            </div>
          </Card>
          <Card className="bg-red-900/20 border-red-700 p-6">
            <p className="text-gray-400 text-sm mb-2">Off Track</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-red-400">{countByStatus.red}</p>
              <XCircle className="w-6 h-6 text-red-400 mb-1" />
            </div>
          </Card>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-3 font-medium transition-all ${
                selectedCategory === cat
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Metrics Grid */}
        {loading ? (
          <div className="text-center text-gray-400">Loading metrics...</div>
        ) : Object.keys(groupedMetrics).length === 0 ? (
          <div className="text-center text-gray-400">No metrics found</div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedMetrics).map(([category, catMetrics]) => (
              <div key={category}>
                <h2 className="text-xl font-semibold text-white mb-4">{category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catMetrics.map((metric) => (
                    <Card
                      key={metric.id}
                      className={`border p-6 cursor-pointer hover:border-blue-500 transition-all ${getStatusColor(metric.status)}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(metric.status)}
                          <div>
                            <h3 className="font-semibold text-white">{metric.name}</h3>
                            <p className="text-xs text-gray-400">{ownerName(metric.owner_id)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleEditMetric(metric)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>

                      {metric.description && (
                        <p className="text-sm text-gray-300 mb-3">{metric.description}</p>
                      )}

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Weekly Actual vs Goal</p>
                          <p className="text-lg font-bold text-white">
                            {metric.actual_value || '-'} / {metric.goal || '-'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(metric.trend)}
                          <button
                            onClick={() => {
                              setSelectedMetricForValue(metric);
                              setNewValue({ value: '', notes: '' });
                              setShowUpdateValue(true);
                            }}
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                          >
                            Update
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Metric Dialog */}
      <Dialog open={showAddMetric} onOpenChange={setShowAddMetric}>
        <DialogContent className="bg-navy-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>{editingMetric ? 'Edit Metric' : 'Add New Metric'}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingMetric ? 'Update the metric details' : 'Create a new scorecard metric'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Metric Name</label>
              <Input
                value={newMetric.name}
                onChange={(e) => setNewMetric({ ...newMetric, name: e.target.value })}
                className="bg-navy-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea
                value={newMetric.description}
                onChange={(e) => setNewMetric({ ...newMetric, description: e.target.value })}
                className="bg-navy-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Owner</label>
              <select
                value={newMetric.owner_id}
                onChange={(e) => setNewMetric({ ...newMetric, owner_id: e.target.value })}
                className="w-full bg-navy-800 border border-gray-700 text-white px-3 py-2 rounded"
              >
                <option value="">Select Owner</option>
                {teamUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={newMetric.category}
                  onChange={(e) => setNewMetric({ ...newMetric, category: e.target.value })}
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
                <label className="block text-sm font-medium mb-1">Goal</label>
                <Input
                  type="number"
                  value={newMetric.goal}
                  onChange={(e) => setNewMetric({ ...newMetric, goal: e.target.value })}
                  className="bg-navy-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <div className="space-y-3 border-t border-gray-700 pt-4">
              <p className="text-sm font-medium">Thresholds</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Green Min</label>
                  <Input
                    type="number"
                    value={newMetric.thresholds.green_min}
                    onChange={(e) =>
                      setNewMetric({
                        ...newMetric,
                        thresholds: { ...newMetric.thresholds, green_min: e.target.value },
                      })
                    }
                    className="bg-navy-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Yellow Min</label>
                  <Input
                    type="number"
                    value={newMetric.thresholds.yellow_min}
                    onChange={(e) =>
                      setNewMetric({
                        ...newMetric,
                        thresholds: { ...newMetric.thresholds, yellow_min: e.target.value },
                      })
                    }
                    className="bg-navy-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Red Max</label>
                  <Input
                    type="number"
                    value={newMetric.thresholds.red_max}
                    onChange={(e) =>
                      setNewMetric({
                        ...newMetric,
                        thresholds: { ...newMetric.thresholds, red_max: e.target.value },
                      })
                    }
                    className="bg-navy-800 border-gray-700 text-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              {editingMetric && (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="destructive"
                  className="bg-red-900 hover:bg-red-800"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
              <Button
                onClick={() => setShowAddMetric(false)}
                variant="outline"
                className="border-gray-700 text-white hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={editingMetric ? handleSaveMetric : handleAddMetric}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingMetric ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Value Dialog */}
      <Dialog open={showUpdateValue} onOpenChange={setShowUpdateValue}>
        <DialogContent className="bg-navy-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Update Metric Value</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedMetricForValue?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Actual Value</label>
              <Input
                type="number"
                value={newValue.value}
                onChange={(e) => setNewValue({ ...newValue, value: e.target.value })}
                className="bg-navy-800 border-gray-700 text-white"
                placeholder="Enter value"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <Textarea
                value={newValue.notes}
                onChange={(e) => setNewValue({ ...newValue, notes: e.target.value })}
                className="bg-navy-800 border-gray-700 text-white"
                placeholder="Add notes (optional)"
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button
                onClick={() => setShowUpdateValue(false)}
                variant="outline"
                className="border-gray-700 text-white hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateValue}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-navy-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete Metric?</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete "{editingMetric?.name}"? This action cannot be undone.
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
              onClick={handleDeleteMetric}
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
