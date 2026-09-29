import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { evaluateTenantSubscription } from '../../lib/licenseEngine';
import { Button } from '../../components/ui/Button';
import { formatDate } from '../../lib/utils';
import {
  Clock, ShieldAlert, Phone, ShieldCheck,
  Building, LogOut, RefreshCw, KeyRound, Sparkles
} from 'lucide-react';
import { ContactSupportModal } from './ContactSupportModal';
import { RequestActivationModal } from './RequestActivationModal';

interface TrialExpiredScreenProps {
  onGoToLicenseManager?: () => void;
}

export const TrialExpiredScreen: React.FC<TrialExpiredScreenProps> = ({ onGoToLicenseManager }) => {
  const { currentTenant, currentUser, switchUser, allUsers, logout } = useAuth();
  const [showContactModal, setShowContactModal] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);

  const evaluation = evaluateTenantSubscription(currentTenant);
  const isSuperAdmin = currentUser?.roles.some(r => r.code === 'SUPER_ADMIN');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Bar with Center Brand */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-2xl flex items-center justify-center font-black text-white shadow-lg">
            CMS
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-white">Centre Management System</h1>
            <p className="text-[11px] text-slate-400">Solution Complète de Gestion de Centre & Prestations</p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          icon={LogOut}
          onClick={logout}
          className="text-xs text-slate-300 border-slate-700 hover:bg-slate-800"
        >
          Déconnexion
        </Button>
      </div>

      {/* Center Card */}
      <div className="max-w-xl w-full mx-auto my-8">
        <div className="bg-slate-800/90 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-2xl p-6 sm:p-10 text-center space-y-6">
          {/* Status Icon */}
          <div className="w-20 h-20 bg-rose-500/10 border-2 border-rose-500/30 rounded-3xl flex items-center justify-center mx-auto text-rose-500 shadow-inner">
            <Clock className="w-10 h-10 animate-pulse" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-rose-400 bg-rose-950/60 px-3 py-1 rounded-full border border-rose-800/50">
              PÉRIODE D'ESSAI TERMINÉE
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white pt-2">
              Votre période d'essai de 45 jours est arrivée à son terme
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              Merci d'avoir utilisé <strong>Centre Management System</strong>. Toutes vos données restent conservées en toute sécurité. Pour débloquer l'accès complet, veuillez contacter l'administrateur.
            </p>
          </div>

          {/* Center Details Summary */}
          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 text-left text-xs space-y-2">
            <div className="flex justify-between items-center py-1 border-b border-slate-800">
              <span className="text-slate-400">Centre :</span>
              <strong className="text-white">{currentTenant?.name || 'Centre'}</strong>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800">
              <span className="text-slate-400">Référence du compte :</span>
              <span className="font-mono text-brand-400 font-bold">{currentTenant?.code || 'NICOST-01'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800">
              <span className="text-slate-400">Fin de l'essai :</span>
              <span className="text-slate-300 font-semibold">{formatDate(evaluation.endDate, 'dd MMMM yyyy')}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-400">État des données :</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                🔒 100% Sauvegardées & Intactes
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              variant="primary"
              icon={Phone}
              onClick={() => setShowContactModal(true)}
              className="w-full py-3 font-extrabold text-sm shadow-xl bg-brand-600 hover:bg-brand-500"
            >
              CONTACTER L'ADMINISTRATEUR
            </Button>

            <Button
              variant="outline"
              icon={ShieldCheck}
              onClick={() => setShowActivationModal(true)}
              className="w-full py-2.5 font-bold text-xs text-emerald-400 border-emerald-500/40 hover:bg-emerald-950/40"
            >
              Demander l'Activation
            </Button>

            {isSuperAdmin && onGoToLicenseManager && (
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={KeyRound}
                  onClick={onGoToLicenseManager}
                  className="text-xs text-amber-400 hover:bg-amber-950/40"
                >
                  Accès Super-Admin : Gestion des Licences
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Support Info */}
      <div className="max-w-4xl w-full mx-auto text-center text-xs text-slate-500 space-y-1">
        <p>
          Support Technique & Commercial : <strong>{evaluation.supportContact.phone}</strong> • {evaluation.supportContact.email}
        </p>
        <p className="text-[10px] text-slate-600">
          Centre Management System • Système certifié multi-agences
        </p>
      </div>

      {/* Modals */}
      <ContactSupportModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        supportContact={evaluation.supportContact}
        tenantName={currentTenant?.name}
        onOpenActivationRequest={() => setShowActivationModal(true)}
      />

      <RequestActivationModal
        isOpen={showActivationModal}
        onClose={() => setShowActivationModal(false)}
      />
    </div>
  );
};
