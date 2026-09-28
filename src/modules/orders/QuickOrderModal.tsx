import React, { useState, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { isValidPhoneNumber } from '../../lib/phoneValidation';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { checkDiscountPermission } from '../../lib/pricingEngine';
import { evaluateTenantSubscription } from '../../lib/licenseEngine';
import { formatCurrency, generateDocNumber } from '../../lib/utils';
import {
  Service, Person, OrderItem, OrderFile, OrderPriority, PaymentMethod, Payment, Order,
  Product, ProductionJob, DiscountAudit, PurchaseOrder,
  ServiceSpecificationOption, ServiceSpecificationGroup
} from '../../types';
import {
  Plus, Trash2, UploadCloud, CheckCircle2, UserPlus, ShoppingBag,
  Percent, Tag, ShieldAlert, Sparkles, Minus, AlertCircle, Info, FileText,
  Lock, Unlock, Store, Wrench, Layers, AlertTriangle, Paperclip,
  Users, Search, Truck, RotateCcw, Boxes, ArrowRight, Check, Settings2, Clock,
  Printer, ShieldCheck
} from 'lucide-react';
import { OpenCashModal } from '../cash/OpenCashModal';
import { PaymentReceiptModal } from './PaymentReceiptModal';
import { calculateOrderStockRequirements, evaluateOrderStock, StockEvaluation, resolveProductPurchasePrice, calculateEffectiveServiceConsumableQty } from '../../lib/stockEngine';

// Helper to get visual cues (icon, badge color, category) for any service dynamically
function getServiceVisuals(service: Service) {
  const nameLower = (service.name || '').toLowerCase();
  const codeLower = (service.code || '').toLowerCase();
  const catLower = (service.categoryName || '').toLowerCase();

  if (nameLower.includes('photocopi') || codeLower.includes('photo-') || nameLower.includes('copie')) {
    return {
      icon: '📄',
      badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800',
      categoryTag: 'Photocopie',
    };
  }
  if (nameLower.includes('impress') || codeLower.includes('print') || nameLower.includes('laser') || nameLower.includes('jet d\'encre')) {
    return {
      icon: '🖨️',
      badgeColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800',
      categoryTag: 'Impression',
    };
  }
  if (nameLower.includes('reliur') || codeLower.includes('reliure') || nameLower.includes('spirale') || nameLower.includes('thermoreliure')) {
    return {
      icon: '📚',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
      categoryTag: 'Reliure',
    };
  }
  if (nameLower.includes('plastif') || codeLower.includes('plastif') || nameLower.includes('pochette')) {
    return {
      icon: '🗂️',
      badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
      categoryTag: 'Plastification',
    };
  }
  if (nameLower.includes('t-shirt') || nameLower.includes('tshirt') || nameLower.includes('sublim') || nameLower.includes('pressage') || nameLower.includes('flocage') || nameLower.includes('textile')) {
    return {
      icon: '👕',
      badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800',
      categoryTag: 'Textile / Sublimation',
    };
  }
  if (nameLower.includes('format') || nameLower.includes('cours') || nameLower.includes('atelier') || catLower.includes('format')) {
    return {
      icon: '🎓',
      badgeColor: 'bg-teal-500/10 text-teal-600 border-teal-200 dark:border-teal-800',
      categoryTag: 'Formation',
    };
  }
  if (nameLower.includes('scan') || nameLower.includes('numéris') || codeLower.includes('scan')) {
    return {
      icon: '🔍',
      badgeColor: 'bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800',
      categoryTag: 'Numérisation',
    };
  }
  if (nameLower.includes('photo') || nameLower.includes('identit') || codeLower.includes('photo')) {
    return {
      icon: '📸',
      badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800',
      categoryTag: 'Photo',
    };
  }
  if (nameLower.includes('infograph') || nameLower.includes('design') || nameLower.includes('graphism') || nameLower.includes('logo') || nameLower.includes('affiche')) {
    return {
      icon: '🎨',
      badgeColor: 'bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800',
      categoryTag: 'Infographie',
    };
  }
  if (nameLower.includes('tampon') || nameLower.includes('cachet') || nameLower.includes('gravur')) {
    return {
      icon: '🏷️',
      badgeColor: 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800',
      categoryTag: 'Cachet & Tampon',
    };
  }
  return {
    icon: '🛠️',
    badgeColor: 'bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800',
    categoryTag: service.categoryName || 'Prestation',
  };
}

// Helper to auto-assign the best matching department when a service is picked
function getDepartmentForService(service: Service): 'DESIGN' | 'PRINT' | 'FINISHING' | 'PHOTOCOPY' | 'PHOTO' | 'OTHER' {
  const nameLower = (service.name || '').toLowerCase();
  const codeLower = (service.code || '').toLowerCase();
  if (nameLower.includes('photocopi') || codeLower.includes('photo-') || nameLower.includes('copie')) return 'PHOTOCOPY';
  if (nameLower.includes('impress') || codeLower.includes('print') || nameLower.includes('scan') || nameLower.includes('numéris')) return 'PRINT';
  if (nameLower.includes('reliur') || nameLower.includes('plastif') || codeLower.includes('reliure') || codeLower.includes('plastif')) return 'FINISHING';
  if (nameLower.includes('photo') || nameLower.includes('identit')) return 'PHOTO';
  if (nameLower.includes('infograph') || nameLower.includes('design') || nameLower.includes('logo')) return 'DESIGN';
  return 'PRINT';
}

// Re-export specifications engine
export { getServiceSpecificationGroups, resolveSpecOption, getSelectedSpecOption, resolveServiceSpecsImpact } from '../../lib/serviceSpecs';
import { getServiceSpecificationGroups, resolveSpecOption, getSelectedSpecOption, resolveServiceSpecsImpact } from '../../lib/serviceSpecs';

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (orderId: string) => void;
}

interface OrderFormLine {
  id: string;
  itemType: 'SERVICE' | 'PRODUCT';
  serviceId?: string;
  productId?: string;
  pageCount?: number; // Nombre de pages du document original (ex: 5)
  copiesCount?: number; // Nombre d'exemplaires / tirages (ex: 20)
  quantity: number; // Total à produire et facturer = pageCount * copiesCount
  unit: string;
  purchaseUnitName?: string;
  conversionFactor?: number;
  usePurchaseUnit?: boolean; // Vente au carton ou au paquet
  isCustomPrice: boolean;
  customUnitPrice?: number;
  discountReasonCategory: 'VOLUME' | 'LOYALTY' | 'INSTITUTIONAL' | 'PROMOTION' | 'COMMERCIAL_NEGOTIATION' | 'OTHER';
  discountReasonCustom: string;
  assignedDepartment: 'DESIGN' | 'PRINT' | 'FINISHING' | 'PHOTOCOPY' | 'PHOTO' | 'STORE' | 'OTHER';
  notes: string;
  files: { name: string; size: number }[];
}

interface CalculatedLine extends OrderFormLine {
  name: string;
  category: string;
  unit: string;
  stockUnit?: string;
  stockDeduction?: number;
  currentStock?: number;
  standardUnitPrice: number;
  appliedUnitPrice: number;
  grossTotal: number;
  netTotal: number;
  discountAmount: number;
  discountPercent: number;
  permCheck: any;
  service?: Service;
  product?: Product;
}

