import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { isValidPhoneNumber } from '../../lib/phoneValidation';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { dbStore } from '../../server/db/mockStore';
import { checkAccountLockout } from '../../server/security/securityEngine';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Tenant, ActivityType, AgencyStatus, LicensePlan, User, AuditLog, Order, Person } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { ACTIVITY_TYPES_CONFIG } from '../../lib/moduleRegistry';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Building2, Store, UtensilsCrossed, PackageCheck, Plus, Search,
  TrendingUp, ShieldCheck, ShieldAlert, KeyRound, Clock, Users,
  ArrowRight, RefreshCw, Lock, Unlock, AlertTriangle, CheckCircle2,
  Building, DollarSign, Activity, Eye, Sparkles, ExternalLink,
  Crown, UserCheck, Shield, History, Settings, CreditCard, BarChart3,
  Sliders, Globe, Filter, Check, HelpCircle, Archive, RotateCcw,
  Trash2, Edit, Download, FileText, Layers, Info, Calendar, X, BadgeCheck, Power
} from 'lucide-react';

export type SuperAdminTab =
  | 'dashboard'
  | 'agencies'
  | 'agency-admins'
  | 'global-users'
  | 'clients'
  | 'licenses'
  | 'plans'
  | 'stats'
  | 'audit'
  | 'settings';

interface SuperAdminDashboardViewProps {
  onNavigateToAgency?: (agencyId: string) => void;
}

