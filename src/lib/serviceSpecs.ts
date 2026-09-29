import {
  Service,
  ServiceOption,
  ServiceConfiguration,
  ServiceConsumableRule,
  ServiceSpecificationGroup,
  ServiceSpecificationOption,
  Product
} from '../types';

/**
 * Safely extracts a string display label from any option value format (string or object).
 */
export function getOptionValueLabel(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.label || val.name || val.id || String(val);
}

/**
 * Normalizes legacy spec option into a structured ServiceSpecificationOption object.
 */
export function resolveSpecOption(opt: string | ServiceSpecificationOption): ServiceSpecificationOption {
  if (typeof opt === 'string') {
    return { name: opt };
  }
  return opt;
}

/**
 * Canonical option key normalizer to bridge synonyms between UI and configurations
 * (e.g. "Couleur" vs "Mode", "Impression" vs "Type d'impression").
 */
export function canonicalOptionKey(key: string): string {
  const k = (key || '').trim().toLowerCase();
  if (k === 'couleur' || k === 'mode' || k === 'coloris' || k === 'type de couleur') return 'couleur';
  if (k === 'impression' || k === "type d'impression" || k === "mode d'impression" || k === 'recto/verso' || k === 'recto-verso') return 'impression';
  if (k === 'format' || k === 'taille') return 'format';
  if (k === 'papier' || k === 'support' || k === 'type de papier') return 'papier';
  if (k === 'type' || k === 'type de reliure') return 'type';
  if (k === 'finition') return 'finition';
  if (k === 'destination') return 'destination';
  return k;
}

/**
 * Canonical option value normalizer to bridge variations
 * (e.g. "Noir & Blanc" vs "Noir & blanc" vs "N&B").
 */
export function canonicalOptionValue(val: string): string {
  const v = (val || '').trim().toLowerCase();
  if (v === 'noir & blanc' || v === 'noir et blanc' || v === 'n&b' || v === 'monochrome' || v === 'nb' || v === 'noir & blanc laser') {
    return 'noir & blanc';
  }
  if (v === 'couleur' || v === 'couleur hd' || v === 'coul' || v === 'color') {
    return 'couleur';
  }
  if (v === 'recto' || v === 'simple face') {
    return 'recto';
  }
  if (v === 'recto-verso' || v === 'recto verso' || v === 'double face' || v === 'recto/verso') {
    return 'recto-verso';
  }
  return v;
}

/**
 * Returns dynamic options for a service (Data-driven, zero hardcoding).
 */
