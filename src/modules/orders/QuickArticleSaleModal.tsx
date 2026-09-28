import React, { useState, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { formatCurrency, generateDocNumber } from '../../lib/utils';
import {
  Product, Person, PaymentMethod, Payment, Order, OrderItem
} from '../../types';
import {
  ShoppingBag, Search, Plus, Trash2, CheckCircle2, UserPlus,
  Boxes, ShieldAlert, Sparkles, AlertTriangle, Minus, Wallet,
  CreditCard, Check, ArrowRight, LayoutGrid, List
} from 'lucide-react';
import { PaymentReceiptModal } from './PaymentReceiptModal';

interface QuickArticleSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleCompleted?: (orderId: string) => void;
}

export interface PackagingOption {
  label: string;
  containedQty: number;
  price: number;
  isBase?: boolean;
}

export function getProductPackagingOptions(product: Product): PackagingOption[] {
  const options: PackagingOption[] = [];
  const baseUnit = product.baseUnit || product.unit || 'unité';
  const basePrice = product.salePrice || product.costPrice || 0;

  options.push({
    label: baseUnit,
    containedQty: 1,
    price: basePrice,
    isBase: true,
  });

  if (product.packagings && product.packagings.length > 0) {
    product.packagings.forEach(pkg => {
      if (pkg.isAllowedForSale !== false) {
        const pkgPrice = pkg.salePrice || (basePrice * (pkg.factorToBase || 1));
        options.push({
          label: pkg.unitName,
          containedQty: pkg.factorToBase || 1,
          price: pkgPrice,
          isBase: false,
        });
      }
    });
  } else if (product.purchaseUnit && (product.conversionFactor || 1) > 1) {
    const conversion = product.conversionFactor || 1;
    const puPrice = product.salePricePerPurchaseUnit || (basePrice * conversion);
    options.push({
      label: product.purchaseUnit,
      containedQty: conversion,
      price: puPrice,
      isBase: false,
    });
  }

  return options;
}

interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  usePurchaseUnit: boolean;
  unitName: string;
  conversionFactor: number;
  unitPrice: number;
  isCustomPrice: boolean;
}

