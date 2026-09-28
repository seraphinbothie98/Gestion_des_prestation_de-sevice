import { Product, ProductPackaging, Service, PurchaseOrder, OrderItem, ServiceConsumableConfig, ConsumableMode } from '../types';
import { resolveServiceSpecsImpact } from './serviceSpecs';

/**
 * Calculates the exact consumable quantity for a service line,
 * taking into account recto-verso sheet division for photocopy & print.
 * Example: 8 pages in recto-verso = 4 sheets (feuilles), 9 pages = 5 sheets (feuilles).
 */
export function calculateEffectiveServiceConsumableQty(
  service: Service,
  itemOrLine: { quantity: number; pageCount?: number; copiesCount?: number; notes?: string; description?: string },
  consumable: { quantityPerUnit: number; unit?: string; productName?: string },
  product?: Product
): number {
  const notes = (itemOrLine.notes || itemOrLine.description || '').toLowerCase();
  const srvName = (service.name || '').toLowerCase();
  const isPrintOrCopy = srvName.includes('photocopi') || srvName.includes('impress') || srvName.includes('print') || srvName.includes('copie') || (service.unit || '').toLowerCase() === 'page' || (service.unit || '').toLowerCase() === 'feuille';
  const isRectoVerso = notes.includes('recto-verso') || notes.includes('recto verso') || notes.includes('recto/verso') || notes.includes('2 faces');

  const unit = (consumable.unit || product?.unit || product?.baseUnit || '').toLowerCase();
  const prodName = (consumable.productName || product?.name || '').toLowerCase();
  const isSheetConsumable = unit.includes('feuille') || unit.includes('sheet') || prodName.includes('papier') || prodName.includes('ramette') || prodName.includes('feuille');

  if (isPrintOrCopy && isRectoVerso && isSheetConsumable) {
    const pageCount = itemOrLine.pageCount ?? itemOrLine.quantity ?? 1;
    const copiesCount = itemOrLine.copiesCount ?? 1;
    const sheetsPerCopy = Math.ceil(pageCount / 2);
    const totalSheets = sheetsPerCopy * copiesCount;
    return Number((totalSheets * (consumable.quantityPerUnit || 1)).toFixed(4));
  }

  return Number(((itemOrLine.quantity || 1) * (consumable.quantityPerUnit || 1)).toFixed(4));
}

export interface ProductUnitDefinition {
  unitName: string;
  level: number; // 1 = baseUnit, 2 = first packaging, 3 = second packaging...
  factorToBase: number;
  containedQuantity: number;
  subUnitName: string;
  salePrice?: number;
  purchasePrice?: number;
  wholesalePrice?: number;
  isBaseUnit: boolean;
  isAllowedForSale: boolean;
  isAllowedForPurchase: boolean;
  isDefaultSaleUnit: boolean;
  isDefaultPurchaseUnit: boolean;
  barcode?: string;
}

export interface StockRequirement {
  productId: string;
  productName: string;
  productCode: string;
  category: string;
  requiredQtyBaseUnit: number; // in baseUnit
  baseUnit: string;
  sourceTypes: ('BOUTIQUE_SALE' | 'INTERNAL_CONSUMPTION')[];
  sourceDescriptions: string[];
}

export type StockEvaluationStatus = 'SUFFICIENT' | 'LOW_STOCK' | 'RESTOCK_IN_PROGRESS' | 'INSUFFICIENT';

export interface StockEvaluation {
  productId: string;
  productName: string;
  productCode: string;
  category: string;
  currentStock: number; // in baseUnit
  minStockAlert: number; // in baseUnit
  totalRequired: number; // in baseUnit
  baseUnit: string;
  stockUnit: string; // alias for baseUnit
  defaultPurchaseUnit: string;
  purchaseUnit: string; // alias for defaultPurchaseUnit
  purchaseConversionFactor: number;
  conversionFactor: number; // alias for purchaseConversionFactor
  missingQty: number; // in baseUnit
  remainingStockAfter: number; // in baseUnit
  pendingIncomingQty: number; // in baseUnit
  openPoNumbers: string[];
  status: StockEvaluationStatus;
  recommendedPurchaseQty: number; // in defaultPurchaseUnit
  recommendedPurchaseUnitName: string;
  usualSupplierId?: string;
  usualSupplierName?: string;
  costPrice: number; // in baseUnit
  purchasePricePerPurchaseUnit: number;
  allowNegativeStock?: boolean;
  smartStockFormatted?: string;
}

/**
 * Normalizes and extracts all available units for a product (Base Unit + all configured Packagings).
 */
