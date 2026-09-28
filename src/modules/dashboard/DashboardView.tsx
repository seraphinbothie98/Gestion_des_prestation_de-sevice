import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { dbStore } from '../../server/db/mockStore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  DollarSign, ShoppingBag, GraduationCap, AlertTriangle,
  TrendingUp, Clock, CheckCircle2, ArrowUpRight, ArrowDownRight,
  Boxes, Calendar, FileCheck2, Filter, Sparkles, User, Factory,
  Wallet, BookOpen, Users, CheckSquare, Award, ArrowRight, Plus, Eye, Play, Layout,
  Monitor, Wrench, ShieldCheck, Truck, Printer
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { NavSection } from '../../components/layout/Sidebar';
import { ConfigurationScoreWidget } from '../onboarding/ConfigurationScoreWidget';
import { OnboardingWizardModal } from '../onboarding/OnboardingWizardModal';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
  onOpenQuickOrder: () => void;
  onOpenQuickArticleSale: () => void;
  onOpenQuickEnrollment: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenQuickOrder,
  onOpenQuickArticleSale,
  onOpenQuickEnrollment,
}) => {
  const { currentUser, currentTenant, currentBranch, isSuperAdmin } = useAuth();
  const { showToast } = useNotification();
  const [timeFilter, setTimeFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'>('MONTH');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    return Boolean(currentTenant && currentTenant.onboardingCompleted === false && !isSuperAdmin);
  });
  const state = dbStore.getState();

  const roleCode = currentUser?.roles[0]?.code || 'ADMIN_CENTRE';

  // ============================================================================
  // 1. DASHBOARD: ADMIN DU CENTRE
  // ============================================================================
  const renderAdminDashboard = () => {
    const tenantId = currentTenant?.id || 't-001';
    const isAll = tenantId === 'ALL' || tenantId === 'global';

    const agencyPayments = isAll ? state.payments : state.payments.filter(p => p.tenantId === tenantId);
    const agencyOrders = isAll ? state.orders : state.orders.filter(o => o.tenantId === tenantId);
    const agencyTrainings = isAll ? state.trainings : state.trainings.filter(t => t.tenantId === tenantId);
    const agencySessions = isAll ? state.trainingSessions : state.trainingSessions.filter(s => s.tenantId === tenantId);
    const agencyEnrollments = isAll ? state.enrollments : state.enrollments.filter(e => e.tenantId === tenantId);
    const agencyCashSessions = isAll ? state.cashSessions : state.cashSessions.filter(cs => cs.tenantId === tenantId);
    const agencyEquipment = isAll ? (state.equipment || []) : (state.equipment || []).filter(e => e.tenantId === tenantId);
    const agencyProducts = isAll ? state.products : state.products.filter(p => p.tenantId === tenantId);

    const totalRevenue = agencyPayments.reduce((acc, p) => acc + p.amount, 0);
    const serviceOrdersCount = agencyOrders.length;
    const activeTrainingsCount = agencyTrainings.filter(t => t.isActive).length;
    const activeSessionsCount = agencySessions.filter(s => s.status === 'OPEN' || s.status === 'IN_PROGRESS').length;
    const totalLearnersCount = agencyEnrollments.length;
    
    // Single Source of Truth for Cash Balance and Treasury (Strict Finance & Treasury synchronization)
    const treasuryMetrics = dbStore.getTreasuryMetrics(tenantId, isSuperAdmin);
    const cashBalance = treasuryMetrics.cashTotal;
    const activeCashSession = agencyCashSessions.find(cs => cs.status === 'OPEN');
    const criticalStockItems = agencyProducts.filter(p => p.currentStock <= p.minStockAlert);
    const totalEquipment = agencyEquipment.length;
    const brokenEquipment = agencyEquipment.filter(e => e.status === 'EN_PANNE' || e.status === 'EN_MAINTENANCE').length;

    const revenueTrendData = [
      { period: 'Sem 1', services: 1250000, formations: 1800000, total: 3050000 },
      { period: 'Sem 2', services: 1680000, formations: 2400000, total: 4080000 },
      { period: 'Sem 3', services: 2100000, formations: 1620000, total: 3720000 },
      { period: 'Sem 4', services: 2850000, formations: 3200000, total: 6050000 },
    ];

    return (
      <div className="space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80 border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recettes Globales</span>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatCurrency(totalRevenue)}
              </span>
            </div>
          </Card>

          <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80 border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pôle Services</span>
              <div className="p-2.5 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{serviceOrdersCount}</span>
              <span className="text-xs text-slate-400 ml-2">commandes</span>
            </div>
          </Card>

          <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80 border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pôle Formation</span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalLearnersCount}</span>
              <span className="text-xs text-slate-400 ml-2">apprenants ({activeSessionsCount} sessions)</span>
            </div>
          </Card>

          <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80 border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Solde Caisse</span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{formatCurrency(cashBalance)}</span>
            </div>
          </Card>
        </div>

        {/* Secondary Status Row (Stock & Matériel) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-4 flex items-center justify-between cursor-pointer hover:border-brand-500 transition-colors" onClick={() => onNavigate('equipment')}>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-50 dark:bg-brand-950/60 text-brand-600 rounded-xl">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block">Parc Matériel du Centre</span>
                <span className="text-xs text-slate-400">{totalEquipment} équipements enregistrés</span>
              </div>
            </div>
            <div>
              {brokenEquipment > 0 ? (
                <Badge variant="warning" size="sm">⚠️ {brokenEquipment} en panne/maint.</Badge>
              ) : (
                <Badge variant="success" size="sm">✅ 100% Opérationnel</Badge>
              )}
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between cursor-pointer hover:border-brand-500 transition-colors" onClick={() => onNavigate('stock')}>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 rounded-xl">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block">Stock & Consommables</span>
                <span className="text-xs text-slate-400">{state.products.length} articles répertoriés</span>
              </div>
            </div>
            <div>
              {criticalStockItems.length > 0 ? (
                <Badge variant="danger" size="sm">🚨 {criticalStockItems.length} alertes stock</Badge>
              ) : (
                <Badge variant="success" size="sm">✅ Stock suffisant</Badge>
              )}
            </div>
          </Card>
        </div>

        {/* Charts & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6">
            <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-500" />
                Évolution Financière Consolidée (Services vs Formations)
              </CardTitle>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="period" stroke="#888888" fontSize={11} />
                  <YAxis stroke="#888888" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip />
                  <Area type="monotone" dataKey="services" name="Services" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="formations" name="Formations" stroke="#eab308" fill="#eab308" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-sm font-bold">Raccourcis d'Administration</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-xs" onClick={() => onNavigate('users-rbac')}>
                <ShieldCheck className="w-4 h-4 mr-2 text-brand-500" /> Gérer les Utilisateurs & Postes (4 Rôles)
              </Button>
              <Button variant="outline" className="w-full justify-start text-xs" onClick={() => onNavigate('equipment')}>
                <Monitor className="w-4 h-4 mr-2 text-brand-500" /> Parc Matériel & Maintenance
              </Button>
              <Button variant="outline" className="w-full justify-start text-xs" onClick={() => onNavigate('settings')}>
                <Layout className="w-4 h-4 mr-2 text-amber-500" /> Identité Visuelle & Logo
              </Button>
              <Button variant="outline" className="w-full justify-start text-xs" onClick={() => onNavigate('reports')}>
                <TrendingUp className="w-4 h-4 mr-2 text-emerald-500" /> Rapports Financiers & Exports
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 2. DASHBOARD: CAISSIÈRE (Poste Polyvalent : Réception + Commandes + Caisse + Production)
  // ============================================================================
  const renderCashierDashboard = () => {
    const tenantId = currentTenant?.id || 't-001';
    const isAll = tenantId === 'ALL' || tenantId === 'global';

    const agencyOrders = isAll ? state.orders : state.orders.filter(o => o.tenantId === tenantId);
    const readyOrders = agencyOrders.filter(o => o.status === 'READY');
    const pendingOrders = agencyOrders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');
    const inProductionOrders = agencyOrders.filter(o => o.status === 'IN_PRODUCTION');
    const criticalStock = (isAll ? state.products : state.products.filter(p => p.tenantId === tenantId)).filter(p => p.currentStock <= p.minStockAlert);
    const activeSession = state.cashSessions.find(cs => (isAll || cs.tenantId === tenantId) && cs.status === 'OPEN');

    // Single Source of Truth for Cash Balance
    const cashierTreasury = dbStore.getTreasuryMetrics(tenantId, isSuperAdmin);
    const cashBalance = cashierTreasury.cashTotal;

    const todayInflows = activeSession
      ? activeSession.movements.filter(m => m.movementType === 'INFLOW').reduce((acc, m) => acc + m.amount, 0)
      : 0;

    const todayExpenses = activeSession
      ? activeSession.movements.filter(m => m.movementType === 'EXPENSE' || m.movementType === 'OUTFLOW').reduce((acc, m) => acc + m.amount, 0)
      : 0;

    const handleQuickStatusChange = (orderId: string, nextStatus: any) => {
      dbStore.updateState(draft => {
        const ord = draft.orders.find(o => o.id === orderId);
        if (ord) {
          ord.status = nextStatus;
          ord.updatedAt = new Date().toISOString();
        }
      });
      showToast('Statut Mis à Jour', `Commande passée en "${nextStatus}".`, 'SUCCESS');
    };

    return (
      <div className="space-y-6">
        {/* Banner: Polyvalent Workstation Status */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-slate-900 p-6 rounded-3xl text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${activeSession ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-200">
                {activeSession ? "Session de Caisse Ouverte" : "Session de Caisse Fermée"}
              </span>
            </div>
            <h3 className="text-3xl font-black mt-1">{formatCurrency(cashBalance)}</h3>
            <p className="text-xs text-emerald-100 mt-0.5">Poste polyvalent : Réception clients • Commandes • Caisse • Production atelier</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 min-h-[42px]" icon={Plus} onClick={onOpenQuickOrder}>
              Nouvelle Commande
            </Button>
            <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 min-h-[42px]" icon={Wallet} onClick={() => onNavigate('cash')}>
              Gérer Caisse
            </Button>
          </div>
        </div>

        {/* 4 Pillars KPIs: Réception, Commandes, Caisse, Production */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 border-l-4 border-l-brand-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('orders')}>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">1. Commandes</span>
            <h3 className="text-xl sm:text-2xl font-extrabold text-brand-600 mt-1">{pendingOrders.length} à traiter</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Nouvelles saisies</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-amber-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('production')}>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">2. Production</span>
            <h3 className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">{inProductionOrders.length} en cours</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Impressions / reliures</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-emerald-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('payments')}>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">3. Caisse du Jour</span>
            <h3 className="text-lg sm:text-xl font-extrabold text-emerald-600 mt-1">{formatCurrency(todayInflows)}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Sorties : {formatCurrency(todayExpenses)}</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-amber-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('orders')}>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">4. Prêtes / Retrait</span>
            <h3 className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">{readyOrders.length} prêtes</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">À remettre aux clients</p>
          </Card>
        </div>

        {/* 2 Main Working Blocks: Production Queue & Counter Ready Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Production Workstation Block */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Factory className="w-4 h-4 text-amber-500" />
                Atelier : Commandes à Produire ({pendingOrders.length + inProductionOrders.length})
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => onNavigate('production')}>
                Kanban <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {[...inProductionOrders, ...pendingOrders].length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[...inProductionOrders, ...pendingOrders].slice(0, 4).map(o => (
                    <div key={o.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-brand-600 font-mono">{o.orderNumber}</span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{o.personName}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {o.items.map(i => `${i.quantity}x ${i.serviceName}`).join(' • ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {o.status === 'PENDING' || o.status === 'CONFIRMED' ? (
                          <Button size="sm" variant="outline" className="text-amber-600" onClick={() => handleQuickStatusChange(o.id, 'IN_PRODUCTION')}>
                            Démarrer
                          </Button>
                        ) : (
                          <Button size="sm" variant="primary" onClick={() => handleQuickStatusChange(o.id, 'READY')}>
                            Terminer
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Aucun travail en attente dans la file de production.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Counter Delivery Block */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Comptoir : Commandes Prêtes à Livrer ({readyOrders.length})
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => onNavigate('orders')}>
                Toutes <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {readyOrders.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {readyOrders.slice(0, 4).map(o => (
                    <div key={o.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-brand-600 font-mono">{o.orderNumber}</span>
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{o.personName}</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-emerald-600">{formatCurrency(o.totalAmount)}</span>
                      </div>

                      <Button size="sm" variant="outline" className="text-emerald-700 font-bold" onClick={() => handleQuickStatusChange(o.id, 'DELIVERED')}>
                        Remettre au Client
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Aucune commande en attente de retrait.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 3. DASHBOARD: OPÉRATEUR DE PRODUCTION (Production + Matériel)
  // ============================================================================
  const renderOperatorDashboard = () => {
    const tenantId = currentTenant?.id || 't-001';
    const isAll = tenantId === 'ALL' || tenantId === 'global';

    const agencyOrders = isAll ? state.orders : state.orders.filter(o => o.tenantId === tenantId);
    const agencyEquipment = isAll ? (state.equipment || []) : (state.equipment || []).filter(e => e.tenantId === tenantId);

    const queuedOrders = agencyOrders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');
    const inProduction = agencyOrders.filter(o => o.status === 'IN_PRODUCTION');
    const urgentOrders = agencyOrders.filter(o => o.priority === 'HIGH' || o.priority === 'URGENT');
    const equipmentInService = agencyEquipment.filter(e => e.status === 'EN_SERVICE').length;
    const equipmentIssues = agencyEquipment.filter(e => e.status === 'EN_PANNE' || e.status === 'EN_MAINTENANCE').length;

    return (
      <div className="space-y-6">
        {/* Banner: Production & Machines */}
        <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 p-6 rounded-3xl text-white shadow-lg border border-brand-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold flex items-center gap-2">
              <Factory className="w-5 h-5 text-brand-400" />
              Atelier de Production & Matériel Technique
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Gestion de la file de fabrication (impression, reliure, tirages) et maintenance du parc machines.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" icon={Play} onClick={() => onNavigate('production')}>
              File Kanban Atelier
            </Button>
            <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" icon={Monitor} onClick={() => onNavigate('equipment')}>
              Parc Matériel
            </Button>
          </div>
        </div>

        {/* 4 KPIs: Production & Matériel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">En File d'Attente</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {queuedOrders.length}
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">En Cours Tirage/Reliure</span>
              <Printer className="w-4 h-4 text-brand-500" />
            </div>
            <div className="text-2xl font-black text-brand-600 dark:text-brand-400 mt-2">
              {inProduction.length}
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Commandes Urgentes</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
              {urgentOrders.length}
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Parc Machines Opérationnel</span>
              <Monitor className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
              {equipmentInService} / {agencyEquipment.length}
            </div>
          </Card>
        </div>

        {/* Urgent Orders & Machine Status List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Commandes en Attente de Traitement
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => onNavigate('production')}>
                Kanban Atelier <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {queuedOrders.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {queuedOrders.slice(0, 5).map(o => (
                    <div key={o.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-brand-600 font-mono">{o.orderNumber}</span>
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{o.personName}</span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {o.items.map(i => `${i.quantity}x ${i.serviceName}`).join(', ')}
                        </span>
                      </div>
                      <Badge variant={o.priority === 'URGENT' ? 'danger' : o.priority === 'HIGH' ? 'warning' : 'outline'} size="sm">
                        {o.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Aucune commande en attente dans la file.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                <Monitor className="w-4 h-4 text-brand-500" />
                État du Parc Matériel & Imprimantes
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => onNavigate('equipment')}>
                Voir Tout <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {agencyEquipment.slice(0, 5).map(eq => (
                  <div key={eq.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">{eq.name}</span>
                      <span className="text-[10px] text-slate-400">{eq.location || 'Atelier'} • {eq.brand}</span>
                    </div>
                    <div>
                      {eq.status === 'EN_SERVICE' ? (
                        <Badge variant="success" size="sm">🟢 En Service</Badge>
                      ) : eq.status === 'EN_MAINTENANCE' ? (
                        <Badge variant="warning" size="sm">🟠 Maintenance</Badge>
                      ) : (
                        <Badge variant="danger" size="sm">🔴 En Panne</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 4. DASHBOARD: RESPONSABLE FORMATION
  // ============================================================================
  const renderTrainingLeadDashboard = () => {
    const tenantId = currentTenant?.id || 't-001';
    const isAll = tenantId === 'ALL' || tenantId === 'global';

    const agencyTrainings = isAll ? state.trainings : state.trainings.filter(t => t.tenantId === tenantId);
    const agencySessions = isAll ? state.trainingSessions : state.trainingSessions.filter(s => s.tenantId === tenantId);
    const agencyCertificates = isAll ? state.certificates : state.certificates.filter(c => c.tenantId === tenantId);
    const agencyEnrollments = isAll ? state.enrollments : state.enrollments.filter(e => e.tenantId === tenantId);

    const activeTrainings = agencyTrainings.filter(t => t.isActive);
    const activeSessions = agencySessions.filter(s => s.status === 'OPEN' || s.status === 'IN_PROGRESS');
    const totalCertificates = agencyCertificates.length;
    const totalLearners = agencyEnrollments.length;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 p-6 rounded-3xl text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-amber-400" />
              Pôle Formation & Gestion Pédagogique
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Supervision des cours, planification des sessions, suivi des apprenants et certificats.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" icon={Plus} onClick={onOpenQuickEnrollment}>
              Nouvelle Inscription
            </Button>
            <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" icon={BookOpen} onClick={() => onNavigate('training')}>
              Catalogue & LMS
            </Button>
          </div>
        </div>

        {/* Training KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-amber-500">
            <span className="text-xs font-semibold text-slate-500 uppercase">Formations Actives</span>
            <h3 className="text-2xl font-extrabold text-amber-600 mt-1">{activeTrainings.length}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Dans le catalogue</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-brand-500">
            <span className="text-xs font-semibold text-slate-500 uppercase">Sessions Ouvertes</span>
            <h3 className="text-2xl font-extrabold text-brand-600 mt-1">{activeSessions.length}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">En cours d'apprentissage</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-emerald-500">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Inscrits</span>
            <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{totalLearners}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Apprenants certifiés / actifs</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-amber-500">
            <span className="text-xs font-semibold text-slate-500 uppercase">Certificats Délivrés</span>
            <h3 className="text-2xl font-extrabold text-amber-600 mt-1">{totalCertificates}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Attestations avec QR code</p>
          </Card>
        </div>

        {/* Active Sessions List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              Sessions de Formation en Cours & Programmées
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('training')}>
              Voir Tout le LMS <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {activeSessions.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeSessions.map(s => {
                  const training = state.trainings.find(t => t.id === s.trainingId);
                  const enrolledCount = state.enrollments.filter(e => e.sessionId === s.id).length;
                  return (
                    <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white block">{training?.title || s.trainingTitle}</span>
                        <span className="text-[11px] text-slate-400">
                          Formateur : {s.trainerName || 'Attribué par Resp. Formation'} • Du {formatDate(s.startDate, 'dd/MM')} au {formatDate(s.endDate, 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="warning" size="sm">{enrolledCount} / {s.capacity} apprenants</Badge>
                        <Badge variant={s.status === 'IN_PROGRESS' ? 'success' : 'primary'} size="sm">
                          {s.status === 'IN_PROGRESS' ? 'En Cours' : 'Inscriptions Ouvertes'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                Aucune session active actuellement.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Dispatch appropriate dashboard based on user role
  const renderDashboardByRole = () => {
    switch (roleCode) {
      case 'SUPER_ADMIN':
      case 'ADMIN_CENTRE':
      case 'GERANT':
        return renderAdminDashboard();
      case 'CAISSIER':
      case 'RECEPTIONNISTE':
      case 'MAGASINIER':
        return renderCashierDashboard();
      case 'OPERATEUR':
        return renderOperatorDashboard();
      case 'RESPONSABLE_FORMATION':
      case 'FORMATEUR':
        return renderTrainingLeadDashboard();
      default:
        return renderAdminDashboard();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. SMARTPHONE SIMPLIFIED HOME SECTION (< md) */}
      <div className="md:hidden space-y-4">
        {/* Mobile Greeting & Today's Date */}
        <div className="bg-gradient-to-br from-brand-900 via-slate-900 to-navy-950 p-4 sm:p-5 rounded-3xl text-white shadow-lg border border-brand-800/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-brand-300 font-medium">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h2 className="text-xl font-black tracking-tight mt-0.5">
                Bonjour, {currentUser?.firstName || 'Collaborateur'} 👋
              </h2>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 font-bold">
              {currentUser?.roles[0]?.name || 'Collaborateur'}
            </span>
          </div>

          {/* MAIN ACTIONS: + COMMANDE PRESTATION / + VENDRE UN ARTICLE */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenQuickOrder}
              className="w-full py-3 px-3.5 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-transform min-h-[48px]"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>+ Commande Prestation</span>
            </button>
            <button
              type="button"
              onClick={onOpenQuickArticleSale}
              className="w-full py-3 px-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-transform min-h-[48px]"
            >
              <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
              <span>+ Vendre un article</span>
            </button>
          </div>
        </div>

        {/* Mobile Quick Action Cards Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Mes Commandes */}
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-start gap-2 text-left active:bg-slate-50 dark:active:bg-slate-800 transition-colors min-h-[72px]"
          >
            <div className="p-2 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-slate-900 dark:text-white block">Mes commandes</span>
              <span className="text-[10px] text-slate-400">
                {state.orders.filter(o => o.tenantId === currentTenant?.id || o.tenantId === 'global').length} enregistrée(s)
              </span>
            </div>
          </button>

          {/* Clients */}
          <button
            type="button"
            onClick={() => onNavigate('persons')}
            className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-start gap-2 text-left active:bg-slate-50 dark:active:bg-slate-800 transition-colors min-h-[72px]"
          >
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-slate-900 dark:text-white block">Clients</span>
              <span className="text-[10px] text-slate-400">
                {state.persons.filter(p => p.tenantId === currentTenant?.id || p.tenantId === 'global').length} contact(s)
              </span>
            </div>
          </button>

          {/* Caisse ou Atelier selon rôle */}
          <button
            type="button"
            onClick={() => onNavigate('cash')}
            className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-start gap-2 text-left active:bg-slate-50 dark:active:bg-slate-800 transition-colors min-h-[72px]"
          >
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-slate-900 dark:text-white block">Caisse & Finance</span>
              <span className="text-[10px] text-slate-400">Encaissements & solde</span>
            </div>
          </button>

          {/* Notifications */}
          <button
            type="button"
            onClick={() => onNavigate('notifications')}
            className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-start gap-2 text-left active:bg-slate-50 dark:active:bg-slate-800 transition-colors min-h-[72px]"
          >
            <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-slate-900 dark:text-white block">Notifications</span>
              <span className="text-[10px] text-slate-400">Alertes & messages</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. DESKTOP & TABLET BANNER (>= md) */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-brand-900 via-slate-900 to-navy-950 p-6 rounded-3xl text-white shadow-premium-dark border border-brand-800/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span className="text-xs uppercase font-bold tracking-wider text-brand-300">
              Espace de Travail Personnalisé
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Bonjour, {currentUser?.firstName} {currentUser?.lastName} 👋
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="warning" size="sm">{currentUser?.roles[0]?.name || 'Collaborateur'}</Badge>
            <Badge variant="secondary" size="sm">
              Univers: {currentUser?.department || 'Centre de Prestations'}
            </Badge>
            <span className="text-xs text-slate-400 font-medium ml-1">
              {currentTenant?.name} • {currentBranch?.name}
            </span>
          </div>
        </div>

        {/* Global Quick Action Wizard */}
        <div className="flex items-center gap-3 flex-wrap">
          {(roleCode === 'ADMIN_CENTRE' || roleCode === 'SUPER_ADMIN' || roleCode === 'CAISSIER') && (
            <>
              <Button
                size="md"
                variant="primary"
                icon={Plus}
                onClick={onOpenQuickOrder}
                className="px-5 py-3 text-sm sm:text-base font-extrabold shadow-md hover:scale-[1.02] transition-all"
              >
                + Commande Prestation
              </Button>
              <Button
                size="md"
                variant="success"
                icon={ShoppingBag}
                onClick={onOpenQuickArticleSale}
                className="px-5 py-3 text-sm sm:text-base font-extrabold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white border-none hover:scale-[1.02] transition-all"
              >
                + Vendre un article
              </Button>
              <Button
                size="md"
                variant="outline"
                icon={GraduationCap}
                onClick={onOpenQuickEnrollment}
                className="px-5 py-3 text-sm sm:text-base font-extrabold bg-white/10 text-white border-white/25 hover:bg-white/20 hover:scale-[1.02] transition-all"
              >
                Inscription Formation
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Onboarding & Configuration Score Widget */}
      {!isSuperAdmin && currentTenant && (
        <ConfigurationScoreWidget onOpenWizard={() => setIsOnboardingOpen(true)} />
      )}

      {/* Render Dynamic Role-Specific Dashboard Content */}
      {renderDashboardByRole()}

      {/* Onboarding Wizard Modal */}
      {isOnboardingOpen && (
        <OnboardingWizardModal
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          onCompleted={() => setIsOnboardingOpen(false)}
        />
      )}
    </div>
  );
};