export const QuickOrderModal: React.FC<QuickOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
}) => {
  const { currentTenant, currentBranch, currentUser, hasPermission, isSuperAdmin } = useAuth();
  const { showToast } = useNotification();
  const state = dbStore.getState();

  const userRoleCode = currentUser?.roles[0]?.code || 'CAISSIER';
  const roleLimits = currentTenant?.settings?.discountRoleLimits || [];
  const hasAdminPerm = hasPermission('discounts.approve') || hasPermission('discounts.create') || hasPermission('orders.*') || currentUser?.roles.some(r => r.code === 'SUPER_ADMIN' || r.code === 'ADMIN_CENTRE' || r.code === 'GERANT');

  const tenantId = currentTenant?.id || 't-001';

  // Strict Tenant Isolated Collections
  const tenantServices = useMemo(() => {
    return (state.services || []).filter(s => s.tenantId === tenantId && s.isActive);
  }, [state.services, tenantId]);

  const tenantProducts = useMemo(() => {
    // Fournitures / Articles Magasin & Boutique (isSellable !== false)
    return (state.products || []).filter(p => p.tenantId === tenantId && p.isSellable !== false && p.isActive);
  }, [state.products, tenantId]);

  const tenantAccounts = useMemo(() => {
    return (state.financialAccounts || []).filter(a => a.tenantId === tenantId && a.isActive);
  }, [state.financialAccounts, tenantId]);

  // Active Cash Session detection
  const activeCashSession = (state.cashSessions || []).find(s => s.tenantId === tenantId && s.status === 'OPEN');
  const [isOpenCashModalOpen, setIsOpenCashModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Confirmation State for rapid successive orders
  const [createdOrderSummary, setCreatedOrderSummary] = useState<{
    id: string;
    orderNumber: string;
    clientName: string;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    paymentStatus: string;
    status: string;
    linesCount: number;
  } | null>(null);

  const [isValidatingDelivery, setIsValidatingDelivery] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<any | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<any | null>(null);

  // Customer Mode & State: REGISTERED vs WALK_IN (Default: WALK_IN / Client de Passage)
  const [clientMode, setClientMode] = useState<'REGISTERED' | 'WALK_IN'>('WALK_IN');
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    (state.persons || []).find(p => p.tenantId === tenantId)?.id || state.persons[0]?.id || ''
  );
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  // Quick person creation modal state
  const [isCreatingNewPerson, setIsCreatingNewPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [newPersonType, setNewPersonType] = useState<'ALL' | 'STUDENT' | 'COMPANY'>('ALL');

  // Form Lines State
  const defaultInitialService = tenantServices[0] || state.services[0];
  const initialSpecs = getServiceSpecificationGroups(defaultInitialService);
  const initialNotes = initialSpecs.map(g => `${g.name}: ${g.defaultValue || g.options[0]}`).join(' | ');

  const [lines, setLines] = useState<OrderFormLine[]>([
    {
      id: `line-${Date.now()}-1`,
      itemType: 'SERVICE',
      serviceId: defaultInitialService?.id || '',
      pageCount: 1,
      copiesCount: 1,
      quantity: 1,
      unit: defaultInitialService?.unit || 'page',
      isCustomPrice: false,
      discountReasonCategory: 'COMMERCIAL_NEGOTIATION',
      discountReasonCustom: '',
      assignedDepartment: 'PHOTOCOPY',
      notes: initialNotes,
      files: [],
    }
  ]);

  const [priority, setPriority] = useState<OrderPriority>('NORMAL');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);

  // Enhanced 3-Option Payment State: 'UNPAID' | 'FULL' | 'PARTIAL'
  const [paymentOption, setPaymentOption] = useState<'UNPAID' | 'FULL' | 'PARTIAL'>('FULL');
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [selectedFinancialAccountId, setSelectedFinancialAccountId] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');

  // Auto-resolve destination financial account
  const matchingAccounts = useMemo(() => {
    if (paymentMethod === 'CASH') {
      return tenantAccounts.filter(a => a.type === 'CASH');
    }
    if (paymentMethod === 'ORANGE_MONEY' || paymentMethod === 'MTN_MOMO') {
      return tenantAccounts.filter(a => a.type === 'MOBILE_MONEY');
    }
    if (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CARD' || paymentMethod === 'CHECK') {
      return tenantAccounts.filter(a => a.type === 'BANK');
    }
    return tenantAccounts;
  }, [tenantAccounts, paymentMethod]);

  const effectiveFinancialAccountId = selectedFinancialAccountId || matchingAccounts[0]?.id || tenantAccounts[0]?.id || '';
  const effectiveFinancialAccount = tenantAccounts.find(a => a.id === effectiveFinancialAccountId);

  // Complete Reset of Form State to Initial Values
  const resetForm = () => {
    const defaultSrv = tenantServices[0] || state.services[0];
    const srvSpecs = getServiceSpecificationGroups(defaultSrv);
    const defaultNotes = srvSpecs.map(g => `${g.name}: ${g.defaultValue || g.options[0]}`).join(' | ');
    setLines([
      {
        id: `line-${Date.now()}-1`,
        itemType: 'SERVICE',
        serviceId: defaultSrv?.id || '',
        pageCount: 1,
        copiesCount: 1,
        quantity: 1,
        unit: defaultSrv?.unit || 'page',
        isCustomPrice: false,
        customUnitPrice: undefined,
        discountReasonCategory: 'COMMERCIAL_NEGOTIATION',
        discountReasonCustom: '',
        assignedDepartment: 'PHOTOCOPY',
        notes: defaultNotes,
        files: [],
      }
    ]);
    setClientMode('WALK_IN');
    setSelectedPersonId((state.persons || []).find(p => p.tenantId === tenantId)?.id || state.persons[0]?.id || '');
    setClientSearchQuery('');
    setWalkInName('');
    setWalkInPhone('');
    setIsCreatingNewPerson(false);
    setNewPersonName('');
    setNewPersonPhone('');
    setNewPersonType('ALL');
    setPriority('NORMAL');
    setInstructions('');
    setDueDate(new Date().toISOString().split('T')[0]);
    setPaymentOption('FULL');
    setPartialAmount(0);
    setPaymentMethod('CASH');
    setSelectedFinancialAccountId('');
    setPaymentReference('');
  };

  // Filtered persons for instant dynamic search
  const filteredPersons = useMemo(() => {
    const tenantPersons = (state.persons || []).filter(p => p.tenantId === tenantId || p.tenantId === 'global');
    if (!clientSearchQuery.trim()) return tenantPersons;
    const q = clientSearchQuery.toLowerCase();
    return tenantPersons.filter(p =>
      p.firstName.toLowerCase().includes(q) ||
      (p.lastName && p.lastName.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q)) ||
      (p.customerProfile?.customerNumber && p.customerProfile.customerNumber.toLowerCase().includes(q)) ||
      (p.customerProfile?.companyName && p.customerProfile.companyName.toLowerCase().includes(q))
    );
  }, [state.persons, tenantId, clientSearchQuery]);

  // Selected Person details
  const selectedPerson = useMemo(() => {
    if (clientMode === 'WALK_IN') return null;
    return (state.persons || []).find(p => p.id === selectedPersonId);
  }, [clientMode, selectedPersonId, state.persons]);

  // Derived customer type for pricing engine
  const customerType = useMemo(() => {
    if (clientMode === 'WALK_IN') return 'ALL';
    if (selectedPerson?.customerProfile?.isCompany) return 'COMPANY';
    if (selectedPerson?.types.includes('LEARNER')) return 'STUDENT';
    return 'ALL';
  }, [clientMode, selectedPerson]);

  // Detailed calculations for all lines
  const calculatedLines = useMemo((): CalculatedLine[] => {
    return lines.map(line => {
      if (line.itemType === 'SERVICE') {
        const srv = tenantServices.find(s => s.id === line.serviceId) || state.services.find(s => s.id === line.serviceId);
        const specsImpact = srv ? resolveServiceSpecsImpact(srv, line.notes, state.products) : null;
        const standardUnitPrice = specsImpact ? specsImpact.standardUnitPrice : (srv?.basePrice || 0);
        const appliedUnitPrice = line.isCustomPrice && line.customUnitPrice !== undefined
          ? line.customUnitPrice
          : standardUnitPrice;
        
        const grossTotal = standardUnitPrice * line.quantity;
        const netTotal = appliedUnitPrice * line.quantity;
        const discountAmount = Math.max(0, grossTotal - netTotal);
        const discountPercent = grossTotal > 0 ? Number(((discountAmount / grossTotal) * 100).toFixed(1)) : 0;

        const permCheck = checkDiscountPermission(
          userRoleCode,
          discountPercent,
          roleLimits,
          hasAdminPerm
        );

        return {
          ...line,
          name: srv?.name || 'Prestation',
          category: (srv as any)?.category || srv?.categoryName || 'Service',
          unit: srv?.unit || 'unité',
          standardUnitPrice,
          appliedUnitPrice,
          grossTotal,
          netTotal,
          discountAmount,
          discountPercent,
          permCheck,
          service: srv,
        };
      } else {
        // BOUTIQUE PRODUCT / STOCK MAGASIN
        const prod = tenantProducts.find(p => p.id === line.productId) || state.products.find(p => p.id === line.productId);
        const conversion = prod?.conversionFactor || 1;
        const isCarton = line.usePurchaseUnit && conversion > 1;

        const standardUnitPrice = isCarton
          ? (prod?.salePricePerPurchaseUnit || (prod?.salePrice || prod?.costPrice || 0) * conversion)
          : (prod?.salePrice || prod?.costPrice || 0);

        const appliedUnitPrice = line.isCustomPrice && line.customUnitPrice !== undefined
          ? line.customUnitPrice
          : standardUnitPrice;

        const stockDeduction = isCarton ? line.quantity * conversion : line.quantity;
        const grossTotal = standardUnitPrice * line.quantity;
        const netTotal = appliedUnitPrice * line.quantity;
        const discountAmount = Math.max(0, grossTotal - netTotal);
        const discountPercent = grossTotal > 0 ? Number(((discountAmount / grossTotal) * 100).toFixed(1)) : 0;

        const permCheck = checkDiscountPermission(
          userRoleCode,
          discountPercent,
          roleLimits,
          hasAdminPerm
        );

        return {
          ...line,
          name: prod?.name || 'Article Fourniture',
          category: prod?.category || 'Fournitures / Boutique',
          unit: isCarton ? (prod?.purchaseUnit || 'carton') : (prod?.unit || 'unité'),
          stockUnit: prod?.unit || 'unité',
          stockDeduction,
          currentStock: prod?.currentStock || 0,
          standardUnitPrice,
          appliedUnitPrice,
          grossTotal,
          netTotal,
          discountAmount,
          discountPercent,
          permCheck,
          product: prod,
        };
      }
    });
  }, [lines, tenantServices, tenantProducts, state.services, state.products, userRoleCode, roleLimits, hasAdminPerm]);

  // Order Totals Breakdown & Effective Payment Amount Calculation
  const totals = useMemo(() => {
    const grossSubtotal = calculatedLines.reduce((acc, curr) => acc + curr.grossTotal, 0);
    const subtotal = calculatedLines.reduce((acc, curr) => acc + curr.netTotal, 0);
    const totalDiscount = Math.max(0, grossSubtotal - subtotal);
    const totalAmount = subtotal;

    let computedPaidAmount = 0;
    if (paymentOption === 'UNPAID') {
      computedPaidAmount = 0;
    } else if (paymentOption === 'FULL') {
      computedPaidAmount = totalAmount;
    } else {
      // PARTIAL
      computedPaidAmount = Math.min(totalAmount, Math.max(0, partialAmount));
    }

    const dueAmount = Math.max(0, totalAmount - computedPaidAmount);
    const hasHighDiscount = calculatedLines.some(l => l.discountPercent > 20 && !hasAdminPerm);

    return {
      grossSubtotal,
      subtotal,
      totalDiscount,
      totalAmount,
      paidAmount: computedPaidAmount,
      dueAmount,
      hasHighDiscount,
    };
  }, [calculatedLines, paymentOption, partialAmount, hasAdminPerm]);

  const paymentAmount = totals.paidAmount;

  // Aggregate stock requirements across boutique items and service internal consumptions
  const stockRequirements = useMemo(() => {
    return calculateOrderStockRequirements(calculatedLines, state.services, state.products);
  }, [calculatedLines, state.services, state.products]);

  // Live stock evaluations with threshold alerts, open POs, and restock suggestions
  const stockEvaluations = useMemo(() => {
    return evaluateOrderStock(stockRequirements, state.products, state.purchaseOrders);
  }, [stockRequirements, state.products, state.purchaseOrders]);

  // High-level stock status summary
  const stockStatusSummary = useMemo(() => {
    const insufficientItems = stockEvaluations.filter(e => e.status === 'INSUFFICIENT' && !e.allowNegativeStock);
    const restockInProgressItems = stockEvaluations.filter(e => e.status === 'RESTOCK_IN_PROGRESS');
    const lowStockItems = stockEvaluations.filter(e => e.status === 'LOW_STOCK');

    const hasInsufficient = insufficientItems.length > 0;
    const hasRestockInProgress = restockInProgressItems.length > 0;
    const hasLowStock = lowStockItems.length > 0;
    const allSufficient = !hasInsufficient && !hasRestockInProgress && !hasLowStock;

    return {
      hasInsufficient,
      hasRestockInProgress,
      hasLowStock,
      insufficientItems,
      restockInProgressItems,
      lowStockItems,
      allSufficient,
    };
  }, [stockEvaluations]);

  // Restock PO Modal State
  const [isRestockPOModalOpen, setIsRestockPOModalOpen] = useState(false);
  const [restockSupplierId, setRestockSupplierId] = useState<string>('');
  const [restockDepartmentId, setRestockDepartmentId] = useState<string>('');
  const [restockLines, setRestockLines] = useState<Array<{
    productId: string;
    productName: string;
    productCode: string;
    category: string;
    orderedQuantityPurchaseUnit: number;
    purchaseUnitName: string;
    conversionFactor: number;
    quantityInStockUnit: number;
    unitPricePurchaseUnit: number;
    unitPriceStockUnit: number;
    totalPrice: number;
    currentStock: number;
    baseUnit: string;
  }>>([]);
  const [restockNotes, setRestockNotes] = useState('');

  // Open Restock PO Modal pre-populated with missing / low-stock items
  const handleOpenRestockPO = (targetEvaluations?: StockEvaluation[]) => {
    const itemsToRestock = targetEvaluations && targetEvaluations.length > 0
      ? targetEvaluations
      : stockEvaluations.filter(e => e.status === 'INSUFFICIENT' || e.status === 'LOW_STOCK' || e.status === 'RESTOCK_IN_PROGRESS');

    if (itemsToRestock.length === 0) return;

    // Pick first supplier among items, or first available supplier
    const detectedSupplierId = itemsToRestock.find(it => it.usualSupplierId)?.usualSupplierId || state.suppliers[0]?.id || '';
    setRestockSupplierId(detectedSupplierId);
    
    // Pick first active department if available
    const dept = state.requestingDepartments?.find(d => d.isActive)?.id || '';
    setRestockDepartmentId(dept);

    const initialPOLines = itemsToRestock.map(it => {
      const prod = state.products.find(p => p.id === it.productId);
      const chosenUnit = it.purchaseUnit || 'carton';
      const priceRes = prod ? resolveProductPurchasePrice(prod, chosenUnit) : null;
      const conversion = priceRes ? priceRes.factorToBase : (it.conversionFactor || 1);
      const orderQtyPU = it.recommendedPurchaseQty > 0 ? it.recommendedPurchaseQty : 1;
      const unitPricePU = priceRes && priceRes.unitPrice > 0 ? priceRes.unitPrice : (it.purchasePricePerPurchaseUnit || (it.costPrice * conversion));
      const unitPriceSU = conversion > 0 ? Math.round(unitPricePU / conversion) : unitPricePU;

      return {
        productId: it.productId,
        productName: it.productName,
        productCode: it.productCode,
        category: it.category,
        orderedQuantityPurchaseUnit: orderQtyPU,
        purchaseUnitName: priceRes ? priceRes.selectedUnitName : chosenUnit,
        conversionFactor: conversion,
        quantityInStockUnit: orderQtyPU * conversion,
        unitPricePurchaseUnit: unitPricePU,
        unitPriceStockUnit: unitPriceSU,
        totalPrice: orderQtyPU * unitPricePU,
        currentStock: it.currentStock,
        baseUnit: it.stockUnit,
      };
    });

    setRestockLines(initialPOLines);
    setRestockNotes(`Ravitaillement express déclenché pour la commande client (besoin immédiat).`);
    setIsRestockPOModalOpen(true);
  };

  // Submit Restock PO
  const handleCreateRestockPO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockSupplierId) {
      showToast('Fournisseur Requis', 'Veuillez sélectionner un fournisseur.', 'DANGER');
      return;
    }
    if (restockLines.length === 0) {
      showToast('Articles Requis', 'Aucun article dans la commande fournisseur.', 'DANGER');
      return;
    }

    const performedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Gestionnaire Commandes';

    const result = dbStore.createSecurePurchaseOrder(
      {
        supplierId: restockSupplierId,
        departmentId: restockDepartmentId,
        notes: restockNotes,
        expectedDelivery: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        items: restockLines.map(l => ({
          productId: l.productId,
          orderedQuantityPurchaseUnit: l.orderedQuantityPurchaseUnit,
          purchaseUnitName: l.purchaseUnitName,
          unitPricePurchaseUnit: l.unitPricePurchaseUnit
        }))
      },
      currentTenant?.id || 't-001',
      performedBy,
      isSuperAdmin
    );

    if (result.success && result.purchaseOrder) {
      showToast(
        'Bon de Commande Émis 📦',
        `Bon de commande ${result.purchaseOrder.poNumber} émis auprès de ${result.purchaseOrder.supplierName} (${result.purchaseOrder.items.length} article(s)).`,
        'SUCCESS'
      );
      setIsRestockPOModalOpen(false);
    } else {
      showToast('Erreur', result.message, 'DANGER');
    }
  };

  // Add Service Line
  const handleAddServiceLine = () => {
    const defaultSrv = state.services.find(s => s.isActive) || state.services[0];
    const srvSpecs = getServiceSpecificationGroups(defaultSrv);
    const defaultNotes = srvSpecs.map(g => `${g.name}: ${g.defaultValue || g.options[0]}`).join(' | ');
    setLines(prev => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length + 1}`,
        itemType: 'SERVICE',
        serviceId: defaultSrv?.id || '',
        pageCount: 1,
        copiesCount: 1,
        quantity: 1,
        unit: defaultSrv?.unit || 'page',
        isCustomPrice: false,
        discountReasonCategory: 'COMMERCIAL_NEGOTIATION',
        discountReasonCustom: '',
        assignedDepartment: 'PRINT',
        notes: defaultNotes,
        files: [],
      }
    ]);
  };

  // Add Product Line (Boutique)
  const handleAddProductLine = () => {
    const defaultProd = state.products.find(p => p.isActive && p.currentStock > 0) || state.products[0];
    setLines(prev => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length + 1}`,
        itemType: 'PRODUCT',
        productId: defaultProd?.id || '',
        quantity: 1,
        unit: defaultProd?.unit || 'unité',
        purchaseUnitName: defaultProd?.purchaseUnit || 'carton',
        conversionFactor: defaultProd?.conversionFactor || 1,
        usePurchaseUnit: false,
        isCustomPrice: false,
        discountReasonCategory: 'COMMERCIAL_NEGOTIATION',
        discountReasonCustom: '',
        assignedDepartment: 'STORE',
        notes: '',
        files: [],
      }
    ]);
  };

  // Remove Line
  const handleRemoveLine = (index: number) => {
    if (lines.length > 1) {
      setLines(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Update Line Field with dynamic reactive calculation for pageCount * copiesCount
  const handleUpdateLine = (index: number, updates: Partial<OrderFormLine>) => {
    setLines(prev => {
      const copy = [...prev];
      const current = copy[index];
      let newPageCount = updates.pageCount !== undefined ? updates.pageCount : current.pageCount;
      let newCopiesCount = updates.copiesCount !== undefined ? updates.copiesCount : current.copiesCount;
      let newQuantity = updates.quantity !== undefined ? updates.quantity : current.quantity;

      // Recompute total quantity whenever pageCount or copiesCount is edited
      if (updates.pageCount !== undefined || updates.copiesCount !== undefined) {
        const p = Math.max(1, newPageCount !== undefined ? Number(newPageCount) : 1);
        const c = Math.max(1, newCopiesCount !== undefined ? Number(newCopiesCount) : 1);
        newPageCount = p;
        newCopiesCount = c;
        newQuantity = p * c;
      }

      copy[index] = {
        ...current,
        ...updates,
        pageCount: newPageCount,
        copiesCount: newCopiesCount,
        quantity: newQuantity,
      };
      return copy;
    });
  };

  // Quick Client Creation
  const handleCreateNewPerson = () => {
    if (!newPersonName.trim()) return;

    if (newPersonPhone.trim() && !isValidPhoneNumber(newPersonPhone, { allowEmpty: true })) {
      showToast('Erreur Téléphone', 'Le numéro de téléphone du client est invalide.', 'DANGER');
      return;
    }

    const newId = `p-${Date.now()}`;
    const newPerson: Person = {
      id: newId,
      tenantId: currentTenant?.id || 't-001',
      firstName: newPersonName.trim(),
      lastName: '',
      phone: newPersonPhone.trim() || undefined,
      types: newPersonType === 'STUDENT' ? ['CUSTOMER', 'LEARNER'] : ['CUSTOMER'],
      customerProfile: {
        customerNumber: generateDocNumber('CLI', state.persons.length + 1),
        isCompany: newPersonType === 'COMPANY',
        companyName: newPersonType === 'COMPANY' ? newPersonName.trim() : undefined,
        discountRate: 0,
        creditLimit: 0,
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dbStore.updateState(draft => {
      draft.persons.unshift(newPerson);
    });

    setSelectedPersonId(newId);
    setIsCreatingNewPerson(false);
    setNewPersonName('');
    setNewPersonPhone('');
    showToast('Client Enregistré', `Le client ${newPerson.firstName} a été créé.`, 'SUCCESS');
  };

  // Submit Order
  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (clientMode === 'WALK_IN' && walkInPhone.trim() && !isValidPhoneNumber(walkInPhone, { allowEmpty: true })) {
      showToast('Erreur Téléphone', 'Le numéro de téléphone de contact est invalide.', 'DANGER');
      return;
    }
    setIsSubmitting(true);

    try {
      // Verification licence serveur
      const evalRes = evaluateTenantSubscription(currentTenant);
      if (evalRes.isExpired || evalRes.isSuspended) {
        showToast('Période d\'Essai Expirée', "Votre période d'essai de 45 jours est arrivée à son terme. Veuillez contacter l'administrateur.", 'DANGER');
        setIsSubmitting(false);
        return;
      }

      if (clientMode === 'REGISTERED' && !selectedPerson) {
        showToast('Client requis', 'Veuillez sélectionner un client enregistré ou choisir « Client de passage ».', 'DANGER');
        setIsSubmitting(false);
        return;
      }

      if (lines.length === 0) {
        showToast('Lignes requises', 'Veuillez ajouter au moins une prestation ou un article.', 'DANGER');
        setIsSubmitting(false);
        return;
      }

      // Check cash session for upfront payment if destination account is cash
      const isCashDestination = paymentMethod === 'CASH' || effectiveFinancialAccount?.type === 'CASH' || effectiveFinancialAccount?.isMainCash;
      if (paymentAmount > 0 && isCashDestination && !activeCashSession) {
        showToast('Caisse Fermée', 'Veuillez ouvrir la caisse du jour pour encaisser en espèces.', 'WARNING');
        setIsOpenCashModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      // Live stock verification for boutique products and service internal consumptions
      const liveReqs = calculateOrderStockRequirements(calculatedLines, state.services, state.products);
      const liveEvals = evaluateOrderStock(liveReqs, state.products, state.purchaseOrders);
      const blockingEvals = liveEvals.filter(e => e.status === 'INSUFFICIENT' && !e.allowNegativeStock);

      if (blockingEvals.length > 0) {
        const first = blockingEvals[0];
        showToast(
          'Stock Insuffisant pour la Commande',
          `Impossible de valider : ${first.productName} est insuffisant (Disponible: ${first.currentStock} ${first.stockUnit}, Requis: ${first.totalRequired} ${first.stockUnit}, Manquant: ${first.missingQty} ${first.stockUnit}). Veuillez effectuer un ravitaillement fournisseur.`,
          'DANGER'
        );
        setIsSubmitting(false);
        return;
      }

      const orderId = `ord-${Date.now()}`;
      const orderNumber = generateDocNumber('CMD', state.orders.length + 1);
      const performedBy = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Caissier';

      const finalCustomerType = clientMode;
      const finalPersonId = clientMode === 'REGISTERED' && selectedPerson ? selectedPerson.id : undefined;
      const finalPersonName = clientMode === 'REGISTERED' && selectedPerson
        ? (selectedPerson.firstName + (selectedPerson.lastName ? ` ${selectedPerson.lastName}` : '')).trim()
        : (walkInName.trim() || 'Client de passage');
      const finalPersonPhone = clientMode === 'REGISTERED' && selectedPerson
        ? selectedPerson.phone
        : (walkInPhone.trim() || undefined);
      const finalPersonEmail = clientMode === 'REGISTERED' && selectedPerson
        ? selectedPerson.email
        : undefined;

      // Map OrderItems
      const orderItems: OrderItem[] = calculatedLines.map((line, idx) => ({
        id: `item-${Date.now()}-${idx + 1}`,
        orderId,
        itemType: line.itemType,
        serviceId: line.serviceId,
        serviceName: line.itemType === 'SERVICE' ? line.name : undefined,
        productId: line.productId,
        productName: line.itemType === 'PRODUCT' ? line.name : undefined,
        category: line.category,
        description: line.notes || line.name,
        quantity: line.quantity,
        unit: line.unit,
        purchaseUnitName: line.purchaseUnitName,
        conversionFactor: line.conversionFactor,
        standardUnitPrice: line.standardUnitPrice,
        appliedUnitPrice: line.appliedUnitPrice,
        unitPrice: line.appliedUnitPrice,
        isCustomPrice: line.isCustomPrice,
        grossTotal: line.grossTotal,
        discountAmount: line.discountAmount,
        discountPercent: line.discountPercent,
        discountType: line.discountAmount > 0 ? 'EXCEPTIONAL' : 'NONE',
        discountReasonCategory: line.discountReasonCategory,
        discountReason: line.discountReasonCategory === 'OTHER' ? line.discountReasonCustom : line.discountReasonCategory,
        discountGrantedBy: line.discountAmount > 0 ? performedBy : undefined,
        totalPrice: line.netTotal,
        productionStatus: line.itemType === 'PRODUCT' ? 'DELIVERED' : 'PENDING',
        assignedDepartment: line.assignedDepartment,
        assignedToUserName: line.itemType === 'PRODUCT' ? performedBy : undefined,
        notes: line.notes,
        pageCount: line.pageCount,
        copiesCount: line.copiesCount,
        stockDeducted: line.itemType === 'PRODUCT',
        stockProductId: line.productId,
        stockQuantityDeducted: line.itemType === 'PRODUCT' ? line.stockDeduction : undefined,
      }));

      // Pre-validation: Check Availability of Prestation Consumables and Products
      const tenantId = currentTenant?.id || 't-001';
      const stockCheck = dbStore.checkConsumablesStockAvailability(orderItems, tenantId);
      if (!stockCheck.isAvailable && stockCheck.missingItems && stockCheck.missingItems.length > 0) {
        const missingDetails = stockCheck.missingItems
          .map(m => `• « ${m.productName} » pour ${m.serviceName} : Requis ${m.requiredQty} ${m.unit}, Dispo ${m.availableQty} ${m.unit} (Manque ${m.missingQty} ${m.unit})`)
          .join('\n');
        showToast(
          'Stock de consommables insuffisant',
          `Impossible de créer la commande. Stock insuffisant :\n${missingDetails}`,
          'DANGER'
        );
        setIsSubmitting(false);
        return;
      }

      // Production Jobs for services
      const productionJobs: ProductionJob[] = calculatedLines
        .filter(l => l.itemType === 'SERVICE')
        .map((line, idx) => ({
          id: `job-${Date.now()}-${idx + 1}`,
          tenantId: currentTenant?.id || 't-001',
          orderId,
          orderItemId: `item-${Date.now()}-${idx + 1}`,
          orderNumber,
          personName: finalPersonName,
          itemDescription: line.name,
          serviceName: line.name,
          department: line.assignedDepartment,
          quantity: line.quantity,
          unit: line.unit,
          priority,
          status: 'PENDING',
          durationMinutes: 30,
          notes: line.notes,
          dueDate,
        }));

      const finalPaymentStatus = paymentAmount >= totals.totalAmount ? 'PAID' : paymentAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      const newOrder: any = {
        id: orderId,
        tenantId: currentTenant?.id || 't-001',
        branchId: currentBranch?.id || 'b-001',
        orderNumber,
        customerType: finalCustomerType,
        personId: finalPersonId,
        personName: finalPersonName,
        personPhone: finalPersonPhone,
        personEmail: finalPersonEmail,
        status: 'PENDING',
        paymentStatus: finalPaymentStatus,
        deliveryStatus: 'UNDELIVERED',
        priority,
        items: orderItems,
        files: [],
        subtotal: totals.grossSubtotal,
        discountAmount: totals.totalDiscount,
        taxAmount: 0,
        totalAmount: totals.totalAmount,
        paidAmount: paymentAmount,
        dueAmount: totals.dueAmount,
        dueDate,
        assignedDepartment: calculatedLines.find(l => l.assignedDepartment)?.assignedDepartment,
        instructions,
        createdBy: currentUser?.id,
        createdByName: performedBy,
        qrCodeData: JSON.stringify({
          ref: orderNumber,
          client: finalPersonName,
          total: totals.totalAmount,
          due: totals.dueAmount,
          lines: orderItems.length
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      dbStore.updateState(draft => {
        draft.orders.unshift(newOrder);

        // Append production jobs
        if (!draft.productionJobs) draft.productionJobs = [];
        productionJobs.forEach(job => draft.productionJobs.unshift(job));
      });

      // Deduct stock for consumables and boutique items atomically
      dbStore.deductConsumablesForOrder(newOrder.id, tenantId, performedBy);

      dbStore.updateState(draft => {
        // Register Cash Payment & Inflow if paymentAmount > 0
        if (paymentAmount > 0) {
          if (isCashDestination && activeCashSession) {
            const activeSess = draft.cashSessions.find(cs => cs.id === activeCashSession.id);
            if (activeSess) {
              if (!activeSess.movements) activeSess.movements = [];
              activeSess.movements.push({
                id: `cmov-${Date.now()}`,
                cashSessionId: activeCashSession.id,
                movementType: 'INFLOW',
                amount: paymentAmount,
                category: 'Encaissement Commande Prestation',
                reason: `Règlement ${totals.dueAmount === 0 ? 'intégral' : 'acompte'} sur commande ${orderNumber}`,
                isCommercialRevenue: true,
                performedByUserName: performedBy,
                createdAt: new Date().toISOString()
              });
            }
          }

          if (!draft.payments) draft.payments = [];
          draft.payments.unshift({
            id: `pay-${Date.now()}`,
            tenantId: currentTenant?.id || 't-001',
            cashSessionId: isCashDestination && activeCashSession ? activeCashSession.id : undefined,
            personId: finalPersonId,
            personName: finalPersonName,
            targetType: 'ORDER',
            orderId,
            orderNumber,
            paymentNumber: generateDocNumber('PAY', draft.payments.length + 1),
            amount: paymentAmount,
            balanceBefore: totals.totalAmount,
            balanceAfter: totals.dueAmount,
            paymentType: totals.dueAmount === 0 ? 'BALANCE_PAYMENT' : 'ADVANCE',
            paymentMethod,
            financialAccountId: effectiveFinancialAccountId || undefined,
            reference: paymentReference || `Règlement ${orderNumber}`,
            notes: `Règlement commande multi-prestations ${orderNumber} (${paymentOption === 'FULL' ? 'Paiement total' : 'Paiement partiel'})`,
            receivedByUserName: performedBy,
            createdAt: new Date().toISOString()
          });
        }

        // Log discount audit if any
        calculatedLines.forEach(line => {
          if (line.discountAmount > 0) {
            if (!draft.discountAudits) draft.discountAudits = [];
            draft.discountAudits.unshift({
              id: `disc-${Date.now()}-${line.id}`,
              tenantId: currentTenant?.id || 't-001',
              orderId,
              orderNumber,
              serviceId: line.serviceId,
              serviceName: line.name,
              quantity: line.quantity,
              unit: line.unit,
              standardPrice: line.standardUnitPrice,
              appliedPrice: line.appliedUnitPrice,
              grossTotal: line.grossTotal,
              discountAmount: line.discountAmount,
              discountPercent: line.discountPercent,
              discountType: 'EXCEPTIONAL',
              discountReasonCategory: line.discountReasonCategory,
              discountReason: line.discountReasonCategory === 'OTHER' ? line.discountReasonCustom : line.discountReasonCategory,
              grantedByUserId: currentUser?.id || 'usr-admin',
              grantedByUserName: performedBy,
              status: 'APPLIED',
              createdAt: new Date().toISOString()
            });
          }
        });
      });

      dbStore.logAudit('ORDER_CREATED', 'ORDER', orderId, null, {
        orderNumber,
        client: finalPersonName,
        customerType: finalCustomerType,
      });

      // Synchronisation automatique avec Finance & Trésorerie
      if (paymentAmount > 0) {
        dbStore.recordIncomingPayment({
          tenantId: currentTenant?.id || 't-001',
          amount: paymentAmount,
          paymentMethod,
          financialAccountId: effectiveFinancialAccountId || undefined,
          reference: paymentReference || `Règlement commande ${orderNumber}`,
          category: 'CLIENT_PAYMENT',
          categoryLabel: paymentOption === 'FULL' ? 'Règlement Intégral Commande' : 'Acompte Commande Prestation',
          relatedEntityId: orderId,
          relatedEntityType: 'ORDER',
          performedByUserName: performedBy,
          notes: `Règlement initial commande ${orderNumber} (${finalPersonName})`
        });
      }

      showToast('Dossier Commercial Validé 🟢', `Dossier commercial ${orderNumber} créé et validé avec succès (${orderItems.length} ligne(s)).`, 'SUCCESS');
      
      // Stocke le résumé de la commande validée pour affichage de la confirmation et enchaînement
      setCreatedOrderSummary({
        id: orderId,
        orderNumber,
        clientName: finalPersonName,
        totalAmount: totals.totalAmount,
        paidAmount: paymentAmount,
        dueAmount: totals.dueAmount,
        paymentStatus: finalPaymentStatus,
        status: 'PENDING',
        linesCount: orderItems.length,
      });
      setIsSubmitting(false);

      onOrderCreated?.(orderId);
    } catch (error) {
      setIsSubmitting(false);
      showToast('Erreur', "Une erreur inattendue est survenue lors de l'enregistrement du dossier commercial.", 'DANGER');
    }
  };

  const handleModalClose = () => {
    setCreatedOrderSummary(null);
    setReceiptPayment(null);
    setReceiptOrder(null);
    onClose();
  };

  const handleValidateAndDeliver = () => {
    if (!createdOrderSummary) return;
    if (createdOrderSummary.status === 'DELIVERED') return;

    setIsValidatingDelivery(true);
    try {
      const performedBy = currentUser ? {
        id: currentUser.id,
        name: `${currentUser.firstName} ${currentUser.lastName}`
      } : {
        id: 'usr-admin',
        name: 'Caissier'
      };

      const res = dbStore.deliverCommercialOrder(
        createdOrderSummary.id,
        currentTenant?.id || 't-001',
        performedBy
      );

      if (res.success) {
        setCreatedOrderSummary(prev => prev ? { ...prev, status: 'DELIVERED' } : null);
        showToast('Commande Livrée 🟢', res.message, 'SUCCESS');
      } else {
        showToast('Validation Impossible ⚠️', res.message, 'DANGER');
      }
    } catch (err) {
      showToast('Erreur', "Une erreur inattendue est survenue lors de la validation.", 'DANGER');
    } finally {
      setIsValidatingDelivery(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!createdOrderSummary) return;
    const currentOrder = (state.orders || []).find(o => o.id === createdOrderSummary.id);
    const existingPayment = ((state.payments || []) as any[]).find(p => p.orderId === createdOrderSummary.id) as Payment | undefined;
    const resolvedMethod: PaymentMethod = existingPayment ? existingPayment.paymentMethod : paymentMethod;

    const fallbackPayment: Payment = existingPayment || {
      id: `pay-${createdOrderSummary.id}`,
      tenantId: currentTenant?.id || 't-001',
      personId: currentOrder?.personId || 'client-walk-in',
      personName: createdOrderSummary.clientName,
      targetType: 'ORDER',
      orderId: createdOrderSummary.id,
      orderNumber: createdOrderSummary.orderNumber,
      paymentNumber: `REC-${createdOrderSummary.orderNumber}`,
      amount: createdOrderSummary.paidAmount,
      balanceBefore: createdOrderSummary.totalAmount,
      balanceAfter: createdOrderSummary.dueAmount,
      paymentType: createdOrderSummary.dueAmount === 0 ? 'BALANCE_PAYMENT' : 'ADVANCE',
      paymentMethod: resolvedMethod,
      reference: `Reçu commande ${createdOrderSummary.orderNumber}`,
      receivedByUserName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Caisse',
      createdAt: currentOrder?.createdAt || new Date().toISOString()
    };

    setReceiptPayment(fallbackPayment);
    setReceiptOrder(currentOrder || null);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleModalClose}
        title={createdOrderSummary ? "Confirmation — Commande Validée" : "Nouvelle Commande Multi-Prestations & Fournitures"}
        maxWidth="2xl"
      >
        {createdOrderSummary ? (
          <div className="py-6 px-4 sm:px-8 space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Commande Validée avec Succès !
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                La commande <span className="font-mono font-bold text-slate-800 dark:text-slate-200">#{createdOrderSummary.orderNumber}</span> a été enregistrée avec succès.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg mx-auto text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-medium">N° de Commande :</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-sm">#{createdOrderSummary.orderNumber}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-medium">Client :</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{createdOrderSummary.clientName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-medium">Prestations / Articles :</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{createdOrderSummary.linesCount} ligne(s)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-medium">Montant Total :</span>
                <span className="font-black text-brand-600 dark:text-brand-400 text-sm">{formatCurrency(createdOrderSummary.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-medium">Statut de la commande :</span>
                {createdOrderSummary.status === 'DELIVERED' ? (
                  <Badge variant="success" size="sm" className="font-bold text-[11px]">
                    🟢 Livrée
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm" className="font-bold text-[11px]">
                    🟡 Commande validée / En attente de livraison
                  </Badge>
                )}
              </div>
              <div className="flex justify-between items-center pt-0.5">
                <span className="text-slate-500 font-medium">Règlement :</span>
                {(() => {
                  const isFullyPaid = createdOrderSummary.paymentStatus === 'PAID' || (createdOrderSummary.paidAmount >= createdOrderSummary.totalAmount && createdOrderSummary.totalAmount > 0);
                  const hasAdvance = createdOrderSummary.paidAmount > 0 && !isFullyPaid;

                  return (
                    <Badge variant={isFullyPaid ? 'success' : hasAdvance ? 'warning' : 'outline'} size="sm">
                      {isFullyPaid ? '✅ Payée Intégralement' : hasAdvance ? `⏳ Acompte : ${formatCurrency(createdOrderSummary.paidAmount)}` : '❌ Non Payée (En attente)'}
                    </Badge>
                  );
                })()}
              </div>
            </div>

            {/* Delivery & Print Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Button
                type="button"
                variant="primary"
                size="md"
                icon={createdOrderSummary.status === 'DELIVERED' ? ShieldCheck : CheckCircle2}
                disabled={createdOrderSummary.status === 'DELIVERED' || isValidatingDelivery}
                onClick={handleValidateAndDeliver}
                className={
                  createdOrderSummary.status === 'DELIVERED'
                    ? 'bg-emerald-600 hover:bg-emerald-600 cursor-default font-extrabold text-xs opacity-90'
                    : 'bg-emerald-600 hover:bg-emerald-700 font-extrabold text-xs shadow-sm'
                }
              >
                {isValidatingDelivery ? 'Validation en cours...' : createdOrderSummary.status === 'DELIVERED' ? '✓ Commande livrée' : '✓ Valider la commande'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="md"
                icon={Printer}
                onClick={handlePrintReceipt}
                className="font-bold text-xs border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                🖨 Imprimer le reçu
              </Button>
            </div>

            {/* Successive Order & Close Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="primary"
                size="lg"
                icon={Plus}
                onClick={() => {
                  resetForm();
                  setCreatedOrderSummary(null);
                }}
                className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 font-black px-6 shadow-md shadow-brand-500/20 text-xs"
              >
                + Nouvelle commande (Saisir la suivante)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleModalClose}
                className="w-full sm:w-auto font-bold text-xs"
              >
                Terminer / Fermer
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder} className="space-y-5 pt-1">
          {/* 1. Client & Priority Header */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            {/* Mode Selector & Priority */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-brand-500" />
                  Type de Client Donneur d'Ordre *
                </label>

                {/* Segmented Control */}
                <div className="grid grid-cols-2 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl max-w-md text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setClientMode('REGISTERED')}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                      clientMode === 'REGISTERED'
                        ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Client Enregistré
                  </button>

                  <button
                    type="button"
                    onClick={() => setClientMode('WALK_IN')}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                      clientMode === 'WALK_IN'
                        ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Client de Passage
                  </button>
                </div>
              </div>

              {/* Priority */}
              <div className="w-full sm:w-48">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Priorité Production
                </label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as OrderPriority)}
                  className="text-xs font-bold"
                >
                  <option value="NORMAL">🟢 Normale</option>
                  <option value="HIGH">🟠 Haute</option>
                  <option value="URGENT">🔴 Urgente (Express)</option>
                  <option value="LOW">⚪ Basse</option>
                </Select>
              </div>
            </div>

            {/* Client Selection Content */}
            {clientMode === 'REGISTERED' ? (
              <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Rechercher un client (nom, prénom, téléphone, réf. client)..."
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      className="pl-9 text-xs"
                    />
                  </div>

                  <div className="flex-1">
                    <Select
                      value={selectedPersonId}
                      onChange={(e) => setSelectedPersonId(e.target.value)}
                      className="text-xs font-semibold"
                    >
                      {filteredPersons.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName || ''} {p.phone ? `• ${p.phone}` : ''} {p.customerProfile?.customerNumber ? `(${p.customerProfile.customerNumber})` : ''}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    icon={UserPlus}
                    onClick={() => setIsCreatingNewPerson(true)}
                    className="text-xs shrink-0 font-bold"
                  >
                    + Nouveau
                  </Button>
                </div>

                {selectedPerson && (
                  <div className="p-2.5 bg-brand-50/50 dark:bg-brand-950/30 rounded-xl border border-brand-200/60 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedPerson.firstName} {selectedPerson.lastName || ''}
                      </span>
                      {selectedPerson.phone && (
                        <span className="text-slate-500 font-mono text-[11px]">
                          📞 {selectedPerson.phone}
                        </span>
                      )}
                      {selectedPerson.customerProfile?.customerNumber && (
                        <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                          {selectedPerson.customerProfile.customerNumber}
                        </Badge>
                      )}
                    </div>
                    <Badge variant="primary" size="sm" className="text-[10px]">
                      {customerType === 'COMPANY' ? '🏢 Entreprise' : customerType === 'STUDENT' ? '🎓 Étudiant' : '👤 Particulier'}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              /* WALK-IN CLIENT BANNER & OPTIONAL FIELDS */
              <div className="space-y-3 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <strong className="font-bold block">Client de passage (Vente directe au comptoir)</strong>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                      Aucune fiche client ne sera créée dans la base. La transaction, le chiffre d'affaires, le stock et la caisse seront enregistrés normalement.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      Nom / Référence libre (Facultatif)
                    </label>
                    <Input
                      type="text"
                      placeholder="ex: Client Comptoir, M. Barry, Lycée..."
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <PhoneInput
                      label="Téléphone de contact (Facultatif)"
                      placeholder="ex: +224 6XX XX XX XX"
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Multi-Lines Container */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-brand-500" />
                Lignes du Dossier Commercial ({lines.length})
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={Plus}
                  onClick={handleAddServiceLine}
                  className="text-xs font-bold text-brand-600 border-brand-300 hover:bg-brand-50"
                >
                  + Prestation
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={Store}
                  onClick={handleAddProductLine}
                  className="text-xs font-bold text-amber-600 border-amber-300 hover:bg-amber-50"
                >
                  + Fourniture Boutique
                </Button>
              </div>
            </div>

            {/* Stock Health Synthesis Banner */}
            {stockEvaluations.length > 0 && (
              <div className="space-y-2">
                {stockStatusSummary.hasInsufficient && (
                  <div className="p-3.5 bg-rose-500/10 border-2 border-rose-500/30 rounded-2xl text-xs text-rose-900 dark:text-rose-200 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-extrabold text-sm block text-rose-700 dark:text-rose-300">
                            ⚠️ Stock Insuffisant — Ravitaillement Nécessaire ({stockStatusSummary.insufficientItems.length} article(s))
                          </strong>
                          <p className="text-xs text-rose-800/90 dark:text-rose-300/90 mt-0.5">
                            Cette commande ne peut pas être exécutée correctement sans réapprovisionnement préalable auprès d'un fournisseur.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        icon={Truck}
                        onClick={() => handleOpenRestockPO(stockStatusSummary.insufficientItems)}
                        className="bg-rose-600 hover:bg-rose-700 font-bold shrink-0 shadow-sm"
                      >
                        Passer une commande fournisseur
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                      {stockStatusSummary.insufficientItems.map(item => (
                        <div key={item.productId} className="p-2.5 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-rose-200 dark:border-rose-900/60 text-[11px] space-y-1">
                          <strong className="block text-slate-900 dark:text-white font-bold truncate">
                            {item.productName}
                          </strong>
                          <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>Besoin : <strong>{item.totalRequired} {item.stockUnit}</strong></span>
                            <span>Dispo : <strong>{item.currentStock} {item.stockUnit}</strong></span>
                          </div>
                          <div className="flex justify-between text-rose-600 font-bold">
                            <span>Manquant :</span>
                            <span>{item.missingQty} {item.stockUnit}</span>
                          </div>
                          {item.recommendedPurchaseQty > 0 && (
                            <div className="text-[10px] text-brand-600 dark:text-brand-400 border-t border-slate-100 dark:border-slate-800 pt-1 flex justify-between">
                              <span>Achat suggéré :</span>
                              <span className="font-bold">{item.recommendedPurchaseQty} {item.purchaseUnit}(s)</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!stockStatusSummary.hasInsufficient && stockStatusSummary.hasRestockInProgress && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Ravitaillement en cours :</strong> Une ou plusieurs commandes fournisseurs ouvertes couvrent les besoins en stock de ce dossier commercial.
                      </span>
                    </div>
                    <Badge variant="warning" size="sm" className="shrink-0 font-mono">
                      BC en attente
                    </Badge>
                  </div>
                )}

                {!stockStatusSummary.hasInsufficient && stockStatusSummary.hasLowStock && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Stock faible :</strong> La commande passera sous le seuil d'alerte ({stockStatusSummary.lowStockItems.map(i => `${i.productName}: reste ${i.remainingStockAfter}/${i.minStockAlert}`).join(', ')}).
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={Truck}
                      onClick={() => handleOpenRestockPO(stockStatusSummary.lowStockItems)}
                      className="text-xs font-bold text-amber-700 border-amber-300 hover:bg-amber-100 shrink-0"
                    >
                      Ravitailler le stock
                    </Button>
                  </div>
                )}

                {stockStatusSummary.allSufficient && (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Disponibilité vérifiée :</strong> Tous les articles et consommations internes sont couverts par le stock disponible.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Render Each Line */}
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {calculatedLines.map((line, idx) => {
                const isService = line.itemType === 'SERVICE';

                return (
                  <div
                    key={line.id}
                    className="p-4 bg-white dark:bg-slate-950 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                  >
                    {/* Line Header */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isService ? 'primary' : 'warning'}
                          size="sm"
                          className="font-bold text-[10px]"
                        >
                          {isService ? '🛠️ Prestation' : '🛒 Boutique / Stock'}
                        </Badge>
                        <span className="text-xs font-bold text-slate-500">
                          Ligne #{idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          Total : {formatCurrency(line.netTotal)}
                        </span>
                        {lines.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() => handleRemoveLine(idx)}
                            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700"
                            title="Supprimer cette ligne"
                          />
                        )}
                      </div>
                    </div>

                    {/* Selector & Quantity Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      {isService ? (
                        <div className="sm:col-span-12 space-y-3">
                          {/* Visual Prestation / Service Cards Selection */}
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span>🛠️</span> Prestation / Service *
                              </label>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {(tenantServices.length > 0 ? tenantServices : state.services.filter(s => s.isActive)).length} prestation(s) disponible(s)
                              </span>
                            </div>

                            {/* Service Cards Responsive Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                              {(tenantServices.length > 0 ? tenantServices : state.services.filter(s => s.isActive)).map((srv) => {
                                const isSelected = line.serviceId === srv.id;
                                const visuals = getServiceVisuals(srv);

                                return (
                                  <button
                                    key={srv.id}
                                    type="button"
                                    onClick={() => {
                                      const autoDept = getDepartmentForService(srv);
                                      const specGroups = getServiceSpecificationGroups(srv);
                                      const defaultNotes = specGroups.map(g => {
                                        const def = g.defaultValue || resolveSpecOption(g.options[0])?.name || '';
                                        return `${g.name}: ${def}`;
                                      }).join(' | ');
                                      handleUpdateLine(idx, {
                                        serviceId: srv.id,
                                        unit: srv.unit,
                                        assignedDepartment: autoDept || line.assignedDepartment,
                                        notes: defaultNotes,
                                      });
                                    }}
                                    className={`relative flex flex-col justify-between p-3 rounded-xl border-2 text-left transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-brand-500/50 cursor-pointer ${
                                      isSelected
                                        ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 shadow-sm ring-2 ring-brand-500/20 scale-[1.01]'
                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-brand-300 dark:hover:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-900 hover:shadow-xs'
                                    }`}
                                  >
                                    {/* Selected Badge Checkmark */}
                                    {isSelected && (
                                      <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white shadow-xs">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                      </span>
                                    )}

                                    {/* Icon & Category Tag */}
                                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                      <span className="text-2xl leading-none select-none filter drop-shadow-xs">
                                        {visuals.icon}
                                      </span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border truncate max-w-[85px] ${visuals.badgeColor}`}>
                                        {visuals.categoryTag}
                                      </span>
                                    </div>

                                    {/* Service Name */}
                                    <div className="mt-1 flex-1">
                                      <span className={`block text-xs leading-snug line-clamp-2 ${
                                        isSelected ? 'text-brand-950 dark:text-brand-100 font-extrabold' : 'text-slate-800 dark:text-slate-200 font-bold'
                                      }`}>
                                        {srv.name}
                                      </span>
                                    </div>

                                    {/* Price & Unit Pill */}
                                    <div className="mt-2.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                                      <span className="font-black text-brand-600 dark:text-brand-400">
                                        {formatCurrency(srv.basePrice)}
                                      </span>
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                                        / {srv.unit}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Dynamic Parameters & Specifications for Selected Service (Horizontal Dropdowns) */}
                          {line.service && (() => {
                            const srv = line.service;
                            const specGroups = getServiceSpecificationGroups(srv);
                            const specsImpact = resolveServiceSpecsImpact(srv, line.notes, state.products);

                            // Helper to extract or fallback the current selected value for a group
                            const getGroupValue = (group: ServiceSpecificationGroup) => {
                              const currentNotes = line.notes || '';
                              const regex = new RegExp(`${group.name}\\s*:\\s*([^|\\n,]+)`, 'i');
                              const match = currentNotes.match(regex);
                              const optNames = group.options.map(o => resolveSpecOption(o).name);
                              if (match && match[1]) {
                                const found = match[1].trim();
                                if (optNames.some(n => n.toLowerCase() === found.toLowerCase())) {
                                  return optNames.find(n => n.toLowerCase() === found.toLowerCase()) || found;
                                }
                              }
                              return group.defaultValue || optNames[0] || '';
                            };

                            const handleGroupChange = (groupName: string, newValue: string) => {
                              const currentNotes = line.notes || '';
                              const regex = new RegExp(`(${groupName}\\s*:\\s*)([^|\\n,]+)`, 'i');
                              let updated = '';
                              if (regex.test(currentNotes)) {
                                updated = currentNotes.replace(regex, `$1${newValue}`);
                              } else {
                                updated = currentNotes ? `${currentNotes} | ${groupName}: ${newValue}` : `${groupName}: ${newValue}`;
                              }
                              handleUpdateLine(idx, { notes: updated });
                            };

                            return (
                              <div className="p-3 bg-slate-50/90 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                                  <div className="flex items-center gap-2">
                                    <Settings2 className="w-4 h-4 text-brand-500" />
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                                      Paramètres & Spécifications de la prestation
                                    </span>
                                    <Badge variant="primary" size="sm" className="font-bold text-[10px]">
                                      Tarif : {formatCurrency(specsImpact.standardUnitPrice)} / {srv.unit}
                                    </Badge>
                                  </div>

                                  {srv.estimatedDurationMinutes > 0 && (
                                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      Délai estimé : <strong>~{srv.estimatedDurationMinutes} min</strong>
                                    </span>
                                  )}
                                </div>

                                {/* Horizontal Dropdowns Grid */}
                                {specGroups.length > 0 && (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                                    {specGroups.map((group) => {
                                      const val = getGroupValue(group);
                                      return (
                                        <div key={group.name} className="space-y-1">
                                          <label className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 block uppercase tracking-wider truncate">
                                            {group.name} :
                                          </label>
                                          <Select
                                            value={val}
                                            onChange={(e) => handleGroupChange(group.name, e.target.value)}
                                            className="text-xs h-8 bg-white dark:bg-slate-950 font-bold border-slate-200 dark:border-slate-700 shadow-2xs"
                                          >
                                            {group.options.map((optRaw) => {
                                              const opt = resolveSpecOption(optRaw);
                                              let label = opt.name;
                                              if (opt.unitPrice !== undefined && opt.unitPrice > 0) {
                                                label += ` (${formatCurrency(opt.unitPrice)})`;
                                              } else if (opt.priceAdjustment !== undefined && opt.priceAdjustment !== 0) {
                                                label += ` (${opt.priceAdjustment > 0 ? '+' : ''}${formatCurrency(opt.priceAdjustment)})`;
                                              }
                                              return (
                                                <option key={opt.name} value={opt.name}>
                                                  {label}
                                                </option>
                                              );
                                            })}
                                          </Select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Consumable linked badges indicator with Recto-verso sheet conversion */}
                                {specsImpact.consumables.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500">
                                    <span className="font-semibold text-slate-600 dark:text-slate-400">📦 Consommables associés :</span>
                                    {specsImpact.consumables.map((c, cIdx) => {
                                      const effectiveQty = calculateEffectiveServiceConsumableQty(srv, line, c);
                                      return (
                                        <span key={cIdx} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-md font-medium text-[10px]">
                                          {c.productName} ({effectiveQty} {c.unit})
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* File Requirement Notice if applicable */}
                                {srv.requiresFile && (
                                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between gap-2 text-[11px] text-amber-900 dark:text-amber-200">
                                    <span className="flex items-center gap-1.5 font-medium">
                                      <Paperclip className="w-3.5 h-3.5 text-amber-600" />
                                      <span><strong>Fichier requis :</strong> Cette prestation nécessite le document ou fichier numérique du client.</span>
                                    </span>
                                    <span className="text-[10px] bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded font-bold shrink-0">
                                      Fichier à fournir
                                    </span>
                                  </div>
                                )}

                                {/* Instructions for workshop / custom notes */}
                                <div>
                                  <Input
                                    type="text"
                                    placeholder="Instructions ou détails supplémentaires pour l'atelier (ex: recto-verso, reliure spirale noire...)"
                                    value={line.notes || ''}
                                    onChange={(e) => handleUpdateLine(idx, { notes: e.target.value })}
                                    className="text-xs h-8 bg-white dark:bg-slate-950"
                                  />
                                </div>
                              </div>
                            );
                          })()}

                          {/* Quantity & Pôle Grid for Service */}
                          {(() => {
                            const srv = state.services.find(s => s.id === line.serviceId) || tenantServices.find(s => s.id === line.serviceId);
                            const srvName = (srv?.name || '').toLowerCase();
                            const isPageBased = (
                              (line.unit || '').toLowerCase() === 'page' ||
                              (line.unit || '').toLowerCase() === 'feuille' ||
                              srvName.includes('photocopi') ||
                              srvName.includes('impress') ||
                              srvName.includes('scan') ||
                              srvName.includes('tirage')
                            );

                            if (isPageBased) {
                              const pages = line.pageCount ?? 1;
                              const copies = line.copiesCount ?? 1;
                              const totalPages = pages * copies;

                              return (
                                <div className="space-y-2 pt-1">
                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                                    {/* Pages du document */}
                                    <div className="sm:col-span-6">
                                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
                                        📄 Pages du document *
                                      </label>
                                      <div className="flex items-center gap-1.5">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleUpdateLine(idx, { pageCount: Math.max(1, pages - 1) })}
                                          className="h-11 w-11 p-0 shrink-0 text-lg font-black border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                        >
                                          -
                                        </Button>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={pages}
                                          onChange={(e) => handleUpdateLine(idx, { pageCount: parseInt(e.target.value) || 1 })}
                                          className="h-11 text-center text-base sm:text-lg font-black border-slate-300 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleUpdateLine(idx, { pageCount: pages + 1 })}
                                          className="h-11 w-11 p-0 shrink-0 text-lg font-black border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                        >
                                          +
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Nombre d'exemplaires */}
                                    <div className="sm:col-span-6">
                                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
                                        📑 Nombre d'exemplaires *
                                      </label>
                                      <div className="flex items-center gap-1.5">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleUpdateLine(idx, { copiesCount: Math.max(1, copies - 1) })}
                                          className="h-11 w-11 p-0 shrink-0 text-lg font-black border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                        >
                                          -
                                        </Button>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={copies}
                                          onChange={(e) => handleUpdateLine(idx, { copiesCount: parseInt(e.target.value) || 1 })}
                                          className="h-11 text-center text-base sm:text-lg font-black border-slate-300 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleUpdateLine(idx, { copiesCount: copies + 1 })}
                                          className="h-11 w-11 p-0 shrink-0 text-lg font-black border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                        >
                                          +
                                        </Button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Dynamic Live Calculation Card */}
                                  {(() => {
                                    const isRectoVerso = (line.notes || '').toLowerCase().includes('recto-verso') || (line.notes || '').toLowerCase().includes('recto verso');
                                    const sheetsPerCopy = isRectoVerso ? Math.ceil(pages / 2) : pages;
                                    const totalSheets = sheetsPerCopy * copies;

                                    return (
                                      <div className="p-2.5 bg-brand-50/80 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-extrabold text-brand-700 dark:text-brand-300 flex items-center gap-1">
                                            🧮 Total à produire :
                                          </span>
                                          <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {pages} page(s) × {copies} ex. = <strong className="text-brand-600 dark:text-brand-400 font-black text-sm">{totalPages} {line.unit}s au total</strong>
                                            {isRectoVerso && (
                                              <span className="ml-1.5 px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-md font-extrabold text-[11px]">
                                                📄 {totalSheets} feuille(s) en Recto-verso ({sheetsPerCopy} f./ex.)
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-medium">
                                          Tarif : {totalPages} × {formatCurrency(line.appliedUnitPrice)} = <span className="font-black text-slate-900 dark:text-white">{formatCurrency(line.netTotal)}</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            }

                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                                {/* Quantity Selection */}
                                <div className="sm:col-span-12">
                                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
                                    Quantité ({line.unit}) *
                                  </label>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUpdateLine(idx, { quantity: Math.max(1, line.quantity - 1) })}
                                      className="h-11 w-11 p-0 shrink-0 text-lg font-black border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                    >
                                      -
                                    </Button>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={line.quantity}
                                      onChange={(e) => handleUpdateLine(idx, { quantity: parseInt(e.target.value) || 1 })}
                                      className="h-11 text-center text-base sm:text-lg font-black border-slate-300 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUpdateLine(idx, { quantity: line.quantity + 1 })}
                                      className="h-11 w-11 p-0 shrink-0 text-lg font-black border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                    >
                                      +
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <>
                          <div className="sm:col-span-6">
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              Article de Stock / Boutique *
                            </label>
                            <Select
                              value={line.productId}
                              onChange={(e) => handleUpdateLine(idx, { productId: e.target.value })}
                              className="text-xs"
                            >
                              {state.products.filter(p => p.isActive).map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} — Dispo : {p.currentStock} {p.unit}s
                                </option>
                              ))}
                            </Select>
                          </div>

                          {/* Quantity & Unit Selection */}
                          <div className="sm:col-span-3">
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              Quantité ({line.unit}) *
                            </label>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateLine(idx, { quantity: Math.max(1, line.quantity - 1) })}
                                className="h-8 w-8 p-0 shrink-0"
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={(e) => handleUpdateLine(idx, { quantity: parseInt(e.target.value) || 1 })}
                                className="h-8 text-center text-xs font-bold"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateLine(idx, { quantity: line.quantity + 1 })}
                                className="h-8 w-8 p-0 shrink-0"
                              >
                                +
                              </Button>
                            </div>
                          </div>

                          {/* Packaging / Unit */}
                          <div className="sm:col-span-3">
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              Conditionnement
                            </label>
                            <div className="flex items-center gap-1 pt-1">
                              <label className="text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.usePurchaseUnit}
                                  onChange={(e) => handleUpdateLine(idx, { usePurchaseUnit: e.target.checked })}
                                  className="rounded text-brand-600"
                                />
                                Vente en Carton
                              </label>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Product Live Stock Status Pill */}
                      {line.product && (() => {
                        const evalItem = stockEvaluations.find(e => e.productId === line.productId);
                        if (!evalItem) return null;

                        return (
                          <div className="sm:col-span-12">
                            <div className="p-2 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/50">
                              <div className="flex items-center gap-2">
                                <Boxes className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-slate-600 dark:text-slate-400">
                                  Stock actuel : <strong>{evalItem.currentStock} {evalItem.stockUnit}</strong>
                                </span>
                                <span>•</span>
                                <span className="text-slate-600 dark:text-slate-400">
                                  Sortie prévue : <strong>{line.stockDeduction || line.quantity} {evalItem.stockUnit}</strong>
                                </span>
                              </div>

                              <div>
                                {evalItem.status === 'INSUFFICIENT' && (
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="danger" size="sm" className="font-bold text-[10px]">
                                      🔴 Insuffisant (Manque {evalItem.missingQty} {evalItem.stockUnit})
                                    </Badge>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRestockPO([evalItem])}
                                      className="text-[11px] text-rose-600 hover:underline font-bold flex items-center gap-0.5 ml-1"
                                    >
                                      <Truck className="w-3 h-3" /> Commander
                                    </button>
                                  </div>
                                )}
                                {evalItem.status === 'RESTOCK_IN_PROGRESS' && (
                                  <Badge variant="warning" size="sm" className="font-bold text-[10px]">
                                    ⚠️ Ravitaillement en cours (+{evalItem.pendingIncomingQty} attendus)
                                  </Badge>
                                )}
                                {evalItem.status === 'LOW_STOCK' && (
                                  <Badge variant="warning" size="sm" className="font-bold text-[10px]">
                                    🟠 Stock faible après commande (Reste {evalItem.remainingStockAfter})
                                  </Badge>
                                )}
                                {evalItem.status === 'SUFFICIENT' && (
                                  <Badge variant="success" size="sm" className="font-bold text-[10px]">
                                    🟢 Stock suffisant
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Service Internal Consumptions Pill */}
                      {isService && (() => {
                        const srv = line.service;
                        if (!srv) return null;
                        const consumableConfigs = srv.consumables && srv.consumables.length > 0
                          ? srv.consumables.map(c => ({
                              productId: c.productId,
                              quantityPerUnit: c.quantityPerUnit,
                              isClientSupplied: c.isClientSupplied
                            }))
                          : (srv.consumptions || []).map(c => ({
                              productId: c.productId,
                              quantityPerUnit: c.quantity,
                              isClientSupplied: false
                            }));

                        if (consumableConfigs.length === 0) return null;

                        return (
                          <div className="sm:col-span-12">
                            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs bg-slate-50 dark:bg-slate-900/50 space-y-1.5">
                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 font-semibold text-[11px]">
                                <span className="flex items-center gap-1.5">
                                  <Wrench className="w-3.5 h-3.5 text-brand-500" />
                                  <span>Consommables internes requis pour {line.quantity} {line.unit} :</span>
                                </span>
                                <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium">
                                  Stock Consommables Prestations
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {consumableConfigs.map(c => {
                                  if (c.isClientSupplied) return null;
                                  const prod = state.products.find(p => p.id === c.productId);
                                  if (!prod) return null;
                                  const required = Number((line.quantity * c.quantityPerUnit).toFixed(4));
                                  const evalItem = stockEvaluations.find(e => e.productId === prod.id);
                                  const isMissing = evalItem?.status === 'INSUFFICIENT';

                                  return (
                                    <div
                                      key={c.productId}
                                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 ${
                                        isMissing
                                          ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 font-bold'
                                          : 'bg-white border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 shadow-sm'
                                      }`}
                                    >
                                      <span>{prod.name} : <strong>{required} {prod.stockUnit || prod.unit}</strong></span>
                                      {isMissing ? (
                                        <span className="text-rose-600 font-extrabold flex items-center gap-1">
                                          (🔴 Manque {evalItem?.missingQty})
                                          <button
                                            type="button"
                                            onClick={() => handleOpenRestockPO(evalItem ? [evalItem] : undefined)}
                                            className="underline hover:text-rose-800"
                                          >
                                            BC
                                          </button>
                                        </span>
                                      ) : (
                                        <span className="text-emerald-600 font-bold">(🟢 Stock Atelier : {prod.prestationStock !== undefined ? prod.prestationStock : prod.currentStock})</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Custom Unit Price & Discount Box */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Tarif normal de référence :</span>
                          <strong className="text-slate-700 dark:text-slate-300">
                            {formatCurrency(line.standardUnitPrice)} / {line.unit}
                          </strong>
                        </div>

                        <label className="flex items-center gap-2 font-bold text-brand-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={line.isCustomPrice}
                            onChange={(e) => {
                              handleUpdateLine(idx, {
                                isCustomPrice: e.target.checked,
                                customUnitPrice: e.target.checked ? line.standardUnitPrice : undefined
                              });
                            }}
                            className="rounded text-brand-600"
                          />
                          Appliquer un Tarif Personnalisé
                        </label>
                      </div>

                      {/* Custom Price Fields */}
                      {line.isCustomPrice && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                          <div className="sm:col-span-4">
                            <label className="text-[10px] font-bold text-brand-700 dark:text-brand-300 block mb-1">
                              Nouveau Tarif Unitaire Appliqué (GNF) *
                            </label>
                            <Input
                              type="number"
                              min="0"
                              value={line.customUnitPrice ?? line.standardUnitPrice}
                              onChange={(e) => handleUpdateLine(idx, { customUnitPrice: parseInt(e.target.value) || 0 })}
                              className="text-xs font-bold text-brand-600 h-8"
                            />
                          </div>

                          <div className="sm:col-span-4">
                            <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              Motif Obligatoire de la Remise *
                            </label>
                            <Select
                              value={line.discountReasonCategory}
                              onChange={(e) => handleUpdateLine(idx, { discountReasonCategory: e.target.value as any })}
                              className="text-xs h-8"
                            >
                              <option value="COMMERCIAL_NEGOTIATION">Négociation commerciale</option>
                              <option value="VOLUME">Gros volume</option>
                              <option value="LOYALTY">Client fidèle</option>
                              <option value="INSTITUTIONAL">Client institutionnel / Partenaire</option>
                              <option value="PROMOTION">Offre promotionnelle</option>
                              <option value="OTHER">Autre motif</option>
                            </Select>
                          </div>

                          {line.discountReasonCategory === 'OTHER' && (
                            <div className="sm:col-span-4">
                              <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                Précisez le motif *
                              </label>
                              <Input
                                type="text"
                                placeholder="ex: Accord direction..."
                                value={line.discountReasonCustom}
                                onChange={(e) => handleUpdateLine(idx, { discountReasonCustom: e.target.value })}
                                className="text-xs h-8"
                              />
                            </div>
                          )}

                          {line.discountAmount > 0 && (
                            <div className="sm:col-span-12 flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
                              <span>
                                Remise calculée : <strong>{formatCurrency(line.discountAmount)}</strong> ({line.discountPercent}%)
                              </span>
                              {!line.permCheck.allowed && (
                                <span className="font-bold text-amber-700 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  ⚠️ Remise importante &gt; limite autorisée
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Global Financial Summary & Payment Configuration */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-4 shadow-xl border border-slate-800">
            {/* Financial Totals Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-b border-slate-800 pb-3">
              <div>
                <span className="text-slate-400 block text-[11px]">Sous-Total Brut</span>
                <strong className="text-slate-200">{formatCurrency(totals.grossSubtotal)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Total Remises</span>
                <strong className="text-emerald-400">-{formatCurrency(totals.totalDiscount)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Total Net à Payer</span>
                <strong className="text-base font-black text-brand-400">{formatCurrency(totals.totalAmount)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Reste à Payer (Créance)</span>
                <strong className={`text-base font-black ${totals.dueAmount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatCurrency(totals.dueAmount)}
                </strong>
              </div>
            </div>

            {/* Payment Situation Choice: 3 Options */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-2">
                Situation du Paiement à la Création *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Option 1: NON PAYÉ */}
                <div
                  onClick={() => setPaymentOption('UNPAID')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    paymentOption === 'UNPAID'
                      ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-amber-300">1. Non Payé</span>
                    <input
                      type="radio"
                      name="paymentOption"
                      checked={paymentOption === 'UNPAID'}
                      onChange={() => setPaymentOption('UNPAID')}
                      className="text-amber-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    0 GNF versé • Créance client intégrale ({formatCurrency(totals.totalAmount)})
                  </p>
                </div>

                {/* Option 2: PAYÉ EN TOTALITÉ */}
                <div
                  onClick={() => setPaymentOption('FULL')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    paymentOption === 'FULL'
                      ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
                      : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-emerald-300">2. Payé en Totalité</span>
                    <input
                      type="radio"
                      name="paymentOption"
                      checked={paymentOption === 'FULL'}
                      onChange={() => setPaymentOption('FULL')}
                      className="text-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {formatCurrency(totals.totalAmount)} versé • 0 GNF de dette restante
                  </p>
                </div>

                {/* Option 3: PAIEMENT PARTIEL */}
                <div
                  onClick={() => {
                    setPaymentOption('PARTIAL');
                    if (partialAmount === 0) {
                      setPartialAmount(Math.round(totals.totalAmount / 2));
                    }
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    paymentOption === 'PARTIAL'
                      ? 'bg-brand-950/40 border-brand-500 ring-1 ring-brand-500'
                      : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-brand-300">3. Paiement Partiel</span>
                    <input
                      type="radio"
                      name="paymentOption"
                      checked={paymentOption === 'PARTIAL'}
                      onChange={() => {
                        setPaymentOption('PARTIAL');
                        if (partialAmount === 0) {
                          setPartialAmount(Math.round(totals.totalAmount / 2));
                        }
                      }}
                      className="text-brand-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Avance / Acompte • Reste dû en créance
                  </p>
                </div>
              </div>
            </div>

            {/* If PARTIAL: Amount input with quick buttons */}
            {paymentOption === 'PARTIAL' && (
              <div className="p-3 bg-slate-800/90 rounded-xl border border-brand-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-brand-300">
                    Montant Versé / Acompte (GNF) *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPartialAmount(Math.round(totals.totalAmount * 0.25))}
                      className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-300 font-bold"
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartialAmount(Math.round(totals.totalAmount * 0.50))}
                      className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-300 font-bold"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartialAmount(Math.round(totals.totalAmount * 0.75))}
                      className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-300 font-bold"
                    >
                      75%
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <Input
                    type="number"
                    min="0"
                    max={totals.totalAmount}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(parseInt(e.target.value) || 0)}
                    className="font-black text-base text-slate-900 bg-white"
                  />
                  <div className="text-xs text-slate-300 flex items-center justify-between p-2 bg-slate-900/60 rounded-lg">
                    <span>Créance restante :</span>
                    <strong className="text-amber-400 font-mono font-bold text-sm">
                      {formatCurrency(totals.dueAmount)}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method & Destination Account (Only when paymentAmount > 0) */}
            {paymentAmount > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Mode de Règlement *
                  </label>
                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="text-xs font-semibold text-slate-900 bg-white"
                  >
                    <option value="CASH">💵 Espèces (Caisse physique)</option>
                    <option value="ORANGE_MONEY">📱 Orange Money</option>
                    <option value="MTN_MOMO">📱 MTN MoMo</option>
                    <option value="BANK_TRANSFER">🏦 Virement Bancaire</option>
                    <option value="CARD">💳 Carte Bancaire</option>
                    <option value="CHECK">📑 Chèque</option>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Compte Financier de Destination *
                  </label>
                  <Select
                    value={effectiveFinancialAccountId}
                    onChange={(e) => setSelectedFinancialAccountId(e.target.value)}
                    className="text-xs font-semibold text-slate-900 bg-white"
                  >
                    {tenantAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type}) — Solde : {formatCurrency(acc.currentBalance || 0)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}

            {/* Additional Details: Due Date & Instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Date de Livraison Prévue
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Référence / Note de Paiement (Facultatif)
                </label>
                <Input
                  type="text"
                  placeholder="ex: Reçu OM #94827 / Chèque N°..."
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="text-xs text-slate-900 bg-white"
                />
              </div>
            </div>

            {/* Cash Warning if Closed */}
            {paymentAmount > 0 && (paymentMethod === 'CASH' || effectiveFinancialAccount?.type === 'CASH') && !activeCashSession && (
              <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs text-amber-200">
                <span className="flex items-center gap-1.5 font-bold">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Caisse principale fermée. Ouvrez la caisse pour enregistrer ce paiement en espèces.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => setIsOpenCashModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-xs font-bold"
                >
                  Ouvrir Caisse
                </Button>
              </div>
            )}
          </div>

          {/* 4. Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={handleModalClose}>
              Annuler
            </Button>
            <Button
              variant="primary"
              icon={CheckCircle2}
              type="submit"
              disabled={isSubmitting || calculatedLines.some(l => l.permCheck?.allowed === false)}
              className="bg-brand-600 hover:bg-brand-700 font-extrabold px-6"
            >
              {isSubmitting ? 'Création du dossier en cours...' : 'Créer le Dossier Commercial & Valider'}
            </Button>
          </div>
        </form>
        )}
      </Modal>

      {/* Modal: New Client Quick Creation */}
      {isCreatingNewPerson && (
        <Modal
          isOpen={isCreatingNewPerson}
          onClose={() => setIsCreatingNewPerson(false)}
          title="Création Rapide d'un Client"
          maxWidth="sm"
        >
          <div className="space-y-4 pt-1">
            <Input
              label="Nom / Raison Sociale *"
              placeholder="ex: Entreprise GSB / M. Bah"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              required
            />
            <PhoneInput
              label="Téléphone"
              placeholder="+224 ..."
              value={newPersonPhone}
              onChange={(e) => setNewPersonPhone(e.target.value)}
            />
            <Select
              label="Type de Client"
              value={newPersonType}
              onChange={(e) => setNewPersonType(e.target.value as any)}
            >
              <option value="ALL">Particulier Standard</option>
              <option value="COMPANY">Entreprise / Institution</option>
              <option value="STUDENT">Étudiant / Apprenant</option>
            </Select>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsCreatingNewPerson(false)}>
                Annuler
              </Button>
              <Button variant="primary" onClick={handleCreateNewPerson} className="font-bold">
                Enregistrer Client
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Open Cash */}
      {isOpenCashModalOpen && (
        <OpenCashModal
          isOpen={isOpenCashModalOpen}
          onClose={() => setIsOpenCashModalOpen(false)}
          onSuccess={() => {
            setIsOpenCashModalOpen(false);
            showToast('Caisse Ouverte', 'Vous pouvez maintenant valider le paiement.', 'SUCCESS');
          }}
        />
      )}

      {/* Modal: Express Supplier Restock PO */}
      {isRestockPOModalOpen && (
        <Modal
          isOpen={isRestockPOModalOpen}
          onClose={() => setIsRestockPOModalOpen(false)}
          title="Ravitaillement Express — Émettre un Bon de Commande Fournisseur"
          maxWidth="3xl"
        >
          <form onSubmit={handleCreateRestockPO} className="space-y-4 pt-1">
            <div className="p-3 bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 rounded-xl text-xs text-brand-900 dark:text-brand-200 flex items-start gap-2">
              <Truck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block">Création d'un Bon de Commande Fournisseur (BC)</strong>
                <p className="text-[11px] text-brand-800/80 dark:text-brand-300/80 mt-0.5">
                  Les articles nécessaires pour exécuter la commande client ont été automatiquement préchargés ci-dessous avec leurs quantités et conditionnements d'achat recommandés. Votre commande client reste 100% conservée.
                </p>
              </div>
            </div>

            {/* Supplier & Department Selection Header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Fournisseur Partenaire *
                </label>
                <Select
                  value={restockSupplierId}
                  onChange={(e) => setRestockSupplierId(e.target.value)}
                  className="text-xs font-semibold"
                  required
                >
                  <option value="">Sélectionner un fournisseur...</option>
                  {state.suppliers.filter(s => s.isActive !== false).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Service / Atelier Demandeur (Facultatif)
                </label>
                <Select
                  value={restockDepartmentId}
                  onChange={(e) => setRestockDepartmentId(e.target.value)}
                  className="text-xs"
                >
                  <option value="">-- Aucun / Stock Général --</option>
                  {(state.requestingDepartments || []).filter(d => d.isActive && !d.isArchived).map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Restock Lines Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Articles à Commander ({restockLines.length})</span>
                <span>Total Estimé : {formatCurrency(restockLines.reduce((sum, l) => sum + l.totalPrice, 0))}</span>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
                {restockLines.map((line, idx) => (
                  <div key={line.productId} className="p-3 bg-white dark:bg-slate-950 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong className="text-slate-900 dark:text-white font-bold">{line.productName}</strong>
                        <span className="text-[11px] text-slate-400 font-mono ml-2">({line.productCode})</span>
                      </div>
                      {restockLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRestockLines(prev => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 text-xs"
                          title="Retirer cet article"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Quantité Achat ({line.purchaseUnitName})</label>
                        <Input
                          type="number"
                          min="1"
                          value={line.orderedQuantityPurchaseUnit}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setRestockLines(prev => {
                              const copy = [...prev];
                              copy[idx] = {
                                ...copy[idx],
                                orderedQuantityPurchaseUnit: val,
                                quantityInStockUnit: val * copy[idx].conversionFactor,
                                totalPrice: val * copy[idx].unitPricePurchaseUnit,
                              };
                              return copy;
                            });
                          }}
                          className="h-7 text-xs font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Prix Achat / {line.purchaseUnitName} (GNF)</label>
                        <Input
                          type="number"
                          min="0"
                          value={line.unitPricePurchaseUnit}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setRestockLines(prev => {
                              const copy = [...prev];
                              copy[idx] = {
                                ...copy[idx],
                                unitPricePurchaseUnit: val,
                                unitPriceStockUnit: copy[idx].conversionFactor > 0 ? val / copy[idx].conversionFactor : val,
                                totalPrice: copy[idx].orderedQuantityPurchaseUnit * val,
                              };
                              return copy;
                            });
                          }}
                          className="h-7 text-xs font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Entrée Stock Estimée</label>
                        <div className="h-7 px-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center text-[11px] font-mono">
                          {line.quantityInStockUnit} {line.baseUnit}s
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Sous-Total</label>
                        <div className="h-7 px-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center text-[11px] font-bold text-brand-600">
                          {formatCurrency(line.totalPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                Instructions ou Notes pour le Bon de Commande
              </label>
              <Input
                type="text"
                placeholder="ex: Livraison express urgente pour client..."
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRestockPOModalOpen(false)}
                className="w-full sm:w-auto text-xs"
              >
                Retour à la commande client
              </Button>

              <Button
                type="submit"
                variant="primary"
                icon={CheckCircle2}
                className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 font-extrabold text-xs"
              >
                Émettre le Bon de Commande Fournisseur ({formatCurrency(restockLines.reduce((sum, l) => sum + l.totalPrice, 0))})
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Receipt Printing */}
      {receiptPayment && (
        <PaymentReceiptModal
          payment={receiptPayment}
          order={receiptOrder}
          onClose={() => {
            setReceiptPayment(null);
            setReceiptOrder(null);
          }}
        />
      )}
    </>
  );
};