export function getAvailableProductUnits(product: Product): ProductUnitDefinition[] {
  const baseUnitName = product.baseUnit || product.unit || 'unité';
  const units: ProductUnitDefinition[] = [];

  // Level 1: Base Unit
  const isBaseDefaultSale = !product.defaultSaleUnit || product.defaultSaleUnit.toLowerCase() === baseUnitName.toLowerCase();
  const isBaseDefaultPurchase = !product.defaultPurchaseUnit || product.defaultPurchaseUnit.toLowerCase() === baseUnitName.toLowerCase();

  units.push({
    unitName: baseUnitName,
    level: 1,
    factorToBase: 1,
    containedQuantity: 1,
    subUnitName: baseUnitName,
    salePrice: product.salePrice,
    purchasePrice: product.costPrice,
    wholesalePrice: product.wholesalePrice,
    isBaseUnit: true,
    isAllowedForSale: true,
    isAllowedForPurchase: true,
    isDefaultSaleUnit: isBaseDefaultSale,
    isDefaultPurchaseUnit: isBaseDefaultPurchase,
    barcode: product.barcode,
  });

  // Packagings (Levels 2, 3, 4...)
  if (product.packagings && product.packagings.length > 0) {
    const sorted = [...product.packagings].sort((a, b) => a.level - b.level);
    sorted.forEach(p => {
      const isDefSale = product.defaultSaleUnit ? product.defaultSaleUnit.toLowerCase() === p.unitName.toLowerCase() : !!p.isDefaultSaleUnit;
      const isDefPurch = product.defaultPurchaseUnit ? product.defaultPurchaseUnit.toLowerCase() === p.unitName.toLowerCase() : !!p.isDefaultPurchaseUnit;

      const specificPrice = (p.purchasePrice !== undefined && p.purchasePrice !== null && p.purchasePrice > 0) ? p.purchasePrice : undefined;
      const resolvedPurchasePrice = specificPrice !== undefined
        ? specificPrice
        : ((product.costPrice && product.costPrice > 0) ? Math.round(product.costPrice * (p.factorToBase || 1)) : undefined);

      units.push({
        unitName: p.unitName,
        level: p.level || 2,
        factorToBase: p.factorToBase > 0 ? p.factorToBase : (p.containedQuantity || 1),
        containedQuantity: p.containedQuantity,
        subUnitName: p.subUnitName || baseUnitName,
        salePrice: p.salePrice !== undefined ? p.salePrice : (product.salePrice ? product.salePrice * (p.factorToBase || 1) : undefined),
        purchasePrice: resolvedPurchasePrice,
        wholesalePrice: p.wholesalePrice,
        isBaseUnit: false,
        isAllowedForSale: p.isAllowedForSale !== false,
        isAllowedForPurchase: p.isAllowedForPurchase !== false,
        isDefaultSaleUnit: isDefSale,
        isDefaultPurchaseUnit: isDefPurch,
        barcode: p.barcode,
      });
    });
  } else if (product.purchaseUnit && product.purchaseUnit.toLowerCase() !== baseUnitName.toLowerCase() && (product.conversionFactor || 1) > 1) {
    // Legacy fallback for single conversion factor
    const factor = product.conversionFactor || 1;
    const resolvedPurchasePrice = product.purchasePricePerPurchaseUnit || (product.costPrice ? Math.round(product.costPrice * factor) : undefined);
    units.push({
      unitName: product.purchaseUnit,
      level: 2,
      factorToBase: factor,
      containedQuantity: factor,
      subUnitName: baseUnitName,
      salePrice: product.salePricePerPurchaseUnit || (product.salePrice ? product.salePrice * factor : undefined),
      purchasePrice: resolvedPurchasePrice,
      wholesalePrice: product.wholesalePrice ? product.wholesalePrice * factor : undefined,
      isBaseUnit: false,
      isAllowedForSale: true,
      isAllowedForPurchase: true,
      isDefaultSaleUnit: false,
      isDefaultPurchaseUnit: true,
    });
  }

  return units;
}

/**
 * Returns available units specifically allowed for supplier purchasing.
 */
export function getProductPurchaseUnits(product: Product): ProductUnitDefinition[] {
  const all = getAvailableProductUnits(product);
  const allowed = all.filter(u => u.isAllowedForPurchase !== false);
  return allowed.length > 0 ? allowed : all;
}

export interface ResolvedPurchasePrice {
  unitPrice: number;
  factorToBase: number;
  isSpecificPrice: boolean;
  hasPriceConfigured: boolean;
  conversionDescription: string;
  unitPriceStockEquivalent: number;
  selectedUnitName: string;
  baseUnitName: string;
}

/**
 * Resolves purchase price and conversion factor according to strict business priorities:
 * 1. Specific purchase price configured on packaging (pkg.purchasePrice > 0).
 * 2. Reference base unit cost price converted (product.costPrice * factorToBase).
 * 3. 0 with clear indication if no price is configured.
 */
