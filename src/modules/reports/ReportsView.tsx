import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { dbStore } from '../../server/db/mockStore';
import { formatCurrency, formatDate } from '../../lib/utils';
import { getCanonicalServiceKey } from '../../lib/serviceSpecs';
import {
  BarChart3, Download, Printer, DollarSign,
  ShoppingBag, GraduationCap, Boxes, TrendingUp,
  Users, Sparkles
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'finances' | 'services' | 'formation' | 'stock'>('finances');
  const state = dbStore.getState();

  const uniqueServices = React.useMemo(() => {
    const seen = new Set<string>();
    const list: typeof state.services = [];
    (state.services || []).forEach(s => {
      const key = getCanonicalServiceKey(s.name, s.code);
      if (!seen.has(key)) {
        seen.add(key);
        list.push(s);
      }
    });
    return list;
  }, [state.services]);

  const handleExportCSV = (filename: string, rows: (string | number)[][]) => {
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-500" />
            Rapports Analytiques & Exports
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Bilan d'activité consolidé : finances, rentabilité des prestations, formation et consommations de stock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            icon={Download}
            onClick={() => {
              const rows = [
                ['Numéro', 'Date', 'Personne', 'Type', 'Montant'],
                ...state.payments.map(p => [p.paymentNumber, p.createdAt, p.personName, p.paymentMethod, p.amount])
              ];
              handleExportCSV('Rapport_Financier_CMS', rows);
            }}
          >
            Exporter CSV
          </Button>
          <Button
            variant="primary"
            icon={Printer}
            onClick={() => window.print()}
          >
            Imprimer Rapport
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'finances', label: 'Bilan Financier & Recettes', icon: DollarSign },
          { id: 'services', label: 'Performance des Prestations', icon: ShoppingBag },
          { id: 'formation', label: 'Statistiques Pôle Formation', icon: GraduationCap },
          { id: 'stock', label: 'Consommations de Stock', icon: Boxes },
        ]}
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as any)}
      />

      {/* TAB: FINANCES */}
      {/* TAB: FINANCES */}
      {activeTab === 'finances' && (() => {
        const registeredOrders = state.orders.filter(o => o.status !== 'CANCELLED' && (o.customerType === 'REGISTERED' || (o.customerType === undefined && o.personId)));
        const walkInOrders = state.orders.filter(o => o.status !== 'CANCELLED' && (o.customerType === 'WALK_IN' || (o.customerType === undefined && !o.personId)));

        const registeredCA = registeredOrders.reduce((acc, o) => acc + o.totalAmount, 0);
        const registeredPaid = registeredOrders.reduce((acc, o) => acc + o.paidAmount, 0);

        const walkInCA = walkInOrders.reduce((acc, o) => acc + o.totalAmount, 0);
        const walkInPaid = walkInOrders.reduce((acc, o) => acc + o.paidAmount, 0);

        const totalOrders = registeredOrders.length + walkInOrders.length;
        const totalCA = registeredCA + walkInCA;
        const totalPaid = registeredPaid + walkInPaid;

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Recettes Brutes
                </span>
                <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
                  {formatCurrency(state.payments.reduce((acc, p) => acc + p.amount, 0))}
                </h3>
              </Card>
              <Card className="p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Dépenses Enregistrées
                </span>
                <h3 className="text-2xl font-extrabold text-rose-600 mt-1">
                  {formatCurrency(state.expenses.reduce((acc, e) => acc + e.amount, 0))}
                </h3>
              </Card>
              <Card className="p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Bénéfice Net Estimé
                </span>
                <h3 className="text-2xl font-extrabold text-brand-600 mt-1">
                  {formatCurrency(
                    state.payments.reduce((acc, p) => acc + p.amount, 0) -
                    state.expenses.reduce((acc, e) => acc + e.amount, 0)
                  )}
                </h3>
              </Card>
            </div>

            {/* Breakdown: Registered vs Walk-in Customers */}
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-500" />
                  Répartition Commerciale : Clients Enregistrés vs Clients de Passage (Comptoir)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Typologie Client</TableHead>
                      <TableHead className="text-center">Nombre de Transactions</TableHead>
                      <TableHead className="text-right">Chiffre d'Affaires Facturé</TableHead>
                      <TableHead className="text-right">Montant Encaissé</TableHead>
                      <TableHead className="text-right">Part du CA Global</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-brand-600" />
                          <strong className="text-xs text-slate-900 dark:text-white">Clients Enregistrés</strong>
                        </div>
                        <span className="text-[11px] text-slate-400 block ml-6">Fiches clients répertoriées avec historique</span>
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">{registeredOrders.length}</TableCell>
                      <TableCell className="text-right font-bold text-xs text-slate-900 dark:text-white">{formatCurrency(registeredCA)}</TableCell>
                      <TableCell className="text-right font-bold text-xs text-emerald-600">{formatCurrency(registeredPaid)}</TableCell>
                      <TableCell className="text-right font-bold text-xs text-brand-600">
                        {totalCA > 0 ? `${Math.round((registeredCA / totalCA) * 100)}%` : '0%'}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <strong className="text-xs text-slate-900 dark:text-white">Clients de Passage</strong>
                        </div>
                        <span className="text-[11px] text-slate-400 block ml-6">Ventes directes express au comptoir</span>
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">{walkInOrders.length}</TableCell>
                      <TableCell className="text-right font-bold text-xs text-slate-900 dark:text-white">{formatCurrency(walkInCA)}</TableCell>
                      <TableCell className="text-right font-bold text-xs text-emerald-600">{formatCurrency(walkInPaid)}</TableCell>
                      <TableCell className="text-right font-bold text-xs text-amber-600">
                        {totalCA > 0 ? `${Math.round((walkInCA / totalCA) * 100)}%` : '0%'}
                      </TableCell>
                    </TableRow>

                    <TableRow className="bg-slate-50 dark:bg-slate-800/80 font-black">
                      <TableCell><strong className="text-xs text-slate-900 dark:text-white uppercase">Total Consolidé</strong></TableCell>
                      <TableCell className="text-center font-black text-xs">{totalOrders}</TableCell>
                      <TableCell className="text-right font-black text-xs text-slate-900 dark:text-white">{formatCurrency(totalCA)}</TableCell>
                      <TableCell className="text-right font-black text-xs text-emerald-600">{formatCurrency(totalPaid)}</TableCell>
                      <TableCell className="text-right font-black text-xs text-slate-900 dark:text-white">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Journal des Transactions Financières</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numéro & Date</TableHead>
                      <TableHead>Client / Apprenant</TableHead>
                      <TableHead>Mode de Règlement</TableHead>
                      <TableHead>Objet</TableHead>
                      <TableHead className="text-right">Montant Encaissé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <span className="font-bold text-xs text-brand-600">{p.paymentNumber}</span>
                          <span className="block text-[11px] text-slate-400">{formatDate(p.createdAt)}</span>
                        </TableCell>
                        <TableCell>{p.personName}</TableCell>
                        <TableCell><Badge size="sm">{p.paymentMethod}</Badge></TableCell>
                        <TableCell>{p.targetType}</TableCell>
                        <TableCell className="text-right font-extrabold text-emerald-600">{formatCurrency(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* TAB: SERVICES */}
      {activeTab === 'services' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Prestations et Rentabilité des Services</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code & Prestation</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Coût de Revient</TableHead>
                  <TableHead>Prix de Vente</TableHead>
                  <TableHead>Marge Brute Estimée</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueServices.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">{s.name}</span>
                      <span className="text-[11px] font-mono text-brand-600">{s.code}</span>
                    </TableCell>
                    <TableCell>{s.categoryName}</TableCell>
                    <TableCell>{formatCurrency(s.baseCost)} / {s.unit}</TableCell>
                    <TableCell>{formatCurrency(s.basePrice)} / {s.unit}</TableCell>
                    <TableCell className="font-bold text-emerald-600">
                      {formatCurrency(s.basePrice - s.baseCost)} ({Math.round(((s.basePrice - s.baseCost) / s.basePrice) * 100)}%)
                    </TableCell>
                    <TableCell><Badge variant="success" size="sm">Active</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB: FORMATION */}
      {activeTab === 'formation' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bilan Pédagogique & Inscriptions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Formation</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Prix Inscription</TableHead>
                  <TableHead>Sessions Planifiées</TableHead>
                  <TableHead>Certificats Délivrés</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.trainings.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">{t.title}</span>
                      <span className="text-[11px] text-slate-400">{t.level}</span>
                    </TableCell>
                    <TableCell>{t.durationHours} Heures</TableCell>
                    <TableCell className="font-bold text-emerald-600">{formatCurrency(t.price)}</TableCell>
                    <TableCell>{state.trainingSessions.filter(s => s.trainingId === t.id).length} session(s)</TableCell>
                    <TableCell className="font-bold text-amber-600">
                      {state.certificates.filter(c => c.trainingTitle === t.title).length} certif(s)
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB: STOCK */}
      {activeTab === 'stock' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">État des Stocks & Valeur d'Inventaire</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Stock Actuel</TableHead>
                  <TableHead>Coût Unitaire</TableHead>
                  <TableHead>Valeur Totale Immobilisée</TableHead>
                  <TableHead>Alerte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-bold text-xs">{p.name}</TableCell>
                    <TableCell>{p.currentStock} {p.unit}</TableCell>
                    <TableCell>{formatCurrency(p.costPrice)}</TableCell>
                    <TableCell className="font-extrabold text-slate-900 dark:text-white">
                      {formatCurrency(p.currentStock * p.costPrice)}
                    </TableCell>
                    <TableCell>
                      {p.currentStock <= p.minStockAlert ? (
                        <Badge variant="danger" size="sm">Seuil Critique</Badge>
                      ) : (
                        <Badge variant="success" size="sm">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
