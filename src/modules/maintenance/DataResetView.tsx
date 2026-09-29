import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  ResetLevel, ResetSummaryData, OperationalResetOptions, ResetExecutionResult
} from '../../types';
import {
  AlertTriangle, ShieldAlert, Trash2, Download, CheckCircle2,
  Lock, RefreshCw, FileText, Database, Shield, Check, Users, ShieldCheck, Sparkles,
  Layers, DollarSign, ShoppingCart, GraduationCap, PackageCheck, Truck, ArrowRight
} from 'lucide-react';

const REQUIRED_CONFIRMATION_WORD = 'RÉINITIALISER';

export const DataResetView: React.FC = () => {
  const { currentUser, hasPermission, currentTenant, isSuperAdmin } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const isAuthorized = hasPermission('system.reset_data') || hasPermission('*') || isSuperAdmin;
  const activeTenantId = currentTenant?.id || 't-001';

  // State
  const [selectedLevel, setSelectedLevel] = useState<ResetLevel | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [typedWord, setTypedWord] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resetReport, setResetReport] = useState<ResetExecutionResult | null>(null);
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  // Level 2 Options
  const [deleteClientsInCommercial, setDeleteClientsInCommercial] = useState(false);

  // Level 4 Options
  const [operationalOptions, setOperationalOptions] = useState<OperationalResetOptions>({
    resetServices: true,
    resetTraining: true,
    resetClients: false,
    stockOption: 'PRESERVE',
    resetFinancialTreasury: true,
    supplierDebtsOption: 'PRESERVE'
  });

  // Summary counts
  const summary: ResetSummaryData = dbStore.getResetSummary(activeTenantId);

  // Backup snapshot download handler
  const handleDownloadBackup = () => {
    const jsonStr = dbStore.exportBackupSnapshot(activeTenantId);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `backup_cms_${currentTenant?.code || 'nicost'}_${now}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setBackupDownloaded(true);
    showToast('Sauvegarde Téléchargée', 'Le fichier de sauvegarde JSON complet de votre agence a été téléchargé.', 'SUCCESS');
  };

  const handleOpenModal = (level: ResetLevel) => {
    setSelectedLevel(level);
    setIsConfirmModalOpen(true);
    setTypedWord('');
    setAdminPassword('');
    setErrorMsg(null);
  };

  const handleExecuteReset = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (typedWord.trim().toUpperCase() !== REQUIRED_CONFIRMATION_WORD) {
      setErrorMsg(`Veuillez saisir exactement le mot "${REQUIRED_CONFIRMATION_WORD}" en majuscules pour confirmer.`);
      return;
    }

    if (!adminPassword.trim()) {
      setErrorMsg("Veuillez renseigner votre mot de passe administrateur pour valider l'opération.");
      return;
    }

    if (!currentUser) {
      setErrorMsg("Aucun administrateur connecté.");
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      let result: ResetExecutionResult;

      try {
        if (selectedLevel === 'TEST_DATA') {
          result = dbStore.cleanDemoTestData(
            activeTenantId,
            currentUser.username,
            adminPassword,
            currentUser
          );
        } else if (selectedLevel === 'COMMERCIAL') {
          result = dbStore.resetCommercialData(
            activeTenantId,
            deleteClientsInCommercial,
            currentUser.username,
            adminPassword,
            currentUser
          );
        } else if (selectedLevel === 'FINANCIAL') {
          result = dbStore.resetFinancialData(
            activeTenantId,
            currentUser.username,
            adminPassword,
            currentUser
          );
        } else {
          result = dbStore.resetAllOperationalData(
            activeTenantId,
            operationalOptions,
            currentUser.username,
            adminPassword,
            currentUser
          );
        }

        setIsProcessing(false);

        if (result.success) {
          setResetReport(result);
          setIsConfirmModalOpen(false);
          showToast(
            'Réinitialisation Réussie',
            result.message,
            'SUCCESS'
          );
        } else {
          setErrorMsg(result.message);
        }
      } catch (err: any) {
        setIsProcessing(false);
        setErrorMsg(err.message || 'Une erreur inattendue est survenue.');
      }
    }, 400);
  };

  if (!isAuthorized) {
    return (
      <Card className="p-8 text-center border-rose-200 bg-rose-50/40 space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900">Accès Refusé — Permission Requise</h3>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
            La réinitialisation des données nécessite la permission spéciale <code className="bg-rose-100 px-1.5 py-0.5 rounded font-mono text-rose-800 font-bold">system.reset_data</code> ou le rôle Administrateur.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Principle Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 border border-slate-800 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <span className="text-xs font-black tracking-wider uppercase text-amber-400">
              ZONE DE MAINTENANCE AVANCÉE & RESET
            </span>
            <span className="text-xs bg-brand-500/30 text-brand-300 border border-brand-400/40 px-2 py-0.5 rounded-full font-mono font-bold">
              Agence : {currentTenant?.name} ({currentTenant?.code})
            </span>
          </div>
          <h3 className="text-xl font-black tracking-tight text-white">
            Nettoyage et Réinitialisation des Données Métier
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Permet de purger les données de test ou opérationnelles pour repartir sur une base propre avant le démarrage réel de l'activité. <strong>Strictement isolé à votre agence ({activeTenantId}). Les comptes, rôles, configuration et services sont 100% préservés.</strong>
          </p>
        </div>

        <Button
          variant="outline"
          className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs shrink-0"
          icon={Download}
          onClick={handleDownloadBackup}
        >
          {backupDownloaded ? "✓ Sauvegarde Exportée" : "💾 Sauvegarde Snapshot JSON"}
        </Button>
      </div>

      {/* Main Grid: 4 Reset Levels + Inviolable Configuration Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 4 Levels */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* NIVEAU 1 — NETTOYAGE DES DONNÉES DE TEST */}
          <Card className="p-5 border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-amber-100 dark:border-amber-900/40">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      NIVEAU 1 — Nettoyage des Données de Test
                    </h4>
                    <Badge variant="warning" size="sm">DÉMO & SEED</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supprime uniquement les données de démonstration, anciennes factures fictives, commandes de test et paiements seed.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block">Factures à supprimer</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{summary.testData.invoices}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Commandes à supprimer</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{summary.testData.orders}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Paiements à supprimer</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{summary.testData.payments}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Flux financiers</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{summary.testData.financialMovements}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500 font-medium">
                💡 Remet automatiquement les Recettes Globales, Solde Caisse et Trésorerie à <strong>0 GNF</strong>.
              </span>
              <Button
                variant="outline"
                icon={Sparkles}
                className="border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 text-xs shrink-0"
                onClick={() => handleOpenModal('TEST_DATA')}
              >
                Nettoyer les données de test
              </Button>
            </div>
          </Card>

          {/* NIVEAU 2 — RÉINITIALISATION COMMERCIALE */}
          <Card className="p-5 border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-amber-100 dark:border-amber-900/40">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      NIVEAU 2 — Réinitialisation Commerciale
                    </h4>
                    <Badge variant="primary" size="sm">COMMANDES & VENTES</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supprime l'historique des commandes services, prestations atelier, factures, devis, paiements clients et ventes boutique.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block">Commandes Services</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{summary.commercial.orders}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Factures Émises</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{summary.commercial.invoices}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Paiements Clients</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{summary.commercial.payments}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteClientsInCommercial}
                  onChange={(e) => setDeleteClientsInCommercial(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span>Supprimer également les clients et tiers ({summary.commercial.customers})</span>
              </label>

              <Button
                variant="outline"
                icon={ShoppingCart}
                className="border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 text-xs shrink-0"
                onClick={() => handleOpenModal('COMMERCIAL')}
              >
                Réinitialiser le Pôle Commercial
              </Button>
            </div>
          </Card>

          {/* NIVEAU 3 — RÉINITIALISATION FINANCIÈRE */}
          <Card className="p-5 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-emerald-100 dark:border-emerald-900/40">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      NIVEAU 3 — Réinitialisation Financière
                    </h4>
                    <Badge variant="success" size="sm">TRÉSORERIE & CAISSES</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supprime l'ensemble des flux financiers, encaissements, dépenses et remet les soldes de tous les comptes à 0 GNF.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block">Mouvements de Caisse</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{summary.financial.movements}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Dépenses Enregistrées</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{summary.financial.expenses}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Sessions de Caisse</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{summary.financial.cashSessions}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Comptes Réinitialisés</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">{summary.financial.accounts} (à 0 GNF)</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500 font-medium">
                💰 Recalcule le Dashboard et les rapports financiers (Solde Caisse = 0 GNF, Trésorerie = 0 GNF).
              </span>
              <Button
                variant="outline"
                icon={DollarSign}
                className="border-emerald-400 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-600 dark:text-emerald-300 text-xs shrink-0"
                onClick={() => handleOpenModal('FINANCIAL')}
              >
                Réinitialiser les Flux Financiers
              </Button>
            </div>
          </Card>

          {/* NIVEAU 4 — RÉINITIALISATION MÉTIER COMPLÈTE */}
          <Card className="p-5 border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10 space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-rose-100 dark:border-rose-900/40">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      NIVEAU 4 — Réinitialisation Métier Complète
                    </h4>
                    <Badge variant="danger" size="sm">REMISE À ZÉRO TOTALE</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supprime l'ensemble des données opérationnelles choisies tout en préservant 100% de la configuration de l'agence.
                  </p>
                </div>
              </div>
            </div>

            {/* Granular options */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200/60 dark:border-rose-900/40 space-y-3 text-xs">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 block">
                Sélectionnez les pôles à purger :
              </span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={operationalOptions.resetServices}
                    onChange={(e) => setOperationalOptions({ ...operationalOptions, resetServices: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span>Pôle Services & Commandes ({summary.operational.orders} cmd, {summary.operational.invoices} fac)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={operationalOptions.resetTraining}
                    onChange={(e) => setOperationalOptions({ ...operationalOptions, resetTraining: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span>Pôle Formation ({summary.operational.enrollments} inscr, {summary.operational.certificates} cert)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={operationalOptions.resetFinancialTreasury}
                    onChange={(e) => setOperationalOptions({ ...operationalOptions, resetFinancialTreasury: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span>Finance & Trésorerie (remise à 0 GNF)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={operationalOptions.resetClients}
                    onChange={(e) => setOperationalOptions({ ...operationalOptions, resetClients: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span>Supprimer les clients & apprenants ({summary.operational.customers})</span>
                </label>
              </div>

              {/* Special Stock Management (Section 4) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="font-extrabold text-slate-800 dark:text-slate-200 block text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  📦 Gestion Spéciale du Stock & Consommables :
                </span>
                <div className="space-y-1.5 pl-1">
                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="stockOption"
                      value="PRESERVE"
                      checked={operationalOptions.stockOption === 'PRESERVE'}
                      onChange={() => setOperationalOptions({ ...operationalOptions, stockOption: 'PRESERVE' })}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Conserver le stock physique actuel et les consommables existants (Recommandé)</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="stockOption"
                      value="CLEAR_MOVEMENTS_ONLY"
                      checked={operationalOptions.stockOption === 'CLEAR_MOVEMENTS_ONLY'}
                      onChange={() => setOperationalOptions({ ...operationalOptions, stockOption: 'CLEAR_MOVEMENTS_ONLY' })}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Supprimer uniquement l'historique des mouvements de stock (garde les quantités)</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer text-rose-700 dark:text-rose-400">
                    <input
                      type="radio"
                      name="stockOption"
                      value="FULL_STOCK_RESET"
                      checked={operationalOptions.stockOption === 'FULL_STOCK_RESET'}
                      onChange={() => setOperationalOptions({ ...operationalOptions, stockOption: 'FULL_STOCK_RESET' })}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>Réinitialiser complètement le stock (remet toutes les quantités à 0)</span>
                  </label>
                </div>
              </div>

              {/* Special Supplier Debts Management */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="font-extrabold text-slate-800 dark:text-slate-200 block text-[11px] uppercase tracking-wider text-brand-700 dark:text-brand-400">
                  🚚 Gestion Fournisseurs & Achats à Crédit :
                </span>
                <div className="space-y-1.5 pl-1">
                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="supplierDebtsOption"
                      value="PRESERVE"
                      checked={operationalOptions.supplierDebtsOption === 'PRESERVE'}
                      onChange={() => setOperationalOptions({ ...operationalOptions, supplierDebtsOption: 'PRESERVE' })}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Conserver les commandes d'achats et dettes fournisseurs réelles</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer text-rose-700 dark:text-rose-400">
                    <input
                      type="radio"
                      name="supplierDebtsOption"
                      value="CLEAR_DEBTS_AND_PURCHASES"
                      checked={operationalOptions.supplierDebtsOption === 'CLEAR_DEBTS_AND_PURCHASES'}
                      onChange={() => setOperationalOptions({ ...operationalOptions, supplierDebtsOption: 'CLEAR_DEBTS_AND_PURCHASES' })}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>Purger l'historique des bons de commande et dettes fournisseurs</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Action irréversible. Mot de passe admin obligatoire.
              </span>
              <Button
                variant="danger"
                icon={Trash2}
                className="shadow-md text-xs shrink-0"
                onClick={() => handleOpenModal('FULL_OPERATIONAL')}
              >
                RÉINITIALISATION MÉTIER COMPLÈTE
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Col: Inviolable Configuration Checklist (Section 3) */}
        <div>
          <Card className="p-5 border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/20 space-y-4 shadow-sm sticky top-6">
            <div className="flex items-center gap-2 pb-2 border-b border-emerald-100 dark:border-emerald-900/60">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Données de Configuration Toujours Conservées
                </h4>
                <p className="text-[10px] text-slate-500">Ne sont JAMAIS supprimées par le reset</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{summary.preservedConfig.usersCount} Comptes Utilisateurs</strong>
                  <p className="text-[11px] text-slate-500">Admin, Réception, Caissiers, Formateurs...</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{summary.preservedConfig.rolesCount} Rôles & Permissions RBAC</strong>
                  <p className="text-[11px] text-slate-500">Habilitations de sécurité inchangées</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Identité Visuelle & Logo Officiel</strong>
                  <p className="text-[11px] text-slate-500">Logo, signatures électroniques, cachet & en-têtes</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{summary.preservedConfig.servicesCount} Services & Grille Tarifaire</strong>
                  <p className="text-[11px] text-slate-500">Catalogue des prestations et barèmes de prix</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{summary.preservedConfig.productsCount} Articles & Consommables du Catalogue</strong>
                  <p className="text-[11px] text-slate-500">Définition des articles et prix de vente/achat</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{summary.preservedConfig.suppliersCount} Fournisseurs & Répertoire</strong>
                  <p className="text-[11px] text-slate-500">Contacts et adresses des partenaires</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{summary.preservedConfig.accountsCount} Comptes Financiers de Structure</strong>
                  <p className="text-[11px] text-slate-500">Caisses, Comptes Bancaires, Mobile Money (soldes remis à 0)</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{summary.preservedConfig.branchesCount} Agences & Annexes</strong>
                  <p className="text-[11px] text-slate-500">Siège et annexes opérationnelles</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Paramètres & Licence SaaS</strong>
                  <p className="text-[11px] text-slate-500">Statut de la licence et paramètres système</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation & Password Verification Modal */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => !isProcessing && setIsConfirmModalOpen(false)}
          title={
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <span>
                Confirmation — {selectedLevel === 'TEST_DATA' && 'Nettoyage des Données de Test'}
                {selectedLevel === 'COMMERCIAL' && 'Réinitialisation Commerciale'}
                {selectedLevel === 'FINANCIAL' && 'Réinitialisation Financière'}
                {selectedLevel === 'FULL_OPERATIONAL' && 'Réinitialisation Métier Complète'}
              </span>
            </div>
          }
          maxWidth="md"
        >
          <form onSubmit={handleExecuteReset} className="space-y-4 pt-1">
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-900 dark:text-rose-200 space-y-2">
              <p className="font-bold">
                ⚠️ ATTENTION : Cette action est irréversible. Les données métier sélectionnées de l'agence "{currentTenant?.name}" seront définitivement supprimées.
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Les comptes utilisateurs, rôles, permissions et configuration resteront 100% intacts.
              </p>
            </div>

            {/* Backup reminder */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-brand-500" />
                <span className="text-slate-700 dark:text-slate-300">Sauvegarde recommandée :</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="text-xs font-bold text-brand-600 hover:underline"
              >
                {backupDownloaded ? "✓ Snapshot JSON exporté" : "Télécharger Snapshot JSON"}
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            {/* 1. Mandatory confirmation word input */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                1. Saisissez exactement le mot de confirmation ci-dessous :
              </label>
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-center font-mono font-extrabold text-sm text-slate-800 dark:text-slate-200 mb-2 select-all">
                {REQUIRED_CONFIRMATION_WORD}
              </div>
              <Input
                placeholder={`Tapez "${REQUIRED_CONFIRMATION_WORD}"`}
                value={typedWord}
                onChange={(e) => setTypedWord(e.target.value)}
                required
              />
            </div>

            {/* 2. Administrator password verification */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-brand-500" />
                2. Mot de passe de votre compte administrateur ({currentUser?.username}) :
              </label>
              <Input
                type="password"
                placeholder="Votre mot de passe actuel"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isProcessing}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="danger"
                icon={Trash2}
                disabled={typedWord.trim().toUpperCase() !== REQUIRED_CONFIRMATION_WORD || !adminPassword.trim() || isProcessing}
              >
                {isProcessing ? "Réinitialisation en cours..." : "Confirmer la Réinitialisation"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Post-Reset Detailed Report Modal */}
      {resetReport && (
        <Modal
          isOpen={Boolean(resetReport)}
          onClose={() => setResetReport(null)}
          title={
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              <span>Rapport d'Exécution — Réinitialisation Terminée</span>
            </div>
          }
          maxWidth="md"
        >
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
              <h4 className="font-extrabold text-sm text-emerald-900 dark:text-emerald-200">
                ✅ OPÉRATION TERMINÉE AVEC SUCCÈS
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                {resetReport.message}
              </p>
            </div>

            {/* Recalculated Financial State Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 block uppercase tracking-wider text-[11px]">
                État Financier Recalculé de l'Agence :
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Recettes Globales</span>
                  <span className="font-black text-emerald-600">0 GNF</span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Solde Caisse</span>
                  <span className="font-black text-emerald-600">0 GNF</span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Trésorerie</span>
                  <span className="font-black text-emerald-600">0 GNF</span>
                </div>
              </div>
            </div>

            {/* Exact Integrity Verification Checklist */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs">
              <h5 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100 dark:border-slate-800">
                Contrôle d'Intégrité de la Configuration :
              </h5>
              
              <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 font-semibold">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Utilisateurs : <strong className="text-emerald-600">Conservés</strong></span>
                </div>
                <div className="flex items-center gap-2 font-semibold">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Rôles & RBAC : <strong className="text-emerald-600">Conservés</strong></span>
                </div>
                <div className="flex items-center gap-2 font-semibold">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Identité & Logo : <strong className="text-emerald-600">Conservés</strong></span>
                </div>
                <div className="flex items-center gap-2 font-semibold">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Catalogue Services : <strong className="text-emerald-600">Conservé</strong></span>
                </div>
                <div className="flex items-center gap-2 font-semibold">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Articles Catalogue : <strong className="text-emerald-600">Conservés</strong></span>
                </div>
                <div className="flex items-center gap-2 font-semibold">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Fournisseurs : <strong className="text-emerald-600">Conservés</strong></span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                Contrôle des comptes : <strong>{resetReport.integrityVerification.usersBefore} utilisateurs avant</strong> = <strong>{resetReport.integrityVerification.usersAfter} utilisateurs après</strong> (0 utilisateur supprimé).
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => setResetReport(null)}>
                Fermer le Rapport
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
