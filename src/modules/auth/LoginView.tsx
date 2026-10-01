import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { RegisterAgencyModal } from './RegisterAgencyModal';
import {
  Lock, User as UserIcon, LogIn, Sparkles, Building2,
  AlertCircle, Eye, EyeOff, Crown, ShieldAlert, Mail, Send, CheckCircle2
} from 'lucide-react';

interface LoginViewProps {
  initialMode?: 'AGENCY' | 'SUPER_ADMIN';
}

export const LoginView: React.FC<LoginViewProps> = ({ 
  initialMode = 'AGENCY'
}) => {
  const { login, currentTenant, resendEmailVerification } = useAuth();

  const [authMode, setAuthMode] = useState<'AGENCY' | 'SUPER_ADMIN'>(() => {
    if (window.location.hash === '#login-superadmin' || window.location.hash === '#superadmin' || window.location.hash === '#saas-superadmin') return 'SUPER_ADMIN';
    return initialMode;
  });

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLockedError, setIsLockedError] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLockedError(false);
    setUnverifiedEmail(null);
    setResendMsg(null);

    if (!identifier.trim()) {
      setErrorMsg("Veuillez saisir votre identifiant, email ou numéro de téléphone.");
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
      if (res.requiresEmailVerification) {
        setUnverifiedEmail(res.email || identifier.trim());
      }
    }
  };

  const handleResendVerificationFromLogin = () => {
    if (!unverifiedEmail) return;
    setIsResending(true);
    setResendMsg(null);
    try {
      const res = resendEmailVerification(unverifiedEmail);
      if (res.success) {
        setResendMsg({ text: res.message, type: 'success' });
        setResendCooldown(60);
      } else {
        setResendMsg({ text: res.message, type: 'error' });
        if (res.remainingSeconds) {
          setResendCooldown(res.remainingSeconds);
        }
      }
    } catch (err: any) {
      setResendMsg({ text: err?.message || "Erreur lors du renvoi.", type: 'error' });
    } finally {
      setIsResending(false);
    }
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
            <span>Gestion des Centres de Prestation</span>
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
              setIdentifier('');
              setPassword('');
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
              setIdentifier('');
              setPassword('');
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

          {unverifiedEmail ? (
            <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-200 space-y-2.5 animate-shake">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Mail className="w-4 h-4 text-amber-400" />
                Confirmation d'adresse e-mail requise
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Veuillez confirmer votre adresse e-mail avant de vous connecter. Un lien de confirmation a été envoyé à <strong>{unverifiedEmail}</strong>. Votre période d'essai de 15 jours démarrera dès confirmation.
              </p>
              {resendMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  resendMsg.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {resendMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span>{resendMsg.text}</span>
                </div>
              )}
              <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={Send}
                  disabled={isResending || resendCooldown > 0}
                  onClick={handleResendVerificationFromLogin}
                  className="text-xs bg-amber-500/20 border-amber-500/40 text-amber-200 hover:text-white"
                >
                  {isResending
                    ? "Envoi..."
                    : resendCooldown > 0
                    ? `Patienter ${resendCooldown}s`
                    : "Renvoyer l'e-mail de confirmation"}
                </Button>
                <a
                  href="/verify-email"
                  className="text-xs text-amber-300 hover:text-amber-100 underline"
                >
                  Valider avec un jeton
                </a>
              </div>
            </div>
          ) : errorMsg && (
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
                Identifiant, email ou numéro de téléphone
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  authMode === 'SUPER_ADMIN' 
                    ? "Identifiant, email ou téléphone (ex: superadmin)" 
                    : "Identifiant, email ou téléphone (ex: admin, email@domaine.com, +224...)"
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
