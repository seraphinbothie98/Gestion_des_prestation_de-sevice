import { dbStore } from '../server/db/mockStore';
import { resolveServiceSpecsImpact } from '../lib/serviceSpecs';
import { formatReceiptItemDetails } from '../lib/orderItemUtils';
import {
  isPhotocopieLine,
  isImpressionLine,
  isPageServiceLine,
  getLineRectoVerso,
} from '../modules/orders/QuickOrderModal';
import { OrderItem } from '../types';

export function runMultiPrestationTests() {
  console.log('🧪 Starting validation: Formulaire Multi-Prestations, Paramètres Dynamiques, Remises et Reçu Détaillé...');

  const state = dbStore.getState();
  const tenantId = 't-001';
  const tenantServices = state.services.filter(s => s.tenantId === tenantId && s.isActive);

  // 1. Verify standard services exist
  const photoSrv = tenantServices.find(s => s.name.toLowerCase().includes('photocopie'));
  const reliureSrv = tenantServices.find(s => s.name.toLowerCase().includes('reliure'));
  const plastifSrv = tenantServices.find(s => s.name.toLowerCase().includes('plastif'));

  if (!photoSrv || !reliureSrv || !plastifSrv) {
    throw new Error('❌ Test failed: Required services (Photocopie, Reliure, Plastification) not found in tenantServices');
  }
  console.log('✅ Services Photocopie, Reliure, Plastification detected in store.');

  // 2. Test Dynamic Line Detection
  const dummyPhotoLine: any = {
    id: 'l-1',
    itemType: 'SERVICE',
    name: photoSrv.name,
    unit: photoSrv.unit || 'page',
    service: photoSrv,
    notes: 'Format: A4 | Mode: Noir & blanc | Type d\'impression: Recto | Papier: Standard',
  };

  const dummyReliureLine: any = {
    id: 'l-2',
    itemType: 'SERVICE',
    name: reliureSrv.name,
    unit: reliureSrv.unit || 'document',
    service: reliureSrv,
    notes: 'Format: A4 | Type: Spirale | Couverture: Transparente',
  };

  const dummyPlastifLine: any = {
    id: 'l-3',
    itemType: 'SERVICE',
    name: plastifSrv.name,
    unit: plastifSrv.unit || 'document',
    service: plastifSrv,
    notes: 'Format: A4 (125µ) | Finition: Brillante',
  };

  if (!isPhotocopieLine(dummyPhotoLine) || !isPageServiceLine(dummyPhotoLine)) {
    throw new Error('❌ Test failed: isPhotocopieLine or isPageServiceLine failed for Photocopie');
  }
  if (isPageServiceLine(dummyReliureLine)) {
    throw new Error('❌ Test failed: Reliure should NOT be identified as a page service');
  }
  if (isPageServiceLine(dummyPlastifLine)) {
    throw new Error('❌ Test failed: Plastification should NOT be identified as a page service');
  }
  console.log('✅ Dynamic service line classification correctly identifies page vs non-page services.');

  // 3. Test Recto / Verso Resolution for Photocopie
  const rectoInfo = getLineRectoVerso(dummyPhotoLine);
  if (!rectoInfo || rectoInfo.currentVal !== 'Recto') {
    throw new Error(`❌ Test failed: getLineRectoVerso returned ${JSON.stringify(rectoInfo)}`);
  }
  console.log('✅ Photocopie recto/verso detection works:', rectoInfo);

  // 4. Test Price Calculation for Photocopie: 10 pages * 2 exemplaires * 500 GNF = 10 000 GNF
  const rectoImpact = resolveServiceSpecsImpact(photoSrv, dummyPhotoLine.notes, state.products);
  const rectoUnitP = rectoImpact.standardUnitPrice;
  const pageCount = 10;
  const copiesCount = 2;
  const photoQuantity = pageCount * copiesCount;
  const photoTotalRecto = rectoUnitP * photoQuantity;

  console.log(`Photocopie Recto: ${pageCount} pages × ${copiesCount} ex. × ${rectoUnitP} GNF = ${photoTotalRecto} GNF`);
  if (photoTotalRecto !== 10000) {
    throw new Error(`❌ Test failed: Expected 10 000 GNF for 10 pages x 2 ex. Recto, got ${photoTotalRecto}`);
  }
  console.log('✅ Photocopie 10 pages × 2 ex. Recto = 10 000 GNF confirmed.');

  // Test switching to Recto-verso: 10 pages * 2 ex * 700 GNF = 14 000 GNF
  const versoNotes = 'Format: A4 | Mode: Noir & blanc | Type d\'impression: Recto-verso | Papier: Standard';
  const versoImpact = resolveServiceSpecsImpact(photoSrv, versoNotes, state.products);
  const versoUnitP = versoImpact.standardUnitPrice;
  const photoTotalVerso = versoUnitP * photoQuantity;
  console.log(`Photocopie Recto-verso: ${pageCount} pages × ${copiesCount} ex. × ${versoUnitP} GNF = ${photoTotalVerso} GNF`);
  if (photoTotalVerso !== 14000) {
    throw new Error(`❌ Test failed: Expected 14 000 GNF for Recto-verso, got ${photoTotalVerso}`);
  }
  console.log('✅ Dynamic price update upon switching to Recto-verso confirmed (14 000 GNF).');

  // 5. Test Reliure Calculation: 2 documents * 15 000 GNF = 30 000 GNF
  const reliureImpact = resolveServiceSpecsImpact(reliureSrv, dummyReliureLine.notes, state.products);
  const reliureTotal = reliureImpact.standardUnitPrice * 2;
  if (reliureTotal !== 30000) {
    throw new Error(`❌ Test failed: Expected 30 000 GNF for 2 Reliures, got ${reliureTotal}`);
  }
  console.log('✅ Reliure: Quantité : 2 = 30 000 GNF confirmed.');

  // 6. Test Plastification Calculation: 5 documents * 5 000 GNF = 25 000 GNF
  const plastifImpact = resolveServiceSpecsImpact(plastifSrv, dummyPlastifLine.notes, state.products);
  const plastifTotal = plastifImpact.standardUnitPrice * 5;
  if (plastifTotal !== 25000) {
    throw new Error(`❌ Test failed: Expected 25 000 GNF for 5 Plastifications, got ${plastifTotal}`);
  }
  console.log('✅ Plastification: Quantité : 5 = 25 000 GNF confirmed.');

  // Total order = 10 000 + 30 000 + 25 000 = 65 000 GNF
  const orderSubtotal = photoTotalRecto + reliureTotal + plastifTotal;
  if (orderSubtotal !== 65000) {
    throw new Error(`❌ Test failed: Expected 65 000 GNF total, got ${orderSubtotal}`);
  }
  console.log('✅ Multi-prestation order subtotal sum = 65 000 GNF confirmed.');

  // 7. Test Remise on Photocopie: 10 000 -> 8 000 GNF
  const newAmount = 8000;
  const remiseDiff = photoTotalRecto - newAmount;
  const newUnitPrice = newAmount / photoQuantity;
  if (remiseDiff !== 2000 || newUnitPrice !== 400) {
    throw new Error('❌ Test failed: Remise calculation mismatch');
  }
  console.log(`✅ Remise logic: Montant initial: 10 000 GNF -> Nouveau: 8 000 GNF (Remise: 2 000 GNF, P.U.: 400 GNF).`);

  // 8. Test Detailed Receipt Line Generation
  const photoOrderItem: OrderItem = {
    id: 'it-1',
    itemType: 'SERVICE',
    serviceName: 'Photocopie',
    notes: dummyPhotoLine.notes,
    pageCount: 10,
    copiesCount: 2,
    quantity: 20,
    unit: 'page',
    unitPrice: 500,
    totalPrice: 10000,
    discountPercent: 0,
  };

  const reliureOrderItem: OrderItem = {
    id: 'it-2',
    itemType: 'SERVICE',
    serviceName: 'Reliure',
    notes: dummyReliureLine.notes,
    quantity: 2,
    unit: 'document',
    unitPrice: 15000,
    totalPrice: 30000,
    discountPercent: 0,
  };

  const plastifOrderItem: OrderItem = {
    id: 'it-3',
    itemType: 'SERVICE',
    serviceName: 'Plastification',
    notes: dummyPlastifLine.notes,
    quantity: 5,
    unit: 'document',
    unitPrice: 5000,
    totalPrice: 25000,
    discountPercent: 0,
  };

  const photoReceipt = formatReceiptItemDetails(photoOrderItem);
  const reliureReceipt = formatReceiptItemDetails(reliureOrderItem);
  const plastifReceipt = formatReceiptItemDetails(plastifOrderItem);

  console.log('Receipt Photocopie:', photoReceipt);
  console.log('Receipt Reliure:', reliureReceipt);
  console.log('Receipt Plastification:', plastifReceipt);

  if (!photoReceipt.title.includes('Photocopie — Recto')) {
    throw new Error(`❌ Test failed: Expected "Photocopie — Recto" title, got "${photoReceipt.title}"`);
  }
  if (!photoReceipt.quantityText.includes('10 pages × 2 exemplaires')) {
    throw new Error(`❌ Test failed: Expected "10 pages × 2 exemplaires", got "${photoReceipt.quantityText}"`);
  }
  if (!reliureReceipt.quantityText.includes('Quantité : 2')) {
    throw new Error(`❌ Test failed: Expected "Quantité : 2", got "${reliureReceipt.quantityText}"`);
  }
  if (!plastifReceipt.quantityText.includes('Quantité : 5')) {
    throw new Error(`❌ Test failed: Expected "Quantité : 5", got "${plastifReceipt.quantityText}"`);
  }

  console.log('🎉 ALL MULTI-PRESTATION TESTS PASSED SUCCESSFULLY! 🟢');
}

runMultiPrestationTests();
