import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { AppNotification } from '../types';
import { dbStore } from '../server/db/mockStore';
import { useAuth } from './AuthContext';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  toasts: Toast[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  showToast: (title: string, message: string, type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER') => void;
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant, currentUser, isSuperAdmin } = useAuth();
  const [storeState, setStoreState] = useState(() => dbStore.getState());
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return dbStore.subscribe(() => {
      setStoreState({ ...dbStore.getState() });
    });
  }, []);

  const effectiveTenantId = currentTenant?.id;

  // Strict tenant & user isolation for notifications
  const notifications = useMemo<AppNotification[]>(() => {
    return dbStore.getTenantNotifications(effectiveTenantId, currentUser?.id, isSuperAdmin);
  }, [storeState, effectiveTenantId, currentUser?.id, isSuperAdmin]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (id: string) => {
    dbStore.updateState(draft => {
      const notif = draft.notifications.find(n => n.id === id);
      if (notif) notif.isRead = true;
    });
  };

  const markAllAsRead = () => {
    dbStore.updateState(draft => {
      draft.notifications.forEach(n => {
        // Only mark notifications scoped to current tenant/user as read
        if (
          isSuperAdmin ||
          (effectiveTenantId && n.tenantId === effectiveTenantId) ||
          (currentUser?.id && n.userId === currentUser.id)
        ) {
          n.isRead = true;
        }
      });
    });
  };

  const showToast = (title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER' = 'INFO') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, title, message, type };
    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      dismissToast(id);
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        markAsRead,
        markAllAsRead,
        showToast,
        dismissToast,
      }}
    >
      {children}

      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-premium border backdrop-blur-md flex items-start space-x-3 transition-all duration-300 transform translate-y-0 ${
              toast.type === 'SUCCESS'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
                : toast.type === 'WARNING'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-100'
                : toast.type === 'DANGER'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-100'
                : 'bg-slate-900/90 border-slate-700 text-slate-100'
            }`}
          >
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold">{toast.title}</h4>
              <p className="text-xs mt-0.5 opacity-90">{toast.message}</p>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-xs opacity-60 hover:opacity-100 transition-opacity p-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