export function getServiceOptions(service?: Service): ServiceOption[] {
  if (!service) return [];
  if (service.options && Array.isArray(service.options) && service.options.length > 0) {
    return service.options.map(opt => ({
      ...opt,
      values: Array.isArray(opt.values) ? opt.values.map(v => getOptionValueLabel(v)) : []
    }));
  }
  // Derived dynamically from configurations if options array is empty
  if (service.configurations && Array.isArray(service.configurations) && service.configurations.length > 0) {
    const valMap: Record<string, Set<string>> = {};
    for (const cfg of service.configurations) {
      if (cfg.optionValues) {
        for (const [k, v] of Object.entries(cfg.optionValues)) {
          if (!valMap[k]) valMap[k] = new Set();
          if (v) valMap[k].add(v);
        }
      }
    }
    const derived = Object.entries(valMap).map(([k, set]) => ({
      id: `opt-${k.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: k,
      values: Array.from(set)
    }));
    if (derived.length > 0) return derived;
  }
  // Backward compatibility: convert legacy specificationGroups if options is undefined
  if (service.specificationGroups && Array.isArray(service.specificationGroups)) {
    return service.specificationGroups.map(g => ({
      id: g.id || `opt-${g.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: g.name,
      values: (g.options || []).map(o => (typeof o === 'string' ? o : o.name))
    }));
  }
  return [];
}

/**
 * Returns authorized configurations for a service.
 */
export function getServiceConfigurations(service?: Service): ServiceConfiguration[] {
  if (!service) return [];
  return service.configurations || [];
}

/**
 * Formats option values map into standard display string (e.g. "A4 | Noir & blanc | Recto | Standard").
 */
export function formatConfigOptionValues(optionValues?: Record<string, string>): string {
  if (!optionValues || Object.keys(optionValues).length === 0) {
    return 'Configuration standard (sans option)';
  }
  return Object.entries(optionValues)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');
}

/**
 * Formats option values into a compact readable badge text (e.g. "A4 · Noir & blanc · Recto · Standard").
 */
export function formatCompactOptionValues(optionValues?: Record<string, string>): string {
  if (!optionValues || Object.keys(optionValues).length === 0) {
    return 'Standard';
  }
  return Object.values(optionValues).join(' · ');
}

/**
 * Parses selected option values from an order item note or string.
 */
export function parseSelectedOptionsFromNotes(
  notes?: string,
  options?: ServiceOption[]
): Record<string, string> {
  const selected: Record<string, string> = {};
  const currentNotes = notes || '';

  if (!options || options.length === 0) {
    return selected;
  }

  for (const opt of options) {
    const optCanon = canonicalOptionKey(opt.name);
    const valList = Array.isArray(opt.values) ? opt.values.map(getOptionValueLabel) : [];

    // Try matching exact "OptionName : SelectedValue"
    const escapedName = opt.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escapedName}\\s*:\\s*([^|\\n,;]+)`, 'i');
    const match = currentNotes.match(regex);

    if (match && match[1]) {
      const val = match[1].trim();
      const known = valList.find(v => v.toLowerCase() === val.toLowerCase());
      selected[opt.name] = known || val;
      continue;
    }

    // Try matching synonym names in notes (e.g. "Mode:" when option is "Couleur", or "Type d'impression:" when option is "Impression")
    let synonymMatchFound = false;
    for (const part of currentNotes.split(' | ')) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        const k = part.slice(0, colonIdx).trim();
        const v = part.slice(colonIdx + 1).trim();
        if (canonicalOptionKey(k) === optCanon) {
          const known = valList.find(knownV => canonicalOptionValue(knownV) === canonicalOptionValue(v));
          selected[opt.name] = known || v;
          synonymMatchFound = true;
          break;
        }
      }
    }

    if (!synonymMatchFound) {
      // Default to first available value if defined
      selected[opt.name] = valList[0] || '';
    }
  }

  return selected;
}

/**
 * Encodes selected option values into a clean string for item notes/description.
 */
export function formatSelectedOptionsToNotes(
  selectedOptions: Record<string, string>,
  existingNotes?: string
): string {
  const pairs = Object.entries(selectedOptions)
    .filter(([_, v]) => Boolean(v))
    .map(([k, v]) => `${k}: ${v}`);

  if (pairs.length === 0) {
    return existingNotes || '';
  }

  const specString = pairs.join(' | ');
  if (!existingNotes || existingNotes.trim() === '') {
    return specString;
  }

  // If existing notes already contained specs, replace matching keys
  const keys = Object.keys(selectedOptions).map(canonicalOptionKey);
  const cleaned = existingNotes
    .split('\n')
    .filter(line => {
      const parts = line.split(':');
      if (parts.length > 1) {
        const lineKey = canonicalOptionKey(parts[0].trim());
        return !keys.includes(lineKey);
      }
      return true;
    })
    .join('\n')
    .trim();

  return cleaned ? `${specString}\n${cleaned}` : specString;
}

/**
 * Finds matching authorized configuration for a service based on selected option values.
 * Uses exact matching first, then canonical scoring matching to support flexible options.
 */
export function findMatchingConfiguration(
  service: Service,
  selectedOptions: Record<string, string>
): ServiceConfiguration | undefined {
  const configs = service.configurations || [];
  const serviceOpts = getServiceOptions(service);

  // If service has no options (simple service)
  if (serviceOpts.length === 0) {
    return configs.find(c => c.isActive) || configs[0];
  }

  // 1. Exact matching across all service options
  const exactMatch = configs.find(cfg => {
    return serviceOpts.every(opt => {
      const selectedVal = (selectedOptions[opt.name] || '').trim().toLowerCase();
      const configVal = (cfg.optionValues?.[opt.name] || '').trim().toLowerCase();
      return selectedVal === configVal;
    });
  });

  if (exactMatch) return exactMatch;

  // 2. Canonical matching: bridges "Couleur" <-> "Mode", "Impression" <-> "Type d'impression", etc.
  const canonicalSelected: Record<string, string> = {};
  for (const [k, v] of Object.entries(selectedOptions)) {
    if (v) {
      canonicalSelected[canonicalOptionKey(k)] = canonicalOptionValue(v);
    }
  }

  const scoredConfigs = configs.map(cfg => {
    const cfgCanonical: Record<string, string> = {};
    for (const [k, v] of Object.entries(cfg.optionValues || {})) {
      if (v) {
        cfgCanonical[canonicalOptionKey(k)] = canonicalOptionValue(v);
      }
    }

    let matchCount = 0;
    let mismatchCount = 0;

    for (const [canonK, canonV] of Object.entries(canonicalSelected)) {
      if (cfgCanonical[canonK] !== undefined) {
        if (cfgCanonical[canonK] === canonV) {
          matchCount++;
        } else {
          mismatchCount++;
        }
      }
    }

    return {
      cfg,
      matchCount,
      mismatchCount,
      isActive: cfg.isActive !== false
    };
  });

  // Filter out any configs with active mismatches
  const validConfigs = scoredConfigs.filter(sc => sc.mismatchCount === 0 && sc.matchCount > 0);
  if (validConfigs.length > 0) {
    // Sort by: active first, then highest matchCount
    validConfigs.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.matchCount - a.matchCount;
    });
    return validConfigs[0].cfg;
  }

  // Fallback: If only a single default configuration exists
  if (configs.length === 1 && (!configs[0].optionValues || Object.keys(configs[0].optionValues).length === 0)) {
    return configs[0];
  }

  // Fallback to first active configuration
  return configs.find(c => c.isActive) || configs[0];
}

/**
 * Resolves effective unit price, billing unit, and linked consumable requirements
 * from dynamic ServiceConfiguration with fallback to legacy models.
 */
export function resolveServiceSpecsImpact(
  service: Service,
  notesOrSelected?: string | Record<string, string>,
  products?: Product[]
): {
  standardUnitPrice: number;
  billingUnit: string;
  priceAdjustments: number;
  consumables: Array<{
    productId: string;
    productName?: string;
    quantityPerUnit: number;
    unit?: string;
    isClientSupplied?: boolean;
    isVariableWithQuantity?: boolean;
  }>;
  selectedOptions: Array<{ groupName: string; option: ServiceSpecificationOption }>;
  matchedConfig?: ServiceConfiguration;
  isConfigActive: boolean;
  formattedSpecs: string;
} {
  const serviceOpts = getServiceOptions(service);
  let selectedMap: Record<string, string> = {};

  if (typeof notesOrSelected === 'string' || !notesOrSelected) {
    selectedMap = parseSelectedOptionsFromNotes(notesOrSelected as string, serviceOpts);
  } else {
    selectedMap = { ...notesOrSelected };
  }

  // Build legacy-compatible selectedOptions array & calculate price delta if any
  let calculatedPriceDeltas = 0;
  const legacySelected: Array<{ groupName: string; option: ServiceSpecificationOption }> = [];

  for (const opt of (service.options || [])) {
    const rawValList = Array.isArray(opt.values) ? opt.values : [];
    const chosenLabel = selectedMap[opt.name] || getOptionValueLabel(rawValList[0]) || '';
    legacySelected.push({
      groupName: opt.name,
      option: { name: chosenLabel }
    });

    // Check if raw option values have priceDelta
    const matchingRawVal: any = rawValList.find(v => getOptionValueLabel(v).toLowerCase() === chosenLabel.toLowerCase());
    if (matchingRawVal && typeof matchingRawVal === 'object' && typeof matchingRawVal.priceDelta === 'number') {
      calculatedPriceDeltas += matchingRawVal.priceDelta;
    }
  }

  // 1. Check if matching modern ServiceConfiguration exists
  const matchedConfig = findMatchingConfiguration(service, selectedMap);

  if (matchedConfig) {
    const isConfigActive = matchedConfig.isActive !== false;
    const baseConfigPrice = matchedConfig.price ?? service.basePrice ?? 0;
    const standardUnitPrice = baseConfigPrice + calculatedPriceDeltas;
    const billingUnit = matchedConfig.billingUnit || service.unit || 'prestation';

    // Map consumables from configuration
    const configConsumables = (matchedConfig.consumables || []).map(c => {
      const prod = products?.find(p => p.id === c.productId);
      return {
        productId: c.productId,
        productName: c.productName || prod?.name || 'Consommable',
        quantityPerUnit: c.quantityPerUnit || (c as any).quantity || 1,
        unit: c.unit || prod?.unit || prod?.baseUnit || 'unité',
        isClientSupplied: Boolean(c.isClientSupplied),
        isVariableWithQuantity: c.isVariableWithQuantity !== false
      };
    });

    return {
      standardUnitPrice,
      billingUnit,
      priceAdjustments: calculatedPriceDeltas,
      consumables: configConsumables,
      selectedOptions: legacySelected,
      matchedConfig,
      isConfigActive,
      formattedSpecs: formatConfigOptionValues(selectedMap)
    };
  }

  // 2. Fallback for Simple Service or legacy configuration
  const standardUnitPrice = (service.basePrice || 0) + calculatedPriceDeltas;
  const billingUnit = service.unit || 'prestation';
  const defaultConsumables: Array<{
    productId: string;
    productName?: string;
    quantityPerUnit: number;
    unit?: string;
    isClientSupplied?: boolean;
    isVariableWithQuantity?: boolean;
  }> = [];

  if (service.consumables && service.consumables.length > 0) {
    for (const c of service.consumables) {
      const prod = products?.find(p => p.id === c.productId);
      defaultConsumables.push({
        productId: c.productId,
        productName: c.productName || prod?.name || 'Consommable',
        quantityPerUnit: c.quantityPerUnit || 1,
        unit: c.unit || prod?.unit || prod?.baseUnit || 'unité',
        isClientSupplied: Boolean(c.isClientSupplied),
        isVariableWithQuantity: c.isVariableWithQuantity !== false
      });
    }
  } else if (service.consumptions && service.consumptions.length > 0) {
    for (const c of service.consumptions) {
      const prod = products?.find(p => p.id === c.productId);
      defaultConsumables.push({
        productId: c.productId,
        productName: prod?.name || 'Consommable',
        quantityPerUnit: c.quantity || 1,
        unit: prod?.unit || prod?.baseUnit || 'unité',
        isClientSupplied: false,
        isVariableWithQuantity: true
      });
    }
  }

  return {
    standardUnitPrice,
    billingUnit,
    priceAdjustments: calculatedPriceDeltas,
    consumables: defaultConsumables,
    selectedOptions: legacySelected,
    matchedConfig: undefined,
    isConfigActive: true,
    formattedSpecs: formatConfigOptionValues(selectedMap)
  };
}

/**
 * Backward compatibility: Returns specification groups for legacy callers.
 */
export function getServiceSpecificationGroups(service?: Service): ServiceSpecificationGroup[] {
  if (!service) return [];
  const opts = getServiceOptions(service);
  return opts.map(o => ({
    name: o.name,
    defaultValue: o.values[0] || '',
    options: o.values.map(v => ({ name: v }))
  }));
}

/**
 * Backward compatibility: Finds selected option within a group.
 */
export function getSelectedSpecOption(
  group: ServiceSpecificationGroup,
  notes?: string
): ServiceSpecificationOption {
  const currentNotes = notes || '';
  const escapedName = group.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escapedName}\\s*:\\s*([^|\\n,]+)`, 'i');
  const match = currentNotes.match(regex);
  const selectedName = match && match[1]
    ? match[1].trim()
    : (group.defaultValue || (typeof group.options[0] === 'string' ? group.options[0] : group.options[0]?.name) || '');

  const normalizedOptions = group.options.map(resolveSpecOption);
  const found = normalizedOptions.find(o => o.name.toLowerCase() === selectedName.toLowerCase());
  return found || normalizedOptions[0] || { name: selectedName };
}

