import React, { useState, useEffect } from 'react';
import { useOrg } from '../../../lib/OrgContext';
import { fetchCrews, createCrew, updateCrew, deleteCrew, fetchCrewMembers, createCrewMember, updateCrewMember, deleteCrewMember } from '../../../lib/customerOpsService';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Avatar, AvatarFallback } from '../../../components/ui/avatar';
import { Plus, Edit2, Trash2, Users, MapPin, Star, AlertCircle, Search, Filter, X, ChevronDown, Phone, Mail, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const CREW_COLORS = [
  { name: 'Blue', value: 'sky-500', bg: 'bg-sky-500', border: 'border-sky-500', light: 'bg-sky-50' },
  { name: 'Emerald', value: 'emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-500', light: 'bg-emerald-50' },
  { name: 'Purple', value: 'purple-500', bg: 'bg-purple-500', border: 'border-purple-500', light: 'bg-purple-50' },
  { name: 'Amber', value: 'amber-500', bg: 'bg-amber-500', border: 'border-amber-500', light: 'bg-amber-50' },
  { name: 'Rose', value: 'rose-500', bg: 'bg-rose-500', border: 'border-rose-500', light: 'bg-rose-50' },
  { name: 'Cyan', value: 'cyan-500', bg: 'bg-cyan-500', border: 'border-cyan-500', light: 'bg-cyan-50' },
];

const SPECIALTIES = ['Roofing', 'Siding', 'Gutters', 'Windows', 'Painting', 'Flooring', 'Fencing', 'Landscaping', 'Concrete', 'Deck', 'General', 'HVAC', 'Plumbing', 'Electrical'];

const ROLES = ['Leader', 'Foreman', 'Member', 'Apprentice', 'Helper'];

const STATUS_OPTIONS = ['Active', 'Inactive', 'On Break', 'On Job'];

const MEMBER_STATUS_OPTIONS = ['Active', 'Inactive', 'On Leave', 'Terminated'];

const CERTIFICATIONS_PRESETS = ['OSHA', 'First Aid', 'CPR', 'Electrical License', 'Roofing License', 'HVAC Certified', 'Fall Protection', 'Confined Space'];

function StatsCard({ label, value, icon: Icon }) {
  return (
    <Card className="bg-navy-800 border-white/10">
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/70 text-sm font-medium">{label}</p>
          <Icon className="w-4 h-4 text-sky-500" />
        </div>
        <p className="text-white text-3xl font-bold">{value}</p>
      </div>
    </Card>
  );
}

function MemberAvatar({ member, color = 'sky-500' }) {
  const initials = member.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const colorMap = {
    'sky-500': 'bg-sky-500',
    'emerald-500': 'bg-emerald-500',
    'purple-500': 'bg-purple-500',
    'amber-500': 'bg-amber-500',
    'rose-500': 'bg-rose-500',
    'cyan-500': 'bg-cyan-500',
  };

  return (
    <Avatar className={`w-10 h-10 ${colorMap[color] || 'bg-sky-500'}`}>
      <AvatarFallback className="text-white text-xs font-bold">{initials}</AvatarFallback>
    </Avatar>
  );
}

function CrewMemberListItem({ member, crewColor, onEdit, onRemove }) {
  const roleColors = {
    'Leader': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    'Foreman': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'Member': 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    'Apprentice': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'Helper': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  };

  const statusColors = {
    'Active': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'Inactive': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    'On Leave': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'Terminated': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  };

  return (
    <div className="bg-navy-900/50 border border-white/5 rounded-lg p-4 mb-3">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <MemberAvatar member={member} color={crewColor} />
          <div className="flex-1">
            <p className="text-white font-semibold">{member.name}</p>
            <div className="flex gap-2 mt-1">
              <Badge className={`text-xs ${roleColors[member.role] || roleColors['Member']}`}>
                {member.role}
              </Badge>
              <Badge className={`text-xs ${statusColors[member.status] || statusColors['Active']}`}>
                {member.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 text-white/70 hover:text-white hover:border-white/30"
            onClick={() => onEdit(member)}
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 text-rose-400 hover:text-rose-300 hover:border-rose-500/30"
            onClick={() => onRemove(member.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div className="flex items-center gap-2 text-white/70">
          <Phone className="w-3 h-3" />
          <span>{member.phone || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-white/70">
          <Mail className="w-3 h-3" />
          <span className="truncate">{member.email || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-white/70">
          <Calendar className="w-3 h-3" />
          <span>{member.hireDate ? new Date(member.hireDate).toLocaleDateString() : 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-white/70">
          <DollarSign className="w-3 h-3" />
          <span>${member.hourlyRate || '0'}/hr</span>
        </div>
      </div>

      {member.certifications && member.certifications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {member.certifications.map((cert, idx) => (
            <Badge key={idx} className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs">
              {cert}
            </Badge>
          ))}
        </div>
      )}

      {member.emergencyContact && (
        <div className="mt-3 pt-3 border-t border-white/5 text-xs text-white/60">
          Emergency: {member.emergencyContact.name} ({member.emergencyContact.relationship})
        </div>
      )}
    </div>
  );
}

function CrewDetailPanel({ crew, onClose, onEditCrew, onAddMember, onEditMember, onRemoveMember }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentOrg } = useOrg();

  useEffect(() => {
    loadMembers();
  }, [crew.id]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await fetchCrewMembers(currentOrg?.id, crew.id);
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading crew members:', error);
      toast.error('Failed to load crew members');
    } finally {
      setLoading(false);
    }
  };

  const crewColorObj = CREW_COLORS.find(c => c.value === crew.color) || CREW_COLORS[0];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="bg-navy-800 border-white/10 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10 sticky top-0 bg-navy-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${crewColorObj.bg}`} />
              <div>
                <h2 className="text-xl font-bold text-white">{crew.name}</h2>
                <p className="text-sm text-white/60 mt-1">{crew.description}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-6">
          {/* Crew Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-white/60 text-sm mb-1">Status</p>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                {crew.status}
              </Badge>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Specialties</p>
              <div className="flex flex-wrap gap-2">
                {crew.specialties?.map((spec, idx) => (
                  <Badge key={idx} className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs">
                    {spec}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Vehicle</p>
              <p className="text-white">{crew.vehicle || 'N/A'}</p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">License Plate</p>
              <p className="text-white font-mono">{crew.licensePlate || 'N/A'}</p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Max Capacity</p>
              <p className="text-white">{crew.maxCapacity} members</p>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-1">Jobs Completed</p>
              <p className="text-white">{crew.jobsCompleted || 0}</p>
            </div>
          </div>

          {crew.avgRating && (
            <div className="mb-6 p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white">{crew.avgRating.toFixed(1)} / 5.0 average rating</span>
            </div>
          )}

          {/* Members Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Members ({members.length} / {crew.maxCapacity})
              </h3>
              <Button
                size="sm"
                className="bg-sky-500 hover:bg-sky-600 text-white"
                onClick={() => onAddMember(crew)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </div>

            {loading ? (
              <p className="text-white/60 text-center py-8">Loading members...</p>
            ) : members.length > 0 ? (
              <div className="space-y-3">
                {members.map(member => (
                  <CrewMemberListItem
                    key={member.id}
                    member={member}
                    crewColor={crewColorObj.value}
                    onEdit={onEditMember}
                    onRemove={onRemoveMember}
                  />
                ))}
              </div>
            ) : (
              <p className="text-white/60 text-center py-8">No team members yet. Add one to get started.</p>
            )}
          </div>

          {/* Edit Crew Button */}
          <div className="flex gap-3 pt-6 border-t border-white/10">
            <Button
              className="flex-1 bg-sky-500 hover:bg-sky-600 text-white"
              onClick={() => onEditCrew(crew)}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Crew
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CrewCard({ crew, onExpand, onEdit, onDelete }) {
  const crewColorObj = CREW_COLORS.find(c => c.value === crew.color) || CREW_COLORS[0];
  const memberCount = crew.memberCount || 0;
  const capacity = crew.maxCapacity || 5;
  const capacityPercent = (memberCount / capacity) * 100;

  return (
    <Card
      className={`bg-navy-800 border ${crewColorObj.border} border-opacity-30 hover:border-opacity-60 cursor-pointer transition-all hover:shadow-lg hover:shadow-${crewColorObj.value}/20`}
      onClick={onExpand}
    >
      <div className="p-5">
        {/* Header with Color Dot and Name */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className={`w-3 h-3 rounded-full ${crewColorObj.bg}`} />
            <h3 className="text-lg font-bold text-white flex-1">{crew.name}</h3>
          </div>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 text-white/70 hover:text-white hover:border-white/30"
              onClick={() => onEdit(crew)}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 text-rose-400 hover:text-rose-300 hover:border-rose-500/30"
              onClick={() => onDelete(crew.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-3">
          <Badge className={`text-xs ${crew.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : crew.status === 'On Job' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : crew.status === 'On Break' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
            {crew.status}
          </Badge>
        </div>

        {/* Specialties */}
        <div className="mb-4">
          <p className="text-white/60 text-xs mb-2">Specialties</p>
          <div className="flex flex-wrap gap-2">
            {crew.specialties?.slice(0, 3).map((spec, idx) => (
              <Badge key={idx} className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs">
                {spec}
              </Badge>
            ))}
            {crew.specialties?.length > 3 && (
              <Badge className="bg-white/10 text-white/70 border-white/10 text-xs">
                +{crew.specialties.length - 3}
              </Badge>
            )}
          </div>
        </div>

        {/* Vehicle Info */}
        {crew.vehicle && (
          <div className="mb-4 p-2 bg-white/5 rounded border border-white/10">
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <MapPin className="w-3 h-3" />
              <span>{crew.vehicle}</span>
              {crew.licensePlate && <span className="font-mono text-xs">{crew.licensePlate}</span>}
            </div>
          </div>
        )}

        {/* Member Count and Avatars */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-sm">Team Members</span>
            <span className="text-white font-semibold">{memberCount}/{capacity}</span>
          </div>
          <div className="w-full bg-navy-900/50 rounded-full h-2 overflow-hidden mb-2">
            <div
              className={`h-full ${crewColorObj.bg} transition-all`}
              style={{ width: `${capacityPercent}%` }}
            />
          </div>
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
          <div>
            <p className="text-white/60 text-xs">Jobs Completed</p>
            <p className="text-white font-semibold">{crew.jobsCompleted || 0}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">Rating</p>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-white font-semibold">{crew.avgRating ? crew.avgRating.toFixed(1) : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CrewFormDialog({ crew, isOpen, onOpenChange, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'sky-500',
    specialties: [],
    vehicle: '',
    licensePlate: '',
    maxCapacity: 5,
    status: 'Active',
  });

  useEffect(() => {
    if (crew) {
      setFormData(crew);
    } else {
      setFormData({
        name: '',
        description: '',
        color: 'sky-500',
        specialties: [],
        vehicle: '',
        licensePlate: '',
        maxCapacity: 5,
        status: 'Active',
      });
    }
  }, [crew, isOpen]);

  const handleSpecialtyToggle = (specialty) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Crew name is required');
      return;
    }
    await onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-800 border-white/10 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>{crew ? 'Edit Crew' : 'Create New Crew'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Basic Info */}
          <div className="space-y-2">
            <label className="text-white text-sm font-semibold">Crew Name</label>
            <Input
              placeholder="Enter crew name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
            />
          </div>

          <div className="space-y-2">
            <label className="text-white text-sm font-semibold">Description</label>
            <Textarea
              placeholder="Brief description of the crew"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="bg-navy-900 border-white/10 text-white placeholder:text-white/40 resize-none"
              rows={3}
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <label className="text-white text-sm font-semibold">Team Color</label>
            <div className="flex gap-3">
              {CREW_COLORS.map(color => (
                <button
                  key={color.value}
                  className={`w-10 h-10 rounded-full ${color.bg} border-2 transition-all ${
                    formData.color === color.value ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                />
              ))}
            </div>
          </div>

          {/* Specialties */}
          <div className="space-y-2">
            <label className="text-white text-sm font-semibold">Specialties</label>
            <div className="grid grid-cols-2 gap-2">
              {SPECIALTIES.map(specialty => (
                <button
                  key={specialty}
                  onClick={() => handleSpecialtyToggle(specialty)}
                  className={`p-2 rounded border text-sm transition-all ${
                    formData.specialties.includes(specialty)
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                      : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                  }`}
                >
                  {specialty}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold">Vehicle</label>
              <Input
                placeholder="e.g., Ford Transit"
                value={formData.vehicle}
                onChange={(e) => setFormData(prev => ({ ...prev, vehicle: e.target.value }))}
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold">License Plate</label>
              <Input
                placeholder="e.g., ABC-1234"
                value={formData.licensePlate}
                onChange={(e) => setFormData(prev => ({ ...prev, licensePlate: e.target.value }))}
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
          </div>

          {/* Capacity and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold">Max Capacity</label>
              <Input
                type="number"
                min="1"
                max="20"
                value={formData.maxCapacity}
                onChange={(e) => setFormData(prev => ({ ...prev, maxCapacity: parseInt(e.target.value) }))}
                className="bg-navy-900 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full bg-navy-900 border border-white/10 text-white rounded px-3 py-2"
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status} className="bg-navy-900">
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-white/10 text-white"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-sky-500 hover:bg-sky-600 text-white"
            onClick={handleSave}
          >
            {crew ? 'Update Crew' : 'Create Crew'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberFormDialog({ member, crew, isOpen, onOpenChange, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'Member',
    certifications: [],
    hireDate: '',
    hourlyRate: '',
    status: 'Active',
    emergencyContact: { name: '', phone: '', relationship: '' },
  });

  const [newCert, setNewCert] = useState('');

  useEffect(() => {
    if (member) {
      setFormData(member);
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        role: 'Member',
        certifications: [],
        hireDate: '',
        hourlyRate: '',
        status: 'Active',
        emergencyContact: { name: '', phone: '', relationship: '' },
      });
    }
    setNewCert('');
  }, [member, isOpen]);

  const handleAddCert = () => {
    if (newCert.trim() && !formData.certifications.includes(newCert)) {
      setFormData(prev => ({
        ...prev,
        certifications: [...prev.certifications, newCert],
      }));
      setNewCert('');
    }
  };

  const handleRemoveCert = (cert) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter(c => c !== cert),
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Member name is required');
      return;
    }
    await onSave(crew.id, formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-800 border-white/10 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>{member ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold">Full Name</label>
              <Input
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="w-full bg-navy-900 border border-white/10 text-white rounded px-3 py-2"
              >
                {ROLES.map(role => (
                  <option key={role} value={role} className="bg-navy-900">
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold">Phone</label>
              <Input
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold">Email</label>
              <Input
                placeholder="member@example.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
          </div>

          {/* Employment Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold">Hire Date</label>
              <Input
                type="date"
                value={formData.hireDate}
                onChange={(e) => setFormData(prev => ({ ...prev, hireDate: e.target.value }))}
                className="bg-navy-900 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold">Hourly Rate</label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.hourlyRate}
                onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
          </div>

          {/* Certifications */}
          <div className="space-y-2">
            <label className="text-white text-sm font-semibold">Certifications</label>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add certification..."
                value={newCert}
                onChange={(e) => setNewCert(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCert())}
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
              <Button
                size="sm"
                className="bg-sky-500 hover:bg-sky-600 text-white"
                onClick={handleAddCert}
              >
                Add
              </Button>
            </div>
            {/* Preset suggestions */}
            <div className="text-xs text-white/60 mb-2">Quick add:</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {CERTIFICATIONS_PRESETS.map(cert => (
                <button
                  key={cert}
                  onClick={() => {
                    if (!formData.certifications.includes(cert)) {
                      setFormData(prev => ({
                        ...prev,
                        certifications: [...prev.certifications, cert],
                      }));
                    }
                  }}
                  className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-2 py-1 rounded"
                >
                  {cert}
                </button>
              ))}
            </div>
            {/* Added certifications */}
            <div className="flex flex-wrap gap-2">
              {formData.certifications.map((cert, idx) => (
                <Badge
                  key={idx}
                  className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs cursor-pointer"
                  onClick={() => handleRemoveCert(cert)}
                >
                  {cert} <X className="w-2 h-2 ml-1" />
                </Badge>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-white text-sm font-semibold">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full bg-navy-900 border border-white/10 text-white rounded px-3 py-2"
            >
              {MEMBER_STATUS_OPTIONS.map(status => (
                <option key={status} value={status} className="bg-navy-900">
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Emergency Contact */}
          <div className="space-y-3 p-3 bg-white/5 border border-white/10 rounded">
            <label className="text-white text-sm font-semibold">Emergency Contact</label>
            <div className="space-y-2">
              <Input
                placeholder="Contact name"
                value={formData.emergencyContact.name}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  emergencyContact: { ...prev.emergencyContact, name: e.target.value }
                }))}
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Contact phone"
                value={formData.emergencyContact.phone}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  emergencyContact: { ...prev.emergencyContact, phone: e.target.value }
                }))}
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Relationship"
                value={formData.emergencyContact.relationship}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  emergencyContact: { ...prev.emergencyContact, relationship: e.target.value }
                }))}
                className="bg-navy-900 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-white/10 text-white"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-sky-500 hover:bg-sky-600 text-white"
            onClick={handleSave}
          >
            {member ? 'Update Member' : 'Add Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OpsCrewManagement() {
  const { currentOrg } = useOrg();
  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [crewFormOpen, setCrewFormOpen] = useState(false);
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [expandedCrew, setExpandedCrew] = useState(null);
  const [editingCrew, setEditingCrew] = useState(null);

  useEffect(() => {
    loadCrews();
  }, [currentOrg?.id]);

  const loadCrews = async () => {
    try {
      setLoading(true);
      const data = await fetchCrews(currentOrg?.id);
      setCrews(data || []);
    } catch (error) {
      console.error('Error loading crews:', error);
      toast.error('Failed to load crews');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdateCrew = async (formData) => {
    try {
      if (editingCrew) {
        await updateCrew(currentOrg?.id, editingCrew.id, formData);
        toast.success('Crew updated successfully');
      } else {
        await createCrew(currentOrg?.id, formData);
        toast.success('Crew created successfully');
      }
      setEditingCrew(null);
      loadCrews();
    } catch (error) {
      console.error('Error saving crew:', error);
      toast.error('Failed to save crew');
    }
  };

  const handleDeleteCrew = async (crewId) => {
    if (!window.confirm('Are you sure you want to delete this crew?')) return;
    try {
      await deleteCrew(currentOrg?.id, crewId);
      toast.success('Crew deleted successfully');
      loadCrews();
    } catch (error) {
      console.error('Error deleting crew:', error);
      toast.error('Failed to delete crew');
    }
  };

  const handleAddOrUpdateMember = async (crewId, memberData) => {
    try {
      if (selectedMember) {
        await updateCrewMember(currentOrg?.id, crewId, selectedMember.id, memberData);
        toast.success('Member updated successfully');
      } else {
        await createCrewMember(currentOrg?.id, crewId, memberData);
        toast.success('Member added successfully');
      }
      setSelectedMember(null);
      setSelectedCrew(null);
      loadCrews();
    } catch (error) {
      console.error('Error saving member:', error);
      toast.error('Failed to save member');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      await deleteCrewMember(currentOrg?.id, selectedCrew.id, memberId);
      toast.success('Member removed successfully');
      setExpandedCrew(null);
      setSelectedCrew(null);
      loadCrews();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const filteredCrews = crews.filter(crew => {
    const matchesSearch = crew.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crew.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || crew.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    totalCrews: crews.length,
    activeCrews: crews.filter(c => c.status === 'Active').length,
    totalMembers: crews.reduce((sum, c) => sum + (c.memberCount || 0), 0),
    onJob: crews.filter(c => c.status === 'On Job').length,
  };

  return (
    <div className="min-h-screen bg-navy-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Crew Management</h1>
          <p className="text-white/60">Manage your field teams, members, and scheduling</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard label="Total Crews" value={stats.totalCrews} icon={Users} />
          <StatsCard label="Active Crews" value={stats.activeCrews} icon={Users} />
          <StatsCard label="Total Members" value={stats.totalMembers} icon={Users} />
          <StatsCard label="On Job Now" value={stats.onJob} icon={AlertCircle} />
        </div>

        {/* Controls */}
        <div className="mb-8 flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="flex-1 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Search crews or members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-navy-800 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-white/60" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-navy-800 border border-white/10 text-white rounded px-3 py-2"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="On Break">On Break</option>
                <option value="On Job">On Job</option>
              </select>
            </div>
          </div>
          <Button
            className="bg-sky-500 hover:bg-sky-600 text-white"
            onClick={() => {
              setEditingCrew(null);
              setCrewFormOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Crew
          </Button>
        </div>

        {/* Crews Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-white/60">Loading crews...</p>
          </div>
        ) : filteredCrews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCrews.map(crew => (
              <CrewCard
                key={crew.id}
                crew={crew}
                onExpand={() => {
                  setExpandedCrew(crew);
                  setSelectedCrew(crew);
                }}
                onEdit={(c) => {
                  setEditingCrew(c);
                  setCrewFormOpen(true);
                }}
                onDelete={handleDeleteCrew}
              />
            ))}
          </div>
        ) : (
          <Card className="bg-navy-800 border-white/10">
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/60 mb-4">No crews found. Create one to get started!</p>
              <Button
                className="bg-sky-500 hover:bg-sky-600 text-white"
                onClick={() => {
                  setEditingCrew(null);
                  setCrewFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Crew
              </Button>
            </div>
          </Card>
        )}

        {/* Crew Detail Panel */}
        {expandedCrew && (
          <CrewDetailPanel
            crew={expandedCrew}
            onClose={() => {
              setExpandedCrew(null);
              setSelectedCrew(null);
            }}
            onEditCrew={(c) => {
              setEditingCrew(c);
              setCrewFormOpen(true);
            }}
            onAddMember={(c) => {
              setSelectedCrew(c);
              setSelectedMember(null);
              setMemberFormOpen(true);
            }}
            onEditMember={(m) => {
              setSelectedMember(m);
              setMemberFormOpen(true);
            }}
            onRemoveMember={handleRemoveMember}
          />
        )}

        {/* Crew Form Dialog */}
        <CrewFormDialog
          crew={editingCrew}
          isOpen={crewFormOpen}
          onOpenChange={setCrewFormOpen}
          onSave={handleCreateOrUpdateCrew}
        />

        {/* Member Form Dialog */}
        {selectedCrew && (
          <MemberFormDialog
            member={selectedMember}
            crew={selectedCrew}
            isOpen={memberFormOpen}
            onOpenChange={setMemberFormOpen}
            onSave={handleAddOrUpdateMember}
          />
        )}
      </div>
    </div>
  );
}