export const QuickArticleSaleModal: React.FC<QuickArticleSaleModalProps> = ({
  isOpen,
  onClose,
  onSaleCompleted,
}) => {
  const { currentTenant, currentUser, hasPermission } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const tenantId = currentTenant?.id || 't-001';
  const tenantProducts = useMemo(() => {
    return state.products.filter(p => p.tenantId === tenantId || p.tenantId === 'global');
  }, [state.products, tenantId]);

  const tenantPersons = useMemo(() => {
    return state.persons.filter(p => p.tenantId === tenantId || p.tenantId === 'global');
  }, [state.persons, tenantId]);

  const tenantAccounts = useMemo(() => {
    return (state.financialAccounts || []).filter(a => a.tenantId === tenantId || a.tenantId === 'global');
  }, [state.financialAccounts, tenantId]);

  // Active Cash Session check
  const activeCashSession = useMemo(() => {
    return (state.cashSessions || []).find(cs => (cs.tenantId === tenantId || cs.tenantId === 'global') && cs.status === 'OPEN');
  }, [state.cashSessions, tenantId]);

  // View Mode: GRID (Mosaïque) by default vs LIST
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Client State
  const [clientMode, setClientMode] = useState<'WALK_IN' | 'REGISTERED' | 'NEW'>('WALK_IN');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  // New Client Creation Inline
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // Payment State
  const [paymentOption, setPaymentOption] = useState<'FULL' | 'PARTIAL' | 'UNPAID'>('FULL');
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [selectedFinancialAccountId, setSelectedFinancialAccountId] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');

  // Success Receipt Modal State
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Available product categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(tenantProducts.map(p => p.category || 'Général')));
    return ['ALL', ...cats];
  }, [tenantProducts]);

  // Filtered Products List
  const filteredProducts = useMemo(() => {
    return tenantProducts.filter(p => {
      const matchSearch = !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCat = selectedCategory === 'ALL' || (p.category || 'Général') === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [tenantProducts, searchQuery, selectedCategory]);

  // Selected Person details
  const selectedPerson = useMemo(() => {
    if (clientMode !== 'REGISTERED') return null;
    return tenantPersons.find(p => p.id === selectedPersonId);
  }, [clientMode, selectedPersonId, tenantPersons]);

  // Add or increment item in cart with specific unit/packaging option
  const handleAddToCart = (product: Product, option?: PackagingOption) => {
    const opt = option || {
      label: product.unit || 'unité',
      containedQty: 1,
      price: product.salePrice || product.costPrice || 0,
      isBase: true,
    };

    // Check available stock
    const availablePhysical = product.currentStock;
    if (availablePhysical <= 0) {
      showToast('Rupture de Stock', `L'article "${product.name}" est en rupture de stock.`, 'DANGER');
      return;
    }

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.productId === product.id && item.unitName === opt.label);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const currentItem = updated[existingIndex];
        const newQty = currentItem.quantity + 1;
        const requiredPhysical = newQty * opt.containedQty;
        if (requiredPhysical > availablePhysical) {
          showToast('Stock Insuffisant', `Stock maximum disponible atteint (${availablePhysical} ${product.unit}).`, 'WARNING');
          return prev;
        }
        updated[existingIndex] = { ...currentItem, quantity: newQty };
        return updated;
      } else {
        const requiredPhysical = 1 * opt.containedQty;
        if (requiredPhysical > availablePhysical) {
          showToast('Stock Insuffisant', `Stock disponible (${availablePhysical} ${product.unit}) insuffisant pour un(e) ${opt.label} (${opt.containedQty} ${product.unit}).`, 'WARNING');
          return prev;
        }

        return [
          ...prev,
          {
            id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            productId: product.id,
            product,
            quantity: 1,
            usePurchaseUnit: opt.containedQty > 1,
            unitName: opt.label,
            conversionFactor: opt.containedQty,
            unitPrice: opt.price,
            isCustomPrice: false
          }
        ];
      }
    });
  };

  // Update cart item quantity
  const handleUpdateQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(item => item.id !== cartItemId));
      return;
    }

    setCart(prev => prev.map(item => {
      if (item.id !== cartItemId) return item;
      const conversion = item.conversionFactor || 1;
      const requiredPhysical = newQty * conversion;
      if (requiredPhysical > item.product.currentStock) {
        showToast('Stock Insuffisant', `Quantité supérieure au stock disponible (${item.product.currentStock} ${item.product.unit}).`, 'WARNING');
        return item;
      }
      return { ...item, quantity: newQty };
    }));
  };

  // Update cart item price
  const handleUpdatePrice = (cartItemId: string, newPrice: number) => {
    setCart(prev => prev.map(item => {
      if (item.id !== cartItemId) return item;
      return { ...item, unitPrice: Math.max(0, newPrice), isCustomPrice: true };
    }));
  };

  // Remove cart item
  const handleRemoveFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  // Calculate Subtotals & Totals
  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [cart]);

  // Selected financial account
  const effectiveAccountId = selectedFinancialAccountId || tenantAccounts[0]?.id || '';

  // Validate Sale & Execute Stock Deduction
  const handleConfirmSale = () => {
    if (cart.length === 0) {
      showToast('Panier Vide', 'Veuillez sélectionner au moins un article à vendre.', 'WARNING');
      return;
    }

    // Client resolution
    let finalPersonId = '';
    let finalPersonName = 'Client de passage';
    let finalPersonPhone = '';

    if (clientMode === 'REGISTERED') {
      if (!selectedPersonId) {
        showToast('Client Requis', 'Veuillez sélectionner un client enregistré.', 'WARNING');
        return;
      }
      const p = tenantPersons.find(person => person.id === selectedPersonId);
      if (p) {
        finalPersonId = p.id;
        finalPersonName = `${p.firstName} ${p.lastName}`.trim();
        finalPersonPhone = p.phone || '';
      }
    } else if (clientMode === 'NEW') {
      if (!newPersonName.trim()) {
        showToast('Nom du client requis', 'Veuillez saisir le nom du nouveau client.', 'WARNING');
        return;
      }
      if (newPersonPhone && !newPersonPhone.startsWith('+')) {
        showToast('Téléphone invalide', 'Le téléphone doit comporter un indicatif (ex: +224...).', 'WARNING');
        return;
      }
      // Create new person in database
      const newPersonId = `pers-${Date.now()}`;
      dbStore.updateState(draft => {
        draft.persons.unshift({
          id: newPersonId,
          tenantId,
          firstName: newPersonName.trim(),
          lastName: '',
          phone: newPersonPhone,
          types: ['CUSTOMER'],
          isActive: true,
          createdAt: new Date().toISOString()
        });
      });
      finalPersonId = newPersonId;
      finalPersonName = newPersonName.trim();
      finalPersonPhone = newPersonPhone;
    } else {
      // WALK_IN
      finalPersonName = walkInName.trim() || 'Client de passage';
      finalPersonPhone = walkInPhone.trim();
    }

    // Verify stock availability on server-side before proceeding
    for (const item of cart) {
      const prod = dbStore.getState().products.find(p => p.id === item.productId);
      if (!prod) {
        showToast('Article introuvable', `L'article "${item.product.name}" n'existe plus.`, 'DANGER');
        return;
      }
      const conversion = item.conversionFactor || 1;
      const requiredQty = item.quantity * conversion;
      if (prod.currentStock < requiredQty) {
        showToast(
          'Stock Insuffisant (Validation)',
          `L'article "${prod.name}" dispose de ${prod.currentStock} ${prod.unit} (Requis: ${requiredQty}).`,
          'DANGER'
        );
        return;
      }
    }

    const orderNumber = generateDocNumber('VTE', state.orders.length + 1);
    const performedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Vendeur';

    // Build Order Items
    const orderItems: OrderItem[] = cart.map((item, idx) => {
      const conversion = item.conversionFactor || 1;
      const stockDeduction = item.quantity * conversion;
      const unitLabel = item.unitName || item.product.unit;

      return {
        id: `item-${Date.now()}-${idx}`,
        itemType: 'PRODUCT',
        productId: item.productId,
        productName: item.product.name,
        productCode: item.product.code,
        category: item.product.category || 'Article Boutique / Stock Central',
        quantity: item.quantity,
        unit: unitLabel,
        publicUnit: unitLabel,
        purchaseUnitName: item.product.purchaseUnit,
        conversionFactor: item.conversionFactor,
        standardUnitPrice: item.unitPrice,
        appliedUnitPrice: item.unitPrice,
        unitPrice: item.unitPrice,
        discountPercent: 0,
        discountAmount: 0,
        totalPrice: item.quantity * item.unitPrice,
        stockDeducted: true,
        stockProductId: item.productId,
        stockQuantityDeducted: stockDeduction,
        assignedDepartment: 'STORE',
        productionStatus: 'DELIVERED',
        deliveredAt: new Date().toISOString(),
        deliveredByUserName: performedBy,
      };
    });

    // Payment calculations
    let paidAmount = 0;
    if (paymentOption === 'FULL') {
      paidAmount = totalAmount;
    } else if (paymentOption === 'PARTIAL') {
      paidAmount = Math.min(totalAmount, Math.max(0, partialAmount));
    } else {
      paidAmount = 0;
    }
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    const paymentStatus = dueAmount === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    // 1. Create Order in Database
    const newOrder: Order = {
      id: `ord-vte-${Date.now()}`,
      tenantId,
      branchId: currentUser?.branchId,
      orderNumber,
      orderSource: 'VENTE_ARTICLE',
      customerType: clientMode === 'WALK_IN' ? 'WALK_IN' : 'REGISTERED',
      personId: finalPersonId || undefined,
      personName: finalPersonName,
      personPhone: finalPersonPhone || undefined,
      status: 'DELIVERED',
      paymentStatus,
      deliveryStatus: 'DELIVERED',
      priority: 'NORMAL',
      items: orderItems,
      files: [],
      subtotal: totalAmount,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount,
      paidAmount,
      dueAmount,
      stockDeducted: true, // Mark stock deducted atomically
      consumablesDeducted: true,
      deliveredAt: new Date().toISOString(),
      deliveredByUserId: currentUser?.id,
      deliveredByUserName: performedBy,
      createdBy: currentUser?.id,
      createdByName: performedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save order via store
    dbStore.updateState(draft => {
      draft.orders.unshift(newOrder);
    });

    // 2. Perform Stock Deduction & Traçabilité (VENTE_BOUTIQUE / VENTE_ARTICLE movement)
    dbStore.deductConsumablesForOrder(newOrder.id, tenantId, performedBy);

    // 3. Register Payment & Cash Inflow if paidAmount > 0
    let recordedPayment: Payment | null = null;
    if (paidAmount > 0) {
      recordedPayment = {
        id: `pay-${Date.now()}`,
        tenantId,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        personName: finalPersonName,
        targetType: 'ORDER',
        paymentNumber: generateDocNumber('PAY', state.payments.length + 1),
        amount: paidAmount,
        paymentMethod,
        financialAccountId: effectiveAccountId,
        reference: paymentReference || undefined,
        receivedByUserName: performedBy,
        createdAt: new Date().toISOString(),
      };

      dbStore.updateState(draft => {
        if (!draft.payments) draft.payments = [];
        draft.payments.unshift(recordedPayment!);

        // Link payment to Cash Session if Cash Method used
        const cashSess = draft.cashSessions.find(cs => (cs.tenantId === tenantId || cs.tenantId === 'global') && cs.status === 'OPEN');
        if (cashSess) {
          if (!cashSess.movements) cashSess.movements = [];
          cashSess.movements.unshift({
            id: `cm-vte-${Date.now()}`,
            cashSessionId: cashSess.id,
            movementType: 'INFLOW',
            amount: paidAmount,
            category: 'Vente d\'Article Stock Central',
            reason: `Encaissement Vente #${orderNumber} - Client: ${finalPersonName}`,
            isCommercialRevenue: true,
            performedByUserName: performedBy,
            createdAt: new Date().toISOString()
          });
        }
      });
    }

    showToast('Vente Enregistrée', `La vente d'articles #${orderNumber} de ${formatCurrency(totalAmount)} a été validée avec succès.`, 'SUCCESS');

    if (onSaleCompleted) {
      onSaleCompleted(newOrder.id);
    }

    if (recordedPayment) {
      setCompletedOrder(newOrder);
      setReceiptPayment(recordedPayment);
    } else {
      // Close modal if unpaid
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title=""
        maxWidth="4xl"
      >
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-slate-900 p-4 sm:p-5 rounded-2xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Vendre un Article — Stock Central</h3>
                  <p className="text-xs text-emerald-200">
                    Vente rapide directe d'articles et fournitures au détail, en paquet ou en carton depuis la source centrale.
                  </p>
                </div>
              </div>
            </div>

            {activeCashSession ? (
              <Badge variant="success" size="sm" className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
                🟢 Session Caisse Ouverte
              </Badge>
            ) : (
              <Badge variant="warning" size="sm" className="bg-amber-500/20 text-amber-300 border-amber-400/30">
                ⚠️ Caisse non ouverte
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT COLUMN: Catalog & Article Selector (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Search, View Mode Toggle & Category Filter */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Rechercher un article (nom, code, code-barres)..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* View Mode Toggle: Mosaïque (GRID) vs Liste (LIST) */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode('GRID')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-colors ${
                        viewMode === 'GRID'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Affichage Mosaïque (Grand Format)"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Mosaïque</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('LIST')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-colors ${
                        viewMode === 'LIST'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Affichage Liste Compacte"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Liste</span>
                    </button>
                  </div>
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        selectedCategory === cat
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat === 'ALL' ? 'Tous les Articles' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Display Container */}
              {viewMode === 'GRID' ? (
                /* MOSAÏQUE / GRAND FORMAT GRID VIEW */
                <div className="max-h-[460px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3.5 pr-1">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(prod => {
                      const isOutOfStock = prod.currentStock <= 0;
                      const isLowStock = prod.currentStock > 0 && prod.currentStock <= prod.minStockAlert;
                      const packagingOptions = getProductPackagingOptions(prod);

                      return (
                        <div
                          key={prod.id}
                          className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-emerald-500/50 transition-all duration-200 group"
                        >
                          <div>
                            {/* Card Top: Category & Code */}
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                                {prod.category || 'Papeterie'}
                              </span>
                              {prod.code && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500">
                                  {prod.code}
                                </span>
                              )}
                            </div>

                            {/* Product Title */}
                            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-emerald-600 transition-colors">
                              {prod.name}
                            </h4>

                            {/* Price & Stock status */}
                            <div className="mt-2 space-y-1">
                              <div className="text-xs text-slate-600 dark:text-slate-300">
                                Prix: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{formatCurrency(prod.salePrice || prod.costPrice || 0)}</strong>
                                <span className="text-[11px] text-slate-400"> / {prod.unit}</span>
                              </div>

                              <div>
                                {isOutOfStock ? (
                                  <span className="inline-block text-[10px] font-extrabold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
                                    🔴 Rupture de stock
                                  </span>
                                ) : isLowStock ? (
                                  <span className="inline-block text-[10px] font-extrabold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900">
                                    ⚠️ Stock faible: {prod.currentStock} {prod.unit}
                                  </span>
                                ) : (
                                  <span className="inline-block text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900">
                                    🟢 Stock dispo: {prod.currentStock} {prod.unit}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: Add Unit, Packet, Carton etc. */}
                          <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
                              Vendre par :
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {packagingOptions.map(opt => {
                                const isOptDisabled = isOutOfStock || (prod.currentStock < opt.containedQty);
                                return (
                                  <button
                                    key={opt.label}
                                    type="button"
                                    disabled={isOptDisabled}
                                    onClick={() => handleAddToCart(prod, opt)}
                                    className={`flex-1 min-w-[90px] px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center justify-between gap-1 transition-all border shadow-2xs ${
                                      isOptDisabled
                                        ? 'opacity-40 bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                        : opt.isBase
                                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white hover:border-emerald-600'
                                        : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'
                                    }`}
                                  >
                                    <span>+ {opt.label}</span>
                                    <span className="text-[10px] opacity-80 font-bold">{formatCurrency(opt.price)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                      <Boxes className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      Aucun article ne correspond à votre recherche.
                    </div>
                  )}
                </div>
              ) : (
                /* COMPACT LIST VIEW */
                <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(prod => {
                      const isOutOfStock = prod.currentStock <= 0;
                      const isLowStock = prod.currentStock > 0 && prod.currentStock <= prod.minStockAlert;
                      const packagingOptions = getProductPackagingOptions(prod);

                      return (
                        <div
                          key={prod.id}
                          className="pt-2 first:pt-0 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-xl transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                {prod.name}
                              </span>
                              {prod.code && (
                                <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                  {prod.code}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              <span>Prix: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">{formatCurrency(prod.salePrice || prod.costPrice || 0)}</strong> / {prod.unit}</span>
                              <span>•</span>
                              <span className={isOutOfStock ? 'text-rose-600 font-bold' : isLowStock ? 'text-amber-600 font-bold' : 'text-slate-600 dark:text-slate-300 font-bold'}>
                                Stock dispo: {prod.currentStock} {prod.unit}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {packagingOptions.map(opt => (
                              <Button
                                key={opt.label}
                                size="sm"
                                variant={isOutOfStock || prod.currentStock < opt.containedQty ? 'ghost' : 'outline'}
                                disabled={isOutOfStock || prod.currentStock < opt.containedQty}
                                onClick={() => handleAddToCart(prod, opt)}
                                className={`text-xs font-bold ${
                                  opt.isBase
                                    ? 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60'
                                    : 'text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
                                }`}
                              >
                                + {opt.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      <Boxes className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      Aucun article ne correspond à votre recherche.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Ticket / Cart Summary & Checkout (5 cols) */}
            <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  Ticket de Vente ({cart.length} articles)
                </h4>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[10px] font-bold text-rose-600 hover:underline"
                  >
                    Vider le panier
                  </button>
                )}
              </div>

              {/* Cart Items List */}
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                {cart.length > 0 ? (
                  cart.map(item => {
                    const unitLabel = item.usePurchaseUnit ? (item.product.purchaseUnit || 'carton') : item.product.unit;
                    const subtotal = item.quantity * item.unitPrice;

                    return (
                      <div
                        key={item.id}
                        className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white block truncate">
                              {item.product.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Unité: {unitLabel}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Quantity & Unit Price Controls */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 rounded font-bold text-xs"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                              className="w-10 text-center bg-transparent text-xs font-black focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="w-5 h-5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 rounded font-bold text-xs"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right">
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={e => handleUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
                              className="w-24 text-right bg-white dark:bg-slate-900 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold"
                            />
                            <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                              Total: {formatCurrency(subtotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    Le panier est actuellement vide. Cliquez sur un article à gauche pour l'ajouter.
                  </div>
                )}
              </div>

              {/* Client Selection */}
              <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  Identité du Client
                </span>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setClientMode('WALK_IN')}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-extrabold transition-colors ${
                      clientMode === 'WALK_IN' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Passage
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode('REGISTERED')}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-extrabold transition-colors ${
                      clientMode === 'REGISTERED' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Enregistré
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode('NEW')}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-extrabold transition-colors ${
                      clientMode === 'NEW' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    + Nouveau
                  </button>
                </div>

                {clientMode === 'REGISTERED' && (
                  <Select
                    value={selectedPersonId}
                    onChange={e => setSelectedPersonId(e.target.value)}
                    options={[
                      { value: '', label: '-- Sélectionner un client --' },
                      ...tenantPersons.map(p => ({
                        value: p.id,
                        label: `${p.firstName} ${p.lastName} ${p.phone ? `(${p.phone})` : ''}`
                      }))
                    ]}
                  />
                )}

                {clientMode === 'NEW' && (
                  <div className="space-y-1.5">
                    <Input
                      placeholder="Nom complet du client"
                      value={newPersonName}
                      onChange={e => setNewPersonName(e.target.value)}
                    />
                    <PhoneInput
                      value={newPersonPhone}
                      onChange={e => setNewPersonPhone(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Payment Section */}
              <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Mode de Règlement
                  </span>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="bg-white dark:bg-slate-800 text-xs font-bold px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="CASH">Espèces (Caisse)</option>
                    <option value="ORANGE_MONEY">Orange Money</option>
                    <option value="MTN_MOMO">MTN Mobile Money</option>
                    <option value="CARD">Carte Bancaire</option>
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="CHECK">Chèque</option>
                  </select>
                </div>
              </div>

              {/* Total Summary Banner */}
              <div className="p-3 bg-emerald-950 text-white rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-300 font-bold uppercase block">Total Net à Payer</span>
                  <span className="text-xl font-black">{formatCurrency(totalAmount)}</span>
                </div>
                <Button
                  variant="success"
                  size="md"
                  disabled={cart.length === 0}
                  onClick={handleConfirmSale}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold shadow-md"
                >
                  <Check className="w-4 h-4 mr-1 stroke-[3]" /> Valider la Vente
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Success Receipt Modal */}
      {completedOrder && receiptPayment && (
        <PaymentReceiptModal
          onClose={() => {
            setReceiptPayment(null);
            setCompletedOrder(null);
            onClose();
          }}
          payment={receiptPayment}
          order={completedOrder}
        />
      )}
    </>
  );
};
