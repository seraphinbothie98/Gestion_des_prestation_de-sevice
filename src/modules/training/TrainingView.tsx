import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Training, TrainingCategory, TrainingSession, Enrollment, AttendanceSheet, Assessment, Certificate, TrainingModule } from '../../types';
import { formatCurrency, formatDate, generateDocNumber } from '../../lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import {
  GraduationCap, Plus, Users, Calendar, Award, CheckCircle,
  FileCheck2, UserCheck, Clock, BookOpen, Search, ArrowRight, Printer,
  Layers, FolderTree, Tag, Edit, Trash2, Eye, Power, AlertTriangle,
  FolderPlus, Laptop, Palette, Calculator, ShieldCheck, CheckCircle2,
  SlidersHorizontal, Check, X
} from 'lucide-react';

interface TrainingViewProps {
  onOpenQuickEnrollment: () => void;
  onSelectCertificateToVerify?: (code: string) => void;
}

export const TrainingView: React.FC<TrainingViewProps> = ({
  onOpenQuickEnrollment,
  onSelectCertificateToVerify,
}) => {
  const { currentTenant, currentUser, hasPermission } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const [activeTab, setActiveTab] = useState<'catalogue' | 'categories' | 'sessions' | 'inscriptions' | 'presences' | 'notes' | 'certificats'>('catalogue');
  const [selectedSessionForAttendance, setSelectedSessionForAttendance] = useState<string>(state.trainingSessions[0]?.id || '');
  const [selectedSessionForGrading, setSelectedSessionForGrading] = useState<string>(state.trainingSessions[0]?.id || '');
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);

  // ==========================================
  // ACTIVE CATEGORIES COMPUTATION
  // ==========================================
  const activeCategories = useMemo(() => {
    const categories = state.trainingCategories || [];
    return categories.filter(c => c.isActive !== false);
  }, [state.trainingCategories]);

  // ==========================================
  // CATALOGUE STATE & MODALS
  // ==========================================
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueCategoryFilter, setCatalogueCategoryFilter] = useState('ALL');
  const [catalogueStatusFilter, setCatalogueStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // New Training Form
  const [isNewTrainingModalOpen, setIsNewTrainingModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDuration, setNewDuration] = useState(30);
  const [newPrice, setNewPrice] = useState(1000000);
  const [newLevel, setNewLevel] = useState<'DEBUTANT' | 'INTERMEDIAIRE' | 'AVANCE' | 'TOUS_NIVEAUX'>('DEBUTANT');
  const [newDescription, setNewDescription] = useState('');

  // Edit Training Form
  const [trainingToEdit, setTrainingToEdit] = useState<Training | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDuration, setEditDuration] = useState(30);
  const [editPrice, setEditPrice] = useState(1000000);
  const [editLevel, setEditLevel] = useState<'DEBUTANT' | 'INTERMEDIAIRE' | 'AVANCE' | 'TOUS_NIVEAUX'>('DEBUTANT');
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editModules, setEditModules] = useState<TrainingModule[]>([]);

  // View Training Sheet
  const [trainingToView, setTrainingToView] = useState<Training | null>(null);

  // Auto-select first active category when opening New Training Modal
  const handleOpenNewTrainingModal = () => {
    setNewTitle('');
    setNewCode('');
    setNewDuration(30);
    setNewPrice(1000000);
    setNewLevel('DEBUTANT');
    setNewDescription('');
    setNewCategoryId(activeCategories[0]?.id || state.trainingCategories[0]?.id || '');
    setIsNewTrainingModalOpen(true);
  };

  // Open Edit Training Modal
  const handleOpenEditTraining = (t: Training) => {
    setTrainingToEdit(t);
    setEditTitle(t.title);
    setEditCode(t.code);
    setEditCategoryId(t.categoryId || activeCategories[0]?.id || '');
    setEditDuration(t.durationHours);
    setEditPrice(t.price);
    setEditLevel(t.level);
    setEditDescription(t.description || '');
    setEditIsActive(t.isActive !== false);
    setEditModules(t.modules ? JSON.parse(JSON.stringify(t.modules)) : []);
  };

  // Submit Create Training
  const handleCreateTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCode.trim()) {
      showToast('Erreur', 'Veuillez renseigner le titre et le code de formation.', 'DANGER');
      return;
    }

    const targetCatId = newCategoryId || activeCategories[0]?.id || state.trainingCategories[0]?.id || 'tc-01';
    const selectedCategory = state.trainingCategories.find(c => c.id === targetCatId);
    const newId = `tr-${Date.now()}`;

    dbStore.updateState(draft => {
      draft.trainings.unshift({
        id: newId,
        tenantId: currentTenant?.id || 't-001',
        categoryId: targetCatId,
        categoryName: selectedCategory?.name || 'Informatique & Bureautique',
        code: newCode.toUpperCase().trim(),
        title: newTitle.trim(),
        description: newDescription.trim(),
        durationHours: newDuration,
        level: newLevel,
        price: newPrice,
        maxCapacity: 20,
        isActive: true,
        modules: [
          { id: `mod-${Date.now()}-1`, title: 'Module 1 : Fondamentaux & Pratique', durationHours: Math.floor(newDuration / 2), sortOrder: 1 },
          { id: `mod-${Date.now()}-2`, title: 'Module 2 : Projet & Perfectionnement', durationHours: Math.ceil(newDuration / 2), sortOrder: 2 }
        ],
        createdAt: new Date().toISOString()
      });
    });

    dbStore.logAudit('TRAINING_CREATED', 'TRAINING', newId, null, { title: newTitle, category: selectedCategory?.name });
    showToast('Formation ajoutée', `La formation "${newTitle}" a été créée dans la catégorie "${selectedCategory?.name}".`, 'SUCCESS');
    setIsNewTrainingModalOpen(false);
  };

  // Submit Edit Training
  const handleSaveEditTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainingToEdit) return;

    const selectedCategory = state.trainingCategories.find(c => c.id === editCategoryId);

    dbStore.updateState(draft => {
      const training = draft.trainings.find(t => t.id === trainingToEdit.id);
      if (training) {
        training.title = editTitle.trim();
        training.code = editCode.toUpperCase().trim();
        training.categoryId = editCategoryId;
        training.categoryName = selectedCategory?.name || training.categoryName;
        training.durationHours = editDuration;
        training.price = editPrice;
        training.level = editLevel;
        training.description = editDescription.trim();
        training.isActive = editIsActive;
        training.modules = editModules;
      }
    });

    dbStore.logAudit('TRAINING_UPDATED', 'TRAINING', trainingToEdit.id, { title: trainingToEdit.title }, { title: editTitle, category: selectedCategory?.name });
    showToast('Formation Mise à Jour', `La formation "${editTitle}" a été modifiée avec succès.`, 'SUCCESS');
    setTrainingToEdit(null);
  };

  // Toggle Training Status (Active / Inactive)
  const handleToggleTrainingActive = (t: Training) => {
    dbStore.updateState(draft => {
      const training = draft.trainings.find(item => item.id === t.id);
      if (training) {
        training.isActive = !training.isActive;
      }
    });

    dbStore.logAudit('TRAINING_STATUS_TOGGLED', 'TRAINING', t.id, { isActive: t.isActive }, { isActive: !t.isActive });
    showToast(t.isActive ? 'Formation Désactivée' : 'Formation Réactivée', `La formation "${t.title}" est désormais ${t.isActive ? 'inactive' : 'active'}.`, 'INFO');
  };

  // Delete Training with Dependency Check
  const handleDeleteTraining = (t: Training) => {
    const linkedSessions = state.trainingSessions.filter(s => s.trainingId === t.id);

    if (linkedSessions.length > 0) {
      if (confirm(`⚠️ Attention : Cette formation possède ${linkedSessions.length} session(s) de cours planifiée(s) ou archivée(s).\n\nPour préserver la cohérence des inscriptions et certificats, il est recommandé de la DÉSACTIVER.\n\nVoulez-vous désactiver la formation "${t.title}" ?`)) {
        handleToggleTrainingActive(t);
      }
      return;
    }

    if (confirm(`Confirmez-vous la suppression définitive de la formation "${t.title}" du catalogue ?`)) {
      dbStore.updateState(draft => {
        draft.trainings = draft.trainings.filter(item => item.id !== t.id);
      });
      dbStore.logAudit('TRAINING_DELETED', 'TRAINING', t.id, null, { title: t.title });
      showToast('Formation Supprimée', `La formation "${t.title}" a été retirée du catalogue.`, 'SUCCESS');
    }
  };

  // Filtered trainings for catalogue
  const filteredTrainings = useMemo(() => {
    return state.trainings.filter(t => {
      const matchesSearch =
        t.title.toLowerCase().includes(catalogueSearch.toLowerCase()) ||
        t.code.toLowerCase().includes(catalogueSearch.toLowerCase()) ||
        (t.categoryName && t.categoryName.toLowerCase().includes(catalogueSearch.toLowerCase())) ||
        (t.description && t.description.toLowerCase().includes(catalogueSearch.toLowerCase()));

      const matchesCategory = catalogueCategoryFilter === 'ALL' || t.categoryId === catalogueCategoryFilter;

      let matchesStatus = true;
      if (catalogueStatusFilter === 'ACTIVE') matchesStatus = t.isActive !== false;
      else if (catalogueStatusFilter === 'INACTIVE') matchesStatus = t.isActive === false;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [state.trainings, catalogueSearch, catalogueCategoryFilter, catalogueStatusFilter]);

  // ==========================================
  // CATEGORIES STATE & HANDLERS
  // ==========================================
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<TrainingCategory | null>(null);
  const [categoryToView, setCategoryToView] = useState<TrainingCategory | null>(null);

  // Category Form fields
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catIcon, setCatIcon] = useState('BookOpen');
  const [catColor, setCatColor] = useState('#3b82f6');
  const [catSortOrder, setCatSortOrder] = useState(1);
  const [catIsActive, setCatIsActive] = useState(true);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return (state.trainingCategories || []).filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(categorySearch.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(categorySearch.toLowerCase()));

      let matchesStatus = true;
      if (categoryStatusFilter === 'ACTIVE') matchesStatus = c.isActive !== false;
      else if (categoryStatusFilter === 'INACTIVE') matchesStatus = c.isActive === false;

      return matchesSearch && matchesStatus;
    }).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [state.trainingCategories, categorySearch, categoryStatusFilter]);

  // Open Create Category Modal
  const handleOpenCreateCategory = () => {
    setCatName('');
    setCatCode('');
    setCatDescription('');
    setCatIcon('BookOpen');
    setCatColor('#3b82f6');
    setCatSortOrder((state.trainingCategories?.length || 0) + 1);
    setCatIsActive(true);
    setIsNewCategoryModalOpen(true);
  };

  // Submit Create Category
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catCode.trim()) {
      showToast('Erreur', 'Veuillez saisir le nom et le code de la catégorie.', 'DANGER');
      return;
    }

    const newId = `tc-${Date.now()}`;
    const newCategory: TrainingCategory = {
      id: newId,
      tenantId: currentTenant?.id || 't-001',
      code: catCode.toUpperCase().trim(),
      name: catName.trim(),
      description: catDescription.trim(),
      icon: catIcon,
      color: catColor,
      sortOrder: catSortOrder,
      isActive: catIsActive,
      createdAt: new Date().toISOString()
    };

    dbStore.updateState(draft => {
      if (!draft.trainingCategories) draft.trainingCategories = [];
      draft.trainingCategories.push(newCategory);
    });

    dbStore.logAudit('TRAINING_CATEGORY_CREATED', 'TRAINING_CATEGORY', newId, null, {
      name: catName,
      code: catCode
    });

    showToast('Catégorie Créée', `La catégorie "${catName}" a été ajoutée.`, 'SUCCESS');
    setIsNewCategoryModalOpen(false);
  };

  // Open Edit Category Modal
  const handleOpenEditCategory = (cat: TrainingCategory) => {
    setCategoryToEdit(cat);
    setCatName(cat.name);
    setCatCode(cat.code);
    setCatDescription(cat.description || '');
    setCatIcon(cat.icon || 'BookOpen');
    setCatColor(cat.color || '#3b82f6');
    setCatSortOrder(cat.sortOrder || 1);
    setCatIsActive(cat.isActive !== false);
  };

  // Submit Edit Category with Automatic Propagation
  const handleSaveEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryToEdit) return;

    const oldName = categoryToEdit.name;
    const newNameTrimmed = catName.trim();

    dbStore.updateState(draft => {
      const category = (draft.trainingCategories || []).find(c => c.id === categoryToEdit.id);
      if (category) {
        category.name = newNameTrimmed;
        category.code = catCode.toUpperCase().trim();
        category.description = catDescription.trim();
        category.icon = catIcon;
        category.color = catColor;
        category.sortOrder = catSortOrder;
        category.isActive = catIsActive;
        category.updatedAt = new Date().toISOString();
      }

      // AUTOMATIC PROPAGATION: Update categoryName on all associated trainings!
      (draft.trainings || []).forEach(t => {
        if (t.categoryId === categoryToEdit.id) {
          t.categoryName = newNameTrimmed;
        }
      });
    });

    dbStore.logAudit('TRAINING_CATEGORY_UPDATED', 'TRAINING_CATEGORY', categoryToEdit.id, { name: oldName }, { name: newNameTrimmed, code: catCode });
    showToast('Catégorie Mise à Jour', `La catégorie "${newNameTrimmed}" a été modifiée et répercutée sur toutes ses formations.`, 'SUCCESS');
    setCategoryToEdit(null);
  };

  // Toggle Category Active/Inactive
  const handleToggleCategoryActive = (cat: TrainingCategory) => {
    dbStore.updateState(draft => {
      const category = (draft.trainingCategories || []).find(c => c.id === cat.id);
      if (category) {
        category.isActive = !category.isActive;
        category.updatedAt = new Date().toISOString();
      }
    });

    dbStore.logAudit('TRAINING_CATEGORY_STATUS_TOGGLED', 'TRAINING_CATEGORY', cat.id, { isActive: cat.isActive }, { isActive: !cat.isActive });
    showToast(cat.isActive ? 'Catégorie Désactivée' : 'Catégorie Réactivée', `La catégorie "${cat.name}" est désormais ${cat.isActive ? 'inactive' : 'active'}.`, 'INFO');
  };

  // Delete Category with Dependency Integrity Check
  const handleDeleteCategory = (cat: TrainingCategory) => {
    const linkedTrainings = state.trainings.filter(t => t.categoryId === cat.id);

    if (linkedTrainings.length > 0) {
      if (confirm(`⚠️ Attention : Cette catégorie est actuellement utilisée par ${linkedTrainings.length} formation(s).\n\nPour préserver l'historique pédagogique, il est recommandé de la DÉSACTIVER plutôt que de la supprimer.\n\nVoulez-vous désactiver la catégorie "${cat.name}" ?`)) {
        handleToggleCategoryActive(cat);
      }
      return;
    }

    if (confirm(`Confirmez-vous la suppression définitive de la catégorie "${cat.name}" ?`)) {
      dbStore.updateState(draft => {
        draft.trainingCategories = (draft.trainingCategories || []).filter(c => c.id !== cat.id);
      });
      dbStore.logAudit('TRAINING_CATEGORY_DELETED', 'TRAINING_CATEGORY', cat.id, null, { name: cat.name });
      showToast('Catégorie Supprimée', `La catégorie "${cat.name}" a été supprimée.`, 'SUCCESS');
    }
  };

  // ==========================================
  // SESSIONS STATE & HANDLERS
  // ==========================================
  // New Session Form
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [sessionTrainingId, setSessionTrainingId] = useState(state.trainings[0]?.id || '');
  const [sessionStartDate, setSessionStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionEndDate, setSessionEndDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [sessionSchedule, setSessionSchedule] = useState('Lun-Mer-Ven 14h-17h');
  const [sessionTrainerId, setSessionTrainerId] = useState(state.persons.find(p => p.types.includes('TRAINER'))?.id || '');
  const [sessionClassroomId, setSessionClassroomId] = useState(state.classrooms[0]?.id || '');
  const [sessionCapacity, setSessionCapacity] = useState(15);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const training = state.trainings.find(t => t.id === sessionTrainingId);
    const trainer = state.persons.find(p => p.id === sessionTrainerId);
    const classroom = state.classrooms.find(c => c.id === sessionClassroomId);

    const sessionSeq = state.trainingSessions.length + 1;
    const sessionCode = `SESS-2026-${training?.code || 'TR'}-${sessionSeq.toString().padStart(2, '0')}`;
    const newSessionId = `sess-${Date.now()}`;

    dbStore.updateState(draft => {
      draft.trainingSessions.unshift({
        id: newSessionId,
        tenantId: currentTenant?.id || 't-001',
        trainingId: sessionTrainingId,
        trainingTitle: training?.title || 'Formation',
        trainingCode: training?.code || 'TR',
        sessionCode,
        trainerId: sessionTrainerId,
        trainerName: trainer ? `${trainer.firstName} ${trainer.lastName}` : undefined,
        classroomId: sessionClassroomId,
        classroomName: classroom?.name,
        startDate: sessionStartDate,
        endDate: sessionEndDate,
        scheduleDescription: sessionSchedule,
        capacity: sessionCapacity,
        enrolledCount: 0,
        status: 'OPEN',
        price: training?.price || 1000000
      });
    });

    showToast('Session planifiée', `Session ${sessionCode} ouverte aux inscriptions.`, 'SUCCESS');
    setIsNewSessionModalOpen(false);
  };

  const handleIssueCertificate = (enrollment: Enrollment) => {
    const certNumber = generateDocNumber('CERT', state.certificates.length + 1);
    const certId = `cert-${Date.now()}`;
    const signatures = currentTenant?.settings?.digitalSignatures || [];
    const dirSig = signatures.find(s => s.type === 'DIRECTOR' && s.isActive);
    const trainerSig = signatures.find(s => s.type === 'TRAINER' && s.isActive);
    const stamp = signatures.find(s => s.type === 'STAMP' && s.isActive);

    dbStore.updateState(draft => {
      draft.certificates.unshift({
        id: certId,
        tenantId: currentTenant?.id || 't-001',
        sessionId: enrollment.sessionId,
        trainingTitle: enrollment.trainingTitle,
        trainingDurationHours: 60,
        learnerId: enrollment.learnerId,
        learnerName: enrollment.learnerName,
        certificateCode: certNumber,
        issueDate: new Date().toISOString().split('T')[0],
        finalScore: 18,
        mention: 'TRES_BIEN',
        signatureName: dirSig?.signerName || currentTenant?.settings?.certificateSignerName || 'M. Eric BOTHIE',
        signatureTitle: dirSig?.signerTitle || currentTenant?.settings?.certificateSignerTitle || 'Directeur Général du Centre',
        directorSignatureUrl: dirSig?.imageUrl,
        directorSignerName: dirSig?.signerName,
        directorSignerTitle: dirSig?.signerTitle,
        trainerSignatureUrl: trainerSig?.imageUrl,
        trainerSignerName: trainerSig?.signerName || 'M. Ousmane Soumah',
        trainerSignerTitle: trainerSig?.signerTitle || 'Formateur Référent',
        officialStampUrl: stamp?.imageUrl,
        signatureVersion: dirSig?.version || 1,
        qrCodeData: `https://cms.nicost-guinee.com/verify/certificate/${certNumber}`,
        isValid: true
      });

      draft.notifications.unshift({
        id: `notif-cert-${Date.now()}`,
        tenantId: currentTenant?.id || 't-001',
        title: 'Certificat Généré',
        message: `Le certificat officiel ${certNumber} a été délivré à ${enrollment.learnerName}.`,
        type: 'SUCCESS',
        link: '/training',
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    dbStore.logAudit('CERTIFICATE_ISSUED', 'CERTIFICATE', certId, null, {
      certNumber,
      learner: enrollment.learnerName
    });

    showToast('Certificat Généré', `Certificat ${certNumber} créé avec QR Code.`, 'SUCCESS');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-emerald-500" />
            Pôle Formation & LMS Intégré
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gestion du catalogue des formations, catégories, sessions, émargements et certificats officiels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" icon={Plus} onClick={handleOpenNewTrainingModal}>
            Nouvelle Formation
          </Button>
          <Button variant="primary" icon={Users} onClick={onOpenQuickEnrollment}>
            Inscrire un Apprenant
          </Button>
        </div>
      </div>

      {/* Tabs Menu with Categories Tab */}
      <Tabs
        tabs={[
          { id: 'catalogue', label: 'Catalogue des Formations', icon: BookOpen, count: state.trainings.length },
          { id: 'categories', label: 'Catégories de Formation', icon: Layers, count: (state.trainingCategories || []).length },
          { id: 'sessions', label: 'Sessions & Salles', icon: Calendar, count: state.trainingSessions.length },
          { id: 'inscriptions', label: 'Inscriptions', icon: Users, count: state.enrollments.length },
          { id: 'presences', label: 'Feuille de Présences', icon: UserCheck },
          { id: 'notes', label: 'Évaluations & Notes', icon: FileCheck2 },
          { id: 'certificats', label: 'Certificats Délivrés', icon: Award, count: state.certificates.length },
        ]}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as any)}
      />

      {/* ========================================================================= */}
      {/* TAB 1: CATALOGUE DES FORMATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'catalogue' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher une formation par titre, code..."
                  value={catalogueSearch}
                  onChange={(e) => setCatalogueSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <select
                value={catalogueCategoryFilter}
                onChange={(e) => setCatalogueCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">Toutes les catégories</option>
                {(state.trainingCategories || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={catalogueStatusFilter}
                onChange={(e) => setCatalogueStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">🟢 Actives uniquement</option>
                <option value="INACTIVE">🔴 Inactives uniquement</option>
              </select>
            </div>
          </Card>

          {/* Training Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrainings.map(t => (
              <Card
                key={t.id}
                className={`flex flex-col justify-between hover:border-emerald-500/50 transition-all ${
                  t.isActive === false ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/30' : ''
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="primary" size="sm">{t.code}</Badge>
                        <Badge variant="secondary" size="sm">{t.level}</Badge>
                      </div>
                      <Badge variant={t.isActive !== false ? 'success' : 'danger'} size="sm">
                        {t.isActive !== false ? '🟢 Active' : '🔴 Inactive'}
                      </Badge>
                    </div>

                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md inline-block">
                      {t.categoryName || 'Informatique & Bureautique'}
                    </span>

                    <CardTitle className="text-base font-extrabold text-slate-900 dark:text-white line-clamp-1">
                      {t.title}
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {t.description || 'Formation professionnelle de haut niveau animée par des formateurs certifiés.'}
                  </p>

                  {t.modules && t.modules.length > 0 && (
                    <div className="space-y-1 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Programme ({t.modules.length} Modules)
                      </span>
                      {t.modules.slice(0, 3).map(m => (
                        <div key={m.id} className="flex justify-between text-slate-700 dark:text-slate-300">
                          <span className="truncate">{m.title}</span>
                          <span className="text-slate-400 font-semibold">{m.durationHours}h</span>
                        </div>
                      ))}
                      {t.modules.length > 3 && (
                        <span className="text-[10px] text-slate-400 italic block">+{t.modules.length - 3} autres modules...</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{t.durationHours} Heures</span>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(t.price)}
                    </span>
                  </div>

                  {/* Actions Bar on Card */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Eye}
                      onClick={() => setTrainingToView(t)}
                    >
                      Détails
                    </Button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditTraining(t)}
                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-lg transition-colors"
                        title="Modifier la formation"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleToggleTrainingActive(t)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          t.isActive !== false
                            ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                        title={t.isActive !== false ? "Désactiver la formation" : "Réactiver la formation"}
                      >
                        <Power className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteTraining(t)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Supprimer du catalogue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GESTION DES CATÉGORIES DE FORMATION */}
      {/* ========================================================================= */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou code de catégorie..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <select
                value={categoryStatusFilter}
                onChange={(e) => setCategoryStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">Toutes les catégories</option>
                <option value="ACTIVE">🟢 Actives uniquement</option>
                <option value="INACTIVE">🔴 Inactives uniquement</option>
              </select>
            </div>

            <Button variant="primary" icon={FolderPlus} onClick={handleOpenCreateCategory}>
              Ajouter une Catégorie
            </Button>
          </div>

          {/* Categories Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie & Description</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Formations Associées</TableHead>
                  <TableHead>Ordre</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map(cat => {
                  const linkedTrainingsCount = state.trainings.filter(t => t.categoryId === cat.id).length;

                  return (
                    <TableRow key={cat.id} className={cat.isActive === false ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/30' : ''}>
                      <TableCell>
                        <div className="flex items-start gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm"
                            style={{ backgroundColor: cat.color || '#3b82f6' }}
                          >
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 dark:text-white block">
                              {cat.name}
                            </span>
                            <span className="text-[11px] text-slate-400 line-clamp-1">
                              {cat.description || 'Aucune description'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
                          {cat.code}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                          {linkedTrainingsCount}
                        </span>
                        <span className="text-[10px] text-slate-400 block">cours au catalogue</span>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs font-semibold text-slate-500">
                          #{cat.sortOrder || 1}
                        </span>
                      </TableCell>

                      <TableCell>
                        {cat.isActive !== false ? (
                          <Badge variant="success" size="sm">🟢 Active</Badge>
                        ) : (
                          <Badge variant="danger" size="sm">🔴 Inactive</Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setCategoryToView(cat)}
                            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Consulter les détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEditCategory(cat)}
                            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-lg transition-colors"
                            title="Modifier la catégorie"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleCategoryActive(cat)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              cat.isActive !== false
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                            title={cat.isActive !== false ? "Désactiver la catégorie" : "Réactiver la catégorie"}
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Supprimer la catégorie"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SESSIONS */}
      {/* ========================================================================= */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" icon={Plus} onClick={() => setIsNewSessionModalOpen(true)}>
              Planifier une Session
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code & Formation</TableHead>
                  <TableHead>Dates & Horaires</TableHead>
                  <TableHead>Formateur</TableHead>
                  <TableHead>Salle & Jauge</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.trainingSessions.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="font-bold text-xs text-amber-600 block">{s.sessionCode}</span>
                      <span className="font-semibold text-xs text-slate-900 dark:text-white">{s.trainingTitle}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-700 dark:text-slate-300 block">
                        Du {formatDate(s.startDate, 'dd MMM')} au {formatDate(s.endDate, 'dd MMM yyyy')}
                      </span>
                      <span className="text-[11px] text-slate-400">{s.scheduleDescription || 'Horaires en journée'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {s.trainerName || 'Non assigné'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-700 dark:text-slate-300 block">{s.classroomName || 'Salle B'}</span>
                      <span className="text-[11px] font-bold text-emerald-600">{s.enrolledCount} / {s.capacity} places</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="primary" size="sm">{s.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: INSCRIPTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'inscriptions' && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Inscription</TableHead>
                <TableHead>Apprenant</TableHead>
                <TableHead>Formation</TableHead>
                <TableHead>Montant Facturé</TableHead>
                <TableHead>Règlement</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.enrollments.map(e => (
                <TableRow key={e.id}>
                  <TableCell>
                    <span className="font-mono text-xs font-bold text-brand-600">{e.enrollmentNumber}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">{e.learnerName}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{e.trainingTitle}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-bold">{formatCurrency(e.finalAmount)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-bold text-emerald-600">{formatCurrency(e.paidAmount)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.status === 'CONFIRMED' ? 'success' : 'warning'} size="sm">
                      {e.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: FEUILLE DE PRÉSENCES */}
      {/* ========================================================================= */}
      {activeTab === 'presences' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <CardTitle className="text-sm font-bold">Feuille d'Émargement Pédagogique</CardTitle>
              <p className="text-xs text-slate-500">Pointage des présences des apprenants pour la session sélectionnée.</p>
            </div>
            <select
              value={selectedSessionForAttendance}
              onChange={(e) => setSelectedSessionForAttendance(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
            >
              {state.trainingSessions.map(s => (
                <option key={s.id} value={s.id}>{s.sessionCode} - {s.trainingTitle}</option>
              ))}
            </select>
          </div>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 text-xs flex items-center justify-between">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              Session sélectionnée : <strong>{state.trainingSessions.find(s => s.id === selectedSessionForAttendance)?.trainingTitle}</strong>
            </span>
            <Button size="sm" variant="primary" icon={CheckCircle}>
              Valider l'Émargement du Jour
            </Button>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: NOTES & ÉVALUATIONS */}
      {activeTab === 'notes' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <CardTitle className="text-sm font-bold">Saisie des Notes & Bulletins de Formation</CardTitle>
              <p className="text-xs text-slate-500">Notation des modules et calcul de la moyenne générale.</p>
            </div>
            <select
              value={selectedSessionForGrading}
              onChange={(e) => setSelectedSessionForGrading(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
            >
              {state.trainingSessions.map(s => (
                <option key={s.id} value={s.id}>{s.sessionCode} - {s.trainingTitle}</option>
              ))}
            </select>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              Sélectionnez une session pour afficher la liste des apprenants et saisir les notes d'évaluation sur 20.
            </p>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: CERTIFICATS DÉLIVRÉS */}
      {/* ========================================================================= */}
      {activeTab === 'certificats' && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Certificat</TableHead>
                <TableHead>Apprenant Certifié</TableHead>
                <TableHead>Formation Validée</TableHead>
                <TableHead>Moyenne & Mention</TableHead>
                <TableHead>Date Délivrance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.certificates.map(cert => (
                <TableRow key={cert.id}>
                  <TableCell>
                    <span className="font-mono text-xs font-extrabold text-amber-600 block">{cert.certificateCode}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">{cert.learnerName}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{cert.trainingTitle}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-extrabold text-emerald-600 block">{cert.finalScore} / 20</span>
                    <Badge variant="success" size="sm">{cert.mention || 'ADMIS'}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-500">{formatDate(cert.issueDate, 'dd MMM yyyy')}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Eye}
                        onClick={() => setSelectedCertificate(cert)}
                      >
                        Aperçu Certificat
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        icon={CheckCircle2}
                        onClick={() => onSelectCertificateToVerify?.(cert.certificateCode)}
                      >
                        Vérifier QR
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* MODAL: AJOUTER UNE FORMATION AU CATALOGUE */}
      {isNewTrainingModalOpen && (
        <Modal
          isOpen={isNewTrainingModalOpen}
          onClose={() => setIsNewTrainingModalOpen(false)}
          title="Ajouter une Formation au Catalogue"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateTraining} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Titre de la Formation *"
                placeholder="ex: Développement Web Full-Stack"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
              <Input
                label="Code Unique *"
                placeholder="ex: FORM-DEV-01"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Catégorie Pédagogique <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newCategoryId || (activeCategories[0]?.id || '')}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-brand-500 focus:outline-none cursor-pointer"
                  required
                >
                  {activeCategories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {activeCategories.length === 0 && (
                    <option value="tc-01">Informatique & Bureautique</option>
                  )}
                </select>
              </div>

              <Select
                label="Niveau Requis"
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value as any)}
                options={[
                  { value: 'DEBUTANT', label: 'Débutant' },
                  { value: 'INTERMEDIAIRE', label: 'Intermédiaire' },
                  { value: 'AVANCE', label: 'Avancé' },
                  { value: 'TOUS_NIVEAUX', label: 'Tous Niveaux' },
                ]}
              />
              <Input
                label="Durée Globale (Heures)"
                type="number"
                value={newDuration}
                onChange={(e) => setNewDuration(parseInt(e.target.value) || 1)}
              />
            </div>

            <Input
              label="Tarif d'Inscription (GNF)"
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(parseInt(e.target.value) || 0)}
            />

            <Input
              label="Description Pédagogique & Objectifs"
              placeholder="Objectifs de la formation, prérequis..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsNewTrainingModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" icon={Plus}>
                Enregistrer la Formation
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: MODIFIER UNE FORMATION */}
      {trainingToEdit && (
        <Modal
          isOpen={Boolean(trainingToEdit)}
          onClose={() => setTrainingToEdit(null)}
          title={`Modifier la Formation : ${trainingToEdit.title}`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveEditTraining} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Titre de la Formation *"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
              <Input
                label="Code Unique *"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Catégorie Pédagogique <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-brand-500 focus:outline-none cursor-pointer"
                  required
                >
                  {(state.trainingCategories || []).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isActive === false ? '(Inactive)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <Select
                label="Niveau Requis"
                value={editLevel}
                onChange={(e) => setEditLevel(e.target.value as any)}
                options={[
                  { value: 'DEBUTANT', label: 'Débutant' },
                  { value: 'INTERMEDIAIRE', label: 'Intermédiaire' },
                  { value: 'AVANCE', label: 'Avancé' },
                  { value: 'TOUS_NIVEAUX', label: 'Tous Niveaux' },
                ]}
              />

              <Input
                label="Durée Globale (Heures)"
                type="number"
                value={editDuration}
                onChange={(e) => setEditDuration(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Tarif d'Inscription (GNF)"
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(parseInt(e.target.value) || 0)}
              />

              <Select
                label="Statut de la Formation"
                value={editIsActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => setEditIsActive(e.target.value === 'ACTIVE')}
                options={[
                  { value: 'ACTIVE', label: '🟢 Active (Visible au catalogue)' },
                  { value: 'INACTIVE', label: '🔴 Inactive (Désactivée)' },
                ]}
              />
            </div>

            <Input
              label="Description & Objectifs"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setTrainingToEdit(null)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary">
                Enregistrer les Modifications
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: FICHE DÉTAILLÉE FORMATION */}
      {trainingToView && (
        <Modal
          isOpen={Boolean(trainingToView)}
          onClose={() => setTrainingToView(null)}
          title={`Fiche Formation : ${trainingToView.title}`}
          maxWidth="lg"
        >
          <div className="space-y-4 pt-1 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="primary">{trainingToView.code}</Badge>
                  <Badge variant="secondary">{trainingToView.level}</Badge>
                  <span className="font-bold text-slate-600 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                    {trainingToView.categoryName}
                  </span>
                </div>
                <Badge variant={trainingToView.isActive !== false ? 'success' : 'danger'}>
                  {trainingToView.isActive !== false ? '🟢 Active' : '🔴 Inactive'}
                </Badge>
              </div>

              <p className="text-slate-700 dark:text-slate-300 text-sm font-semibold">
                {trainingToView.description || 'Formation professionnelle professionnalisante.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block text-[11px]">Durée de Formation :</span>
                  <span className="font-bold text-slate-900 dark:text-white">{trainingToView.durationHours} Heures</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tarif d'Inscription :</span>
                  <span className="font-extrabold text-emerald-600">{formatCurrency(trainingToView.price)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Sessions Ouvertes :</span>
                  <span className="font-bold text-brand-600">
                    {state.trainingSessions.filter(s => s.trainingId === trainingToView.id).length} session(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Modules list */}
            {trainingToView.modules && trainingToView.modules.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                  Programme & Découpage Pédagogique :
                </h5>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  {trainingToView.modules.map(m => (
                    <div key={m.id} className="p-3 flex items-center justify-between bg-white dark:bg-slate-900">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{m.title}</span>
                      <span className="font-mono font-bold text-slate-500">{m.durationHours}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => setTrainingToView(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: AJOUTER UNE CATÉGORIE */}
      {isNewCategoryModalOpen && (
        <Modal
          isOpen={isNewCategoryModalOpen}
          onClose={() => setIsNewCategoryModalOpen(false)}
          title="Ajouter une Catégorie de Formation"
          maxWidth="md"
        >
          <form onSubmit={handleCreateCategory} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nom de la catégorie *"
                placeholder="ex: Informatique & Bureautique"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                required
              />
              <Input
                label="Code unique *"
                placeholder="ex: INFO"
                value={catCode}
                onChange={(e) => setCatCode(e.target.value)}
                required
              />
            </div>

            <Input
              label="Description"
              placeholder="Description des thématiques abordées..."
              value={catDescription}
              onChange={(e) => setCatDescription(e.target.value)}
            />

            <div className="grid grid-cols-3 gap-3">
              <Select
                label="Icône visuelle"
                value={catIcon}
                onChange={(e) => setCatIcon(e.target.value)}
                options={[
                  { value: 'BookOpen', label: '📖 Livre / Pédagogie' },
                  { value: 'Laptop', label: '💻 Informatique & Web' },
                  { value: 'Palette', label: '🎨 Design & Graphisme' },
                  { value: 'Calculator', label: '🧮 Comptabilité & Caisse' },
                  { value: 'GraduationCap', label: '🎓 Diplôme & Général' },
                ]}
              />
              <Input
                label="Couleur badge"
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
              />
              <Input
                label="Ordre d'affichage"
                type="number"
                value={catSortOrder}
                onChange={(e) => setCatSortOrder(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsNewCategoryModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" icon={Plus}>
                Créer la Catégorie
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: MODIFIER UNE CATÉGORIE (AVEC PROPAGATION AUTO) */}
      {categoryToEdit && (
        <Modal
          isOpen={Boolean(categoryToEdit)}
          onClose={() => setCategoryToEdit(null)}
          title={`Modifier la Catégorie : ${categoryToEdit.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveEditCategory} className="space-y-4 pt-1">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
              <span>
                💡 <strong>Propagation automatique :</strong> La modification du nom de cette catégorie sera automatiquement mise à jour sur toutes les formations qui lui sont rattachées.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nom de la catégorie *"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                required
              />
              <Input
                label="Code unique *"
                value={catCode}
                onChange={(e) => setCatCode(e.target.value)}
                required
              />
            </div>

            <Input
              label="Description"
              value={catDescription}
              onChange={(e) => setCatDescription(e.target.value)}
            />

            <div className="grid grid-cols-3 gap-3">
              <Select
                label="Icône visuelle"
                value={catIcon}
                onChange={(e) => setCatIcon(e.target.value)}
                options={[
                  { value: 'BookOpen', label: '📖 Livre / Pédagogie' },
                  { value: 'Laptop', label: '💻 Informatique & Web' },
                  { value: 'Palette', label: '🎨 Design & Graphisme' },
                  { value: 'Calculator', label: '🧮 Comptabilité & Caisse' },
                  { value: 'GraduationCap', label: '🎓 Diplôme & Général' },
                ]}
              />
              <Input
                label="Couleur badge"
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
              />
              <Select
                label="Statut"
                value={catIsActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => setCatIsActive(e.target.value === 'ACTIVE')}
                options={[
                  { value: 'ACTIVE', label: '🟢 Active (Visible)' },
                  { value: 'INACTIVE', label: '🔴 Inactive (Désactivée)' },
                ]}
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setCategoryToEdit(null)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary">
                Enregistrer les Modifications
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: CONSULTER UNE CATÉGORIE */}
      {categoryToView && (
        <Modal
          isOpen={Boolean(categoryToView)}
          onClose={() => setCategoryToView(null)}
          title={`Fiche Catégorie : ${categoryToView.name}`}
          maxWidth="md"
        >
          <div className="space-y-4 pt-1 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{categoryToView.name}</span>
                <Badge variant={categoryToView.isActive !== false ? 'success' : 'danger'} size="sm">
                  {categoryToView.isActive !== false ? '🟢 Active' : '🔴 Inactive'}
                </Badge>
              </div>
              <p className="text-slate-600 dark:text-slate-300">{categoryToView.description || 'Aucune description'}</p>
              <span className="font-mono text-brand-600 font-bold block">Code : {categoryToView.code}</span>
            </div>

            <div className="space-y-2">
              <h5 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                Formations rattachées à cette catégorie :
              </h5>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {state.trainings
                  .filter(t => t.categoryId === categoryToView.id)
                  .map(t => (
                    <div key={t.id} className="p-3 flex items-center justify-between bg-white dark:bg-slate-900">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{t.title}</span>
                        <span className="text-[10px] text-slate-400">{t.code} • {t.durationHours} heures</span>
                      </div>
                      <span className="font-extrabold text-emerald-600">{formatCurrency(t.price)}</span>
                    </div>
                  ))}
                {state.trainings.filter(t => t.categoryId === categoryToView.id).length === 0 && (
                  <div className="p-4 text-center text-slate-400">
                    Aucune formation rattachée à cette catégorie.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => setCategoryToView(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: PLANIFIER UNE SESSION */}
      {isNewSessionModalOpen && (
        <Modal
          isOpen={isNewSessionModalOpen}
          onClose={() => setIsNewSessionModalOpen(false)}
          title="Planifier une Nouvelle Session de Cours"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateSession} className="space-y-4 pt-1">
            <Select
              label="Formation à planifier *"
              value={sessionTrainingId}
              onChange={(e) => setSessionTrainingId(e.target.value)}
              options={state.trainings.map(t => ({ value: t.id, label: `${t.code} - ${t.title}` }))}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Date de début *"
                type="date"
                value={sessionStartDate}
                onChange={(e) => setSessionStartDate(e.target.value)}
                required
              />
              <Input
                label="Date de fin estimée *"
                type="date"
                value={sessionEndDate}
                onChange={(e) => setSessionEndDate(e.target.value)}
                required
              />
            </div>

            <Input
              label="Horaires & Fréquence"
              placeholder="ex: Lun-Mer-Ven de 14h à 17h"
              value={sessionSchedule}
              onChange={(e) => setSessionSchedule(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Formateur Responsable"
                value={sessionTrainerId}
                onChange={(e) => setSessionTrainerId(e.target.value)}
                options={state.persons.filter(p => p.types.includes('TRAINER')).map(p => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName}`
                }))}
              />
              <Select
                label="Salle de Formation"
                value={sessionClassroomId}
                onChange={(e) => setSessionClassroomId(e.target.value)}
                options={state.classrooms.map(c => ({ value: c.id, label: `${c.name} (${c.capacity} places)` }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsNewSessionModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary">
                Ouvrir la Session
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: APERÇU CERTIFICAT OFFICIEL AVEC QR CODE */}
      {selectedCertificate && (
        <Modal
          isOpen={Boolean(selectedCertificate)}
          onClose={() => setSelectedCertificate(null)}
          title="Aperçu du Certificat Officiel"
          maxWidth="lg"
        >
          <div className="space-y-4 pt-1">
            <div className="p-8 bg-white text-slate-900 border-4 border-double border-amber-600 rounded-2xl shadow-xl text-center relative overflow-hidden space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black tracking-widest text-amber-700 uppercase">
                  RÉPUBLIQUE DE GUINÉE • MINISTÈRE DE L'ENSEIGNEMENT TECHNIQUE
                </span>
                <h3 className="text-xl font-serif font-black text-slate-900">
                  {currentTenant?.name || 'CENTRE DE PRESTATION & FORMATION'}
                </h3>
              </div>

              <div className="py-2">
                <span className="text-xs font-serif italic text-slate-600 block">Le présent certificat est décerné avec les félicitations à :</span>
                <h4 className="text-2xl font-serif font-extrabold text-slate-900 mt-1 uppercase tracking-wide">
                  {selectedCertificate.learnerName}
                </h4>
              </div>

              <p className="text-xs text-slate-700 max-w-lg mx-auto">
                Pour avoir suivi avec succès et validé l'ensemble des modules d'évaluation de la formation professionnelle :
              </p>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 inline-block">
                <span className="font-extrabold text-sm text-amber-900 block">{selectedCertificate.trainingTitle}</span>
                <span className="text-xs text-amber-700">Mention : {selectedCertificate.mention || 'TRÈS BIEN'} • Score : {selectedCertificate.finalScore}/20</span>
              </div>

              {/* Signatures Tri-block */}
              {(() => {
                const signatures = currentTenant?.settings?.digitalSignatures || [];
                const dirSig = signatures.find(s => s.type === 'DIRECTOR');
                const trainerSig = signatures.find(s => s.type === 'TRAINER');
                const stamp = signatures.find(s => s.type === 'STAMP');

                const dirImg = selectedCertificate.directorSignatureUrl || dirSig?.imageUrl;
                const trainerImg = selectedCertificate.trainerSignatureUrl || trainerSig?.imageUrl;
                const stampImg = selectedCertificate.officialStampUrl || stamp?.imageUrl;
                const dirName = selectedCertificate.directorSignerName || selectedCertificate.signatureName || 'M. Eric BOTHIE';
                const dirTitle = selectedCertificate.directorSignerTitle || selectedCertificate.signatureTitle || 'Directeur Général';
                const trainerName = selectedCertificate.trainerSignerName || 'M. Ousmane Soumah';
                const trainerTitle = selectedCertificate.trainerSignerTitle || 'Formateur Référent';

                return (
                  <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-3 items-end text-xs">
                    {/* 1. Trainer Signature */}
                    <div className="text-center space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold">Le Formateur :</span>
                      <div className="min-h-[48px] flex items-center justify-center">
                        {trainerImg ? (
                          <img src={trainerImg} alt="Signature Formateur" className="h-12 w-auto object-contain" />
                        ) : (
                          <div className="w-24 border-b border-slate-300 my-2" />
                        )}
                      </div>
                      <span className="font-serif font-bold text-slate-800 text-[11px] block">{trainerName}</span>
                      <span className="text-[9px] text-slate-400 block">{trainerTitle}</span>
                    </div>

                    {/* 2. Official Stamp & QR Code */}
                    <div className="flex flex-col items-center justify-center space-y-1 relative">
                      <div className="relative flex items-center justify-center">
                        <QRCodeSVG value={selectedCertificate.qrCodeData} size={54} />
                        {stampImg && (
                          <img
                            src={stampImg}
                            alt="Cachet"
                            className="absolute -top-3 -right-3 h-14 w-14 object-contain opacity-55 pointer-events-none"
                          />
                        )}
                      </div>
                      <span className="font-mono font-bold text-[9px] text-slate-900">{selectedCertificate.certificateCode}</span>
                      <span className="text-[8px] text-emerald-600 font-bold uppercase">Authenticité Certifiée</span>
                    </div>

                    {/* 3. Director Signature */}
                    <div className="text-center space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold">Le Directeur Général :</span>
                      <div className="min-h-[48px] flex items-center justify-center">
                        {dirImg ? (
                          <img src={dirImg} alt="Signature Directeur" className="h-12 w-auto object-contain" />
                        ) : (
                          <div className="w-24 border-b border-slate-300 my-2" />
                        )}
                      </div>
                      <span className="font-serif font-bold text-slate-800 text-[11px] block">{dirName}</span>
                      <span className="text-[9px] text-slate-400 block">{dirTitle}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedCertificate(null)}>
                Fermer
              </Button>
              <Button variant="primary" icon={Printer} onClick={() => window.print()}>
                Imprimer le Diplôme
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