export function resolveProductPurchasePrice(product: Product, unitName?: string): ResolvedPurchasePrice {
  const baseUnitName = product.baseUnit || product.unit || 'unité';
  const allUnits = getProductPurchaseUnits(product);
  
  const selectedUnit = (unitName && allUnits.find(u => u.unitName.toLowerCase() === unitName.trim().toLowerCase()))
    || allUnits.find(u => u.isDefaultPurchaseUnit)
    || allUnits[0];

  const targetUnitName = selectedUnit ? selectedUnit.unitName : (unitName || baseUnitName);
  const factor = selectedUnit ? selectedUnit.factorToBase : (unitName ? getUnitConversionFactor(unitName, product) : 1);
  const isBase = selectedUnit ? selectedUnit.isBaseUnit : (targetUnitName.toLowerCase() === baseUnitName.toLowerCase());

  let unitPrice = 0;
  let isSpecificPrice = false;

  if (isBase) {
    if (product.costPrice !== undefined && product.costPrice !== null && product.costPrice > 0) {
      unitPrice = product.costPrice;
      isSpecificPrice = true;
    }
  } else {
    // 1. Check specific packaging price
    const pkg = product.packagings?.find(p => p.unitName.toLowerCase() === targetUnitName.toLowerCase());
    if (pkg && pkg.purchasePrice !== undefined && pkg.purchasePrice !== null && pkg.purchasePrice > 0) {
      unitPrice = pkg.purchasePrice;
      isSpecificPrice = true;
    } else if (
      product.purchaseUnit &&
      product.purchaseUnit.toLowerCase() === targetUnitName.toLowerCase() &&
      product.purchasePricePerPurchaseUnit !== undefined &&
      product.purchasePricePerPurchaseUnit > 0
    ) {
      unitPrice = product.purchasePricePerPurchaseUnit;
      isSpecificPrice = true;
    } else if (product.costPrice !== undefined && product.costPrice !== null && product.costPrice > 0) {
      // 2. Base unit cost converted
      unitPrice = Math.round(product.costPrice * factor);
      isSpecificPrice = false;
    }
  }

  const hasPriceConfigured = unitPrice > 0;
  const unitPriceStockEquivalent = factor > 0 ? (isBase ? unitPrice : (isSpecificPrice ? Math.round(unitPrice / factor) : (product.costPrice || 0))) : unitPrice;

  // Build descriptive conversion text
  let conversionDescription = `1 ${targetUnitName} = ${factor.toLocaleString('fr-FR')} ${baseUnitName}${factor > 1 && !baseUnitName.endsWith('s') ? 's' : ''}`;
  if (factor === 1) {
    conversionDescription = `Unité de référence (${baseUnitName})`;
  } else if (product.packagings && product.packagings.length > 0) {
    const pkg = product.packagings.find(p => p.unitName.toLowerCase() === targetUnitName.toLowerCase());
    if (pkg && pkg.subUnitName && pkg.subUnitName.toLowerCase() !== baseUnitName.toLowerCase()) {
      conversionDescription = `1 ${targetUnitName} = ${pkg.containedQuantity} ${pkg.subUnitName}s = ${factor.toLocaleString('fr-FR')} ${baseUnitName}s`;
    }
  }

  return {
    unitPrice,
    factorToBase: factor,
    isSpecificPrice,
    hasPriceConfigured,
    conversionDescription,
    unitPriceStockEquivalent,
    selectedUnitName: targetUnitName,
    baseUnitName
  };
}

/**
 * Returns the conversion factor from a given unitName to baseUnit for a product.
 */
export function getUnitConversionFactor(unitName: string | undefined, product: Product): number {
  if (!unitName) return 1;
  const baseUnitName = product.baseUnit || product.unit || 'unité';
  if (unitName.toLowerCase() === baseUnitName.toLowerCase()) return 1;

  const allUnits = getAvailableProductUnits(product);
  const found = allUnits.find(u => u.unitName.toLowerCase() === unitName.toLowerCase());
  return found ? found.factorToBase : 1;
}

/**
 * Converts a quantity in a specific unit to base reference unit.
 */
export function convertToBaseQuantity(quantity: number, unitName: string | undefined, product: Product): number {
  const factor = getUnitConversionFactor(unitName, product);
  return Number((quantity * factor).toFixed(4));
}

/**
 * Converts a base quantity into a specific target unit.
 */
export function convertFromBaseQuantity(baseQuantity: number, targetUnitName: string | undefined, product: Product): number {
  const factor = getUnitConversionFactor(targetUnitName, product);
  if (factor <= 0) return baseQuantity;
  return Number((baseQuantity / factor).toFixed(4));
}

/**
 * Formats a raw stock quantity into a human-readable decomposed hierarchy.
 * Example: 21 998 feuilles -> "8 cartons, 4 paquets, 498 feuilles (21 998 feuilles)"
 */
export function formatSmartStockBreakdown(baseQuantity: number, product: Product): string {
  const baseUnit = product.baseUnit || product.unit || 'unité';
  const allUnits = getAvailableProductUnits(product);

  if (allUnits.length <= 1 || baseQuantity <= 0) {
    return `${baseQuantity.toLocaleString('fr-FR')} ${baseUnit}${baseQuantity > 1 && !baseUnit.endsWith('s') ? 's' : ''}`;
  }

  // Sort packagings from highest level (e.g. Carton) to lowest (e.g. Paquet)
  const packagingLevels = allUnits
    .filter(u => !u.isBaseUnit && u.factorToBase > 1)
    .sort((a, b) => b.factorToBase - a.factorToBase);

  let remaining = Math.round(baseQuantity);
  const parts: string[] = [];

  for (const pkg of packagingLevels) {
    if (pkg.factorToBase <= 0) continue;
    const count = Math.floor(remaining / pkg.factorToBase);
    if (count > 0) {
      parts.push(`${count.toLocaleString('fr-FR')} ${pkg.unitName}${count > 1 && !pkg.unitName.endsWith('s') ? 's' : ''}`);
      remaining = remaining % pkg.factorToBase;
    }
  }

  if (remaining > 0 || parts.length === 0) {
    parts.push(`${remaining.toLocaleString('fr-FR')} ${baseUnit}${remaining > 1 && !baseUnit.endsWith('s') ? 's' : ''}`);
  }

  if (parts.length > 1) {
    return `${parts.join(', ')} (${baseQuantity.toLocaleString('fr-FR')} ${baseUnit}s)`;
  }

  return parts[0] || `${baseQuantity.toLocaleString('fr-FR')} ${baseUnit}`;
}

/**
 * Validates and recursively calculates factorToBase for a list of packaging levels.
 */
