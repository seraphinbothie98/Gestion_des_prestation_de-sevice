import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { isValidPhoneNumber } from '../../lib/phoneValidation';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { BrandingConfig } from '../../types';
import {
  Image, Upload, Trash2, Eye, Layout, Type,
  FileText, Check, Sparkles, Building, Globe, Phone, Mail, MapPin, Save
} from 'lucide-react';

export const BrandingSettingsView: React.FC = () => {
  const { currentTenant } = useAuth();
  const { showToast } = useNotification();

  const defaultBranding: BrandingConfig = {
    logoUrl: currentTenant?.settings?.branding?.logoUrl || "/nicost-logo.png",
    logoPosition: currentTenant?.settings?.branding?.logoPosition || 'center',
    logoSize: currentTenant?.settings?.branding?.logoSize || 'md',
    showLogo: currentTenant?.settings?.branding?.showLogo ?? true,
    slogan: currentTenant?.settings?.branding?.slogan || "Informatique, Developpement & Installation Reseaux",
    website: currentTenant?.settings?.branding?.website || "https://www.nicost-guinee.com",
    headerAlignment: currentTenant?.settings?.branding?.headerAlignment || 'center',
    showPhone: currentTenant?.settings?.branding?.showPhone ?? true,
    showEmail: currentTenant?.settings?.branding?.showEmail ?? true,
    showAddress: currentTenant?.settings?.branding?.showAddress ?? true,
    showWebsite: currentTenant?.settings?.branding?.showWebsite ?? true,
    footerText: currentTenant?.settings?.branding?.footerText || "NICOST • Nimba Consulting & Supports Technologique • Kindia-Republique de Guinée",
    footerAlignment: currentTenant?.settings?.branding?.footerAlignment || 'center',
    showFooter: currentTenant?.settings?.branding?.showFooter ?? true,
  };

  const [branding, setBranding] = useState<BrandingConfig>(defaultBranding);
  const [centreName, setCentreName] = useState(currentTenant?.name || '');
  const [centreAddress, setCentreAddress] = useState(currentTenant?.address || '');
  const [centrePhone, setCentrePhone] = useState(currentTenant?.phone || '');
  const [centreEmail, setCentreEmail] = useState(currentTenant?.email || '');

  React.useEffect(() => {
    setBranding({
      logoUrl: currentTenant?.settings?.branding?.logoUrl || currentTenant?.logoUrl || "/nicost-logo.png",
      logoPosition: currentTenant?.settings?.branding?.logoPosition || 'center',
      logoSize: currentTenant?.settings?.branding?.logoSize || 'md',
      showLogo: currentTenant?.settings?.branding?.showLogo ?? true,
      slogan: currentTenant?.settings?.branding?.slogan || currentTenant?.slogan || "Informatique, Developpement & Installation Reseaux",
      website: currentTenant?.settings?.branding?.website || currentTenant?.website || "https://www.nicost-guinee.com",
      headerAlignment: currentTenant?.settings?.branding?.headerAlignment || 'center',
      showPhone: currentTenant?.settings?.branding?.showPhone ?? true,
      showEmail: currentTenant?.settings?.branding?.showEmail ?? true,
      showAddress: currentTenant?.settings?.branding?.showAddress ?? true,
      showWebsite: currentTenant?.settings?.branding?.showWebsite ?? true,
      footerText: currentTenant?.settings?.branding?.footerText || currentTenant?.footerText || "NICOST • Nimba Consulting & Supports Technologique • Kindia-Republique de Guinée",
      footerAlignment: currentTenant?.settings?.branding?.footerAlignment || 'center',
      showFooter: currentTenant?.settings?.branding?.showFooter ?? true,
    });
    setCentreName(currentTenant?.name || '');
    setCentreAddress(currentTenant?.address || '');
    setCentrePhone(currentTenant?.phone || '');
    setCentreEmail(currentTenant?.email || '');
  }, [currentTenant?.id, currentTenant?.name, currentTenant?.address, currentTenant?.phone, currentTenant?.email, currentTenant?.logoUrl]);

  // File Upload Handler (Base64 data URL)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check format
    const validFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validFormats.includes(file.type)) {
      showToast('Format Invalide', 'Formats acceptés : PNG, JPG, JPEG, SVG, WebP.', 'DANGER');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setBranding(prev => ({
          ...prev,
          logoUrl: event.target?.result as string,
          showLogo: true,
        }));
        showToast('Logo Téléversé', 'Le logo a été mis à jour dans la configuration.', 'SUCCESS');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();

    if (centrePhone.trim() && !isValidPhoneNumber(centrePhone, { allowEmpty: true })) {
      showToast('Erreur Téléphone', 'Le numéro de téléphone est invalide (lettres ou caractères interdits).', 'DANGER');
      return;
    }

    dbStore.updateState(draft => {
      const tenant = draft.tenants.find(t => t.id === currentTenant?.id);
      if (tenant) {
        tenant.name = centreName;
        tenant.address = centreAddress;
        tenant.phone = centrePhone;
        tenant.email = centreEmail;
        tenant.logoUrl = branding.logoUrl;
        tenant.settings = {
          ...tenant.settings,
          branding: { ...branding }
        };
      }
    });

    dbStore.logAudit('BRANDING_UPDATED', 'TENANT', currentTenant?.id, null, {
      logoUrl: branding.logoUrl,
      slogan: branding.slogan
    });

    showToast('Identité Visuelle Enregistrée', 'Les paramètres visuels ont été appliqués à l\'ensemble des documents du centre.', 'SUCCESS');
  };

  const getLogoSizeClass = () => {
    switch (branding.logoSize) {
      case 'sm': return 'h-10 w-auto';
      case 'lg': return 'h-24 w-auto';
      default: return 'h-16 w-auto';
    }
  };

  const getAlignmentClass = (align: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'left': return 'text-left items-start';
      case 'right': return 'text-right items-end';
      default: return 'text-center items-center';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Layout className="w-5 h-5 text-brand-500" />
            Personnalisation de l'Identité Visuelle & Maquettes Officielles
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configurez le logo, l'en-tête et le pied de page appliqués automatiquement sur vos factures, devis, reçus et certificats.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration Forms (7 cols) */}
        <form onSubmit={handleSaveBranding} className="lg:col-span-6 space-y-5">
          {/* SECTION 1: LOGO */}
          <Card className="p-5 space-y-4">
            <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider flex items-center gap-2">
                <Image className="w-4 h-4 text-brand-500" />
                1. Gestion du Logo Officiel
              </CardTitle>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showLogoCheck"
                  checked={branding.showLogo}
                  onChange={(e) => setBranding({ ...branding, showLogo: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <label htmlFor="showLogoCheck" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Afficher le logo
                </label>
              </div>
            </CardHeader>

            {/* Logo Preview & Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-24 h-24 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner p-2">
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt="Logo Aperçu"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Image className="w-8 h-8 text-slate-300" />
                )}
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {branding.logoUrl ? "Logo configuré" : "Aucun logo chargé"}
                </span>
                <p className="text-[11px] text-slate-500">
                  Formats supportés : PNG, JPG, JPEG, SVG, WebP.
                </p>
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors">
                      <Upload className="w-3.5 h-3.5" /> Téléverser un Fichier
                    </span>
                  </label>

                  {branding.logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-rose-600 hover:bg-rose-50"
                      onClick={() => setBranding({ ...branding, logoUrl: undefined })}
                    >
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Positionnement du Logo"
                value={branding.logoPosition}
                onChange={(e) => setBranding({ ...branding, logoPosition: e.target.value as any })}
                options={[
                  { value: 'left', label: 'Aligné à Gauche' },
                  { value: 'center', label: 'Centré au Milieu' },
                  { value: 'right', label: 'Aligné à Droite' },
                ]}
              />
              <Select
                label="Taille d'Affichage"
                value={branding.logoSize}
                onChange={(e) => setBranding({ ...branding, logoSize: e.target.value as any })}
                options={[
                  { value: 'sm', label: 'Compact (Petit)' },
                  { value: 'md', label: 'Standard (Moyen)' },
                  { value: 'lg', label: 'Imposant (Grand)' },
                ]}
              />
            </div>
          </Card>

          {/* SECTION 2: EN-TÊTE */}
          <Card className="p-5 space-y-4">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-xs uppercase tracking-wider flex items-center gap-2">
                <Type className="w-4 h-4 text-brand-500" />
                2. Configuration de l'En-tête de Document
              </CardTitle>
            </CardHeader>

            <Input
              label="Nom officiel du Centre"
              value={centreName}
              onChange={(e) => setCentreName(e.target.value)}
              required
            />

            <Input
              label="Slogan / Devise d'Excellence"
              placeholder="ex: Informatique, Developpement & Installation Reseaux"
              value={branding.slogan || ''}
              onChange={(e) => setBranding({ ...branding, slogan: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Adresse Physique"
                value={centreAddress}
                onChange={(e) => setCentreAddress(e.target.value)}
              />
              <PhoneInput
                label="Numéro de Téléphone"
                value={centrePhone}
                onChange={(e) => setCentrePhone(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Adresse Email"
                value={centreEmail}
                onChange={(e) => setCentreEmail(e.target.value)}
              />
              <Input
                label="Site Web Officiel"
                value={branding.website || ''}
                onChange={(e) => setBranding({ ...branding, website: e.target.value })}
              />
            </div>

            <Select
              label="Alignement Global de l'En-tête"
              value={branding.headerAlignment}
              onChange={(e) => setBranding({ ...branding, headerAlignment: e.target.value as any })}
              options={[
                { value: 'left', label: 'Aligné à Gauche' },
                { value: 'center', label: 'Centré' },
                { value: 'right', label: 'Aligné à Droite' },
              ]}
            />

            {/* Elements toggles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={branding.showPhone}
                  onChange={(e) => setBranding({ ...branding, showPhone: e.target.checked })}
                  className="rounded text-brand-600"
                />
                Téléphone
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={branding.showEmail}
                  onChange={(e) => setBranding({ ...branding, showEmail: e.target.checked })}
                  className="rounded text-brand-600"
                />
                Email
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={branding.showAddress}
                  onChange={(e) => setBranding({ ...branding, showAddress: e.target.checked })}
                  className="rounded text-brand-600"
                />
                Adresse
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={branding.showWebsite}
                  onChange={(e) => setBranding({ ...branding, showWebsite: e.target.checked })}
                  className="rounded text-brand-600"
                />
                Site Web
              </label>
            </div>
          </Card>

          {/* SECTION 3: PIED DE PAGE */}
          <Card className="p-5 space-y-4">
            <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-500" />
                3. Configuration du Pied de Page
              </CardTitle>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showFooterCheck"
                  checked={branding.showFooter}
                  onChange={(e) => setBranding({ ...branding, showFooter: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <label htmlFor="showFooterCheck" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Afficher le pied de page
                </label>
              </div>
            </CardHeader>

            <Input
              label="Mentions légales & Texte personnalisé de bas de page"
              value={branding.footerText || ''}
              onChange={(e) => setBranding({ ...branding, footerText: e.target.value })}
            />

            <Select
              label="Alignement du Pied de Page"
              value={branding.footerAlignment}
              onChange={(e) => setBranding({ ...branding, footerAlignment: e.target.value as any })}
              options={[
                { value: 'left', label: 'Aligné à Gauche' },
                { value: 'center', label: 'Centré' },
                { value: 'right', label: 'Aligné à Droite' },
              ]}
            />
          </Card>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" icon={Save} size="lg">
              Enregistrer l'Identité Visuelle
            </Button>
          </div>
        </form>

        {/* Right Column: Live Visual Preview of Official Document (5 cols) */}
        <div className="lg:col-span-6 space-y-3 sticky top-20">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-brand-500" />
              Aperçu Visuel en Temps Réel du Document
            </h4>
            <Badge variant="purple" size="sm">Rendu Document A4 Type</Badge>
          </div>

          {/* Paper Sheet Preview */}
          <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-300 shadow-xl min-h-[580px] flex flex-col justify-between text-xs space-y-6">
            {/* DOCUMENT HEADER */}
            <div className={`border-b-2 border-slate-900 pb-5 flex flex-col ${getAlignmentClass(branding.headerAlignment)}`}>
              {/* Logo with configured position & size */}
              {branding.showLogo && branding.logoUrl && (
                <div className={`mb-3 flex w-full ${
                  branding.logoPosition === 'left'
                    ? 'justify-start'
                    : branding.logoPosition === 'right'
                    ? 'justify-end'
                    : 'justify-center'
                }`}>
                  <img
                    src={branding.logoUrl}
                    alt="Logo"
                    className={`${getLogoSizeClass()} object-contain rounded-lg`}
                  />
                </div>
              )}

              <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                {centreName || "CENTRE MANAGEMENT SYSTEM"}
              </h2>

              {branding.slogan && (
                <p className="text-xs font-semibold text-brand-600 italic mt-0.5">
                  {branding.slogan}
                </p>
              )}

              {/* Contact info row */}
              <div className={`flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 mt-2 ${
                branding.headerAlignment === 'left' ? 'justify-start' : branding.headerAlignment === 'right' ? 'justify-end' : 'justify-center'
              }`}>
                {branding.showAddress && centreAddress && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{centreAddress}</span>
                )}
                {branding.showPhone && centrePhone && (
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />{centrePhone}</span>
                )}
                {branding.showEmail && centreEmail && (
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" />{centreEmail}</span>
                )}
                {branding.showWebsite && branding.website && (
                  <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-slate-400" />{branding.website}</span>
                )}
              </div>
            </div>

            {/* DOCUMENT BODY SAMPLE */}
            <div className="flex-1 space-y-4 py-2 opacity-90">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Exemple de Document :</span>
                  <p className="font-extrabold text-sm text-slate-900 font-mono">FACTURE N° FAC-2026-000042</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Date d'émission</span>
                  <span className="font-bold text-slate-700">29 Août 2026</span>
                </div>
              </div>

              {/* Sample Table */}
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="p-2 font-bold text-slate-700">Désignation Prestation</th>
                    <th className="p-2 text-center font-bold text-slate-700">Qté</th>
                    <th className="p-2 text-right font-bold text-slate-700">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-2 font-medium">Photocopie & Impression Documents A4</td>
                    <td className="p-2 text-center">150</td>
                    <td className="p-2 text-right font-semibold">75 000 GNF</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">Reliure Spirale Anneaux Plastiques</td>
                    <td className="p-2 text-center">3</td>
                    <td className="p-2 text-right font-semibold">45 000 GNF</td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-end pt-2">
                <div className="w-48 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-right space-y-1">
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>Total HT :</span>
                    <span>120 000 GNF</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-xs text-brand-600 border-t border-slate-200 pt-1">
                    <span>NET À PAYER :</span>
                    <span>120 000 GNF</span>
                  </div>
                </div>
              </div>
            </div>

            {/* DOCUMENT FOOTER */}
            {branding.showFooter && (
              <div className={`border-t-2 border-slate-200 pt-3 text-[10px] text-slate-500 space-y-0.5 ${getAlignmentClass(branding.footerAlignment)}`}>
                <p className="font-semibold text-slate-700">{branding.footerText}</p>
                <p className="text-slate-400">Généré automatiquement par Centre Management System (CMS).</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
