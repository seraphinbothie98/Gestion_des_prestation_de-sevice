import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, ShoppingBag, Factory, GraduationCap,
  CreditCard, Wallet, Boxes, Truck, Receipt, BarChart3,
  Bell, ShieldCheck, History, Settings, Sparkles, ChevronRight,
  Monitor, Tag, Store, KeyRound, Building2, Lock, MessageSquare, BadgeCheck, LogOut
} from 'lucide-react';
import { dbStore } from '../../server/db/mockStore';
import { cn } from '../../lib/utils';
import { isModuleEnabledForAgency, ACTIVITY_TYPES_CONFIG } from '../../lib/moduleRegistry';

export type NavSection =
  | 'dashboard'
  | 'persons'
  | 'orders'
  | 'production'
  | 'equipment'
  | 'services-pricing'
  | 'training'
  | 'payments'
  | 'cash'
  | 'stock'
  | 'suppliers'
  | 'billing'
  | 'reports'
  | 'notifications'
  | 'users-rbac'
  | 'audit'
  | 'settings'
  | 'licenses'
  | 'saas-superadmin';

interface SidebarProps {
  currentSection: NavSection;
  onNavigate: (section: NavSection) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { currentTenant, currentUser, allTenants, switchTenant, hasPermission, isSuperAdmin, canPerformMutations, logout } = useAuth();
  const roleCode = currentUser?.roles[0]?.code || 'ADMIN_CENTRE';

  const isReceptionistOrCashier = roleCode === 'CAISSIER' || roleCode === 'RECEPTIONNISTE';
  const isAdmin = roleCode === 'ADMIN_CENTRE' || roleCode === 'SUPER_ADMIN' || isSuperAdmin || hasPermission('*');
  const activityType = currentTenant?.activityType || 'SERVICE_CENTER';
  const activityConfig = ACTIVITY_TYPES_CONFIG[activityType] || ACTIVITY_TYPES_CONFIG.SERVICE_CENTER;

  // Helper to check if an item is allowed for current user and current agency
  const isItemAllowed = (id: NavSection): boolean => {
    if (id === 'saas-superadmin') {
      return isSuperAdmin;
    }

    // Check if module is allowed for the agency's activity type
    if (!isSuperAdmin && !isModuleEnabledForAgency(id as any, currentTenant)) {
      return false;
    }

    // Receptionist / Cashier must NEVER see admin modules
    if (isReceptionistOrCashier) {
      if (id === 'users-rbac' || id === 'settings' || id === 'audit' || id === 'reports' || id === 'licenses') {
        return false;
      }
    }

    if (id === 'licenses') {
      return isAdmin || roleCode === 'GERANT' || hasPermission('settings.view') || hasPermission('settings.*') || hasPermission('*');
    }
    if (id === 'users-rbac') {
      return !isReceptionistOrCashier && (hasPermission('users.view') || hasPermission('users.*') || hasPermission('roles.*') || hasPermission('*'));
    }
    if (id === 'settings') {
      return !isReceptionistOrCashier && (hasPermission('settings.view') || hasPermission('settings.*') || hasPermission('signatures.*') || hasPermission('*'));
    }
    if (id === 'audit') {
      return !isReceptionistOrCashier && (hasPermission('audit.view') || hasPermission('audit.*') || hasPermission('*'));
    }
    if (id === 'reports') {
      return !isReceptionistOrCashier && (hasPermission('reports.view') || hasPermission('reports.*') || hasPermission('*'));
    }
    if (id === 'training') {
      return hasPermission('training.view') || hasPermission('training.*') || hasPermission('*');
    }
    if (id === 'equipment') {
      return hasPermission('equipment.view') || hasPermission('equipment.*') || hasPermission('production.*') || hasPermission('*');
    }
    return true;
  };

