import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Payment, Order } from '../../types';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Printer, Download, CheckCircle2, Receipt, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatReceiptItemDetails } from '../../lib/orderItemUtils';

interface PaymentReceiptModalProps {
  payment: Payment | null;
  order?: Order | null;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  payment,
  order,
  onClose,
}) => {
  const { currentTenant } = useAuth();
  const state = dbStore.getState();

  if (!payment) return null;

  const linkedOrder = order || state.orders.find(o => o.id === payment.orderId);
  const totalOrderAmount = linkedOrder?.totalAmount || (payment.balanceBefore || payment.amount);
  const balanceBefore = payment.balanceBefore !== undefined
    ? payment.balanceBefore
    : totalOrderAmount;
  const balanceAfter = payment.balanceAfter !== undefined
    ? payment.balanceAfter
    : Math.max(0, balanceBefore - payment.amount);

  const officialStamp = currentTenant?.settings?.digitalSignatures?.find(s => s.isActive && s.type === 'STAMP') || currentTenant?.settings?.digitalSignatures?.find(s => s.type === 'STAMP');
  const cashierSig = currentTenant?.settings?.digitalSignatures?.find(s => s.isActive && (s.type === 'DIRECTOR' || s.type === 'TRAINER')) || currentTenant?.settings?.digitalSignatures?.find(s => s.type === 'DIRECTOR');

  const logoUrl = currentTenant?.settings?.branding?.logoUrl || currentTenant?.logoUrl;
  const showLogo = currentTenant?.settings?.branding?.showLogo ?? true;

  const qrPayload = JSON.stringify({
    receipt: payment.paymentNumber,
    order: payment.orderNumber,
    client: payment.personName,
    amount: payment.amount,
    date: payment.createdAt,
    balanceAfter
  });

  return (
    <Modal
      isOpen={!!payment}
      onClose={onClose}
      title={`Reçu de Paiement — ${payment.paymentNumber}`}
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Printable Ticket / Receipt Body (Format A5 - 1 Page) */}
        <div
          id="printable-document"
          className="printable-area p-4 sm:p-5 bg-white text-slate-900 border border-slate-300 rounded-xl space-y-3 sm:space-y-4 shadow-sm"
        >
          {/* Header with Logo & Center Info */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-3">
              {showLogo && logoUrl && (
                <img
                  src={logoUrl}
                  alt={currentTenant?.name || 'Logo'}
                  className="h-11 w-auto max-w-[110px] object-contain rounded"
                />
              )}
              <div>
                <span className="text-[11px] font-black text-brand-700 uppercase tracking-wider block">
                  {currentTenant?.name || 'CENTRE PRESTATION ET FORMATION'}
                </span>
                {currentTenant?.settings?.branding?.slogan && (
                  <p className="text-[9px] text-slate-500 italic leading-tight">
                    {currentTenant.settings.branding.slogan}
                  </p>
                )}
                <h3 className="text-xs font-black text-slate-900 uppercase mt-0.5 tracking-tight">
                  REÇU DE RÈGLEMENT OFFICIEL
                </h3>
                <p className="text-[10px] text-slate-600 font-mono">
                  N° Reçu : <strong>{payment.paymentNumber}</strong>
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <Badge variant={balanceAfter === 0 ? 'success' : 'warning'} size="sm">
                {balanceAfter === 0 ? '🟢 Soldé' : '🟠 Partiel'}
              </Badge>
              <p className="text-[10px] text-slate-500 mt-1 font-medium">
                {formatDate(payment.createdAt, 'dd/MM/yyyy HH:mm')}
              </p>
              {currentTenant?.phone && (
                <p className="text-[9px] text-slate-400 mt-0.5">{currentTenant.phone}</p>
              )}
            </div>
          </div>

          {/* Client & Order Details */}
          <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div>
              <span className="text-[9px] text-slate-400 block uppercase font-bold">Client / Bénéficiaire</span>
              <strong className="text-slate-900 text-xs block truncate">{payment.personName}</strong>
              {linkedOrder?.personPhone && <span className="text-[10px] text-slate-500">{linkedOrder.personPhone}</span>}
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block uppercase font-bold">Commande / Prestation</span>
              <strong className="text-brand-700 font-mono text-xs block">{payment.orderNumber || 'Prestation Directe'}</strong>
              <span className="text-[10px] text-slate-500">Caissier : {payment.receivedByUserName || 'Caisse'}</span>
            </div>
          </div>

          {/* Detailed Order Lines Table (Prestations & Fournitures) */}
          {linkedOrder && linkedOrder.items && linkedOrder.items.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <div className="p-2 bg-slate-100 grid grid-cols-12 text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200">
                <span className="col-span-6">Désignation des Prestations</span>
                <span className="col-span-3 text-center">Quantité / Format</span>
                <span className="col-span-3 text-right">Montant</span>
              </div>
              <div className="divide-y divide-slate-100">
                {linkedOrder.items.map((it, idx) => {
                  const details = formatReceiptItemDetails(it);
                  return (
                    <div key={it.id || idx} className="p-2.5 grid grid-cols-12 gap-1 items-start text-xs">
                      <div className="col-span-6 space-y-0.5">
                        <strong className="text-slate-900 block font-bold text-xs">{details.title}</strong>
                        {details.specs && (
                          <span className="text-[10px] text-slate-500 block leading-tight">{details.specs}</span>
                        )}
                      </div>
                      <div className="col-span-3 text-center">
                        <span className="font-semibold text-slate-800 text-[11px] block">{details.quantityText}</span>
                        {it.unitPrice !== undefined && (
                          <span className="text-[9px] text-slate-400 block">{formatCurrency(it.unitPrice)} / {it.unit || 'u.'}</span>
                        )}
                      </div>
                      <div className="col-span-3 text-right font-black text-slate-900 text-xs">
                        {formatCurrency(it.totalPrice)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Financial Breakdown Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
            <div className="p-2 bg-slate-100 flex items-center justify-between text-[10px] font-bold uppercase text-slate-700">
              <span>Récapitulatif Financier</span>
              <span>Montant (GNF)</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="p-2 flex justify-between">
                <span className="text-slate-600">Total initial de la commande :</span>
                <span className="font-semibold">{formatCurrency(totalOrderAmount)}</span>
              </div>
              {linkedOrder?.discountAmount && linkedOrder.discountAmount > 0 ? (
                <div className="p-2 flex justify-between text-emerald-700 font-semibold bg-emerald-50/50">
                  <span>Remise accordée :</span>
                  <span>-{formatCurrency(linkedOrder.discountAmount)}</span>
                </div>
              ) : null}
              <div className="p-2 flex justify-between bg-slate-50/60">
                <span className="text-slate-600">Solde avant ce versement :</span>
                <span className="font-semibold">{formatCurrency(balanceBefore)}</span>
              </div>
              <div className="p-2 flex justify-between bg-emerald-50 text-emerald-950 font-bold">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Encaissé ce jour ({payment.paymentMethod}) :
                </span>
                <span className="text-sm text-emerald-700 font-black">
                  +{formatCurrency(payment.amount)}
                </span>
              </div>
              <div className="p-2 flex justify-between font-black text-slate-900 bg-slate-100/80">
                <span>Reste à payer résiduel :</span>
                <span className={`text-sm ${balanceAfter > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatCurrency(balanceAfter)}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures, Stamp & QR Code */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 items-end text-center">
            {/* QR Code */}
            <div className="flex flex-col items-center justify-center">
              <QRCodeSVG value={qrPayload} size={54} level="M" />
              <span className="text-[8px] text-slate-400 mt-0.5 font-mono">Authenticité certifiée</span>
            </div>

            {/* Cashier Sign */}
            <div>
              <span className="text-[9px] font-bold text-slate-600 block uppercase">Visa Caissier</span>
              <p className="text-[9px] text-slate-400 truncate">{payment.receivedByUserName || cashierSig?.signerName || 'Caisse'}</p>
              <div className="h-11 border-b border-dashed border-slate-300 flex items-center justify-center p-0.5">
                {cashierSig && cashierSig.imageUrl ? (
                  <img src={cashierSig.imageUrl} alt="Signature Caissier" className="max-h-10 object-contain" />
                ) : (
                  <span className="text-[8px] text-slate-400 italic">Signature</span>
                )}
              </div>
            </div>

            {/* Official Stamp */}
            <div>
              <span className="text-[9px] font-bold text-slate-600 block uppercase">Cachet Officiel</span>
              <div className="h-11 flex items-center justify-center border-b border-dashed border-slate-300 p-0.5">
                {officialStamp && officialStamp.imageUrl ? (
                  <img src={officialStamp.imageUrl} alt="Cachet Officiel" className="max-h-10 object-contain opacity-90" />
                ) : (
                  <span className="text-[8px] text-slate-400 italic">Cachet du Centre</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 no-print">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="primary"
            icon={Printer}
            onClick={() => window.print()}
          >
            Imprimer le Reçu (A5)
          </Button>
        </div>
      </div>
    </Modal>
  );
};