export function recalculatePackagingFactors(
  baseUnit: string,
  packagings: ProductPackaging[]
): { packagings: ProductPackaging[]; error?: string } {
  const cleanBase = (baseUnit || 'unité').trim().toLowerCase();
  const result: ProductPackaging[] = [];

  // Map of unitName -> factorToBase
  const factorMap = new Map<string, number>();
  factorMap.set(cleanBase, 1);

  // Sort by level ascending
  const sorted = [...packagings].sort((a, b) => (a.level || 2) - (b.level || 2));

  for (let i = 0; i < sorted.length; i++) {
    const pkg = sorted[i];
    const unitName = (pkg.unitName || '').trim();
    const subUnit = (pkg.subUnitName || cleanBase).trim().toLowerCase();
    const contained = Number(pkg.containedQuantity) || 1;

    if (!unitName) {
      return { packagings, error: `Le conditionnement #${i + 1} doit avoir un nom d'unité (ex: Paquet, Carton).` };
    }

    if (unitName.toLowerCase() === cleanBase) {
      return { packagings, error: `L'unité "${unitName}" ne peut pas être à la fois l'unité de base et un conditionnement supérieur.` };
    }

    if (contained <= 0) {
      return { packagings, error: `Le conditionnement "${unitName}" doit contenir une quantité strictement positive (> 0).` };
    }

    const subFactor = factorMap.get(subUnit);
    if (!subFactor) {
      return {
        packagings,
        error: `L'unité inférieure "${pkg.subUnitName}" pour "${unitName}" est inconnue. Elle doit être l'unité de base "${baseUnit}" ou un conditionnement de niveau inférieur.`,
      };
    }

    const factorToBase = contained * subFactor;
    factorMap.set(unitName.toLowerCase(), factorToBase);

    result.push({
      ...pkg,
      level: i + 2,
      unitName,
      subUnitName: pkg.subUnitName || baseUnit,
      containedQuantity: contained,
      factorToBase,
    });
  }

  return { packagings: result };
}

/**
 * Calculates aggregate stock requirements from direct boutique items and service internal consumptions.
 */
export function calculateOrderStockRequirements(
  linesOrOrder: any,
  servicesOrProducts?: any[],
  optionalProducts?: any[]
): StockRequirement[] {
  const reqMap = new Map<string, StockRequirement>();

  // Normalize input
  let rawLines: any[] = [];
  if (Array.isArray(linesOrOrder)) {
    rawLines = linesOrOrder;
  } else if (linesOrOrder && Array.isArray(linesOrOrder.items)) {
    rawLines = linesOrOrder.items.map((it: any) => ({
      itemType: it.serviceId ? 'SERVICE' : 'PRODUCT',
      serviceId: it.serviceId,
      productId: it.productId,
      quantity: it.quantity,
      unit: it.unit,
      notes: it.notes,
      description: it.notes,
      stockDeduction: it.stockDeduction
    }));
  }

  // Resolve services and products arguments
  let services: Service[] = [];
  let products: Product[] = [];

  const isServiceList = (arr: any[]) => arr.length > 0 && ('baseCost' in arr[0] || 'requiresFile' in arr[0] || 'pricingRules' in arr[0]);
  const isProductList = (arr: any[]) => arr.length > 0 && ('currentStock' in arr[0] || 'purchasePrice' in arr[0] || 'sellingPrice' in arr[0]);

  if (Array.isArray(servicesOrProducts)) {
    if (isServiceList(servicesOrProducts)) {
      services = servicesOrProducts;
      products = Array.isArray(optionalProducts) ? optionalProducts : [];
    } else if (isProductList(servicesOrProducts)) {
      products = servicesOrProducts;
      services = Array.isArray(optionalProducts) ? optionalProducts : [];
    } else {
      services = servicesOrProducts;
      products = Array.isArray(optionalProducts) ? optionalProducts : [];
    }
  }

  rawLines.forEach(line => {
    if (line.itemType === 'PRODUCT' && line.productId) {
      const prod = products.find(p => p.id === line.productId);
      if (!prod) return;

      const baseUnit = prod.baseUnit || prod.unit || 'unité';
      const selectedUnit = line.unitName || line.unit || (line.usePurchaseUnit ? (prod.purchaseUnit || 'carton') : baseUnit);
      
      const deductionInBase = line.stockDeduction !== undefined
        ? line.stockDeduction
        : convertToBaseQuantity(line.quantity, selectedUnit, prod);


      const existing = reqMap.get(prod.id);
      const desc = `Vente directe : ${line.quantity} ${selectedUnit} (= ${deductionInBase} ${baseUnit})`;

      if (existing) {
        existing.requiredQtyBaseUnit += deductionInBase;
        if (!existing.sourceTypes.includes('BOUTIQUE_SALE')) {
          existing.sourceTypes.push('BOUTIQUE_SALE');
        }
        existing.sourceDescriptions.push(desc);
      } else {
        reqMap.set(prod.id, {
          productId: prod.id,
          productName: prod.name,
          productCode: prod.code,
          category: prod.category,
          requiredQtyBaseUnit: deductionInBase,
          baseUnit,
          sourceTypes: ['BOUTIQUE_SALE'],
          sourceDescriptions: [desc],
        });
      }
    } else if (line.itemType === 'SERVICE' && line.serviceId) {
      const srv = services.find(s => s.id === line.serviceId);
      if (!srv) return;

      const hasConfigConsumables = (srv.configurations || []).some(c => (c.consumables || []).length > 0);
      const mode = srv.consumableMode || (hasConfigConsumables ? 'INTERNAL_VARIABLE' : (srv.consumables && srv.consumables.length > 0 ? 'INTERNAL_VARIABLE' : (srv.consumptions && srv.consumptions.length > 0 ? 'INTERNAL_VARIABLE' : 'NONE')));
      if (mode === 'NONE' || mode === 'CLIENT_SUPPLIED') return;

      // Extract consumables dynamically from selected specifications or service defaults
      const specsImpact = resolveServiceSpecsImpact(srv, (line as any).notes || (line as any).description, products);
      const consumablesToProcess: Array<{ productId: string; quantityPerUnit: number; isClientSupplied?: boolean }> = [];

      if (specsImpact.consumables && specsImpact.consumables.length > 0) {
        specsImpact.consumables.forEach(c => {
          if (!c.isClientSupplied) {
            consumablesToProcess.push({
              productId: c.productId,
              quantityPerUnit: c.quantityPerUnit || 1,
              isClientSupplied: c.isClientSupplied
            });
          }
        });
      } else if (srv.consumables && srv.consumables.length > 0) {
        srv.consumables.forEach(c => {
          if (!c.isClientSupplied) {
            consumablesToProcess.push({
              productId: c.productId,
              quantityPerUnit: c.quantityPerUnit || 1,
              isClientSupplied: c.isClientSupplied
            });
          }
        });
      } else if (srv.consumptions && srv.consumptions.length > 0) {
        srv.consumptions.forEach(c => {
          consumablesToProcess.push({
            productId: c.productId,
            quantityPerUnit: c.quantity || 1,
            isClientSupplied: false
          });
        });
      }

      if (consumablesToProcess.length === 0) {
        const fallbacks = resolveSmartConsumableFallback(srv, products);
        fallbacks.forEach(c => consumablesToProcess.push(c));
      }

      consumablesToProcess.forEach(c => {
        const prod = products.find(p => p.id === c.productId);
        if (!prod) return;

        const baseUnit = prod.baseUnit || prod.unit || 'unité';
        const consumedQtyInBase = calculateEffectiveServiceConsumableQty(srv, line as any, c, prod);
        const existing = reqMap.get(prod.id);
        const desc = `Consommation interne (${srv.name}) : ${consumedQtyInBase} ${baseUnit}`;

        if (existing) {
          existing.requiredQtyBaseUnit += consumedQtyInBase;
          if (!existing.sourceTypes.includes('INTERNAL_CONSUMPTION')) {
            existing.sourceTypes.push('INTERNAL_CONSUMPTION');
          }
          existing.sourceDescriptions.push(desc);
        } else {
          reqMap.set(prod.id, {
            productId: prod.id,
            productName: prod.name,
            productCode: prod.code,
            category: prod.category,
            requiredQtyBaseUnit: consumedQtyInBase,
            baseUnit,
            sourceTypes: ['INTERNAL_CONSUMPTION'],
            sourceDescriptions: [desc],
          });
        }
      });
    }
  });

  return Array.from(reqMap.values());
}

