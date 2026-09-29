import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { isValidPhoneNumber } from '../../lib/phoneValidation';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { dbStore } from '../../server/db/mockStore';
import { checkAccountLockout } from '../../server/security/securityEngine';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { User, Role, DepartmentCode } from '../../types';
import { formatDate } from '../../lib/utils';
import {
  ShieldCheck, UserPlus, Shield, Check, Lock, Users,
  Edit2, UserX, UserCheck, Trash2, Search, Filter, KeyRound, AlertTriangle, Plus, Sliders,
  Building, CheckCircle2, ShieldAlert, Unlock, Clock
} from 'lucide-react';

const AVAILABLE_PERMISSIONS = [
  { code: 'orders.view', category: 'Commandes', label: 'Consulter les commandes' },
  { code: 'orders.create', category: 'Commandes', label: 'Créer de nouvelles commandes' },
  { code: 'orders.update', category: 'Commandes', label: 'Modifier les commandes' },
  { code: 'orders.deliver', category: 'Commandes', label: 'Livrer les commandes soldées' },
  { code: 'orders.deliver_unpaid', category: 'Commandes', label: 'Autoriser la livraison sans paiement (avec dette)' },
  { code: 'orders.cancel', category: 'Commandes', label: 'Annuler une commande' },
  
  { code: 'production.view', category: 'Production', label: 'Consulter l\'atelier de production' },
  { code: 'production.update', category: 'Production', label: 'Mettre à jour les statuts de fabrication' },
  
  { code: 'cash.view', category: 'Caisse', label: 'Consulter la caisse et les soldes' },
  { code: 'cash.create', category: 'Caisse', label: 'Enregistrer des entrées / sorties de caisse' },
  { code: 'cash.update', category: 'Caisse', label: 'Gérer les sessions de caisse' },
  { code: 'cash.close', category: 'Caisse', label: 'Clôturer la caisse du jour' },
  
  { code: 'payments.view', category: 'Paiements & Dettes', label: 'Consulter les règlements' },
  { code: 'payments.create', category: 'Paiements & Dettes', label: 'Encaisser les paiements et acomptes' },
  { code: 'payments.cancel', category: 'Paiements & Dettes', label: 'Annuler un paiement ou remboursement' },
  { code: 'debts.view', category: 'Paiements & Dettes', label: 'Consulter les dettes et créances clients' },
  { code: 'debts.collect', category: 'Paiements & Dettes', label: 'Recouvrer et solder les dettes clients' },
  
  { code: 'training.view', category: 'Formations', label: 'Consulter le catalogue et les sessions' },
  { code: 'training.create', category: 'Formations', label: 'Créer des formations et sessions' },
  { code: 'training.update', category: 'Formations', label: 'Gérer apprenants, présences et notes' },
  { code: 'training.delete', category: 'Formations', label: 'Supprimer ou désactiver des formations' },
  
  { code: 'pricing.view', category: 'Tarifs & Remises', label: 'Consulter les grilles tarifaires' },
  { code: 'pricing.create', category: 'Tarifs & Remises', label: 'Ajouter de nouvelles prestations' },
  { code: 'pricing.update', category: 'Tarifs & Remises', label: 'Modifier les tarifs de référence et paliers' },
  { code: 'discounts.create', category: 'Tarifs & Remises', label: 'Accorder des remises exceptionnelles' },
  { code: 'discounts.approve', category: 'Tarifs & Remises', label: 'Valider les remises supérieures' },
  
  { code: 'invoices.view', category: 'Facturation', label: 'Consulter les factures' },
  { code: 'invoices.create', category: 'Facturation', label: 'Générer des factures' },
  { code: 'invoices.print', category: 'Facturation', label: 'Imprimer les factures et reçus' },
  
  { code: 'signatures.view', category: 'Identité & Signatures', label: 'Consulter les signatures officielles' },
  { code: 'signatures.update', category: 'Identité & Signatures', label: 'Modifier signatures et cachet officiel' },
  
  { code: 'users.view', category: 'Administration', label: 'Consulter la liste des utilisateurs' },
  { code: 'users.create', category: 'Administration', label: 'Créer des collaborateurs' },
  { code: 'users.update', category: 'Administration', label: 'Modifier ou réinitialiser mot de passe' },
  { code: 'users.delete', category: 'Administration', label: 'Désactiver ou supprimer des comptes' },
  
  { code: 'roles.view', category: 'Administration', label: 'Consulter les postes et rôles' },
  { code: 'roles.create', category: 'Administration', label: 'Créer de nouveaux postes' },
  { code: 'roles.update', category: 'Administration', label: 'Modifier les permissions d\'un poste' },
  
  { code: 'reports.view', category: 'Statistiques & Audit', label: 'Consulter les statistiques financières' },
  { code: 'audit.view', category: 'Statistiques & Audit', label: 'Consulter le journal d\'audit' },
];

