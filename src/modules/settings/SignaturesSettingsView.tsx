import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { DigitalSignature, DocumentSignatureConfig, DocumentType, SignatureType } from '../../types';
import { formatDate } from '../../lib/utils';
import {
  Award, Upload, Trash2, Eye, ShieldCheck, Check, RefreshCw,
  FileText, Sparkles, AlertCircle, Layers, CheckCircle2,
  FileCheck2, Sliders, History, Power, UserCheck
} from 'lucide-react';

const DOCUMENT_LABELS: Record<DocumentType, { label: string; icon: string; desc: string }> = {
  INVOICE: { label: 'Facture Officielle', icon: '🧾', desc: 'Factures de vente et prestations délivrées aux clients' },
  RECEIPT: { label: 'Reçu de Paiement & Caisse', icon: '💳', desc: 'Bons de caisse et reçus d\'encaissement' },
  QUOTE: { label: 'Devis Estimatif & Proforma', icon: '📑', desc: 'Offres commerciales et devis de prestations' },
  CERTIFICATE: { label: 'Certificat de Formation', icon: '🎓', desc: 'Diplômes et certificats finaux avec QR code' },
  ATTESTATION: { label: 'Attestation de Présence / Réussite', icon: '📜', desc: 'Attestations de participation aux modules' },
  ATTENDANCE_SHEET: { label: 'Feuille d\'Émargement', icon: '📋', desc: 'Fiches de présence journalières de formation' },
};

