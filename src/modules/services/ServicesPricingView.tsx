import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { dbStore, INITIAL_STATE } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  Service,
  ServiceOption,
  ServiceConfiguration,
  ServiceConsumableRule,
  ServicePriceHistory,
  Product
} from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  Tag, Plus, Edit, Trash2, Search, History,
  CheckCircle2, AlertCircle, Layers, Power, Sparkles, Filter, Info,
  ShieldCheck, BarChart3, Package, Check, X, BoxSelect, Settings2,
  Boxes, ArrowRight, Sliders, ToggleLeft, ToggleRight
} from 'lucide-react';
import {
  getServiceOptions,
  getServiceConfigurations,
  formatCompactOptionValues,
  formatConfigOptionValues,
  getCanonicalServiceKey
} from '../../lib/serviceSpecs';

const COMMON_BILLING_UNITS = [
  { value: 'page', label: '📄 Page (ex: Photocopie, Impression, Scan)' },
  { value: 'document', label: '📑 Document (ex: Reliure, Plastification)' },
  { value: 'feuille', label: '📃 Feuille (ex: Tirage bristol, cartonné)' },
  { value: 'exemplaire', label: '📚 Exemplaire (ex: Brochure, Rapport)' },
  { value: 'prestation', label: '🛠️ Prestation (ex: Conseil, Orientation)' },
  { value: 'heure', label: '⏱️ Heure (ex: Formation, Location poste PC)' },
  { value: 'seance', label: '🎓 Séance / Atelier' },
  { value: 'forfait', label: '💼 Forfait / Pack global' },
  { value: 'planche', label: '🖼️ Planche (ex: Photo d\'identité)' },
  { value: 'piece', label: '📦 Pièce / Unité (ex: Badge, Clé USB)' },
  { value: 'm2', label: '📐 Mètre carré (m²) (ex: Bâche, Vinyle)' }
];

