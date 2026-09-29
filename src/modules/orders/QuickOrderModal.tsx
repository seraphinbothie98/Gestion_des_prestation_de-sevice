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
  Printer, ShieldCheck, X, SlidersHorizontal
} from 'lucide-react';
import { OpenCashModal } from '../cash/OpenCashModal';
import { PaymentReceiptModal } from './PaymentReceiptModal';
import { calculateOrderStockRequirements, evaluateOrderStock, StockEvaluation, resolveProductPurchasePrice, calculateEffectiveServiceConsumableQty } from '../../lib/stockEngine';
import {
  getServiceSpecificationGroups,
  resolveSpecOption,
  getSelectedSpecOption,
  resolveServiceSpecsImpact,
  getServiceOptions,
  canonicalOptionKey,
  canonicalOptionValue
} from '../../lib/serviceSpecs';
import { formatReceiptItemDetails } from '../../lib/orderItemUtils';

export { getServiceSpecificationGroups, resolveSpecOption, getSelectedSpecOption, resolveServiceSpecsImpact };

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

export const isPhotocopieLine = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE') return false;
  const name = (line.name || '').toLowerCase();
  const code = (line.service?.code || '').toLowerCase();
  return (name.includes('photocopie') || code.includes('photo')) && !name.includes('planche') && !name.includes('identité');
};

export const isImpressionLine = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE') return false;
  const name = (line.name || '').toLowerCase();
  const code = (line.service?.code || '').toLowerCase();
  return (name.includes('impression') || code.includes('imp')) && !isPhotocopieLine(line);
};

export const isReliureLine = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE') return false;
  const name = (line.name || '').toLowerCase();
  const code = (line.service?.code || '').toLowerCase();
  return name.includes('reliure') || code.includes('rel');
};

export const isPlastificationLine = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE') return false;
  const name = (line.name || '').toLowerCase();
  const code = (line.service?.code || '').toLowerCase();
  return name.includes('plastif') || code.includes('plast');
};

export const isScanLine = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE') return false;
  const name = (line.name || '').toLowerCase();
  const code = (line.service?.code || '').toLowerCase();
  return name.includes('numéris') || name.includes('numeris') || name.includes('scan');
};

export const isPageServiceLine = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE') return false;
  return isPhotocopieLine(line) || isImpressionLine(line);
};

export const getLineRectoVerso = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE' || !line.service) return null;
  const opts = getServiceOptions(line.service);

  let targetOpt = opts.find(o =>
    (o.values || []).some((v: any) => {
      const s = typeof v === 'string' ? v : (v.name || v.label || '');
      return s.toLowerCase().includes('recto');
    })
  );
  if (!targetOpt) {
    targetOpt = opts.find(o => {
      const n = o.name.toLowerCase();
      return n.includes('recto') || n.includes('impression') || n.includes('mode');
    });
  }

  const optionName = targetOpt ? targetOpt.name : "Impression";
  const rawValues = targetOpt?.values?.length
    ? (targetOpt.values as any[]).map((v: any) => (typeof v === 'string' ? v : (v?.name || v?.label || '')))
    : ['Recto', 'Recto-verso'];
  const values = Array.from(new Set(rawValues.concat(['Recto', 'Recto-verso'])));

  const notes = line.notes || '';
  const match = notes.match(new RegExp(`${optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^|\\n]+)`, 'i'));
  let currentVal = match && match[1] ? match[1].trim() : '';

  if (!currentVal) {
    for (const part of notes.split(' | ')) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        const k = part.slice(0, colonIdx).trim();
        const v = part.slice(colonIdx + 1).trim();
        if (canonicalOptionKey(k) === 'impression') {
          currentVal = v;
          break;
        }
      }
    }
  }

  if (!currentVal) {
    if (notes.toLowerCase().includes('recto-verso')) currentVal = 'Recto-verso';
    else currentVal = 'Recto';
  }

  const matched = values.find(v => v.toLowerCase() === currentVal.toLowerCase());
  if (matched) currentVal = matched;

  return {
    optionName,
    values,
    currentVal,
  };
};

export const getLineColorOption = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE' || !line.service) return null;
  const opts = getServiceOptions(line.service);

  let targetOpt = opts.find(o => {
    const k = canonicalOptionKey(o.name);
    return k === 'couleur' || (o.values || []).some((v: any) => {
      const s = (typeof v === 'string' ? v : (v.name || v.label || '')).toLowerCase();
      return s.includes('noir') || s.includes('couleur') || s.includes('n&b');
    });
  });

  const optionName = targetOpt ? targetOpt.name : 'Couleur';
  const rawValues = targetOpt?.values?.length
    ? targetOpt.values.map((v: any) => (typeof v === 'string' ? v : (v?.name || v?.label || '')))
    : ['Noir & Blanc', 'Couleur'];
  const values = Array.from(new Set(rawValues));

  const notes = line.notes || '';
  const match = notes.match(new RegExp(`${optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^|\\n]+)`, 'i'));
  let currentVal = match && match[1] ? match[1].trim() : '';

  if (!currentVal) {
    for (const part of notes.split(' | ')) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        const k = part.slice(0, colonIdx).trim();
        const v = part.slice(colonIdx + 1).trim();
        if (canonicalOptionKey(k) === 'couleur') {
          currentVal = v;
          break;
        }
      }
    }
  }

  if (!currentVal) {
    if (notes.toLowerCase().includes('couleur')) {
      currentVal = values.find(v => v.toLowerCase().includes('couleur')) || 'Couleur';
    } else {
      currentVal = values[0] || 'Noir & Blanc';
    }
  }

  const matched = values.find(v => v.toLowerCase() === currentVal.toLowerCase());
  if (matched) currentVal = matched;

  return {
    optionName,
    values,
    currentVal,
  };
};

export const getLineFormatOption = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE' || !line.service) return null;
  const opts = getServiceOptions(line.service);
  let targetOpt = opts.find(o => canonicalOptionKey(o.name) === 'format');

  let values: string[] = [];
  if (targetOpt && targetOpt.values.length > 0) {
    values = targetOpt.values.map((v: any) => (typeof v === 'string' ? v : (v?.name || v?.label || '')));
  } else if (line.service.configurations && line.service.configurations.length > 0) {
    const set = new Set<string>();
    for (const cfg of line.service.configurations) {
      for (const [k, v] of Object.entries(cfg.optionValues || {})) {
        if (canonicalOptionKey(k) === 'format' && v) set.add(v);
      }
    }
    values = Array.from(set);
  }

  if (values.length === 0) {
    const isPhoto = isPhotocopieLine(line);
    const isImp = isImpressionLine(line);
    const isRel = isReliureLine(line);
    const isPlast = isPlastificationLine(line);
    const isScan = isScanLine(line);
    if (isPhoto || isImp || isRel || isPlast || isScan) {
      values = ['A4', 'A3'];
    } else {
      return null;
    }
  }

  const optionName = targetOpt ? targetOpt.name : 'Format';
  const notes = line.notes || '';
  const match = notes.match(new RegExp(`${optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^|\\n]+)`, 'i'));
  let currentVal = match && match[1] ? match[1].trim() : '';

  if (!currentVal) {
    for (const part of notes.split(' | ')) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        const k = part.slice(0, colonIdx).trim();
        const v = part.slice(colonIdx + 1).trim();
        if (canonicalOptionKey(k) === 'format') {
          currentVal = v;
          break;
        }
      }
    }
  }

  if (!currentVal) {
    currentVal = values[0] || 'A4';
  }

  const matched = values.find(v => v.toLowerCase() === currentVal.toLowerCase());
  if (matched) currentVal = matched;

  return {
    optionName,
    values,
    currentVal,
  };
};

