import React, { useState, useEffect } from 'react';
import { useOrg } from '../../../lib/OrgContext';
import {
  fetchMeasurements,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
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
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  ChevronDown,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

// Template presets for each measurement type
const TEMPLATE_PRESETS = {
  roofing: {
    label: 'Roofing',
    measurements: [
      { label: 'Ridge Length', unit: 'lnft' },
      { label: 'Hip Length', unit: 'lnft' },
      { label: 'Valley Length', unit: 'lnft' },
      { label: 'Eave Length', unit: 'lnft' },
      { label: 'Rake Length', unit: 'lnft' },
      { label: 'Roof Area', unit: 'sqft' },
      { label: 'Pitch', unit: 'in' },
      { label: 'Waste Factor', unit: '%' },
    ],
  },
  siding: {
    label: 'Siding',
    measurements: [
      { label: 'Wall Height', unit: 'ft' },
      { label: 'Wall Width', unit: 'ft' },
      { label: 'Window Openings', unit: 'units' },
      { label: 'Door Openings', unit: 'units' },
      { label: 'Gable Area', unit: 'sqft' },
      { label: 'Soffit Length', unit: 'lnft' },
      { label: 'Fascia Length', unit: 'lnft' },
    ],
  },
  gutters: {
    label: 'Gutters',
    measurements: [
      { label: 'Run Length', unit: 'lnft' },
      { label: 'Downspout Count', unit: 'units' },
      { label: 'Corner Count', unit: 'units' },
      { label: 'End Caps', unit: 'units' },
      { label: 'Drop Outlet Locations', unit: 'units' },
    ],
  },
  windows: {
    label: 'Windows',
    measurements: [
      { label: 'Width', unit: 'in' },
      { label: 'Height', unit: 'in' },
      { label: 'Frame Depth', unit: 'in' },
      { label: 'Sill to Floor', unit: 'in' },
      { label: 'Rough Opening W', unit: 'in' },
      { label: 'Rough Opening H', unit: 'in' },
    ],
  },
  painting: {
    label: 'Painting',
    measurements: [
      { label: 'Wall Sqft', unit: 'sqft' },
      { label: 'Ceiling Sqft', unit: 'sqft' },
      { label: 'Trim Lnft', unit: 'lnft' },
      { label: 'Door Count', unit: 'units' },
      { label: 'Window Count', unit: 'units' },
      { label: 'Coats Needed', unit: 'units' },
    ],
  },
  flooring: {
    label: 'Flooring',
    measurements: [
      { label: 'Room Length', unit: 'ft' },
      { label: 'Room Width', unit: 'ft' },
      { label: 'Closet Area', unit: 'sqft' },
      { label: 'Hallway Area', unit: 'sqft' },
      { label: 'Transition Strips', unit: 'lnft' },
      { label: 'Waste %', unit: '%' },
    ],
  },
  fencing: {
    label: 'Fencing',
    measurements: [
      { label: 'Total Run', unit: 'lnft' },
      { label: 'Gate Width', unit: 'ft' },
      { label: 'Post Count', unit: 'units' },
      { label: 'Panel Count', unit: 'units' },
      { label: 'Post Height', unit: 'ft' },
      { label: 'Rail Length', unit: 'lnft' },
    ],
  },
  concrete: {
    label: 'Concrete',
    measurements: [
      { label: 'Length', unit: 'ft' },
      { label: 'Width', unit: 'ft' },
      { label: 'Depth', unit: 'in' },
      { label: 'Volume', unit: 'cubic_yards' },
      { label: 'Rebar Count', unit: 'units' },
      { label: 'Form Length', unit: 'lnft' },
    ],
  },
  deck: {
    label: 'Deck',
    measurements: [
      { label: 'Deck Length', unit: 'ft' },
      { label: 'Deck Width', unit: 'ft' },
      { label: 'Joist Spacing', unit: 'in' },
      { label: 'Post Count', unit: 'units' },
      { label: 'Railing Length', unit: 'lnft' },
      { label: 'Steps Count', unit: 'units' },
      { label: 'Board Count', unit: 'units' },
    ],
  },
};

// Unit display mapping
const UNIT_OPTIONS = [
  { value: 'sqft', label: 'Square Feet' },
  { value: 'lnft', label: 'Linear Feet' },
  { value: 'ft', label: 'Feet' },
  { value: 'in', label: 'Inches' },
  { value: 'm', label: 'Meters' },
  { value: 'cm', label: 'Centimeters' },
  { value: 'yards', label: 'Yards' },
  { value: 'cubic_yards', label: 'Cubic Yards' },
  { value: 'units', label: 'Units' },
  { value: '%', label: 'Percent' },
];

// Status color mapping
const STATUS_COLORS = {
  draft: 'bg-gray-600 text-white',
  in_progress: 'bg-yellow-600 text-white',
  completed: 'bg-green-600 text-white',
  approved: 'bg-sky-500 text-white',
  revised: 'bg-orange-600 text-white',
};

const STATUS_LABELS = {
  draft: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  approved: 'Approved',
  revised: 'Revised',
};

// Measurement row component for dialog builder
function MeasurementRow({
  measurement,
  index,
  onUpdate,
  onRemove,
  templateType,
}) {
  const handleAreaCalculate = (e) => {
    if (e.key === 'Enter' && measurement.length && measurement.width) {
      const area = parseFloat(measurement.length) * parseFloat(measurement.width);
      onUpdate(index, { ...measurement, area: area.toFixed(2) });
    }
  };

  return (
    <div className="space-y-3 p-3 bg-navy-800 rounded-lg border border-white/10">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold text-white/70">Label</label>
          <Input
            placeholder="e.g., Ridge Length"
            value={measurement.label || ''}
            onChange={(e) =>
              onUpdate(index, { ...measurement, label: e.target.value })
            }
            className="bg-navy-700 text-white border-white/20 placeholder-white/30"
          />
        </div>
        <div className="w-24">
          <label className="text-xs font-semibold text-white/70">Unit</label>
          <select
            value={measurement.unit || ''}
            onChange={(e) =>
              onUpdate(index, { ...measurement, unit: e.target.value })
            }
            className="w-full px-2 py-2 bg-navy-700 text-white border border-white/20 rounded text-sm"
          >
            <option value="">Select</option>
            {UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-white/70">Value</label>
          <Input
            type="number"
            placeholder="Enter value"
            value={measurement.value || ''}
            onChange={(e) =>
              onUpdate(index, { ...measurement, value: e.target.value })
            }
            className="bg-navy-700 text-white border-white/20 placeholder-white/30"
          />
        </div>
        {measurement.unit === 'sqft' && (
          <>
            <div className="w-20">
              <label className="text-xs font-semibold text-white/70">L</label>
              <Input
                type="number"
                placeholder="Length"
                value={measurement.length || ''}
                onChange={(e) =>
                  onUpdate(index, { ...measurement, length: e.target.value })
                }
                onKeyDown={handleAreaCalculate}
                className="bg-navy-700 text-white border-white/20"
              />
            </div>
            <div className="w-20">
              <label className="text-xs font-semibold text-white/70">W</label>
              <Input
                type="number"
                placeholder="Width"
                value={measurement.width || ''}
                onChange={(e) =>
                  onUpdate(index, { ...measurement, width: e.target.value })
                }
                onKeyDown={handleAreaCalculate}
                className="bg-navy-700 text-white border-white/20"
              />
            </div>
          </>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-white/70">Notes</label>
        <Input
          placeholder="Optional notes"
          value={measurement.notes || ''}
          onChange={(e) =>
            onUpdate(index, { ...measurement, notes: e.target.value })
          }
          className="bg-navy-700 text-white border-white/20 placeholder-white/30"
        />
      </div>
    </div>
  );
}

// Main component
export default function OpsMeasurements() {
  const { currentOrg } = useOrg();
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    template_type: 'custom',
    address: '',
    status: 'draft',
    measurements: [],
    site_conditions: '',
    notes: '',
  });

  // Load measurements on mount
  useEffect(() => {
    loadMeasurements();
  }, [currentOrg?.id]);

  const loadMeasurements = async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      const data = await fetchMeasurements(currentOrg.id);
      setMeasurements(data || []);
    } catch (error) {
      console.error('Failed to load measurements:', error);
      toast.error('Failed to load measurements');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (templateType) => {
    if (templateType === 'custom') {
      setFormData((prev) => ({
        ...prev,
        template_type: 'custom',
        measurements: [],
      }));
    } else {
      const preset = TEMPLATE_PRESETS[templateType];
      if (preset) {
        setFormData((prev) => ({
          ...prev,
          template_type: templateType,
          measurements: preset.measurements.map((m) => ({
            label: m.label,
            unit: m.unit,
            value: '',
            notes: '',
          })),
        }));
      }
    }
  };

  const handleMeasurementUpdate = (index, updated) => {
    const newMeasurements = [...formData.measurements];
    newMeasurements[index] = updated;
    setFormData((prev) => ({
      ...prev,
      measurements: newMeasurements,
    }));
  };

  const handleMeasurementRemove = (index) => {
    const newMeasurements = formData.measurements.filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      measurements: newMeasurements,
    }));
  };

  const handleAddMeasurement = () => {
    setFormData((prev) => ({
      ...prev,
      measurements: [
        ...prev.measurements,
        { label: '', unit: 'sqft', value: '', notes: '' },
      ],
    }));
  };

  const calculateSummary = () => {
    const summary = {
      total_sqft: 0,
      total_lnft: 0,
      measurement_count: formData.measurements.length,
    };

    formData.measurements.forEach((m) => {
      if (m.value) {
        if (m.unit === 'sqft') {
          summary.total_sqft += parseFloat(m.value) || 0;
        } else if (m.unit === 'lnft') {
          summary.total_lnft += parseFloat(m.value) || 0;
        }
      }
    });

    return summary;
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a measurement title');
      return;
    }
    if (formData.measurements.length === 0) {
      toast.error('Please add at least one measurement');
      return;
    }

    try {
      const payload = {
        ...formData,
        org_id: currentOrg.id,
        summary: calculateSummary(),
      };

      if (editingId) {
        await updateMeasurement(editingId, payload);
        toast.success('Measurement updated');
      } else {
        await createMeasurement(payload);
        toast.success('Measurement created');
      }

      await loadMeasurements();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save measurement:', error);
      toast.error('Failed to save measurement');
    }
  };

  const handleEdit = (measurement) => {
    setEditingId(measurement.id);
    setFormData({
      title: measurement.title,
      template_type: measurement.template_type,
      address: measurement.address,
      status: measurement.status,
      measurements: measurement.measurements || [],
      site_conditions: measurement.site_conditions || '',
      notes: measurement.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this measurement?')) {
      try {
        await deleteMeasurement(id);
        toast.success('Measurement deleted');
        await loadMeasurements();
      } catch (error) {
        console.error('Failed to delete measurement:', error);
        toast.error('Failed to delete measurement');
      }
    }
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingId(null);
    setFormData({
      title: '',
      template_type: 'custom',
      address: '',
      status: 'draft',
      measurements: [],
      site_conditions: '',
      notes: '',
    });
  };

  // Calculate statistics
  const stats = {
    total: measurements.length,
    completed: measurements.filter((m) => m.status === 'completed').length,
    pendingApproval: measurements.filter((m) => m.status === 'in_progress').length,
    byType: {},
  };

  measurements.forEach((m) => {
    stats.byType[m.template_type] = (stats.byType[m.template_type] || 0) + 1;
  });

  const topType = Object.entries(stats.byType).sort((a, b) => b[1] - a[1])[0];
  const topTypeLabel = topType
    ? TEMPLATE_PRESETS[topType[0]]?.label || topType[0]
    : 'N/A';

  // Filter measurements
  const filteredMeasurements =
    selectedTemplate === 'all'
      ? measurements
      : measurements.filter((m) => m.template_type === selectedTemplate);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-white/60">Loading measurements...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-navy-900 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Project Measurements</h1>
          <p className="text-white/60 text-sm mt-1">
            Professional measurement templates for home services estimates
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setFormData({
              title: '',
              template_type: 'custom',
              address: '',
              status: 'draft',
              measurements: [],
              site_conditions: '',
              notes: '',
            });
            setIsCreateDialogOpen(true);
          }}
          className="bg-sky-500 hover:bg-sky-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Measurement
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-navy-800 border-white/10 p-4">
          <div className="text-white/60 text-xs font-semibold uppercase tracking-wider">
            Total Measurements
          </div>
          <div className="text-3xl font-bold text-white mt-2">{stats.total}</div>
        </Card>
        <Card className="bg-navy-800 border-white/10 p-4">
          <div className="text-white/60 text-xs font-semibold uppercase tracking-wider">
            Completed
          </div>
          <div className="text-3xl font-bold text-green-400 mt-2">
            {stats.completed}
          </div>
        </Card>
        <Card className="bg-navy-800 border-white/10 p-4">
          <div className="text-white/60 text-xs font-semibold uppercase tracking-wider">
            Pending Approval
          </div>
          <div className="text-3xl font-bold text-yellow-400 mt-2">
            {stats.pendingApproval}
          </div>
        </Card>
        <Card className="bg-navy-800 border-white/10 p-4">
          <div className="text-white/60 text-xs font-semibold uppercase tracking-wider">
            Top Type
          </div>
          <div className="text-lg font-bold text-sky-400 mt-2">{topTypeLabel}</div>
        </Card>
      </div>

      {/* Template Filter Chips */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...Object.keys(TEMPLATE_PRESETS)].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedTemplate(type)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              selectedTemplate === type
                ? 'bg-sky-500 text-white'
                : 'bg-navy-800 text-white/70 hover:text-white border border-white/20'
            }`}
          >
            {type === 'all'
              ? 'All'
              : TEMPLATE_PRESETS[type]?.label || type}
          </button>
        ))}
      </div>

      {/* Measurements List */}
      <div className="space-y-3">
        {filteredMeasurements.length === 0 ? (
          <Card className="bg-navy-800 border-white/10 p-8 text-center">
            <AlertCircle className="w-8 h-8 text-white/40 mx-auto mb-3" />
            <p className="text-white/60">No measurements yet</p>
          </Card>
        ) : (
          filteredMeasurements.map((measurement) => (
            <Card
              key={measurement.id}
              className="bg-navy-800 border-white/10 p-4 hover:bg-navy-700/50 transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-white font-semibold">{measurement.title}</h3>
                    <Badge className={`text-xs ${STATUS_COLORS[measurement.status]}`}>
                      {STATUS_LABELS[measurement.status]}
                    </Badge>
                    <Badge className="text-xs bg-navy-600 text-sky-300">
                      {TEMPLATE_PRESETS[measurement.template_type]?.label ||
                        'Custom'}
                    </Badge>
                  </div>

                  <p className="text-white/70 text-sm mb-2">{measurement.address}</p>

                  <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                    {measurement.summary?.total_sqft > 0 && (
                      <div>
                        <span className="text-white/60">Total Sqft:</span>
                        <span className="text-white ml-1 font-medium">
                          {measurement.summary.total_sqft.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {measurement.summary?.total_lnft > 0 && (
                      <div>
                        <span className="text-white/60">Total Lnft:</span>
                        <span className="text-white ml-1 font-medium">
                          {measurement.summary.total_lnft.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-white/60">Measurements:</span>
                      <span className="text-white ml-1 font-medium">
                        {measurement.summary?.measurement_count || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/60">Date:</span>
                      <span className="text-white ml-1 font-medium">
                        {new Date(measurement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(measurement)}
                    className="border-white/20 text-white hover:bg-sky-500/20"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(measurement.id)}
                    className="border-white/20 text-red-400 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
        }}
      >
        <DialogContent className="bg-navy-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Measurement' : 'Create Measurement'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">
                Measurement Title
              </label>
              <Input
                placeholder="e.g., Smith Residence - Roof Estimate"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                className="bg-navy-800 text-white border-white/20 placeholder-white/30"
              />
            </div>

            {/* Template Type */}
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">
                Template Type
              </label>
              <div className="flex gap-2 flex-wrap">
                {['custom', ...Object.keys(TEMPLATE_PRESETS)].map((type) => (
                  <button
                    key={type}
                    onClick={() => handleTemplateSelect(type)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                      formData.template_type === type
                        ? 'bg-sky-500 text-white'
                        : 'bg-navy-800 text-white/70 hover:text-white border border-white/20'
                    }`}
                  >
                    {type === 'custom'
                      ? 'Custom'
                      : TEMPLATE_PRESETS[type]?.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">
                Address
              </label>
              <Input
                placeholder="123 Main St, Springfield, IL 62701"
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                className="bg-navy-800 text-white border-white/20 placeholder-white/30"
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value }))
                }
                className="w-full px-3 py-2 bg-navy-800 text-white border border-white/20 rounded"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Measurements Builder */}
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-3">
                Measurements
              </label>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {formData.measurements.map((measurement, index) => (
                  <MeasurementRow
                    key={index}
                    measurement={measurement}
                    index={index}
                    onUpdate={handleMeasurementUpdate}
                    onRemove={handleMeasurementRemove}
                    templateType={formData.template_type}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddMeasurement}
                className="mt-3 w-full border-sky-500 text-sky-400 hover:bg-sky-500/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Measurement
              </Button>
            </div>

            {/* Site Conditions */}
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">
                Site Conditions
              </label>
              <Textarea
                placeholder="e.g., Multiple levels, difficult access, weather conditions..."
                value={formData.site_conditions}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    site_conditions: e.target.value,
                  }))
                }
                className="bg-navy-800 text-white border-white/20 placeholder-white/30"
                rows={3}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">
                Notes
              </label>
              <Textarea
                placeholder="Additional notes or observations..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="bg-navy-800 text-white border-white/20 placeholder-white/30"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              className="border-white/20 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              {editingId ? 'Update' : 'Create'} Measurement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
