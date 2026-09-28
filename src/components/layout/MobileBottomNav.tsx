import React from 'react';
import { NavSection } from './Sidebar';
import { LayoutDashboard, Plus, ShoppingBag, User } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MobileBottomNavProps {
  currentSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onOpenQuickOrder: () => void;
  onOpenAccountMenu: () => void;
  unreadCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentSection,
  onNavigate,
  onOpenQuickOrder,
  onOpenAccountMenu,
  unreadCount = 0,
}) => {
  return (
    <nav
      aria-label="Navigation mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 pb-safe"
    >
      <div className="grid grid-cols-4 items-center max-w-md mx-auto">
        {/* 1. Accueil */}
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className={cn(
            "flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-150 min-h-[48px]",
            currentSection === 'dashboard'
              ? "text-brand-600 dark:text-brand-400 font-extrabold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          )}
        >
          <div className={cn(
            "p-1 rounded-xl transition-all",
            currentSection === 'dashboard' ? "bg-brand-50 dark:bg-brand-950/60" : ""
          )}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">Accueil</span>
        </button>

        {/* 2. Nouvelle Commande (Action Principale Prominente) */}
        <button
          type="button"
          onClick={onOpenQuickOrder}
          className="flex flex-col items-center justify-center py-1 px-1 text-white min-h-[48px] group"
          title="Créer une nouvelle commande de prestation"
        >
          <div className="w-11 h-11 -mt-4 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-brand-500/30 ring-4 ring-white dark:ring-slate-900 transform active:scale-95 transition-transform">
            <Plus className="w-6 h-6 text-white stroke-[2.5]" />
          </div>
          <span className="text-[11px] font-black text-brand-600 dark:text-brand-400 mt-0.5 tracking-tight">
            Commande
          </span>
        </button>

        {/* 3. Mes Commandes */}
        <button
          type="button"
          onClick={() => onNavigate('orders')}
          className={cn(
            "flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-150 min-h-[48px]",
            currentSection === 'orders'
              ? "text-brand-600 dark:text-brand-400 font-extrabold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          )}
        >
          <div className={cn(
            "p-1 rounded-xl transition-all",
            currentSection === 'orders' ? "bg-brand-50 dark:bg-brand-950/60" : ""
          )}>
            <ShoppingBag className="w-5 h-5" />
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">Commandes</span>
        </button>

        {/* 4. Compte & Profil */}
        <button
          type="button"
          onClick={onOpenAccountMenu}
          className={cn(
            "flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-150 min-h-[48px] relative",
            "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          )}
        >
          <div className="p-1 rounded-xl relative">
            <User className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">Compte</span>
        </button>
      </div>
    </nav>
  );
};