export const UsersRbacView: React.FC = () => {
  const { currentTenant, currentUser, isSuperAdmin } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals User
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
  const [adminResetNewPassword, setAdminResetNewPassword] = useState('');

  // Modals Role
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRoleForDetails, setSelectedRoleForDetails] = useState<Role | null>(null);

  // Form State: User
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleCode, setRoleCode] = useState('CAISSIER');
  const [department, setDepartment] = useState<DepartmentCode>('ACCUEIL_CAISSE_STOCK');
  const [initialPassword, setInitialPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Form State: Role
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const departments: { code: DepartmentCode; label: string }[] = [
    { code: 'ADMINISTRATION', label: 'Direction & Administration Générale' },
    { code: 'ACCUEIL_CAISSE_STOCK', label: 'Accueil, Caisse, Ventes & Stock' },
    { code: 'PRODUCTION_MATERIEL', label: 'Atelier de Production & Matériel' },
    { code: 'FORMATION', label: 'Pôle Formation & LMS' },
  ];

  // Isolated Agency Users & Roles
  const currentAgencyId = currentTenant?.id || 't-001';

  const agencyUsers = useMemo(() => {
    return dbStore.getUsersByTenant(currentAgencyId);
  }, [state.users, currentAgencyId]);

  const agencyRoles = useMemo(() => {
    return state.roles.filter(r => r.isSystem || r.tenantId === currentAgencyId);
  }, [state.roles, currentAgencyId]);

  const resetUserForm = () => {
    setFirstName('');
    setLastName('');
    setUsername('');
    setEmail('');
    setPhone('');
    setRoleCode(agencyRoles[0]?.code || 'CAISSIER');
    setDepartment('ACCUEIL_CAISSE_STOCK');
    setInitialPassword('');
    setIsActive(true);
    setEditingUser(null);
  };

  const handleOpenCreateModal = () => {
    resetUserForm();
    setIsNewUserModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    // Security check
    if (!isSuperAdmin && user.tenantId !== currentAgencyId) {
      showToast('Accès Refusé', "Cet utilisateur n'appartient pas à votre agence.", 'DANGER');
      return;
    }
    setEditingUser(user);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setUsername(user.username || '');
    setEmail(user.email);
    setPhone(user.phone || '');
    setRoleCode(user.roles[0]?.code || 'CAISSIER');
    setDepartment((user.department as DepartmentCode) || 'ACCUEIL_CAISSE_STOCK');
    setInitialPassword('');
    setIsActive(user.isActive);
    setIsNewUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !username.trim()) {
      showToast('Erreur', 'Veuillez renseigner tous les champs obligatoires (Nom, Prénom, Login, Email).', 'DANGER');
      return;
    }

    if (phone.trim() && !isValidPhoneNumber(phone, { allowEmpty: true })) {
      showToast('Erreur Téléphone', "Le numéro de téléphone est invalide (les lettres et caractères spéciaux sont rejetés).", 'DANGER');
      return;
    }

    const assignedRole = agencyRoles.find(r => r.code === roleCode) || agencyRoles[0] || state.roles[0];

    if (editingUser) {
      const res = dbStore.updateSecureUser(editingUser.id, {
        firstName,
        lastName,
        username,
        email,
        phone,
        role: assignedRole,
        department,
        isActive,
        password: initialPassword || undefined
      }, currentAgencyId, isSuperAdmin);

      if (res.success) {
        showToast('Utilisateur Modifié', res.message, 'SUCCESS');
        setIsNewUserModalOpen(false);
      } else {
        showToast('Erreur de Modification', res.message, 'DANGER');
      }
    } else {
      const res = dbStore.createSecureUser({
        firstName,
        lastName,
        username,
        email,
        phone,
        role: assignedRole,
        department,
        initialPassword,
        isActive,
        branchId: 'b-001'
      }, currentAgencyId, isSuperAdmin);

      if (res.success) {
        showToast('Compte Créé', res.message, 'SUCCESS');
        setIsNewUserModalOpen(false);
      } else {
        showToast('Erreur de Création', res.message, 'DANGER');
      }
    }
  };

  const handleToggleStatus = (user: User) => {
    const res = dbStore.toggleSecureUserStatus(user.id, currentAgencyId, isSuperAdmin);
    if (res.success) {
      showToast(
        res.newStatus ? 'Compte Activé' : 'Compte Désactivé',
        res.message,
        res.newStatus ? 'SUCCESS' : 'WARNING'
      );
    } else {
      showToast('Action Refusée', res.message, 'DANGER');
    }
  };

  const handleDeleteUser = () => {
    if (!userToDelete) return;
    const res = dbStore.deleteSecureUser(userToDelete.id, currentAgencyId, isSuperAdmin);
    if (res.success) {
      showToast('Compte Supprimé', res.message, 'SUCCESS');
      setUserToDelete(null);
    } else {
      showToast('Suppression Refusée', res.message, 'DANGER');
    }
  };

  const handleAdminResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToResetPassword || !adminResetNewPassword.trim()) return;

    const res = dbStore.resetSecureUserPassword(userToResetPassword.id, adminResetNewPassword.trim(), currentAgencyId, isSuperAdmin);
    if (res.success) {
      showToast('Mot de Passe Réinitialisé', res.message, 'SUCCESS');
      setUserToResetPassword(null);
      setAdminResetNewPassword('');
    } else {
      showToast('Réinitialisation Refusée', res.message, 'DANGER');
    }
  };

  // Open Create Role Modal
  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setNewRoleName('');
    setNewRoleCode('');
    setNewRoleDescription('');
    setSelectedPermissions(['orders.view', 'production.view']);
    setIsNewRoleModalOpen(true);
  };

  // Open Edit Role Modal
  const handleOpenEditRole = (role: Role) => {
    setEditingRole(role);
    setNewRoleName(role.name);
    setNewRoleCode(role.code);
    setNewRoleDescription(role.description || '');
    setSelectedPermissions([...role.permissions]);
    setIsNewRoleModalOpen(true);
  };

  // Save Role & Granular Permissions
  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim() || !newRoleCode.trim()) {
      showToast('Erreur', 'Veuillez saisir le nom et le code du poste.', 'DANGER');
      return;
    }

    const code = newRoleCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    if (editingRole) {
      dbStore.updateState(draft => {
        const r = draft.roles.find(item => item.id === editingRole.id);
        if (r) {
          r.name = newRoleName.trim();
          r.description = newRoleDescription.trim();
          r.permissions = selectedPermissions;
        }

        // Propagate updated permissions to all users having this role in this agency
        draft.users.forEach(u => {
          if (u.tenantId === currentAgencyId && u.roles.some(ur => ur.id === editingRole.id || ur.code === editingRole.code)) {
            u.permissions = selectedPermissions;
          }
        });
      });

      dbStore.logAudit('ROLE_UPDATED', 'ROLE', editingRole.id, null, { name: newRoleName, permissionsCount: selectedPermissions.length, tenantId: currentAgencyId });
      showToast('Poste Modifié', `Les permissions du poste "${newRoleName}" ont été mises à jour.`, 'SUCCESS');
    } else {
      const newRole: Role = {
        id: `role-${Date.now()}`,
        tenantId: currentAgencyId,
        name: newRoleName.trim(),
        code: code,
        description: newRoleDescription.trim() || 'Poste personnalisé',
        permissions: selectedPermissions,
        isCustom: true,
      };

      dbStore.updateState(draft => {
        draft.roles.push(newRole);
      });

      dbStore.logAudit('ROLE_CREATED', 'ROLE', newRole.id, null, { name: newRole.name, code: newRole.code, tenantId: currentAgencyId });
      showToast('Nouveau Poste Créé', `Le poste "${newRole.name}" est prêt à être attribué aux utilisateurs de votre agence.`, 'SUCCESS');
    }

    setIsNewRoleModalOpen(false);
  };

  const handleUnlockUser = (user: User) => {
    if (!currentUser) return;
    const res = dbStore.unlockUserAccount(user.id, currentUser, "Déverrouillage administratif par l'agence");
    if (res.success) {
      showToast('Compte Déverrouillé', res.message, 'SUCCESS');
    } else {
      showToast('Action Refusée', res.message, 'DANGER');
    }
  };

  // Toggle permission checkbox
  const handleTogglePermission = (permCode: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permCode) ? prev.filter(p => p !== permCode) : [...prev, permCode]
    );
  };

  // Filtered Users List (Strictly Isolated to the current agency)
  const filteredUsers = useMemo(() => {
    return agencyUsers.filter(u => {
      const matchesSearch =
        u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === 'ALL' || u.roles.some(r => r.code === roleFilter);
      const matchesDept = departmentFilter === 'ALL' || u.department === departmentFilter;
      const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? u.isActive : !u.isActive);

      return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });
  }, [agencyUsers, searchTerm, roleFilter, departmentFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header with Strict Agency Identification */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-brand-500" />
              Gestion des Utilisateurs, Postes & Permissions
            </h2>
            <Badge variant="primary" size="sm" className="font-bold flex items-center gap-1">
              <Building className="w-3 h-3" />
              {currentTenant?.name || 'Agence Active'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Espace sécurisé & strictement isolé : gestion des comptes et attribution des postes pour <strong>{currentTenant?.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'users' ? (
            <Button variant="primary" icon={UserPlus} onClick={handleOpenCreateModal}>
              Créer un Utilisateur
            </Button>
          ) : (
            <Button variant="primary" icon={Plus} onClick={handleOpenCreateRole}>
              Créer un Nouveau Poste
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'users', label: 'Collaborateurs de l\'Agence', icon: Users, count: agencyUsers.length },
          { id: 'roles', label: 'Postes & Permissions Extensibles', icon: Sliders, count: agencyRoles.length },
        ]}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as 'users' | 'roles')}
      />

      {/* ========================================================================= */}
      {/* TAB 1: USERS */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <Card className="p-5 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Rechercher par nom, login, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs py-1.5 w-auto"
              >
                <option value="ALL">Tous les Postes</option>
                {agencyRoles.map(r => (
                  <option key={r.id} value={r.code}>{r.name}</option>
                ))}
              </Select>

              <Select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="text-xs py-1.5 w-auto"
              >
                <option value="ALL">Tous les Départements</option>
                {departments.map(d => (
                  <option key={d.code} value={d.code}>{d.label}</option>
                ))}
              </Select>

              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs py-1.5 w-auto"
              >
                <option value="ALL">Tous les Statuts</option>
                <option value="ACTIVE">Actif uniquement</option>
                <option value="INACTIVE">Désactivé uniquement</option>
              </Select>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Poste / Rôle</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date Création</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const role = user.roles[0];
                  const isCurrentLoggedUser = currentUser?.id === user.id;
                  const lockStatus = checkAccountLockout(user);

                  return (
                    <TableRow key={user.id} className={isCurrentLoggedUser ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                            {user.firstName[0]}{user.lastName[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <strong className="text-xs font-bold text-slate-900 dark:text-white">
                                {user.firstName} {user.lastName}
                              </strong>
                              {isCurrentLoggedUser && (
                                <Badge variant="primary" size="sm" className="text-[9px] py-0 px-1 font-bold">
                                  Vous
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="font-mono font-medium text-brand-600 dark:text-brand-400">
                                @{user.username}
                              </span>
                              <span>•</span>
                              <span>{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="primary" size="sm" className="font-bold text-[10px]">
                          {role?.name || 'Sans poste'}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                        {departments.find(d => d.code === user.department)?.label || user.department}
                      </TableCell>

                      <TableCell>
                        {lockStatus.isLocked ? (
                            <Badge variant="danger" size="sm" className="font-bold text-[10px] flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              BLOQUÉ ({lockStatus.remainingMinutes}m)
                            </Badge>
                          ) : (
                            <Badge variant={user.isActive ? 'success' : 'danger'} size="sm" className="font-bold text-[10px]">
                              {user.isActive ? 'ACTIF' : 'DÉSACTIVÉ'}
                            </Badge>
                          )}
                      </TableCell>

                      <TableCell className="text-xs text-slate-500 font-mono">
                        {user.createdAt ? formatDate(user.createdAt, 'dd/MM/yyyy') : '01/01/2026'}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {lockStatus.isLocked && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleUnlockUser(user)}
                              className="text-xs py-1 px-2.5 h-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 shadow-sm"
                              title="Déverrouiller le compte immédiatement"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Débloquer</span>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenEditModal(user)}
                            className="text-xs py-1 px-2 h-auto text-slate-600 hover:text-brand-600"
                            title="Modifier les informations"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setUserToResetPassword(user);
                              setAdminResetNewPassword('password123');
                            }}
                            className="text-xs py-1 px-2 h-auto text-amber-700 bg-amber-50 hover:bg-amber-100"
                            title="Réinitialiser le mot de passe"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>

                          {!isCurrentLoggedUser && (
                            <>
                              <Button
                                size="sm"
                                variant={user.isActive ? 'secondary' : 'primary'}
                                onClick={() => handleToggleStatus(user)}
                                className={`text-xs py-1 px-2 h-auto ${
                                  user.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-white'
                                }`}
                                title={user.isActive ? 'Désactiver le compte' : 'Activer le compte'}
                              >
                                {user.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              </Button>

                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setUserToDelete(user)}
                                className="text-xs py-1 px-2 h-auto text-rose-600 hover:bg-rose-50"
                                title="Supprimer le collaborateur"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                      Aucun collaborateur trouvé pour cette agence avec les filtres sélectionnés.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ROLES & PERMISSIONS */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agencyRoles.map((role) => {
            const usersCount = agencyUsers.filter(u => u.roles.some(r => r.id === role.id || r.code === role.code)).length;
            const hasFullAccess = role.permissions.includes('*');

            return (
              <Card key={role.id} className="p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition-shadow">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {role.name}
                        </h4>
                        {role.isSystem && (
                          <Badge variant="secondary" size="sm" className="text-[9px] py-0 px-1 font-bold">
                            Système
                          </Badge>
                        )}
                        {role.isCustom && (
                          <Badge variant="primary" size="sm" className="text-[9px] py-0 px-1 font-bold">
                            Personnalisé
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                        CODE: {role.code}
                      </span>
                    </div>

                    <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2">
                    {role.description || 'Poste standard avec accès aux fonctions autorisées.'}
                  </p>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Collaborateurs affectés :</span>
                    <strong className="text-brand-600 dark:text-brand-400 font-bold">{usersCount}</strong>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Permissions Granulaires ({hasFullAccess ? 'Accès Total' : role.permissions.length})
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {hasFullAccess ? (
                        <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded">
                          ★ Administrateur Total (Toutes Permissions)
                        </span>
                      ) : (
                        role.permissions.map(p => (
                          <span key={p} className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">
                            {p}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEditRole(role)}
                    className="text-xs py-1 px-3 h-auto font-bold"
                  >
                    <Sliders className="w-3.5 h-3.5 mr-1 text-brand-500" />
                    Configurer Permissions
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRÉER / MODIFIER UTILISATEUR */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isNewUserModalOpen}
        onClose={() => setIsNewUserModalOpen(false)}
        title={editingUser ? `Modifier le Collaborateur — @${editingUser.username}` : "Création d'un Nouveau Collaborateur d'Agence"}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveUser} className="space-y-4 pt-1">
          {/* Agency Context Indicator */}
          <div className="p-3 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 rounded-xl text-xs flex items-center justify-between text-brand-800 dark:text-brand-300">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              <span>Agence de Rattachement : <strong>{currentTenant?.name}</strong></span>
            </div>
            <Badge variant="primary" size="sm" className="text-[10px]">
              {currentTenant?.code}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Prénom *
              </label>
              <Input
                type="text"
                placeholder="ex: Fatoumata"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nom de Famille *
              </label>
              <Input
                type="text"
                placeholder="ex: Barry"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Identifiant / Login Unique *
              </label>
              <Input
                type="text"
                placeholder="ex: fatou.caisse"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Adresse Email *
              </label>
              <Input
                type="email"
                placeholder="ex: b.bothie@nicost-guinee.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <PhoneInput
                label="Téléphone de Contact"
                placeholder="ex: +224 622 11 22 33"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Poste / Rôle Métier *
              </label>
              <Select
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value)}
                required
              >
                {agencyRoles.map(r => (
                  <option key={r.id} value={r.code}>{r.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Département / Pôle
              </label>
              <Select
                value={department}
                onChange={(e) => setDepartment(e.target.value as DepartmentCode)}
              >
                {departments.map(d => (
                  <option key={d.code} value={d.code}>{d.label}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {editingUser ? "Nouveau Mot de Passe (Optionnel)" : "Mot de Passe Initial"}
              </label>
              <Input
                type="password"
                placeholder={editingUser ? "Laisser vide pour conserver" : "Défaut: [login]123"}
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsNewUserModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={Check}
              className="font-bold py-2 px-5"
            >
              {editingUser ? "Enregistrer les Modifications" : "Créer le Collaborateur"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: RESET MOT DE PASSE PAR ADMIN */}
      {/* ========================================================================= */}
      {userToResetPassword && (
        <Modal
          isOpen={true}
          onClose={() => setUserToResetPassword(null)}
          title={`Réinitialiser le Mot de Passe — @${userToResetPassword.username}`}
          maxWidth="sm"
        >
          <form onSubmit={handleAdminResetPassword} className="space-y-4 pt-1">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Définissez un nouveau mot de passe pour <strong>{userToResetPassword.firstName} {userToResetPassword.lastName}</strong> ({userToResetPassword.email}).
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nouveau Mot de Passe Temporaire *
              </label>
              <Input
                type="text"
                value={adminResetNewPassword}
                onChange={(e) => setAdminResetNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setUserToResetPassword(null)}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                type="submit"
                className="font-bold"
              >
                Appliquer le Mot de Passe
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUPPRIMER UTILISATEUR */}
      {/* ========================================================================= */}
      {userToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setUserToDelete(null)}
          title={`Confirmation de Suppression — @${userToDelete.username}`}
          maxWidth="sm"
        >
          <div className="space-y-4 pt-1">
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                Êtes-vous sûr de vouloir supprimer le compte de <strong>{userToDelete.firstName} {userToDelete.lastName}</strong> ? Cette action est irréversible.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setUserToDelete(null)}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteUser}
                className="font-bold"
              >
                Supprimer Définitivement
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRÉER / MODIFIER UN POSTE & PERMISSIONS */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isNewRoleModalOpen}
        onClose={() => setIsNewRoleModalOpen(false)}
        title={editingRole ? `Configurer les Permissions — ${editingRole.name}` : "Création d'un Nouveau Poste Métier"}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveRole} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Intitulé du Poste *
              </label>
              <Input
                type="text"
                placeholder="ex: Responsable SAV & Livraison"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Code Technique Unique *
              </label>
              <Input
                type="text"
                placeholder="ex: RESP_SAV"
                value={newRoleCode}
                onChange={(e) => setNewRoleCode(e.target.value)}
                disabled={Boolean(editingRole?.isSystem)}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Description & Attributions
            </label>
            <Input
              type="text"
              placeholder="ex: Gère les livraisons clients, les garanties et le service après-vente"
              value={newRoleDescription}
              onChange={(e) => setNewRoleDescription(e.target.value)}
            />
          </div>

          {/* Permissions Matrix */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center justify-between">
              <span>Permissions Granulaires Autorisées</span>
              <span className="text-[11px] font-normal text-brand-600">
                {selectedPermissions.length} permission(s) cochée(s)
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
              {AVAILABLE_PERMISSIONS.map(perm => {
                const isChecked = selectedPermissions.includes(perm.code);
                return (
                  <div
                    key={perm.code}
                    onClick={() => handleTogglePermission(perm.code)}
                    className={`p-2 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-all select-none ${
                      isChecked
                        ? 'bg-brand-50 dark:bg-brand-950/80 border-brand-300 dark:border-brand-700 text-brand-900 dark:text-brand-100 font-semibold shadow-sm'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          [{perm.category}]
                        </span>
                        <span className="text-xs font-bold">{perm.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        {perm.code}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsNewRoleModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={Check}
              className="font-bold py-2 px-5"
            >
              Enregistrer le Poste
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
