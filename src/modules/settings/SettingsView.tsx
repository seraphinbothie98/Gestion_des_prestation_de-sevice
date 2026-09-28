import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { isValidPhoneNumber } from '../../lib/phoneValidation';
import { Tabs } from '../../components/ui/Tabs';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { BrandingSettingsView } from './BrandingSettingsView';
import { SignaturesSettingsView } from './SignaturesSettingsView';
import { DataResetView } from '../maintenance/DataResetView';
import { Settings, Building, Save, RefreshCw, Layout, Award, MapPin, ShieldAlert, ShieldCheck } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { currentTenant, hasPermission } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const [activeTab, setActiveTab] = useState<'branding' | 'signatures' | 'general' | 'branches' | 'maintenance'>('branding');

  const [centreName, setCentreName] = useState(currentTenant?.name || '');
  const [centrePhone, setCentrePhone] = useState(currentTenant?.phone || '');
  const [centreEmail, setCentreEmail] = useState(currentTenant?.email || '');
  const [centreAddress, setCentreAddress] = useState(currentTenant?.address || '');
  const [centreCity, setCentreCity] = useState(currentTenant?.city || 'Conakry');
  const [companyHeader, setCompanyHeader] = useState(currentTenant?.settings?.companyHeader || '');
  const [invoiceFooter, setInvoiceFooter] = useState(currentTenant?.settings?.invoiceFooter || '');

  // Synchronisation dynamique lors du changement d'agence active
  React.useEffect(() => {
    setCentreName(currentTenant?.name || '');
    setCentrePhone(currentTenant?.phone || '');
    setCentreEmail(currentTenant?.email || '');
    setCentreAddress(currentTenant?.address || '');
    setCentreCity(currentTenant?.city || 'Conakry');
    setCompanyHeader(currentTenant?.settings?.companyHeader || '');
    setInvoiceFooter(currentTenant?.settings?.invoiceFooter || '');
  }, [currentTenant?.id, currentTenant?.name, currentTenant?.phone, currentTenant?.email, currentTenant?.address, currentTenant?.city]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    if (centrePhone.trim() && !isValidPhoneNumber(centrePhone, { allowEmpty: true })) {
      showToast('Erreur Téléphone', 'Le numéro de téléphone officiel est invalide (lettres ou caractères interdits).', 'DANGER');
      return;
    }
    dbStore.updateState(draft => {
      const tenant = draft.tenants.find(t => t.id === currentTenant?.id);
      if (tenant) {
        tenant.name = centreName;
        tenant.phone = centrePhone;
        tenant.email = centreEmail;
        tenant.address = centreAddress;
        tenant.city = centreCity;
        tenant.settings = {
          ...tenant.settings,
          companyHeader,
          invoiceFooter,
        };
      }
    });

    dbStore.logAudit('SETTINGS_UPDATED', 'TENANT', currentTenant?.id, null, { centreName, centreCity });
    showToast('Paramètres Enregistrés', 'Les informations du centre et la ville ont été mises à jour.', 'SUCCESS');
  };

  const handleResetDemoData = () => {
    if (confirm('Attention : Voulez-vous réinitialiser toutes les données aux valeurs de démonstration initiales ?')) {
      dbStore.resetToDefault();
      showToast('Données réinitialisées', 'Jeu de données de démonstration réinitialisé.', 'INFO');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand-500" />
            Administration & Configuration du Centre
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Personnalisation de l'identité visuelle, signatures & cachet officiel, coordonnées légales, ville, catégories et maintenance système.
          </p>
        </div>
        <Button variant="outline" icon={RefreshCw} onClick={handleResetDemoData}>
          Recharger Démo Seed
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'branding', label: 'Identité Visuelle & Logo', icon: Layout },
          { id: 'signatures', label: 'Signatures & Cachet Officiel', icon: ShieldCheck },
          { id: 'general', label: 'Paramètres Généraux', icon: Building },
          { id: 'branches', label: 'Agences & Annexes', icon: MapPin },
          { id: 'maintenance', label: 'Maintenance & Reset', icon: ShieldAlert },
        ]}
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as any)}
      />

      {/* TAB 1: IDENTITÉ VISUELLE */}
      {activeTab === 'branding' && <BrandingSettingsView key={currentTenant?.id} />}

      {/* TAB 2: SIGNATURES & CACHET OFFICIEL */}
      {activeTab === 'signatures' && <SignaturesSettingsView key={currentTenant?.id} />}

      {/* TAB 3: PARAMÈTRES GÉNÉRAUX */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <Card className="p-6 space-y-4">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building className="w-4 h-4 text-brand-500" />
                Coordonnées, Ville & Informations Légales
              </CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Raison sociale / Nom complet"
                value={centreName}
                onChange={(e) => setCentreName(e.target.value)}
                required
              />
              <PhoneInput
                label="Téléphone officiel"
                value={centrePhone}
                onChange={(e) => setCentrePhone(e.target.value)}
              />
              <Input
                label="Email de contact"
                type="email"
                value={centreEmail}
                onChange={(e) => setCentreEmail(e.target.value)}
              />
              <Input
                label="Adresse physique (Commune / Quartier)"
                value={centreAddress}
                onChange={(e) => setCentreAddress(e.target.value)}
              />
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  📍 Ville de la boutique / agence
                </label>
                <select
                  value={centreCity}
                  onChange={(e) => setCentreCity(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="Conakry">Conakry</option>
                  <option value="Kindia">Kindia</option>
                  <option value="Boké">Boké</option>
                  <option value="Mamou">Mamou</option>
                  <option value="Labé">Labé</option>
                  <option value="Kankan">Kankan</option>
                  <option value="N'Zérékoré">N'Zérékoré</option>
                  <option value="Siguiri">Siguiri</option>
                  <option value="Kissidougou">Kissidougou</option>
                  <option value="Coyah">Coyah</option>
                  <option value="Dubréka">Dubréka</option>
                  <option value="Autre ville">Autre ville</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tous vos produits sur le Marketplace afficheront automatiquement cette ville de disponibilité.
                </p>
              </div>
            </div>
            <Input
              label="En-tête fiscale (RCCM, NIF...)"
              value={companyHeader}
              onChange={(e) => setCompanyHeader(e.target.value)}
            />
            <Input
              label="Pied de page des documents"
              value={invoiceFooter}
              onChange={(e) => setInvoiceFooter(e.target.value)}
            />
          </Card>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" icon={Save}>
              Enregistrer les Paramètres
            </Button>
          </div>
        </form>
      )}


      {/* TAB 3: AGENCES */}
      {activeTab === 'branches' && (
        <Card className="p-6 space-y-4">
          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-500" />
              Agences et Annexes ({state.branches.length})
            </CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {state.branches.map(b => (
              <div key={b.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{b.name}</h4>
                  {b.isMain && <span className="text-[10px] bg-brand-100 text-brand-700 font-bold px-2 py-0.5 rounded-full">Siège Principal</span>}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{b.address}</p>
                <p className="text-[11px] text-slate-400">Tél : {b.phone} • Email : {b.email}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 5: MAINTENANCE & RÉINITIALISATION DES DONNÉES */}
      {activeTab === 'maintenance' && <DataResetView />}
    </div>
  );
};
