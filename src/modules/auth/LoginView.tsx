import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { RegisterAgencyModal } from './RegisterAgencyModal';
import { dbStore } from '../../server/db/mockStore';
import { checkAccountLockout } from '../../server/security/securityEngine';
import {
  Lock, User as UserIcon, LogIn, Sparkles, Building2,
  ShieldCheck, AlertCircle, Eye, EyeOff, Check, Crown,
  Building, Briefcase, ArrowRight, ShieldAlert, PlusCircle, Clock, ShieldX
} from 'lucide-react';

interface LoginViewProps {
  initialMode?: 'AGENCY' | 'SUPER_ADMIN';
}

export const LoginView: React.FC<LoginViewProps> = ({ 
  initialMode = 'AGENCY'
}) => {
  const { login, allUsers, currentTenant } = useAuth();
  const state = dbStore.getState();

  const [authMode, setAuthMode] = useState<'AGENCY' | 'SUPER_ADMIN'>(() => {
    if (window.location.hash === '#login-superadmin' || window.location.hash === '#superadmin' || window.location.hash === '#saas-superadmin') return 'SUPER_ADMIN';
    return initialMode;
  });

  const [identifier, setIdentifier] = useState(() => {
    if (initialMode === 'SUPER_ADMIN') return 'superadmin';
    return 'admin';
  });

  const [password, setPassword] = useState(() => {
    if (initialMode === 'SUPER_ADMIN') return 'superadmin123';
    return 'admin123';
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLockedError, setIsLockedError] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Grouped users for clear demo hierarchy
  const superAdminUsers = state.users.filter(u => u.isSuperAdmin || u.username === 'superadmin' || u.roles.some(r => r.code === 'SUPER_ADMIN'));
  const agencyAdminUsers = state.users.filter(u => !u.isSuperAdmin && u.username !== 'superadmin' && u.roles.some(r => r.code === 'ADMIN_CENTRE' || r.code === 'GERANT' || r.code === 'ADMIN_AGENCY'));
  const staffUsers = state.users.filter(u => !u.isSuperAdmin && u.username !== 'superadmin' && !u.roles.some(r => r.code === 'ADMIN_CENTRE' || r.code === 'GERANT' || r.code === 'ADMIN_AGENCY' || r.code === 'SUPER_ADMIN'));

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLockedError(false);

    if (!identifier.trim()) {
      setErrorMsg("Veuillez saisir votre identifiant ou adresse email.");
      return;
    }

    if (!password) {
      setErrorMsg("Veuillez saisir votre mot de passe.");
      return;
    }

    const res = login(identifier, password);
    if (!res.success) {
      setErrorMsg(res.message || "Identifiants incorrects.");
      if (res.isLocked) {
        setIsLockedError(true);
      }
    }
  };

  const handleQuickSelect = (username: string, pass: string, mode: 'AGENCY' | 'SUPER_ADMIN') => {
    setAuthMode(mode);
    setIdentifier(username);
    setPassword(pass);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 text-brand-400 flex items-center justify-center mx-auto shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-brand-600 via-yellow-400 to-emerald-600" />
            <Building2 className="w-8 h-8 relative z-10 text-brand-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            <span>GESTION DU CENTRE DE PRESTATIONS</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium max-w-md mx-auto">
            Plateforme complète : Services, Reprographie, Production, Caisse & Formations
          </p>
        </div>

        {/* Mode Selector Switcher */}
        <div className="bg-slate-900/90 p-1 rounded-2xl border border-slate-800 flex flex-col sm:flex-row gap-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setAuthMode('AGENCY');
              setIdentifier('admin');
              setPassword('admin123');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              authMode === 'AGENCY'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Espace Centre & Agence</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('SUPER_ADMIN');
              setIdentifier('superadmin');
              setPassword('superadmin123');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              authMode === 'SUPER_ADMIN'
                ? 'bg-yellow-500 text-slate-950 font-black shadow-md shadow-yellow-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>Super Admin SaaS</span>
          </button>
        </div>

        {/* Login Card */}
        <Card className="p-6 sm:p-8 bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-3xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                {authMode === 'SUPER_ADMIN' ? (
                  <>
                    <Crown className="w-5 h-5 text-amber-400" />
                    Connexion Super Administrateur
                  </>
                ) : (
                  <>
                    <Building2 className="w-5 h-5 text-brand-400" />
                    Connexion Centre de Prestations
                  </>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">
                {authMode === 'SUPER_ADMIN'
                  ? 'Contrôle transverse de toute la plateforme SaaS et du parc des agences'
                  : 'Accédez à la gestion des prestations, caisse, production, stock et formations'}
              </p>
            </div>
            {authMode === 'SUPER_ADMIN' ? (
              <Badge variant="warning" size="sm" className="font-extrabold uppercase">
                Global SaaS
              </Badge>
            ) : (
              <Badge variant="primary" size="sm" className="font-extrabold uppercase bg-brand-500/20 text-brand-300 border-brand-500/40">
                {currentTenant?.name?.split(' ')[0] || 'Centre'}
              </Badge>
            )}
          </div>

          {errorMsg && (
            <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-3 animate-shake ${
              isLockedError
                ? 'bg-rose-950/80 border-rose-500/80 text-rose-200 shadow-lg shadow-rose-950/50'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {isLockedError ? (
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-extrabold flex items-center gap-1.5">
                  {isLockedError ? 'POLITIQUE DE SÉCURITÉ ACTIVE — COMPTE BLOQUÉ' : 'ÉCHEC D\'AUTHENTIFICATION'}
                </div>
                <div className="text-[11px] leading-relaxed opacity-95">
                  {errorMsg}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-brand-400" />
                {authMode === 'SUPER_ADMIN' 
                  ? "Identifiant Super Admin ou Email" 
                  : "Identifiant Collaborateur ou Email"}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  authMode === 'SUPER_ADMIN' 
                    ? "superadmin" 
                    : "admin, caissier, operateur..."
                }
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all placeholder:text-slate-600 outline-none"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-brand-400" />
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition-colors cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all placeholder:text-slate-600 outline-none pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              icon={LogIn}
              className={`w-full py-2.5 shadow-lg mt-2 font-extrabold cursor-pointer ${
                authMode === 'SUPER_ADMIN'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/25'
                  : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-600/25'
              }`}
            >
              {authMode === 'SUPER_ADMIN' 
                ? "Accéder à l'Administration Globale" 
                : "Se Connecter à mon Espace de Gestion"}
            </Button>

            {/* Inscription d'un Nouveau Centre */}
            {authMode === 'AGENCY' && (
              <div className="pt-3 border-t border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400 font-medium">
                  Nouveau centre de prestations ?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  icon={Sparkles}
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="w-full py-2.5 bg-gradient-to-r from-brand-600/15 via-amber-600/15 to-emerald-600/15 hover:from-brand-600/30 hover:via-amber-600/30 hover:to-emerald-600/30 border-brand-500/40 text-brand-300 hover:text-white font-extrabold text-xs transition-all shadow-md cursor-pointer"
                >
                  Créer mon centre de prestations (Essai 15 jours)
                </Button>
              </div>
            )}
          </form>
        </Card>

        {/* Demo Fast Access Picker with Clear Hierarchy */}
        <div className="p-5 bg-slate-900/70 backdrop-blur-md rounded-3xl border border-slate-800 text-xs space-y-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-300 border-b border-slate-800 pb-2.5">
            <span className="font-extrabold text-xs flex items-center gap-1.5 text-white">
              <Sparkles className="w-4 h-4 text-brand-400" />
              Sélecteur Rapide de Rôles & Démonstration :
            </span>
            <span className="text-[10px] text-slate-400">Cliquez sur un compte pour tester</span>
          </div>

          {/* Niveau 1: Super Administrateur Global */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" />
              NIVEAU 1 — SUPER ADMINISTRATEUR GLOBAL (SaaS)
            </div>
            <div className="grid grid-cols-1 gap-2">
              {superAdminUsers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickSelect(u.username, u.passwordHash || 'superadmin123', 'SUPER_ADMIN')}
                  className={`p-3 rounded-2xl text-left border transition-all flex items-center justify-between cursor-pointer ${
                    identifier === u.username
                      ? 'bg-amber-950/60 border-amber-500 text-white shadow-md shadow-amber-950/50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-amber-600/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                      👑
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-xs text-white">{u.firstName} {u.lastName}</strong>
                        <Badge variant="warning" size="sm" className="text-[9px] py-0 px-1 font-bold">
                          Global
                        </Badge>
                      </div>
                      <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                        login: <span className="text-amber-300 font-bold">{u.username}</span> • mdp: <span className="text-slate-300">superadmin123</span>
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Niveau 2: Administrateurs de Centres */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              NIVEAU 2 — DIRECTEURS & GÉRANTS DU CENTRE
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agencyAdminUsers.map(u => {
                const agency = state.tenants.find(t => t.id === u.tenantId);
                const isAgencyA = u.tenantId === 't-001';
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickSelect(u.username, u.passwordHash || 'admin123', 'AGENCY')}
                    className={`p-2.5 rounded-2xl text-left border transition-all flex flex-col justify-between cursor-pointer ${
                      identifier === u.username
                        ? 'bg-brand-950/60 border-brand-500 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-brand-600/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <strong className="text-xs text-white truncate">{u.firstName} {u.lastName}</strong>
                      <Badge variant={isAgencyA ? 'primary' : 'success'} size="sm" className="text-[9px] py-0 px-1 font-bold">
                        {isAgencyA ? 'NICOST' : 'Horizon'}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-brand-300 font-medium truncate mt-0.5">
                      {agency?.name || 'Centre'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono mt-1">
                      login: <span className="text-white font-bold">{u.username}</span> • mdp: admin123
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Niveau 3: Collaborateurs Métier */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                NIVEAU 3 — POSTES MÉTIER (CAISSE, ATELIER, FORMATION)
              </span>
              <span className="text-[9px] text-slate-400 font-mono">NICOST (t-001)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {staffUsers.filter(u => u.tenantId === 't-001').map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickSelect(u.username, u.passwordHash || `${u.username}123`, 'AGENCY')}
                  className={`p-2 rounded-xl text-left border transition-all flex flex-col justify-between cursor-pointer ${
                    identifier === u.username
                      ? 'bg-emerald-950/60 border-emerald-500 text-white'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="font-bold text-[11px] text-white truncate">{u.firstName} {u.lastName}</span>
                  <span className="text-[10px] text-emerald-300 font-semibold">{u.roles[0]?.name}</span>
                  <span className="text-[9px] text-slate-500 font-mono mt-0.5">login: {u.username}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        onSuccess={() => {
          setIsForgotModalOpen(false);
          setErrorMsg(null);
        }}
      />

      {/* Register Agency Modal */}
      <RegisterAgencyModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
      />
    </div>
  );
};
