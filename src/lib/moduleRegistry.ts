import { ActivityType, Tenant, Agency } from '../types';
import {
  LayoutDashboard, Users, ShoppingBag, Store, Factory,
  Monitor, Tag, GraduationCap, CreditCard, Wallet, Boxes,
  Truck, Receipt, BarChart3, Bell, ShieldCheck, History,
  Settings, KeyRound, UtensilsCrossed, Building2, PackageCheck,
  MessageSquare
} from 'lucide-react';

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  category: 'CORE' | 'COMMERCIAL' | 'SERVICES' | 'FINANCE' | 'ADMIN' | 'FUTURE';
  icon: any;
  requiredPermissions?: string[];
  isAvailableForActivities: ActivityType[];
}

export interface ActivityTypeConfig {
  type: ActivityType;
  label: string;
  badgeColor: string;
  description: string;
  icon: any;
  defaultModules: string[];
  isFutureOnly?: boolean;
}

export const ACTIVITY_TYPES_CONFIG: Record<ActivityType, ActivityTypeConfig> = {
  SERVICE_CENTER: {
    type: 'SERVICE_CENTER',
    label: 'Centre de Prestations & Services',
    badgeColor: 'primary',
    description: 'Prestations de reprographie, imprimerie, secrétariat, formations et consommables associés.',
    icon: Building2,
    defaultModules: [
      'dashboard', 'persons', 'orders', 'services-pricing', 'production',
      'equipment', 'training', 'stock', 'suppliers',
      'cash', 'payments', 'billing', 'reports', 'notifications',
      'users-rbac', 'audit', 'settings', 'licenses'
    ]
  },
  RETAIL_STORE: {
    type: 'RETAIL_STORE',
    label: 'Centre de Services Spécialisés',
    badgeColor: 'success',
    description: 'Prestations de services et reprographie spécialisée.',
    icon: Building2,
    defaultModules: [
      'dashboard', 'orders', 'persons', 'services-pricing', 'production', 'stock', 'suppliers',
      'cash', 'payments', 'billing', 'reports', 'notifications',
      'users-rbac', 'audit', 'settings', 'licenses'
    ]
  },
  RESTAURANT: {
    type: 'RESTAURANT',
    label: 'Services & Restauration (Prévu)',
    badgeColor: 'warning',
    description: 'Services associés.',
    icon: UtensilsCrossed,
    defaultModules: [
      'dashboard', 'stock', 'suppliers', 'cash', 'payments',
      'billing', 'reports', 'notifications', 'users-rbac', 'audit', 'settings', 'licenses'
    ],
    isFutureOnly: true
  },
  WHOLESALE: {
    type: 'WHOLESALE',
    label: 'Centre de Prestations Grands Volumes',
    badgeColor: 'secondary',
    description: 'Tirages grands volumes et façonnage.',
    icon: PackageCheck,
    defaultModules: [
      'dashboard', 'orders', 'persons', 'services-pricing', 'production', 'stock', 'suppliers',
      'cash', 'payments', 'billing', 'reports', 'notifications',
      'users-rbac', 'audit', 'settings', 'licenses'
    ]
  },
  OTHER: {
    type: 'OTHER',
    label: 'Autre Centre de Services',
    badgeColor: 'outline',
    description: 'Entreprise de prestations et services.',
    icon: Building2,
    defaultModules: [
      'dashboard', 'orders', 'persons', 'services-pricing', 'production', 'stock', 'suppliers',
      'cash', 'payments', 'billing', 'reports', 'notifications',
      'users-rbac', 'audit', 'settings', 'licenses'
    ]
  }
};

