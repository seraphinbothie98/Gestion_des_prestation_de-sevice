import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Tabs } from '../../components/ui/Tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Product, ProductCategory, StockMovement, Supplier, StockMovementType, ProductPackaging } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  Boxes, Plus, AlertTriangle, Search, Eye, Edit,
  CheckCircle2, RefreshCw, Layers, History, Settings,
  DollarSign, PackageCheck, AlertCircle, Truck, MapPin, Tag,
  ShieldCheck, Trash2, Power, Filter, Calculator, Barcode,
  Flame, Sparkles, ArrowLeftRight, Wrench, MoreVertical,
  Archive, RotateCcw, FolderTree, ArrowRight, HelpCircle,
  FileText, Check, X, Building2, ChevronDown, Package,
  LayoutGrid, List, Image, ImageIcon, Upload, Zap, Globe
} from 'lucide-react';
import { ProductBarcodeLabelModal } from './ProductBarcodeLabelModal';
import {
  getAvailableProductUnits,
  formatSmartStockBreakdown,
  recalculatePackagingFactors,
  convertToBaseQuantity,
  convertFromBaseQuantity,
  getUnitConversionFactor,
  calculateServiceStockConsumption
} from '../../lib/stockEngine';

const COMMON_UNITS_BASE = [
  { value: 'feuille', label: '📄 Feuille (ex: Ramette A4, Bristol, papier photo)' },
  { value: 'unité', label: '⚙️ Unité / Pièce (ex: Clé USB, agrafeuse, accessoire)' },
  { value: 'pièce', label: '🖊️ Pièce (ex: Stylo, feutre, chemise)' },
  { value: 'cartouche', label: '🖨️ Cartouche / Toner (ex: Toner imprimante)' },
  { value: 'pochette', label: '🛡️ Pochette (ex: Pochette plastification A4/A3)' },
  { value: 'kit', label: '🎨 Kit / Flacon (ex: Encre liquide CMYK)' },
  { value: 'rouleau', label: '📜 Rouleau (ex: Bâche, vinyle, adhésif)' },
  { value: 'mètre', label: '📏 Mètre linéaire' },
  { value: 'litre', label: '🧪 Litre / Volume' },
  { value: 'paquet', label: '📦 Paquet (lorsqu\'il n\'y a pas de sous-unité)' },
];

const PACKAGING_PRESETS = [
  { unitName: 'paquet', label: 'Paquet (ex: 500 feuilles ou 100 unités)' },
  { unitName: 'boîte', label: 'Boîte (ex: 50 pièces ou 100 pochettes)' },
  { unitName: 'carton', label: 'Carton (ex: 5 paquets ou 10 boîtes)' },
  { unitName: 'pack', label: 'Pack (ex: 10 unités)' },
  { unitName: 'palette', label: 'Palette (ex: 40 cartons)' },
];