  // Navigation Groups dynamically built from agency activity type & user role
  const getNavigationGroups = () => {
    const groups: { title: string; items: { id: NavSection; label: string; icon: any }[] }[] = [];

    // 0. SUPER ADMIN SAAS GLOBAL GROUP
    if (isSuperAdmin) {
      groups.push({
        title: "SUPER ADMIN SAAS",
        items: [
          { id: 'saas-superadmin', label: 'Administration SaaS & Agences', icon: Sparkles }
        ]
      });
    }

    // 1. CAISSIÈRE & RÉCEPTIONNISTE (Poste Polyvalent)
    if (isReceptionistOrCashier) {
      const cashierItems = [
        { id: 'dashboard' as NavSection, label: 'Tableau de Bord', icon: LayoutDashboard },
        { id: 'orders' as NavSection, label: 'Commandes de Prestations', icon: ShoppingBag },
        { id: 'persons' as NavSection, label: 'Clients & Contacts', icon: Users },
        { id: 'cash' as NavSection, label: 'Finance & Trésorerie', icon: Wallet },
        { id: 'stock' as NavSection, label: 'Stock Consommables', icon: Boxes },
        { id: 'billing' as NavSection, label: 'Factures & Reçus', icon: Receipt },
        { id: 'production' as NavSection, label: 'Atelier Production', icon: Factory },
        { id: 'services-pricing' as NavSection, label: 'Consultation des Tarifs', icon: Tag }
      ];

      return [
        ...groups,
        {
          title: "POSTE RÉCEPTION & CAISSE",
          items: cashierItems
        }
      ];
    }

    // 2. OPÉRATEUR DE PRODUCTION (Atelier & Matériel)
    if (roleCode === 'OPERATEUR') {
      return [
        ...groups,
        {
          title: "ATELIER & TECHNIQUE",
          items: [
            { id: 'dashboard' as NavSection, label: 'Tableau de Bord Production', icon: LayoutDashboard },
            { id: 'production' as NavSection, label: 'Atelier Production', icon: Factory },
            { id: 'equipment' as NavSection, label: 'Matériel du Centre', icon: Monitor },
            { id: 'orders' as NavSection, label: 'Commandes à Traiter', icon: ShoppingBag },
          ]
        }
      ];
    }

    // 3. RESPONSABLE FORMATION (Pôle Pédagogique)
    if (roleCode === 'RESPONSABLE_FORMATION') {
      return [
        ...groups,
        {
          title: "PÔLE FORMATION & LMS",
          items: [
            { id: 'dashboard' as NavSection, label: 'Tableau de Bord Formation', icon: LayoutDashboard },
            { id: 'training' as NavSection, label: 'Formations & Sessions', icon: GraduationCap },
            { id: 'persons' as NavSection, label: 'Apprenants & Formateurs', icon: Users },
            { id: 'payments' as NavSection, label: 'Paiements Formations', icon: CreditCard },
          ]
        }
      ];
    }

    // 4. STANDARD NAVIGATION FOR CENTRE DE PRESTATIONS
    groups.push(
      {
        title: "GÉNÉRAL",
        items: [
          { id: 'dashboard', label: 'Tableau de Bord 360°', icon: LayoutDashboard },
          { id: 'persons', label: 'Clients & Contacts', icon: Users },
        ]
      },
      {
        title: "PÔLE 1 — SERVICES & PRODUCTION",
        items: [
          { id: 'orders', label: 'Commandes de Prestations', icon: ShoppingBag },
          { id: 'production', label: 'Atelier Production', icon: Factory },
          { id: 'services-pricing', label: 'Services & Tarifs', icon: Tag },
          { id: 'equipment', label: 'Matériel du Centre', icon: Monitor },
        ]
      },
      {
        title: "PÔLE 2 — FORMATION",
        items: [
          { id: 'training', label: 'Formations & LMS', icon: GraduationCap },
        ]
      },
      {
        title: "LOGISTIQUE & APPROVISIONNEMENT",
        items: [
          { id: 'stock', label: 'Stock Consommables', icon: Boxes },
          { id: 'suppliers', label: 'Fournisseurs & Commandes', icon: Truck },
          { id: 'billing', label: 'Facturation & Devis', icon: Receipt },
        ]
      },
      {
        title: "FINANCES & CAISSE",
        items: [
          { id: 'cash', label: 'Finance & Trésorerie', icon: Wallet },
          { id: 'payments', label: 'Paiements & Reçus', icon: CreditCard },
        ]
      },
      {
        title: "PILOTAGE & ADMINISTRATION",
        items: [
          { id: 'reports', label: 'Rapports & Analytics', icon: BarChart3 },
          { id: 'notifications', label: 'Centre Notifications', icon: Bell },
          { id: 'users-rbac', label: 'Utilisateurs & Postes', icon: ShieldCheck },
          { id: 'audit', label: 'Journal d\'Audit', icon: History },
          { id: 'settings', label: 'Paramètres Agence', icon: Settings },
          { id: 'licenses', label: 'Licence & Souscription', icon: KeyRound },
        ]
      }
    );

    // Filter each group's items by permission & availability
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(item => isItemAllowed(item.id))
      }))
      .filter(g => g.items.length > 0);
  };

  const navigationGroups = getNavigationGroups();

  return (
    <>
      {/* Mobile overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 border-r border-slate-800",
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header & Tenant Switcher */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center space-x-3 mb-3">
            {(currentTenant?.settings?.branding?.showLogo ?? true) && (currentTenant?.settings?.branding?.logoUrl || currentTenant?.logoUrl) ? (
              <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden border border-slate-700/60 shadow-glow shrink-0">
                <img
                  src={currentTenant?.settings?.branding?.logoUrl || currentTenant?.logoUrl}
                  alt={currentTenant?.name || 'Logo'}
                  className="max-h-full max-w-full object-contain rounded"
                />
              </div>
            ) : isSuperAdmin ? (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-lg shadow-glow shrink-0">
                👑
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-glow shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5 truncate">
                <span className="truncate">{currentTenant?.name || (isSuperAdmin ? "SUPER ADMIN" : "CENTRE GESTION")}</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                {isSuperAdmin ? "Administration Globale" : (currentTenant?.settings?.branding?.slogan || "Centre de Prestations & Reprographie")}
              </p>
            </div>
          </div>

          {/* Multi-Agency / Multi-Tenant Selector */}
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {isSuperAdmin ? "Agence Sélectionnée" : "Agence Active"}
              </label>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                {activityConfig.label.split(' ')[0]}
              </span>
            </div>

            {isSuperAdmin ? (
              <select
                value={currentTenant?.id}
                onChange={(e) => switchTenant(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
              >
                {allTenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            ) : (
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white truncate">
                {currentTenant?.name}
              </div>
            )}

            {/* Read-only warning badge if agency is suspended or expired */}
            {!canPerformMutations && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-300 text-[10px] font-bold mt-1">
                <Lock className="w-3 h-3 shrink-0" />
                <span>Mode Lecture Seule (Licence)</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navigationGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1.5 flex items-center justify-between">
                <span>{group.title}</span>
              </div>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = currentSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      onCloseMobile();
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group",
                      isActive
                        ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-slate-400 group-hover:text-brand-400")} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-brand-200" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Card & Logout at bottom */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-brand-700/60 border border-brand-500/30 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={`${currentUser.firstName} ${currentUser.lastName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>
                    {currentUser?.firstName?.[0] || 'U'}{currentUser?.lastName?.[0] || ''}
                  </span>
                )}
              </div>
              <div className="min-w-0 truncate">
                <p className="text-xs font-semibold text-white truncate flex items-center gap-1">
                  {currentUser?.firstName} {currentUser?.lastName}
                  {isSuperAdmin && (
                    <span className="text-[9px] bg-brand-500/30 text-brand-300 px-1 rounded font-bold">
                      SAAS
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-brand-400 font-medium truncate">
                  {currentUser?.roles[0]?.name || 'Collaborateur'}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              logout();
            }}
            className="w-full py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            title="Se déconnecter (Retour immédiat à la page Visiteur)"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>
    </>
  );
};
