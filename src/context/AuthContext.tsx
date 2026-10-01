import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant, Branch, Role, UserProfileUpdateData } from '../types';
import { dbStore, DatabaseState } from '../server/db/mockStore';
import {
  canPerformFinancialSensitiveAction,
  getFinancialUserRoleLabel,
  FinancialSensitiveAction
} from '../server/security/securityEngine';

interface AuthContextType {
  currentUser: User | null;
  currentTenant: Tenant | null;
  currentAgency: Tenant | null;
  currentBranch: Branch | null;
  allTenants: Tenant[];
  allAgencies: Tenant[];
  allBranches: Branch[];
  allUsers: User[];
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  canPerformMutations: boolean;
  canManageSensitiveFinancials: boolean;
  canModifyFinancials: boolean;
  userRoleLabel: string;
  checkFinancialPermission: (action: FinancialSensitiveAction, agencyId?: string) => boolean;
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  switchUser: (userId: string) => void;
  switchTenant: (tenantId: string) => void;
  switchAgency: (agencyId: string) => void;
  switchBranch: (branchId: string) => void;
  login: (identifier: string, password?: string) => {
    success: boolean;
    message?: string;
    isLocked?: boolean;
    remainingMinutes?: number;
    requiresEmailVerification?: boolean;
    email?: string;
    user?: User;
  };
  unlockUserAccount: (targetUserId: string, reason?: string) => { success: boolean; message: string };
  registerAgency: (data: any) => {
    success: boolean;
    message: string;
    requiresEmailVerification?: boolean;
    verificationToken?: string;
    verificationUrl?: string;
    email?: string;
    user?: User;
    tenant?: Tenant;
  };
  resendEmailVerification: (email: string) => {
    success: boolean;
    statusCode: number;
    message: string;
    remainingSeconds?: number;
    verificationToken?: string;
    verificationUrl?: string;
  };
  verifyEmailAndActivate: (token: string) => {
    success: boolean;
    statusCode: number;
    reason?: 'INVALID' | 'ALREADY_USED' | 'EXPIRED';
    message: string;
    email?: string;
    user?: User;
    tenant?: Tenant;
    trialStartedAt?: string;
    trialEndsAt?: string;
  };
  logout: () => void;
  updateProfile: (data: UserProfileUpdateData) => { success: boolean; message: string; user?: User };
  updateAvatar: (avatarUrl: string | null) => { success: boolean; message: string; user?: User };
  removeAvatar: () => { success: boolean; message: string; user?: User };
  changePassword: (oldPassword: string, newPassword: string) => { success: boolean; message: string };
  requestPasswordReset: (identifier: string) => { success: boolean; message: string; code?: string };
  resetPasswordWithCode: (identifier: string, code: string, newPassword: string) => { success: boolean; message: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbState, setDbState] = useState<DatabaseState>(dbStore.getState());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('cms_is_authenticated') === 'true';
  });

  useEffect(() => {
    return dbStore.subscribe(() => {
      setDbState({ ...dbStore.getState() });
      setIsAuthenticated(localStorage.getItem('cms_is_authenticated') === 'true');
    });
  }, []);

  const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('cms_current_user_id') : null;
  const activeUserId = savedUserId || dbState.currentUserId;
  const currentUser: User | null = isAuthenticated
    ? (dbState.users.find(u => u.id === activeUserId) || null)
    : null;

  const isSuperAdmin = Boolean(
    currentUser && (
      currentUser.isSuperAdmin ||
      currentUser.roles?.some(r => r.code === 'SUPER_ADMIN') ||
      currentUser.username === 'superadmin'
    )
  );

  // If superadmin, allow picking any tenant. If standard user, strictly resolve to user's assigned tenantId
  const effectiveTenantId = isSuperAdmin
    ? (dbState.currentTenantId && dbState.currentTenantId !== 'global' ? dbState.currentTenantId : dbState.tenants[0]?.id)
    : (currentUser?.tenantId && currentUser.tenantId !== 'global' ? currentUser.tenantId : dbState.tenants[0]?.id);

  const currentTenant = dbState.tenants.find(t => t.id === effectiveTenantId) || dbState.tenants[0] || null;
  const currentAgency = currentTenant;
  const currentBranch = dbState.branches.find(b => b.tenantId === effectiveTenantId && b.isMain) || dbState.branches[0] || null;

  const allTenants = isSuperAdmin ? dbState.tenants : dbState.tenants.filter(t => t.id === currentUser?.tenantId);
  const allAgencies = allTenants;
  const allBranches = dbState.branches.filter(b => b.tenantId === effectiveTenantId && b.isActive);
  const allUsers = isSuperAdmin
    ? dbState.users.filter(u => u.isActive)
    : dbState.users.filter(u => u.tenantId === effectiveTenantId && u.isActive);

  // Agency mutation check (Read-Only enforcement for expired/suspended licenses)
  const canPerformMutations = isSuperAdmin || (
    Boolean(currentTenant) &&
    currentTenant.status === 'ACTIVE' &&
    currentTenant.subscriptionStatus !== 'SUSPENDED' &&
    currentTenant.subscriptionStatus !== 'EXPIRED'
  );

  const userRoleLabel = getFinancialUserRoleLabel(currentUser);

  const checkFinancialPermission = (action: FinancialSensitiveAction, agencyId?: string): boolean => {
    const target = agencyId || effectiveTenantId;
    const res = canPerformFinancialSensitiveAction(currentUser, target, action);
    return res.allowed;
  };

  const canManageSensitiveFinancials = checkFinancialPermission('UPDATE_FINANCIAL_ACCOUNT');
  const canModifyFinancials = canManageSensitiveFinancials;

  const hasPermission = (permissionCode: string): boolean => {
    if (!currentUser) return false;
    
    // Super admin wildcard
    if (isSuperAdmin || currentUser.permissions.includes('*')) return true;

    // Check specific permission or domain wildcard (e.g. "orders.*")
    const [domain] = permissionCode.split('.');
    if (currentUser.permissions.includes(`${domain}.*`)) return true;

    return currentUser.permissions.includes(permissionCode);
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(p => hasPermission(p));
  };

  const switchUser = (userId: string) => {
    const user = dbState.users.find(u => u.id === userId);
    if (!user) return;

    if (!user.isActive) {
      return;
    }

    dbStore.updateState(draft => {
      draft.currentUserId = userId;
      if (user.tenantId && user.tenantId !== 'global') {
        draft.currentTenantId = user.tenantId;
      }
    });
    localStorage.setItem('cms_active_section', 'dashboard');
    window.location.hash = 'dashboard';
    dbStore.logAudit('USER_SESSION_SWITCHED', 'USER', userId, null, {
      username: user.username,
      email: user.email,
      role: user.roles[0]?.name
    });
  };

  const switchTenant = (tenantId: string) => {
    // Only superadmin can switch to another agency arbitrarily
    if (!isSuperAdmin && currentUser?.tenantId !== tenantId) {
      return;
    }

    dbStore.updateState(draft => {
      draft.currentTenantId = tenantId;
      if (!isSuperAdmin) {
        const tenantUsers = draft.users.filter(u => u.tenantId === tenantId);
        if (tenantUsers.length > 0) {
          draft.currentUserId = tenantUsers[0].id;
        }
      }
    });
  };

  const switchAgency = switchTenant;

  const switchBranch = (branchId: string) => {
    dbStore.updateState(draft => {
      const u = draft.users.find(user => user.id === draft.currentUserId);
      if (u) {
        u.branchId = branchId;
      }
    });
  };

  const login = (identifier: string, password?: string): {
    success: boolean;
    message?: string;
    isLocked?: boolean;
    remainingMinutes?: number;
    requiresEmailVerification?: boolean;
    email?: string;
    user?: User;
  } => {
    const authRes = dbStore.authenticateUser(identifier, password);

    if (!authRes.success || !authRes.user) {
      return {
        success: false,
        message: authRes.message || "Identifiants incorrects.",
        isLocked: authRes.isLocked,
        remainingMinutes: authRes.remainingMinutes,
        requiresEmailVerification: authRes.requiresEmailVerification,
        email: authRes.email
      };
    }

    const user = authRes.user;
    const userIsSuper = Boolean(
      user.isSuperAdmin ||
      user.username === 'superadmin' ||
      user.roles.some(r => r.code === 'SUPER_ADMIN')
    );

    const isClient = Boolean(
      user.roles?.some(r => r.code === 'CLIENT') ||
      user.role === 'CLIENT' ||
      (!user.isSuperAdmin && !user.roles?.some(r => ['SUPER_ADMIN', 'ADMIN_CENTRE', 'GERANT', 'CAISSIER', 'OPERATEUR', 'RESPONSABLE_FORMATION', 'FORMATEUR', 'MAGASINIER', 'RECEPTIONNISTE'].includes(r.code)))
    );

    if (isClient) {
      localStorage.setItem('cms_active_section', 'marketplace');
      window.location.hash = '';
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
    } else {
      // Tout utilisateur connecté accède automatiquement au module tableau de bord
      localStorage.setItem('cms_active_section', 'dashboard');
      window.location.hash = 'dashboard';
    }

    localStorage.setItem('cms_is_authenticated', 'true');
    localStorage.setItem('cms_current_user_id', user.id);
    dbStore.updateState(draft => {
      draft.currentUserId = user.id;
      if (user.tenantId && user.tenantId !== 'global') {
        draft.currentTenantId = user.tenantId;
      }
    });
    setIsAuthenticated(true);

    return { success: true, user };
  };

  const unlockUserAccount = (targetUserId: string, reason?: string): { success: boolean; message: string } => {
    if (!currentUser) {
      return { success: false, message: "Aucun utilisateur connecté pour exécuter cette action." };
    }
    return dbStore.unlockUserAccount(targetUserId, currentUser, reason);
  };

  const logout = () => {
    if (currentUser) {
      dbStore.logAudit('USER_LOGOUT', 'USER', currentUser.id, null, {
        username: currentUser.username,
        email: currentUser.email
      });
    }
    localStorage.removeItem('cms_is_authenticated');
    localStorage.removeItem('cms_current_user_id');
    localStorage.removeItem('cms_active_section');
    dbStore.updateState(draft => {
      draft.currentUserId = '';
    });
    window.location.hash = '';
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setIsAuthenticated(false);
  };

  const updateProfile = (data: UserProfileUpdateData): { success: boolean; message: string; user?: User } => {
    if (!currentUser) {
      return { success: false, message: "Aucun utilisateur connecté." };
    }
    const res = dbStore.updateUserProfile(currentUser.id, data, currentUser, isSuperAdmin);
    return res;
  };

  const updateAvatar = (avatarUrl: string | null): { success: boolean; message: string; user?: User } => {
    if (!currentUser) {
      return { success: false, message: "Aucun utilisateur connecté." };
    }
    const res = dbStore.updateUserAvatar(currentUser.id, avatarUrl, currentUser, isSuperAdmin);
    return res;
  };

  const removeAvatar = (): { success: boolean; message: string; user?: User } => {
    if (!currentUser) {
      return { success: false, message: "Aucun utilisateur connecté." };
    }
    const res = dbStore.removeUserAvatar(currentUser.id, currentUser, isSuperAdmin);
    return res;
  };

  const changePassword = (oldPassword: string, newPassword: string): { success: boolean; message: string } => {
    if (!currentUser) {
      return { success: false, message: "Aucun utilisateur connecté." };
    }
    const res = dbStore.changeUserPassword(currentUser.id, oldPassword, newPassword, currentUser, isSuperAdmin);
    return res;
  };

  const requestPasswordReset = (identifier: string): { success: boolean; message: string; code?: string } => {
    const cleanId = identifier.trim().toLowerCase();
    const user = dbState.users.find(
      u => u.email.toLowerCase() === cleanId || (u.username && u.username.toLowerCase() === cleanId)
    );

    if (!user) {
      return { success: false, message: "Aucun compte n'est associé à cet identifiant ou email." };
    }

    if (!user.isActive) {
      return { success: false, message: "Ce compte utilisateur est désactivé." };
    }

    // Generate 6-digit temporary security code valid for 15 minutes
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    dbStore.updateState(draft => {
      const u = draft.users.find(userItem => userItem.id === user.id);
      if (u) {
        u.resetPasswordCode = resetCode;
        u.resetPasswordExpiresAt = expiresAt;
      }
    });

    dbStore.logAudit('PASSWORD_RESET_REQUESTED', 'USER', user.id, null, {
      username: user.username,
      codeGenerated: resetCode
    });

    return {
      success: true,
      message: `Code de réinitialisation sécurisé envoyé à ${user.email} (valable 15 minutes).`,
      code: resetCode
    };
  };

  const resetPasswordWithCode = (identifier: string, code: string, newPassword: string): { success: boolean; message: string } => {
    const cleanId = identifier.trim().toLowerCase();
    const user = dbState.users.find(
      u => u.email.toLowerCase() === cleanId || (u.username && u.username.toLowerCase() === cleanId)
    );

    if (!user) {
      return { success: false, message: "Compte introuvable." };
    }

    if (!user.resetPasswordCode || user.resetPasswordCode !== code.trim()) {
      return { success: false, message: "Code de vérification invalide ou expiré." };
    }

    if (user.resetPasswordExpiresAt && new Date(user.resetPasswordExpiresAt) < new Date()) {
      return { success: false, message: "Ce code de vérification a expiré. Veuillez refaire une demande." };
    }

    if (newPassword.length < 6) {
      return { success: false, message: "Le nouveau mot de passe doit comporter au moins 6 caractères." };
    }

    dbStore.updateState(draft => {
      const u = draft.users.find(userItem => userItem.id === user.id);
      if (u) {
        u.passwordHash = newPassword;
        u.resetPasswordCode = undefined;
        u.resetPasswordExpiresAt = undefined;
      }
    });

    dbStore.logAudit('PASSWORD_RESET_COMPLETED', 'USER', user.id, null, {
      username: user.username
    });

    return {
      success: true,
      message: "Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter."
    };
  };

  const registerAgency = (data: any): {
    success: boolean;
    message: string;
    requiresEmailVerification?: boolean;
    verificationToken?: string;
    verificationUrl?: string;
    email?: string;
    user?: User;
    tenant?: Tenant;
  } => {
    const res = dbStore.registerAutonomousAgency(data);
    if (res.success && res.user && res.tenant) {
      // Si aucune vérification d'e-mail n'est requise (autoVerify activé), connecter immédiatement
      if (!res.requiresEmailVerification) {
        localStorage.setItem('cms_is_authenticated', 'true');
        localStorage.setItem('cms_current_user_id', res.user.id);
        setIsAuthenticated(true);
      }
      return {
        success: true,
        message: res.message,
        requiresEmailVerification: res.requiresEmailVerification,
        verificationToken: res.verificationToken,
        verificationUrl: res.verificationUrl,
        email: res.email,
        user: res.user,
        tenant: res.tenant
      };
    }
    return {
      success: false,
      message: res.message || "Erreur lors de la création de l'agence."
    };
  };

  const resendEmailVerification = (email: string) => {
    return dbStore.resendEmailVerification(email);
  };

  const verifyEmailAndActivate = (token: string) => {
    const res = dbStore.verifyEmailAndActivateAgency(token);
    if (res.success && res.user && res.tenant) {
      localStorage.setItem('cms_is_authenticated', 'true');
      localStorage.setItem('cms_current_user_id', res.user.id);
      localStorage.setItem('cms_active_section', 'dashboard');
      window.location.hash = 'dashboard';
      setIsAuthenticated(true);
    }
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentTenant,
        currentAgency,
        currentBranch,
        allTenants,
        allAgencies,
        allBranches,
        allUsers,
        isAuthenticated,
        isSuperAdmin,
        canPerformMutations,
        canManageSensitiveFinancials,
        canModifyFinancials,
        userRoleLabel,
        checkFinancialPermission,
        hasPermission,
        hasAnyPermission,
        switchUser,
        switchTenant,
        switchAgency,
        switchBranch,
        login,
        unlockUserAccount,
        registerAgency,
        resendEmailVerification,
        verifyEmailAndActivate,
        logout,
        updateProfile,
        updateAvatar,
        removeAvatar,
        changePassword,
        requestPasswordReset,
        resetPasswordWithCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
