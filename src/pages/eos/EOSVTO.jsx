import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useOrg } from '../../lib/OrgContext';
import { fetchVTO, saveVTO } from '../../lib/eosService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_VTO = {
  core_values: [],
  core_focus: {
    purpose: '',
    niche: '',
  },
  ten_year_target: '',
  marketing_strategy: {
    target_market: '',
    unique_value: '',
    three_uniques: [],
  },
  three_year_picture: {
    revenue: '',
    profit: '',
    measurables: [],
  },
  one_year_plan: {
    revenue: '',
    profit: '',
    goals: [],
  },
};

export default function EOSVTO() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [vtoData, setVtoData] = useState(DEFAULT_VTO);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewValueDialog, setShowNewValueDialog] = useState(false);
  const [newValueSection, setNewValueSection] = useState(null);
  const [newValue, setNewValue] = useState({
    name: '',
    description: '',
    behaviors: [],
  });

  useEffect(() => {
    const loadVTO = async () => {
      try {
        const data = await fetchVTO(currentOrg?.id);
        if (data) {
          setVtoData(data);
        } else {
          setVtoData(DEFAULT_VTO);
        }
      } catch (error) {
        console.error('Error loading VTO:', error);
        toast.error('Failed to load V/TO');
      } finally {
        setLoading(false);
      }
    };
    loadVTO();
  }, [currentOrg?.id]);

  const handleSaveVTO = async () => {
    setSaving(true);
    try {
      const saved = await saveVTO(vtoData);
      setVtoData(saved);
      setIsEditMode(false);
      toast.success('V/TO saved successfully');
    } catch (error) {
      console.error('Error saving VTO:', error);
      toast.error('Failed to save V/TO');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCoreValue = () => {
    setNewValueSection('core_values');
    setNewValue({ name: '', description: '', behaviors: [] });
    setShowNewValueDialog(true);
  };

  const handleSaveCoreValue = () => {
    if (!newValue.name) {
      toast.error('Please enter a value name');
      return;
    }

    const updatedValues = [
      ...vtoData.core_values,
      {
        id: Date.now(),
        ...newValue,
      },
    ];

    setVtoData({
      ...vtoData,
      core_values: updatedValues,
    });

    setShowNewValueDialog(false);
    setNewValue({ name: '', description: '', behaviors: [] });
  };

  const handleDeleteCoreValue = (valueId) => {
    setVtoData({
      ...vtoData,
      core_values: vtoData.core_values.filter((v) => v.id !== valueId),
    });
  };

  const handleUpdateCoreValue = (valueId, field, value) => {
    setVtoData({
      ...vtoData,
      core_values: vtoData.core_values.map((v) =>
        v.id === valueId ? { ...v, [field]: value } : v
      ),
    });
  };

  const handleAddListItem = (section, field) => {
    const current = vtoData[section]?.[field] || vtoData[section];
    if (Array.isArray(current)) {
      const updated = [...current, ''];
      if (section.includes('.')) {
        const [parent, child] = section.split('.');
        setVtoData({
          ...vtoData,
          [parent]: {
            ...vtoData[parent],
            [child]: updated,
          },
        });
      } else {
        setVtoData({
          ...vtoData,
          [section]: updated,
        });
      }
    }
  };

  const handleRemoveListItem = (section, field, index) => {
    const current = vtoData[section]?.[field] || vtoData[section];
    if (Array.isArray(current)) {
      const updated = current.filter((_, i) => i !== index);
      if (section.includes('.')) {
        const [parent, child] = section.split('.');
        setVtoData({
          ...vtoData,
          [parent]: {
            ...vtoData[parent],
            [child]: updated,
          },
        });
      } else {
        setVtoData({
          ...vtoData,
          [section]: updated,
        });
      }
    }
  };

  const handleUpdateListItem = (section, field, index, value) => {
    const current = vtoData[section]?.[field] || vtoData[section];
    if (Array.isArray(current)) {
      const updated = current.map((item, i) => (i === index ? value : item));
      if (section.includes('.')) {
        const [parent, child] = section.split('.');
        setVtoData({
          ...vtoData,
          [parent]: {
            ...vtoData[parent],
            [child]: updated,
          },
        });
      } else {
        setVtoData({
          ...vtoData,
          [section]: updated,
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 p-8 flex items-center justify-center">
        <p className="text-gray-400">Loading V/TO...</p>
      </div>
    );
  }

  const SectionCard = ({ title, children }) => (
    <Card className="bg-navy-900 border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      {children}
    </Card>
  );

  const EditableText = ({ value, onChange, multiline = false }) => {
    if (!isEditMode) {
      return <p className="text-gray-300">{value || '-'}</p>;
    }

    return multiline ? (
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="bg-navy-800 border-gray-700 text-white" />
    ) : (
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="bg-navy-800 border-gray-700 text-white" />
    );
  };

  const EditableListItem = ({ value, onChangeValue, onRemove, index }) => {
    if (!isEditMode) {
      return <p className="text-gray-300 text-sm">{value || '-'}</p>;
    }

    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChangeValue(index, e.target.value)}
          className="bg-navy-800 border-gray-700 text-white text-sm flex-1"
        />
        <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-300">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-navy-950 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">Vision/Traction Organizer</h1>
          <div className="flex gap-2">
            {isEditMode ? (
              <>
                <Button
                  onClick={() => setIsEditMode(false)}
                  variant="outline"
                  className="border-gray-700 text-white hover:bg-gray-800"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveVTO}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsEditMode(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Vision Column */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Vision</h2>

            {/* Core Values */}
            <SectionCard title="Core Values">
              <div className="space-y-4">
                {vtoData.core_values.map((value) => (
                  <div key={value.id} className="bg-navy-800 p-4 rounded border border-gray-700">
                    {isEditMode ? (
                      <div className="space-y-3">
                        <Input
                          value={value.name}
                          onChange={(e) => handleUpdateCoreValue(value.id, 'name', e.target.value)}
                          className="bg-navy-700 border-gray-700 text-white font-semibold"
                          placeholder="Value name"
                        />
                        <Textarea
                          value={value.description || ''}
                          onChange={(e) => handleUpdateCoreValue(value.id, 'description', e.target.value)}
                          className="bg-navy-700 border-gray-700 text-white text-sm"
                          placeholder="Description"
                        />
                        <button
                          onClick={() => handleDeleteCoreValue(value.id)}
                          className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    ) : (
                      <>
                        <h4 className="font-semibold text-white">{value.name}</h4>
                        {value.description && (
                          <p className="text-sm text-gray-300 mt-1">{value.description}</p>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {isEditMode && (
                  <Button
                    onClick={handleAddCoreValue}
                    variant="outline"
                    className="w-full border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Core Value
                  </Button>
                )}
              </div>
            </SectionCard>

            {/* Core Focus */}
            <SectionCard title="Core Focus">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Purpose</label>
                  <EditableText
                    value={vtoData.core_focus.purpose}
                    onChange={(val) =>
                      setVtoData({
                        ...vtoData,
                        core_focus: { ...vtoData.core_focus, purpose: val },
                      })
                    }
                    multiline
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Niche</label>
                  <EditableText
                    value={vtoData.core_focus.niche}
                    onChange={(val) =>
                      setVtoData({
                        ...vtoData,
                        core_focus: { ...vtoData.core_focus, niche: val },
                      })
                    }
                  />
                </div>
              </div>
            </SectionCard>

            {/* 10-Year Target */}
            <SectionCard title="10-Year Target">
              <EditableText
                value={vtoData.ten_year_target}
                onChange={(val) => setVtoData({ ...vtoData, ten_year_target: val })}
                multiline
              />
            </SectionCard>

            {/* Marketing Strategy */}
            <SectionCard title="Marketing Strategy">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Target Market
                  </label>
                  <EditableText
                    value={vtoData.marketing_strategy.target_market}
                    onChange={(val) =>
                      setVtoData({
                        ...vtoData,
                        marketing_strategy: {
                          ...vtoData.marketing_strategy,
                          target_market: val,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Unique Value
                  </label>
                  <EditableText
                    value={vtoData.marketing_strategy.unique_value}
                    onChange={(val) =>
                      setVtoData({
                        ...vtoData,
                        marketing_strategy: {
                          ...vtoData.marketing_strategy,
                          unique_value: val,
                        },
                      })
                    }
                    multiline
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    3 Uniques
                  </label>
                  <div className="space-y-2">
                    {vtoData.marketing_strategy.three_uniques.map((unique, idx) => (
                      <EditableListItem
                        key={idx}
                        value={unique}
                        onChangeValue={(index, val) =>
                          handleUpdateListItem('marketing_strategy', 'three_uniques', index, val)
                        }
                        onRemove={() =>
                          handleRemoveListItem('marketing_strategy', 'three_uniques', idx)
                        }
                        index={idx}
                      />
                    ))}
                    {isEditMode && (
                      <Button
                        onClick={() => handleAddListItem('marketing_strategy', 'three_uniques')}
                        size="sm"
                        variant="outline"
                        className="w-full border-gray-700 text-gray-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Unique
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Traction Column */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Traction</h2>

            {/* 3-Year Picture */}
            <SectionCard title="3-Year Picture">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Revenue</label>
                  <EditableText
                    value={vtoData.three_year_picture.revenue}
                    onChange={(val) =>
                      setVtoData({
                        ...vtoData,
                        three_year_picture: { ...vtoData.three_year_picture, revenue: val },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Profit</label>
                  <EditableText
                    value={vtoData.three_year_picture.profit}
                    onChange={(val) =>
                      setVtoData({
                        ...vtoData,
                        three_year_picture: { ...vtoData.three_year_picture, profit: val },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Measurables
                  </label>
                  <div className="space-y-2">
                    {vtoData.three_year_picture.measurables.map((measurable, idx) => (
                      <EditableListItem
                        key={idx}
                        value={measurable}
                        onChangeValue={(index, val) =>
                          handleUpdateListItem('three_year_picture', 'measurables', index, val)
                        }
                        onRemove={() =>
                          handleRemoveListItem('three_year_picture', 'measurables', idx)
                        }
                        index={idx}
                      />
                    ))}
                    {isEditMode && (
                      <Button
                        onClick={() => handleAddListItem('three_year_picture', 'measurables')}
                        size="sm"
                        variant="outline"
                        className="w-full border-gray-700 text-gray-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Measurable
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* 1-Year Plan */}
            <SectionCard title="1-Year Plan">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Revenue</label>
                  <EditableText
                    value={vtoData.one_year_plan.revenue}
                    onChange={(val) =>
                      setVtoData({
                        ...vtoData,
                        one_year_plan: { ...vtoData.one_year_plan, revenue: val },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Profit</label>
                  <EditableText
                    value={vtoData.one_year_plan.profit}
                    onChange={(val) =>
                      setVtoData({
                        ...vtoData,
                        one_year_plan: { ...vtoData.one_year_plan, profit: val },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Goals</label>
                  <div className="space-y-2">
                    {vtoData.one_year_plan.goals.map((goal, idx) => (
                      <EditableListItem
                        key={idx}
                        value={goal}
                        onChangeValue={(index, val) =>
                          handleUpdateListItem('one_year_plan', 'goals', index, val)
                        }
                        onRemove={() => handleRemoveListItem('one_year_plan', 'goals', idx)}
                        index={idx}
                      />
                    ))}
                    {isEditMode && (
                      <Button
                        onClick={() => handleAddListItem('one_year_plan', 'goals')}
                        size="sm"
                        variant="outline"
                        className="w-full border-gray-700 text-gray-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Goal
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* New Core Value Dialog */}
      <Dialog open={showNewValueDialog} onOpenChange={setShowNewValueDialog}>
        <DialogContent className="bg-navy-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Add Core Value</DialogTitle>
            <DialogDescription className="text-gray-400">
              Create a new core value with description
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Value Name</label>
              <Input
                value={newValue.name}
                onChange={(e) => setNewValue({ ...newValue, name: e.target.value })}
                className="bg-navy-800 border-gray-700 text-white"
                placeholder="e.g., Integrity"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea
                value={newValue.description}
                onChange={(e) => setNewValue({ ...newValue, description: e.target.value })}
                className="bg-navy-800 border-gray-700 text-white"
                placeholder="Describe this core value..."
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button
                onClick={() => setShowNewValueDialog(false)}
                variant="outline"
                className="border-gray-700 text-white hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCoreValue}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