export const getLineReliureTypeOption = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE' || !line.service) return null;
  const opts = getServiceOptions(line.service);
  let targetOpt = opts.find(o => {
    const k = canonicalOptionKey(o.name);
    return k === 'reliure' || k === 'type' || o.name.toLowerCase().includes('reliure') || o.name.toLowerCase().includes('type');
  });

  let values: string[] = [];
  if (targetOpt && targetOpt.values.length > 0) {
    values = targetOpt.values.map((v: any) => (typeof v === 'string' ? v : (v?.name || v?.label || '')));
  } else if (line.service.configurations && line.service.configurations.length > 0) {
    const set = new Set<string>();
    for (const cfg of line.service.configurations) {
      for (const [k, v] of Object.entries(cfg.optionValues || {})) {
        if (k.toLowerCase().includes('reliure') || k.toLowerCase().includes('type')) {
          if (v) set.add(v);
        }
      }
    }
    values = Array.from(set);
  }

  if (values.length === 0) {
    values = ['Spirale plastique', 'Spirale métallique', 'Baguette'];
  }

  const optionName = targetOpt ? targetOpt.name : 'Type de reliure';
  const notes = line.notes || '';
  const match = notes.match(new RegExp(`${optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^|\\n]+)`, 'i'));
  let currentVal = match && match[1] ? match[1].trim() : '';

  if (!currentVal) {
    for (const part of notes.split(' | ')) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        const k = part.slice(0, colonIdx).trim().toLowerCase();
        const v = part.slice(colonIdx + 1).trim();
        if (k.includes('reliure') || k.includes('type')) {
          currentVal = v;
          break;
        }
      }
    }
  }

  if (!currentVal) currentVal = values[0] || 'Spirale plastique';
  const matched = values.find(v => v.toLowerCase() === currentVal.toLowerCase());
  if (matched) currentVal = matched;

  return { optionName, values, currentVal };
};

export const getLinePlastifFinitionOption = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE' || !line.service) return null;
  const opts = getServiceOptions(line.service);
  let targetOpt = opts.find(o => {
    const k = canonicalOptionKey(o.name);
    return k === 'finition' || k === 'epaisseur' || o.name.toLowerCase().includes('finition') || o.name.toLowerCase().includes('epaisseur');
  });

  let values: string[] = [];
  if (targetOpt && targetOpt.values.length > 0) {
    values = targetOpt.values.map((v: any) => (typeof v === 'string' ? v : (v?.name || v?.label || '')));
  } else if (line.service.configurations && line.service.configurations.length > 0) {
    const set = new Set<string>();
    for (const cfg of line.service.configurations) {
      for (const [k, v] of Object.entries(cfg.optionValues || {})) {
        if (k.toLowerCase().includes('finition') || k.toLowerCase().includes('epaisseur')) {
          if (v) set.add(v);
        }
      }
    }
    values = Array.from(set);
  }

  if (values.length === 0) {
    values = ['Brillant 80µ', 'Mat 125µ', 'Brillant 125µ'];
  }

  const optionName = targetOpt ? targetOpt.name : 'Finition';
  const notes = line.notes || '';
  const match = notes.match(new RegExp(`${optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^|\\n]+)`, 'i'));
  let currentVal = match && match[1] ? match[1].trim() : '';

  if (!currentVal) {
    for (const part of notes.split(' | ')) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        const k = part.slice(0, colonIdx).trim().toLowerCase();
        const v = part.slice(colonIdx + 1).trim();
        if (k.includes('finition') || k.includes('epaisseur')) {
          currentVal = v;
          break;
        }
      }
    }
  }

  if (!currentVal) currentVal = values[0] || 'Brillant 80µ';
  const matched = values.find(v => v.toLowerCase() === currentVal.toLowerCase());
  if (matched) currentVal = matched;

  return { optionName, values, currentVal };
};

export const getLineScanDestinationOption = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE' || !line.service) return null;
  const opts = getServiceOptions(line.service);
  let targetOpt = opts.find(o => {
    const k = canonicalOptionKey(o.name);
    return k === 'destination' || k === 'support' || o.name.toLowerCase().includes('destination') || o.name.toLowerCase().includes('support');
  });

  let values: string[] = [];
  if (targetOpt && targetOpt.values.length > 0) {
    values = targetOpt.values.map((v: any) => (typeof v === 'string' ? v : (v?.name || v?.label || '')));
  } else if (line.service.configurations && line.service.configurations.length > 0) {
    const set = new Set<string>();
    for (const cfg of line.service.configurations) {
      for (const [k, v] of Object.entries(cfg.optionValues || {})) {
        if (k.toLowerCase().includes('destination') || k.toLowerCase().includes('support')) {
          if (v) set.add(v);
        }
      }
    }
    values = Array.from(set);
  }

  if (values.length === 0) {
    values = ['Email (PDF)', 'Clé USB (PDF)', 'Clé USB (JPEG)'];
  }

  const optionName = targetOpt ? targetOpt.name : 'Destination';
  const notes = line.notes || '';
  const match = notes.match(new RegExp(`${optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^|\\n]+)`, 'i'));
  let currentVal = match && match[1] ? match[1].trim() : '';

  if (!currentVal) {
    for (const part of notes.split(' | ')) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        const k = part.slice(0, colonIdx).trim().toLowerCase();
        const v = part.slice(colonIdx + 1).trim();
        if (k.includes('destination') || k.includes('support')) {
          currentVal = v;
          break;
        }
      }
    }
  }

  if (!currentVal) currentVal = values[0] || 'Email (PDF)';
  const matched = values.find(v => v.toLowerCase() === currentVal.toLowerCase());
  if (matched) currentVal = matched;

  return { optionName, values, currentVal };
};

export const getLineSecondaryOption = (line: CalculatedLine) => {
  if (line.itemType !== 'SERVICE' || !line.service) return null;
  const opts = getServiceOptions(line.service);
  if (opts.length === 0) return null;

  // Find secondary option that is NOT couleur, impression, or format
  const secOpt = opts.find(o => {
    const k = canonicalOptionKey(o.name);
    return k !== 'couleur' && k !== 'impression' && k !== 'format';
  });

  if (!secOpt) return null;

  const optionName = secOpt.name;
  const values = secOpt.values.map((v: any) => (typeof v === 'string' ? v : (v?.name || v?.label || '')));
  const notes = line.notes || '';
  const match = notes.match(new RegExp(`${optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^|\\n]+)`, 'i'));
  const currentVal = match && match[1] ? match[1].trim() : (values[0] || '');

  return {
    optionName,
    values,
    currentVal,
  };
};

