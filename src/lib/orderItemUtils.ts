import { OrderItem } from '../types';

export interface FormattedItemDetails {
  title: string;
  designation: string;
  specs: string;
  quantityText: string;
  quantityLabel: string;
  fullDescription: string;
  detailsSummary: string;
  receiptFullLine: string;
}

/**
 * Returns formatted details for an order item or line for display on receipts, invoices and views.
 */
export function formatReceiptItemDetails(item: Partial<OrderItem> & {
  name?: string;
  pageCount?: number;
  copiesCount?: number;
  notes?: string;
}): FormattedItemDetails {
  const baseName = item.serviceName || item.productName || item.name || item.description || 'Prestation';
  const notes = item.notes || '';
  const lowerName = baseName.toLowerCase();
  const lowerNotes = notes.toLowerCase();

  const isPhotocopie = lowerName.includes('photocopie') || lowerName.includes('photo') && !lowerName.includes('planche');
  const isImpression = lowerName.includes('impression') || lowerName.includes('tirage') && !isPhotocopie;

  // Extract structured parameters from notes
  let printMode = '';
  if (lowerNotes.includes('recto-verso')) {
    printMode = 'Recto-verso';
  } else if (lowerNotes.includes('recto')) {
    printMode = 'Recto';
  }

  let colorMode = '';
  if (lowerNotes.includes('couleur')) {
    colorMode = 'Couleur';
  } else if (lowerNotes.includes('noir & blanc') || lowerNotes.includes('n&b') || lowerNotes.includes('noir et blanc')) {
    colorMode = 'Noir & Blanc';
  }

  let formatVal = '';
  if (lowerNotes.includes('a3')) {
    formatVal = 'A3';
  } else if (lowerNotes.includes('a4')) {
    formatVal = 'A4';
  } else if (lowerNotes.includes('badge')) {
    formatVal = 'Badge / Carte';
  }

  // Format Title: Keep baseName or backward-compatible "Photocopie — Recto"
  let title = baseName;
  if ((isPhotocopie || isImpression) && printMode) {
    title = `${baseName} — ${printMode}`;
  }

  // Format Specs List
  let specsList: string[] = [];
  if (notes) {
    const rawParts = notes.split(' | ');
    specsList = rawParts
      .map(p => p.trim())
      .filter(p => {
        if (!p) return false;
        const lowP = p.toLowerCase();
        if (printMode && (lowP.includes('recto') || lowP.startsWith('type d\'impression:') || lowP.startsWith('impression:'))) {
          return false;
        }
        return true;
      });
  }
  const specs = specsList.join(' — ') || (isPhotocopie && colorMode ? `${colorMode}${printMode ? ` — ${printMode}` : ''}${formatVal ? ` — ${formatVal}` : ''}` : '');

  // Format Quantity Text
  let quantityText = '';
  const pageCount = item.pageCount;
  const copiesCount = item.copiesCount;

  if (pageCount && copiesCount && (pageCount > 1 || copiesCount > 1 || isPhotocopie || isImpression)) {
    const pagesLabel = pageCount > 1 ? `${pageCount} pages` : `${pageCount} page`;
    const copiesLabel = copiesCount > 1 ? `${copiesCount} exemplaires` : `${copiesCount} exemplaire`;
    quantityText = `${pagesLabel} × ${copiesLabel}`;
  } else if (item.quantity !== undefined) {
    const unitLabel = item.publicUnit || item.unit;
    quantityText = `Quantité : ${item.quantity}${unitLabel && unitLabel !== 'unité' ? ` ${unitLabel}` : ''}`;
  } else {
    quantityText = 'Quantité : 1';
  }

  // Details Summary (Ideal for Invoices table: e.g. "Couleur, Recto, A4, 2 ex.")
  const summaryParts: string[] = [];
  if (colorMode) summaryParts.push(colorMode);
  if (printMode) summaryParts.push(printMode);
  if (formatVal) summaryParts.push(formatVal);
  if (copiesCount && copiesCount > 1) summaryParts.push(`${copiesCount} ex.`);

  // If other specs exist, add them
  if (specsList.length > 0 && summaryParts.length === 0) {
    summaryParts.push(...specsList.map(s => s.replace(/^[^:]+:\s*/, '')));
  }

  const detailsSummary = summaryParts.length > 0 ? summaryParts.join(', ') : (specs || '—');

  // Receipt full line (e.g. "Photocopie — Couleur — Recto — A4")
  const receiptOptions: string[] = [];
  if (colorMode) receiptOptions.push(colorMode);
  if (printMode) receiptOptions.push(printMode);
  if (formatVal) receiptOptions.push(formatVal);
  const receiptFullLine = receiptOptions.length > 0
    ? `${baseName} — ${receiptOptions.join(' — ')}`
    : (specs ? `${baseName} — ${specs}` : baseName);

  // Full description
  let fullDescription = receiptFullLine;
  if (quantityText && !fullDescription.includes(quantityText)) {
    fullDescription += ` [${quantityText}]`;
  }

  return {
    title,
    designation: baseName,
    specs,
    quantityText,
    quantityLabel: quantityText,
    fullDescription,
    detailsSummary,
    receiptFullLine
  };
}