export const ServicesPricingView: React.FC = () => {
  const { currentTenant, currentUser, hasPermission } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const [activeTab, setActiveTab] = useState<'services' | 'history' | 'discounts'>('services');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Unique Cleaned Services List (Guarantees each service type appears strictly once)
  const uniqueServices = useMemo(() => {
    const rawServices = state.services || [];
    const seen = new Set<string>();
    const deduplicated: Service[] = [];

    // Prioritize services with configured options/configurations
    const sorted = [...rawServices].sort((a, b) => {
      const aIsInit = a.id.startsWith('srv-') && a.id.length <= 6 ? 100 : 0;
      const bIsInit = b.id.startsWith('srv-') && b.id.length <= 6 ? 100 : 0;
      const aScore = aIsInit + (a.options?.length || 0) * 10 + (a.configurations?.length || 0) + (a.isActive ? 5 : 0);
      const bScore = bIsInit + (b.options?.length || 0) * 10 + (b.configurations?.length || 0) + (b.isActive ? 5 : 0);
      return bScore - aScore;
    });

    for (const s of sorted) {
      const key = getCanonicalServiceKey(s.name, s.code);
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(s);
      }
    }

    return deduplicated;
  }, [state.services]);

  // Selected Service in Master-Detail view
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    uniqueServices[0]?.id || ''
  );

  // Synchronize selectedServiceId when services change
  React.useEffect(() => {
    if (uniqueServices.length > 0 && !uniqueServices.some(s => s.id === selectedServiceId)) {
      setSelectedServiceId(uniqueServices[0].id);
    }
  }, [uniqueServices, selectedServiceId]);

  // Modals State
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<Service | null>(null);

  // Configuration Modal State (Single Unified Configurator)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configToEdit, setConfigToEdit] = useState<ServiceConfiguration | null>(null);
  const [configOptionValues, setConfigOptionValues] = useState<Record<string, string>>({});
  const [configPrice, setConfigPrice] = useState<number>(500);
  const [configBillingUnit, setConfigBillingUnit] = useState<string>('page');
  const [configConsumables, setConfigConsumables] = useState<ServiceConsumableRule[]>([]);
  const [configIsActive, setConfigIsActive] = useState<boolean>(true);

  // Option Modal State (Add New Option dynamically)
  const [isAddOptionModalOpen, setIsAddOptionModalOpen] = useState(false);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionValuesInput, setNewOptionValuesInput] = useState('');

  // Add Option Value inline State
  const [addingValueToOptionId, setAddingValueToOptionId] = useState<string | null>(null);
  const [newOptionValueText, setNewOptionValueText] = useState('');

  // Service Create / Edit Form State
  const [srvName, setSrvName] = useState('');
  const [srvCategoryId, setSrvCategoryId] = useState(state.serviceCategories[0]?.id || 'sc-01');
  const [srvUnit, setSrvUnit] = useState('page');
  const [srvBasePrice, setSrvBasePrice] = useState(500);
  const [srvBaseCost, setSrvBaseCost] = useState(150);
  const [srvDescription, setSrvDescription] = useState('');
  const [srvIsActive, setSrvIsActive] = useState(true);

  // Categories Map
  const categoriesMap = useMemo(() => {
    const map = new Map<string, string>();
    (state.serviceCategories || []).forEach(c => map.set(c.id, c.name));
    return map;
  }, [state.serviceCategories]);

  // Filtered Services List
  const filteredServices = useMemo(() => {
    return uniqueServices.filter(s => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(search.toLowerCase())) ||
        (s.categoryName && s.categoryName.toLowerCase().includes(search.toLowerCase()));

      const matchesCat = categoryFilter === 'ALL' || s.categoryId === categoryFilter;
      const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? s.isActive : !s.isActive);

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [uniqueServices, search, categoryFilter, statusFilter]);

  // Selected Service
  const selectedService = useMemo(() => {
    const found = uniqueServices.find(s => s.id === selectedServiceId);
    return found || filteredServices[0] || uniqueServices[0] || state.services[0];
  }, [uniqueServices, selectedServiceId, filteredServices, state.services]);


  // Available Stock Products for Consumables
  const availableProducts = useMemo(() => {
    return (state.products || []).filter(p => p.isActive && !p.isArchived);
  }, [state.products]);

  // ==========================================
  // SERVICE ACTIONS
  // ==========================================

  const handleOpenAddService = () => {
    setSrvName('');
    setSrvCategoryId(state.serviceCategories[0]?.id || 'sc-01');
    setSrvUnit('page');
    setSrvBasePrice(500);
    setSrvBaseCost(150);
    setSrvDescription('');
    setSrvIsActive(true);
    setIsAddServiceModalOpen(true);
  };

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName.trim()) {
      showToast('Erreur', 'Veuillez saisir le nom de la prestation.', 'DANGER');
      return;
    }

    const cat = state.serviceCategories.find(c => c.id === srvCategoryId);
    const code = srvName.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 20);
    const newId = `srv-${Date.now()}`;

    const newService: Service = {
      id: newId,
      tenantId: currentTenant?.id || 't-001',
      categoryId: srvCategoryId,
      categoryName: cat?.name || 'Prestations Générales',
      code: `SRV-${code}`,
      name: srvName.trim(),
      description: srvDescription.trim() || undefined,
      unit: srvUnit,
      baseCost: srvBaseCost || 0,
      basePrice: srvBasePrice || 0,
      requiresFile: false,
      estimatedDurationMinutes: 5,
      isActive: srvIsActive,
      options: [],
      configurations: [
        {
          id: `cfg-${newId}-1`,
          serviceId: newId,
          optionValues: {},
          price: srvBasePrice || 0,
          billingUnit: srvUnit,
          consumables: [],
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ],
      pricingRules: []
    };

    dbStore.updateState(draft => {
      draft.services.unshift(newService);
    });

    setSelectedServiceId(newId);
    showToast('Prestation Créée', `Le service "${newService.name}" a été créé avec succès.`, 'SUCCESS');
    setIsAddServiceModalOpen(false);
  };

  const handleOpenEditService = (service: Service) => {
    setServiceToEdit(service);
    setSrvName(service.name);
    setSrvCategoryId(service.categoryId);
    setSrvUnit(service.unit);
    setSrvBasePrice(service.basePrice);
    setSrvBaseCost(service.baseCost || 0);
    setSrvDescription(service.description || '');
    setSrvIsActive(service.isActive);
  };

  const handleSaveEditService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceToEdit) return;

    const cat = state.serviceCategories.find(c => c.id === srvCategoryId);

    dbStore.updateState(draft => {
      const srv = draft.services.find(s => s.id === serviceToEdit.id);
      if (srv) {
        srv.name = srvName.trim();
        srv.categoryId = srvCategoryId;
        srv.categoryName = cat?.name || srv.categoryName;
        srv.unit = srvUnit;
        srv.basePrice = srvBasePrice;
        srv.baseCost = srvBaseCost;
        srv.description = srvDescription.trim() || undefined;
        srv.isActive = srvIsActive;
        srv.updatedAt = new Date().toISOString();
      }
    });

    showToast('Modifications Enregistrées', `Le service "${srvName}" a été mis à jour.`, 'SUCCESS');
    setServiceToEdit(null);
  };

  const handleToggleServiceStatus = (service: Service) => {
    dbStore.updateState(draft => {
      const srv = draft.services.find(s => s.id === service.id);
      if (srv) {
        srv.isActive = !srv.isActive;
        srv.updatedAt = new Date().toISOString();
      }
    });
    showToast(
      service.isActive ? 'Service Désactivé' : 'Service Activé',
      `Le service "${service.name}" est maintenant ${service.isActive ? 'inactif' : 'actif'}.`,
      'INFO'
    );
  };

  // ==========================================
  // OPTIONS & VALUES ACTIONS
  // ==========================================

  const handleOpenAddOption = () => {
    setNewOptionName('');
    setNewOptionValuesInput('');
    setIsAddOptionModalOpen(true);
  };

  const handleAddOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !newOptionName.trim()) return;

    const values = newOptionValuesInput
      .split(/[,;\n]/)
      .map(v => v.trim())
      .filter(Boolean);

    if (values.length === 0) {
      showToast('Valeurs Requises', 'Veuillez saisir au moins une valeur pour cette option (ex: A4, A3).', 'WARNING');
      return;
    }

    const newOption: ServiceOption = {
      id: `opt-${Date.now()}`,
      name: newOptionName.trim(),
      values: Array.from(new Set(values))
    };

    dbStore.updateState(draft => {
      const srv = draft.services.find(s => s.id === selectedService.id);
      if (srv) {
        if (!srv.options) srv.options = [];
        srv.options.push(newOption);
        srv.updatedAt = new Date().toISOString();
      }
    });

    showToast('Option Ajoutée', `L'option "${newOption.name}" a été ajoutée avec ${values.length} valeur(s).`, 'SUCCESS');
    setIsAddOptionModalOpen(false);
  };

  const handleDeleteOption = (optionId: string, optionName: string) => {
    if (!selectedService) return;
    if (!window.confirm(`Supprimer l'option "${optionName}" et ses valeurs associées ?`)) return;

    dbStore.updateState(draft => {
      const srv = draft.services.find(s => s.id === selectedService.id);
      if (srv && srv.options) {
        srv.options = srv.options.filter(o => o.id !== optionId);
        srv.updatedAt = new Date().toISOString();
      }
    });

    showToast('Option Supprimée', `L'option "${optionName}" a été retirée du service.`, 'INFO');
  };

  const handleAddValueToOption = (optionId: string) => {
    if (!selectedService || !newOptionValueText.trim()) return;

    dbStore.updateState(draft => {
      const srv = draft.services.find(s => s.id === selectedService.id);
      if (srv && srv.options) {
        const opt = srv.options.find(o => o.id === optionId);
        if (opt && !opt.values.includes(newOptionValueText.trim())) {
          opt.values.push(newOptionValueText.trim());
          srv.updatedAt = new Date().toISOString();
        }
      }
    });

    setNewOptionValueText('');
    setAddingValueToOptionId(null);
    showToast('Valeur Ajoutée', 'La nouvelle valeur est disponible pour les configurations.', 'SUCCESS');
  };

  const handleDeleteOptionValue = (optionId: string, valToRemove: string) => {
    if (!selectedService) return;

    dbStore.updateState(draft => {
      const srv = draft.services.find(s => s.id === selectedService.id);
      if (srv && srv.options) {
        const opt = srv.options.find(o => o.id === optionId);
        if (opt) {
          opt.values = opt.values.filter(v => v !== valToRemove);
          srv.updatedAt = new Date().toISOString();
        }
      }
    });

    showToast('Valeur Supprimée', `La valeur "${valToRemove}" a été supprimée.`, 'INFO');
  };

  // ==========================================
  // CONFIGURATIONS ACTIONS (SINGLE MODAL)
  // ==========================================

  const handleOpenAddConfig = () => {
    if (!selectedService) return;
    const srvOptions = getServiceOptions(selectedService);

    // Build default selected values for each defined option
    const initialVals: Record<string, string> = {};
    srvOptions.forEach(opt => {
      initialVals[opt.name] = opt.values[0] || '';
    });

    setConfigToEdit(null);
    setConfigOptionValues(initialVals);
    setConfigPrice(selectedService.basePrice || 500);
    setConfigBillingUnit(selectedService.unit || 'page');
    setConfigConsumables(
      (selectedService.consumables || []).map(c => ({
        productId: c.productId,
        productName: c.productName,
        quantityPerUnit: c.quantityPerUnit || 1,
        unit: c.unit || 'feuille',
        isClientSupplied: Boolean(c.isClientSupplied)
      }))
    );
    setConfigIsActive(true);
    setIsConfigModalOpen(true);
  };

  const handleOpenEditConfig = (config: ServiceConfiguration) => {
    if (!selectedService) return;
    const srvOptions = getServiceOptions(selectedService);

    const mergedVals: Record<string, string> = {};
    srvOptions.forEach(opt => {
      mergedVals[opt.name] = config.optionValues?.[opt.name] || opt.values[0] || '';
    });

    setConfigToEdit(config);
    setConfigOptionValues(mergedVals);
    setConfigPrice(config.price);
    setConfigBillingUnit(config.billingUnit || selectedService.unit || 'page');
    setConfigConsumables(
      (config.consumables || []).map(c => ({
        productId: c.productId,
        productName: c.productName,
        quantityPerUnit: c.quantityPerUnit || 1,
        unit: c.unit || 'feuille',
        isClientSupplied: Boolean(c.isClientSupplied)
      }))
    );
    setConfigIsActive(config.isActive !== false);
    setIsConfigModalOpen(true);
  };

  const handleAddConsumableRow = () => {
    const firstProd = availableProducts[0];
    if (!firstProd) {
      showToast('Stock', 'Aucun article de stock disponible.', 'WARNING');
      return;
    }
    setConfigConsumables(prev => [
      ...prev,
      {
        productId: firstProd.id,
        productName: firstProd.name,
        quantityPerUnit: 1,
        unit: firstProd.unit || firstProd.baseUnit || 'feuille',
        isClientSupplied: false
      }
    ]);
  };

  const handleRemoveConsumableRow = (index: number) => {
    setConfigConsumables(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateConsumableRow = (index: number, updates: Partial<ServiceConsumableRule>) => {
    setConfigConsumables(prev => {
      const copy = [...prev];
      if (updates.productId) {
        const prod = availableProducts.find(p => p.id === updates.productId);
        copy[index] = {
          ...copy[index],
          ...updates,
          productName: prod?.name || copy[index].productName,
          unit: prod?.unit || prod?.baseUnit || copy[index].unit
        };
      } else {
        copy[index] = { ...copy[index], ...updates };
      }
      return copy;
    });
  };

  const handleSaveConfiguration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    if (configPrice < 0) {
      showToast('Prix Invalide', 'Le tarif unitaire ne peut pas être négatif.', 'DANGER');
      return;
    }

    const srvOptions = getServiceOptions(selectedService);
    // Sanitize option values
    const finalOptionValues: Record<string, string> = {};
    srvOptions.forEach(opt => {
      finalOptionValues[opt.name] = configOptionValues[opt.name] || opt.values[0] || '';
    });

    const isEdit = Boolean(configToEdit);
    const configId = configToEdit ? configToEdit.id : `cfg-${selectedService.id}-${Date.now()}`;

    const savedConfig: ServiceConfiguration = {
      id: configId,
      serviceId: selectedService.id,
      optionValues: finalOptionValues,
      price: configPrice,
      billingUnit: configBillingUnit || selectedService.unit || 'prestation',
      consumables: configConsumables.map(c => ({
        productId: c.productId,
        productName: c.productName || availableProducts.find(p => p.id === c.productId)?.name || 'Consommable',
        quantityPerUnit: Number(c.quantityPerUnit) || 1,
        unit: c.unit || 'unité',
        isClientSupplied: Boolean(c.isClientSupplied)
      })),
      isActive: configIsActive,
      updatedAt: new Date().toISOString(),
      createdAt: configToEdit?.createdAt || new Date().toISOString()
    };

    dbStore.updateState(draft => {
      const srv = draft.services.find(s => s.id === selectedService.id);
      if (srv) {
        if (!srv.configurations) srv.configurations = [];
        if (isEdit) {
          const idx = srv.configurations.findIndex(c => c.id === configId);
          if (idx >= 0) {
            srv.configurations[idx] = savedConfig;
          } else {
            srv.configurations.push(savedConfig);
          }
        } else {
          srv.configurations.push(savedConfig);
        }
        srv.updatedAt = new Date().toISOString();
      }
    });

    showToast(
      isEdit ? 'Configuration Modifiée' : 'Configuration Ajoutée',
      `La configuration (${formatCompactOptionValues(finalOptionValues)}) à ${formatCurrency(configPrice)} / ${configBillingUnit} a été enregistrée.`,
      'SUCCESS'
    );
    setIsConfigModalOpen(false);
  };

  const handleToggleConfigStatus = (config: ServiceConfiguration) => {
    if (!selectedService) return;

    dbStore.updateState(draft => {
      const srv = draft.services.find(s => s.id === selectedService.id);
      if (srv && srv.configurations) {
        const cfg = srv.configurations.find(c => c.id === config.id);
        if (cfg) {
          cfg.isActive = !cfg.isActive;
          cfg.updatedAt = new Date().toISOString();
        }
      }
    });

    showToast(
      config.isActive ? 'Configuration Désactivée' : 'Configuration Activée',
      `La configuration est maintenant ${config.isActive ? 'inactive (masquée des commandes)' : 'active'}.`,
      'INFO'
    );
  };

  const handleDeleteConfig = (config: ServiceConfiguration) => {
    if (!selectedService) return;
    if (!window.confirm('Supprimer cette configuration ? (Conseil : vous pouvez plutôt la désactiver pour préserver les devis passés)')) {
      return;
    }

    dbStore.updateState(draft => {
      const srv = draft.services.find(s => s.id === selectedService.id);
      if (srv && srv.configurations) {
        srv.configurations = srv.configurations.filter(c => c.id !== config.id);
        srv.updatedAt = new Date().toISOString();
      }
    });

    showToast('Configuration Supprimée', 'La configuration a été supprimée.', 'INFO');
  };

  // Selected Service Options & Configurations
  const currentServiceOptions = useMemo(() => {
    return getServiceOptions(selectedService);
  }, [selectedService]);

  const currentServiceConfigurations = useMemo(() => {
    return getServiceConfigurations(selectedService);
  }, [selectedService]);

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-brand-900/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Services & Tarifs
                <Badge variant="primary" size="sm" className="bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs">
                  Configurateur Unique Standard
                </Badge>
              </h1>
              <p className="text-xs text-slate-300">
                Gérez vos prestations, options dynamiques, configurations autorisées, tarifs et recettes de consommation depuis une seule interface.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="primary"
            icon={Plus}
            onClick={handleOpenAddService}
            className="font-bold shadow-lg shadow-brand-900/40 bg-brand-600 hover:bg-brand-500 text-xs md:text-sm"
          >
            + Nouveau Service
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('services')}
          className={`py-3 px-5 text-xs md:text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'services'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Configurateur de Prestations ({uniqueServices.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-5 text-xs md:text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'history'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Historique des Tarifs
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: UNIFIED STANDARD SERVICES CONFIGURATOR */}
      {/* ========================================================= */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Service Selector & Filters (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Prestations ({filteredServices.length})</span>
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Rechercher une prestation..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs font-medium"
                  >
                    <option value="ALL">Toutes catégories</option>
                    {(state.serviceCategories || []).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>

                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs font-medium"
                  >
                    <option value="ALL">Tous statuts</option>
                    <option value="ACTIVE">Actifs uniquement</option>
                    <option value="INACTIVE">Inactifs</option>
                  </Select>
                </div>

                {/* Services List Cards */}
                <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                  {filteredServices.map(srv => {
                    const isSelected = srv.id === selectedService?.id;
                    const opts = getServiceOptions(srv);
                    const cfgs = getServiceConfigurations(srv);
                    const activeCfgs = cfgs.filter(c => c.isActive);

                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => setSelectedServiceId(srv.id)}
                        className={`w-full text-left p-3 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 shadow-sm ring-2 ring-brand-500/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className={`text-xs font-black truncate ${isSelected ? 'text-brand-950 dark:text-brand-200' : 'text-slate-900 dark:text-white'}`}>
                            {srv.name}
                          </span>
                          <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${srv.isActive ? 'bg-emerald-500 shadow-xs' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          <span className="truncate max-w-[140px] font-medium">
                            {srv.categoryName || categoriesMap.get(srv.categoryId) || 'Prestation'}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            dès {formatCurrency(srv.basePrice)} / {srv.unit}
                          </span>
                        </div>

                        {/* Badges count */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                            {opts.length} option(s)
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-brand-100/60 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold">
                            {activeCfgs.length} config(s)
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {filteredServices.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Aucune prestation trouvée.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Selected Service Standard Configurator (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {selectedService ? (
              <>
                {/* 1. Service Overview Header Card */}
                <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                            {selectedService.name}
                          </h2>
                          <Badge
                            variant={selectedService.isActive ? 'success' : 'secondary'}
                            size="sm"
                            className="font-bold text-[10px]"
                          >
                            {selectedService.isActive ? '● Actif' : '○ Inactif'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">
                            {selectedService.code}
                          </span>
                          <span>•</span>
                          <span>{selectedService.categoryName || categoriesMap.get(selectedService.categoryId)}</span>
                          <span>•</span>
                          <span>Unité standard : <strong>{selectedService.unit}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={Edit}
                          onClick={() => handleOpenEditService(selectedService)}
                          className="text-xs font-bold"
                        >
                          Modifier infos
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={Power}
                          onClick={() => handleToggleServiceStatus(selectedService)}
                          className={`text-xs font-bold ${
                            selectedService.isActive
                              ? 'text-amber-600 hover:bg-amber-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {selectedService.isActive ? 'Désactiver' : 'Activer'}
                        </Button>
                      </div>
                    </div>

                    {selectedService.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 pt-3 italic">
                        « {selectedService.description} »
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* 2. Dynamic Specifications & Options Section */}
                <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                  <CardHeader className="p-4 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-brand-500" />
                        1. Spécifications & Options du Service
                      </CardTitle>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Définissez les options personnalisées (ex: Format, Mode, Type, Papier, Finition, Durée...) et leurs valeurs possibles.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={Plus}
                      onClick={handleOpenAddOption}
                      className="text-xs font-bold text-brand-600 border-brand-200 hover:bg-brand-50 shrink-0"
                    >
                      + Ajouter une option
                    </Button>
                  </CardHeader>

                  <CardContent className="p-4 space-y-4">
                    {currentServiceOptions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {currentServiceOptions.map(opt => (
                          <div
                            key={opt.id || opt.name}
                            className="p-3.5 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                                {opt.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteOption(opt.id, opt.name)}
                                className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                title="Supprimer cette option"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Values pills */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {opt.values.map(val => (
                                <span
                                  key={val}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700"
                                >
                                  {val}
                                  {opt.values.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteOptionValue(opt.id, val)}
                                      className="hover:text-rose-500 text-slate-400 ml-0.5"
                                      title="Supprimer cette valeur"
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              ))}

                              {/* Add value button/input */}
                              {addingValueToOptionId === opt.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Valeur..."
                                    value={newOptionValueText}
                                    onChange={(e) => setNewOptionValueText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddValueToOption(opt.id);
                                      } else if (e.key === 'Escape') {
                                        setAddingValueToOptionId(null);
                                      }
                                    }}
                                    className="h-7 px-2 text-xs border border-brand-500 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none w-24"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddValueToOption(opt.id)}
                                    className="h-7 px-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-500"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAddingValueToOptionId(null)}
                                    className="h-7 px-1.5 text-slate-400 hover:text-slate-600 text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddingValueToOptionId(opt.id);
                                    setNewOptionValueText('');
                                  }}
                                  className="px-2 py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50/50 font-bold text-xs flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Valeur
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-5 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-1">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Aucune option spécifique définie pour ce service.
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Ce service fonctionne comme un service simple (tarif direct). Cliquez sur « + Ajouter une option » si vous souhaitez proposer des choix (Format, Mode, Finition, etc.).
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 3. Authorized Configurations Section */}
                <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                  <CardHeader className="p-4 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <BoxSelect className="w-4 h-4 text-emerald-500" />
                        2. Configurations Autorisées ({currentServiceConfigurations.length})
                      </CardTitle>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Chaque configuration lie une combinaison d'options à son tarif unitaire, son unité de facturation et sa recette de consommables stock.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={Plus}
                      onClick={handleOpenAddConfig}
                      className="font-bold bg-emerald-600 hover:bg-emerald-700 text-xs shrink-0 shadow-sm"
                    >
                      + Ajouter une configuration
                    </Button>
                  </CardHeader>

                  <CardContent className="p-4">
                    {currentServiceConfigurations.length > 0 ? (
                      <div className="space-y-3">
                        {currentServiceConfigurations.map((cfg) => {
                          const hasConsumables = cfg.consumables && cfg.consumables.length > 0;
                          const optionBadgeText = formatCompactOptionValues(cfg.optionValues);

                          return (
                            <div
                              key={cfg.id}
                              className={`p-4 rounded-2xl border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                cfg.isActive
                                  ? 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                                  : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-60'
                              }`}
                            >
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="px-2.5 py-1 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-800 dark:text-brand-300 border border-brand-200/80 font-black text-xs">
                                    {optionBadgeText}
                                  </span>

                                  <Badge
                                    variant={cfg.isActive ? 'success' : 'secondary'}
                                    size="sm"
                                    className="font-bold text-[10px]"
                                  >
                                    {cfg.isActive ? '● Actif' : '○ Inactif'}
                                  </Badge>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-xs">
                                  <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                                    <span>Tarif :</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                                      {formatCurrency(cfg.price)}
                                    </span>
                                    <span className="text-slate-500 font-semibold">
                                      / {cfg.billingUnit || selectedService.unit}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                    <span className="font-semibold">Consommation :</span>
                                    {hasConsumables ? (
                                      <span className="font-medium text-slate-800 dark:text-slate-200">
                                        {cfg.consumables
                                          .map(c => `${c.productName || 'Article'} × ${c.quantityPerUnit} ${c.unit || 'unité'}`)
                                          .join(' + ')}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic">Aucun consommable</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Config Actions */}
                              <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 dark:border-slate-800">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  icon={Edit}
                                  onClick={() => handleOpenEditConfig(cfg)}
                                  className="text-xs font-bold"
                                >
                                  Modifier
                                </Button>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleConfigStatus(cfg)}
                                  className={`text-xs font-bold ${
                                    cfg.isActive
                                      ? 'text-amber-600 hover:bg-amber-50'
                                      : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  {cfg.isActive ? 'Désactiver' : 'Activer'}
                                </Button>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  icon={Trash2}
                                  onClick={() => handleDeleteConfig(cfg)}
                                  className="text-slate-400 hover:text-rose-600 h-8 w-8 p-0"
                                  title="Supprimer la configuration"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                        <BoxSelect className="w-8 h-8 mx-auto text-slate-400" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Aucune configuration autorisée pour l'instant.
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                          Cliquez sur le bouton ci-dessous pour ajouter une configuration (valeurs d'options, tarif unitaire et consommables de stock).
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          icon={Plus}
                          onClick={handleOpenAddConfig}
                          className="font-bold bg-emerald-600 hover:bg-emerald-700 text-xs mt-2"
                        >
                          + Ajouter une configuration
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="p-12 text-center text-slate-400 border-dashed">
                Sélectionnez ou créez une prestation pour commencer la configuration.
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PRICE AUDIT HISTORY */}
      {/* ========================================================= */}
      {activeTab === 'history' && (
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <History className="w-4 h-4 text-brand-500" />
              Journal des Évolutions Tarifaires
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Prestation</TableHead>
                  <TableHead>Ancien Tarif</TableHead>
                  <TableHead>Nouveau Tarif</TableHead>
                  <TableHead>Modifié par</TableHead>
                  <TableHead>Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(state.priceHistories || []).map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs font-mono">{formatDate(h.changeDate)}</TableCell>
                    <TableCell className="text-xs font-bold text-slate-900 dark:text-white">{h.serviceName}</TableCell>
                    <TableCell className="text-xs font-mono line-through text-rose-500">{formatCurrency(h.oldPrice)}</TableCell>
                    <TableCell className="text-xs font-mono font-bold text-emerald-600">{formatCurrency(h.newPrice)}</TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{h.changedBy}</TableCell>
                    <TableCell className="text-xs italic text-slate-500">{h.reason || 'Mise à jour standard'}</TableCell>
                  </TableRow>
                ))}
                {(!state.priceHistories || state.priceHistories.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-xs text-slate-400 py-6">
                      Aucun historique tarifaire enregistré.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ========================================================= */}
      {/* UNIFIED CONFIGURATION MODAL (SINGLE SCREEN) */}
      {/* ========================================================= */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title={configToEdit ? `Modifier la Configuration — ${selectedService?.name}` : `Ajouter une Configuration — ${selectedService?.name}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveConfiguration} className="space-y-5 text-xs">
          {/* 1. Dynamic Option Values Selection */}
          {currentServiceOptions.length > 0 ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 block">
                1. Sélectionner les valeurs des options
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentServiceOptions.map(opt => (
                  <div key={opt.id || opt.name} className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      {opt.name} *
                    </label>
                    <Select
                      value={configOptionValues[opt.name] || opt.values[0] || ''}
                      onChange={(e) => setConfigOptionValues(prev => ({ ...prev, [opt.name]: e.target.value }))}
                      className="text-xs font-bold"
                    >
                      {opt.values.map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-xs">
              ℹ️ Ce service n'a pas d'options spécifiques. La configuration s'appliquera comme tarif standard global du service.
            </div>
          )}

          {/* 2. Pricing & Billing Unit */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 block">
              2. Tarif & Unité de Facturation
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Prix Unitaire (GNF) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  required
                  value={configPrice}
                  onChange={(e) => setConfigPrice(Number(e.target.value))}
                  className="text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Unité de Facturation *
                </label>
                <Select
                  value={configBillingUnit}
                  onChange={(e) => setConfigBillingUnit(e.target.value)}
                  className="text-xs font-bold"
                >
                  {COMMON_BILLING_UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* 3. Consumable Stock Recipe */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 block">
                  3. Consommation & Recette Stock (Optionnel)
                </label>
                <p className="text-[10px] text-slate-500">
                  Définissez les articles de stock déduits lors de l'exécution de cette configuration.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={handleAddConsumableRow}
                className="text-xs font-bold text-brand-600 border-brand-200 hover:bg-brand-50"
              >
                + Ajouter un consommable
              </Button>
            </div>

            {configConsumables.length > 0 ? (
              <div className="space-y-2">
                {configConsumables.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <div className="sm:col-span-6">
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Article de Stock :</label>
                      <Select
                        value={c.productId}
                        onChange={(e) => handleUpdateConsumableRow(idx, { productId: e.target.value })}
                        className="text-xs font-medium"
                      >
                        {availableProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit || p.baseUnit})
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Quantité consommée :</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={c.quantityPerUnit}
                        onChange={(e) => handleUpdateConsumableRow(idx, { quantityPerUnit: Number(e.target.value) })}
                        className="text-xs font-bold"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Unité :</label>
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 block py-1.5 px-2 bg-slate-100 dark:bg-slate-800 rounded">
                        {c.unit || 'unité'}
                      </span>
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveConsumableRow(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="Retirer ce consommable"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic py-2">
                Aucun consommable de stock associé à cette configuration (aucun débit de stock).
              </p>
            )}
          </div>

          {/* 4. Active Status Switch */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-extrabold text-slate-900 dark:text-white block">
                Statut de la configuration
              </span>
              <span className="text-[11px] text-slate-500">
                {configIsActive
                  ? 'Actif : La configuration sera immédiatement proposée dans les commandes.'
                  : 'Inactif : La configuration est masquée sans altérer l\'historique.'}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfigIsActive(!configIsActive)}
              className={`font-bold text-xs ${
                configIsActive ? 'text-emerald-600 border-emerald-300 bg-emerald-50/50' : 'text-slate-500'
              }`}
            >
              {configIsActive ? '● Active' : '○ Inactive'}
            </Button>
          </div>

          {/* 5. Submit Button */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfigModalOpen(false)}
              className="text-xs"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs px-5 shadow-sm"
            >
              Enregistrer la configuration
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* DYNAMIC OPTION CREATION MODAL */}
      {/* ========================================================= */}
      <Modal
        isOpen={isAddOptionModalOpen}
        onClose={() => setIsAddOptionModalOpen(false)}
        title={`Ajouter une Option — ${selectedService?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleAddOption} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Nom de l'Option *
            </label>
            <Input
              type="text"
              required
              placeholder="ex: Format, Mode, Type d'impression, Papier, Qualité, Finition..."
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              className="text-xs font-semibold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Valeurs autorisées (séparées par une virgule ou un retour à la ligne) *
            </label>
            <textarea
              required
              rows={3}
              placeholder="ex: A4, A3, A5"
              value={newOptionValuesInput}
              onChange={(e) => setNewOptionValuesInput(e.target.value)}
              className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Vous pourrez ajouter d'autres valeurs ultérieurement sans modifier le code.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddOptionModalOpen(false)}
              className="text-xs"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="bg-brand-600 font-bold text-xs"
            >
              Ajouter l'Option
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* SERVICE CREATION / EDIT MODAL */}
      {/* ========================================================= */}
      <Modal
        isOpen={isAddServiceModalOpen || Boolean(serviceToEdit)}
        onClose={() => {
          setIsAddServiceModalOpen(false);
          setServiceToEdit(null);
        }}
        title={serviceToEdit ? `Modifier la Prestation — ${serviceToEdit.name}` : 'Créer une Nouvelle Prestation'}
        maxWidth="md"
      >
        <form onSubmit={serviceToEdit ? handleSaveEditService : handleCreateService} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Nom de la Prestation *
            </label>
            <Input
              type="text"
              required
              placeholder="ex: Photocopie, Reliure, Aide à l'orientation..."
              value={srvName}
              onChange={(e) => setSrvName(e.target.value)}
              className="text-xs font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Catégorie *
              </label>
              <Select
                value={srvCategoryId}
                onChange={(e) => setSrvCategoryId(e.target.value)}
                className="text-xs font-semibold"
              >
                {(state.serviceCategories || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Unité Principale *
              </label>
              <Select
                value={srvUnit}
                onChange={(e) => setSrvUnit(e.target.value)}
                className="text-xs font-semibold"
              >
                {COMMON_BILLING_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Tarif Standard Base (GNF)
              </label>
              <Input
                type="number"
                min="0"
                step="50"
                value={srvBasePrice}
                onChange={(e) => setSrvBasePrice(Number(e.target.value))}
                className="text-xs font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Coût Revient Base (GNF)
              </label>
              <Input
                type="number"
                min="0"
                step="50"
                value={srvBaseCost}
                onChange={(e) => setSrvBaseCost(Number(e.target.value))}
                className="text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Description / Instructions de Production
            </label>
            <textarea
              rows={2}
              placeholder="Description générale de la prestation..."
              value={srvDescription}
              onChange={(e) => setSrvDescription(e.target.value)}
              className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddServiceModalOpen(false);
                setServiceToEdit(null);
              }}
              className="text-xs"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="bg-brand-600 font-bold text-xs"
            >
              {serviceToEdit ? 'Enregistrer les Modifications' : 'Créer le Service'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
