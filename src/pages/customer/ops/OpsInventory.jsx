import React, { useState, useEffect } from 'react';
import { useOrg } from '../../../lib/OrgContext';
import {
  fetchInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  createInventoryTransaction,
  fetchInventoryTransactions,
} from '../../../lib/customerOpsService';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import {
  Plus,
  Search,
  Grid,
  List,
  AlertTriangle,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Calendar,
  Package,
  DollarSign,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['All', 'Material', 'Equipment', 'Tool', 'Vehicle', 'Safety', 'Uniform', 'Consumable'];
const UNITS = ['each', 'box', 'case', 'roll', 'sqft', 'lnft', 'gallon', 'pound', 'bag', 'pallet', 'bundle', 'sheet', 'pair', 'set'];
const CONDITIONS = ['new', 'good', 'fair', 'needs-repair', 'damaged'];
const TRANSACTION_TYPES = ['Purchase', 'Use', 'Return', 'Adjustment', 'Transfer', 'Waste', 'Count'];

export default function OpsInventory() {
  const { currentOrg } = useOrg();
  const [viewMode, setViewMode] = useState('table');
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showLowStockSection, setShowLowStockSection] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState(null);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category: 'Material',
    quantity: 0,
    minQuantity: 5,
    maxQuantity: 100,
    unit: 'each',
    unitCost: 0,
    sellPrice: 0,
    location: '',
    serialNumber: '',
    condition: 'good',
    lastInspected: '',
    warrantyExpiry: '',
    supplier: {
      name: '',
      contact: '',
      partNumber: '',
      reorderUrl: '',
    },
  });

  const [adjustData, setAdjustData] = useState({
    type: 'Purchase',
    quantity: 0,
    notes: '',
  });

  useEffect(() => {
    loadInventory();
  }, [currentOrg]);

  const loadInventory = async () => {
    try {
      if (!currentOrg?.id) return;
      setLoading(true);
      const data = await fetchInventory(currentOrg.id);
      setInventory(data || []);
    } catch (error) {
      console.error('Failed to load inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (itemId) => {
    try {
      const data = await fetchInventoryTransactions(itemId);
      setTransactions(data || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      toast.error('Failed to load transaction history');
    }
  };

  const handleCreateItem = async () => {
    try {
      if (!currentOrg?.id || !formData.name || !formData.sku) {
        toast.error('Name and SKU are required');
        return;
      }

      if (editingItem) {
        await updateInventoryItem(editingItem.id, {
          ...formData,
          orgId: currentOrg.id,
        });
        toast.success('Item updated successfully');
      } else {
        await createInventoryItem({
          ...formData,
          orgId: currentOrg.id,
        });
        toast.success('Item created successfully');
      }

      setShowCreateDialog(false);
      setEditingItem(null);
      setFormData({
        name: '',
        sku: '',
        description: '',
        category: 'Material',
        quantity: 0,
        minQuantity: 5,
        maxQuantity: 100,
        unit: 'each',
        unitCost: 0,
        sellPrice: 0,
        location: '',
        serialNumber: '',
        condition: 'good',
        lastInspected: '',
        warrantyExpiry: '',
        supplier: {
          name: '',
          contact: '',
          partNumber: '',
          reorderUrl: '',
        },
      });
      await loadInventory();
    } catch (error) {
      console.error('Failed to save item:', error);
      toast.error('Failed to save item');
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await deleteInventoryItem(itemId);
      toast.success('Item deleted successfully');
      await loadInventory();
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleAdjustStock = async () => {
    try {
      if (!selectedItemForAdjust?.id || adjustData.quantity === 0) {
        toast.error('Please enter a valid quantity');
        return;
      }

      await createInventoryTransaction({
        itemId: selectedItemForAdjust.id,
        type: adjustData.type,
        quantity: adjustData.quantity,
        notes: adjustData.notes,
      });

      toast.success(`Stock adjusted successfully`);
      setShowAdjustDialog(false);
      setAdjustData({ type: 'Purchase', quantity: 0, notes: '' });
      await loadInventory();
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      toast.error('Failed to adjust stock');
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setFormData(item);
    setShowCreateDialog(true);
  };

  const handleOpenHistory = async (item) => {
    setSelectedItemForHistory(item);
    await loadTransactions(item.id);
    setShowHistoryDialog(true);
  };

  const filteredInventory = inventory
    .filter((item) => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      const aIsLow = a.quantity <= a.minQuantity;
      const bIsLow = b.quantity <= b.minQuantity;
      if (aIsLow && !bIsLow) return -1;
      if (!aIsLow && bIsLow) return 1;
      return 0;
    });

  const lowStockItems = inventory.filter((item) => item.quantity <= item.minQuantity);
  const categoryCounts = CATEGORIES.map((cat) => ({
    name: cat,
    count: cat === 'All' ? inventory.length : inventory.filter((i) => i.category === cat).length,
  }));

  const totalValue = inventory.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  const getStockStatus = (item) => {
    if (item.quantity <= item.minQuantity) return 'critical';
    if (item.quantity <= item.minQuantity * 1.5) return 'warning';
    return 'good';
  };

  const getStockColor = (status) => {
    switch (status) {
      case 'critical':
        return 'from-red-500 to-red-600';
      case 'warning':
        return 'from-yellow-500 to-yellow-600';
      default:
        return 'from-green-500 to-green-600';
    }
  };

  const getConditionColor = (condition) => {
    switch (condition) {
      case 'new':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'good':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'fair':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'needs-repair':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'damaged':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-navy-900">
        <p className="text-white">Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Inventory Management</h1>
            <p className="text-white/60 mt-1">Manage materials, equipment, and assets</p>
          </div>
          <Button
            onClick={() => {
              setEditingItem(null);
              setFormData({
                name: '',
                sku: '',
                description: '',
                category: 'Material',
                quantity: 0,
                minQuantity: 5,
                maxQuantity: 100,
                unit: 'each',
                unitCost: 0,
                sellPrice: 0,
                location: '',
                serialNumber: '',
                condition: 'good',
                lastInspected: '',
                warrantyExpiry: '',
                supplier: {
                  name: '',
                  contact: '',
                  partNumber: '',
                  reorderUrl: '',
                },
              });
              setShowCreateDialog(true);
            }}
            className="gap-2 bg-sky-500 hover:bg-sky-600 text-black font-semibold"
          >
            <Plus size={18} />
            Add Item
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-navy-800 border-white/10 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm font-medium">Total Items</p>
                <p className="text-3xl font-bold text-white mt-2">{inventory.length}</p>
              </div>
              <Package className="text-sky-500" size={24} />
            </div>
          </Card>
          <Card className="bg-navy-800 border-white/10 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm font-medium">Total Value</p>
                <p className="text-3xl font-bold text-white mt-2">${totalValue.toFixed(2)}</p>
              </div>
              <DollarSign className="text-sky-500" size={24} />
            </div>
          </Card>
          <Card className="bg-navy-800 border-white/10 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm font-medium">Low Stock Alerts</p>
                <p className="text-3xl font-bold text-white mt-2">{lowStockItems.length}</p>
              </div>
              <AlertTriangle className="text-red-500" size={24} />
            </div>
          </Card>
          <Card className="bg-navy-800 border-white/10 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm font-medium">Categories in Use</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {categoryCounts.filter((c) => c.count > 0).length}
                </p>
              </div>
              <TrendingDown className="text-sky-500" size={24} />
            </div>
          </Card>
        </div>

        {/* Low Stock Alert Section */}
        {lowStockItems.length > 0 && (
          <Card className="bg-red-500/10 border-red-500/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-500" size={20} />
                <div>
                  <p className="font-semibold text-white">
                    {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below minimum stock
                  </p>
                  <p className="text-white/60 text-sm">
                    {lowStockItems.map((item) => item.name).join(', ')}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLowStockSection(!showLowStockSection)}
              >
                {showLowStockSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </Button>
            </div>
          </Card>
        )}

        {/* Category Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categoryCounts.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                selectedCategory === cat.name
                  ? 'bg-sky-500 text-black'
                  : 'bg-navy-800 text-white/70 border border-white/10 hover:bg-navy-700'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* Search Bar & View Mode Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <Input
              placeholder="Search by name, SKU, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-navy-800 border-white/10 text-white placeholder-white/40"
            />
          </div>
          <div className="flex gap-2 bg-navy-800 rounded-lg p-1 border border-white/10">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-sky-500/20 text-sky-400'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-sky-500/20 text-sky-400'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              <Grid size={18} />
            </button>
          </div>
        </div>

        {/* Inventory Content */}
        {filteredInventory.length === 0 ? (
          <Card className="bg-navy-800 border-white/10 p-12 text-center">
            <Package size={48} className="mx-auto text-white/30 mb-4" />
            <p className="text-white/60">No items found. Create your first inventory item to get started.</p>
          </Card>
        ) : viewMode === 'table' ? (
          /* Table View */
          <Card className="bg-navy-800 border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-navy-900/50 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-white/60 text-sm font-semibold">Name</th>
                    <th className="px-6 py-3 text-left text-white/60 text-sm font-semibold">SKU</th>
                    <th className="px-6 py-3 text-left text-white/60 text-sm font-semibold">Category</th>
                    <th className="px-6 py-3 text-left text-white/60 text-sm font-semibold">Stock Level</th>
                    <th className="px-6 py-3 text-left text-white/60 text-sm font-semibold">Unit</th>
                    <th className="px-6 py-3 text-left text-white/60 text-sm font-semibold">Unit Cost</th>
                    <th className="px-6 py-3 text-left text-white/60 text-sm font-semibold">Total Value</th>
                    <th className="px-6 py-3 text-left text-white/60 text-sm font-semibold">Condition</th>
                    <th className="px-6 py-3 text-left text-white/60 text-sm font-semibold">Location</th>
                    <th className="px-6 py-3 text-left text-white/60 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredInventory.map((item) => {
                    const status = getStockStatus(item);
                    const isLow = status === 'critical';
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-white/5 transition-colors ${
                          isLow ? 'bg-red-500/5 border-l-4 border-l-red-500' : ''
                        }`}
                      >
                        <td className="px-6 py-4 text-white font-medium">{item.name}</td>
                        <td className="px-6 py-4 text-white/60 text-sm">{item.sku}</td>
                        <td className="px-6 py-4">
                          <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30">
                            {item.category}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-navy-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${getStockColor(status)}`}
                                style={{
                                  width: `${Math.min(
                                    (item.quantity / item.maxQuantity) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className={isLow ? 'text-red-400 font-semibold' : 'text-white/70 text-sm'}>
                              {item.quantity}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-white/60 text-sm">{item.unit}</td>
                        <td className="px-6 py-4 text-white/60 text-sm">${item.unitCost.toFixed(2)}</td>
                        <td className="px-6 py-4 text-white font-semibold">
                          ${(item.quantity * item.unitCost).toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getConditionColor(
                              item.condition
                            )}`}
                          >
                            {item.condition}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white/60 text-sm">{item.location}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedItemForAdjust(item);
                                setShowAdjustDialog(true);
                              }}
                              className="p-2 hover:bg-sky-500/20 rounded text-sky-400 transition-colors"
                              title="Adjust Stock"
                            >
                              <ArrowUpRight size={16} />
                            </button>
                            <button
                              onClick={() => handleOpenHistory(item)}
                              className="p-2 hover:bg-blue-500/20 rounded text-blue-400 transition-colors"
                              title="View History"
                            >
                              <Calendar size={16} />
                            </button>
                            <button
                              onClick={() => handleEditItem(item)}
                              className="p-2 hover:bg-white/10 rounded text-white/60 hover:text-white transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Are you sure you want to delete ${item.name}? This action cannot be undone.`
                                  )
                                ) {
                                  handleDeleteItem(item.id);
                                }
                              }}
                              className="p-2 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInventory.map((item) => {
              const status = getStockStatus(item);
              const isLow = status === 'critical';
              return (
                <Card
                  key={item.id}
                  className={`bg-navy-800 border-white/10 p-4 hover:border-white/20 transition-all ${
                    isLow ? 'border-red-500/50 bg-red-500/5 shadow-lg shadow-red-500/20' : ''
                  }`}
                >
                  {/* Image Placeholder */}
                  <div className="w-full h-40 bg-navy-900 rounded-lg flex items-center justify-center border border-white/10 mb-3">
                    <Package className="text-white/30" size={40} />
                  </div>

                  {/* Item Info */}
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold text-white text-lg">{item.name}</p>
                      <p className="text-white/60 text-xs">SKU: {item.sku}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs">
                        {item.category}
                      </Badge>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded border ${getConditionColor(
                          item.condition
                        )}`}
                      >
                        {item.condition}
                      </span>
                    </div>

                    {/* Stock Level Bar */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-white/60 text-xs">Stock Level</span>
                        <span
                          className={`text-sm font-semibold ${
                            isLow ? 'text-red-400' : 'text-white/80'
                          }`}
                        >
                          {item.quantity} / {item.maxQuantity}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-navy-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${getStockColor(status)}`}
                          style={{
                            width: `${Math.min((item.quantity / item.maxQuantity) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      {isLow && (
                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle size={12} /> Below minimum ({item.minQuantity})
                        </p>
                      )}
                    </div>

                    {/* Cost Info */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-navy-900/50 rounded p-2">
                        <p className="text-white/60">Unit Cost</p>
                        <p className="text-white font-semibold">${item.unitCost.toFixed(2)}</p>
                      </div>
                      <div className="bg-navy-900/50 rounded p-2">
                        <p className="text-white/60">Total Value</p>
                        <p className="text-white font-semibold">
                          ${(item.quantity * item.unitCost).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Location */}
                    <p className="text-white/60 text-xs">Location: {item.location || 'Not specified'}</p>

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedItemForAdjust(item);
                          setShowAdjustDialog(true);
                        }}
                        className="flex-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30"
                      >
                        <ArrowUpRight size={14} />
                        Adjust
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleOpenHistory(item)}
                        variant="outline"
                        className="flex-1 border-white/10 text-white/60 hover:text-white"
                      >
                        <Calendar size={14} />
                        History
                      </Button>
                      <button
                        onClick={() => handleEditItem(item)}
                        className="p-2 border border-white/10 rounded hover:bg-white/5 text-white/60 hover:text-white transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to delete ${item.name}? This action cannot be undone.`
                            )
                          ) {
                            handleDeleteItem(item.id);
                          }
                        }}
                        className="p-2 border border-white/10 rounded hover:bg-red-500/10 text-white/60 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Item Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-navy-800 border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingItem ? 'Edit Inventory Item' : 'Create Inventory Item'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="space-y-3">
              <p className="text-white/60 text-sm font-semibold">Basic Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1">Name*</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                    placeholder="Item name"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1">SKU*</label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                    placeholder="SKU code"
                  />
                </div>
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-navy-900 border-white/10 text-white placeholder-white/40 resize-none"
                  placeholder="Item description"
                  rows={2}
                />
              </div>
            </div>

            {/* Category & Condition */}
            <div className="space-y-3">
              <p className="text-white/60 text-sm font-semibold">Classification</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-navy-900 border border-white/10 text-white rounded px-3 py-2 text-sm"
                  >
                    {['Material', 'Equipment', 'Tool', 'Vehicle', 'Safety', 'Uniform', 'Consumable'].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1">Condition</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    className="w-full bg-navy-900 border border-white/10 text-white rounded px-3 py-2 text-sm"
                  >
                    {CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond.charAt(0).toUpperCase() + cond.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Quantity & Units */}
            <div className="space-y-3">
              <p className="text-white/60 text-sm font-semibold">Inventory Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1">Quantity</label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    className="bg-navy-900 border-white/10 text-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-navy-900 border border-white/10 text-white rounded px-3 py-2 text-sm"
                  >
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1">Min Quantity (Reorder Point)</label>
                  <Input
                    type="number"
                    value={formData.minQuantity}
                    onChange={(e) => setFormData({ ...formData, minQuantity: parseFloat(e.target.value) || 0 })}
                    className="bg-navy-900 border-white/10 text-white"
                    placeholder="5"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1">Max Quantity</label>
                  <Input
                    type="number"
                    value={formData.maxQuantity}
                    onChange={(e) => setFormData({ ...formData, maxQuantity: parseFloat(e.target.value) || 0 })}
                    className="bg-navy-900 border-white/10 text-white"
                    placeholder="100"
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-3">
              <p className="text-white/60 text-sm font-semibold">Pricing</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1">Unit Cost</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                    className="bg-navy-900 border-white/10 text-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1">Sell Price (Optional)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sellPrice}
                    onChange={(e) => setFormData({ ...formData, sellPrice: parseFloat(e.target.value) || 0 })}
                    className="bg-navy-900 border-white/10 text-white"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Storage & Serial */}
            <div className="space-y-3">
              <p className="text-white/60 text-sm font-semibold">Storage & Identification</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1">Location</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                    placeholder="Warehouse, Aisle, Bin, etc."
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1">Serial Number</label>
                  <Input
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                    placeholder="If applicable"
                  />
                </div>
              </div>
            </div>

            {/* Maintenance Dates */}
            <div className="space-y-3">
              <p className="text-white/60 text-sm font-semibold">Maintenance & Warranty</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1">Last Inspected</label>
                  <Input
                    type="date"
                    value={formData.lastInspected}
                    onChange={(e) => setFormData({ ...formData, lastInspected: e.target.value })}
                    className="bg-navy-900 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1">Warranty Expiry</label>
                  <Input
                    type="date"
                    value={formData.warrantyExpiry}
                    onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                    className="bg-navy-900 border-white/10 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Supplier Info */}
            <div className="space-y-3">
              <p className="text-white/60 text-sm font-semibold">Supplier Information</p>
              <div>
                <label className="block text-white/60 text-xs mb-1">Supplier Name</label>
                <Input
                  value={formData.supplier.name}
                  onChange={(e) => setFormData({
                    ...formData,
                    supplier: { ...formData.supplier, name: e.target.value },
                  })}
                  className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                  placeholder="Supplier name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 text-xs mb-1">Contact</label>
                  <Input
                    value={formData.supplier.contact}
                    onChange={(e) => setFormData({
                      ...formData,
                      supplier: { ...formData.supplier, contact: e.target.value },
                    })}
                    className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                    placeholder="Email or phone"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1">Part Number</label>
                  <Input
                    value={formData.supplier.partNumber}
                    onChange={(e) => setFormData({
                      ...formData,
                      supplier: { ...formData.supplier, partNumber: e.target.value },
                    })}
                    className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                    placeholder="Supplier part number"
                  />
                </div>
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">Reorder URL</label>
                <Input
                  value={formData.supplier.reorderUrl}
                  onChange={(e) => setFormData({
                    ...formData,
                    supplier: { ...formData.supplier, reorderUrl: e.target.value },
                  })}
                  className="bg-navy-900 border-white/10 text-white placeholder-white/40"
                  placeholder="Direct order link"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateItem}
              className="bg-sky-500 hover:bg-sky-600 text-black font-semibold"
            >
              {editingItem ? 'Update Item' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="bg-navy-800 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              Adjust Stock: {selectedItemForAdjust?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-white/60 text-xs mb-2 font-semibold">Transaction Type</label>
              <select
                value={adjustData.type}
                onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value })}
                className="w-full bg-navy-900 border border-white/10 text-white rounded px-3 py-2"
              >
                {TRANSACTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white/60 text-xs mb-2 font-semibold">
                Quantity (positive to add, negative to remove)
              </label>
              <Input
                type="number"
                value={adjustData.quantity}
                onChange={(e) => setAdjustData({ ...adjustData, quantity: parseFloat(e.target.value) || 0 })}
                className="bg-navy-900 border-white/10 text-white"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-white/60 text-xs mb-2 font-semibold">Notes</label>
              <Textarea
                value={adjustData.notes}
                onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
                className="bg-navy-900 border-white/10 text-white placeholder-white/40 resize-none"
                placeholder="Additional notes about this adjustment"
                rows={3}
              />
            </div>

            <div className="bg-navy-900/50 rounded p-3 border border-white/10">
              <p className="text-white/60 text-xs mb-1">Current Stock</p>
              <p className="text-2xl font-bold text-white">
                {selectedItemForAdjust?.quantity} {selectedItemForAdjust?.unit}
              </p>
              <p className="text-sky-400 text-xs mt-2">
                New Stock: {(selectedItemForAdjust?.quantity || 0) + adjustData.quantity}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustStock}
              className="bg-sky-500 hover:bg-sky-600 text-black font-semibold"
            >
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="bg-navy-800 border-white/10 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              Transaction History: {selectedItemForHistory?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {transactions.length === 0 ? (
              <p className="text-white/60 text-sm">No transactions yet.</p>
            ) : (
              transactions.map((tx, idx) => (
                <div
                  key={idx}
                  className="bg-navy-900/50 rounded p-3 border border-white/10 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {tx.quantity > 0 ? (
                        <ArrowUpRight className="text-green-400" size={16} />
                      ) : (
                        <ArrowDownLeft className="text-red-400" size={16} />
                      )}
                      <div>
                        <p className="font-semibold text-white">{tx.type}</p>
                        <p className="text-white/60 text-xs">
                          {new Date(tx.createdAt).toLocaleDateString()} at{' '}
                          {new Date(tx.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`font-bold text-lg ${
                        tx.quantity > 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                    </p>
                  </div>
                  {tx.notes && (
                    <p className="text-white/60 text-xs italic">
                      {tx.notes}
                    </p>
                  )}
                  {tx.performedBy && (
                    <p className="text-white/40 text-xs">
                      By: {tx.performedBy}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