// Reusable reactive visual component for Product Cards
const ProductCardVisual: React.FC<{
  imageUrl?: string;
  name: string;
  category?: string;
  isArchived?: boolean;
  isOutOfStock?: boolean;
  isLowStock?: boolean;
  isActive?: boolean;
}> = ({ imageUrl, name, category, isArchived, isOutOfStock, isLowStock, isActive = true }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  const hasValidImage = Boolean(imageUrl && imageUrl.trim() && !imgError);

  return (
    <div className="relative w-full h-44 rounded-t-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-slate-800 group">
      {hasValidImage ? (
        <img
          key={imageUrl}
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-1.5 p-4 text-center text-slate-400 select-none">
          <div className="w-14 h-14 rounded-2xl bg-white/80 dark:bg-slate-800/80 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            📦
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {category || 'Article'}
          </span>
        </div>
      )}

      {/* Floating Status Badge */}
      <div className="absolute top-2.5 left-2.5">
        {isArchived ? (
          <Badge variant="secondary" size="sm" className="font-black text-[10px] shadow-sm">
            🗃️ Archivé
          </Badge>
        ) : !isActive ? (
          <Badge variant="secondary" size="sm" className="font-black text-[10px] shadow-sm bg-slate-800 text-white dark:bg-slate-700">
            ⛔ Inactif
          </Badge>
        ) : (
          <Badge
            variant={isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'}
            size="sm"
            className="font-black text-[10px] shadow-sm flex items-center gap-1"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? 'bg-rose-400' : isLowStock ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            {isOutOfStock ? 'Rupture de Stock' : isLowStock ? 'Stock Faible' : 'En Stock'}
          </Badge>
        )}
      </div>



      {/* Category Tag Top Right */}
      {category && (
        <div className="absolute top-2.5 right-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-bold">
            {category}
          </span>
        </div>
      )}
    </div>
  );
};

// Reusable reactive thumbnail for tables, modals & previews
const ProductThumbnailSmall: React.FC<{
  imageUrl?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ imageUrl, alt = '', size = 'sm', className = '' }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  const hasValidImage = Boolean(imageUrl && imageUrl.trim() && !imgError);

  const sizeClasses =
    size === 'lg'
      ? 'w-16 h-16 rounded-2xl text-2xl'
      : size === 'md'
      ? 'w-12 h-12 rounded-xl text-xl'
      : 'w-8 h-8 rounded-lg text-sm';

  return (
    <div
      className={`${sizeClasses} bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}
    >
      {hasValidImage ? (
        <img
          key={imageUrl}
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>📦</span>
      )}
    </div>
  );
};

const ProductActionsDropdown: React.FC<{
  product: Product;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onView: () => void;
  onEdit: () => void;
  onAdjust: () => void;
  onBarcode: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
  placement?: 'top' | 'bottom';
}> = ({
  product,
  isOpen,
  onToggle,
  onClose,
  onView,
  onEdit,
  onAdjust,
  onBarcode,
  onToggleActive,
  onDelete,
  canEdit,
  canDelete,
  placement = 'top',
}) => {
  return (
    <div className="relative inline-block text-left">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        icon={MoreVertical}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="h-8 px-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1"
        title="Actions sur l'article"
      >
        <span className="hidden sm:inline">Actions</span>
      </Button>

      {isOpen && (
        <>
          {/* Dismiss Backdrop */}
          <div
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />
          {/* Menu popover */}
          <div
            className={`absolute right-0 ${
              placement === 'bottom'
                ? 'top-full mt-1.5 origin-top-right'
                : 'bottom-full mb-1.5 origin-bottom-right'
            } w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 divide-y divide-slate-100 dark:divide-slate-800 focus:outline-none animate-in fade-in zoom-in-95 duration-100`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onView();
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
              >
                <Eye className="w-4 h-4 text-brand-500" />
                <span>👁 Voir la fiche détaillée</span>
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit();
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                >
                  <Edit className="w-4 h-4 text-amber-500" />
                  <span>✏ Modifier l'article</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAdjust();
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
              >
                <Calculator className="w-4 h-4 text-brand-600" />
                <span>⚡ Ajuster le stock</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBarcode();
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
              >
                <Barcode className="w-4 h-4 text-slate-500" />
                <span>🏷 Étiquette Code-barres</span>
              </button>
            </div>

            <div className="py-1">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onToggleActive();
                  }}
                  className={`flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-semibold text-left transition-colors ${
                    product.isActive
                      ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                      : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  <span>{product.isActive ? '⛔ Désactiver l\'article' : '✓ Activer l\'article'}</span>
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDelete();
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>🗑 Supprimer l'article</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const StockView: React.FC = () => {
  const { currentTenant, currentUser, hasPermission, isSuperAdmin } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const currentAgencyId = currentTenant?.id || 't-001';
  const isPrestationAgency = currentTenant?.activityType === 'SERVICE_CENTER';

  // Isolated Agency Datasets (Multi-tenant security)
  const agencyProducts = useMemo(() => dbStore.getProductsByTenant(currentAgencyId, isSuperAdmin), [state.products, currentAgencyId, isSuperAdmin]);
  const agencyCategories = useMemo(() => dbStore.getProductCategoriesByTenant(currentAgencyId, isSuperAdmin), [state.productCategories, currentAgencyId, isSuperAdmin]);
  const agencyMovements = useMemo(() => dbStore.getStockMovementsByTenant(currentAgencyId, isSuperAdmin), [state.stockMovements, currentAgencyId, isSuperAdmin]);
  const agencySuppliers = useMemo(() => dbStore.getSuppliersByTenant(currentAgencyId, isSuperAdmin), [state.suppliers, currentAgencyId, isSuperAdmin]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'inventory' | 'prestation_stock' | 'categories' | 'movements' | 'consumption' | 'transfers' | 'losses' | 'audit' | 'analytics'
  >('inventory');

  // Fallback if current tab is not allowed for agency model
  useEffect(() => {
    if (!isPrestationAgency && (activeTab === 'prestation_stock' || activeTab === 'consumption')) {
      setActiveTab('inventory');
    }
  }, [isPrestationAgency, activeTab]);

  // Search and filters for articles
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'LOW' | 'OUT'>('ACTIVE');
  const [photoFilter, setPhotoFilter] = useState<'ALL' | 'WITH_PHOTO' | 'WITHOUT_PHOTO'>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  // ----------------------------------------------------
  // Prestation Stock State & Filters
  // ----------------------------------------------------
  const [prestationSearch, setPrestationSearch] = useState('');
  const [prestationCategoryFilter, setPrestationCategoryFilter] = useState('ALL');
  const [prestationStatusFilter, setPrestationStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'LOW' | 'OUT'>('ALL');
  const [prestationViewMode, setPrestationViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [productToViewPrestation, setProductToViewPrestation] = useState<Product | null>(null);
  const [productToAdjustPrestation, setProductToAdjustPrestation] = useState<Product | null>(null);
  const [adjustPrestationQty, setAdjustPrestationQty] = useState<number>(0);
  const [adjustPrestationReason, setAdjustPrestationReason] = useState<string>('');

  // Categories search & filter
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'>('ALL');

  // Article Modals state
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToView, setProductToView] = useState<Product | null>(null);
  const [productToAdjustStock, setProductToAdjustStock] = useState<Product | null>(null);
  const [productToArchive, setProductToArchive] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productToToggleActive, setProductToToggleActive] = useState<Product | null>(null);
  const [productForBarcode, setProductForBarcode] = useState<Product | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Category Modals state
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ProductCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);
  const [reassignTargetCategoryId, setReassignTargetCategoryId] = useState<string>('');

  // New Category Form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');
  const [newCatIsActive, setNewCatIsActive] = useState(true);

  // Edit Category Form state
  const [editCatName, setEditCatName] = useState('');
  const [editCatCode, setEditCatCode] = useState('');
  const [editCatDescription, setEditCatDescription] = useState('');
  const [editCatColor, setEditCatColor] = useState('#3b82f6');
  const [editCatIsActive, setEditCatIsActive] = useState(true);

  // Stock Adjustment Form State
  const [adjustTargetStock, setAdjustTargetStock] = useState<number>(0);
  const [adjustLocation, setAdjustLocation] = useState<string>('MAIN_STORE');
  const [adjustReason, setAdjustReason] = useState<string>('');

  // ----------------------------------------------------
  // ----------------------------------------------------
  // Form state: New Product (5 Sections)
  // ----------------------------------------------------
  const [newCode, setNewCode] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImages, setNewImages] = useState<string[]>(['']);
  const [newIsActive, setNewIsActive] = useState(true);

  // Section B: Multi-Unit & Packagings Hierarchy
  const [newBaseUnit, setNewBaseUnit] = useState('feuille');
  const [newPackagings, setNewPackagings] = useState<ProductPackaging[]>([
    {
      id: 'pkg-init-1',
      level: 2,
      unitName: 'paquet',
      containedQuantity: 500,
      subUnitName: 'feuille',
      factorToBase: 500,
      salePrice: 70000,
      purchasePrice: 60000,
      wholesalePrice: 65000,
      isAllowedForSale: true,
      isAllowedForPurchase: true,
      isDefaultSaleUnit: false,
      isDefaultPurchaseUnit: false,
    },
    {
      id: 'pkg-init-2',
      level: 3,
      unitName: 'carton',
      containedQuantity: 5,
      subUnitName: 'paquet',
      factorToBase: 2500,
      salePrice: 330000,
      purchasePrice: 300000,
      wholesalePrice: 315000,
      isAllowedForSale: true,
      isAllowedForPurchase: true,
      isDefaultSaleUnit: false,
      isDefaultPurchaseUnit: true,
    }
  ]);
  const [newDefaultSaleUnit, setNewDefaultSaleUnit] = useState('feuille');
  const [newDefaultPurchaseUnit, setNewDefaultPurchaseUnit] = useState('carton');

  // Marketplace Pricing & Unit Configuration
  const [newPublicUnit, setNewPublicUnit] = useState<string>('carton');
  const [newPublicPrice, setNewPublicPrice] = useState<number | undefined>(330000);
  const [newConversionFactorToStock, setNewConversionFactorToStock] = useState<number>(2500);

  // Section C: Stock & Location (All quantities in Base Unit)
  const [newInitialStock, setNewInitialStock] = useState<number>(25000);
  const [newMinAlert, setNewMinAlert] = useState<number>(2500);
  const [newMaxStock, setNewMaxStock] = useState<number>(50000);
  const [newLocation, setNewLocation] = useState('Magasin Principal - Étagère A1');

  // Section D: Pricing per Base Unit
  const [newCostPrice, setNewCostPrice] = useState<number>(120);
  const [newSalePrice, setNewSalePrice] = useState<number>(500);
  const [newWholesalePrice, setNewWholesalePrice] = useState<number>(400);

  // Section E: Supplier
  const [newSupplierId, setNewSupplierId] = useState('');

  // ----------------------------------------------------
  // Form state: Edit Product (5 Sections)
  // ----------------------------------------------------
  const [editCode, setEditCode] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);

  const [editBaseUnit, setEditBaseUnit] = useState('feuille');
  const [editPackagings, setEditPackagings] = useState<ProductPackaging[]>([]);
  const [editDefaultSaleUnit, setEditDefaultSaleUnit] = useState('feuille');
  const [editDefaultPurchaseUnit, setEditDefaultPurchaseUnit] = useState('carton');

  // Edit Marketplace Pricing & Unit Configuration
  const [editPublicUnit, setEditPublicUnit] = useState<string>('feuille');
  const [editPublicPrice, setEditPublicPrice] = useState<number | undefined>(undefined);
  const [editConversionFactorToStock, setEditConversionFactorToStock] = useState<number>(1);

  const [editMinAlert, setEditMinAlert] = useState<number>(0);
  const [editMaxStock, setEditMaxStock] = useState<number>(0);
  const [editLocation, setEditLocation] = useState('');

  const [editCostPrice, setEditCostPrice] = useState<number>(0);
  const [editSalePrice, setEditSalePrice] = useState<number>(0);
  const [editWholesalePrice, setEditWholesalePrice] = useState<number>(0);

  const [editSupplierId, setEditSupplierId] = useState('');

  // ----------------------------------------------------
  // Internal Consumption & Workshop Transfer State
  // ----------------------------------------------------
  const [consProductId, setConsProductId] = useState(state.products[0]?.id || '');
  const [consUnit, setConsUnit] = useState<string>('');
  const [consQuantity, setConsQuantity] = useState<number>(1);
  const [consServiceId, setConsServiceId] = useState<string>('');
  const [consServiceName, setConsServiceName] = useState<string>('Photocopie & Impression');
  const [consOrderNumber, setConsOrderNumber] = useState('');
  const [consReason, setConsReason] = useState('Transfert pour réalisation de prestations');

  // ----------------------------------------------------
  // Transfer Form State
  // ----------------------------------------------------
  const [transProductId, setTransProductId] = useState(state.products[0]?.id || '');
  const [transSource, setTransSource] = useState<string>('MAIN_STORE');
  const [transDestination, setTransDestination] = useState<string>('BOUTIQUE');
  const [transQuantity, setTransQuantity] = useState<number>(10);
  const [transReason, setTransReason] = useState('Réapprovisionnement du comptoir boutique');

  // ----------------------------------------------------
  // Losses & Damage Form State
  // ----------------------------------------------------
  const [lossProductId, setLossProductId] = useState(state.products[0]?.id || '');
  const [lossType, setLossType] = useState<StockMovementType>('DETERIORATION');
  const [lossQuantity, setLossQuantity] = useState<number>(1);
  const [lossReason, setLossReason] = useState('Papier mouillé / humidité');

  // ----------------------------------------------------
  // Physical Inventory Audit Form State
  // ----------------------------------------------------
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [auditReasons, setAuditReasons] = useState<Record<string, string>>({});

  // Active categories list
  const activeCategories = useMemo(() => {
    return agencyCategories.filter(c => c.isActive && !c.isArchived);
  }, [agencyCategories]);

  // Dynamic Marketplace Units (Strictly derived from configured base unit and allowed packagings)
  const newAvailableMarketplaceUnits = useMemo(() => {
    const baseU = newBaseUnit.trim() || 'unité';
    const list = [
      {
        unit: baseU,
        label: `${baseU} (Unité de base)`,
        defaultPrice: newSalePrice,
        factor: 1
      }
    ];
    newPackagings
      .filter(p => p.isAllowedForSale && p.unitName && p.unitName.trim().length > 0)
      .forEach(pkg => {
        list.push({
          unit: pkg.unitName.trim(),
          label: `${pkg.unitName.trim()} (Conditionnement x${pkg.factorToBase} ${baseU})`,
          defaultPrice: pkg.salePrice || (newSalePrice * pkg.factorToBase),
          factor: pkg.factorToBase
        });
      });
    return list;
  }, [newBaseUnit, newSalePrice, newPackagings]);

  const editAvailableMarketplaceUnits = useMemo(() => {
    const baseU = editBaseUnit.trim() || 'unité';
    const list = [
      {
        unit: baseU,
        label: `${baseU} (Unité de base)`,
        defaultPrice: editSalePrice,
        factor: 1
      }
    ];
    editPackagings
      .filter(p => p.isAllowedForSale && p.unitName && p.unitName.trim().length > 0)
      .forEach(pkg => {
        list.push({
          unit: pkg.unitName.trim(),
          label: `${pkg.unitName.trim()} (Conditionnement x${pkg.factorToBase} ${baseU})`,
          defaultPrice: pkg.salePrice || (editSalePrice * pkg.factorToBase),
          factor: pkg.factorToBase
        });
      });
    return list;
  }, [editBaseUnit, editSalePrice, editPackagings]);

  // Suppliers list
  const suppliers = agencySuppliers;

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return agencyCategories.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(categorySearch.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(categorySearch.toLowerCase()));

      let matchesStatus = true;
      if (categoryStatusFilter === 'ACTIVE') matchesStatus = c.isActive && !c.isArchived;
      else if (categoryStatusFilter === 'INACTIVE') matchesStatus = !c.isActive && !c.isArchived;
      else if (categoryStatusFilter === 'ARCHIVED') matchesStatus = !!c.isArchived;

      return matchesSearch && matchesStatus;
    });
  }, [agencyCategories, categorySearch, categoryStatusFilter]);

  // Count articles per category
  const articlesCountByCategoryId = useMemo(() => {
    const counts: Record<string, { total: number; active: number }> = {};
    agencyProducts.forEach(p => {
      const catId = p.categoryId || agencyCategories.find(c => c.name.toLowerCase() === p.category?.toLowerCase())?.id || 'other';
      if (!counts[catId]) counts[catId] = { total: 0, active: 0 };
      counts[catId].total += 1;
      if (p.isActive && !p.isArchived) counts[catId].active += 1;
    });
    return counts;
  }, [agencyProducts, agencyCategories]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return agencyProducts.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode && p.barcode.includes(search)) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
        (p.location && p.location.toLowerCase().includes(search.toLowerCase()));

      const matchesCat =
        categoryFilter === 'ALL' ||
        p.categoryId === categoryFilter ||
        p.category === categoryFilter;

      let matchesStatus = true;
      if (statusFilter === 'ACTIVE') matchesStatus = p.isActive && !p.isArchived;
      else if (statusFilter === 'INACTIVE') matchesStatus = !p.isActive && !p.isArchived;
      else if (statusFilter === 'ARCHIVED') matchesStatus = !!p.isArchived;
      else if (statusFilter === 'LOW') matchesStatus = p.isActive && !p.isArchived && p.currentStock <= p.minStockAlert && p.currentStock > 0;
      else if (statusFilter === 'OUT') matchesStatus = p.isActive && !p.isArchived && p.currentStock === 0;
      else if (statusFilter === 'ALL') {
        // By default on "ALL", hide archived items unless requested
        matchesStatus = !p.isArchived;
      }

      let matchesPhoto = true;
      if (photoFilter === 'WITH_PHOTO') {
        matchesPhoto = Boolean(p.imageUrl && p.imageUrl.trim());
      } else if (photoFilter === 'WITHOUT_PHOTO') {
        matchesPhoto = !p.imageUrl || !p.imageUrl.trim();
      }

      return matchesSearch && matchesCat && matchesStatus && matchesPhoto;
    });
  }, [agencyProducts, search, categoryFilter, statusFilter, photoFilter]);

  // Stock KPIs (Excludes archived articles for operational KPIs)
  const metrics = useMemo(() => {
    const operationalProds = agencyProducts.filter(p => p.isActive && !p.isArchived);
    const totalValue = operationalProds.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);
    const lowStockCount = operationalProds.filter(p => p.currentStock <= p.minStockAlert && p.currentStock > 0).length;
    const outOfStockCount = operationalProds.filter(p => p.currentStock === 0).length;
    const archivedCount = agencyProducts.filter(p => p.isArchived).length;
    const totalCategoriesCount = agencyCategories.filter(c => c.isActive && !c.isArchived).length;

    return {
      totalValue,
      totalCount: operationalProds.length,
      lowStockCount,
      outOfStockCount,
      archivedCount,
      totalCategoriesCount
    };
  }, [agencyProducts, agencyCategories]);

  // Agency services for internal consumption & workshop transfer
  const agencyServices = useMemo(() => {
    return (state.services || []).filter(s => (isSuperAdmin || s.tenantId === currentAgencyId) && s.isActive);
  }, [state.services, currentAgencyId, isSuperAdmin]);

  const selectedConsProduct = useMemo(() => {
    return agencyProducts.find(p => p.id === consProductId)
      || agencyProducts.find(p => p.isActive && !p.isArchived && p.currentStock > 0)
      || agencyProducts[0];
  }, [agencyProducts, consProductId]);

  const consAvailableUnits = useMemo(() => {
    return selectedConsProduct ? getAvailableProductUnits(selectedConsProduct) : [];
  }, [selectedConsProduct]);

  const selectedConsService = useMemo(() => {
    if (consServiceId) {
      return agencyServices.find(s => s.id === consServiceId) || null;
    }
    return agencyServices.find(s => s.name.toLowerCase() === consServiceName.toLowerCase()) || null;
  }, [agencyServices, consServiceId, consServiceName]);

  // Auto-sync consUnit when product changes
  useEffect(() => {
    if (selectedConsProduct) {
      const units = getAvailableProductUnits(selectedConsProduct);
      const isCurrentUnitValid = units.some(u => u.unitName.toLowerCase() === (consUnit || '').toLowerCase());
      if (!isCurrentUnitValid) {
        const defaultU = units.find(u => u.isDefaultPurchaseUnit && !u.isBaseUnit)
          || units.find(u => !u.isBaseUnit)
          || units[0];
        if (defaultU) setConsUnit(defaultU.unitName);
      }
    }
  }, [selectedConsProduct, consUnit]);

  // Real-time calculation of capacity, stock impact and validity
  const consCalculation = useMemo(() => {
    if (!selectedConsProduct) return null;
    return calculateServiceStockConsumption(
      selectedConsProduct,
      consQuantity,
      consUnit || selectedConsProduct.defaultPurchaseUnit || selectedConsProduct.unit || 'unité',
      selectedConsService,
      consServiceName
    );
  }, [selectedConsProduct, consQuantity, consUnit, selectedConsService, consServiceName]);

  // ----------------------------------------------------
  // Prestation Stock Derived Data & KPIs
  // ----------------------------------------------------
  const prestationProducts = useMemo(() => {
    return agencyProducts.filter(p => !p.isArchived);
  }, [agencyProducts]);

  const filteredPrestationProducts = useMemo(() => {
    return prestationProducts.filter(p => {
      const q = prestationSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q));

      const matchesCat =
        prestationCategoryFilter === 'ALL' ||
        p.categoryId === prestationCategoryFilter ||
        p.category === prestationCategoryFilter;

      const pStock = p.prestationStock || 0;
      const pMinAlert = p.prestationMinStockAlert || p.minStockAlert || 0;

      let matchesStatus = true;
      if (prestationStatusFilter === 'AVAILABLE') matchesStatus = pStock > pMinAlert;
      else if (prestationStatusFilter === 'LOW') matchesStatus = pStock <= pMinAlert && pStock > 0;
      else if (prestationStatusFilter === 'OUT') matchesStatus = pStock === 0;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [prestationProducts, prestationSearch, prestationCategoryFilter, prestationStatusFilter]);

  const prestationMetrics = useMemo(() => {
    let totalItems = 0;
    let totalQty = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let availableCount = 0;

    prestationProducts.forEach(p => {
      totalItems += 1;
      const pStock = p.prestationStock || 0;
      const pMinAlert = p.prestationMinStockAlert || p.minStockAlert || 0;
      totalQty += pStock;
      if (pStock === 0) outOfStockCount += 1;
      else if (pStock <= pMinAlert) lowStockCount += 1;
      else availableCount += 1;
    });

    const recentTransfersCount = agencyMovements.filter(m => 
      m.destinationLocation === 'PRESTATION' || m.movementType === 'INTERNAL_CONSUMPTION'
    ).length;

    const recentConsumptionsCount = agencyMovements.filter(m => 
      m.sourceLocation === 'PRESTATION' || m.movementType === 'CONSUMPTION'
    ).length;

    return {
      totalItems,
      totalQty,
      lowStockCount,
      outOfStockCount,
      availableCount,
      recentTransfersCount,
      recentConsumptionsCount
    };
  }, [prestationProducts, agencyMovements]);

  // Statistics per product in Prestation Stock
  const getProductPrestationStats = (productId: string) => {
    const prodMovements = agencyMovements.filter(m => m.productId === productId);
    
    // Transferred into prestation
    const transfers = prodMovements.filter(m => 
      m.destinationLocation === 'PRESTATION' || m.movementType === 'INTERNAL_CONSUMPTION'
    );
    const totalTransferred = transfers.reduce((acc, m) => acc + Math.abs(m.quantity), 0);
    const lastTransfer = transfers[0] || null;

    // Consumed from prestation
    const consumptions = prodMovements.filter(m => 
      m.sourceLocation === 'PRESTATION' || (m.movementType === 'CONSUMPTION' && !m.destinationLocation)
    );
    const totalConsumed = consumptions.reduce((acc, m) => acc + Math.abs(m.quantity), 0);
    const lastConsumption = consumptions[0] || null;

    return {
      totalTransferred,
      lastTransfer,
      totalConsumed,
      lastConsumption
    };
  };

  const handleOpenAdjustPrestation = (product: Product) => {
    setProductToAdjustPrestation(product);
    setAdjustPrestationQty(product.prestationStock || 0);
    setAdjustPrestationReason('');
  };

  const handleProcessPrestationAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToAdjustPrestation) return;
    if (adjustPrestationQty < 0) {
      showToast('Quantité Invalide', 'La quantité en stock prestation ne peut pas être négative.', 'DANGER');
      return;
    }

    const performedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Gestionnaire Atelier';
    const result = dbStore.adjustPrestationStock(
      productToAdjustPrestation.id,
      adjustPrestationQty,
      adjustPrestationReason || 'Ajustement inventaire régulier',
      currentAgencyId,
      performedBy,
      isSuperAdmin
    );

    if (!result.success) {
      showToast('Erreur Ajustement', result.message, 'DANGER');
      return;
    }

    showToast('Stock Prestation Ajusté', result.message, 'SUCCESS');
    setProductToAdjustPrestation(null);
  };



  // =========================================================================
  // CATEGORY ACTIONS
  // =========================================================================

  const handleOpenCreateCategory = () => {
    setNewCatName('');
    setNewCatCode('');
    setNewCatDescription('');
    setNewCatColor('#3b82f6');
    setNewCatIsActive(true);
    setIsNewCategoryModalOpen(true);
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCatName.trim();
    if (!trimmedName) {
      showToast('Validation', 'Le nom de la catégorie est obligatoire.', 'DANGER');
      return;
    }

    // Auto-generate code if empty
    let generatedCode = newCatCode.trim().toUpperCase();
    if (!generatedCode) {
      generatedCode = trimmedName
        .substring(0, 5)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    }

    // Uniqueness check within the agency
    const existingName = agencyCategories.find(
      c => c.name.toLowerCase() === trimmedName.toLowerCase() && !c.isArchived
    );
    if (existingName) {
      showToast('Doublon', 'Une catégorie portant ce nom existe déjà dans votre agence.', 'DANGER');
      return;
    }

    const existingCode = agencyCategories.find(
      c => c.code.toUpperCase() === generatedCode && !c.isArchived
    );
    if (existingCode) {
      showToast('Doublon', 'Ce code de catégorie est déjà utilisé dans votre agence.', 'DANGER');
      return;
    }

    const newCategory: ProductCategory = {
      id: `cat-prod-${Date.now()}`,
      tenantId: currentAgencyId,
      code: generatedCode,
      name: trimmedName,
      description: newCatDescription.trim(),
      color: newCatColor,
      isActive: newCatIsActive,
      isArchived: false,
      sortOrder: agencyCategories.length + 1,
      createdAt: new Date().toISOString()
    };

    dbStore.updateState(draft => {
      if (!draft.productCategories) draft.productCategories = [];
      draft.productCategories.push(newCategory);
    });

    dbStore.logAudit('CATEGORY_CREATED', 'PRODUCT_CATEGORY', newCategory.id, null, {
      name: newCategory.name,
      code: newCategory.code,
      tenantId: currentAgencyId
    });

    showToast('Catégorie créée', `La catégorie « ${newCategory.name} » a été créée avec succès.`, 'SUCCESS');
    setIsNewCategoryModalOpen(false);
  };

  const handleOpenEditCategory = (c: ProductCategory) => {
    setCategoryToEdit(c);
    setEditCatName(c.name);
    setEditCatCode(c.code);
    setEditCatDescription(c.description || '');
    setEditCatColor(c.color || '#3b82f6');
    setEditCatIsActive(c.isActive);
  };

  const handleSaveEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryToEdit) return;

    const trimmedName = editCatName.trim();
    if (!trimmedName) {
      showToast('Validation', 'Le nom de la catégorie est obligatoire.', 'DANGER');
      return;
    }

    const trimmedCode = editCatCode.trim().toUpperCase();

    // Check duplicate name on other categories in agency
    const duplicateName = agencyCategories.find(
      c => c.id !== categoryToEdit.id && c.name.toLowerCase() === trimmedName.toLowerCase() && !c.isArchived
    );
    if (duplicateName) {
      showToast('Doublon', 'Une autre catégorie porte déjà ce nom dans votre agence.', 'DANGER');
      return;
    }

    const oldName = categoryToEdit.name;

    dbStore.updateState(draft => {
      const cat = draft.productCategories?.find(c => c.id === categoryToEdit.id && (isSuperAdmin || c.tenantId === currentAgencyId));
      if (cat) {
        cat.name = trimmedName;
        cat.code = trimmedCode;
        cat.description = editCatDescription.trim();
        cat.color = editCatColor;
        cat.isActive = editCatIsActive;
        cat.updatedAt = new Date().toISOString();
      }

      // Propagate name change to all associated products for current agency only
      if (oldName !== trimmedName) {
        draft.products.forEach(p => {
          if ((isSuperAdmin || p.tenantId === currentAgencyId) && (p.categoryId === categoryToEdit.id || p.category === oldName)) {
            p.category = trimmedName;
            p.categoryId = categoryToEdit.id;
          }
        });
      }
    });

    dbStore.logAudit('CATEGORY_UPDATED', 'PRODUCT_CATEGORY', categoryToEdit.id, { name: oldName }, { name: trimmedName, code: trimmedCode, tenantId: currentAgencyId });
    showToast('Catégorie modifiée', `La catégorie « ${trimmedName} » a été modifiée avec succès.`, 'SUCCESS');
    setCategoryToEdit(null);
  };

  const handleToggleCategoryActive = (cat: ProductCategory) => {
    dbStore.updateState(draft => {
      const c = draft.productCategories?.find(item => item.id === cat.id && (isSuperAdmin || item.tenantId === currentAgencyId));
      if (c) {
        c.isActive = !c.isActive;
        c.updatedAt = new Date().toISOString();
      }
    });

    dbStore.logAudit('CATEGORY_STATUS_TOGGLED', 'PRODUCT_CATEGORY', cat.id, { isActive: cat.isActive }, { isActive: !cat.isActive, tenantId: currentAgencyId });
    showToast(
      cat.isActive ? 'Catégorie désactivée' : 'Catégorie réactivée',
      `La catégorie « ${cat.name} » est maintenant ${cat.isActive ? 'inactive' : 'active'}.`,
      'INFO'
    );
  };

  const handleArchiveCategory = (cat: ProductCategory) => {
    dbStore.updateState(draft => {
      const c = draft.productCategories?.find(item => item.id === cat.id && (isSuperAdmin || item.tenantId === currentAgencyId));
      if (c) {
        c.isArchived = true;
        c.isActive = false;
        c.archivedAt = new Date().toISOString();
      }
    });

    dbStore.logAudit('CATEGORY_ARCHIVED', 'PRODUCT_CATEGORY', cat.id, null, { name: cat.name, tenantId: currentAgencyId });
    showToast('Catégorie archivée', `La catégorie « ${cat.name} » a été archivée avec succès.`, 'SUCCESS');
  };

  const handleRestoreCategory = (cat: ProductCategory) => {
    dbStore.updateState(draft => {
      const c = draft.productCategories?.find(item => item.id === cat.id && (isSuperAdmin || item.tenantId === currentAgencyId));
      if (c) {
        c.isArchived = false;
        c.isActive = true;
        c.archivedAt = undefined;
        c.updatedAt = new Date().toISOString();
      }
    });

    dbStore.logAudit('CATEGORY_RESTORED', 'PRODUCT_CATEGORY', cat.id, null, { name: cat.name, tenantId: currentAgencyId });
    showToast('Catégorie restaurée', `La catégorie « ${cat.name} » a été restaurée et réactivée.`, 'SUCCESS');
  };

  const handleOpenDeleteOrReassign = (cat: ProductCategory) => {
    const stats = articlesCountByCategoryId[cat.id] || { total: 0, active: 0 };
    setCategoryToDelete(cat);
    // Find another available category as default reassign target in current agency
    const otherCat = agencyCategories.find(c => c.id !== cat.id && c.isActive && !c.isArchived);
    setReassignTargetCategoryId(otherCat?.id || '');
  };

  const handleConfirmDeleteOrReassign = () => {
    if (!categoryToDelete) return;
    const catId = categoryToDelete.id;
    const catName = categoryToDelete.name;
    const articlesCount = articlesCountByCategoryId[catId]?.total || 0;

    if (articlesCount > 0) {
      if (!reassignTargetCategoryId) {
        showToast('Sélection requise', 'Veuillez sélectionner la catégorie de destination pour les articles.', 'WARNING');
        return;
      }

      const targetCat = agencyCategories.find(c => c.id === reassignTargetCategoryId);
      if (!targetCat) {
        showToast('Erreur', 'Catégorie de destination introuvable.', 'DANGER');
        return;
      }

      // Reassign articles then soft delete/archive category
      dbStore.updateState(draft => {
        draft.products.forEach(p => {
          if ((isSuperAdmin || p.tenantId === currentAgencyId) && (p.categoryId === catId || p.category === catName)) {
            p.categoryId = targetCat.id;
            p.category = targetCat.name;
            p.updatedAt = new Date().toISOString();
          }
        });

        const c = draft.productCategories?.find(item => item.id === catId && (isSuperAdmin || item.tenantId === currentAgencyId));
        if (c) {
          c.isArchived = true;
          c.isActive = false;
          c.archivedAt = new Date().toISOString();
        }
      });

      dbStore.logAudit('CATEGORY_REASSIGNED_AND_ARCHIVED', 'PRODUCT_CATEGORY', catId, null, {
        reassignedArticlesCount: articlesCount,
        fromCategory: catName,
        toCategory: targetCat.name,
        tenantId: currentAgencyId
      });

      showToast(
        'Articles réaffectés',
        `${articlesCount} article(s) ont été transférés vers « ${targetCat.name} » et la catégorie a été archivée.`,
        'SUCCESS'
      );
    } else {
      // Safe delete / archive when 0 articles
      dbStore.updateState(draft => {
        draft.productCategories = draft.productCategories?.filter(c => c.id !== catId) || [];
      });

      dbStore.logAudit('CATEGORY_DELETED', 'PRODUCT_CATEGORY', catId, null, { name: catName });
      showToast('Catégorie supprimée', `La catégorie « ${catName} » a été supprimée définitivement.`, 'SUCCESS');
    }

    setCategoryToDelete(null);
  };

  // =========================================================================
  // ARTICLE ACTIONS
  // =========================================================================

  // =========================================================================
  // ARTICLE ACTIONS & MULTI-LEVEL PACKAGING MANAGEMENT
  // =========================================================================

  const handleAddPackaging = (isEdit: boolean) => {
    const baseU = isEdit ? editBaseUnit : newBaseUnit;
    const currentPkgs = isEdit ? editPackagings : newPackagings;
    const lastSubUnit = currentPkgs.length > 0 ? currentPkgs[currentPkgs.length - 1].unitName : baseU;
    const nextLevel = currentPkgs.length + 2;
    const defaultName = nextLevel === 2 ? 'paquet' : nextLevel === 3 ? 'carton' : `boîte-${nextLevel}`;

    const newPkg: ProductPackaging = {
      id: `pkg-${Date.now()}-${nextLevel}`,
      level: nextLevel,
      unitName: defaultName,
      containedQuantity: nextLevel === 2 ? 500 : 5,
      subUnitName: lastSubUnit,
      factorToBase: 0,
      isAllowedForSale: true,
      isAllowedForPurchase: true,
      isDefaultSaleUnit: false,
      isDefaultPurchaseUnit: false,
    };

    const { packagings: computed, error } = recalculatePackagingFactors(baseU, [...currentPkgs, newPkg]);
    if (error) {
      showToast('Configuration Conditionnement', error, 'WARNING');
      return;
    }

    if (isEdit) {
      setEditPackagings(computed);
    } else {
      setNewPackagings(computed);
    }
  };

  const handleUpdatePackaging = (index: number, updates: Partial<ProductPackaging>, isEdit: boolean) => {
    const baseU = isEdit ? editBaseUnit : newBaseUnit;
    const currentPkgs = isEdit ? [...editPackagings] : [...newPackagings];
    currentPkgs[index] = { ...currentPkgs[index], ...updates };

    const { packagings: computed } = recalculatePackagingFactors(baseU, currentPkgs);
    if (isEdit) {
      setEditPackagings(computed);
    } else {
      setNewPackagings(computed);
    }
  };

  const handleRemovePackaging = (index: number, isEdit: boolean) => {
    const baseU = isEdit ? editBaseUnit : newBaseUnit;
    const currentPkgs = (isEdit ? editPackagings : newPackagings).filter((_, i) => i !== index);
    const { packagings: computed } = recalculatePackagingFactors(baseU, currentPkgs);
    if (isEdit) {
      setEditPackagings(computed);
    } else {
      setNewPackagings(computed);
    }
  };

  const handleOpenCreateProduct = () => {
    setNewCode('');
    setNewBarcode('');
    setNewName('');
    const defaultCat = activeCategories[0] || state.productCategories[0];
    setNewCategoryId(defaultCat?.id || 'cat-prod-01');
    setNewDescription('');

    // Default template: Ramette / multi-level paper
    const baseU = 'feuille';
    setNewBaseUnit(baseU);
    const initialPkgs: ProductPackaging[] = [
      {
        id: `pkg-${Date.now()}-1`,
        level: 2,
        unitName: 'paquet',
        containedQuantity: 500,
        subUnitName: 'feuille',
        factorToBase: 500,
        salePrice: 70000,
        purchasePrice: 60000,
        wholesalePrice: 65000,
        isAllowedForSale: true,
        isAllowedForPurchase: true,
        isDefaultSaleUnit: false,
        isDefaultPurchaseUnit: false,
      },
      {
        id: `pkg-${Date.now()}-2`,
        level: 3,
        unitName: 'carton',
        containedQuantity: 5,
        subUnitName: 'paquet',
        factorToBase: 2500,
        salePrice: 330000,
        purchasePrice: 300000,
        wholesalePrice: 315000,
        isAllowedForSale: true,
        isAllowedForPurchase: true,
        isDefaultSaleUnit: false,
        isDefaultPurchaseUnit: true,
      }
    ];

    setNewPackagings(initialPkgs);
    setNewDefaultSaleUnit('feuille');
    setNewDefaultPurchaseUnit('carton');
    setNewCostPrice(120);
    setNewSalePrice(500);
    setNewWholesalePrice(400);
    setNewInitialStock(25000);
    setNewMinAlert(2500);
    setNewMaxStock(50000);
    setNewLocation('Magasin Principal - Étagère A1');
    setNewSupplierId(suppliers[0]?.id || '');
    setNewImageUrl('');
    setNewIsActive(true);
    setIsNewProductModalOpen(true);
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean, viewIndex: number = 0) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image trop volumineuse', 'La taille maximale du fichier est de 10 Mo.', 'WARNING');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawDataUrl = evt.target?.result as string;
      if (!rawDataUrl) return;

      // Optimize and resize image via Canvas to avoid filling LocalStorage quota
      const img = new window.Image();
      img.onload = () => {
        try {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          let finalDataUrl = rawDataUrl;
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          }
          
          if (isEdit) {
            setEditImages(prev => {
              const copy = [...prev];
              copy[viewIndex] = finalDataUrl;
              return copy;
            });
            if (viewIndex === 0) setEditImageUrl(finalDataUrl);
          } else {
            setNewImages(prev => {
              const copy = [...prev];
              copy[viewIndex] = finalDataUrl;
              return copy;
            });
            if (viewIndex === 0) setNewImageUrl(finalDataUrl);
          }
          showToast('Photo chargée 📸', `Vue ${viewIndex + 1} enregistrée avec succès.`, 'SUCCESS');
        } catch (err) {
          if (isEdit) {
            setEditImages(prev => {
              const copy = [...prev];
              copy[viewIndex] = rawDataUrl;
              return copy;
            });
            if (viewIndex === 0) setEditImageUrl(rawDataUrl);
          } else {
            setNewImages(prev => {
              const copy = [...prev];
              copy[viewIndex] = rawDataUrl;
              return copy;
            });
            if (viewIndex === 0) setNewImageUrl(rawDataUrl);
          }
          showToast('Photo chargée 📸', `Vue ${viewIndex + 1} chargée.`, 'SUCCESS');
        }
      };
      img.onerror = () => {
        if (isEdit) {
          setEditImages(prev => {
            const copy = [...prev];
            copy[viewIndex] = rawDataUrl;
            return copy;
          });
          if (viewIndex === 0) setEditImageUrl(rawDataUrl);
        } else {
          setNewImages(prev => {
            const copy = [...prev];
            copy[viewIndex] = rawDataUrl;
            return copy;
          });
          if (viewIndex === 0) setNewImageUrl(rawDataUrl);
        }
        showToast('Photo chargée 📸', `Vue ${viewIndex + 1} chargée.`, 'SUCCESS');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddImageView = (isEdit: boolean) => {
    if (isEdit) {
      if (editImages.length < 4) {
        setEditImages(prev => [...prev, '']);
      }
    } else {
      if (newImages.length < 4) {
        setNewImages(prev => [...prev, '']);
      }
    }
  };

  const handleUpdateImageViewUrl = (isEdit: boolean, index: number, url: string) => {
    if (isEdit) {
      setEditImages(prev => {
        const copy = [...prev];
        copy[index] = url;
        return copy;
      });
      if (index === 0) setEditImageUrl(url);
    } else {
      setNewImages(prev => {
        const copy = [...prev];
        copy[index] = url;
        return copy;
      });
      if (index === 0) setNewImageUrl(url);
    }
  };

  const handleRemoveImageView = (isEdit: boolean, index: number) => {
    if (isEdit) {
      setEditImages(prev => {
        const filtered = prev.filter((_, i) => i !== index);
        setEditImageUrl(filtered[0] || '');
        return filtered;
      });
    } else {
      setNewImages(prev => {
        const filtered = prev.filter((_, i) => i !== index);
        setNewImageUrl(filtered[0] || '');
        return filtered;
      });
    }
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    const trimmedCode = newCode.trim().toUpperCase();
    const trimmedBaseUnit = newBaseUnit.trim().toLowerCase() || 'unité';

    if (!trimmedName || !trimmedCode) {
      showToast('Validation', 'Veuillez renseigner la désignation et la référence de l’article.', 'DANGER');
      return;
    }

    // Check code uniqueness in current agency
    const existingCode = agencyProducts.find(p => p.code.toUpperCase() === trimmedCode && !p.isArchived);
    if (existingCode) {
      showToast('Doublon', 'Ce code article / référence est déjà utilisé dans votre agence.', 'DANGER');
      return;
    }

    // Check barcode uniqueness if provided in current agency
    if (newBarcode.trim()) {
      const existingBarcode = agencyProducts.find(p => p.barcode === newBarcode.trim() && !p.isArchived);
      if (existingBarcode) {
        showToast('Doublon', 'Ce code-barres est déjà associé à un autre article dans votre agence.', 'DANGER');
        return;
      }
    }

    // Validate packagings
    const { packagings: computedPkgs, error: pkgError } = recalculatePackagingFactors(trimmedBaseUnit, newPackagings);
    if (pkgError) {
      showToast('Erreur Conditionnement', pkgError, 'DANGER');
      return;
    }

    const selectedCategory = agencyCategories.find(c => c.id === newCategoryId) || agencyCategories[0];
    const supplier = suppliers.find(s => s.id === newSupplierId);
    const defaultPurchPkg = computedPkgs.find(p => p.isDefaultPurchaseUnit) || computedPkgs[computedPkgs.length - 1];

    const validImages = newImages.map(img => img.trim()).filter(img => img.length > 0).slice(0, 4);
    const primaryImg = validImages.length > 0 ? validImages[0] : (newImageUrl.trim() || undefined);

    const result = dbStore.createSecureProduct({
      code: trimmedCode,
      barcode: newBarcode.trim() || undefined,
      name: trimmedName,
      categoryId: selectedCategory?.id || 'cat-prod-01',
      category: selectedCategory?.name || 'Général',
      description: newDescription.trim() || undefined,
      imageUrl: primaryImg,
      baseUnit: trimmedBaseUnit,
      packagings: computedPkgs,
      defaultSaleUnit: newDefaultSaleUnit || trimmedBaseUnit,
      defaultPurchaseUnit: defaultPurchPkg ? defaultPurchPkg.unitName : trimmedBaseUnit,
      costPrice: newCostPrice,
      salePrice: newSalePrice,
      wholesalePrice: newWholesalePrice,
      initialStock: newInitialStock,
      minStockAlert: newMinAlert,
      maxStock: newMaxStock,
      supplierId: newSupplierId || undefined,
      supplierName: supplier?.name,
      location: newLocation.trim() || 'Magasin Principal',
      stockByLocation: { 'MAIN_STORE': newInitialStock },
      isActive: newIsActive,
    }, currentAgencyId, isSuperAdmin);

    if (!result.success) {
      showToast('Erreur Création Article', result.message, 'DANGER');
      return;
    }

    showToast('Article créé avec succès', result.message, 'SUCCESS');
    setIsNewProductModalOpen(false);
  };

  const handleOpenEditProduct = (p: Product) => {
    setProductToEdit(p);
    setEditCode(p.code);
    setEditBarcode(p.barcode || '');
    setEditName(p.name);
    setEditCategoryId(p.categoryId || agencyCategories.find(c => c.name.toLowerCase() === p.category?.toLowerCase())?.id || 'cat-prod-01');
    setEditDescription(p.description || '');
    setEditImageUrl(p.imageUrl || '');

    const baseU = p.baseUnit || p.unit || 'unité';
    setEditBaseUnit(baseU);
    const pkgs = p.packagings ? JSON.parse(JSON.stringify(p.packagings)) : [];
    setEditPackagings(pkgs);
    setEditDefaultSaleUnit(p.defaultSaleUnit || baseU);
    setEditDefaultPurchaseUnit(p.defaultPurchaseUnit || p.purchaseUnit || baseU);

    setEditCostPrice(p.costPrice || 0);
    setEditSalePrice(p.salePrice || 0);
    setEditWholesalePrice(p.wholesalePrice || p.salePrice || p.costPrice);
    setEditMinAlert(p.minStockAlert || 0);
    setEditMaxStock(p.maxStock || 100);
    setEditSupplierId(p.supplierId || '');
    setEditLocation(p.location || 'Magasin Principal');
    setEditIsActive(p.isActive !== false);
  };

  const handleSaveEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToEdit) return;

    const trimmedName = editName.trim();
    const trimmedCode = editCode.trim().toUpperCase();
    const trimmedBaseUnit = editBaseUnit.trim().toLowerCase() || 'unité';

    if (!trimmedName || !trimmedCode) {
      showToast('Validation', 'Veuillez renseigner la désignation et la référence de l’article.', 'DANGER');
      return;
    }

    // Check code uniqueness against other articles in current agency
    const duplicateCode = agencyProducts.find(
      p => p.id !== productToEdit.id && p.code.toUpperCase() === trimmedCode && !p.isArchived
    );
    if (duplicateCode) {
      showToast('Doublon', 'Ce code article est déjà utilisé par un autre article de votre agence.', 'DANGER');
      return;
    }

    if (editBarcode.trim()) {
      const duplicateBarcode = agencyProducts.find(
        p => p.id !== productToEdit.id && p.barcode === editBarcode.trim() && !p.isArchived
      );
      if (duplicateBarcode) {
        showToast('Doublon', 'Ce code-barres est déjà associé à un autre article de votre agence.', 'DANGER');
        return;
      }
    }

    // Validate packagings
    const { packagings: computedPkgs, error: pkgError } = recalculatePackagingFactors(trimmedBaseUnit, editPackagings);
    if (pkgError) {
      showToast('Erreur Conditionnement', pkgError, 'DANGER');
      return;
    }

    const selectedCategory = agencyCategories.find(c => c.id === editCategoryId);
    const supplier = suppliers.find(s => s.id === editSupplierId);
    const defaultPurchPkg = computedPkgs.find(p => p.isDefaultPurchaseUnit) || computedPkgs[computedPkgs.length - 1];

    const validImages = editImages.map(img => img.trim()).filter(img => img.length > 0).slice(0, 4);
    const primaryImg = validImages.length > 0 ? validImages[0] : (editImageUrl.trim() || undefined);

    const result = dbStore.updateSecureProduct(productToEdit.id, {
      code: trimmedCode,
      barcode: editBarcode.trim() || undefined,
      name: trimmedName,
      categoryId: selectedCategory?.id || productToEdit.categoryId,
      category: selectedCategory?.name || productToEdit.category,
      description: editDescription.trim() || undefined,
      imageUrl: primaryImg,
      baseUnit: trimmedBaseUnit,
      packagings: computedPkgs,
      defaultSaleUnit: editDefaultSaleUnit || trimmedBaseUnit,
      defaultPurchaseUnit: defaultPurchPkg ? defaultPurchPkg.unitName : (editDefaultPurchaseUnit || trimmedBaseUnit),
      costPrice: editCostPrice,
      salePrice: editSalePrice,
      wholesalePrice: editWholesalePrice,
      minStockAlert: editMinAlert,
      maxStock: editMaxStock,
      supplierId: editSupplierId || undefined,
      supplierName: supplier?.name,
      location: editLocation.trim(),
      isActive: editIsActive
    }, currentAgencyId, isSuperAdmin);

    if (!result.success) {
      showToast('Erreur Modification', result.message, 'DANGER');
      return;
    }

    showToast('Article mis à jour', result.message, 'SUCCESS');
    setProductToEdit(null);
  };

  // -------------------------------------------------------------------------
  // QUICK STOCK INCREMENT (ACTIONS RAPIDES + 1 UNITÉ / + 1 PAQUET)
  // -------------------------------------------------------------------------
  const handleQuickAddUnit = (product: Product) => {
    const unitLabel = product.baseUnit || product.unit || 'unité';
    const userName = currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName}` : 'Agent Stock';
    
    const res = dbStore.quickIncrementStock(
      product.id,
      1,
      `Ajout rapide réapprovisionnement +1 ${unitLabel}`,
      currentAgencyId,
      userName,
      unitLabel,
      isSuperAdmin
    );

    if (res.success) {
      showToast(
        'Stock Mis à Jour ⚡',
        `+1 ${unitLabel} ajouté à « ${product.name} » (Nouveau stock : ${res.newStock} ${unitLabel}s)`,
        'SUCCESS'
      );
    } else {
      showToast('Erreur', res.message, 'DANGER');
    }
  };

  const handleQuickAddPackage = (product: Product) => {
    const pkg = product.packagings && product.packagings.length > 0
      ? product.packagings[0]
      : (product.purchaseUnit && product.conversionFactor && product.conversionFactor > 1
          ? { unitName: product.purchaseUnit, factorToBase: product.conversionFactor, containedQuantity: product.conversionFactor }
          : null);

    if (!pkg || !pkg.factorToBase || pkg.factorToBase <= 1) {
      showToast('Information', "Aucun conditionnement en paquet n'est configuré pour cet article.", 'INFO');
      return;
    }

    const qtyToAdd = pkg.factorToBase;
    const unitLabel = product.baseUnit || product.unit || 'unité';
    const userName = currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName}` : 'Agent Stock';

    const res = dbStore.quickIncrementStock(
      product.id,
      qtyToAdd,
      `Ajout rapide réapprovisionnement +1 ${pkg.unitName} (+${qtyToAdd} ${unitLabel}s)`,
      currentAgencyId,
      userName,
      pkg.unitName,
      isSuperAdmin
    );

    if (res.success) {
      showToast(
        'Stock Mis à Jour 📦',
        `+1 ${pkg.unitName} (+${qtyToAdd} ${unitLabel}s) ajouté à « ${product.name} » (Nouveau stock : ${res.newStock} ${unitLabel}s)`,
        'SUCCESS'
      );
    } else {
      showToast('Erreur', res.message, 'DANGER');
    }
  };

  const handleToggleProductActive = (p: Product) => {
    setProductToToggleActive(p);
  };

  const handleConfirmToggleActiveProduct = () => {
    if (!productToToggleActive) return;
    const targetState = !productToToggleActive.isActive;
    const result = dbStore.updateSecureProduct(
      productToToggleActive.id,
      { isActive: targetState },
      currentAgencyId,
      isSuperAdmin
    );

    if (result.success) {
      showToast(
        targetState ? 'Article réactivé' : 'Article désactivé',
        `L'article « ${productToToggleActive.name} » est désormais ${targetState ? 'actif' : 'inactif'}.`,
        'SUCCESS'
      );
    } else {
      showToast('Erreur Statut', result.message, 'DANGER');
    }
    setProductToToggleActive(null);
  };

  const handleConfirmDeleteProduct = () => {
    if (!productToDelete) return;
    const result = dbStore.deleteSecureProduct(productToDelete.id, currentAgencyId, isSuperAdmin);

    if (result.success) {
      showToast('Article supprimé', `L'article « ${productToDelete.name} » a été supprimé définitivement.`, 'SUCCESS');
      setProductToDelete(null);
    } else {
      showToast('Suppression refusée', result.message, 'DANGER');
    }
  };


  const handleDeactivateInsteadFromDeleteModal = () => {
    if (!productToDelete) return;
    const result = dbStore.updateSecureProduct(
      productToDelete.id,
      { isActive: false },
      currentAgencyId,
      isSuperAdmin
    );

    if (result.success) {
      showToast('Article désactivé', `L'article « ${productToDelete.name} » a été désactivé avec succès.`, 'SUCCESS');
      setProductToDelete(null);
    } else {
      showToast('Erreur Désactivation', result.message, 'DANGER');
    }
  };

  const handleOpenArchiveProduct = (p: Product) => {
    setProductToArchive(p);
  };

  const handleConfirmArchiveProduct = () => {
    if (!productToArchive) return;
    const result = dbStore.updateSecureProduct(productToArchive.id, { isArchived: true, isActive: false }, currentAgencyId, isSuperAdmin);
    if (result.success) {
      showToast('Article archivé avec succès.', `L'article ${productToArchive.name} a été archivé. Son historique de stock est conservé.`, 'SUCCESS');
    } else {
      showToast('Erreur Archivage', result.message, 'DANGER');
    }
    setProductToArchive(null);
  };

  const handleRestoreProduct = (p: Product) => {
    const result = dbStore.updateSecureProduct(p.id, { isArchived: false, isActive: true }, currentAgencyId, isSuperAdmin);
    if (result.success) {
      showToast('Article restauré avec succès.', `L'article ${p.name} est à nouveau actif.`, 'SUCCESS');
    } else {
      showToast('Erreur Restauration', result.message, 'DANGER');
    }
  };

  const handleOpenAdjustStock = (p: Product) => {
    setProductToAdjustStock(p);
    setAdjustTargetStock(p.currentStock);
    setAdjustLocation('MAIN_STORE');
    setAdjustReason('Ajustement ponctuel et réétalonnage de stock');
  };

  const handleSaveStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToAdjustStock) return;

    const oldStock = productToAdjustStock.currentStock;
    const variance = adjustTargetStock - oldStock;

    if (variance === 0) {
      showToast('Information', 'Le stock cible est identique au stock actuel. Aucun ajustement nécessaire.', 'INFO');
      setProductToAdjustStock(null);
      return;
    }

    if (!adjustReason.trim()) {
      showToast('Validation', 'Veuillez saisir un motif pour l’ajustement de stock.', 'WARNING');
      return;
    }

    const performedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Gestionnaire Stock';
    const result = dbStore.adjustSecureProductStock(
      productToAdjustStock.id,
      adjustTargetStock,
      adjustReason.trim(),
      adjustLocation,
      currentAgencyId,
      performedBy,
      isSuperAdmin
    );

    if (!result.success) {
      showToast('Erreur Ajustement', result.message, 'DANGER');
      return;
    }

    showToast('Stock ajusté avec succès.', result.message, 'SUCCESS');
    setProductToAdjustStock(null);
  };

  // ----------------------------------------------------
  // Other Tab Handlers (Consumption, Transfer, Loss, Audit)
  // ----------------------------------------------------
  const handleProcessConsumption = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = selectedConsProduct;
    if (!prod) {
      showToast('Erreur', 'Produit sélectionné introuvable dans votre agence.', 'DANGER');
      return;
    }

    if (consQuantity <= 0) {
      showToast('Quantité Invalide', 'La quantité transférée doit être supérieure à 0.', 'DANGER');
      return;
    }

    if (consCalculation && !consCalculation.isStockSufficient) {
      showToast(
        'Stock Insuffisant',
        `Stock disponible insuffisant : ${consCalculation.currentStockInBase.toLocaleString('fr-FR')} ${consCalculation.baseUnitName}s (${consCalculation.currentStockPrestationCapacity.toLocaleString('fr-FR')} ${consCalculation.prestationUnitName}) disponibles. Vous demandez ${consCalculation.qtyInBaseUnit.toLocaleString('fr-FR')} ${consCalculation.baseUnitName}s.`,
        'DANGER'
      );
      return;
    }

    const performedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Opérateur Production';
    const chosenUnit = consUnit || prod.defaultPurchaseUnit || prod.unit || 'unité';
    const result = dbStore.consumeSecureProductStock(
      prod.id,
      consQuantity,
      consServiceName,
      consOrderNumber,
      consReason,
      currentAgencyId,
      performedBy,
      isSuperAdmin,
      chosenUnit,
      consServiceId || undefined
    );

    if (!result.success) {
      showToast('Erreur Transfert Consommation', result.message, 'DANGER');
      return;
    }

    showToast('Transfert Consommation Validé 🛠️', result.message, 'SUCCESS');
    setConsQuantity(1);
    setConsOrderNumber('');
  };

  const handleProcessTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transSource === transDestination) {
      showToast('Emplacements Identiques', 'La source et la destination doivent être différentes.', 'WARNING');
      return;
    }

    const prod = agencyProducts.find(p => p.id === transProductId);
    if (!prod) {
      showToast('Erreur', 'Produit sélectionné introuvable dans votre agence.', 'DANGER');
      return;
    }

    if (transQuantity <= 0) {
      showToast('Quantité Invalide', 'La quantité transférée doit être supérieure à 0.', 'DANGER');
      return;
    }

    const performedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Responsable Logistique';
    const result = dbStore.transferSecureProductStock(
      prod.id,
      transQuantity,
      transSource,
      transDestination,
      transReason,
      currentAgencyId,
      performedBy,
      isSuperAdmin
    );

    if (!result.success) {
      showToast('Erreur Transfert', result.message, 'DANGER');
      return;
    }

    showToast('Transfert Validé 🔄', result.message, 'SUCCESS');
    setTransQuantity(10);
  };

  const handleProcessLoss = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = agencyProducts.find(p => p.id === lossProductId);
    if (!prod) {
      showToast('Erreur', 'Produit sélectionné introuvable dans votre agence.', 'DANGER');
      return;
    }

    if (lossQuantity <= 0) {
      showToast('Quantité Invalide', 'La quantité déclarée doit être supérieure à 0.', 'DANGER');
      return;
    }

    const performedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Gestionnaire';
    const result = dbStore.recordSecureProductLoss(
      prod.id,
      lossQuantity,
      lossType,
      lossReason,
      currentAgencyId,
      performedBy,
      isSuperAdmin
    );

    if (!result.success) {
      showToast('Erreur Perte', result.message, 'DANGER');
      return;
    }

    showToast('Perte Enregistrée', result.message, 'WARNING');
    setLossQuantity(1);
    setLossReason('');
  };

  const handleApplyAuditItem = (product: Product) => {
    const physicalCount = auditCounts[product.id];
    if (physicalCount === undefined) {
      showToast('Attention', 'Veuillez saisir le comptage physique.', 'WARNING');
      return;
    }

    const reason = auditReasons[product.id] || 'Régularisation suite à inventaire physique périodique';
    const performedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Auditeur Inventaire';
    const result = dbStore.applySecureInventoryAudit(
      product.id,
      physicalCount,
      reason,
      currentAgencyId,
      performedBy,
      isSuperAdmin
    );

    if (!result.success) {
      showToast('Erreur Inventaire', result.message, 'DANGER');
      return;
    }

    showToast('Inventaire Régularisé', result.message, 'SUCCESS');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Boxes className="w-6 h-6 text-brand-500" />
              Stock Central
            </h2>
            <Badge variant="primary" size="sm" className="font-bold text-[11px] px-2 py-0.5">
              🏬 {currentTenant?.name || 'Agence Active'} ({currentAgencyId})
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ressource physique centrale commune pour la Boutique, les Prestations et le Marketplace.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={activeTab === 'categories' ? 'primary' : 'outline'}
            icon={FolderTree}
            onClick={() => setActiveTab('categories')}
            className="text-xs font-bold"
          >
            ⚙️ Gérer les Catégories ({agencyCategories.length})
          </Button>

          {hasPermission('article.create') && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={handleOpenCreateProduct}
              className="font-bold text-xs"
            >
              + Nouvel Article
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-4 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Valeur du Stock</span>
            <DollarSign className="w-4 h-4 text-brand-500" />
          </div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
            {formatCurrency(metrics.totalValue)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {metrics.totalCount} articles actifs valorisés
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Stock Normal</span>
            <PackageCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-lg font-extrabold text-emerald-600 mt-1">
            {metrics.totalCount - metrics.lowStockCount - metrics.outOfStockCount}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Disponibilité optimale</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Stock Faible</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-lg font-extrabold text-amber-600 mt-1">
            {metrics.lowStockCount}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Niveau ≤ Seuil d'alerte</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Ruptures</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-lg font-extrabold text-rose-600 mt-1">
            {metrics.outOfStockCount}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Stock épuisé (0 unité)</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Catégories Actives</span>
            <FolderTree className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-lg font-extrabold text-amber-600 mt-1">
            {metrics.totalCategoriesCount}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {metrics.archivedCount > 0 ? `${metrics.archivedCount} article(s) archivé(s)` : 'Tous catalogues à jour'}
          </p>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        tabs={[
          { id: 'inventory', label: `Stock Central (${agencyProducts.filter(p => !p.isArchived).length})`, icon: Boxes },
          { id: 'categories', label: `Gestion des Catégories (${agencyCategories.length})`, icon: FolderTree },
          { id: 'movements', label: `Journal Mouvements (${agencyMovements.length})`, icon: History },
          { id: 'losses', label: 'Pertes & Détériorations', icon: Flame },
          { id: 'audit', label: 'Inventaire Physique', icon: CheckCircle2 },
          { id: 'analytics', label: 'Valorisation & Rapports', icon: Calculator },
        ]}
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as any)}
      />

      {/* ========================================================================= */}
      {/* TAB 1: CATALOGUE & ARTICLES DE STOCK */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && (
        <Card className="p-4 sm:p-6 space-y-4">
          {/* Header & Filter Bar */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                type="text"
                placeholder="Rechercher par désignation, référence, code-barres, catégorie, emplacement..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Commutateur Grille / Tableau */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode('CARDS')}
                  className={`px-2.5 py-1 text-xs font-extrabold rounded-lg flex items-center gap-1.5 transition-all ${
                    viewMode === 'CARDS'
                      ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Affichage en Cartes"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cartes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('TABLE')}
                  className={`px-2.5 py-1 text-xs font-extrabold rounded-lg flex items-center gap-1.5 transition-all ${
                    viewMode === 'TABLE'
                      ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Affichage en Tableau"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Tableau</span>
                </button>
              </div>

              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs min-w-[150px]"
              >
                <option value="ALL">Toutes les Catégories</option>
                {agencyCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} {!cat.isActive ? '(Inactive)' : ''}
                  </option>
                ))}
              </Select>

              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs min-w-[170px]"
              >
                <option value="ACTIVE">🟢 Articles actifs (Par défaut)</option>
                <option value="ALL">📋 Tous les articles</option>
                <option value="INACTIVE">⛔ Articles désactivés</option>
                <option value="LOW">🟠 Stock Faible</option>
                <option value="OUT">🔴 En Rupture</option>
                <option value="ARCHIVED">🗃️ Articles Archivés</option>
              </Select>

              <Select
                value={photoFilter}
                onChange={(e) => setPhotoFilter(e.target.value as any)}
                className="text-xs min-w-[130px]"
              >
                <option value="ALL">🖼️ Toutes les photos</option>
                <option value="WITH_PHOTO">Avec photo</option>
                <option value="WITHOUT_PHOTO">Sans photo (📦)</option>
              </Select>

              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={handleOpenCreateProduct}
                className="text-xs font-bold shrink-0 bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-800"
              >
                Nouvel Article
              </Button>
            </div>
          </div>

          {/* Active filter indication for archived items */}
          {statusFilter === 'ARCHIVED' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-amber-600" />
                Vous consultez actuellement les <strong>articles archivés</strong>. Ces articles sont masqués des opérations quotidiennes mais leur historique complet est conservé.
              </span>
              <Button size="sm" variant="ghost" onClick={() => setStatusFilter('ALL')} className="text-xs font-bold text-amber-700">
                Fermer ce filtre
              </Button>
            </div>
          )}

          {/* ================================================================= */}
          {/* AFFICHAGE SOUS FORME DE CARTES PRODUITS (GRILLE RESPONSIVE) */}
          {/* ================================================================= */}
          {viewMode === 'CARDS' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">Aucun article ne correspond aux filtres sélectionnés.</p>
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isOutOfStock = p.currentStock <= 0;
                  const isLowStock = p.currentStock <= p.minStockAlert && p.currentStock > 0;
                  const unitLabel = p.baseUnit || p.unit || 'unité';
                  
                  // Packaging extraction
                  const pkg = p.packagings && p.packagings.length > 0
                    ? p.packagings[0]
                    : (p.purchaseUnit && p.conversionFactor && p.conversionFactor > 1
                        ? { unitName: p.purchaseUnit, factorToBase: p.conversionFactor, containedQuantity: p.conversionFactor, salePrice: p.salePricePerPurchaseUnit }
                        : null);

                  const hasPackaging = Boolean(pkg && pkg.factorToBase && pkg.factorToBase > 1);

                  // Progress percentage
                  const maxTarget = p.maxStock && p.maxStock > 0 ? p.maxStock : Math.max(p.minStockAlert * 3, 50);
                  const progressPct = Math.min(Math.round((p.currentStock / maxTarget) * 100), 100);

                  return (
                    <Card
                      key={p.id}
                      className={`relative overflow-visible flex flex-col justify-between transition-all hover:shadow-lg border ${
                        activeActionMenuId === p.id ? 'z-30 shadow-md ring-1 ring-brand-500/40' : 'z-0'
                      } ${
                        p.isArchived
                          ? 'opacity-60 bg-slate-50 dark:bg-slate-900/40 border-slate-200'
                          : !p.isActive
                          ? 'opacity-75 bg-slate-50/80 dark:bg-slate-900/30 border-slate-300 dark:border-slate-700'
                          : isOutOfStock
                          ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/10'
                          : isLowStock
                          ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/10'
                          : 'border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      {/* Top Visual Container with Photo or Placeholder */}
                      <ProductCardVisual
                        imageUrl={p.imageUrl}
                        name={p.name}
                        category={p.category}
                        isArchived={p.isArchived}
                        isOutOfStock={isOutOfStock}
                        isLowStock={isLowStock}
                        isActive={p.isActive}
                      />

                      {/* Card Content */}
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Code / SKU & Barcode */}
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
                            <span className="font-bold text-slate-500 dark:text-slate-400">Réf : {p.code}</span>
                            {p.barcode && <span>EAN : {p.barcode}</span>}
                          </div>

                          {/* Product Name */}
                          <h4
                            onClick={() => setProductToView(p)}
                            className="font-black text-sm text-slate-900 dark:text-white line-clamp-2 hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer transition-colors"
                            title={p.name}
                          >
                            {p.name}
                          </h4>

                          {/* Pricing */}
                          <div className="mt-2 flex items-baseline justify-between gap-1">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Prix Unitaire</span>
                              <strong className="text-sm font-black text-brand-600 dark:text-brand-400">
                                {p.salePrice ? formatCurrency(p.salePrice) : formatCurrency(p.costPrice)}
                              </strong>
                              <span className="text-[10px] text-slate-400 font-medium"> / {unitLabel}</span>
                            </div>

                            {hasPackaging && pkg?.salePrice && (
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block font-semibold">Prix {pkg.unitName}</span>
                                <strong className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                  {formatCurrency(pkg.salePrice)}
                                </strong>
                              </div>
                            )}
                          </div>

                          {/* Packaging info banner */}
                          {hasPackaging && (
                            <div className="mt-2 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300 font-medium flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Package className="w-3.5 h-3.5 text-brand-500" />
                                1 {pkg?.unitName} = <strong>{pkg?.containedQuantity || pkg?.factorToBase} {unitLabel}s</strong>
                              </span>
                            </div>
                          )}

                          {/* Stock Level & Indicator */}
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-slate-500 dark:text-slate-400 text-[11px]">Stock disponible :</span>
                              <span className={`text-xs font-black ${isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                                {p.currentStock.toLocaleString('fr-FR')} {unitLabel}s
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isOutOfStock
                                    ? 'bg-rose-500'
                                    : isLowStock
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Quick Actions Buttons Footer */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              icon={Zap}
                              onClick={() => handleQuickAddUnit(p)}
                              className={`text-xs font-extrabold shadow-sm bg-white dark:bg-slate-900 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/40 ${
                                !hasPackaging ? 'col-span-2' : ''
                              }`}
                              title={`Ajouter +1 ${unitLabel}`}
                            >
                              + 1 {unitLabel}
                            </Button>

                            {hasPackaging && (
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                icon={Plus}
                                onClick={() => handleQuickAddPackage(p)}
                                className="text-xs font-extrabold bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                                title={`Ajouter +1 ${pkg?.unitName} (+${pkg?.factorToBase} ${unitLabel}s)`}
                              >
                                + 1 {pkg?.unitName}
                              </Button>
                            )}
                          </div>

                          {/* Secondary context buttons */}
                          <div className="flex items-center justify-between pt-1 text-slate-400">
                            <button
                              type="button"
                              onClick={() => setProductToView(p)}
                              className="text-[11px] font-semibold text-slate-500 hover:text-brand-600 flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Fiche
                            </button>

                            <div className="flex items-center gap-1">
                              <ProductActionsDropdown
                                product={p}
                                isOpen={activeActionMenuId === p.id}
                                onToggle={() => setActiveActionMenuId(activeActionMenuId === p.id ? null : p.id)}
                                onClose={() => setActiveActionMenuId(null)}
                                onView={() => setProductToView(p)}
                                onEdit={() => handleOpenEditProduct(p)}
                                onAdjust={() => handleOpenAdjustStock(p)}
                                onBarcode={() => setProductForBarcode(p)}
                                onToggleActive={() => handleToggleProductActive(p)}
                                onDelete={() => setProductToDelete(p)}
                                canEdit={isSuperAdmin || hasPermission('article.edit') || hasPermission('stock.manage')}
                                canDelete={isSuperAdmin || hasPermission('article.delete') || hasPermission('stock.manage')}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            /* ================================================================= */
            /* AFFICHAGE EN TABLEAU CLASSIC / LISTE */
            /* ================================================================= */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf. & Code</TableHead>
                    <TableHead>Désignation Article</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Multi-Unités</TableHead>
                    <TableHead>Stock Actuel</TableHead>
                    <TableHead>Coût Unitaire</TableHead>
                    <TableHead>Prix Vente</TableHead>
                    <TableHead>Valeur Stock</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions Rapides & Gestion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => {
                    const isOutOfStock = p.currentStock <= 0;
                    const isLowStock = p.currentStock <= p.minStockAlert && p.currentStock > 0;
                    const totalProdValue = p.currentStock * p.costPrice;
                    const unitLabel = p.baseUnit || p.unit || 'unité';
                    
                    const pkg = p.packagings && p.packagings.length > 0
                      ? p.packagings[0]
                      : (p.purchaseUnit && p.conversionFactor && p.conversionFactor > 1
                          ? { unitName: p.purchaseUnit, factorToBase: p.conversionFactor, containedQuantity: p.conversionFactor }
                          : null);
                    const hasPackaging = Boolean(pkg && pkg.factorToBase && pkg.factorToBase > 1);

                    return (
                      <TableRow
                        key={p.id}
                        className={p.isArchived ? 'opacity-60 bg-slate-100/70 dark:bg-slate-900/60' : !p.isActive ? 'opacity-70 bg-slate-50 dark:bg-slate-950' : ''}
                      >
                        <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{p.code}</span>
                            {p.isArchived && (
                              <Badge variant="secondary" size="sm" className="text-[9px] px-1 py-0">
                                Archivé
                              </Badge>
                            )}
                          </div>
                          {p.barcode && (
                            <div className="text-[10px] text-slate-400 font-normal">{p.barcode}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ProductThumbnailSmall
                              imageUrl={p.imageUrl}
                              alt={p.name}
                              size="sm"
                            />
                            <div>
                              <strong className="text-xs text-slate-900 dark:text-white block hover:text-brand-600 cursor-pointer" onClick={() => setProductToView(p)}>
                                {p.name}
                              </strong>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3 inline" />
                                {p.location || 'Magasin Principal'}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" size="sm" className="font-semibold">
                            {p.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.packagings && p.packagings.length > 0 ? (
                            <div className="space-y-1">
                              {p.packagings.map((pkgItem, idx) => (
                                <div key={pkgItem.id || idx} className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                  1 {pkgItem.unitName} = <strong className="text-brand-600 dark:text-brand-400">{pkgItem.containedQuantity} {pkgItem.subUnitName}s</strong>
                                  {pkgItem.subUnitName.toLowerCase() !== unitLabel.toLowerCase() && (
                                    <span className="text-slate-400"> ({pkgItem.factorToBase} {unitLabel}s)</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">1 {unitLabel} (Unitaire)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <strong className={`text-sm font-black ${isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                            {p.currentStock.toLocaleString('fr-FR')} {unitLabel}s
                          </strong>
                          {p.packagings && p.packagings.length > 0 && p.currentStock > 0 && (
                            <span className="text-[11px] text-brand-700 dark:text-brand-300 font-semibold block mt-0.5 bg-brand-50/80 dark:bg-brand-950/60 px-1.5 py-0.5 rounded border border-brand-100 dark:border-brand-900">
                              {formatSmartStockBreakdown(p.currentStock, p)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {formatCurrency(p.costPrice)}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-brand-600 dark:text-brand-400">
                          {p.salePrice ? formatCurrency(p.salePrice) : '-'}
                        </TableCell>
                        <TableCell className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {formatCurrency(totalProdValue)}
                        </TableCell>
                        <TableCell>
                          {p.isArchived ? (
                            <Badge variant="secondary" size="sm" className="font-bold">
                              🗃️ Archivé
                            </Badge>
                          ) : (
                            <Badge
                              variant={isOutOfStock ? 'danger' : isLowStock ? 'warning' : p.isActive ? 'success' : 'secondary'}
                              size="sm"
                              className="font-bold"
                            >
                              {isOutOfStock ? 'Rupture' : isLowStock ? 'Stock Faible' : p.isActive ? 'Actif' : 'Inactif'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Fast Action Buttons in table */}
                            {!p.isArchived && (
                              <div className="flex items-center gap-1 mr-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleQuickAddUnit(p)}
                                  className="h-7 px-2 text-[10px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                                  title={`+1 ${unitLabel}`}
                                >
                                  +1 {unitLabel}
                                </Button>
                                {hasPackaging && (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleQuickAddPackage(p)}
                                    className="h-7 px-2 text-[10px] font-bold bg-brand-600 text-white"
                                    title={`+1 ${pkg?.unitName} (+${pkg?.factorToBase} ${unitLabel}s)`}
                                  >
                                    +1 {pkg?.unitName}
                                  </Button>
                                )}
                              </div>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Eye}
                              onClick={() => setProductToView(p)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-brand-600"
                              title="Voir la fiche détaillée"
                            />

                            {!p.isArchived && (
                              <ProductActionsDropdown
                                product={p}
                                placement="bottom"
                                isOpen={activeActionMenuId === p.id}
                                onToggle={() => setActiveActionMenuId(activeActionMenuId === p.id ? null : p.id)}
                                onClose={() => setActiveActionMenuId(null)}
                                onView={() => setProductToView(p)}
                                onEdit={() => handleOpenEditProduct(p)}
                                onAdjust={() => handleOpenAdjustStock(p)}
                                onBarcode={() => setProductForBarcode(p)}
                                onToggleActive={() => handleToggleProductActive(p)}
                                onDelete={() => setProductToDelete(p)}
                                canEdit={isSuperAdmin || hasPermission('article.edit') || hasPermission('stock.manage')}
                                canDelete={isSuperAdmin || hasPermission('article.delete') || hasPermission('stock.manage')}
                              />
                            )}

                            {p.isArchived && (
                              <Button
                                size="sm"
                                variant="outline"
                                icon={RotateCcw}
                                onClick={() => handleRestoreProduct(p)}
                                className="h-8 text-xs text-emerald-600 font-bold"
                                title="Restaurer l'article"
                              >
                                Restaurer
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-10 text-slate-400 text-xs">
                        Aucun article de stock trouvé avec ces critères de recherche.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STOCK PRESTATION (Postes de Travail & Ateliers) */}
      {/* ========================================================================= */}
      {activeTab === 'prestation_stock' && (
        <div className="space-y-6">
          {/* Prestation Stock Top KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <Card className="p-3.5 border-l-4 border-l-brand-500 bg-gradient-to-br from-white to-brand-50/20 dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Articles Prestation</span>
                <Sparkles className="w-4 h-4 text-brand-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {prestationMetrics.totalItems}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Produits suivis en atelier</p>
            </Card>

            <Card className="p-3.5 border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/20 dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Volume Disponible</span>
                <PackageCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <h3 className="text-xl font-black text-emerald-600 mt-1">
                {prestationMetrics.totalQty.toLocaleString('fr-FR')}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Unités prêtes à consommer</p>
            </Card>

            <Card className="p-3.5 border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/20 dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stock Faible</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-xl font-black text-amber-600 mt-1">
                {prestationMetrics.lowStockCount}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Sous le seuil d'alerte</p>
            </Card>

            <Card className="p-3.5 border-l-4 border-l-rose-500 bg-gradient-to-br from-white to-rose-50/20 dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">En Rupture</span>
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
              <h3 className="text-xl font-black text-rose-600 mt-1">
                {prestationMetrics.outOfStockCount}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">0 unité disponible</p>
            </Card>

            <Card className="p-3.5 border-l-4 border-l-brand-500 bg-gradient-to-br from-white to-brand-50/20 dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Transferts Reçus</span>
                <ArrowLeftRight className="w-4 h-4 text-brand-500" />
              </div>
              <h3 className="text-xl font-black text-brand-600 mt-1">
                {prestationMetrics.recentTransfersCount}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Mouvements magasin → atelier</p>
            </Card>

            <Card className="p-3.5 border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/20 dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Consommations</span>
                <Wrench className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-xl font-black text-amber-600 mt-1">
                {prestationMetrics.recentConsumptionsCount}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Prestations réalisées</p>
            </Card>
          </div>

          {/* Main Card with Controls & Product List */}
          <Card className="p-4 sm:p-6 space-y-4">
            {/* Header & Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Stock Disponible pour Prestations ({filteredPrestationProducts.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stock déporté aux postes de travail. Les consommations sont automatiquement déduites lors des prestations caissiers.
                </p>
              </div>

              {/* View Mode & Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPrestationViewMode('CARDS')}
                    className={`p-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                      prestationViewMode === 'CARDS'
                        ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Affichage en cartes avec photos"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cartes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrestationViewMode('TABLE')}
                    className={`p-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                      prestationViewMode === 'TABLE'
                        ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Affichage en tableau synthétique"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tableau</span>
                  </button>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  icon={ArrowLeftRight}
                  onClick={() => setActiveTab('consumption')}
                  className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Transférer depuis Magasin
                </Button>
              </div>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  type="text"
                  placeholder="Rechercher par nom, code, catégorie..."
                  value={prestationSearch}
                  onChange={(e) => setPrestationSearch(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Select
                  value={prestationCategoryFilter}
                  onChange={(e) => setPrestationCategoryFilter(e.target.value)}
                  className="text-xs min-w-[140px]"
                >
                  <option value="ALL">Toutes les catégories</option>
                  {agencyCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </Select>

                <Select
                  value={prestationStatusFilter}
                  onChange={(e) => setPrestationStatusFilter(e.target.value as any)}
                  className="text-xs min-w-[140px]"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="AVAILABLE">🟢 Disponible</option>
                  <option value="LOW">🟡 Stock Faible</option>
                  <option value="OUT">🔴 En Rupture</option>
                </Select>
              </div>
            </div>

            {/* ================================================================= */}
            {/* AFFICHAGE GRILLE DE CARTES STOCK PRESTATION */}
            {/* ================================================================= */}
            {prestationViewMode === 'CARDS' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredPrestationProducts.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">Aucun article trouvé dans le Stock Prestation.</p>
                  </div>
                ) : (
                  filteredPrestationProducts.map((p) => {
                    const pStock = p.prestationStock || 0;
                    const pMinAlert = p.prestationMinStockAlert || p.minStockAlert || 0;
                    const isOutOfStock = pStock === 0;
                    const isLowStock = pStock <= pMinAlert && pStock > 0;
                    const unitLabel = p.baseUnit || p.unit || 'unité';
                    const stats = getProductPrestationStats(p.id);

                    return (
                      <Card
                        key={p.id}
                        className={`overflow-hidden border transition-all duration-200 hover:shadow-lg flex flex-col justify-between ${
                          isOutOfStock
                            ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/10'
                            : isLowStock
                            ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/10'
                            : 'border-slate-200 dark:border-slate-800 hover:border-brand-300'
                        }`}
                      >
                        <div>
                          {/* Image box */}
                          <div className="relative h-36 w-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-slate-800">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="h-full w-full object-contain p-2 hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-slate-400 p-4">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black text-lg mb-1">
                                  {p.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[10px] font-semibold text-slate-400">Sans image catalogue</span>
                              </div>
                            )}

                            {/* Status badge on top */}
                            <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                              {isOutOfStock ? (
                                <Badge variant="danger" size="sm" className="font-bold shadow-sm">
                                  🔴 Rupture Atelier
                                </Badge>
                              ) : isLowStock ? (
                                <Badge variant="warning" size="sm" className="font-bold shadow-sm">
                                  🟡 Stock Faible
                                </Badge>
                              ) : (
                                <Badge variant="success" size="sm" className="font-bold shadow-sm">
                                  🟢 Disponible
                                </Badge>
                              )}
                            </div>

                            {/* Category badge on bottom left */}
                            <div className="absolute bottom-2 left-2">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 shadow-sm backdrop-blur-xs">
                                {p.category}
                              </span>
                            </div>
                          </div>

                          {/* Content area */}
                          <div className="p-4 space-y-3">
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                                  {p.code}
                                </span>
                              </div>
                              <h4
                                className="text-sm font-black text-slate-900 dark:text-white line-clamp-1 hover:text-brand-600 cursor-pointer mt-0.5"
                                onClick={() => setProductToViewPrestation(p)}
                                title={p.name}
                              >
                                {p.name}
                              </h4>
                            </div>

                            {/* Prestation stock highlighted box */}
                            <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/80 dark:to-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Stock Prestation
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Min: {pMinAlert} {unitLabel}s
                                </span>
                              </div>

                              <div className="flex items-baseline gap-1.5">
                                <span className={`text-2xl font-black ${
                                  isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  {pStock.toLocaleString('fr-FR')}
                                </span>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                  {unitLabel}{pStock > 1 ? 's' : ''}
                                </span>
                              </div>

                              {/* Main store stock reference */}
                              <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-between text-[11px] text-slate-500">
                                <span>Réserve Magasin :</span>
                                <strong className="text-slate-700 dark:text-slate-300">
                                  {p.currentStock.toLocaleString('fr-FR')} {unitLabel}s
                                </strong>
                              </div>
                            </div>

                            {/* Quick stats */}
                            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 pt-1">
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                                <span className="text-slate-400 block">Cumul Transféré</span>
                                <strong className="text-slate-700 dark:text-slate-200 text-xs">
                                  {stats.totalTransferred.toLocaleString('fr-FR')} {unitLabel}s
                                </strong>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                                <span className="text-slate-400 block">Cumul Consommé</span>
                                <strong className="text-slate-700 dark:text-slate-200 text-xs">
                                  {stats.totalConsumed.toLocaleString('fr-FR')} {unitLabel}s
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card actions */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            icon={Eye}
                            onClick={() => setProductToViewPrestation(p)}
                            className="text-xs font-bold flex-1 h-8 justify-center"
                          >
                            Détails
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            icon={Wrench}
                            onClick={() => {
                              setConsProductId(p.id);
                              setActiveTab('consumption');
                            }}
                            className="text-xs font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 h-8"
                            title="Transférer du stock magasin vers prestation"
                          >
                            + Transférer
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Edit}
                            onClick={() => handleOpenAdjustPrestation(p)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                            title="Ajuster le stock prestation manuellement"
                          />
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            ) : (
              /* ================================================================= */
              /* AFFICHAGE TABLEAU SYNTHÉTIQUE STOCK PRESTATION */
              /* ================================================================= */
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">Photo</TableHead>
                      <TableHead>Code & Référence</TableHead>
                      <TableHead>Article</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Stock Prestation Dispo</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Réserve Magasin</TableHead>
                      <TableHead className="text-right">Transféré Total</TableHead>
                      <TableHead className="text-right">Consommé Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrestationProducts.map((p) => {
                      const pStock = p.prestationStock || 0;
                      const pMinAlert = p.prestationMinStockAlert || p.minStockAlert || 0;
                      const isOutOfStock = pStock === 0;
                      const isLowStock = pStock <= pMinAlert && pStock > 0;
                      const unitLabel = p.baseUnit || p.unit || 'unité';
                      const stats = getProductPrestationStats(p.id);

                      return (
                        <TableRow key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <TableCell className="text-center">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-8 h-8 rounded-lg object-contain bg-slate-100 dark:bg-slate-800 p-0.5 mx-auto"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 font-bold text-xs flex items-center justify-center mx-auto">
                                {p.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="font-mono text-xs font-bold text-slate-500">
                            {p.code}
                          </TableCell>

                          <TableCell>
                            <strong
                              className="text-xs text-slate-900 dark:text-white block hover:text-brand-600 cursor-pointer"
                              onClick={() => setProductToViewPrestation(p)}
                            >
                              {p.name}
                            </strong>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" size="sm" className="font-semibold">
                              {p.category}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right font-black text-sm">
                            <span className={isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'}>
                              {pStock.toLocaleString('fr-FR')} {unitLabel}s
                            </span>
                          </TableCell>

                          <TableCell>
                            {isOutOfStock ? (
                              <Badge variant="danger" size="sm">🔴 Rupture</Badge>
                            ) : isLowStock ? (
                              <Badge variant="warning" size="sm">🟡 Faible</Badge>
                            ) : (
                              <Badge variant="success" size="sm">🟢 Dispo</Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {p.currentStock.toLocaleString('fr-FR')} {unitLabel}s
                          </TableCell>

                          <TableCell className="text-right text-xs text-slate-500">
                            +{stats.totalTransferred.toLocaleString('fr-FR')} {unitLabel}s
                          </TableCell>

                          <TableCell className="text-right text-xs text-rose-600 font-medium">
                            -{stats.totalConsumed.toLocaleString('fr-FR')} {unitLabel}s
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={Eye}
                                onClick={() => setProductToViewPrestation(p)}
                                className="h-7 w-7 p-0 text-slate-500 hover:text-brand-600"
                                title="Voir la fiche détaillée"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                icon={ArrowLeftRight}
                                onClick={() => {
                                  setConsProductId(p.id);
                                  setActiveTab('consumption');
                                }}
                                className="h-7 px-2 text-[10px] font-bold text-amber-600"
                                title="Transférer depuis le magasin"
                              >
                                Transférer
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {filteredPrestationProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-slate-400 text-xs">
                          Aucun article correspondant dans le Stock Prestation.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GESTION COMPLÈTE DES CATÉGORIES */}
      {/* ========================================================================= */}
      {activeTab === 'categories' && (
        <Card className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-brand-600" />
                Gestion des Catégories du Catalogue
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Créez, modifiez, désactivez ou réaffectez les catégories d'articles en toute sécurité sans perte de traçabilité.
              </p>
            </div>

            <Button
              variant="primary"
              icon={Plus}
              onClick={handleOpenCreateCategory}
              className="text-xs font-bold self-start sm:self-auto"
            >
              + Nouvelle Catégorie
            </Button>
          </div>

          {/* Categories Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex-1 relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                type="text"
                placeholder="Rechercher par nom de catégorie, code ou description..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <Select
              value={categoryStatusFilter}
              onChange={(e) => setCategoryStatusFilter(e.target.value as any)}
              className="text-xs min-w-[150px]"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="ACTIVE">🟢 Actives uniquement</option>
              <option value="INACTIVE">⚪ Inactives</option>
              <option value="ARCHIVED">🗃️ Archivées</option>
            </Select>
          </div>

          {/* Categories Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom de la Catégorie</TableHead>
                  <TableHead>Code Unique</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Articles Associés</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((cat) => {
                  const articleStats = articlesCountByCategoryId[cat.id] || { total: 0, active: 0 };
                  const isArchived = !!cat.isArchived;

                  return (
                    <TableRow key={cat.id} className={isArchived ? 'opacity-60 bg-slate-100/60 dark:bg-slate-900/60' : !cat.isActive ? 'opacity-70 bg-slate-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color || '#3b82f6' }}
                          />
                          <strong className="text-xs text-slate-900 dark:text-white block">
                            {cat.name}
                          </strong>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        {cat.code}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-xs truncate" title={cat.description}>
                        {cat.description || '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={articleStats.total > 0 ? 'primary' : 'outline'} size="sm" className="font-bold">
                          {articleStats.total} article(s)
                        </Badge>
                        {articleStats.total > 0 && articleStats.active !== articleStats.total && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            ({articleStats.active} actifs)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isArchived ? (
                          <Badge variant="secondary" size="sm" className="font-bold">
                            🗃️ Archivée
                          </Badge>
                        ) : (
                          <Badge variant={cat.isActive ? 'success' : 'secondary'} size="sm" className="font-bold">
                            {cat.isActive ? '🟢 Active' : '⚪ Inactive'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {cat.createdAt ? formatDate(cat.createdAt) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isArchived && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                icon={Edit}
                                onClick={() => handleOpenEditCategory(cat)}
                                className="h-8 text-xs font-bold"
                              >
                                Modifier
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                icon={Power}
                                onClick={() => handleToggleCategoryActive(cat)}
                                className={`h-8 w-8 p-0 ${cat.isActive ? 'text-amber-500 hover:text-amber-700' : 'text-emerald-500 hover:text-emerald-700'}`}
                                title={cat.isActive ? 'Désactiver la catégorie' : 'Réactiver la catégorie'}
                              />

                              <Button
                                size="sm"
                                variant="ghost"
                                icon={Trash2}
                                onClick={() => handleOpenDeleteOrReassign(cat)}
                                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700"
                                title={articleStats.total > 0 ? 'Désactiver ou Réaffecter les articles' : 'Supprimer définitivement'}
                              />
                            </>
                          )}

                          {isArchived && (
                            <Button
                              size="sm"
                              variant="outline"
                              icon={RotateCcw}
                              onClick={() => handleRestoreCategory(cat)}
                              className="h-8 text-xs text-emerald-600 font-bold"
                            >
                              Restaurer
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredCategories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                      Aucune catégorie trouvée.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: JOURNAL DES MOUVEMENTS DE STOCK */}
      {/* ========================================================================= */}
      {activeTab === 'movements' && (
        <Card className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Historique Complet des Mouvements de Stock
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Traçabilité intégrale de chaque variation : réceptions, consommations, ventes, transferts et ajustements.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Heure</TableHead>
                  <TableHead>Article</TableHead>
                  <TableHead>Type Mouvement</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Avant → Après</TableHead>
                  <TableHead>Emplacement</TableHead>
                  <TableHead>Motif & Référence</TableHead>
                  <TableHead>Opérateur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencyMovements.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(m.createdAt)}
                      </TableCell>
                      <TableCell className="font-bold text-xs text-slate-900 dark:text-white">
                        {m.productName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            m.movementType === 'PURCHASE_ENTRY' || m.movementType === 'IN' || m.movementType === 'CUSTOMER_RETURN'
                              ? 'success'
                              : m.movementType === 'INTERNAL_CONSUMPTION'
                              ? 'warning'
                              : m.movementType === 'LOSS' || m.movementType === 'DETERIORATION'
                              ? 'danger'
                              : 'outline'
                          }
                          size="sm"
                          className="font-bold text-[10px]"
                        >
                          {m.movementType === 'PURCHASE_ENTRY'
                            ? '📥 Réception Fournisseur'
                            : m.movementType === 'INTERNAL_CONSUMPTION'
                            ? '🛠️ Consommation Interne'
                            : m.movementType === 'TRANSFER_OUT'
                            ? '📤 Transfert Sortie'
                            : m.movementType === 'TRANSFER_IN'
                            ? '📥 Transfert Entrée'
                            : m.movementType === 'DETERIORATION' || m.movementType === 'LOSS'
                            ? '🔥 Perte / Détérioration'
                            : m.movementType === 'INVENTORY_ADJUSTMENT'
                            ? '⚖️ Ajustement Inventaire'
                            : m.movementType === 'CUSTOMER_RETURN'
                            ? '↩️ Retour Client'
                            : m.movementType}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-xs font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPositive ? `+${m.quantity}` : m.quantity} {m.unitUsed || 'unités'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {m.oldStock !== undefined ? `${m.oldStock} → ${m.newStock}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {m.destinationLocation || m.sourceLocation || 'Magasin Principal'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 dark:text-slate-300 max-w-xs truncate" title={m.reason}>
                        {m.reason}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {m.performedByUserName || 'Système'}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {agencyMovements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                      Aucun mouvement de stock enregistré pour cette agence.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CONSOMMATION INTERNE DU CENTRE & TRANSFERT PRESTATION */}
      {/* ========================================================================= */}
      {activeTab === 'consumption' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <Card className="lg:col-span-7 p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Transfert Stock vers Service de Prestation
                </h3>
                <p className="text-xs text-slate-500">
                  Déduction et conversion automatique du stock magasin vers l'atelier (photocopies, impressions, reliures...).
                </p>
              </div>
            </div>

            <form onSubmit={handleProcessConsumption} className="space-y-4">
              {/* Product Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Article à Transférer / Consommer *
                </label>
                <Select
                  value={consProductId}
                  onChange={(e) => {
                    setConsProductId(e.target.value);
                    const prod = agencyProducts.find(p => p.id === e.target.value);
                    if (prod) {
                      const units = getAvailableProductUnits(prod);
                      const defU = units.find(u => u.isDefaultPurchaseUnit && !u.isBaseUnit) || units.find(u => !u.isBaseUnit) || units[0];
                      if (defU) setConsUnit(defU.unitName);
                    }
                  }}
                >
                  {agencyProducts.filter(p => p.isActive && !p.isArchived).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — Dispo : {p.currentStock.toLocaleString('fr-FR')} {p.baseUnit || p.unit}s ({formatSmartStockBreakdown(p.currentStock, p)})
                    </option>
                  ))}
                </Select>
              </div>

              {/* Service Destination */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Service / Prestation Destinataire *
                </label>
                <Select
                  value={consServiceId || consServiceName}
                  onChange={(e) => {
                    const val = e.target.value;
                    const matched = agencyServices.find(s => s.id === val);
                    if (matched) {
                      setConsServiceId(matched.id);
                      setConsServiceName(matched.name);
                    } else {
                      setConsServiceId('');
                      setConsServiceName(val);
                    }
                  }}
                >
                  {agencyServices.length > 0 && (
                    <optgroup label="Services Configurés de l'Agence">
                      {agencyServices.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.unit})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Postes de Travail & Ateliers">
                    <option value="Photocopie & Impression">Photocopie & Impression</option>
                    <option value="Reliure & Façonnage">Reliure & Façonnage</option>
                    <option value="Plastification">Plastification</option>
                    <option value="Impression Grand Format / Plans">Impression Grand Format / Plans</option>
                    <option value="Formations Pédagogiques">Formations Pédagogiques</option>
                    <option value="Administration & Bureau">Administration & Bureau</option>
                  </optgroup>
                </Select>
              </div>

              {/* Quantity & Packaging Unit Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Quantité à Transférer *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={consQuantity}
                    onChange={(e) => setConsQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-xs font-black h-9 border-amber-300 focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Unité de Transfert *
                  </label>
                  <Select
                    value={consUnit}
                    onChange={(e) => setConsUnit(e.target.value)}
                    className="text-xs font-bold h-9 bg-white dark:bg-slate-900"
                  >
                    {consAvailableUnits.map((u) => (
                      <option key={u.unitName} value={u.unitName}>
                        {u.isBaseUnit
                          ? `${u.unitName} (Unité de base)`
                          : `${u.unitName} (1 ${u.unitName} = ${u.factorToBase} ${selectedConsProduct?.baseUnit || selectedConsProduct?.unit || 'unité'}s)`}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Live Conversion & Prestation Capacity Card */}
              {consCalculation && (
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/60 space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Règle de conversion :
                    </span>
                    <Badge variant="outline" size="sm" className="font-mono text-[10px] bg-white dark:bg-slate-800">
                      {consCalculation.conversionSummary}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-amber-100 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                        Quantité Transférée
                      </span>
                      <strong className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                        {consCalculation.transferQty} {consCalculation.transferUnitName}{consCalculation.transferQty > 1 ? 's' : ''}
                      </strong>
                      <span className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold block">
                        = {consCalculation.qtyInBaseUnit.toLocaleString('fr-FR')} {consCalculation.baseUnitName}s
                      </span>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-amber-100 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                        Capacité de Prestation
                      </span>
                      <strong className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5 block">
                        {consCalculation.prestationCapacity.toLocaleString('fr-FR')} {consCalculation.prestationUnitName}
                      </strong>
                      <span className="text-[11px] text-slate-500 font-medium block">
                        pour {consCalculation.serviceName}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                    <span>
                      Stock magasin dispo : <strong>{consCalculation.currentStockInBase.toLocaleString('fr-FR')} {consCalculation.baseUnitName}s</strong> ({consCalculation.currentStockPrestationCapacity.toLocaleString('fr-FR')} {consCalculation.prestationUnitName})
                    </span>
                    {consCalculation.isStockSufficient && (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        Reste après transfert : {consCalculation.remainingStockInBaseAfter.toLocaleString('fr-FR')} {consCalculation.baseUnitName}s ({consCalculation.remainingStockPrestationCapacityAfter.toLocaleString('fr-FR')} {consCalculation.prestationUnitName})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Insufficient Stock Warning Alert */}
              {consCalculation && !consCalculation.isStockSufficient && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>⚠️ Quantité de stock insuffisante pour ce transfert</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 text-[11px] pl-6 space-y-0.5">
                    <div>Stock disponible : <strong>{consCalculation.currentStockInBase.toLocaleString('fr-FR')} {consCalculation.baseUnitName}s</strong> ({consCalculation.currentStockPrestationCapacity.toLocaleString('fr-FR')} {consCalculation.prestationUnitName})</div>
                    <div>Quantité demandée : <strong>{consCalculation.qtyInBaseUnit.toLocaleString('fr-FR')} {consCalculation.baseUnitName}s</strong> ({consCalculation.transferQty} {consCalculation.transferUnitName}s)</div>
                    <div className="text-rose-600 dark:text-rose-400 font-semibold">
                      Manquant : {consCalculation.missingQtyInBase.toLocaleString('fr-FR')} {consCalculation.baseUnitName}s ({consCalculation.missingQtyInTransferUnit} {consCalculation.transferUnitName}{consCalculation.missingQtyInTransferUnit > 1 ? 's' : ''})
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    N° Commande Client Liée (Optionnel)
                  </label>
                  <Input
                    type="text"
                    placeholder="ex: CMD-2026-000001"
                    value={consOrderNumber}
                    onChange={(e) => setConsOrderNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Motif / Description de l'usage *
                  </label>
                  <Input
                    type="text"
                    placeholder="ex: Tirage 500 copies mémoire universitaire, 3 livrets..."
                    value={consReason}
                    onChange={(e) => setConsReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                variant="primary"
                type="submit"
                icon={CheckCircle2}
                disabled={!consCalculation?.isStockSufficient || consQuantity <= 0}
                className="w-full justify-center bg-amber-600 hover:bg-amber-700 font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Transférer vers le Service de Prestation
              </Button>
            </form>
          </Card>

          {/* Recent consumptions */}
          <Card className="lg:col-span-5 p-5 space-y-3">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Dernières Consommations Atelier
            </h4>
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {agencyMovements
                .filter(m => m.movementType === 'INTERNAL_CONSUMPTION')
                .slice(0, 10)
                .map((m) => (
                  <div key={m.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-start">
                      <strong className="text-slate-900 dark:text-white">{m.productName}</strong>
                      <span className="font-black text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg">
                        {m.quantity} {m.unitUsed || 'unités'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{m.reason}</p>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                      <span className="font-medium text-slate-600 dark:text-slate-300">{m.serviceOrDepartment}</span>
                      <span>{formatDate(m.createdAt)} par {m.performedByUserName}</span>
                    </div>
                  </div>
                ))}

              {agencyMovements.filter(m => m.movementType === 'INTERNAL_CONSUMPTION').length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Aucun transfert de consommation enregistré récemment.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: TRANSFERTS INTER-EMPLACEMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'transfers' && (
        <Card className="p-5 max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <ArrowLeftRight className="w-5 h-5 text-brand-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Transfert de Stock Inter-Emplacements
              </h3>
              <p className="text-xs text-slate-500">
                Déplacement physique de marchandises entre le Magasin Principal, la Boutique et l'Atelier de l'agence.
              </p>
            </div>
          </div>

          <form onSubmit={handleProcessTransfer} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Article à Transférer *
              </label>
              <Select
                value={transProductId}
                onChange={(e) => setTransProductId(e.target.value)}
              >
                {agencyProducts.filter(p => p.isActive && !p.isArchived && p.currentStock > 0).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — Total Dispo : {p.currentStock} {p.unit}s
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Emplacement Source (Départ) *
                </label>
                <Select
                  value={transSource}
                  onChange={(e) => setTransSource(e.target.value)}
                >
                  <option value="MAIN_STORE">Magasin Principal (Stock Général)</option>
                  <option value="BOUTIQUE">Boutique (Comptoir)</option>
                  <option value="PRODUCTION">Atelier Production</option>
                  <option value="FORMATION">Salles de Formation</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Emplacement Destination (Arrivée) *
                </label>
                <Select
                  value={transDestination}
                  onChange={(e) => setTransDestination(e.target.value)}
                >
                  <option value="BOUTIQUE">Boutique (Comptoir)</option>
                  <option value="MAIN_STORE">Magasin Principal (Stock Général)</option>
                  <option value="PRODUCTION">Atelier Production</option>
                  <option value="FORMATION">Salles de Formation</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Quantité Transférée (Unité de base) *
              </label>
              <Input
                type="number"
                min="1"
                value={transQuantity}
                onChange={(e) => setTransQuantity(parseInt(e.target.value) || 1)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Motif du Transfert *
              </label>
              <Input
                type="text"
                value={transReason}
                onChange={(e) => setTransReason(e.target.value)}
                placeholder="ex: Réapprovisionnement des rayons boutique, mise à disposition atelier..."
                required
              />
            </div>

            <Button
              variant="primary"
              type="submit"
              icon={CheckCircle2}
              className="w-full justify-center bg-brand-600 hover:bg-brand-700 font-bold py-3"
            >
              Exécuter le Transfert Interne
            </Button>
          </form>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: PERTES & DÉTÉRIORATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'losses' && (
        <Card className="p-5 max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Flame className="w-5 h-5 text-rose-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Déclaration de Pertes, Casse & Détériorations
              </h3>
              <p className="text-xs text-slate-500">
                Déduction de stock pour marchandise avariée, chocs ou vols avec motif obligatoire.
              </p>
            </div>
          </div>

          <form onSubmit={handleProcessLoss} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Article Endommagé / Perdu *
              </label>
              <Select
                value={lossProductId}
                onChange={(e) => setLossProductId(e.target.value)}
              >
                {agencyProducts.filter(p => p.isActive && !p.isArchived && p.currentStock > 0).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — Dispo : {p.currentStock} {p.unit}s
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Type d'incident *
                </label>
                <Select
                  value={lossType}
                  onChange={(e) => setLossType(e.target.value as StockMovementType)}
                >
                  <option value="DETERIORATION">Détérioration / Papier abîmé</option>
                  <option value="DAMAGE">Casse / Choc matériel</option>
                  <option value="THEFT">Vol / Disparition constatée</option>
                  <option value="EXPIRATION">Périmé / Inutilisable</option>
                  <option value="LOSS">Autre Perte</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Quantité Perdue *
                </label>
                <Input
                  type="number"
                  min="1"
                  value={lossQuantity}
                  onChange={(e) => setLossQuantity(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Motif Détaillé de l'Incident (Obligatoire) *
              </label>
              <Input
                type="text"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                placeholder="ex: Infiltration d'eau au magasin, marchandise cassée lors du transport..."
                required
              />
            </div>

            <Button
              variant="danger"
              type="submit"
              icon={Flame}
              className="w-full justify-center font-bold py-3"
            >
              Enregistrer la Perte & Déduire du Stock
            </Button>
          </form>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: INVENTAIRE PHYSIQUE & RÉGULARISATION */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Feuille de Comptage & Inventaire Physique
              </h3>
              <p className="text-xs text-slate-500">
                Saisissez le stock réellement compté en rayon. Le système calcule l'écart et exige un motif pour tout ajustement.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Emplacement</TableHead>
                  <TableHead>Stock Système (Théorique)</TableHead>
                  <TableHead className="w-36">Stock Compté (Physique)</TableHead>
                  <TableHead>Écart Constaté</TableHead>
                  <TableHead className="min-w-[200px]">Motif Obligatoire de l'Écart</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencyProducts.filter(p => p.isActive && !p.isArchived).map((p) => {
                  const physicalVal = auditCounts[p.id] ?? p.currentStock;
                  const variance = physicalVal - p.currentStock;

                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <strong className="text-xs text-slate-900 dark:text-white block">{p.name}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">Réf: {p.code}</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{p.location || 'Magasin'}</TableCell>
                      <TableCell className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        <div>{p.currentStock.toLocaleString('fr-FR')} {p.baseUnit || p.unit}s</div>
                        {p.packagings && p.packagings.length > 0 && (
                          <span className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold block">
                            {formatSmartStockBreakdown(p.currentStock, p)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={physicalVal}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setAuditCounts({ ...auditCounts, [p.id]: val });
                          }}
                          className="text-xs font-bold text-center"
                        />
                        {p.packagings && p.packagings.length > 0 && physicalVal > 0 && (
                          <span className="text-[9px] text-slate-400 block text-center mt-0.5">
                            ≈ {formatSmartStockBreakdown(physicalVal, p)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={variance === 0 ? 'success' : variance > 0 ? 'primary' : 'danger'}
                          size="sm"
                          className="font-extrabold"
                        >
                          {variance === 0 ? '0 (Conforme)' : `${variance > 0 ? '+' : ''}${variance} ${p.baseUnit || p.unit}s`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {variance !== 0 ? (
                          <Input
                            type="text"
                            placeholder="Motif de l'écart..."
                            value={auditReasons[p.id] || ''}
                            onChange={(e) => setAuditReasons({ ...auditReasons, [p.id]: e.target.value })}
                            className="text-xs"
                            required
                          />
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium">Stock parfaitement aligné</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={variance === 0}
                          onClick={() => handleApplyAuditItem(p)}
                          className="text-xs font-bold"
                        >
                          Ajuster
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: VALORISATION & ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <Card className="p-5">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Valorisation Financière du Stock par Catégorie ({currentTenant?.name})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {agencyCategories.map(cat => {
                const prods = agencyProducts.filter(p => p.isActive && !p.isArchived && (p.categoryId === cat.id || p.category === cat.name));
                const catValue = prods.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);
                const totalUnits = prods.reduce((acc, p) => acc + p.currentStock, 0);

                return (
                  <div key={cat.id} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{cat.name}</span>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color || '#3b82f6' }} />
                    </div>
                    <strong className="text-lg font-black text-slate-900 dark:text-white block">
                      {formatCurrency(catValue)}
                    </strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {prods.length} articles • {totalUnits} unités physiques
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOUVEL ARTICLE MULTI-UNITÉS (5 SECTIONS) */}
      {/* ========================================================================= */}
      {isNewProductModalOpen && (
        <Modal
          isOpen={isNewProductModalOpen}
          onClose={() => setIsNewProductModalOpen(false)}
          title="Création d'un Nouvel Article de Stock (Catalogue)"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateProduct} className="space-y-5 pt-1">
            {/* SECTION A: INFORMATIONS GÉNÉRALES */}
            <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 text-brand-600">
                <Tag className="w-4 h-4" />
                Section A — Informations Générales
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Désignation de l'Article *
                  </label>
                  <Input
                    type="text"
                    placeholder="ex: Papier Ramette A4 80g Double A, Boudin 6mm..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    className="font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Référence / Code Article (Unique) *
                  </label>
                  <Input
                    type="text"
                    placeholder="ex: RAM-A4-80G"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    required
                    className="font-mono uppercase font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Code-Barres EAN / UPC
                  </label>
                  <Input
                    type="text"
                    placeholder="ex: 6001234567890"
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Catégorie d'Article *
                  </label>
                  <Select
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                  >
                    {activeCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Statut Initial
                  </label>
                  <Select
                    value={newIsActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setNewIsActive(e.target.value === 'ACTIVE')}
                  >
                    <option value="ACTIVE">🟢 Actif (Prêt aux opérations)</option>
                    <option value="INACTIVE">⚪ Inactif (Brouillon)</option>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Description & Spécifications (Optionnel)
                  </label>
                  <Input
                    type="text"
                    placeholder="ex: Papier ultra blanc 80g certifié FSC, usage polyvalent laser et jet d'encre"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>

                {/* Photos de l'Article (jusqu'à 4 vues réelles) */}
                <div className="sm:col-span-2 space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-brand-500" />
                        Photos de l'Article ({newImages.filter(img => img.trim()).length}/4 vue{newImages.filter(img => img.trim()).length > 1 ? 's' : ''} configurée{newImages.filter(img => img.trim()).length > 1 ? 's' : ''})
                      </label>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Vue 1 = Image principale affichée en premier • Vues 2 à 4 = angles, dos et détails complémentaires.
                      </span>
                    </div>

                    {newImages.length < 4 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        icon={Plus}
                        onClick={() => handleAddImageView(false)}
                        className="text-xs font-bold text-brand-600 dark:text-brand-400 border-brand-300 dark:border-brand-800 self-start sm:self-auto"
                      >
                        + Ajouter une vue ({newImages.length + 1}/4)
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3 pt-1">
                    {newImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-sm"
                      >
                        {/* Thumbnail preview */}
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner group relative">
                          <ProductThumbnailSmall
                            imageUrl={imgUrl}
                            alt={`Vue ${idx + 1}`}
                            size="lg"
                            className="w-full h-full border-0 shadow-none"
                          />
                          <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-bold">
                            {imgUrl ? 'Changer' : 'Charger'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleProductImageUpload(e, false, idx)}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* Controls */}
                        <div className="flex-1 space-y-1.5 w-full">
                          <div className="flex items-center justify-between">
                            <Badge
                              variant={idx === 0 ? "primary" : "secondary"}
                              size="sm"
                              className="text-[10px] font-bold"
                            >
                              {idx === 0 ? "Vue 1 / Image principale" : `Vue ${idx + 1}`}
                            </Badge>

                            <div className="flex items-center gap-2">
                              {/* File Upload Trigger */}
                              <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-all shadow-sm">
                                <Upload className="w-3 h-3" />
                                <span>Importer</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleProductImageUpload(e, false, idx)}
                                  className="hidden"
                                />
                              </label>

                              {(newImages.length > 1 || imgUrl) && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImageView(false, idx)}
                                  className="text-[11px] text-rose-500 hover:text-rose-700 font-bold p-1 rounded transition-colors flex items-center gap-0.5"
                                  title="Supprimer cette vue"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <Input
                            type="text"
                            placeholder="ex: https://... ou /images/produit.jpg"
                            value={imgUrl}
                            onChange={(e) => handleUpdateImageViewUrl(false, idx, e.target.value)}
                            className="text-xs h-8"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <span className="text-[10px] text-slate-400 block pt-1">
                    Formats acceptés : JPG, PNG, WEBP, SVG (max 5 Mo). Si aucune photo n'est fournie, un placeholder élégant (📦) sera affiché sans utiliser l'image d'un autre article.
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION B: UNITÉ DE BASE & CONDITIONNEMENTS HIÉRARCHIQUES */}
            <div className="p-4 bg-brand-50/70 dark:bg-brand-950/50 rounded-2xl border border-brand-200 dark:border-brand-900 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-brand-950 dark:text-brand-100 uppercase flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-brand-600" />
                    Section B — Unité de Base & Conditionnements Multi-Niveaux
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Le stock unique de référence est stocké dans l'<strong>Unité de Base</strong>. Ajoutez autant de niveaux que nécessaire (Paquet, Carton, Palette...).
                  </p>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    icon={Plus}
                    onClick={() => handleAddPackaging(false)}
                    className="text-xs font-bold text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-800"
                  >
                    + Conditionnement (Niveau {newPackagings.length + 2})
                  </Button>
                </div>
              </div>

              {/* Base Unit Selector */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
                    Unité de Base (Niveau 1 - Plus petite unité indivisible) *
                  </label>
                  <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                    Unité de Stock Unique
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <Input
                      type="text"
                      placeholder="ex: feuille, unité, pièce, cartouche, litre, mètre..."
                      value={newBaseUnit}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewBaseUnit(val);
                        const { packagings: computed } = recalculatePackagingFactors(val, newPackagings);
                        setNewPackagings(computed);
                      }}
                      required
                      className="font-bold text-slate-900 dark:text-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Toutes les entrées, sorties et consommations sont rigoureusement comptabilisées dans cette unité.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Suggestions rapides :</span>
                    <div className="flex flex-wrap gap-1">
                      {['feuille', 'unité', 'pièce', 'cartouche', 'rouleau'].map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => {
                            setNewBaseUnit(u);
                            const { packagings: computed } = recalculatePackagingFactors(u, newPackagings);
                            setNewPackagings(computed);
                          }}
                          className={`px-2 py-0.5 text-[10px] rounded-lg font-semibold border transition ${
                            newBaseUnit.toLowerCase() === u
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Packagings Table */}
              {newPackagings.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Niveaux de Conditionnement Supérieurs ({newPackagings.length} configuré{newPackagings.length > 1 ? 's' : ''})
                  </span>

                  <div className="space-y-3">
                    {newPackagings.map((pkg, idx) => (
                      <div
                        key={pkg.id || idx}
                        className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-black flex items-center justify-center">
                              {idx + 2}
                            </span>
                            <strong className="text-xs text-slate-900 dark:text-white capitalize">
                              Niveau {idx + 2} : {pkg.unitName || 'Conditionnement'}
                            </strong>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="success" size="sm" className="font-mono text-[10px]">
                              1 {pkg.unitName || 'unité'} = {pkg.factorToBase.toLocaleString('fr-FR')} {newBaseUnit}s
                            </Badge>

                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              icon={Trash2}
                              onClick={() => handleRemovePackaging(idx, false)}
                              className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                              title="Supprimer ce niveau"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                          <div>
                            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              Nom du Conditionnement *
                            </label>
                            <Input
                              type="text"
                              placeholder="ex: paquet, carton, boîte, palette..."
                              value={pkg.unitName}
                              onChange={(e) => handleUpdatePackaging(idx, { unitName: e.target.value }, false)}
                              required
                              className="font-bold text-slate-900 dark:text-white capitalize"
                            />
                          </div>

                          <div>
                            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              Contenance *
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={pkg.containedQuantity}
                              onChange={(e) => handleUpdatePackaging(idx, { containedQuantity: parseInt(e.target.value) || 1 }, false)}
                              required
                            />
                          </div>

                          <div>
                            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              Sous-Unité Contenue *
                            </label>
                            <Select
                              value={pkg.subUnitName}
                              onChange={(e) => handleUpdatePackaging(idx, { subUnitName: e.target.value }, false)}
                            >
                              <option value={newBaseUnit}>{newBaseUnit} (Unité de base)</option>
                              {newPackagings.slice(0, idx).map((prevPkg, pIdx) => (
                                <option key={prevPkg.id || pIdx} value={prevPkg.unitName}>
                                  {prevPkg.unitName} (Niveau {pIdx + 2})
                                </option>
                              ))}
                            </Select>
                          </div>

                          <div>
                            <label className="font-bold text-emerald-600 block mb-1">
                              Prix Vente Détail ({pkg.unitName || 'Lot'})
                            </label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="ex: 70000"
                              value={pkg.salePrice || ''}
                              onChange={(e) => handleUpdatePackaging(idx, { salePrice: parseInt(e.target.value) || 0 }, false)}
                              className="font-bold text-emerald-600"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs border-t border-slate-100 dark:border-slate-800">
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={pkg.isAllowedForSale}
                              onChange={(e) => handleUpdatePackaging(idx, { isAllowedForSale: e.target.checked }, false)}
                              className="rounded text-brand-600 focus:ring-brand-500"
                            />
                            Autorisé à la vente
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={pkg.isAllowedForPurchase}
                              onChange={(e) => handleUpdatePackaging(idx, { isAllowedForPurchase: e.target.checked }, false)}
                              className="rounded text-brand-600 focus:ring-brand-500"
                            />
                            Autorisé aux achats fournisseurs
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                            <input
                              type="radio"
                              name="defaultPurchaseUnitCreate"
                              checked={pkg.isDefaultPurchaseUnit}
                              onChange={() => {
                                const currentPkgs = newPackagings.map((p, i) => ({
                                  ...p,
                                  isDefaultPurchaseUnit: i === idx
                                }));
                                const { packagings: computed } = recalculatePackagingFactors(newBaseUnit, currentPkgs);
                                setNewPackagings(computed);
                              }}
                              className="rounded text-brand-600 focus:ring-brand-500"
                            />
                            Unité d'achat par défaut
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                  Article à <strong>1 seul niveau d'unité</strong> (ex: Clé USB, Toner, Câble). Aucun carton/paquet requis.
                </div>
              )}
            </div>

            {/* SECTION C: PARAMÈTRES DE STOCK & EMPLACEMENT */}
            <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 text-brand-600">
                  <Boxes className="w-4 h-4" />
                  Section C — Paramètres de Stock (Exprimés en {newBaseUnit}s)
                </h4>
                {newInitialStock > 0 && (
                  <Badge variant="primary" size="sm" className="font-semibold text-[10px]">
                    {formatSmartStockBreakdown(newInitialStock, { baseUnit: newBaseUnit, packagings: newPackagings } as Product)}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Stock Initial ({newBaseUnit}s) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={newInitialStock}
                    onChange={(e) => setNewInitialStock(parseInt(e.target.value) || 0)}
                    required
                    className="font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">En unité de base</span>
                </div>

                <div>
                  <label className="font-bold text-amber-600 block mb-1">
                    Seuil d'Alerte Minimum ({newBaseUnit}s) *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={newMinAlert}
                    onChange={(e) => setNewMinAlert(parseInt(e.target.value) || 1)}
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Alerte rupture</span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Stock Maximum Conseillé ({newBaseUnit}s)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={newMaxStock}
                    onChange={(e) => setNewMaxStock(parseInt(e.target.value) || 100)}
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Emplacement par Défaut
                  </label>
                  <Input
                    type="text"
                    placeholder="Magasin Principal - Étagère A1"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SECTION D: TARIFICATION DE BASE */}
            <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 text-emerald-600">
                  <DollarSign className="w-4 h-4" />
                  Section D — Coût & Tarification Unitaire (Par 1 {newBaseUnit})
                </h4>
                {newSalePrice > newCostPrice && (
                  <Badge variant="success" size="sm" className="font-bold text-[10px]">
                    Marge unitaire : +{formatCurrency(newSalePrice - newCostPrice)} ({Math.round(((newSalePrice - newCostPrice) / (newSalePrice || 1)) * 100)}%)
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Coût d'Achat Réel (Par 1 {newBaseUnit}) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={newCostPrice}
                    onChange={(e) => setNewCostPrice(parseInt(e.target.value) || 0)}
                    required
                    className="bg-slate-50 font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Coût moyen de référence</span>
                </div>

                <div>
                  <label className="font-bold text-brand-600 block mb-1">
                    Prix de Vente Détail (Par 1 {newBaseUnit}) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={newSalePrice}
                    onChange={(e) => setNewSalePrice(parseInt(e.target.value) || 0)}
                    required
                    className="font-bold text-brand-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Prix unitaire à la pièce</span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Prix de Gros (Par 1 {newBaseUnit})
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={newWholesalePrice}
                    onChange={(e) => setNewWholesalePrice(parseInt(e.target.value) || 0)}
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Tarif partenaire / gros</span>
                </div>
              </div>
            </div>

            {/* SECTION : CONFIGURATION DU PRIX ET UNITÉ DANS LE MARKETPLACE */}
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase">
                    Prix affiché dans la Marketplace
                  </h4>
                </div>
                <Badge variant="warning" size="sm" className="text-[10px] font-bold">
                  Visible par les clients
                </Badge>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Sélectionnez l'unité commerciale que verront les clients sur la marketplace publique (parmi les unités réelles configurées pour cet article).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Unité commerciale présentée au client *
                  </label>
                  <Select
                    value={newPublicUnit}
                    onChange={(e) => {
                      const selUnit = e.target.value;
                      setNewPublicUnit(selUnit);
                      const found = newAvailableMarketplaceUnits.find(u => u.unit === selUnit);
                      if (found) {
                        setNewPublicPrice(found.defaultPrice);
                        setNewConversionFactorToStock(found.factor);
                      }
                    }}
                  >
                    {newAvailableMarketplaceUnits.map(u => (
                      <option key={u.unit} value={u.unit}>
                        {u.label}
                      </option>
                    ))}
                  </Select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    1 {newPublicUnit} = {newConversionFactorToStock} {newBaseUnit}(s)
                  </span>
                </div>

                <div>
                  <label className="font-bold text-amber-600 dark:text-amber-400 block mb-1">
                    Prix de Vente Public Marketplace (GNF) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={newPublicPrice !== undefined ? newPublicPrice : ''}
                    onChange={(e) => setNewPublicPrice(parseInt(e.target.value) || 0)}
                    placeholder="ex: 35000"
                    required
                    className="font-bold text-amber-600 text-sm"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Affiché au client : <strong>{formatCurrency(newPublicPrice || 0)}</strong> / {newPublicUnit}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION E: FOURNISSEUR */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 text-slate-600">
                <Truck className="w-4 h-4" />
                Section E — Fournisseur Habituel
              </h4>

              <div>
                <Select
                  value={newSupplierId}
                  onChange={(e) => setNewSupplierId(e.target.value)}
                >
                  <option value="">Aucun fournisseur spécifique</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.contactPerson ? `(Contact: ${s.contactPerson})` : ''}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" type="button" onClick={() => setIsNewProductModalOpen(false)}>
                Annuler
              </Button>
              <Button variant="primary" icon={CheckCircle2} type="submit" className="font-bold">
                Créer l'Article dans le Catalogue
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MODIFIER UN ARTICLE (5 SECTIONS) */}
      {/* ========================================================================= */}
      {productToEdit && (
        <Modal
          isOpen={!!productToEdit}
          onClose={() => setProductToEdit(null)}
          title={`Modifier l'Article — ${productToEdit.name}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveEditProduct} className="space-y-5 pt-1">
            {/* Section A */}
            <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 text-brand-600">
                <Tag className="w-4 h-4" />
                Informations Générales
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Désignation *
                  </label>
                  <Input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Référence / Code *
                  </label>
                  <Input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    required
                    className="font-mono uppercase font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Code-Barres
                  </label>
                  <Input
                    type="text"
                    value={editBarcode}
                    onChange={(e) => setEditBarcode(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Catégorie *
                  </label>
                  <Select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                  >
                    {(state.productCategories || []).map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Statut
                  </label>
                  <Select
                    value={editIsActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setEditIsActive(e.target.value === 'ACTIVE')}
                  >
                    <option value="ACTIVE">🟢 Actif</option>
                    <option value="INACTIVE">⚪ Inactif</option>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Description
                  </label>
                  <Input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>

                {/* Photos & Vues du Produit (Jusqu'à 4 vues réelles) */}
                <div className="sm:col-span-2 space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-brand-500" />
                        Photos & Vues de l'Article (Optionnelles — Jusqu'à 4 vues)
                      </label>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Vue 1 = Image principale affichée en premier • Vues 2 à 4 = angles, dos et détails complémentaires.
                      </span>
                    </div>

                    {editImages.length < 4 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        icon={Plus}
                        onClick={() => handleAddImageView(true)}
                        className="text-xs font-bold text-brand-600 dark:text-brand-400 border-brand-300 dark:border-brand-800 self-start sm:self-auto"
                      >
                        + Ajouter une vue ({editImages.length + 1}/4)
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3 pt-1">
                    {editImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-sm"
                      >
                        {/* Thumbnail preview */}
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner group relative">
                          <ProductThumbnailSmall
                            imageUrl={imgUrl}
                            alt={`Vue ${idx + 1}`}
                            size="lg"
                            className="w-full h-full border-0 shadow-none"
                          />
                          <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-bold">
                            {imgUrl ? 'Changer' : 'Charger'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleProductImageUpload(e, true, idx)}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* Controls */}
                        <div className="flex-1 space-y-1.5 w-full">
                          <div className="flex items-center justify-between">
                            <Badge
                              variant={idx === 0 ? "primary" : "secondary"}
                              size="sm"
                              className="text-[10px] font-bold"
                            >
                              {idx === 0 ? "Vue 1 / Image principale" : `Vue ${idx + 1}`}
                            </Badge>

                            <div className="flex items-center gap-2">
                              {/* File Upload Trigger */}
                              <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-all shadow-sm">
                                <Upload className="w-3 h-3" />
                                <span>Importer</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleProductImageUpload(e, true, idx)}
                                  className="hidden"
                                />
                              </label>

                              {(editImages.length > 1 || imgUrl) && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImageView(true, idx)}
                                  className="text-[11px] text-rose-500 hover:text-rose-700 font-bold p-1 rounded transition-colors flex items-center gap-0.5"
                                  title="Supprimer cette vue"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <Input
                            type="text"
                            placeholder="ex: https://... ou /images/produit.jpg"
                            value={imgUrl}
                            onChange={(e) => handleUpdateImageViewUrl(true, idx, e.target.value)}
                            className="text-xs h-8"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <span className="text-[10px] text-slate-400 block pt-1">
                    Formats acceptés : JPG, PNG, WEBP, SVG (max 5 Mo). Si aucune photo n'est fournie, un placeholder élégant (📦) sera affiché sans utiliser l'image d'un autre article.
                  </span>
                </div>
              </div>
            </div>

            {/* Section B: Base Unit & Packaging Hierarchy */}
            <div className="p-4 bg-brand-50/70 dark:bg-brand-950/50 rounded-2xl border border-brand-200 dark:border-brand-900 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-brand-950 dark:text-brand-100 uppercase flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-brand-600" />
                    Unités de Mesure & Conditionnements
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Stock unique de référence exprimé en <strong>{editBaseUnit || 'unité de base'}</strong>. Les conditionnements permettent la vente et l'achat par lots.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    icon={Plus}
                    onClick={() => handleAddPackaging(true)}
                    className="text-xs font-bold text-brand-700 dark:text-brand-300 border-brand-300 dark:border-brand-800"
                  >
                    + Conditionnement (Niveau {editPackagings.length + 2})
                  </Button>
                </div>
              </div>

              {/* Base Unit */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
                    Unité de Base (Niveau 1) *
                  </label>
                  <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                    Unité de Stock Unique
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <Input
                      type="text"
                      value={editBaseUnit}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditBaseUnit(val);
                        const { packagings: computed } = recalculatePackagingFactors(val, editPackagings);
                        setEditPackagings(computed);
                      }}
                      required
                      className="font-bold text-slate-900 dark:text-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Unité indivisible de référence</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Suggestions :</span>
                    <div className="flex flex-wrap gap-1">
                      {['feuille', 'unité', 'pièce', 'cartouche', 'rouleau'].map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => {
                            setEditBaseUnit(u);
                            const { packagings: computed } = recalculatePackagingFactors(u, editPackagings);
                            setEditPackagings(computed);
                          }}
                          className={`px-2 py-0.5 text-[10px] rounded-lg font-semibold border transition ${
                            editBaseUnit.toLowerCase() === u
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Packagings */}
              {editPackagings.length > 0 ? (
                <div className="space-y-3">
                  {editPackagings.map((pkg, idx) => (
                    <div
                      key={pkg.id || idx}
                      className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-black flex items-center justify-center">
                            {idx + 2}
                          </span>
                          <strong className="text-xs text-slate-900 dark:text-white capitalize">
                            Niveau {idx + 2} : {pkg.unitName}
                          </strong>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="success" size="sm" className="font-mono text-[10px]">
                            1 {pkg.unitName} = {pkg.factorToBase.toLocaleString('fr-FR')} {editBaseUnit}s
                          </Badge>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() => handleRemovePackaging(idx, true)}
                            className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950"
                            title="Supprimer ce niveau"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Nom du Conditionnement *
                          </label>
                          <Input
                            type="text"
                            value={pkg.unitName}
                            onChange={(e) => handleUpdatePackaging(idx, { unitName: e.target.value }, true)}
                            required
                            className="font-semibold"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Contient (Quantité) *
                          </label>
                          <Input
                            type="number"
                            min="1"
                            value={pkg.containedQuantity}
                            onChange={(e) => handleUpdatePackaging(idx, { containedQuantity: parseInt(e.target.value) || 1 }, true)}
                            required
                            className="font-bold text-center"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            De l'Unité Inférieure
                          </label>
                          <Input
                            type="text"
                            value={pkg.subUnitName}
                            disabled
                            className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-brand-600 block mb-1">
                            Prix Vente ({pkg.unitName || 'Unité'})
                          </label>
                          <Input
                            type="number"
                            min="0"
                            value={pkg.salePrice || ''}
                            onChange={(e) => handleUpdatePackaging(idx, { salePrice: parseInt(e.target.value) || 0 }, true)}
                            className="font-bold text-brand-600"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <div>
                          <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Prix Achat Fournisseur ({pkg.unitName || 'Unité'})
                          </label>
                          <Input
                            type="number"
                            min="0"
                            value={pkg.purchasePrice || ''}
                            onChange={(e) => handleUpdatePackaging(idx, { purchasePrice: parseInt(e.target.value) || 0 }, true)}
                          />
                        </div>

                        <div className="flex items-center gap-4 sm:col-span-2 pt-4">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={pkg.isAllowedForSale !== false}
                              onChange={(e) => handleUpdatePackaging(idx, { isAllowedForSale: e.target.checked }, true)}
                              className="rounded text-brand-600 focus:ring-brand-500"
                            />
                            Autorisé à la vente
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={pkg.isAllowedForPurchase !== false}
                              onChange={(e) => handleUpdatePackaging(idx, { isAllowedForPurchase: e.target.checked }, true)}
                              className="rounded text-brand-600 focus:ring-brand-500"
                            />
                            Autorisé à l'achat
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={pkg.isDefaultPurchaseUnit === true}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const currentPkgs = editPackagings.map((p, i) => ({
                                  ...p,
                                  isDefaultPurchaseUnit: i === idx ? checked : false
                                }));
                                const { packagings: computed } = recalculatePackagingFactors(editBaseUnit, currentPkgs);
                                setEditPackagings(computed);
                              }}
                              className="rounded text-brand-600 focus:ring-brand-500"
                            />
                            Unité d'achat par défaut
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                  Article à <strong>1 seul niveau d'unité</strong> (ex: Clé USB, Toner).
                </div>
              )}
            </div>

            {/* Section C: Base Pricing & Alerts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Coût Réel (Par 1 {editBaseUnit}) *
                </label>
                <Input
                  type="number"
                  min="0"
                  value={editCostPrice}
                  onChange={(e) => setEditCostPrice(parseInt(e.target.value) || 0)}
                  required
                  className="bg-slate-50 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-brand-600 block mb-1">
                  Prix Vente Détail (Par 1 {editBaseUnit}) *
                </label>
                <Input
                  type="number"
                  min="0"
                  value={editSalePrice}
                  onChange={(e) => setEditSalePrice(parseInt(e.target.value) || 0)}
                  required
                  className="font-bold text-brand-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Prix de Gros (Par 1 {editBaseUnit})
                </label>
                <Input
                  type="number"
                  min="0"
                  value={editWholesalePrice}
                  onChange={(e) => setEditWholesalePrice(parseInt(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="font-semibold text-amber-600 block mb-1">
                  Seuil Alerte ({editBaseUnit}s) *
                </label>
                <Input
                  type="number"
                  min="1"
                  value={editMinAlert}
                  onChange={(e) => setEditMinAlert(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
            </div>

            {/* SECTION : CONFIGURATION DU PRIX ET UNITÉ DANS LE MARKETPLACE */}
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase">
                    Prix affiché dans la Marketplace
                  </h4>
                </div>
                <Badge variant="warning" size="sm" className="text-[10px] font-bold">
                  Visible par les clients
                </Badge>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Sélectionnez l'unité commerciale que verront les clients sur la marketplace publique (parmi les unités réelles configurées pour cet article).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Unité commerciale présentée au client *
                  </label>
                  <Select
                    value={editPublicUnit}
                    onChange={(e) => {
                      const selUnit = e.target.value;
                      setEditPublicUnit(selUnit);
                      const found = editAvailableMarketplaceUnits.find(u => u.unit === selUnit);
                      if (found) {
                        setEditPublicPrice(found.defaultPrice);
                        setEditConversionFactorToStock(found.factor);
                      }
                    }}
                  >
                    {editAvailableMarketplaceUnits.map(u => (
                      <option key={u.unit} value={u.unit}>
                        {u.label}
                      </option>
                    ))}
                  </Select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    1 {editPublicUnit} = {editConversionFactorToStock} {editBaseUnit}(s)
                  </span>
                </div>

                <div>
                  <label className="font-bold text-amber-600 dark:text-amber-400 block mb-1">
                    Prix de Vente Public Marketplace (GNF) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={editPublicPrice !== undefined ? editPublicPrice : ''}
                    onChange={(e) => setEditPublicPrice(parseInt(e.target.value) || 0)}
                    placeholder="ex: 35000"
                    required
                    className="font-bold text-amber-600 text-sm"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Affiché au client : <strong>{formatCurrency(editPublicPrice || 0)}</strong> / {editPublicUnit}
                  </span>
                </div>
              </div>
            </div>

            {/* Location & Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Emplacement
                </label>
                <Input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Fournisseur
                </label>
                <Select
                  value={editSupplierId}
                  onChange={(e) => setEditSupplierId(e.target.value)}
                >
                  <option value="">Aucun fournisseur</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" type="button" onClick={() => setProductToEdit(null)}>
                Annuler
              </Button>
              <Button variant="primary" icon={CheckCircle2} type="submit" className="font-bold">
                Enregistrer les Modifications
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FICHE DÉTAILLÉE 360° DE L'ARTICLE */}
      {/* ========================================================================= */}
      {productToView && (
        <Modal
          isOpen={!!productToView}
          onClose={() => setProductToView(null)}
          title={`Fiche Article — ${productToView.name}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 pt-1">
            {/* Header Identity */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex items-start gap-3">
                <ProductThumbnailSmall
                  imageUrl={productToView.imageUrl}
                  alt={productToView.name}
                  size="lg"
                />
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">
                    RÉFÉRENCE : {productToView.code}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {productToView.name}
                  </h3>
                  {productToView.description && (
                    <p className="text-xs text-slate-500 mt-1">{productToView.description}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 self-start">
                <Badge variant="outline" size="sm" className="font-bold">
                  {productToView.category}
                </Badge>
                <Badge
                  variant={productToView.isArchived ? 'secondary' : productToView.currentStock <= 0 ? 'danger' : productToView.currentStock <= productToView.minStockAlert ? 'warning' : 'success'}
                  size="sm"
                  className="font-bold"
                >
                  {productToView.isArchived ? '🗃️ Archivé' : productToView.currentStock <= 0 ? 'Rupture' : productToView.currentStock <= productToView.minStockAlert ? 'Stock Faible' : 'En Stock'}
                </Badge>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Stock Actuel</span>
                <strong className="text-sm font-black text-slate-900 dark:text-white block mt-0.5">
                  {productToView.currentStock} {productToView.unit}s
                </strong>
                <span className="text-[10px] text-slate-400">Seuil min : {productToView.minStockAlert}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Coût d'Achat</span>
                <strong className="text-sm font-black text-slate-900 dark:text-white block mt-0.5">
                  {formatCurrency(productToView.costPrice)}
                </strong>
                <span className="text-[10px] text-slate-400">par {productToView.unit}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-brand-600 dark:text-brand-400 block uppercase font-bold">Prix Vente</span>
                <strong className="text-sm font-black text-brand-600 block mt-0.5">
                  {productToView.salePrice ? formatCurrency(productToView.salePrice) : '-'}
                </strong>
                <span className="text-[10px] text-slate-400">par {productToView.unit}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Valeur Globale</span>
                <strong className="text-sm font-black text-emerald-600 block mt-0.5">
                  {formatCurrency(productToView.currentStock * productToView.costPrice)}
                </strong>
                <span className="text-[10px] text-slate-400">en stock</span>
              </div>
            </div>

            {/* Multi-Units & Emplacements info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1.5">
                <h5 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-brand-600" />
                  Formule de Conditionnement
                </h5>
                {productToView.purchaseUnit && productToView.conversionFactor ? (
                  <p className="text-slate-600 dark:text-slate-300">
                    1 {productToView.purchaseUnit} = <strong>{productToView.conversionFactor} {productToView.unit}s</strong>
                  </p>
                ) : (
                  <p className="text-slate-400">Unité simple ({productToView.unit})</p>
                )}
                {productToView.barcode && (
                  <p className="text-slate-500 font-mono text-[11px]">Code-Barres : {productToView.barcode}</p>
                )}
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1.5">
                <h5 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-600" />
                  Localisation & Fournisseur
                </h5>
                <p className="text-slate-700 dark:text-slate-300">
                  Emplacement : <strong>{productToView.location || 'Magasin Principal'}</strong>
                </p>
                <p className="text-slate-500">
                  Fournisseur : {productToView.supplierName || 'Non spécifié'}
                </p>
              </div>
            </div>

            {/* Recent movements for this product */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-brand-500" />
                Mouvements Récents de cet Article
              </h5>

              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {(state.stockMovements || [])
                  .filter(m => m.productId === productToView.id)
                  .slice(0, 6)
                  .map((m) => (
                    <div key={m.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{m.reason}</span>
                        <span className="text-[10px] text-slate-400">{formatDate(m.createdAt)} • {m.performedByUserName || 'Système'}</span>
                      </div>
                      <span className={`font-black text-xs ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unitUsed || productToView.unit}
                      </span>
                    </div>
                  ))}

                {(state.stockMovements || []).filter(m => m.productId === productToView.id).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">Aucun mouvement enregistré pour cet article.</p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                icon={Barcode}
                onClick={() => {
                  const p = productToView;
                  setProductToView(null);
                  setProductForBarcode(p);
                }}
                className="text-xs font-bold"
              >
                Imprimer Code-Barres
              </Button>

              <div className="flex items-center gap-2">
                {!productToView.isArchived && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Edit}
                    onClick={() => {
                      const p = productToView;
                      setProductToView(null);
                      handleOpenEditProduct(p);
                    }}
                    className="text-xs font-bold"
                  >
                    Modifier
                  </Button>
                )}
                <Button variant="primary" size="sm" onClick={() => setProductToView(null)}>
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AJUSTEMENT RAPIDE DU STOCK */}
      {/* ========================================================================= */}
      {productToAdjustStock && (
        <Modal
          isOpen={!!productToAdjustStock}
          onClose={() => setProductToAdjustStock(null)}
          title={`Ajustement de Stock — ${productToAdjustStock.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveStockAdjustment} className="space-y-4 pt-1">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Stock Actuel Théorique :</span>
                <strong className="text-slate-900 dark:text-white font-black">{productToAdjustStock.currentStock} {productToAdjustStock.unit}s</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Emplacement :</span>
                <span className="text-slate-700 dark:text-slate-300">{productToAdjustStock.location || 'Magasin Principal'}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nouveau Stock Physique Constaté ({productToAdjustStock.unit}) *
              </label>
              <Input
                type="number"
                min="0"
                value={adjustTargetStock}
                onChange={(e) => setAdjustTargetStock(parseInt(e.target.value) || 0)}
                required
                className="font-bold text-center text-sm"
              />
              <div className="flex justify-between text-[11px] mt-1 text-slate-400">
                <span>Écart calculé :</span>
                <strong className={adjustTargetStock - productToAdjustStock.currentStock >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {adjustTargetStock - productToAdjustStock.currentStock >= 0 ? '+' : ''}
                  {adjustTargetStock - productToAdjustStock.currentStock} {productToAdjustStock.unit}s
                </strong>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Emplacement Concerné *
              </label>
              <Select
                value={adjustLocation}
                onChange={(e) => setAdjustLocation(e.target.value)}
              >
                <option value="MAIN_STORE">Magasin Principal</option>
                <option value="BOUTIQUE">Boutique (Comptoir)</option>
                <option value="PRODUCTION">Atelier Production</option>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Motif Obligatoire de l'Ajustement *
              </label>
              <Input
                type="text"
                placeholder="ex: Régularisation comptage physique, correction erreur saisie..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" type="button" onClick={() => setProductToAdjustStock(null)}>
                Annuler
              </Button>
              <Button variant="primary" icon={CheckCircle2} type="submit" className="font-bold">
                Valider l'Ajustement
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMATION D'ARCHIVAGE D'ARTICLE */}
      {/* ========================================================================= */}
      {productToArchive && (
        <Modal
          isOpen={!!productToArchive}
          onClose={() => setProductToArchive(null)}
          title="Archiver cet article ?"
          maxWidth="md"
        >
          <div className="space-y-4 pt-1">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs text-amber-800 dark:text-amber-200 space-y-2">
              <p className="font-bold text-sm text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Archivage de « {productToArchive.name} »
              </p>
              <p>
                L'article ne sera plus disponible pour les nouvelles opérations (ventes boutique, commandes, consommations), mais son <strong>historique complet de mouvements et statistiques</strong> restera intégralement conservé.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Vous pourrez le restaurer à tout moment via le filtre des articles archivés.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setProductToArchive(null)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                icon={Archive}
                onClick={handleConfirmArchiveProduct}
                className="bg-amber-600 hover:bg-amber-700 font-bold"
              >
                Confirmer l'Archivage
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMATION DÉSACTIVER / ACTIVER ARTICLE */}
      {/* ========================================================================= */}
      {productToToggleActive && (
        <Modal
          isOpen={!!productToToggleActive}
          onClose={() => setProductToToggleActive(null)}
          title={productToToggleActive.isActive ? "Désactiver cet article ?" : "Réactiver cet article ?"}
          maxWidth="md"
        >
          <div className="space-y-4 pt-1">
            <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
              productToToggleActive.isActive
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-100'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100'
            }`}>
              <p className="font-bold text-sm flex items-center gap-1.5">
                {productToToggleActive.isActive ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                {productToToggleActive.name} (Réf : {productToToggleActive.code})
              </p>
              <p className="text-sm font-semibold">
                {productToToggleActive.isActive
                  ? "Voulez-vous vraiment désactiver cet article ?"
                  : "Voulez-vous réactiver cet article ?"}
              </p>
              {productToToggleActive.isActive ? (
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 dark:text-amber-300">
                  <li>L'article ne sera plus disponible pour les nouvelles ventes.</li>
                  <li>L'article ne sera plus disponible pour les nouvelles prestations.</li>
                  <li>L'article ne sera plus sélectionnable comme consommable actif.</li>
                  <li>Son historique complet et ses anciens mouvements de stock restent intégralement conservés.</li>
                  <li>Les anciennes commandes ne sont pas modifiées.</li>
                </ul>
              ) : (
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  L'article redeviendra immédiatement disponible pour les ventes boutique, les prestations atelier et les approvisionnements.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setProductToToggleActive(null)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                icon={Power}
                onClick={handleConfirmToggleActiveProduct}
                className={productToToggleActive.isActive ? "bg-amber-600 hover:bg-amber-700 font-bold text-white" : "bg-emerald-600 hover:bg-emerald-700 font-bold text-white"}
              >
                {productToToggleActive.isActive ? 'Désactiver' : 'Activer'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUPPRESSION SÉCURISÉE D'ARTICLE */}
      {/* ========================================================================= */}
      {productToDelete && (() => {
        const deletability = dbStore.checkProductDeletability(productToDelete.id, currentAgencyId, isSuperAdmin);
        return (
          <Modal
            isOpen={!!productToDelete}
            onClose={() => setProductToDelete(null)}
            title={deletability.canDelete ? "Supprimer cet article ?" : "Suppression impossible"}
            maxWidth="md"
          >
            <div className="space-y-4 pt-1">
              {deletability.canDelete ? (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-900 dark:text-rose-100 space-y-2">
                  <p className="font-bold text-sm flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Suppression définitive de « {productToDelete.name} »
                  </p>
                  <p className="text-sm font-semibold">
                    Voulez-vous définitivement supprimer cet article ?
                  </p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">
                    Cet article ne possède aucun mouvement de stock, vente, commande ou prestation liée. Cette action est irréversible.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs text-amber-900 dark:text-amber-100 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-black text-amber-900 dark:text-amber-100 text-sm">
                        Cet article possède déjà un historique et ne peut pas être supprimé définitivement.
                      </h4>
                      <p className="text-amber-800 dark:text-amber-200 mt-1">
                        Pour préserver l'intégrité de vos données historiques (mouvements, ventes, consommations), la suppression définitive est bloquée. Vous pouvez le désactiver.
                      </p>
                    </div>
                  </div>

                  {deletability.linkedDataSummary && (
                    <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-amber-200 dark:border-amber-900 space-y-1 text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">Données historiques associées :</span>
                      {deletability.linkedDataSummary.movementsCount > 0 && (
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>• Mouvements de stock :</span>
                          <strong>{deletability.linkedDataSummary.movementsCount} mouvement(s)</strong>
                        </div>
                      )}
                      {deletability.linkedDataSummary.ordersCount > 0 && (
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>• Commandes :</span>
                          <strong>{deletability.linkedDataSummary.ordersCount} commande(s)</strong>
                        </div>
                      )}
                      {deletability.linkedDataSummary.purchaseOrdersCount > 0 && (
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>• Bons de commande :</span>
                          <strong>{deletability.linkedDataSummary.purchaseOrdersCount} bon(s)</strong>
                        </div>
                      )}
                      {deletability.linkedDataSummary.servicesCount > 0 && (
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>• Prestations associées :</span>
                          <strong>{deletability.linkedDataSummary.servicesCount} prestation(s)</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setProductToDelete(null)}>
                  {deletability.canDelete ? 'Annuler' : 'Fermer'}
                </Button>

                {deletability.canDelete ? (
                  <Button
                    variant="danger"
                    icon={Trash2}
                    onClick={handleConfirmDeleteProduct}
                    className="font-bold"
                  >
                    Supprimer Définitivement
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    icon={Power}
                    onClick={handleDeactivateInsteadFromDeleteModal}
                    className="font-bold bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Désactiver l'article
                  </Button>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL: CRÉER UNE CATÉGORIE */}
      {/* ========================================================================= */}
      {isNewCategoryModalOpen && (
        <Modal
          isOpen={isNewCategoryModalOpen}
          onClose={() => setIsNewCategoryModalOpen(false)}
          title="Création d'une Nouvelle Catégorie d'Articles"
          maxWidth="md"
        >
          <form onSubmit={handleCreateCategory} className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nom de la Catégorie *
              </label>
              <Input
                type="text"
                placeholder="ex: Papeterie, Fournitures, Plastification, Supports Spéciaux..."
                value={newCatName}
                onChange={(e) => {
                  setNewCatName(e.target.value);
                  if (!newCatCode) {
                    setNewCatCode(e.target.value.substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  }
                }}
                required
                className="font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Code Unique *
                </label>
                <Input
                  type="text"
                  placeholder="ex: PAP, FOURN"
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value.toUpperCase())}
                  required
                  className="font-mono uppercase font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Couleur d'Identification
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer border border-slate-200 dark:border-slate-700 p-0.5"
                  />
                  <Input
                    type="text"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="font-mono text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Description (Facultative)
              </label>
              <Input
                type="text"
                placeholder="Description des articles classés dans cette catégorie..."
                value={newCatDescription}
                onChange={(e) => setNewCatDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Statut
              </label>
              <Select
                value={newCatIsActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => setNewCatIsActive(e.target.value === 'ACTIVE')}
              >
                <option value="ACTIVE">🟢 Active (Proposée pour les nouveaux articles)</option>
                <option value="INACTIVE">⚪ Inactive (Masquée des formulaires)</option>
              </Select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" type="button" onClick={() => setIsNewCategoryModalOpen(false)}>
                Annuler
              </Button>
              <Button variant="primary" icon={CheckCircle2} type="submit" className="font-bold">
                Créer la Catégorie
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MODIFIER UNE CATÉGORIE */}
      {/* ========================================================================= */}
      {categoryToEdit && (
        <Modal
          isOpen={!!categoryToEdit}
          onClose={() => setCategoryToEdit(null)}
          title={`Modifier la Catégorie — ${categoryToEdit.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveEditCategory} className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nom de la Catégorie *
              </label>
              <Input
                type="text"
                value={editCatName}
                onChange={(e) => setEditCatName(e.target.value)}
                required
                className="font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Code Unique *
                </label>
                <Input
                  type="text"
                  value={editCatCode}
                  onChange={(e) => setEditCatCode(e.target.value.toUpperCase())}
                  required
                  className="font-mono uppercase font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Couleur
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editCatColor}
                    onChange={(e) => setEditCatColor(e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer border border-slate-200 dark:border-slate-700 p-0.5"
                  />
                  <Input
                    type="text"
                    value={editCatColor}
                    onChange={(e) => setEditCatColor(e.target.value)}
                    className="font-mono text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Description
              </label>
              <Input
                type="text"
                value={editCatDescription}
                onChange={(e) => setEditCatDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Statut
              </label>
              <Select
                value={editCatIsActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => setEditCatIsActive(e.target.value === 'ACTIVE')}
              >
                <option value="ACTIVE">🟢 Active</option>
                <option value="INACTIVE">⚪ Inactive</option>
              </Select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" type="button" onClick={() => setCategoryToEdit(null)}>
                Annuler
              </Button>
              <Button variant="primary" icon={CheckCircle2} type="submit" className="font-bold">
                Enregistrer les Modifications
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUPPRESSION / RÉAFFECTATION SÉCURISÉE DE CATÉGORIE */}
      {/* ========================================================================= */}
      {categoryToDelete && (
        <Modal
          isOpen={!!categoryToDelete}
          onClose={() => setCategoryToDelete(null)}
          title={`Gestion Sécurisée — ${categoryToDelete.name}`}
          maxWidth="md"
        >
          <div className="space-y-4 pt-1">
            {articlesCountByCategoryId[categoryToDelete.id]?.total > 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-black text-amber-900 dark:text-amber-100 text-sm">
                      Catégorie contenant des articles
                    </h4>
                    <p className="text-amber-800 dark:text-amber-200 mt-1">
                      Cette catégorie contient actuellement <strong>{articlesCountByCategoryId[categoryToDelete.id]?.total} article(s)</strong>. Elle ne peut pas être supprimée brutalement pour préserver l'intégrité de vos données.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200 dark:border-amber-900">
                  <label className="font-bold text-amber-900 dark:text-amber-100 block mb-1">
                    Réaffecter tous ces articles vers : *
                  </label>
                  <Select
                    value={reassignTargetCategoryId}
                    onChange={(e) => setReassignTargetCategoryId(e.target.value)}
                  >
                    {(state.productCategories || [])
                      .filter(c => c.id !== categoryToDelete.id && c.isActive && !c.isArchived)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({articlesCountByCategoryId[c.id]?.total || 0} articles existants)
                        </option>
                      ))}
                  </Select>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                <p>
                  Cette catégorie ne contient aucun article associé. Vous pouvez la supprimer définitivement en toute sécurité.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setCategoryToDelete(null)}>
                Annuler
              </Button>

              {articlesCountByCategoryId[categoryToDelete.id]?.total > 0 ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const cat = categoryToDelete;
                      setCategoryToDelete(null);
                      handleArchiveCategory(cat);
                    }}
                    className="text-xs font-bold text-amber-700"
                  >
                    Désactiver la catégorie
                  </Button>
                  <Button
                    variant="primary"
                    icon={ArrowRight}
                    onClick={handleConfirmDeleteOrReassign}
                    className="bg-brand-600 hover:bg-brand-700 font-bold"
                  >
                    Réaffecter & Archiver
                  </Button>
                </div>
              ) : (
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={handleConfirmDeleteOrReassign}
                  className="font-bold"
                >
                  Supprimer Définitivement
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FICHE DÉTAILLÉE & HISTORIQUE STOCK PRESTATION */}
      {/* ========================================================================= */}
      {productToViewPrestation && (
        <Modal
          isOpen={!!productToViewPrestation}
          onClose={() => setProductToViewPrestation(null)}
          title={`Fiche Stock Prestation — ${productToViewPrestation.name}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 pt-1">
            {/* Header with image and general info */}
            <div className="flex flex-col sm:flex-row gap-4 items-start p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-24 h-24 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                {productToViewPrestation.imageUrl ? (
                  <img
                    src={productToViewPrestation.imageUrl}
                    alt={productToViewPrestation.name}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <span className="text-2xl font-black text-amber-600">
                      {productToViewPrestation.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[9px] text-slate-400">Sans image</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" size="sm" className="font-bold">
                    {productToViewPrestation.category}
                  </Badge>
                  <span className="font-mono text-slate-400 font-bold">
                    Code: {productToViewPrestation.code}
                  </span>
                  {productToViewPrestation.barcode && (
                    <span className="font-mono text-slate-400">
                      CB: {productToViewPrestation.barcode}
                    </span>
                  )}
                </div>

                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  {productToViewPrestation.name}
                </h4>

                {productToViewPrestation.description && (
                  <p className="text-slate-500 text-[11px] line-clamp-2">
                    {productToViewPrestation.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                  <span>Unité de base : <strong>{productToViewPrestation.baseUnit || productToViewPrestation.unit || 'unité'}</strong></span>
                  {productToViewPrestation.packagings && productToViewPrestation.packagings.length > 0 && (
                    <span>• Conditionnements : {productToViewPrestation.packagings.map(pkg => `1 ${pkg.unitName} (${pkg.factorToBase} ${productToViewPrestation.baseUnit})`).join(', ')}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Dual stock gauges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Stock Prestation */}
              <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50/60 dark:from-amber-950/30 dark:to-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/60 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Stock Prestation Disponible
                  </span>
                  {(productToViewPrestation.prestationStock || 0) === 0 ? (
                    <Badge variant="danger" size="sm">🔴 Rupture</Badge>
                  ) : (productToViewPrestation.prestationStock || 0) <= (productToViewPrestation.prestationMinStockAlert || productToViewPrestation.minStockAlert || 0) ? (
                    <Badge variant="warning" size="sm">🟡 Faible</Badge>
                  ) : (
                    <Badge variant="success" size="sm">🟢 Disponible</Badge>
                  )}
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
                    {(productToViewPrestation.prestationStock || 0).toLocaleString('fr-FR')}
                  </span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {productToViewPrestation.baseUnit || productToViewPrestation.unit || 'unité'}s
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                  <span>Seuil min alerte : {productToViewPrestation.prestationMinStockAlert || productToViewPrestation.minStockAlert || 0}</span>
                  <span>Emplacement : Atelier</span>
                </div>
              </div>

              {/* Stock Magasin Réserve */}
              <div className="p-3.5 bg-gradient-to-br from-slate-50 to-brand-50/20 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-brand-500" />
                    Réserve Stock Magasin
                  </span>
                  {productToViewPrestation.currentStock <= 0 ? (
                    <Badge variant="danger" size="sm">🔴 Épuisé</Badge>
                  ) : (
                    <Badge variant="outline" size="sm">📦 En Stock</Badge>
                  )}
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-800 dark:text-slate-200">
                    {productToViewPrestation.currentStock.toLocaleString('fr-FR')}
                  </span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {productToViewPrestation.baseUnit || productToViewPrestation.unit || 'unité'}s
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Conditionnement : {formatSmartStockBreakdown(productToViewPrestation.currentStock, productToViewPrestation)}</span>
                  <span>Emplacement : {productToViewPrestation.location || 'Magasin'}</span>
                </div>
              </div>
            </div>

            {/* Prestation movements history */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-brand-500" />
                Historique des Mouvements — Stock Prestation
              </h5>

              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {agencyMovements
                  .filter(m => 
                    m.productId === productToViewPrestation.id &&
                    (m.sourceLocation === 'PRESTATION' || m.destinationLocation === 'PRESTATION' || m.movementType === 'INTERNAL_CONSUMPTION' || m.movementType === 'CONSUMPTION')
                  )
                  .map((m) => {
                    const isTransferIn = m.destinationLocation === 'PRESTATION' || m.movementType === 'INTERNAL_CONSUMPTION';
                    return (
                      <div key={m.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs flex justify-between items-center border border-slate-100 dark:border-slate-800">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            {isTransferIn ? (
                              <Badge variant="success" size="sm" className="text-[10px]">
                                📥 Transfert Entrant
                              </Badge>
                            ) : (
                              <Badge variant="outline" size="sm" className="text-[10px] text-rose-600 border-rose-200 bg-rose-50">
                                ✂️ Consommation Prestation
                              </Badge>
                            )}
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {m.serviceOrDepartment || m.reason}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            {formatDate(m.createdAt)} • par {m.performedByUserName || 'Système'} {m.relatedOrderId ? `• Commande : ${m.relatedOrderId}` : ''}
                          </span>
                        </div>

                        <span className={`font-black text-xs px-2 py-0.5 rounded-md ${
                          isTransferIn ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40' : 'text-rose-700 bg-rose-50 dark:bg-rose-950/40'
                        }`}>
                          {isTransferIn ? `+${Math.abs(m.quantity)}` : `-${Math.abs(m.quantity)}`} {m.unitUsed || productToViewPrestation.unit}
                        </span>
                      </div>
                    );
                  })}

                {agencyMovements.filter(m => 
                  m.productId === productToViewPrestation.id &&
                  (m.sourceLocation === 'PRESTATION' || m.destinationLocation === 'PRESTATION' || m.movementType === 'INTERNAL_CONSUMPTION' || m.movementType === 'CONSUMPTION')
                ).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Aucun mouvement enregistré pour cet article dans le Stock Prestation.
                  </p>
                )}
              </div>
            </div>

            {/* Modal footer actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                icon={Wrench}
                onClick={() => {
                  const p = productToViewPrestation;
                  setProductToViewPrestation(null);
                  setConsProductId(p.id);
                  setActiveTab('consumption');
                }}
                className="text-xs font-bold text-amber-600 hover:bg-amber-50"
              >
                Transférer depuis Magasin
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Edit}
                  onClick={() => {
                    const p = productToViewPrestation;
                    setProductToViewPrestation(null);
                    handleOpenAdjustPrestation(p);
                  }}
                  className="text-xs font-bold"
                >
                  Ajuster Stock
                </Button>
                <Button variant="primary" size="sm" onClick={() => setProductToViewPrestation(null)}>
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AJUSTEMENT INVENTAIRE STOCK PRESTATION */}
      {/* ========================================================================= */}
      {productToAdjustPrestation && (
        <Modal
          isOpen={!!productToAdjustPrestation}
          onClose={() => setProductToAdjustPrestation(null)}
          title={`Ajuster Stock Prestation — ${productToAdjustPrestation.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleProcessPrestationAdjustment} className="space-y-4 pt-1">
            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Stock Prestation Actuel :</span>
                <strong className="text-amber-700 dark:text-amber-300 font-black">
                  {(productToAdjustPrestation.prestationStock || 0).toLocaleString('fr-FR')} {productToAdjustPrestation.baseUnit || productToAdjustPrestation.unit}s
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Réserve Magasin :</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {productToAdjustPrestation.currentStock.toLocaleString('fr-FR')} {productToAdjustPrestation.baseUnit || productToAdjustPrestation.unit}s
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nouveau Stock Réel en Prestation ({productToAdjustPrestation.baseUnit || productToAdjustPrestation.unit}s) *
              </label>
              <Input
                type="number"
                min="0"
                value={adjustPrestationQty}
                onChange={(e) => setAdjustPrestationQty(Math.max(0, parseInt(e.target.value) || 0))}
                className="font-black text-sm"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Motif de l'ajustement / inventaire atelier *
              </label>
              <Input
                type="text"
                placeholder="ex: Comptage physique fin de journée, régularisation..."
                value={adjustPrestationReason}
                onChange={(e) => setAdjustPrestationReason(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" size="sm" onClick={() => setProductToAdjustPrestation(null)}>
                Annuler
              </Button>
              <Button variant="primary" size="sm" type="submit" className="bg-amber-600 hover:bg-amber-700 font-bold">
                Valider l'Ajustement Prestation
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BARCODE LABEL PRINT */}
      {/* ========================================================================= */}
      {productForBarcode && (
        <ProductBarcodeLabelModal
          product={productForBarcode}
          isOpen={!!productForBarcode}
          onClose={() => setProductForBarcode(null)}
        />
      )}

    </div>
  );
};
