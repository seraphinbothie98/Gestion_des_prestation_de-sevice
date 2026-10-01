import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import {
  CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, ArrowRight,
  Building2, Sparkles, ShieldCheck, Mail, Send, Clock, LogIn
} from 'lucide-react';
import { Tenant, User } from '../../types';

interface EmailVerificationViewProps {
  initialToken?: string;
  onNavigateToLogin: () => void;
  onNavigateToDashboard: () => void;
}

export const EmailVerificationView: React.FC<EmailVerificationViewProps> = ({
  initialToken,
  onNavigateToLogin,
  onNavigateToDashboard
}) => {
  const { verifyEmailAndActivate, resendEmailVerification } = useAuth();

  // Extract token from prop, window.location.search or window.location.hash
  const resolveTokenFromLocation = (): string => {
    if (initialToken) return initialToken.trim();
    if (typeof window === 'undefined') return '';

    // Search params ?token=...
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromQuery = urlParams.get('token');
    if (tokenFromQuery) return tokenFromQuery.trim();

    // Hash query #verify-email?token=...
    if (window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1];
      const hashParams = new URLSearchParams(hashQuery);
      const tokenFromHash = hashParams.get('token');
      if (tokenFromHash) return tokenFromHash.trim();
    }

    return '';
  };

  const [token, setToken] = useState<string>(resolveTokenFromLocation);
  const [status, setStatus] = useState<'IDLE' | 'VALIDATING' | 'SUCCESS' | 'ALREADY_USED' | 'EXPIRED' | 'INVALID'>('IDLE');
  const [message, setMessage] = useState<string>('');
  const [activatedUser, setActivatedUser] = useState<User | null>(null);
  const [activatedTenant, setActivatedTenant] = useState<Tenant | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  // Resend state for expired or lost tokens
  const [resendEmail, setResendEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isResending, setIsResending] = useState(false);

  // Execute verification
  const executeVerification = (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) {
      setStatus('INVALID');
      setMessage("Aucun jeton de validation n'a été fourni.");
      return;
    }

    setStatus('VALIDATING');
    setMessage("Vérification sécurisée de votre e-mail en cours...");

    try {
      const res = verifyEmailAndActivate(tokenToVerify.trim());

      if (res.success && res.user && res.tenant) {
        setStatus('SUCCESS');
        setMessage(res.message);
        setActivatedUser(res.user);
        setActivatedTenant(res.tenant);
        setTrialEndsAt(res.trialEndsAt || res.tenant.trialEndsAt || null);
      } else if (res.reason === 'ALREADY_USED') {
        setStatus('ALREADY_USED');
        setMessage(res.message || "Ce lien a déjà été utilisé. Votre compte est déjà actif.");
        if (res.user) setActivatedUser(res.user);
        if (res.tenant) setActivatedTenant(res.tenant);
      } else if (res.reason === 'EXPIRED') {
        setStatus('EXPIRED');
        setMessage(res.message || "Le lien de confirmation a expiré (validité 24h).");
        if (res.email) setResendEmail(res.email);
      } else {
        setStatus('INVALID');
        setMessage(res.message || "Lien de confirmation invalide ou introuvable.");
        if (res.email) setResendEmail(res.email);
      }
    } catch (err: any) {
      setStatus('INVALID');
      setMessage(err?.message || "Une erreur inattendue est survenue lors de la vérification.");
    }
  };

  // Cooldown timer tick
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Run on mount if token is detected
  useEffect(() => {
    const currentTok = resolveTokenFromLocation();
    if (currentTok) {
      executeVerification(currentTok);
    }
  }, []);

  const handleResend = () => {
    const emailToUse = (resendEmail || activatedUser?.email || '').trim();
    if (!emailToUse || !emailToUse.includes('@')) {
      setResendMsg({ text: "Veuillez renseigner une adresse e-mail valide.", type: 'error' });
      return;
    }

    setIsResending(true);
    setResendMsg(null);

    try {
      const res = resendEmailVerification(emailToUse);
      if (res.success) {
        setResendMsg({ text: res.message, type: 'success' });
        setResendCooldown(60);
        if (res.verificationToken) {
          setToken(res.verificationToken);
        }
      } else {
        setResendMsg({ text: res.message, type: 'error' });
        if (res.remainingSeconds) {
          setResendCooldown(res.remainingSeconds);
        }
      }
    } catch (err: any) {
      setResendMsg({ text: err?.message || "Impossible de renvoyer l'e-mail pour le moment.", type: 'error' });
    } finally {
      setIsResending(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '15 jours';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 text-brand-400 flex items-center justify-center mx-auto shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-brand-600 via-amber-400 to-emerald-500" />
            <Building2 className="w-8 h-8 relative z-10 text-brand-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Gestion des Centres de Prestation
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Activation & Validation Sécurisée de Centre
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-6 sm:p-8 bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-3xl">
          {/* STATE: VALIDATING */}
          {status === 'VALIDATING' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/30 text-brand-400 flex items-center justify-center mx-auto animate-spin">
                <RefreshCw className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-extrabold text-white">
                Validation du jeton de confirmation...
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Nous activons votre agence et synchronisons votre période d'essai de 15 jours.
              </p>
            </div>
          )}

          {/* STATE: SUCCESS */}
          {status === 'SUCCESS' && (
            <div className="space-y-6 py-2">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <Badge variant="success" size="sm" className="font-extrabold">
                  Compte Validé & Vérifié
                </Badge>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Félicitations ! Votre centre est activé
                </h2>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  Votre adresse e-mail a été confirmée avec succès. Votre période d'essai gratuit de <strong className="text-emerald-400 font-bold">15 jours</strong> vient de commencer officiellement.
                </p>
              </div>

              {/* Agency Summary Box */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                  <span className="text-xs text-slate-400">Établissement</span>
                  <span className="text-xs font-black text-white">{activatedTenant?.name || 'Mon Agence'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                  <span className="text-xs text-slate-400">Responsable</span>
                  <span className="text-xs font-bold text-slate-200">
                    {activatedUser ? `${activatedUser.firstName} ${activatedUser.lastName}` : 'Administrateur'}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                  <span className="text-xs text-slate-400">Période d'essai</span>
                  <span className="text-xs font-bold text-emerald-400">15 Jours Complets</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Fin de l'essai</span>
                  <span className="text-xs font-bold text-amber-300">{formatDate(trialEndsAt)}</span>
                </div>
              </div>

              {/* Enter Dashboard Action */}
              <Button
                type="button"
                variant="primary"
                icon={ArrowRight}
                onClick={onNavigateToDashboard}
                className="w-full py-3.5 bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 font-black text-sm shadow-xl shadow-brand-900/40 cursor-pointer"
              >
                Accéder à mon centre de prestations
              </Button>
            </div>
          )}

          {/* STATE: ALREADY_USED */}
          {status === 'ALREADY_USED' && (
            <div className="space-y-6 py-2">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/20 border border-brand-500/40 text-brand-300 flex items-center justify-center mx-auto shadow-lg">
                  <ShieldCheck className="w-9 h-9" />
                </div>
                <Badge variant="primary" size="sm" className="font-extrabold">
                  Lien Déjà Utilisé
                </Badge>
                <h2 className="text-xl font-black text-white">
                  Ce lien a déjà été utilisé
                </h2>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Votre compte et votre établissement sont déjà actifs. Vous pouvez vous connecter immédiatement avec vos identifiants.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="primary"
                  icon={LogIn}
                  onClick={onNavigateToLogin}
                  className="flex-1 font-bold bg-brand-600 hover:bg-brand-700"
                >
                  Se Connecter
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  icon={ArrowRight}
                  onClick={onNavigateToDashboard}
                  className="flex-1 font-bold border-slate-700 hover:bg-slate-800"
                >
                  Aller au Dashboard
                </Button>
              </div>
            </div>
          )}

          {/* STATE: EXPIRED */}
          {status === 'EXPIRED' && (
            <div className="space-y-6 py-2">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg">
                  <Clock className="w-9 h-9" />
                </div>
                <Badge variant="warning" size="sm" className="font-extrabold">
                  Lien Expiré (24h)
                </Badge>
                <h2 className="text-xl font-black text-white">
                  Le lien de confirmation a expiré
                </h2>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Pour votre sécurité, les liens de confirmation expirent après 24 heures. Renseignez votre adresse e-mail ci-dessous pour recevoir un nouveau lien.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Adresse E-mail de votre compte
                  </label>
                  <Input
                    type="email"
                    placeholder="responsable@agence.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                  />
                </div>

                {resendMsg && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    resendMsg.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  }`}>
                    {resendMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{resendMsg.text}</span>
                  </div>
                )}

                <Button
                  type="button"
                  variant="primary"
                  icon={Send}
                  disabled={isResending || resendCooldown > 0}
                  onClick={handleResend}
                  className="w-full font-bold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isResending
                    ? "Envoi en cours..."
                    : resendCooldown > 0
                    ? `Patienter ${resendCooldown}s`
                    : "Renvoyer un nouveau lien de confirmation"}
                </Button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Retour à la page de connexion
                </button>
              </div>
            </div>
          )}

          {/* STATE: INVALID or IDLE (Manual token input) */}
          {(status === 'INVALID' || status === 'IDLE') && (
            <div className="space-y-6 py-2">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
                  <AlertCircle className="w-9 h-9" />
                </div>
                <Badge variant="danger" size="sm" className="font-extrabold">
                  Validation Requise
                </Badge>
                <h2 className="text-xl font-black text-white">
                  Confirmation d'Adresse E-mail
                </h2>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  {message || "Veuillez saisir votre jeton de confirmation ou demander un nouvel envoi d'e-mail."}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Jeton de Confirmation
                  </label>
                  <Input
                    type="text"
                    placeholder="vtok_..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </div>

                <Button
                  type="button"
                  variant="primary"
                  icon={CheckCircle2}
                  disabled={!token.trim()}
                  onClick={() => executeVerification(token)}
                  className="w-full font-bold bg-brand-600 hover:bg-brand-700"
                >
                  Valider et Activer mon Agence
                </Button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-3">
                <span className="text-xs font-bold text-slate-300 block">
                  Vous n'avez pas reçu le lien ?
                </span>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="votre@email.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    icon={Send}
                    disabled={isResending || resendCooldown > 0}
                    onClick={handleResend}
                    className="text-xs flex-shrink-0"
                  >
                    {resendCooldown > 0 ? `${resendCooldown}s` : "Renvoyer"}
                  </Button>
                </div>
                {resendMsg && (
                  <p className={`text-[11px] ${resendMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {resendMsg.text}
                  </p>
                )}
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Retour à la page de connexion
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