/**
 * Evaluates stock availability, alert thresholds, pending purchase orders, and restock recommendations.
 */
export function evaluateOrderStock(
  requirements: StockRequirement[],
  products: Product[],
  purchaseOrders: PurchaseOrder[] = []
): StockEvaluation[] {
  const openPOs = (purchaseOrders || []).filter(
    po => po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED'
  );

  return requirements.map(req => {
    const prod = products.find(p => p.id === req.productId);
    const baseUnit = prod?.baseUnit || prod?.unit || 'unité';
    // SINGLE CENTRAL STOCK: Both boutique sales and prestation consumables evaluate against prod.currentStock
    const currentStock = prod?.currentStock || 0;
    const minStockAlert = prod?.minStockAlert || 0;

    const allUnits = prod ? getAvailableProductUnits(prod) : [];
    // Default purchase packaging or highest level packaging
    const purchaseUnitDef = allUnits.find(u => u.isDefaultPurchaseUnit && !u.isBaseUnit)
      || allUnits.filter(u => !u.isBaseUnit).sort((a, b) => b.factorToBase - a.factorToBase)[0]
      || allUnits[0]
      || { unitName: baseUnit, factorToBase: 1, purchasePrice: prod?.costPrice || 0 };

    const defaultPurchaseUnit = purchaseUnitDef.unitName;
    const purchaseConversionFactor = purchaseUnitDef.factorToBase || 1;
    const costPrice = prod?.costPrice || 0;
    const purchasePricePerPurchaseUnit = purchaseUnitDef.purchasePrice || (costPrice * purchaseConversionFactor);

    // Calculate incoming quantities in baseUnit from open POs for this product
    let pendingIncomingQty = 0;
    const openPoNumbers: string[] = [];

    openPOs.forEach(po => {
      po.items.forEach(item => {
        if (item.productId === req.productId) {
          const itemFactor = item.conversionFactor || (prod ? getUnitConversionFactor(item.purchaseUnitName, prod) : purchaseConversionFactor);
          const orderedInBase = item.quantityInStockUnit || (item.orderedQuantityPurchaseUnit * itemFactor);
          const receivedInBase = item.receivedQuantityInStockUnit !== undefined
            ? item.receivedQuantityInStockUnit
            : (item.receivedQuantityPurchaseUnit || 0) * itemFactor;
          const remainingInBase = Math.max(0, orderedInBase - receivedInBase);

          if (remainingInBase > 0) {
            pendingIncomingQty += remainingInBase;
            if (!openPoNumbers.includes(po.poNumber)) {
              openPoNumbers.push(po.poNumber);
            }
          }
        }
      });
    });

    const totalRequired = req.requiredQtyBaseUnit;
    const missingQty = Math.max(0, totalRequired - currentStock);
    const remainingStockAfter = currentStock - totalRequired;

    let status: StockEvaluationStatus = 'SUFFICIENT';

    if (totalRequired > currentStock) {
      if (currentStock + pendingIncomingQty >= totalRequired) {
        status = 'RESTOCK_IN_PROGRESS';
      } else {
        status = 'INSUFFICIENT';
      }
    } else if (remainingStockAfter < minStockAlert && minStockAlert > 0) {
      status = 'LOW_STOCK';
    } else {
      status = 'SUFFICIENT';
    }

    // Recommended order quantity in default purchase packaging unit
    const netMissingWithSafety = Math.max(0, (totalRequired + minStockAlert) - (currentStock + pendingIncomingQty));
    const recommendedPurchaseQty = netMissingWithSafety > 0
      ? Math.max(1, Math.ceil(netMissingWithSafety / purchaseConversionFactor))
      : (missingQty > 0 ? Math.max(1, Math.ceil(missingQty / purchaseConversionFactor)) : 0);

    return {
      productId: req.productId,
      productName: req.productName,
      productCode: req.productCode,
      category: req.category,
      currentStock,
      minStockAlert,
      totalRequired,
      baseUnit,
      stockUnit: baseUnit,
      defaultPurchaseUnit,
      purchaseUnit: defaultPurchaseUnit,
      purchaseConversionFactor,
      conversionFactor: purchaseConversionFactor,
      missingQty,
      remainingStockAfter,
      pendingIncomingQty,
      openPoNumbers,
      status,
      recommendedPurchaseQty,
      recommendedPurchaseUnitName: defaultPurchaseUnit,
      usualSupplierId: prod?.supplierId,
      usualSupplierName: prod?.supplierName,
      costPrice,
      purchasePricePerPurchaseUnit,
      allowNegativeStock: prod?.allowNegativeStock,
      smartStockFormatted: prod ? formatSmartStockBreakdown(currentStock, prod) : `${currentStock} ${baseUnit}`,
    };
  });
}

