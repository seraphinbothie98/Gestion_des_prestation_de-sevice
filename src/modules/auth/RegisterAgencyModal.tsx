import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { isValidPhoneNumber } from '../../lib/phoneValidation';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { ActivityType, Currency } from '../../types';
import {
  Sparkles, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck,
  Eye, EyeOff, AlertCircle, Mail, Send, Clock, ExternalLink
} from 'lucide-react';

interface RegisterAgencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RegisterAgencyModal: React.FC<RegisterAgencyModalProps> = ({ isOpen, onClose }) => {
  const { registerAgency, resendEmailVerification } = useAuth();
  const { showToast } = useNotification();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // STEP 1: Responsable
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // STEP 2: Agence
  const [agencyName, setAgencyName] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('SERVICE_CENTER');
  const [agencyPhone, setAgencyPhone] = useState('');
  const [agencyAddress, setAgencyAddress] = useState('');
  const [agencyCity, setAgencyCity] = useState('');
  const [currency, setCurrency] = useState<Currency>('GNF');

  // STEP 3: Email confirmation waiting
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatusMsg, setResendStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isResending, setIsResending] = useState(false);

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg("Veuillez renseigner votre nom et prénom.");
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg("Veuillez saisir une adresse e-mail valide.");
      return;
    }
    if (!phone.trim() || !isValidPhoneNumber(phone, { allowEmpty: false, required: true })) {
      setErrorMsg("Veuillez saisir un numéro de téléphone valide sans lettres ni caractères interdits.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setStep(2);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!agencyName.trim()) {
      setErrorMsg("Veuillez saisir le nom de votre agence ou établissement.");
      return;
    }

    if (agencyPhone.trim() && !isValidPhoneNumber(agencyPhone, { allowEmpty: true })) {
      setErrorMsg("Le numéro de téléphone professionnel de l'agence est invalide.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = registerAgency({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        agencyName: agencyName.trim(),
        activityType,
        agencyPhone: agencyPhone.trim() || phone.trim(),
        agencyAddress: agencyAddress.trim(),
        agencyCity: agencyCity.trim(),
        currency
      });

      if (res.success) {
        if (res.requiresEmailVerification) {
          setRegisteredEmail(email.trim());
          setVerificationToken(res.verificationToken || '');
          setVerificationUrl(res.verificationUrl || `/verify-email?token=${res.verificationToken}`);
          setStep(3);
        } else {
          showToast(
            "Agence Créée avec Succès !",
            `Bienvenue dans ${res.tenant?.name}. Votre période d'essai gratuite de 15 jours est immédiatement activée.`,
            "SUCCESS"
          );
          onClose();
        }
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Une erreur inattendue est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = () => {
    if (!registeredEmail) return;
    setIsResending(true);
    setResendStatusMsg(null);

    try {
      const res = resendEmailVerification(registeredEmail);
      if (res.success) {
        setResendStatusMsg({ text: res.message, type: 'success' });
        setResendCooldown(60);
        if (res.verificationToken) {
          setVerificationToken(res.verificationToken);
        }
        if (res.verificationUrl) {
          setVerificationUrl(res.verificationUrl);
        }
      } else {
        setResendStatusMsg({ text: res.message, type: 'error' });
        if (res.remainingSeconds) {
          setResendCooldown(res.remainingSeconds);
        }
      }
    } catch (err: any) {
      setResendStatusMsg({ text: err?.message || "Erreur lors du renvoi.", type: 'error' });
    } finally {
      setIsResending(false);
    }
  };

  const handleGoToVerificationPage = () => {
    if (verificationUrl) {
      window.location.href = verificationUrl;
    } else {
      window.location.href = `/verify-email?token=${verificationToken}`;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 3 ? "Confirmation de votre adresse e-mail" : "Création Autonome d'un Centre de Prestations"}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Trial Badge Header */}
        <div className="p-3.5 bg-gradient-to-r from-brand-500/10 via-amber-500/10 to-emerald-500/10 dark:from-brand-950/40 dark:via-amber-950/40 dark:to-emerald-950/40 border border-brand-200 dark:border-brand-800 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-600 text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-xs font-black text-slate-900 dark:text-white block">
                Licence d'Essai Gratuite de 15 Jours
              </strong>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                La période d'essai de 15 jours démarre dès confirmation de votre e-mail
              </span>
            </div>
          </div>
          <Badge variant="success" size="sm" className="font-black">
            0 GNF
          </Badge>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
            step === 1
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
          }`}>
            <span>1. Responsable</span>
            {step > 1 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          </div>
          <div className="w-4 h-0.5 bg-slate-200 dark:bg-slate-700" />
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
            step === 2
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : step === 3
              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            <span>2. Centre</span>
            {step > 2 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          </div>
          <div className="w-4 h-0.5 bg-slate-200 dark:bg-slate-700" />
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
            step === 3
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            <span>3. Confirmation</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: FORMULAIRE RESPONSABLE */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Prénom du Responsable *
                </label>
                <Input
                  type="text"
                  placeholder="ex: Mamadou"
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
                  placeholder="ex: Diallo"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Adresse E-mail (Sert d'identifiant) *
                </label>
                <Input
                  type="email"
                  placeholder="responsable@agence.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <PhoneInput
                  label="Numéro de Téléphone *"
                  placeholder="+224 620 00 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Mot de Passe (Min 6 car.) *
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Confirmation du Mot de Passe *
                </label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                icon={ArrowRight}
                className="w-full sm:w-auto font-bold bg-brand-600 hover:bg-brand-700"
              >
                Suivant : Configurer le Centre
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: FORMULAIRE CENTRE */}
        {step === 2 && (
          <form onSubmit={handleFinalSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nom du Centre ou de l'Agence *
              </label>
              <Input
                type="text"
                placeholder="ex: Centre Multi-Services Kaloum, Horizon Matériaux..."
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                required
                className="font-extrabold text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Type d'Activité Principale *
                </label>
                <Select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as ActivityType)}
                >
                  <option value="SERVICE_CENTER">📄 Centre de Prestations & Reprographie</option>
                  <option value="RETAIL_STORE">🏬 Boutique & Magasin de Détail</option>
                  <option value="RESTAURANT">🍽️ Restaurant & Salon de Thé</option>
                  <option value="WHOLESALE">📦 Grossiste & Distribution</option>
                  <option value="OTHER">🏢 Autre Activité Professionnelle</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Devise d'Exploitation
                </label>
                <Select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                >
                  <option value="GNF">GNF — Franc Guinéen</option>
                  <option value="XOF">XOF — Franc CFA (UEMOA)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="USD">USD — Dollar ($)</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <PhoneInput
                  label="Téléphone Professionnel (Optionnel)"
                  placeholder="ex: +224 622 00 11 22"
                  value={agencyPhone}
                  onChange={(e) => setAgencyPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Ville / Commune
                </label>
                <Input
                  type="text"
                  placeholder="ex: Conakry (Kaloum)"
                  value={agencyCity}
                  onChange={(e) => setAgencyCity(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Adresse Complète
              </label>
              <Input
                type="text"
                placeholder="ex: Immeuble Horizon, 2ème étage, Avenue de la République"
                value={agencyAddress}
                onChange={(e) => setAgencyAddress(e.target.value)}
              />
            </div>

            {/* Recap info */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Confirmation par e-mail requise
              </div>
              <p className="text-[11px]">
                Pour sécuriser votre compte, un e-mail de confirmation vous sera envoyé. Votre période d'essai gratuit de 15 jours débutera au moment exact de la confirmation.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                icon={ArrowLeft}
                onClick={() => setStep(1)}
              >
                Retour
              </Button>

              <Button
                type="submit"
                variant="primary"
                icon={Sparkles}
                disabled={isSubmitting}
                className="font-extrabold bg-brand-600 hover:bg-brand-700"
              >
                {isSubmitting ? "Création en cours..." : "Créer mon centre de prestations (Essai 15 jours)"}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: VÉRIFIEZ VOTRE ADRESSE E-MAIL */}
        {step === 3 && (
          <div className="space-y-5 py-1">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center mx-auto shadow-lg shadow-brand-950/40">
                <Mail className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Vérifiez votre adresse e-mail
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                Un e-mail de confirmation contenant votre lien d'activation sécurisé a été envoyé à :
              </p>
              <div className="inline-block px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 font-extrabold text-sm">
                {registeredEmail}
              </div>
            </div>

            {/* Information Callout */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <Clock className="w-4 h-4 text-amber-500" />
                Démarrage de l'essai après confirmation
              </div>
              <p className="text-[11px] leading-relaxed">
                Votre période d'essai gratuit de <strong>15 jours</strong> commencera dès que vous aurez confirmé votre adresse e-mail en cliquant sur le lien reçu. Le lien est valable pendant 24 heures.
              </p>
            </div>

            {/* Test Simulation Box (Facilite les tests en local) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-brand-500/10 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Mode Démonstration / Test Rapide
                </span>
                <Badge variant="success" size="sm">Prêt</Badge>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Vous pouvez cliquer directement ci-dessous pour confirmer immédiatement votre e-mail et activer vos 15 jours d'essai :
              </p>
              <Button
                type="button"
                variant="primary"
                icon={ExternalLink}
                onClick={handleGoToVerificationPage}
                className="w-full text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Confirmer l'e-mail & Démarrer les 15 jours
              </Button>
            </div>

            {/* Resend status message */}
            {resendStatusMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                resendStatusMsg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
              }`}>
                {resendStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{resendStatusMsg.text}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                icon={Send}
                disabled={isResending || resendCooldown > 0}
                onClick={handleResendEmail}
                className="w-full sm:w-auto font-bold text-xs"
              >
                {isResending
                  ? "Envoi en cours..."
                  : resendCooldown > 0
                  ? `Renvoyer (${resendCooldown}s)`
                  : "Renvoyer l'e-mail de confirmation"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="w-full sm:w-auto text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Retour à la page de connexion
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
