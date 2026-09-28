import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  Menu, Search, Bell, Shield, Building, Plus, CheckCircle2,
  AlertTriangle, Info, Clock, LogOut, ChevronDown, Check, User, Lock, Sparkles, Crown,
  Settings, Camera, KeyRound, ShieldCheck
} from 'lucide-react';
import { Button } from '../ui/Button';
import { NavSection } from './Sidebar';
import { formatDate } from '../../lib/utils';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  onOpenSearch: () => void;
  onNavigate: (section: NavSection) => void;
  onOpenQuickOrder: () => void;
  onOpenQuickArticleSale: () => void;
  onOpenQuickEnrollment: () => void;
  onOpenUserProfile: (tab?: 'INFO' | 'EDIT' | 'PHOTO' | 'SECURITY') => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  onOpenSearch,
  onNavigate,
  onOpenQuickOrder,
  onOpenQuickArticleSale,
  onOpenQuickEnrollment,
  onOpenUserProfile,
}) => {
  const { currentUser, currentTenant, currentBranch, allBranches, allUsers, switchUser, switchBranch, logout, isSuperAdmin } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6">
      {/* Left side: Hamburger, Logo / Nom du centre & Global Search */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden shrink-0"
          title="Ouvrir le menu complet"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Agency Brand Label & Logo */}
        <div className="flex items-center gap-2 lg:hidden min-w-0">
          {(currentTenant?.settings?.branding?.showLogo ?? true) && (currentTenant?.settings?.branding?.logoUrl || currentTenant?.logoUrl) ? (
            <img
              src={currentTenant?.settings?.branding?.logoUrl || currentTenant?.logoUrl}
              alt={currentTenant?.name || 'Logo'}
              className="h-8 w-auto max-w-[100px] object-contain rounded shrink-0 bg-white/90 p-0.5"
            />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
          )}
          <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-[180px]">
            {currentTenant?.name || 'Centre de Prestations'}
          </span>
        </div>

        {/* Desktop / Tablet Global Search */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-medium transition-all w-44 md:w-56 border border-slate-200/60 dark:border-slate-700/50"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="truncate">Recherche...</span>
          <span className="hidden md:inline-block ml-auto text-[10px] bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded shadow-sm border border-slate-200 dark:border-slate-600">
            Ctrl+K
          </span>
        </button>

        {isSuperAdmin && (
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-black">
            <Crown className="w-3.5 h-3.5" />
            <span>ADMINISTRATION GLOBALE</span>
          </div>
        )}
      </div>

      {/* Right side: Quick Action Button, Role Simulator, Notifications, User Menu */}
      <div className="flex items-center space-x-2 sm:space-x-3">

        {/* Quick Action Wizard Dropdown (Only for authorized agency roles) */}
        {!isSuperAdmin && (currentUser?.roles[0]?.code === 'ADMIN_CENTRE' || currentUser?.roles[0]?.code === 'CAISSIER') && (
          <div className="relative">
            <Button
              size="sm"
              variant="primary"
              icon={Plus}
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="hidden sm:inline-flex shadow-sm"
            >
              Nouvelle Action
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>

            {showQuickActions && (
              <div
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-50 animate-fade-in"
                onClick={() => setShowQuickActions(false)}
              >
                <button
                  onClick={onOpenQuickOrder}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                  Nouvelle Commande Service
                </button>
                <button
                  onClick={onOpenQuickArticleSale}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-600 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Vendre un article (Stock Central)
                </button>
                <button
                  onClick={onOpenQuickEnrollment}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Nouvelle Inscription Formation
                </button>
                <button
                  onClick={() => onNavigate('cash')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  Ouvrir / Clôturer Caisse
                </button>
              </div>
            )}
          </div>
        )}

        {/* Branch Selector */}
        {!isSuperAdmin && allBranches.length > 1 && (
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={currentBranch?.id}
              onChange={(e) => switchBranch(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              {allBranches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Role Simulator Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors ${
              isSuperAdmin
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700 border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200'
            }`}
            title="Changer de rôle pour tester"
          >
            {isSuperAdmin ? <Crown className="w-3.5 h-3.5 text-amber-500" /> : <Shield className="w-3.5 h-3.5 text-brand-500" />}
            <span className="text-xs font-bold hidden sm:inline">
              {isSuperAdmin ? 'Super Admin' : (currentUser?.roles[0]?.name || 'Rôle')}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in">
              <div className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                Simulateur de Rôle (RBAC)
              </div>
              <div className="mt-1 space-y-1 max-h-72 overflow-y-auto">
                {allUsers.map((u) => {
                  const isSelected = u.id === currentUser?.id;
                  const isUserSuper = Boolean(u.isSuperAdmin || u.username === 'superadmin' || u.roles.some(r => r.code === 'SUPER_ADMIN'));
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        switchUser(u.id);
                        setShowUserDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition-colors ${
                        isSelected
                          ? isUserSuper
                            ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold'
                            : 'bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs truncate flex items-center gap-1.5">
                          {isUserSuper && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {isUserSuper ? 'Super Administrateur Global' : u.roles[0]?.name} • @{u.username}
                        </p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-brand-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 relative transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Notifications
                  </h4>
                  <span className="px-1.5 py-0.2 bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-[10px] font-bold rounded">
                    {unreadCount} non lues
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] font-medium text-brand-600 hover:underline"
                  >
                    Tout marquer lu
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto mt-2">
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors ${
                        !n.isRead ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {n.type === 'SUCCESS' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : n.type === 'WARNING' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Info className="w-4 h-4 text-brand-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">{n.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {formatDate(n.createdAt, 'dd MMM HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400">
                    Aucune notification pour le moment.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar & Dropdown Menu */}
        <div className="relative pl-2 border-l border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left group"
            title="Menu Utilisateur & Profil"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white font-bold text-xs flex items-center justify-center shadow-sm overflow-hidden ring-2 ring-transparent group-hover:ring-brand-500/30 transition-all">
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
            <div className="hidden lg:block min-w-0">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                {currentUser?.firstName} {currentUser?.lastName}
              </span>
              <span className="text-[10px] text-slate-400 block font-medium truncate">
                {isSuperAdmin ? 'Super Admin' : (currentUser?.roles[0]?.name || 'Collaborateur')}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showProfileMenu ? 'rotate-180 text-brand-500' : ''}`} />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div
              className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800"
              onClick={() => setShowProfileMenu(false)}
            >
              {/* User Header Summary */}
              <div className="p-3 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white font-bold text-sm flex items-center justify-center shadow-sm overflow-hidden shrink-0">
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
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentUser?.firstName} {currentUser?.lastName}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {currentUser?.email || `@${currentUser?.username}`}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 text-[10px] font-bold rounded-lg border border-brand-200 dark:border-brand-800">
                    {isSuperAdmin ? 'Super Administrateur' : (currentUser?.roles[0]?.name || 'Collaborateur')}
                  </span>
                </div>
              </div>

              {/* Navigation Options */}
              <div className="py-1.5 space-y-0.5">
                <button
                  onClick={() => onOpenUserProfile('INFO')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors"
                >
                  <User className="w-4 h-4 text-brand-500" />
                  <span>Mon profil</span>
                </button>

                <button
                  onClick={() => onOpenUserProfile('EDIT')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Paramètres du compte</span>
                </button>

                <button
                  onClick={() => onOpenUserProfile('PHOTO')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors"
                >
                  <Camera className="w-4 h-4 text-brand-500" />
                  <span>Photo de profil</span>
                </button>

                <button
                  onClick={() => onOpenUserProfile('SECURITY')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  <span>Sécurité & Mot de passe</span>
                </button>
              </div>

              {/* Logout Option */}
              <div className="pt-1.5">
                <button
                  onClick={logout}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl flex items-center gap-2.5 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