export interface ServiceConsumptionCalculation {
  product: Product;
  transferQty: number;
  transferUnitName: string;
  factorToBase: number;
  qtyInBaseUnit: number;
  baseUnitName: string;
  serviceName: string;
  consumptionPerPrestation: number;
  prestationUnitName: string;
  prestationCapacity: number;
  currentStockInBase: number;
  currentStockPrestationCapacity: number;
  remainingStockInBaseAfter: number;
  remainingStockPrestationCapacityAfter: number;
  isStockSufficient: boolean;
  missingQtyInBase: number;
  missingQtyInTransferUnit: number;
  conversionSummary: string;
}

/**
 * Accurately calculates internal stock consumption and prestation capacity conversion
 * based on product packaging rules and service consumption definitions.
 */
export function calculateServiceStockConsumption(
  product: Product,
  transferQty: number,
  transferUnitName?: string,
  service?: Service | null,
  serviceNameOverride?: string,
  customConsumptionRatio?: number
): ServiceConsumptionCalculation {
  const baseUnitName = (product.baseUnit || product.unit || 'unité').trim();
  const allUnits = getAvailableProductUnits(product);
  
  // Find selected unit
  const targetUnit = (transferUnitName || baseUnitName).trim().toLowerCase();
  const unitDef = allUnits.find(u => u.unitName.toLowerCase() === targetUnit)
    || allUnits.find(u => u.isDefaultPurchaseUnit)
    || allUnits[0]
    || { unitName: baseUnitName, factorToBase: 1 };

  const factorToBase = unitDef.factorToBase > 0 ? unitDef.factorToBase : 1;
  const validTransferQty = Math.max(0, transferQty);
  const qtyInBaseUnit = Math.round(validTransferQty * factorToBase);

  // Determine service consumption ratio (how many base stock units per prestation)
  let consumptionPerPrestation = 1; // default 1 sheet/piece/m per prestation
  let prestationUnitName = 'prestations';
  let srvName = serviceNameOverride || 'Service Atelier';

  if (service) {
    srvName = service.name;
    prestationUnitName = service.unit ? `${service.unit}s` : 'prestations';
    
    // Check if service has explicit consumption rule for this product
    if (service.consumptions && service.consumptions.length > 0) {
      const match = service.consumptions.find(c => c.productId === product.id);
      if (match && match.quantity > 0) {
        consumptionPerPrestation = match.quantity;
      }
    }
  }

  if (customConsumptionRatio !== undefined && customConsumptionRatio > 0) {
    consumptionPerPrestation = customConsumptionRatio;
  }

  // Prestation capacity calculations
  const prestationCapacity = consumptionPerPrestation > 0
    ? Math.floor(qtyInBaseUnit / consumptionPerPrestation)
    : qtyInBaseUnit;

  const currentStockInBase = product.currentStock || 0;
  const currentStockPrestationCapacity = consumptionPerPrestation > 0
    ? Math.floor(currentStockInBase / consumptionPerPrestation)
    : currentStockInBase;

  const remainingStockInBaseAfter = currentStockInBase - qtyInBaseUnit;
  const remainingStockPrestationCapacityAfter = consumptionPerPrestation > 0
    ? Math.floor(Math.max(0, remainingStockInBaseAfter) / consumptionPerPrestation)
    : Math.max(0, remainingStockInBaseAfter);

  const isStockSufficient = currentStockInBase >= qtyInBaseUnit;
  const missingQtyInBase = Math.max(0, qtyInBaseUnit - currentStockInBase);
  const missingQtyInTransferUnit = factorToBase > 0 ? Math.ceil(missingQtyInBase / factorToBase) : missingQtyInBase;

  // Conversion summary string
  let conversionSummary = '';
  if (factorToBase > 1) {
    conversionSummary = `1 ${unitDef.unitName} = ${factorToBase.toLocaleString('fr-FR')} ${baseUnitName}s = ${Math.floor(factorToBase / consumptionPerPrestation).toLocaleString('fr-FR')} ${prestationUnitName}`;
  } else {
    conversionSummary = `1 ${baseUnitName} = ${Math.floor(1 / consumptionPerPrestation)} ${prestationUnitName}`;
  }

  return {
    product,
    transferQty: validTransferQty,
    transferUnitName: unitDef.unitName,
    factorToBase,
    qtyInBaseUnit,
    baseUnitName,
    serviceName: srvName,
    consumptionPerPrestation,
    prestationUnitName,
    prestationCapacity,
    currentStockInBase,
    currentStockPrestationCapacity,
    remainingStockInBaseAfter,
    remainingStockPrestationCapacityAfter,
    isStockSufficient,
    missingQtyInBase,
    missingQtyInTransferUnit,
    conversionSummary
  };
}

