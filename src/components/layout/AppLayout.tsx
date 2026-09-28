import React, { useState, useEffect } from 'react';
import { Sidebar, NavSection } from './Sidebar';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileAccountDrawer } from './MobileAccountDrawer';
import { TrialBanner } from './TrialBanner';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { QuickOrderModal } from '../../modules/orders/QuickOrderModal';
import { QuickArticleSaleModal } from '../../modules/orders/QuickArticleSaleModal';
import { QuickEnrollmentModal } from '../../modules/enrollments/QuickEnrollmentModal';
import { UserProfileModal } from '../../modules/auth/UserProfileModal';

// Domain Views
import { DashboardView } from '../../modules/dashboard/DashboardView';
import { PersonsView } from '../../modules/persons/PersonsView';
import { OrdersView } from '../../modules/orders/OrdersView';
import { ProductionView } from '../../modules/production/ProductionView';
import { EquipmentView } from '../../modules/equipment/EquipmentView';
import { ServicesPricingView } from '../../modules/services/ServicesPricingView';
import { TrainingView } from '../../modules/training/TrainingView';
import { PaymentsView } from '../../modules/payments/PaymentsView';
import { CashView } from '../../modules/cash/CashView';
import { StockView } from '../../modules/stock/StockView';
import { SuppliersView } from '../../modules/suppliers/SuppliersView';
import { BillingView } from '../../modules/billing/BillingView';
import { ReportsView } from '../../modules/reports/ReportsView';
import { NotificationsView } from '../../modules/notifications/NotificationsView';
import { UsersRbacView } from '../../modules/users/UsersRbacView';
import { AuditView } from '../../modules/audit/AuditView';
import { SettingsView } from '../../modules/settings/SettingsView';
import { LicenseManagementView } from '../../modules/license/LicenseManagementView';
import { TrialExpiredScreen } from '../../modules/license/TrialExpiredScreen';
import { SuperAdminDashboardView } from '../../modules/saas/SuperAdminDashboardView';

import { useAuth } from '../../context/AuthContext';
import { evaluateTenantSubscription } from '../../lib/licenseEngine';
import { isModuleEnabledForAgency } from '../../lib/moduleRegistry';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface AppLayoutProps {
  onOpenCertificateVerification?: (code?: string) => void;
}

const VALID_SECTIONS: NavSection[] = [
  'dashboard', 'persons', 'orders', 'production',
  'equipment', 'services-pricing', 'training', 'payments', 'cash',
  'stock', 'suppliers', 'billing', 'reports', 'notifications',
  'users-rbac', 'audit', 'settings', 'licenses', 'saas-superadmin'
];

