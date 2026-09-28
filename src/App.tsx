import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginView } from './modules/auth/LoginView';
import { CertificateVerificationView } from './modules/certificates/CertificateVerificationView';

const MainAppRouter: React.FC<{
  onOpenCertificateVerification: (code?: string) => void;
}> = ({ onOpenCertificateVerification }) => {
  const { isAuthenticated } = useAuth();

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
  const [verifyCertCode, setVerifyCertCode] = useState<string>('CERT-2026-000001');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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
        }}
      />
    );
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <MainAppRouter
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