export const SuperAdminDashboardView: React.FC<SuperAdminDashboardViewProps> = ({ onNavigateToAgency }) => {
  const { currentTenant, switchTenant, currentUser } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const [activeTab, setActiveTab] = useState<SuperAdminTab>('dashboard');
  const [selectedAgencyFilter, setSelectedAgencyFilter] = useState<string>('ALL');

  // Search & Filter States
  const [agencySearch, setAgencySearch] = useState('');
  const [agencyActivityFilter, setAgencyActivityFilter] = useState<string>('ALL');
  const [agencyStatusFilter, setAgencyStatusFilter] = useState<string>('ALL');
  const [agencyStatusTab, setAgencyStatusTab] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'>('ALL');

  const [userSearch, setUserSearch] = useState('');
  const [userAgencyFilter, setUserAgencyFilter] = useState<string>('ALL');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // Global Clients Module States
  const [clientSubTab, setClientSubTab] = useState<'ALL' | 'MARKETPLACE' | 'STORE_REGISTERED' | 'MULTI_STORE' | 'RECENT' | 'SUSPENDED'>('ALL');
  const [clientSearch, setClientSearch] = useState('');
  const [clientOriginFilter, setClientOriginFilter] = useState<'ALL' | 'MARKETPLACE' | 'STORE_REGISTERED'>('ALL');
  const [selectedClientForView, setSelectedClientForView] = useState<any | null>(null);

  const [auditSearch, setAuditSearch] = useState('');
  const [auditAgencyFilter, setAuditAgencyFilter] = useState<string>('ALL');

  // Lifecycle Modals State
  const [viewAgencyTarget, setViewAgencyTarget] = useState<Tenant | null>(null);
  const [viewAgencyTab, setViewAgencyTab] = useState<'INFO' | 'LICENSE' | 'USERS' | 'AUDIT'>('INFO');

  const [editAgencyTarget, setEditAgencyTarget] = useState<Tenant | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editResponsible, setEditResponsible] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');

  const [archiveAgencyTarget, setArchiveAgencyTarget] = useState<Tenant | null>(null);
  const [archiveReason, setArchiveReason] = useState('Cessation temporaire d’activité');

  const [restoreAgencyTarget, setRestoreAgencyTarget] = useState<Tenant | null>(null);

  const [deleteAgencyTarget, setDeleteAgencyTarget] = useState<Tenant | null>(null);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');

  // Modals state
  const [isNewAgencyModalOpen, setIsNewAgencyModalOpen] = useState(false);
  const [isNewAdminModalOpen, setIsNewAdminModalOpen] = useState(false);
  const [selectedAgencyForAction, setSelectedAgencyForAction] = useState<Tenant | null>(null);
  const [actionType, setActionType] = useState<'RENEW' | 'SUSPEND' | 'ACTIVATE' | null>(null);
  const [renewDurationMonths, setRenewDurationMonths] = useState<number>(12);
  const [renewPlan, setRenewPlan] = useState<LicensePlan>('PROFESSIONAL');
  const [suspendReason, setSuspendReason] = useState('Défaut de paiement de la redevance de licence');

  // Password reset modal state
  const [resetUserTarget, setResetUserTarget] = useState<User | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('password123');

  // New Agency Form State
  const [newAgencyName, setNewAgencyName] = useState('');
  const [newAgencyCode, setNewAgencyCode] = useState('');
  const [newAgencyActivity, setNewAgencyActivity] = useState<ActivityType>('RETAIL_STORE');
  const [newAgencyResponsible, setNewAgencyResponsible] = useState('');
  const [newAgencyPhone, setNewAgencyPhone] = useState('');
  const [newAgencyEmail, setNewAgencyEmail] = useState('');
  const [newAgencyAddress, setNewAgencyAddress] = useState('');
  const [newAgencyPlan, setNewAgencyPlan] = useState<LicensePlan>('PROFESSIONAL');
  const [newAgencyMonths, setNewAgencyMonths] = useState<number>(12);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // New Agency Admin Form State
  const [adminTargetAgencyId, setAdminTargetAgencyId] = useState<string>(state.tenants[0]?.id || '');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Consolidated Global Metrics
  const globalMetrics = useMemo(() => {
    const totalAgencies = state.tenants.length;
    const activeAgencies = state.tenants.filter(t => t.status === 'ACTIVE').length;
    const suspendedAgencies = state.tenants.filter(t => t.status === 'SUSPENDED').length;
    const expiredAgencies = state.tenants.filter(t => t.subscriptionStatus === 'EXPIRED' || t.status === 'EXPIRED').length;

    const totalUsers = state.users.length;
    const totalAgencyAdmins = state.users.filter(u => u.roles.some(r => r.code === 'ADMIN_CENTRE' || r.code === 'GERANT' || r.code === 'ADMIN_AGENCY')).length;
    const totalProducts = state.products.length;

    // Total Global Turnover
    const totalOrdersRevenue = (state.orders || []).reduce((acc: number, o: Order) => acc + (o.totalAmount || 0), 0);
    const totalGlobalRevenue = totalOrdersRevenue;

    const totalSalesCount = 0;
    const totalOrdersCount = (state.orders || []).length;

    const byActivity: Record<ActivityType, number> = {
      SERVICE_CENTER: 0,
      RETAIL_STORE: 0,
      RESTAURANT: 0,
      WHOLESALE: 0,
      OTHER: 0
    };

    state.tenants.forEach(t => {
      const act = t.activityType || 'SERVICE_CENTER';
      if (byActivity[act] !== undefined) {
        byActivity[act]++;
      }
    });

    // CA by agency
    const revenueByAgency = state.tenants.map(t => {
      const oRev = (state.orders || []).filter(o => o.tenantId === t.id).reduce((acc: number, o: Order) => acc + (o.totalAmount || 0), 0);
      return {
        agencyId: t.id,
        name: t.name,
        code: t.code,
        revenue: oRev
      };
    });

    return {
      totalAgencies,
      activeAgencies,
      suspendedAgencies,
      expiredAgencies,
      totalUsers,
      totalAgencyAdmins,
      totalProducts,
      totalBoutiqueRevenue: 0,
      totalOrdersRevenue,
      totalGlobalRevenue,
      totalSalesCount,
      totalOrdersCount,
      byActivity,
      revenueByAgency
    };
  }, [state]);

  // Global Clients Data for Super Admin Module
  const allPlatformClients = useMemo(() => {
    const customerPersons = (state.persons || []).filter((p: Person) => p.types.includes('CUSTOMER') || !p.types.includes('STAFF'));

    if (clientSearch) {
      const q = clientSearch.toLowerCase();
      return customerPersons.filter((p: Person) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q))
      );
    }

    if (clientSubTab === 'SUSPENDED') {
      return customerPersons.filter((p: Person) => p.isActive === false);
    }

    return customerPersons;
  }, [state.persons, clientSubTab, clientSearch]);

  const clientMetrics = useMemo(() => {
    const rawList = (state.persons || []).filter((p: Person) => p.types.includes('CUSTOMER') || !p.types.includes('STAFF'));
    const total = rawList.length;
    const activeCount = rawList.filter((c: Person) => c.isActive !== false).length;
    const suspendedCount = rawList.filter((c: Person) => c.isActive === false).length;

    return {
      total,
      marketplaceCount: 0,
      storeRegisteredCount: total,
      todayCount: 0,
      weekCount: 0,
      monthCount: 0,
      multiStoreCount: 0,
      activeCount,
      suspendedCount
    };
  }, [state.persons]);

  // Filtered Agencies with Tabs and Search
  const filteredAgencies = useMemo(() => {
    return state.tenants.filter(t => {
      if (selectedAgencyFilter !== 'ALL' && t.id !== selectedAgencyFilter) return false;

      const matchesSearch =
        t.name.toLowerCase().includes(agencySearch.toLowerCase()) ||
        t.code.toLowerCase().includes(agencySearch.toLowerCase()) ||
        (t.responsibleName && t.responsibleName.toLowerCase().includes(agencySearch.toLowerCase())) ||
        (t.email && t.email.toLowerCase().includes(agencySearch.toLowerCase())) ||
        (t.phone && t.phone.includes(agencySearch));

      const matchesActivity = agencyActivityFilter === 'ALL' || (t.activityType || 'SERVICE_CENTER') === agencyActivityFilter;

      const matchesStatusTab =
        agencyStatusTab === 'ALL' ||
        (agencyStatusTab === 'ACTIVE' && t.status === 'ACTIVE') ||
        (agencyStatusTab === 'SUSPENDED' && t.status === 'SUSPENDED') ||
        (agencyStatusTab === 'ARCHIVED' && t.status === 'ARCHIVED');

      const matchesStatus = agencyStatusFilter === 'ALL' || t.status === agencyStatusFilter || (agencyStatusFilter === 'EXPIRED' && t.subscriptionStatus === 'EXPIRED');

      return matchesSearch && matchesActivity && matchesStatusTab && matchesStatus;
    });
  }, [state.tenants, agencySearch, agencyActivityFilter, agencyStatusFilter, agencyStatusTab, selectedAgencyFilter]);

  // Status Counts for Agency Filter Tabs
  const agencyCounts = useMemo(() => {
    const all = state.tenants.length;
    const active = state.tenants.filter(t => t.status === 'ACTIVE').length;
    const suspended = state.tenants.filter(t => t.status === 'SUSPENDED').length;
    const archived = state.tenants.filter(t => t.status === 'ARCHIVED').length;
    return { all, active, suspended, archived };
  }, [state.tenants]);

  // Handler: Open View Detail Modal
  const handleOpenDetailModal = (agency: Tenant) => {
    setViewAgencyTarget(agency);
    setViewAgencyTab('INFO');
  };

  // Handler: Open Edit Modal
  const handleOpenEditModal = (agency: Tenant) => {
    setEditAgencyTarget(agency);
    setEditName(agency.name);
    setEditCode(agency.code);
    setEditResponsible(agency.responsibleName || '');
    setEditPhone(agency.phone || '');
    setEditEmail(agency.email || '');
    setEditAddress(agency.address || '');
  };

  // Handler: Save Edited Agency
  const handleSaveEditAgency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAgencyTarget) return;

    if (editPhone.trim() && !isValidPhoneNumber(editPhone, { allowEmpty: true })) {
      showToast('Erreur Téléphone', "Le numéro de téléphone est invalide (lettres ou caractères interdits).", 'DANGER');
      return;
    }

    const res = dbStore.updateAgencyDetails(
      editAgencyTarget.id,
      {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        responsibleName: editResponsible.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        address: editAddress.trim()
      },
      true
    );

    if (res.success) {
      showToast('Agence Modifiée ✏️', res.message, 'SUCCESS');
      setEditAgencyTarget(null);
    } else {
      showToast('Erreur de Modification', res.message, 'DANGER');
    }
  };

  // Handler: Archive Agency
  const handleConfirmArchive = () => {
    if (!archiveAgencyTarget) return;

    const res = dbStore.archiveAgency(archiveAgencyTarget.id, archiveReason, true);
    if (res.success) {
      showToast('Agence Archivée 📦', res.message, 'SUCCESS');
      setArchiveAgencyTarget(null);
    } else {
      showToast('Erreur Archivage', res.message, 'DANGER');
    }
  };

  // Handler: Restore Agency
  const handleConfirmRestore = () => {
    if (!restoreAgencyTarget) return;

    const res = dbStore.restoreAgency(restoreAgencyTarget.id, true);
    if (res.success) {
      showToast('Agence Restaurée ♻️', res.message, 'SUCCESS');
      setRestoreAgencyTarget(null);
    } else {
      showToast('Erreur Restauration', res.message, 'DANGER');
    }
  };

  // Handler: Download Agency JSON Backup
  const handleDownloadAgencyBackup = (agency: Tenant) => {
    const res = dbStore.exportAgencyData(agency.id, true);
    if (!res.success || !res.exportBundle) {
      showToast('Erreur Export', res.message, 'DANGER');
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.exportBundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sauvegarde_agence_${agency.code}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Sauvegarde Téléchargée 💾', `L'archive JSON de l'agence "${agency.name}" a été téléchargée avec succès.`, 'SUCCESS');
  };

  // Handler: Confirm Permanent Delete
  const handleConfirmPermanentDelete = () => {
    if (!deleteAgencyTarget) return;

    const res = dbStore.deleteAgencyPermanently(deleteAgencyTarget.id, deleteConfirmationName.trim(), true);
    if (res.success) {
      showToast('Suppression Définitive Effectuée 🗑️', res.message, 'SUCCESS');
      setDeleteAgencyTarget(null);
      setDeleteConfirmationName('');
    } else {
      showToast('Échec de Suppression', res.message, 'DANGER');
    }
  };

  // Filtered Agency Admins
  const agencyAdminsList = useMemo(() => {
    return state.users.filter(u => {
      const isAdmin = !u.isSuperAdmin && u.username !== 'superadmin' && u.roles.some(r => r.code === 'ADMIN_CENTRE' || r.code === 'GERANT' || r.code === 'ADMIN_AGENCY');
      if (!isAdmin) return false;
      if (selectedAgencyFilter !== 'ALL' && u.tenantId !== selectedAgencyFilter) return false;
      return true;
    });
  }, [state.users, selectedAgencyFilter]);

  // Filtered Global Users
  const filteredGlobalUsers = useMemo(() => {
    return state.users.filter(u => {
      if (selectedAgencyFilter !== 'ALL' && u.tenantId !== selectedAgencyFilter && u.tenantId !== 'global') return false;
      if (userAgencyFilter !== 'ALL' && u.tenantId !== userAgencyFilter) return false;
      if (userRoleFilter !== 'ALL' && !u.roles.some(r => r.code === userRoleFilter)) return false;

      const matchesSearch =
        u.firstName.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.lastName.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase());

      return matchesSearch;
    });
  }, [state.users, userSearch, userAgencyFilter, userRoleFilter, selectedAgencyFilter]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return (state.auditLogs || []).filter(l => {
      if (selectedAgencyFilter !== 'ALL' && l.tenantId && l.tenantId !== selectedAgencyFilter) return false;
      if (auditAgencyFilter !== 'ALL' && l.tenantId !== auditAgencyFilter) return false;

      const matchesSearch =
        l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        (l.userName && l.userName.toLowerCase().includes(auditSearch.toLowerCase())) ||
        (l.entityType && l.entityType.toLowerCase().includes(auditSearch.toLowerCase()));

      return matchesSearch;
    });
  }, [state.auditLogs, auditSearch, auditAgencyFilter, selectedAgencyFilter]);

  // Handler: Create Agency
  const handleCreateAgency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgencyName.trim() || !newAgencyCode.trim() || !newAgencyResponsible.trim() || !newAdminUsername.trim() || !newAdminEmail.trim()) {
      showToast('Champs Requis', 'Veuillez renseigner tous les champs obligatoires.', 'WARNING');
      return;
    }

    if (newAgencyPhone.trim() && !isValidPhoneNumber(newAgencyPhone, { allowEmpty: true })) {
      showToast('Erreur Téléphone', "Le numéro de téléphone de l'agence est invalide.", 'DANGER');
      return;
    }

    const res = dbStore.createAgency({
      name: newAgencyName,
      code: newAgencyCode,
      activityType: newAgencyActivity,
      responsibleName: newAgencyResponsible,
      phone: newAgencyPhone,
      email: newAgencyEmail,
      address: newAgencyAddress,
      planId: newAgencyPlan,
      licenseMonths: newAgencyMonths,
      adminUsername: newAdminUsername,
      adminEmail: newAdminEmail,
      adminPassword: newAdminPassword || `${newAdminUsername.trim()}123`
    });

    if (res.success) {
      showToast('Agence Créée 🎉', res.message, 'SUCCESS');
      setIsNewAgencyModalOpen(false);
      // Reset form
      setNewAgencyName('');
      setNewAgencyCode('');
      setNewAgencyResponsible('');
      setNewAgencyPhone('');
      setNewAgencyEmail('');
      setNewAgencyAddress('');
      setNewAdminUsername('');
      setNewAdminEmail('');
      setNewAdminPassword('');
    } else {
      showToast('Erreur de Création', res.message, 'DANGER');
    }
  };

  // Handler: Create Agency Admin
  const handleCreateAgencyAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminFirstName.trim() || !adminLastName.trim() || !adminUsername.trim() || !adminEmail.trim() || !adminTargetAgencyId) {
      showToast('Champs Requis', 'Veuillez renseigner tous les champs obligatoires.', 'WARNING');
      return;
    }

    if (adminPhone.trim() && !isValidPhoneNumber(adminPhone, { allowEmpty: true })) {
      showToast('Erreur Téléphone', "Le numéro de téléphone de l'administrateur est invalide.", 'DANGER');
      return;
    }

    const res = dbStore.createAgencyAdmin({
      agencyId: adminTargetAgencyId,
      firstName: adminFirstName,
      lastName: adminLastName,
      username: adminUsername,
      email: adminEmail,
      phone: adminPhone,
      password: adminPassword || `${adminUsername.trim()}123`
    });

    if (res.success) {
      showToast('Administrateur Créé 👤', res.message, 'SUCCESS');
      setIsNewAdminModalOpen(false);
      setAdminFirstName('');
      setAdminLastName('');
      setAdminUsername('');
      setAdminEmail('');
      setAdminPhone('');
      setAdminPassword('');
    } else {
      showToast('Erreur', res.message, 'DANGER');
    }
  };

  // Handler: Switch into Agency context
  const handleSwitchToAgency = (agency: Tenant) => {
    switchTenant(agency.id);
    showToast('Contexte Agence Actif', `Vous êtes maintenant positionné sur "${agency.name}".`, 'INFO');
    onNavigateToAgency?.(agency.id);
  };

  // Handler: Execute Action (Renew / Suspend / Activate)
  const handleExecuteAgencyAction = () => {
    if (!selectedAgencyForAction) return;

    if (actionType === 'SUSPEND') {
      dbStore.updateAgencyStatus(selectedAgencyForAction.id, 'SUSPENDED', suspendReason);
      showToast('Agence Suspendue 🔒', `L'agence "${selectedAgencyForAction.name}" a été suspendue.`, 'WARNING');
    } else if (actionType === 'ACTIVATE') {
      dbStore.updateAgencyStatus(selectedAgencyForAction.id, 'ACTIVE', 'Réactivation par le Super Administrateur');
      showToast('Agence Réactivée 🟢', `L'agence "${selectedAgencyForAction.name}" est de nouveau active.`, 'SUCCESS');
    } else if (actionType === 'RENEW') {
      dbStore.renewAgencyLicense(selectedAgencyForAction.id, renewDurationMonths, renewPlan);
      showToast('Licence Renouvelée 🎉', `La licence de "${selectedAgencyForAction.name}" a été prolongée de ${renewDurationMonths} mois.`, 'SUCCESS');
    }

    setSelectedAgencyForAction(null);
    setActionType(null);
  };

  // Handler: Reset user password
  const handleConfirmPasswordReset = () => {
    if (!resetUserTarget) return;
    dbStore.resetUserPassword(resetUserTarget.id, newPasswordValue);
    showToast('Mot de Passe Réinitialisé 🔑', `Le mot de passe de @${resetUserTarget.username} a été mis à jour avec succès.`, 'SUCCESS');
    setResetUserTarget(null);
  };

  // Chart data for consolidated overview
  const globalTrendData = [
    { period: 'Sem 1', agenceA: 3050000, agenceB: 3200000, total: 6250000 },
    { period: 'Sem 2', agenceA: 4080000, agenceB: 4500000, total: 8580000 },
    { period: 'Sem 3', agenceA: 3720000, agenceB: 3900000, total: 7620000 },
    { period: 'Sem 4', agenceA: 6050000, agenceB: 6100000, total: 12150000 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner: SaaS Super Admin Master Header */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-brand-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-xl shadow-lg">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  ADMINISTRATION GLOBALE SaaS
                </h2>
                <Badge variant="warning" size="sm" className="font-extrabold uppercase text-[10px]">
                  Super Admin
                </Badge>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Pilotage centralisé du parc des agences, des souscriptions et de la sécurité plateforme.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Global Agency Context Filter */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl">
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold text-slate-300">Portée :</span>
            <select
              value={selectedAgencyFilter}
              onChange={(e) => setSelectedAgencyFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-amber-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">Toutes les Agences (Vue Consolidée)</option>
              {state.tenants.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setIsNewAgencyModalOpen(true)}
            className="font-extrabold shadow-lg shadow-brand-500/25 bg-brand-600 hover:bg-brand-500 text-xs py-2"
          >
            Nouvelle Agence
          </Button>
        </div>
      </div>

      {/* Super Admin Top Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Tableau de Bord
        </button>

        <button
          onClick={() => setActiveTab('agencies')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'agencies'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Agences ({state.tenants.length})
        </button>


        <button
          onClick={() => setActiveTab('agency-admins')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'agency-admins'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Admins d'Agence ({agencyAdminsList.length})
        </button>

        <button
          onClick={() => setActiveTab('global-users')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'global-users'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Utilisateurs Globaux ({state.users.length})
        </button>

        <button
          onClick={() => setActiveTab('clients')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'clients'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          Gestion des Clients ({allPlatformClients.length})
        </button>

        <button
          onClick={() => setActiveTab('licenses')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'licenses'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Licences & Durées
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'plans'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Abonnements & Plans
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'stats'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Statistiques
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Global
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          Paramètres SaaS
        </button>
      </div>

      {/* ======================================================================= */}
      {/* TAB 1: TABLEAU DE BORD GLOBAL */}
      {/* ======================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Global KPIs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-white dark:bg-slate-900 border-l-4 border-l-brand-600">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Agences SaaS
                  </span>
                  <strong className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                    {globalMetrics.totalAgencies}
                  </strong>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-emerald-600 font-semibold">
                    <span>{globalMetrics.activeAgencies} actives</span>
                    {globalMetrics.suspendedAgencies > 0 && (
                      <span className="text-rose-500">• {globalMetrics.suspendedAgencies} suspendues</span>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-white dark:bg-slate-900 border-l-4 border-l-emerald-600">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Volume d'Affaires Global
                  </span>
                  <strong className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {formatCurrency(globalMetrics.totalGlobalRevenue)}
                  </strong>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {globalMetrics.totalSalesCount} ventes boutique + {globalMetrics.totalOrdersCount} commandes
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-white dark:bg-slate-900 border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Univers & Activités
                  </span>
                  <strong className="text-sm font-black text-slate-900 dark:text-white mt-1 block">
                    {globalMetrics.byActivity.SERVICE_CENTER} Services • {globalMetrics.byActivity.RETAIL_STORE} Boutiques
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {globalMetrics.byActivity.RESTAURANT} Restaurant(s) configuré(s)
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-white dark:bg-slate-900 border-l-4 border-l-brand-600">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Utilisateurs & Postes
                  </span>
                  <strong className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                    {globalMetrics.totalUsers} Comptes
                  </strong>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    dont {globalMetrics.totalAgencyAdmins} Administrateurs d'agence
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </Card>
          </div>

          {/* Consolidated Chart & Agency Quick List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6">
              <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-500" />
                  Évolution Financière Consolidée Plateforme
                </CardTitle>
              </CardHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={globalTrendData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="period" stroke="#888888" fontSize={11} />
                    <YAxis stroke="#888888" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip />
                    <Area type="monotone" dataKey="agenceA" name="Agence A (NICOST)" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="agenceB" name="Agence B (Horizon)" stroke="#eab308" fill="#eab308" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  Raccourcis Super Admin
                </CardTitle>
              </CardHeader>
              <div className="space-y-2">
                <Button
                  variant="primary"
                  className="w-full justify-start text-xs font-bold bg-brand-600 hover:bg-brand-500"
                  onClick={() => setIsNewAgencyModalOpen(true)}
                >
                  <Building2 className="w-4 h-4 mr-2" /> Déployer une Nouvelle Agence
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs font-semibold"
                  onClick={() => setIsNewAdminModalOpen(true)}
                >
                  <UserCheck className="w-4 h-4 mr-2 text-brand-500" /> Créer un Admin d'Agence
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs font-semibold"
                  onClick={() => setActiveTab('licenses')}
                >
                  <KeyRound className="w-4 h-4 mr-2 text-amber-500" /> Renouveler les Licences
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs font-semibold"
                  onClick={() => setActiveTab('audit')}
                >
                  <History className="w-4 h-4 mr-2 text-amber-500" /> Consulter l'Audit Global
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 2: GESTION DES AGENCES */}
      {/* ======================================================================= */}
      {activeTab === 'agencies' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Parc des Agences & Gestion du Cycle de Vie
              </h3>
              <p className="text-xs text-slate-500">
                Supervisez toutes les agences, consultez les détails, modifiez, suspendez, archivez ou restaurez selon vos droits Super Admin.
              </p>
            </div>

            <Button
              variant="primary"
              icon={Plus}
              size="sm"
              onClick={() => setIsNewAgencyModalOpen(true)}
              className="text-xs font-bold py-2 px-4 shadow-sm"
            >
              Nouvelle Agence
            </Button>
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex-wrap">
              <button
                onClick={() => setAgencyStatusTab('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  agencyStatusTab === 'ALL'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Toutes ({agencyCounts.all})
              </button>
              <button
                onClick={() => setAgencyStatusTab('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  agencyStatusTab === 'ACTIVE'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Actives ({agencyCounts.active})
              </button>
              <button
                onClick={() => setAgencyStatusTab('SUSPENDED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  agencyStatusTab === 'SUSPENDED'
                    ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Suspendues ({agencyCounts.suspended})
              </button>
              <button
                onClick={() => setAgencyStatusTab('ARCHIVED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  agencyStatusTab === 'ARCHIVED'
                    ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                Archivées ({agencyCounts.archived})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Rechercher agence, code, gérant..."
                  value={agencySearch}
                  onChange={(e) => setAgencySearch(e.target.value)}
                  className="pl-8 text-xs py-1.5"
                />
              </div>

              <Select
                value={agencyActivityFilter}
                onChange={(e) => setAgencyActivityFilter(e.target.value)}
                className="text-xs py-1.5 w-auto"
              >
                <option value="ALL">Toutes les Activités</option>
                <option value="SERVICE_CENTER">Centres de Prestations</option>
                <option value="RETAIL_STORE">Boutiques & Commerces</option>
                <option value="RESTAURANT">Restaurants (Prévus)</option>
                <option value="WHOLESALE">Grossistes</option>
                <option value="OTHER">Autres</option>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code & Nom Agence</TableHead>
                  <TableHead>Type d'Activité</TableHead>
                  <TableHead>Responsable / Contact</TableHead>
                  <TableHead>Statut & Licence</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead className="text-right">Actions du Cycle de Vie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgencies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-400">
                      Aucune agence correspondant aux critères de recherche / filtrage.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAgencies.map((agency) => {
                    const activityConfig = ACTIVITY_TYPES_CONFIG[agency.activityType || 'SERVICE_CENTER'] || ACTIVITY_TYPES_CONFIG.SERVICE_CENTER;
                    const isCurrentActive = currentTenant?.id === agency.id;
                    const isSuspended = agency.status === 'SUSPENDED' || agency.subscriptionStatus === 'SUSPENDED';
                    const isArchived = agency.status === 'ARCHIVED';
                    const isExpired = agency.status === 'EXPIRED' || agency.subscriptionStatus === 'EXPIRED';

                    return (
                      <TableRow key={agency.id} className={isArchived ? 'opacity-70 bg-slate-50/50 dark:bg-slate-900/40' : isCurrentActive ? 'bg-brand-50/50 dark:bg-brand-950/20 font-medium' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-brand-600">
                              {agency.code.substring(0, 3)}
                            </div>
                            <div>
                              <strong className="text-xs text-slate-900 dark:text-white block flex items-center gap-1.5">
                                {agency.name}
                                {isCurrentActive && (
                                  <Badge variant="primary" size="sm" className="text-[9px] py-0 px-1">
                                    Positionné
                                  </Badge>
                                )}
                              </strong>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {agency.id} • Réf: {agency.code}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={activityConfig.badgeColor as any}
                            size="sm"
                            className="font-bold text-[10px] flex items-center gap-1 w-fit"
                          >
                            <activityConfig.icon className="w-3 h-3" />
                            {activityConfig.label}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <strong className="text-xs text-slate-800 dark:text-slate-200 block">
                            {agency.responsibleName || 'Non spécifié'}
                          </strong>
                          <span className="text-[10px] text-slate-500 block">
                            {agency.phone || agency.email || 'Aucun contact'}
                          </span>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={isArchived ? 'secondary' : isSuspended ? 'danger' : isExpired ? 'warning' : 'success'}
                            size="sm"
                            className="font-extrabold text-[10px]"
                          >
                            {isArchived ? 'ARCHIVÉE' : isSuspended ? 'SUSPENDUE' : isExpired ? 'EXPIRÉE' : 'ACTIVE'}
                          </Badge>
                          <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                            Plan: {agency.licensePlan || 'PROFESSIONAL'}
                          </span>
                        </TableCell>

                        <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                          {agency.licenseExpiresAt ? formatDate(agency.licenseExpiresAt) : agency.trialEndsAt ? formatDate(agency.trialEndsAt) : 'Illimitée'}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {/* 1. Voir Détail */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDetailModal(agency)}
                              className="text-xs p-1.5 h-auto text-slate-600 hover:text-brand-600 hover:bg-slate-100"
                              title="Consulter la fiche détaillée"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>

                            {/* 2. Modifier Agence */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditModal(agency)}
                              className="text-xs p-1.5 h-auto text-slate-600 hover:text-amber-600 hover:bg-slate-100"
                              title="Modifier les coordonnées de l'agence"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>

                            {/* Actions selon le statut */}
                            {isArchived ? (
                              <>
                                {/* 3. Restaurer */}
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setRestoreAgencyTarget(agency)}
                                  className="text-xs font-bold py-1 px-2 h-auto text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                  title="Restaurer l'agence archivée"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                  Restaurer
                                </Button>

                                {/* 4. Exporter Sauvegarde JSON */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDownloadAgencyBackup(agency)}
                                  className="text-xs p-1.5 h-auto text-slate-600 hover:text-emerald-600"
                                  title="Télécharger sauvegarde JSON complète"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>

                                {/* 5. Supprimer Définitivement */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setDeleteAgencyTarget(agency);
                                    setDeleteConfirmationName('');
                                  }}
                                  className="text-xs p-1.5 h-auto text-rose-600 hover:bg-rose-50"
                                  title="Supprimer définitivement (Irréversible)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            ) : (
                              <>
                                {/* Suspendre / Réactiver */}
                                {isSuspended ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setSelectedAgencyForAction(agency);
                                      setActionType('ACTIVATE');
                                    }}
                                    className="text-xs font-bold py-1 px-2 h-auto text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                                    title="Réactiver l'agence suspendue"
                                  >
                                    <Unlock className="w-3.5 h-3.5 mr-1" />
                                    Réactiver
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setSelectedAgencyForAction(agency);
                                      setActionType('SUSPEND');
                                    }}
                                    className="text-xs font-bold py-1 px-2 h-auto text-rose-600 bg-rose-50 hover:bg-rose-100"
                                    title="Suspendre l'agence"
                                  >
                                    <Lock className="w-3.5 h-3.5 mr-1" />
                                    Suspendre
                                  </Button>
                                )}

                                {/* Archiver */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setArchiveAgencyTarget(agency)}
                                  className="text-xs p-1.5 h-auto text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                  title="Archiver l'agence (Données préservées)"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </Button>

                                {/* Renouveler */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedAgencyForAction(agency);
                                    setActionType('RENEW');
                                    setRenewPlan(agency.licensePlan || 'PROFESSIONAL');
                                  }}
                                  className="text-xs p-1.5 h-auto text-amber-700 hover:bg-amber-50"
                                  title="Renouveler ou modifier la formule de licence"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </Button>

                                {/* Positionner Administrer */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSwitchToAgency(agency)}
                                  className="text-xs font-bold py-1 px-2 h-auto text-brand-600 border-brand-300 hover:bg-brand-50"
                                  title="Basculer vers cette agence"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}


      {/* ======================================================================= */}
      {/* TAB 3: ADMINISTRATEURS D'AGENCE */}
      {/* ======================================================================= */}
      {activeTab === 'agency-admins' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Administrateurs & Directeurs d'Agence
              </h3>
              <p className="text-xs text-slate-500">
                Gérez les comptes administratifs habilités à diriger chaque agence.
              </p>
            </div>

            <Button
              variant="primary"
              icon={Plus}
              size="sm"
              onClick={() => setIsNewAdminModalOpen(true)}
              className="text-xs font-bold py-1.5 px-3"
            >
              Nouvel Admin d'Agence
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Administrateur</TableHead>
                  <TableHead>Agence Rattachée</TableHead>
                  <TableHead>Identifiants de Connexion</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencyAdminsList.map(admin => {
                  const agency = state.tenants.find(t => t.id === admin.tenantId);
                  return (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 font-bold text-xs flex items-center justify-center">
                            {admin.firstName[0]}{admin.lastName[0]}
                          </div>
                          <div>
                            <strong className="text-xs text-slate-900 dark:text-white block">
                              {admin.firstName} {admin.lastName}
                            </strong>
                            <span className="text-[10px] text-slate-400">
                              {admin.roles[0]?.name || 'Admin'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          {agency?.name || 'Agence non trouvée'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {admin.tenantId} • Code: {agency?.code}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400 block">
                          @{admin.username}
                        </span>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          {admin.email}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge variant={admin.isActive ? 'success' : 'danger'} size="sm">
                          {admin.isActive ? 'ACTIF' : 'DÉSACTIVÉ'}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setResetUserTarget(admin);
                              setNewPasswordValue('password123');
                            }}
                            className="text-xs font-bold py-1 px-2 h-auto text-amber-700 bg-amber-50 hover:bg-amber-100"
                            title="Réinitialiser le mot de passe"
                          >
                            <KeyRound className="w-3.5 h-3.5 mr-1" />
                            Reset MDP
                          </Button>

                          <Button
                            size="sm"
                            variant={admin.isActive ? 'outline' : 'secondary'}
                            onClick={() => {
                              dbStore.updateUserStatus(admin.id, !admin.isActive);
                              showToast('Statut Mis à Jour', `Le compte @${admin.username} a été ${!admin.isActive ? 'activé' : 'désactivé'}.`, 'INFO');
                            }}
                            className={`text-xs font-bold py-1 px-2 h-auto ${
                              admin.isActive ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 bg-emerald-50'
                            }`}
                          >
                            {admin.isActive ? 'Désactiver' : 'Activer'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ======================================================================= */}
      {/* TAB 4: UTILISATEURS GLOBAUX */}
      {/* ======================================================================= */}
      {activeTab === 'global-users' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Répertoire Global des Utilisateurs
              </h3>
              <p className="text-xs text-slate-500">
                Consultez et administrez l'ensemble des comptes de toutes les agences de la plateforme.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Rechercher utilisateur, email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-8 text-xs py-1.5"
                />
              </div>

              <Select
                value={userAgencyFilter}
                onChange={(e) => setUserAgencyFilter(e.target.value)}
                className="text-xs py-1.5 w-auto"
              >
                <option value="ALL">Toutes les Agences</option>
                {state.tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead>Rôle & Département</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGlobalUsers.map(user => {
                  const agency = state.tenants.find(t => t.id === user.tenantId);
                  const lockStatus = checkAccountLockout(user);

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <strong className="text-xs text-slate-900 dark:text-white block">
                          {user.firstName} {user.lastName}
                        </strong>
                        <span className="text-[10px] text-slate-400 font-mono">
                          @{user.username} • {user.email}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                          {user.tenantId === 'global' ? '👑 Plateforme Globale' : (agency?.name || user.tenantId)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge variant="primary" size="sm" className="text-[10px]">
                          {user.roles[0]?.name || 'Collaborateur'}
                        </Badge>
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                          {user.department}
                        </span>
                      </TableCell>

                      <TableCell>
                        {lockStatus.isLocked ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="danger" size="sm" className="font-bold text-[10px] flex items-center gap-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                              <Lock className="w-3 h-3 text-rose-400" />
                              BLOQUÉ ({lockStatus.remainingMinutes}m)
                            </Badge>
                            <span className="text-[9px] text-rose-400 font-mono">
                              Niveau {user.lockoutCount || 1}
                            </span>
                          </div>
                        ) : (
                          <Badge variant={user.isActive ? 'success' : 'danger'} size="sm">
                            {user.isActive ? 'ACTIF' : 'DÉSACTIVÉ'}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {lockStatus.isLocked && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                if (!currentUser) return;
                                const res = dbStore.unlockUserAccount(user.id, currentUser, "Déverrouillage global par Super Admin");
                                if (res.success) {
                                  showToast('Compte Déverrouillé', res.message, 'SUCCESS');
                                } else {
                                  showToast('Erreur', res.message, 'DANGER');
                                }
                              }}
                              className="text-xs font-bold py-1 px-2.5 h-auto bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-sm"
                              title="Déverrouiller ce compte immédiatement"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Débloquer</span>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setResetUserTarget(user);
                              setNewPasswordValue('password123');
                            }}
                            className="text-xs font-bold py-1 px-2 h-auto text-amber-700 bg-amber-50 hover:bg-amber-100"
                          >
                            <KeyRound className="w-3.5 h-3.5 mr-1" />
                            Reset MDP
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ======================================================================= */}
      {/* TAB 5: LICENCES & DURÉES */}
      {/* ======================================================================= */}
      {activeTab === 'licenses' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Gestion des Licences d'Exploitation SaaS
              </h3>
              <p className="text-xs text-slate-500">
                Suivi des échéances, des clés de produit et du régime de restriction en cas d'expiration.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agence</TableHead>
                  <TableHead>Formule / Plan</TableHead>
                  <TableHead>Clé de Licence</TableHead>
                  <TableHead>Statut Licence</TableHead>
                  <TableHead>Validité & Échéance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.tenants.map(t => {
                  const isSuspended = t.status === 'SUSPENDED' || t.subscriptionStatus === 'SUSPENDED';
                  const isExpired = t.status === 'EXPIRED' || t.subscriptionStatus === 'EXPIRED';

                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <strong className="text-xs text-slate-900 dark:text-white block">
                          {t.name}
                        </strong>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Code: {t.code}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge variant="primary" size="sm" className="font-bold">
                          {t.licensePlan || 'PROFESSIONAL'}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <span className="text-[11px] font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded border border-brand-200 dark:border-brand-800">
                          {t.licenseKey || 'TRIAL-45D-KEY'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge variant={isSuspended ? 'danger' : isExpired ? 'warning' : 'success'} size="sm">
                          {isSuspended ? 'SUSPENDUE' : isExpired ? 'EXPIRÉE' : 'ACTIVE'}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs font-mono">
                        {t.licenseExpiresAt ? formatDate(t.licenseExpiresAt) : t.trialEndsAt ? formatDate(t.trialEndsAt) : 'Illimitée'}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedAgencyForAction(t);
                            setActionType('RENEW');
                            setRenewPlan(t.licensePlan || 'PROFESSIONAL');
                          }}
                          className="text-xs font-bold py-1 px-2.5 h-auto text-amber-700 bg-amber-50 hover:bg-amber-100"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          Renouveler
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ======================================================================= */}
      {/* TAB: GESTION CENTRALISÉE DES CLIENTS DU MARKETPLACE & BOUTIQUES */}
      {/* ======================================================================= */}
      {activeTab === 'clients' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header & Subtitle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" />
                Gestion Centralisée des Clients de la Plateforme
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Supervision unifiée des comptes clients Marketplace et des clientèles enregistrées par les boutiques (avec isolation multi-boutiques).
              </p>
            </div>
          </div>

          {/* Client Metrics Overview - 9 Counters with Real Data */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
            <Card className="p-3 border-l-4 border-l-brand-600 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Clients</span>
              <strong className="text-lg font-black text-brand-600 dark:text-brand-400 block mt-0.5">
                {clientMetrics.total}
              </strong>
              <span className="text-[10px] text-slate-400">Identités uniques</span>
            </Card>

            <Card className="p-3 border-l-4 border-l-blue-500 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Marketplace</span>
              <strong className="text-lg font-black text-blue-600 dark:text-blue-400 block mt-0.5">
                {clientMetrics.marketplaceCount}
              </strong>
              <span className="text-[10px] text-slate-400">Comptes acheteurs</span>
            </Card>

            <Card className="p-3 border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Boutiques</span>
              <strong className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {clientMetrics.storeRegisteredCount}
              </strong>
              <span className="text-[10px] text-slate-400">En magasin</span>
            </Card>

            <Card className="p-3 border-l-4 border-l-indigo-500 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aujourd'hui</span>
              <strong className="text-lg font-black text-indigo-600 dark:text-indigo-400 block mt-0.5">
                +{clientMetrics.todayCount}
              </strong>
              <span className="text-[10px] text-slate-400">Nouveaux 24h</span>
            </Card>

            <Card className="p-3 border-l-4 border-l-cyan-500 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cette Semaine</span>
              <strong className="text-lg font-black text-cyan-600 dark:text-cyan-400 block mt-0.5">
                +{clientMetrics.weekCount}
              </strong>
              <span className="text-[10px] text-slate-400">Derniers 7 jours</span>
            </Card>

            <Card className="p-3 border-l-4 border-l-amber-500 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ce Mois</span>
              <strong className="text-lg font-black text-amber-600 dark:text-amber-400 block mt-0.5">
                +{clientMetrics.monthCount}
              </strong>
              <span className="text-[10px] text-slate-400">Mois en cours</span>
            </Card>

            <Card className="p-3 border-l-4 border-l-purple-500 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Multi-Boutiques</span>
              <strong className="text-lg font-black text-purple-600 dark:text-purple-400 block mt-0.5">
                {clientMetrics.multiStoreCount}
              </strong>
              <span className="text-[10px] text-slate-400">Liés à ≥ 2</span>
            </Card>

            <Card className="p-3 border-l-4 border-l-teal-500 bg-white dark:bg-slate-900 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Actifs</span>
              <strong className="text-lg font-black text-teal-600 dark:text-teal-400 block mt-0.5">
                {clientMetrics.activeCount}
              </strong>
              <span className="text-[10px] text-slate-400">Accès autorisés</span>
            </Card>

            <Card className="p-3 border-l-4 border-l-rose-500 bg-white dark:bg-slate-900 shadow-sm col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Suspendus</span>
              <strong className="text-lg font-black text-rose-600 dark:text-rose-400 block mt-0.5">
                {clientMetrics.suspendedCount}
              </strong>
              <span className="text-[10px] text-slate-400">Accès bloqués</span>
            </Card>
          </div>

          {/* 6 Sub-Tabs for Clients */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-2xl">
            <button
              onClick={() => setClientSubTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                clientSubTab === 'ALL'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              1. Tous les clients ({clientMetrics.total})
            </button>

            <button
              onClick={() => setClientSubTab('MARKETPLACE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                clientSubTab === 'MARKETPLACE'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              2. Clients Marketplace ({clientMetrics.marketplaceCount})
            </button>

            <button
              onClick={() => setClientSubTab('STORE_REGISTERED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                clientSubTab === 'STORE_REGISTERED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              3. Enregistrés par Boutiques ({clientMetrics.storeRegisteredCount})
            </button>

            <button
              onClick={() => setClientSubTab('MULTI_STORE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                clientSubTab === 'MULTI_STORE'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              4. Clients Multi-Boutiques ({clientMetrics.multiStoreCount})
            </button>

            <button
              onClick={() => setClientSubTab('RECENT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                clientSubTab === 'RECENT'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              5. Inscriptions Récentes
            </button>

            <button
              onClick={() => setClientSubTab('SUSPENDED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                clientSubTab === 'SUSPENDED'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              6. Clients Suspendus ({clientMetrics.suspendedCount})
            </button>
          </div>

          {/* Search & Origin Filter Bar */}
          <Card className="p-3.5 bg-white dark:bg-slate-900">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, prénom, téléphone, email, ville..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-brand-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={clientOriginFilter}
                  onChange={(e) => setClientOriginFilter(e.target.value as any)}
                  options={[
                    { value: 'ALL', label: 'Toutes les origines' },
                    { value: 'MARKETPLACE', label: 'Marketplace uniquement' },
                    { value: 'STORE_REGISTERED', label: 'Enregistrés boutiques' }
                  ]}
                  className="text-xs w-full"
                />
              </div>
            </div>
          </Card>

          {/* Clients List Table */}
          <Card className="overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                    <TableHead className="text-xs font-bold">Client</TableHead>
                    <TableHead className="text-xs font-bold">Coordonnées & Ville</TableHead>
                    <TableHead className="text-xs font-bold">Agence</TableHead>
                    <TableHead className="text-xs font-bold">Profil / Types</TableHead>
                    <TableHead className="text-xs font-bold">Statut</TableHead>
                    <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPlatformClients.length > 0 ? (
                    allPlatformClients.map((client: Person) => {
                      const isSuspended = client.status === 'SUSPENDED' || client.isActive === false;
                      const clientAgency = state.tenants.find(t => t.id === client.tenantId);
                      return (
                        <TableRow key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          {/* Client Name */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-black text-xs flex items-center justify-center border border-brand-200 shrink-0">
                                {client.firstName?.[0]?.toUpperCase() || 'C'}
                              </div>
                              <div className="space-y-0.5">
                                <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                                  {client.firstName} {client.lastName}
                                </strong>
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  Inscrit : {client.createdAt ? formatDate(client.createdAt) : 'Non daté'}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Contact & City */}
                          <TableCell>
                            <div className="space-y-0.5 text-xs">
                              <div className="font-mono text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                                📞 {client.phone || 'Non renseigné'}
                              </div>
                              {client.email && (
                                <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                  ✉️ {client.email}
                                </div>
                              )}
                              <div className="text-[10px] text-slate-400">
                                📍 {client.address || 'Conakry'}
                              </div>
                            </div>
                          </TableCell>

                          {/* Agency */}
                          <TableCell>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {clientAgency?.name || (client.tenantId === 'global' ? 'Toutes agences' : client.tenantId)}
                            </span>
                          </TableCell>

                          {/* Client Types */}
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {client.types.map((t: string) => (
                                <Badge key={t} size="sm" variant="primary" className="text-[10px]">
                                  {t === 'CUSTOMER' ? 'Client Prestations' : t === 'LEARNER' ? 'Apprenant' : t}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <Badge variant={isSuspended ? 'danger' : 'success'} size="sm" className="font-extrabold text-[10px]">
                              {isSuspended ? '🔴 SUSPENDU' : '🟢 ACTIF'}
                            </Badge>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  const res = dbStore.toggleClientSuspension(client.id);
                                  if (res.success) {
                                    showToast(
                                      res.status === 'SUSPENDED' ? 'Client Suspendu' : 'Client Réactivé',
                                      res.message,
                                      res.status === 'SUSPENDED' ? 'WARNING' : 'SUCCESS'
                                    );
                                  }
                                }}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  isSuspended
                                    ? 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                    : 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100'
                                }`}
                                title={isSuspended ? "Réactiver le client" : "Suspendre le client"}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                        Aucun client ne correspond aux critères de filtre ou de recherche.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 6: PLANS & OFFRES SAAS */}
      {/* ======================================================================= */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 border-t-4 border-t-slate-400 space-y-4 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-black text-slate-900 dark:text-white">STARTER</h4>
              <Badge variant="secondary" size="sm">TPE & Boutiques</Badge>
            </div>
            <p className="text-xs text-slate-500">
              Idéal pour les commerces mono-poste ou petites agences indépendantes.
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <strong className="text-2xl font-black text-slate-900 dark:text-white">150 000 GNF</strong>
              <span className="text-xs text-slate-400"> / mois</span>
            </div>
            <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300 pt-2">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Jusqu'à 3 utilisateurs</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Gestion Caisse & POS</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Stock & Magasin</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Facturation standard</li>
            </ul>
          </Card>

          <Card className="p-6 border-t-4 border-t-brand-600 space-y-4 bg-white dark:bg-slate-900 shadow-xl relative">
            <div className="absolute -top-3 right-4 bg-brand-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow">
              Plus Populaire
            </div>
            <div className="flex items-center justify-between">
              <h4 className="text-base font-black text-brand-600 dark:text-brand-400">PROFESSIONAL</h4>
              <Badge variant="primary" size="sm">Centres & PME</Badge>
            </div>
            <p className="text-xs text-slate-500">
              Conçu pour les centres polyvalents, reprographies et commerces à fort volume.
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <strong className="text-2xl font-black text-brand-600 dark:text-brand-400">350 000 GNF</strong>
              <span className="text-xs text-slate-400"> / mois</span>
            </div>
            <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300 pt-2">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Jusqu'à 10 utilisateurs</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Tous les modules métier</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Multi-conditionnements stock</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Signatures & Cachets officiels</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Support prioritaire 6j/7</li>
            </ul>
          </Card>

          <Card className="p-6 border-t-4 border-t-amber-500 space-y-4 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-black text-amber-600 dark:text-amber-400">ENTERPRISE</h4>
              <Badge variant="warning" size="sm">Réseaux Multi-Sites</Badge>
            </div>
            <p className="text-xs text-slate-500">
              Pour les réseaux de succursales, franchises et institutions éducatives.
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <strong className="text-2xl font-black text-amber-600 dark:text-amber-400">750 000 GNF</strong>
              <span className="text-xs text-slate-400"> / mois</span>
            </div>
            <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300 pt-2">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Utilisateurs illimités</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Multi-succursales & dépôts</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Pédagogie, LMS & Certificats</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Journal d'audit illimité</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> SLA Garanti & Support 24/7</li>
            </ul>
          </Card>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 7: STATISTIQUES GLOBALES */}
      {/* ======================================================================= */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CA Agence A (NICOST)</span>
              <strong className="text-xl font-black text-brand-600 block mt-1">
                {formatCurrency(globalMetrics.revenueByAgency.find(a => a.agencyId === 't-001')?.revenue || 0)}
              </strong>
            </Card>

            <Card className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CA Agence B (Horizon)</span>
              <strong className="text-xl font-black text-emerald-600 block mt-1">
                {formatCurrency(globalMetrics.revenueByAgency.find(a => a.agencyId === 't-002')?.revenue || 0)}
              </strong>
            </Card>

            <Card className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Volume Global Consolidé</span>
              <strong className="text-xl font-black text-amber-600 block mt-1">
                {formatCurrency(globalMetrics.totalGlobalRevenue)}
              </strong>
            </Card>
          </div>

          <Card className="p-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-sm font-bold">Répartition du Chiffre d'Affaires par Agence</CardTitle>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={globalMetrics.revenueByAgency}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} />
                  <YAxis stroke="#888888" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip />
                  <Bar dataKey="revenue" name="Chiffre d'Affaires (GNF)" fill="#16a34a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 8: AUDIT GLOBAL TRANSVERSE */}
      {/* ======================================================================= */}
      {activeTab === 'audit' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Journal d'Audit Transverse SaaS
              </h3>
              <p className="text-xs text-slate-500">
                Traçabilité complète des opérations critiques sur toutes les agences.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Rechercher action, utilisateur..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="pl-8 text-xs py-1.5"
                />
              </div>

              <Select
                value={auditAgencyFilter}
                onChange={(e) => setAuditAgencyFilter(e.target.value)}
                className="text-xs py-1.5 w-auto"
              >
                <option value="ALL">Toutes les Agences</option>
                {state.tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horodatage</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead>Utilisateur & Rôle</TableHead>
                  <TableHead>Action & Module</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuditLogs.slice(0, 50).map(log => {
                  const agency = state.tenants.find(t => t.id === log.tenantId);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-300">
                        {formatDate(log.createdAt || new Date().toISOString(), 'dd/MM/yyyy HH:mm')}
                      </TableCell>

                      <TableCell>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          {agency?.name || 'Plateforme Globale'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <strong className="text-xs text-slate-900 dark:text-white block">
                          {log.userName || 'Utilisateur'}
                        </strong>
                        <span className="text-[10px] text-slate-400">
                          ID: {log.userId || 'Système'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                          {log.action}
                        </Badge>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {log.entityType}
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-mono max-w-xs truncate">
                        {log.newValues ? JSON.stringify(log.newValues) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredAuditLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400 text-xs">
                      Aucun événement d'audit enregistré.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ======================================================================= */}
      {/* TAB 9: PARAMÈTRES PLATEFORME SAAS */}
      {/* ======================================================================= */}
      {activeTab === 'settings' && (
        <Card className="p-6 space-y-6 bg-white dark:bg-slate-900">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Configuration Globale de la Plateforme SaaS
            </h3>
            <p className="text-xs text-slate-500">
              Paramètres techniques, contact support global et options système transverses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <h4 className="text-xs font-black uppercase text-brand-600 dark:text-brand-400">
                1. Support Client & Assistance Globale
              </h4>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Email Support Principal
                </label>
                <Input type="email" defaultValue="support@saas-platform.com" readOnly />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Ligne Téléphonique / WhatsApp Support
                </label>
                <Input type="text" defaultValue="+224 600 00 00 00" readOnly />
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400">
                2. Politique de Licence & Sécurité
              </h4>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <p>✓ <strong>Mode Lecture Seule Automatique</strong> activé lors de l'expiration d'une licence.</p>
                <p>✓ <strong>Isolation Absolue</strong> des bases d'agences (Anti-IDOR).</p>
                <p>✓ <strong>Sauvegardes automatiques</strong> locales persistées en temps réel.</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOUVELLE AGENCE SAAS */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isNewAgencyModalOpen}
        onClose={() => setIsNewAgencyModalOpen(false)}
        title="Création d'une Nouvelle Agence / Entreprise SaaS"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateAgency} className="space-y-4 pt-1">
          {/* Section 1: Informations Agence & Type Métier */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <h4 className="text-xs font-black uppercase text-brand-700 dark:text-brand-400 flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              1. Identité de l'Agence & Univers Métier
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nom de l'Agence / Entreprise *
                </label>
                <Input
                  type="text"
                  placeholder="ex: Boutique Quincaillerie Horizon"
                  value={newAgencyName}
                  onChange={(e) => setNewAgencyName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Code Agence Unique *
                </label>
                <Input
                  type="text"
                  placeholder="ex: AG-HQM-02"
                  value={newAgencyCode}
                  onChange={(e) => setNewAgencyCode(e.target.value.toUpperCase())}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Univers / Type d'Activité Métier *
              </label>
              <Select
                value={newAgencyActivity}
                onChange={(e) => setNewAgencyActivity(e.target.value as ActivityType)}
              >
                <option value="SERVICE_CENTER">Centre de Prestations & Services (Photocopie, Reliure, Formations...)</option>
                <option value="RETAIL_STORE">Gestion de Boutique & Commerce de Détail (Alimentation, Quincaillerie, Matériaux...)</option>
                <option value="RESTAURANT">Gestion de Restaurant & Traiteur (Prévu pour intégration future)</option>
                <option value="WHOLESALE">Grossiste & Distribution</option>
                <option value="OTHER">Autre Commerce / Services Généraux</option>
              </Select>
              {newAgencyActivity === 'RESTAURANT' && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                  ℹ️ L'activité Restaurant est configurée au niveau architectural. Les modules spécifiques de restauration seront débloqués dans la prochaine phase.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nom du Responsable / Gérant *
                </label>
                <Input
                  type="text"
                  placeholder="ex: Boubacar Diallo"
                  value={newAgencyResponsible}
                  onChange={(e) => setNewAgencyResponsible(e.target.value)}
                  required
                />
              </div>

              <div>
                <PhoneInput
                  label="Téléphone"
                  placeholder="ex: +224 628 00 11 22"
                  value={newAgencyPhone}
                  onChange={(e) => setNewAgencyPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Email de Contact
                </label>
                <Input
                  type="email"
                  placeholder="ex: contact@horizon.com"
                  value={newAgencyEmail}
                  onChange={(e) => setNewAgencyEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Adresse Géographique
              </label>
              <Input
                type="text"
                placeholder="ex: Route Le Prince, Bambéto, Conakry"
                value={newAgencyAddress}
                onChange={(e) => setNewAgencyAddress(e.target.value)}
              />
            </div>
          </div>

          {/* Section 2: Licence & Souscription */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <h4 className="text-xs font-black uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" />
              2. Formule de Licence & Durée
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Plan de Licence *
                </label>
                <Select
                  value={newAgencyPlan}
                  onChange={(e) => setNewAgencyPlan(e.target.value as LicensePlan)}
                >
                  <option value="STARTER">Starter (Jusqu'à 3 postes)</option>
                  <option value="PROFESSIONAL">Professionnel (Jusqu'à 10 postes)</option>
                  <option value="ENTERPRISE">Entreprise (Postes illimités)</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Durée de Validité Initiale
                </label>
                <Select
                  value={newAgencyMonths.toString()}
                  onChange={(e) => setNewAgencyMonths(parseInt(e.target.value) || 12)}
                >
                  <option value="1">1 Mois (Mensuel)</option>
                  <option value="3">3 Mois (Trimestriel)</option>
                  <option value="6">6 Mois (Semestriel)</option>
                  <option value="12">12 Mois (Annuel - Recommandé)</option>
                  <option value="24">24 Mois (2 Ans)</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 3: Compte Administrateur Initial */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <h4 className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              3. Compte Administrateur de l'Agence
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nom d'Utilisateur *
                </label>
                <Input
                  type="text"
                  placeholder="ex: admin.horizon"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Email de Connexion *
                </label>
                <Input
                  type="email"
                  placeholder="ex: direction@horizon.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Mot de Passe Initial
                </label>
                <Input
                  type="password"
                  placeholder="Défaut: [username]123"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsNewAgencyModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={Plus}
              className="font-bold py-2.5 px-5"
            >
              Créer & Déployer l'Agence
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: NOUVEL ADMINISTRATEUR D'AGENCE */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isNewAdminModalOpen}
        onClose={() => setIsNewAdminModalOpen(false)}
        title="Création d'un Administrateur d'Agence"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateAgencyAdmin} className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Agence Rattachée *
            </label>
            <Select
              value={adminTargetAgencyId}
              onChange={(e) => setAdminTargetAgencyId(e.target.value)}
              required
            >
              {state.tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Prénom *
              </label>
              <Input
                type="text"
                placeholder="ex: Boubacar"
                value={adminFirstName}
                onChange={(e) => setAdminFirstName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nom *
              </label>
              <Input
                type="text"
                placeholder="ex: Diallo"
                value={adminLastName}
                onChange={(e) => setAdminLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Login Utilisateur *
              </label>
              <Input
                type="text"
                placeholder="ex: admin.horizon"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Email Professionnel *
              </label>
              <Input
                type="email"
                placeholder="ex: direction@horizon.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <PhoneInput
                label="Téléphone"
                placeholder="ex: +224 628 00 11 22"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Mot de Passe Temporaire
              </label>
              <Input
                type="password"
                placeholder="Défaut: [username]123"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsNewAdminModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={Plus}
              className="font-bold py-2 px-5"
            >
              Créer l'Administrateur
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: RÉINITIALISATION MOT DE PASSE */}
      {/* ========================================================================= */}
      {resetUserTarget && (
        <Modal
          isOpen={true}
          onClose={() => setResetUserTarget(null)}
          title={`Réinitialisation du Mot de Passe — @${resetUserTarget.username}`}
          maxWidth="sm"
        >
          <div className="space-y-4 pt-1">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Définissez un nouveau mot de passe temporaire pour <strong>{resetUserTarget.firstName} {resetUserTarget.lastName}</strong>.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nouveau Mot de Passe
              </label>
              <Input
                type="text"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setResetUserTarget(null)}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmPasswordReset}
                className="font-bold"
              >
                Appliquer le Mot de Passe
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ACTIONS SUR AGENCE (RENOUVELER / SUSPENDRE) */}
      {/* ========================================================================= */}
      {selectedAgencyForAction && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedAgencyForAction(null);
            setActionType(null);
          }}
          title={
            actionType === 'SUSPEND'
              ? `Suspension de l'Agence — ${selectedAgencyForAction.name}`
              : actionType === 'ACTIVATE'
              ? `Réactivation de l'Agence — ${selectedAgencyForAction.name}`
              : `Renouvellement de Licence — ${selectedAgencyForAction.name}`
          }
          maxWidth="md"
        >
          <div className="space-y-4 pt-1">
            {actionType === 'SUSPEND' && (
              <div className="space-y-3">
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>
                    La suspension bloque immédiatement toute nouvelle transaction (ventes, commandes, réceptions) pour les utilisateurs de l'agence. Les données historiques restent préservées en mode lecture seule.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Motif de la Suspension *
                  </label>
                  <Input
                    type="text"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {actionType === 'ACTIVATE' && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  Confirmez la réactivation de l'agence. Les collaborateurs pourront reprendre immédiatement toutes leurs activités opérationnelles.
                </span>
              </div>
            )}

            {actionType === 'RENEW' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Formule de Licence
                  </label>
                  <Select
                    value={renewPlan}
                    onChange={(e) => setRenewPlan(e.target.value as LicensePlan)}
                  >
                    <option value="STARTER">Starter</option>
                    <option value="PROFESSIONAL">Professionnel</option>
                    <option value="ENTERPRISE">Entreprise</option>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Durée de Prolongation
                  </label>
                  <Select
                    value={renewDurationMonths.toString()}
                    onChange={(e) => setRenewDurationMonths(parseInt(e.target.value) || 12)}
                  >
                    <option value="1">+1 Mois</option>
                    <option value="3">+3 Mois</option>
                    <option value="6">+6 Mois</option>
                    <option value="12">+12 Mois (1 An)</option>
                    <option value="24">+24 Mois (2 Ans)</option>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedAgencyForAction(null);
                  setActionType(null);
                }}
              >
                Annuler
              </Button>
              <Button
                variant={actionType === 'SUSPEND' ? 'danger' : 'primary'}
                onClick={handleExecuteAgencyAction}
                className="font-bold"
              >
                {actionType === 'SUSPEND' ? 'Confirmer la Suspension' : actionType === 'ACTIVATE' ? 'Confirmer la Réactivation' : 'Appliquer le Renouvellement'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FICHE DÉTAILLÉE DE L'AGENCE */}
      {/* ========================================================================= */}
      {viewAgencyTarget && (
        <Modal
          isOpen={true}
          onClose={() => setViewAgencyTarget(null)}
          title={`Fiche Complète de l'Agence — ${viewAgencyTarget.name}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 pt-1">
            {/* Header Summary */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-black text-base">
                  {viewAgencyTarget.code.substring(0, 3)}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    {viewAgencyTarget.name}
                    <Badge
                      variant={viewAgencyTarget.status === 'ARCHIVED' ? 'secondary' : viewAgencyTarget.status === 'SUSPENDED' ? 'danger' : 'success'}
                      size="sm"
                      className="font-black text-[10px]"
                    >
                      {viewAgencyTarget.status}
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    ID Système : {viewAgencyTarget.id} • Réf : {viewAgencyTarget.code} • Modèle : {viewAgencyTarget.activityType === 'RETAIL_STORE' ? 'Boutique & Commerce' : 'Centre de Prestations'}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => handleDownloadAgencyBackup(viewAgencyTarget)}
                className="text-xs font-bold shrink-0"
              >
                Exporter JSON
              </Button>
            </div>

            {/* Sub-Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewAgencyTab('INFO')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewAgencyTab === 'INFO'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Informations & Coordonnées
              </button>
              <button
                onClick={() => setViewAgencyTab('LICENSE')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewAgencyTab === 'LICENSE'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Contrat de Licence
              </button>
              <button
                onClick={() => setViewAgencyTab('USERS')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewAgencyTab === 'USERS'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Utilisateurs ({state.users.filter(u => u.tenantId === viewAgencyTarget.id).length})
              </button>
              <button
                onClick={() => setViewAgencyTab('AUDIT')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewAgencyTab === 'AUDIT'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Audit & Traçabilité
              </button>
            </div>

            {/* Tab 1: Informations */}
            {viewAgencyTab === 'INFO' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Responsable / Gérant</span>
                    <strong className="text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">{viewAgencyTarget.responsibleName || 'Non spécifié'}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Téléphone Officiel</span>
                    <strong className="text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">{viewAgencyTarget.phone || 'Non renseigné'}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Email de Contact</span>
                    <strong className="text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">{viewAgencyTarget.email || 'Non renseigné'}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Adresse Géographique</span>
                    <strong className="text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">{viewAgencyTarget.address || 'Non renseignée'}</strong>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Articles & Catalogue Produits</span>
                    <strong className="text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                      {state.products.filter(p => p.tenantId === viewAgencyTarget.id).length} article(s) référencé(s)
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Date de Déploiement</span>
                    <strong className="text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                      {viewAgencyTarget.createdAt ? formatDate(viewAgencyTarget.createdAt) : '—'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Licence */}
            {viewAgencyTab === 'LICENSE' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Formule Souscrite</span>
                    <strong className="text-amber-600 dark:text-amber-400 text-xs mt-0.5 block">
                      {viewAgencyTarget.licensePlan || 'PROFESSIONAL'}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Statut Souscription</span>
                    <strong className="text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                      {viewAgencyTarget.subscriptionStatus || 'ACTIVE'}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Date d'Expiration</span>
                    <strong className="text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                      {viewAgencyTarget.licenseExpiresAt ? formatDate(viewAgencyTarget.licenseExpiresAt) : viewAgencyTarget.trialEndsAt ? formatDate(viewAgencyTarget.trialEndsAt) : 'Illimitée'}
                    </strong>
                  </div>
                </div>

                {viewAgencyTarget.licenseKey && (
                  <div className="p-3 bg-slate-900 text-white rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Clé de Licence Officielle</span>
                      <code className="text-xs font-mono font-bold text-amber-300 mt-0.5 block">{viewAgencyTarget.licenseKey}</code>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Utilisateurs */}
            {viewAgencyTab === 'USERS' && (
              <div className="max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom & Prénom</TableHead>
                      <TableHead>Identifiant</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.users.filter(u => u.tenantId === viewAgencyTarget.id).map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-bold text-xs">{user.firstName} {user.lastName}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-500">@{user.username}</TableCell>
                        <TableCell>
                          <Badge variant="outline" size="sm">{user.roles[0]?.name || 'Collaborateur'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'success' : 'danger'} size="sm">
                            {user.isActive ? 'ACTIF' : 'BLOQUÉ'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Tab 4: Audit */}
            {viewAgencyTab === 'AUDIT' && (
              <div className="max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Opérateur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(state.auditLogs || []).filter(l => l.tenantId === viewAgencyTarget.id || l.entityId === viewAgencyTarget.id).slice(0, 10).map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">{formatDate(log.createdAt, 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell className="text-xs font-mono font-bold">{log.action}</TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">{log.userName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setViewAgencyTarget(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MODIFICATION ADMINISTRATIVE DE L'AGENCE */}
      {/* ========================================================================= */}
      {editAgencyTarget && (
        <Modal
          isOpen={true}
          onClose={() => setEditAgencyTarget(null)}
          title={`Modifier les Coordonnées — ${editAgencyTarget.name}`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveEditAgency} className="space-y-4 pt-1 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nom Commercial de l'Agence *
                </label>
                <Input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Code Réf / Sigle *
                </label>
                <Input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Responsable / Gérant
                </label>
                <Input
                  type="text"
                  value={editResponsible}
                  onChange={(e) => setEditResponsible(e.target.value)}
                />
              </div>

              <div>
                <PhoneInput
                  label="Téléphone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Adresse Géographique
              </label>
              <Input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Les modifications administratives seront immédiatement reflétées sur les documents commerciaux (factures, devis, tickets) et enregistrées dans le journal d'audit Super Admin.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" type="button" onClick={() => setEditAgencyTarget(null)}>
                Annuler
              </Button>
              <Button variant="primary" type="submit" className="font-bold">
                Enregistrer les Modifications
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ARCHIVAGE DE L'AGENCE */}
      {/* ========================================================================= */}
      {archiveAgencyTarget && (
        <Modal
          isOpen={true}
          onClose={() => setArchiveAgencyTarget(null)}
          title={`Archiver l'Agence — ${archiveAgencyTarget.name}`}
          maxWidth="md"
        >
          <div className="space-y-4 pt-1 text-xs">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start gap-3">
              <Archive className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-slate-900 dark:text-slate-200">
                <strong className="block font-black">Préservation Intégrale des Données :</strong>
                <p className="leading-relaxed">
                  L'archivage désactive les accès opérationnels de l'agence sans supprimer aucune information. Toutes les ventes, stocks, historiques et factures restent consultables et restaurables à tout moment.
                </p>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Motif de l'Archivage *
              </label>
              <Input
                type="text"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setArchiveAgencyTarget(null)}>
                Annuler
              </Button>
              <Button variant="primary" onClick={handleConfirmArchive} className="bg-slate-800 hover:bg-slate-700 text-white font-bold">
                Confirmer l'Archivage
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: RESTAURATION D'UNE AGENCE ARCHIVÉE */}
      {/* ========================================================================= */}
      {restoreAgencyTarget && (
        <Modal
          isOpen={true}
          onClose={() => setRestoreAgencyTarget(null)}
          title={`Restaurer l'Agence — ${restoreAgencyTarget.name}`}
          maxWidth="md"
        >
          <div className="space-y-4 pt-1 text-xs">
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-emerald-950 dark:text-emerald-200">
                <strong className="block font-black">Réintégration Immédiate :</strong>
                <p className="leading-relaxed">
                  L'agence repassera à l'état ACTIF. Les utilisateurs retrouveront leurs accès selon l'état de validité de leur licence commerciale.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setRestoreAgencyTarget(null)}>
                Annuler
              </Button>
              <Button variant="primary" onClick={handleConfirmRestore} className="font-bold">
                Confirmer la Restauration
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: SUPPRESSION DÉFINITIVE SÉCURISÉE (ULTIME RECOURS) */}
      {/* ========================================================================= */}
      {deleteAgencyTarget && (
        <Modal
          isOpen={true}
          onClose={() => {
            setDeleteAgencyTarget(null);
            setDeleteConfirmationName('');
          }}
          title={`⚠️ SUPPRESSION DÉFINITIVE — ${deleteAgencyTarget.name}`}
          maxWidth="lg"
        >
          <div className="space-y-4 pt-1 text-xs">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-900 dark:text-rose-200">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 leading-relaxed">
                <strong className="text-sm font-black text-rose-950 dark:text-rose-100 block">
                  ACTION STRICTEMENT IRRÉVERSIBLE & EXCEPTIONNELLE
                </strong>
                <p>
                  Vous vous apprêtez à supprimer définitivement l'agence <strong>« {deleteAgencyTarget.name} »</strong> ({deleteAgencyTarget.code}) ainsi que toutes ses données associées (utilisateurs, catalogue articles, stocks, factures, historiques).
                </p>
                <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                  💡 Recommandation de sécurité : Téléchargez impérativement une sauvegarde complète au format JSON avant de procéder.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <strong className="text-slate-800 dark:text-slate-200 block text-xs">Sauvegarde de Sécurité Préalable</strong>
                <span className="text-[11px] text-slate-500">Exporter l'archive JSON avant destruction</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={() => handleDownloadAgencyBackup(deleteAgencyTarget)}
                className="text-xs font-bold text-emerald-600 border-emerald-300 hover:bg-emerald-50"
              >
                Télécharger Sauvegarde JSON
              </Button>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-800 dark:text-slate-200 block">
                Pour confirmer la suppression, saisissez exactement le nom officiel de l'agence :
              </label>
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-center font-bold text-slate-900 dark:text-white select-all">
                {deleteAgencyTarget.name}
              </div>
              <Input
                type="text"
                placeholder="Recopiez le nom exact ici..."
                value={deleteConfirmationName}
                onChange={(e) => setDeleteConfirmationName(e.target.value)}
                className="text-xs font-bold"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteAgencyTarget(null);
                  setDeleteConfirmationName('');
                }}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                icon={Trash2}
                disabled={deleteConfirmationName.trim() !== deleteAgencyTarget.name.trim()}
                onClick={handleConfirmPermanentDelete}
                className="font-black"
              >
                Supprimer Définitivement
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FICHE CLIENT DÉTAILLÉE 360° (SUPER ADMINISTRATEUR) */}
      {/* ========================================================================= */}
      {selectedClientForView && (
        <Modal
          isOpen={Boolean(selectedClientForView)}
          onClose={() => setSelectedClientForView(null)}
          title={`Fiche Client : ${selectedClientForView.firstName} ${selectedClientForView.lastName}`}
          maxWidth="2xl"
        >
          <div className="space-y-5 pt-1 text-xs">
            {/* Header / Identity Banner */}
            <div className="p-4 bg-gradient-to-r from-slate-900 to-brand-950 rounded-2xl text-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-lg">
                  {selectedClientForView.firstName?.[0]?.toUpperCase() || 'C'}
                </div>
                <div>
                  <h4 className="text-base font-black text-white">
                    {selectedClientForView.firstName} {selectedClientForView.lastName}
                  </h4>
                  <p className="text-slate-300 text-[11px] font-mono">
                    {selectedClientForView.phone} {selectedClientForView.email ? `• ${selectedClientForView.email}` : ''}
                  </p>
                </div>
              </div>

              <Badge
                variant={selectedClientForView.status === 'SUSPENDED' || selectedClientForView.isActive === false ? 'danger' : 'success'}
                size="md"
                className="font-extrabold uppercase text-[10px]"
              >
                {selectedClientForView.status === 'SUSPENDED' || selectedClientForView.isActive === false ? '🔴 Suspendu' : '🟢 Actif'}
              </Badge>
            </div>

            {/* Section 1: Coordonnées & Identité */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <h5 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                1. Identité & Coordonnées
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">Prénom & Nom</span>
                  <strong className="text-slate-900 dark:text-white font-bold">
                    {selectedClientForView.firstName} {selectedClientForView.lastName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Téléphone</span>
                  <strong className="text-slate-900 dark:text-white font-mono">
                    {selectedClientForView.phone || 'Non renseigné'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Adresse E-mail</span>
                  <strong className="text-slate-900 dark:text-white truncate block">
                    {selectedClientForView.email || 'Non renseignée'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Ville / Localisation</span>
                  <strong className="text-slate-900 dark:text-white">
                    {selectedClientForView.city || 'Conakry'} {selectedClientForView.commune ? `(${selectedClientForView.commune})` : ''}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Date d'inscription</span>
                  <strong className="text-slate-900 dark:text-white font-mono">
                    {selectedClientForView.createdAt ? formatDate(selectedClientForView.createdAt) : 'Non daté'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Compte Utilisateur Connecté</span>
                  <strong className="text-slate-900 dark:text-white">
                    {selectedClientForView.userAccount ? '✓ Oui (Marketplace)' : '— Non (Client Interne)'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Section 2: Origine du Client & Agence Principale */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <h5 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                2. Type de Client & Agence Principale
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Type de Client</span>
                  <Badge variant={selectedClientForView.origin === 'MARKETPLACE' ? 'primary' : 'success'} size="sm" className="font-bold">
                    {selectedClientForView.clientTypeLabel || (selectedClientForView.origin === 'MARKETPLACE' ? 'CLIENT MARKETPLACE' : 'CLIENT BOUTIQUE')}
                  </Badge>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Agence Principale</span>
                  <strong className="text-slate-900 dark:text-white text-xs block">
                    {selectedClientForView.principalAgencyLabel || 'Aucune'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Section 3: Relations Boutiques & Multi-Boutiques */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <h5 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                  3. Boutiques Associées ({selectedClientForView.linkedStores?.length || 0})
                </h5>
                {selectedClientForView.linkedStores?.length >= 2 && (
                  <Badge variant="warning" size="sm" className="font-extrabold uppercase text-[9px]">
                    Multi-Boutiques ({selectedClientForView.linkedStores.length})
                  </Badge>
                )}
              </div>

              {selectedClientForView.linkedStores && selectedClientForView.linkedStores.length > 0 ? (
                <div className="space-y-2">
                  {selectedClientForView.linkedStores.map((store: Tenant) => (
                    <div
                      key={store.id}
                      className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-brand-600" />
                        <div>
                          <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                            {store.name}
                          </strong>
                          <span className="text-[10px] text-slate-400 font-mono">Code: {store.code} • {store.city || 'Conakry'}</span>
                        </div>
                      </div>
                      <Badge variant="success" size="sm" className="text-[10px] font-bold">
                        ★ Client Boutique
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic text-xs">
                  Aucune boutique spécifique rattachée (Client public Marketplace).
                </p>
              )}
            </div>

            {/* Section 4: Historique des Commandes & Ventes */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <h5 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                  4. Commandes & Historique d'Achats ({selectedClientForView.totalOrdersCount || 0})
                </h5>
                <strong className="text-emerald-600 dark:text-emerald-400 font-black text-xs">
                  Total Dépensé : {formatCurrency(selectedClientForView.totalSpentAmount || 0)}
                </strong>
              </div>

              {selectedClientForView.ordersList && selectedClientForView.ordersList.length > 0 ? (
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {selectedClientForView.ordersList.map((ord: any) => (
                    <div
                      key={ord.id}
                      className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <strong className="font-mono text-[11px] text-slate-800 dark:text-slate-200 block">
                          #{ord.reference}
                        </strong>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(ord.date)} {ord.storeName ? `• ${ord.storeName}` : ''}
                        </span>
                      </div>
                      <div className="text-right">
                        <strong className="text-emerald-600 dark:text-emerald-400 block font-bold text-xs">
                          {formatCurrency(ord.amount)}
                        </strong>
                        <Badge variant="primary" size="sm" className="text-[9px]">
                          {ord.status || 'COMPLÉTÉ'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic text-xs">
                  Aucune commande enregistrée pour le moment.
                </p>
              )}
            </div>

            {/* Section 5: Messagerie & Activité */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <h5 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                5. Supervision Messagerie & Activité
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Conversations</span>
                  <strong className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                    {selectedClientForView.conversationsCount || 0} discussion(s)
                  </strong>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Dernière Connexion</span>
                  <strong className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-1 block">
                    {selectedClientForView.lastLoginAt ? formatDate(selectedClientForView.lastLoginAt) : 'Jamais'}
                  </strong>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Dernière Activité</span>
                  <strong className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-1 block">
                    {selectedClientForView.lastActivityDate ? formatDate(selectedClientForView.lastActivityDate) : 'Aucune'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Section 6: Actions de Supervision */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                onClick={() => setSelectedClientForView(null)}
              >
                Fermer
              </Button>

              <Button
                variant={selectedClientForView.status === 'SUSPENDED' || selectedClientForView.isActive === false ? 'primary' : 'danger'}
                onClick={() => {
                  const res = dbStore.toggleClientSuspension(selectedClientForView.id);
                  if (res.success) {
                    showToast(
                      res.status === 'SUSPENDED' ? 'Compte Client Suspendu' : 'Compte Client Réactivé',
                      res.message,
                      res.status === 'SUSPENDED' ? 'WARNING' : 'SUCCESS'
                    );
                    setSelectedClientForView({
                      ...selectedClientForView,
                      status: res.status,
                      isActive: res.status === 'ACTIVE'
                    });
                  }
                }}
              >
                {selectedClientForView.status === 'SUSPENDED' || selectedClientForView.isActive === false
                  ? '🟢 Réactiver le Compte Client'
                  : '🔴 Suspendre le Compte Client'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
