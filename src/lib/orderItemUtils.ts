import { OrderItem } from '../types';

export interface FormattedItemDetails {
  title: string;
  specs: string;
  quantityText: string;
  fullDescription: string;
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

  const isPhotocopie = lowerName.includes('photocopie') || lowerName.includes('photo');
  const isImpression = lowerName.includes('impression') || lowerName.includes('tirage');
  const isReliure = lowerName.includes('reliure');
  const isPlastification = lowerName.includes('plastif');

  // Detect Recto / Recto-verso
  let printMode = '';
  if (lowerNotes.includes('recto-verso')) {
    printMode = 'Recto-verso';
  } else if (lowerNotes.includes('recto')) {
    printMode = 'Recto';
  }

  // Format Title
  let title = baseName;
  if ((isPhotocopie || isImpression) && printMode) {
    title = `${baseName} — ${printMode}`;
  }

  // Format Specs (filter out recto/verso if already in title)
  let specsList: string[] = [];
  if (notes) {
    const rawParts = notes.split(' | ');
    specsList = rawParts
      .map(p => p.trim())
      .filter(p => {
        if (!p) return false;
        const lowP = p.toLowerCase();
        if (printMode && (lowP.includes('recto') || lowP.startsWith('type d\'impression:'))) {
          return false;
        }
        return true;
      });
  }
  const specs = specsList.join(' · ');

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

  // Format Full Description (for normal invoices / table lines)
  let fullDescription = title;
  if (specs) {
    fullDescription += ` (${specs})`;
  }
  if (quantityText && !fullDescription.includes(quantityText)) {
    fullDescription += ` [${quantityText}]`;
  }

  return {
    title,
    specs,
    quantityText,
    fullDescription,
  };
}