export const AppLayout: React.FC<AppLayoutProps> = ({ 
  onOpenCertificateVerification
}) => {
  const { hasPermission, hasAnyPermission, currentUser, currentTenant } = useAuth();

  // Initialize active section from URL hash or localStorage for resilient local routing
  const [currentSection, setCurrentSection] = useState<NavSection>(() => {
    const hash = window.location.hash.replace('#', '') as NavSection;
    if (hash && VALID_SECTIONS.includes(hash)) return hash;
    const saved = localStorage.getItem('cms_active_section') as NavSection;
    if (saved && VALID_SECTIONS.includes(saved)) return saved;
    return 'dashboard';
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileAccountOpen, setIsMobileAccountOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);
  const [isQuickArticleSaleOpen, setIsQuickArticleSaleOpen] = useState(false);
  const [isQuickEnrollmentOpen, setIsQuickEnrollmentOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [userProfileTab, setUserProfileTab] = useState<'INFO' | 'EDIT' | 'PHOTO' | 'SECURITY'>('INFO');

  // License / Trial Subscription Evaluation
  const trialEvaluation = evaluateTenantSubscription(currentTenant);
  const isSuperAdmin = currentUser?.roles.some(r => r.code === 'SUPER_ADMIN');

  // Handle section navigation with URL hash & localStorage sync
  const handleNavigate = (section: NavSection) => {
    setCurrentSection(section);
    localStorage.setItem('cms_active_section', section);
    window.location.hash = section;
  };

  // Listen to browser forward/back buttons & direct URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as NavSection;
      if (hash && VALID_SECTIONS.includes(hash) && hash !== currentSection) {
        setCurrentSection(hash);
        localStorage.setItem('cms_active_section', hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentSection]);

  // Redirection automatique vers le tableau de bord à la connexion
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (!hash || hash === 'login-superadmin' || hash === 'superadmin' || hash === 'saas-superadmin') {
      handleNavigate('dashboard');
    }
  }, [currentUser?.id]);

  // Keyboard shortcut Ctrl+K / Cmd+K for global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // If Account is EXPIRED or SUSPENDED (Block regular access, unless Super Admin in licenses view)
  if ((trialEvaluation.isExpired || trialEvaluation.isSuspended) && !(isSuperAdmin && currentSection === 'licenses')) {
    return (
      <TrialExpiredScreen
        onGoToLicenseManager={isSuperAdmin ? () => handleNavigate('licenses') : undefined}
      />
    );
  }

  const renderAccessDenied = (moduleName: string) => (
    <Card className="p-8 text-center max-w-lg mx-auto mt-12 space-y-4 border-rose-200 dark:border-rose-900/40">
      <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/60 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-black text-slate-900 dark:text-white">Accès Refusé — Autorisation Requise</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Votre poste ({currentUser?.roles[0]?.name || 'Collaborateur'}) ne dispose pas des privilèges nécessaires pour accéder au module <strong>{moduleName}</strong>.
      </p>
      <div className="pt-2">
        <Button variant="primary" icon={ArrowLeft} onClick={() => handleNavigate('dashboard')}>
          Retourner au Tableau de Bord
        </Button>
      </div>
    </Card>
  );

  const renderCurrentSection = () => {
    // Agency Model & Module Security Guard
    if (
      !isSuperAdmin &&
      currentSection !== 'dashboard' &&
      currentSection !== 'saas-superadmin' &&
      !isModuleEnabledForAgency(currentSection as any, currentTenant)
    ) {
      return renderAccessDenied(`Module non inclus dans votre modèle d'agence (${currentTenant?.activityType === 'RETAIL_STORE' ? 'Boutique & Commerce' : 'Services'})`);
    }

    switch (currentSection) {
      case 'dashboard':
        return (
          <DashboardView
            onNavigate={handleNavigate}
            onOpenQuickOrder={() => setIsQuickOrderOpen(true)}
            onOpenQuickArticleSale={() => setIsQuickArticleSaleOpen(true)}
            onOpenQuickEnrollment={() => setIsQuickEnrollmentOpen(true)}
          />
        );
      case 'persons':
        return <PersonsView />;
      case 'orders':
        return (
          <OrdersView
            onOpenQuickOrder={() => setIsQuickOrderOpen(true)}
            onOpenQuickArticleSale={() => setIsQuickArticleSaleOpen(true)}
          />
        );
      case 'production':
        return <ProductionView />;
      case 'equipment':
        if (!hasAnyPermission(['equipment.view', 'equipment.*', 'production.*', '*'])) {
          return renderAccessDenied('Parc Matériel');
        }
        return <EquipmentView />;
      case 'services-pricing':
        return <ServicesPricingView />;
      case 'training':
        if (!hasAnyPermission(['training.view', 'training.*', '*'])) {
          return renderAccessDenied('Formations & LMS');
        }
        return (
          <TrainingView
            onOpenQuickEnrollment={() => setIsQuickEnrollmentOpen(true)}
            onSelectCertificateToVerify={(code) => onOpenCertificateVerification?.(code)}
          />
        );
      case 'payments':
        return <PaymentsView />;
      case 'cash':
        return <CashView />;
      case 'stock':
        if (!hasAnyPermission(['stock.view', 'stock.*', '*'])) {
          return renderAccessDenied('Stock & Consommables');
        }
        return <StockView />;
      case 'suppliers':
        if (!hasAnyPermission(['suppliers.view', 'suppliers.*', '*'])) {
          return renderAccessDenied('Fournisseurs');
        }
        return <SuppliersView />;
      case 'billing':
        return <BillingView />;
      case 'reports':
        if (!hasAnyPermission(['reports.view', 'reports.*', '*'])) {
          return renderAccessDenied('Rapports & Statistiques Financières');
        }
        return <ReportsView />;
      case 'notifications':
        return <NotificationsView />;
      case 'users-rbac':
        if (!hasAnyPermission(['users.view', 'users.*', 'roles.*', '*'])) {
          return renderAccessDenied('Utilisateurs, Postes & Permissions');
        }
        return <UsersRbacView />;
      case 'audit':
        if (!hasAnyPermission(['audit.view', 'audit.*', '*'])) {
          return renderAccessDenied('Journal d\'Audit');
        }
        return <AuditView />;
      case 'settings':
        if (!hasAnyPermission(['settings.view', 'signatures.*', 'settings.*', '*'])) {
          return renderAccessDenied('Paramètres Généraux, Signatures & Cachet');
        }
        return <SettingsView />;
      case 'licenses':
        return <LicenseManagementView />;
      case 'saas-superadmin':
        return <SuperAdminDashboardView onNavigateToAgency={() => handleNavigate('dashboard')} />;
      default:
        return (
          <DashboardView
            onNavigate={handleNavigate}
            onOpenQuickOrder={() => setIsQuickOrderOpen(true)}
            onOpenQuickArticleSale={() => setIsQuickArticleSaleOpen(true)}
            onOpenQuickEnrollment={() => setIsQuickEnrollmentOpen(true)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar
        currentSection={currentSection}
        onNavigate={handleNavigate}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        {/* Discrete Trial Banner */}
        <TrialBanner />

        <Header
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onNavigate={handleNavigate}
          onOpenQuickOrder={() => setIsQuickOrderOpen(true)}
          onOpenQuickArticleSale={() => setIsQuickArticleSaleOpen(true)}
          onOpenQuickEnrollment={() => setIsQuickEnrollmentOpen(true)}
          onOpenUserProfile={(tab) => {
            setUserProfileTab(tab || 'INFO');
            setIsUserProfileOpen(true);
          }}
        />

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto overflow-x-hidden">
          {renderCurrentSection()}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation */}
      <MobileBottomNav
        currentSection={currentSection}
        onNavigate={handleNavigate}
        onOpenQuickOrder={() => setIsQuickOrderOpen(true)}
        onOpenAccountMenu={() => setIsMobileAccountOpen(true)}
      />

      {/* Mobile Account Bottom Drawer */}
      <MobileAccountDrawer
        isOpen={isMobileAccountOpen}
        onClose={() => setIsMobileAccountOpen(false)}
        onNavigate={handleNavigate}
        onOpenUserProfile={(tab) => {
          setUserProfileTab(tab || 'INFO');
          setIsUserProfileOpen(true);
        }}
      />

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      <QuickOrderModal
        isOpen={isQuickOrderOpen}
        onClose={() => setIsQuickOrderOpen(false)}
        onOrderCreated={() => handleNavigate('orders')}
      />

      <QuickArticleSaleModal
        isOpen={isQuickArticleSaleOpen}
        onClose={() => setIsQuickArticleSaleOpen(false)}
        onSaleCompleted={() => handleNavigate('orders')}
      />

      <QuickEnrollmentModal
        isOpen={isQuickEnrollmentOpen}
        onClose={() => setIsQuickEnrollmentOpen(false)}
        onEnrollmentCreated={() => handleNavigate('training')}
      />

      <UserProfileModal
        isOpen={isUserProfileOpen}
        onClose={() => setIsUserProfileOpen(false)}
        defaultTab={userProfileTab}
      />
    </div>
  );
};
