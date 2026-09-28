import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { isValidPhoneNumber } from '../../lib/phoneValidation';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Person, PersonType } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  Users, UserPlus, Search, Phone, Mail, MapPin, Eye,
  ShoppingBag, GraduationCap, CreditCard, Award, Filter,
  Edit, Trash2, Power, AlertTriangle, Building, FileText,
  Clock, CheckCircle2, ShieldAlert, UserCheck, DollarSign
} from 'lucide-react';
import { OrderPaymentModal } from '../orders/OrderPaymentModal';

export const PersonsView: React.FC = () => {
  const { currentTenant, currentUser, hasPermission } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  // Search & Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | PersonType | 'COMPANY'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [personToEdit, setPersonToEdit] = useState<Person | null>(null);
  const [personToView, setPersonToView] = useState<Person | null>(null);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [orderForPayment, setOrderForPayment] = useState<any>(null);

  // New Client Form State
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newType, setNewType] = useState<PersonType>('CUSTOMER');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);

  // Edit Client Form State
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editType, setEditType] = useState<PersonType>('CUSTOMER');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const currentAgencyId = currentTenant?.id || 't-001';

  const agencyPersons: Person[] = useMemo(() => {
    if (currentAgencyId === 'ALL' || currentAgencyId === 'global') return state.persons || [];
    return (state.persons || []).filter((p: Person) => p.tenantId === currentAgencyId || p.tenantId === 'global');
  }, [state.persons, currentAgencyId]);

  // Filtered persons
  const filteredPersons = useMemo(() => {
    return agencyPersons.filter((p: Person) => {
      const matchSearch =
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        (p.phone && p.phone.includes(search)) ||
        (p.email && p.email.toLowerCase().includes(search.toLowerCase())) ||
        (p.customerProfile?.customerNumber && p.customerProfile.customerNumber.toLowerCase().includes(search.toLowerCase())) ||
        (p.customerProfile?.companyName && p.customerProfile.companyName.toLowerCase().includes(search.toLowerCase())) ||
        (p.learnerProfile?.learnerNumber && p.learnerProfile.learnerNumber.toLowerCase().includes(search.toLowerCase()));

      let matchType = true;
      if (typeFilter === 'COMPANY') matchType = Boolean(p.customerProfile?.isCompany || p.customerProfile?.companyName);
      else if (typeFilter !== 'ALL') matchType = p.types.includes(typeFilter);

      let matchStatus = true;
      if (statusFilter === 'ACTIVE') matchStatus = p.isActive !== false;
      else if (statusFilter === 'ARCHIVED') matchStatus = p.isActive === false;

      return matchSearch && matchType && matchStatus;
    });
  }, [agencyPersons, search, typeFilter, statusFilter]);

  // KPIs
  const metrics = useMemo(() => {
    const total = agencyPersons.length;
    const active = agencyPersons.filter((p: Person) => p.isActive !== false).length;
    const learners = agencyPersons.filter((p: Person) => p.types.includes('LEARNER')).length;
    const companies = agencyPersons.filter((p: Person) => p.customerProfile?.isCompany || p.customerProfile?.companyName).length;

    return { total, active, learners, companies };
  }, [agencyPersons]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setNewFirstName('');
    setNewLastName('');
    setNewPhone('');
    setNewEmail('');
    setNewAddress('');
    setNewType('CUSTOMER');
    setNewCompanyName('');
    setNewNotes('');
    setNewIsActive(true);
    setIsCreateModalOpen(true);
  };

  // Submit Create Client
  const handleCreatePerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLastName.trim()) {
      showToast('Erreur', 'Veuillez saisir au moins le nom du client.', 'DANGER');
      return;
    }
    if (!newPhone.trim()) {
      showToast('Erreur', 'Veuillez renseigner un numéro de téléphone.', 'DANGER');
      return;
    }
    if (!isValidPhoneNumber(newPhone, { allowEmpty: false, required: true })) {
      showToast('Numéro Invalide', 'Veuillez saisir un numéro de téléphone valide sans lettres ni caractères non autorisés.', 'DANGER');
      return;
    }

    const personId = `pers-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const seq = (state.persons || []).length + 1;
    const customerNumber = `CLT-${new Date().getFullYear()}-${seq.toString().padStart(4, '0')}`;

    const newPerson: Person = {
      id: personId,
      tenantId: currentAgencyId,
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim() || undefined,
      address: newAddress.trim() || undefined,
      notes: newNotes.trim() || undefined,
      types: [newType],
      status: 'ACTIVE',
      isActive: newIsActive,
      customerProfile: {
        customerNumber,
        isCompany: Boolean(newCompanyName.trim()),
        companyName: newCompanyName.trim() || undefined,
        discountRate: 0,
        creditLimit: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dbStore.updateState(draft => {
      if (!draft.persons) draft.persons = [];
      draft.persons.unshift(newPerson);
    });

    showToast('Client Enregistré', `Le client ${newFirstName} ${newLastName} a été créé avec succès.`, 'SUCCESS');
    setIsCreateModalOpen(false);
  };

  // Open Edit Modal
  const handleOpenEdit = (p: Person) => {
    setPersonToEdit(p);
    setEditFirstName(p.firstName || '');
    setEditLastName(p.lastName || '');
    setEditPhone(p.phone || '');
    setEditEmail(p.email || '');
    setEditAddress(p.address || '');
    setEditType(p.types[0] || 'CUSTOMER');
    setEditCompanyName(p.customerProfile?.companyName || '');
    setEditNotes(p.notes || '');
    setEditIsActive(p.isActive !== false);
  };

  // Submit Edit Client
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personToEdit) return;

    if (!editLastName.trim()) {
      showToast('Erreur', 'Le nom du client est obligatoire.', 'DANGER');
      return;
    }
    if (editPhone.trim() && !isValidPhoneNumber(editPhone, { allowEmpty: false })) {
      showToast('Numéro Invalide', 'Le numéro de téléphone modifié est invalide.', 'DANGER');
      return;
    }

    const oldName = `${personToEdit.firstName} ${personToEdit.lastName}`.trim();
    const newName = `${editFirstName} ${editLastName}`.trim();

    dbStore.updateState(draft => {
      const person = draft.persons.find(p => p.id === personToEdit.id);
      if (person) {
        person.firstName = editFirstName.trim();
        person.lastName = editLastName.trim();
        person.phone = editPhone.trim() || undefined;
        person.email = editEmail.trim() || undefined;
        person.address = editAddress.trim() || undefined;
        person.notes = editNotes.trim() || undefined;
        person.isActive = editIsActive;
        person.updatedAt = new Date().toISOString();

        if (!person.types.includes(editType)) {
          person.types = [editType, ...person.types.filter(t => t !== editType)];
        }

        if (!person.customerProfile) {
          person.customerProfile = {
            customerNumber: `CLT-${Date.now().toString().slice(-4)}`,
            companyName: editCompanyName.trim() || undefined,
            isCompany: Boolean(editCompanyName.trim()),
            discountRate: 0,
            creditLimit: 1000000
          };
        } else {
          person.customerProfile.companyName = editCompanyName.trim() || undefined;
          person.customerProfile.isCompany = Boolean(editCompanyName.trim());
        }
      }
    });

    dbStore.logAudit('CLIENT_UPDATED', 'CLIENT', personToEdit.id, { name: oldName }, { name: newName, phone: editPhone });
    showToast('Client Modifié', `Les informations de ${newName} ont été mises à jour.`, 'SUCCESS');
    setPersonToEdit(null);

    // Refresh viewed person if active
    if (personToView && personToView.id === personToEdit.id) {
      setPersonToView(state.persons.find(p => p.id === personToEdit.id) || null);
    }
  };

  // Toggle Active / Archive (Soft Delete)
  const handleToggleActive = (p: Person) => {
    dbStore.updateState(draft => {
      const person = draft.persons.find(item => item.id === p.id);
      if (person) {
        person.isActive = !person.isActive;
        person.updatedAt = new Date().toISOString();
      }
    });

    const isNowActive = p.isActive === false;
    dbStore.logAudit(isNowActive ? 'CLIENT_REACTIVATED' : 'CLIENT_ARCHIVED', 'CLIENT', p.id, { isActive: p.isActive }, { isActive: isNowActive });
    showToast(
      isNowActive ? 'Client Réactivé' : 'Client Archivé',
      `Le dossier de ${p.firstName} ${p.lastName} est désormais ${isNowActive ? 'actif' : 'archivé'}.`,
      'INFO'
    );
  };

  // Delete Action with Dependency Check
  const handleDeleteClick = (p: Person) => {
    setPersonToDelete(p);
  };

  const handleConfirmDelete = () => {
    if (!personToDelete) return;

    const ordersCount = state.orders.filter(o => o.personId === personToDelete.id).length;
    const enrollmentsCount = state.enrollments.filter(e => e.learnerId === personToDelete.id).length;
    const paymentsCount = state.payments.filter(p => p.personId === personToDelete.id).length;

    const hasLinkedData = ordersCount > 0 || enrollmentsCount > 0 || paymentsCount > 0;

    if (hasLinkedData) {
      // Soft delete fallback to protect relational integrity
      handleToggleActive(personToDelete);
      showToast('Archivage Effectué', `Le client possède un historique lié (${ordersCount} commandes, ${enrollmentsCount} formations). Il a été archivé pour préserver les données.`, 'INFO');
      setPersonToDelete(null);
      return;
    }

    // Hard delete when zero dependencies
    dbStore.updateState(draft => {
      draft.persons = draft.persons.filter(p => p.id !== personToDelete.id);
    });

    dbStore.logAudit('CLIENT_DELETED', 'CLIENT', personToDelete.id, null, {
      name: `${personToDelete.firstName} ${personToDelete.lastName}`
    });

    showToast('Client Supprimé', `La fiche de ${personToDelete.firstName} ${personToDelete.lastName} a été définitivement supprimée.`, 'SUCCESS');
    setPersonToDelete(null);
  };

  // Transversal History for Selected Person
  const personOrders = useMemo(() => {
    if (!personToView) return [];
    return state.orders.filter(o => o.personId === personToView.id);
  }, [personToView, state.orders]);

  const personEnrollments = useMemo(() => {
    if (!personToView) return [];
    return state.enrollments.filter(e => e.learnerId === personToView.id);
  }, [personToView, state.enrollments]);

  const personPayments = useMemo(() => {
    if (!personToView) return [];
    return state.payments.filter(p => p.personId === personToView.id);
  }, [personToView, state.payments]);

  const personCertificates = useMemo(() => {
    if (!personToView) return [];
    return state.certificates.filter(c => c.learnerId === personToView.id);
  }, [personToView, state.certificates]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-500" />
            Gestion des Clients & Répertoire Unifié
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gestion partagée des Clients Services, Apprenants en Formation, Entreprises et Contacts.
          </p>
        </div>

        <Button
          variant="primary"
          icon={UserPlus}
          onClick={handleOpenCreateModal}
        >
          Nouveau Client
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Clients</span>
            <Users className="w-4 h-4 text-brand-500" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            {metrics.total}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Répertoire global du centre</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Clients Actifs</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-xl font-extrabold text-emerald-600 mt-1">
            {metrics.active}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Comptes actifs et réguliers</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Apprenants LMS</span>
            <GraduationCap className="w-4 h-4 text-brand-500" />
          </div>
          <h3 className="text-xl font-extrabold text-brand-600 mt-1">
            {metrics.learners}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Inscrits aux formations</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Comptes Entreprises</span>
            <Building className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-xl font-extrabold text-amber-600 mt-1">
            {metrics.companies}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Organisations & Sociétés</p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, code, téléphone, email, société..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">Tous les types de profils</option>
            <option value="CUSTOMER">Clients Services & Prestations</option>
            <option value="LEARNER">Apprenants Formation & LMS</option>
            <option value="COMPANY">Comptes Entreprises & Organisations</option>
            <option value="TRAINER">Formateurs</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">🟢 Actifs uniquement</option>
            <option value="ARCHIVED">🔴 Archivés / Inactifs uniquement</option>
          </select>
        </div>
      </Card>

      {/* Mobile Cards for Clients (md:hidden) */}
      <div className="md:hidden space-y-3">
        {filteredPersons.length > 0 ? (
          filteredPersons.map(p => {
            const customerCode = p.customerProfile?.customerNumber || p.learnerProfile?.learnerNumber || 'CLT-0000';
            return (
              <div
                key={p.id}
                className={`p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs ${
                  p.isActive === false ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/30' : ''
                }`}
              >
                {/* Header: Avatar, Name & Code */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 font-bold text-xs flex items-center justify-center border border-brand-200 dark:border-brand-800/50 shrink-0">
                      {p.firstName ? p.firstName[0] : ''}{p.lastName ? p.lastName[0] : 'C'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        {p.firstName} {p.lastName}
                      </div>
                      <span className="font-mono text-[10px] font-bold text-slate-400 block">
                        {customerCode}
                      </span>
                    </div>
                  </div>

                  <Badge variant={p.isActive !== false ? 'success' : 'danger'} size="sm">
                    {p.isActive !== false ? '🟢 Actif' : '🔴 Archivé'}
                  </Badge>
                </div>

                {/* Company Name & Types */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.customerProfile?.companyName && (
                    <span className="text-[11px] text-brand-600 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {p.customerProfile.companyName}
                    </span>
                  )}
                  {p.types.map(t => (
                    <Badge
                      key={t}
                      size="sm"
                      variant={
                        t === 'CUSTOMER'
                          ? 'primary'
                          : t === 'LEARNER'
                          ? 'success'
                          : t === 'TRAINER'
                          ? 'warning'
                          : 'secondary'
                      }
                    >
                      {t === 'CUSTOMER' ? 'Client Prestation' : t === 'LEARNER' ? 'Apprenant' : t === 'TRAINER' ? 'Formateur' : t}
                    </Badge>
                  ))}
                </div>

                {/* Contact: Phone with direct tap to call */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1 text-xs">
                  {p.phone && (
                    <a
                      href={`tel:${p.phone}`}
                      className="flex items-center gap-2 font-bold text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{p.phone}</span>
                    </a>
                  )}
                  {p.email && (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{p.email}</span>
                    </div>
                  )}
                  {p.address && (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{p.address}</span>
                    </div>
                  )}
                </div>

                {/* Actions for Mobile */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={Eye}
                    onClick={() => setPersonToView(p)}
                    className="flex-1 text-xs font-bold min-h-[38px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                  >
                    Fiche 360°
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    icon={Edit}
                    onClick={() => handleOpenEdit(p)}
                    className="flex-1 text-xs font-bold min-h-[38px]"
                  >
                    Modifier
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            Aucun client trouvé avec ces critères.
          </div>
        )}
      </div>

      {/* Clients Desktop Table (hidden md:block) */}
      <Card className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Identifiant & Client</TableHead>
              <TableHead>Type & Profil</TableHead>
              <TableHead>Téléphone & Contact</TableHead>
              <TableHead>Adresse & Notes</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPersons.length > 0 ? (
              filteredPersons.map(p => {
                const customerCode = p.customerProfile?.customerNumber || p.learnerProfile?.learnerNumber || 'CLT-0000';
                return (
                  <TableRow
                    key={p.id}
                    className={p.isActive === false ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/30' : ''}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 font-bold text-xs flex items-center justify-center border border-brand-200 dark:border-brand-800/50 shrink-0">
                          {p.firstName ? p.firstName[0] : ''}{p.lastName ? p.lastName[0] : 'C'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {p.firstName} {p.lastName}
                            </span>
                            {p.customerProfile?.companyName && (
                              <span className="text-[10px] text-brand-600 bg-brand-50 dark:bg-brand-950/60 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                                <Building className="w-2.5 h-2.5" />
                                {p.customerProfile.companyName}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] font-bold text-slate-400 block">
                            {customerCode}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.types.map(t => (
                          <Badge
                            key={t}
                            size="sm"
                            variant={
                              t === 'CUSTOMER'
                                ? 'primary'
                                : t === 'LEARNER'
                                ? 'success'
                                : t === 'TRAINER'
                                ? 'warning'
                                : 'secondary'
                            }
                          >
                            {t === 'CUSTOMER' ? 'Client Service' : t === 'LEARNER' ? 'Apprenant' : t === 'TRAINER' ? 'Formateur' : t}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        {p.phone && (
                          <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{p.phone}</span>
                          </div>
                        )}
                        {p.email && (
                          <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[150px]">{p.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                        {p.address || p.notes || '-'}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge variant={p.isActive !== false ? 'success' : 'danger'} size="sm">
                        {p.isActive !== false ? '🟢 Actif' : '🔴 Archivé'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPersonToView(p)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Fiche & Historique 360°"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-lg transition-colors"
                          title="Modifier le client"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            p.isActive !== false
                              ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                              : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                          }`}
                          title={p.isActive !== false ? "Archiver le client" : "Réactiver le client"}
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteClick(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Supprimer le client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                  Aucun client trouvé avec ces critères de recherche.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ========================================================================= */}
      {/* MODAL 1: NOUVEAU CLIENT */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Nouveau Client"
          maxWidth="lg"
        >
          <form onSubmit={handleCreatePerson} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nom *"
                placeholder="ex: Barry"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                required
              />
              <Input
                label="Prénom"
                placeholder="ex: Mamadou"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PhoneInput
                label="Téléphone *"
                placeholder="ex: +224 622 11 22 33"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
              />
              <Input
                label="Email"
                type="email"
                placeholder="ex: client@gmail.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Type de client"
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                options={[
                  { value: 'CUSTOMER', label: 'Client Prestations & Services' },
                  { value: 'COMPANY', label: 'Entreprise / Organisation' },
                  ...(currentTenant?.settings?.hasTraining !== false ? [
                    { value: 'LEARNER', label: 'Apprenant Formation & LMS' },
                    { value: 'TRAINER', label: 'Formateur & Enseignant' },
                  ] : []),
                  { value: 'OTHER', label: 'Autre' },
                ]}
              />
              <Input
                label="Entreprise / Organisation (Optionnel)"
                placeholder="ex: Total Guinée, Société ABC..."
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
            </div>

            <Input
              label="Adresse"
              placeholder="ex: Kaloum, Conakry"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />

            <Input
              label="Notes / Observations"
              placeholder="Préférences de facturation, remise accordée..."
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" icon={UserPlus}>
                Enregistrer le Client
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MODIFIER LE CLIENT */}
      {/* ========================================================================= */}
      {personToEdit && (
        <Modal
          isOpen={Boolean(personToEdit)}
          onClose={() => setPersonToEdit(null)}
          title={`Modifier le Client : ${personToEdit.firstName} ${personToEdit.lastName}`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nom *"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                required
              />
              <Input
                label="Prénom"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PhoneInput
                label="Téléphone *"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                required
              />
              <Input
                label="Email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Type de client principal"
                value={editType}
                onChange={(e) => setEditType(e.target.value as any)}
                options={[
                  { value: 'CUSTOMER', label: 'Client Services (Prestations)' },
                  { value: 'LEARNER', label: 'Apprenant Formation' },
                  { value: 'TRAINER', label: 'Formateur' },
                ]}
              />
              <Input
                label="Entreprise / Organisation"
                value={editCompanyName}
                onChange={(e) => setEditCompanyName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Adresse"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />
              <Select
                label="Statut du client"
                value={editIsActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => setEditIsActive(e.target.value === 'ACTIVE')}
                options={[
                  { value: 'ACTIVE', label: '🟢 Actif' },
                  { value: 'INACTIVE', label: '🔴 Archivé / Inactif' },
                ]}
              />
            </div>

            <Input
              label="Notes & Observations"
              value={editNotes}
              onChange={(e) => setNewNotes(e.target.value)}
            />

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setPersonToEdit(null)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary">
                Enregistrer les Modifications
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: FICHE DÉTAILLÉE 360° & HISTORIQUE */}
      {/* ========================================================================= */}
      {personToView && (
        <Modal
          isOpen={Boolean(personToView)}
          onClose={() => setPersonToView(null)}
          title={`Fiche Client 360° : ${personToView.firstName} ${personToView.lastName}`}
          maxWidth="4xl"
        >
          <div className="space-y-6">
            {/* Person Header Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white font-extrabold text-base flex items-center justify-center shadow-md">
                  {personToView.firstName ? personToView.firstName[0] : ''}{personToView.lastName ? personToView.lastName[0] : 'C'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {personToView.firstName} {personToView.lastName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="font-mono text-brand-600 font-bold">
                      {personToView.customerProfile?.customerNumber || personToView.learnerProfile?.learnerNumber || 'CLT-0000'}
                    </span>
                    {personToView.phone && <span>📞 {personToView.phone}</span>}
                    {personToView.email && <span>✉️ {personToView.email}</span>}
                    {personToView.address && <span>📍 {personToView.address}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={Edit}
                  onClick={() => {
                    handleOpenEdit(personToView);
                  }}
                >
                  Modifier
                </Button>
                <Badge variant={personToView.isActive !== false ? 'success' : 'danger'}>
                  {personToView.isActive !== false ? '🟢 Actif' : '🔴 Archivé'}
                </Badge>
              </div>
            </div>

            {/* Financial Balance Summary Card */}
            {(() => {
              const totalBilled = personOrders.reduce((s, o) => s + o.totalAmount, 0);
              const totalPaid = personOrders.reduce((s, o) => s + o.paidAmount, 0);
              const totalDebt = personOrders.reduce((s, o) => s + (o.dueAmount !== undefined ? o.dueAmount : Math.max(0, o.totalAmount - o.paidAmount)), 0);

              return (
                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Solde & Situation Financière du Client
                    </span>
                    {totalDebt === 0 ? (
                      <Badge variant="success" size="sm">🟢 Client à jour (0 GNF dû)</Badge>
                    ) : (
                      <Badge variant="danger" size="sm">🔴 Dette en cours : {formatCurrency(totalDebt)}</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-bold">Total Commandes</span>
                      <span className="text-sm font-extrabold text-white mt-0.5 block">{formatCurrency(totalBilled)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Total Réglé</span>
                      <span className="text-sm font-extrabold text-emerald-400 mt-0.5 block">{formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="p-1 rounded-xl bg-rose-950/60 border border-rose-900/60">
                      <span className="text-[10px] text-rose-300 uppercase font-black block">Dette Restante</span>
                      <span className="text-base font-black text-rose-400 mt-0.5 block">{formatCurrency(totalDebt)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 4 Activity KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 block font-semibold">Commandes Services</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">{personOrders.length}</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 block font-semibold">Formations Suivies</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">{personEnrollments.length}</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 block font-semibold">Total Versements Encaissés</span>
                <span className="text-lg font-bold text-emerald-500">
                  {formatCurrency(personPayments.reduce((acc, p) => acc + p.amount, 0))}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 block font-semibold">Certificats Délivrés</span>
                <span className="text-lg font-bold text-amber-500">{personCertificates.length}</span>
              </div>
            </div>

            {/* Orders History List with Debt Details & Payment Actions */}
            {personOrders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-brand-500" />
                    Historique des Commandes & Règlements
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">{personOrders.length} commande(s)</span>
                </h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  {personOrders.map(o => {
                    const due = o.dueAmount !== undefined ? o.dueAmount : Math.max(0, o.totalAmount - o.paidAmount);

                    return (
                      <div key={o.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-brand-600 dark:text-brand-400">{o.orderNumber}</span>
                            <Badge size="sm" variant={o.status === 'DELIVERED' ? 'success' : o.status === 'READY' ? 'info' : 'outline'}>
                              {o.status}
                            </Badge>
                            {due === 0 ? (
                              <Badge size="sm" variant="success">🟢 Soldé</Badge>
                            ) : o.paidAmount > 0 ? (
                              <Badge size="sm" variant="warning">🟠 Avance {formatCurrency(o.paidAmount)}</Badge>
                            ) : (
                              <Badge size="sm" variant="danger">🔴 Non Payé</Badge>
                            )}
                          </div>
                          <span className="block text-[11px] text-slate-400 mt-0.5">
                            {formatDate(o.createdAt, 'dd/MM/yyyy HH:mm')} • {o.items.length} prestation(s)
                          </span>
                        </div>

                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          <div className="text-right">
                            <span className="font-bold text-slate-900 dark:text-white block">{formatCurrency(o.totalAmount)}</span>
                            {due > 0 && (
                              <span className="text-[10px] text-rose-600 font-bold block">
                                Reste : {formatCurrency(due)}
                              </span>
                            )}
                          </div>

                          {due > 0 && (
                            <Button
                              size="sm"
                              variant="primary"
                              icon={DollarSign}
                              onClick={() => setOrderForPayment(o)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-xs py-1 px-2.5 h-auto"
                            >
                              Encaisser
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Enrollments History List */}
            {personEnrollments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                  Inscriptions aux Formations
                </h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  {personEnrollments.map(e => (
                    <div key={e.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{e.trainingTitle}</span>
                        <span className="block text-[11px] text-slate-400">Session: {e.sessionCode} • {formatDate(e.enrolledAt)}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(e.finalAmount)}</span>
                        <Badge size="sm" variant={e.dueAmount === 0 ? 'success' : 'warning'} className="ml-2">
                          {e.dueAmount === 0 ? 'Réglé' : `Reste ${formatCurrency(e.dueAmount)}`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certificates List */}
            {personCertificates.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  Certificats Délivrés
                </h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  {personCertificates.map(c => (
                    <div key={c.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{c.certificateCode}</span>
                        <span className="text-slate-500 dark:text-slate-400 ml-2">— {c.trainingTitle}</span>
                        <span className="block text-[11px] text-slate-400">Mention: {c.mention} • Délivré le {formatDate(c.issueDate)}</span>
                      </div>
                      <Badge variant="success" size="sm">
                        Valide
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => setPersonToView(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CONFIRMATION SUPPRESSION SÉCURISÉE */}
      {/* ========================================================================= */}
      {personToDelete && (
        <Modal
          isOpen={Boolean(personToDelete)}
          onClose={() => setPersonToDelete(null)}
          title="⚠️ Supprimer ce client ?"
          maxWidth="md"
        >
          <div className="space-y-4 pt-1 text-xs">
            <p className="text-slate-700 dark:text-slate-300">
              Voulez-vous supprimer le client <strong>{personToDelete.firstName} {personToDelete.lastName}</strong> ?
            </p>
            <p className="text-slate-500">
              Si ce client possède des commandes, inscriptions ou paiements enregistrés, le système le désactivera (archivage) afin de préserver l'historique sans altérer la comptabilité.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setPersonToDelete(null)}>
                Annuler
              </Button>
              <Button variant="danger" icon={Trash2} onClick={handleConfirmDelete}>
                Confirmer
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {orderForPayment && (
        <OrderPaymentModal
          order={orderForPayment}
          isOpen={!!orderForPayment}
          onClose={() => setOrderForPayment(null)}
        />
      )}
    </div>
  );
};