export const SignaturesSettingsView: React.FC = () => {
  const { currentTenant, currentUser, hasPermission } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const isPrestationAgency = currentTenant?.activityType === 'SERVICE_CENTER';
  const [activeTab, setActiveTab] = useState<'director' | 'trainer' | 'stamp' | 'documents' | 'preview'>('director');

  // Fallback if trainer tab is active on a boutique agency
  React.useEffect(() => {
    if (!isPrestationAgency && activeTab === 'trainer') {
      setActiveTab('director');
    }
  }, [isPrestationAgency, activeTab]);

  // Signatures list from Tenant
  const signatures: DigitalSignature[] = currentTenant?.settings?.digitalSignatures || [];
  const docConfigs: DocumentSignatureConfig[] = currentTenant?.settings?.documentSignatureConfigs || [];

  // Director Signature
  const directorSignature = useMemo(() => {
    return signatures.find(s => s.type === 'DIRECTOR' && s.isActive) || signatures.find(s => s.type === 'DIRECTOR');
  }, [signatures]);

  // Trainer Signatures
  const trainerSignatures = useMemo(() => {
    return signatures.filter(s => s.type === 'TRAINER');
  }, [signatures]);

  // Stamp
  const officialStamp = useMemo(() => {
    return signatures.find(s => s.type === 'STAMP' && s.isActive) || signatures.find(s => s.type === 'STAMP');
  }, [signatures]);

  // 1. Director Form State
  const [dirName, setDirName] = useState(directorSignature?.signerName || 'M. Eric BOTHIE');
  const [dirTitle, setDirTitle] = useState(directorSignature?.signerTitle || 'Directeur Général du Centre');
  const [dirImage, setDirImage] = useState(directorSignature?.imageUrl || '');
  const [dirWidth, setDirWidth] = useState(directorSignature?.widthPx || 180);
  const [dirHeight, setDirHeight] = useState(directorSignature?.heightPx || 70);
  const [dirAlign, setDirAlign] = useState<'left' | 'center' | 'right'>(directorSignature?.alignment || 'center');
  const [dirIsActive, setDirIsActive] = useState(directorSignature?.isActive ?? true);

  // 2. Trainer Form State (for modal / adding trainer signature)
  const [isTrainerModalOpen, setIsTrainerModalOpen] = useState(false);
  const [trainerToEdit, setTrainerToEdit] = useState<DigitalSignature | null>(null);
  const [trainName, setTrainName] = useState('');
  const [trainTitle, setTrainTitle] = useState('Formateur Référent');
  const [trainImage, setTrainImage] = useState('');
  const [trainWidth, setTrainWidth] = useState(170);
  const [trainHeight, setTrainHeight] = useState(65);
  const [trainIsActive, setTrainIsActive] = useState(true);

  // 3. Stamp Form State
  const [stampName, setStampName] = useState(officialStamp?.signerName || 'Cachet Officiel NICOST');
  const [stampTitle, setStampTitle] = useState(officialStamp?.signerTitle || 'Sceau Officiel de Direction');
  const [stampImage, setStampImage] = useState(officialStamp?.imageUrl || '');
  const [stampDesc, setStampDesc] = useState(officialStamp?.description || 'Cachet d\'authentification circulaire officiel');
  const [stampWidth, setStampWidth] = useState(officialStamp?.widthPx || 130);
  const [stampHeight, setStampHeight] = useState(officialStamp?.heightPx || 130);
  const [stampIsActive, setStampIsActive] = useState(officialStamp?.isActive ?? true);

  // File Upload Handlers (Base64)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'director' | 'trainer' | 'stamp') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      showToast('Format Invalide', 'Formats acceptés : PNG transparent (recommandé), WebP, SVG, JPG.', 'DANGER');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Fichier trop lourd', 'La taille maximale autorisée est de 2 Mo.', 'DANGER');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const dataUrl = event.target.result as string;
        if (target === 'director') setDirImage(dataUrl);
        if (target === 'trainer') setTrainImage(dataUrl);
        if (target === 'stamp') setStampImage(dataUrl);
        showToast('Image Chargée', 'L\'image a été importée avec succès.', 'SUCCESS');
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Director Signature (With automatic versioning)
  const handleSaveDirectorSignature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirName.trim()) {
      showToast('Erreur', 'Veuillez renseigner le nom du Directeur.', 'DANGER');
      return;
    }

    const currentVer = directorSignature?.version || 1;
    const isImageChanged = directorSignature && directorSignature.imageUrl !== dirImage;
    const nextVer = isImageChanged ? currentVer + 1 : currentVer;

    dbStore.updateState(draft => {
      const tenant = draft.tenants.find(t => t.id === currentTenant?.id);
      if (tenant) {
        if (!tenant.settings.digitalSignatures) tenant.settings.digitalSignatures = [];
        
        let sig = tenant.settings.digitalSignatures.find(s => s.type === 'DIRECTOR' && s.id === directorSignature?.id);
        if (sig) {
          sig.signerName = dirName.trim();
          sig.signerTitle = dirTitle.trim();
          sig.imageUrl = dirImage;
          sig.widthPx = dirWidth;
          sig.heightPx = dirHeight;
          sig.alignment = dirAlign;
          sig.isActive = dirIsActive;
          sig.version = nextVer;
          sig.updatedAt = new Date().toISOString();
        } else {
          sig = {
            id: `sig-dir-${Date.now()}`,
            tenantId: tenant.id,
            type: 'DIRECTOR',
            signerName: dirName.trim(),
            signerTitle: dirTitle.trim(),
            imageUrl: dirImage,
            version: 1,
            widthPx: dirWidth,
            heightPx: dirHeight,
            alignment: dirAlign,
            isActive: dirIsActive,
            createdAt: new Date().toISOString(),
          };
          tenant.settings.digitalSignatures.push(sig);
        }

        // Also update legacy certificate signer fields for backward compatibility
        tenant.settings.certificateSignerName = dirName.trim();
        tenant.settings.certificateSignerTitle = dirTitle.trim();
      }
    });

    dbStore.logAudit('SIGNATURE_UPDATED', 'SIGNATURE', directorSignature?.id || 'dir', null, {
      signer: dirName,
      type: 'DIRECTOR',
      version: nextVer,
      action: isImageChanged ? 'REPLACED_NEW_VERSION' : 'METADATA_UPDATED'
    });

    showToast(
      isImageChanged ? `Signature Directeur Version ${nextVer} Activée` : 'Signature Directeur Mise à Jour',
      'Les futurs documents appliqueront cette version. Les documents historiques restent inchangés.',
      'SUCCESS'
    );
  };

  // Save Stamp (With automatic versioning)
  const handleSaveStamp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stampName.trim()) {
      showToast('Erreur', 'Veuillez renseigner le nom du cachet.', 'DANGER');
      return;
    }

    const currentVer = officialStamp?.version || 1;
    const isImageChanged = officialStamp && officialStamp.imageUrl !== stampImage;
    const nextVer = isImageChanged ? currentVer + 1 : currentVer;

    dbStore.updateState(draft => {
      const tenant = draft.tenants.find(t => t.id === currentTenant?.id);
      if (tenant) {
        if (!tenant.settings.digitalSignatures) tenant.settings.digitalSignatures = [];

        let stp = tenant.settings.digitalSignatures.find(s => s.type === 'STAMP' && s.id === officialStamp?.id);
        if (stp) {
          stp.signerName = stampName.trim();
          stp.signerTitle = stampTitle.trim();
          stp.imageUrl = stampImage;
          stp.description = stampDesc.trim();
          stp.widthPx = stampWidth;
          stp.heightPx = stampHeight;
          stp.isActive = stampIsActive;
          stp.version = nextVer;
          stp.updatedAt = new Date().toISOString();
        } else {
          stp = {
            id: `stamp-${Date.now()}`,
            tenantId: tenant.id,
            type: 'STAMP',
            signerName: stampName.trim(),
            signerTitle: stampTitle.trim(),
            imageUrl: stampImage,
            description: stampDesc.trim(),
            version: 1,
            widthPx: stampWidth,
            heightPx: stampHeight,
            alignment: 'center',
            isActive: stampIsActive,
            createdAt: new Date().toISOString(),
          };
          tenant.settings.digitalSignatures.push(stp);
        }
      }
    });

    dbStore.logAudit('STAMP_UPDATED', 'STAMP', officialStamp?.id || 'stamp', null, {
      name: stampName,
      version: nextVer,
      action: isImageChanged ? 'REPLACED_NEW_VERSION' : 'METADATA_UPDATED'
    });

    showToast(
      isImageChanged ? `Cachet Officiel Version ${nextVer} Enregistré` : 'Cachet Officiel Mis à Jour',
      'Le cachet a été mis à jour pour toutes les nouvelles générations de documents.',
      'SUCCESS'
    );
  };

  // Open Trainer Modal (Add or Edit)
  const handleOpenTrainerModal = (trainerSig?: DigitalSignature) => {
    if (trainerSig) {
      setTrainerToEdit(trainerSig);
      setTrainName(trainerSig.signerName);
      setTrainTitle(trainerSig.signerTitle);
      setTrainImage(trainerSig.imageUrl);
      setTrainWidth(trainerSig.widthPx || 170);
      setTrainHeight(trainerSig.heightPx || 65);
      setTrainIsActive(trainerSig.isActive);
    } else {
      setTrainerToEdit(null);
      setTrainName('M. Ousmane Soumah');
      setTrainTitle('Formateur Référent Informatique & Bureautique');
      setTrainImage('');
      setTrainWidth(170);
      setTrainHeight(65);
      setTrainIsActive(true);
    }
    setIsTrainerModalOpen(true);
  };

  // Save Trainer Signature
  const handleSaveTrainerSignature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainName.trim()) {
      showToast('Erreur', 'Veuillez saisir le nom du formateur.', 'DANGER');
      return;
    }

    dbStore.updateState(draft => {
      const tenant = draft.tenants.find(t => t.id === currentTenant?.id);
      if (tenant) {
        if (!tenant.settings.digitalSignatures) tenant.settings.digitalSignatures = [];

        if (trainerToEdit) {
          const sig = tenant.settings.digitalSignatures.find(s => s.id === trainerToEdit.id);
          if (sig) {
            const isImageChanged = sig.imageUrl !== trainImage;
            sig.signerName = trainName.trim();
            sig.signerTitle = trainTitle.trim();
            sig.imageUrl = trainImage;
            sig.widthPx = trainWidth;
            sig.heightPx = trainHeight;
            sig.isActive = trainIsActive;
            sig.version = isImageChanged ? sig.version + 1 : sig.version;
            sig.updatedAt = new Date().toISOString();
          }
        } else {
          const newSig: DigitalSignature = {
            id: `sig-train-${Date.now()}`,
            tenantId: tenant.id,
            type: 'TRAINER',
            signerName: trainName.trim(),
            signerTitle: trainTitle.trim(),
            imageUrl: trainImage,
            version: 1,
            widthPx: trainWidth,
            heightPx: trainHeight,
            alignment: 'center',
            isActive: trainIsActive,
            createdAt: new Date().toISOString(),
          };
          tenant.settings.digitalSignatures.push(newSig);
        }
      }
    });

    dbStore.logAudit('TRAINER_SIGNATURE_UPDATED', 'SIGNATURE', trainerToEdit?.id || 'new', null, { signer: trainName });
    showToast('Signature Formateur Enregistrée', `La signature de "${trainName}" a été mise à jour.`, 'SUCCESS');
    setIsTrainerModalOpen(false);
  };

  // Delete Trainer Signature
  const handleDeleteTrainerSignature = (sigId: string) => {
    if (confirm('Voulez-vous supprimer cette signature de formateur ?')) {
      dbStore.updateState(draft => {
        const tenant = draft.tenants.find(t => t.id === currentTenant?.id);
        if (tenant && tenant.settings.digitalSignatures) {
          tenant.settings.digitalSignatures = tenant.settings.digitalSignatures.filter(s => s.id !== sigId);
        }
      });
      showToast('Signature Supprimée', 'La signature du formateur a été retirée.', 'INFO');
    }
  };

  // Toggle Document Signature Config
  const handleToggleDocConfig = (docType: DocumentType, field: 'showDirectorSignature' | 'showTrainerSignature' | 'showOfficialStamp') => {
    dbStore.updateState(draft => {
      const tenant = draft.tenants.find(t => t.id === currentTenant?.id);
      if (tenant) {
        if (!tenant.settings.documentSignatureConfigs) tenant.settings.documentSignatureConfigs = [];
        let cfg = tenant.settings.documentSignatureConfigs.find(c => c.documentType === docType);
        if (!cfg) {
          cfg = {
            documentType: docType,
            showDirectorSignature: true,
            showTrainerSignature: docType === 'CERTIFICATE' || docType === 'ATTESTATION' || docType === 'ATTENDANCE_SHEET',
            showOfficialStamp: true,
            directorSignatureId: directorSignature?.id,
            officialStampId: officialStamp?.id
          };
          tenant.settings.documentSignatureConfigs.push(cfg);
        }
        cfg[field] = !cfg[field];
      }
    });

    showToast('Configuration Mise à Jour', `Règle d'affichage modifiée pour les documents ${DOCUMENT_LABELS[docType].label}.`, 'SUCCESS');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-brand-500" />
            Signatures Numériques & Cachet Officiel
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gestion de la signature du Directeur, des formateurs, du cachet officiel et des règles d'apposition sur les documents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="purple" size="md">
            🛡️ Non-rétroactivité & Versioning v{directorSignature?.version || 1}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'director', label: isPrestationAgency ? 'Signature du Directeur' : 'Signature du Responsable', icon: Award },
          ...(isPrestationAgency ? [
            { id: 'trainer', label: 'Signatures Formateurs', icon: UserCheck, count: trainerSignatures.length },
          ] : []),
          { id: 'stamp', label: 'Cachet Officiel', icon: ShieldCheck },
          { id: 'documents', label: 'Règles par Document', icon: FileCheck2 },
          { id: 'preview', label: 'Aperçu & Maquettes', icon: Eye },
        ]}
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as any)}
      />

      {/* ========================================================================= */}
      {/* TAB 1: SIGNATURE DU DIRECTEUR */}
      {/* ========================================================================= */}
      {activeTab === 'director' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-7 p-6 space-y-4">
            <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Award className="w-4 h-4 text-brand-500" />
                  Informations & Fichier de la Signature du Directeur
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Apposée sur les factures, devis, reçus et diplômes officiels.
                </p>
              </div>
              <Badge variant={dirIsActive ? 'success' : 'danger'}>
                {dirIsActive ? 'Active' : 'Désactivée'} (v{directorSignature?.version || 1})
              </Badge>
            </CardHeader>

            <form onSubmit={handleSaveDirectorSignature} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nom et Prénom du Directeur *"
                  value={dirName}
                  onChange={(e) => setDirName(e.target.value)}
                  required
                />
                <Input
                  label="Fonction / Qualité officielle *"
                  value={dirTitle}
                  onChange={(e) => setDirTitle(e.target.value)}
                  required
                />
              </div>

              {/* Upload Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Fichier de Signature (PNG avec fond transparent recommandé)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 rounded-xl text-xs font-semibold border border-brand-200 dark:border-brand-800 transition-colors">
                    <Upload className="w-4 h-4" />
                    {dirImage ? 'Remplacer l\'image' : 'Importer une signature'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'director')}
                    />
                  </label>

                  {dirImage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setDirImage('')}
                    >
                      Effacer l'image
                    </Button>
                  )}
                </div>
              </div>

              {/* Dimension & Alignments */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <Input
                  label="Largeur (px)"
                  type="number"
                  value={dirWidth}
                  onChange={(e) => setDirWidth(parseInt(e.target.value) || 180)}
                />
                <Input
                  label="Hauteur (px)"
                  type="number"
                  value={dirHeight}
                  onChange={(e) => setDirHeight(parseInt(e.target.value) || 70)}
                />
                <Select
                  label="Alignement"
                  value={dirAlign}
                  onChange={(e) => setDirAlign(e.target.value as any)}
                  options={[
                    { value: 'left', label: 'Gauche' },
                    { value: 'center', label: 'Centré' },
                    { value: 'right', label: 'Droite' },
                  ]}
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dirIsActiveCheck"
                  checked={dirIsActive}
                  onChange={(e) => setDirIsActive(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                />
                <label htmlFor="dirIsActiveCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Activer la signature du Directeur sur les nouveaux documents
                </label>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button type="submit" variant="primary" icon={Check}>
                  Enregistrer & Appliquer
                </Button>
              </div>
            </form>
          </Card>

          {/* Live Preview Box */}
          <Card className="lg:col-span-5 p-6 flex flex-col justify-between">
            <div>
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-brand-500" />
                  Aperçu en direct (Rendu Officiel)
                </CardTitle>
              </CardHeader>

              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-center space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Direction Générale
                </span>

                <div className="min-h-[90px] flex items-center justify-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-2">
                  {dirImage ? (
                    <img
                      src={dirImage}
                      alt="Signature Directeur"
                      style={{
                        width: `${dirWidth}px`,
                        height: `${dirHeight}px`,
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <div className="text-slate-400 text-xs italic">
                      [ Ligne de signature standard ]
                    </div>
                  )}
                </div>

                <div className="space-y-0.5 pt-1">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {dirName}
                  </h4>
                  <p className="text-xs text-brand-600 font-semibold">
                    {dirTitle}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 text-[11px] text-amber-900 dark:text-amber-200 mt-4">
              <strong>Garantie de non-rétroactivité :</strong> Chaque document généré sauvegarde une copie figée de la signature à l'instant T. Les futures modifications ne changeront jamais les factures passées.
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SIGNATURES DES FORMATEURS */}
      {/* ========================================================================= */}
      {activeTab === 'trainer' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Répertoire des Signatures Pédagogiques
              </h3>
              <p className="text-xs text-slate-500">
                Signatures des formateurs apposées sur les certificats, attestations et feuilles d'émargement.
              </p>
            </div>
            <Button variant="primary" icon={Upload} onClick={() => handleOpenTrainerModal()}>
              Ajouter une Signature Formateur
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Formateur / Signataire</TableHead>
                  <TableHead>Qualité / Titre</TableHead>
                  <TableHead>Aperçu Signature</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainerSignatures.map(ts => (
                  <TableRow key={ts.id}>
                    <TableCell>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">
                        {ts.signerName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Créée le {formatDate(ts.createdAt)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        {ts.signerTitle}
                      </span>
                    </TableCell>

                    <TableCell>
                      {ts.imageUrl ? (
                        <img
                          src={ts.imageUrl}
                          alt="Signature Formateur"
                          className="h-10 w-28 object-contain bg-slate-50 dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 italic">Pas d'image</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" size="sm">v{ts.version}</Badge>
                    </TableCell>

                    <TableCell>
                      {ts.isActive ? (
                        <Badge variant="success" size="sm">🟢 Active</Badge>
                      ) : (
                        <Badge variant="danger" size="sm">🔴 Inactive</Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenTrainerModal(ts)}
                        >
                          Modifier
                        </Button>
                        <button
                          onClick={() => handleDeleteTrainerSignature(ts.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {trainerSignatures.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      Aucune signature de formateur configurée. Cliquez sur "Ajouter une Signature Formateur".
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CACHET OFFICIEL DU CENTRE */}
      {/* ========================================================================= */}
      {activeTab === 'stamp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-7 p-6 space-y-4">
            <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-500" />
                  Configuration du Cachet & Sceau Officiel
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cachet officiel circulaire ou rectangulaire apposé sur les documents légaux.
                </p>
              </div>
              <Badge variant={stampIsActive ? 'success' : 'danger'}>
                {stampIsActive ? 'Actif' : 'Désactivé'} (v{officialStamp?.version || 1})
              </Badge>
            </CardHeader>

            <form onSubmit={handleSaveStamp} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nom du Cachet *"
                  value={stampName}
                  onChange={(e) => setStampName(e.target.value)}
                  required
                />
                <Input
                  label="Titre / Mention légale"
                  value={stampTitle}
                  onChange={(e) => setStampTitle(e.target.value)}
                />
              </div>

              <Input
                label="Description & Mentions réglementaires"
                value={stampDesc}
                onChange={(e) => setStampDesc(e.target.value)}
              />

              {/* Upload Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Image du Cachet (PNG fond transparent recommandé)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 rounded-xl text-xs font-semibold border border-brand-200 dark:border-brand-800 transition-colors">
                    <Upload className="w-4 h-4" />
                    {stampImage ? 'Remplacer le cachet' : 'Importer le cachet'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'stamp')}
                    />
                  </label>

                  {stampImage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setStampImage('')}
                    >
                      Effacer l'image
                    </Button>
                  )}
                </div>
              </div>

              {/* Dimension Settings */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <Input
                  label="Diamètre / Largeur (px)"
                  type="number"
                  value={stampWidth}
                  onChange={(e) => setStampWidth(parseInt(e.target.value) || 130)}
                />
                <Input
                  label="Hauteur (px)"
                  type="number"
                  value={stampHeight}
                  onChange={(e) => setStampHeight(parseInt(e.target.value) || 130)}
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="stampIsActiveCheck"
                  checked={stampIsActive}
                  onChange={(e) => setStampIsActive(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                />
                <label htmlFor="stampIsActiveCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Activer le cachet sur les nouveaux documents générés
                </label>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button type="submit" variant="primary" icon={Check}>
                  Enregistrer le Cachet
                </Button>
              </div>
            </form>
          </Card>

          {/* Stamp Preview */}
          <Card className="lg:col-span-5 p-6 flex flex-col justify-between">
            <div>
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-xs uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-brand-500" />
                  Aperçu du Cachet Officiel
                </CardTitle>
              </CardHeader>

              <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center space-y-4">
                <div className="min-h-[140px] flex items-center justify-center p-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  {stampImage ? (
                    <img
                      src={stampImage}
                      alt="Cachet Officiel"
                      style={{
                        width: `${stampWidth}px`,
                        height: `${stampHeight}px`,
                        objectFit: 'contain'
                      }}
                    />
                  ) : (
                    <div className="text-slate-400 text-xs italic">
                      [ Aucun cachet importé ]
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{stampName}</h4>
                  <p className="text-xs text-brand-600 font-semibold">{stampTitle}</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">{stampDesc}</p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 dark:text-emerald-200 mt-4 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Le cachet est automatiquement superposé avec opacité naturelle sur les factures et certificats pour un rendu professionnel anti-fraude.
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RÈGLES PAR TYPE DE DOCUMENT */}
      {/* ========================================================================= */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <Card className="p-6 space-y-4">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-brand-500" />
                Matrice des Signatures & Cachets par Document
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Cochez les éléments qui doivent être apposés automatiquement sur chaque type de document émis par le centre.
              </p>
            </CardHeader>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type de Document</TableHead>
                  <TableHead className="text-center">Signature {isPrestationAgency ? 'Directeur' : 'Responsable'}</TableHead>
                  {isPrestationAgency && <TableHead className="text-center">Signature Formateur</TableHead>}
                  <TableHead className="text-center">Cachet Officiel</TableHead>
                  <TableHead>Aperçu Rendu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Object.keys(DOCUMENT_LABELS) as DocumentType[])
                  .filter(docType => isPrestationAgency || ['INVOICE', 'RECEIPT', 'QUOTE'].includes(docType))
                  .map(docType => {
                  const info = DOCUMENT_LABELS[docType];
                  const cfg = docConfigs.find(c => c.documentType === docType) || {
                    documentType: docType,
                    showDirectorSignature: true,
                    showTrainerSignature: docType === 'CERTIFICATE' || docType === 'ATTESTATION' || docType === 'ATTENDANCE_SHEET',
                    showOfficialStamp: true
                  };

                  return (
                    <TableRow key={docType}>
                      <TableCell>
                        <div className="flex items-start gap-2.5">
                          <span className="text-lg">{info.icon}</span>
                          <div>
                            <span className="font-bold text-xs text-slate-900 dark:text-white block">
                              {info.label}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {info.desc}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={cfg.showDirectorSignature}
                          onChange={() => handleToggleDocConfig(docType, 'showDirectorSignature')}
                          className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                        />
                      </TableCell>

                      {isPrestationAgency && (
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={cfg.showTrainerSignature}
                            onChange={() => handleToggleDocConfig(docType, 'showTrainerSignature')}
                            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                          />
                        </TableCell>
                      )}

                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={cfg.showOfficialStamp}
                          onChange={() => handleToggleDocConfig(docType, 'showOfficialStamp')}
                          className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                        />
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1">
                          {cfg.showDirectorSignature && <Badge variant="primary" size="sm">{isPrestationAgency ? 'Directeur' : 'Responsable'}</Badge>}
                          {isPrestationAgency && cfg.showTrainerSignature && <Badge variant="success" size="sm">Formateur</Badge>}
                          {cfg.showOfficialStamp && <Badge variant="danger" size="sm">Cachet</Badge>}
                          {!cfg.showDirectorSignature && (!isPrestationAgency || !cfg.showTrainerSignature) && !cfg.showOfficialStamp && (
                            <span className="text-xs text-slate-400 italic">Aucun élément</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: APERÇU COMPLET & MAQUETTES */}
      {/* ========================================================================= */}
      {activeTab === 'preview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mockup 1: Invoice */}
          <Card className="p-6 space-y-4">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-500" />
                Maquette 1 : Facture / Reçu Client
              </CardTitle>
            </CardHeader>

            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-xs space-y-4">
              <div className="flex justify-between border-b pb-3">
                <span className="font-extrabold text-sm">{currentTenant?.name}</span>
                <span className="font-mono font-bold text-brand-600">FAC-2026-00042</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex justify-between">
                <span>Client : <strong>Sekou Kourouma</strong></span>
                <span className="font-black text-brand-600">150 000 GNF</span>
              </div>

              {/* Signature Block */}
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <div className="relative text-center w-56 p-3 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl">
                  {/* Director Signature */}
                  {dirImage && (
                    <img
                      src={dirImage}
                      alt="Signature"
                      className="h-14 w-auto mx-auto object-contain z-10 relative"
                    />
                  )}

                  {/* Stamp overlaid */}
                  {stampImage && (
                    <img
                      src={stampImage}
                      alt="Cachet"
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 object-contain opacity-40 pointer-events-none"
                    />
                  )}

                  <div className="mt-1 pt-1 border-t border-slate-200 text-center">
                    <span className="font-extrabold text-xs text-slate-900 block">{dirName}</span>
                    <span className="text-[10px] text-slate-500">{dirTitle}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Mockup 2: Certificate */}
          <Card className="p-6 space-y-4">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-500" />
                Maquette 2 : Certificat de Formation
              </CardTitle>
            </CardHeader>

            <div className="p-6 bg-gradient-to-br from-amber-50/30 to-amber-100/10 border-2 border-amber-300/60 rounded-2xl shadow-sm text-xs space-y-4">
              <div className="text-center space-y-1">
                <span className="text-[10px] uppercase tracking-widest font-black text-amber-700">CERTIFICAT D'ACCOMPLISSEMENT</span>
                <h4 className="font-black text-sm text-slate-900">Mamadou Lamarana Diallo</h4>
                <p className="text-[11px] text-slate-600">Bureautique & Informatique Professionnelle</p>
              </div>

              {/* Signatures Tri-block */}
              <div className="grid grid-cols-3 gap-2 items-end pt-4 border-t border-amber-200 text-center">
                {/* Trainer Signature */}
                <div>
                  {trainerSignatures[0]?.imageUrl && (
                    <img src={trainerSignatures[0].imageUrl} alt="Formateur" className="h-10 mx-auto object-contain" />
                  )}
                  <span className="font-bold text-[10px] block mt-1">{trainerSignatures[0]?.signerName || 'Le Formateur'}</span>
                  <span className="text-[9px] text-slate-400">Formateur Référent</span>
                </div>

                {/* Stamp */}
                <div>
                  {stampImage && (
                    <img src={stampImage} alt="Cachet" className="h-14 mx-auto object-contain" />
                  )}
                </div>

                {/* Director Signature */}
                <div>
                  {dirImage && (
                    <img src={dirImage} alt="Directeur" className="h-10 mx-auto object-contain" />
                  )}
                  <span className="font-bold text-[10px] block mt-1">{dirName}</span>
                  <span className="text-[9px] text-slate-400">Directeur Général</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AJOUTER / MODIFIER SIGNATURE FORMATEUR */}
      {/* ========================================================================= */}
      {isTrainerModalOpen && (
        <Modal
          isOpen={isTrainerModalOpen}
          onClose={() => setIsTrainerModalOpen(false)}
          title={trainerToEdit ? 'Modifier la Signature Formateur' : 'Ajouter une Signature Formateur'}
          maxWidth="md"
        >
          <form onSubmit={handleSaveTrainerSignature} className="space-y-4 pt-1">
            <Input
              label="Nom et Prénom du Formateur *"
              value={trainName}
              onChange={(e) => setTrainName(e.target.value)}
              required
            />

            <Input
              label="Titre / Discipline pédagogique *"
              value={trainTitle}
              onChange={(e) => setTrainTitle(e.target.value)}
              required
            />

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Fichier de Signature
              </label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl text-xs font-semibold border border-brand-200 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {trainImage ? 'Remplacer l\'image' : 'Importer la signature'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'trainer')}
                  />
                </label>
                {trainImage && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setTrainImage('')}>
                    Effacer
                  </Button>
                )}
              </div>
            </div>

            {/* Preview inside modal */}
            {trainImage && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border flex items-center justify-center">
                <img src={trainImage} alt="Aperçu" className="h-14 object-contain" />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="trainIsActiveCheck"
                checked={trainIsActive}
                onChange={(e) => setTrainIsActive(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded cursor-pointer"
              />
              <label htmlFor="trainIsActiveCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                Signature active pour les certificats et fiches
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsTrainerModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary">
                Enregistrer la Signature
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
