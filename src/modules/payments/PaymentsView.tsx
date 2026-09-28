import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { Payment, PaymentMethod } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { CreditCard, Search, Receipt, Printer, ArrowDownLeft, Smartphone } from 'lucide-react';
import { PaymentReceiptModal } from '../orders/PaymentReceiptModal';

export const PaymentsView: React.FC = () => {
  const { currentTenant } = useAuth();
  const state = dbStore.getState();

  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const filteredPayments = useMemo(() => {
    return state.payments.filter(p => {
      const matchSearch =
        p.paymentNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.personName.toLowerCase().includes(search.toLowerCase()) ||
        (p.orderNumber && p.orderNumber.toLowerCase().includes(search.toLowerCase())) ||
        (p.enrollmentNumber && p.enrollmentNumber.toLowerCase().includes(search.toLowerCase()));

      const matchMethod = methodFilter === 'ALL' || p.paymentMethod === methodFilter;
      return matchSearch && matchMethod;
    });
  }, [state.payments, search, methodFilter]);

  const totalCollected = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [filteredPayments]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-brand-500" />
            Paiements & Encaissements Unifiés
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Historique centralisé des règlements (Commandes services, Inscriptions formations).
          </p>
        </div>
        <div className="bg-brand-50 dark:bg-brand-950/80 p-3 rounded-2xl border border-brand-200 dark:border-brand-800/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-brand-700 dark:text-brand-300">Total Encaissé Filtré</span>
            <p className="text-base font-extrabold text-brand-900 dark:text-white">{formatCurrency(totalCollected)}</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par N° reçu (PAY-...), client, commande, inscription..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <Select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as any)}
            className="w-full sm:w-52 text-xs"
            options={[
              { value: 'ALL', label: 'Tous les modes' },
              { value: 'CASH', label: 'Espèces' },
              { value: 'ORANGE_MONEY', label: 'Orange Money' },
              { value: 'MTN_MOMO', label: 'MTN MoMo' },
              { value: 'BANK_TRANSFER', label: 'Virement bancaire' },
              { value: 'CARD', label: 'Carte bancaire' },
            ]}
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro & Date</TableHead>
              <TableHead>Client / Apprenant</TableHead>
              <TableHead>Objet & Réf</TableHead>
              <TableHead>Mode de Paiement</TableHead>
              <TableHead>Montant Encaissé</TableHead>
              <TableHead>Opérateur</TableHead>
              <TableHead className="text-right">Reçu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.length > 0 ? (
              filteredPayments.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-bold text-xs text-brand-600 dark:text-brand-400 block">{p.paymentNumber}</span>
                    <span className="text-[11px] text-slate-400">{formatDate(p.createdAt, 'dd/MM/yyyy HH:mm')}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">{p.personName}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                      {p.targetType === 'ORDER' ? `Commande ${p.orderNumber || ''}` : `Formation ${p.enrollmentNumber || ''}`}
                    </span>
                    {p.reference && <span className="text-[10px] text-slate-400">Réf: {p.reference}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.paymentMethod === 'ORANGE_MONEY' || p.paymentMethod === 'MTN_MOMO' ? 'warning' : 'primary'} size="sm">
                      {p.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-500">{p.receivedByUserName || 'Système'}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Printer}
                      onClick={() => setSelectedPayment(p)}
                    >
                      Reçu PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                  Aucun paiement enregistré.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Standardized Unified Printable Receipt Modal (Format A5 - 1 Page) */}
      {selectedPayment && (
        <PaymentReceiptModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  );
};
