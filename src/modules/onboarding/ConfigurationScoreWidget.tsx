import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import {
  Sparkles, CheckCircle2, Circle, ArrowRight, Settings,
  Building2, FolderTree, Package, Boxes, Users, Image as ImageIcon
} from 'lucide-react';

interface ConfigurationScoreWidgetProps {
  onOpenWizard: () => void;
}

export const ConfigurationScoreWidget: React.FC<ConfigurationScoreWidgetProps> = ({
  onOpenWizard
}) => {
  const { currentTenant } = useAuth();
  if (!currentTenant) return null;

  const scoreData = dbStore.getTenantOnboardingScore(currentTenant.id);
  const { score, completedItems, pendingItems, details } = scoreData;

  // Si le niveau de configuration atteint 100%, la section se masque automatiquement
  if (score >= 100) {
    return null;
  }

  const isComplete = score >= 100;

  return (
    <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-brand-900/10 via-emerald-900/5 to-white dark:to-slate-900 border-brand-200/80 dark:border-brand-900/60 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left info & progress */}
        <div className="space-y-3 flex-1">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-brand-600 text-white shadow-md shadow-brand-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Niveau de Configuration de l'Agence
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {currentTenant.name} ({currentTenant.activityType})
                </span>
              </div>
            </div>

            <Badge
              variant={isComplete ? 'success' : score >= 60 ? 'primary' : 'warning'}
              size="sm"
              className="font-black text-xs px-2.5 py-0.5"
            >
              {score}% Complété
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 rounded-full ${
                  isComplete
                    ? 'bg-emerald-500'
                    : score >= 60
                    ? 'bg-gradient-to-r from-brand-600 to-amber-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          {/* Checklist Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {details.hasAgencyInfo ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              )}
              <span className={details.hasAgencyInfo ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                1. Infos Agence
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {details.hasVisuals ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              )}
              <span className={details.hasVisuals ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                2. Visuels & Facture
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {details.hasTeam ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              )}
              <span className={details.hasTeam ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                3. Équipe & Accès
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {details.hasServices ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              )}
              <span className={details.hasServices ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                4. Services Activés
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {details.hasPricingRules ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              )}
              <span className={details.hasPricingRules ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                5. Règles Tarifs
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {details.hasTraining ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              )}
              <span className={details.hasTraining ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                6. Formation
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {details.hasShopStock ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              )}
              <span className={details.hasShopStock ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                7. Boutique & Stock
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {details.hasSuppliers ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              )}
              <span className={details.hasSuppliers ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                8. Fournisseurs
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {details.hasFinancialAccounts ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              )}
              <span className={details.hasFinancialAccounts ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                9. Trésorerie
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              {details.isFinalized ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              )}
              <span className={details.isFinalized ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                10. Exploitation
              </span>
            </div>
          </div>
        </div>

        {/* Right action button */}
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="primary"
            icon={ArrowRight}
            onClick={onOpenWizard}
            className="text-xs font-extrabold bg-brand-600 hover:bg-brand-700 whitespace-nowrap shadow-md"
          >
            {isComplete ? "Revoir la Configuration" : "Continuer la Configuration"}
          </Button>
        </div>
      </div>
    </Card>
  );
};