export interface ConsumableRequirementItem {
  orderItemId: string;
  serviceId: string;
  serviceName: string;
  productId: string;
  productName: string;
  quantityRequired: number;
  unit: string;
  isClientSupplied: boolean;
  consumableMode: ConsumableMode;
}

export interface StockAvailabilityResult {
  isAvailable: boolean;
  missingItems: Array<{
    productId: string;
    productName: string;
    serviceName: string;
    requiredQty: number;
    availableQty: number;
    missingQty: number;
    unit: string;
    storeId?: string;
  }>;
  summaryMessage: string;
  detailedItems: ConsumableRequirementItem[];
}

/**
 * Intelligently resolves raw material/consumable products in stock
 * for services (Photocopie, Reliure, Plastification, Impression, etc.) if no explicit mapping exists.
 */
export function resolveSmartConsumableFallback(
  service: Service,
  products: Product[]
): Array<{ productId: string; productName?: string; quantityPerUnit: number; unit?: string; isClientSupplied?: boolean }> {
  const result: Array<{ productId: string; productName?: string; quantityPerUnit: number; unit?: string; isClientSupplied?: boolean }> = [];
  const srvNameLower = (service.name || '').toLowerCase();
  const srvCodeLower = (service.code || '').toLowerCase();

  if (srvNameLower.includes('photocopi') || srvNameLower.includes('impress') || srvNameLower.includes('copie') || srvCodeLower.includes('photo') || srvCodeLower.includes('print')) {
    const paper = products.find(p => p.isConsumable !== false && (p.name.toLowerCase().includes('papier') || p.name.toLowerCase().includes('ramette') || p.name.toLowerCase().includes('a4')));
    if (paper) {
      result.push({ productId: paper.id, productName: paper.name, quantityPerUnit: 1, unit: paper.baseUnit || paper.unit || 'feuille', isClientSupplied: false });
    }
  } else if (srvNameLower.includes('reliur') || srvCodeLower.includes('reliure')) {
    const spiral = products.find(p => p.isConsumable !== false && p.name.toLowerCase().includes('spirale'));
    const pvc = products.find(p => p.isConsumable !== false && (p.name.toLowerCase().includes('pvc') || p.name.toLowerCase().includes('plat') || p.name.toLowerCase().includes('transparent')));
    const bristol = products.find(p => p.isConsumable !== false && p.name.toLowerCase().includes('bristol'));
    if (spiral) result.push({ productId: spiral.id, productName: spiral.name, quantityPerUnit: 1, unit: spiral.baseUnit || spiral.unit || 'unité', isClientSupplied: false });
    if (pvc) result.push({ productId: pvc.id, productName: pvc.name, quantityPerUnit: 1, unit: pvc.baseUnit || pvc.unit || 'feuille', isClientSupplied: false });
    if (bristol) result.push({ productId: bristol.id, productName: bristol.name, quantityPerUnit: 1, unit: bristol.baseUnit || bristol.unit || 'feuille', isClientSupplied: false });
  } else if (srvNameLower.includes('plastif') || srvCodeLower.includes('plastif')) {
    const plastif = products.find(p => p.isConsumable !== false && (p.name.toLowerCase().includes('plastif') || p.name.toLowerCase().includes('pochette')));
    if (plastif) {
      result.push({ productId: plastif.id, productName: plastif.name, quantityPerUnit: 1, unit: plastif.baseUnit || plastif.unit || 'pochette', isClientSupplied: false });
    }
  }

  return result;
}

/**
 * Calculates generic required consumables across all items of an order,
 * respecting the service's consumableMode and client support flags.
 */
