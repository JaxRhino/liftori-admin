import React, { useState, useEffect } from 'react';
import { useOrg } from '../../../lib/OrgContext';
import { fetchOpsDocs } from '../../../lib/customerOpsService';
import { supabase } from '../../../lib/supabase';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import {
  Plus,
  Search,
  Download,
  Eye,
  Edit2,
  Trash2,
  Shield,
  Book,
  Clipboard,
  FileText,
  Award,
  Wrench,
  Users,
  Megaphone,
  DollarSign,
  Layout,
  Grid,
  List,
  FileType,
  FileType2,
  Table2,
  Image,
  File,
  Upload,
  X,
  Clock,
  FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';

const DOC_CATEGORIES = [
  { id: 'safety_compliance', label: 'Safety & Compliance', icon: Shield },
  { id: 'training_materials', label: 'Training Materials', icon: Book },
  { id: 'standard_procedures', label: 'Standard Operating Procedures', icon: Clipboard },
  { id: 'contracts_legal', label: 'Contracts & Legal', icon: FileText },
  { id: 'insurance_licensing', label: 'Insurance & Licensing', icon: Award },
  { id: 'equipment_manuals', label: 'Equipment Manuals', icon: Wrench },
  { id: 'hr_documents', label: 'HR Documents', icon: Users },
  { id: 'marketing_materials', label: 'Marketing Materials', icon: Megaphone },
  { id: 'financial_records', label: 'Financial Records', icon: DollarSign },
  { id: 'project_templates', label: 'Project Templates', icon: Layout }
];

const FILE_TYPE_ICONS = {
  pdf: { icon: FileType, color: 'text-red-400' },
  doc: { icon: FileType2, color: 'text-blue-400' },
  docx: { icon: FileType2, color: 'text-blue-400' },
  xls: { icon: Table2, color: 'text-green-400' },
  xlsx: { icon: Table2, color: 'text-green-400' },
  csv: { icon: Table2, color: 'text-green-400' },
  png: { icon: Image, color: 'text-purple-400' },
  jpg: { icon: Image, color: 'text-purple-400' },
  jpeg: { icon: Image, color: 'text-purple-400' },
  txt: { icon: FileText, color: 'text-gray-400' },
  other: { icon: File, color: 'text-gray-400' }
};

const VISIBILITY_LEVELS = [
  { id: 'all_team', label: 'All Team' },
  { id: 'management_only', label: 'Management Only' },
  { id: 'specific_roles', label: 'Specific Roles' }
];

export default function OpsDocs() {
  const { currentOrg } = useOrg();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid or folder
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [formData, setFormData] = useState(getEmptyFormData());
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (currentOrg?.id) {
      loadDocuments();
    }
  }, [currentOrg?.id]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await fetchOpsDocs(currentOrg.id);
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const getFileType = (fileName) => {
    if (!fileName) return 'other';
    const ext = fileName.split('.').pop().toLowerCase();
    return ext || 'other';
  };

  const getFileIcon = (fileName) => {
    const type = getFileType(fileName);
    return FILE_TYPE_ICONS[type] || FILE_TYPE_ICONS.other;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatistics = () => {
    const totalDocs = documents.length;
    const uniqueCategories = new Set(documents.map(d => d.category)).size;
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentUploads = documents.filter(d => new Date(d.created_at) > lastWeek).length;
    const totalSize = documents.reduce((sum, d) => sum + (d.file_size || 0), 0);

    return {
      totalDocs,
      uniqueCategories,
      recentUploads,
      totalSize: formatFileSize(totalSize)
    };
  };

  const getCategoryCount = (categoryId) => {
    if (categoryId === 'all') return documents.length;
    return documents.filter(d => d.category === categoryId).length;
  };

  const getFilteredDocuments = () => {
    let filtered = documents;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(d => d.category === selectedCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        (d.name?.toLowerCase().includes(term) || d.description?.toLowerCase().includes(term))
      );
    }

    return filtered;
  };

  const handleUpload = async () => {
    if (!formData.name.trim()) {
      toast.error('Document name is required');
      return;
    }

    try {
      const docData = {
        org_id: currentOrg.id,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        file_type: formData.file_type,
        file_url: formData.file_url,
        file_size: parseInt(formData.file_size) || 0,
        visibility: formData.visibility,
        uploaded_by: currentOrg.user_id || 'unknown'
      };

      if (isEditing && selectedDoc?.id) {
        const { error } = await supabase
          .from('org_documents')
          .update({ ...docData, updated_at: new Date().toISOString() })
          .eq('id', selectedDoc.id);

        if (error) throw error;
        toast.success('Document updated');
      } else {
        const { error } = await supabase
          .from('org_documents')
          .insert([docData]);

        if (error) throw error;
        toast.success('Document uploaded');
      }

      setIsUploadDialogOpen(false);
      setIsEditing(false);
      setFormData(getEmptyFormData());
      await loadDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    }
  };

  const handleEditDoc = (doc) => {
    setSelectedDoc(doc);
    setFormData({
      name: doc.name,
      description: doc.description || '',
      category: doc.category || 'safety_compliance',
      file_type: doc.file_type || 'pdf',
      file_url: doc.file_url || '',
      file_size: doc.file_size || '',
      visibility: doc.visibility || 'all_team'
    });
    setIsEditing(true);
    setIsUploadDialogOpen(true);
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const { error } = await supabase
        .from('org_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;
      toast.success('Document deleted');
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleOpenDetail = (doc) => {
    setSelectedDoc(doc);
    setIsDetailDialogOpen(true);
  };

  const stats = getStatistics();
  const filteredDocs = getFilteredDocuments();

  return (
    <div className="min-h-screen bg-navy-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-sky-500" />
            Company Documents
          </h1>
          <p className="text-gray-400 mt-1">Manage safety, compliance, and operational documents</p>
        </div>
        <Button
          onClick={() => {
            setIsEditing(false);
            setFormData(getEmptyFormData());
            setIsUploadDialogOpen(true);
          }}
          className="bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Upload Document
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-navy-800/50 border-sky-500/20 p-6">
          <p className="text-gray-400 text-sm mb-2">Total Documents</p>
          <p className="text-3xl font-bold text-white">{stats.totalDocs}</p>
        </Card>
        <Card className="bg-navy-800/50 border-sky-500/20 p-6">
          <p className="text-gray-400 text-sm mb-2">Categories Used</p>
          <p className="text-3xl font-bold text-white">{stats.uniqueCategories}</p>
        </Card>
        <Card className="bg-navy-800/50 border-sky-500/20 p-6">
          <p className="text-gray-400 text-sm mb-2">Recent Uploads (7 days)</p>
          <p className="text-3xl font-bold text-white">{stats.recentUploads}</p>
        </Card>
        <Card className="bg-navy-800/50 border-sky-500/20 p-6">
          <p className="text-gray-400 text-sm mb-2">Total Storage</p>
          <p className="text-3xl font-bold text-white">{stats.totalSize}</p>
        </Card>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Sidebar - Categories */}
        <div className="col-span-1 space-y-3">
          <Card className="bg-navy-800/50 border-navy-700/50 overflow-hidden">
            <div className="p-4 border-b border-navy-700/50">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Categories</h3>
            </div>
            <div className="p-2">
              {/* All Documents */}
              <button
                onClick={() => setSelectedCategory('all')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-between ${
                  selectedCategory === 'all'
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-gray-300 hover:bg-navy-700/50'
                }`}
              >
                <span>All Documents</span>
                <span className="text-xs bg-navy-700/50 px-2 py-1 rounded">
                  {getCategoryCount('all')}
                </span>
              </button>

              {/* Category items */}
              {DOC_CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const count = getCategoryCount(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-between ${
                      selectedCategory === cat.id
                        ? 'bg-sky-500/20 text-sky-400'
                        : 'text-gray-300 hover:bg-navy-700/50'
                    }`}
                  >
                    <span className="flex items-center gap-2 flex-1">
                      <Icon className="w-4 h-4" />
                      <span>{cat.label}</span>
                    </span>
                    <span className="text-xs bg-navy-700/50 px-2 py-1 rounded">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="col-span-3 space-y-4">
          {/* Search and View Controls */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-navy-800 border-navy-700/50 text-white placeholder-gray-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-gray-400 hover:bg-navy-700/50'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('folder')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'folder'
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-gray-400 hover:bg-navy-700/50'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Upload Area Placeholder */}
          <Card className="bg-navy-800/30 border-2 border-dashed border-navy-700/50 p-8 text-center hover:border-sky-500/30 transition-colors">
            <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-1">
              File upload coming soon — use URL for now
            </p>
            <p className="text-gray-500 text-xs">
              Paste document URLs in the Upload Dialog
            </p>
          </Card>

          {/* Documents Grid/Folder View */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Loading documents...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <Card className="bg-navy-800/50 p-12 text-center">
              <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-4">No documents found</p>
              <Button
                onClick={() => {
                  setIsEditing(false);
                  setFormData(getEmptyFormData());
                  setIsUploadDialogOpen(true);
                }}
                className="bg-sky-500 hover:bg-sky-600 text-white"
              >
                Upload First Document
              </Button>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map(doc => {
                const fileIcon = getFileIcon(doc.file_url || doc.name);
                const FileIcon = fileIcon.icon;
                const categoryObj = DOC_CATEGORIES.find(c => c.id === doc.category);

                return (
                  <Card
                    key={doc.id}
                    className="bg-navy-800/50 border-navy-700/50 hover:border-sky-500/30 hover:bg-navy-800/70 transition-all overflow-hidden flex flex-col"
                  >
                    {/* File Icon */}
                    <div className="bg-navy-900/50 p-6 flex items-center justify-center border-b border-navy-700/50">
                      <FileIcon className={`w-12 h-12 ${fileIcon.color}`} />
                    </div>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="text-white font-semibold text-sm truncate mb-2">
                        {doc.name}
                      </h3>

                      {categoryObj && (
                        <Badge className="w-fit mb-3 bg-sky-500/20 text-sky-300 border-sky-500/30">
                          {categoryObj.label}
                        </Badge>
                      )}

                      {doc.description && (
                        <p className="text-gray-400 text-xs line-clamp-2 mb-3 flex-1">
                          {doc.description}
                        </p>
                      )}

                      {/* Metadata */}
                      <div className="space-y-1 text-xs text-gray-500 mb-4 border-t border-navy-700/50 pt-3">
                        <div className="flex justify-between">
                          <span>Size:</span>
                          <span className="text-gray-300">{formatFileSize(doc.file_size)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Uploaded:</span>
                          <span className="text-gray-300">{formatDate(doc.created_at)}</span>
                        </div>
                        {doc.visibility && (
                          <div className="flex justify-between">
                            <span>Access:</span>
                            <Badge className="h-5 text-xs bg-navy-700/50 text-gray-300 border-0">
                              {doc.visibility === 'all_team' && 'All Team'}
                              {doc.visibility === 'management_only' && 'Management'}
                              {doc.visibility === 'specific_roles' && 'Specific Roles'}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-3 border-t border-navy-700/50">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenDetail(doc)}
                          className="flex-1 h-8 text-sky-400 hover:bg-sky-500/10"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditDoc(doc)}
                          className="flex-1 h-8 text-blue-400 hover:bg-blue-500/10"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="flex-1 h-8 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            // Folder/Accordion View
            <div className="space-y-3">
              {DOC_CATEGORIES.filter(cat =>
                selectedCategory === 'all' || selectedCategory === cat.id
              ).map(category => {
                const catDocs = filteredDocs.filter(d => d.category === category.id);
                if (catDocs.length === 0) return null;

                const CatIcon = category.icon;
                return (
                  <Card
                    key={category.id}
                    className="bg-navy-800/50 border-navy-700/50 overflow-hidden"
                  >
                    <div className="p-4 bg-navy-900/30 border-b border-navy-700/50 flex items-center gap-2">
                      <CatIcon className="w-5 h-5 text-sky-400" />
                      <h3 className="text-white font-semibold">{category.label}</h3>
                      <span className="ml-auto text-xs text-gray-400">
                        ({catDocs.length} document{catDocs.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="divide-y divide-navy-700/50">
                      {catDocs.map(doc => {
                        const fileIcon = getFileIcon(doc.file_url || doc.name);
                        const FileIcon = fileIcon.icon;

                        return (
                          <div
                            key={doc.id}
                            className="p-4 flex items-start justify-between hover:bg-navy-800/30 transition-colors"
                          >
                            <div className="flex items-start gap-3 flex-1">
                              <FileIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${fileIcon.color}`} />
                              <div className="flex-1">
                                <h4 className="text-white font-medium text-sm">{doc.name}</h4>
                                {doc.description && (
                                  <p className="text-gray-400 text-xs mt-1 line-clamp-1">
                                    {doc.description}
                                  </p>
                                )}
                                <div className="flex gap-3 mt-2 text-xs text-gray-500">
                                  <span>{formatFileSize(doc.file_size)}</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(doc.created_at)}
                                  </span>
                                  {doc.visibility && (
                                    <Badge className="h-4 text-xs bg-navy-700/50 text-gray-300 border-0 py-0.5 px-1.5">
                                      {doc.visibility === 'all_team' && 'All Team'}
                                      {doc.visibility === 'management_only' && 'Management'}
                                      {doc.visibility === 'specific_roles' && 'Specific Roles'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-1 ml-4">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenDetail(doc)}
                                className="h-8 px-2 text-sky-400 hover:bg-sky-500/10"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditDoc(doc)}
                                className="h-8 px-2 text-blue-400 hover:bg-blue-500/10"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteDoc(doc.id)}
                                className="h-8 px-2 text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="bg-navy-900 border-navy-700/50 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {isEditing ? 'Edit Document' : 'Upload Document'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                Document Name *
              </label>
              <Input
                placeholder="e.g., Safety Checklist 2026"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-navy-800 border-navy-700/50 text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                Description
              </label>
              <Textarea
                placeholder="Brief description of the document..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-navy-800 border-navy-700/50 text-white placeholder-gray-500 h-20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-navy-800 border border-navy-700/50 text-white rounded-md px-3 py-2 text-sm"
                >
                  {DOC_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">
                  File Type *
                </label>
                <select
                  value={formData.file_type}
                  onChange={(e) => setFormData({ ...formData, file_type: e.target.value })}
                  className="w-full bg-navy-800 border border-navy-700/50 text-white rounded-md px-3 py-2 text-sm"
                >
                  <option value="pdf">PDF</option>
                  <option value="docx">Word (DOCX)</option>
                  <option value="doc">Word (DOC)</option>
                  <option value="xlsx">Excel (XLSX)</option>
                  <option value="xls">Excel (XLS)</option>
                  <option value="csv">CSV</option>
                  <option value="png">PNG Image</option>
                  <option value="jpg">JPG Image</option>
                  <option value="txt">Text File</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">
                File URL (paste link)
              </label>
              <Input
                placeholder="https://..."
                value={formData.file_url}
                onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                className="bg-navy-800 border-navy-700/50 text-white placeholder-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">
                  File Size (bytes)
                </label>
                <Input
                  type="number"
                  placeholder="e.g., 2048000"
                  value={formData.file_size}
                  onChange={(e) => setFormData({ ...formData, file_size: e.target.value })}
                  className="bg-navy-800 border-navy-700/50 text-white placeholder-gray-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">
                  Visibility *
                </label>
                <select
                  value={formData.visibility}
                  onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                  className="w-full bg-navy-800 border border-navy-700/50 text-white rounded-md px-3 py-2 text-sm"
                >
                  {VISIBILITY_LEVELS.map(level => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsUploadDialogOpen(false);
                setIsEditing(false);
                setFormData(getEmptyFormData());
              }}
              className="text-gray-400 hover:bg-navy-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              {isEditing ? 'Update Document' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="bg-navy-900 border-navy-700/50 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-400" />
              {selectedDoc?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedDoc && (
            <div className="space-y-6 py-4">
              {/* Preview Area */}
              <div className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-12 flex flex-col items-center justify-center">
                {(() => {
                  const fileIcon = getFileIcon(selectedDoc.file_url || selectedDoc.name);
                  const FileIcon = fileIcon.icon;
                  return (
                    <>
                      <FileIcon className={`w-16 h-16 mb-4 ${fileIcon.color}`} />
                      <p className="text-gray-400 text-center">
                        Preview coming soon — download to view
                      </p>
                    </>
                  );
                })()}
              </div>

              {/* Document Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Category</p>
                  <p className="text-white font-medium">
                    {DOC_CATEGORIES.find(c => c.id === selectedDoc.category)?.label || selectedDoc.category}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">File Type</p>
                  <p className="text-white font-medium uppercase">{selectedDoc.file_type}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">File Size</p>
                  <p className="text-white font-medium">{formatFileSize(selectedDoc.file_size)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Uploaded</p>
                  <p className="text-white font-medium">{formatDate(selectedDoc.created_at)}</p>
                </div>
              </div>

              {selectedDoc.description && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Description</p>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {selectedDoc.description}
                  </p>
                </div>
              )}

              {selectedDoc.visibility && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Access Level</p>
                  <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30">
                    {selectedDoc.visibility === 'all_team' && 'All Team'}
                    {selectedDoc.visibility === 'management_only' && 'Management Only'}
                    {selectedDoc.visibility === 'specific_roles' && 'Specific Roles'}
                  </Badge>
                </div>
              )}

              {/* Version History Placeholder */}
              <div className="border-t border-navy-700/50 pt-4">
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Version History</p>
                <p className="text-gray-400 text-sm">Coming soon</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedDoc?.file_url && (
              <a
                href={selectedDoc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
                Download/Open
              </a>
            )}
            <Button
              variant="ghost"
              onClick={() => setIsDetailDialogOpen(false)}
              className="text-gray-400 hover:bg-navy-800"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getEmptyFormData() {
  return {
    name: '',
    description: '',
    category: 'safety_compliance',
    file_type: 'pdf',
    file_url: '',
    file_size: '',
    visibility: 'all_team'
  };
}
