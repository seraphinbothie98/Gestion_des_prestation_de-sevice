import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { NavSection } from './Sidebar';
import {
  User, Settings, KeyRound, LogOut, X, Crown, Shield,
  Building, ChevronRight, Check, Bell, Sparkles, Camera, Wallet
} from 'lucide-react';
import { Button } from '../ui/Button';

interface MobileAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: NavSection) => void;
  onOpenUserProfile: (tab?: 'INFO' | 'EDIT' | 'PHOTO' | 'SECURITY') => void;
}

export const MobileAccountDrawer: React.FC<MobileAccountDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenUserProfile,
}) => {
  const {
    currentUser,
    currentTenant,
    currentBranch,
    allBranches,
    allUsers,
    switchUser,
    switchBranch,
    logout,
    isSuperAdmin,
    hasPermission
  } = useAuth();
  const { unreadCount } = useNotification();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  if (!isOpen) return null;

  const handleNavigateSection = (section: NavSection) => {
    onNavigate(section);
    onClose();
  };

  const handleOpenProfileTab = (tab: 'INFO' | 'EDIT' | 'PHOTO' | 'SECURITY') => {
    onClose();
    onOpenUserProfile(tab);
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-6 space-y-4 animate-slide-up">
        {/* Handle & Close */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card Summary */}
        <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/80 dark:to-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white font-black text-sm flex items-center justify-center shadow-md overflow-hidden shrink-0">
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
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                {currentUser?.firstName} {currentUser?.lastName}
              </h3>
              {isSuperAdmin && <Crown className="w-4 h-4 text-amber-500 shrink-0" />}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {currentUser?.email || `@${currentUser?.username}`}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block px-2 py-0.5 bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-[10px] font-bold rounded-lg border border-brand-200 dark:border-brand-800">
                {isSuperAdmin ? 'Super Administrateur' : (currentUser?.roles[0]?.name || 'Collaborateur')}
              </span>
              <span className="text-[10px] text-slate-400 font-medium truncate">
                • {currentTenant?.name}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <div className="space-y-1 text-xs">
          {/* Mon profil */}
          <button
            type="button"
            onClick={() => handleOpenProfileTab('INFO')}
            className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 rounded-xl">
                <User className="w-4 h-4" />
              </div>
              <span>Mon Profil</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Paramètres du compte */}
          <button
            type="button"
            onClick={() => handleOpenProfileTab('EDIT')}
            className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl">
                <Settings className="w-4 h-4" />
              </div>
              <span>Informations & Coordonnées</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Photo de profil */}
          <button
            type="button"
            onClick={() => handleOpenProfileTab('PHOTO')}
            className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
                <Camera className="w-4 h-4" />
              </div>
              <span>Photo de profil</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Sécurité */}
          <button
            type="button"
            onClick={() => handleOpenProfileTab('SECURITY')}
            className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
                <KeyRound className="w-4 h-4" />
              </div>
              <span>Sécurité & Mot de passe</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Notifications */}
          <button
            type="button"
            onClick={() => handleNavigateSection('notifications')}
            className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl relative">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span>Notifications</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Paramètres Agence (si autorisé) */}
          {(hasPermission('settings.view') || hasPermission('settings.*') || isSuperAdmin) && (
            <button
              type="button"
              onClick={() => handleNavigateSection('settings')}
              className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Building className="w-4 h-4" />
                </div>
                <span>Paramètres Agence & Signatures</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          )}

          {/* Role Simulator Switcher for Mobile */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-brand-500" />
                <span>Simulateur de Rôle (RBAC)</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showRoleSwitcher ? 'rotate-90' : ''}`} />
            </button>

            {showRoleSwitcher && (
              <div className="mt-2 p-2 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl space-y-1 max-h-48 overflow-y-auto">
                {allUsers.map((u) => {
                  const isSelected = u.id === currentUser?.id;
                  const isUserSuper = Boolean(u.isSuperAdmin || u.username === 'superadmin' || u.roles.some(r => r.code === 'SUPER_ADMIN'));
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        switchUser(u.id);
                        setShowRoleSwitcher(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-brand-600 text-white font-bold shadow-sm'
                          : 'hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs truncate flex items-center gap-1">
                          {isUserSuper && <Crown className="w-3 h-3 text-amber-300 shrink-0" />}
                          {u.firstName} {u.lastName}
                        </p>
                        <p className={`text-[10px] ${isSelected ? 'text-brand-100' : 'text-slate-400'}`}>
                          {u.roles[0]?.name || 'Collaborateur'}
                        </p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Déconnexion */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
