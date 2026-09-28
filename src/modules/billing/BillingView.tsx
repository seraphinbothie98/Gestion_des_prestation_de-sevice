import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { Invoice } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Receipt, Printer, Eye, FileText, Download, CheckCircle2 } from 'lucide-react';

export const BillingView: React.FC = () => {
  const { currentTenant } = useAuth();
  const state = dbStore.getState();

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-brand-500" />
            Facturation, Devis & Documents Fiscaux
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Édition des factures normalisées, devis estimatifs et suivi des créances.
          </p>
        </div>
      </div>

      {/* Desktop Invoices Table */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro & Type</TableHead>
              <TableHead>Client / Tiers</TableHead>
              <TableHead>Date d'Émission</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Montant Net</TableHead>
              <TableHead>Montant Réglé</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.invoices.map(inv => (
              <TableRow key={inv.id}>
                <TableCell>
                  <span className="font-bold text-xs text-brand-600 dark:text-brand-400 block">{inv.documentNumber}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{inv.invoiceType}</span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">{inv.personName}</span>
                  <span className="text-[11px] text-slate-400">{inv.personAddress || '-'}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-700 dark:text-slate-300">{formatDate(inv.issueDate)}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-500">{formatDate(inv.dueDate) || 'Immédiat'}</span>
                </TableCell>
                <TableCell>
                  <span className="font-bold text-xs text-slate-900 dark:text-white">{formatCurrency(inv.totalAmount)}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-semibold text-emerald-600">{formatCurrency(inv.paidAmount)}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIAL' ? 'warning' : 'secondary'} size="sm">
                    {inv.status === 'PAID' ? 'Acquittée' : inv.status === 'PARTIAL' ? 'Acompte versé' : inv.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={Printer}
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    Imprimer Facture
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile Card Invoices List (Optimized for Smartphones) */}
      <div className="md:hidden space-y-3">
        {state.invoices.map(inv => (
          <Card key={inv.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-bold text-sm text-brand-600 block">{inv.documentNumber}</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{inv.personName}</span>
              </div>
              <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIAL' ? 'warning' : 'secondary'} size="sm">
                {inv.status === 'PAID' ? 'Acquittée' : inv.status === 'PARTIAL' ? 'Acompte' : inv.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Total Net TTC</span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {formatCurrency(inv.totalAmount)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Reste Dû</span>
                <span className={`font-bold text-xs ${inv.totalAmount - inv.paidAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {formatCurrency(Math.max(0, inv.totalAmount - inv.paidAmount))}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="outline"
                icon={Printer}
                className="w-full min-h-[40px]"
                onClick={() => setSelectedInvoice(inv)}
              >
                Afficher / Imprimer la Facture
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Invoice Printable View Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          maxWidth="4xl"
        >
          <div id="printable-document" className="p-8 bg-white text-slate-900 rounded-2xl border border-slate-200 space-y-6">
            {/* Dynamic Header with Branding */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-6">
              <div className="flex items-start gap-4">
                {currentTenant?.settings?.branding?.showLogo && currentTenant?.settings?.branding?.logoUrl && (
                  <img
                    src={currentTenant.settings.branding.logoUrl}
                    alt="Logo"
                    className="h-16 w-auto object-contain rounded-lg border border-slate-200 p-1"
                  />
                )}
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{currentTenant?.name}</h2>
                  {currentTenant?.settings?.branding?.slogan && (
                    <p className="text-xs font-semibold text-brand-600 italic mt-0.5">
                      {currentTenant.settings.branding.slogan}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    {currentTenant?.address} • Tél : {currentTenant?.phone} • Email : {currentTenant?.email}
                  </p>
                  {currentTenant?.settings?.branding?.website && (
                    <p className="text-[11px] text-brand-600">{currentTenant.settings.branding.website}</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    {currentTenant?.settings?.companyHeader || 'RCCM: GN.TCC.2024.B.01234'}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs uppercase font-bold tracking-wider text-brand-600">
                  {selectedInvoice.invoiceType === 'INVOICE' ? 'FACTURE OFFICIELLE' : 'DEVIS ESTIMATIF'}
                </span>
                <h3 className="text-xl font-extrabold font-mono text-slate-900 mt-0.5">
                  {selectedInvoice.documentNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Date : {formatDate(selectedInvoice.issueDate)}</p>
                {selectedInvoice.dueDate && (
                  <p className="text-xs text-slate-500">Échéance : {formatDate(selectedInvoice.dueDate)}</p>
                )}
              </div>
            </div>

            {/* Client Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Facturé à :</span>
                <h4 className="font-extrabold text-sm text-slate-900">{selectedInvoice.personName}</h4>
                <p className="text-xs text-slate-600">{selectedInvoice.personAddress}</p>
                <p className="text-xs text-slate-600">{selectedInvoice.personPhone}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Statut de règlement :</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg inline-block ${
                  selectedInvoice.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {selectedInvoice.status === 'PAID' ? 'ACQUITTÉE' : 'RÈGLEMENT PARTIEL'}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-bold text-slate-700">Désignation des Prestations / Articles</th>
                    <th className="p-3 text-center font-bold text-slate-700">Quantité</th>
                    <th className="p-3 text-right font-bold text-slate-700">Prix Unitaire</th>
                    <th className="p-3 text-right font-bold text-slate-700">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoice.items.map((it: any, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-medium text-slate-800">{it.description}</td>
                      <td className="p-3 text-center text-slate-600 font-semibold">{it.quantity} {it.unit || ''}</td>
                      <td className="p-3 text-right text-slate-600">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(it.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end pt-4">
              <div className="w-72 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Sous-total :</span>
                  <span className="font-semibold">{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.discountAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-600">
                    <span>Remise accordée :</span>
                    <span>-{formatCurrency(selectedInvoice.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b-2 border-slate-900 font-extrabold text-sm">
                  <span>TOTAL TTC :</span>
                  <span className="text-brand-600">{formatCurrency(selectedInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Montant déjà versé :</span>
                  <span>{formatCurrency(selectedInvoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-amber-600">
                  <span>Reste dû :</span>
                  <span>{formatCurrency(Math.max(0, selectedInvoice.totalAmount - selectedInvoice.paidAmount))}</span>
                </div>
              </div>
            </div>

            {/* Signature and Official Stamp Block */}
            {(() => {
              const signatures = currentTenant?.settings?.digitalSignatures || [];
              const docConfigs = currentTenant?.settings?.documentSignatureConfigs || [];
              const invoiceConfig = docConfigs.find(c => c.documentType === 'INVOICE') || {
                showDirectorSignature: true,
                showOfficialStamp: true,
              };

              const dirSig = signatures.find(s => s.type === 'DIRECTOR' && s.isActive) || signatures.find(s => s.type === 'DIRECTOR');
              const stamp = signatures.find(s => s.type === 'STAMP' && s.isActive) || signatures.find(s => s.type === 'STAMP');

              const dirName = selectedInvoice.directorSignerName || dirSig?.signerName || currentTenant?.settings?.certificateSignerName || 'Le Directeur';
              const dirTitle = selectedInvoice.directorSignerTitle || dirSig?.signerTitle || 'Directeur Général du Centre';
              const dirImg = selectedInvoice.directorSignatureUrl || dirSig?.imageUrl;
              const stampImg = selectedInvoice.officialStampUrl || stamp?.imageUrl;

              return (
                <div className="flex justify-between items-end pt-6 border-t border-slate-200">
                  <div className="text-[11px] text-slate-500 max-w-xs space-y-1">
                    <p className="font-semibold text-slate-700">Conditions de règlement :</p>
                    <p>Paiement au comptant en Francs Guinéens (GNF) ou par virement bancaire / Mobile Money.</p>
                    <p className="text-[10px] text-slate-400">Authentification numérique certifiée par le système central.</p>
                  </div>

                  {(invoiceConfig.showDirectorSignature || invoiceConfig.showOfficialStamp) && (
                    <div className="relative text-center w-64 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                        Pour la Direction Générale
                      </span>

                      <div className="min-h-[75px] relative flex items-center justify-center">
                        {/* Director Signature */}
                        {invoiceConfig.showDirectorSignature && dirImg ? (
                          <img
                            src={dirImg}
                            alt="Signature Directeur"
                            className="h-16 w-auto object-contain z-10 relative"
                          />
                        ) : invoiceConfig.showDirectorSignature ? (
                          <div className="w-36 border-b border-slate-400 my-4" />
                        ) : null}

                        {/* Stamp overlaid */}
                        {invoiceConfig.showOfficialStamp && stampImg && (
                          <img
                            src={stampImg}
                            alt="Cachet Officiel"
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 object-contain opacity-45 pointer-events-none"
                          />
                        )}
                      </div>

                      <div className="mt-1 pt-1 border-t border-slate-200 text-center">
                        <span className="font-extrabold text-xs text-slate-900 block">{dirName}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{dirTitle}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Footer Notice */}
            <div className="pt-4 border-t border-slate-200 text-center text-[11px] text-slate-400 space-y-1">
              <p>{currentTenant?.settings?.invoiceFooter || 'Merci de votre confiance.'}</p>
              <p>Document généré par Centre Management System (CMS).</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 no-print">
            <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
              Fermer
            </Button>
            <Button variant="primary" icon={Printer} onClick={() => window.print()}>
              Imprimer Facture PDF
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