export const getLinePrimaryOption = (line: CalculatedLine) => {
  return getLineColorOption(line) || getLineSecondaryOption(line);
};

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

  // Clean deduplicated selectable services for "Type de service"
  // Ensures only 1 "Photocopie" and 1 "Impression", while preserving all other services intact
  const selectableServices = useMemo(() => {
    if (!tenantServices || tenantServices.length === 0) return [];

    const photoServices = tenantServices.filter(s => {
      const n = (s.name || '').toLowerCase();
      const c = (s.code || '').toLowerCase();
      return (n.includes('photocopie') || c.includes('photo')) && !n.includes('planche') && !n.includes('identité') && !n.includes('photo-id');
    });

    const primaryPhoto = photoServices.find(s => s.name.trim().toLowerCase() === 'photocopie')
      || photoServices.find(s => !s.name.toLowerCase().includes('n&b') && !s.name.toLowerCase().includes('couleur') && !s.name.toLowerCase().includes('a4'))
      || photoServices[0];

    const impServices = tenantServices.filter(s => {
      const n = (s.name || '').toLowerCase();
      const c = (s.code || '').toLowerCase();
      return (n.includes('impression') || c.includes('imp')) && !photoServices.some(p => p.id === s.id);
    });

    const primaryImp = impServices.find(s => s.name.trim().toLowerCase() === 'impression')
      || impServices.find(s => s.name.trim().toLowerCase() === 'impression numérique')
      || impServices.find(s => !s.name.toLowerCase().includes('n&b') && !s.name.toLowerCase().includes('couleur') && !s.name.toLowerCase().includes('a4'))
      || impServices[0];

    const list: Service[] = [];

    if (primaryPhoto) {
      list.push({
        ...primaryPhoto,
        name: 'Photocopie'
      });
    }

    if (primaryImp) {
      list.push({
        ...primaryImp,
        name: 'Impression'
      });
    }

    tenantServices.forEach(s => {
      const isPhotoVar = photoServices.some(p => p.id === s.id);
      const isImpVar = impServices.some(i => i.id === s.id);
      const isFormation = (s.name || '').toLowerCase().includes('formation') || (s.code || '').toLowerCase().includes('formation') || (s.categoryName || '').toLowerCase().includes('formation');
      if (!isPhotoVar && !isImpVar && !isFormation) {
        list.push(s);
      }
    });

    return list;
  }, [tenantServices]);

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

  // Quick Add Search Bar State
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [selectedAddItem, setSelectedAddItem] = useState<{ type: 'SERVICE' | 'PRODUCT'; id: string } | null>(null);

  // Editing Panel Modal State for line details
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);

  // Remise Modal State for dedicated line discount
  const [remiseLineIndex, setRemiseLineIndex] = useState<number | null>(null);
  const [remiseNewAmount, setRemiseNewAmount] = useState<number>(0);
  const [remiseCategory, setRemiseCategory] = useState<'VOLUME' | 'LOYALTY' | 'INSTITUTIONAL' | 'PROMOTION' | 'COMMERCIAL_NEGOTIATION' | 'OTHER'>('COMMERCIAL_NEGOTIATION');
  const [remiseCustomReason, setRemiseCustomReason] = useState<string>('');

  // Form Lines State - Décoché par défaut : c'est à l'utilisateur de choisir ses prestations
  const [lines, setLines] = useState<OrderFormLine[]>([]);

  const [priority, setPriority] = useState<OrderPriority>('NORMAL');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);

  // Payment Options
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

  // Combined Catalogue of Services + Articles for Quick Search & Add
  const catalogueItems = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'SERVICE' | 'PRODUCT';
      name: string;
      code: string;
      category: string;
      price: number;
      unit: string;
      stock?: number;
      service?: Service;
      product?: Product;
    }> = [];

    tenantServices.forEach(s => {
      list.push({
        id: s.id,
        type: 'SERVICE',
        name: s.name,
        code: s.code,
        category: s.categoryName || 'Prestation',
        price: s.basePrice,
        unit: s.unit || 'page',
        service: s,
      });
    });

    tenantProducts.forEach(p => {
      list.push({
        id: p.id,
        type: 'PRODUCT',
        name: p.name,
        code: p.code || p.id,
        category: p.category || 'Article Stock Central',
        price: p.salePrice || p.costPrice || 0,
        unit: p.unit || 'unité',
        stock: p.currentStock || 0,
        product: p,
      });
    });

    return list;
  }, [tenantServices, tenantProducts]);

  // Filtered Catalogue Items based on quick search query
  const filteredCatalogueItems = useMemo(() => {
    if (!quickSearchQuery.trim()) return catalogueItems;
    const q = quickSearchQuery.toLowerCase();
    return catalogueItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [catalogueItems, quickSearchQuery]);

  // Reset Form
  const resetForm = () => {
    setLines([]);
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
    setQuickSearchQuery('');
    setSelectedAddItem(null);
    setEditingLineIndex(null);
    setRemiseLineIndex(null);
  };

  // Filtered Persons
  const filteredPersons = useMemo(() => {
    const tenantPersons = (state.persons || []).filter(p => p.tenantId === tenantId || p.tenantId === 'global');
    if (!clientSearchQuery.trim()) return tenantPersons;
    const q = clientSearchQuery.toLowerCase();
    return tenantPersons.filter(p =>
      p.firstName.toLowerCase().includes(q) ||
      (p.lastName && p.lastName.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q)) ||
      (p.customerProfile?.customerNumber && p.customerProfile.customerNumber.toLowerCase().includes(q))
    );
  }, [state.persons, tenantId, clientSearchQuery]);

  // Selected Person details
  const selectedPerson = useMemo(() => {
    if (clientMode === 'WALK_IN') return null;
    return (state.persons || []).find(p => p.id === selectedPersonId);
  }, [clientMode, selectedPersonId, state.persons]);

  // Calculated Lines for Compact Table
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
          unit: srv?.unit || 'page',
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
          category: prod?.category || 'Stock Central',
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

  // Order Totals
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
      computedPaidAmount = Math.min(totalAmount, Math.max(0, partialAmount));
    }

    const dueAmount = Math.max(0, totalAmount - computedPaidAmount);
    return {
      grossSubtotal,
      subtotal,
      totalDiscount,
      totalAmount,
      paidAmount: computedPaidAmount,
      dueAmount,
    };
  }, [calculatedLines, paymentOption, partialAmount]);

  const paymentAmount = totals.paidAmount;

  // Add Item Handler from Top Quick Add Zone
  const handleAddItemFromCatalogue = (targetItem?: { type: 'SERVICE' | 'PRODUCT'; id: string }) => {
    const itemToAdd = targetItem || selectedAddItem || (filteredCatalogueItems.length > 0 ? { type: filteredCatalogueItems[0].type, id: filteredCatalogueItems[0].id } : null);
    if (!itemToAdd) {
      showToast('Sélection requise', 'Veuillez sélectionner une prestation ou un article à ajouter.', 'WARNING');
      return;
    }

    if (itemToAdd.type === 'SERVICE') {
      const srv = tenantServices.find(s => s.id === itemToAdd.id) || state.services.find(s => s.id === itemToAdd.id);
      if (!srv) return;
      const srvSpecs = getServiceSpecificationGroups(srv);
      const defaultNotes = srvSpecs.map(g => `${g.name}: ${g.defaultValue || (typeof g.options[0] === 'string' ? g.options[0] : g.options[0]?.name)}`).join(' | ');

      const newLine: OrderFormLine = {
        id: `line-${Date.now()}-${lines.length + 1}`,
        itemType: 'SERVICE',
        serviceId: srv.id,
        pageCount: 1,
        copiesCount: 1,
        quantity: 1,
        unit: srv.unit || 'page',
        isCustomPrice: false,
        discountReasonCategory: 'COMMERCIAL_NEGOTIATION',
        discountReasonCustom: '',
        assignedDepartment: 'PRINT',
        notes: defaultNotes,
        files: [],
      };
      setLines(prev => [...prev, newLine]);
      showToast('Prestation ajoutée', `« ${srv.name} » a été ajouté à la commande.`, 'SUCCESS');
    } else {
      const prod = tenantProducts.find(p => p.id === itemToAdd.id) || state.products.find(p => p.id === itemToAdd.id);
      if (!prod) return;

      const newLine: OrderFormLine = {
        id: `line-${Date.now()}-${lines.length + 1}`,
        itemType: 'PRODUCT',
        productId: prod.id,
        quantity: 1,
        unit: prod.unit || 'unité',
        purchaseUnitName: prod.purchaseUnit || 'carton',
        conversionFactor: prod.conversionFactor || 1,
        usePurchaseUnit: false,
        isCustomPrice: false,
        discountReasonCategory: 'COMMERCIAL_NEGOTIATION',
        discountReasonCustom: '',
        assignedDepartment: 'STORE',
        notes: '',
        files: [],
      };
      setLines(prev => [...prev, newLine]);
      showToast('Article ajouté', `« ${prod.name} » (Stock: ${prod.currentStock}) a été ajouté à la commande.`, 'SUCCESS');
    }

    setQuickSearchQuery('');
    setSelectedAddItem(null);
  };

  // Remove Line (unchecks corresponding service if applicable)
  const handleRemoveLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
    if (editingLineIndex === index) setEditingLineIndex(null);
    if (remiseLineIndex === index) setRemiseLineIndex(null);
  };

  // Update Line Field
  const handleUpdateLine = (index: number, updates: Partial<OrderFormLine>) => {
    setLines(prev => {
      const copy = [...prev];
      const current = copy[index];
      if (!current) return prev;
      let newPageCount = updates.pageCount !== undefined ? updates.pageCount : (current.pageCount || 1);
      let newCopiesCount = updates.copiesCount !== undefined ? updates.copiesCount : (current.copiesCount || 1);
      let newQuantity = updates.quantity !== undefined ? updates.quantity : (current.quantity || 1);

      if (updates.quantity !== undefined && updates.pageCount === undefined && updates.copiesCount === undefined) {
        newQuantity = Math.max(1, Number(updates.quantity) || 1);
        newPageCount = newQuantity;
        newCopiesCount = 1;
      } else if (updates.pageCount !== undefined || updates.copiesCount !== undefined) {
        const p = Math.max(1, Number(newPageCount) || 1);
        const c = Math.max(1, Number(newCopiesCount) || 1);
        newPageCount = p;
        newCopiesCount = c;
        newQuantity = p * c;
      } else if (updates.quantity !== undefined) {
        newQuantity = Math.max(1, Number(updates.quantity) || 1);
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

  // Update Line Option in Notes
  const handleUpdateLineOption = (index: number, optionName: string, newValue: string) => {
    setLines(prev => {
      const copy = [...prev];
      const current = copy[index];
      if (!current) return prev;

      const currentNotes = current.notes || '';
      const canonTarget = canonicalOptionKey(optionName);

      const parts = currentNotes
        .split(' | ')
        .map(p => p.trim())
        .filter(p => {
          if (!p) return false;
          const colonIdx = p.indexOf(':');
          if (colonIdx > 0) {
            const k = p.slice(0, colonIdx).trim();
            if (canonicalOptionKey(k) === canonTarget || k.toLowerCase() === optionName.toLowerCase()) {
              return false;
            }
          }
          return true;
        });

      parts.push(`${optionName}: ${newValue}`);
      const updatedNotes = parts.join(' | ');

      copy[index] = {
        ...current,
        notes: updatedNotes,
        isCustomPrice: false,
        customUnitPrice: undefined,
      };
      return copy;
    });
  };

  // Open Remise Modal
  const handleOpenRemiseModal = (idx: number) => {
    const line = calculatedLines[idx];
    if (!line) return;
    setRemiseLineIndex(idx);
    setRemiseNewAmount(line.netTotal);
    setRemiseCategory(line.discountReasonCategory || 'COMMERCIAL_NEGOTIATION');
    setRemiseCustomReason(line.discountReasonCustom || '');
  };

  // Quick Person Creation
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
      const evalRes = evaluateTenantSubscription(currentTenant);
      if (evalRes.isExpired || evalRes.isSuspended) {
        showToast('Période d\'Essai Expirée', "Votre période d'essai est arrivée à son terme. Veuillez contacter l'administrateur.", 'DANGER');
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

      const isCashDestination = paymentMethod === 'CASH' || effectiveFinancialAccount?.type === 'CASH' || effectiveFinancialAccount?.isMainCash;
      if (paymentAmount > 0 && isCashDestination && !activeCashSession) {
        showToast('Caisse Fermée', 'Veuillez ouvrir la caisse du jour pour encaisser en espèces.', 'WARNING');
        setIsOpenCashModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      // Check stock availability
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

        if (!draft.productionJobs) draft.productionJobs = [];
        productionJobs.forEach(job => draft.productionJobs.unshift(job));
      });

      // Deduct stock for consumables and boutique items atomically
      dbStore.deductConsumablesForOrder(newOrder.id, tenantId, performedBy);

      dbStore.updateState(draft => {
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

          let createdPayObj: any = null;
          if (!draft.payments) draft.payments = [];
          createdPayObj = {
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
          };
          draft.payments.unshift(createdPayObj);
          (newOrder as any)._createdPayment = createdPayObj;
        }
      });

      setReceiptOrder(newOrder);
      if (paymentAmount > 0 && (newOrder as any)._createdPayment) {
        setReceiptPayment((newOrder as any)._createdPayment);
      } else {
        setReceiptPayment(null);
      }

      dbStore.logAudit('ORDER_CREATED', 'ORDER', orderId, null, {
        orderNumber,
        client: finalPersonName,
        customerType: finalCustomerType,
      });

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

      showToast('Commande Enregistrée 🟢', `La commande ${orderNumber} a été validée avec succès (${orderItems.length} ligne(s)).`, 'SUCCESS');
      
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
      showToast('Erreur', "Une erreur inattendue est survenue lors de l'enregistrement.", 'DANGER');
    }
  };

  const handleModalClose = () => {
    resetForm();
    setCreatedOrderSummary(null);
    setReceiptPayment(null);
    setReceiptOrder(null);
    setEditingLineIndex(null);
    onClose();
  };

  React.useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

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

  const currentEditingLine = editingLineIndex !== null ? calculatedLines[editingLineIndex] : null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleModalClose}
        title={createdOrderSummary ? "Confirmation — Commande Validée" : "Nouvelle Commande Multi-Prestations & Fournitures"}
        maxWidth="4xl"
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
                La commande <span className="font-mono font-bold text-slate-800 dark:text-slate-200">#{createdOrderSummary.orderNumber}</span> a été enregistrée.
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
                <span className="text-slate-500 font-medium">Articles / Prestations :</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{createdOrderSummary.linesCount} ligne(s)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-medium">Montant Total :</span>
                <span className="font-black text-brand-600 dark:text-brand-400 text-sm">{formatCurrency(createdOrderSummary.totalAmount)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="lg"
                icon={Printer}
                onClick={() => {
                  if (!receiptPayment && createdOrderSummary) {
                    setReceiptPayment({
                      id: `rec-${Date.now()}`,
                      tenantId: currentTenant?.id || 't-001',
                      targetType: 'ORDER',
                      orderId: createdOrderSummary.id,
                      orderNumber: createdOrderSummary.orderNumber,
                      paymentNumber: generateDocNumber('PAY', state.payments.length + 1),
                      amount: createdOrderSummary.paidAmount,
                      balanceBefore: createdOrderSummary.totalAmount,
                      balanceAfter: createdOrderSummary.dueAmount,
                      paymentMethod: paymentMethod || 'CASH',
                      personName: createdOrderSummary.clientName,
                      receivedByUserName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Caissier',
                      createdAt: new Date().toISOString()
                    });
                  }
                }}
                className="w-full sm:w-auto font-bold text-xs border-brand-300 text-brand-700 hover:bg-brand-50"
              >
                Imprimer Reçu Détaillé (A5)
              </Button>

              <Button
                type="button"
                variant="primary"
                size="lg"
                icon={Plus}
                onClick={() => {
                  resetForm();
                  setCreatedOrderSummary(null);
                }}
                className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 font-black px-6 text-xs"
              >
                + Nouvelle commande (Suivante)
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
          <form onSubmit={handleSubmitOrder} className="flex flex-col max-h-[82vh] overflow-hidden -m-4">
            {/* SCROLLABLE MAIN CONTENT AREA */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">

              {/* 1. EN-TÊTE : Client Selection & Header Info */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                      Client :
                    </span>

                    <div className="inline-flex p-0.5 bg-slate-200 dark:bg-slate-800 rounded-lg text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setClientMode('WALK_IN')}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          clientMode === 'WALK_IN'
                            ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Client de passage
                      </button>

                      <button
                        type="button"
                        onClick={() => setClientMode('REGISTERED')}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          clientMode === 'REGISTERED'
                            ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Client Enregistré
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">Priorité:</span>
                    <Select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as OrderPriority)}
                      className="text-xs font-bold py-1 px-2 h-7"
                    >
                      <option value="NORMAL">🟢 Normale</option>
                      <option value="HIGH">🟠 Haute</option>
                      <option value="URGENT">🔴 Urgente (Express)</option>
                    </Select>
                  </div>
                </div>

                {/* Client Input Details */}
                {clientMode === 'REGISTERED' ? (
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                    <div className="flex-1 w-full">
                      <Select
                        value={selectedPersonId}
                        onChange={(e) => setSelectedPersonId(e.target.value)}
                        className="text-xs font-semibold w-full"
                      >
                        {filteredPersons.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.firstName} {p.lastName || ''} {p.phone ? `• 📞 ${p.phone}` : ''}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={UserPlus}
                      onClick={() => setIsCreatingNewPerson(true)}
                      className="text-xs shrink-0 font-bold h-8"
                    >
                      + Nouveau Client
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <Input
                      type="text"
                      placeholder="Nom du client (optionnel)..."
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className="text-xs h-8"
                    />
                    <PhoneInput
                      placeholder="Téléphone client (optionnel)..."
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                )}
              </div>

              {/* 2. TYPE DE SERVICE : Case à cocher pour les prestations configurées dans Services & Tarifs */}
              <div className="p-3.5 bg-sky-50/80 dark:bg-slate-900 rounded-xl border border-sky-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-200/60 dark:border-slate-800 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-sky-900 dark:text-sky-300 flex items-center gap-1.5">
                    <Settings2 className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" />
                    2. Type de service (Prestations configurées dans Services & Tarifs)
                  </h3>
                  <span className="text-[10px] text-sky-700 dark:text-sky-400 font-semibold">
                    Cochez pour ajouter à la commande
                  </span>
                </div>

                {/* Checkboxes Grid of Services */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {selectableServices.map(service => {
                    const isChecked = lines.some(l => l.itemType === 'SERVICE' && l.serviceId === service.id);

                    return (
                      <label
                        key={service.id}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all select-none ${
                          isChecked
                            ? 'bg-white dark:bg-slate-800 border-sky-500 text-sky-900 dark:text-sky-200 shadow-sm font-bold ring-1 ring-sky-400'
                            : 'bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-300 hover:bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const isPhoto = isPhotocopieLine({ itemType: 'SERVICE', service } as any);
                              const isImp = isImpressionLine({ itemType: 'SERVICE', service } as any);
                              const srvOpts = getServiceOptions(service);
                              const defaultPairs: string[] = [];

                              if (isPhoto || isImp) {
                                const colorOpt = srvOpts.find(o => canonicalOptionKey(o.name) === 'couleur');
                                const modeOpt = srvOpts.find(o => canonicalOptionKey(o.name) === 'impression');
                                const formatOpt = srvOpts.find(o => canonicalOptionKey(o.name) === 'format');

                                defaultPairs.push(`${colorOpt ? colorOpt.name : 'Couleur'}: Noir & Blanc`);
                                defaultPairs.push(`${modeOpt ? modeOpt.name : 'Impression'}: Recto`);
                                defaultPairs.push(`${formatOpt ? formatOpt.name : 'Format'}: ${formatOpt?.values?.[0] || 'A4'}`);

                                srvOpts.forEach(o => {
                                  const k = canonicalOptionKey(o.name);
                                  if (k !== 'couleur' && k !== 'impression' && k !== 'format') {
                                    defaultPairs.push(`${o.name}: ${o.values[0] || 'Standard'}`);
                                  }
                                });
                              } else {
                                srvOpts.forEach(o => {
                                  defaultPairs.push(`${o.name}: ${o.values[0] || ''}`);
                                });
                              }

                              const defaultNotes = defaultPairs.filter(Boolean).join(' | ');

                              setLines(prev => [
                                ...prev,
                                {
                                  id: `line-${Date.now()}-${prev.length + 1}`,
                                  itemType: 'SERVICE',
                                  serviceId: service.id,
                                  pageCount: 1,
                                  copiesCount: 1,
                                  quantity: 1,
                                  unit: service.unit || 'page',
                                  isCustomPrice: false,
                                  discountReasonCategory: 'COMMERCIAL_NEGOTIATION',
                                  discountReasonCustom: '',
                                  assignedDepartment: isPhoto ? 'PHOTOCOPY' : isImp ? 'PRINT' : 'FINISHING',
                                  notes: defaultNotes,
                                  files: [],
                                }
                              ]);
                              showToast('Prestation ajoutée', `« ${service.name} » a été ajouté à la commande.`, 'SUCCESS');
                            } else {
                              setLines(prev => prev.filter(l => !(l.itemType === 'SERVICE' && l.serviceId === service.id)));
                            }
                          }}
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                        />
                        <span className="truncate">{service.name}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Option d'ajout d'article du Stock Central si besoin */}
                {tenantProducts.length > 0 && (
                  <div className="pt-2 border-t border-sky-200/50 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-500 font-medium">Besoin d'ajouter une fourniture / article du stock central ?</span>
                    <div className="flex items-center gap-2">
                      <select
                        onChange={(e) => {
                          const prodId = e.target.value;
                          if (!prodId) return;
                          const prod = tenantProducts.find(p => p.id === prodId);
                          if (!prod) return;
                          setLines(prev => [
                            ...prev,
                            {
                              id: `line-${Date.now()}-${prev.length + 1}`,
                              itemType: 'PRODUCT',
                              productId: prod.id,
                              quantity: 1,
                              unit: prod.unit || 'unité',
                              purchaseUnitName: prod.purchaseUnit || 'carton',
                              conversionFactor: prod.conversionFactor || 1,
                              usePurchaseUnit: false,
                              isCustomPrice: false,
                              discountReasonCategory: 'COMMERCIAL_NEGOTIATION',
                              discountReasonCustom: '',
                              assignedDepartment: 'STORE',
                              notes: '',
                              files: [],
                            }
                          ]);
                          showToast('Article ajouté', `« ${prod.name} » a été ajouté à la commande.`, 'SUCCESS');
                          e.target.value = '';
                        }}
                        className="py-1 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                      >
                        <option value="">+ Ajouter un article du Stock Central...</option>
                        {tenantProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            🛒 {p.name} — {formatCurrency(p.salePrice || p.costPrice || 0)} (Dispo: {p.currentStock})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. TABLEAU COMPACT DES LIGNES AJOUTÉES */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-brand-500" />
                    Lignes de Commande ({lines.length})
                  </h3>
                  <span className="text-[11px] text-slate-400 italic">
                    Paramètres configurables en direct · Cliquez sur « Modifier » pour les options avancées.
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                  {calculatedLines.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                      Aucune prestation ou fourniture sélectionnée. Cochez des prestations ci-dessus pour composer la commande.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                        <tr>
                          <th className="py-3 px-3 min-w-[150px]">Désignation</th>
                          <th className="py-3 px-3 min-w-[140px]">Paramètre</th>
                          <th className="py-3 px-3 min-w-[140px]">Quantité</th>
                          <th className="py-3 px-3 text-center whitespace-nowrap">Prix unitaire</th>
                          <th className="py-3 px-3 text-center whitespace-nowrap">Total</th>
                          <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {calculatedLines.map((line, idx) => {
                          const isPhoto = isPhotocopieLine(line);
                          const isImp = isImpressionLine(line);
                          const isRel = isReliureLine(line);
                          const isPlast = isPlastificationLine(line);
                          const isScan = isScanLine(line);
                          const isPage = isPhoto || isImp || isPageServiceLine(line);

                          const colorOpt = getLineColorOption(line);
                          const rectoVersoOpt = getLineRectoVerso(line);
                          const formatOpt = getLineFormatOption(line);
                          const reliureTypeOpt = getLineReliureTypeOption(line);
                          const plastifFinitionOpt = getLinePlastifFinitionOption(line);
                          const scanDestOpt = getLineScanDestinationOption(line);
                          const secOpt = getLineSecondaryOption(line);

                          return (
                            <tr key={line.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
                              {/* 1. DÉSIGNATION */}
                              <td className="py-3 px-3 align-middle">
                                <div className="flex flex-col">
                                  <strong className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm">
                                    {line.name}
                                  </strong>
                                  {line.itemType === 'PRODUCT' ? (
                                    <span className="text-[11px] text-slate-400 font-medium">
                                      Article stock (Dispo: {line.currentStock})
                                    </span>
                                  ) : (
                                    line.notes && (
                                      <span className="text-[11px] text-slate-400 font-normal leading-relaxed line-clamp-2 max-w-[220px]" title={line.notes}>
                                        {line.notes.split(' | ').join(' · ')}
                                      </span>
                                    )
                                  )}
                                </div>
                              </td>

                              {/* 2. PARAMÈTRE (SELECTS EMPILÉS VERTICALEMENT) */}
                              <td className="py-3 px-3 align-middle">
                                {isPhoto || isImp ? (
                                  <div className="flex flex-col gap-1.5 w-fit min-w-[130px] max-w-[160px]">
                                    {colorOpt && (
                                      <select
                                        value={colorOpt.currentVal}
                                        onChange={(e) => handleUpdateLineOption(idx, colorOpt.optionName, e.target.value)}
                                        className="h-8 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-slate-800 dark:text-slate-100 shadow-xs focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                        title="Couleur"
                                      >
                                        {colorOpt.values.map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    )}
                                    {rectoVersoOpt && (
                                      <select
                                        value={rectoVersoOpt.currentVal}
                                        onChange={(e) => handleUpdateLineOption(idx, rectoVersoOpt.optionName, e.target.value)}
                                        className="h-8 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-slate-800 dark:text-slate-100 shadow-xs focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                        title="Type d'impression"
                                      >
                                        {rectoVersoOpt.values.map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                ) : isRel ? (
                                  <div className="flex flex-col gap-1.5 w-fit min-w-[130px] max-w-[160px]">
                                    {reliureTypeOpt && (
                                      <select
                                        value={reliureTypeOpt.currentVal}
                                        onChange={(e) => handleUpdateLineOption(idx, reliureTypeOpt.optionName, e.target.value)}
                                        className="h-8 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-slate-800 dark:text-slate-100 shadow-xs focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                        title="Type de reliure"
                                      >
                                        {reliureTypeOpt.values.map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    )}
                                    {formatOpt && (
                                      <select
                                        value={formatOpt.currentVal}
                                        onChange={(e) => handleUpdateLineOption(idx, formatOpt.optionName, e.target.value)}
                                        className="h-8 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-slate-800 dark:text-slate-100 shadow-xs focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                        title="Format"
                                      >
                                        {formatOpt.values.map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                ) : isPlast ? (
                                  <div className="flex flex-col gap-1.5 w-fit min-w-[130px] max-w-[160px]">
                                    {formatOpt && (
                                      <select
                                        value={formatOpt.currentVal}
                                        onChange={(e) => handleUpdateLineOption(idx, formatOpt.optionName, e.target.value)}
                                        className="h-8 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-slate-800 dark:text-slate-100 shadow-xs focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                        title="Format"
                                      >
                                        {formatOpt.values.map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    )}
                                    {plastifFinitionOpt && (
                                      <select
                                        value={plastifFinitionOpt.currentVal}
                                        onChange={(e) => handleUpdateLineOption(idx, plastifFinitionOpt.optionName, e.target.value)}
                                        className="h-8 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-slate-800 dark:text-slate-100 shadow-xs focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                        title="Finition"
                                      >
                                        {plastifFinitionOpt.values.map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                ) : isScan ? (
                                  <div className="flex flex-col gap-1.5 w-fit min-w-[130px] max-w-[160px]">
                                    {formatOpt && (
                                      <select
                                        value={formatOpt.currentVal}
                                        onChange={(e) => handleUpdateLineOption(idx, formatOpt.optionName, e.target.value)}
                                        className="h-8 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-slate-800 dark:text-slate-100 shadow-xs focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                        title="Format"
                                      >
                                        {formatOpt.values.map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    )}
                                    {scanDestOpt && (
                                      <select
                                        value={scanDestOpt.currentVal}
                                        onChange={(e) => handleUpdateLineOption(idx, scanDestOpt.optionName, e.target.value)}
                                        className="h-8 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-slate-800 dark:text-slate-100 shadow-xs focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                        title="Destination"
                                      >
                                        {scanDestOpt.values.map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1.5 w-fit min-w-[130px] max-w-[160px]">
                                    {formatOpt && (
                                      <select
                                        value={formatOpt.currentVal}
                                        onChange={(e) => handleUpdateLineOption(idx, formatOpt.optionName, e.target.value)}
                                        className="h-8 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-slate-800 dark:text-slate-100 shadow-xs focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                        title="Format"
                                      >
                                        {formatOpt.values.map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    )}
                                    {secOpt && (
                                      <select
                                        value={secOpt.currentVal}
                                        onChange={(e) => handleUpdateLineOption(idx, secOpt.optionName, e.target.value)}
                                        className="h-8 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-slate-800 dark:text-slate-100 shadow-xs focus:ring-1 focus:ring-sky-500 cursor-pointer"
                                        title={secOpt.optionName}
                                      >
                                        {secOpt.values.map(val => (
                                          <option key={val} value={val}>{val}</option>
                                        ))}
                                      </select>
                                    )}
                                    {!formatOpt && !secOpt && (
                                      <span className="text-xs text-slate-400 italic">Standard</span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* 3. QUANTITÉ (INPUTS EMPILÉS VERTICALEMENT AVEC DIMENSIONS CONFORTABLES) */}
                              <td className="py-3 px-3 align-middle">
                                {isPage ? (
                                  <div className="flex flex-col gap-2 w-fit">
                                    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 shadow-xs">
                                      <input
                                        type="number"
                                        min={1}
                                        value={line.pageCount || 1}
                                        onChange={(e) => handleUpdateLine(idx, { pageCount: Math.max(1, parseInt(e.target.value) || 1) })}
                                        className="w-14 sm:w-16 h-8 text-sm font-bold text-center rounded-lg border-2 border-slate-800 dark:border-slate-200 bg-white dark:bg-slate-950 px-1 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                                        title="Nombre de pages du document original"
                                      />
                                      <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold min-w-[34px]">pages</span>
                                    </div>

                                    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 shadow-xs">
                                      <input
                                        type="number"
                                        min={1}
                                        value={line.copiesCount || 1}
                                        onChange={(e) => handleUpdateLine(idx, { copiesCount: Math.max(1, parseInt(e.target.value) || 1) })}
                                        className="w-14 sm:w-16 h-8 text-sm font-bold text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                                        title="Nombre d'exemplaires"
                                      />
                                      <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold min-w-[34px]">ex.</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 shadow-xs w-fit">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLine(idx, { quantity: Math.max(1, (line.quantity || 1) - 1) })}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-sm select-none transition-colors"
                                      title="Diminuer la quantité"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      max={line.itemType === 'PRODUCT' ? (line.currentStock || 9999) : 9999}
                                      value={line.quantity}
                                      onChange={(e) => {
                                        const v = parseInt(e.target.value);
                                        handleUpdateLine(idx, { quantity: isNaN(v) ? 1 : Math.max(1, v) });
                                      }}
                                      className="w-14 sm:w-16 h-8 text-sm font-bold text-center rounded-lg border-2 border-slate-800 dark:border-slate-200 bg-white dark:bg-slate-950 px-1 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                                      title="Quantité"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLine(idx, { quantity: (line.quantity || 1) + 1 })}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-sm select-none transition-colors"
                                      title="Augmenter la quantité"
                                    >
                                      +
                                    </button>
                                    <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold min-w-[34px]">
                                      {line.unit || 'doc'}
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* 4. PRIX UNITAIRE */}
                              <td className="py-3 px-3 align-middle text-center whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                                <span>{formatCurrency(line.appliedUnitPrice)}</span>
                                {line.isCustomPrice && line.standardUnitPrice !== line.appliedUnitPrice && (
                                  <span className="text-[10px] text-slate-400 line-through block">
                                    {formatCurrency(line.standardUnitPrice)}
                                  </span>
                                )}
                              </td>

                              {/* 5. TOTAL (DOUBLE LIGNE EN VERT) */}
                              <td className="py-3 px-3 align-middle text-center whitespace-nowrap">
                                {line.discountAmount > 0 && (
                                  <span className="text-[10px] text-slate-400 line-through block">
                                    {formatCurrency(line.grossTotal)}
                                  </span>
                                )}
                                <div className="text-emerald-700 dark:text-emerald-400 font-bold text-xs leading-tight flex flex-col items-center">
                                  {(() => {
                                    const parts = formatCurrency(line.netTotal).trim().split(/\s+/);
                                    if (parts.length >= 2) {
                                      const unit = parts.pop();
                                      const amount = parts.join(' ');
                                      return (
                                        <>
                                          <span>{amount}</span>
                                          <span className="text-[10px] font-semibold">{unit}</span>
                                        </>
                                      );
                                    }
                                    return <span>{formatCurrency(line.netTotal)}</span>;
                                  })()}
                                </div>
                              </td>

                              {/* 6. ACTIONS (PILULES MODIFIER + REMISE + POUBELLE ROUGE) */}
                              <td className="py-3 px-3 align-middle whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingLineIndex(idx)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-colors"
                                    title="Modifier tous les paramètres de cette prestation"
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                                    <span>Modifier</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenRemiseModal(idx)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold shadow-2xs transition-colors ${
                                      line.discountAmount > 0
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs'
                                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                    title="Appliquer ou modifier une remise sur cette ligne"
                                  >
                                    <Tag className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                                    <span>Remise</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLine(idx)}
                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-colors ml-0.5"
                                    title="Supprimer la ligne"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>

            {/* 6. TOTAL TOUJOURS VISIBLE : Sticky Bottom Bar */}
            <div className="p-3 bg-white dark:bg-slate-950 border-t-2 border-slate-200 dark:border-slate-800 shadow-xl space-y-3 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Financial Totals */}
                <div className="flex items-center gap-4 sm:gap-6">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Sous-total</span>
                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                      {formatCurrency(totals.grossSubtotal)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Remise</span>
                    <span className="font-extrabold text-xs text-emerald-600">
                      {totals.totalDiscount > 0 ? `-${formatCurrency(totals.totalDiscount)}` : '0 GNF'}
                    </span>
                  </div>

                  <div className="p-1.5 bg-brand-50 dark:bg-brand-950/60 rounded-xl border border-brand-200 dark:border-brand-800">
                    <span className="text-[9px] text-brand-600 dark:text-brand-400 font-black uppercase block">
                      TOTAL À PAYER
                    </span>
                    <span className="font-black text-lg text-brand-700 dark:text-brand-300">
                      {formatCurrency(totals.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Quick Payment Mode Selector */}
                <div className="flex items-center gap-2">
                  <Select
                    value={paymentOption}
                    onChange={(e) => setPaymentOption(e.target.value as any)}
                    className="text-xs font-bold py-1 h-8"
                  >
                    <option value="FULL">🟢 Paiement 100% (Comptant)</option>
                    <option value="PARTIAL">🟠 Acompte (Partiel)</option>
                    <option value="UNPAID">🔴 Non Payé (Crédit)</option>
                  </Select>

                  {paymentOption === 'PARTIAL' && (
                    <Input
                      type="number"
                      min={0}
                      max={totals.totalAmount}
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(Number(e.target.value))}
                      className="w-28 text-xs font-bold h-8"
                      placeholder="Acompte GNF"
                    />
                  )}

                  <Select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="text-xs font-bold py-1 h-8"
                  >
                    <option value="CASH">💵 Espèces</option>
                    <option value="ORANGE_MONEY">📱 Orange Money</option>
                    <option value="MTN_MOMO">📱 MTN Momo</option>
                    <option value="BANK_TRANSFER">🏦 Virement</option>
                  </Select>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleModalClose}
                    className="font-bold text-xs h-9 px-4"
                  >
                    Annuler
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    icon={CheckCircle2}
                    disabled={isSubmitting}
                    className="font-black text-xs bg-brand-600 hover:bg-brand-700 px-6 h-9 shadow-md shadow-brand-500/20"
                  >
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer la commande'}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* 3. MODAL / PANNEAU D'ÉDITION DES PARAMÈTRES D'UNE LIGNE (OUVERT AU CLIC SUR MODIFIER) */}
      {editingLineIndex !== null && currentEditingLine && (
        <Modal
          isOpen={editingLineIndex !== null}
          onClose={() => setEditingLineIndex(null)}
          title={`Paramètres Détaillés — ${currentEditingLine.name}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs pt-1">
            {/* Header info */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <Badge variant={currentEditingLine.itemType === 'SERVICE' ? 'primary' : 'warning'} size="sm" className="font-bold">
                  {currentEditingLine.itemType === 'SERVICE' ? 'Prestation' : 'Article Stock Central'}
                </Badge>
                <strong className="text-slate-900 dark:text-white font-bold block text-sm mt-0.5">
                  {currentEditingLine.name}
                </strong>
              </div>
              <div className="text-right font-mono">
                <span className="text-slate-400 block text-[10px]">P.U. Appliqué</span>
                <span className="font-black text-sm text-brand-600">{formatCurrency(currentEditingLine.appliedUnitPrice)}</span>
              </div>
            </div>

            {/* PRESTATION SPECIFICATIONS & OPTIONS */}
            {currentEditingLine.itemType === 'SERVICE' && currentEditingLine.service && (
              <div className="space-y-3 p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 text-brand-500" />
                  Spécifications & Caractéristiques
                </h4>

                {/* Service Specs Groups */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {getServiceSpecificationGroups(currentEditingLine.service).map(group => {
                    const currentSelectedOpt = getSelectedSpecOption(group, currentEditingLine.notes);
                    const currentSelectedVal = currentSelectedOpt?.name || (typeof group.options[0] === 'string' ? group.options[0] : group.options[0]?.name) || '';
                    return (
                      <div key={group.name} className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                          {group.name}
                        </label>
                        <Select
                          value={currentSelectedVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (editingLineIndex !== null) {
                              handleUpdateLineOption(editingLineIndex, group.name, val);
                            }
                          }}
                          className="text-xs font-medium"
                        >
                          {group.options.map(opt => {
                            const resolved = resolveSpecOption(opt);
                            return (
                              <option key={resolved.name} value={resolved.name}>
                                {resolved.name} {resolved.unitPrice ? `(${formatCurrency(resolved.unitPrice)})` : ''}
                              </option>
                            );
                          })}
                        </Select>
                      </div>
                    );
                  })}
                </div>

                {/* Quantité Dynamique selon la prestation */}
                {isPageServiceLine(currentEditingLine) ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Nombre de pages doc original
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={currentEditingLine.pageCount || 1}
                          onChange={(e) => handleUpdateLine(editingLineIndex, { pageCount: Number(e.target.value) })}
                          className="text-sm font-bold h-10"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Nombre de tirages / exemplaires
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={currentEditingLine.copiesCount || 1}
                          onChange={(e) => handleUpdateLine(editingLineIndex, { copiesCount: Number(e.target.value) })}
                          className="text-sm font-bold h-10"
                        />
                      </div>
                    </div>

                    <div className="p-2 bg-brand-50/50 dark:bg-brand-950/30 rounded-lg text-center font-bold text-brand-700 dark:text-brand-300">
                      Quantité Totale Facturée : {(currentEditingLine.pageCount || 1)} page(s) × {(currentEditingLine.copiesCount || 1)} tirage(s) = {currentEditingLine.quantity} {currentEditingLine.unit}s
                    </div>
                  </>
                ) : (
                  <>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Quantité ({currentEditingLine.unit || 'document'})
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateLine(editingLineIndex, { quantity: Math.max(1, (currentEditingLine.quantity || 1) - 1) })}
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-lg transition-colors border border-slate-300 dark:border-slate-700 select-none"
                          title="Diminuer"
                        >
                          -
                        </button>
                        <Input
                          type="number"
                          min={1}
                          value={currentEditingLine.quantity || 1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            handleUpdateLine(editingLineIndex, {
                              quantity: isNaN(val) ? 1 : Math.max(1, val)
                            });
                          }}
                          className="text-sm font-bold h-10 w-28 text-center"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateLine(editingLineIndex, { quantity: (currentEditingLine.quantity || 1) + 1 })}
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-lg transition-colors border border-slate-300 dark:border-slate-700 select-none"
                          title="Augmenter"
                        >
                          +
                        </button>
                        <span className="font-semibold text-slate-600 dark:text-slate-300 text-sm">
                          {currentEditingLine.unit || 'document'}(s)
                        </span>
                      </div>
                    </div>

                    <div className="p-2 bg-brand-50/50 dark:bg-brand-950/30 rounded-lg text-center font-bold text-brand-700 dark:text-brand-300">
                      Quantité Totale : {currentEditingLine.quantity} {currentEditingLine.unit || 'document'}s
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ARTICLE / PRODUCT OPTIONS */}
            {currentEditingLine.itemType === 'PRODUCT' && currentEditingLine.product && (
              <div className="space-y-3 p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-amber-500" />
                  Paramètres de Vente Article
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Quantité Vendue ({currentEditingLine.unit})
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={currentEditingLine.currentStock || 9999}
                      value={currentEditingLine.quantity}
                      onChange={(e) => handleUpdateLine(editingLineIndex, { quantity: Math.max(1, Number(e.target.value)) })}
                      className="text-xs font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Stock dispo : {currentEditingLine.currentStock} {currentEditingLine.stockUnit}</span>
                  </div>

                  {currentEditingLine.product.conversionFactor && currentEditingLine.product.conversionFactor > 1 && (
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Unité de vente
                      </label>
                      <Select
                        value={currentEditingLine.usePurchaseUnit ? 'PURCHASE' : 'UNIT'}
                        onChange={(e) => handleUpdateLine(editingLineIndex, { usePurchaseUnit: e.target.value === 'PURCHASE' })}
                        className="text-xs font-bold"
                      >
                        <option value="UNIT">À l'unité ({currentEditingLine.product.unit})</option>
                        <option value="PURCHASE">Au carton/paquet ({currentEditingLine.product.purchaseUnit} × {currentEditingLine.product.conversionFactor})</option>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TARIFICATION SUR-MESURE & REMISE */}
            <div className="space-y-3 p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentEditingLine.isCustomPrice}
                    onChange={(e) => handleUpdateLine(editingLineIndex, { isCustomPrice: e.target.checked })}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>Activer un prix unitaire sur-mesure</span>
                </label>
              </div>

              {currentEditingLine.isCustomPrice && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Prix Unitaire Personnalisé (GNF)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={currentEditingLine.customUnitPrice !== undefined ? currentEditingLine.customUnitPrice : currentEditingLine.standardUnitPrice}
                      onChange={(e) => handleUpdateLine(editingLineIndex, { customUnitPrice: Number(e.target.value) })}
                      className="text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Catégorie de Remise / Négociation
                    </label>
                    <Select
                      value={currentEditingLine.discountReasonCategory}
                      onChange={(e) => handleUpdateLine(editingLineIndex, { discountReasonCategory: e.target.value as any })}
                      className="text-xs"
                    >
                      <option value="COMMERCIAL_NEGOTIATION">Négociation Commerciale</option>
                      <option value="VOLUME">Remise de Volume</option>
                      <option value="LOYALTY">Fidélité Client</option>
                      <option value="INSTITUTIONAL">Partenariat Institutionnel</option>
                      <option value="PROMOTION">Offre Promotionnelle</option>
                      <option value="OTHER">Autre motif</option>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* DEPARTEMENT & NOTES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Département Affecté
                </label>
                <Select
                  value={currentEditingLine.assignedDepartment}
                  onChange={(e) => handleUpdateLine(editingLineIndex, { assignedDepartment: e.target.value as any })}
                  className="text-xs"
                >
                  <option value="PHOTOCOPY">📄 Photocopie</option>
                  <option value="PRINT">🖨️ Impression Numérique</option>
                  <option value="FINISHING">📚 Reliure & Finition</option>
                  <option value="DESIGN">🎨 Infographie / Graphisme</option>
                  <option value="PHOTO">📸 Studio Photo</option>
                  <option value="STORE">🛒 Magasin / Stock Central</option>
                </Select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Notes & Instructions Spéciales
                </label>
                <Input
                  type="text"
                  placeholder="Notes particulières..."
                  value={currentEditingLine.notes}
                  onChange={(e) => handleUpdateLine(editingLineIndex, { notes: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Validation Button */}
            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="primary"
                icon={Check}
                onClick={() => setEditingLineIndex(null)}
                className="bg-brand-600 hover:bg-brand-700 font-extrabold text-xs px-6 py-2"
              >
                Enregistrer les modifications
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. MODAL COMPACT DE REMISE SUR UNE LIGNE */}
      {remiseLineIndex !== null && calculatedLines[remiseLineIndex] && (() => {
        const currentRemiseLine = calculatedLines[remiseLineIndex];
        const grossTotal = currentRemiseLine.grossTotal;
        const currentNewAmount = Number(remiseNewAmount) || 0;
        const discountDiff = Math.max(0, grossTotal - currentNewAmount);
        const discountPct = grossTotal > 0 ? Number(((discountDiff / grossTotal) * 100).toFixed(1)) : 0;

        return (
          <Modal
            isOpen={remiseLineIndex !== null}
            onClose={() => setRemiseLineIndex(null)}
            title={`Appliquer une Remise — ${currentRemiseLine.name}`}
            maxWidth="sm"
          >
            <div className="space-y-4 text-xs pt-1">
              {/* Détails du montant initial */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Prestation / Fourniture :</span>
                  <strong className="text-slate-900 dark:text-white font-bold">{currentRemiseLine.name}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Montant initial (Tarif configuré) :</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {formatCurrency(grossTotal)}
                  </span>
                </div>
                {currentRemiseLine.isCustomPrice && (
                  <div className="flex justify-between items-center text-emerald-600 font-semibold pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <span>Montant actuellement remisé :</span>
                    <span className="font-mono font-bold">{formatCurrency(currentRemiseLine.netTotal)}</span>
                  </div>
                )}
              </div>

              {/* Saisie du nouveau montant */}
              <div className="space-y-1.5">
                <label className="font-black text-slate-900 dark:text-white block text-xs">
                  Nouveau montant souhaité (GNF) *
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    value={remiseNewAmount}
                    onChange={(e) => setRemiseNewAmount(Math.max(0, Number(e.target.value)))}
                    className="text-base font-black text-brand-600 dark:text-brand-400 h-10 pr-12"
                    placeholder="ex: 8000"
                    autoFocus
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    GNF
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400">
                    P.U. effectif : {formatCurrency(currentRemiseLine.quantity > 0 ? Math.round(currentNewAmount / currentRemiseLine.quantity) : currentNewAmount)}
                  </span>
                  {discountDiff > 0 ? (
                    <Badge variant="success" size="sm" className="font-bold">
                      Remise : -{formatCurrency(discountDiff)} (-{discountPct}%)
                    </Badge>
                  ) : currentNewAmount > grossTotal ? (
                    <Badge variant="warning" size="sm" className="font-bold">
                      Majoration : +{formatCurrency(currentNewAmount - grossTotal)}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">Tarif standard</span>
                  )}
                </div>
              </div>

              {/* Motif de la remise */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  Motif de la remise / négociation
                </label>
                <Select
                  value={remiseCategory}
                  onChange={(e) => setRemiseCategory(e.target.value as any)}
                  className="text-xs font-semibold"
                >
                  <option value="COMMERCIAL_NEGOTIATION">🤝 Négociation Commerciale</option>
                  <option value="VOLUME">📦 Remise sur Volume / Quantité</option>
                  <option value="LOYALTY">⭐ Fidélité Client Régulier</option>
                  <option value="INSTITUTIONAL">🏛️ Partenariat Institutionnel / ONG</option>
                  <option value="PROMOTION">🏷️ Offre Promotionnelle</option>
                  <option value="OTHER">📝 Autre motif spécifique</option>
                </Select>
              </div>

              {remiseCategory === 'OTHER' && (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1 text-[11px]">
                    Préciser le motif
                  </label>
                  <Input
                    type="text"
                    placeholder="ex: Accord verbal gérant..."
                    value={remiseCustomReason}
                    onChange={(e) => setRemiseCustomReason(e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  {currentRemiseLine.isCustomPrice && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleUpdateLine(remiseLineIndex, {
                          isCustomPrice: false,
                          customUnitPrice: undefined,
                        });
                        setRemiseLineIndex(null);
                        showToast('Plein tarif rétabli', 'La remise a été retirée sur cette ligne.', 'INFO');
                      }}
                      className="text-slate-500 hover:text-slate-800 text-[11px]"
                    >
                      Rétablir plein tarif
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRemiseLineIndex(null)}
                    className="text-xs"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Check}
                    onClick={() => {
                      const qty = currentRemiseLine.quantity || 1;
                      const newTotal = Math.max(0, Number(remiseNewAmount));
                      if (newTotal === grossTotal) {
                        handleUpdateLine(remiseLineIndex, {
                          isCustomPrice: false,
                          customUnitPrice: undefined,
                        });
                      } else {
                        const newUnitPrice = qty > 0 ? (newTotal / qty) : newTotal;
                        handleUpdateLine(remiseLineIndex, {
                          isCustomPrice: true,
                          customUnitPrice: newUnitPrice,
                          discountReasonCategory: remiseCategory,
                          discountReasonCustom: remiseCustomReason,
                        });
                      }
                      setRemiseLineIndex(null);
                      showToast('Remise Appliquée', `Le montant de la ligne a été actualisé à ${formatCurrency(newTotal)}.`, 'SUCCESS');
                    }}
                    className="bg-brand-600 hover:bg-brand-700 font-bold text-xs"
                  >
                    Appliquer
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* 5. MODAL DE REÇU / FACTURE DÉTAILLÉ */}
      {receiptPayment && (
        <PaymentReceiptModal
          payment={receiptPayment}
          order={receiptOrder}
          onClose={() => setReceiptPayment(null)}
        />
      )}

      {/* QUICK CLIENT CREATION MODAL */}
      {isCreatingNewPerson && (
        <Modal
          isOpen={isCreatingNewPerson}
          onClose={() => setIsCreatingNewPerson(false)}
          title="Nouveau Client Rapide"
          maxWidth="sm"
        >
          <div className="space-y-4 pt-1 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nom complet ou Raison Sociale *
              </label>
              <Input
                type="text"
                placeholder="ex: Mohamed Sylla, SARL Konia..."
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                className="text-xs"
              />
            </div>

            <PhoneInput
              label="Téléphone *"
              placeholder="ex: +224 6XX XX XX XX"
              value={newPersonPhone}
              onChange={(e) => setNewPersonPhone(e.target.value)}
              className="text-xs"
            />

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Type de client
              </label>
              <Select
                value={newPersonType}
                onChange={(e) => setNewPersonType(e.target.value as any)}
                className="text-xs font-medium"
              >
                <option value="ALL">👤 Particulier</option>
                <option value="COMPANY">🏢 Entreprise / Société</option>
                <option value="STUDENT">🎓 Étudiant / Élève</option>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setIsCreatingNewPerson(false)}>
                Annuler
              </Button>
              <Button variant="primary" onClick={handleCreateNewPerson} className="font-bold">
                Enregistrer le client
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
