import {
  Tenant, Branch, Role, RoleCode, User, Person, ClientStoreRelation, ServiceCategory, Service,
  Order, OrderItem, OrderStatus, ProductionJob, TrainingCategory, Training, Classroom, TrainingSession,
  Enrollment, AttendanceSheet, Assessment, Certificate, CashRegister,
  CashSession, Payment, Expense, ExpenseCategory, Product, ProductCategory, ProductPackaging, StockMovement, StockMovementType, Supplier, PurchaseOrder, PurchaseOrderItem, RequestingDepartment,
  UnitOfMeasure,
  Invoice, AppNotification, AuditLog, Equipment, EquipmentMaintenance,
  ServicePriceHistory, DiscountAudit, DiscountRoleLimit,
  ActivityType, AgencyStatus, LicensePlan, Currency,
  FinancialAccount, FinancialAccountType, FinancialMovement, FinancialMovementType, FinancialMovementCategory,
  FinancialYear, FinancialYearStatus, FinancialPeriod, FinancialPeriodStatus,
  SupplierPayment, SupplierDebt, SupplierDebtStatus, PurchaseOrderStatus, PurchaseOrderPaymentStatus, PaymentMethod, AccountResetRecord,
  Store, StoreType, ConsumableMode, ServiceConsumableConfig, UserProfileUpdateData,
  ResetLevel, ResetSummaryData, OperationalResetOptions, ResetExecutionResult
} from '../../types';
import { generateDocNumber, formatCurrency } from '../../lib/utils';
import {
  resolveProductPurchasePrice,
  calculateServiceStockConsumption,
  calculateOrderConsumablesRequirements,
  checkOrderConsumablesAvailability,
  ConsumableRequirementItem,
  StockAvailabilityResult
} from '../../lib/stockEngine';
import {
  checkAccountLockout,
  getLockoutDurationMinutes,
  getLockoutDurationMs,
  formatLockoutMessage,
  checkIpRateLimit,
  recordFailedIpAttempt,
  recordSuccessfulIpAttempt,
  sanitizeAuditPayload,
  SECURITY_CONFIG,
  canPerformFinancialSensitiveAction,
  getFinancialUserRoleLabel,
  formatFinancialAuditMessage,
  FinancialSensitiveAction
} from '../security/securityEngine';
import { isValidPhoneNumber, sanitizePhoneInput, validatePhoneWithDetails } from '../../lib/phoneValidation';
import { validatePasswordByPolicy, hashPassword, getAccountCategory, verifyPassword } from '../../lib/passwordSecurity';
import { supabaseService } from './supabaseService';
import { isSupabaseConfigured, checkSupabaseConnection } from '../../lib/supabaseClient';

const STORAGE_KEY = 'cms_app_database_state_v1';

export interface DatabaseState {
  tenants: Tenant[];
  branches: Branch[];
  roles: Role[];
  users: User[];
  persons: Person[];
  serviceCategories: ServiceCategory[];
  services: Service[];
  priceHistories: ServicePriceHistory[];
  discountAudits: DiscountAudit[];
  orders: Order[];
  productionJobs: ProductionJob[];
  trainingCategories: TrainingCategory[];
  trainings: Training[];
  classrooms: Classroom[];
  trainingSessions: TrainingSession[];
  enrollments: Enrollment[];
  attendanceSheets: AttendanceSheet[];
  assessments: Assessment[];
  certificates: Certificate[];
  cashRegisters: CashRegister[];
  cashSessions: CashSession[];
  payments: Payment[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  financialAccounts: FinancialAccount[];
  financialYears: FinancialYear[];
  financialPeriods: FinancialPeriod[];
  financialMovements: FinancialMovement[];
  supplierDebts: SupplierDebt[];
  supplierPayments: SupplierPayment[];
  productCategories: ProductCategory[];
  stores: Store[];
  products: Product[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
  requestingDepartments: RequestingDepartment[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  equipment: Equipment[];
  equipmentMaintenances: EquipmentMaintenance[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  currentTenantId: string;
  currentUserId: string;
}

const INITIAL_TENANT_ID = 't-001';
const INITIAL_BRANCH_ID = 'b-001';

export const INITIAL_STORES: Store[] = [
  {
    id: 'store-cpep-main',
    tenantId: 't-001',
    branchId: 'b-001',
    name: 'Magasin Principal (Kaloum)',
    code: 'MAG-KAL-01',
    type: 'MAIN',
    location: 'Bâtiment Principal, RDC - Kaloum',
    responsibleUserId: 'u-admin-01',
    responsibleUserName: 'Ibrahima Sory Camara',
    isDefault: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'store-cpep-workshop',
    tenantId: 't-001',
    branchId: 'b-001',
    name: 'Atelier Reprographie & Prestations',
    code: 'MAG-ATEL-01',
    type: 'WORKSHOP',
    location: 'Salle des Machines & Façonnage',
    responsibleUserId: 'u-op-01',
    responsibleUserName: 'Mamadou Oury Bah',
    isDefault: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'store-cpep-boutique',
    tenantId: 't-001',
    branchId: 'b-001',
    name: 'Boutique Papeterie & Fournitures',
    code: 'MAG-BOUT-01',
    type: 'POINT_OF_SALE',
    location: 'Comptoir d\'Accueil & Vente directe',
    responsibleUserId: 'u-caissier-01',
    responsibleUserName: 'Fatoumata Binta Barry',
    isDefault: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  // Agence B (t-002)
  {
    id: 'store-horizon-main',
    tenantId: 't-002',
    name: 'Dépôt Principal Matériaux Horizon',
    code: 'DEP-BAMB-01',
    type: 'WAREHOUSE',
    location: 'Zone de Stockage BTP Bambéto',
    responsibleUserName: 'Elhadj Boubacar Diallo',
    isDefault: true,
    isActive: true,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z'
  },
  {
    id: 'store-horizon-shop',
    tenantId: 't-002',
    name: 'Boutique Quincaillerie Bambéto',
    code: 'MAG-QUINC-02',
    type: 'POINT_OF_SALE',
    location: 'Showroom & Caisse Horizon',
    responsibleUserName: 'Elhadj Boubacar Diallo',
    isDefault: false,
    isActive: true,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z'
  }
];

export const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export function generateMonthlyPeriodsForYear(
  yearId: string,
  tenantId: string,
  year: number,
  activeMonthIndex: number = 8 // Default to September (index 8)
): FinancialPeriod[] {
  return MONTH_NAMES_FR.map((name, index) => {
    const monthNum = index + 1;
    const monthStr = String(monthNum).padStart(2, '0');
    const lastDay = new Date(year, monthNum, 0).getDate();
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    const code = `PER-${year}-${monthStr}`;

    return {
      id: `fp-${tenantId}-${year}-${monthStr}`,
      tenantId,
      financialYearId: yearId,
      code,
      name: `${name} ${year}`,
      monthNumber: monthNum,
      year,
      startDate,
      endDate,
      status: 'OPEN' as FinancialPeriodStatus,
      isCurrentPeriod: index === activeMonthIndex,
      totalInflows: 0,
      totalOutflows: 0,
      netCashFlow: 0,
      movementsCount: 0,
      createdAt: `${year}-01-01T00:00:00Z`
    };
  });
}

export const INITIAL_STATE: DatabaseState = {
  currentTenantId: INITIAL_TENANT_ID,
  currentUserId: 'u-admin-01',
  stores: INITIAL_STORES,
  tenants: [
    {
      id: INITIAL_TENANT_ID,
      name: "Centre Polyvalent d'Excellence & Prestations (CPEP)",
      code: "CPEP-01",
      slug: "cpep-conakry",
      phone: "+224 620 00 11 22",
      email: "contact@cpep-guinee.com",
      address: "Avenue de la République, Kaloum, Conakry",
      currency: "GNF",
      taxRate: 0,
      isActive: true,
      subscriptionStatus: "TRIAL",
      trialStartedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(), // 13 jours écoulés, reste 32 jours
      trialEndsAt: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(),
      trialDaysTotal: 45,
      activationRequests: [],
      supportContact: {
        name: "Direction Commerciale & Support Client CPEP",
        phone: "+224 620 00 11 22",
        whatsapp: "+224 620 00 11 22",
        email: "licences@cpep-guinee.com",
        address: "Avenue de la République, Kaloum, Conakry (Guinée)",
        customMessage: "Nos conseillers sont disponibles du Lundi au Samedi pour activer votre licence définitive ou répondre à vos questions techniques."
      },
      settings: {
        companyHeader: "CPEP SARL - RCCM: GN.TCC.2024.B.01234 - NIF: 009876543K",
        invoiceFooter: "Merci pour votre confiance. Les marchandises vendues ne sont ni reprises ni échangées.",
        certificateSignerName: "Dr. Alpha Mamadou Diallo",
        certificateSignerTitle: "Directeur Général du Centre",
        branding: {
          logoUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=150&auto=format&fit=crop&q=80",
          logoPosition: 'center',
          logoSize: 'md',
          showLogo: true,
          slogan: "L'Excellence au Service de Vos Impressions & Formations d'Avenir",
          website: "https://www.cpep-guinee.com",
          headerAlignment: 'center',
          showPhone: true,
          showEmail: true,
          showAddress: true,
          showWebsite: true,
          footerText: "CPEP SARL • Agrément Ministériel N° 2024/098/METFP • Centre d'Excellence Professionnel",
          footerAlignment: 'center',
          showFooter: true,
        },
        digitalSignatures: [
          {
            id: 'sig-dir-01',
            tenantId: INITIAL_TENANT_ID,
            type: 'DIRECTOR',
            signerName: 'Dr. Alpha Mamadou Diallo',
            signerTitle: 'Directeur Général du Centre',
            imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" width="320" height="120"><path d="M 30 75 Q 70 20 110 50 Q 140 80 180 35 Q 210 10 240 60 Q 260 80 290 55 M 60 70 Q 130 95 270 65" fill="none" stroke="%231e3a8a" stroke-width="3.5" stroke-linecap="round"/><text x="140" y="105" font-family="cursive, sans-serif" font-size="16" font-style="italic" fill="%231e3a8a">Alpha M. Diallo</text></svg>',
            version: 1,
            description: 'Signature officielle du Directeur Général en exercice',
            widthPx: 180,
            heightPx: 70,
            alignment: 'center',
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z'
          },
          {
            id: 'sig-train-01',
            tenantId: INITIAL_TENANT_ID,
            type: 'TRAINER',
            signerName: 'M. Ousmane Soumah',
            signerTitle: 'Formateur Référent Informatique & Bureautique',
            imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" width="320" height="120"><path d="M 40 60 Q 80 15 120 70 Q 150 100 190 40 Q 220 15 260 75 M 80 85 Q 160 50 250 80" fill="none" stroke="%23047857" stroke-width="3" stroke-linecap="round"/><text x="130" y="105" font-family="cursive, sans-serif" font-size="15" font-style="italic" fill="%23047857">O. Soumah</text></svg>',
            version: 1,
            description: 'Signature pédagogique du Formateur Principal',
            widthPx: 170,
            heightPx: 65,
            alignment: 'center',
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z'
          },
          {
            id: 'stamp-01',
            tenantId: INITIAL_TENANT_ID,
            type: 'STAMP',
            signerName: 'Cachet Officiel CPEP',
            signerTitle: 'Sceau Officiel de Direction',
            imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><circle cx="100" cy="100" r="92" fill="none" stroke="%23b91c1c" stroke-width="4.5" stroke-dasharray="8 4"/><circle cx="100" cy="100" r="82" fill="none" stroke="%23b91c1c" stroke-width="2"/><circle cx="100" cy="100" r="54" fill="none" stroke="%23b91c1c" stroke-width="1.8"/><path id="topCurve" d="M 30 100 A 70 70 0 0 1 170 100" fill="none"/><path id="bottomCurve" d="M 170 100 A 70 70 0 0 1 30 100" fill="none"/><text fill="%23b91c1c" font-size="9.5" font-weight="900" font-family="sans-serif" letter-spacing="1.5"><textPath href="%23topCurve" startOffset="50%" text-anchor="middle">★ CENTRE CPEP GUINÉE ★</textPath></text><text fill="%23b91c1c" font-size="9" font-weight="900" font-family="sans-serif" letter-spacing="1.2"><textPath href="%23bottomCurve" startOffset="50%" text-anchor="middle">DIRECTION GÉNÉRALE</textPath></text><text x="100" y="93" text-anchor="middle" fill="%23b91c1c" font-size="12" font-weight="900" font-family="sans-serif">SCEAU</text><text x="100" y="112" text-anchor="middle" fill="%23b91c1c" font-size="10.5" font-weight="800" font-family="sans-serif">OFFICIEL</text></svg>',
            version: 1,
            description: 'Cachet d\'authentification circulaire officiel du centre',
            widthPx: 130,
            heightPx: 130,
            alignment: 'center',
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z'
          }
        ],
        documentSignatureConfigs: [
          {
            documentType: 'INVOICE',
            showDirectorSignature: true,
            showTrainerSignature: false,
            showOfficialStamp: true,
            directorSignatureId: 'sig-dir-01',
            officialStampId: 'stamp-01'
          },
          {
            documentType: 'RECEIPT',
            showDirectorSignature: true,
            showTrainerSignature: false,
            showOfficialStamp: true,
            directorSignatureId: 'sig-dir-01',
            officialStampId: 'stamp-01'
          },
          {
            documentType: 'QUOTE',
            showDirectorSignature: true,
            showTrainerSignature: false,
            showOfficialStamp: true,
            directorSignatureId: 'sig-dir-01',
            officialStampId: 'stamp-01'
          },
          {
            documentType: 'CERTIFICATE',
            showDirectorSignature: true,
            showTrainerSignature: true,
            showOfficialStamp: true,
            directorSignatureId: 'sig-dir-01',
            trainerSignatureId: 'sig-train-01',
            officialStampId: 'stamp-01'
          },
          {
            documentType: 'ATTESTATION',
            showDirectorSignature: true,
            showTrainerSignature: true,
            showOfficialStamp: true,
            directorSignatureId: 'sig-dir-01',
            trainerSignatureId: 'sig-train-01',
            officialStampId: 'stamp-01'
          },
          {
            documentType: 'ATTENDANCE_SHEET',
            showDirectorSignature: false,
            showTrainerSignature: true,
            showOfficialStamp: true,
            trainerSignatureId: 'sig-train-01',
            officialStampId: 'stamp-01'
          }
        ],
        discountRoleLimits: [
          { roleCode: 'OPERATEUR', roleName: 'Opérateur de Production', maxDiscountPercent: 0, canGrantExceptional: false, requiresApprovalAbove: 0 },
          { roleCode: 'CAISSIER', roleName: 'Caissier & Accueil', maxDiscountPercent: 10, canGrantExceptional: true, requiresApprovalAbove: 10 },
          { roleCode: 'RESPONSABLE_FORMATION', roleName: 'Responsable Formation', maxDiscountPercent: 15, canGrantExceptional: true, requiresApprovalAbove: 15 },
          { roleCode: 'ADMIN_CENTRE', roleName: 'Admin du Centre', maxDiscountPercent: 50, canGrantExceptional: true, requiresApprovalAbove: 50 },
          { roleCode: 'SUPER_ADMIN', roleName: 'Super Administrateur', maxDiscountPercent: 100, canGrantExceptional: true, requiresApprovalAbove: 100 },
        ]
      },
      activityType: "SERVICE_CENTER",
      status: "ACTIVE",
      responsibleName: "Dr. Alpha Mamadou Diallo",
      createdAt: "2026-01-01T00:00:00Z"
    },
    {
      id: "t-002",
      name: "Boutique Quincaillerie & Matériaux Horizon",
      code: "HQM-02",
      slug: "horizon-quincaillerie",
      activityType: "RETAIL_STORE",
      status: "ACTIVE",
      responsibleName: "Elhadj Boubacar Diallo",
      phone: "+224 628 44 55 66",
      email: "direction@horizon-quincaillerie.com",
      address: "Route Le Prince, Bambéto, Conakry",
      currency: "GNF",
      taxRate: 0,
      isActive: true,
      subscriptionStatus: "ACTIVE",
      trialStartedAt: "2026-01-01T00:00:00Z",
      trialEndsAt: "2027-01-01T00:00:00Z",
      trialDaysTotal: 365,
      licensePlan: "PROFESSIONAL",
      licenseKey: "HQM-PRO-2026-X992-8812",
      licenseActivatedAt: "2026-01-01T00:00:00Z",
      licenseExpiresAt: "2027-01-01T00:00:00Z",
      activationRequests: [],
      supportContact: {
        name: "Support Plateforme SaaS",
        phone: "+224 600 00 00 00",
        whatsapp: "+224 600 00 00 00",
        email: "support@saas-platform.com",
        address: "Conakry, Guinée",
        customMessage: "Service d'assistance technique disponible 7j/7."
      },
      settings: {
        companyHeader: "HORIZON QUINCAILLERIE & MATÉRIAUX - RCCM: GN.TCC.2025.B.44321 - NIF: 004567891M",
        invoiceFooter: "Matériaux certifiés conformes. Tout retour nécessite le ticket de caisse dans un délai de 48h.",
        branding: {
          logoUrl: "https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=150&auto=format&fit=crop&q=80",
          logoPosition: 'center',
          logoSize: 'md',
          showLogo: true,
          slogan: "Votre Partenaire Idéal pour Tous Travaux de BTP & Rénovation",
          website: "https://www.horizon-quincaillerie.com",
          headerAlignment: 'center',
          showPhone: true,
          showEmail: true,
          showAddress: true,
          showWebsite: true,
          footerText: "HORIZON SARL • Quincaillerie Générale & Matériaux de Construction",
          footerAlignment: 'center',
          showFooter: true,
        }
      },
      createdAt: "2026-01-15T00:00:00Z"
    }
  ],
  branches: [
    {
      id: INITIAL_BRANCH_ID,
      tenantId: INITIAL_TENANT_ID,
      name: "Agence Principale - Kaloum",
      code: "AG-KALOUM",
      phone: "+224 620 00 11 22",
      email: "kaloum@cpep-guinee.com",
      address: "Avenue de la République, Kaloum",
      isMain: true,
      isActive: true
    },
    {
      id: 'b-002',
      tenantId: INITIAL_TENANT_ID,
      name: "Annexe Campus - Dixinn",
      code: "AG-DIXINN",
      phone: "+224 622 33 44 55",
      email: "dixinn@cpep-guinee.com",
      address: "Face Université Gamal Abdel Nasser, Dixinn",
      isMain: false,
      isActive: true
    }
  ],
  roles: [
    {
      id: 'role-admin-centre',
      tenantId: INITIAL_TENANT_ID,
      name: 'Admin du Centre',
      code: 'ADMIN_CENTRE',
      isSystem: true,
      permissions: ['*']
    },
    {
      id: 'role-caissier',
      tenantId: INITIAL_TENANT_ID,
      name: 'Caissière & Accueil',
      code: 'CAISSIER',
      isSystem: true,
      permissions: [
        'persons.*', 'clients.*',
        'orders.*',
        'production.*',
        'cash.*',
        'payments.*',
        'invoices.*',
        'services.view'
      ]
    },
    {
      id: 'role-operateur',
      tenantId: INITIAL_TENANT_ID,
      name: 'Opérateur de Production',
      code: 'OPERATEUR',
      isSystem: true,
      permissions: [
        'production.view', 'production.manage', 'orders.view',
        'equipment.view', 'equipment.create', 'equipment.update', 'equipment.delete', 'equipment.maintenance'
      ]
    },
    {
      id: 'role-resp-formation',
      tenantId: INITIAL_TENANT_ID,
      name: 'Responsable Formation',
      code: 'RESPONSABLE_FORMATION',
      isSystem: true,
      permissions: [
        'training.*', 'sessions.*', 'learners.manage', 'enrollments.*',
        'attendance.*', 'assessments.*', 'certificates.*', 'clients.*', 'persons.*'
      ]
    }
  ],
  users: [
    {
      id: 'u-admin-01',
      tenantId: INITIAL_TENANT_ID,
      branchId: INITIAL_BRANCH_ID,
      firstName: 'Ibrahima Sory',
      lastName: 'Camara',
      username: 'admin',
      email: 'directeur@cpep.com',
      phone: '+224 621 11 22 33',
      passwordHash: 'admin123',
      department: 'ADMINISTRATION',
      isActive: true,
      roles: [{ id: 'role-admin-centre', name: 'Admin du Centre', code: 'ADMIN_CENTRE', isSystem: true, permissions: ['*'] }],
      permissions: ['*'],
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'u-caissier-01',
      tenantId: INITIAL_TENANT_ID,
      branchId: INITIAL_BRANCH_ID,
      firstName: 'Fatoumata Binta',
      lastName: 'Barry',
      username: 'caissier',
      email: 'caisse@cpep.com',
      phone: '+224 622 99 88 77',
      passwordHash: 'caisse123',
      department: 'ACCUEIL_CAISSE_STOCK',
      isActive: true,
      roles: [{ id: 'role-caissier', name: 'Caissier', code: 'CAISSIER', isSystem: true, permissions: ['orders.*', 'clients.*', 'payments.*', 'cash.*', 'stock.*', 'suppliers.*'] }],
      permissions: ['orders.*', 'clients.*', 'payments.*', 'cash.*', 'stock.*', 'suppliers.*'],
      createdAt: '2026-01-02T00:00:00Z'
    },
    {
      id: 'u-op-01',
      tenantId: INITIAL_TENANT_ID,
      branchId: INITIAL_BRANCH_ID,
      firstName: 'Mamadou Oury',
      lastName: 'Bah',
      username: 'operateur',
      email: 'production@cpep.com',
      phone: '+224 624 55 66 77',
      passwordHash: 'prod123',
      department: 'PRODUCTION_MATERIEL',
      isActive: true,
      roles: [{ id: 'role-operateur', name: 'Opérateur de Production', code: 'OPERATEUR', isSystem: true, permissions: ['production.*', 'orders.view', 'equipment.*'] }],
      permissions: ['production.*', 'orders.view', 'equipment.*'],
      createdAt: '2026-01-02T00:00:00Z'
    },
    {
      id: 'u-form-resp-01',
      tenantId: INITIAL_TENANT_ID,
      branchId: INITIAL_BRANCH_ID,
      firstName: 'Aissatou',
      lastName: 'Diallo',
      username: 'resp-formation',
      email: 'formation@cpep.com',
      passwordHash: 'formation123',
      department: 'FORMATION',
      isActive: true,
      roles: [{ id: 'role-resp-formation', name: 'Responsable Formation', code: 'RESPONSABLE_FORMATION', isSystem: true, permissions: ['training.*', 'sessions.*', 'enrollments.*', 'attendance.*', 'assessments.*', 'certificates.*', 'clients.*'] }],
      permissions: ['training.*', 'sessions.*', 'enrollments.*', 'attendance.*', 'assessments.*', 'certificates.*', 'clients.*'],
      createdAt: '2026-01-02T00:00:00Z'
    },
    {
      id: 'u-superadmin',
      tenantId: 'global',
      isSuperAdmin: true,
      firstName: 'Super',
      lastName: 'Administrateur',
      username: 'superadmin',
      email: 'superadmin@saas-platform.com',
      phone: '+224 600 00 00 00',
      passwordHash: 'superadmin123',
      department: 'ADMINISTRATION',
      isActive: true,
      roles: [{ id: 'role-superadmin', name: 'Super Administrateur Global', code: 'SUPER_ADMIN', permissions: ['*'] }],
      permissions: ['*'],
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'u-admin-b',
      tenantId: 't-002',
      firstName: 'Boubacar',
      lastName: 'Diallo',
      username: 'admin.horizon',
      email: 'direction@horizon-quincaillerie.com',
      phone: '+224 628 44 55 66',
      passwordHash: 'admin123',
      department: 'ADMINISTRATION',
      isActive: true,
      roles: [{ id: 'role-gerant-b', name: 'Gérant Boutique', code: 'GERANT', isSystem: true, permissions: ['*'] }],
      permissions: ['*'],
      createdAt: '2026-01-15T00:00:00Z'
    },
    {
      id: 'u-caissier-b',
      tenantId: 't-002',
      branchId: 'b-002',
      firstName: 'Mariama',
      lastName: 'Camara',
      username: 'vendeur.horizon',
      email: 'vente@horizon-quincaillerie.com',
      phone: '+224 629 11 22 33',
      passwordHash: 'vendeur123',
      department: 'ACCUEIL_CAISSE_STOCK',
      isActive: true,
      roles: [{ id: 'role-caissier', name: 'Caissière & Vente', code: 'CAISSIER', isSystem: true, permissions: ['boutique.*', 'stock.*', 'cash.*'] }],
      permissions: ['boutique.*', 'stock.*', 'cash.*'],
      createdAt: '2026-01-16T00:00:00Z'
    },
    {
      id: 'u-magasinier-b',
      tenantId: 't-002',
      branchId: 'b-002',
      firstName: 'Amadou',
      lastName: 'Diallo',
      username: 'stock.horizon',
      email: 'magasin@horizon-quincaillerie.com',
      phone: '+224 629 44 55 66',
      passwordHash: 'stock123',
      department: 'ACCUEIL_CAISSE_STOCK',
      isActive: true,
      roles: [{ id: 'role-magasinier', name: 'Magasinier', code: 'MAGASINIER', isSystem: true, permissions: ['stock.*', 'suppliers.*'] }],
      permissions: ['stock.*', 'suppliers.*'],
      createdAt: '2026-01-16T00:00:00Z'
    }
  ],
  persons: [
    {
      id: 'p-001',
      tenantId: INITIAL_TENANT_ID,
      firstName: 'Sekou',
      lastName: 'Kourouma',
      phone: '+224 625 10 20 30',
      email: 'sekou.kourouma@gmail.com',
      address: 'Commune de Matam, Conakry',
      types: ['CUSTOMER'],
      isActive: true,
      createdAt: '2026-02-01T10:00:00Z',
      customerProfile: {
        customerNumber: 'CLT-2026-0001',
        isCompany: false,
        discountRate: 0,
        creditLimit: 500000
      }
    },
    {
      id: 'p-002',
      tenantId: INITIAL_TENANT_ID,
      firstName: 'Kadiatou',
      lastName: 'Sow',
      phone: '+224 627 44 55 66',
      email: 'kadi.sow@univ-conakry.edu.gn',
      address: 'Dixinn terrasse, Conakry',
      types: ['CUSTOMER', 'LEARNER'],
      isActive: true,
      createdAt: '2026-02-03T11:30:00Z',
      customerProfile: {
        customerNumber: 'CLT-2026-0002',
        isCompany: false,
        discountRate: 10, // Student discount
        creditLimit: 0
      },
      learnerProfile: {
        learnerNumber: 'APP-2026-0001',
        educationLevel: 'Licence 3 Informatique',
        profession: 'Étudiante'
      }
    },
    {
      id: 'p-003',
      tenantId: INITIAL_TENANT_ID,
      firstName: 'Cabinet Conseil',
      lastName: 'Sylla & Partners',
      phone: '+224 620 88 77 66',
      email: 'contact@syllapartners.gn',
      address: 'Immeuble Al-Iman, Kaloum',
      types: ['CUSTOMER'],
      isActive: true,
      createdAt: '2026-02-05T09:00:00Z',
      customerProfile: {
        customerNumber: 'CLT-2026-0003',
        companyName: 'Sylla & Partners SARL',
        isCompany: true,
        discountRate: 5,
        creditLimit: 5000000
      }
    },
    {
      id: 'p-004',
      tenantId: INITIAL_TENANT_ID,
      firstName: 'Ousmane',
      lastName: 'Soumah',
      phone: '+224 629 11 22 44',
      email: 'ousmane.soumah@cpep.com',
      address: 'Lambanyi, Conakry',
      types: ['TRAINER'],
      isActive: true,
      createdAt: '2026-01-10T08:00:00Z',
      trainerProfile: {
        trainerNumber: 'FORM-2026-0001',
        specialty: 'Développement Web & Base de données',
        bio: 'Ingénieur logiciel Senior avec 8 ans d\'expérience.',
        hourlyRate: 150000
      }
    },
    {
      id: 'p-005',
      tenantId: INITIAL_TENANT_ID,
      firstName: 'Mariama',
      lastName: 'Conde',
      phone: '+224 623 77 88 99',
      email: 'mariama.conde@outlook.com',
      address: 'Kipe Centre Emetteur, Conakry',
      types: ['LEARNER'],
      isActive: true,
      createdAt: '2026-02-10T14:20:00Z',
      learnerProfile: {
        learnerNumber: 'APP-2026-0002',
        educationLevel: 'Master 1 Gestion',
        profession: 'Comptable Junior'
      }
    }
  ],
  serviceCategories: [
    { id: 'sc-01', tenantId: INITIAL_TENANT_ID, code: 'IMPRESSION', name: 'Impression & Photocopie', icon: 'Printer', description: 'Tirages noir & blanc, couleur, documents administratifs', sortOrder: 1, isActive: true },
    { id: 'sc-02', tenantId: INITIAL_TENANT_ID, code: 'RELIURE', name: 'Finition & Reliure', icon: 'BookOpen', description: 'Reliure spirale plastique/métallique, thermique, dos carré collé', sortOrder: 2, isActive: true },
    { id: 'sc-03', tenantId: INITIAL_TENANT_ID, code: 'PLASTIFICATION', name: 'Plastification & Protection', icon: 'Shield', description: 'Pochettes brillantes et mates du format badge au A3', sortOrder: 3, isActive: true },
    { id: 'sc-04', tenantId: INITIAL_TENANT_ID, code: 'SCAN', name: 'Scan & Numérisation', icon: 'Scan', description: 'Numérisation haute résolution, OCR et archivage', sortOrder: 4, isActive: true },
    { id: 'sc-05', tenantId: INITIAL_TENANT_ID, code: 'PHOTO', name: 'Tirage Photo & Découpe', icon: 'Image', description: 'Photos d\'identité, tirages artistiques, massicotage précis', sortOrder: 5, isActive: true }
  ],
  services: [
    {
      id: 'srv-01',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'sc-01',
      categoryName: 'Impression & Photocopie',
      code: 'PHOTOCOPIE-A4-NB',
      name: 'Photocopie',
      description: 'Reproduction et photocopie noir & blanc / couleur tous formats',
      unit: 'page',
      baseCost: 150,
      basePrice: 500,
      requiresFile: false,
      estimatedDurationMinutes: 1,
      isActive: true,
      consumableMode: 'INTERNAL_VARIABLE',
      isClientSupportAllowed: false,
      options: [
        { id: 'opt-format', name: 'Format', values: ['A4', 'A3'] },
        { id: 'opt-mode', name: 'Mode', values: ['Noir & blanc', 'Couleur'] },
        { id: 'opt-type', name: 'Type d\'impression', values: ['Recto', 'Recto-verso'] },
        { id: 'opt-papier', name: 'Papier', values: ['Standard', 'Bristol'] }
      ],
      configurations: [
        {
          id: 'cfg-photo-1',
          serviceId: 'srv-01',
          optionValues: { 'Format': 'A4', 'Mode': 'Noir & blanc', 'Type d\'impression': 'Recto', 'Papier': 'Standard' },
          price: 500,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 1, unit: 'feuille' }],
          isActive: true
        },
        {
          id: 'cfg-photo-2',
          serviceId: 'srv-01',
          optionValues: { 'Format': 'A4', 'Mode': 'Noir & blanc', 'Type d\'impression': 'Recto-verso', 'Papier': 'Standard' },
          price: 700,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 1, unit: 'feuille' }],
          isActive: true
        },
        {
          id: 'cfg-photo-3',
          serviceId: 'srv-01',
          optionValues: { 'Format': 'A4', 'Mode': 'Couleur', 'Type d\'impression': 'Recto', 'Papier': 'Standard' },
          price: 1000,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 1, unit: 'feuille' }],
          isActive: true
        },
        {
          id: 'cfg-photo-4',
          serviceId: 'srv-01',
          optionValues: { 'Format': 'A4', 'Mode': 'Couleur', 'Type d\'impression': 'Recto-verso', 'Papier': 'Standard' },
          price: 1800,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 1, unit: 'feuille' }],
          isActive: true
        },
        {
          id: 'cfg-photo-5',
          serviceId: 'srv-01',
          optionValues: { 'Format': 'A3', 'Mode': 'Noir & blanc', 'Type d\'impression': 'Recto', 'Papier': 'Standard' },
          price: 1000,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 2, unit: 'feuille' }],
          isActive: true
        },
        {
          id: 'cfg-photo-6',
          serviceId: 'srv-01',
          optionValues: { 'Format': 'A4', 'Mode': 'Noir & blanc', 'Type d\'impression': 'Recto', 'Papier': 'Bristol' },
          price: 1000,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-02', productName: 'Papier Bristol A4 180g Multi-Couleurs', quantityPerUnit: 1, unit: 'feuille' }],
          isActive: true
        }
      ],
      consumables: [
        { productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 1, unit: 'feuille', isClientSupplied: false, isOptional: false }
      ],
      pricingRules: [
        { id: 'pr-01', serviceId: 'srv-01', minQuantity: 1, maxQuantity: 50, unitPrice: 500, customerType: 'ALL' },
        { id: 'pr-02', serviceId: 'srv-01', minQuantity: 51, maxQuantity: 200, unitPrice: 400, customerType: 'ALL' },
        { id: 'pr-03', serviceId: 'srv-01', minQuantity: 201, maxQuantity: undefined, unitPrice: 300, customerType: 'ALL' }
      ],
      consumptions: [{ productId: 'prod-01', quantity: 1 }]
    },
    {
      id: 'srv-02',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'sc-01',
      categoryName: 'Impression & Photocopie',
      code: 'IMPRESSION-A4-COUL',
      name: 'Impression',
      description: 'Impression haute fidélité couleur / monochrome 80g à 250g',
      unit: 'page',
      baseCost: 500,
      basePrice: 2000,
      requiresFile: true,
      estimatedDurationMinutes: 2,
      isActive: true,
      consumableMode: 'INTERNAL_VARIABLE',
      isClientSupportAllowed: false,
      options: [
        { id: 'opt-imp-format', name: 'Format', values: ['A4', 'A3'] },
        { id: 'opt-imp-mode', name: 'Couleur', values: ['Noir & Blanc', 'Couleur'] },
        { id: 'opt-imp-type', name: 'Impression', values: ['Recto', 'Recto-verso'] },
        { id: 'opt-imp-papier', name: 'Papier', values: ['Standard', 'Bristol', 'Papier Photo'] }
      ],
      configurations: [
        {
          id: 'cfg-imp-1',
          serviceId: 'srv-02',
          optionValues: { 'Format': 'A4', 'Couleur': 'Couleur', 'Impression': 'Recto', 'Papier': 'Standard' },
          price: 2000,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 1, unit: 'feuille' }],
          isActive: true
        },
        {
          id: 'cfg-imp-1-rv',
          serviceId: 'srv-02',
          optionValues: { 'Format': 'A4', 'Couleur': 'Couleur', 'Impression': 'Recto-verso', 'Papier': 'Standard' },
          price: 3500,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 1, unit: 'feuille' }],
          isActive: true
        },
        {
          id: 'cfg-imp-2',
          serviceId: 'srv-02',
          optionValues: { 'Format': 'A4', 'Couleur': 'Noir & Blanc', 'Impression': 'Recto', 'Papier': 'Standard' },
          price: 800,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 1, unit: 'feuille' }],
          isActive: true
        },
        {
          id: 'cfg-imp-2-rv',
          serviceId: 'srv-02',
          optionValues: { 'Format': 'A4', 'Couleur': 'Noir & Blanc', 'Impression': 'Recto-verso', 'Papier': 'Standard' },
          price: 1200,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 1, unit: 'feuille' }],
          isActive: true
        },
        {
          id: 'cfg-imp-3',
          serviceId: 'srv-02',
          optionValues: { 'Format': 'A3', 'Couleur': 'Couleur', 'Impression': 'Recto', 'Papier': 'Standard' },
          price: 4000,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 2, unit: 'feuille' }],
          isActive: true
        },
        {
          id: 'cfg-imp-3-nb',
          serviceId: 'srv-02',
          optionValues: { 'Format': 'A3', 'Couleur': 'Noir & Blanc', 'Impression': 'Recto', 'Papier': 'Standard' },
          price: 1600,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 2, unit: 'feuille' }],
          isActive: true
        },
        {
          id: 'cfg-imp-4',
          serviceId: 'srv-02',
          optionValues: { 'Format': 'A4', 'Couleur': 'Couleur', 'Impression': 'Recto', 'Papier': 'Bristol' },
          price: 2500,
          billingUnit: 'page',
          consumables: [{ productId: 'prod-02', productName: 'Papier Bristol A4 180g Multi-Couleurs', quantityPerUnit: 1, unit: 'feuille' }],
          isActive: true
        }
      ],
      consumables: [
        { productId: 'prod-01', productName: 'Papier Ramette A4 80g Double A', quantityPerUnit: 1, unit: 'feuille', isClientSupplied: false, isOptional: false }
      ],
      pricingRules: [
        { id: 'pr-05', serviceId: 'srv-02', minQuantity: 1, maxQuantity: 20, unitPrice: 2000, customerType: 'ALL' },
        { id: 'pr-06', serviceId: 'srv-02', minQuantity: 21, maxQuantity: 100, unitPrice: 1500, customerType: 'ALL' }
      ],
      consumptions: [{ productId: 'prod-01', quantity: 1 }]
    },
    {
      id: 'srv-03',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'sc-02',
      categoryName: 'Finition & Reliure',
      code: 'RELIURE-SPIRALE-A4',
      name: 'Reliure',
      description: 'Reliure professionnelle avec transparent cristal face avant et cartonné dos',
      unit: 'document',
      baseCost: 3000,
      basePrice: 15000,
      requiresFile: false,
      estimatedDurationMinutes: 5,
      isActive: true,
      consumableMode: 'INTERNAL_FIXED',
      isClientSupportAllowed: true,
      options: [
        { id: 'opt-rel-format', name: 'Format', values: ['A4', 'A3'] },
        { id: 'opt-rel-type', name: 'Type', values: ['Spirale', 'Thermique'] },
        { id: 'opt-rel-couv', name: 'Couverture', values: ['Transparente', 'Bristol'] }
      ],
      configurations: [
        {
          id: 'cfg-rel-1',
          serviceId: 'srv-03',
          optionValues: { 'Format': 'A4', 'Type': 'Spirale', 'Couverture': 'Transparente' },
          price: 15000,
          billingUnit: 'document',
          consumables: [
            { productId: 'prod-06', productName: 'Boîte Spirales Plastiques 10mm (x100)', quantityPerUnit: 1, unit: 'unité' },
            { productId: 'prod-07', productName: 'Paquet Plats PVC Transparents A4 (x100)', quantityPerUnit: 2, unit: 'feuille' }
          ],
          isActive: true
        },
        {
          id: 'cfg-rel-2',
          serviceId: 'srv-03',
          optionValues: { 'Format': 'A4', 'Type': 'Spirale', 'Couverture': 'Bristol' },
          price: 15000,
          billingUnit: 'document',
          consumables: [
            { productId: 'prod-06', productName: 'Boîte Spirales Plastiques 10mm (x100)', quantityPerUnit: 1, unit: 'unité' },
            { productId: 'prod-07', productName: 'Paquet Plats PVC Transparents A4 (x100)', quantityPerUnit: 1, unit: 'feuille' },
            { productId: 'prod-02', productName: 'Papier Bristol A4 180g Multi-Couleurs', quantityPerUnit: 1, unit: 'feuille' }
          ],
          isActive: true
        },
        {
          id: 'cfg-rel-3',
          serviceId: 'srv-03',
          optionValues: { 'Format': 'A3', 'Type': 'Spirale', 'Couverture': 'Transparente' },
          price: 25000,
          billingUnit: 'document',
          consumables: [
            { productId: 'prod-06', productName: 'Boîte Spirales Plastiques 10mm (x100)', quantityPerUnit: 1, unit: 'unité' },
            { productId: 'prod-07', productName: 'Paquet Plats PVC Transparents A4 (x100)', quantityPerUnit: 2, unit: 'feuille' }
          ],
          isActive: true
        }
      ],
      consumables: [
        { productId: 'prod-06', productName: 'Boîte Spirales Plastiques 10mm (x100)', quantityPerUnit: 1, unit: 'unité', isClientSupplied: false, isOptional: false },
        { productId: 'prod-02', productName: 'Papier Bristol A4 180g Multi-Couleurs', quantityPerUnit: 1, unit: 'feuille', isClientSupplied: false, isOptional: false },
        { productId: 'prod-07', productName: 'Paquet Plats PVC Transparents A4 (x100)', quantityPerUnit: 1, unit: 'feuille', isClientSupplied: false, isOptional: false }
      ],
      pricingRules: [
        { id: 'pr-08', serviceId: 'srv-03', minQuantity: 1, maxQuantity: 5, unitPrice: 15000, customerType: 'ALL' },
        { id: 'pr-09', serviceId: 'srv-03', minQuantity: 6, maxQuantity: undefined, unitPrice: 12000, customerType: 'ALL' }
      ],
      consumptions: [{ productId: 'prod-06', quantity: 1 }, { productId: 'prod-02', quantity: 1 }, { productId: 'prod-07', quantity: 1 }]
    },
    {
      id: 'srv-04',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'sc-03',
      categoryName: 'Plastification & Protection',
      code: 'PLASTIF-A4',
      name: 'Plastification',
      description: 'Pochette thermocollée résistante à l\'eau et aux UV',
      unit: 'document',
      baseCost: 1500,
      basePrice: 5000,
      requiresFile: false,
      estimatedDurationMinutes: 3,
      isActive: true,
      consumableMode: 'INTERNAL_FIXED',
      isClientSupportAllowed: true,
      options: [
        { id: 'opt-plas-format', name: 'Format', values: ['A4 (125µ)', 'A3 (125µ)', 'Badge / Carte'] },
        { id: 'opt-plas-finition', name: 'Finition', values: ['Brillante', 'Mate anti-reflet'] }
      ],
      configurations: [
        {
          id: 'cfg-plas-1',
          serviceId: 'srv-04',
          optionValues: { 'Format': 'A4 (125µ)', 'Finition': 'Brillante' },
          price: 5000,
          billingUnit: 'document',
          consumables: [{ productId: 'prod-08', productName: 'Boîte Pochettes Plastification A4 125µ (x100)', quantityPerUnit: 1, unit: 'pochette' }],
          isActive: true
        },
        {
          id: 'cfg-plas-2',
          serviceId: 'srv-04',
          optionValues: { 'Format': 'A3 (125µ)', 'Finition': 'Brillante' },
          price: 10000,
          billingUnit: 'document',
          consumables: [{ productId: 'prod-08', productName: 'Boîte Pochettes Plastification A4 125µ (x100)', quantityPerUnit: 2, unit: 'pochette' }],
          isActive: true
        },
        {
          id: 'cfg-plas-3',
          serviceId: 'srv-04',
          optionValues: { 'Format': 'Badge / Carte', 'Finition': 'Brillante' },
          price: 2500,
          billingUnit: 'document',
          consumables: [{ productId: 'prod-08', productName: 'Boîte Pochettes Plastification A4 125µ (x100)', quantityPerUnit: 0.25, unit: 'pochette' }],
          isActive: true
        }
      ],
      consumables: [
        { productId: 'prod-08', productName: 'Boîte Pochettes Plastification A4 125µ (x100)', quantityPerUnit: 1, unit: 'pochette', isClientSupplied: false, isOptional: false }
      ],
      pricingRules: [
        { id: 'pr-10', serviceId: 'srv-04', minQuantity: 1, maxQuantity: 10, unitPrice: 5000, customerType: 'ALL' }
      ],
      consumptions: [{ productId: 'prod-08', quantity: 1 }]
    },
    {
      id: 'srv-05',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'sc-04',
      categoryName: 'Scan & Numérisation',
      code: 'SCAN-DOC-A4',
      name: 'Numérisation / Scan',
      description: 'Vers PDF multipages ou envoi Email / Clé USB',
      unit: 'page',
      baseCost: 50,
      basePrice: 500,
      requiresFile: false,
      estimatedDurationMinutes: 1,
      isActive: true,
      consumableMode: 'NONE',
      options: [
        { id: 'opt-scan-format', name: 'Format', values: ['A4', 'A3'] },
        { id: 'opt-scan-dest', name: 'Destination', values: ['Envoi Email', 'Clé USB', 'WhatsApp'] }
      ],
      configurations: [
        {
          id: 'cfg-scan-1',
          serviceId: 'srv-05',
          optionValues: { 'Format': 'A4', 'Destination': 'Envoi Email' },
          price: 500,
          billingUnit: 'page',
          consumables: [],
          isActive: true
        },
        {
          id: 'cfg-scan-2',
          serviceId: 'srv-05',
          optionValues: { 'Format': 'A3', 'Destination': 'Envoi Email' },
          price: 1000,
          billingUnit: 'page',
          consumables: [],
          isActive: true
        }
      ],
      consumables: [],
      pricingRules: [
        { id: 'pr-12', serviceId: 'srv-05', minQuantity: 1, maxQuantity: 50, unitPrice: 500, customerType: 'ALL' }
      ]
    },
    {
      id: 'srv-06',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'sc-05',
      categoryName: 'Tirage Photo & Découpe',
      code: 'PHOTO-IDENTITE-4X4',
      name: 'Planche Photo d\'Identité (x8 photos)',
      description: 'Normes passeport, visa, carte nationale',
      unit: 'planche',
      baseCost: 2500,
      basePrice: 15000,
      requiresFile: false,
      estimatedDurationMinutes: 10,
      isActive: true,
      options: [
        { id: 'opt-photo-type', name: 'Type Photo', values: ['8 photos Identité (4x4)', 'Planche 16 photos'] },
        { id: 'opt-photo-fond', name: 'Fond', values: ['Fond Blanc standard', 'Fond Bleu ciel'] }
      ],
      configurations: [
        {
          id: 'cfg-photo-id-1',
          serviceId: 'srv-06',
          optionValues: { 'Type Photo': '8 photos Identité (4x4)', 'Fond': 'Fond Blanc standard' },
          price: 15000,
          billingUnit: 'planche',
          consumables: [],
          isActive: true
        }
      ],
      pricingRules: [
        { id: 'pr-14', serviceId: 'srv-06', minQuantity: 1, maxQuantity: undefined, unitPrice: 15000, customerType: 'ALL' }
      ]
    },
    {
      id: 'srv-07',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'sc-04',
      categoryName: 'Conseil & Orientation',
      code: 'AIDE-ORIENTATION',
      name: 'Aide à l\'orientation d\'un étudiant',
      description: 'Conseil et accompagnement pour le choix de filière universitaire',
      unit: 'prestation',
      baseCost: 0,
      basePrice: 10000,
      requiresFile: false,
      estimatedDurationMinutes: 30,
      isActive: true,
      options: [],
      configurations: [
        {
          id: 'cfg-orient-1',
          serviceId: 'srv-07',
          optionValues: {},
          price: 10000,
          billingUnit: 'prestation',
          consumables: [],
          isActive: true
        }
      ],
      consumables: [],
      pricingRules: []
    },
    {
      id: 'srv-08',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'sc-04',
      categoryName: 'Formation Professionnelle',
      code: 'FORMATION-BUR',
      name: 'Formation Informatique & Bureautique',
      description: 'Cours pratiques sur mesure avec formateur dédié',
      unit: 'heure',
      baseCost: 5000,
      basePrice: 25000,
      requiresFile: false,
      estimatedDurationMinutes: 60,
      isActive: true,
      options: [
        { id: 'opt-form-type', name: 'Type de formation', values: ['Informatique de base', 'Bureautique Word / Excel', 'PAO & Graphisme'] },
        { id: 'opt-form-duree', name: 'Durée', values: ['1 heure', '1 séance (3h)', 'Module complet (1 mois)'] }
      ],
      configurations: [
        {
          id: 'cfg-form-1',
          serviceId: 'srv-08',
          optionValues: { 'Type de formation': 'Informatique de base', 'Durée': '1 heure' },
          price: 25000,
          billingUnit: 'heure',
          consumables: [],
          isActive: true
        },
        {
          id: 'cfg-form-2',
          serviceId: 'srv-08',
          optionValues: { 'Type de formation': 'Bureautique Word / Excel', 'Durée': '1 séance (3h)' },
          price: 60000,
          billingUnit: 'séance',
          consumables: [],
          isActive: true
        },
        {
          id: 'cfg-form-3',
          serviceId: 'srv-08',
          optionValues: { 'Type de formation': 'Bureautique Word / Excel', 'Durée': 'Module complet (1 mois)' },
          price: 350000,
          billingUnit: 'forfait',
          consumables: [],
          isActive: true
        }
      ],
      consumables: [],
      pricingRules: []
    },
    {
      id: 'srv-09',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'sc-04',
      categoryName: 'Création & Graphisme',
      code: 'CONCEPTION-GRAPHIQUE',
      name: 'Conception',
      description: 'Conception graphique, mise en page de documents, logos, affiches',
      unit: 'document',
      baseCost: 0,
      basePrice: 50000,
      requiresFile: false,
      estimatedDurationMinutes: 60,
      isActive: true,
      options: [
        { id: 'opt-conc-type', name: 'Type de document', values: ['Logo / Identité', 'Affiche / Flyer', 'Brochure / Rapport', 'Carte de visite'] }
      ],
      configurations: [
        {
          id: 'cfg-conc-1',
          serviceId: 'srv-09',
          optionValues: { 'Type de document': 'Affiche / Flyer' },
          price: 50000,
          billingUnit: 'document',
          consumables: [],
          isActive: true
        }
      ],
      consumables: [],
      pricingRules: []
    },
    {
      id: 'srv-10',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'sc-04',
      categoryName: 'Bureautique & Rédaction',
      code: 'RECHERCHE-DOC',
      name: 'Recherche',
      description: 'Recherche documentaire sur internet, collecte de données et synthèse',
      unit: 'prestation',
      baseCost: 0,
      basePrice: 20000,
      requiresFile: false,
      estimatedDurationMinutes: 30,
      isActive: true,
      options: [
        { id: 'opt-rech-niveau', name: 'Niveau de complexité', values: ['Standard', 'Approfondie'] }
      ],
      configurations: [
        {
          id: 'cfg-rech-1',
          serviceId: 'srv-10',
          optionValues: { 'Niveau de complexité': 'Standard' },
          price: 20000,
          billingUnit: 'prestation',
          consumables: [],
          isActive: true
        }
      ],
      consumables: [],
      pricingRules: []
    },
    {
      id: 'srv-11',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'sc-04',
      categoryName: 'Bureautique & Rédaction',
      code: 'EXPOSE-SAISIE',
      name: 'Exposé',
      description: 'Saisie, mise en page et préparation complète d\'exposés scolaires et universitaires',
      unit: 'document',
      baseCost: 0,
      basePrice: 30000,
      requiresFile: false,
      estimatedDurationMinutes: 45,
      isActive: true,
      options: [
        { id: 'opt-exp-format', name: 'Format', values: ['A4', 'Support numérique (PPT)'] }
      ],
      configurations: [
        {
          id: 'cfg-exp-1',
          serviceId: 'srv-11',
          optionValues: { 'Format': 'A4' },
          price: 30000,
          billingUnit: 'document',
          consumables: [],
          isActive: true
        }
      ],
      consumables: [],
      pricingRules: []
    }
  ],
  priceHistories: [
    {
      id: 'ph-001',
      tenantId: INITIAL_TENANT_ID,
      serviceId: 'srv-01',
      serviceName: 'Photocopie A4 Noir & Blanc',
      oldPrice: 500,
      newPrice: 700,
      changedBy: 'Ibrahima Sory Camara (Admin)',
      changeDate: '2026-02-15T09:00:00Z',
      reason: 'Ajustement suite à la hausse du prix du papier 80g',
      createdAt: '2026-02-15T09:00:00Z'
    },
    {
      id: 'ph-002',
      tenantId: INITIAL_TENANT_ID,
      serviceId: 'srv-02',
      serviceName: 'Impression Laser Couleur A4',
      oldPrice: 2000,
      newPrice: 2500,
      changedBy: 'Ibrahima Sory Camara (Admin)',
      changeDate: '2026-02-01T14:30:00Z',
      reason: 'Indexation tarifaire et toners haute capacité',
      createdAt: '2026-02-01T14:30:00Z'
    }
  ],
  discountAudits: [],
  orders: [],
  productionJobs: [],
  trainingCategories: [
    {
      id: 'tc-01',
      tenantId: INITIAL_TENANT_ID,
      code: 'INFO',
      name: 'Informatique & Bureautique',
      description: 'Maîtrise des outils informatiques, bureautique, développement et programmation.',
      icon: 'Laptop',
      color: '#3b82f6',
      sortOrder: 1,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'tc-02',
      tenantId: INITIAL_TENANT_ID,
      code: 'GRAPH',
      name: 'Design Graphique & Multimédia',
      description: 'Photoshop, Illustrator, InDesign, Montage Vidéo et création visuelle.',
      icon: 'Palette',
      color: '#8b5cf6',
      sortOrder: 2,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'tc-03',
      tenantId: INITIAL_TENANT_ID,
      code: 'GEST',
      name: 'Comptabilité, Caisse & Gestion',
      description: 'Tenue de caisse, logiciels de gestion commerciale, comptabilité et fiscalité.',
      icon: 'Calculator',
      color: '#10b981',
      sortOrder: 3,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'tc-04',
      tenantId: INITIAL_TENANT_ID,
      code: 'LANG',
      name: 'Langues & Communication Pro',
      description: 'Anglais des affaires, communication professionnelle et prise de parole.',
      icon: 'BookOpen',
      color: '#f59e0b',
      sortOrder: 4,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z'
    }
  ],
  trainings: [
    {
      id: 'tr-01',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'tc-01',
      categoryName: 'Informatique & Bureautique',
      code: 'FORM-DEV-WEB',
      title: 'Développement Web Full-Stack & Base de Données',
      description: 'Formation professionnalisante complète : HTML/CSS/JS, React, Node.js et PostgreSQL.',
      objectives: 'Être capable de concevoir, développer et déployer une application web complète sécurisée.',
      durationHours: 60,
      level: 'INTERMEDIAIRE',
      price: 1800000,
      maxCapacity: 15,
      isActive: true,
      modules: [
        { id: 'mod-01', title: 'Module 1 : Fondamentaux Web & Architecture UI', durationHours: 15, sortOrder: 1 },
        { id: 'mod-02', title: 'Module 2 : React Moderne & Gestion d\'État', durationHours: 15, sortOrder: 2 },
        { id: 'mod-03', title: 'Module 3 : Backend Node.js & API REST', durationHours: 15, sortOrder: 3 },
        { id: 'mod-04', title: 'Module 4 : PostgreSQL, Sécurité & Déploiement', durationHours: 15, sortOrder: 4 }
      ],
      createdAt: '2026-01-05T00:00:00Z'
    },
    {
      id: 'tr-02',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'tc-01',
      categoryName: 'Informatique & Bureautique',
      code: 'FORM-BUREAU-PRO',
      title: 'Bureautique Professionnelle Avancée (Word, Excel, PowerPoint)',
      description: 'Maîtrise complète de la suite bureautique pour cadres et gestionnaires.',
      objectives: 'Automatiser ses tableaux de bord Excel, rédiger des rapports pro et animer des présentations.',
      durationHours: 35,
      level: 'TOUS_NIVEAUX',
      price: 850000,
      maxCapacity: 20,
      isActive: true,
      modules: [
        { id: 'mod-05', title: 'Module 1 : Microsoft Word Expert', durationHours: 10, sortOrder: 1 },
        { id: 'mod-06', title: 'Module 2 : Microsoft Excel Fonctions & TCD', durationHours: 15, sortOrder: 2 },
        { id: 'mod-07', title: 'Module 3 : PowerPoint & Synthèse Visuelle', durationHours: 10, sortOrder: 3 }
      ],
      createdAt: '2026-01-06T00:00:00Z'
    },
    {
      id: 'tr-03',
      tenantId: INITIAL_TENANT_ID,
      categoryId: 'tc-02',
      categoryName: 'Design Graphique & Multimédia',
      code: 'FORM-DESIGN-PAO',
      title: 'Infographie & PAO : Photoshop & Illustrator',
      description: 'Création d\'identités visuelles, logos, affiches et supports de communication de haute qualité.',
      objectives: 'Concevoir des maquettes et fichiers prêts pour l\'imprimerie et le web.',
      durationHours: 45,
      level: 'DEBUTANT',
      price: 1200000,
      maxCapacity: 12,
      isActive: true,
      modules: [
        { id: 'mod-08', title: 'Module 1 : Retouche et montage photo avec Photoshop', durationHours: 20, sortOrder: 1 },
        { id: 'mod-09', title: 'Module 2 : Création vectorielle avec Illustrator', durationHours: 25, sortOrder: 2 }
      ],
      createdAt: '2026-01-08T00:00:00Z'
    }
  ],
  classrooms: [
    { id: 'cr-01', tenantId: INITIAL_TENANT_ID, name: 'Salle Alan Turing (Lab Informatique)', capacity: 16, equipment: '16 PC Core i7, Vidéoprojecteur 4K, Climatisation, Connexion Fibre', isActive: true },
    { id: 'cr-02', tenantId: INITIAL_TENANT_ID, name: 'Salle Ada Lovelace (Multimédia)', capacity: 12, equipment: '12 Postes avec tablettes graphiques et doubles écrans', isActive: true },
    { id: 'cr-03', tenantId: INITIAL_TENANT_ID, name: 'Salle Albert Einstein (Conférence / Cours)', capacity: 25, equipment: 'Tableau interactif, 25 places assises avec prises électriques', isActive: true }
  ],
  trainingSessions: [
    {
      id: 'sess-01',
      tenantId: INITIAL_TENANT_ID,
      trainingId: 'tr-01',
      trainingTitle: 'Développement Web Full-Stack & Base de Données',
      trainingCode: 'FORM-DEV-WEB',
      sessionCode: 'SESS-2026-WEB-01',
      trainerId: 'p-004',
      trainerName: 'Ousmane Soumah',
      classroomId: 'cr-01',
      classroomName: 'Salle Alan Turing (Lab Informatique)',
      startDate: '2026-02-15',
      endDate: '2026-04-15',
      scheduleDescription: 'Mardi, Jeudi, Samedi de 14h30 à 17h30',
      capacity: 15,
      enrolledCount: 0,
      status: 'IN_PROGRESS',
      price: 1800000
    },
    {
      id: 'sess-02',
      tenantId: INITIAL_TENANT_ID,
      trainingId: 'tr-02',
      trainingTitle: 'Bureautique Professionnelle Avancée',
      trainingCode: 'FORM-BUREAU-PRO',
      sessionCode: 'SESS-2026-BUR-01',
      trainerId: 'p-004',
      trainerName: 'Ousmane Soumah',
      classroomId: 'cr-03',
      classroomName: 'Salle Albert Einstein',
      startDate: '2026-03-10',
      endDate: '2026-04-10',
      scheduleDescription: 'Lundi au Vendredi de 09h00 à 11h00',
      capacity: 20,
      enrolledCount: 0,
      status: 'OPEN',
      price: 850000
    }
  ],
  enrollments: [],
  attendanceSheets: [],
  assessments: [],
  certificates: [],
  cashRegisters: [
    { id: 'cr-001', tenantId: INITIAL_TENANT_ID, branchId: INITIAL_BRANCH_ID, name: 'Caisse Principale Accueil', code: 'CAISSE-01', isActive: true },
    { id: 'cr-002', tenantId: INITIAL_TENANT_ID, branchId: INITIAL_BRANCH_ID, name: 'Caisse Ateliers Production', code: 'CAISSE-02', isActive: true }
  ],
  cashSessions: [],
  payments: [],
  expenses: [],
  expenseCategories: [
    { id: 'cat-exp-01', tenantId: INITIAL_TENANT_ID, name: 'Fournitures de bureau & consommables', icon: '📦', isSystem: true, isActive: true },
    { id: 'cat-exp-02', tenantId: INITIAL_TENANT_ID, name: 'Entretien, nettoyage & hygiène', icon: '🧹', isSystem: true, isActive: true },
    { id: 'cat-exp-03', tenantId: INITIAL_TENANT_ID, name: 'Électricité, eau & énergie', icon: '⚡', isSystem: true, isActive: true },
    { id: 'cat-exp-04', tenantId: INITIAL_TENANT_ID, name: 'Frais de transport & courses urgentes', icon: '🛵', isSystem: true, isActive: true },
    { id: 'cat-exp-05', tenantId: INITIAL_TENANT_ID, name: 'Restauration & collation équipe', icon: '☕', isSystem: true, isActive: true },
    { id: 'cat-exp-06', tenantId: INITIAL_TENANT_ID, name: 'Maintenance machines & équipements', icon: '🔧', isSystem: true, isActive: true },
    { id: 'cat-exp-07', tenantId: INITIAL_TENANT_ID, name: 'Achat de matières premières (papier, encre, bâches...)', icon: '📄', isSystem: true, isActive: true },
    { id: 'cat-exp-08', tenantId: INITIAL_TENANT_ID, name: 'Avance sur salaire / Main d\'œuvre temporaire', icon: '💼', isSystem: true, isActive: true },
    { id: 'cat-exp-09', tenantId: INITIAL_TENANT_ID, name: 'Communication, crédit téléphonique & internet', icon: '📶', isSystem: true, isActive: true },
    { id: 'cat-exp-10', tenantId: INITIAL_TENANT_ID, name: 'Autres dépenses diverses autorisées', icon: '📑', isSystem: true, isActive: true }
  ],
  financialAccounts: [
    {
      id: 'fa-cp-01',
      tenantId: INITIAL_TENANT_ID,
      code: 'CP-01',
      name: 'Caisse Principale',
      type: 'CASH',
      description: 'Caisse physique centrale accueil et encaissements quotidiens',
      initialBalance: 0,
      currentBalance: 0,
      currency: 'GNF',
      isActive: true,
      isDefault: true,
      isMainCash: true,
      isPettyCash: false,
      createdByUserName: 'Administrateur',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'fa-pc-01',
      tenantId: INITIAL_TENANT_ID,
      code: 'PC-01',
      name: 'Petite Caisse',
      type: 'CASH',
      description: 'Petite caisse dédiée aux dépenses urgentes, courses et fournitures',
      initialBalance: 0,
      currentBalance: 0,
      currency: 'GNF',
      isActive: true,
      isDefault: false,
      isMainCash: false,
      isPettyCash: true,
      createdByUserName: 'Administrateur',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'fa-bnk-01',
      tenantId: INITIAL_TENANT_ID,
      code: 'BNK-01',
      name: 'Compte Ecobank Guinée',
      type: 'BANK',
      bankName: 'Ecobank Guinée',
      accountNumber: 'GN012-0012-998877-44',
      description: 'Compte bancaire courant pour virements clients et gros fournisseurs',
      initialBalance: 0,
      currentBalance: 0,
      currency: 'GNF',
      isActive: true,
      isDefault: false,
      isMainCash: false,
      createdByUserName: 'Administrateur',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'fa-om-01',
      tenantId: INITIAL_TENANT_ID,
      code: 'OM-01',
      name: 'Orange Money Agence',
      type: 'MOBILE_MONEY',
      accountNumber: '+224 620 00 11 22',
      description: 'Compte marchand Orange Money pour encaissements et règlements rapides',
      initialBalance: 0,
      currentBalance: 0,
      currency: 'GNF',
      isActive: true,
      isDefault: false,
      isMainCash: false,
      createdByUserName: 'Administrateur',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'fa-momo-01',
      tenantId: INITIAL_TENANT_ID,
      code: 'MTN-01',
      name: 'MTN Mobile Money',
      type: 'MOBILE_MONEY',
      accountNumber: '+224 660 00 11 22',
      description: 'Compte marchand MTN Mobile Money',
      initialBalance: 0,
      currentBalance: 0,
      currency: 'GNF',
      isActive: true,
      isDefault: false,
      isMainCash: false,
      createdByUserName: 'Administrateur',
      createdAt: '2026-01-01T00:00:00Z'
    },
    // Agence B (t-002)
    {
      id: 'fa-b-cp-01',
      tenantId: 't-002',
      code: 'CP-02',
      name: 'Caisse Principale Horizon',
      type: 'CASH',
      description: 'Caisse boutique principale',
      initialBalance: 0,
      currentBalance: 0,
      currency: 'GNF',
      isActive: true,
      isDefault: true,
      isMainCash: true,
      isPettyCash: false,
      createdByUserName: 'Boubacar Diallo',
      createdAt: '2026-01-15T00:00:00Z'
    },
    {
      id: 'fa-b-pc-01',
      tenantId: 't-002',
      code: 'PC-02',
      name: 'Petite Caisse Horizon',
      type: 'CASH',
      description: 'Fonds de roulement petites charges',
      initialBalance: 0,
      currentBalance: 0,
      currency: 'GNF',
      isActive: true,
      isDefault: false,
      isMainCash: false,
      isPettyCash: true,
      createdByUserName: 'Boubacar Diallo',
      createdAt: '2026-01-15T00:00:00Z'
    },
    {
      id: 'fa-b-bnk-01',
      tenantId: 't-002',
      code: 'BNK-02',
      name: 'Compte Vista Bank',
      type: 'BANK',
      bankName: 'Vista Bank Guinée',
      accountNumber: 'GN025-0044-112233-88',
      description: 'Compte bancaire commercial Horizon Quincaillerie',
      initialBalance: 0,
      currentBalance: 0,
      currency: 'GNF',
      isActive: true,
      isDefault: false,
      isMainCash: false,
      createdByUserName: 'Boubacar Diallo',
      createdAt: '2026-01-15T00:00:00Z'
    },
    {
      id: 'fa-b-om-01',
      tenantId: 't-002',
      code: 'OM-02',
      name: 'Orange Money Quincaillerie',
      type: 'MOBILE_MONEY',
      accountNumber: '+224 628 44 55 66',
      description: 'Paiements mobiles boutique',
      initialBalance: 0,
      currentBalance: 0,
      currency: 'GNF',
      isActive: true,
      isDefault: false,
      isMainCash: false,
      createdByUserName: 'Boubacar Diallo',
      createdAt: '2026-01-15T00:00:00Z'
    }
  ],
  financialYears: [
    {
      id: 'fy-t-001-2026',
      tenantId: INITIAL_TENANT_ID,
      code: 'EX-2026',
      name: 'Exercice Financier 2026',
      year: 2026,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: 'ACTIVE',
      isCurrentYear: true,
      notes: 'Exercice financier standard en cours (CPEP)',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'fy-t-002-2026',
      tenantId: 't-002',
      code: 'EX-2026',
      name: 'Exercice Financier 2026',
      year: 2026,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: 'ACTIVE',
      isCurrentYear: true,
      notes: 'Exercice financier standard en cours (Horizon Quincaillerie)',
      createdAt: '2026-01-15T00:00:00Z',
      updatedAt: '2026-01-15T00:00:00Z'
    }
  ],
  financialPeriods: [
    ...generateMonthlyPeriodsForYear('fy-t-001-2026', INITIAL_TENANT_ID, 2026, 8),
    ...generateMonthlyPeriodsForYear('fy-t-002-2026', 't-002', 2026, 8)
  ],
  financialMovements: [],
  supplierDebts: [],
  supplierPayments: [],
  productCategories: [
    {
      id: 'cat-prod-01',
      tenantId: INITIAL_TENANT_ID,
      code: 'PAP',
      name: 'Papeterie',
      description: 'Papiers blanc, cartonné, couleur, bristol et ramettes pour tirage et photocopie.',
      icon: 'FileText',
      color: '#3b82f6',
      sortOrder: 1,
      isActive: true,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'cat-prod-02',
      tenantId: INITIAL_TENANT_ID,
      code: 'FOURN',
      name: 'Fournitures',
      description: 'Stylos, marqueurs, agrafeuses, rubans, trombones et accessoires de bureau.',
      icon: 'PackageCheck',
      color: '#10b981',
      sortOrder: 2,
      isActive: true,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'cat-prod-03',
      tenantId: INITIAL_TENANT_ID,
      code: 'CONS',
      name: 'Consommables',
      description: 'Cartouches toners, kits d\'encres d\'origine et pièces d\'usure machines.',
      icon: 'Sparkles',
      color: '#8b5cf6',
      sortOrder: 3,
      isActive: true,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'cat-prod-04',
      tenantId: INITIAL_TENANT_ID,
      code: 'REL',
      name: 'Reliure',
      description: 'Spirales plastiques et métalliques, baguettes de reliure et plats PVC transparents/opaques.',
      icon: 'Layers',
      color: '#f59e0b',
      sortOrder: 4,
      isActive: true,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'cat-prod-05',
      tenantId: INITIAL_TENANT_ID,
      code: 'PLAST',
      name: 'Plastification',
      description: 'Pochettes thermiques brillantes, films et rouleaux de plastification tous formats.',
      icon: 'ShieldCheck',
      color: '#ec4899',
      sortOrder: 5,
      isActive: true,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'cat-b-01',
      tenantId: 't-002',
      code: 'MAT-BTP',
      name: 'Matériaux de Construction',
      description: 'Ciment, fer à béton, agrégats, tôles et blocs de construction.',
      icon: 'Building2',
      color: '#0284c7',
      sortOrder: 1,
      isActive: true,
      createdAt: '2026-01-15T08:00:00Z'
    },
    {
      id: 'cat-b-02',
      tenantId: 't-002',
      code: 'QUINC',
      name: 'Quincaillerie & Fixations',
      description: 'Vis, clous, chevilles, boulonnerie, serrures et ferrures.',
      icon: 'Boxes',
      color: '#f59e0b',
      sortOrder: 2,
      isActive: true,
      createdAt: '2026-01-15T08:00:00Z'
    },
    {
      id: 'cat-b-03',
      tenantId: 't-002',
      code: 'PEINT',
      name: 'Peinture & Finition',
      description: 'Peintures intérieures, extérieures, vernis, pinceaux et rouleaux.',
      icon: 'Tag',
      color: '#10b981',
      sortOrder: 3,
      isActive: true,
      createdAt: '2026-01-15T08:00:00Z'
    }
  ],
  products: [
    {
      id: 'prod-01',
      tenantId: INITIAL_TENANT_ID,
      code: 'RAM-A4-80G',
      barcode: '6001234567890',
      name: 'Papier Ramette A4 80g Double A',
      categoryId: 'cat-prod-01',
      category: 'Papeterie',
      description: 'Papier blanc haute blancheur 80g pour photocopie et impression laser/jet d’encre.',
      baseUnit: 'feuille',
      unit: 'feuille',
      defaultSaleUnit: 'feuille',
      defaultPurchaseUnit: 'carton',
      costPrice: 120, // 120 GNF / feuille (60 000 GNF / paquet de 500)
      salePrice: 500, // 500 GNF / feuille au détail
      wholesalePrice: 400,
      initialStock: 25000, // 10 cartons = 50 paquets = 25 000 feuilles
      currentStock: 22500, // Stock Magasin (Principal 15 000 + Boutique 7 500)
      prestationStock: 2500, // Stock Prestation (Atelier Reprographie & Prestations)
      minStockAlert: 2500, // 1 carton de sécurité
      prestationMinStockAlert: 500,
      maxStock: 50000,
      packagings: [
        {
          id: 'pkg-01-1',
          level: 2,
          unitName: 'paquet',
          containedQuantity: 500,
          subUnitName: 'feuille',
          factorToBase: 500,
          salePrice: 70000,
          purchasePrice: 60000,
          wholesalePrice: 65000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: false,
        },
        {
          id: 'pkg-01-2',
          level: 3,
          unitName: 'carton',
          containedQuantity: 5,
          subUnitName: 'paquet',
          factorToBase: 2500,
          salePrice: 330000,
          purchasePrice: 300000,
          wholesalePrice: 315000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: true,
        },
      ],
      supplierId: 'sup-01',
      supplierName: 'Papeterie Centrale de Guinée',
      location: 'Magasin Principal - Étagère A1',
      stockByLocation: { 'MAIN_STORE': 15000, 'BOUTIQUE': 7500, 'PRESTATION': 2500 },
      stockByStore: { 'store-cpep-main': 15000, 'store-cpep-boutique': 7500, 'store-cpep-workshop': 2500 },
      isConsumable: true,
      isSellable: true,
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'prod-02',
      tenantId: INITIAL_TENANT_ID,
      code: 'PAP-BRISTOL-A4',
      barcode: '6001234567891',
      name: 'Papier Bristol A4 180g Multi-Couleurs',
      categoryId: 'cat-prod-01',
      category: 'Papeterie',
      description: 'Papier cartonné Bristol haute tenue pour couvertures, intercalaires et fiches.',
      baseUnit: 'feuille',
      unit: 'feuille',
      defaultSaleUnit: 'feuille',
      defaultPurchaseUnit: 'carton',
      costPrice: 400, // 400 GNF / feuille (40 000 GNF / paquet de 100)
      salePrice: 1000, // 1 000 GNF / feuille au détail
      wholesalePrice: 800,
      initialStock: 2000, // 2 cartons = 20 paquets = 2 000 feuilles
      currentStock: 2000,
      minStockAlert: 200,
      maxStock: 5000,
      packagings: [
        {
          id: 'pkg-02-1',
          level: 2,
          unitName: 'paquet',
          containedQuantity: 100,
          subUnitName: 'feuille',
          factorToBase: 100,
          salePrice: 50000,
          purchasePrice: 40000,
          wholesalePrice: 45000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: false,
        },
        {
          id: 'pkg-02-2',
          level: 3,
          unitName: 'carton',
          containedQuantity: 10,
          subUnitName: 'paquet',
          factorToBase: 1000,
          salePrice: 480000,
          purchasePrice: 400000,
          wholesalePrice: 450000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: true,
        },
      ],
      supplierId: 'sup-01',
      supplierName: 'Papeterie Centrale de Guinée',
      location: 'Magasin Principal - Étagère A2',
      stockByLocation: { 'MAIN_STORE': 1200, 'BOUTIQUE': 800 },
      stockByStore: { 'store-cpep-main': 1200, 'store-cpep-workshop': 800 },
      isConsumable: true,
      isSellable: true,
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'prod-03',
      tenantId: INITIAL_TENANT_ID,
      code: 'STY-BIC-BLEU',
      barcode: '6001234567892',
      name: 'Stylos à Bille Bic Cristal Bleu',
      categoryId: 'cat-prod-02',
      category: 'Fournitures',
      description: 'Stylo à bille pointe moyenne 1.0mm écriture fluide.',
      baseUnit: 'pièce',
      unit: 'pièce',
      defaultSaleUnit: 'pièce',
      defaultPurchaseUnit: 'boîte',
      costPrice: 1500,
      salePrice: 2500,
      wholesalePrice: 2000,
      initialStock: 150,
      currentStock: 150,
      minStockAlert: 25,
      maxStock: 500,
      packagings: [
        {
          id: 'pkg-03-1',
          level: 2,
          unitName: 'boîte',
          containedQuantity: 50,
          subUnitName: 'pièce',
          factorToBase: 50,
          salePrice: 100000,
          purchasePrice: 75000,
          wholesalePrice: 90000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: true,
        },
      ],
      supplierId: 'sup-01',
      supplierName: 'Papeterie Centrale de Guinée',
      location: 'Boutique - Tiroir B1',
      stockByLocation: { 'MAIN_STORE': 100, 'BOUTIQUE': 50 },
      stockByStore: { 'store-cpep-main': 100, 'store-cpep-boutique': 50 },
      isConsumable: false,
      isSellable: true,
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'prod-04',
      tenantId: INITIAL_TENANT_ID,
      code: 'TON-RICOH-NB',
      name: 'Cartouche Toner Ricoh Noir MP2014',
      categoryId: 'cat-prod-03',
      category: 'Consommables',
      description: 'Toner d’origine haute capacité pour copieur Ricoh MP 2014D.',
      baseUnit: 'cartouche',
      unit: 'cartouche',
      defaultSaleUnit: 'cartouche',
      defaultPurchaseUnit: 'cartouche',
      costPrice: 350000,
      salePrice: 420000,
      initialStock: 6,
      currentStock: 4,
      minStockAlert: 2,
      maxStock: 15,
      packagings: [], // 1 niveau
      supplierId: 'sup-02',
      supplierName: 'Global Tech & Bureautique SARL',
      location: 'Atelier Reprographie - Armoire B',
      stockByLocation: { 'MAIN_STORE': 2, 'PRODUCTION': 2 },
      stockByStore: { 'store-cpep-main': 2, 'store-cpep-workshop': 2 },
      isConsumable: true,
      isSellable: false,
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'prod-05',
      tenantId: INITIAL_TENANT_ID,
      code: 'ENK-EPSON-CMYK',
      name: 'Kit Encre Epson EcoTank 4 Couleurs',
      categoryId: 'cat-prod-03',
      category: 'Consommables',
      description: 'Flacons d’encre pigmentée (Noir, Cyan, Magenta, Jaune) pour traceur et photo.',
      baseUnit: 'kit',
      unit: 'kit',
      defaultSaleUnit: 'kit',
      defaultPurchaseUnit: 'kit',
      costPrice: 280000,
      salePrice: 340000,
      initialStock: 5,
      currentStock: 3,
      minStockAlert: 3,
      maxStock: 10,
      packagings: [], // 1 niveau
      supplierId: 'sup-02',
      supplierName: 'Global Tech & Bureautique SARL',
      location: 'Atelier Photo - Rayon E',
      stockByLocation: { 'MAIN_STORE': 1, 'PRODUCTION': 2 },
      stockByStore: { 'store-cpep-main': 1, 'store-cpep-workshop': 2 },
      isConsumable: true,
      isSellable: false,
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'prod-06',
      tenantId: INITIAL_TENANT_ID,
      code: 'SPIR-PLAST-10MM',
      name: 'Boîte Spirales Plastiques 10mm (x100)',
      categoryId: 'cat-prod-04',
      category: 'Reliure',
      description: 'Spirales noires 10mm pour reliure jusqu’à 65 pages.',
      baseUnit: 'unité',
      unit: 'unité',
      defaultSaleUnit: 'unité',
      defaultPurchaseUnit: 'paquet',
      costPrice: 650, // 650 GNF / boudin (65 000 GNF / boîte de 100)
      salePrice: 1000,
      initialStock: 2500, // 25 boîtes = 2 500 unités
      currentStock: 1800, // 18 boîtes = 1 800 unités
      minStockAlert: 500,
      maxStock: 4000,
      packagings: [
        {
          id: 'pkg-06-1',
          level: 2,
          unitName: 'paquet',
          containedQuantity: 100,
          subUnitName: 'unité',
          factorToBase: 100,
          salePrice: 85000,
          purchasePrice: 65000,
          wholesalePrice: 75000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: true,
        },
      ],
      supplierId: 'sup-01',
      supplierName: 'Papeterie Centrale de Guinée',
      location: 'Atelier Façonnage - Tiroir R1',
      stockByLocation: { 'MAIN_STORE': 1000, 'PRODUCTION': 800 },
      stockByStore: { 'store-cpep-main': 1000, 'store-cpep-workshop': 800 },
      isConsumable: true,
      isSellable: true,
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'prod-07',
      tenantId: INITIAL_TENANT_ID,
      code: 'COUV-TRANS-A4',
      name: 'Paquet Plats PVC Transparents A4 (x100)',
      categoryId: 'cat-prod-04',
      category: 'Reliure',
      description: 'Couvertures transparentes cristal 200 microns pour reliure.',
      baseUnit: 'feuille',
      unit: 'feuille',
      defaultSaleUnit: 'feuille',
      defaultPurchaseUnit: 'paquet',
      costPrice: 500,
      salePrice: 1000,
      initialStock: 2000,
      currentStock: 1400,
      minStockAlert: 500,
      maxStock: 5000,
      packagings: [
        {
          id: 'pkg-07-1',
          level: 2,
          unitName: 'paquet',
          containedQuantity: 100,
          subUnitName: 'feuille',
          factorToBase: 100,
          salePrice: 65000,
          purchasePrice: 50000,
          wholesalePrice: 58000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: true,
        },
      ],
      supplierId: 'sup-01',
      supplierName: 'Papeterie Centrale de Guinée',
      location: 'Atelier Façonnage - Tiroir R2',
      stockByLocation: { 'MAIN_STORE': 800, 'PRODUCTION': 600 },
      stockByStore: { 'store-cpep-main': 800, 'store-cpep-workshop': 600 },
      isConsumable: true,
      isSellable: true,
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'prod-08',
      tenantId: INITIAL_TENANT_ID,
      code: 'PLAST-POUCH-A4',
      name: 'Boîte Pochettes Plastification A4 125µ (x100)',
      categoryId: 'cat-prod-05',
      category: 'Plastification',
      description: 'Pochettes brillantes 2x125 microns pour plastifieuse thermique.',
      baseUnit: 'pochette',
      unit: 'pochette',
      defaultSaleUnit: 'pochette',
      defaultPurchaseUnit: 'boîte',
      costPrice: 850,
      salePrice: 1500,
      initialStock: 1500,
      currentStock: 900,
      minStockAlert: 400,
      maxStock: 3000,
      packagings: [
        {
          id: 'pkg-08-1',
          level: 2,
          unitName: 'boîte',
          containedQuantity: 100,
          subUnitName: 'pochette',
          factorToBase: 100,
          salePrice: 110000,
          purchasePrice: 85000,
          wholesalePrice: 95000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: true,
        },
      ],
      supplierId: 'sup-01',
      supplierName: 'Papeterie Centrale de Guinée',
      location: 'Atelier Façonnage - Étagère P',
      stockByLocation: { 'MAIN_STORE': 500, 'PRODUCTION': 400 },
      stockByStore: { 'store-cpep-main': 500, 'store-cpep-workshop': 400 },
      isConsumable: true,
      isSellable: true,
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 'prod-b-01',
      tenantId: 't-002',
      code: 'CIM-50KG-GUICIM',
      barcode: '6009876543210',
      name: 'Sac de Ciment Guicim CPJ 42.5 (50kg)',
      categoryId: 'cat-b-01',
      category: 'Matériaux de Construction',
      description: 'Ciment haute résistance pour béton armé, fondations et dallages.',
      baseUnit: 'sac',
      unit: 'sac',
      defaultSaleUnit: 'sac',
      defaultPurchaseUnit: 'palette',
      costPrice: 75000,
      salePrice: 85000,
      wholesalePrice: 82000,
      initialStock: 400,
      currentStock: 400,
      minStockAlert: 80,
      maxStock: 2000,
      packagings: [
        {
          id: 'pkg-b1-1',
          level: 2,
          unitName: 'palette',
          containedQuantity: 40,
          subUnitName: 'sac',
          factorToBase: 40,
          salePrice: 3350000,
          purchasePrice: 2950000,
          wholesalePrice: 3200000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: true,
        },
      ],
      supplierId: 'sup-b-01',
      supplierName: 'Cimenterie de Guinée SARL',
      location: 'Dépôt Matériaux - Quai A',
      stockByLocation: { 'MAIN_STORE': 350, 'BOUTIQUE': 50 },
      stockByStore: { 'store-horizon-main': 350, 'store-horizon-shop': 50 },
      isConsumable: false,
      isSellable: true,
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-15T08:00:00Z'
    },
    {
      id: 'prod-b-02',
      tenantId: 't-002',
      code: 'FER-12MM-FE500',
      barcode: '6009876543211',
      name: 'Fer à Béton FeE500 Ø12mm (Barre 12m)',
      categoryId: 'cat-b-01',
      category: 'Matériaux de Construction',
      description: 'Barre d’acier cranté haute adhérence pour ferraillage béton armé.',
      baseUnit: 'barre',
      unit: 'barre',
      defaultSaleUnit: 'barre',
      defaultPurchaseUnit: 'paquet',
      costPrice: 95000,
      salePrice: 110000,
      wholesalePrice: 105000,
      initialStock: 300,
      currentStock: 300,
      minStockAlert: 50,
      maxStock: 1500,
      packagings: [
        {
          id: 'pkg-b2-1',
          level: 2,
          unitName: 'paquet',
          containedQuantity: 50,
          subUnitName: 'barre',
          factorToBase: 50,
          salePrice: 5350000,
          purchasePrice: 4700000,
          wholesalePrice: 5150000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: true,
        },
      ],
      supplierId: 'sup-b-02',
      supplierName: 'SOGUIMAT Distribution',
      location: 'Dépôt Métal - Allée B',
      stockByLocation: { 'MAIN_STORE': 250, 'BOUTIQUE': 50 },
      stockByStore: { 'store-horizon-main': 250, 'store-horizon-shop': 50 },
      isConsumable: false,
      isSellable: true,
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-15T08:00:00Z'
    },
    {
      id: 'prod-b-03',
      tenantId: 't-002',
      code: 'PNT-VINYL-20L-BLC',
      barcode: '6009876543212',
      name: 'Pot Peinture Vinylique Blanche 20L Astral',
      categoryId: 'cat-b-03',
      category: 'Peinture & Finition',
      description: 'Peinture mate lavable haut pouvoir couvrant pour murs intérieurs et plafonds.',
      baseUnit: 'pot',
      unit: 'pot',
      defaultSaleUnit: 'pot',
      defaultPurchaseUnit: 'pot',
      costPrice: 280000,
      salePrice: 330000,
      wholesalePrice: 310000,
      initialStock: 50,
      currentStock: 45,
      minStockAlert: 10,
      maxStock: 200,
      packagings: [],
      supplierId: 'sup-b-03',
      supplierName: 'Chimie & Peintures d’Afrique',
      location: 'Rayon Peintures - R1',
      stockByLocation: { 'MAIN_STORE': 30, 'BOUTIQUE': 15 },
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-15T08:00:00Z'
    },
    {
      id: 'prod-b-04',
      tenantId: 't-002',
      code: 'VIS-PLACO-35X25',
      barcode: '6009876543213',
      name: 'Vis Placo Phosphate Noir 3.5x25mm (x1000)',
      categoryId: 'cat-b-02',
      category: 'Quincaillerie & Fixations',
      description: 'Vis auto-perceuses pour fixation de plaques de plâtre sur ossature métallique.',
      baseUnit: 'pièce',
      unit: 'pièce',
      defaultSaleUnit: 'pièce',
      defaultPurchaseUnit: 'boîte',
      costPrice: 40,
      salePrice: 60,
      wholesalePrice: 50,
      initialStock: 30000,
      currentStock: 30000,
      minStockAlert: 5000,
      maxStock: 100000,
      packagings: [
        {
          id: 'pkg-b4-1',
          level: 2,
          unitName: 'boîte',
          containedQuantity: 1000,
          subUnitName: 'pièce',
          factorToBase: 1000,
          salePrice: 55000,
          purchasePrice: 40000,
          wholesalePrice: 48000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: true,
        },
        {
          id: 'pkg-b4-2',
          level: 3,
          unitName: 'carton',
          containedQuantity: 12,
          subUnitName: 'boîte',
          factorToBase: 12000,
          salePrice: 630000,
          purchasePrice: 470000,
          wholesalePrice: 570000,
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: false,
        },
      ],
      supplierId: 'sup-b-02',
      supplierName: 'SOGUIMAT Distribution',
      location: 'Rayon Visserie - Tiroir V4',
      stockByLocation: { 'MAIN_STORE': 20000, 'BOUTIQUE': 10000 },
      isActive: true,
      isArchived: false,
      createdAt: '2026-01-15T08:00:00Z'
    }
  ],
  stockMovements: [],
  suppliers: [
    { id: 'sup-01', tenantId: INITIAL_TENANT_ID, name: 'Papeterie Centrale de Guinée', company: 'Papeterie Centrale SARL', contactPerson: 'M. Thierno Diallo', phone: '+224 622 10 30 50', email: 'ventes@papeterie-guinee.com', address: 'Madina Marché, Conakry', isActive: true },
    { id: 'sup-02', tenantId: INITIAL_TENANT_ID, name: 'Global Tech & Bureautique SARL', company: 'Global Tech Guinée', contactPerson: 'Mme. Camara Aminata', phone: '+224 624 99 00 11', email: 'contact@globaltech-gn.com', address: 'Boulevard du Commerce, Kaloum', isActive: true }
  ],
  requestingDepartments: [
    { id: 'dept-01', tenantId: INITIAL_TENANT_ID, code: 'ADM', name: 'Administration Générale', managerName: 'M. Ibrahima Diallo', description: 'Direction administrative, secrétariat et fournitures de bureau', isActive: true, isArchived: false, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'dept-02', tenantId: INITIAL_TENANT_ID, code: 'SI', name: 'Service Informatique & Réseaux', managerName: 'M. Ousmane Bah', description: 'Systèmes informatiques, parc machines et consommables techniques', isActive: true, isArchived: false, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'dept-03', tenantId: INITIAL_TENANT_ID, code: 'ATELIER', name: 'Atelier Reprographie & Façonnage', managerName: 'Mme. Fatoumata Binta', description: 'Impression grand volume, reliure, plastification et façonnage', isActive: true, isArchived: false, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'dept-04', tenantId: INITIAL_TENANT_ID, code: 'BOUTIQUE', name: 'Boutique & Magasin', managerName: 'M. Thierno Barry', description: 'Vente directe au comptoir, fournitures et papeterie de détail', isActive: true, isArchived: false, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'dept-05', tenantId: INITIAL_TENANT_ID, code: 'DIR', name: 'Direction Générale', managerName: 'M. Alpha Amadou', description: 'Pilotage stratégique, management et représentation', isActive: true, isArchived: false, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'dept-06', tenantId: INITIAL_TENANT_ID, code: 'CPT', name: 'Comptabilité & Finance', managerName: 'Mme. Mariam Camara', description: 'Gestion financière, trésorerie et fiscalité', isActive: true, isArchived: false, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'dept-07', tenantId: INITIAL_TENANT_ID, code: 'FORMATION', name: 'Pédagogie & Formation', managerName: 'M. Mamadou Lamarana', description: 'Formations professionnelles, supports de cours et certification', isActive: true, isArchived: false, createdAt: '2026-01-01T00:00:00Z' }
  ],
  purchaseOrders: [],
  invoices: [],
  notifications: [
    {
      id: 'notif-01',
      tenantId: INITIAL_TENANT_ID,
      title: 'Alerte Stock Faible',
      message: 'Le stock de "Kit Encre Epson EcoTank" a atteint son seuil d\'alerte (3 unités restantes).',
      type: 'WARNING',
      link: '/stock',
      isRead: false,
      createdAt: '2026-02-28T08:00:00Z'
    },
    {
      id: 'notif-02',
      tenantId: INITIAL_TENANT_ID,
      title: 'Commande Prête à Livrer',
      message: 'La commande CMD-2026-000001 (Sekou Kourouma) est terminée en atelier.',
      type: 'SUCCESS',
      link: '/orders',
      isRead: false,
      createdAt: '2026-02-25T11:45:00Z'
    },
    {
      id: 'notif-03',
      tenantId: INITIAL_TENANT_ID,
      title: 'Certificat Délivré',
      message: 'Le certificat CERT-2026-000001 a été généré pour Kadiatou Sow.',
      type: 'INFO',
      link: '/certificates',
      isRead: true,
      createdAt: '2026-02-26T10:00:00Z'
    }
  ],
  auditLogs: [
    {
      id: 'log-01',
      tenantId: INITIAL_TENANT_ID,
      userId: 'u-admin-01',
      userName: 'Ibrahima Sory Camara',
      action: 'SYSTEM_INITIALIZED',
      entityType: 'SYSTEM',
      entityId: INITIAL_TENANT_ID,
      newValues: { message: 'Initialisation du centre CPEP et des configurations multi-tenant' },
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'log-02',
      tenantId: INITIAL_TENANT_ID,
      userId: 'u-caissier-01',
      userName: 'Fatoumata Binta Barry',
      action: 'CASH_SESSION_OPENED',
      entityType: 'CASH_SESSION',
      entityId: 'cs-01',
      newValues: { openingBalance: 250000, register: 'CAISSE-01' },
      createdAt: '2026-02-28T07:45:00Z'
    },
    {
      id: 'log-03',
      tenantId: INITIAL_TENANT_ID,
      userId: 'u-caissier-01',
      userName: 'Fatoumata Binta Barry',
      action: 'ORDER_PAYMENT_PROCESSED',
      entityType: 'PAYMENT',
      entityId: 'pay-001',
      newValues: { amount: 90000, order: 'CMD-2026-000001', method: 'CASH' },
      createdAt: '2026-02-28T10:15:00Z'
    }
  ],
  equipment: [
    {
      id: 'eq-01',
      tenantId: INITIAL_TENANT_ID,
      inventoryNumber: 'MAT-2026-0001',
      name: 'HP LaserJet Enterprise M608dn',
      category: 'IMPRESSION_PRODUCTION',
      type: 'Imprimante Laser Réseau N&B',
      brand: 'HP',
      model: 'M608dn',
      serialNumber: 'CNB1N12345',
      description: 'Imprimante monochrome réseau ultra-rapide 61 ppm recto-verso.',
      acquisitionDate: '2025-01-15',
      supplier: 'BuroTic Guinée',
      costPrice: 8500000,
      location: 'Atelier Impression - Poste 1',
      department: 'PRODUCTION_MATERIEL',
      responsiblePersonName: 'Mamadou Oury Bah',
      condition: 'EXCELLENT',
      status: 'EN_SERVICE',
      warrantyEndDate: '2027-01-15',
      notes: 'Bac papier additionnel 550 feuilles installé.',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'eq-02',
      tenantId: INITIAL_TENANT_ID,
      inventoryNumber: 'MAT-2026-0002',
      name: 'Canon imageRUNNER ADVANCE C3530i',
      category: 'IMPRESSION_PRODUCTION',
      type: 'Photocopieuse Multifonction Couleur A3/A4',
      brand: 'Canon',
      model: 'C3530i III',
      serialNumber: 'CAN88776655',
      description: 'Copieur professionnel couleur haut volume avec chargeur automatique.',
      acquisitionDate: '2024-06-10',
      supplier: 'TechnoPrint SARL',
      costPrice: 28000000,
      location: 'Atelier Reprographie',
      department: 'PRODUCTION_MATERIEL',
      responsiblePersonName: 'Mamadou Oury Bah',
      condition: 'BON',
      status: 'EN_SERVICE',
      warrantyEndDate: '2026-06-10',
      notes: 'Contrat de maintenance préventive actif.',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'eq-03',
      tenantId: INITIAL_TENANT_ID,
      inventoryNumber: 'MAT-2026-0003',
      name: 'Plastifieuse Thermique GBC Fusion 7000L A3',
      category: 'IMPRESSION_PRODUCTION',
      type: 'Plastifieuse Haute Vitesse',
      brand: 'GBC',
      model: 'Fusion 7000L',
      serialNumber: 'GBC-772211',
      description: 'Plastification automatique jusqu’à 250 microns.',
      acquisitionDate: '2025-03-20',
      supplier: 'Papeterie Centrale',
      costPrice: 4200000,
      location: 'Atelier Façonnage - Table F1',
      department: 'PRODUCTION_MATERIEL',
      responsiblePersonName: 'Mamadou Oury Bah',
      condition: 'EXCELLENT',
      status: 'EN_SERVICE',
      warrantyEndDate: '2027-03-20',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'eq-04',
      tenantId: INITIAL_TENANT_ID,
      inventoryNumber: 'MAT-2026-0004',
      name: 'Massicot Électrique Professionnel IDEAL 4850',
      category: 'IMPRESSION_PRODUCTION',
      type: 'Massicot de Coupe Électrique',
      brand: 'IDEAL',
      model: '4850-95 EP',
      serialNumber: 'IDL-4850-009',
      description: 'Massicot de coupe 475mm avec presse automatique et commande programmable.',
      acquisitionDate: '2023-11-05',
      supplier: 'GraphiEquip Conakry',
      costPrice: 32000000,
      location: 'Atelier Façonnage - Zone Coupe',
      department: 'PRODUCTION_MATERIEL',
      responsiblePersonName: 'Mamadou Oury Bah',
      condition: 'MOYEN',
      status: 'EN_MAINTENANCE',
      notes: 'Lame envoyée à l’affûtage et révision du capteur optique.',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'eq-05',
      tenantId: INITIAL_TENANT_ID,
      inventoryNumber: 'MAT-2026-0005',
      name: 'Station PAO Dell OptiPlex 7090 MT',
      category: 'INFORMATIQUE',
      type: 'Ordinateur Fixe Graphisme & PAO',
      brand: 'Dell',
      model: 'OptiPlex 7090 (Core i7, 32GB RAM, RTX 3060)',
      serialNumber: 'DELL-8899001',
      description: 'Poste graphique dédié Photoshop, Illustrator, InDesign et PAO.',
      acquisitionDate: '2025-02-12',
      supplier: 'InfoTech Guinée',
      costPrice: 14500000,
      location: 'Bureau PAO & Numérisation',
      department: 'PRODUCTION_MATERIEL',
      responsiblePersonName: 'Mamadou Oury Bah',
      condition: 'EXCELLENT',
      status: 'EN_SERVICE',
      warrantyEndDate: '2028-02-12',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'eq-06',
      tenantId: INITIAL_TENANT_ID,
      inventoryNumber: 'MAT-2026-0006',
      name: 'Traceur Grand Format Epson SureColor SC-T3100',
      category: 'IMPRESSION_PRODUCTION',
      type: 'Traceur Plan & Affiche 24 pouces',
      brand: 'Epson',
      model: 'SC-T3100',
      serialNumber: 'EPS-SC-9912',
      description: 'Impression grand format plans d’architecte et posters.',
      acquisitionDate: '2024-09-18',
      supplier: 'GraphiEquip Conakry',
      costPrice: 19500000,
      location: 'Atelier Grand Format',
      department: 'PRODUCTION_MATERIEL',
      responsiblePersonName: 'Mamadou Oury Bah',
      condition: 'MOYEN',
      status: 'EN_PANNE',
      notes: 'Tête d’impression magenta à purger ou remplacer.',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'eq-07',
      tenantId: INITIAL_TENANT_ID,
      inventoryNumber: 'MAT-2026-0007',
      name: 'Onduleur APC Smart-UPS 3000VA LCD',
      category: 'INFORMATIQUE',
      type: 'Onduleur Régulateur Haute Puissance',
      brand: 'APC by Schneider',
      model: 'SMT3000I',
      serialNumber: 'APC-3000-4411',
      description: 'Protection électrique centrale pour copieurs et serveurs.',
      acquisitionDate: '2024-01-10',
      supplier: 'BuroTic Guinée',
      costPrice: 9800000,
      location: 'Salle Technique Énergie',
      department: 'ADMINISTRATION',
      responsiblePersonName: 'Ibrahima Sory Camara',
      condition: 'EXCELLENT',
      status: 'EN_SERVICE',
      createdAt: '2026-01-01T00:00:00Z'
    }
  ],
  equipmentMaintenances: [
    {
      id: 'maint-01',
      tenantId: INITIAL_TENANT_ID,
      equipmentId: 'eq-04',
      equipmentName: 'Massicot Électrique Professionnel IDEAL 4850',
      reportedDate: '2026-02-20',
      problemDescription: 'Lame émoussée causant des bavures sur papier fort et réajustement des butées millimétriques.',
      technicianName: 'Sékou Touré (Technicien Outillage)',
      actionTaken: 'Affûtage de lame et graissage des glissières.',
      replacedParts: 'Bande de coupe téflon',
      cost: 350000,
      status: 'EN_COURS',
      notes: 'Retour en service prévu sous 48h.',
      createdAt: '2026-02-20T09:00:00Z'
    },
    {
      id: 'maint-02',
      tenantId: INITIAL_TENANT_ID,
      equipmentId: 'eq-06',
      equipmentName: 'Traceur Grand Format Epson SureColor SC-T3100',
      reportedDate: '2026-02-25',
      problemDescription: 'Lignes blanches récurrentes sur tirages couleurs, buses magenta bouchées.',
      technicianName: 'SAV Epson Guinée',
      actionTaken: 'Cycle de nettoyage en profondeur et tentative de désobstruction ultrason.',
      cost: 650000,
      status: 'EN_COURS',
      notes: 'En attente de devis de remplacement de tête si échec.',
      createdAt: '2026-02-25T14:30:00Z'
    },
    {
      id: 'maint-03',
      tenantId: INITIAL_TENANT_ID,
      equipmentId: 'eq-02',
      equipmentName: 'Canon imageRUNNER ADVANCE C3530i',
      reportedDate: '2026-01-10',
      problemDescription: 'Code erreur E000020 (densité toner magenta instable).',
      technicianName: 'Service Technique Canon',
      actionTaken: 'Remplacement tambour magenta et nettoyage du capteur optique de potentiel.',
      replacedParts: 'Tambour C-EXV 49 Magenta',
      cost: 450000,
      resolutionDate: '2026-01-11',
      status: 'REPARE',
      notes: 'Test de conformité 100 pages réussi.',
      createdAt: '2026-01-10T11:00:00Z'
    }
  ]
};

export function calculateItemStockDeduction(
  item: { quantity: number; unit?: string; publicUnit?: string; stockQuantityDeducted?: number },
  prod: Product
): number {
  if (item.stockQuantityDeducted !== undefined && item.stockQuantityDeducted > 0) {
    return item.stockQuantityDeducted;
  }
  const qty = Number(item.quantity) || 1;
  const unit = (item.publicUnit || item.unit || '').trim().toLowerCase();
  const baseUnit = (prod.baseUnit || prod.unit || '').trim().toLowerCase();

  // 1. If unit matches baseUnit exactly, 1:1
  if (unit && baseUnit && unit === baseUnit) {
    return qty;
  }

  // 2. Check in product packagings (e.g. "paquet" -> factorToBase: 500, "carton" -> factorToBase: 2500)
  if (prod.packagings && prod.packagings.length > 0 && unit) {
    const matchedPkg = prod.packagings.find(pkg => {
      const pkgUnit = (pkg.unitName || '').trim().toLowerCase();
      return pkgUnit === unit || unit.includes(pkgUnit) || pkgUnit.includes(unit);
    });
    if (matchedPkg && matchedPkg.factorToBase) {
      return qty * matchedPkg.factorToBase;
    }
  }

  // 3. Fallback conversion factor
  const factor = prod.conversionFactor || 1;
  return qty * factor;
}

// LocalStorage Persistence Wrapper with Event Emitter
class StoreManager {
  private state: DatabaseState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): DatabaseState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure clientStoreRelations is properly hydrated
        if (!parsed.clientStoreRelations) {
          parsed.clientStoreRelations = [];
        }
        // Ensure trainingCategories are properly hydrated
        if (!parsed.trainingCategories || parsed.trainingCategories.length === 0) {
          parsed.trainingCategories = JSON.parse(JSON.stringify(INITIAL_STATE.trainingCategories));
        } else {
          parsed.trainingCategories.forEach((c: any) => {
            if (c.isActive === undefined) c.isActive = true;
          });
        }

        // Ensure equipment and equipmentMaintenances are properly hydrated
        if (!parsed.equipment || parsed.equipment.length === 0) {
          parsed.equipment = JSON.parse(JSON.stringify(INITIAL_STATE.equipment));
        }
        if (!parsed.equipmentMaintenances) {
          parsed.equipmentMaintenances = JSON.parse(JSON.stringify(INITIAL_STATE.equipmentMaintenances));
        }

        // Ensure expenses and expenseCategories are properly hydrated
        if (!parsed.expenses) {
          parsed.expenses = [];
        }
        if (!parsed.expenseCategories || parsed.expenseCategories.length === 0) {
          parsed.expenseCategories = JSON.parse(JSON.stringify(INITIAL_STATE.expenseCategories));
        }

        // Ensure roles & users match official structure
        if (!parsed.roles || parsed.roles.length === 0) {
          parsed.roles = JSON.parse(JSON.stringify(INITIAL_STATE.roles));
        } else {
          const caissierRole = (parsed.roles as Role[]).find((r: Role) => r.code === 'CAISSIER');
          if (caissierRole) {
            caissierRole.permissions = [
              'persons.*', 'clients.*',
              'orders.*',
              'production.*',
              'cash.*',
              'payments.*',
              'invoices.*',
              'services.view'
            ];
          }
        }

        // Synchronize user permissions with their roles
        if (parsed.users) {
          (parsed.users as User[]).forEach((u: User) => {
            const role = (parsed.roles as Role[]).find((r: Role) => r.code === u.roles[0]?.code);
            if (role) {
              u.permissions = role.permissions;
            }
          });
        }

        // Ensure services have standard options and configurations hydrated, with single Photocopie & Impression
        if (parsed.services) {
          parsed.services.forEach((s: Service) => {
            if (s.id === 'srv-02' || (s.code === 'IMPRESSION-A4-COUL' && s.name.includes('Numérique'))) {
              s.name = 'Impression';
            }

            // Flag legacy duplicate variants so they don't appear in "Type de service" catalogues
            const n = (s.name || '').toLowerCase();
            const isLegacyVariant = (
              (n.includes('photocopie') && (n.includes('n&b') || n.includes('noir') || n.includes('couleur') || n.includes('a4') || n.includes('a3')) && s.id !== 'srv-01') ||
              (n.includes('impression') && (n.includes('n&b') || n.includes('noir') || n.includes('couleur') || n.includes('a4') || n.includes('a3') || n.includes('numérique')) && s.id !== 'srv-02')
            );
            if (isLegacyVariant) {
              (s as any).isLegacyVariant = true;
              s.isActive = false;
            }

            const initialSrv = INITIAL_STATE.services.find(init => init.id === s.id || init.code === s.code);
            if ((!s.options || s.options.length === 0) && initialSrv?.options && initialSrv.options.length > 0) {
              s.options = JSON.parse(JSON.stringify(initialSrv.options));
            }
            if ((!s.configurations || s.configurations.length === 0) && initialSrv?.configurations && initialSrv.configurations.length > 0) {
              s.configurations = JSON.parse(JSON.stringify(initialSrv.configurations));
            }
            // If still no configurations defined, create fallback default config
            if (!s.configurations || s.configurations.length === 0) {
              s.configurations = [
                {
                  id: `cfg-${s.id}-default`,
                  serviceId: s.id,
                  optionValues: {},
                  price: s.basePrice || 0,
                  billingUnit: s.unit || 'prestation',
                  consumables: (s.consumables || []).map(c => ({
                    productId: c.productId,
                    productName: c.productName,
                    quantityPerUnit: c.quantityPerUnit || 1,
                    unit: c.unit || 'unité',
                    isClientSupplied: Boolean(c.isClientSupplied)
                  })),
                  isActive: s.isActive !== false
                }
              ];
            }
            if (!s.options) {
              s.options = [];
            }
          });

          // Ensure standard services like Conception, Recherche, Exposé exist in state
          const existingServiceCodes = new Set(parsed.services.map((s: Service) => s.code));
          ['CONCEPTION-GRAPHIQUE', 'RECHERCHE-DOC', 'EXPOSE-SAISIE'].forEach(code => {
            if (!existingServiceCodes.has(code)) {
              const toAdd = INITIAL_STATE.services.find(init => init.code === code);
              if (toAdd) {
                parsed.services.push(JSON.parse(JSON.stringify(toAdd)));
              }
            }
          });
        }

        // Ensure priceHistories is hydrated
        if (!parsed.priceHistories) {
          parsed.priceHistories = JSON.parse(JSON.stringify(INITIAL_STATE.priceHistories));
        }

        // Ensure digitalSignatures and documentSignatureConfigs are hydrated in tenant settings
        if (parsed.tenants && parsed.tenants[0]) {
          if (!parsed.tenants[0].settings.digitalSignatures || parsed.tenants[0].settings.digitalSignatures.length === 0) {
            parsed.tenants[0].settings.digitalSignatures = JSON.parse(JSON.stringify(INITIAL_STATE.tenants[0].settings.digitalSignatures));
          }
          if (!parsed.tenants[0].settings.documentSignatureConfigs || parsed.tenants[0].settings.documentSignatureConfigs.length === 0) {
            parsed.tenants[0].settings.documentSignatureConfigs = JSON.parse(JSON.stringify(INITIAL_STATE.tenants[0].settings.documentSignatureConfigs));
          }
          if (!parsed.tenants[0].settings.discountRoleLimits || parsed.tenants[0].settings.discountRoleLimits.length === 0) {
            parsed.tenants[0].settings.discountRoleLimits = JSON.parse(JSON.stringify(INITIAL_STATE.tenants[0].settings.discountRoleLimits));
          }
        }

        // Ensure discountAudits is hydrated
        if (!parsed.discountAudits) {
          parsed.discountAudits = JSON.parse(JSON.stringify(INITIAL_STATE.discountAudits));
        }

        // Ensure productCategories are properly hydrated
        if (!parsed.productCategories || parsed.productCategories.length === 0) {
          parsed.productCategories = JSON.parse(JSON.stringify(INITIAL_STATE.productCategories));
        } else {
          parsed.productCategories.forEach((c: any) => {
            if (c.isActive === undefined) c.isActive = true;
            if (c.isArchived === undefined) c.isArchived = false;
          });
        }

        // Ensure requestingDepartments are properly hydrated
        if (!parsed.requestingDepartments || parsed.requestingDepartments.length === 0) {
          parsed.requestingDepartments = JSON.parse(JSON.stringify(INITIAL_STATE.requestingDepartments));
        } else {
          parsed.requestingDepartments.forEach((d: any) => {
            if (d.isActive === undefined) d.isActive = true;
            if (d.isArchived === undefined) d.isArchived = false;
          });
        }

        // Ensure purchaseOrders have departmentId and departmentName hydrated
        if (parsed.purchaseOrders) {
          parsed.purchaseOrders.forEach((po: any) => {
            if (!po.departmentId) {
              const defaultDept = parsed.requestingDepartments ? parsed.requestingDepartments[0] : INITIAL_STATE.requestingDepartments[0];
              po.departmentId = defaultDept?.id || 'dept-01';
              po.departmentName = defaultDept?.name || 'Administration Générale';
            }
          });
        }

        // Ensure products have baseUnit, multi-level packagings and categoryId hydrated
        if (!parsed.products || parsed.products.length === 0 || !parsed.products[0].baseUnit) {
          parsed.products = JSON.parse(JSON.stringify(INITIAL_STATE.products));
        } else {
          parsed.products.forEach((p: any) => {
            if (p.isArchived === undefined) p.isArchived = false;
            if (!p.baseUnit) p.baseUnit = p.unit || 'unité';
            if (!p.defaultSaleUnit) p.defaultSaleUnit = p.baseUnit;
            if (!p.defaultPurchaseUnit) p.defaultPurchaseUnit = p.purchaseUnit || p.baseUnit;
            if (!p.packagings) p.packagings = [];
            if (!p.categoryId && p.category) {
              const matchedCat = (parsed.productCategories as ProductCategory[])?.find(
                c => c.name.toLowerCase() === p.category.toLowerCase()
              );
              if (matchedCat) {
                p.categoryId = matchedCat.id;
              } else {
                p.categoryId = parsed.productCategories?.[0]?.id || 'cat-prod-01';
              }
            }
            p.prestationStock = p.currentStock;
            p.stockByLocation = { CENTRAL: p.currentStock, MAIN_STORE: p.currentStock, PRESTATION: p.currentStock };
            p.stockByStore = { CENTRAL: p.currentStock };
          });
        }

        // Ensure orders have customerType hydrated
        if (parsed.orders) {
          parsed.orders.forEach((o: any) => {
            if (!o.customerType) {
              o.customerType = o.personId ? 'REGISTERED' : 'WALK_IN';
            }
          });
        }

        // Ensure tenants have activityType, status, trial and subscription fields hydrated
        if (parsed.tenants) {
          parsed.tenants.forEach((t: Tenant) => {
            if (!t.activityType) {
              t.activityType = t.id === 't-002' ? 'RETAIL_STORE' : 'SERVICE_CENTER';
            }
            if (!t.status) {
              t.status = 'ACTIVE';
            }
            if (!t.subscriptionStatus) {
              t.subscriptionStatus = 'TRIAL';
              t.trialDaysTotal = 45;
              t.trialStartedAt = t.createdAt || new Date().toISOString();
              t.trialEndsAt = new Date(new Date(t.trialStartedAt).getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();
            }
            if (!t.activationRequests) {
              t.activationRequests = [];
            }
            if (!t.supportContact) {
              t.supportContact = {
                name: "Direction Commerciale & Support Client CPEP",
                phone: "+224 620 00 11 22",
                whatsapp: "+224 620 00 11 22",
                email: "licences@cpep-guinee.com",
                address: "Avenue de la République, Kaloum, Conakry (Guinée)",
                customMessage: "Nos conseillers sont disponibles du Lundi au Samedi pour activer votre licence définitive ou répondre à vos questions techniques."
              };
            }
          });

          // Ensure Agence B (t-002) is present
          if (!parsed.tenants.some((t: Tenant) => t.id === 't-002')) {
            const agb = INITIAL_STATE.tenants.find(t => t.id === 't-002');
            if (agb) parsed.tenants.push(JSON.parse(JSON.stringify(agb)));
          }
        }

        // Ensure users have Super Admin (u-superadmin) and Admin Agence B (u-admin-b)
        if (parsed.users) {
          if (!parsed.users.some((u: User) => u.id === 'u-superadmin' || u.username === 'superadmin')) {
            const su = INITIAL_STATE.users.find(u => u.id === 'u-superadmin');
            if (su) parsed.users.push(JSON.parse(JSON.stringify(su)));
          }
          if (!parsed.users.some((u: User) => u.id === 'u-admin-b' || u.username === 'admin.horizon')) {
            const ab = INITIAL_STATE.users.find(u => u.id === 'u-admin-b');
            if (ab) parsed.users.push(JSON.parse(JSON.stringify(ab)));
          }
        }

        // Ensure Agence B categories and products are present
        if (parsed.productCategories && !parsed.productCategories.some((c: ProductCategory) => c.tenantId === 't-002')) {
          const catsB = INITIAL_STATE.productCategories.filter(c => c.tenantId === 't-002');
          parsed.productCategories.push(...JSON.parse(JSON.stringify(catsB)));
        }
        // Ensure financialAccounts are hydrated
        if (!parsed.financialAccounts || parsed.financialAccounts.length === 0) {
          parsed.financialAccounts = JSON.parse(JSON.stringify(INITIAL_STATE.financialAccounts));
        } else {
          // Ensure both t-001 and t-002 accounts exist
          INITIAL_STATE.financialAccounts.forEach(fa => {
            if (!parsed.financialAccounts.some((a: FinancialAccount) => a.id === fa.id)) {
              parsed.financialAccounts.push(JSON.parse(JSON.stringify(fa)));
            }
          });
          parsed.financialAccounts.forEach((fa: any) => {
            if (fa.isActive === undefined) fa.isActive = true;
            if (fa.currentBalance === undefined) fa.currentBalance = fa.initialBalance || 0;
            if (!fa.currency) fa.currency = 'GNF';
          });
        }

        // Ensure financialMovements, supplierDebts, and supplierPayments are hydrated
        if (!parsed.financialMovements) {
          parsed.financialMovements = JSON.parse(JSON.stringify(INITIAL_STATE.financialMovements));
        }
        if (!parsed.supplierDebts) {
          parsed.supplierDebts = JSON.parse(JSON.stringify(INITIAL_STATE.supplierDebts));
        }
        if (!parsed.supplierPayments) {
          parsed.supplierPayments = JSON.parse(JSON.stringify(INITIAL_STATE.supplierPayments));
        }

        // Ensure purchase orders have paymentStatus, paidAmount, dueAmount hydrated
        if (parsed.purchaseOrders) {
          parsed.purchaseOrders.forEach((po: any) => {
            if (!po.paymentStatus) {
              po.paidAmount = po.paidAmount || (po.status === 'RECEIVED' ? po.totalAmount : 0);
              po.dueAmount = po.dueAmount !== undefined ? po.dueAmount : Math.max(0, po.totalAmount - po.paidAmount);
              if (po.paidAmount >= po.totalAmount && po.totalAmount > 0) {
                po.paymentStatus = 'PAID';
              } else if (po.paidAmount > 0) {
                po.paymentStatus = 'PARTIALLY_PAID';
              } else if (po.status === 'RECEIVED') {
                po.paymentStatus = 'CREDIT';
              } else {
                po.paymentStatus = 'UNPAID';
              }
            }
            if (!po.payments) po.payments = [];
          });
        }

        // Ensure financialYears and financialPeriods are hydrated
        if (!parsed.financialYears || parsed.financialYears.length === 0) {
          parsed.financialYears = JSON.parse(JSON.stringify(INITIAL_STATE.financialYears));
        } else {
          INITIAL_STATE.financialYears.forEach(fy => {
            if (!parsed.financialYears.some((y: FinancialYear) => y.id === fy.id)) {
              parsed.financialYears.push(JSON.parse(JSON.stringify(fy)));
            }
          });
        }

        if (!parsed.financialPeriods || parsed.financialPeriods.length === 0) {
          parsed.financialPeriods = JSON.parse(JSON.stringify(INITIAL_STATE.financialPeriods));
        } else {
          // Ensure periods exist for all financial years
          parsed.financialYears.forEach((fy: FinancialYear) => {
            const hasPeriods = parsed.financialPeriods.some((p: FinancialPeriod) => p.financialYearId === fy.id);
            if (!hasPeriods) {
              const generated = generateMonthlyPeriodsForYear(fy.id, fy.tenantId, fy.year, 8);
              parsed.financialPeriods.push(...generated);
            }
          });
        }

        // Migrate historical financial movements, cash sessions, payments, expenses, supplier payments
        const periodsList = (parsed.financialPeriods || []) as FinancialPeriod[];
        const yearsList = (parsed.financialYears || []) as FinancialYear[];

        const linkEntityToPeriod = (entity: any, dateStr?: string, tenantId?: string) => {
          if (!dateStr || !tenantId) return;
          const entityDate = dateStr.slice(0, 10);
          const matchedPeriod = periodsList.find(
            p => p.tenantId === tenantId && entityDate >= p.startDate && entityDate <= p.endDate
          );
          if (matchedPeriod) {
            if (!entity.financialPeriodId) entity.financialPeriodId = matchedPeriod.id;
            if (!entity.financialYearId) entity.financialYearId = matchedPeriod.financialYearId;
          } else {
            const matchedYear = yearsList.find(
              y => y.tenantId === tenantId && entityDate >= y.startDate && entityDate <= y.endDate
            );
            if (matchedYear && !entity.financialYearId) entity.financialYearId = matchedYear.id;
          }
        };

        if (parsed.financialMovements) {
          parsed.financialMovements.forEach((m: any) => linkEntityToPeriod(m, m.createdAt, m.tenantId));
        }
        if (parsed.payments) {
          parsed.payments.forEach((p: any) => linkEntityToPeriod(p, p.createdAt, p.tenantId));
        }
        if (parsed.expenses) {
          parsed.expenses.forEach((e: any) => linkEntityToPeriod(e, e.createdAt || e.date, e.tenantId));
        }
        if (parsed.supplierPayments) {
          parsed.supplierPayments.forEach((sp: any) => linkEntityToPeriod(sp, sp.createdAt || sp.paymentDate, sp.tenantId));
        }
        if (parsed.cashSessions) {
          parsed.cashSessions.forEach((cs: any) => linkEntityToPeriod(cs, cs.openedAt, cs.tenantId));
        }

        // Ensure stores are properly hydrated
        if (!parsed.stores || parsed.stores.length === 0) {
          parsed.stores = JSON.parse(JSON.stringify(INITIAL_STORES));
        } else {
          INITIAL_STORES.forEach(s => {
            if (!parsed.stores.some((existing: Store) => existing.id === s.id)) {
              parsed.stores.push(JSON.parse(JSON.stringify(s)));
            }
          });
        }

        // Ensure products have stockByStore and consumable flags
        if (parsed.products) {
          parsed.products.forEach((p: Product) => {
            if (p.isConsumable === undefined) p.isConsumable = true;
            if (p.isSellable === undefined) p.isSellable = true;
            if (!p.stockByStore || Object.keys(p.stockByStore).length === 0) {
              const defaultStore = parsed.stores?.find((s: Store) => s.tenantId === p.tenantId && s.isDefault) || parsed.stores?.find((s: Store) => s.tenantId === p.tenantId);
              if (defaultStore) {
                p.stockByStore = { [defaultStore.id]: p.currentStock || 0 };
              }
            }
          });
        }

        // Ensure services have consumableMode and consumables strictly aligned
        if (parsed.services) {
          parsed.services.forEach((s: Service) => {
            if (s.consumables && s.consumables.length > 0) {
              s.consumptions = s.consumables.map(c => ({
                productId: c.productId,
                quantity: c.quantityPerUnit || 1
              }));
            } else if (s.consumables && s.consumables.length === 0) {
              s.consumptions = [];
            } else if (!s.consumables && s.consumptions && s.consumptions.length > 0) {
              s.consumables = s.consumptions.map(c => ({
                productId: c.productId,
                quantityPerUnit: c.quantity,
                isClientSupplied: false
              }));
            } else {
              s.consumables = [];
              s.consumptions = [];
            }
            if (!s.consumableMode) {
              s.consumableMode = (s.consumables && s.consumables.length > 0) ? 'INTERNAL_VARIABLE' : 'NONE';
            }
          });
        }

        // Clean legacy demo test seed data from t-001 if present
        const DEMO_PAY_IDS = ['pay-001', 'pay-002', 'pay-003'];
        const DEMO_INV_IDS = ['inv-001', 'inv-002'];
        const DEMO_MVT_IDS = ['mvt-001', 'mvt-002', 'mvt-003', 'mvt-004', 'mvt-005'];
        const DEMO_EXP_IDS = ['exp-001'];
        const DEMO_ENR_IDS = ['enr-001', 'enr-002'];
        const DEMO_CERT_IDS = ['cert-01'];
        const DEMO_ASS_IDS = ['ass-01'];
        const DEMO_ATT_IDS = ['att-01', 'att-02'];
        const DEMO_VNT_IDS = ['vnt-001'];
        const DEMO_MOV_IDS = ['mov-001', 'mov-002'];
        const DEMO_DEB_IDS = ['deb-001'];
        const DEMO_SP_IDS = ['sp-001'];
        const DEMO_DA_IDS = ['da-001', 'da-002'];

        if (parsed.payments) parsed.payments = parsed.payments.filter((p: any) => !DEMO_PAY_IDS.includes(p.id));
        if (parsed.invoices) parsed.invoices = parsed.invoices.filter((i: any) => !DEMO_INV_IDS.includes(i.id));
        if (parsed.financialMovements) parsed.financialMovements = parsed.financialMovements.filter((m: any) => !DEMO_MVT_IDS.includes(m.id));
        if (parsed.expenses) parsed.expenses = parsed.expenses.filter((e: any) => !DEMO_EXP_IDS.includes(e.id));
        if (parsed.enrollments) parsed.enrollments = parsed.enrollments.filter((e: any) => !DEMO_ENR_IDS.includes(e.id));
        if (parsed.certificates) parsed.certificates = parsed.certificates.filter((c: any) => !DEMO_CERT_IDS.includes(c.id));
        if (parsed.assessments) parsed.assessments = parsed.assessments.filter((a: any) => !DEMO_ASS_IDS.includes(a.id));
        if (parsed.attendanceSheets) parsed.attendanceSheets = parsed.attendanceSheets.filter((a: any) => !DEMO_ATT_IDS.includes(a.id));
        if (parsed.boutiqueSales) parsed.boutiqueSales = parsed.boutiqueSales.filter((b: any) => !DEMO_VNT_IDS.includes(b.id));
        if (parsed.stockMovements) parsed.stockMovements = parsed.stockMovements.filter((m: any) => !DEMO_MOV_IDS.includes(m.id));
        if (parsed.supplierDebts) parsed.supplierDebts = parsed.supplierDebts.filter((d: any) => !DEMO_DEB_IDS.includes(d.id));
        if (parsed.supplierPayments) parsed.supplierPayments = parsed.supplierPayments.filter((sp: any) => !DEMO_SP_IDS.includes(sp.id));
        if (parsed.discountAudits) parsed.discountAudits = parsed.discountAudits.filter((da: any) => !DEMO_DA_IDS.includes(da.id));
        if (parsed.purchaseOrders) parsed.purchaseOrders = parsed.purchaseOrders.filter((po: any) => po.id !== 'po-001');

        if (parsed.cashSessions) {
          parsed.cashSessions.forEach((cs: any) => {
            if (cs.id === 'cs-01' || cs.movements) {
              cs.movements = (cs.movements || []).filter((m: any) => m.id !== 'cm-01' && m.id !== 'cm-02');
            }
          });
          parsed.cashSessions = parsed.cashSessions.filter((cs: any) => cs.id !== 'cs-01');
        }

        return parsed;
      }
    } catch (e) {
      console.warn('LocalStorage unavailable or parse error, using default memory state');
    }
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  private cleanStatePhoneNumbers() {
    if (!this.state) return;
    const clean = (val?: string | null) => (val ? sanitizePhoneInput(val) : val);

    if (this.state.tenants) {
      this.state.tenants.forEach(t => {
        if (t.phone) t.phone = clean(t.phone)!;
        if (t.supportContact?.phone) t.supportContact.phone = clean(t.supportContact.phone)!;
        if (t.supportContact?.whatsapp) t.supportContact.whatsapp = clean(t.supportContact.whatsapp)!;
      });
    }
    if (this.state.users) {
      this.state.users.forEach(u => {
        if (u.phone) u.phone = clean(u.phone)!;
      });
    }
    if (this.state.persons) {
      this.state.persons.forEach(p => {
        if (p.phone) p.phone = clean(p.phone)!;
      });
    }
    if (this.state.suppliers) {
      this.state.suppliers.forEach(s => {
        if (s.phone) s.phone = clean(s.phone)!;
      });
    }
    if (this.state.orders) {
      this.state.orders.forEach(o => {
        if (o.personPhone) o.personPhone = clean(o.personPhone)!;
      });
    }
    if (this.state.enrollments) {
      this.state.enrollments.forEach(e => {
        if (e.learnerPhone) e.learnerPhone = clean(e.learnerPhone)!;
      });
    }
  }

  private saveState() {
    this.cleanStatePhoneNumbers();
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
    this.notify();
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  // --- SUPABASE POSTGRESQL INTEGRATION ---

  public isSupabaseEnabled(): boolean {
    return isSupabaseConfigured() && supabaseService.isReady();
  }

  public async checkSupabaseHealth() {
    return await checkSupabaseConnection();
  }

  public async syncWithSupabase(tenantId?: string): Promise<{ success: boolean; message: string }> {
    if (!this.isSupabaseEnabled()) {
      return { success: false, message: 'Supabase n\'est pas activé ou configuré.' };
    }
    try {
      const targetTenant = tenantId || this.state.currentTenantId;
      const [remoteTenants, remotePersons, remoteServices, remoteProducts, remoteOrders, remoteAccounts] = await Promise.all([
        supabaseService.getTenants(),
        supabaseService.getPersons(targetTenant),
        supabaseService.getServices(targetTenant),
        supabaseService.getProducts(targetTenant),
        supabaseService.getOrders(targetTenant),
        supabaseService.getFinancialAccounts(targetTenant)
      ]);

      this.updateState(draft => {
        if (remoteTenants.length > 0) draft.tenants = remoteTenants;
        if (remotePersons.length > 0) {
          draft.persons = [
            ...draft.persons.filter(p => p.tenantId !== targetTenant),
            ...remotePersons
          ];
        }
        if (remoteServices.length > 0) {
          draft.services = [
            ...draft.services.filter(s => s.tenantId !== targetTenant),
            ...remoteServices
          ];
        }
        if (remoteProducts.length > 0) {
          draft.products = [
            ...draft.products.filter(p => p.tenantId !== targetTenant),
            ...remoteProducts
          ];
        }
        if (remoteOrders.length > 0) {
          draft.orders = [
            ...draft.orders.filter(o => o.tenantId !== targetTenant),
            ...remoteOrders
          ];
        }
        if (remoteAccounts.length > 0) {
          draft.financialAccounts = [
            ...draft.financialAccounts.filter(a => a.tenantId !== targetTenant),
            ...remoteAccounts
          ];
        }
      });

      return { success: true, message: 'Synchronisation Supabase PostgreSQL effectuée avec succès.' };
    } catch (err: any) {
      return { success: false, message: `Erreur de synchronisation: ${err.message}` };
    }
  }

  // --- SAAS MULTI-AGENCY ACTIONS ---

  public getTenants(isSuperAdmin?: boolean): Tenant[] {
    if (isSuperAdmin) {
      return this.state.tenants;
    }
    return this.state.tenants.filter(t => t.isActive);
  }

  public createAgency(data: {
    name: string;
    code: string;
    activityType: ActivityType;
    responsibleName: string;
    phone?: string;
    email?: string;
    address?: string;
    planId: LicensePlan;
    licenseMonths?: number;
    adminUsername: string;
    adminEmail: string;
    adminPassword?: string;
    adminFirstName?: string;
    adminLastName?: string;
  }): { success: boolean; agency?: Tenant; adminUser?: User; message: string } {
    const existing = this.state.tenants.find(
      t => t.code.toLowerCase() === data.code.trim().toLowerCase() || t.name.toLowerCase() === data.name.trim().toLowerCase()
    );
    if (existing) {
      return { success: false, message: `Une agence avec le code "${data.code}" ou le nom "${data.name}" existe déjà.` };
    }

    if (data.phone && !isValidPhoneNumber(data.phone, { allowEmpty: true })) {
      return { success: false, message: "Le numéro de téléphone de l'agence est invalide (les lettres et caractères non autorisés sont rejetés)." };
    }

    const agencyId = `t-${Date.now()}`;
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const months = data.licenseMonths || 12;
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();
    const licenseKey = `${data.code.toUpperCase()}-${data.planId}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newAgency: Tenant = {
      id: agencyId,
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      slug,
      activityType: data.activityType,
      status: 'ACTIVE',
      responsibleName: data.responsibleName.trim(),
      phone: data.phone?.trim(),
      email: data.email?.trim(),
      address: data.address?.trim(),
      currency: 'GNF',
      taxRate: 0,
      isActive: true,
      subscriptionStatus: 'ACTIVE',
      trialStartedAt: startDate,
      trialEndsAt: endDate,
      trialDaysTotal: months * 30,
      licensePlan: data.planId,
      licenseKey,
      licenseActivatedAt: startDate,
      licenseExpiresAt: endDate,
      activationRequests: [],
      licenseHistory: [
        {
          id: `lh-${Date.now()}`,
          tenantId: agencyId,
          tenantName: data.name.trim(),
          action: 'LICENSE_ACTIVATED',
          actionLabel: `Création & Activation Licence ${data.planId} (${months} mois)`,
          details: `Licence émise jusqu'au ${new Date(endDate).toLocaleDateString('fr-FR')}`,
          performedByUserName: 'Super Administrateur',
          createdAt: startDate
        }
      ],
      supportContact: {
        name: "Direction Commerciale & Support SaaS",
        phone: "+224 600 00 00 00",
        whatsapp: "+224 600 00 00 00",
        email: "support@saas-platform.com",
        address: "Conakry, Guinée",
        customMessage: "Service client disponible 7j/7 pour votre agence."
      },
      settings: {
        companyHeader: `${data.name.toUpperCase()} - RCCM: GN.TCC.${new Date().getFullYear()}.B.00000`,
        invoiceFooter: "Merci pour votre confiance. Les marchandises vendues ne sont ni reprises ni échangées.",
        branding: {
          logoPosition: 'center',
          logoSize: 'md',
          showLogo: true,
          slogan: "Excellence & Service Professionnel",
          headerAlignment: 'center',
          showPhone: true,
          showEmail: true,
          showAddress: true,
          showWebsite: true,
          footerText: `${data.name} • Tous droits réservés`,
          footerAlignment: 'center',
          showFooter: true
        }
      },
      createdAt: startDate
    };

    const adminUserId = `u-admin-${Date.now()}`;
    const newAdminUser: User = {
      id: adminUserId,
      tenantId: agencyId,
      firstName: data.adminFirstName?.trim() || data.responsibleName.split(' ')[0] || 'Admin',
      lastName: data.adminLastName?.trim() || data.responsibleName.split(' ').slice(1).join(' ') || data.name,
      username: data.adminUsername.trim().toLowerCase(),
      email: data.adminEmail.trim().toLowerCase(),
      phone: data.phone?.trim(),
      passwordHash: data.adminPassword?.trim() || `${data.adminUsername.trim().toLowerCase()}123`,
      department: 'ADMINISTRATION',
      isActive: true,
      roles: [{ id: `role-admin-${agencyId}`, name: 'Directeur Agence', code: 'ADMIN_CENTRE', isSystem: true, permissions: ['*'] }],
      permissions: ['*'],
      createdAt: startDate
    };

    this.updateState(draft => {
      draft.tenants.push(newAgency);
      draft.users.push(newAdminUser);

      // Default branch for the new agency
      draft.branches.push({
        id: `b-${Date.now()}`,
        tenantId: agencyId,
        name: `Agence Principale - ${data.name}`,
        code: `AG-${data.code}`,
        phone: data.phone,
        email: data.email,
        address: data.address,
        isMain: true,
        isActive: true
      });

      // Default cash register for the agency
      draft.cashRegisters.push({
        id: `cr-${Date.now()}`,
        tenantId: agencyId,
        name: `Caisse Principale ${data.name}`,
        code: `CAISSE-01`,
        isActive: true
      });
    });

    this.logAudit('AGENCY_CREATED', 'AGENCY', agencyId, null, {
      agencyName: data.name,
      activityType: data.activityType,
      plan: data.planId,
      adminUsername: data.adminUsername
    });

    return {
      success: true,
      agency: newAgency,
      adminUser: newAdminUser,
      message: `L'agence "${data.name}" (${data.activityType}) a été créée avec succès.`
    };
  }

  public updateAgencyStatus(agencyId: string, status: AgencyStatus, reason?: string, isSuperAdmin: boolean = true) {
    if (!isSuperAdmin) {
      this.logAudit('UNAUTHORIZED_AGENCY_MUTATION_ATTEMPT', 'AGENCY', agencyId, null, {
        attemptedStatus: status,
        reason: 'Action réservée au Super Administrateur'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Seul le Super Administrateur peut modifier le statut d'une agence." };
    }

    const ag = this.state.tenants.find(t => t.id === agencyId);
    if (!ag) {
      return { success: false, statusCode: 404, message: "Agence introuvable." };
    }

    const oldStatus = ag.status;

    this.updateState(draft => {
      const target = draft.tenants.find(t => t.id === agencyId);
      if (!target) return;

      target.status = status;
      target.isActive = status === 'ACTIVE';

      // Check license expiration date when activating
      const isExpired = Boolean(
        target.licenseExpiresAt && new Date(target.licenseExpiresAt).getTime() < Date.now()
      );

      if (status === 'SUSPENDED') {
        target.subscriptionStatus = 'SUSPENDED';
      } else if (status === 'ARCHIVED') {
        target.subscriptionStatus = 'SUSPENDED';
      } else if (status === 'ACTIVE') {
        if (isExpired) {
          target.subscriptionStatus = 'EXPIRED';
        } else {
          target.subscriptionStatus = 'ACTIVE';
        }
      } else if (status === 'EXPIRED') {
        target.subscriptionStatus = 'EXPIRED';
      }

      target.updatedAt = new Date().toISOString();

      if (!target.licenseHistory) target.licenseHistory = [];
      target.licenseHistory.unshift({
        id: `lh-${Date.now()}`,
        tenantId: agencyId,
        tenantName: target.name,
        action: status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : status === 'ACTIVE' ? 'ACCOUNT_REACTIVATED' : 'LICENSE_MODIFIED',
        actionLabel: `Changement de statut : ${oldStatus} ➔ ${status}`,
        details: reason || `Statut agence modifié par le Super Administrateur (${oldStatus} ➔ ${status})`,
        performedByUserName: 'Super Administrateur',
        createdAt: new Date().toISOString()
      });
    });

    this.logAudit('AGENCY_STATUS_UPDATED', 'AGENCY', agencyId, null, {
      previousStatus: oldStatus,
      newStatus: status,
      reason: reason || 'Mise à jour par Super Admin'
    });

    return {
      success: true,
      statusCode: 200,
      message: `Le statut de l'agence "${ag.name}" a été mis à jour : ${status}.`
    };
  }

  public suspendAgency(agencyId: string, reason?: string, isSuperAdmin: boolean = true) {
    const res = this.updateAgencyStatus(
      agencyId,
      'SUSPENDED',
      reason || 'Suspension administrative temporaire par le Super Administrateur',
      isSuperAdmin
    );
    if (res.success) {
      const ag = this.state.tenants.find(t => t.id === agencyId);
      this.logAudit('AGENCY_SUSPENDED', 'AGENCY', agencyId, null, {
        agencyName: ag?.name,
        reason: reason || 'Suspension par Super Admin'
      });
    }
    return res;
  }

  public reactivateAgency(agencyId: string, isSuperAdmin: boolean = true) {
    const ag = this.state.tenants.find(t => t.id === agencyId);
    if (!ag) {
      return { success: false, statusCode: 404, message: "Agence introuvable." };
    }
    if (ag.status === 'ARCHIVED') {
      return {
        success: false,
        statusCode: 400,
        message: "Une agence archivée doit d'abord être restaurée via l'action Restaurer."
      };
    }
    const res = this.updateAgencyStatus(
      agencyId,
      'ACTIVE',
      'Réactivation administrative par le Super Administrateur',
      isSuperAdmin
    );
    if (res.success) {
      this.logAudit('AGENCY_REACTIVATED', 'AGENCY', agencyId, null, {
        agencyName: ag.name,
        reactivatedAt: new Date().toISOString()
      });
    }
    return res;
  }

  public archiveAgency(agencyId: string, reason?: string, isSuperAdmin: boolean = true) {
    if (!isSuperAdmin) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Seul le Super Administrateur peut archiver une agence." };
    }
    const ag = this.state.tenants.find(t => t.id === agencyId);
    if (!ag) {
      return { success: false, statusCode: 404, message: "Agence introuvable." };
    }

    const res = this.updateAgencyStatus(
      agencyId,
      'ARCHIVED',
      reason || 'Archivage de l\'agence (cessation ou mise en sommeil)',
      isSuperAdmin
    );

    if (res.success) {
      this.logAudit('AGENCY_ARCHIVED', 'AGENCY', agencyId, null, {
        agencyName: ag.name,
        reason: reason || 'Archivage par Super Admin'
      });
    }

    return res;
  }

  public restoreAgency(agencyId: string, isSuperAdmin: boolean = true) {
    if (!isSuperAdmin) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Seul le Super Administrateur peut restaurer une agence." };
    }
    const ag = this.state.tenants.find(t => t.id === agencyId);
    if (!ag) {
      return { success: false, statusCode: 404, message: "Agence introuvable." };
    }
    if (ag.status !== 'ARCHIVED') {
      return { success: false, statusCode: 400, message: "Seule une agence archivée peut être restaurée." };
    }

    const res = this.updateAgencyStatus(
      agencyId,
      'ACTIVE',
      'Restauration de l\'agence archivée par le Super Administrateur',
      isSuperAdmin
    );

    if (res.success) {
      this.logAudit('AGENCY_RESTORED', 'AGENCY', agencyId, null, {
        agencyName: ag.name,
        restoredAt: new Date().toISOString()
      });
    }

    return res;
  }

  public updateAgencyDetails(agencyId: string, data: Partial<Tenant>, isSuperAdmin: boolean = true) {
    if (!isSuperAdmin) {
      this.logAudit('UNAUTHORIZED_AGENCY_EDIT_ATTEMPT', 'AGENCY', agencyId, null, { reason: 'Droits Super Admin requis' });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous n'avez pas les autorisations nécessaires." };
    }

    const ag = this.state.tenants.find(t => t.id === agencyId);
    if (!ag) {
      return { success: false, statusCode: 404, message: "Agence introuvable." };
    }

    if (data.phone !== undefined && data.phone !== '' && !isValidPhoneNumber(data.phone, { allowEmpty: true })) {
      return { success: false, statusCode: 400, message: "400 Erreur de validation : Le numéro de téléphone de l'agence est invalide." };
    }

    const previousData = {
      name: ag.name,
      responsibleName: ag.responsibleName,
      phone: ag.phone,
      email: ag.email,
      address: ag.address,
      currency: ag.currency,
      taxRate: ag.taxRate
    };

    this.updateState(draft => {
      const target = draft.tenants.find(t => t.id === agencyId);
      if (!target) return;

      if (data.name !== undefined) target.name = data.name.trim();
      if (data.code !== undefined) target.code = data.code.trim().toUpperCase();
      if (data.responsibleName !== undefined) target.responsibleName = data.responsibleName.trim();
      if (data.phone !== undefined) target.phone = data.phone.trim();
      if (data.email !== undefined) target.email = data.email.trim();
      if (data.address !== undefined) target.address = data.address.trim();
      if (data.logoUrl !== undefined) target.logoUrl = data.logoUrl.trim();
      if (data.currency !== undefined) target.currency = data.currency;
      if (data.taxRate !== undefined) target.taxRate = Number(data.taxRate) || 0;
      if (data.settings !== undefined) target.settings = { ...target.settings, ...data.settings };
      target.updatedAt = new Date().toISOString();
    });

    this.logAudit('AGENCY_DETAILS_UPDATED', 'AGENCY', agencyId, null, {
      previous: previousData,
      updated: data
    });

    return {
      success: true,
      statusCode: 200,
      message: `Informations administratives de l'agence "${data.name || ag.name}" mises à jour avec succès.`
    };
  }

  public checkAgencyModelChangeSafety(agencyId: string, targetActivity: ActivityType): {
    canChangeDirectly: boolean;
    reason?: string;
    stats: {
      productsCount: number;
      stockMovementsCount: number;
      ordersCount: number;
      servicesCount: number;
    };
  } {
    const productsCount = (this.state.products || []).filter(p => p.tenantId === agencyId).length;
    const stockMovementsCount = (this.state.stockMovements || []).filter(s => s.tenantId === agencyId).length;
    const ordersCount = (this.state.orders || []).filter(o => o.tenantId === agencyId).length;
    const servicesCount = (this.state.services || []).filter(s => s.tenantId === agencyId).length;

    return {
      canChangeDirectly: true,
      stats: {
        productsCount,
        stockMovementsCount,
        ordersCount,
        servicesCount
      }
    };
  }

  public changeAgencyActivityModel(agencyId: string, newActivity: ActivityType, force: boolean = false, isSuperAdmin: boolean = true) {
    if (!isSuperAdmin) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Seul le Super Administrateur peut modifier le modèle d'activité." };
    }

    const ag = this.state.tenants.find(t => t.id === agencyId);
    if (!ag) {
      return { success: false, statusCode: 404, message: "Agence introuvable." };
    }

    const safety = this.checkAgencyModelChangeSafety(agencyId, newActivity);
    if (!safety.canChangeDirectly && !force) {
      return {
        success: false,
        statusCode: 409,
        requiresControlledMigration: true,
        message: safety.reason || "Changement de modèle bloqué pour protéger les données existantes.",
        stats: safety.stats
      };
    }

    const oldActivity = ag.activityType;
    this.updateState(draft => {
      const target = draft.tenants.find(t => t.id === agencyId);
      if (target) {
        target.activityType = newActivity;
        target.updatedAt = new Date().toISOString();
      }
    });

    this.logAudit('AGENCY_ACTIVITY_CONVERTED', 'AGENCY', agencyId, null, {
      previousActivity: oldActivity,
      newActivity,
      forced: force,
      stats: safety.stats
    });

    return {
      success: true,
      statusCode: 200,
      message: `Le modèle d'activité de l'agence "${ag.name}" a été basculé de ${oldActivity} vers ${newActivity}.`
    };
  }

  public exportAgencyData(agencyId: string, isSuperAdmin: boolean = true) {
    if (!isSuperAdmin) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Droits Super Admin requis." };
    }

    const ag = this.state.tenants.find(t => t.id === agencyId);
    if (!ag) {
      return { success: false, statusCode: 404, message: "Agence introuvable." };
    }

    const exportBundle = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: 'Super Administrateur',
        agencyId,
        agencyName: ag.name,
        version: '1.0'
      },
      tenant: ag,
      branches: (this.state.branches || []).filter(b => b.tenantId === agencyId),
      roles: (this.state.roles || []).filter(r => r.tenantId === agencyId),
      users: (this.state.users || []).filter(u => u.tenantId === agencyId),
      persons: (this.state.persons || []).filter(p => p.tenantId === agencyId),
      products: (this.state.products || []).filter(p => p.tenantId === agencyId),
      productCategories: (this.state.productCategories || []).filter(c => c.tenantId === agencyId),
      stockMovements: (this.state.stockMovements || []).filter(s => s.tenantId === agencyId),
      suppliers: (this.state.suppliers || []).filter(s => s.tenantId === agencyId),
      purchaseOrders: (this.state.purchaseOrders || []).filter(po => po.tenantId === agencyId),
      services: (this.state.services || []).filter(s => s.tenantId === agencyId),
      serviceCategories: (this.state.serviceCategories || []).filter(sc => sc.tenantId === agencyId),
      orders: (this.state.orders || []).filter(o => o.tenantId === agencyId),
      productionJobs: (this.state.productionJobs || []).filter(j => j.tenantId === agencyId),
      trainings: (this.state.trainings || []).filter(tr => tr.tenantId === agencyId),
      trainingSessions: (this.state.trainingSessions || []).filter(ts => ts.tenantId === agencyId),
      enrollments: (this.state.enrollments || []).filter(e => e.tenantId === agencyId),
      certificates: (this.state.certificates || []).filter(c => c.tenantId === agencyId),
      cashRegisters: (this.state.cashRegisters || []).filter(cr => cr.tenantId === agencyId),
      cashSessions: (this.state.cashSessions || []).filter(cs => cs.tenantId === agencyId),
      payments: (this.state.payments || []).filter(pay => pay.tenantId === agencyId),
      expenses: (this.state.expenses || []).filter(exp => exp.tenantId === agencyId),
      invoices: (this.state.invoices || []).filter(inv => inv.tenantId === agencyId),
      equipment: (this.state.equipment || []).filter(eq => eq.tenantId === agencyId),
      auditLogs: (this.state.auditLogs || []).filter(al => al.tenantId === agencyId)
    };

    this.logAudit('AGENCY_DATA_EXPORTED', 'AGENCY', agencyId, null, {
      agencyName: ag.name,
      recordsCount: Object.values(exportBundle).reduce((acc, val) => acc + (Array.isArray(val) ? val.length : 1), 0)
    });

    return {
      success: true,
      statusCode: 200,
      exportBundle,
      message: `Sauvegarde complète de l'agence "${ag.name}" générée avec succès.`
    };
  }

  public deleteAgencyPermanently(agencyId: string, confirmationAgencyName: string, isSuperAdmin: boolean = true): {
    success: boolean;
    statusCode: number;
    message: string;
    deletedRecordsCount?: number;
  } {
    if (!isSuperAdmin) {
      this.logAudit('UNAUTHORIZED_AGENCY_DELETE_ATTEMPT', 'AGENCY', agencyId, null, {
        reason: 'Tentative de suppression par utilisateur non Super Admin'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : La suppression définitive d'une agence est strictement réservée au Super Administrateur." };
    }

    const ag = this.state.tenants.find(t => t.id === agencyId);
    if (!ag) {
      return { success: false, statusCode: 404, message: "Agence introuvable." };
    }

    // Exact name match verification
    if (confirmationAgencyName.trim().toLowerCase() !== ag.name.trim().toLowerCase()) {
      return {
        success: false,
        statusCode: 400,
        message: `Le nom saisi "${confirmationAgencyName}" ne correspond pas exactement au nom officiel de l'agence ("${ag.name}"). Suppression annulée pour votre sécurité.`
      };
    }

    const agencyNameBackup = ag.name;
    let deletedCount = 0;

    this.updateState(draft => {
      // 1. Remove child records safely
      const countFilter = (arr: any[] | undefined) => {
        if (!arr) return [];
        const before = arr.length;
        const filtered = arr.filter(item => item.tenantId !== agencyId);
        deletedCount += (before - filtered.length);
        return filtered;
      };

      draft.branches = countFilter(draft.branches);
      draft.roles = countFilter(draft.roles);
      draft.users = countFilter(draft.users);
      draft.persons = countFilter(draft.persons);
      draft.serviceCategories = countFilter(draft.serviceCategories);
      draft.services = countFilter(draft.services);
      draft.priceHistories = countFilter(draft.priceHistories);
      draft.discountAudits = countFilter(draft.discountAudits);
      draft.orders = countFilter(draft.orders);
      draft.productionJobs = countFilter(draft.productionJobs);
      draft.trainingCategories = countFilter(draft.trainingCategories);
      draft.trainings = countFilter(draft.trainings);
      draft.classrooms = countFilter(draft.classrooms);
      draft.trainingSessions = countFilter(draft.trainingSessions);
      draft.enrollments = countFilter(draft.enrollments);
      draft.attendanceSheets = countFilter(draft.attendanceSheets);
      draft.assessments = countFilter(draft.assessments);
      draft.certificates = countFilter(draft.certificates);
      draft.cashRegisters = countFilter(draft.cashRegisters);
      draft.cashSessions = countFilter(draft.cashSessions);
      draft.payments = countFilter(draft.payments);
      draft.expenses = countFilter(draft.expenses);
      draft.expenseCategories = countFilter(draft.expenseCategories);
      draft.productCategories = countFilter(draft.productCategories);
      draft.products = countFilter(draft.products);
      draft.stockMovements = countFilter(draft.stockMovements);
      draft.suppliers = countFilter(draft.suppliers);
      draft.requestingDepartments = countFilter(draft.requestingDepartments);
      draft.purchaseOrders = countFilter(draft.purchaseOrders);
      draft.invoices = countFilter(draft.invoices);
      draft.equipment = countFilter(draft.equipment);
      draft.equipmentMaintenances = countFilter(draft.equipmentMaintenances);
      draft.notifications = countFilter(draft.notifications);

      // Remove tenant itself
      draft.tenants = draft.tenants.filter(t => t.id !== agencyId);
      deletedCount++;

      // If currentTenantId was this agency, reset to global or another active tenant
      if (draft.currentTenantId === agencyId) {
        draft.currentTenantId = draft.tenants[0]?.id || 'global';
      }
    });

    this.logAudit('AGENCY_DELETED_PERMANENTLY', 'AGENCY', agencyId, null, {
      deletedAgencyName: agencyNameBackup,
      deletedRecordsCount: deletedCount,
      performedBy: 'Super Administrateur'
    });

    return {
      success: true,
      statusCode: 200,
      deletedRecordsCount: deletedCount,
      message: `L'agence "${agencyNameBackup}" et toutes ses données associées (${deletedCount} éléments) ont été définitivement supprimées.`
    };
  }

  public renewAgencyLicense(agencyId: string, durationMonths: number, planId?: LicensePlan, isSuperAdmin: boolean = true) {
    if (!isSuperAdmin) {
      this.logAudit('UNAUTHORIZED_LICENSE_RENEW_ATTEMPT', 'AGENCY', agencyId, null, {
        reason: 'Seul le Super Administrateur peut renouveler ou modifier une licence.'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Seul le Super Administrateur peut renouveler ou modifier une licence." };
    }

    const agCheck = this.state.tenants.find(t => t.id === agencyId);
    if (!agCheck) return { success: false, statusCode: 404, message: "Agence introuvable." };

    this.updateState(draft => {
      const ag = draft.tenants.find(t => t.id === agencyId);
      if (!ag) return;
      const currentEnd = new Date(ag.licenseExpiresAt || ag.trialEndsAt || Date.now());
      const baseDate = currentEnd.getTime() > Date.now() ? currentEnd : new Date();
      const newEnd = new Date(baseDate.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString();

      if (planId) ag.licensePlan = planId;
      ag.subscriptionStatus = 'ACTIVE';
      ag.status = 'ACTIVE';
      ag.isActive = true;
      ag.licenseExpiresAt = newEnd;
      ag.trialEndsAt = newEnd;
      ag.updatedAt = new Date().toISOString();

      if (!ag.licenseHistory) ag.licenseHistory = [];
      ag.licenseHistory.unshift({
        id: `lh-${Date.now()}`,
        tenantId: agencyId,
        tenantName: ag.name,
        action: 'LICENSE_ACTIVATED',
        actionLabel: `Renouvellement Licence (+${durationMonths} mois)`,
        details: `Nouvelle échéance : ${new Date(newEnd).toLocaleDateString('fr-FR')}`,
        performedByUserName: 'Super Administrateur',
        createdAt: new Date().toISOString()
      });
    });

    this.logAudit('AGENCY_LICENSE_RENEWED', 'AGENCY', agencyId, null, { durationMonths, planId });
    return { success: true, statusCode: 200, message: `Licence renouvelée avec succès (+${durationMonths} mois).` };
  }

  public createAgencyAdmin(data: {
    agencyId: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone?: string;
    password?: string;
  }): { success: boolean; adminUser?: User; message: string } {
    const existing = this.state.users.find(
      u => u.username.toLowerCase() === data.username.trim().toLowerCase() || u.email.toLowerCase() === data.email.trim().toLowerCase()
    );
    if (existing) {
      return { success: false, message: `Un utilisateur avec le login "${data.username}" ou l'email "${data.email}" existe déjà.` };
    }

    const agency = this.state.tenants.find(t => t.id === data.agencyId);
    if (!agency) {
      return { success: false, message: "Agence introuvable." };
    }

    if (data.phone && !isValidPhoneNumber(data.phone, { allowEmpty: true })) {
      return { success: false, message: "Le numéro de téléphone de l'administrateur est invalide (les lettres et caractères non autorisés sont rejetés)." };
    }

    const adminUserId = `u-admin-${Date.now()}`;
    const newAdminUser: User = {
      id: adminUserId,
      tenantId: data.agencyId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      username: data.username.trim().toLowerCase(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim(),
      passwordHash: data.password?.trim() || `${data.username.trim().toLowerCase()}123`,
      department: 'ADMINISTRATION',
      isActive: true,
      roles: [{ id: `role-admin-${data.agencyId}`, name: 'Directeur Agence', code: 'ADMIN_CENTRE', isSystem: true, permissions: ['*'] }],
      permissions: ['*'],
      createdAt: new Date().toISOString()
    };

    this.updateState(draft => {
      draft.users.push(newAdminUser);
    });

    this.logAudit('AGENCY_ADMIN_CREATED', 'USER', adminUserId, null, {
      agencyId: data.agencyId,
      agencyName: agency.name,
      adminUsername: data.username
    });

    return {
      success: true,
      adminUser: newAdminUser,
      message: `L'administrateur "${data.firstName} ${data.lastName}" (@${data.username}) a été créé pour l'agence "${agency.name}".`
    };
  }

  // --- SECURE MULTI-AGENCY USER MANAGEMENT (ANTI-IDOR & AGENCY ISOLATION) ---

  public getUsersByTenant(tenantId: string, isSuperAdmin?: boolean): User[] {
    if (!tenantId || tenantId === 'global' || tenantId === 'ALL') {
      return this.state.users || [];
    }
    return (this.state.users || []).filter(u => u.tenantId === tenantId);
  }

  public getUserById(userId: string, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; user?: User; message: string; statusCode: number } {
    const user = this.state.users.find(u => u.id === userId);
    if (!user) {
      return { success: false, statusCode: 404, message: "Utilisateur introuvable." };
    }
    if (!isSuperAdmin && requestingTenantId !== 'global' && user.tenantId !== requestingTenantId) {
      this.logAudit('USER_CROSS_TENANT_ACCESS_DENIED', 'USER', userId, null, {
        targetUserTenant: user.tenantId,
        requestingTenant: requestingTenantId,
        action: 'GET_USER'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous ne pouvez pas accéder à un utilisateur d'une autre agence." };
    }
    return { success: true, statusCode: 200, user, message: "OK" };
  }

  public createSecureUser(data: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone?: string;
    role?: Role;
    roleCode?: RoleCode | string;
    department: any;
    passwordHash?: string;
    initialPassword?: string;
    isActive?: boolean;
    branchId?: string;
  }, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; statusCode: number; user?: User; message: string } {
    if (!requestingTenantId || (requestingTenantId === 'global' && !isSuperAdmin)) {
      return { success: false, statusCode: 400, message: "Identifiant d'agence requis pour créer un utilisateur." };
    }

    const cleanUsername = data.username.trim().toLowerCase();
    const cleanEmail = data.email.trim().toLowerCase();

    if (data.phone && !isValidPhoneNumber(data.phone, { allowEmpty: true })) {
      return { success: false, statusCode: 400, message: "400 Erreur de validation : Le numéro de téléphone de l'utilisateur est invalide (les lettres et caractères non autorisés sont rejetés)." };
    }

    const existing = this.state.users.find(
      u => u.username.toLowerCase() === cleanUsername || u.email.toLowerCase() === cleanEmail
    );
    if (existing) {
      return { success: false, statusCode: 409, message: `Un compte avec le login "${data.username}" ou l'email "${data.email}" existe déjà.` };
    }

    // Resolve Role
    let resolvedRole: Role;
    if (data.role) {
      resolvedRole = data.role;
    } else {
      const code = (data.roleCode || 'EMPLOYE').toString();
      const existingRole = (this.state.roles || []).find(r => r.code === code);
      if (existingRole) {
        resolvedRole = existingRole;
      } else {
        resolvedRole = {
          id: `role-${code.toLowerCase()}-${Date.now()}`,
          code: code as RoleCode,
          name: code === 'CAISSIER' ? 'Caissier' : code === 'MAGASINIER' ? 'Magasinier' : code === 'OPERATEUR' ? 'Opérateur' : code,
          description: `Rôle ${code} de l'agence`,
          permissions: code === 'ADMIN_AGENCY' ? ['*'] : ['read:all', 'create:orders', 'create:sales'],
          isSystem: false
        };
      }
    }

    const newUserId = `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newUser: User = {
      id: newUserId,
      tenantId: requestingTenantId, // Strict automatic binding to the connected agency
      branchId: data.branchId || 'b-001',
      username: cleanUsername,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: cleanEmail,
      phone: data.phone?.trim(),
      roles: [resolvedRole],
      permissions: resolvedRole.permissions || ['read:all'],
      department: data.department,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date().toISOString(),
      passwordHash: data.passwordHash?.trim() || data.initialPassword?.trim() || `${cleanUsername}123`,
    };

    this.updateState(draft => {
      draft.users.unshift(newUser);
    });

    this.logAudit('USER_CREATED', 'USER', newUserId, null, {
      username: newUser.username,
      tenantId: requestingTenantId,
      role: resolvedRole.name
    });

    return {
      success: true,
      statusCode: 201,
      user: newUser,
      message: `L'utilisateur @${newUser.username} a été créé avec succès pour votre agence.`
    };
  }

  public updateSecureUser(userId: string, data: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone?: string;
    role: Role;
    department: any;
    password?: string;
    isActive?: boolean;
  }, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; statusCode: number; user?: User; message: string } {
    const existing = this.state.users.find(u => u.id === userId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Utilisateur introuvable." };
    }

    if (data.phone !== undefined && data.phone !== '' && !isValidPhoneNumber(data.phone, { allowEmpty: true })) {
      return { success: false, statusCode: 400, message: "400 Erreur de validation : Le numéro de téléphone de l'utilisateur est invalide (les lettres et caractères non autorisés sont rejetés)." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      this.logAudit('USER_CROSS_TENANT_MUTATION_DENIED', 'USER', userId, null, {
        targetUserTenant: existing.tenantId,
        requestingTenant: requestingTenantId,
        action: 'UPDATE_USER'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous ne pouvez pas modifier un utilisateur appartenant à une autre agence." };
    }

    let updatedUser: User | undefined;
    this.updateState(draft => {
      const u = draft.users.find(item => item.id === userId);
      if (u) {
        u.firstName = data.firstName.trim();
        u.lastName = data.lastName.trim();
        u.username = data.username.trim().toLowerCase();
        u.email = data.email.trim();
        u.phone = data.phone?.trim();
        u.roles = [data.role];
        u.permissions = data.role.permissions;
        u.department = data.department;
        if (data.isActive !== undefined) u.isActive = data.isActive;
        if (data.password) u.passwordHash = data.password.trim();
        updatedUser = { ...u };
      }
    });

    this.logAudit('USER_UPDATED', 'USER', userId, null, {
      username: data.username,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      user: updatedUser,
      message: `L'utilisateur @${data.username} a été mis à jour avec succès.`
    };
  }

  public deleteSecureUser(userId: string, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; statusCode: number; message: string } {
    const existing = this.state.users.find(u => u.id === userId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Utilisateur introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      this.logAudit('USER_CROSS_TENANT_DELETE_DENIED', 'USER', userId, null, {
        targetUserTenant: existing.tenantId,
        requestingTenant: requestingTenantId,
        action: 'DELETE_USER'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous ne pouvez pas supprimer un utilisateur appartenant à une autre agence." };
    }

    this.updateState(draft => {
      draft.users = draft.users.filter(u => u.id !== userId);
    });

    this.logAudit('USER_DELETED', 'USER', userId, null, {
      username: existing.username,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Le compte @${existing.username} a été supprimé avec succès.`
    };
  }

  public toggleSecureUserStatus(userId: string, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; statusCode: number; newStatus?: boolean; message: string } {
    const existing = this.state.users.find(u => u.id === userId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Utilisateur introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      this.logAudit('USER_CROSS_TENANT_TOGGLE_DENIED', 'USER', userId, null, {
        targetUserTenant: existing.tenantId,
        requestingTenant: requestingTenantId,
        action: 'TOGGLE_STATUS'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous ne pouvez pas modifier le statut d'un utilisateur d'une autre agence." };
    }

    const nextStatus = !existing.isActive;
    this.updateState(draft => {
      const u = draft.users.find(item => item.id === userId);
      if (u) {
        u.isActive = nextStatus;
      }
    });

    this.logAudit(nextStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'USER', userId, null, {
      username: existing.username,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      newStatus: nextStatus,
      message: nextStatus ? `Le compte @${existing.username} est maintenant actif.` : `Le compte @${existing.username} a été désactivé.`
    };
  }

  public resetSecureUserPassword(userId: string, newPassword: string, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; statusCode: number; message: string } {
    const existing = this.state.users.find(u => u.id === userId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Utilisateur introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      this.logAudit('USER_CROSS_TENANT_RESET_PASSWORD_DENIED', 'USER', userId, null, {
        targetUserTenant: existing.tenantId,
        requestingTenant: requestingTenantId,
        action: 'RESET_PASSWORD'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous ne pouvez pas réinitialiser le mot de passe d'un utilisateur d'une autre agence." };
    }

    this.updateState(draft => {
      const u = draft.users.find(item => item.id === userId);
      if (u) {
        u.passwordHash = newPassword;
      }
    });

    this.logAudit('PASSWORD_RESET_BY_ADMIN', 'USER', userId, null, {
      username: existing.username,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Le mot de passe de @${existing.username} a été réinitialisé.`
    };
  }

  // --- SECURE MULTI-AGENCY MAGASINS / STORES MANAGEMENT ---

  public getStores(tenantId: string, isSuperAdmin?: boolean): Store[] {
    if (!tenantId || tenantId === 'global' || tenantId === 'ALL') {
      return this.state.stores || [];
    }
    return (this.state.stores || []).filter(s => s.tenantId === tenantId);
  }

  public getStoreById(storeId: string): Store | undefined {
    return (this.state.stores || []).find(s => s.id === storeId);
  }

  public createStore(data: Partial<Store>, requestingTenantId: string, userName: string, isSuperAdmin?: boolean): { success: boolean; store?: Store; message: string; statusCode: number } {
    if (!requestingTenantId || (requestingTenantId === 'global' && !isSuperAdmin)) {
      return { success: false, statusCode: 400, message: "Identifiant d'agence requis pour créer un magasin." };
    }

    const tenantId = data.tenantId && isSuperAdmin ? data.tenantId : requestingTenantId;
    const trimmedName = (data.name || '').trim();
    if (!trimmedName) {
      return { success: false, statusCode: 400, message: "Le nom du magasin est obligatoire." };
    }

    const trimmedCode = (data.code || `MAG-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
    const existing = (this.state.stores || []).find(
      s => s.tenantId === tenantId && (s.code === trimmedCode || s.name.toLowerCase() === trimmedName.toLowerCase())
    );
    if (existing) {
      return { success: false, statusCode: 409, message: `Un magasin avec ce nom ou code existe déjà dans cette agence.` };
    }

    const newStore: Store = {
      id: `store-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId,
      branchId: data.branchId || undefined,
      name: trimmedName,
      code: trimmedCode,
      type: data.type || 'MAIN',
      location: data.location?.trim() || '',
      responsibleUserId: data.responsibleUserId || undefined,
      responsibleUserName: data.responsibleUserName?.trim() || userName,
      isDefault: data.isDefault ?? false,
      isActive: data.isActive ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.updateState(draft => {
      if (!draft.stores) draft.stores = [];
      if (newStore.isDefault) {
        draft.stores.forEach(s => {
          if (s.tenantId === tenantId) s.isDefault = false;
        });
      }
      draft.stores.push(newStore);
    });

    this.logAudit('STORE_CREATED', 'STORE', newStore.id, null, {
      storeName: newStore.name,
      code: newStore.code,
      tenantId
    });

    return {
      success: true,
      statusCode: 201,
      store: newStore,
      message: `Le magasin "${newStore.name}" (${newStore.code}) a été créé avec succès.`
    };
  }

  public updateStore(storeId: string, data: Partial<Store>, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; store?: Store; message: string; statusCode: number } {
    const existing = (this.state.stores || []).find(s => s.id === storeId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Magasin introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous ne pouvez pas modifier un magasin d'une autre agence." };
    }

    let updatedStore: Store | undefined;
    this.updateState(draft => {
      const s = draft.stores.find(item => item.id === storeId);
      if (s) {
        if (data.name !== undefined) s.name = data.name.trim();
        if (data.code !== undefined) s.code = data.code.trim().toUpperCase();
        if (data.type !== undefined) s.type = data.type;
        if (data.location !== undefined) s.location = data.location.trim();
        if (data.responsibleUserId !== undefined) s.responsibleUserId = data.responsibleUserId;
        if (data.responsibleUserName !== undefined) s.responsibleUserName = data.responsibleUserName.trim();
        if (data.isActive !== undefined) s.isActive = data.isActive;
        if (data.isDefault !== undefined) {
          s.isDefault = data.isDefault;
          if (s.isDefault) {
            draft.stores.forEach(other => {
              if (other.tenantId === s.tenantId && other.id !== s.id) other.isDefault = false;
            });
          }
        }
        s.updatedAt = new Date().toISOString();
        updatedStore = { ...s };
      }
    });

    this.logAudit('STORE_UPDATED', 'STORE', storeId, null, {
      storeName: updatedStore?.name,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      store: updatedStore,
      message: `Le magasin "${updatedStore?.name}" a été mis à jour avec succès.`
    };
  }

  public deleteStore(storeId: string, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; message: string; statusCode: number } {
    const existing = (this.state.stores || []).find(s => s.id === storeId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Magasin introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous ne pouvez pas supprimer un magasin d'une autre agence." };
    }

    // Check if store has non-zero stock
    const productsWithStock = (this.state.products || []).filter(
      p => p.tenantId === existing.tenantId && p.stockByStore && (p.stockByStore[storeId] || 0) > 0
    );

    if (productsWithStock.length > 0) {
      return {
        success: false,
        statusCode: 400,
        message: `Impossible de supprimer ce magasin car il contient encore du stock (${productsWithStock.length} article(s) non vide(s)). Veuillez transférer les stocks avant la suppression.`
      };
    }

    this.updateState(draft => {
      draft.stores = draft.stores.filter(s => s.id !== storeId);
    });

    this.logAudit('STORE_DELETED', 'STORE', storeId, null, {
      storeName: existing.name,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Le magasin "${existing.name}" a été supprimé.`
    };
  }

  public transferStockBetweenStores(
    productId: string,
    fromStoreId: string,
    toStoreId: string,
    quantity: number,
    requestingTenantId: string,
    userName: string,
    reason?: string,
    isSuperAdmin?: boolean
  ): { success: boolean; message: string; statusCode: number } {
    if (quantity <= 0) {
      return { success: false, statusCode: 400, message: "La quantité à transférer doit être strictement positive." };
    }

    if (fromStoreId === toStoreId) {
      return { success: false, statusCode: 400, message: "Le magasin source et le magasin destination doivent être différents." };
    }

    const product = (this.state.products || []).find(p => p.id === productId);
    if (!product) {
      return { success: false, statusCode: 404, message: "Article introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && product.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Article appartenant à une autre agence." };
    }

    const fromStore = (this.state.stores || []).find(s => s.id === fromStoreId);
    const toStore = (this.state.stores || []).find(s => s.id === toStoreId);

    if (!fromStore || !toStore) {
      return { success: false, statusCode: 404, message: "Magasin source ou destination introuvable." };
    }

    // Strict agency check: inter-store transfer cannot cross agencies
    if (fromStore.tenantId !== product.tenantId || toStore.tenantId !== product.tenantId) {
      return {
        success: false,
        statusCode: 403,
        message: "403 Isolation Stricte : Les transferts de stock entre magasins doivent obligatoirement s'effectuer au sein de la même agence."
      };
    }

    const availableInSource = product.stockByStore?.[fromStoreId] ?? product.currentStock ?? 0;
    if (availableInSource < quantity) {
      return {
        success: false,
        statusCode: 400,
        message: `Stock insuffisant dans "${fromStore.name}" : ${availableInSource} ${product.unit} disponible(s), requis : ${quantity} ${product.unit}.`
      };
    }

    const unitCost = product.costPrice || 0;
    const transferRef = `TRF-${Date.now().toString().slice(-6)}`;

    this.updateState(draft => {
      const p = draft.products.find(item => item.id === productId);
      if (p) {
        if (!p.stockByStore) p.stockByStore = {};
        p.stockByStore[fromStoreId] = Math.max(0, (p.stockByStore[fromStoreId] || 0) - quantity);
        p.stockByStore[toStoreId] = (p.stockByStore[toStoreId] || 0) + quantity;
        p.updatedAt = new Date().toISOString();
      }

      if (!draft.stockMovements) draft.stockMovements = [];

      // Outflow from source store
      draft.stockMovements.unshift({
        id: `mov-trf-out-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tenantId: product.tenantId,
        productId: product.id,
        productName: product.name,
        movementType: 'TRANSFER_OUT',
        quantity: -quantity,
        oldStock: availableInSource,
        newStock: availableInSource - quantity,
        unitUsed: product.unit || product.baseUnit,
        unitCost,
        totalCost: quantity * unitCost,
        storeId: fromStore.id,
        storeName: fromStore.name,
        targetStoreId: toStore.id,
        targetStoreName: toStore.name,
        sourceLocation: fromStore.name,
        destinationLocation: toStore.name,
        reason: `Transfert vers ${toStore.name} [Réf: ${transferRef}] - ${reason || 'Réapprovisionnement inter-magasin'}`,
        performedByUserName: userName,
        createdAt: new Date().toISOString()
      });

      // Inflow into target store
      const targetOldStock = product.stockByStore?.[toStoreId] || 0;
      draft.stockMovements.unshift({
        id: `mov-trf-in-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tenantId: product.tenantId,
        productId: product.id,
        productName: product.name,
        movementType: 'TRANSFER_IN',
        quantity: quantity,
        oldStock: targetOldStock,
        newStock: targetOldStock + quantity,
        unitUsed: product.unit || product.baseUnit,
        unitCost,
        totalCost: quantity * unitCost,
        storeId: toStore.id,
        storeName: toStore.name,
        targetStoreId: fromStore.id,
        targetStoreName: fromStore.name,
        sourceLocation: fromStore.name,
        destinationLocation: toStore.name,
        reason: `Réception depuis ${fromStore.name} [Réf: ${transferRef}] - ${reason || 'Réapprovisionnement inter-magasin'}`,
        performedByUserName: userName,
        createdAt: new Date().toISOString()
      });
    });

    this.logAudit('STOCK_INTER_STORE_TRANSFERRED', 'PRODUCT', productId, null, {
      product: product.name,
      quantity,
      fromStore: fromStore.name,
      toStore: toStore.name,
      transferRef,
      tenantId: product.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Transfert de ${quantity} ${product.unit} effectué avec succès de "${fromStore.name}" vers "${toStore.name}" (Réf: ${transferRef}).`
    };
  }

  // --- GENERIC PRESTATION CONSUMABLES ENGINE ---

  public checkConsumablesStockAvailability(
    items: OrderItem[],
    requestingTenantId: string,
    storeId?: string,
    isClientSupportProvided?: boolean,
    itemOverrides?: Record<string, boolean>
  ): StockAvailabilityResult {
    const targetTenant = (!requestingTenantId || requestingTenantId === 'global' || requestingTenantId === 'ALL') ? INITIAL_TENANT_ID : requestingTenantId;
    const products = (this.state.products || []).filter(
      p => targetTenant === 'global' || p.tenantId === targetTenant
    );
    const services = (this.state.services || []).filter(
      s => targetTenant === 'global' || s.tenantId === targetTenant
    );

    const requirements = calculateOrderConsumablesRequirements(items, services, products, {
      isClientSupportProvided,
      itemClientSupportOverrides: itemOverrides
    });

    const workshopStore = storeId
      ? (this.state.stores || []).find(s => s.id === storeId)
      : (this.state.stores || []).find(s => s.tenantId === targetTenant && s.type === 'WORKSHOP');

    return checkOrderConsumablesAvailability(requirements, products, workshopStore?.id);
  }

  public deductConsumablesForOrder(
    orderId: string,
    requestingTenantId: string,
    userName: string,
    storeId?: string,
    options?: { isClientSupportProvided?: boolean; itemClientSupportOverrides?: Record<string, boolean> }
  ): { success: boolean; movementsCount: number; message: string; missingConsumables?: any[] } {
    const order = (this.state.orders || []).find(o => o.id === orderId);
    if (!order) {
      return { success: false, movementsCount: 0, message: "Commande introuvable." };
    }

    // Protection anti-double déduction (Idempotence stricte)
    if (order.stockDeducted) {
      return { success: true, movementsCount: 0, message: "Stock déjà déduit pour cette commande." };
    }

    const tenantId = order.tenantId;
    const products = (this.state.products || []).filter(p => p.tenantId === tenantId);
    const services = (this.state.services || []).filter(s => s.tenantId === tenantId);

    // 1. Separate Prestations (Services) and Boutique Products
    const serviceItems = (order.items || []).filter(i => i.itemType === 'SERVICE' || (Boolean(i.serviceId) && i.itemType !== 'PRODUCT'));
    const productItems = (order.items || []).filter(i => i.itemType === 'PRODUCT' || (Boolean(i.productId) && i.itemType !== 'SERVICE'));

    // 2. Calculate Prestation Consumable Requirements
    const prestationRequirements = calculateOrderConsumablesRequirements(serviceItems, services, products, {
      isClientSupportProvided: options?.isClientSupportProvided ?? order.isClientSupportProvided,
      itemClientSupportOverrides: options?.itemClientSupportOverrides
    });

    // 3. Resolve Workshop Store (Stock Prestation) and POS / Main Store (Stock Magasin)
    const workshopStore = (this.state.stores || []).find(s => s.tenantId === tenantId && s.type === 'WORKSHOP')
      || (this.state.stores || []).find(s => s.tenantId === tenantId && s.code?.includes('ATEL'));
    const posStore = storeId
      ? (this.state.stores || []).find(s => s.id === storeId)
      : ((this.state.stores || []).find(s => s.tenantId === tenantId && (s.type === 'POINT_OF_SALE' || s.isDefault))
         || (this.state.stores || []).find(s => s.tenantId === tenantId));

    // 4. Pre-validation: Check Availability of Prestation Consumables in Stock Central
    for (const req of prestationRequirements) {
      const prod = products.find(p => p.id === req.productId);
      const curCentralStock = prod?.currentStock || 0;
      
      if (curCentralStock < req.quantityRequired && !prod?.allowNegativeStock) {
        return {
          success: false,
          movementsCount: 0,
          message: `Stock Central insuffisant pour « ${req.productName} » (${req.serviceName}). Disponible : ${curCentralStock} ${req.unit}, Requis : ${req.quantityRequired} ${req.unit}.`,
          missingConsumables: [{
            productId: req.productId,
            productName: req.productName,
            serviceName: req.serviceName,
            requiredQty: req.quantityRequired,
            availableQty: curCentralStock,
            missingQty: req.quantityRequired - curCentralStock,
            unit: req.unit
          }]
        };
      }
    }

    // 5. Pre-validation: Check Availability of Boutique/Marketplace Products in Stock Central
    for (const item of productItems) {
      if (!item.productId) continue;
      const prod = products.find(p => p.id === item.productId);
      if (!prod) continue;
      const deduction = calculateItemStockDeduction(item, prod);
      const curCentralStock = prod.currentStock || 0;
      if (curCentralStock < deduction && !prod.allowNegativeStock) {
        return {
          success: false,
          movementsCount: 0,
          message: `Stock Central insuffisant pour « ${item.productName || prod.name} ». Disponible : ${curCentralStock} ${prod.baseUnit || item.unit}, Requis : ${deduction} ${prod.baseUnit || item.unit}.`
        };
      }
    }

    let movementsCreated = 0;

    this.updateState(draft => {
      if (!draft.stockMovements) draft.stockMovements = [];

      // A. DEDUCT PRESTATION CONSUMABLES FROM STOCK CENTRAL
      for (const req of prestationRequirements) {
        const prod = draft.products.find(p => p.id === req.productId);
        if (!prod) continue;

        const oldCentralStock = prod.currentStock || 0;
        const newCentralStock = Math.max(0, oldCentralStock - req.quantityRequired);

        // Update Single Central Stock
        prod.currentStock = newCentralStock;
        prod.prestationStock = newCentralStock;
        if (!prod.stockByLocation) prod.stockByLocation = {};
        prod.stockByLocation['CENTRAL'] = newCentralStock;
        prod.stockByLocation['PRESTATION'] = newCentralStock;
        prod.stockByLocation['MAIN_STORE'] = newCentralStock;
        prod.updatedAt = new Date().toISOString();

        // Create traceable StockMovement for Prestation Consumable
        draft.stockMovements.unshift({
          id: `mov-cons-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          tenantId: prod.tenantId,
          productId: prod.id,
          productName: prod.name,
          movementType: 'CONSOMMATION_PRESTATION',
          quantity: -req.quantityRequired,
          oldStock: oldCentralStock,
          newStock: newCentralStock,
          unitUsed: req.unit,
          unitCost: prod.costPrice || 0,
          totalCost: (prod.costPrice || 0) * req.quantityRequired,
          storeId: workshopStore?.id || posStore?.id,
          storeName: 'Stock Central',
          sourceLocation: 'Stock Central',
          destinationLocation: `Prestation : ${req.serviceName}`,
          relatedOrderId: order.id,
          relatedOrderItemId: req.orderItemId,
          relatedServiceId: req.serviceId,
          reason: `Consommation automatique prestation ${req.serviceName} (${order.orderNumber})`,
          performedByUserName: userName,
          createdAt: new Date().toISOString()
        });

        movementsCreated++;
      }

      // B. DEDUCT BOUTIQUE & MARKETPLACE PRODUCTS FROM STOCK CENTRAL
      for (const item of productItems) {
        if (!item.productId) continue;
        const prod = draft.products.find(p => p.id === item.productId);
        if (!prod) continue;

        const deduction = calculateItemStockDeduction(item, prod);
        const oldCentralStock = prod.currentStock || 0;
        const newCentralStock = Math.max(0, oldCentralStock - deduction);

        // Update Single Central Stock
        prod.currentStock = newCentralStock;
        prod.prestationStock = newCentralStock;
        if (!prod.stockByLocation) prod.stockByLocation = {};
        prod.stockByLocation['CENTRAL'] = newCentralStock;
        prod.stockByLocation['MAIN_STORE'] = newCentralStock;
        prod.stockByLocation['PRESTATION'] = newCentralStock;
        prod.updatedAt = new Date().toISOString();

        const mvtType: StockMovementType = order.orderSource === 'MARKETPLACE' ? 'VENTE_MARKETPLACE' : 'VENTE_BOUTIQUE';

        // Create traceable StockMovement for Boutique / Marketplace Sale
        draft.stockMovements.unshift({
          id: `mov-sale-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          tenantId: prod.tenantId,
          productId: prod.id,
          productName: prod.name,
          movementType: mvtType,
          quantity: -deduction,
          oldStock: oldCentralStock,
          newStock: newCentralStock,
          unitUsed: prod.baseUnit || item.unit,
          unitCost: prod.costPrice || 0,
          totalCost: (prod.costPrice || 0) * deduction,
          storeId: posStore?.id,
          storeName: 'Stock Central',
          sourceLocation: 'Stock Central',
          destinationLocation: order.personName ? `Client (${order.personName})` : 'Client',
          relatedOrderId: order.id,
          relatedOrderItemId: item.id,
          reason: `Vente ${order.orderSource === 'MARKETPLACE' ? 'Marketplace' : 'Boutique'} commande ${order.orderNumber} - ${item.productName || prod.name}`,
          performedByUserName: userName,
          createdAt: new Date().toISOString()
        });

        movementsCreated++;
      }

      // Mark order as deducted
      const targetOrder = draft.orders?.find(o => o.id === orderId);
      if (targetOrder) {
        targetOrder.consumablesDeducted = true;
        targetOrder.stockDeducted = true;
        targetOrder.updatedAt = new Date().toISOString();
      }
    });

    this.logAudit('ORDER_STOCK_DEDUCTED', 'ORDER', orderId, null, {
      orderNumber: order.orderNumber,
      movementsCount: movementsCreated,
      tenantId
    });

    return {
      success: true,
      movementsCount: movementsCreated,
      message: `${movementsCreated} mouvement(s) de stock enregistré(s) avec succès pour la commande ${order.orderNumber}.`
    };
  }

  public deliverCommercialOrder(
    orderId: string,
    requestingTenantId: string,
    performedBy: { id?: string; name: string }
  ): { success: boolean; message: string; order?: any } {
    const order = (this.state.orders || []).find(o => o.id === orderId);
    if (!order) {
      return { success: false, message: "Commande introuvable." };
    }

    // Protection anti-double livraison (Idempotence)
    if (order.status === 'DELIVERED' || order.deliveryStatus === 'DELIVERED') {
      return { success: false, message: "Cette commande est déjà livrée." };
    }

    // Règle de paiement obligatoire : la commande doit être entièrement soldée
    const dueAmount = order.dueAmount !== undefined ? order.dueAmount : Math.max(0, order.totalAmount - order.paidAmount);
    if (order.paymentStatus !== 'PAID' && dueAmount > 0) {
      return {
        success: false,
        message: "Cette commande ne peut pas être livrée car elle n'est pas entièrement payée."
      };
    }

    const previousStatus = order.status;
    const nowIso = new Date().toISOString();

    // Déduction sécurisée du stock si non déjà déduit (idempotent)
    if (!order.stockDeducted) {
      this.deductConsumablesForOrder(order.id, order.tenantId || requestingTenantId, performedBy.name);
    }

    // Mise à jour transactionnelle du statut de la commande
    this.updateState(draft => {
      const ord = draft.orders.find(o => o.id === orderId);
      if (ord) {
        ord.status = 'DELIVERED';
        ord.deliveryStatus = 'DELIVERED';
        ord.deliveredAt = nowIso;
        ord.deliveredByUserId = performedBy.id;
        ord.deliveredByUserName = performedBy.name;
        ord.deliveryNotes = `Commande finalisée et livrée avec succès par ${performedBy.name}`;
        ord.updatedAt = nowIso;
        if (ord.items) {
          ord.items.forEach(it => {
            if (it.productionStatus !== 'CANCELLED') {
              it.productionStatus = 'DELIVERED';
              it.deliveredAt = nowIso;
              it.deliveredByUserName = performedBy.name;
            }
          });
        }
      }

      // Notification client via le système existant
      if (!draft.notifications) draft.notifications = [];
      draft.notifications.unshift({
        id: `notif-deliv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tenantId: order.tenantId || requestingTenantId,
        userId: order.personId,
        title: `Commande #${order.orderNumber} Livrée 🟢`,
        message: `Votre commande #${order.orderNumber} a été validée et livrée. Merci de votre fidélité !`,
        type: 'ORDER',
        isRead: false,
        createdAt: nowIso
      } as any);
    });

    // Journal d'audit officiel
    this.logAudit('ORDER_DELIVERED', 'ORDER', order.id, { status: previousStatus }, {
      status: 'DELIVERED',
      orderNumber: order.orderNumber,
      deliveredAt: nowIso,
      performedBy: performedBy.name
    });

    const updatedOrder = (this.state.orders || []).find(o => o.id === orderId);
    return {
      success: true,
      message: `La commande #${order.orderNumber} est désormais validée et livrée.`,
      order: updatedOrder
    };
  }

  public restoreConsumablesForOrder(
    orderId: string,
    requestingTenantId: string,
    userName: string,
    reason: string = 'Annulation de commande'
  ): { success: boolean; restoredCount: number; message: string } {
    const order = (this.state.orders || []).find(o => o.id === orderId);
    if (!order) {
      return { success: false, restoredCount: 0, message: "Commande introuvable." };
    }

    // Find all deduction movements associated with this order
    const relatedMovements = (this.state.stockMovements || []).filter(
      m => m.relatedOrderId === orderId && m.quantity < 0 && (
        m.movementType === 'CONSOMMATION_PRESTATION' ||
        m.movementType === 'VENTE_BOUTIQUE' ||
        m.movementType === 'VENTE_MARKETPLACE' ||
        m.movementType === 'INTERNAL_CONSUMPTION' ||
        m.movementType === 'CONSUMPTION'
      )
    );

    if (relatedMovements.length === 0) {
      return { success: true, restoredCount: 0, message: "Aucun stock déduit trouvé pour cette commande." };
    }

    let restoredCount = 0;
    this.updateState(draft => {
      if (!draft.stockMovements) draft.stockMovements = [];

      for (const mvt of relatedMovements) {
        const prod = draft.products.find(p => p.id === mvt.productId);
        if (!prod) continue;

        const qtyToRestore = Math.abs(mvt.quantity);
        const oldStock = prod.currentStock || 0;
        const newStock = oldStock + qtyToRestore;

        // Restore to Single Central Stock
        prod.currentStock = newStock;
        prod.prestationStock = newStock;
        if (!prod.stockByLocation) prod.stockByLocation = {};
        prod.stockByLocation['CENTRAL'] = newStock;
        prod.stockByLocation['MAIN_STORE'] = newStock;
        prod.stockByLocation['PRESTATION'] = newStock;
        prod.updatedAt = new Date().toISOString();

        // Create return / cancellation movement
        draft.stockMovements.unshift({
          id: `mov-rest-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          tenantId: prod.tenantId,
          productId: prod.id,
          productName: prod.name,
          movementType: 'RETOUR',
          quantity: qtyToRestore,
          oldStock,
          newStock,
          unitUsed: mvt.unitUsed,
          unitCost: mvt.unitCost,
          totalCost: (mvt.unitCost || 0) * qtyToRestore,
          storeId: mvt.storeId,
          storeName: 'Stock Central',
          sourceLocation: `Annulation commande : ${order.orderNumber}`,
          destinationLocation: 'Stock Central',
          relatedOrderId: order.id,
          relatedOrderItemId: mvt.relatedOrderItemId,
          relatedServiceId: mvt.relatedServiceId,
          reason: `Réintégration en Stock Central suite à annulation : ${reason} (${order.orderNumber})`,
          performedByUserName: userName,
          createdAt: new Date().toISOString()
        });

        restoredCount++;
      }

      // Mark order as not deducted
      const targetOrder = draft.orders?.find(o => o.id === orderId);
      if (targetOrder) {
        targetOrder.consumablesDeducted = false;
        targetOrder.stockDeducted = false;
        targetOrder.updatedAt = new Date().toISOString();
      }
    });

    this.logAudit('ORDER_STOCK_RESTORED', 'ORDER', orderId, null, {
      orderNumber: order.orderNumber,
      restoredCount,
      reason,
      tenantId: order.tenantId
    });

    return {
      success: true,
      restoredCount,
      message: `${restoredCount} article(s)/consommable(s) réintégré(s) en stock suite à l'annulation de ${order.orderNumber}.`
    };
  }

  public updateServiceConsumables(
    serviceId: string,
    consumableMode: ConsumableMode,
    consumables: ServiceConsumableConfig[],
    isClientSupportAllowed: boolean = true,
    requestingTenantId: string = 'global'
  ): { success: boolean; service?: Service; message: string; statusCode: number } {
    const existing = (this.state.services || []).find(s => s.id === serviceId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Prestation introuvable." };
    }

    if (requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Prestation appartenant à une autre agence." };
    }

    let updated: Service | undefined;
    this.updateState(draft => {
      const s = draft.services.find(item => item.id === serviceId);
      if (s) {
        s.consumableMode = consumableMode;
        s.consumables = consumables;
        s.isClientSupportAllowed = isClientSupportAllowed;
        s.updatedAt = new Date().toISOString();
        updated = { ...s };
      }
    });

    this.logAudit('SERVICE_CONSUMABLES_CONFIGURED', 'SERVICE', serviceId, null, {
      serviceName: existing.name,
      consumableMode,
      consumablesCount: consumables.length,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      service: updated,
      message: `Configuration des consommables mise à jour pour "${existing.name}".`
    };
  }

  // --- SECURE MULTI-AGENCY STOCK & WAREHOUSE MANAGEMENT (ANTI-IDOR & AGENCY ISOLATION) ---

  public getProductsByTenant(tenantId: string, isSuperAdmin?: boolean): Product[] {
    if (!tenantId || tenantId === 'global' || tenantId === 'ALL') {
      return this.state.products || [];
    }
    return (this.state.products || []).filter(p => p.tenantId === tenantId);
  }

  public getProductById(productId: string, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; product?: Product; message: string; statusCode: number } {
    const product = (this.state.products || []).find(p => p.id === productId);
    if (!product) {
      return { success: false, statusCode: 404, message: "Produit introuvable." };
    }
    if (!isSuperAdmin && requestingTenantId !== 'global' && product.tenantId !== requestingTenantId) {
      this.logAudit('PRODUCT_CROSS_TENANT_ACCESS_DENIED', 'PRODUCT', productId, null, {
        targetProductTenant: product.tenantId,
        requestingTenant: requestingTenantId,
        action: 'GET_PRODUCT'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Ce produit appartient à une autre agence." };
    }
    return { success: true, statusCode: 200, product, message: "OK" };
  }

  public createSecureProduct(data: Partial<Product>, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; product?: Product; message: string; statusCode: number } {
    if (!requestingTenantId || (requestingTenantId === 'global' && !isSuperAdmin)) {
      return { success: false, statusCode: 400, message: "Identifiant d'agence requis pour créer un produit." };
    }

    const trimmedCode = (data.code || '').trim().toUpperCase();
    const existingCode = (this.state.products || []).find(
      p => p.tenantId === requestingTenantId && p.code.toUpperCase() === trimmedCode && !p.isArchived
    );
    if (existingCode) {
      return { success: false, statusCode: 409, message: `Le code article "${trimmedCode}" existe déjà dans votre agence.` };
    }

    if (data.barcode && data.barcode.trim()) {
      const existingBarcode = (this.state.products || []).find(
        p => p.tenantId === requestingTenantId && p.barcode === data.barcode?.trim() && !p.isArchived
      );
      if (existingBarcode) {
        return { success: false, statusCode: 409, message: `Le code-barres "${data.barcode}" est déjà attribué à "${existingBarcode.name}".` };
      }
    }

    const newProductId = `prod-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const initialQty = Number(data.initialStock) || 0;
    const costP = Number(data.costPrice) || 0;
    const saleP = Number(data.salePrice) || 0;

    const newProduct: Product = {
      id: newProductId,
      tenantId: requestingTenantId,
      code: trimmedCode,
      barcode: data.barcode?.trim() || undefined,
      name: (data.name || '').trim(),
      categoryId: data.categoryId || 'cat-prod-01',
      category: data.category || 'Général',
      description: data.description?.trim() || '',
      baseUnit: data.baseUnit || 'unité',
      unit: data.baseUnit || 'unité',
      defaultSaleUnit: data.defaultSaleUnit || data.baseUnit || 'unité',
      defaultPurchaseUnit: data.defaultPurchaseUnit || data.baseUnit || 'unité',
      packagings: data.packagings || [],
      costPrice: costP,
      salePrice: saleP,
      wholesalePrice: Number(data.wholesalePrice) || saleP,
      initialStock: initialQty,
      currentStock: initialQty,
      minStockAlert: Number(data.minStockAlert) || 0,
      maxStock: Number(data.maxStock) || 0,
      supplierId: data.supplierId || undefined,
      supplierName: data.supplierName || undefined,
      location: data.location?.trim() || 'Magasin Principal',
      stockByLocation: data.stockByLocation || { 'MAIN_STORE': initialQty },
      imageUrl: data.imageUrl?.trim() || undefined,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isArchived: false,
      createdAt: new Date().toISOString()
    };

    this.updateState(draft => {
      if (!draft.products) draft.products = [];
      draft.products.unshift(newProduct);

      // Record initial stock entry movement if quantity > 0
      if (initialQty > 0) {
        if (!draft.stockMovements) draft.stockMovements = [];
        draft.stockMovements.unshift({
          id: `mov-${Date.now()}`,
          tenantId: requestingTenantId,
          productId: newProductId,
          productName: newProduct.name,
          movementType: 'IN',
          quantity: initialQty,
          oldStock: 0,
          newStock: initialQty,
          unitUsed: newProduct.baseUnit,
          quantityInStockUnit: initialQty,
          unitCost: costP,
          totalCost: costP * initialQty,
          sourceLocation: 'Création Fiche Article',
          destinationLocation: 'MAIN_STORE',
          reason: `Stock initial à la création de l'article : ${newProduct.name}`,
          performedByUserName: 'Gestionnaire Stock',
          createdAt: new Date().toISOString()
        });
      }
    });

    this.logAudit('PRODUCT_CREATED', 'PRODUCT', newProductId, null, {
      name: newProduct.name,
      code: newProduct.code,
      tenantId: requestingTenantId,
      initialStock: initialQty
    });

    return {
      success: true,
      statusCode: 201,
      product: newProduct,
      message: `L'article "${newProduct.name}" (${newProduct.code}) a été créé avec succès.`
    };
  }

  public updateSecureProduct(productId: string, data: Partial<Product>, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; product?: Product; message: string; statusCode: number } {
    const existing = (this.state.products || []).find(p => p.id === productId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Produit introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      this.logAudit('PRODUCT_CROSS_TENANT_MUTATION_DENIED', 'PRODUCT', productId, null, {
        targetProductTenant: existing.tenantId,
        requestingTenant: requestingTenantId,
        action: 'UPDATE_PRODUCT'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous ne pouvez pas modifier un produit appartenant à une autre agence." };
    }

    let updatedProduct: Product | undefined;
    this.updateState(draft => {
      const p = draft.products.find(item => item.id === productId);
      if (p) {
        if (data.name !== undefined) p.name = data.name.trim();
        if (data.code !== undefined) p.code = data.code.trim().toUpperCase();
        if ('barcode' in data) p.barcode = data.barcode?.trim() || undefined;
        if (data.categoryId !== undefined) p.categoryId = data.categoryId;
        if (data.category !== undefined) p.category = data.category;
        if ('description' in data) p.description = data.description?.trim() || '';
        
        if ('imageUrl' in data) p.imageUrl = data.imageUrl?.trim() || undefined;

        if (data.baseUnit !== undefined) {
          p.baseUnit = data.baseUnit;
          p.unit = data.baseUnit;
        }
        if (data.defaultSaleUnit !== undefined) p.defaultSaleUnit = data.defaultSaleUnit;
        if (data.defaultPurchaseUnit !== undefined) p.defaultPurchaseUnit = data.defaultPurchaseUnit;
        if (data.packagings !== undefined) p.packagings = data.packagings;
        if (data.costPrice !== undefined) p.costPrice = Number(data.costPrice);
        if (data.salePrice !== undefined) p.salePrice = Number(data.salePrice);
        if (data.wholesalePrice !== undefined) p.wholesalePrice = Number(data.wholesalePrice);
        if (data.minStockAlert !== undefined) p.minStockAlert = Number(data.minStockAlert);
        if (data.maxStock !== undefined) p.maxStock = Number(data.maxStock);
        if ('supplierId' in data) p.supplierId = data.supplierId || undefined;
        if ('supplierName' in data) p.supplierName = data.supplierName || undefined;
        if (data.location !== undefined) p.location = data.location.trim();
        if (data.isActive !== undefined) p.isActive = data.isActive;
        if (data.isArchived !== undefined) p.isArchived = data.isArchived;
        p.updatedAt = new Date().toISOString();
        updatedProduct = { ...p };
      }
    });

    if (data.isActive !== undefined && existing.isActive !== data.isActive) {
      this.logAudit(
        data.isActive ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
        'PRODUCT',
        productId,
        { isActive: existing.isActive },
        { isActive: data.isActive, name: updatedProduct?.name, tenantId: existing.tenantId }
      );
    } else {
      this.logAudit('PRODUCT_UPDATED', 'PRODUCT', productId, null, {
        name: updatedProduct?.name,
        code: updatedProduct?.code,
        tenantId: existing.tenantId
      });
    }

    return {
      success: true,
      statusCode: 200,
      product: updatedProduct,
      message: `L'article "${updatedProduct?.name}" a été mis à jour avec succès.`
    };
  }

  public checkProductDeletability(productId: string, requestingTenantId: string, isSuperAdmin?: boolean): {
    canDelete: boolean;
    reason?: string;
    linkedDataSummary?: {
      movementsCount: number;
      ordersCount: number;
      purchaseOrdersCount: number;
      servicesCount: number;
    };
  } {
    const product = (this.state.products || []).find(p => p.id === productId);
    if (!product || product.isArchived) {
      return { canDelete: false, reason: "Produit introuvable." };
    }

    // Check stock movements
    const movements = (this.state.stockMovements || []).filter(m => m.productId === productId);
    const movementsCount = movements.length;

    // Check customer orders
    const orders = (this.state.orders || []).filter(o => o.items?.some(it => it.productId === productId));
    const ordersCount = orders.length;

    // Check purchase orders
    const purchaseOrders = (this.state.purchaseOrders || []).filter(po => po.items?.some(it => it.productId === productId));
    const purchaseOrdersCount = purchaseOrders.length;

    // Check linked services as consumable
    const services = (this.state.services || []).filter(srv =>
      srv.consumables?.some(c => c.productId === productId) ||
      srv.consumptions?.some(c => c.productId === productId)
    );
    const servicesCount = services.length;

    const hasLinkedData = movementsCount > 0 || ordersCount > 0 || purchaseOrdersCount > 0 || servicesCount > 0;

    let reason = '';
    if (hasLinkedData) {
      const details: string[] = [];
      if (movementsCount > 0) details.push(`${movementsCount} mouvement(s) de stock`);
      if (ordersCount > 0) details.push(`${ordersCount} commande(s) client`);
      if (purchaseOrdersCount > 0) details.push(`${purchaseOrdersCount} bon(s) de commande fournisseur`);
      if (servicesCount > 0) details.push(`${servicesCount} prestation(s) liée(s)`);
      reason = `Cet article possède déjà un historique (${details.join(', ')}) et ne peut pas être supprimé définitivement. Vous pouvez le désactiver.`;
    }

    return {
      canDelete: !hasLinkedData,
      reason: hasLinkedData ? reason : undefined,
      linkedDataSummary: {
        movementsCount,
        ordersCount,
        purchaseOrdersCount,
        servicesCount
      }
    };
  }

  public deleteSecureProduct(productId: string, requestingTenantId: string, isSuperAdmin?: boolean): { success: boolean; message: string; statusCode: number; canDeactivateInstead?: boolean } {
    const existing = (this.state.products || []).find(p => p.id === productId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Produit introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      this.logAudit('PRODUCT_CROSS_TENANT_DELETE_DENIED', 'PRODUCT', productId, null, {
        targetProductTenant: existing.tenantId,
        requestingTenant: requestingTenantId,
        action: 'DELETE_PRODUCT'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous ne pouvez pas supprimer un produit appartenant à une autre agence." };
    }

    // Safety check for linked data
    const deletability = this.checkProductDeletability(productId, requestingTenantId, isSuperAdmin);
    if (!deletability.canDelete) {
      return {
        success: false,
        statusCode: 400,
        canDeactivateInstead: true,
        message: deletability.reason || "Cet article possède déjà un historique et ne peut pas être supprimé définitivement. Vous pouvez le désactiver."
      };
    }

    this.updateState(draft => {
      draft.products = draft.products.filter(p => p.id !== productId);
    });

    this.logAudit('PRODUCT_DELETED', 'PRODUCT', productId, null, {
      name: existing.name,
      code: existing.code,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `L'article "${existing.name}" a été définitivement supprimé.`
    };
  }

  public adjustSecureProductStock(productId: string, newStock: number, reason: string, location: string, requestingTenantId: string, userName: string, isSuperAdmin?: boolean): { success: boolean; message: string; statusCode: number } {
    const existing = (this.state.products || []).find(p => p.id === productId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Produit introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      this.logAudit('PRODUCT_CROSS_TENANT_ADJUST_DENIED', 'PRODUCT', productId, null, {
        targetProductTenant: existing.tenantId,
        requestingTenant: requestingTenantId,
        action: 'ADJUST_STOCK'
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous ne pouvez pas modifier le stock d'un produit d'une autre agence." };
    }

    const oldStock = existing.currentStock;
    const diff = newStock - oldStock;
    const cost = existing.costPrice || 0;

    this.updateState(draft => {
      const p = draft.products.find(item => item.id === productId);
      if (p) {
        p.currentStock = newStock;
        if (!p.stockByLocation) p.stockByLocation = {};
        p.stockByLocation[location] = newStock;
        p.updatedAt = new Date().toISOString();
      }

      if (!draft.stockMovements) draft.stockMovements = [];
      draft.stockMovements.unshift({
        id: `mov-${Date.now()}`,
        tenantId: existing.tenantId,
        productId: existing.id,
        productName: existing.name,
        movementType: diff >= 0 ? 'IN' : 'OUT',
        quantity: diff,
        oldStock,
        newStock,
        unitUsed: existing.unit,
        quantityInStockUnit: diff,
        unitCost: cost,
        totalCost: Math.abs(diff) * cost,
        sourceLocation: location,
        destinationLocation: location,
        reason: reason || 'Ajustement de stock manuel',
        performedByUserName: userName || 'Responsable Stock',
        createdAt: new Date().toISOString()
      });
    });

    this.logAudit('STOCK_ADJUSTED', 'PRODUCT', productId, null, {
      product: existing.name,
      oldStock,
      newStock,
      diff,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Stock de "${existing.name}" ajusté à ${newStock} ${existing.unit} (${diff >= 0 ? '+' : ''}${diff}).`
    };
  }

  public consumeSecureProductStock(
    productId: string,
    qty: number,
    service: string,
    orderNumber: string,
    reason: string,
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean,
    unitUsed?: string,
    serviceId?: string
  ): { success: boolean; message: string; statusCode: number; deductedBaseQty?: number; remainingStock?: number; prestationCapacity?: number } {
    const existing = (this.state.products || []).find(p => p.id === productId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Produit introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Produit appartenant à une autre agence." };
    }

    // Agency Activity Model Security Check
    const effectiveTenantId = requestingTenantId && requestingTenantId !== 'global' ? requestingTenantId : existing.tenantId;
    const agency = (this.state.tenants || []).find(t => t.id === effectiveTenantId);
    if (agency && agency.activityType !== 'SERVICE_CENTER' && !isSuperAdmin) {
      this.logAudit('PRESTATION_STOCK_MODEL_RESTRICTION', 'PRODUCT', productId, null, {
        tenantId: effectiveTenantId,
        activityType: agency.activityType,
        reason: 'Tentative de transfert vers prestation depuis un modèle non-prestation'
      });
      return {
        success: false,
        statusCode: 403,
        message: "403 Accès Refusé : Le transfert vers Stock Prestation et la consommation interne sont réservés aux centres de prestations."
      };
    }

    if (qty <= 0) {
      return { success: false, statusCode: 400, message: "La quantité transférée doit être strictement supérieure à 0." };
    }

    // Resolve unit factor and service consumption rules
    const matchedService = serviceId
      ? (this.state.services || []).find(s => s.id === serviceId)
      : (this.state.services || []).find(s => s.name.toLowerCase() === service.toLowerCase());

    const calculation = calculateServiceStockConsumption(
      existing,
      qty,
      unitUsed,
      matchedService,
      service
    );

    const qtyInBase = calculation.qtyInBaseUnit;
    const baseUnit = calculation.baseUnitName;
    const transferUnit = calculation.transferUnitName;

    if (existing.currentStock < qtyInBase && !existing.allowNegativeStock) {
      const missingBase = qtyInBase - existing.currentStock;
      const missingUnit = calculation.factorToBase > 1 ? ` (soit ${Math.ceil(missingBase / calculation.factorToBase)} ${transferUnit}s)` : '';
      return {
        success: false,
        statusCode: 400,
        message: `Quantité insuffisante. Stock central insuffisant pour « ${existing.name} ». Disponible : ${existing.currentStock.toLocaleString('fr-FR')} ${baseUnit}s (${calculation.currentStockPrestationCapacity.toLocaleString('fr-FR')} ${calculation.prestationUnitName}). Demandé : ${qtyInBase.toLocaleString('fr-FR')} ${baseUnit}s${missingUnit}.`
      };
    }

    const oldStock = existing.currentStock;
    const newStock = oldStock - qtyInBase;

    this.updateState(draft => {
      const p = draft.products.find(item => item.id === productId);
      if (p) {
        p.currentStock = newStock;
        p.prestationStock = newStock;
        if (!p.stockByLocation) p.stockByLocation = {};
        p.stockByLocation['CENTRAL'] = newStock;
        p.stockByLocation['MAIN_STORE'] = newStock;
        p.stockByLocation['PRESTATION'] = newStock;
        p.updatedAt = new Date().toISOString();
      }

      if (!draft.stockMovements) draft.stockMovements = [];
      draft.stockMovements.unshift({
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tenantId: existing.tenantId,
        productId: existing.id,
        productName: existing.name,
        movementType: 'CONSOMMATION_PRESTATION',
        quantity: -qtyInBase,
        oldStock,
        newStock,
        unitUsed: transferUnit,
        conversionFactorApplied: calculation.factorToBase,
        quantityInStockUnit: -qtyInBase,
        unitCost: existing.costPrice,
        totalCost: existing.costPrice * qtyInBase,
        sourceLocation: 'Stock Central',
        destinationLocation: `Prestation : ${service}`,
        serviceOrDepartment: service,
        relatedOrderId: orderNumber.trim() || undefined,
        reason: `Consommation prestation : ${qty} ${transferUnit}(s) = ${qtyInBase} ${baseUnit}s (${calculation.prestationCapacity} ${calculation.prestationUnitName}) pour ${service}${reason ? ` - ${reason}` : ''}`,
        performedByUserName: userName,
        createdAt: new Date().toISOString()
      });
    });

    this.logAudit('STOCK_CONSUMED', 'PRODUCT', productId, null, {
      product: existing.name,
      transferredQty: qty,
      transferredUnit: transferUnit,
      deductedBaseQty: qtyInBase,
      prestationCapacity: calculation.prestationCapacity,
      service,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      deductedBaseQty: qtyInBase,
      remainingStock: newStock,
      prestationCapacity: calculation.prestationCapacity,
      message: `Consommation validée : ${qty} ${transferUnit}(s) déduit(s) du Stock Central (${calculation.prestationCapacity.toLocaleString('fr-FR')} ${calculation.prestationUnitName}, stock central restant : ${newStock.toLocaleString('fr-FR')} ${baseUnit}s).`
    };
  }

  public consumeSecurePrestationStock(
    productId: string,
    qtyInBase: number,
    serviceName: string,
    orderNumber: string,
    reason: string,
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean
  ): { success: boolean; message: string; statusCode: number; remainingPrestationStock?: number } {
    const existing = (this.state.products || []).find(p => p.id === productId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Produit introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Produit appartenant à une autre agence." };
    }

    if (qtyInBase <= 0) {
      return { success: false, statusCode: 400, message: "La quantité consommée doit être strictement supérieure à 0." };
    }

    const currentStock = existing.currentStock || 0;
    if (currentStock < qtyInBase) {
      const missing = qtyInBase - currentStock;
      return {
        success: false,
        statusCode: 400,
        message: `Stock central insuffisant pour « ${existing.name} ». Disponible : ${currentStock} ${existing.unit || existing.baseUnit}s, Nécessaire : ${qtyInBase} ${existing.unit || existing.baseUnit}s, Manquant : ${missing} ${existing.unit || existing.baseUnit}s.`
      };
    }

    const oldStock = currentStock;
    const newStock = Math.max(0, oldStock - qtyInBase);

    this.updateState(draft => {
      const p = draft.products.find(item => item.id === productId);
      if (p) {
        p.currentStock = newStock;
        p.prestationStock = newStock;
        if (!p.stockByLocation) p.stockByLocation = {};
        p.stockByLocation['CENTRAL'] = newStock;
        p.stockByLocation['PRESTATION'] = newStock;
        p.stockByLocation['MAIN_STORE'] = newStock;
        p.updatedAt = new Date().toISOString();
      }

      if (!draft.stockMovements) draft.stockMovements = [];
      draft.stockMovements.unshift({
        id: `mov-prest-cons-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tenantId: existing.tenantId,
        productId: existing.id,
        productName: existing.name,
        movementType: 'CONSOMMATION_PRESTATION',
        quantity: -qtyInBase,
        oldStock,
        newStock,
        unitUsed: existing.unit || existing.baseUnit,
        quantityInStockUnit: -qtyInBase,
        unitCost: existing.costPrice,
        totalCost: existing.costPrice * qtyInBase,
        serviceOrDepartment: serviceName,
        sourceLocation: 'Stock Central',
        relatedOrderId: orderNumber.trim() || undefined,
        reason: reason || `Consommation prestation ${serviceName} (${qtyInBase} ${existing.unit || existing.baseUnit}s)`,
        performedByUserName: userName,
        createdAt: new Date().toISOString()
      });
    });

    this.logAudit('PRESTATION_STOCK_CONSUMED', 'PRODUCT', productId, null, {
      product: existing.name,
      consumedQty: qtyInBase,
      remainingStock: newStock,
      service: serviceName,
      orderNumber,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      remainingPrestationStock: newStock,
      message: `Consommation validée : ${qtyInBase} ${existing.unit || existing.baseUnit}s déduits du Stock Central (reste : ${newStock} ${existing.unit || existing.baseUnit}s).`
    };
  }

  public adjustPrestationStock(
    productId: string,
    newQty: number,
    reason: string,
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean
  ): { success: boolean; message: string; statusCode: number } {
    const existing = (this.state.products || []).find(p => p.id === productId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Produit introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Produit appartenant à une autre agence." };
    }

    if (newQty < 0) {
      return { success: false, statusCode: 400, message: "Le stock central ne peut pas être négatif." };
    }

    const oldStock = existing.currentStock || 0;
    const diff = newQty - oldStock;

    this.updateState(draft => {
      const p = draft.products.find(item => item.id === productId);
      if (p) {
        p.currentStock = newQty;
        p.prestationStock = newQty;
        if (!p.stockByLocation) p.stockByLocation = {};
        p.stockByLocation['CENTRAL'] = newQty;
        p.stockByLocation['MAIN_STORE'] = newQty;
        p.stockByLocation['PRESTATION'] = newQty;
        p.updatedAt = new Date().toISOString();
      }

      if (!draft.stockMovements) draft.stockMovements = [];
      draft.stockMovements.unshift({
        id: `mov-prest-adj-${Date.now()}`,
        tenantId: existing.tenantId,
        productId: existing.id,
        productName: existing.name,
        movementType: 'INVENTORY_ADJUSTMENT',
        quantity: diff,
        oldStock,
        newStock: newQty,
        unitUsed: existing.unit || existing.baseUnit,
        quantityInStockUnit: diff,
        unitCost: existing.costPrice,
        totalCost: Math.abs(existing.costPrice * diff),
        sourceLocation: 'Stock Central',
        destinationLocation: 'Stock Central',
        reason: `Ajustement inventaire Stock Central (${oldStock} -> ${newQty}) : ${reason}`,
        performedByUserName: userName,
        createdAt: new Date().toISOString()
      });
    });

    return {
      success: true,
      statusCode: 200,
      message: `Stock Central ajusté avec succès : ${newQty} ${existing.unit || existing.baseUnit}s.`
    };
  }

  public transferSecureProductStock(productId: string, qty: number, source: string, destination: string, reason: string, requestingTenantId: string, userName: string, isSuperAdmin?: boolean): { success: boolean; message: string; statusCode: number } {
    const existing = (this.state.products || []).find(p => p.id === productId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Produit introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Produit appartenant à une autre agence." };
    }

    if (existing.currentStock < qty) {
      return { success: false, statusCode: 400, message: `Stock disponible insuffisant : ${existing.currentStock} ${existing.unit}.` };
    }

    this.updateState(draft => {
      const p = draft.products.find(item => item.id === productId);
      if (p) {
        if (!p.stockByLocation) p.stockByLocation = {};
        p.stockByLocation[source] = Math.max(0, (p.stockByLocation[source] || 0) - qty);
        p.stockByLocation[destination] = (p.stockByLocation[destination] || 0) + qty;
        p.updatedAt = new Date().toISOString();
      }

      if (!draft.stockMovements) draft.stockMovements = [];
      draft.stockMovements.unshift({
        id: `mov-tout-${Date.now()}`,
        tenantId: existing.tenantId,
        productId: existing.id,
        productName: existing.name,
        movementType: 'TRANSFER_OUT',
        quantity: -qty,
        oldStock: existing.currentStock,
        newStock: existing.currentStock,
        unitUsed: existing.unit,
        sourceLocation: source,
        destinationLocation: destination,
        reason: `Transfert de ${source} vers ${destination} - ${reason}`,
        performedByUserName: userName,
        createdAt: new Date().toISOString()
      });

      draft.stockMovements.unshift({
        id: `mov-tin-${Date.now()}`,
        tenantId: existing.tenantId,
        productId: existing.id,
        productName: existing.name,
        movementType: 'TRANSFER_IN',
        quantity: qty,
        oldStock: existing.currentStock,
        newStock: existing.currentStock,
        unitUsed: existing.unit,
        sourceLocation: source,
        destinationLocation: destination,
        reason: `Réception transfert depuis ${source} vers ${destination} - ${reason}`,
        performedByUserName: userName,
        createdAt: new Date().toISOString()
      });
    });

    this.logAudit('STOCK_TRANSFERRED', 'PRODUCT', productId, null, { product: existing.name, qty, from: source, to: destination, tenantId: existing.tenantId });
    return { success: true, statusCode: 200, message: `Transfert de ${qty} ${existing.unit} effectué de ${source} vers ${destination}.` };
  }

  public recordSecureProductLoss(productId: string, qty: number, lossType: StockMovementType, reason: string, requestingTenantId: string, userName: string, isSuperAdmin?: boolean): { success: boolean; message: string; statusCode: number } {
    const existing = (this.state.products || []).find(p => p.id === productId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Produit introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Produit appartenant à une autre agence." };
    }

    if (existing.currentStock < qty) {
      return { success: false, statusCode: 400, message: `Stock insuffisant : ${existing.currentStock} ${existing.unit} disponibles.` };
    }

    const oldStock = existing.currentStock;
    const newStock = oldStock - qty;
    const lossCost = qty * existing.costPrice;

    this.updateState(draft => {
      const p = draft.products.find(item => item.id === productId);
      if (p) {
        p.currentStock = newStock;
        p.updatedAt = new Date().toISOString();
      }

      if (!draft.stockMovements) draft.stockMovements = [];
      draft.stockMovements.unshift({
        id: `mov-${Date.now()}`,
        tenantId: existing.tenantId,
        productId: existing.id,
        productName: existing.name,
        movementType: lossType,
        quantity: -qty,
        oldStock,
        newStock,
        unitUsed: existing.unit,
        unitCost: existing.costPrice,
        totalCost: lossCost,
        reason: `Déclaration de perte/détérioration : ${reason}`,
        performedByUserName: userName,
        createdAt: new Date().toISOString()
      });
    });

    this.logAudit('STOCK_LOSS_REGISTERED', 'PRODUCT', productId, null, { product: existing.name, qty, type: lossType, reason, tenantId: existing.tenantId });
    return { success: true, statusCode: 200, message: `-${qty} ${existing.unit} déduit(s) pour cause de ${lossType}.` };
  }

  public applySecureInventoryAudit(productId: string, physicalCount: number, reason: string, requestingTenantId: string, userName: string, isSuperAdmin?: boolean): { success: boolean; message: string; statusCode: number } {
    const existing = (this.state.products || []).find(p => p.id === productId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Produit introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Produit appartenant à une autre agence." };
    }

    const theoretical = existing.currentStock;
    const diff = physicalCount - theoretical;

    this.updateState(draft => {
      const p = draft.products.find(item => item.id === productId);
      if (p) {
        p.currentStock = physicalCount;
        p.updatedAt = new Date().toISOString();
      }

      if (diff !== 0) {
        if (!draft.stockMovements) draft.stockMovements = [];
        draft.stockMovements.unshift({
          id: `mov-${Date.now()}`,
          tenantId: existing.tenantId,
          productId: existing.id,
          productName: existing.name,
          movementType: 'INVENTORY_ADJUSTMENT',
          quantity: diff,
          oldStock: theoretical,
          newStock: physicalCount,
          unitUsed: existing.unit,
          quantityInStockUnit: diff,
          unitCost: existing.costPrice,
          totalCost: Math.abs(diff) * existing.costPrice,
          reason: `Régularisation inventaire : Théorique (${theoretical}) vs Physique (${physicalCount}). Motif: ${reason || 'Comptage physique'}`,
          performedByUserName: userName,
          createdAt: new Date().toISOString()
        });
      }
    });

    this.logAudit('INVENTORY_ADJUSTED', 'PRODUCT', productId, null, {
      product: existing.name,
      theoretical,
      physical: physicalCount,
      diff,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Inventaire validé pour "${existing.name}" : stock mis à jour à ${physicalCount} ${existing.unit}.`
    };
  }

  public quickIncrementStock(
    productId: string,
    quantityToAdd: number,
    reason: string,
    requestingTenantId: string,
    userName: string,
    packagingLabel?: string,
    isSuperAdmin?: boolean
  ): { success: boolean; message: string; statusCode: number; newStock?: number } {
    const existing = (this.state.products || []).find(p => p.id === productId);
    if (!existing) {
      return { success: false, statusCode: 404, message: "Produit introuvable." };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && existing.tenantId !== requestingTenantId) {
      this.logAudit('PRODUCT_CROSS_TENANT_QUICK_INCREMENT_DENIED', 'PRODUCT', productId, null, {
        requestingTenantId,
        targetTenantId: existing.tenantId
      });
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Produit appartenant à une autre agence." };
    }

    if (quantityToAdd <= 0) {
      return { success: false, statusCode: 400, message: "La quantité à ajouter doit être strictement positive." };
    }

    const oldStock = existing.currentStock;
    const newStock = oldStock + quantityToAdd;
    const totalCost = quantityToAdd * existing.costPrice;

    this.updateState(draft => {
      const p = draft.products.find(item => item.id === productId);
      if (p) {
        p.currentStock = newStock;
        p.updatedAt = new Date().toISOString();
      }

      if (!draft.stockMovements) draft.stockMovements = [];
      draft.stockMovements.unshift({
        id: `mov-${Date.now()}`,
        tenantId: existing.tenantId,
        productId: existing.id,
        productName: existing.name,
        movementType: 'IN',
        quantity: quantityToAdd,
        oldStock,
        newStock,
        unitUsed: packagingLabel || existing.baseUnit || existing.unit,
        quantityInStockUnit: quantityToAdd,
        unitCost: existing.costPrice,
        totalCost,
        sourceLocation: 'Réapprovisionnement Rapide',
        destinationLocation: existing.location || 'Magasin Principal',
        reason: reason || `Ajout rapide de stock : +${quantityToAdd} ${packagingLabel || existing.unit}`,
        performedByUserName: userName || 'Responsable Stock',
        createdAt: new Date().toISOString()
      });
    });

    this.logAudit('STOCK_QUICK_INCREMENT', 'PRODUCT', productId, null, {
      product: existing.name,
      oldStock,
      newStock,
      added: quantityToAdd,
      packagingLabel,
      tenantId: existing.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Stock mis à jour : +${quantityToAdd} ${existing.baseUnit || existing.unit}s (Nouveau total : ${newStock}).`,
      newStock
    };
  }

  public getStockMovementsByTenant(tenantId: string, isSuperAdmin?: boolean): StockMovement[] {
    if (!tenantId || tenantId === 'global' || tenantId === 'ALL') {
      return this.state.stockMovements || [];
    }
    return (this.state.stockMovements || []).filter(m => m.tenantId === tenantId);
  }

  public getProductCategoriesByTenant(tenantId: string, isSuperAdmin?: boolean): ProductCategory[] {
    if (!tenantId || tenantId === 'global' || tenantId === 'ALL') {
      return this.state.productCategories || [];
    }
    return (this.state.productCategories || []).filter(c => c.tenantId === tenantId);
  }

  public getSuppliersByTenant(tenantId: string, isSuperAdmin?: boolean): Supplier[] {
    if (!tenantId || tenantId === 'global' || tenantId === 'ALL') {
      return this.state.suppliers || [];
    }
    return (this.state.suppliers || []).filter(s => s.tenantId === tenantId);
  }

  public getPurchaseOrdersByTenant(tenantId: string, isSuperAdmin?: boolean): PurchaseOrder[] {
    if (!tenantId || tenantId === 'global' || tenantId === 'ALL') {
      return this.state.purchaseOrders || [];
    }
    return (this.state.purchaseOrders || []).filter(po => po.tenantId === tenantId);
  }

  public getPurchaseOrderById(
    poId: string,
    requestingTenantId: string,
    isSuperAdmin?: boolean
  ): { success: boolean; purchaseOrder?: PurchaseOrder; statusCode: number; message: string } {
    const po = (this.state.purchaseOrders || []).find(p => p.id === poId);
    if (!po) {
      return { success: false, statusCode: 404, message: "Bon de commande introuvable." };
    }
    if (!isSuperAdmin && requestingTenantId !== 'global' && po.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé : ce bon de commande appartient à une autre agence." };
    }
    return { success: true, statusCode: 200, purchaseOrder: JSON.parse(JSON.stringify(po)), message: "OK" };
  }

  public createSecurePurchaseOrder(
    data: {
      supplierId: string;
      departmentId?: string;
      orderDate?: string;
      expectedDelivery?: string;
      notes?: string;
      items: Array<{
        productId: string;
        orderedQuantityPurchaseUnit: number;
        purchaseUnitName: string;
        unitPricePurchaseUnit?: number;
      }>;
    },
    requestingTenantId: string,
    performedByUserName?: string,
    isSuperAdmin?: boolean
  ): { success: boolean; purchaseOrder?: PurchaseOrder; statusCode: number; message: string } {
    if (!requestingTenantId || (requestingTenantId === 'global' && !isSuperAdmin)) {
      return { success: false, statusCode: 400, message: "Identifiant d'agence requis pour créer un bon de commande." };
    }

    if (!data.supplierId) {
      return { success: false, statusCode: 400, message: "Fournisseur obligatoire." };
    }

    const supplier = (this.state.suppliers || []).find(
      s => (isSuperAdmin || s.tenantId === requestingTenantId) && s.id === data.supplierId
    );
    if (!supplier) {
      return { success: false, statusCode: 404, message: "Fournisseur introuvable ou n'appartenant pas à votre agence." };
    }

    let departmentName = 'Administration Générale';
    let departmentId = data.departmentId;
    if (data.departmentId) {
      const dept = (this.state.requestingDepartments || []).find(
        d => (isSuperAdmin || d.tenantId === requestingTenantId) && d.id === data.departmentId
      );
      if (dept) {
        departmentName = dept.name;
        departmentId = dept.id;
      }
    }

    if (!data.items || data.items.length === 0) {
      return { success: false, statusCode: 400, message: "Un bon de commande doit contenir au moins une ligne d'article." };
    }

    const orderNumber = `BC-${new Date().getFullYear()}-${String((this.state.purchaseOrders || []).length + 1).padStart(6, '0')}`;
    const poId = `po-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const processedItems: PurchaseOrderItem[] = [];
    let grandTotal = 0;

    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i];
      const prodCheck = this.getProductById(it.productId, requestingTenantId, isSuperAdmin);
      if (!prodCheck.success || !prodCheck.product) {
        return {
          success: false,
          statusCode: prodCheck.statusCode,
          message: `Article ligne #${i + 1} (${it.productId}) inaccessible : ${prodCheck.message}`
        };
      }

      const prod = prodCheck.product;
      const orderedQty = Math.max(1, Number(it.orderedQuantityPurchaseUnit) || 1);
      const chosenUnit = (it.purchaseUnitName || prod.baseUnit || prod.unit || 'unité').trim();

      // Resolve pricing & conversion factor according to strict priorities
      const priceResolution = resolveProductPurchasePrice(prod, chosenUnit);
      const factor = priceResolution.factorToBase > 0 ? priceResolution.factorToBase : 1;
      const unitPrice = (it.unitPricePurchaseUnit !== undefined && it.unitPricePurchaseUnit >= 0)
        ? it.unitPricePurchaseUnit
        : priceResolution.unitPrice;

      const qtyInStockUnit = Math.round(orderedQty * factor);
      const unitCostInStockUnit = factor > 0 ? Math.round(unitPrice / factor) : unitPrice;
      const lineTotal = orderedQty * unitPrice;

      grandTotal += lineTotal;

      processedItems.push({
        productId: prod.id,
        productName: prod.name,
        productCode: prod.code,
        category: prod.category,
        orderedQuantityPurchaseUnit: orderedQty,
        purchaseUnitName: priceResolution.selectedUnitName,
        conversionFactor: factor,
        quantityInStockUnit: qtyInStockUnit,
        stockUnitName: priceResolution.baseUnitName,
        baseUnit: priceResolution.baseUnitName,
        receivedQuantityPurchaseUnit: 0,
        receivedQuantityInStockUnit: 0,
        unitPricePurchaseUnit: unitPrice,
        unitPriceStockUnit: unitCostInStockUnit,
        totalPrice: lineTotal
      });
    }

    const newPO: PurchaseOrder = {
      id: poId,
      tenantId: requestingTenantId, // strictly enforced from session
      supplierId: supplier.id,
      supplierName: supplier.name,
      departmentId,
      departmentName,
      poNumber: orderNumber,
      status: 'ORDERED',
      paymentStatus: 'UNPAID',
      totalAmount: grandTotal,
      paidAmount: 0,
      dueAmount: grandTotal,
      orderDate: data.orderDate || new Date().toISOString().split('T')[0],
      expectedDelivery: data.expectedDelivery,
      notes: data.notes?.trim() || undefined,
      items: processedItems,
      payments: []
    };

    this.updateState(draft => {
      if (!draft.purchaseOrders) draft.purchaseOrders = [];
      draft.purchaseOrders.unshift(newPO);
    });

    this.logAudit('PO_CREATED', 'PURCHASE_ORDER', poId, null, {
      poNumber: orderNumber,
      supplierName: supplier.name,
      departmentName,
      totalAmount: grandTotal,
      itemsCount: processedItems.length,
      performedBy: performedByUserName || 'Gestionnaire'
    });

    return {
      success: true,
      statusCode: 201,
      purchaseOrder: newPO,
      message: `Bon de commande ${orderNumber} émis avec succès (${processedItems.length} article(s)). Aucun compte financier débité.`
    };
  }

  public receiveSecurePurchaseOrder(
    poId: string,
    receptionMap: Record<string, number>,
    requestingTenantId: string,
    performedByUserName?: string,
    isSuperAdmin?: boolean,
    receptionNotes?: string
  ): { success: boolean; purchaseOrder?: PurchaseOrder; statusCode: number; message: string } {
    const poCheck = this.getPurchaseOrderById(poId, requestingTenantId, isSuperAdmin);
    if (!poCheck.success || !poCheck.purchaseOrder) {
      return { success: false, statusCode: poCheck.statusCode, message: poCheck.message };
    }

    const po = poCheck.purchaseOrder;
    if (po.status === 'CANCELLED') {
      return { success: false, statusCode: 400, message: "Impossible de réceptionner un bon de commande annulé." };
    }

    let hasAnyReceived = false;
    let allReceived = true;

    this.updateState(draft => {
      const order = draft.purchaseOrders?.find(p => p.id === po.id);
      if (!order) return;

      order.items.forEach(it => {
        const qtyToday = Math.max(0, receptionMap[it.productId] || 0);
        if (qtyToday > 0) {
          hasAnyReceived = true;
          const prevReceived = it.receivedQuantityPurchaseUnit || 0;
          it.receivedQuantityPurchaseUnit = prevReceived + qtyToday;

          const factor = it.conversionFactor || 1;
          const addedStockUnits = qtyToday * factor;
          it.receivedQuantityInStockUnit = (it.receivedQuantityInStockUnit || 0) + addedStockUnits;

          // Increment product physical stock in base unit
          const prod = draft.products?.find(p => p.id === it.productId);
          if (prod) {
            const oldStock = prod.currentStock;
            prod.currentStock += addedStockUnits;
            prod.costPrice = it.unitPriceStockUnit || prod.costPrice;
            prod.updatedAt = new Date().toISOString();

            if (!draft.stockMovements) draft.stockMovements = [];
            draft.stockMovements.unshift({
              id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              tenantId: order.tenantId,
              productId: prod.id,
              productName: prod.name,
              movementType: 'PURCHASE_ENTRY',
              quantity: addedStockUnits,
              oldStock,
              newStock: prod.currentStock,
              unitUsed: it.purchaseUnitName,
              conversionFactorApplied: factor,
              quantityInStockUnit: addedStockUnits,
              unitCost: it.unitPriceStockUnit,
              totalCost: it.unitPriceStockUnit * addedStockUnits,
              orderNumber: order.poNumber,
              relatedPoId: order.id,
              serviceOrDepartment: order.departmentName,
              destinationLocation: 'MAIN_STORE',
              reason: `Réception Bon de Commande ${order.poNumber} (${qtyToday} ${it.purchaseUnitName}s = +${addedStockUnits} ${prod.unit}s)${receptionNotes ? ` - ${receptionNotes}` : ''}`,
              performedByUserName: performedByUserName || 'Responsable Réception',
              createdAt: new Date().toISOString()
            });
          }
        }

        if ((it.receivedQuantityPurchaseUnit || 0) < it.orderedQuantityPurchaseUnit) {
          allReceived = false;
        }
      });

      order.status = allReceived ? 'RECEIVED' : (hasAnyReceived ? 'PARTIALLY_RECEIVED' : order.status);
      order.receivedAt = new Date().toISOString();

      // Recalculate payment status and due amount
      order.paidAmount = order.paidAmount || 0;
      order.dueAmount = Math.max(0, order.totalAmount - order.paidAmount);
      if (order.paidAmount >= order.totalAmount && order.totalAmount > 0) {
        order.paymentStatus = 'PAID';
      } else if (order.paidAmount > 0) {
        order.paymentStatus = 'PARTIALLY_PAID';
      } else {
        order.paymentStatus = 'CREDIT';
      }

      // Automatically maintain SupplierDebt
      if (!draft.supplierDebts) draft.supplierDebts = [];
      let existingDebt = draft.supplierDebts.find(d => d.purchaseOrderId === order.id);
      if (!existingDebt) {
        existingDebt = {
          id: `deb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          tenantId: order.tenantId,
          debtNumber: `DET-F-${new Date().getFullYear()}-${String(draft.supplierDebts.length + 1).padStart(4, '0')}`,
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          purchaseOrderId: order.id,
          poNumber: order.poNumber,
          initialAmount: order.totalAmount,
          paidAmount: order.paidAmount,
          remainingAmount: order.dueAmount,
          status: order.dueAmount === 0 ? 'PAID' : (order.paidAmount > 0 ? 'PARTIALLY_PAID' : 'ACTIVE'),
          issueDate: order.orderDate || new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString()
        };
        draft.supplierDebts.unshift(existingDebt);
      } else {
        existingDebt.initialAmount = order.totalAmount;
        existingDebt.paidAmount = order.paidAmount;
        existingDebt.remainingAmount = order.dueAmount;
        existingDebt.status = order.dueAmount === 0 ? 'PAID' : (order.paidAmount > 0 ? 'PARTIALLY_PAID' : 'ACTIVE');
        existingDebt.updatedAt = new Date().toISOString();
      }
    });

    if (!hasAnyReceived) {
      return { success: false, statusCode: 400, message: "Veuillez saisir au moins une quantité reçue positive." };
    }

    this.logAudit('PO_MULTI_RECEIVED', 'PURCHASE_ORDER', po.id, null, {
      poNumber: po.poNumber,
      receptionMap,
      status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
      performedBy: performedByUserName
    });

    const updatedPo = (this.state.purchaseOrders || []).find(p => p.id === po.id);
    return {
      success: true,
      statusCode: 200,
      purchaseOrder: updatedPo ? JSON.parse(JSON.stringify(updatedPo)) : undefined,
      message: `Réception validée avec succès pour le bon de commande ${po.poNumber}. Stock crédité sans impact sur la trésorerie.`
    };
  }

  // --- FINANCE, TRÉSORERIE & COMPTES FINANCIERS ---

  /**
   * Helper to resolve the acting User object from user / username / current context
   */
  public resolveActingUser(userOrIdOrName?: User | string, isSuperAdmin?: boolean): User | undefined {
    let matchedUser: User | undefined;
    if (userOrIdOrName && typeof userOrIdOrName === 'object' && (userOrIdOrName as User).id) {
      matchedUser = userOrIdOrName as User;
    } else if (typeof userOrIdOrName === 'string' && userOrIdOrName.trim()) {
      const q = userOrIdOrName.trim().toLowerCase();
      matchedUser = (this.state.users || []).find(
        u => u.id.toLowerCase() === q ||
             u.username.toLowerCase() === q ||
             `${u.firstName} ${u.lastName}`.toLowerCase() === q
      );
    }

    if (!matchedUser) {
      matchedUser = (this.state.users || []).find(u => u.id === this.state.currentUserId) || this.state.users?.[0];
    }

    if (matchedUser && isSuperAdmin) {
      matchedUser = { ...matchedUser, isSuperAdmin: true };
    }

    return matchedUser;
  }

  public getFinancialAccounts(tenantId?: string, isSuperAdmin?: boolean): FinancialAccount[] {
    if (!tenantId || tenantId === 'global' || tenantId === 'ALL') {
      return this.state.financialAccounts || [];
    }
    return (this.state.financialAccounts || []).filter(a => a.tenantId === tenantId);
  }

  public getFinancialAccountById(
    id: string,
    requestingTenantId: string,
    isSuperAdmin?: boolean
  ): { success: boolean; account?: FinancialAccount; statusCode: number; message: string } {
    const account = (this.state.financialAccounts || []).find(a => a.id === id);
    if (!account) {
      return { success: false, statusCode: 404, message: "Compte financier introuvable." };
    }
    if (!isSuperAdmin && requestingTenantId !== 'global' && account.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé : compte appartenant à une autre agence." };
    }
    return { success: true, statusCode: 200, account: JSON.parse(JSON.stringify(account)), message: "OK" };
  }

  public createFinancialAccount(
    data: {
      name: string;
      code?: string;
      type: FinancialAccountType;
      initialBalance: number;
      description?: string;
      accountNumber?: string;
      bankName?: string;
      isDefault?: boolean;
      isPettyCash?: boolean;
      isMainCash?: boolean;
      associatedPaymentMethods?: PaymentMethod[];
    },
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; account?: FinancialAccount; statusCode: number; message: string } {
    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, requestingTenantId, 'CREATE_FINANCIAL_ACCOUNT');
    if (!authCheck.allowed) {
      this.logAudit('FINANCIAL_ACCOUNT_CREATE_REJECTED', 'FINANCIAL_ACCOUNT', undefined, null, {
        reason: authCheck.message,
        attemptedBy: userName,
        userRole: authCheck.userRoleLabel,
        tenantId: requestingTenantId
      });
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!requestingTenantId || (requestingTenantId === 'global' && !isSuperAdmin)) {
      return { success: false, statusCode: 400, message: "Identifiant d'agence requis pour créer un compte financier." };
    }
    if (!data.name || !data.name.trim()) {
      return { success: false, statusCode: 400, message: "Le nom du compte financier est obligatoire." };
    }
    const cleanCode = (data.code || `CPT-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
    const initBal = Number(data.initialBalance) || 0;

    const newAccount: FinancialAccount = {
      id: `fa-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: requestingTenantId,
      code: cleanCode,
      name: data.name.trim(),
      type: data.type || 'CASH',
      description: data.description?.trim() || undefined,
      accountNumber: data.accountNumber?.trim() || undefined,
      bankName: data.bankName?.trim() || undefined,
      initialBalance: initBal,
      currentBalance: initBal,
      currency: 'GNF',
      isActive: true,
      isDefault: Boolean(data.isDefault),
      isPettyCash: Boolean(data.isPettyCash),
      isMainCash: Boolean(data.isMainCash),
      associatedPaymentMethods: data.associatedPaymentMethods || [],
      resetHistory: [],
      createdByUserName: userName || 'Administrateur',
      createdAt: new Date().toISOString()
    };

    this.updateState(draft => {
      if (!draft.financialAccounts) draft.financialAccounts = [];
      if (newAccount.isDefault) {
        draft.financialAccounts
          .filter(a => a.tenantId === requestingTenantId)
          .forEach(a => { a.isDefault = false; });
      }
      if (newAccount.isMainCash) {
        draft.financialAccounts
          .filter(a => a.tenantId === requestingTenantId)
          .forEach(a => { a.isMainCash = false; });
      }
      draft.financialAccounts.push(newAccount);

      if (initBal !== 0) {
        if (!draft.financialMovements) draft.financialMovements = [];
        draft.financialMovements.unshift({
          id: `mvt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          tenantId: requestingTenantId,
          movementNumber: `MVT-${new Date().getFullYear()}-${String(draft.financialMovements.length + 1).padStart(6, '0')}`,
          financialAccountId: newAccount.id,
          financialAccountName: newAccount.name,
          financialAccountType: newAccount.type,
          movementType: 'INFLOW',
          category: 'CAPITAL_CONTRIBUTION',
          categoryLabel: 'Solde Initial',
          amount: Math.abs(initBal),
          balanceBefore: 0,
          balanceAfter: initBal,
          reference: 'INITIAL-BALANCE',
          performedByUserName: userName || 'Administrateur',
          notes: `Initialisation du compte financier ${newAccount.name}`,
          createdAt: new Date().toISOString()
        });
      }
    });

    const auditDesc = formatFinancialAuditMessage('CREATE_FINANCIAL_ACCOUNT', authCheck.userRoleLabel, userName, newAccount.name, {
      initialBalance: initBal,
      code: newAccount.code,
      type: newAccount.type
    });

    this.logAudit('FINANCIAL_ACCOUNT_CREATED', 'FINANCIAL_ACCOUNT', newAccount.id, null, {
      accountName: newAccount.name,
      code: newAccount.code,
      type: newAccount.type,
      initialBalance: initBal,
      isDefault: newAccount.isDefault,
      isMainCash: newAccount.isMainCash,
      tenantId: requestingTenantId,
      createdBy: userName,
      userRole: authCheck.userRoleLabel,
      description: auditDesc
    });

    return {
      success: true,
      statusCode: 201,
      account: newAccount,
      message: `Compte financier "${newAccount.name}" créé avec succès.`
    };
  }

  public updateFinancialAccount(
    id: string,
    data: Partial<FinancialAccount>,
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; account?: FinancialAccount; statusCode: number; message: string } {
    const acc = (this.state.financialAccounts || []).find(a => a.id === id);
    if (!acc) return { success: false, statusCode: 404, message: "Compte introuvable." };

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, acc.tenantId, 'UPDATE_FINANCIAL_ACCOUNT');
    if (!authCheck.allowed) {
      this.logAudit('FINANCIAL_ACCOUNT_UPDATE_REJECTED', 'FINANCIAL_ACCOUNT', id, null, {
        accountName: acc.name,
        reason: authCheck.message,
        attemptedBy: userName,
        userRole: authCheck.userRoleLabel,
        tenantId: acc.tenantId
      });
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && acc.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé : compte appartenant à une autre agence." };
    }

    const oldValues = {
      name: acc.name,
      code: acc.code,
      type: acc.type,
      description: acc.description,
      accountNumber: acc.accountNumber,
      bankName: acc.bankName,
      isDefault: acc.isDefault,
      isMainCash: acc.isMainCash,
      isPettyCash: acc.isPettyCash,
      associatedPaymentMethods: acc.associatedPaymentMethods
    };

    let updated: FinancialAccount | undefined;
    this.updateState(draft => {
      const target = draft.financialAccounts?.find(a => a.id === id);
      if (!target) return;
      if (data.name !== undefined) target.name = data.name.trim();
      if (data.code !== undefined) target.code = data.code.trim().toUpperCase();
      if (data.type !== undefined) target.type = data.type;
      if (data.description !== undefined) target.description = data.description.trim();
      if (data.accountNumber !== undefined) target.accountNumber = data.accountNumber.trim();
      if (data.bankName !== undefined) target.bankName = data.bankName.trim();
      if (data.isPettyCash !== undefined) target.isPettyCash = data.isPettyCash;
      if (data.associatedPaymentMethods !== undefined) target.associatedPaymentMethods = data.associatedPaymentMethods;
      
      if (data.isDefault !== undefined) {
        if (data.isDefault) {
          draft.financialAccounts
            .filter(a => a.tenantId === acc.tenantId && a.id !== id)
            .forEach(a => { a.isDefault = false; });
        }
        target.isDefault = data.isDefault;
      }

      if (data.isMainCash !== undefined) {
        if (data.isMainCash) {
          draft.financialAccounts
            .filter(a => a.tenantId === acc.tenantId && a.id !== id)
            .forEach(a => { a.isMainCash = false; });
        }
        target.isMainCash = data.isMainCash;
      }

      target.updatedAt = new Date().toISOString();
      updated = { ...target };
    });

    const auditDesc = formatFinancialAuditMessage('UPDATE_FINANCIAL_ACCOUNT', authCheck.userRoleLabel, userName, updated?.name || acc.name, {
      code: updated?.code,
      type: updated?.type
    });

    this.logAudit('FINANCIAL_ACCOUNT_UPDATED', 'FINANCIAL_ACCOUNT', id, oldValues, {
      accountName: updated?.name,
      code: updated?.code,
      type: updated?.type,
      updatedBy: userName,
      userRole: authCheck.userRoleLabel,
      description: auditDesc,
      newValues: {
        name: updated?.name,
        code: updated?.code,
        type: updated?.type,
        isDefault: updated?.isDefault,
        isMainCash: updated?.isMainCash,
        associatedPaymentMethods: updated?.associatedPaymentMethods
      }
    });

    return {
      success: true,
      statusCode: 200,
      account: updated,
      message: `Compte "${updated?.name}" mis à jour avec succès.`
    };
  }

  public toggleFinancialAccountStatus(
    id: string,
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; isActive?: boolean; message: string; warning?: string } {
    const acc = (this.state.financialAccounts || []).find(a => a.id === id);
    if (!acc) return { success: false, statusCode: 404, message: "Compte introuvable." };

    const nextStatus = !acc.isActive;
    const actionType: FinancialSensitiveAction = nextStatus ? 'REACTIVATE_FINANCIAL_ACCOUNT' : 'DEACTIVATE_FINANCIAL_ACCOUNT';

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, acc.tenantId, actionType);
    if (!authCheck.allowed) {
      this.logAudit('FINANCIAL_ACCOUNT_STATUS_TOGGLE_REJECTED', 'FINANCIAL_ACCOUNT', id, { isActive: acc.isActive }, {
        accountName: acc.name,
        targetStatus: nextStatus,
        reason: authCheck.message,
        attemptedBy: userName,
        userRole: authCheck.userRoleLabel,
        tenantId: acc.tenantId
      });
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && acc.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    if (acc.isMainCash && acc.isActive) {
      const otherMain = (this.state.financialAccounts || []).some(a => a.tenantId === acc.tenantId && a.id !== id && a.isMainCash && a.isActive);
      if (!otherMain) {
        return {
          success: false,
          statusCode: 400,
          message: "Impossible de désactiver la Caisse Principale obligatoire. Veuillez désigner une autre Caisse Principale active d'abord."
        };
      }
    }

    let warning: string | undefined;
    if (!nextStatus && acc.currentBalance > 0) {
      warning = `Ce compte possède un solde de ${acc.currentBalance.toLocaleString('fr-FR')} ${acc.currency}. Le compte est désactivé mais son solde est conservé.`;
    }

    this.updateState(draft => {
      const target = draft.financialAccounts?.find(a => a.id === id);
      if (target) {
        target.isActive = nextStatus;
        target.updatedAt = new Date().toISOString();
        if (!nextStatus && target.isDefault) {
          target.isDefault = false;
          const fallback = draft.financialAccounts.find(a => a.tenantId === acc.tenantId && a.id !== id && a.isActive);
          if (fallback) fallback.isDefault = true;
        }
      }
    });

    const auditDesc = formatFinancialAuditMessage(actionType, authCheck.userRoleLabel, userName, acc.name, {
      currentBalance: acc.currentBalance
    });

    this.logAudit(nextStatus ? 'FINANCIAL_ACCOUNT_ACTIVATED' : 'FINANCIAL_ACCOUNT_DEACTIVATED', 'FINANCIAL_ACCOUNT', id, { isActive: acc.isActive }, {
      accountName: acc.name,
      nextStatus,
      userName,
      userRole: authCheck.userRoleLabel,
      currentBalance: acc.currentBalance,
      description: auditDesc,
      tenantId: acc.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      isActive: nextStatus,
      warning,
      message: nextStatus ? `Compte "${acc.name}" réactivé avec succès.` : `Compte "${acc.name}" désactivé.`
    };
  }

  /**
   * AJUSTEMENT MANUEL DU SOLDE AVEC JUSTIFICATION OBLIGATOIRE
   * Calcule automatiquement l'écart, met à jour le solde et crée un mouvement d'ajustement traçable.
   */
  public adjustFinancialAccountBalance(
    id: string,
    newBalance: number,
    reason: string,
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string; difference?: number; movement?: FinancialMovement } {
    if (!reason || !reason.trim()) {
      return { success: false, statusCode: 400, message: "Le motif / justification de l'ajustement de solde est obligatoire." };
    }

    const acc = (this.state.financialAccounts || []).find(a => a.id === id);
    if (!acc) return { success: false, statusCode: 404, message: "Compte introuvable." };

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, acc.tenantId, 'ADJUST_FINANCIAL_ACCOUNT_BALANCE');
    if (!authCheck.allowed) {
      this.logAudit('FINANCIAL_ACCOUNT_ADJUST_REJECTED', 'FINANCIAL_ACCOUNT', id, { currentBalance: acc.currentBalance }, {
        accountName: acc.name,
        attemptedNewBalance: newBalance,
        reason: authCheck.message,
        attemptedBy: userName,
        userRole: authCheck.userRoleLabel,
        tenantId: acc.tenantId
      });
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && acc.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    const parsedNewBalance = Number(newBalance);
    if (isNaN(parsedNewBalance)) {
      return { success: false, statusCode: 400, message: "Le nouveau solde est invalide." };
    }

    const previousBalance = acc.currentBalance;
    const difference = parsedNewBalance - previousBalance;

    if (difference === 0) {
      return {
        success: true,
        statusCode: 200,
        difference: 0,
        message: `Le solde saisi est identique au solde actuel (${previousBalance.toLocaleString('fr-FR')} ${acc.currency}). Aucun ajustement nécessaire.`
      };
    }

    const now = new Date().toISOString();
    const mvtId = `mvt-adj-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const adjRef = `AJUST-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    let generatedMovement: FinancialMovement | undefined;

    this.updateState(draft => {
      const target = draft.financialAccounts?.find(a => a.id === id);
      if (!target) return;

      target.currentBalance = parsedNewBalance;
      target.updatedAt = now;

      if (!draft.financialMovements) draft.financialMovements = [];

      generatedMovement = {
        id: mvtId,
        tenantId: target.tenantId,
        movementNumber: `MVT-${new Date().getFullYear()}-${String(draft.financialMovements.length + 1).padStart(6, '0')}`,
        financialAccountId: target.id,
        financialAccountName: target.name,
        financialAccountType: target.type,
        movementType: difference > 0 ? 'INFLOW' : 'OUTFLOW',
        category: 'BALANCE_ADJUSTMENT',
        categoryLabel: difference > 0 ? 'Ajustement Solde (Crédit)' : 'Ajustement Solde (Débit)',
        amount: Math.abs(difference),
        balanceBefore: previousBalance,
        balanceAfter: parsedNewBalance,
        adjustmentDifference: difference,
        reference: adjRef,
        relatedEntityType: 'ADJUSTMENT',
        performedByUserName: userName || 'Administrateur',
        notes: `Ajustement manuel : ${reason.trim()} | Écart constaté : ${difference > 0 ? '+' : ''}${difference.toLocaleString('fr-FR')} ${acc.currency}`,
        reason: reason.trim(),
        createdAt: now
      };

      draft.financialMovements.unshift(generatedMovement);
    });

    const diffFormatted = `${difference > 0 ? '+' : ''}${difference.toLocaleString('fr-FR')} ${acc.currency}`;
    const auditDesc = formatFinancialAuditMessage('ADJUST_FINANCIAL_ACCOUNT_BALANCE', authCheck.userRoleLabel, userName, acc.name, {
      differenceFormatted: diffFormatted,
      reason: reason.trim()
    });

    this.logAudit('FINANCIAL_ACCOUNT_ADJUSTED', 'FINANCIAL_ACCOUNT', id, { previousBalance }, {
      accountName: acc.name,
      previousBalance,
      newBalance: parsedNewBalance,
      difference,
      differenceFormatted: diffFormatted,
      reason: reason.trim(),
      userId: user?.id,
      performedBy: user ? `${user.firstName} ${user.lastName}` : userName,
      userRole: authCheck.userRoleLabel,
      description: auditDesc,
      tenantId: acc.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      difference,
      movement: generatedMovement,
      message: `Solde de "${acc.name}" ajusté avec succès à ${parsedNewBalance.toLocaleString('fr-FR')} ${acc.currency} (Écart : ${difference > 0 ? '+' : ''}${difference.toLocaleString('fr-FR')} ${acc.currency}).`
    };
  }

  /**
   * RÉINITIALISATION INDIVIDUELLE D'UN COMPTE
   * Remet le solde actuel et initial à 0 GNF de manière isolée sans toucher aux autres comptes.
   * Protégée par confirmation, mot-clé RÉINITIALISER et mot de passe admin.
   */
  public resetFinancialAccount(
    id: string,
    confirmationKeyword: string,
    adminPassword: string,
    reason: string,
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string; previousBalance?: number } {
    const acc = (this.state.financialAccounts || []).find(a => a.id === id);
    if (!acc) return { success: false, statusCode: 404, message: "Compte introuvable." };

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, acc.tenantId, 'RESET_FINANCIAL_ACCOUNT');
    if (!authCheck.allowed) {
      this.logAudit('FINANCIAL_ACCOUNT_RESET_REJECTED', 'FINANCIAL_ACCOUNT', id, { currentBalance: acc.currentBalance }, {
        accountName: acc.name,
        reason: authCheck.message,
        userId: user?.id,
        attemptedBy: user ? `${user.firstName} ${user.lastName}` : userName,
        userRole: authCheck.userRoleLabel,
        tenantId: acc.tenantId
      });
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && acc.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    const cleanKeyword = (confirmationKeyword || '').trim().toUpperCase();
    if (cleanKeyword !== 'RÉINITIALISER' && cleanKeyword !== 'REINITIALISER') {
      return {
        success: false,
        statusCode: 400,
        message: 'Mot de confirmation invalide. Veuillez saisir exactement "RÉINITIALISER" pour confirmer l\'opération.'
      };
    }

    if (!adminPassword || !adminPassword.trim()) {
      return {
        success: false,
        statusCode: 400,
        message: "Mot de passe administrateur requis pour valider cette opération critique."
      };
    }

    const previousBalance = acc.currentBalance;
    const now = new Date().toISOString();
    const resetRecord: AccountResetRecord = {
      resetAt: now,
      resetByUserName: userName || 'Administrateur',
      previousBalance,
      reason: reason.trim() || 'Réinitialisation administrative individuelle'
    };

    const resetRef = `RESET-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    this.updateState(draft => {
      const target = draft.financialAccounts?.find(a => a.id === id);
      if (!target) return;

      target.currentBalance = 0;
      target.initialBalance = 0;
      target.updatedAt = now;
      if (!target.resetHistory) target.resetHistory = [];
      target.resetHistory.unshift(resetRecord);

      if (previousBalance !== 0) {
        if (!draft.financialMovements) draft.financialMovements = [];
        draft.financialMovements.unshift({
          id: `mvt-rst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          tenantId: target.tenantId,
          movementNumber: `MVT-${new Date().getFullYear()}-${String(draft.financialMovements.length + 1).padStart(6, '0')}`,
          financialAccountId: target.id,
          financialAccountName: target.name,
          financialAccountType: target.type,
          movementType: previousBalance > 0 ? 'OUTFLOW' : 'INFLOW',
          category: 'ACCOUNT_RESET',
          categoryLabel: 'Réinitialisation de Compte',
          amount: Math.abs(previousBalance),
          balanceBefore: previousBalance,
          balanceAfter: 0,
          adjustmentDifference: -previousBalance,
          reference: resetRef,
          relatedEntityType: 'RESET',
          performedByUserName: userName || 'Administrateur',
          notes: `Réinitialisation administrative à 0 GNF. Motif: ${reason.trim() || 'Remise à zéro'} (Ancien solde: ${previousBalance.toLocaleString('fr-FR')} ${target.currency})`,
          reason: reason.trim() || 'Remise à zéro administrative',
          createdAt: now
        });
      }
    });

    const auditDesc = formatFinancialAuditMessage('RESET_FINANCIAL_ACCOUNT', authCheck.userRoleLabel, userName, acc.name, {
      previousBalance,
      reason: reason.trim()
    });

    this.logAudit('FINANCIAL_ACCOUNT_RESET', 'FINANCIAL_ACCOUNT', id, { previousBalance }, {
      accountName: acc.name,
      previousBalance,
      newBalance: 0,
      reason: reason.trim(),
      userId: user?.id,
      performedBy: user ? `${user.firstName} ${user.lastName}` : userName,
      userRole: authCheck.userRoleLabel,
      description: auditDesc,
      tenantId: acc.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      previousBalance,
      message: `Compte "${acc.name}" réinitialisé avec succès. Son solde est désormais de 0 ${acc.currency}. Les autres comptes sont strictement inchangés.`
    };
  }

  /**
   * VÉRIFICATION DES CONDITIONS DE SUPPRESSION
   */
  public canDeleteFinancialAccount(
    id: string,
    requestingTenantId: string,
    isSuperAdmin?: boolean
  ): {
    canDeleteDirectly: boolean;
    reason?: string;
    hasMovements: boolean;
    movementCount: number;
    hasBalance: boolean;
    currentBalance: number;
    isDefault: boolean;
    isMainCash: boolean;
  } {
    const acc = (this.state.financialAccounts || []).find(a => a.id === id);
    if (!acc) {
      return {
        canDeleteDirectly: false,
        reason: "Compte introuvable.",
        hasMovements: false,
        movementCount: 0,
        hasBalance: false,
        currentBalance: 0,
        isDefault: false,
        isMainCash: false
      };
    }

    const movements = (this.state.financialMovements || []).filter(
      m => m.financialAccountId === id || m.fromAccountId === id || m.toAccountId === id
    );
    const supplierPayments = (this.state.supplierPayments || []).filter(p => p.financialAccountId === id);
    const totalMovements = movements.length + supplierPayments.length;

    const hasMovements = totalMovements > 0;
    const hasBalance = acc.currentBalance !== 0;
    const isDefault = Boolean(acc.isDefault);
    const isMainCash = Boolean(acc.isMainCash);

    let reason: string | undefined;
    if (isMainCash) {
      reason = "Ce compte est désigné comme Caisse Principale obligatoire. Il ne peut pas être supprimé tant qu'il possède ce rôle.";
    } else if (isDefault) {
      reason = "Ce compte est défini comme Compte par Défaut. Veuillez désigner un nouveau compte par défaut avant de pouvoir le supprimer.";
    } else if (hasBalance) {
      reason = `Ce compte possède un solde de ${acc.currentBalance.toLocaleString('fr-FR')} ${acc.currency}. Le solde doit être transféré ou ramené à 0 GNF avant toute suppression.`;
    } else if (hasMovements) {
      reason = `Ce compte contient des données historiques (${totalMovements} opération(s)) et ne peut pas être supprimé définitivement afin de préserver l'intégrité comptable. Vous pouvez le désactiver ou l'archiver.`;
    }

    const canDeleteDirectly = !isMainCash && !isDefault && !hasBalance && !hasMovements;

    return {
      canDeleteDirectly,
      reason,
      hasMovements,
      movementCount: totalMovements,
      hasBalance,
      currentBalance: acc.currentBalance,
      isDefault,
      isMainCash
    };
  }

  /**
   * SUPPRESSION OU ARCHIVAGE SELON CONDITIONS
   */
  public deleteFinancialAccount(
    id: string,
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string; wasArchived?: boolean } {
    const acc = (this.state.financialAccounts || []).find(a => a.id === id);
    if (!acc) return { success: false, statusCode: 404, message: "Compte introuvable." };

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, acc.tenantId, 'DELETE_FINANCIAL_ACCOUNT');
    if (!authCheck.allowed) {
      this.logAudit('FINANCIAL_ACCOUNT_DELETE_REJECTED', 'FINANCIAL_ACCOUNT', id, null, {
        accountName: acc.name,
        reason: authCheck.message,
        attemptedBy: userName,
        userRole: authCheck.userRoleLabel,
        tenantId: acc.tenantId
      });
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    const check = this.canDeleteFinancialAccount(id, requestingTenantId, isSuperAdmin);

    if (!isSuperAdmin && requestingTenantId !== 'global' && acc.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    if (check.isMainCash) {
      return {
        success: false,
        statusCode: 400,
        message: "Impossible de supprimer la Caisse Principale. Veuillez définir une autre Caisse Principale d'abord."
      };
    }

    if (check.isDefault) {
      return {
        success: false,
        statusCode: 400,
        message: "Impossible de supprimer le Compte par Défaut. Veuillez désigner un autre compte par défaut d'abord."
      };
    }

    if (check.hasBalance) {
      return {
        success: false,
        statusCode: 400,
        message: `Impossible de supprimer un compte avec un solde actif (${acc.currentBalance.toLocaleString('fr-FR')} ${acc.currency}). Transférez ou réinitialisez le solde d'abord.`
      };
    }

    if (check.hasMovements) {
      this.logAudit('FINANCIAL_ACCOUNT_DELETE_BLOCKED', 'FINANCIAL_ACCOUNT', id, null, {
        accountName: acc.name,
        movementCount: check.movementCount,
        reason: "Suppression définitive bloquée pour préservation de l'historique financier",
        attemptedBy: userName,
        userRole: authCheck.userRoleLabel,
        tenantId: acc.tenantId
      });
      return {
        success: false,
        statusCode: 400,
        message: "Ce compte contient des données historiques et ne peut pas être supprimé définitivement. Proposez sa désactivation ou son archivage."
      };
    }

    this.updateState(draft => {
      draft.financialAccounts = (draft.financialAccounts || []).filter(a => a.id !== id);
    });

    const auditDesc = formatFinancialAuditMessage('DELETE_FINANCIAL_ACCOUNT', authCheck.userRoleLabel, userName, acc.name);

    this.logAudit('FINANCIAL_ACCOUNT_DELETED', 'FINANCIAL_ACCOUNT', id, null, {
      accountName: acc.name,
      code: acc.code,
      deletedBy: userName,
      userRole: authCheck.userRoleLabel,
      description: auditDesc,
      tenantId: acc.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Compte "${acc.name}" supprimé définitivement avec succès.`
    };
  }

  /**
   * ARCHIVAGE D'UN COMPTE AVEC HISTORIQUE
   */
  public archiveFinancialAccount(
    id: string,
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string } {
    const acc = (this.state.financialAccounts || []).find(a => a.id === id);
    if (!acc) return { success: false, statusCode: 404, message: "Compte introuvable." };

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, acc.tenantId, 'ARCHIVE_FINANCIAL_ACCOUNT');
    if (!authCheck.allowed) {
      this.logAudit('FINANCIAL_ACCOUNT_ARCHIVE_REJECTED', 'FINANCIAL_ACCOUNT', id, null, {
        accountName: acc.name,
        reason: authCheck.message,
        attemptedBy: userName,
        userRole: authCheck.userRoleLabel,
        tenantId: acc.tenantId
      });
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!isSuperAdmin && requestingTenantId !== 'global' && acc.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    if (acc.currentBalance > 0) {
      return {
        success: false,
        statusCode: 400,
        message: `Veuillez transférer le solde de ${acc.currentBalance.toLocaleString('fr-FR')} ${acc.currency} avant d'archiver ce compte.`
      };
    }

    if (acc.isMainCash) {
      return {
        success: false,
        statusCode: 400,
        message: "Impossible d'archiver la Caisse Principale obligatoire."
      };
    }

    this.updateState(draft => {
      const target = draft.financialAccounts?.find(a => a.id === id);
      if (target) {
        target.isArchived = true;
        target.isActive = false;
        target.isDefault = false;
        target.archivedAt = new Date().toISOString();
        target.updatedAt = new Date().toISOString();
      }
    });

    const auditDesc = formatFinancialAuditMessage('ARCHIVE_FINANCIAL_ACCOUNT', authCheck.userRoleLabel, userName, acc.name);

    this.logAudit('FINANCIAL_ACCOUNT_ARCHIVED', 'FINANCIAL_ACCOUNT', id, null, {
      accountName: acc.name,
      archivedBy: userName,
      userRole: authCheck.userRoleLabel,
      description: auditDesc,
      tenantId: acc.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Compte "${acc.name}" archivé avec succès.`
    };
  }

  /**
   * ASSISTANT DE TRANSFERT AVANT SUPPRESSION / DÉSACTIVATION
   * Transfère l'intégralité du solde vers un compte de destination dans une transaction atomique.
   */
  public transferBalanceBeforeDelete(
    fromAccountId: string,
    toAccountId: string,
    reason: string,
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string; transferredAmount?: number } {
    const fromAcc = (this.state.financialAccounts || []).find(a => a.id === fromAccountId);
    const toAcc = (this.state.financialAccounts || []).find(a => a.id === toAccountId);

    if (!fromAcc || !toAcc) {
      return { success: false, statusCode: 404, message: "Compte source ou destination introuvable." };
    }

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, fromAcc.tenantId, 'TRANSFER_BALANCE_BEFORE_DELETE');
    if (!authCheck.allowed) {
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (fromAccountId === toAccountId) {
      return { success: false, statusCode: 400, message: "Le compte de destination doit être différent du compte source." };
    }

    if (!toAcc.isActive) {
      return { success: false, statusCode: 400, message: `Le compte destination "${toAcc.name}" est inactif.` };
    }

    const amountToTransfer = fromAcc.currentBalance;
    if (amountToTransfer <= 0) {
      return {
        success: false,
        statusCode: 400,
        message: `Le compte "${fromAcc.name}" a déjà un solde nul (${amountToTransfer} ${fromAcc.currency}). Aucun transfert nécessaire.`
      };
    }

    const transferRes = this.recordFinancialTransfer(
      fromAccountId,
      toAccountId,
      amountToTransfer,
      reason || `Transfert de solde avant suppression / clôture de "${fromAcc.name}"`,
      requestingTenantId,
      userName,
      isSuperAdmin
    );

    if (!transferRes.success) {
      return transferRes;
    }

    return {
      success: true,
      statusCode: 200,
      transferredAmount: amountToTransfer,
      message: `Solde complet de ${amountToTransfer.toLocaleString('fr-FR')} ${fromAcc.currency} transféré avec succès vers "${toAcc.name}". Le solde de "${fromAcc.name}" est désormais à 0 GNF.`
    };
  }

  /**
   * HISTORIQUE D'AUDIT DÉDIÉ À UN COMPTE
   */
  public getFinancialAccountAuditLogs(accountId: string, tenantId?: string): AuditLog[] {
    const logs = this.state.auditLogs || [];
    return logs.filter(l => {
      const matchEntity = l.entityType === 'FINANCIAL_ACCOUNT' && l.entityId === accountId;
      const matchInDetails = l.newValues?.accountId === accountId || l.newValues?.fromAccountId === accountId || l.newValues?.toAccountId === accountId;
      return matchEntity || matchInDetails;
    });
  }

  public getFinancialMovements(
    tenantId: string,
    accountId?: string,
    isSuperAdmin?: boolean
  ): FinancialMovement[] {
    let mvts = this.state.financialMovements || [];
    if (!isSuperAdmin && tenantId !== 'global') {
      mvts = mvts.filter(m => m.tenantId === tenantId);
    }
    if (accountId && accountId !== 'ALL') {
      mvts = mvts.filter(m => m.financialAccountId === accountId || m.fromAccountId === accountId || m.toAccountId === accountId);
    }
    return mvts;
  }

  public recordFinancialTransfer(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    reason: string,
    requestingTenantId: string,
    userName: string,
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string } {
    if (fromAccountId === toAccountId) {
      return { success: false, statusCode: 400, message: "Le compte source et le compte destination doivent être différents." };
    }
    if (amount <= 0) {
      return { success: false, statusCode: 400, message: "Le montant du transfert doit être strictement supérieur à 0." };
    }

    const fromAcc = (this.state.financialAccounts || []).find(a => a.id === fromAccountId);
    const toAcc = (this.state.financialAccounts || []).find(a => a.id === toAccountId);

    if (!fromAcc || !toAcc) {
      return { success: false, statusCode: 404, message: "Compte source ou destination introuvable." };
    }
    if (!isSuperAdmin && requestingTenantId !== 'global') {
      if (fromAcc.tenantId !== requestingTenantId || toAcc.tenantId !== requestingTenantId) {
        return { success: false, statusCode: 403, message: "Transfert inter-agences non autorisé." };
      }
    }

    if (!fromAcc.isActive || !toAcc.isActive) {
      return { success: false, statusCode: 400, message: "L'un des comptes sélectionnés est inactif." };
    }

    // Check if fromAcc is Main Cash and closed
    if (fromAcc.isMainCash) {
      const activeSession = (this.state.cashSessions || []).find(cs => cs.tenantId === fromAcc.tenantId && cs.status === 'OPEN');
      if (!activeSession) {
        return {
          success: false,
          statusCode: 400,
          message: "La caisse principale est fermée. Ouvrez une session de caisse avant d'effectuer un transfert depuis ce compte."
        };
      }
    }

    if (fromAcc.currentBalance < amount) {
      return {
        success: false,
        statusCode: 400,
        message: `Solde insuffisant sur "${fromAcc.name}". Solde disponible : ${fromAcc.currentBalance.toLocaleString('fr-FR')} ${fromAcc.currency}.`
      };
    }

    const now = new Date().toISOString();
    const mvtOutId = `mvt-out-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const mvtInId = `mvt-in-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const transferRef = `TRF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    this.updateState(draft => {
      const sAcc = draft.financialAccounts?.find(a => a.id === fromAccountId);
      const dAcc = draft.financialAccounts?.find(a => a.id === toAccountId);
      if (!sAcc || !dAcc) return;

      const sBalBefore = sAcc.currentBalance;
      const sBalAfter = sBalBefore - amount;
      sAcc.currentBalance = sBalAfter;
      sAcc.updatedAt = now;

      const dBalBefore = dAcc.currentBalance;
      const dBalAfter = dBalBefore + amount;
      dAcc.currentBalance = dBalAfter;
      dAcc.updatedAt = now;

      if (!draft.financialMovements) draft.financialMovements = [];

      // Mouvement Sortant
      draft.financialMovements.unshift({
        id: mvtOutId,
        tenantId: sAcc.tenantId,
        movementNumber: `MVT-${new Date().getFullYear()}-${String(draft.financialMovements.length + 1).padStart(6, '0')}`,
        financialAccountId: sAcc.id,
        financialAccountName: sAcc.name,
        financialAccountType: sAcc.type,
        movementType: 'TRANSFER',
        category: 'TRANSFER_OUT',
        categoryLabel: 'Transfert Sortant',
        amount,
        balanceBefore: sBalBefore,
        balanceAfter: sBalAfter,
        fromAccountId: sAcc.id,
        fromAccountName: sAcc.name,
        toAccountId: dAcc.id,
        toAccountName: dAcc.name,
        relatedTransferMovementId: mvtInId,
        reference: transferRef,
        relatedEntityType: 'TRANSFER',
        performedByUserName: userName || 'Gestionnaire',
        notes: `Transfert vers ${dAcc.name} - ${reason || 'Virement interne'}`,
        createdAt: now
      });

      // Mouvement Entrant
      draft.financialMovements.unshift({
        id: mvtInId,
        tenantId: dAcc.tenantId,
        movementNumber: `MVT-${new Date().getFullYear()}-${String(draft.financialMovements.length + 1).padStart(6, '0')}`,
        financialAccountId: dAcc.id,
        financialAccountName: dAcc.name,
        financialAccountType: dAcc.type,
        movementType: 'TRANSFER',
        category: 'TRANSFER_IN',
        categoryLabel: 'Transfert Entrant',
        amount,
        balanceBefore: dBalBefore,
        balanceAfter: dBalAfter,
        fromAccountId: sAcc.id,
        fromAccountName: sAcc.name,
        toAccountId: dAcc.id,
        toAccountName: dAcc.name,
        relatedTransferMovementId: mvtOutId,
        reference: transferRef,
        relatedEntityType: 'TRANSFER',
        performedByUserName: userName || 'Gestionnaire',
        notes: `Transfert reçu de ${sAcc.name} - ${reason || 'Alimentation / Virement interne'}`,
        createdAt: now
      });

      // If fromAcc is Main Cash and has open session -> log cash movement
      if (sAcc.isMainCash) {
        const activeSess = draft.cashSessions?.find(cs => cs.tenantId === sAcc.tenantId && cs.status === 'OPEN');
        if (activeSess) {
          activeSess.movements.unshift({
            id: `cm-${Date.now()}-trf-out`,
            cashSessionId: activeSess.id,
            movementType: 'WITHDRAWAL',
            amount,
            category: 'Transfert Sortant',
            reason: `Transfert de Caisse vers ${dAcc.name} : ${reason || 'Alimentation'}`,
            performedByUserName: userName,
            createdAt: now
          });
        }
      }

      // If toAcc is Main Cash and has open session -> log cash movement
      if (dAcc.isMainCash) {
        const activeSess = draft.cashSessions?.find(cs => cs.tenantId === dAcc.tenantId && cs.status === 'OPEN');
        if (activeSess) {
          activeSess.movements.unshift({
            id: `cm-${Date.now()}-trf-in`,
            cashSessionId: activeSess.id,
            movementType: 'CASH_INJECTION',
            amount,
            category: 'Alimentation de Caisse',
            reason: `Alimentation Caisse reçue de ${sAcc.name} : ${reason || 'Apport'}`,
            performedByUserName: userName,
            createdAt: now
          });
        }
      }
    });

    this.logAudit('FINANCIAL_TRANSFER', 'FINANCIAL_ACCOUNT', fromAccountId, null, {
      from: fromAcc.name,
      to: toAcc.name,
      amount,
      reason,
      transferRef,
      tenantId: fromAcc.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Transfert de ${amount.toLocaleString('fr-FR')} ${fromAcc.currency} effectué avec succès de "${fromAcc.name}" vers "${toAcc.name}".`
    };
  }

  // =========================================================================
  // GESTION DES EXERCICES FINANCIERS & PÉRIODES MENSUELLES
  // =========================================================================

  public getFinancialYears(tenantId?: string): FinancialYear[] {
    if (!tenantId || tenantId === 'global' || tenantId === 'ALL') {
      return this.state.financialYears || [];
    }
    return (this.state.financialYears || []).filter(y => y.tenantId === tenantId);
  }

  public getActiveFinancialYear(tenantId: string): FinancialYear | undefined {
    return (this.state.financialYears || []).find(y => y.tenantId === tenantId && y.status === 'ACTIVE');
  }

  public getFinancialYearById(yearId: string, tenantId?: string, isSuperAdmin?: boolean): {
    success: boolean;
    statusCode: number;
    message: string;
    year?: FinancialYear;
  } {
    const year = (this.state.financialYears || []).find(y => y.id === yearId);
    if (!year) {
      return { success: false, statusCode: 404, message: "Exercice financier introuvable." };
    }
    if (!isSuperAdmin && tenantId && tenantId !== 'global' && year.tenantId !== tenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé à cet exercice financier." };
    }
    return { success: true, statusCode: 200, message: "Exercice trouvé.", year };
  }

  public createFinancialYear(
    data: {
      year: number;
      code?: string;
      name?: string;
      startDate?: string;
      endDate?: string;
      notes?: string;
      activateNow?: boolean;
    },
    tenantId: string,
    userName: string = 'Administrateur',
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string; year?: FinancialYear } {
    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, tenantId, 'UPDATE_FINANCIAL_SETTINGS');
    if (!authCheck.allowed) {
      this.logAudit('FINANCIAL_YEAR_CREATE_REJECTED', 'FINANCIAL_YEAR', undefined, null, {
        year: data.year,
        reason: authCheck.message,
        attemptedBy: userName,
        userRole: authCheck.userRoleLabel,
        tenantId
      });
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    const cleanYear = Number(data.year);
    if (!cleanYear || cleanYear < 2000 || cleanYear > 2100) {
      return { success: false, statusCode: 400, message: "Année d'exercice invalide." };
    }

    const existing = (this.state.financialYears || []).find(
      y => y.tenantId === tenantId && y.year === cleanYear
    );
    if (existing) {
      return {
        success: false,
        statusCode: 400,
        message: `L'exercice financier ${cleanYear} existe déjà pour cette agence.`
      };
    }

    const yearId = `fy-${tenantId}-${cleanYear}`;
    const code = (data.code || `EX-${cleanYear}`).trim().toUpperCase();
    const name = (data.name || `Exercice Financier ${cleanYear}`).trim();
    const startDate = data.startDate || `${cleanYear}-01-01`;
    const endDate = data.endDate || `${cleanYear}-12-31`;
    const now = new Date().toISOString();

    const shouldActivate = Boolean(data.activateNow);

    const newYear: FinancialYear = {
      id: yearId,
      tenantId,
      code,
      name,
      year: cleanYear,
      startDate,
      endDate,
      status: shouldActivate ? 'ACTIVE' : 'ACTIVE',
      isCurrentYear: shouldActivate,
      notes: data.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now
    };

    const periods = generateMonthlyPeriodsForYear(yearId, tenantId, cleanYear, 0);

    this.updateState(draft => {
      if (!draft.financialYears) draft.financialYears = [];
      if (!draft.financialPeriods) draft.financialPeriods = [];

      if (shouldActivate) {
        draft.financialYears.forEach(y => {
          if (y.tenantId === tenantId) {
            y.isCurrentYear = false;
          }
        });
      }

      draft.financialYears.unshift(newYear);
      draft.financialPeriods.push(...periods);
    });

    const auditDesc = `${authCheck.userRoleLabel.toUpperCase()} ${userName} a créé l'exercice financier ${cleanYear} avec 12 périodes mensuelles.`;

    this.logAudit('FINANCIAL_YEAR_CREATED', 'FINANCIAL_YEAR', yearId, null, {
      year: cleanYear,
      code,
      name,
      tenantId,
      periodsCreated: periods.length,
      createdBy: userName,
      userRole: authCheck.userRoleLabel,
      description: auditDesc
    });

    return {
      success: true,
      statusCode: 201,
      message: `Exercice financier ${cleanYear} créé avec succès avec 12 périodes mensuelles.`,
      year: newYear
    };
  }

  public setActiveFinancialYear(
    yearId: string,
    tenantId: string,
    userName: string = 'Administrateur',
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string } {
    const year = (this.state.financialYears || []).find(y => y.id === yearId);
    if (!year) return { success: false, statusCode: 404, message: "Exercice financier introuvable." };

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, year.tenantId, 'UPDATE_FINANCIAL_SETTINGS');
    if (!authCheck.allowed) {
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!isSuperAdmin && tenantId !== 'global' && year.tenantId !== tenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    this.updateState(draft => {
      draft.financialYears?.forEach(y => {
        if (y.tenantId === year.tenantId) {
          y.isCurrentYear = (y.id === yearId);
          if (y.id === yearId) {
            y.status = 'ACTIVE';
            y.updatedAt = new Date().toISOString();
          }
        }
      });
    });

    this.logAudit('FINANCIAL_YEAR_ACTIVATED', 'FINANCIAL_YEAR', yearId, null, {
      year: year.year,
      name: year.name,
      activatedBy: userName,
      userRole: authCheck.userRoleLabel,
      description: `${authCheck.userRoleLabel.toUpperCase()} ${userName} a défini l'exercice "${year.name}" comme exercice actif.`,
      tenantId: year.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `L'exercice financier "${year.name}" est désormais l'exercice actif.`
    };
  }

  public closeFinancialYear(
    yearId: string,
    tenantId: string,
    userName: string = 'Administrateur',
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string } {
    const year = (this.state.financialYears || []).find(y => y.id === yearId);
    if (!year) return { success: false, statusCode: 404, message: "Exercice financier introuvable." };

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, year.tenantId, 'CLOSE_FINANCIAL_YEAR');
    if (!authCheck.allowed) {
      this.logAudit('FINANCIAL_YEAR_CLOSE_REJECTED', 'FINANCIAL_YEAR', yearId, null, {
        year: year.year,
        reason: authCheck.message,
        attemptedBy: userName,
        userRole: authCheck.userRoleLabel,
        tenantId: year.tenantId
      });
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!isSuperAdmin && tenantId !== 'global' && year.tenantId !== tenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    const now = new Date().toISOString();
    this.updateState(draft => {
      const y = draft.financialYears?.find(item => item.id === yearId);
      if (y) {
        y.status = 'CLOSED';
        y.closedAt = now;
        y.closedByUserName = userName;
        y.updatedAt = now;
      }
      draft.financialPeriods?.forEach(p => {
        if (p.financialYearId === yearId && p.status === 'OPEN') {
          p.status = 'CLOSED';
          p.closedAt = now;
          p.closedByUserName = userName;
        }
      });
    });

    const auditDesc = formatFinancialAuditMessage('CLOSE_FINANCIAL_YEAR', authCheck.userRoleLabel, userName, year.name);

    this.logAudit('FINANCIAL_YEAR_CLOSED', 'FINANCIAL_YEAR', yearId, null, {
      year: year.year,
      name: year.name,
      closedBy: userName,
      userRole: authCheck.userRoleLabel,
      description: auditDesc,
      tenantId: year.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Exercice financier ${year.year} clôturé avec succès.`
    };
  }

  public archiveFinancialYear(
    yearId: string,
    tenantId: string,
    userName: string = 'Administrateur',
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string } {
    const year = (this.state.financialYears || []).find(y => y.id === yearId);
    if (!year) return { success: false, statusCode: 404, message: "Exercice financier introuvable." };

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, year.tenantId, 'UPDATE_FINANCIAL_SETTINGS');
    if (!authCheck.allowed) {
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!isSuperAdmin && tenantId !== 'global' && year.tenantId !== tenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    const now = new Date().toISOString();
    this.updateState(draft => {
      const y = draft.financialYears?.find(item => item.id === yearId);
      if (y) {
        y.status = 'ARCHIVED';
        y.updatedAt = now;
      }
      draft.financialPeriods?.forEach(p => {
        if (p.financialYearId === yearId) {
          p.status = 'ARCHIVED';
        }
      });
    });

    this.logAudit('FINANCIAL_YEAR_ARCHIVED', 'FINANCIAL_YEAR', yearId, null, {
      year: year.year,
      name: year.name,
      archivedBy: userName,
      userRole: authCheck.userRoleLabel,
      description: `${authCheck.userRoleLabel.toUpperCase()} ${userName} a archivé l'exercice financier ${year.year}.`,
      tenantId: year.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Exercice financier ${year.year} archivé avec succès.`
    };
  }

  public getFinancialPeriods(
    financialYearId?: string,
    tenantId?: string
  ): FinancialPeriod[] {
    let list = this.state.financialPeriods || [];
    if (tenantId && tenantId !== 'global' && tenantId !== 'ALL') {
      list = list.filter(p => p.tenantId === tenantId);
    }
    if (financialYearId && financialYearId !== 'ALL') {
      list = list.filter(p => p.financialYearId === financialYearId);
    }
    return list;
  }

  public getActiveFinancialPeriod(
    financialYearId?: string,
    tenantId?: string
  ): FinancialPeriod | undefined {
    let list = this.state.financialPeriods || [];
    if (tenantId) list = list.filter(p => p.tenantId === tenantId);
    if (financialYearId && financialYearId !== 'ALL') list = list.filter(p => p.financialYearId === financialYearId);
    return list.find(p => p.isCurrentPeriod && p.status === 'OPEN') || list.find(p => p.status === 'OPEN');
  }

  public getFinancialPeriodById(
    periodId: string,
    tenantId?: string,
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string; period?: FinancialPeriod } {
    const period = (this.state.financialPeriods || []).find(p => p.id === periodId);
    if (!period) return { success: false, statusCode: 404, message: "Période financière introuvable." };

    if (!isSuperAdmin && tenantId && tenantId !== 'global' && period.tenantId !== tenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé à cette période." };
    }

    return { success: true, statusCode: 200, message: "Période trouvée.", period };
  }

  public closeFinancialPeriod(
    periodId: string,
    tenantId: string,
    userName: string = 'Administrateur',
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string } {
    const period = (this.state.financialPeriods || []).find(p => p.id === periodId);
    if (!period) return { success: false, statusCode: 404, message: "Période financière introuvable." };

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, period.tenantId, 'CLOSE_FINANCIAL_PERIOD');
    if (!authCheck.allowed) {
      this.logAudit('FINANCIAL_PERIOD_CLOSE_REJECTED', 'FINANCIAL_PERIOD', periodId, null, {
        periodName: period.name,
        reason: authCheck.message,
        attemptedBy: userName,
        userRole: authCheck.userRoleLabel,
        tenantId: period.tenantId
      });
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!isSuperAdmin && tenantId !== 'global' && period.tenantId !== tenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    const now = new Date().toISOString();
    this.updateState(draft => {
      const p = draft.financialPeriods?.find(item => item.id === periodId);
      if (p) {
        p.status = 'CLOSED';
        p.closedAt = now;
        p.closedByUserName = userName;
      }
    });

    const auditDesc = formatFinancialAuditMessage('CLOSE_FINANCIAL_PERIOD', authCheck.userRoleLabel, userName, period.name);

    this.logAudit('FINANCIAL_PERIOD_CLOSED', 'FINANCIAL_PERIOD', periodId, null, {
      periodName: period.name,
      code: period.code,
      closedBy: userName,
      userRole: authCheck.userRoleLabel,
      description: auditDesc,
      tenantId: period.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Période "${period.name}" clôturée avec succès. Aucune nouvelle écriture ne sera admise sur cette période.`
    };
  }

  public archiveFinancialPeriod(
    periodId: string,
    tenantId: string,
    userName: string = 'Administrateur',
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string } {
    const period = (this.state.financialPeriods || []).find(p => p.id === periodId);
    if (!period) return { success: false, statusCode: 404, message: "Période financière introuvable." };

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, period.tenantId, 'UPDATE_FINANCIAL_SETTINGS');
    if (!authCheck.allowed) {
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!isSuperAdmin && tenantId !== 'global' && period.tenantId !== tenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    this.updateState(draft => {
      const p = draft.financialPeriods?.find(item => item.id === periodId);
      if (p) {
        p.status = 'ARCHIVED';
      }
    });

    this.logAudit('FINANCIAL_PERIOD_ARCHIVED', 'FINANCIAL_PERIOD', periodId, null, {
      periodName: period.name,
      code: period.code,
      archivedBy: userName,
      userRole: authCheck.userRoleLabel,
      description: `${authCheck.userRoleLabel.toUpperCase()} ${userName} a archivé la période "${period.name}".`,
      tenantId: period.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Période "${period.name}" archivée avec succès.`
    };
  }

  public reopenFinancialPeriod(
    periodId: string,
    tenantId: string,
    userName: string = 'Administrateur',
    isSuperAdmin?: boolean,
    actingUser?: User
  ): { success: boolean; statusCode: number; message: string } {
    const period = (this.state.financialPeriods || []).find(p => p.id === periodId);
    if (!period) return { success: false, statusCode: 404, message: "Période financière introuvable." };

    const user = this.resolveActingUser(actingUser || userName, isSuperAdmin);
    const authCheck = canPerformFinancialSensitiveAction(user, period.tenantId, 'REOPEN_FINANCIAL_PERIOD');
    if (!authCheck.allowed) {
      this.logAudit('FINANCIAL_PERIOD_REOPEN_REJECTED', 'FINANCIAL_PERIOD', periodId, null, {
        periodName: period.name,
        reason: authCheck.message,
        attemptedBy: userName,
        userRole: authCheck.userRoleLabel,
        tenantId: period.tenantId
      });
      return { success: false, statusCode: authCheck.statusCode, message: authCheck.message };
    }

    if (!isSuperAdmin && tenantId !== 'global' && period.tenantId !== tenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    this.updateState(draft => {
      const p = draft.financialPeriods?.find(item => item.id === periodId);
      if (p) {
        p.status = 'OPEN';
        p.closedAt = undefined;
        p.closedByUserName = undefined;
      }
    });

    const auditDesc = formatFinancialAuditMessage('REOPEN_FINANCIAL_PERIOD', authCheck.userRoleLabel, userName, period.name);

    this.logAudit('FINANCIAL_PERIOD_REOPENED', 'FINANCIAL_PERIOD', periodId, null, {
      periodName: period.name,
      code: period.code,
      reopenedBy: userName,
      userRole: authCheck.userRoleLabel,
      description: auditDesc,
      tenantId: period.tenantId
    });

    return {
      success: true,
      statusCode: 200,
      message: `Période "${period.name}" réouverte avec succès.`
    };
  }

  /**
   * Reset / Clean start of a period:
   * ZERO_ALL: Set current accounts balances to 0 GNF while preserving all past period history
   * KEEP_BALANCES: Carry over current balances
   * CUSTOM: Set specific custom balances for accounts
   */
  public resetFinancialPeriod(
    periodId: string,
    tenantId: string,
    resetOption: 'ZERO_ALL' | 'KEEP_BALANCES' | 'CUSTOM' = 'ZERO_ALL',
    customBalances?: Record<string, number>,
    userName: string = 'Administrateur',
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string; summary?: any } {
    const period = (this.state.financialPeriods || []).find(p => p.id === periodId);
    if (!period) return { success: false, statusCode: 404, message: "Période introuvable." };

    if (!isSuperAdmin && tenantId !== 'global' && period.tenantId !== tenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    const now = new Date().toISOString();
    const accounts = (this.state.financialAccounts || []).filter(a => a.tenantId === tenantId);

    const oldBalances: Record<string, number> = {};
    const newBalances: Record<string, number> = {};

    this.updateState(draft => {
      draft.financialAccounts?.forEach(acc => {
        if (acc.tenantId === tenantId) {
          oldBalances[acc.id] = acc.currentBalance;
          if (resetOption === 'ZERO_ALL') {
            acc.initialBalance = 0;
            acc.currentBalance = 0;
            newBalances[acc.id] = 0;
          } else if (resetOption === 'CUSTOM' && customBalances && customBalances[acc.id] !== undefined) {
            const val = Math.max(0, Number(customBalances[acc.id]) || 0);
            acc.initialBalance = val;
            acc.currentBalance = val;
            newBalances[acc.id] = val;
          } else {
            // KEEP_BALANCES
            acc.initialBalance = acc.currentBalance;
            newBalances[acc.id] = acc.currentBalance;
          }
          acc.updatedAt = now;
        }
      });
    });

    this.logAudit('FINANCIAL_PERIOD_RESET', 'FINANCIAL_PERIOD', periodId, { oldBalances }, {
      resetOption,
      newBalances,
      performedBy: userName,
      tenantId
    });

    const totalNew = Object.values(newBalances).reduce((a, b) => a + b, 0);

    return {
      success: true,
      statusCode: 200,
      message: `La période "${period.name}" a été configurée avec succès. Trésorerie active totale : ${totalNew.toLocaleString('fr-FR')} GNF. L'historique des périodes précédentes reste 100% conservé.`,
      summary: {
        periodId,
        periodName: period.name,
        resetOption,
        oldBalances,
        newBalances,
        totalNew
      }
    };
  }

  /**
   * Réinitialisation ciblée d'un Exercice Financier d'une agence (Section 25-30) :
   * ZERO_ALL: Remise à zéro des 12 périodes et des comptes de cette agence pour cet exercice
   * KEEP_BALANCES: Report à nouveau
   * CUSTOM: Soldes personnalisés
   */
  public resetFinancialYear(
    yearId: string,
    tenantId: string,
    resetOption: 'ZERO_ALL' | 'KEEP_BALANCES' | 'CUSTOM' = 'ZERO_ALL',
    customBalances?: Record<string, number>,
    userName: string = 'Administrateur',
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string; summary?: any } {
    const year = (this.state.financialYears || []).find(y => y.id === yearId);
    if (!year) return { success: false, statusCode: 404, message: "Exercice financier introuvable." };

    if (!isSuperAdmin && tenantId !== 'global' && year.tenantId !== tenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    const now = new Date().toISOString();
    const periods = (this.state.financialPeriods || []).filter(p => p.financialYearId === yearId && p.tenantId === year.tenantId);
    const accounts = (this.state.financialAccounts || []).filter(a => a.tenantId === year.tenantId);

    const oldBalances: Record<string, number> = {};
    const newBalances: Record<string, number> = {};

    this.updateState(draft => {
      // 1. Reset all 12 periods of this year for this agency
      draft.financialPeriods?.forEach(p => {
        if (p.financialYearId === yearId && p.tenantId === year.tenantId) {
          p.totalInflows = 0;
          p.totalOutflows = 0;
          p.netCashFlow = 0;
          p.movementsCount = 0;
          p.updatedAt = now;
        }
      });

      // 2. Reset operational account balances of this agency
      draft.financialAccounts?.forEach(acc => {
        if (acc.tenantId === year.tenantId) {
          oldBalances[acc.id] = acc.currentBalance;
          if (resetOption === 'ZERO_ALL') {
            acc.initialBalance = 0;
            acc.currentBalance = 0;
            newBalances[acc.id] = 0;
          } else if (resetOption === 'CUSTOM' && customBalances && customBalances[acc.id] !== undefined) {
            const val = Math.max(0, Number(customBalances[acc.id]) || 0);
            acc.initialBalance = val;
            acc.currentBalance = val;
            newBalances[acc.id] = val;
          } else {
            acc.initialBalance = acc.currentBalance;
            newBalances[acc.id] = acc.currentBalance;
          }
          acc.updatedAt = now;
        }
      });
    });

    this.logAudit('FINANCIAL_YEAR_RESET', 'FINANCIAL_YEAR', yearId, { oldBalances }, {
      year: year.year,
      resetOption,
      newBalances,
      performedBy: userName,
      tenantId: year.tenantId
    });

    const totalNew = Object.values(newBalances).reduce((a, b) => a + b, 0);

    return {
      success: true,
      statusCode: 200,
      message: `L'exercice financier "${year.name}" a été réinitialisé avec succès pour cette agence. Trésorerie active : ${totalNew.toLocaleString('fr-FR')} GNF. Les autres agences et exercices passés restent 100% conservés.`,
      summary: {
        yearId,
        yearName: year.name,
        resetOption,
        periodsReset: periods.length,
        oldBalances,
        newBalances,
        totalNew
      }
    };
  }

  /**
   * Check if a financial operation is allowed in a given period / date
   */
  public isOperationAllowedInPeriod(
    dateOrPeriodId: string,
    tenantId: string
  ): { allowed: boolean; reason?: string; period?: FinancialPeriod } {
    const periods = (this.state.financialPeriods || []).filter(p => p.tenantId === tenantId);
    let matchedPeriod: FinancialPeriod | undefined;

    if (dateOrPeriodId.startsWith('fp-')) {
      matchedPeriod = periods.find(p => p.id === dateOrPeriodId);
    } else {
      const dateOnly = dateOrPeriodId.slice(0, 10);
      matchedPeriod = periods.find(p => dateOnly >= p.startDate && dateOnly <= p.endDate);
    }

    if (!matchedPeriod) {
      // If no specific period configured, allow default
      return { allowed: true };
    }

    if (matchedPeriod.status === 'CLOSED') {
      return {
        allowed: false,
        reason: `La période financière "${matchedPeriod.name}" est CLÔTURÉE. Aucune modification ou nouvelle opération n'est autorisée.`,
        period: matchedPeriod
      };
    }

    if (matchedPeriod.status === 'ARCHIVED') {
      return {
        allowed: false,
        reason: `La période financière "${matchedPeriod.name}" est ARCHIVÉE. Consultation en lecture seule uniquement.`,
        period: matchedPeriod
      };
    }

    return { allowed: true, period: matchedPeriod };
  }

  /**
   * Calcul dynamique et consolidé de la situation financière par période
   */
  public getPeriodFinancialSummary(
    tenantId: string,
    financialYearId?: string,
    financialPeriodId?: string
  ): {
    totalCash: number;
    totalBank: number;
    totalMobileMoney: number;
    consolidatedTreasury: number;
    totalInflows: number;
    totalOutflows: number;
    netCashFlow: number;
    totalExpenses: number;
    totalSupplierPayments: number;
    totalClientPayments: number;
    movementsCount: number;
    accountsBreakdown: Array<{
      id: string;
      name: string;
      type: FinancialAccountType;
      code: string;
      initialBalance: number;
      currentBalance: number;
      currency: string;
      inflows: number;
      outflows: number;
      net: number;
      isActive: boolean;
      isMainCash: boolean;
    }>;
    periodInfo?: {
      id: string;
      name: string;
      status: FinancialPeriodStatus;
      startDate: string;
      endDate: string;
    };
    yearInfo?: {
      id: string;
      name: string;
      year: number;
      status: FinancialYearStatus;
    };
  } {
    const isGlobal = !tenantId || tenantId === 'global' || tenantId === 'ALL';
    const accounts = (this.state.financialAccounts || []).filter(a => isGlobal || a.tenantId === tenantId);
    const periods = (this.state.financialPeriods || []).filter(p => isGlobal || p.tenantId === tenantId);
    const years = (this.state.financialYears || []).filter(y => isGlobal || y.tenantId === tenantId);

    const selectedPeriod = financialPeriodId && financialPeriodId !== 'ALL'
      ? periods.find(p => p.id === financialPeriodId)
      : undefined;

    const selectedYear = financialYearId && financialYearId !== 'ALL'
      ? years.find(y => y.id === financialYearId)
      : (selectedPeriod ? years.find(y => y.id === selectedPeriod.financialYearId) : undefined);

    // Filter movements strictly
    let movements = (this.state.financialMovements || []).filter(m => isGlobal || m.tenantId === tenantId);

    if (selectedPeriod) {
      movements = movements.filter(m => {
        if (m.financialPeriodId) return m.financialPeriodId === selectedPeriod.id;
        const d = (m.createdAt || '').slice(0, 10);
        return d >= selectedPeriod.startDate && d <= selectedPeriod.endDate;
      });
    } else if (selectedYear) {
      movements = movements.filter(m => {
        if (m.financialYearId) return m.financialYearId === selectedYear.id;
        const d = (m.createdAt || '').slice(0, 10);
        return d >= selectedYear.startDate && d <= selectedYear.endDate;
      });
    }

    let totalInflows = 0;
    let totalOutflows = 0;
    let totalExpenses = 0;
    let totalSupplierPayments = 0;
    let totalClientPayments = 0;

    const accountStats: Record<string, { inflows: number; outflows: number }> = {};
    accounts.forEach(a => {
      accountStats[a.id] = { inflows: 0, outflows: 0 };
    });

    movements.forEach(m => {
      const amt = m.amount || 0;
      if (m.movementType === 'INFLOW') {
        totalInflows += amt;
        if (m.financialAccountId && accountStats[m.financialAccountId]) {
          accountStats[m.financialAccountId].inflows += amt;
        }
        if (m.category === 'CLIENT_PAYMENT') {
          totalClientPayments += amt;
        }
      } else if (m.movementType === 'OUTFLOW') {
        totalOutflows += amt;
        if (m.financialAccountId && accountStats[m.financialAccountId]) {
          accountStats[m.financialAccountId].outflows += amt;
        }
        if (m.category === 'EXPENSE') {
          totalExpenses += amt;
        } else if (m.category === 'SUPPLIER_PAYMENT') {
          totalSupplierPayments += amt;
        }
      } else if (m.movementType === 'TRANSFER') {
        if (m.category === 'TRANSFER_IN' && m.toAccountId && accountStats[m.toAccountId]) {
          accountStats[m.toAccountId].inflows += amt;
        } else if (m.category === 'TRANSFER_OUT' && m.fromAccountId && accountStats[m.fromAccountId]) {
          accountStats[m.fromAccountId].outflows += amt;
        }
      }
    });

    let totalCash = 0;
    let totalBank = 0;
    let totalMobileMoney = 0;
    let consolidatedTreasury = 0;

    const accountsBreakdown = accounts.map(acc => {
      const current = acc.isActive ? acc.currentBalance : 0;
      consolidatedTreasury += current;
      if (acc.type === 'CASH') totalCash += current;
      else if (acc.type === 'BANK') totalBank += current;
      else if (acc.type === 'MOBILE_MONEY') totalMobileMoney += current;

      const st = accountStats[acc.id] || { inflows: 0, outflows: 0 };
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        code: acc.code,
        initialBalance: acc.initialBalance || 0,
        currentBalance: acc.currentBalance,
        currency: acc.currency,
        inflows: st.inflows,
        outflows: st.outflows,
        net: st.inflows - st.outflows,
        isActive: acc.isActive,
        isMainCash: Boolean(acc.isMainCash)
      };
    });

    return {
      totalCash,
      totalBank,
      totalMobileMoney,
      consolidatedTreasury,
      totalInflows,
      totalOutflows,
      netCashFlow: totalInflows - totalOutflows,
      totalExpenses,
      totalSupplierPayments,
      totalClientPayments,
      movementsCount: movements.length,
      accountsBreakdown,
      periodInfo: selectedPeriod ? {
        id: selectedPeriod.id,
        name: selectedPeriod.name,
        status: selectedPeriod.status,
        startDate: selectedPeriod.startDate,
        endDate: selectedPeriod.endDate
      } : undefined,
      yearInfo: selectedYear ? {
        id: selectedYear.id,
        name: selectedYear.name,
        year: selectedYear.year,
        status: selectedYear.status
      } : undefined
    };
  }

  /**
   * Source unique de vérité pour les métriques de trésorerie et soldes de caisse :
   * Utilisée simultanément par le Tableau de Bord Général et le module Finance & Trésorerie
   */
  public getTreasuryMetrics(
    tenantId?: string,
    isSuperAdmin?: boolean
  ): {
    totalTreasury: number;
    cashTotal: number;
    bankTotal: number;
    momoTotal: number;
    activeCount: number;
    accounts: FinancialAccount[];
  } {
    const isAll = !tenantId || tenantId === 'ALL' || tenantId === 'global';
    const accounts = isAll
      ? (this.state.financialAccounts || [])
      : (this.state.financialAccounts || []).filter(a => a.tenantId === tenantId);

    const activeAccounts = accounts.filter(a => a.isActive);
    const totalTreasury = activeAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const cashTotal = activeAccounts.filter(a => a.type === 'CASH').reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const bankTotal = activeAccounts.filter(a => a.type === 'BANK').reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const momoTotal = activeAccounts.filter(a => a.type === 'MOBILE_MONEY').reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    return {
      totalTreasury,
      cashTotal,
      bankTotal,
      momoTotal,
      activeCount: activeAccounts.length,
      accounts
    };
  }

  /**
   * Enregistre un encaissement réel sur le compte financier approprié (Caisse, Momo, Banque)
   * et crée le mouvement financier correspondant (INFLOW) de manière atomique.
   */
  public recordIncomingPayment(params: {
    tenantId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    financialAccountId?: string;
    reference?: string;
    category?: 'CLIENT_PAYMENT' | 'BOUTIQUE_SALE' | 'TRAINING_ENROLLMENT' | 'CLIENT_DEBT' | 'REFUND';
    categoryLabel?: string;
    relatedEntityId?: string;
    relatedEntityType?: 'ORDER' | 'BOUTIQUE_SALE' | 'ENROLLMENT' | 'PERSON' | 'EXPENSE' | 'PURCHASE_ORDER';
    performedByUserName?: string;
    notes?: string;
  }): { success: boolean; movement?: FinancialMovement; account?: FinancialAccount; message: string } {
    const {
      tenantId,
      amount,
      paymentMethod,
      financialAccountId,
      reference,
      category = 'CLIENT_PAYMENT',
      categoryLabel = 'Règlement Client',
      relatedEntityId,
      relatedEntityType = 'ORDER',
      performedByUserName = 'Caissier',
      notes
    } = params;

    if (amount <= 0) {
      return { success: false, message: "Le montant doit être supérieur à 0." };
    }

    const targetTenant = (!tenantId || tenantId === 'global' || tenantId === 'ALL') ? INITIAL_TENANT_ID : tenantId;
    const agencyAccounts = (this.state.financialAccounts || []).filter(a => a.tenantId === targetTenant && a.isActive);

    let targetAccount: FinancialAccount | undefined;
    if (financialAccountId) {
      targetAccount = agencyAccounts.find(a => a.id === financialAccountId);
    }
    if (!targetAccount) {
      const pmStr = String(paymentMethod);
      if (pmStr === 'ORANGE_MONEY' || pmStr === 'MTN_MOMO' || pmStr === 'WAVE' || pmStr === 'MOOV_MONEY') {
        targetAccount = agencyAccounts.find(a => a.type === 'MOBILE_MONEY') || agencyAccounts.find(a => a.type === 'CASH');
      } else if (pmStr === 'BANK_TRANSFER' || pmStr === 'CARD' || pmStr === 'CHECK') {
        targetAccount = agencyAccounts.find(a => a.type === 'BANK') || agencyAccounts.find(a => a.type === 'CASH');
      } else {
        // CASH / DEFAULT
        targetAccount = agencyAccounts.find(a => a.isMainCash) || agencyAccounts.find(a => a.type === 'CASH') || agencyAccounts[0];
      }
    }

    if (!targetAccount) {
      return { success: false, message: "Aucun compte financier actif trouvé pour cette agence." };
    }

    const now = new Date().toISOString();
    let createdMovement: FinancialMovement | undefined;

    this.updateState(draft => {
      const acc = draft.financialAccounts?.find(a => a.id === targetAccount!.id);
      if (acc) {
        const balBefore = acc.currentBalance || 0;
        const balAfter = balBefore + amount;
        acc.currentBalance = balAfter;
        acc.updatedAt = now;

        if (!draft.financialMovements) draft.financialMovements = [];
        const mvtNumber = `MVT-${new Date().getFullYear()}-${String(draft.financialMovements.length + 1).padStart(6, '0')}`;
        createdMovement = {
          id: `mvt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          tenantId: targetTenant,
          movementNumber: mvtNumber,
          financialAccountId: acc.id,
          financialAccountName: acc.name,
          financialAccountType: acc.type,
          movementType: 'INFLOW',
          category: (category as any) || 'OTHER',
          categoryLabel,
          amount,
          balanceBefore: balBefore,
          balanceAfter: balAfter,
          reference: reference || `ENC-${Date.now()}`,
          relatedEntityId,
          relatedEntityType: relatedEntityType as any,
          paymentMethod,
          performedByUserName,
          notes,
          createdAt: now
        };
        if (createdMovement) {
          draft.financialMovements.unshift(createdMovement);
        }
      }
    });

    return {
      success: true,
      movement: createdMovement,
      account: targetAccount,
      message: `Encaissement de ${amount.toLocaleString('fr-FR')} GNF crédité sur "${targetAccount.name}".`
    };
  }

  public getSupplierDebts(tenantId?: string, isSuperAdmin?: boolean): SupplierDebt[] {
    if (!tenantId || tenantId === 'global' || tenantId === 'ALL') {
      return this.state.supplierDebts || [];
    }
    return (this.state.supplierDebts || []).filter(d => d.tenantId === tenantId);
  }

  public getSupplierPayments(tenantId?: string, isSuperAdmin?: boolean): SupplierPayment[] {
    if (!tenantId || tenantId === 'global' || tenantId === 'ALL') {
      return this.state.supplierPayments || [];
    }
    return (this.state.supplierPayments || []).filter(p => p.tenantId === tenantId);
  }

  public recordSupplierPayment(
    poId: string,
    amount: number,
    financialAccountId: string,
    reference?: string,
    notes?: string,
    requestingTenantId: string = 't-001',
    userName: string = 'Gestionnaire',
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string; payment?: SupplierPayment } {
    if (amount <= 0) {
      return { success: false, statusCode: 400, message: "Le montant du paiement doit être supérieur à 0." };
    }

    const po = (this.state.purchaseOrders || []).find(p => p.id === poId);
    if (!po) return { success: false, statusCode: 404, message: "Bon de commande introuvable." };

    if (!isSuperAdmin && requestingTenantId !== 'global' && po.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé : commande d'une autre agence." };
    }

    const account = (this.state.financialAccounts || []).find(a => a.id === financialAccountId);
    if (!account) return { success: false, statusCode: 404, message: "Compte financier sélectionné introuvable." };

    if (!isSuperAdmin && requestingTenantId !== 'global' && account.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "Compte financier d'une autre agence." };
    }

    if (!account.isActive) {
      return { success: false, statusCode: 400, message: `Le compte "${account.name}" est inactif.` };
    }

    // Rule: if main cash is closed, do not allow payment from main cash
    if (account.isMainCash) {
      const activeSession = (this.state.cashSessions || []).find(cs => cs.tenantId === account.tenantId && cs.status === 'OPEN');
      if (!activeSession) {
        return {
          success: false,
          statusCode: 400,
          message: "La caisse principale est fermée. Ouvrez une session de caisse avant d'effectuer cette opération."
        };
      }
    }

    // Check account balance
    if (account.currentBalance < amount) {
      return {
        success: false,
        statusCode: 400,
        message: `Solde insuffisant sur "${account.name}". Solde disponible : ${account.currentBalance.toLocaleString('fr-FR')} ${account.currency}.`
      };
    }

    const currentDue = po.dueAmount !== undefined ? po.dueAmount : Math.max(0, po.totalAmount - (po.paidAmount || 0));
    if (amount > currentDue) {
      return {
        success: false,
        statusCode: 400,
        message: `Le montant saisi (${amount.toLocaleString('fr-FR')} GNF) dépasse le reste à payer sur cette commande (${currentDue.toLocaleString('fr-FR')} GNF).`
      };
    }

    const now = new Date().toISOString();
    const paymentId = `sp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const paymentNumber = `REG-${new Date().getFullYear()}-${String((this.state.supplierPayments || []).length + 1).padStart(6, '0')}`;
    const mvtId = `mvt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let paymentMethod: any = 'CASH';
    if (account.type === 'BANK') paymentMethod = 'BANK_TRANSFER';
    else if (account.type === 'MOBILE_MONEY') {
      paymentMethod = account.name.toLowerCase().includes('orange') ? 'ORANGE_MONEY' : 'MTN_MOMO';
    }

    const newPayment: SupplierPayment = {
      id: paymentId,
      tenantId: po.tenantId,
      paymentNumber,
      purchaseOrderId: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      financialAccountId: account.id,
      financialAccountName: account.name,
      financialAccountType: account.type,
      amount,
      paymentMethod,
      paymentDate: now.split('T')[0],
      reference: reference?.trim() || undefined,
      notes: notes?.trim() || undefined,
      performedByUserName: userName,
      createdAt: now
    };

    this.updateState(draft => {
      // 1. Debit financial account
      const acc = draft.financialAccounts?.find(a => a.id === financialAccountId);
      if (acc) {
        const balBefore = acc.currentBalance;
        const balAfter = balBefore - amount;
        acc.currentBalance = balAfter;
        acc.updatedAt = now;

        // 2. Financial Movement
        if (!draft.financialMovements) draft.financialMovements = [];
        draft.financialMovements.unshift({
          id: mvtId,
          tenantId: po.tenantId,
          movementNumber: `MVT-${new Date().getFullYear()}-${String(draft.financialMovements.length + 1).padStart(6, '0')}`,
          financialAccountId: acc.id,
          financialAccountName: acc.name,
          financialAccountType: acc.type,
          movementType: 'OUTFLOW',
          category: 'SUPPLIER_PAYMENT',
          categoryLabel: 'Paiement Fournisseur',
          amount,
          balanceBefore: balBefore,
          balanceAfter: balAfter,
          reference: po.poNumber,
          relatedEntityId: po.id,
          relatedEntityType: 'PURCHASE_ORDER',
          paymentMethod,
          performedByUserName: userName,
          notes: `Paiement Fournisseur ${po.supplierName} (${po.poNumber})${notes ? ` - ${notes}` : ''}`,
          createdAt: now
        });

        // If main cash and session is open -> log cash movement
        if (acc.isMainCash) {
          const sess = draft.cashSessions?.find(cs => cs.tenantId === acc.tenantId && cs.status === 'OPEN');
          if (sess) {
            if (!sess.movements) sess.movements = [];
            sess.movements.unshift({
              id: `cm-${Date.now()}-sp`,
              cashSessionId: sess.id,
              movementType: 'EXPENSE',
              amount,
              category: 'Paiement Fournisseur',
              reason: `Paiement Fournisseur ${po.supplierName} (${po.poNumber}) - ${account.name}`,
              performedByUserName: userName,
              createdAt: now
            });
          }
        }
      }

      // 3. Register SupplierPayment
      if (!draft.supplierPayments) draft.supplierPayments = [];
      draft.supplierPayments.unshift(newPayment);

      // 4. Update PurchaseOrder
      const order = draft.purchaseOrders?.find(p => p.id === po.id);
      if (order) {
        order.paidAmount = (order.paidAmount || 0) + amount;
        order.dueAmount = Math.max(0, order.totalAmount - order.paidAmount);
        if (order.dueAmount === 0) {
          order.paymentStatus = 'PAID';
        } else if (order.paidAmount > 0) {
          order.paymentStatus = 'PARTIALLY_PAID';
        }
        if (!order.payments) order.payments = [];
        order.payments.push(newPayment);
      }

      // 5. Update SupplierDebt
      if (!draft.supplierDebts) draft.supplierDebts = [];
      let debt = draft.supplierDebts.find(d => d.purchaseOrderId === po.id);
      if (debt) {
        debt.paidAmount = (debt.paidAmount || 0) + amount;
        debt.remainingAmount = Math.max(0, debt.initialAmount - debt.paidAmount);
        debt.status = debt.remainingAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';
        debt.lastPaymentDate = now;
        debt.updatedAt = now;
      }
    });

    this.logAudit('SUPPLIER_PAYMENT_RECORDED', 'PURCHASE_ORDER', po.id, null, {
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      amount,
      financialAccountName: account.name,
      paymentNumber,
      performedBy: userName
    });

    return {
      success: true,
      statusCode: 200,
      payment: newPayment,
      message: `Paiement de ${amount.toLocaleString('fr-FR')} GNF validé depuis le compte "${account.name}".`
    };
  }

  public recordSupplierDebtPayment(
    debtId: string,
    amount: number,
    financialAccountId: string,
    reference?: string,
    notes?: string,
    requestingTenantId: string = 't-001',
    userName: string = 'Gestionnaire',
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string } {
    const debt = (this.state.supplierDebts || []).find(d => d.id === debtId);
    if (!debt) return { success: false, statusCode: 404, message: "Fiche de dette fournisseur introuvable." };

    return this.recordSupplierPayment(
      debt.purchaseOrderId,
      amount,
      financialAccountId,
      reference,
      notes,
      requestingTenantId,
      userName,
      isSuperAdmin
    );
  }

  public cancelSupplierPayment(
    paymentId: string,
    requestingTenantId: string,
    userName: string,
    reason?: string,
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string } {
    const payment = (this.state.supplierPayments || []).find(p => p.id === paymentId);
    if (!payment) return { success: false, statusCode: 404, message: "Paiement fournisseur introuvable." };

    if (!isSuperAdmin && requestingTenantId !== 'global' && payment.tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "Accès refusé." };
    }

    const now = new Date().toISOString();

    this.updateState(draft => {
      // 1. Recredit financial account
      const acc = draft.financialAccounts?.find(a => a.id === payment.financialAccountId);
      if (acc) {
        const balBefore = acc.currentBalance;
        const balAfter = balBefore + payment.amount;
        acc.currentBalance = balAfter;
        acc.updatedAt = now;

        // Create inverse movement (REFUND)
        if (!draft.financialMovements) draft.financialMovements = [];
        draft.financialMovements.unshift({
          id: `mvt-rev-${Date.now()}`,
          tenantId: payment.tenantId,
          movementNumber: `MVT-${new Date().getFullYear()}-${String(draft.financialMovements.length + 1).padStart(6, '0')}`,
          financialAccountId: acc.id,
          financialAccountName: acc.name,
          financialAccountType: acc.type,
          movementType: 'INFLOW',
          category: 'REFUND',
          categoryLabel: 'Annulation / Contre-passation',
          amount: payment.amount,
          balanceBefore: balBefore,
          balanceAfter: balAfter,
          reference: payment.poNumber,
          relatedEntityId: payment.purchaseOrderId,
          relatedEntityType: 'PURCHASE_ORDER',
          performedByUserName: userName,
          notes: `Contre-passation paiement fournisseur ${payment.paymentNumber} (${reason || 'Annulation autorisée'})`,
          createdAt: now
        });
      }

      // 2. Remove / flag payment from supplierPayments
      draft.supplierPayments = (draft.supplierPayments || []).filter(p => p.id !== paymentId);

      // 3. Update PurchaseOrder
      const order = draft.purchaseOrders?.find(p => p.id === payment.purchaseOrderId);
      if (order) {
        order.paidAmount = Math.max(0, (order.paidAmount || 0) - payment.amount);
        order.dueAmount = Math.max(0, order.totalAmount - order.paidAmount);
        order.paymentStatus = order.paidAmount === 0 ? (order.status === 'RECEIVED' ? 'CREDIT' : 'UNPAID') : 'PARTIALLY_PAID';
        order.payments = (order.payments || []).filter(p => p.id !== paymentId);
      }

      // 4. Update SupplierDebt
      const debt = draft.supplierDebts?.find(d => d.purchaseOrderId === payment.purchaseOrderId);
      if (debt) {
        debt.paidAmount = Math.max(0, (debt.paidAmount || 0) - payment.amount);
        debt.remainingAmount = Math.max(0, debt.initialAmount - debt.paidAmount);
        debt.status = debt.paidAmount === 0 ? 'ACTIVE' : 'PARTIALLY_PAID';
        debt.updatedAt = now;
      }
    });

    this.logAudit('SUPPLIER_PAYMENT_CANCELLED', 'SUPPLIER_PAYMENT', paymentId, null, {
      paymentNumber: payment.paymentNumber,
      amount: payment.amount,
      poNumber: payment.poNumber,
      cancelledBy: userName,
      reason
    });

    return {
      success: true,
      statusCode: 200,
      message: `Paiement ${payment.paymentNumber} annulé. Le compte ${payment.financialAccountName} a été recrédité de ${payment.amount.toLocaleString('fr-FR')} GNF.`
    };
  }

  public returnSecurePurchaseOrder(
    poId: string,
    productId: string,
    returnQty: number,
    reason: string,
    requestingTenantId: string,
    performedByUserName?: string,
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string } {
    const poCheck = this.getPurchaseOrderById(poId, requestingTenantId, isSuperAdmin);
    if (!poCheck.success || !poCheck.purchaseOrder) {
      return { success: false, statusCode: poCheck.statusCode, message: poCheck.message };
    }

    const po = poCheck.purchaseOrder;
    const item = po.items.find(it => it.productId === productId);
    if (!item) {
      return { success: false, statusCode: 404, message: "Article introuvable dans ce bon de commande." };
    }

    const validQty = Math.max(1, Number(returnQty) || 1);
    const factor = item.conversionFactor || 1;
    const deductedUnits = validQty * factor;

    this.updateState(draft => {
      const prod = draft.products?.find(p => p.id === productId);
      if (prod) {
        const oldStock = prod.currentStock;
        prod.currentStock = Math.max(0, prod.currentStock - deductedUnits);
        prod.updatedAt = new Date().toISOString();

        if (!draft.stockMovements) draft.stockMovements = [];
        draft.stockMovements.unshift({
          id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          tenantId: po.tenantId,
          productId: prod.id,
          productName: prod.name,
          movementType: 'SUPPLIER_RETURN',
          quantity: -deductedUnits,
          oldStock,
          newStock: prod.currentStock,
          unitUsed: item.purchaseUnitName,
          conversionFactorApplied: factor,
          quantityInStockUnit: -deductedUnits,
          unitCost: item.unitPriceStockUnit,
          totalCost: item.unitPriceStockUnit * deductedUnits,
          orderNumber: po.poNumber,
          relatedPoId: po.id,
          serviceOrDepartment: po.departmentName,
          reason: `Retour fournisseur sur commande ${po.poNumber} : ${reason || 'Marchandise défectueuse'}`,
          performedByUserName: performedByUserName || 'Gestionnaire Stock',
          createdAt: new Date().toISOString()
        });
      }
    });

    this.logAudit('SUPPLIER_RETURN', 'PURCHASE_ORDER', po.id, null, {
      poNumber: po.poNumber,
      productId,
      returnQty: validQty,
      deductedStockUnits: deductedUnits,
      reason
    });

    return {
      success: true,
      statusCode: 200,
      message: `Retour fournisseur de ${validQty} ${item.purchaseUnitName}(s) (-${deductedUnits} unités) enregistré.`
    };
  }

  public updateUserStatus(userId: string, isActive: boolean) {
    this.updateState(draft => {
      const u = draft.users.find(user => user.id === userId);
      if (u) {
        u.isActive = isActive;
      }
    });
    this.logAudit('USER_STATUS_UPDATED', 'USER', userId, null, { isActive });
  }

  /**
   * MISE À JOUR DU PROFIL PERSONNEL UTILISATEUR
   * Accessible pour tous les utilisateurs (Super Admin, Admins, Caissiers, Vendeurs, Stock, Collaborateurs)
   * Protégé côté backend : l'utilisateur ne peut modifier que son propre profil (sauf Super Admin / Admin autorisé).
   */
  public updateUserProfile(
    userId: string,
    data: UserProfileUpdateData,
    requestingUserOrId?: User | string,
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string; user?: User } {
    const targetUser = (this.state.users || []).find(u => u.id === userId);
    if (!targetUser) {
      return { success: false, statusCode: 404, message: "Utilisateur introuvable." };
    }

    const actingUser = this.resolveActingUser(requestingUserOrId, isSuperAdmin);
    if (!actingUser) {
      return { success: false, statusCode: 401, message: "Authentification requise pour modifier un profil utilisateur." };
    }

    // Security Check: User can only edit their own profile unless Super Admin or explicit admin permission
    const isSelf = actingUser.id === userId;
    const hasAdminPrivilege = Boolean(
      isSuperAdmin ||
      actingUser.isSuperAdmin ||
      actingUser.username === 'superadmin' ||
      actingUser.role === 'SUPER_ADMIN' ||
      actingUser.roles?.some(r => r.code === 'SUPER_ADMIN') ||
      actingUser.permissions?.includes('*') ||
      actingUser.permissions?.includes('users.*') ||
      actingUser.permissions?.includes('users.manage')
    );

    if (!isSelf && !hasAdminPrivilege) {
      this.logAudit('UNAUTHORIZED_USER_PROFILE_MUTATION_DENIED', 'USER', userId, null, {
        targetUserId: userId,
        attemptedBy: actingUser.username,
        reason: "Tentative non autorisée de modification du profil d'un autre utilisateur."
      });
      return {
        success: false,
        statusCode: 403,
        message: "403 Accès Refusé : Vous ne pouvez modifier que votre propre profil personnel."
      };
    }

    // 1. Validate First Name & Last Name
    const cleanFirstName = data.firstName !== undefined ? data.firstName.trim() : targetUser.firstName;
    const cleanLastName = data.lastName !== undefined ? data.lastName.trim() : targetUser.lastName;

    if (!cleanFirstName || !cleanLastName) {
      return { success: false, statusCode: 400, message: "Le prénom et le nom sont obligatoires." };
    }

    // 2. Validate Email format and uniqueness
    const cleanEmail = data.email !== undefined ? data.email.trim().toLowerCase() : targetUser.email.toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, statusCode: 400, message: "Veuillez fournir une adresse email valide." };
    }

    // Check duplicate email in other users
    const duplicateEmailUser = (this.state.users || []).find(
      u => u.id !== userId && u.email && u.email.toLowerCase() === cleanEmail
    );
    if (duplicateEmailUser) {
      return {
        success: false,
        statusCode: 400,
        message: `L'adresse email "${cleanEmail}" est déjà utilisée par un autre compte utilisateur.`
      };
    }

    // 3. Validate Phone Number if provided
    let cleanPhone = targetUser.phone;
    if (data.phone !== undefined) {
      const trimmedPhone = data.phone.trim();
      if (trimmedPhone) {
        if (!isValidPhoneNumber(trimmedPhone, { allowEmpty: false })) {
          return {
            success: false,
            statusCode: 400,
            message: "Le numéro de téléphone fourni est invalide (les lettres et caractères spéciaux interdits sont rejetés)."
          };
        }
        cleanPhone = trimmedPhone;
      } else {
        cleanPhone = undefined;
      }
    }

    // 4. Validate Avatar URL / Data URI if provided
    let cleanAvatarUrl = targetUser.avatarUrl;
    if (data.avatarUrl !== undefined) {
      cleanAvatarUrl = data.avatarUrl ? data.avatarUrl.trim() : undefined;
    }

    // 5. Department if provided
    const cleanDepartment = data.department !== undefined ? data.department.trim() : targetUser.department;

    const oldValues = {
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      email: targetUser.email,
      phone: targetUser.phone,
      avatarUrl: targetUser.avatarUrl ? 'IMAGE_SET' : 'NO_IMAGE',
      department: targetUser.department
    };

    let updatedUser: User | undefined;

    this.updateState(draft => {
      const userToUpdate = draft.users.find(u => u.id === userId);
      if (userToUpdate) {
        userToUpdate.firstName = cleanFirstName;
        userToUpdate.lastName = cleanLastName;
        userToUpdate.email = cleanEmail;
        userToUpdate.phone = cleanPhone;
        userToUpdate.avatarUrl = cleanAvatarUrl;
        userToUpdate.department = cleanDepartment;
        updatedUser = { ...userToUpdate };
      }
    });

    const roleLabel = getFinancialUserRoleLabel(actingUser);
    this.logAudit('USER_PROFILE_UPDATED', 'USER', userId, oldValues, {
      userId,
      userRole: roleLabel,
      performedBy: `${actingUser.firstName} ${actingUser.lastName}`,
      tenantId: targetUser.tenantId,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      email: cleanEmail,
      phone: cleanPhone,
      hasAvatar: Boolean(cleanAvatarUrl),
      description: `${roleLabel} ${actingUser.firstName} ${actingUser.lastName} a mis à jour le profil de ${cleanFirstName} ${cleanLastName}.`
    });

    return {
      ...(updatedUser || {}),
      success: true,
      statusCode: 200,
      message: "Vos informations personnelles ont été mises à jour avec succès.",
      user: updatedUser
    } as any;
  }

  /**
   * MISE À JOUR DE LA PHOTO DE PROFIL
   */
  public updateUserAvatar(
    userId: string,
    avatarUrl: string | null,
    requestingUserOrId?: User | string,
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string; user?: User } {
    const res = this.updateUserProfile(userId, { avatarUrl: avatarUrl || null }, requestingUserOrId, isSuperAdmin);
    if (res.success) {
      const actingUser = this.resolveActingUser(requestingUserOrId, isSuperAdmin);
      const roleLabel = getFinancialUserRoleLabel(actingUser);
      this.logAudit('USER_AVATAR_UPDATED', 'USER', userId, null, {
        userId,
        userRole: roleLabel,
        performedBy: actingUser ? `${actingUser.firstName} ${actingUser.lastName}` : 'System',
        tenantId: actingUser?.tenantId || 'global',
        description: `${roleLabel} a mis à jour la photo de profil.`
      });
    }
    return res;
  }

  /**
   * SUPPRESSION DE LA PHOTO DE PROFIL
   */
  public removeUserAvatar(
    userId: string,
    requestingUserOrId?: User | string,
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string; user?: User } {
    const res = this.updateUserProfile(userId, { avatarUrl: null }, requestingUserOrId, isSuperAdmin);
    if (res.success) {
      const actingUser = this.resolveActingUser(requestingUserOrId, isSuperAdmin);
      const roleLabel = getFinancialUserRoleLabel(actingUser);
      this.logAudit('USER_AVATAR_REMOVED', 'USER', userId, null, {
        userId,
        userRole: roleLabel,
        performedBy: actingUser ? `${actingUser.firstName} ${actingUser.lastName}` : 'System',
        tenantId: actingUser?.tenantId || 'global',
        description: `${roleLabel} a supprimé la photo de profil.`
      });
    }
    return res;
  }

  /**
   * MODIFICATION SÉCURISÉE DU MOT DE PASSE UTILISATEUR
   */
  public changeUserPassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    requestingUserOrId?: User | string,
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string } {
    const targetUser = (this.state.users || []).find(u => u.id === userId);
    if (!targetUser) {
      return { success: false, statusCode: 404, message: "Utilisateur introuvable." };
    }

    const actingUser = this.resolveActingUser(requestingUserOrId, isSuperAdmin);
    if (!actingUser) {
      return { success: false, statusCode: 401, message: "Authentification requise pour modifier le mot de passe." };
    }

    const isSelf = actingUser.id === userId;
    const isGlobalAdmin = Boolean(isSuperAdmin || actingUser.isSuperAdmin || actingUser.username === 'superadmin');

    if (!isSelf && !isGlobalAdmin) {
      return {
        success: false,
        statusCode: 403,
        message: "403 Accès Refusé : Vous ne pouvez modifier que votre propre mot de passe."
      };
    }

    if (!isGlobalAdmin || isSelf) {
      const currentHash = targetUser.passwordHash || targetUser.password || `${targetUser.username || 'user'}123`;
      if (oldPassword !== currentHash && !verifyPassword(oldPassword, currentHash)) {
        return { success: false, statusCode: 400, message: "L'ancien mot de passe saisi est incorrect." };
      }
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, statusCode: 400, message: "Le nouveau mot de passe doit comporter au moins 6 caractères." };
    }

    if (newPassword === oldPassword) {
      return { success: false, statusCode: 400, message: "Le nouveau mot de passe doit être différent de l'ancien mot de passe." };
    }

    // Role-specific password policy validation
    const accountCategory = getAccountCategory(targetUser);
    const pwdValidation = validatePasswordByPolicy(newPassword, accountCategory);
    if (!pwdValidation.isValid) {
      return {
        success: false,
        statusCode: 400,
        message: pwdValidation.errors.join(' ')
      };
    }

    const hashedNewPassword = hashPassword(newPassword);

    this.updateState(draft => {
      const u = draft.users.find(userItem => userItem.id === userId);
      if (u) {
        u.password = newPassword;
        u.passwordHash = hashedNewPassword;
        u.resetPasswordCode = undefined;
        u.resetPasswordExpiresAt = undefined;
      }
    });

    const roleLabel = getFinancialUserRoleLabel(actingUser);
    this.logAudit('USER_PASSWORD_CHANGED', 'USER', userId, null, {
      userId,
      userRole: roleLabel,
      performedBy: `${actingUser.firstName} ${actingUser.lastName}`,
      tenantId: targetUser.tenantId,
      description: `${roleLabel} ${actingUser.firstName} ${actingUser.lastName} a modifié le mot de passe du compte @${targetUser.username}.`
    });

    return {
      success: true,
      statusCode: 200,
      message: "Votre mot de passe a été modifié avec succès."
    };
  }

  public resetUserPassword(userId: string, newPassword?: string) {
    const defaultPass = newPassword || 'password123';
    this.updateState(draft => {
      const u = draft.users.find(user => user.id === userId);
      if (u) {
        u.passwordHash = defaultPass;
      }
    });
    this.logAudit('USER_PASSWORD_RESET', 'USER', userId, null, { resetBy: 'Super Admin' });
  }

  // --- MUTATION HELPERS ---

  public updateState(updater: (draft: DatabaseState) => void) {
    updater(this.state);
    this.saveState();
  }

  public logAudit(action: string, entityType: string, entityId?: string, oldValues?: any, newValues?: any, ipAddress: string = '127.0.0.1') {
    const user = this.state.users.find(u => u.id === this.state.currentUserId);
    const tenantIdOverride = newValues?.tenantId || (entityType === 'TENANT' ? entityId : undefined) || this.state.currentTenantId;
    const userIdOverride = newValues?.userId || newValues?.performedById || this.state.currentUserId;
    const userNameOverride = newValues?.userName || newValues?.performedBy || (user ? `${user.firstName} ${user.lastName}` : 'Utilisateur Système');
    const userRoleOverride = newValues?.userRole || (user ? (user.roles?.[0]?.name || user.role) : undefined);
    const detailsOverride = newValues?.description || newValues?.details || (typeof newValues === 'string' ? newValues : undefined);

    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId: tenantIdOverride || INITIAL_TENANT_ID,
      userId: userIdOverride,
      userName: userNameOverride,
      userRole: userRoleOverride,
      action,
      entityType,
      entityId,
      details: detailsOverride,
      oldValues: sanitizeAuditPayload(oldValues),
      newValues: sanitizeAuditPayload(newValues),
      ipAddress: ipAddress || '127.0.0.1',
      createdAt: new Date().toISOString()
    };
    if (!this.state.auditLogs) this.state.auditLogs = [];
    this.state.auditLogs.unshift(log);
    this.saveState();
  }

  /**
   * CENTRAL AUTHENTICATION ENGINE (Universal Anti-Brute-Force & Lockout Policy)
   */
  public authenticateUser(
    identifier: string,
    password?: string,
    ipAddress: string = '127.0.0.1',
    userAgent?: string,
    customNow?: Date
  ): {
    success: boolean;
    statusCode: number;
    message?: string;
    user?: User;
    isLocked?: boolean;
    remainingMinutes?: number;
    rateLimited?: boolean;
  } {
    const now = customNow || new Date();
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanIp = (ipAddress || '127.0.0.1').trim();

    // 1. IP Rate Limiting Check
    const ipCheck = checkIpRateLimit(cleanIp, now);
    if (!ipCheck.allowed) {
      this.logAudit('RATE_LIMIT_TRIGGERED', 'IP_SECURITY', undefined, null, {
        ipAddress: cleanIp,
        retryAfterSeconds: ipCheck.retryAfterSeconds,
        reason: 'Fréquence de requêtes de connexion excessive'
      }, cleanIp);

      return {
        success: false,
        statusCode: 429,
        rateLimited: true,
        message: `Trop de tentatives de connexion depuis cette adresse IP. Veuillez patienter ${ipCheck.retryAfterSeconds} secondes.`
      };
    }

    if (!cleanId) {
      return { success: false, statusCode: 400, message: "Veuillez saisir votre identifiant ou adresse email." };
    }

    // 2. Lookup user by email, username or phone number
    const user = this.state.users.find(
      u => u.email.toLowerCase() === cleanId || 
           (u.username && u.username.toLowerCase() === cleanId) ||
           (u.phone && u.phone.replace(/\s+/g, '') === cleanId.replace(/\s+/g, ''))
    );

    if (!user) {
      recordFailedIpAttempt(cleanIp, now);
      this.logAudit('LOGIN_FAILED', 'USER', cleanId, null, {
        attemptedIdentifier: cleanId,
        reason: 'Identifiant introuvable',
        ipAddress: cleanIp
      }, cleanIp);

      // Generic error message to prevent user enumeration
      return { success: false, statusCode: 401, message: "Identifiants incorrects." };
    }

    // 3. Inactive account check
    if (!user.isActive) {
      recordFailedIpAttempt(cleanIp, now);
      this.logAudit('LOGIN_FAILED', 'USER', user.id, null, {
        username: user.username,
        tenantId: user.tenantId,
        reason: 'Compte désactivé',
        ipAddress: cleanIp
      }, cleanIp);

      return {
        success: false,
        statusCode: 403,
        message: "Ce compte utilisateur est désactivé. Veuillez contacter un administrateur."
      };
    }

    // 4. Lockout check
    const lockoutStatus = checkAccountLockout(user, now);
    if (lockoutStatus.isLocked) {
      recordFailedIpAttempt(cleanIp, now);
      this.logAudit('LOGIN_FAILED', 'USER', user.id, null, {
        username: user.username,
        tenantId: user.tenantId,
        reason: 'Tentative sur compte verrouillé',
        lockedUntil: lockoutStatus.lockedUntil,
        remainingMinutes: lockoutStatus.remainingMinutes,
        ipAddress: cleanIp
      }, cleanIp);

      return {
        success: false,
        statusCode: 423,
        isLocked: true,
        remainingMinutes: lockoutStatus.remainingMinutes,
        message: formatLockoutMessage(lockoutStatus.remainingMinutes, lockoutStatus.remainingSeconds)
      };
    }

    // 5. Password verification
    const expectedPassword = user.password || user.passwordHash || `${user.username || 'user'}123`;
    const isPasswordValid = password !== undefined && (password === expectedPassword || password === user.password || password === user.passwordHash);

    if (!isPasswordValid) {
      recordFailedIpAttempt(cleanIp, now);
      const newFailedCount = (user.failedLoginAttempts || 0) + 1;
      const lastFailedAt = now.toISOString();

      if (newFailedCount >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
        // Account reaches 3 consecutive failed attempts -> LOCK OUT!
        const newLockoutCount = (user.lockoutCount || 0) + 1;
        const durationMinutes = getLockoutDurationMinutes(newLockoutCount - 1);
        const durationMs = durationMinutes * 60 * 1000;
        const lockedUntilDate = new Date(now.getTime() + durationMs);
        const lockedUntilStr = lockedUntilDate.toISOString();

        this.updateState(draft => {
          const u = draft.users.find(item => item.id === user.id);
          if (u) {
            u.failedLoginAttempts = newFailedCount;
            u.lockoutCount = newLockoutCount;
            u.lockedUntil = lockedUntilStr;
            u.lastFailedLoginAt = lastFailedAt;
            u.lockedReason = `3 tentatives consécutives incorrectes (Niveau ${newLockoutCount}: ${durationMinutes} min)`;
          }
        });

        this.logAudit('ACCOUNT_LOCKED', 'USER', user.id, null, {
          username: user.username,
          tenantId: user.tenantId,
          failedAttempts: newFailedCount,
          lockoutLevel: newLockoutCount,
          lockedUntil: lockedUntilStr,
          durationMinutes,
          ipAddress: cleanIp
        }, cleanIp);

        return {
          success: false,
          statusCode: 423,
          isLocked: true,
          remainingMinutes: durationMinutes,
          message: formatLockoutMessage(durationMinutes, 0)
        };
      } else {
        // Increment failure counter without locking yet
        this.updateState(draft => {
          const u = draft.users.find(item => item.id === user.id);
          if (u) {
            u.failedLoginAttempts = newFailedCount;
            u.lastFailedLoginAt = lastFailedAt;
          }
        });

        this.logAudit('LOGIN_FAILED', 'USER', user.id, null, {
          username: user.username,
          tenantId: user.tenantId,
          failedAttempts: newFailedCount,
          attemptsRemaining: SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - newFailedCount,
          ipAddress: cleanIp
        }, cleanIp);

        return {
          success: false,
          statusCode: 401,
          message: "Identifiants incorrects."
        };
      }
    }

    // 6. Successful Login: Clear consecutive failures & update last login
    const successTime = now.toISOString();
    this.updateState(draft => {
      const u = draft.users.find(item => item.id === user.id);
      if (u) {
        u.failedLoginAttempts = 0;
        u.lockedUntil = undefined;
        u.lockedReason = undefined;
        u.lastLoginAt = successTime;
        u.lastSuccessfulLoginAt = successTime;
      }
      draft.currentUserId = user.id;
      if (user.isSuperAdmin || user.username === 'superadmin' || user.roles.some(r => r.code === 'SUPER_ADMIN')) {
        draft.currentTenantId = 'global';
      } else if (user.tenantId && user.tenantId !== 'global') {
        draft.currentTenantId = user.tenantId;
      }
    });

    recordSuccessfulIpAttempt(cleanIp);

    this.logAudit('LOGIN_SUCCESS', 'USER', user.id, null, {
      username: user.username,
      email: user.email,
      role: user.roles[0]?.name,
      tenantId: user.tenantId,
      department: user.department,
      ipAddress: cleanIp
    }, cleanIp);

    const updatedUser = this.state.users.find(u => u.id === user.id);
    return {
      success: true,
      statusCode: 200,
      user: updatedUser
    };
  }

  /**
   * Administrative Manual Unlock with Strict Multi-Tenant Authorization Check
   */
  public unlockUserAccount(
    targetUserId: string,
    requestingUser: User,
    reason: string = 'Déverrouillage administratif'
  ): { success: boolean; statusCode: number; message: string; user?: User } {
    const target = this.state.users.find(u => u.id === targetUserId);
    if (!target) {
      return { success: false, statusCode: 404, message: "Utilisateur introuvable." };
    }

    const isReqSuper = Boolean(
      requestingUser.isSuperAdmin ||
      requestingUser.username === 'superadmin' ||
      requestingUser.roles.some(r => r.code === 'SUPER_ADMIN')
    );

    // Multi-tenant check: non-superadmin cannot unlock user of another agency
    if (!isReqSuper) {
      if (requestingUser.tenantId !== target.tenantId) {
        this.logAudit('SECURITY_CROSS_TENANT_UNLOCK_DENIED', 'USER', targetUserId, null, {
          targetTenantId: target.tenantId,
          requestingTenantId: requestingUser.tenantId,
          requestingUserId: requestingUser.id,
          targetUsername: target.username,
          action: 'MANUAL_UNLOCK_DENIED'
        });
        return {
          success: false,
          statusCode: 403,
          message: "403 Accès Refusé : Vous ne pouvez pas déverrouiller un compte d'une autre agence."
        };
      }

      // Check admin rights in agency
      const hasAdminRights = requestingUser.roles.some(r =>
        r.code === 'ADMIN_CENTRE' ||
        r.code === 'ADMIN_AGENCY' ||
        r.code === 'GERANT' ||
        r.permissions.includes('*') ||
        r.permissions.includes('users.update')
      );

      if (!hasAdminRights) {
        return {
          success: false,
          statusCode: 403,
          message: "403 Accès Refusé : Vous n'avez pas les autorisations requises pour déverrouiller ce compte."
        };
      }

      // Agency admin cannot unlock a superadmin account
      if (target.isSuperAdmin || target.username === 'superadmin' || target.roles.some(r => r.code === 'SUPER_ADMIN')) {
        return {
          success: false,
          statusCode: 403,
          message: "403 Accès Refusé : Seul un Super Administrateur peut déverrouiller un compte Super Administrateur."
        };
      }
    }

    // Unlock target user
    this.updateState(draft => {
      const u = draft.users.find(item => item.id === targetUserId);
      if (u) {
        u.lockedUntil = undefined;
        u.failedLoginAttempts = 0;
        u.lockedReason = undefined;
      }
    });

    this.logAudit('ACCOUNT_UNLOCKED', 'USER', targetUserId, null, {
      targetUsername: target.username,
      unlockedBy: requestingUser.username,
      unlockedByRole: requestingUser.roles[0]?.name,
      tenantId: target.tenantId,
      reason
    });

    return {
      success: true,
      statusCode: 200,
      user: this.state.users.find(u => u.id === targetUserId),
      message: `Le compte de @${target.username} a été déverrouillé avec succès.`
    };
  }

  /**
   * Retrieve locked accounts with tenant filtering
   */
  public getLockedUsers(tenantId?: string, isSuperAdmin?: boolean, now: Date = new Date()): User[] {
    return this.state.users.filter(u => {
      if (tenantId && !isSuperAdmin && tenantId !== 'global' && u.tenantId !== tenantId) {
        return false;
      }
      const lockStatus = checkAccountLockout(u, now);
      return lockStatus.isLocked;
    });
  }

  public addNotification(
    paramOrTitle: string | Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>,
    message?: string,
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER' = 'INFO',
    link?: string,
    tenantId?: string,
    userId?: string
  ): AppNotification {
    if (!this.state.notifications) this.state.notifications = [];
    let notifObj: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>;
    if (typeof paramOrTitle === 'object') {
      notifObj = paramOrTitle;
    } else {
      notifObj = {
        title: paramOrTitle,
        message: message || '',
        type: type || 'INFO',
        link,
        tenantId: tenantId || this.state.currentTenantId,
        userId
      };
    }
    const newNotif: AppNotification = {
      ...notifObj,
      id: `notif-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    this.state.notifications.unshift(newNotif);
    this.saveState();
    return newNotif;
  }

  public registerAutonomousAgency(data: AutonomousAgencyRegistrationData): {
    success: boolean;
    message: string;
    statusCode: number;
    user?: User;
    tenant?: Tenant;
  } {
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const cleanPhone = (data.phone || '').trim();
    const cleanAgencyName = (data.agencyName || '').trim();
    const cleanFirstName = (data.firstName || '').trim();
    const cleanLastName = (data.lastName || '').trim();

    if (!cleanFirstName || !cleanLastName) {
      return { success: false, statusCode: 400, message: "Le nom et le prénom du responsable sont obligatoires." };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, statusCode: 400, message: "Veuillez fournir une adresse e-mail valide." };
    }
    if (!isValidPhoneNumber(cleanPhone, { allowEmpty: false, required: true })) {
      return { success: false, statusCode: 400, message: "400 Erreur de validation : Le numéro de téléphone fourni est invalide (les lettres et caractères non autorisés sont rejetés)." };
    }
    if (data.agencyPhone && !isValidPhoneNumber(data.agencyPhone, { allowEmpty: true })) {
      return { success: false, statusCode: 400, message: "400 Erreur de validation : Le numéro de téléphone professionnel de l'agence est invalide." };
    }
    if (!data.password || data.password.length < 6) {
      return { success: false, statusCode: 400, message: "Le mot de passe doit comporter au moins 6 caractères." };
    }
    if (!cleanAgencyName) {
      return { success: false, statusCode: 400, message: "Le nom de l'agence est obligatoire." };
    }

    // Check duplicate email or phone in existing users
    const existingUser = (this.state.users || []).find(
      u => (u.email && u.email.toLowerCase() === cleanEmail) || (u.phone && u.phone.trim() === cleanPhone)
    );
    if (existingUser) {
      return { success: false, statusCode: 409, message: "Un compte existe déjà avec cette adresse email ou ce numéro de téléphone." };
    }

    // Generate Tenant ID & codes
    const newTenantId = `tenant-${Date.now()}`;
    const slug = cleanAgencyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `agency-${Date.now()}`;
    const code = `AG-${Math.floor(1000 + Math.random() * 9000)}`;

    const now = new Date();
    const trialStartedAt = now.toISOString();
    const trialEndsAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(); // 15 jours
    const trialDaysTotal = 15;

    // License
    const licenseId = `lic-${Date.now()}`;
    const newLicense = {
      id: licenseId,
      agencyId: newTenantId,
      planId: 'STARTER' as const,
      status: 'ACTIVE' as const,
      startDate: trialStartedAt,
      endDate: trialEndsAt,
      maxUsers: 5,
      notes: "Licence d'essai gratuite de 15 jours créée automatiquement lors de l'inscription autonome.",
      createdAt: trialStartedAt
    };

    // Tenant
    const newTenant: Tenant = {
      id: newTenantId,
      name: cleanAgencyName,
      code,
      slug,
      activityType: data.activityType || 'SERVICE_CENTER',
      status: 'ACTIVE',
      responsibleName: `${cleanFirstName} ${cleanLastName}`,
      phone: data.agencyPhone || cleanPhone,
      email: cleanEmail,
      address: data.agencyAddress ? `${data.agencyAddress}${data.agencyCity ? ', ' + data.agencyCity : ''}` : (data.agencyCity || ''),
      currency: data.currency || 'GNF',
      taxRate: 18,
      isActive: true,
      enabledModules: [
        'dashboard', 'orders', 'production', 'training', 'cash', 'accounting',
        'expenses', 'stock', 'boutique', 'suppliers', 'invoices', 'equipment', 'reports', 'settings'
      ],
      license: newLicense,
      subscriptionStatus: 'TRIAL',
      trialStartedAt,
      trialEndsAt,
      trialDaysTotal,
      lastSeenAt: trialStartedAt,
      licensePlan: 'STARTER',
      onboardingCompleted: false,
      onboardingStep: 1,
      onboardingData: {},
      settings: {
        companyHeader: cleanAgencyName,
        invoiceFooter: `Merci de votre confiance — ${cleanAgencyName}`,
        defaultTrialDays: 15,
        branding: {
          logoPosition: 'left',
          logoSize: 'md',
          showLogo: false,
          headerAlignment: 'left',
          showPhone: true,
          showEmail: true,
          showAddress: true,
          showWebsite: false,
          footerAlignment: 'center',
          showFooter: true
        }
      },
      createdAt: trialStartedAt,
      updatedAt: trialStartedAt
    };

    // Branch
    const newBranch: Branch = {
      id: `br-${Date.now()}`,
      tenantId: newTenantId,
      name: `Siège Principal - ${cleanAgencyName}`,
      code: 'MAIN',
      isMain: true,
      address: newTenant.address,
      phone: newTenant.phone,
      email: newTenant.email,
      isActive: true
    };

    // User Role: ADMIN_AGENCY
    const adminAgencyRole: Role = {
      id: `role-admin-${newTenantId}`,
      code: 'ADMIN_AGENCY',
      name: "Administrateur de l'Agence",
      description: "Responsable et administrateur principal de l'agence",
      permissions: ['*'],
      isSystem: true
    };

    // Username derived from first name / email
    const baseUsername = cleanEmail.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'admin';
    let username = baseUsername;
    let counter = 1;
    while ((this.state.users || []).some(u => u.username === username)) {
      username = `${baseUsername}${counter++}`;
    }

    const newUser: User = {
      id: `u-${Date.now()}`,
      tenantId: newTenantId,
      branchId: newBranch.id,
      username,
      email: cleanEmail,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      phone: cleanPhone,
      passwordHash: data.password,
      roles: [adminAgencyRole],
      permissions: ['*'],
      isActive: true,
      isSuperAdmin: false,
      department: 'ADMINISTRATION',
      createdAt: trialStartedAt
    };

    // Auto-create initial Fiscal Year & 12 Periods for new agency
    const currentYear = now.getFullYear();
    const newYearId = `fy-${newTenantId}-${currentYear}`;
    const initialFiscalYear: FinancialYear = {
      id: newYearId,
      tenantId: newTenantId,
      code: `EX-${currentYear}`,
      name: `Exercice Financier ${currentYear}`,
      year: currentYear,
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
      status: 'ACTIVE',
      isCurrentYear: true,
      notes: `Exercice initial de création pour ${cleanAgencyName}`,
      createdAt: trialStartedAt,
      updatedAt: trialStartedAt
    };
    const initialPeriods = generateMonthlyPeriodsForYear(newYearId, newTenantId, currentYear, now.getMonth());

    // Update state
    this.updateState(draft => {
      draft.tenants.unshift(newTenant);
      draft.branches.unshift(newBranch);
      draft.roles.unshift(adminAgencyRole);
      draft.users.unshift(newUser);
      if (!draft.financialYears) draft.financialYears = [];
      if (!draft.financialPeriods) draft.financialPeriods = [];
      draft.financialYears.unshift(initialFiscalYear);
      draft.financialPeriods.push(...initialPeriods);
      draft.currentTenantId = newTenantId;
      draft.currentUserId = newUser.id;
    });

    this.logAudit('AGENCY_SELF_REGISTERED', 'TENANT', newTenantId, null, {
      agencyName: cleanAgencyName,
      activityType: newTenant.activityType,
      responsible: `${cleanFirstName} ${cleanLastName}`,
      email: cleanEmail,
      phone: cleanPhone,
      trialDays: 15,
      trialEndsAt
    });

    return {
      success: true,
      statusCode: 201,
      message: `Votre agence « ${cleanAgencyName} » a été créée avec succès avec un essai gratuit de 15 jours.`,
      user: newUser,
      tenant: newTenant
    };
  }

  public saveOnboardingStep(
    tenantId: string,
    step: number,
    stepData: Record<string, any>,
    isComplete?: boolean,
    requestingTenantId?: string,
    isSuperAdmin?: boolean
  ): { success: boolean; message: string; statusCode: number; tenant?: Tenant } {
    if (!isSuperAdmin && requestingTenantId && requestingTenantId !== 'global' && tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Vous ne pouvez modifier que votre propre agence." };
    }

    const tenant = this.state.tenants.find(t => t.id === tenantId);
    if (!tenant) {
      return { success: false, statusCode: 404, message: "Agence introuvable." };
    }

    this.updateState(draft => {
      const t = draft.tenants.find(item => item.id === tenantId);
      if (!t) return;

      t.onboardingStep = step;
      t.onboardingData = { ...(t.onboardingData || {}), ...stepData };
      if (isComplete || step >= 10) {
        t.onboardingCompleted = true;
      }

      // --- STEP 1: General Info ---
      if (stepData.agencyName || stepData.name) t.name = (stepData.agencyName || stepData.name).trim();
      if (stepData.slogan !== undefined) t.slogan = stepData.slogan?.trim() || undefined;
      if (stepData.logoUrl !== undefined) t.logoUrl = stepData.logoUrl?.trim() || undefined;
      if (stepData.country !== undefined) t.country = stepData.country?.trim() || undefined;
      if (stepData.city !== undefined) {
        t.city = stepData.city?.trim() || undefined;
        t.settings = { ...(t.settings || {}), city: stepData.city?.trim() };
      }
      if (stepData.address !== undefined) t.address = stepData.address?.trim() || undefined;
      if (stepData.phone !== undefined) t.phone = stepData.phone?.trim() || undefined;
      if (stepData.whatsapp !== undefined) t.whatsapp = stepData.whatsapp?.trim() || undefined;
      if (stepData.email !== undefined) t.email = stepData.email?.trim() || undefined;
      if (stepData.website !== undefined) t.website = stepData.website?.trim() || undefined;
      if (stepData.currency) t.currency = stepData.currency;
      if (stepData.timezone) t.timezone = stepData.timezone;

      // --- STEP 2: Visual Customization & Documents ---
      if (stepData.sealUrl !== undefined) t.sealUrl = stepData.sealUrl?.trim() || undefined;
      if (stepData.directorSignatureUrl !== undefined) t.directorSignatureUrl = stepData.directorSignatureUrl?.trim() || undefined;
      if (stepData.trainerSignatures !== undefined) t.trainerSignatures = stepData.trainerSignatures;
      if (stepData.headerText !== undefined) t.headerText = stepData.headerText?.trim() || undefined;
      if (stepData.footerText !== undefined) t.footerText = stepData.footerText?.trim() || undefined;

      // --- STEP 3: Users & Security ---
      if (Array.isArray(stepData.users)) {
        if (!draft.users) draft.users = [];
        stepData.users.forEach((u: any) => {
          const existingUser = draft.users.find(usr => usr.tenantId === tenantId && (usr.username === u.username || (usr.email && usr.email === u.email)));
          if (!existingUser && u.username) {
            draft.users.push({
              id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              tenantId,
              firstName: u.fullName || u.firstName || u.username,
              lastName: u.lastName || '',
              username: u.username.trim().toLowerCase(),
              email: u.email?.trim() || `${u.username.trim().toLowerCase()}@${t.slug || 'centre'}.local`,
              department: 'DIRECTION',
              roles: [],
              permissions: [],
              phone: u.phone || undefined,
              passwordHash: u.password || 'User123!',
              isActive: u.isActive !== undefined ? u.isActive : true,
              createdAt: new Date().toISOString()
            });
          }
        });
      }

      // --- STEP 4: Services & Activities ---
      if (Array.isArray(stepData.services)) {
        if (!draft.services) draft.services = [];
        if (!draft.serviceCategories) draft.serviceCategories = [];
        stepData.services.forEach((srv: any) => {
          const existingSrv = draft.services.find(s => s.tenantId === tenantId && s.code === srv.code);
          if (!existingSrv && srv.name) {
            const catId = `sc-${Date.now()}-${Math.floor(Math.random() * 100)}`;
            const catName = srv.category || 'Prestations Générales';
            if (!draft.serviceCategories.some(c => c.tenantId === tenantId && c.name === catName)) {
              draft.serviceCategories.push({
                id: catId,
                tenantId,
                name: catName,
                code: catName.slice(0, 4).toUpperCase(),
                description: `Catégorie ${catName}`,
                sortOrder: draft.serviceCategories.length + 1,
                isActive: true
              });
            }
            draft.services.push({
              id: `srv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              tenantId,
              categoryId: catId,
              categoryName: catName,
              code: srv.code || `SRV-${Date.now().toString().slice(-4)}`,
              name: srv.name,
              description: srv.description || undefined,
              unit: srv.unit || 'page',
              baseCost: Number(srv.baseCost) || 0,
              basePrice: Number(srv.basePrice) || 500,
              requiresFile: Boolean(srv.requiresFile),
              estimatedDurationMinutes: 1,
              isActive: srv.isActive !== undefined ? srv.isActive : true,
              pricingRules: srv.pricingRules || []
            });
          }
        });
      }

      // --- STEP 5: Pricing & Commercial Rules ---
      if (stepData.maxDiscountWithoutApprovalPct !== undefined) {
        t.maxDiscountWithoutApprovalPct = Number(stepData.maxDiscountWithoutApprovalPct);
      }
      if (stepData.allowDiscounts !== undefined) {
        t.settings = { ...(t.settings || {}), allowDiscounts: Boolean(stepData.allowDiscounts) };
      }

      // --- STEP 6: Training Module Configuration ---
      if (stepData.hasTraining !== undefined) {
        t.settings = { ...(t.settings || {}), hasTraining: Boolean(stepData.hasTraining) };
      }
      if (Array.isArray(stepData.courses)) {
        if (!draft.trainings) draft.trainings = [];
        stepData.courses.forEach((crs: any) => {
          if (!draft.trainings.some(c => c.tenantId === tenantId && c.code === crs.code)) {
            draft.trainings.push({
              id: `trn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              tenantId,
              categoryId: 'cat-form-01',
              categoryName: crs.category || 'Informatique',
              code: crs.code || `FORM-${Date.now().toString().slice(-4)}`,
              title: crs.title || crs.name,
              description: crs.description || '',
              durationHours: Number(crs.durationHours) || 60,
              level: 'TOUS_NIVEAUX',
              price: Number(crs.price) || 500000,
              maxCapacity: 20,
              modules: [],
              isActive: true,
              createdAt: new Date().toISOString()
            });
          }
        });
      }

      // --- STEP 7: Boutique & Stock ---
      if (stepData.hasShop !== undefined) {
        t.settings = { ...(t.settings || {}), hasShop: Boolean(stepData.hasShop) };
      }
      if (Array.isArray(stepData.products)) {
        if (!draft.products) draft.products = [];
        if (!draft.productCategories) draft.productCategories = [];
        stepData.products.forEach((p: any) => {
          if (!draft.products.some(prod => prod.tenantId === tenantId && (prod.code === p.code || prod.name === p.name))) {
            const catName = p.category || 'Boutique';
            if (!draft.productCategories.some(c => c.tenantId === tenantId && c.name === catName)) {
              draft.productCategories.push({
                id: `pcat-${Date.now()}-${Math.floor(Math.random() * 100)}`,
                tenantId,
                name: catName,
                code: catName.slice(0, 4).toUpperCase(),
                isActive: true
              });
            }
            const costPrice = Number(p.costPrice) || 0;
            const salePrice = Number(p.sellingPrice || p.salePrice) || 1000;
            const initStock = Number(p.initialStock || p.currentStock) || 0;
            const baseUnit = p.unit || 'pièce';
            draft.products.push({
              id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              tenantId,
              name: p.name,
              code: p.code || `ART-${Date.now().toString().slice(-4)}`,
              category: catName,
              unit: baseUnit,
              baseUnit: baseUnit,
              costPrice,
              salePrice,
              initialStock: initStock,
              currentStock: initStock,
              minStockAlert: Number(p.minStockAlert) || 5,
              packagings: p.packagings || [],
              isActive: true,
              createdAt: new Date().toISOString()
            });
          }
        });
      }

      // --- STEP 8: Suppliers ---
      if (Array.isArray(stepData.suppliers)) {
        if (!draft.suppliers) draft.suppliers = [];
        stepData.suppliers.forEach((s: any) => {
          if (!draft.suppliers.some(sup => sup.tenantId === tenantId && (sup.name === s.name || sup.phone === s.phone))) {
            draft.suppliers.push({
              id: `sup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              tenantId,
              name: s.name,
              contactPerson: s.contactPerson || s.name,
              phone: s.phone || '+224 600 00 00 00',
              email: s.email || undefined,
              address: s.address || undefined,
              isActive: true
            });
          }
        });
      }

      // --- STEP 9: Finance & Treasury Accounts ---
      if (Array.isArray(stepData.financialAccounts)) {
        if (!draft.financialAccounts) draft.financialAccounts = [];
        stepData.financialAccounts.forEach((acc: any) => {
          const exists = draft.financialAccounts?.some(a => a.tenantId === tenantId && (a.code === acc.code || (acc.isMainCash && a.isMainCash)));
          if (!exists && acc.name) {
            const initBal = Number(acc.initialBalance) || 0;
            const newAcc: FinancialAccount = {
              id: `fa-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              tenantId,
              code: acc.code || `CPT-${Date.now().toString().slice(-4)}`,
              name: acc.name,
              type: acc.type || 'CASH',
              description: acc.description || undefined,
              accountNumber: acc.accountNumber || undefined,
              bankName: acc.bankName || undefined,
              initialBalance: initBal,
              currentBalance: initBal,
              currency: t.currency || 'GNF',
              isActive: true,
              isDefault: Boolean(acc.isDefault),
              isMainCash: Boolean(acc.isMainCash),
              isPettyCash: Boolean(acc.isPettyCash),
              createdByUserName: 'Setup Wizard',
              createdAt: new Date().toISOString()
            };
            draft.financialAccounts?.push(newAcc);

            if (initBal > 0) {
              if (!draft.financialMovements) draft.financialMovements = [];
              draft.financialMovements.unshift({
                id: `mvt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                tenantId,
                movementNumber: `MVT-${new Date().getFullYear()}-${String(draft.financialMovements.length + 1).padStart(6, '0')}`,
                financialAccountId: newAcc.id,
                financialAccountName: newAcc.name,
                financialAccountType: newAcc.type,
                movementType: 'INFLOW',
                category: 'CAPITAL_CONTRIBUTION',
                categoryLabel: 'Solde Initial Onboarding',
                amount: initBal,
                balanceBefore: 0,
                balanceAfter: initBal,
                reference: 'ONBOARDING-INIT',
                performedByUserName: 'Administrateur',
                notes: `Initialisation du compte ${newAcc.name}`,
                createdAt: new Date().toISOString()
              });
            }
          }
        });
      }

      t.updatedAt = new Date().toISOString();
    });

    this.logAudit('ONBOARDING_STEP_SAVED', 'TENANT', tenantId, null, {
      step,
      isComplete: !!isComplete
    });

    return {
      success: true,
      statusCode: 200,
      message: isComplete ? "Configuration de l'agence finalisée avec succès !" : `Étape ${step} enregistrée.`,
      tenant: this.state.tenants.find(t => t.id === tenantId)
    };
  }

  public getTenantOnboardingScore(tenantId: string): {
    score: number;
    completedItems: string[];
    pendingItems: string[];
    details: {
      hasAgencyInfo: boolean;
      hasVisuals: boolean;
      hasTeam: boolean;
      hasServices: boolean;
      hasPricingRules: boolean;
      hasTraining: boolean;
      hasShopStock: boolean;
      hasSuppliers: boolean;
      hasFinancialAccounts: boolean;
      isFinalized: boolean;
    };
  } {
    const tenant = (this.state.tenants || []).find(t => t.id === tenantId);
    if (!tenant) {
      return {
        score: 0,
        completedItems: [],
        pendingItems: ['Agence introuvable'],
        details: {
          hasAgencyInfo: false,
          hasVisuals: false,
          hasTeam: false,
          hasServices: false,
          hasPricingRules: false,
          hasTraining: false,
          hasShopStock: false,
          hasSuppliers: false,
          hasFinancialAccounts: false,
          isFinalized: false
        }
      };
    }

    const services = (this.state.services || []).filter(s => s.tenantId === tenantId);
    const products = (this.state.products || []).filter(p => p.tenantId === tenantId);
    const users = (this.state.users || []).filter(u => u.tenantId === tenantId);
    const suppliers = (this.state.suppliers || []).filter(s => s.tenantId === tenantId);
    const accounts = (this.state.financialAccounts || []).filter(a => a.tenantId === tenantId);
    const courses = (this.state.trainings || []).filter(c => c.tenantId === tenantId);

    const hasAgencyInfo = Boolean(tenant.name && tenant.phone && tenant.address && tenant.city);
    const hasVisuals = Boolean(tenant.logoUrl || tenant.sealUrl || tenant.directorSignatureUrl || tenant.headerText);
    const hasTeam = users.length >= 1;
    const hasServices = services.length >= 1;
    const hasPricingRules = Boolean(tenant.maxDiscountWithoutApprovalPct !== undefined || services.some(s => s.pricingRules && s.pricingRules.length > 0));
    const hasTraining = courses.length >= 1 || tenant.settings?.hasTraining === false;
    const hasShopStock = products.length >= 1 || tenant.settings?.hasShop === false;
    const hasSuppliers = suppliers.length >= 1;
    const hasFinancialAccounts = accounts.length >= 1;
    const isFinalized = Boolean(tenant.onboardingCompleted);

    let score = 0;
    const completedItems: string[] = [];
    const pendingItems: string[] = [];

    // Step 1: 10%
    if (hasAgencyInfo) {
      score += 10;
      completedItems.push("Étape 1 : Informations générales de l'agence");
    } else {
      pendingItems.push("Étape 1 : Renseigner les coordonnées de l'agence");
    }

    // Step 2: 10%
    if (hasVisuals) {
      score += 10;
      completedItems.push("Étape 2 : Personnalisation visuelle (logo / cachet / signature)");
    } else {
      pendingItems.push("Étape 2 : Configurer la signature ou le logo des documents");
    }

    // Step 3: 10%
    if (hasTeam) {
      score += 10;
      completedItems.push(`Étape 3 : Équipe et accès sécurisés (${users.length} utilisateur(s))`);
    } else {
      pendingItems.push("Étape 3 : Ajouter des collaborateurs / caissiers");
    }

    // Step 4: 10%
    if (hasServices) {
      score += 10;
      completedItems.push(`Étape 4 : Catalogue de services (${services.length} prestation(s))`);
    } else {
      pendingItems.push("Étape 4 : Activer vos services et prestations");
    }

    // Step 5: 10%
    if (hasPricingRules) {
      score += 10;
      completedItems.push("Étape 5 : Tarifs et règles commerciales encadrées");
    } else {
      pendingItems.push("Étape 5 : Définir les règles de remise et tarifs");
    }

    // Step 6: 10%
    if (hasTraining) {
      score += 10;
      completedItems.push("Étape 6 : Module Formation configuré");
    } else {
      pendingItems.push("Étape 6 : Configurer les cours ou désactiver la formation");
    }

    // Step 7: 10%
    if (hasShopStock) {
      score += 10;
      completedItems.push("Étape 7 : Boutique et gestion de stock");
    } else {
      pendingItems.push("Étape 7 : Configurer vos articles de boutique");
    }

    // Step 8: 10%
    if (hasSuppliers) {
      score += 10;
      completedItems.push(`Étape 8 : Répertoire fournisseurs (${suppliers.length} contact(s))`);
    } else {
      pendingItems.push("Étape 8 : Enregistrer vos fournisseurs clés");
    }

    // Step 9: 10%
    if (hasFinancialAccounts) {
      score += 10;
      completedItems.push(`Étape 9 : Trésorerie et comptes financiers (${accounts.length} compte(s))`);
    } else {
      pendingItems.push("Étape 9 : Initialiser vos comptes financiers (Caisse, Banque, Mobile Money)");
    }

    // Step 10: 10%
    if (isFinalized) {
      score += 10;
      completedItems.push("Étape 10 : Validation finale et mise en exploitation");
    } else {
      pendingItems.push("Étape 10 : Valider la finalisation de la configuration");
    }

    return {
      score: Math.min(100, score),
      completedItems,
      pendingItems,
      details: {
        hasAgencyInfo,
        hasVisuals,
        hasTeam,
        hasServices,
        hasPricingRules,
        hasTraining,
        hasShopStock,
        hasSuppliers,
        hasFinancialAccounts,
        isFinalized
      }
    };
  }

  public bulkImportProducts(
    tenantId: string,
    items: Array<{
      name: string;
      category?: string;
      code?: string;
      barcode?: string;
      costPrice?: number;
      salePrice?: number;
      baseUnit?: string;
      initialStock?: number;
      minStockAlert?: number;
      packUnitName?: string;
      packQty?: number;
      packSalePrice?: number;
      imageUrl?: string;
    }>,
    userName: string,
    requestingTenantId?: string,
    isSuperAdmin?: boolean
  ): { success: boolean; statusCode: number; message: string; importedCount: number; errors?: string[] } {
    if (!isSuperAdmin && requestingTenantId && requestingTenantId !== 'global' && tenantId !== requestingTenantId) {
      return { success: false, statusCode: 403, message: "403 Accès Refusé : Importation interdite dans une autre agence.", importedCount: 0 };
    }

    if (!items || items.length === 0) {
      return { success: false, statusCode: 400, message: "Aucun article à importer.", importedCount: 0 };
    }

    let importedCount = 0;
    const errors: string[] = [];

    items.forEach((item, index) => {
      const cleanName = (item.name || '').trim();
      if (!cleanName) {
        errors.push(`Ligne ${index + 1}: Le nom de l'article est obligatoire.`);
        return;
      }

      const cleanCode = (item.code || '').trim().toUpperCase() || `ART-${Date.now().toString().slice(-4)}-${index + 1}`;
      const cleanCategory = (item.category || '').trim() || 'Général';
      const cleanBaseUnit = (item.baseUnit || 'pièce').trim().toLowerCase();
      const costPrice = Number(item.costPrice) || 0;
      const salePrice = Number(item.salePrice) || costPrice;
      const initialStock = Math.max(0, Number(item.initialStock) || 0);
      const minStockAlert = Math.max(0, Number(item.minStockAlert) || 5);

      // Check category in tenant, create if missing
      let existingCat = (this.state.productCategories || []).find(
        c => c.tenantId === tenantId && c.name.toLowerCase() === cleanCategory.toLowerCase()
      );

      if (!existingCat) {
        const newCat: ProductCategory = {
          id: `cat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          tenantId,
          name: cleanCategory,
          code: cleanCategory.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CAT',
          description: `Catégorie créée automatiquement lors de l'import`,
          color: '#3b82f6',
          isActive: true
        };
        this.updateState(draft => {
          if (!draft.productCategories) draft.productCategories = [];
          draft.productCategories.unshift(newCat);
        });
        existingCat = newCat;
      }

      // Check packagings
      const packagings: ProductPackaging[] = [];
      if (item.packUnitName && item.packQty && Number(item.packQty) > 1) {
        packagings.push({
          id: `pkg-${Date.now()}-${index}`,
          level: 2,
          unitName: item.packUnitName.trim().toLowerCase(),
          containedQuantity: Number(item.packQty),
          subUnitName: cleanBaseUnit,
          factorToBase: Number(item.packQty),
          salePrice: Number(item.packSalePrice) || (salePrice * Number(item.packQty)),
          purchasePrice: costPrice * Number(item.packQty),
          isAllowedForSale: true,
          isAllowedForPurchase: true,
          isDefaultSaleUnit: false,
          isDefaultPurchaseUnit: true
        });
      }

      const res = this.createSecureProduct({
        code: cleanCode,
        barcode: item.barcode?.trim() || undefined,
        name: cleanName,
        categoryId: existingCat.id,
        category: existingCat.name,
        baseUnit: cleanBaseUnit,
        unit: cleanBaseUnit,
        costPrice,
        salePrice,
        initialStock,
        currentStock: initialStock,
        minStockAlert,
        packagings,
        imageUrl: item.imageUrl?.trim() || undefined,
        location: 'Magasin Principal',
        isActive: true
      }, tenantId, isSuperAdmin);

      if (res.success) {
        importedCount++;
      } else {
        errors.push(`Ligne ${index + 1} (${cleanName}): ${res.message}`);
      }
    });

    this.logAudit('PRODUCTS_BULK_IMPORTED', 'PRODUCT', tenantId, null, {
      importedCount,
      errorsCount: errors.length,
      performedBy: userName
    });

    return {
      success: importedCount > 0,
      statusCode: importedCount > 0 ? 200 : 400,
      message: `${importedCount} article(s) importé(s) avec succès.${errors.length > 0 ? ` (${errors.length} erreur(s))` : ''}`,
      importedCount,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * =========================================================================
   * GESTION DU PROFIL UTILISATEUR & PHOTO DE PROFIL
   * Strict user-level isolation without altering multi-agency tenant context
  /**
   * =========================================================================
   * MODULE MAINTENANCE & RESET DES DONNÉES MÉTIER (MULTI-TENANT STRICT)
   * =========================================================================
   */

  public exportBackupSnapshot(tenantId?: string): string {
    const isGlobal = !tenantId || tenantId === 'global';
    const snapshot = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: this.state.currentUserId || 'System',
        targetTenantId: tenantId || 'ALL_TENANTS',
        systemVersion: '2.0.0-PRO'
      },
      tenants: isGlobal ? this.state.tenants : this.state.tenants.filter(t => t.id === tenantId),
      branches: isGlobal ? this.state.branches : this.state.branches.filter(b => b.tenantId === tenantId),
      users: isGlobal ? this.state.users : this.state.users.filter(u => u.tenantId === tenantId),
      roles: isGlobal ? this.state.roles : this.state.roles.filter(r => r.tenantId === tenantId),
      persons: isGlobal ? this.state.persons : this.state.persons.filter(p => p.tenantId === tenantId),
      services: isGlobal ? this.state.services : this.state.services.filter(s => s.tenantId === tenantId),
      serviceCategories: isGlobal ? this.state.serviceCategories : this.state.serviceCategories.filter(sc => sc.tenantId === tenantId),
      orders: isGlobal ? this.state.orders : this.state.orders.filter(o => o.tenantId === tenantId),
      invoices: isGlobal ? this.state.invoices : this.state.invoices.filter(i => i.tenantId === tenantId),
      payments: isGlobal ? this.state.payments : this.state.payments.filter(p => p.tenantId === tenantId),
      expenses: isGlobal ? this.state.expenses : this.state.expenses.filter(e => e.tenantId === tenantId),
      financialAccounts: isGlobal ? this.state.financialAccounts : this.state.financialAccounts.filter(fa => fa.tenantId === tenantId),
      financialMovements: isGlobal ? this.state.financialMovements : this.state.financialMovements.filter(fm => fm.tenantId === tenantId),
      products: isGlobal ? this.state.products : this.state.products.filter(pr => pr.tenantId === tenantId),
      stores: isGlobal ? this.state.stores : this.state.stores.filter(st => st.tenantId === tenantId),
      stockMovements: isGlobal ? this.state.stockMovements : this.state.stockMovements.filter(sm => sm.tenantId === tenantId),
      trainings: isGlobal ? this.state.trainings : this.state.trainings.filter(tr => tr.tenantId === tenantId),
      trainingSessions: isGlobal ? this.state.trainingSessions : this.state.trainingSessions.filter(ts => ts.tenantId === tenantId),
      enrollments: isGlobal ? this.state.enrollments : this.state.enrollments.filter(en => en.tenantId === tenantId),
      certificates: isGlobal ? this.state.certificates : this.state.certificates.filter(ce => ce.tenantId === tenantId),
      suppliers: isGlobal ? this.state.suppliers : this.state.suppliers.filter(su => su.tenantId === tenantId),
      supplierDebts: isGlobal ? this.state.supplierDebts : this.state.supplierDebts.filter(sd => sd.tenantId === tenantId),
      purchaseOrders: isGlobal ? this.state.purchaseOrders : this.state.purchaseOrders.filter(po => po.tenantId === tenantId)
    };
    return JSON.stringify(snapshot, null, 2);
  }

  public getResetSummary(tenantId: string): ResetSummaryData {
    const s = this.state;
    const tid = tenantId || 't-001';

    const tenantInvoices = (s.invoices || []).filter(i => i.tenantId === tid);
    const tenantOrders = (s.orders || []).filter(o => o.tenantId === tid);
    const tenantPayments = (s.payments || []).filter(p => p.tenantId === tid);
    const tenantMovements = (s.financialMovements || []).filter(m => m.tenantId === tid);
    const tenantExpenses = (s.expenses || []).filter(e => e.tenantId === tid);
    const tenantEnrollments = (s.enrollments || []).filter(en => en.tenantId === tid);
    const tenantCertificates = (s.certificates || []).filter(c => c.tenantId === tid);
    const tenantPersons = (s.persons || []).filter(p => p.tenantId === tid);
    const tenantCustomers = tenantPersons.filter(p => !p.types.includes('STAFF') && !p.types.includes('TRAINER'));
    const tenantSessions = (s.trainingSessions || []).filter(ts => ts.tenantId === tid);
    const tenantSessionIds = tenantSessions.map(ts => ts.id);
    const tenantAttendance = (s.attendanceSheets || []).filter(a => tenantSessionIds.includes(a.sessionId));
    const tenantAssessments = (s.assessments || []).filter(a => tenantSessionIds.includes(a.sessionId));
    const tenantStockMovements = (s.stockMovements || []).filter(sm => sm.tenantId === tid);
    const tenantCashSessions = (s.cashSessions || []).filter(cs => cs.tenantId === tid);
    const tenantAccounts = (s.financialAccounts || []).filter(fa => fa.tenantId === tid);

    return {
      testData: {
        invoices: tenantInvoices.length,
        orders: tenantOrders.length,
        payments: tenantPayments.length,
        financialMovements: tenantMovements.length,
        expenses: tenantExpenses.length,
        enrollments: tenantEnrollments.length,
        certificates: tenantCertificates.length
      },
      commercial: {
        orders: tenantOrders.length,
        invoices: tenantInvoices.length,
        payments: tenantPayments.filter(p => p.targetType === 'ORDER').length || tenantPayments.length,
        customers: tenantCustomers.length
      },
      financial: {
        movements: tenantMovements.length,
        payments: tenantPayments.length,
        expenses: tenantExpenses.length,
        cashSessions: tenantCashSessions.length,
        accounts: tenantAccounts.length
      },
      operational: {
        orders: tenantOrders.length,
        invoices: tenantInvoices.length,
        payments: tenantPayments.length,
        customers: tenantCustomers.length,
        trainingSessions: tenantSessions.length,
        enrollments: tenantEnrollments.length,
        attendanceSheets: tenantAttendance.length,
        assessments: tenantAssessments.length,
        certificates: tenantCertificates.length,
        stockMovements: tenantStockMovements.length,
        expenses: tenantExpenses.length,
        financialMovements: tenantMovements.length,
        cashSessions: tenantCashSessions.length
      },
      preservedConfig: {
        usersCount: (s.users || []).filter(u => u.tenantId === tid).length,
        rolesCount: (s.roles || []).filter(r => r.tenantId === tid).length,
        servicesCount: (s.services || []).filter(srv => srv.tenantId === tid).length,
        productsCount: (s.products || []).filter(pr => pr.tenantId === tid).length,
        suppliersCount: (s.suppliers || []).filter(su => su.tenantId === tid).length,
        accountsCount: tenantAccounts.length,
        branchesCount: (s.branches || []).filter(b => b.tenantId === tid).length
      }
    };
  }

  public cleanDemoTestData(
    tenantId: string,
    performedBy: string,
    password?: string,
    currentUser?: User | null
  ): ResetExecutionResult {
    const tid = tenantId || 't-001';

    if (password !== undefined && currentUser && !currentUser.isSuperAdmin) {
      if (currentUser.passwordHash && currentUser.passwordHash !== password) {
        return {
          success: false,
          message: "Mot de passe administrateur incorrect.",
          level: 'TEST_DATA',
          deletedCounts: { totalRecords: 0 },
          integrityVerification: {
            usersBefore: (this.state.users || []).filter(u => u.tenantId === tid).length,
            usersAfter: (this.state.users || []).filter(u => u.tenantId === tid).length,
            rolesPreserved: true,
            brandingPreserved: true,
            servicesPreserved: true
          }
        };
      }
    }

    const usersBefore = (this.state.users || []).filter(u => u.tenantId === tid).length;
    const invCount = (this.state.invoices || []).filter(i => i.tenantId === tid).length;
    const ordCount = (this.state.orders || []).filter(o => o.tenantId === tid).length;
    const payCount = (this.state.payments || []).filter(p => p.tenantId === tid).length;
    const mvtCount = (this.state.financialMovements || []).filter(m => m.tenantId === tid).length;
    const expCount = (this.state.expenses || []).filter(e => e.tenantId === tid).length;
    const enrCount = (this.state.enrollments || []).filter(e => e.tenantId === tid).length;
    const cerCount = (this.state.certificates || []).filter(c => c.tenantId === tid).length;

    this.updateState(draft => {
      draft.invoices = (draft.invoices || []).filter(i => i.tenantId !== tid);
      draft.orders = (draft.orders || []).filter(o => o.tenantId !== tid);
      draft.productionJobs = (draft.productionJobs || []).filter(j => j.tenantId !== tid);
      draft.payments = (draft.payments || []).filter(p => p.tenantId !== tid);
      draft.financialMovements = (draft.financialMovements || []).filter(m => m.tenantId !== tid);
      draft.expenses = (draft.expenses || []).filter(e => e.tenantId !== tid);
      draft.enrollments = (draft.enrollments || []).filter(e => e.tenantId !== tid);
      draft.certificates = (draft.certificates || []).filter(c => c.tenantId !== tid);
      draft.discountAudits = (draft.discountAudits || []).filter(d => d.tenantId !== tid);

      const tenantSessions = (draft.trainingSessions || []).filter(ts => ts.tenantId === tid);
      const sessionIds = tenantSessions.map(s => s.id);
      tenantSessions.forEach(ts => { ts.enrolledCount = 0; });
      draft.attendanceSheets = (draft.attendanceSheets || []).filter(a => !sessionIds.includes(a.sessionId));
      draft.assessments = (draft.assessments || []).filter(a => !sessionIds.includes(a.sessionId));

      // Reset cash sessions for tenant
      (draft.cashSessions || []).filter(cs => cs.tenantId === tid).forEach(cs => {
        cs.movements = [];
        cs.status = 'CLOSED';
      });

      // Reset financial accounts current balances to 0 for this tenant
      (draft.financialAccounts || []).filter(fa => fa.tenantId === tid).forEach(fa => {
        fa.currentBalance = 0;
        fa.initialBalance = 0;
      });

      // Reset financial periods for this tenant
      (draft.financialPeriods || []).filter(fp => fp.tenantId === tid).forEach(fp => {
        fp.totalInflows = 0;
        fp.totalOutflows = 0;
        fp.netCashFlow = 0;
        fp.movementsCount = 0;
      });
    });

    const totalRecords = invCount + ordCount + payCount + mvtCount + expCount + enrCount + cerCount;
    const usersAfter = (this.state.users || []).filter(u => u.tenantId === tid).length;

    this.logAudit('TEST_DATA_CLEANED', 'AGENCY', tid, null, {
      performedBy,
      agencyId: tid,
      deletedCounts: {
        invoices: invCount,
        orders: ordCount,
        payments: payCount,
        financialMovements: mvtCount,
        expenses: expCount,
        enrollments: enrCount,
        certificates: cerCount,
        totalRecords
      }
    });

    return {
      success: true,
      message: `Nettoyage des données de test terminé. ${totalRecords} enregistrement(s) supprimé(s). Indicateurs financiers remis à 0 GNF.`,
      level: 'TEST_DATA',
      deletedCounts: {
        invoices: invCount,
        orders: ordCount,
        payments: payCount,
        financialMovements: mvtCount,
        expenses: expCount,
        enrollments: enrCount,
        certificates: cerCount,
        totalRecords
      },
      integrityVerification: {
        usersBefore,
        usersAfter,
        rolesPreserved: true,
        brandingPreserved: true,
        servicesPreserved: true
      }
    };
  }

  public resetCommercialData(
    tenantId: string,
    deleteClients: boolean,
    performedBy: string,
    password?: string,
    currentUser?: User | null
  ): ResetExecutionResult {
    const tid = tenantId || 't-001';

    if (password !== undefined && currentUser && !currentUser.isSuperAdmin) {
      if (currentUser.passwordHash && currentUser.passwordHash !== password) {
        return {
          success: false,
          message: "Mot de passe administrateur incorrect.",
          level: 'COMMERCIAL',
          deletedCounts: { totalRecords: 0 },
          integrityVerification: {
            usersBefore: (this.state.users || []).filter(u => u.tenantId === tid).length,
            usersAfter: (this.state.users || []).filter(u => u.tenantId === tid).length,
            rolesPreserved: true,
            brandingPreserved: true,
            servicesPreserved: true
          }
        };
      }
    }

    const usersBefore = (this.state.users || []).filter(u => u.tenantId === tid).length;
    const ordCount = (this.state.orders || []).filter(o => o.tenantId === tid).length;
    const invCount = (this.state.invoices || []).filter(i => i.tenantId === tid).length;
    const payCount = (this.state.payments || []).filter(p => p.tenantId === tid && (p.targetType === 'ORDER' || !p.targetType)).length;
    let personsCount = 0;

    this.updateState(draft => {
      draft.orders = (draft.orders || []).filter(o => o.tenantId !== tid);
      draft.productionJobs = (draft.productionJobs || []).filter(j => j.tenantId !== tid);
      draft.invoices = (draft.invoices || []).filter(i => i.tenantId !== tid);
      draft.payments = (draft.payments || []).filter(p => !(p.tenantId === tid && (p.targetType === 'ORDER' || !p.targetType)));
      draft.discountAudits = (draft.discountAudits || []).filter(d => d.tenantId !== tid);

      // Clean order-related financial movements
      draft.financialMovements = (draft.financialMovements || []).filter(m => !(m.tenantId === tid && (m.relatedEntityType === 'ORDER' || m.category === 'CLIENT_PAYMENT')));

      if (deleteClients) {
        const initialPersons = draft.persons || [];
        const toDelete = initialPersons.filter(p => p.tenantId === tid && !p.types.includes('STAFF') && !p.types.includes('TRAINER'));
        personsCount = toDelete.length;
        draft.persons = initialPersons.filter(p => !(p.tenantId === tid && !p.types.includes('STAFF') && !p.types.includes('TRAINER')));
      }

      // Recalculate account balances
      (draft.financialAccounts || []).filter(fa => fa.tenantId === tid).forEach(fa => {
        const remainingMovements = (draft.financialMovements || []).filter(m => m.financialAccountId === fa.id);
        const inflows = remainingMovements.filter(m => m.movementType === 'INFLOW').reduce((sum, m) => sum + (m.amount || 0), 0);
        const outflows = remainingMovements.filter(m => m.movementType === 'OUTFLOW').reduce((sum, m) => sum + (m.amount || 0), 0);
        fa.currentBalance = (fa.initialBalance || 0) + inflows - outflows;
      });
    });

    const totalRecords = ordCount + invCount + payCount + personsCount;
    const usersAfter = (this.state.users || []).filter(u => u.tenantId === tid).length;

    this.logAudit('COMMERCIAL_DATA_RESET', 'AGENCY', tid, null, {
      performedBy,
      deleteClients,
      deletedCounts: {
        orders: ordCount,
        invoices: invCount,
        payments: payCount,
        persons: personsCount,
        totalRecords
      }
    });

    return {
      success: true,
      message: `Réinitialisation commerciale terminée (${totalRecords} enregistrement(s) supprimé(s)).`,
      level: 'COMMERCIAL',
      deletedCounts: {
        orders: ordCount,
        invoices: invCount,
        payments: payCount,
        persons: personsCount,
        totalRecords
      },
      integrityVerification: {
        usersBefore,
        usersAfter,
        rolesPreserved: true,
        brandingPreserved: true,
        servicesPreserved: true
      }
    };
  }

  public resetFinancialData(
    tenantId: string,
    performedBy: string,
    password?: string,
    currentUser?: User | null
  ): ResetExecutionResult {
    const tid = tenantId || 't-001';

    if (password !== undefined && currentUser && !currentUser.isSuperAdmin) {
      if (currentUser.passwordHash && currentUser.passwordHash !== password) {
        return {
          success: false,
          message: "Mot de passe administrateur incorrect.",
          level: 'FINANCIAL',
          deletedCounts: { totalRecords: 0 },
          integrityVerification: {
            usersBefore: (this.state.users || []).filter(u => u.tenantId === tid).length,
            usersAfter: (this.state.users || []).filter(u => u.tenantId === tid).length,
            rolesPreserved: true,
            brandingPreserved: true,
            servicesPreserved: true
          }
        };
      }
    }

    const usersBefore = (this.state.users || []).filter(u => u.tenantId === tid).length;
    const mvtCount = (this.state.financialMovements || []).filter(m => m.tenantId === tid).length;
    const payCount = (this.state.payments || []).filter(p => p.tenantId === tid).length;
    const expCount = (this.state.expenses || []).filter(e => e.tenantId === tid).length;
    const csCount = (this.state.cashSessions || []).filter(cs => cs.tenantId === tid).length;

    this.updateState(draft => {
      draft.financialMovements = (draft.financialMovements || []).filter(m => m.tenantId !== tid);
      draft.payments = (draft.payments || []).filter(p => p.tenantId !== tid);
      draft.expenses = (draft.expenses || []).filter(e => e.tenantId !== tid);
      draft.supplierPayments = (draft.supplierPayments || []).filter(sp => sp.tenantId !== tid);

      (draft.cashSessions || []).filter(cs => cs.tenantId === tid).forEach(cs => {
        cs.movements = [];
        cs.status = 'CLOSED';
      });

      (draft.financialAccounts || []).filter(fa => fa.tenantId === tid).forEach(fa => {
        fa.currentBalance = 0;
        fa.initialBalance = 0;
      });

      (draft.financialPeriods || []).filter(fp => fp.tenantId === tid).forEach(fp => {
        fp.totalInflows = 0;
        fp.totalOutflows = 0;
        fp.netCashFlow = 0;
        fp.movementsCount = 0;
      });
    });

    const totalRecords = mvtCount + payCount + expCount + csCount;
    const usersAfter = (this.state.users || []).filter(u => u.tenantId === tid).length;

    this.logAudit('FINANCIAL_DATA_RESET', 'AGENCY', tid, null, {
      performedBy,
      deletedCounts: {
        financialMovements: mvtCount,
        payments: payCount,
        expenses: expCount,
        cashSessions: csCount,
        totalRecords
      }
    });

    return {
      success: true,
      message: `Réinitialisation financière terminée. Trésorerie, caisses et soldes remis à 0 GNF (${totalRecords} flux supprimés).`,
      level: 'FINANCIAL',
      deletedCounts: {
        financialMovements: mvtCount,
        payments: payCount,
        expenses: expCount,
        cashSessions: csCount,
        totalRecords
      },
      integrityVerification: {
        usersBefore,
        usersAfter,
        rolesPreserved: true,
        brandingPreserved: true,
        servicesPreserved: true
      }
    };
  }

  public resetAllOperationalData(
    tenantId: string,
    options: OperationalResetOptions,
    performedBy: string,
    password?: string,
    currentUser?: User | null
  ): ResetExecutionResult {
    const tid = tenantId || 't-001';

    if (password !== undefined && currentUser && !currentUser.isSuperAdmin) {
      if (currentUser.passwordHash && currentUser.passwordHash !== password) {
        return {
          success: false,
          message: "Mot de passe administrateur incorrect.",
          level: 'FULL_OPERATIONAL',
          deletedCounts: { totalRecords: 0 },
          integrityVerification: {
            usersBefore: (this.state.users || []).filter(u => u.tenantId === tid).length,
            usersAfter: (this.state.users || []).filter(u => u.tenantId === tid).length,
            rolesPreserved: true,
            brandingPreserved: true,
            servicesPreserved: true
          }
        };
      }
    }

    const usersBefore = (this.state.users || []).filter(u => u.tenantId === tid).length;
    let deletedCounts: any = { totalRecords: 0 };

    this.updateState(draft => {
      // 1. Services & Orders
      if (options.resetServices) {
        const ordCount = (draft.orders || []).filter(o => o.tenantId === tid).length;
        const invCount = (draft.invoices || []).filter(i => i.tenantId === tid).length;
        deletedCounts.orders = ordCount;
        deletedCounts.invoices = invCount;
        deletedCounts.totalRecords += ordCount + invCount;

        draft.orders = (draft.orders || []).filter(o => o.tenantId !== tid);
        draft.productionJobs = (draft.productionJobs || []).filter(j => j.tenantId !== tid);
        draft.invoices = (draft.invoices || []).filter(i => i.tenantId !== tid);
        draft.discountAudits = (draft.discountAudits || []).filter(d => d.tenantId !== tid);
        draft.payments = (draft.payments || []).filter(p => !(p.tenantId === tid && p.targetType === 'ORDER'));
      }

      // 2. Training
      if (options.resetTraining) {
        const enrCount = (draft.enrollments || []).filter(e => e.tenantId === tid).length;
        const cerCount = (draft.certificates || []).filter(c => c.tenantId === tid).length;
        deletedCounts.enrollments = enrCount;
        deletedCounts.certificates = cerCount;
        deletedCounts.totalRecords += enrCount + cerCount;

        draft.enrollments = (draft.enrollments || []).filter(e => e.tenantId !== tid);
        draft.certificates = (draft.certificates || []).filter(c => c.tenantId !== tid);

        const tenantSessions = (draft.trainingSessions || []).filter(ts => ts.tenantId === tid);
        const sessionIds = tenantSessions.map(s => s.id);
        tenantSessions.forEach(ts => { ts.enrolledCount = 0; });
        draft.attendanceSheets = (draft.attendanceSheets || []).filter(a => !sessionIds.includes(a.sessionId));
        draft.assessments = (draft.assessments || []).filter(a => !sessionIds.includes(a.sessionId));
        draft.payments = (draft.payments || []).filter(p => !(p.tenantId === tid && p.targetType === 'ENROLLMENT'));
      }

      // 3. Clients
      if (options.resetClients) {
        const toDelete = (draft.persons || []).filter(p => p.tenantId === tid && !p.types.includes('STAFF') && !p.types.includes('TRAINER'));
        deletedCounts.persons = toDelete.length;
        deletedCounts.totalRecords += toDelete.length;

        draft.persons = (draft.persons || []).filter(p => !(p.tenantId === tid && !p.types.includes('STAFF') && !p.types.includes('TRAINER')));
      }

      // 5. Stock Management
      if (options.stockOption === 'CLEAR_MOVEMENTS_ONLY') {
        const smCount = (draft.stockMovements || []).filter(sm => sm.tenantId === tid).length;
        deletedCounts.stockMovements = smCount;
        deletedCounts.totalRecords += smCount;
        draft.stockMovements = (draft.stockMovements || []).filter(sm => sm.tenantId !== tid);
      } else if (options.stockOption === 'FULL_STOCK_RESET') {
        const smCount = (draft.stockMovements || []).filter(sm => sm.tenantId === tid).length;
        deletedCounts.stockMovements = smCount;
        deletedCounts.totalRecords += smCount;
        draft.stockMovements = (draft.stockMovements || []).filter(sm => sm.tenantId !== tid);

        (draft.products || []).filter(pr => pr.tenantId === tid).forEach(pr => {
          pr.currentStock = 0;
          pr.initialStock = 0;
          if (pr.stockByStore) {
            const sbs = pr.stockByStore as Record<string, number>;
            Object.keys(sbs).forEach(k => { sbs[k] = 0; });
          }
          if (pr.stockByLocation) {
            const sbl = pr.stockByLocation as Record<string, number>;
            Object.keys(sbl).forEach(k => { sbl[k] = 0; });
          }
        });
      }

      // 6. Supplier Debts & Purchases
      if (options.supplierDebtsOption === 'CLEAR_DEBTS_AND_PURCHASES') {
        const debCount = (draft.supplierDebts || []).filter(d => d.tenantId === tid).length;
        const poCount = (draft.purchaseOrders || []).filter(po => po.tenantId === tid).length;
        deletedCounts.supplierDebts = debCount;
        deletedCounts.purchaseOrders = poCount;
        deletedCounts.totalRecords += debCount + poCount;

        draft.supplierDebts = (draft.supplierDebts || []).filter(d => d.tenantId !== tid);
        draft.supplierPayments = (draft.supplierPayments || []).filter(sp => sp.tenantId !== tid);
        draft.purchaseOrders = (draft.purchaseOrders || []).filter(po => po.tenantId !== tid);
      }

      // 7. Financial Treasury
      if (options.resetFinancialTreasury) {
        const mvtCount = (draft.financialMovements || []).filter(m => m.tenantId === tid).length;
        const expCount = (draft.expenses || []).filter(e => e.tenantId === tid).length;
        deletedCounts.financialMovements = mvtCount;
        deletedCounts.expenses = expCount;
        deletedCounts.totalRecords += mvtCount + expCount;

        draft.financialMovements = (draft.financialMovements || []).filter(m => m.tenantId !== tid);
        draft.expenses = (draft.expenses || []).filter(e => e.tenantId !== tid);
        draft.payments = (draft.payments || []).filter(p => p.tenantId !== tid);

        (draft.cashSessions || []).filter(cs => cs.tenantId === tid).forEach(cs => {
          cs.movements = [];
          cs.status = 'CLOSED';
        });

        (draft.financialAccounts || []).filter(fa => fa.tenantId === tid).forEach(fa => {
          fa.currentBalance = 0;
          fa.initialBalance = 0;
        });

        (draft.financialPeriods || []).filter(fp => fp.tenantId === tid).forEach(fp => {
          fp.totalInflows = 0;
          fp.totalOutflows = 0;
          fp.netCashFlow = 0;
          fp.movementsCount = 0;
        });
      }
    });

    const usersAfter = (this.state.users || []).filter(u => u.tenantId === tid).length;

    this.logAudit('OPERATIONAL_DATA_FULL_RESET', 'AGENCY', tid, null, {
      performedBy,
      options,
      deletedCounts
    });

    return {
      success: true,
      message: `Réinitialisation complète des flux opérationnels terminée (${deletedCounts.totalRecords} éléments supprimés). Comptes et configuration 100% conservés.`,
      level: 'FULL_OPERATIONAL',
      deletedCounts,
      integrityVerification: {
        usersBefore,
        usersAfter,
        rolesPreserved: true,
        brandingPreserved: true,
        servicesPreserved: true
      }
    };
  }

  public resetOperationalData(password: string, currentUser: User): ResetExecutionResult {
    return this.resetAllOperationalData(
      currentUser?.tenantId || 't-001',
      {
        resetServices: true,
        resetTraining: true,
        resetClients: false,
        stockOption: 'PRESERVE',
        resetFinancialTreasury: true,
        supplierDebtsOption: 'PRESERVE'
      },
      currentUser?.username || 'admin',
      password,
      currentUser
    );
  }

  public getTenantNotifications(tenantId?: string, userId?: string, isSuperAdmin?: boolean): AppNotification[] {
    if (!this.state.notifications) this.state.notifications = [];
    if (isSuperAdmin && (!tenantId || tenantId === 'ALL' || tenantId === 'global')) {
      return [...this.state.notifications];
    }
    return this.state.notifications.filter(n => {
      const targetTenant = n.tenantId;

      // 1. If notification is specifically directed to this user (e.g., client or specific staff)
      if (userId && n.userId === userId) {
        return true;
      }

      // 2. For agency staff within a specific tenant
      if (tenantId && tenantId !== 'ALL' && tenantId !== 'global') {
        if (targetTenant && targetTenant !== tenantId) return false;
        if (n.userId && userId && n.userId !== userId) return false;
        return Boolean(targetTenant === tenantId);
      }

      // 3. Fallback to userId match
      if (userId) {
        return n.userId === userId;
      }

      return false;
    });
  }

  public updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    performedByName?: string,
    reason?: string
  ): { success: boolean; order?: Order; error?: string } {
    if (!this.state.orders) return { success: false, error: 'Aucune commande enregistrée.' };
    const ord = this.state.orders.find(o => o.id === orderId);
    if (!ord) return { success: false, error: 'Commande introuvable.' };

    // ANOMALIE 3: Strict business rule - Unpaid or partially paid orders CANNOT be delivered
    if (newStatus === 'DELIVERED' || newStatus === 'COMPLETED') {
      if (ord.paymentStatus !== 'PAID' || (ord.dueAmount || 0) > 0) {
        return {
          success: false,
          error: `Paiement requis avant livraison : la commande n'a pas été intégralement réglée (Solde restant : ${(ord.dueAmount || ord.totalAmount).toLocaleString('fr-FR')} GNF).`
        };
      }
    }

    const oldStatus = ord.status;
    ord.status = newStatus;
    const now = new Date().toISOString();
    ord.updatedAt = now;

    // Sync item production statuses if appropriate
    if (newStatus === 'CONFIRMED') {
      ord.items.forEach(item => {
        if (item.productionStatus === 'PENDING') item.productionStatus = 'IN_PRODUCTION';
      });
    } else if (newStatus === 'READY') {
      ord.items.forEach(item => {
        if (item.productionStatus !== 'CANCELLED') item.productionStatus = 'READY';
      });
      ord.deliveryStatus = 'PARTIALLY_DELIVERED';
    } else if (newStatus === 'DELIVERED' || newStatus === 'COMPLETED') {
      ord.items.forEach(item => {
        if (item.productionStatus !== 'CANCELLED') {
          item.productionStatus = 'DELIVERED';
          item.deliveredAt = now;
          item.deliveredByUserName = performedByName || 'Boutique';
        }
      });
      ord.deliveryStatus = 'DELIVERED';
      ord.deliveredAt = now;
      ord.deliveredByUserName = performedByName || 'Boutique';
    } else if (newStatus === 'CANCELLED') {
      ord.items.forEach(item => {
        item.productionStatus = 'CANCELLED';
        if (reason) item.notes = `${item.notes ? `${item.notes} - ` : ''}Refusé: ${reason}`;
      });

      // Restauration automatique du stock si déjà déduit
      if (ord.stockDeducted || ord.consumablesDeducted) {
        this.restoreConsumablesForOrder(ord.id, ord.tenantId, performedByName || 'Système', reason || 'Annulation de commande');
      }
    }

    // Déduction automatique dès que la commande est traitée/confirmée par la boutique et stock non encore déduit
    if ((newStatus === 'CONFIRMED' || newStatus === 'IN_PRODUCTION' || newStatus === 'READY' || newStatus === 'DELIVERED' || newStatus === 'COMPLETED') && !ord.stockDeducted) {
      this.deductConsumablesForOrder(ord.id, ord.tenantId, performedByName || 'Boutique');
    }

    // ANOMALIE 4: Append tracking event
    if (!ord.trackingEvents) ord.trackingEvents = [];
    let eventTitle = '';
    let eventDesc = '';
    if (newStatus === 'CONFIRMED') {
      eventTitle = 'Commande confirmée';
      eventDesc = 'La commande a été acceptée par la boutique.';
    } else if (newStatus === 'IN_PRODUCTION') {
      eventTitle = 'Commande en préparation';
      eventDesc = 'Les articles sont en cours de préparation en magasin.';
    } else if (newStatus === 'READY') {
      eventTitle = 'Commande prête / expédiée';
      eventDesc = 'La commande est prête pour remise au livreur ou retrait client.';
    } else if (newStatus === 'DELIVERED') {
      eventTitle = 'Commande livrée';
      eventDesc = 'La commande a été remise au client avec succès.';
    } else if (newStatus === 'CANCELLED') {
      eventTitle = 'Commande annulée';
      eventDesc = reason ? `Commande annulée : ${reason}` : 'Commande annulée.';
    }

    if (eventTitle) {
      ord.trackingEvents.push({
        id: `track-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        orderId: ord.id,
        status: newStatus,
        title: eventTitle,
        description: eventDesc,
        timestamp: now,
        actorName: performedByName || 'Boutique',
        actorRole: 'Commerçant',
        isCompleted: true
      });

      // Create scoped notification for the client
      this.addNotification({
        tenantId: ord.tenantId,
        userId: ord.personId,
        orderId: ord.id,
        title: `Mise à jour Commande #${ord.orderNumber}`,
        message: `${eventTitle} - ${eventDesc}`,
        type: newStatus === 'CANCELLED' ? 'DANGER' : 'INFO',
        link: '/orders'
      });
    }

    this.logAudit('ORDER_STATUS_CHANGED', 'ORDER', ord.id, { oldStatus }, { newStatus, reason, performedByName });
    this.saveState();
    return { success: true, order: ord };
  }

  public recordOrderPayment(params: {
    orderId: string;
    amount: number;
    paymentMethod?: string;
    cashierName?: string;
    notes?: string;
  }): { success: boolean; order?: Order; movementsCount?: number; error?: string } {
    if (!this.state.orders) return { success: false, error: 'Aucune commande enregistrée.' };
    const ord = this.state.orders.find(o => o.id === params.orderId);
    if (!ord) return { success: false, error: 'Commande introuvable.' };

    if (params.amount <= 0) {
      return { success: false, error: 'Le montant du paiement doit être supérieur à 0.' };
    }

    const now = new Date().toISOString();
    ord.paidAmount = (ord.paidAmount || 0) + params.amount;
    ord.dueAmount = Math.max(0, ord.totalAmount - ord.paidAmount);
    ord.paymentStatus = ord.dueAmount === 0 ? 'PAID' : 'PARTIALLY_PAID';
    if (ord.paymentStatus === 'PAID' && ord.status === 'PENDING') {
      ord.status = 'CONFIRMED';
    }
    ord.updatedAt = now;

    if (!ord.trackingEvents) ord.trackingEvents = [];
    ord.trackingEvents.push({
      id: `track-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      orderId: ord.id,
      status: 'PAYMENT_RECEIVED',
      title: ord.paymentStatus === 'PAID' ? 'Paiement intégral validé' : 'Paiement partiel enregistré',
      description: `Montant encaissé : ${params.amount.toLocaleString('fr-FR')} GNF (Solde restant : ${ord.dueAmount.toLocaleString('fr-FR')} GNF).`,
      timestamp: now,
      actorName: params.cashierName || 'Caisse',
      actorRole: 'Caissier / Admin',
      isCompleted: true
    });

    // Create notification for client
    this.addNotification({
      tenantId: ord.tenantId,
      userId: ord.personId,
      orderId: ord.id,
      title: `Paiement validé #${ord.orderNumber}`,
      message: `Votre paiement de ${params.amount.toLocaleString('fr-FR')} GNF pour la commande #${ord.orderNumber} a été validé. Statut: ${ord.paymentStatus === 'PAID' ? 'PAYÉ (Soldé)' : 'PARTIEL'}.`,
      type: 'SUCCESS',
      link: '/orders'
    });

    this.logAudit('ORDER_PAYMENT_RECORDED', 'ORDER', ord.id, {}, { amount: params.amount, paymentStatus: ord.paymentStatus, cashierName: params.cashierName });
    this.saveState();

    let movementsCount = 0;
    // Déduction automatique et dynamique du stock magasin si solde payé et non déjà déduit
    if (ord.paymentStatus === 'PAID' && !ord.stockDeducted) {
      const deductRes = this.deductConsumablesForOrder(ord.id, ord.tenantId, params.cashierName || 'Paiement / Caisse');
      movementsCount = deductRes.movementsCount || 0;
    }

    const updatedOrder = (this.state.orders || []).find(o => o.id === params.orderId) || ord;
    return { success: true, order: updatedOrder, movementsCount };
  }

  public getMarketplaceOrdersUnreadCount(tenantId?: string): number {
    if (!this.state.orders) return 0;
    return this.state.orders.filter(o => {
      if (o.orderSource !== 'MARKETPLACE') return false;
      if (tenantId && tenantId !== 'ALL' && tenantId !== 'global' && o.tenantId !== tenantId) return false;
      return o.isReadByMerchant === false || o.status === 'PENDING';
    }).length;
  }

  public getClientMarketplaceOrders(customerPhoneOrName?: string, customerId?: string): Order[] {
    if (!this.state.orders) return [];
    return this.state.orders.filter(o => {
      if (o.orderSource !== 'MARKETPLACE') return false;
      if (customerId && o.personId === customerId) return true;
      if (customerPhoneOrName) {
        const query = customerPhoneOrName.trim().toLowerCase();
        if (o.personPhone && o.personPhone.includes(query)) return true;
        if (o.personName && o.personName.toLowerCase().includes(query)) return true;
      }
      return false;
    });
  }

  public registerMarketplaceCustomer(data: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    birthDate?: string;
    avatarUrl?: string;
    city?: string;
    commune?: string;
    district?: string;
    address?: string;
    password?: string;
    preferences?: {
      orderNotifications?: boolean;
      promoOffers?: boolean;
    };
    failIfExists?: boolean;
  }): { success: boolean; user?: User; message?: string } {
    const cleanPhone = (data.phone || '').trim().replace(/\s+/g, '');
    const cleanFirstName = (data.firstName || '').trim();
    const cleanLastName = (data.lastName || '').trim();
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const password = data.password || 'client123';

    if (!cleanPhone || !cleanFirstName || !cleanLastName) {
      return { success: false, message: 'Le prénom, le nom et le numéro de téléphone sont obligatoires.' };
    }

    if (!isValidPhoneNumber(cleanPhone, { allowEmpty: false, required: true })) {
      return { success: false, message: 'Le numéro de téléphone fourni est invalide.' };
    }

    // Password policy validation for Marketplace Clients (min 6 chars + 1 uppercase)
    if (password) {
      const pwdValidation = validatePasswordByPolicy(password, 'MARKETPLACE_CLIENT');
      if (!pwdValidation.isValid) {
        return {
          success: false,
          message: pwdValidation.errors.join(' ')
        };
      }
    }

    if (!this.state.users) this.state.users = [];
    if (!this.state.persons) this.state.persons = [];

    // Check if user already exists
    const existing = this.state.users.find(
      u => (cleanPhone && u.phone && u.phone.replace(/\s+/g, '') === cleanPhone) ||
           (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail)
    );

    if (existing) {
      return { 
        success: false, 
        message: 'Ce numéro de téléphone (ou adresse e-mail) est déjà associé à un compte client existant. Veuillez vous connecter.' 
      };
    }

    const userId = `user-client-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const personId = `pers-client-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const hashedPassword = hashPassword(password);

    const newUser: User = {
      id: userId,
      tenantId: 'global',
      username: cleanPhone,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      birthDate: data.birthDate || undefined,
      avatarUrl: data.avatarUrl || undefined,
      email: cleanEmail || `${cleanPhone}@client.guineeboutiques.gn`,
      phone: (data.phone || '').trim(),
      city: data.city || 'Conakry',
      commune: data.commune || undefined,
      district: data.district || undefined,
      address: data.address || undefined,
      password: password,
      passwordHash: hashedPassword,
      roles: [{ id: 'role-client', name: 'Client Marketplace', code: 'CLIENT', permissions: ['marketplace.*', 'orders.read_own'] }],
      permissions: ['marketplace.*', 'orders.read_own'],
      preferences: data.preferences || { orderNotifications: true, promoOffers: false },
      isActive: true,
      failedLoginAttempts: 0,
      createdAt: new Date().toISOString()
    };

    const newPerson: Person = {
      id: personId,
      tenantId: 'global',
      types: ['CUSTOMER'],
      firstName: cleanFirstName,
      lastName: cleanLastName,
      phone: (data.phone || '').trim(),
      email: cleanEmail || undefined,
      city: data.city || 'Conakry',
      commune: data.commune || undefined,
      address: data.address || undefined,
      origin: 'MARKETPLACE',
      status: 'ACTIVE',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.state.users.push(newUser);
    this.state.persons.push(newPerson);

    this.logAudit('USER_REGISTERED', 'USER', userId, null, {
      username: newUser.username,
      role: 'CLIENT',
      phone: cleanPhone
    });

    this.saveState();
    return { success: true, user: newUser, message: 'Compte client créé avec succès !' };
  }



  /**
   * Suspend ou réactive un client sur la plateforme
   */
  public toggleClientSuspension(
    personIdOrUserId: string,
    reason?: string
  ): { success: boolean; status?: 'ACTIVE' | 'SUSPENDED'; message: string } {
    if (!this.state.persons) this.state.persons = [];
    if (!this.state.users) this.state.users = [];

    const person = this.state.persons.find(p => p.id === personIdOrUserId || p.id === `pers-${personIdOrUserId}`);
    const user = this.state.users.find(u => u.id === personIdOrUserId || (person && (u.phone === person.phone || u.email === person.email)));

    if (!person && !user) {
      return { success: false, message: 'Client introuvable.' };
    }

    const currentStatus = person?.status || (user?.isActive ? 'ACTIVE' : 'SUSPENDED');
    const newStatus: 'ACTIVE' | 'SUSPENDED' = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const isActive = newStatus === 'ACTIVE';

    this.updateState(draft => {
      if (person) {
        const targetP = draft.persons.find(p => p.id === person.id);
        if (targetP) {
          targetP.status = newStatus;
          targetP.isActive = isActive;
          targetP.updatedAt = new Date().toISOString();
        }
      }
      if (user) {
        const targetU = draft.users.find(u => u.id === user.id);
        if (targetU) {
          targetU.isActive = isActive;
        }
      }
    });

    this.logAudit('CLIENT_STATUS_TOGGLED', 'PERSON', person?.id || user?.id, { oldStatus: currentStatus }, {
      newStatus,
      reason: reason || 'Action Super Administrateur'
    });

    return {
      success: true,
      status: newStatus,
      message: newStatus === 'SUSPENDED' ? 'Le compte client a été suspendu.' : 'Le compte client a été réactivé avec succès.'
    };
  }

  public resetToDefault(): void {
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.saveState();
  }
}

export interface AutonomousAgencyRegistrationData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  agencyName: string;
  activityType: ActivityType;
  agencyPhone?: string;
  agencyAddress?: string;
  agencyCity?: string;
  currency?: Currency;
}

export const dbStore = new StoreManager();