export function calculateOrderConsumablesRequirements(
  orderItems: OrderItem[],
  services: Service[],
  products: Product[],
  options?: {
    isClientSupportProvided?: boolean;
    itemClientSupportOverrides?: Record<string, boolean>;
  }
): ConsumableRequirementItem[] {
  const requirements: ConsumableRequirementItem[] = [];

  for (const item of orderItems) {
    const service = services.find(s => s.id === item.serviceId);
    if (!service) continue;

    const hasConfigConsumables = (service.configurations || []).some(c => (c.consumables || []).length > 0);
    const hasServiceConsumables = (service.consumables || []).length > 0;
    const mode: ConsumableMode = service.consumableMode || (
      hasConfigConsumables || hasServiceConsumables || (service.consumptions && service.consumptions.length > 0) ? 'INTERNAL_VARIABLE' : 'NONE'
    );

    // MODE 1: NONE -> No consumable deduction
    if (mode === 'NONE') {
      continue;
    }

    // Check client support override
    const isClientSupportForItem = item.isClientSuppliedSupport !== undefined
      ? item.isClientSuppliedSupport
      : (options?.itemClientSupportOverrides?.[item.id] ?? options?.isClientSupportProvided ?? false);

    // MODE 3: CLIENT_SUPPLIED -> Client provides the material, 0 stock deduction
    if (mode === 'CLIENT_SUPPLIED' || (isClientSupportForItem && mode !== 'MIXED')) {
      continue;
    }

    // Check configured consumables list or dynamic specification impact
    const specsImpact = resolveServiceSpecsImpact(service, item.notes || item.description, products);
    let consumablesToProcess: Array<{ productId: string; productName?: string; quantityPerUnit: number; unit?: string; isClientSupplied?: boolean }> = [];

    if (specsImpact.consumables && specsImpact.consumables.length > 0) {
      consumablesToProcess = specsImpact.consumables;
    } else if (service.consumables && service.consumables.length > 0) {
      consumablesToProcess = service.consumables;
    } else if (service.consumptions && service.consumptions.length > 0) {
      // Legacy fallback
      consumablesToProcess = service.consumptions.map(c => ({
        productId: c.productId,
        quantityPerUnit: c.quantity,
        isClientSupplied: false
      }));
    }

    if (consumablesToProcess.length === 0) {
      consumablesToProcess = resolveSmartConsumableFallback(service, products);
    }

    for (const cons of consumablesToProcess) {
      // If consumable is flagged as provided by client, skip deduction
      if (cons.isClientSupplied) {
        continue;
      }

      const prod = products.find(p => p.id === cons.productId);
      const prodName = cons.productName || prod?.name || 'Consommable';
      const unit = cons.unit || prod?.unit || prod?.baseUnit || 'unité';

      let qtyToDeduct = 0;
      if (mode === 'INTERNAL_FIXED') {
        // Fixed quantity per service execution (or item.quantity documents if fixed per document)
        qtyToDeduct = calculateEffectiveServiceConsumableQty(service, item as any, cons, prod);
      } else {
        // Variable (per page/copy/unit with recto-verso division support)
        qtyToDeduct = calculateEffectiveServiceConsumableQty(service, item as any, cons, prod);
      }

      if (qtyToDeduct > 0) {
        requirements.push({
          orderItemId: item.id,
          serviceId: service.id,
          serviceName: service.name,
          productId: cons.productId,
          productName: prodName,
          quantityRequired: qtyToDeduct,
          unit,
          isClientSupplied: false,
          consumableMode: mode
        });
      }
    }
  }

  return requirements;
}

/**
 * Validates availability of all required consumables in a specific store or global stock.
 */
export function checkOrderConsumablesAvailability(
  requirements: ConsumableRequirementItem[],
  products: Product[],
  storeId?: string
): StockAvailabilityResult {
  const missingItems: StockAvailabilityResult['missingItems'] = [];

  // Group requirements by productId
  const groupedByProduct: Record<string, { totalRequired: number; productName: string; serviceNames: string[]; unit: string }> = {};

  for (const req of requirements) {
    if (!groupedByProduct[req.productId]) {
      groupedByProduct[req.productId] = {
        totalRequired: 0,
        productName: req.productName,
        serviceNames: [],
        unit: req.unit
      };
    }
    groupedByProduct[req.productId].totalRequired += req.quantityRequired;
    if (!groupedByProduct[req.productId].serviceNames.includes(req.serviceName)) {
      groupedByProduct[req.productId].serviceNames.push(req.serviceName);
    }
  }

  for (const [productId, info] of Object.entries(groupedByProduct)) {
    const prod = products.find(p => p.id === productId);
    let availableQty = 0;

    if (prod) {
      // SINGLE CENTRAL STOCK: available quantity is always prod.currentStock
      availableQty = prod.currentStock || 0;
    }

    if (availableQty < info.totalRequired) {
      missingItems.push({
        productId,
        productName: info.productName,
        serviceName: info.serviceNames.join(', '),
        requiredQty: info.totalRequired,
        availableQty,
        missingQty: info.totalRequired - availableQty,
        unit: info.unit,
        storeId
      });
    }
  }

  const isAvailable = missingItems.length === 0;
  let summaryMessage = 'Tous les consommables sont disponibles en stock.';
  if (!isAvailable) {
    const details = missingItems.map(m => `${m.productName} (Requis: ${m.requiredQty} ${m.unit}, Dispo: ${m.availableQty} ${m.unit})`).join(', ');
    summaryMessage = `Stock insuffisant : ${details}`;
  }

  return {
    isAvailable,
    missingItems,
    summaryMessage,
    detailedItems: requirements
  };
}

