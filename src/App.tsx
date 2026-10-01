import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginView } from './modules/auth/LoginView';
import { CertificateVerificationView } from './modules/certificates/CertificateVerificationView';
import { EmailVerificationView } from './modules/auth/EmailVerificationView';

const MainAppRouter: React.FC<{
  currentPath: string;
  currentHash: string;
  onOpenCertificateVerification: (code?: string) => void;
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
}> = ({
  currentPath,
  currentHash,
  onOpenCertificateVerification,
  onNavigateHome,
  onNavigateDashboard
}) => {
  const { isAuthenticated } = useAuth();

  // If email verification route is visited (/verify-email or #verify-email)
  const isVerifyEmailRoute = currentPath.startsWith('/verify-email') || currentHash.startsWith('#verify-email');
  if (isVerifyEmailRoute) {
    return (
      <EmailVerificationView
        onNavigateToLogin={onNavigateHome}
        onNavigateToDashboard={onNavigateDashboard}
      />
    );
  }

  useEffect(() => {
    if (!isAuthenticated && window.location.hash && !window.location.hash.startsWith('#verify-email') && !window.location.hash.startsWith('#superadmin') && !window.location.hash.startsWith('#login-superadmin')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return (
      <AppLayout
        onOpenCertificateVerification={onOpenCertificateVerification}
      />
    );
  }

  return <LoginView />;
};

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  const [verifyCertCode, setVerifyCertCode] = useState<string>('CERT-2026-000001');

  useEffect(() => {
    const handleNavigationChange = () => {
      setCurrentPath(window.location.pathname);
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('popstate', handleNavigationChange);
    window.addEventListener('hashchange', handleNavigationChange);
    return () => {
      window.removeEventListener('popstate', handleNavigationChange);
      window.removeEventListener('hashchange', handleNavigationChange);
    };
  }, []);

  // Check if public certificate verification route is requested
  const isVerifyRoute = currentPath.startsWith('/verify/certificate') || currentPath === '/verify';

  if (isVerifyRoute) {
    const codeFromPath = currentPath.split('/verify/certificate/')[1] || verifyCertCode;
    return (
      <CertificateVerificationView
        initialCode={codeFromPath}
        onBackToApp={() => {
          window.history.pushState({}, '', '/');
          setCurrentPath('/');
          setCurrentHash('');
        }}
      />
    );
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <MainAppRouter
          currentPath={currentPath}
          currentHash={currentHash}
          onNavigateHome={() => {
            window.history.pushState({}, '', '/');
            setCurrentPath('/');
            setCurrentHash('');
            window.location.hash = '';
          }}
          onNavigateDashboard={() => {
            window.history.pushState({}, '', '/');
            setCurrentPath('/');
            setCurrentHash('dashboard');
            window.location.hash = 'dashboard';
            localStorage.setItem('cms_active_section', 'dashboard');
          }}
          onOpenCertificateVerification={(code) => {
            setVerifyCertCode(code || 'CERT-2026-000001');
            window.history.pushState({}, '', `/verify/certificate/${code || 'CERT-2026-000001'}`);
            setCurrentPath(`/verify/certificate/${code || 'CERT-2026-000001'}`);
          }}
        />
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
