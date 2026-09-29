import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { isValidPhoneNumber } from '../../lib/phoneValidation';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { dbStore } from '../../server/db/mockStore';
import { Currency, RoleCode, ActivityType } from '../../types';
import { formatCurrency } from '../../lib/utils';
import {
  Sparkles, CheckCircle2, ArrowRight, ArrowLeft, Building2,
  Sliders, FolderTree, Package, Boxes, Users, Check, Upload,
  Plus, Trash2, AlertCircle, Eye, Image as ImageIcon, HelpCircle,
  Store, Briefcase, Zap, ShieldCheck, FileText, Stamp, PenTool,
  Percent, GraduationCap, Truck, Landmark, Wallet, DollarSign,
  ChevronRight, Save, Award, RefreshCw, X, Edit, Lock, Shield, UserPlus
} from 'lucide-react';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  onCompleted
}) => {
  const { currentTenant, currentUser, isSuperAdmin } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const currentAgencyId = currentTenant?.id || 't-001';
  const savedData = currentTenant?.onboardingData || {};

  const [currentStep, setCurrentStep] = useState<number>(() => {
    return Math.max(1, Math.min(10, currentTenant?.onboardingStep || 1));
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // TYPE D'ACTIVITÉ DU CENTRE
  // -------------------------------------------------------------------------
  const [activityType, setActivityType] = useState<ActivityType | 'MIXED'>(() => {
    return (currentTenant?.activityType as any) || 'SERVICE_CENTER';
  });

  // -------------------------------------------------------------------------
  // ÉTAPE 1 : INFORMATIONS GÉNÉRALES
  // -------------------------------------------------------------------------
  const [agencyName, setAgencyName] = useState(savedData.agencyName || currentTenant?.name || '');
  const [commercialName, setCommercialName] = useState(savedData.commercialName || currentTenant?.name || '');
  const [slogan, setSlogan] = useState(savedData.slogan || currentTenant?.slogan || 'Excellence & Service Rapide');
  const [logoUrl, setLogoUrl] = useState(savedData.logoUrl || currentTenant?.logoUrl || '');
  const [country, setCountry] = useState(savedData.country || currentTenant?.country || 'Guinée');
  const [city, setCity] = useState(savedData.city || currentTenant?.city || currentTenant?.settings?.city || 'Conakry');
  const [address, setAddress] = useState(savedData.address || currentTenant?.address || 'Kaloum, Centre-Ville');
  const [phone, setPhone] = useState(savedData.phone || currentTenant?.phone || '+224 620 00 00 00');
  const [whatsapp, setWhatsapp] = useState(savedData.whatsapp || currentTenant?.whatsapp || '+224 620 00 00 00');
  const [email, setEmail] = useState(savedData.email || currentTenant?.email || 'contact@agence.local');
  const [website, setWebsite] = useState(savedData.website || currentTenant?.website || 'www.mon-centre.com');
  const [currency, setCurrency] = useState<Currency>(savedData.currency || currentTenant?.currency || 'GNF');
  const [timezone, setTimezone] = useState(savedData.timezone || currentTenant?.timezone || 'Africa/Conakry');

  // -------------------------------------------------------------------------
  // ÉTAPE 2 : PERSONNALISATION VISUELLE & DOCUMENTS
  // -------------------------------------------------------------------------
  const [headerText, setHeaderText] = useState(savedData.headerText || currentTenant?.headerText || 'CENTRE DE PRESTATION & SERVICES MULTIMÉDIA');
  const [footerText, setFooterText] = useState(savedData.footerText || currentTenant?.footerText || 'NIF: 100234890 - RCCM/GC-KAL/2024 - Merci de votre confiance !');
  const [sealUrl, setSealUrl] = useState(savedData.sealUrl || currentTenant?.sealUrl || '');
  const [directorSignatureUrl, setDirectorSignatureUrl] = useState(savedData.directorSignatureUrl || currentTenant?.directorSignatureUrl || '');
  const [showSealOnInvoice, setShowSealOnInvoice] = useState<boolean>(true);
  const [showSignatureOnInvoice, setShowSignatureOnInvoice] = useState<boolean>(true);

  // Logo file upload handler
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validFormats.includes(file.type)) {
      showToast('Format Invalide', 'Formats acceptés : PNG, JPG, JPEG, SVG, WebP.', 'DANGER');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Fichier trop volumineux', 'La taille maximale du logo est de 2 Mo.', 'WARNING');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setLogoUrl(event.target.result as string);
        showToast('Logo importé avec succès 🎉', 'Le logo a été mis à jour pour l\'aperçu.', 'SUCCESS');
      }
    };
    reader.readAsDataURL(file);
  };

  // -------------------------------------------------------------------------
  // ÉTAPE 3 : UTILISATEURS & SÉCURITÉ
  // -------------------------------------------------------------------------
  const [teamMembers, setTeamMembers] = useState<any[]>(() => {
    if (savedData.users && Array.isArray(savedData.users)) return savedData.users;
    return [
      {
        fullName: 'Ibrahima Diallo',
        firstName: 'Ibrahima',
        lastName: 'Diallo',
        username: 'caissier',
        role: 'CAISSIER',
        functionTitle: 'Caissière & Vendeuse',
        password: 'Caissier123!',
        phone: '+224 621 11 22 33',
        email: 'caisse@agence.local',
        isActive: true
      },
      {
        fullName: 'Mamadou Camara',
        firstName: 'Mamadou',
        lastName: 'Camara',
        username: 'stock_mgr',
        role: 'GESTIONNAIRE',
        functionTitle: 'Gestionnaire de Stock & Magasin',
        password: 'Stock123!',
        phone: '+224 622 33 44 55',
        email: 'stock@agence.local',
        isActive: true
      }
    ];
  });
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('Pass123!');
  const [newUserFunction, setNewUserFunction] = useState('Caissier');
  const [newUserRole, setNewUserRole] = useState<RoleCode>('CAISSIER');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  // -------------------------------------------------------------------------
  // ÉTAPE 4 : SERVICES & ACTIVITÉS (DYNAMIQUE)
  // -------------------------------------------------------------------------
  const defaultServices = [
    { code: 'PHOTOCOPIE', name: 'Photocopie', category: 'Impression & Photocopie', unit: 'page', basePrice: 500, baseCost: 150, isSelected: true },
    { code: 'IMPRESSION', name: 'Impression', category: 'Impression & Photocopie', unit: 'page', basePrice: 1000, baseCost: 200, isSelected: true },
    { code: 'SCAN-DOC', name: 'Numérisation / Scan', category: 'Secrétariat & Saisie', unit: 'page', basePrice: 1500, baseCost: 100, isSelected: true },
    { code: 'REL-SPIR-A4', name: 'Reliure', category: 'Finition & Reliure', unit: 'document', basePrice: 10000, baseCost: 3000, isSelected: true },
    { code: 'PLAST-A4', name: 'Plastification', category: 'Finition & Reliure', unit: 'document', basePrice: 5000, baseCost: 1500, isSelected: true },
    { code: 'PHOTO-ID', name: 'Planche photo', category: 'Design & Multimédia', unit: 'planche', basePrice: 15000, baseCost: 2500, isSelected: true },
    { code: 'CONCEPTION-GRAPHIQUE', name: 'Conception', category: 'Design & Multimédia', unit: 'document', basePrice: 50000, baseCost: 5000, isSelected: true },
    { code: 'RECHERCHE-DOC', name: 'Recherche', category: 'Secrétariat & Saisie', unit: 'prestation', basePrice: 20000, baseCost: 0, isSelected: true },
    { code: 'EXPOSE-SAISIE', name: 'Exposé', category: 'Secrétariat & Saisie', unit: 'document', basePrice: 30000, baseCost: 0, isSelected: true }
  ];
  const [servicesList, setServicesList] = useState<any[]>(() => {
    return savedData.services || defaultServices;
  });

  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState(5000);
  const [newServiceUnit, setNewServiceUnit] = useState('unité');

  // Initial products for Boutique Mode (Step 4 & 7)
  const defaultInitialProducts = [
    {
      code: 'ART-RAM-A4-80',
      name: 'Ramette Papier A4 80g Double A',
      category: 'Papeterie & Fournitures',
      unit: 'paquet',
      costPrice: 45000,
      sellingPrice: 55000,
      initialStock: 25,
      minStockAlert: 5
    },
    {
      code: 'ART-STY-BIC-BL',
      name: 'Stylo à bille BIC Cristal Bleu',
      category: 'Fournitures de Bureau',
      unit: 'pièce',
      costPrice: 1500,
      sellingPrice: 2500,
      initialStock: 100,
      minStockAlert: 20
    },
    {
      code: 'ART-CLE-USB-32',
      name: 'Clé USB 32 Go SanDisk Ultra',
      category: 'Accessoires & Informatique',
      unit: 'pièce',
      costPrice: 40000,
      sellingPrice: 65000,
      initialStock: 15,
      minStockAlert: 3
    },
    {
      code: 'ART-CHEM-CART',
      name: 'Chemise Cartonnée avec Rabats A4',
      category: 'Papeterie & Fournitures',
      unit: 'pièce',
      costPrice: 2000,
      sellingPrice: 4000,
      initialStock: 80,
      minStockAlert: 15
    }
  ];
  const [shopProducts, setShopProducts] = useState<any[]>(() => {
    return savedData.products || defaultInitialProducts;
  });

  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Fournitures');
  const [newProdCostPrice, setNewProdCostPrice] = useState(10000);
  const [newProdSellingPrice, setNewProdSellingPrice] = useState(15000);
  const [newProdQty, setNewProdQty] = useState(10);
  const [newProdUnit, setNewProdUnit] = useState('pièce');
  const [newProdAlert, setNewProdAlert] = useState(3);

  // -------------------------------------------------------------------------
  // ÉTAPE 5 : TARIFS & RÈGLEMENTS
  // -------------------------------------------------------------------------
  const [maxDiscountWithoutApprovalPct, setMaxDiscountWithoutApprovalPct] = useState<number>(savedData.maxDiscountWithoutApprovalPct || 10);
  const [allowDiscounts, setAllowDiscounts] = useState<boolean>(savedData.allowDiscounts !== undefined ? savedData.allowDiscounts : true);
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<string[]>(() => {
    return savedData.paymentMethods || ['CASH', 'ORANGE_MONEY', 'MTN_MOMO', 'BANK_TRANSFER'];
  });

  // -------------------------------------------------------------------------
  // ÉTAPE 6 : MODULE FORMATION (TOGGLE ON/OFF)
  // -------------------------------------------------------------------------
  const [hasTrainingModule, setHasTrainingModule] = useState<boolean>(savedData.hasTraining !== undefined ? savedData.hasTraining : false);
  const defaultCourses = [
    { code: 'FORM-BUR-01', title: 'Informatique & Bureautique (Word, Excel, PowerPoint, Internet)', category: 'Bureautique', durationWeeks: 8, durationHours: 40, price: 600000, minDepositAmount: 200000, description: 'Maîtrise complète de la suite Office et productivité' },
    { code: 'FORM-PAO-01', title: 'Infographie & Design Graphique (Photoshop, Illustrator)', category: 'Design', durationWeeks: 12, durationHours: 60, price: 1200000, minDepositAmount: 400000, description: 'Conception graphique et création visuelle professionnelle' },
    { code: 'FORM-MAINT-01', title: 'Maintenance & Réseaux Informatiques', category: 'Technique', durationWeeks: 10, durationHours: 50, price: 900000, minDepositAmount: 300000, description: 'Dépannage matériel, systèmes et câblage réseau' },
    { code: 'FORM-PROG-01', title: 'Initiation à la Programmation Web & Logiciel', category: 'Développement', durationWeeks: 12, durationHours: 60, price: 1500000, minDepositAmount: 500000, description: 'HTML, CSS, JavaScript, bases de données' }
  ];
  const [trainingCourses, setTrainingCourses] = useState<any[]>(() => {
    return savedData.courses || defaultCourses;
  });

  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseWeeks, setNewCourseWeeks] = useState(8);
  const [newCoursePrice, setNewCoursePrice] = useState(600000);
  const [newCourseDesc, setNewCourseDesc] = useState('');

  // -------------------------------------------------------------------------
  // ÉTAPE 7 : BOUTIQUE ET STOCK (CONSOMMABLES OU ARTICLES)
  // -------------------------------------------------------------------------
  const [hasShopModule, setHasShopModule] = useState<boolean>(savedData.hasShop !== undefined ? savedData.hasShop : true);

  // -------------------------------------------------------------------------
  // ÉTAPE 8 : FOURNISSEURS
  // -------------------------------------------------------------------------
  const defaultSuppliers = [
    {
      name: 'Papeterie Centrale & Fournitures SARL',
      code: 'FOUR-PAP-01',
      contactPerson: 'M. Diallo Ibrahima',
      phone: '+224 628 00 11 22',
      email: 'commercial@papeterie-centrale.com',
      address: 'Madina Marché, Conakry',
      supplierType: 'Grossiste Papeterie',
      suppliedProducts: 'Rames papier, reliures, pochettes plastification, stylos',
      notes: 'Livraison sous 24h, paiement sous 30 jours'
    },
    {
      name: 'Techno-Bureau Import Guinée',
      code: 'FOUR-TECH-01',
      contactPerson: 'Mme Camara Fatoumata',
      phone: '+224 622 33 55 77',
      email: 'contact@techno-bureau.gn',
      address: 'Dixinn Oasis, Conakry',
      supplierType: 'Distributeur Informatique',
      suppliedProducts: 'Toners, encres imprimantes, clés USB, câbles',
      notes: 'Paiement comptant ou virement'
    }
  ];
  const [suppliersList, setSuppliersList] = useState<any[]>(() => {
    return savedData.suppliers || defaultSuppliers;
  });

  const [newSupName, setNewSupName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupAddress, setNewSupAddress] = useState('');
  const [newSupProducts, setNewSupProducts] = useState('');

  // -------------------------------------------------------------------------
  // ÉTAPE 9 : FINANCE & TRÉSORERIE
  // -------------------------------------------------------------------------
  const defaultAccounts = [
    {
      name: 'Caisse Principale',
      code: 'CP-01',
      type: 'CASH',
      initialBalance: 0,
      isMainCash: true,
      isDefault: true,
      responsiblePerson: 'Caissier Principal',
      description: 'Caisse centrale pour encaissements au comptoir'
    },
    {
      name: 'Orange Money Marchand',
      code: 'OM-01',
      type: 'MOBILE_MONEY',
      accountNumber: '+224 620 00 11 22',
      initialBalance: 0,
      isMainCash: false,
      isDefault: false,
      responsiblePerson: 'Direction',
      description: 'Encaissements électroniques Orange Money'
    }
  ];
  const [financialAccounts, setFinancialAccounts] = useState<any[]>(() => {
    return savedData.financialAccounts || defaultAccounts;
  });

  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState('CASH');
  const [newAccBalance, setNewAccBalance] = useState(0);
  const [newAccResponsible, setNewAccResponsible] = useState('Responsable');

  // -------------------------------------------------------------------------
  // STEP TITLES & DESCRIPTIONS
  // -------------------------------------------------------------------------
  const stepDefinitions = [
    { num: 1, title: 'Coordonnées & Activité', icon: Building2, desc: 'Identité, modèle d\'activité et devise' },
    { num: 2, title: 'Personnalisation Visuelle', icon: Stamp, desc: 'Logo, aperçu facture en direct' },
    { num: 3, title: 'Équipe & Sécurité', icon: Users, desc: 'Admin principal et collaborateurs' },
    { num: 4, title: 'Services & Activités', icon: Briefcase, desc: 'Catalogue prestations ou produits initiaux' },
    { num: 5, title: 'Tarifs & Règlements', icon: Percent, desc: 'Modes de paiement et contrôle des remises' },
    { num: 6, title: 'Module Formation', icon: GraduationCap, desc: 'Activation optionnelle et catalogue cours' },
    { num: 7, title: 'Boutique & Stocks', icon: Store, desc: 'Articles et quantités de départ' },
    { num: 8, title: 'Fournisseurs', icon: Truck, desc: 'Répertoire et contacts d\'approvisionnement' },
    { num: 9, title: 'Trésorerie & Caisses', icon: Landmark, desc: 'Comptes de caisse et soldes initiaux' },
    { num: 10, title: 'Récapitulatif Général', icon: ShieldCheck, desc: 'Vérification complète et mise en service' },
  ];

  // -------------------------------------------------------------------------
  // SAVE HANDLERS
  // -------------------------------------------------------------------------
  const gatherCurrentPayload = () => {
    return {
      activityType,
      agencyName, commercialName, slogan, logoUrl, country, city, address, phone, whatsapp, email, website, currency, timezone,
      headerText, footerText, sealUrl, directorSignatureUrl,
      users: teamMembers,
      services: servicesList.filter(s => s.isSelected),
      maxDiscountWithoutApprovalPct, allowDiscounts, paymentMethods: acceptedPaymentMethods,
      hasTraining: hasTrainingModule,
      courses: hasTrainingModule ? trainingCourses : [],
      hasShop: hasShopModule,
      products: hasShopModule ? shopProducts : [],
      suppliers: suppliersList,
      financialAccounts
    };
  };

  const handleSaveStep = async (stepNumber: number, isComplete = false) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    // Validation phone on Step 1
    if (stepNumber === 1) {
      if (!agencyName.trim()) {
        setIsSubmitting(false);
        setErrorMsg("Le nom de l'agence est obligatoire.");
        return;
      }
      if (phone && !isValidPhoneNumber(phone, { allowEmpty: true })) {
        setIsSubmitting(false);
        setErrorMsg("Le numéro de téléphone principal de l'agence est invalide.");
        return;
      }
    }

    try {
      const payload = gatherCurrentPayload();
      const res = dbStore.saveOnboardingStep(
        currentAgencyId,
        stepNumber,
        payload,
        isComplete,
        currentAgencyId,
        isSuperAdmin
      );

      if (res.success) {
        if (isComplete) {
          showToast(
            "🎉 Configuration Terminée avec Succès !",
            `Votre agence « ${agencyName} » est désormais opérationnelle avec ses données isolées.`,
            "SUCCESS"
          );
          onCompleted?.();
          onClose();
        } else {
          showToast(
            `Étape ${stepNumber} enregistrée`,
            "Modifications enregistrées.",
            "INFO"
          );
          setCurrentStep(Math.min(10, stepNumber + 1));
        }
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper functions
  const handleAddCollaborator = () => {
    if (!newUserLastName.trim() || !newUserUsername.trim()) {
      setErrorMsg("Nom et identifiant login requis.");
      return;
    }
    const fullName = `${newUserFirstName.trim()} ${newUserLastName.trim()}`.trim();
    const newCollab = {
      fullName,
      firstName: newUserFirstName.trim(),
      lastName: newUserLastName.trim(),
      username: newUserUsername.trim().toLowerCase(),
      password: newUserPassword || 'Pass123!',
      role: newUserRole,
      functionTitle: newUserFunction,
      phone: newUserPhone.trim() || undefined,
      email: newUserEmail.trim() || undefined,
      isActive: true
    };
    setTeamMembers([...teamMembers, newCollab]);
    setNewUserLastName('');
    setNewUserFirstName('');
    setNewUserUsername('');
    setNewUserPhone('');
    setNewUserEmail('');
    setErrorMsg(null);
  };

  const handleAddService = () => {
    if (!newServiceName.trim()) return;
    const newSrv = {
      code: `SRV-${Date.now().toString().slice(-4)}`,
      name: newServiceName.trim(),
      category: 'Prestations Personnalisées',
      unit: newServiceUnit,
      basePrice: Number(newServicePrice) || 1000,
      baseCost: 0,
      isSelected: true
    };
    setServicesList([...servicesList, newSrv]);
    setNewServiceName('');
    setNewServicePrice(5000);
  };

  const handleAddShopProduct = () => {
    if (!newProdName.trim()) return;
    const newProd = {
      code: `ART-${Date.now().toString().slice(-4)}`,
      name: newProdName.trim(),
      category: newProdCategory,
      unit: newProdUnit,
      costPrice: Number(newProdCostPrice) || 0,
      sellingPrice: Number(newProdSellingPrice) || 1000,
      initialStock: Number(newProdQty) || 0,
      minStockAlert: Number(newProdAlert) || 3
    };
    setShopProducts([...shopProducts, newProd]);
    setNewProdName('');
    setNewProdQty(10);
  };

  const handleAddCourse = () => {
    if (!newCourseTitle.trim()) return;
    const newCrs = {
      code: `FORM-${Date.now().toString().slice(-4)}`,
      title: newCourseTitle.trim(),
      category: 'Formation',
      durationWeeks: Number(newCourseWeeks) || 8,
      durationHours: Number(newCourseWeeks) * 5,
      price: Number(newCoursePrice) || 500000,
      minDepositAmount: Math.round(Number(newCoursePrice) / 3),
      description: newCourseDesc.trim() || 'Session de formation certifiante'
    };
    setTrainingCourses([...trainingCourses, newCrs]);
    setNewCourseTitle('');
    setNewCourseDesc('');
  };

  const handleAddSupplier = () => {
    if (!newSupName.trim()) return;
    const newSup = {
      name: newSupName.trim(),
      code: `FOUR-${Date.now().toString().slice(-4)}`,
      phone: newSupPhone.trim() || '+224 600 00 00 00',
      address: newSupAddress.trim() || 'Conakry',
      suppliedProducts: newSupProducts.trim() || 'Articles divers',
      supplierType: 'Fournisseur Agréé'
    };
    setSuppliersList([...suppliersList, newSup]);
    setNewSupName('');
    setNewSupPhone('');
    setNewSupAddress('');
    setNewSupProducts('');
  };

  const handleAddFinancialAccount = () => {
    if (!newAccName.trim()) return;
    const newAcc = {
      name: newAccName.trim(),
      code: `CPT-${Date.now().toString().slice(-4)}`,
      type: newAccType,
      initialBalance: Number(newAccBalance) || 0,
      isMainCash: financialAccounts.length === 0,
      isDefault: financialAccounts.length === 0,
      responsiblePerson: newAccResponsible.trim() || 'Caissier',
      description: `Compte ${newAccName.trim()}`
    };
    setFinancialAccounts([...financialAccounts, newAcc]);
    setNewAccName('');
    setNewAccBalance(0);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="flex flex-col min-h-[750px] -m-6 bg-slate-900 text-slate-100 rounded-lg overflow-hidden border border-slate-700 shadow-2xl">
        
        {/* HEADER BAR */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 p-5 border-b border-brand-800/40 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-400/30 shadow-inner">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  Assistant de Configuration Initiale du Centre
                  <Badge variant="primary" className="text-[10px] bg-brand-500/20 text-brand-300">
                    {currentTenant?.code || 'AGENCE'}
                  </Badge>
                </h2>
                <p className="text-xs text-slate-400">
                  {stepDefinitions.find(s => s.num === currentStep)?.desc}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Fermer l'assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* STEP NAVIGATION TABS */}
          <div className="grid grid-cols-5 md:grid-cols-10 gap-1 mt-4">
            {stepDefinitions.map((step) => {
              const isPassed = step.num < currentStep;
              const isCurrent = step.num === currentStep;
              const Icon = step.icon;
              return (
                <button
                  key={step.num}
                  onClick={() => setCurrentStep(step.num)}
                  className={`flex flex-col items-center p-1.5 rounded-lg border text-center transition-all ${
                    isCurrent
                      ? 'bg-brand-600/30 border-brand-400 text-white shadow-md shadow-brand-500/20 ring-1 ring-brand-400'
                      : isPassed
                      ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-300 hover:bg-slate-800'
                      : 'bg-slate-800/40 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                  title={step.title}
                >
                  <div className="flex items-center gap-1">
                    {isPassed ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-brand-400' : 'text-slate-500'}`} />
                    )}
                    <span className="text-[10px] font-bold">E{step.num}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ERROR BANNER */}
        {errorMsg && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-2.5 flex items-center gap-2 text-rose-400 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP BODY CONTAINER */}
        <div className="flex-1 p-6 overflow-y-auto max-h-[550px] space-y-6">
          
          {/* ========================================================================= */}
          {/* ÉTAPE 1 : COORDONNÉES & TYPE D'ACTIVITÉ */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-brand-400" />
                    Étape 1 : Coordonnées & Modèle d'Activité
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ces informations sont propres à cette agence et apparaîtront sur tous vos documents.
                  </p>
                </div>

                {/* Activity Selector */}
                <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
                  <span className="text-[11px] font-bold text-slate-300 pl-1">Activité :</span>
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value as any)}
                    className="bg-slate-900 text-xs font-bold text-brand-300 px-2 py-1 rounded-lg border border-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="SERVICE_CENTER">Centre de Prestations (Reprographie)</option>
                    <option value="RETAIL_STORE">Boutique & Vente (Commerce)</option>
                    <option value="MIXED">Activité Mixte (Boutique + Prestations)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Nom de l'agence ou du centre *</label>
                  <Input
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Ex: CPEP Kaloum Centre"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Nom commercial / Enseigne</label>
                  <Input
                    value={commercialName}
                    onChange={(e) => setCommercialName(e.target.value)}
                    placeholder="Ex: Centre de Prestation Élite"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Slogan / Sous-titre officiel</label>
                  <Input
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    placeholder="Ex: L'Excellence au Service de Vos Impressions & Formations"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Téléphone Principal (Appels) *</label>
                  <PhoneInput
                    value={phone}
                    onChange={(val) => setPhone(val)}
                    placeholder="+224 620 00 00 00"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">WhatsApp Professionnel</label>
                  <PhoneInput
                    value={whatsapp}
                    onChange={(val) => setWhatsapp(val)}
                    placeholder="+224 620 00 00 00"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Email officiel</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@mon-centre.com"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Site Web / Réseaux</label>
                  <Input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="www.mon-centre.com"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Pays</label>
                  <Input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Guinée"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Ville</label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Conakry"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Adresse physique</label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Immeuble Horizon, Kaloum, Conakry"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Devise principale *</label>
                  <Select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="bg-slate-800 border-slate-700 text-white"
                  >
                    <option value="GNF">GNF - Franc Guinéen</option>
                    <option value="XOF">XOF - Franc CFA (BCEAO)</option>
                    <option value="EUR">EUR - Euro (€)</option>
                    <option value="USD">USD - Dollar US ($)</option>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Fuseau horaire</label>
                  <Select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  >
                    <option value="Africa/Conakry">Afrique/Conakry (GMT+0)</option>
                    <option value="Africa/Abidjan">Afrique/Abidjan (GMT+0)</option>
                    <option value="Africa/Dakar">Afrique/Dakar (GMT+0)</option>
                    <option value="Europe/Paris">Europe/Paris (GMT+1 / GMT+2)</option>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 2 : PERSONNALISATION VISUELLE & APERÇU FACTURE */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Stamp className="w-5 h-5 text-amber-400" />
                  Étape 2 : Personnalisation Visuelle & Aperçu Facture Direct
                </h3>
                <p className="text-xs text-slate-400">
                  Importez votre logo depuis votre appareil et vérifiez le rendu direct sur la facture finale.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form Inputs & Upload Button */}
                <div className="lg:col-span-6 space-y-4">
                  {/* File Upload Box */}
                  <div className="p-4 bg-slate-800/70 rounded-2xl border border-slate-700 space-y-3">
                    <label className="text-xs font-bold text-slate-200 block">
                      Logo Officiel de l'Agence
                    </label>

                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden p-1 shadow-inner shrink-0">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-500" />
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md transition">
                          <Upload className="w-4 h-4" /> Parcourir et importer un logo
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                            onChange={handleLogoFileUpload}
                            className="hidden"
                          />
                        </label>
                        <p className="text-[10px] text-slate-400">
                          Formats : PNG, JPG, JPEG, SVG, WebP (Max 2 Mo).
                        </p>
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl('')}
                            className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Supprimer le logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">Texte d'En-tête des documents</label>
                    <Input
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      placeholder="Ex: PRESTATIONS NUMÉRIQUES & SERVICES"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">Pied de Page (Mentions Légales, RCCM, NIF)</label>
                    <textarea
                      rows={2}
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      placeholder="Ex: NIF: 100234890 - RCCM/GC-KAL/2024 - Merci pour votre fidélité !"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                {/* LIVE INVOICE PREVIEW */}
                <div className="lg:col-span-6 bg-white text-slate-900 p-5 rounded-2xl shadow-2xl border border-slate-300 text-[11px] leading-relaxed relative flex flex-col justify-between min-h-[380px]">
                  <div>
                    {/* Header preview */}
                    <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                      <div className="flex items-center gap-2.5">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded-lg shadow-sm" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-brand-600 text-white font-black flex items-center justify-center text-base shadow-sm">
                            {agencyName.slice(0, 2).toUpperCase() || 'AG'}
                          </div>
                        )}
                        <div>
                          <h4 className="font-black text-sm text-slate-900 uppercase leading-tight">{agencyName || 'Nom de votre Centre'}</h4>
                          <p className="text-[10px] text-brand-600 font-semibold italic">{slogan}</p>
                          <p className="text-[9px] text-slate-500">{address} • {city}, {country}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-xs text-brand-700 block">FACTURE</span>
                        <span className="font-mono text-[10px] text-slate-700 font-bold">N° FAC-2026-0042</span>
                        <span className="text-[9px] text-slate-400 block">{new Date().toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>

                    <div className="py-1.5 text-[10px] text-center font-bold text-slate-700 bg-slate-50 border-y border-slate-200 my-2 uppercase">
                      {headerText}
                    </div>

                    {/* Sample Table */}
                    <table className="w-full my-2 border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b border-slate-300 text-slate-700 bg-slate-100 font-bold">
                          <th className="text-left py-1 px-1.5">Désignation</th>
                          <th className="text-center py-1 px-1.5">Qté</th>
                          <th className="text-right py-1 px-1.5">P.U ({currency})</th>
                          <th className="text-right py-1 px-1.5">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="py-1 px-1.5 font-medium">Articles & Prestations Agence</td>
                          <td className="text-center py-1 px-1.5">10</td>
                          <td className="text-right py-1 px-1.5">5 000</td>
                          <td className="text-right py-1 px-1.5 font-bold">50 000</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="flex justify-end pt-1">
                      <div className="text-right font-black text-xs text-emerald-950 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                        NET À PAYER : 50 000 {currency}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-200 text-center">
                    <p className="text-[8px] text-slate-500 font-medium">
                      {footerText} • Tél: {phone} • Email: {email}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 3 : ÉQUIPE ET SÉCURITÉ */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  Étape 3 : Équipe & Sécurité d'Accès
                </h3>
                <p className="text-xs text-slate-400">
                  Configurez les collaborateurs rattachés à cette agence avec leurs fonctions respectives.
                </p>
              </div>

              {/* Admin Principal Display */}
              <div className="bg-gradient-to-r from-amber-950/40 via-slate-800 to-emerald-950/40 p-4 rounded-2xl border border-amber-500/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-base shadow-md">
                    👑
                  </div>
                  <div>
                    <span className="font-extrabold text-white text-sm block">ADMINISTRATEUR PRINCIPAL</span>
                    <span className="text-xs text-amber-300 font-medium">
                      Compte Direction : @{currentUser?.username || 'admin'} • Tous les droits de gestion et de validation
                    </span>
                  </div>
                </div>
                <Badge variant="warning" className="font-bold text-xs">
                  Responsable Agence
                </Badge>
              </div>

              {/* Add Collaborator Form */}
              <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  Ajouter un Collaborateur
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    label="Nom de famille *"
                    value={newUserLastName}
                    onChange={(e) => setNewUserLastName(e.target.value)}
                    placeholder="Camara"
                    className="bg-slate-900 border-slate-700 text-xs text-white"
                  />
                  <Input
                    label="Prénom"
                    value={newUserFirstName}
                    onChange={(e) => setNewUserFirstName(e.target.value)}
                    placeholder="Mariama"
                    className="bg-slate-900 border-slate-700 text-xs text-white"
                  />
                  <Input
                    label="Identifiant Login *"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    placeholder="mariama.c"
                    className="bg-slate-900 border-slate-700 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Fonction Métier</label>
                    <Select
                      value={newUserFunction}
                      onChange={(e) => setNewUserFunction(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-xs text-white"
                    >
                      <option value="Caissier">Caissier / Caissière</option>
                      <option value="Gestionnaire de stock">Gestionnaire de stock</option>
                      <option value="Vendeur">Vendeur / Vendeuse</option>
                      <option value="Responsable boutique">Responsable boutique</option>
                      <option value="Responsable formation">Responsable formation</option>
                      <option value="Formateur">Formateur / Enseignant</option>
                      <option value="Secrétaire">Secrétaire / Opérateur PAO</option>
                      <option value="Comptable">Comptable / Trésorier</option>
                      <option value="Autre">Autre collaborateur</option>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Rôle Système</label>
                    <Select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as RoleCode)}
                      className="bg-slate-900 border-slate-700 text-xs text-white"
                    >
                      <option value="CAISSIER">Caissier (Ventes & Caisse)</option>
                      <option value="GESTIONNAIRE">Gestionnaire (Stock/Opérations)</option>
                      <option value="OPERATEUR">Opérateur Production</option>
                      <option value="ADMIN">Co-Administrateur</option>
                    </Select>
                  </div>

                  <PhoneInput
                    label="Téléphone"
                    value={newUserPhone}
                    onValueChange={(val) => setNewUserPhone(val)}
                    placeholder="+224 620 00 00 00"
                    className="bg-slate-900 border-slate-700 text-xs text-white"
                  />

                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={handleAddCollaborator}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Ajouter
                    </Button>
                  </div>
                </div>
              </div>

              {/* List of Collaborators */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 block">Collaborateurs configurés ({teamMembers.length})</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {teamMembers.map((u, i) => (
                    <div key={i} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-brand-600/30 text-brand-300 font-bold flex items-center justify-center text-xs border border-brand-500/30">
                          {u.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">{u.fullName}</span>
                          <span className="text-[10px] text-slate-400">{u.functionTitle || u.role} • @{u.username}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTeamMembers(teamMembers.filter((_, idx) => idx !== i))}
                        className="text-rose-400 hover:bg-rose-950/40 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 4 : SERVICES OU PRODUITS INITIAUX (DYNAMIQUE) */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-brand-400" />
                  Étape 4 : Services & Activités Principales
                </h3>
                <p className="text-xs text-slate-400">
                  {activityType === 'RETAIL_STORE'
                    ? "Pour une boutique, saisissez vos premiers produits à commercialiser."
                    : "Activez et personnalisez les prestations proposées par votre centre."}
                </p>
              </div>

              {/* CAS 1: PRESTATIONS & SERVICES */}
              {(activityType === 'SERVICE_CENTER' || activityType === 'MIXED') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-brand-300 uppercase tracking-wider">
                      Prestations & Tarifs de Base
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {servicesList.filter(s => s.isSelected).length} activé(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {servicesList.map((srv, idx) => (
                      <div
                        key={srv.code}
                        className={`p-3 rounded-xl border transition ${
                          srv.isSelected
                            ? 'bg-slate-800/90 border-brand-500/50 shadow-md'
                            : 'bg-slate-900/40 border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={srv.isSelected}
                              onChange={() => {
                                const copy = [...servicesList];
                                copy[idx].isSelected = !copy[idx].isSelected;
                                setServicesList(copy);
                              }}
                              className="rounded text-brand-500 focus:ring-0"
                            />
                            <span className="text-xs font-bold text-white leading-tight">{srv.name}</span>
                          </label>
                          <Badge variant="outline" className="text-[9px]">{srv.unit}</Badge>
                        </div>

                        {srv.isSelected && (
                          <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">Tarif :</span>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={srv.basePrice}
                                onChange={(e) => {
                                  const copy = [...servicesList];
                                  copy[idx].basePrice = Number(e.target.value);
                                  setServicesList(copy);
                                }}
                                className="w-24 bg-slate-900 border-slate-700 text-xs text-right font-bold text-emerald-400 h-7"
                              />
                              <span className="text-[10px] text-slate-400">{currency}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Custom Service */}
                  <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="Nom du nouveau service..."
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-xs text-white flex-1 min-w-[200px]"
                    />
                    <Input
                      type="number"
                      placeholder="Prix"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(Number(e.target.value))}
                      className="bg-slate-900 border-slate-700 text-xs text-white w-24"
                    />
                    <Button size="sm" onClick={handleAddService} className="bg-brand-600 hover:bg-brand-500 text-xs font-bold">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter Service
                    </Button>
                  </div>
                </div>
              )}

              {/* CAS 2: BOUTIQUE - PRODUITS INITIAUX */}
              {(activityType === 'RETAIL_STORE' || activityType === 'MIXED') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Produits Initiaux de la Boutique
                    </h4>
                    <span className="text-[10px] text-slate-400">{shopProducts.length} article(s)</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-400 bg-slate-800/80 font-bold">
                          <th className="p-2">Produit</th>
                          <th className="p-2">Catégorie</th>
                          <th className="p-2 text-right">Prix Achat</th>
                          <th className="p-2 text-right">Prix Vente</th>
                          <th className="p-2 text-center">Qté Initiale</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {shopProducts.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="p-2 font-bold text-white">{p.name}</td>
                            <td className="p-2 text-slate-400">{p.category}</td>
                            <td className="p-2 text-right font-mono">{formatCurrency(p.costPrice, currency)}</td>
                            <td className="p-2 text-right font-mono font-bold text-emerald-400">{formatCurrency(p.sellingPrice, currency)}</td>
                            <td className="p-2 text-center">
                              <Badge variant="primary" className="text-[10px]">
                                {p.initialStock} {p.unit}s
                              </Badge>
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShopProducts(shopProducts.filter((_, i) => i !== idx))}
                                className="text-rose-400 hover:bg-rose-950/40 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Product Form */}
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 grid grid-cols-1 sm:grid-cols-6 gap-2">
                    <Input
                      placeholder="Nom article..."
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      className="sm:col-span-2 bg-slate-900 border-slate-700 text-xs text-white"
                    />
                    <Input
                      type="number"
                      placeholder="Prix Achat"
                      value={newProdCostPrice}
                      onChange={(e) => setNewProdCostPrice(Number(e.target.value))}
                      className="bg-slate-900 border-slate-700 text-xs text-white"
                    />
                    <Input
                      type="number"
                      placeholder="Prix Vente"
                      value={newProdSellingPrice}
                      onChange={(e) => setNewProdSellingPrice(Number(e.target.value))}
                      className="bg-slate-900 border-slate-700 text-xs text-white"
                    />
                    <Input
                      type="number"
                      placeholder="Stock"
                      value={newProdQty}
                      onChange={(e) => setNewProdQty(Number(e.target.value))}
                      className="bg-slate-900 border-slate-700 text-xs text-white"
                    />
                    <Button onClick={handleAddShopProduct} className="bg-emerald-600 hover:bg-emerald-500 text-xs font-bold">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 5 : TARIFS ET RÈGLEMENTS */}
          {/* ========================================================================= */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Percent className="w-5 h-5 text-amber-400" />
                  Étape 5 : Tarifs, Remises & Modes de Règlement
                </h3>
                <p className="text-xs text-slate-400">
                  Définissez les règles commerciales et les moyens de paiement acceptés au comptoir.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    Contrôle des Remises & Réductions
                  </h4>
                  <div>
                    <label className="text-xs font-semibold text-slate-200 block mb-1">
                      Remise max autorisée aux caissiers sans mot de passe Admin (%)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={maxDiscountWithoutApprovalPct}
                      onChange={(e) => setMaxDiscountWithoutApprovalPct(Number(e.target.value))}
                      className="w-28 bg-slate-900 border-slate-700 text-sm font-bold text-white"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-300 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowDiscounts}
                      onChange={(e) => setAllowDiscounts(e.target.checked)}
                      className="rounded text-brand-500 focus:ring-0"
                    />
                    Autoriser les remises exceptionnelles au comptoir
                  </label>
                </div>

                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Modes de Paiement Acceptés
                  </h4>
                  <div className="space-y-2 text-xs text-slate-300">
                    {[
                      { id: 'CASH', label: '💵 Paiement Comptant (Espèces)' },
                      { id: 'ORANGE_MONEY', label: '📱 Orange Money Guinée' },
                      { id: 'MTN_MOMO', label: '📱 MTN Mobile Money' },
                      { id: 'BANK_TRANSFER', label: '🏦 Virement Bancaire & Chèque' },
                    ].map(pm => (
                      <label key={pm.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acceptedPaymentMethods.includes(pm.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAcceptedPaymentMethods([...acceptedPaymentMethods, pm.id]);
                            } else {
                              setAcceptedPaymentMethods(acceptedPaymentMethods.filter(m => m !== pm.id));
                            }
                          }}
                          className="rounded text-brand-500 focus:ring-0"
                        />
                        <span>{pm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 6 : MODULE FORMATION (OPTIONNEL) */}
          {/* ========================================================================= */}
          {currentStep === 6 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-emerald-400" />
                    Étape 6 : Configuration du Module Formation
                  </h3>
                  <p className="text-xs text-slate-400">
                    Activité de cours, formations professionnelles et certificats.
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                  <span className="text-xs font-bold text-slate-300">Activer le module :</span>
                  <button
                    type="button"
                    onClick={() => setHasTrainingModule(!hasTrainingModule)}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                      hasTrainingModule ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {hasTrainingModule ? 'OUI' : 'NON'}
                  </button>
                </div>
              </div>

              {hasTrainingModule ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {trainingCourses.map((crs, idx) => (
                      <div key={crs.code} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-2">
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-bold text-white block">{crs.title}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTrainingCourses(trainingCourses.filter((_, i) => i !== idx))}
                            className="text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Durée : {crs.durationWeeks} semaines</span>
                          <span className="font-bold text-emerald-400 font-mono">{formatCurrency(crs.price, currency)}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">{crs.description}</p>
                      </div>
                    ))}
                  </div>

                  {/* Add Course Form */}
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Input
                      placeholder="Intitulé de la formation..."
                      value={newCourseTitle}
                      onChange={(e) => setNewCourseTitle(e.target.value)}
                      className="sm:col-span-2 bg-slate-900 border-slate-700 text-xs text-white"
                    />
                    <Input
                      type="number"
                      placeholder="Semaines"
                      value={newCourseWeeks}
                      onChange={(e) => setNewCourseWeeks(Number(e.target.value))}
                      className="bg-slate-900 border-slate-700 text-xs text-white"
                    />
                    <Input
                      type="number"
                      placeholder="Montant"
                      value={newCoursePrice}
                      onChange={(e) => setNewCoursePrice(Number(e.target.value))}
                      className="bg-slate-900 border-slate-700 text-xs text-white"
                    />
                    <Button onClick={handleAddCourse} className="sm:col-span-4 bg-brand-600 hover:bg-brand-500 text-xs font-bold">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter cette formation
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/40 p-8 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs space-y-2">
                  <p className="font-bold text-slate-300">Module Formation désactivé.</p>
                  <p>Cette agence ne proposera pas de cours ni d'inscriptions aux apprenants.</p>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 7 : BOUTIQUE, ARTICLES ET STOCK INITIAL */}
          {/* ========================================================================= */}
          {currentStep === 7 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Store className="w-5 h-5 text-amber-400" />
                    Étape 7 : Stock Initial & Consommables
                  </h3>
                  <p className="text-xs text-slate-400">
                    Définissez les articles et stocks initiaux disponibles dans cette agence.
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                  <span className="text-xs font-bold text-slate-300">Activer le stock :</span>
                  <button
                    type="button"
                    onClick={() => setHasShopModule(!hasShopModule)}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                      hasShopModule ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {hasShopModule ? 'OUI' : 'NON'}
                  </button>
                </div>
              </div>

              {hasShopModule ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {shopProducts.map((p, idx) => (
                      <div key={idx} className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-bold text-white block">{p.name}</span>
                            <span className="text-[10px] text-slate-400">{p.category}</span>
                          </div>
                          <Badge variant="success" className="text-[10px]">
                            {p.initialStock} {p.unit}s en stock
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700">
                          <span className="text-slate-400">Achat: {formatCurrency(p.costPrice, currency)}</span>
                          <span className="font-bold text-emerald-400 font-mono">Vente: {formatCurrency(p.sellingPrice, currency)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/40 p-8 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs">
                  Module stock & articles désactivé.
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 8 : FOURNISSEURS */}
          {/* ========================================================================= */}
          {currentStep === 8 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-brand-400" />
                  Étape 8 : Répertoire des Fournisseurs
                </h3>
                <p className="text-xs text-slate-400">
                  Enregistrez vos fournisseurs partenaires pour le réapprovisionnement de cette agence.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suppliersList.map((sup, idx) => (
                  <div key={idx} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold text-white block">{sup.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSuppliersList(suppliersList.filter((_, i) => i !== idx))}
                        className="text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-400">📞 {sup.phone} • {sup.address}</p>
                    <p className="text-[10px] text-brand-300 font-medium">{sup.suppliedProducts}</p>
                  </div>
                ))}
              </div>

              {/* Add Supplier Form */}
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-2">
                <Input
                  placeholder="Nom fournisseur..."
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-xs text-white"
                />
                <PhoneInput
                  placeholder="Téléphone"
                  value={newSupPhone}
                  onValueChange={(val) => setNewSupPhone(val)}
                  className="bg-slate-900 border-slate-700 text-xs text-white"
                />
                <Input
                  placeholder="Produits fournis..."
                  value={newSupProducts}
                  onChange={(e) => setNewSupProducts(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-xs text-white"
                />
                <Button onClick={handleAddSupplier} className="bg-emerald-600 hover:bg-emerald-500 text-xs font-bold">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 9 : FINANCE ET TRÉSORERIE */}
          {/* ========================================================================= */}
          {currentStep === 9 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-brand-400" />
                  Étape 9 : Trésorerie & Caisses du Centre
                </h3>
                <p className="text-xs text-slate-400">
                  Configurez votre caisse principale et définissez le solde initial de départ (0 GNF ou montant libre).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {financialAccounts.map((acc, idx) => (
                  <div key={idx} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{acc.type === 'CASH' ? '💵' : '📱'}</span>
                        <div>
                          <span className="text-xs font-bold text-white block">{acc.name}</span>
                          <span className="text-[10px] text-slate-400">Responsable : {acc.responsiblePerson || 'Caissier'}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFinancialAccounts(financialAccounts.filter((_, i) => i !== idx))}
                        className="text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Solde Initial :</span>
                      <span className="font-bold text-emerald-400 font-mono text-sm">
                        {formatCurrency(acc.initialBalance, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Cash Account Form */}
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-2">
                <Input
                  placeholder="Nom de la caisse (ex: Caisse Boutique)..."
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-xs text-white"
                />
                <Select
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-xs text-white"
                >
                  <option value="CASH">Caisse Physique</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="BANK">Banque</option>
                </Select>
                <Input
                  type="number"
                  placeholder="Solde initial (ex: 0)"
                  value={newAccBalance}
                  onChange={(e) => setNewAccBalance(Number(e.target.value))}
                  className="bg-slate-900 border-slate-700 text-xs text-white"
                />
                <Button onClick={handleAddFinancialAccount} className="bg-emerald-600 hover:bg-emerald-500 text-xs font-bold">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Créer la Caisse
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 10 : RÉCAPITULATIF GÉNÉRAL AVANT VALIDATION */}
          {/* ========================================================================= */}
          {currentStep === 10 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 p-5 rounded-2xl border border-emerald-500/40 text-center space-y-2">
                <h3 className="text-xl font-black text-white">
                  Récapitulatif Général de la Configuration
                </h3>
                <p className="text-xs text-slate-300 max-w-xl mx-auto">
                  Vérifiez attentivement les 9 sections ci-dessous. Vous pouvez modifier n'importe quelle section avant de valider.
                </p>
              </div>

              {/* 9 Summary Sections */}
              <div className="space-y-3">
                {/* Section 1 */}
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">1. Coordonnées de l'Agence</span>
                    <span className="text-[11px] text-slate-400">{agencyName} ({activityType}) • {phone} • {city}, {country}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCurrentStep(1)} className="text-xs text-brand-300 border-slate-600">
                    <Edit className="w-3 h-3 mr-1" /> Modifier
                  </Button>
                </div>

                {/* Section 2 */}
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">2. Personnalisation Visuelle</span>
                    <span className="text-[11px] text-slate-400">{logoUrl ? "Logo importé" : "Logo par défaut"} • {headerText}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCurrentStep(2)} className="text-xs text-brand-300 border-slate-600">
                    <Edit className="w-3 h-3 mr-1" /> Modifier
                  </Button>
                </div>

                {/* Section 3 */}
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">3. Administrateur & Collaborateurs</span>
                    <span className="text-[11px] text-slate-400">Admin principal + {teamMembers.length} collaborateur(s)</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCurrentStep(3)} className="text-xs text-brand-300 border-slate-600">
                    <Edit className="w-3 h-3 mr-1" /> Modifier
                  </Button>
                </div>

                {/* Section 4 */}
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">4. Services & Activités</span>
                    <span className="text-[11px] text-slate-400">{servicesList.filter(s => s.isSelected).length} service(s) activé(s)</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCurrentStep(4)} className="text-xs text-brand-300 border-slate-600">
                    <Edit className="w-3 h-3 mr-1" /> Modifier
                  </Button>
                </div>

                {/* Section 5 */}
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">5. Tarifs & Règlements</span>
                    <span className="text-[11px] text-slate-400">Remise max sans Admin : {maxDiscountWithoutApprovalPct}% • {acceptedPaymentMethods.length} modes de paiement</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCurrentStep(5)} className="text-xs text-brand-300 border-slate-600">
                    <Edit className="w-3 h-3 mr-1" /> Modifier
                  </Button>
                </div>

                {/* Section 6 */}
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">6. Module Formation</span>
                    <span className="text-[11px] text-slate-400">{hasTrainingModule ? `${trainingCourses.length} formation(s) configurée(s)` : "Module Formation désactivé"}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCurrentStep(6)} className="text-xs text-brand-300 border-slate-600">
                    <Edit className="w-3 h-3 mr-1" /> Modifier
                  </Button>
                </div>

                {/* Section 7 */}
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">7. Boutique & Stock Initial</span>
                    <span className="text-[11px] text-slate-400">{hasShopModule ? `${shopProducts.length} article(s) initialisé(s)` : "Module stock désactivé"}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCurrentStep(7)} className="text-xs text-brand-300 border-slate-600">
                    <Edit className="w-3 h-3 mr-1" /> Modifier
                  </Button>
                </div>

                {/* Section 8 */}
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">8. Fournisseurs</span>
                    <span className="text-[11px] text-slate-400">{suppliersList.length} fournisseur(s) enregistré(s)</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCurrentStep(8)} className="text-xs text-brand-300 border-slate-600">
                    <Edit className="w-3 h-3 mr-1" /> Modifier
                  </Button>
                </div>

                {/* Section 9 */}
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">9. Trésorerie & Caisses</span>
                    <span className="text-[11px] text-slate-400">{financialAccounts.length} caisse(s) / compte(s)</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCurrentStep(9)} className="text-xs text-brand-300 border-slate-600">
                    <Edit className="w-3 h-3 mr-1" /> Modifier
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-between gap-4">
          <div>
            {currentStep > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(currentStep - 1)}
                disabled={isSubmitting}
                className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Précédent
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep < 10 ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Passer cette étape
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveStep(currentStep, false)}
                  disabled={isSubmitting}
                  className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-5"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-1.5" />
                  )}
                  Continuer
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => handleSaveStep(10, true)}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold px-6 shadow-lg shadow-emerald-900/40 text-xs uppercase tracking-wider"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                )}
                VALIDER ET TERMINER LA CONFIGURATION
              </Button>
            )}
          </div>
        </div>

      </div>
    </Modal>
  );
};