export const MODULE_CATALOG: ModuleDefinition[] = [
  {
    id: 'dashboard',
    name: 'Tableau de Bord 360°',
    description: 'Indicateurs clés de performance et synthèse opérationnelle du centre.',
    category: 'CORE',
    icon: LayoutDashboard,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'persons',
    name: 'Clients & Contacts',
    description: 'Fichier clients enregistrés, clients de passage et comptes du centre.',
    category: 'COMMERCIAL',
    icon: Users,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'orders',
    name: 'Commandes de Prestations & Devis',
    description: 'Prise de commande de prestations, devis, dossiers commerciaux et bons de livraison.',
    category: 'COMMERCIAL',
    icon: ShoppingBag,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'services-pricing',
    name: 'Services & Grille Tarifaire',
    description: 'Catalogue des prestations, options, règles de calcul et consommables.',
    category: 'SERVICES',
    icon: Tag,
    isAvailableForActivities: ['SERVICE_CENTER']
  },
  {
    id: 'production',
    name: 'Atelier de Production',
    description: 'Suivi des travaux de reprographie, reliure et façonnage.',
    category: 'SERVICES',
    icon: Factory,
    isAvailableForActivities: ['SERVICE_CENTER']
  },
  {
    id: 'equipment',
    name: 'Parc Matériel & Maintenance',
    description: 'Inventaire des copieurs, massicots et compteurs machine.',
    category: 'SERVICES',
    icon: Monitor,
    isAvailableForActivities: ['SERVICE_CENTER']
  },
  {
    id: 'training',
    name: 'Pôle Formation & LMS',
    description: 'Catalogue des cours, sessions, apprenants et attestations.',
    category: 'SERVICES',
    icon: GraduationCap,
    isAvailableForActivities: ['SERVICE_CENTER']
  },
  {
    id: 'stock',
    name: 'Stock, Magasins & Unités',
    description: 'Quantité de référence unique en unité de base et conditionnements multi-niveaux.',
    category: 'COMMERCIAL',
    icon: Boxes,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'suppliers',
    name: 'Fournisseurs & Bons de Commande',
    description: 'Gestion des réapprovisionnements, bons de commande et réceptions.',
    category: 'COMMERCIAL',
    icon: Truck,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'cash',
    name: 'Gestion de Caisse',
    description: 'Ouverture/clôture de session de caisse, fonds de roulement et écarts.',
    category: 'FINANCE',
    icon: Wallet,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'payments',
    name: 'Encaissements & Règlements',
    description: 'Journal des paiements, reçus et décharges.',
    category: 'FINANCE',
    icon: CreditCard,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'billing',
    name: 'Facturation & Devis',
    description: 'Factures proforma, factures définitives et avoirs.',
    category: 'FINANCE',
    icon: Receipt,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'reports',
    name: 'Rapports & Statistiques',
    description: 'Chiffre d\'affaires, marges, rentabilité et exports comptables.',
    category: 'ADMIN',
    icon: BarChart3,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'notifications',
    name: 'Centre de Notifications',
    description: 'Alertes stock faible, relances et messages système.',
    category: 'CORE',
    icon: Bell,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'users-rbac',
    name: 'Utilisateurs & Postes',
    description: 'Gestion des comptes d\'employés de l\'agence et permissions RBAC.',
    category: 'ADMIN',
    icon: ShieldCheck,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'audit',
    name: 'Journal d\'Audit',
    description: 'Traçabilité inviolable des opérations sensibles de l\'agence.',
    category: 'ADMIN',
    icon: History,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'settings',
    name: 'Paramètres de l\'Agence',
    description: 'En-tête, logo, coordonnées, devise et signatures électroniques.',
    category: 'ADMIN',
    icon: Settings,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  },
  {
    id: 'licenses',
    name: 'Licences & Souscription',
    description: 'État du plan d\'abonnement, validité et demandes d\'activation.',
    category: 'ADMIN',
    icon: KeyRound,
    isAvailableForActivities: ['SERVICE_CENTER', 'RETAIL_STORE', 'RESTAURANT', 'WHOLESALE', 'OTHER']
  }
];

/**
 * Checks whether a module is available and enabled for a given agency.
 */
export function isModuleEnabledForAgency(moduleId: string, agency: Agency | null): boolean {
  if (!agency) return true;
  const activityType = agency.activityType || 'SERVICE_CENTER';
  const config = ACTIVITY_TYPES_CONFIG[activityType] || ACTIVITY_TYPES_CONFIG.SERVICE_CENTER;

  // Check if module is allowed for this activity type
  const moduleDef = MODULE_CATALOG.find(m => m.id === moduleId);
  if (moduleDef && !moduleDef.isAvailableForActivities.includes(activityType)) {
    return false;
  }

  // If agency has explicit custom enabledModules list, respect it
  if (agency.enabledModules && agency.enabledModules.length > 0) {
    return agency.enabledModules.includes(moduleId);
  }

  // Otherwise fallback to activity defaults
  return config.defaultModules.includes(moduleId);
}

/**
 * Returns list of all available activity types with their metadata.
 */
export function getAvailableActivityTypes(): ActivityTypeConfig[] {
  return Object.values(ACTIVITY_TYPES_CONFIG);
}
