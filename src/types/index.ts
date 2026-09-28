// ==============================================================================
// CENTRE MANAGEMENT SYSTEM (CMS) - TYPESCRIPT DEFINITIONS
// ==============================================================================

export type Currency = 'GNF' | 'XOF' | 'EUR' | 'USD';

export interface BrandingConfig {
  logoUrl?: string;
  logoPosition: 'left' | 'center' | 'right';
  logoSize: 'sm' | 'md' | 'lg';
  showLogo: boolean;
  slogan?: string;
  website?: string;
  headerAlignment: 'left' | 'center' | 'right';
  showPhone: boolean;
  showEmail: boolean;
  showAddress: boolean;
  showWebsite: boolean;
  footerText?: string;
  footerAlignment: 'left' | 'center' | 'right';
  showFooter: boolean;
}

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'DEMO';

export type ActivationRequestStatus = 'PENDING' | 'CONTACTED' | 'ACTIVATED' | 'REJECTED';

export interface ActivationRequest {
  id: string;
  tenantId: string;
  tenantName: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  message: string;
  status: ActivationRequestStatus;
  requestedAt: string;
  handledAt?: string;
  handledByUserName?: string;
  adminNotes?: string;
}

export interface SupportContactConfig {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  customMessage: string;
}

export type LicensePlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'UNLIMITED';

export interface LicenseHistoryEvent {
  id: string;
  tenantId: string;
  tenantName: string;
  action: 'TRIAL_STARTED' | 'TRIAL_EXTENDED' | 'TRIAL_EXPIRED' | 'LICENSE_ACTIVATED' | 'ACCOUNT_SUSPENDED' | 'ACCOUNT_REACTIVATED' | 'LICENSE_MODIFIED';
  actionLabel: string;
  details?: string;
  performedByUserName: string;
  createdAt: string;
}

export type ActivityType = 
  | 'SERVICE_CENTER' 
  | 'RETAIL_STORE' 
  | 'RESTAURANT' 
  | 'WHOLESALE' 
  | 'OTHER';

export type AgencyStatus = 
  | 'PENDING' 
  | 'ACTIVE' 
  | 'SUSPENDED' 
  | 'ARCHIVED'
  | 'EXPIRED' 
  | 'CLOSED';

export type LicenseStatus = 
  | 'PENDING' 
  | 'ACTIVE' 
  | 'EXPIRING_SOON' 
  | 'EXPIRED' 
  | 'SUSPENDED' 
  | 'CANCELLED';

export interface AgencyLicense {
  id: string;
  agencyId: string;
  planId: LicensePlan;
  status: LicenseStatus;
  startDate: string;
  endDate: string;
  maxUsers?: number;
  features?: string[];
  licenseKey?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}



export interface Tenant {
  id: string;
  name: string;
  code: string;
  slug: string;
  activityType: ActivityType;
  status: AgencyStatus;
  responsibleName?: string;
  logoUrl?: string;
  slogan?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  country?: string;
  city?: string;
  address?: string;
  timezone?: string;
  currency: Currency;
  taxRate: number;
  isActive: boolean;
  enabledModules?: string[];
  sealUrl?: string;
  directorSignatureUrl?: string;
  trainerSignatures?: { id: string; trainerName: string; signatureUrl: string }[];
  headerText?: string;
  footerText?: string;
  maxDiscountWithoutApprovalPct?: number;
  license?: AgencyLicense;
  
  // Subscription & Trial Mode
  subscriptionStatus: SubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  trialDaysTotal: number;
  lastSeenAt?: string;
  licenseKey?: string;
  licenseActivatedAt?: string;
  licenseExpiresAt?: string;
  licensePlan?: LicensePlan;
  activationRequests?: ActivationRequest[];
  licenseHistory?: LicenseHistoryEvent[];
  supportContact?: SupportContactConfig;


  settings: Record<string, any> & {
    branding?: BrandingConfig;
    companyHeader?: string;
    invoiceFooter?: string;
    certificateSignerName?: string;
    certificateSignerTitle?: string;
    digitalSignatures?: DigitalSignature[];
    documentSignatureConfigs?: DocumentSignatureConfig[];
    defaultTrialDays?: number;
    supportContact?: SupportContactConfig;
  };
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  onboardingData?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export type Agency = Tenant;

export type SignatureType = 'DIRECTOR' | 'TRAINER' | 'STAMP' | 'OTHER';

export interface DigitalSignature {
  id: string;
  tenantId: string;
  type: SignatureType;
  targetPersonId?: string;
  signerName: string;
  signerTitle: string;
  imageUrl: string;
  version: number;
  description?: string;
  widthPx?: number;
  heightPx?: number;
  alignment?: 'left' | 'center' | 'right';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type DocumentType = 'INVOICE' | 'RECEIPT' | 'QUOTE' | 'CERTIFICATE' | 'ATTESTATION' | 'ATTENDANCE_SHEET';

export interface DocumentSignatureConfig {
  documentType: DocumentType;
  showDirectorSignature: boolean;
  showTrainerSignature: boolean;
  showOfficialStamp: boolean;
  directorSignatureId?: string;
  trainerSignatureId?: string;
  officialStampId?: string;
}

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  phone?: string;
  email?: string;
  address?: string;
  isMain: boolean;
  isActive: boolean;
}

export type RoleCode = 
  | 'SUPER_ADMIN'
  | 'ADMIN_CENTRE'
  | 'GERANT'
  | 'RECEPTIONNISTE'
  | 'CAISSIER'
  | 'OPERATEUR'
  | 'RESPONSABLE_FORMATION'
  | 'FORMATEUR'
  | 'MAGASINIER'
  | 'CLIENT';

export interface Role {
  id: string;
  tenantId?: string;
  name: string;
  code: RoleCode | string;
  isSystem?: boolean;
  isCustom?: boolean;
  description?: string;
  permissions: string[];
}

export type DepartmentCode = 
  | 'ADMINISTRATION'
  | 'ACCUEIL_CAISSE_STOCK'
  | 'PRODUCTION_MATERIEL'
  | 'FORMATION'
  | 'SERVICES'
  | 'CAISSE'
  | 'LOGISTIQUE';

export interface User {
  id: string;
  tenantId: string;
  branchId?: string;
  isSuperAdmin?: boolean;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone?: string;
  city?: string;
  address?: string;
  password?: string;
  passwordHash?: string;
  department?: DepartmentCode | string;
  avatarUrl?: string;
  isActive: boolean;
  role?: string;
  roles: Role[];
  permissions: string[];
  lastLoginAt?: string;
  resetPasswordCode?: string;
  resetPasswordExpiresAt?: string;

  // Politiques de Sécurité Globale (Anti-Brute-Force & Verrouillage)
  failedLoginAttempts?: number;
  lockoutCount?: number;
  lockedUntil?: string;
  lastFailedLoginAt?: string;
  lastSuccessfulLoginAt?: string;
  lockedReason?: string;

  birthDate?: string;
  commune?: string;
  district?: string;
  preferences?: {
    orderNotifications?: boolean;
    promoOffers?: boolean;
  };
  createdAt: string;
}

export interface UserProfileUpdateData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string | null;
  department?: string;
}

export type PersonType = 'CUSTOMER' | 'LEARNER' | 'TRAINER' | 'STAFF' | 'OTHER';

export interface ClientStoreRelation {
  id: string;
  personId: string;
  userId?: string;
  tenantId: string;
  tenantName?: string;
  registeredByTenantId: string; // 'MARKETPLACE' or specific tenantId
  isLoyalCustomer: boolean;
  notes?: string;
  totalOrdersCount: number;
  totalSpentAmount: number;
  lastPurchaseDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Person {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  city?: string;
  commune?: string;
  address?: string;
  idCardNumber?: string;
  photoUrl?: string;
  types: PersonType[];
  notes?: string;
  isActive: boolean;
  origin?: 'MARKETPLACE' | 'STORE_REGISTERED';
  registeredByTenantId?: string;
  registeredByTenantName?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt?: string;
  
  // Embedded extension profiles
  customerProfile?: {
    customerNumber: string;
    companyName?: string;
    isCompany: boolean;
    discountRate: number;
    creditLimit: number;
  };
  learnerProfile?: {
    learnerNumber: string;
    educationLevel?: string;
    profession?: string;
  };
  trainerProfile?: {
    trainerNumber: string;
    specialty?: string;
    bio?: string;
    hourlyRate: number;
  };
}

export interface ServiceCategory {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  icon?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ServicePricingRule {
  id: string;
  serviceId: string;
  minQuantity: number;
  maxQuantity?: number;
  unitPrice: number;
  customerType: 'ALL' | 'STUDENT' | 'COMPANY' | 'VIP';
}

export type ConsumableMode =
  | 'NONE'               // Mode A: Aucun consommable interne (aucun débit de stock)
  | 'INTERNAL_FIXED'     // Mode B/C: Consommables internes fixes par prestation (ex: Reliure -> 1 spirale + 1 bristol + 1 transparent)
  | 'INTERNAL_VARIABLE'  // Mode D: Consommables variables selon quantité/pages (ex: Photocopie -> 1 feuille A4 par page)
  | 'CLIENT_SUPPLIED'    // Mode E: Support apporté par le client (0 déduction du support client)
  | 'MIXED';             // Mode F: Mode mixte (support client non déduit + consommables agence déduits)

export interface ServiceConsumableConfig {
  id?: string;
  productId: string;
  productName?: string;
  productCode?: string;
  quantityPerUnit: number; // e.g. 1 spirale, or 1 feuille per page
  isVariableWithQuantity?: boolean; // If true: totalQty = quantityPerUnit * orderItem.quantity
  isClientSupplied?: boolean; // If true: support client -> 0 deduction
  unit?: string;
  unitName?: string;
  isOptional?: boolean;
  notes?: string;
}

export interface ServiceOption {
  id: string;
  name: string; // e.g. "Format", "Mode", "Type d'impression", "Papier", "Durée", "Finition"
  values: string[]; // e.g. ["A4", "A3"], ["Noir & blanc", "Couleur"]
  isRequired?: boolean;
}

export interface ServiceConsumableRule {
  productId: string;
  productName?: string;
  productCode?: string;
  quantityPerUnit: number; // e.g. 1 feuille, 10 feuilles, 1 spirale
  unit?: string; // e.g. "feuille", "unité", "mètre"
  storeId?: string;
  isClientSupplied?: boolean;
  isVariableWithQuantity?: boolean;
}

export interface ServiceConfiguration {
  id: string;
  serviceId: string;
  optionValues: Record<string, string>; // e.g. { "Format": "A4", "Mode": "Noir & blanc", ... }
  price: number; // Tarif unitaire en GNF
  billingUnit: string; // Unité de facturation (ex: "page", "exemplaire", "heure", "prestation")
  consumables: ServiceConsumableRule[];
  isActive: boolean;
  code?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceSpecificationOption {
  id?: string;
  name: string; // e.g. "A4", "A3", "160g Bristol", "Noir & Blanc"
  unitPrice?: number; // Specific unit price when this option is chosen (e.g. 500 GNF vs 1000 GNF)
  priceAdjustment?: number; // Price delta (e.g. +500 GNF)
  productId?: string; // Linked consumable product in stock (e.g. "prod-01")
  productName?: string; // Linked consumable product name
  quantityPerUnit?: number; // Consumed quantity per service unit (e.g. 1 feuille)
  consumableUnit?: string; // e.g. "feuille"
  consumables?: Array<{ productId: string; productName?: string; quantityPerUnit: number; unit?: string }>;
}

export interface ServiceSpecificationGroup {
  id?: string;
  name: string; // e.g. "Format", "Mode", "Papier", "Impression"
  options: (string | ServiceSpecificationOption)[];
  defaultValue?: string; // e.g. "A4"
}

export interface Service {
  id: string;
  tenantId: string;
  categoryId: string;
  categoryName?: string;
  code: string;
  name: string;
  description?: string;
  unit: string;
  baseCost: number;
  basePrice: number;
  requiresFile: boolean;
  estimatedDurationMinutes: number;
  isActive: boolean;
  pricingRules: ServicePricingRule[];
  options?: ServiceOption[];
  configurations?: ServiceConfiguration[];
  consumableMode?: ConsumableMode;
  consumables?: ServiceConsumableConfig[];
  isClientSupportAllowed?: boolean; // Client can bring their own item (e.g. t-shirt for pressage)
  consumptions?: { productId: string; quantity: number }[];
  specificationGroups?: ServiceSpecificationGroup[];
  updatedAt?: string;
}

export interface ServicePriceHistory {
  id: string;
  tenantId: string;
  serviceId: string;
  serviceName: string;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  changeDate: string;
  reason?: string;
  createdAt: string;
}

export type OrderStatus = 
  | 'DRAFT'
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'PARTIALLY_DONE'
  | 'COMPLETED'
  | 'READY'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED'
  | 'CANCELLED';

export type OrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface OrderFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedAt: string;
}

export type OrderItemType = 'SERVICE' | 'PRODUCT';

export type ProductionStatus = 
  | 'TODO'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'IN_PRODUCTION'
  | 'PAUSED'
  | 'DONE'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  orderId?: string;
  itemType?: OrderItemType; // 'SERVICE' (prestation) or 'PRODUCT' (fourniture/boutique)
  serviceId?: string;
  serviceName?: string;
  serviceCode?: string;
  productId?: string;
  productName?: string;
  productCode?: string;
  category?: string;
  description?: string;
  quantity: number;
  requestedQuantity?: number; // Quantité demandée initialement par le client
  validatedQuantity?: number; // Quantité effectivement validée par le vendeur
  unit: string;
  publicUnit?: string; // Unité de vente publique (ex: Paquet, Carton, Pièce)
  productImageUrl?: string; // Image miniature du produit commandé
  purchaseUnitName?: string;
  conversionFactor?: number;
  
  // Tarification standard vs appliquée
  standardUnitPrice?: number;
  appliedUnitPrice?: number;
  unitPrice: number;
  isCustomPrice?: boolean;
  
  // Remises & autorisations
  grossTotal?: number;
  discountAmount?: number;
  discountPercent: number;
  discountType?: 'TIER' | 'EXCEPTIONAL' | 'CUSTOMER_PROFILE' | 'NONE';
  discountReasonCategory?: 'VOLUME' | 'LOYALTY' | 'INSTITUTIONAL' | 'PROMOTION' | 'COMMERCIAL_NEGOTIATION' | 'OTHER';
  discountReason?: string;
  discountGrantedBy?: string;
  discountApprovedBy?: string;
  requiresApproval?: boolean;
  isApproved?: boolean;
  tierApplied?: { minQty: number; maxQty?: number; unitPrice: number };
  totalPrice: number;
  
  // Production par ligne
  productionStatus?: ProductionStatus;
  assignedDepartment?: 'DESIGN' | 'PRINT' | 'FINISHING' | 'PHOTOCOPY' | 'PHOTO' | 'STORE' | 'OTHER';
  assignedToUserId?: string;
  assignedToUserName?: string;
  startedAt?: string;
  completedAt?: string;
  deliveredAt?: string;
  deliveredByUserName?: string;
  
  // Fichiers par ligne
  files?: OrderFile[];
  
  // Stock & consommations
  stockDeducted?: boolean;
  stockProductId?: string;
  stockQuantityDeducted?: number;
  isClientSuppliedSupport?: boolean;
  storeId?: string;

  notes?: string;
}

export interface DiscountAudit {
  id: string;
  tenantId: string;
  orderId: string;
  orderNumber: string;
  serviceId?: string;
  serviceName: string;
  quantity: number;
  unit: string;
  standardPrice: number;
  appliedPrice: number;
  grossTotal: number;
  discountAmount: number;
  discountPercent: number;
  discountType: 'TIER' | 'EXCEPTIONAL' | 'CUSTOMER_PROFILE';
  discountReasonCategory?: string;
  discountReason: string;
  grantedByUserId: string;
  grantedByUserName: string;
  authorizedByUserId?: string;
  authorizedByUserName?: string;
  status: 'APPLIED' | 'PENDING_APPROVAL' | 'REJECTED';
  createdAt: string;
}

export interface DiscountRoleLimit {
  roleCode: RoleCode;
  roleName: string;
  maxDiscountPercent: number;
  canGrantExceptional: boolean;
  requiresApprovalAbove: number;
}

export type CustomerType = 'REGISTERED' | 'WALK_IN';

export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';

export type OrderSource = 'INTERNAL' | 'BOUTIQUE_POS' | 'MARKETPLACE' | 'PRESTATION' | 'VENTE_ARTICLE';

export interface Order {
  id: string;
  tenantId: string;
  branchId?: string;
  orderNumber: string;
  orderSource?: OrderSource; // 'INTERNAL' | 'BOUTIQUE_POS' | 'MARKETPLACE' | 'PRESTATION'
  customerType?: CustomerType; // 'REGISTERED' (client enregistré) or 'WALK_IN' (client de passage)
  personId?: string;
  personName: string;
  personPhone?: string;
  personEmail?: string;
  clientCity?: string; // Ville de destination (ex: Conakry, Kindia, Kankan, etc.)
  deliveryAddress?: string; // Adresse / Quartier de livraison
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  deliveryStatus?: 'UNDELIVERED' | 'PARTIALLY_DELIVERED' | 'DELIVERED';
  priority: OrderPriority;
  items: OrderItem[];
  files: OrderFile[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate?: string;
  instructions?: string;
  isClientSupportProvided?: boolean;
  consumablesDeducted?: boolean;
  stockDeducted?: boolean;
  deliveredAt?: string;
  deliveredByUserId?: string;
  deliveredByUserName?: string;
  deliveryNotes?: string;
  isDeliveredUnpaid?: boolean;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: string;
  refundedByUserName?: string;
  qrCodeData?: string;
  createdBy?: string;
  createdByName?: string;
  isReadByMerchant?: boolean; // Pour le compteur de nouvelles commandes marketplace non lues
  trackingEvents?: OrderTrackingEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderTrackingEvent {
  id: string;
  orderId: string;
  status: OrderStatus | 'ORDER_PLACED' | 'PAYMENT_RECEIVED' | 'IN_DELIVERY' | 'DELIVERED';
  title: string;
  description: string;
  timestamp: string;
  actorName?: string;
  actorRole?: string;
  isCompleted: boolean;
}

export interface ProductionJob {
  id: string;
  tenantId: string;
  orderId: string;
  orderItemId?: string;
  orderNumber: string;
  personName: string;
  itemDescription: string;
  serviceName: string;
  department?: string;
  quantity: number;
  unit: string;
  priority: OrderPriority;
  status: ProductionStatus;
  assignedToUser?: string;
  assignedToUserName?: string;
  startedAt?: string;
  completedAt?: string;
  deliveredAt?: string;
  durationMinutes: number;
  notes?: string;
  dueDate?: string;
}

// TRAINING / LMS
export interface TrainingCategory {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  description?: string;
  durationHours: number;
  sortOrder: number;
}

export interface Training {
  id: string;
  tenantId: string;
  categoryId: string;
  categoryName?: string;
  code: string;
  title: string;
  description?: string;
  objectives?: string;
  durationHours: number;
  level: 'DEBUTANT' | 'INTERMEDIAIRE' | 'AVANCE' | 'TOUS_NIVEAUX';
  price: number;
  maxCapacity: number;
  isActive: boolean;
  modules: TrainingModule[];
  createdAt: string;
}

export interface Classroom {
  id: string;
  tenantId: string;
  name: string;
  capacity: number;
  equipment?: string;
  isActive: boolean;
}

export type SessionStatus = 'PLANNED' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TrainingSession {
  id: string;
  tenantId: string;
  trainingId: string;
  trainingTitle: string;
  trainingCode: string;
  sessionCode: string;
  trainerId?: string;
  trainerName?: string;
  classroomId?: string;
  classroomName?: string;
  startDate: string;
  endDate: string;
  scheduleDescription?: string;
  capacity: number;
  enrolledCount: number;
  status: SessionStatus;
  price: number;
}

export type EnrollmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface Enrollment {
  id: string;
  tenantId: string;
  sessionId: string;
  sessionCode: string;
  trainingTitle: string;
  learnerId: string;
  learnerName: string;
  learnerPhone?: string;
  enrollmentNumber: string;
  status: EnrollmentStatus;
  price: number;
  discountAmount: number;
  finalAmount: number;
  paidAmount: number;
  dueAmount: number;
  enrolledAt: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceSheet {
  id: string;
  sessionId: string;
  date: string;
  title?: string;
  records: {
    learnerId: string;
    learnerName: string;
    status: AttendanceStatus;
    justification?: string;
  }[];
}

export interface Assessment {
  id: string;
  sessionId: string;
  moduleId?: string;
  title: string;
  assessmentDate: string;
  maxScore: number;
  coefficient: number;
  results: {
    learnerId: string;
    learnerName: string;
    score: number;
    comments?: string;
  }[];
}

export interface Certificate {
  id: string;
  tenantId: string;
  sessionId: string;
  trainingTitle: string;
  trainingDurationHours: number;
  learnerId: string;
  learnerName: string;
  certificateCode: string; // CERT-2026-000001
  issueDate: string;
  finalScore?: number;
  mention: 'ADMIS' | 'TRES_BIEN' | 'BIEN' | 'ASSEZ_BIEN';
  signatureName: string;
  signatureTitle: string;
  directorSignatureUrl?: string;
  directorSignerName?: string;
  directorSignerTitle?: string;
  trainerSignatureUrl?: string;
  trainerSignerName?: string;
  trainerSignerTitle?: string;
  officialStampUrl?: string;
  signatureVersion?: number;
  qrCodeData: string;
  isValid: boolean;
}

// FINANCES, TRÉSORERIE & COMPTES FINANCIERS
export type PaymentMethod = 'CASH' | 'ORANGE_MONEY' | 'MTN_MOMO' | 'BANK_TRANSFER' | 'CARD' | 'CHECK' | 'OTHER';
export type PaymentTarget = 'ORDER' | 'ENROLLMENT' | 'PURCHASE_ORDER' | 'DEBT' | 'EXPENSE' | 'OTHER';

export type FinancialAccountType = 
  | 'CASH'           // Espèces (Caisse principale, Petite caisse)
  | 'BANK'           // Banque (Virement, Chèque)
  | 'MOBILE_MONEY'   // Mobile Money (Orange Money, MTN MoMo, Wave)
  | 'ELECTRONIC'     // Portefeuille électronique / Carte
  | 'OTHER';         // Autre compte

export type FinancialYearStatus = 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
export type FinancialPeriodStatus = 'OPEN' | 'CLOSED' | 'ARCHIVED';

export interface FinancialPeriod {
  id: string;
  tenantId: string;
  financialYearId: string;
  name: string; // ex: "Septembre 2026"
  code: string; // ex: "PER-2026-09"
  monthNumber: number; // 1 to 12
  year: number; // 2026
  startDate: string; // "2026-09-01"
  endDate: string; // "2026-09-30"
  status: FinancialPeriodStatus;
  isCurrentPeriod?: boolean;
  totalInflows?: number;
  totalOutflows?: number;
  netCashFlow?: number;
  movementsCount?: number;
  openingBalances?: Record<string, number>; // accountId -> balance
  closingBalances?: Record<string, number>; // accountId -> balance
  closedAt?: string;
  closedByUserName?: string;
  archivedAt?: string;
  archivedByUserName?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FinancialYear {
  id: string;
  tenantId: string;
  name: string; // ex: "Exercice Comptable 2026"
  code: string; // ex: "EX-2026"
  year: number; // 2026
  startDate: string; // "2026-01-01"
  endDate: string; // "2026-12-31"
  status: FinancialYearStatus;
  isCurrentYear?: boolean;
  isDefault?: boolean;
  openingBalances?: Record<string, number>; // accountId -> balance
  closingBalances?: Record<string, number>; // accountId -> balance
  closedAt?: string;
  closedByUserName?: string;
  archivedAt?: string;
  archivedByUserName?: string;
  periods?: FinancialPeriod[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AccountResetRecord {
  resetAt: string;
  resetByUserName: string;
  previousBalance: number;
  reason: string;
  financialPeriodId?: string;
  financialYearId?: string;
}

export interface FinancialAccount {
  id: string;
  tenantId: string;
  code: string; // ex: "CP-01", "PC-01", "BNK-01", "OM-01"
  name: string; // ex: "Caisse Principale", "Petite Caisse", "Compte Ecobank", "Orange Money Agence"
  type: FinancialAccountType;
  description?: string;
  accountNumber?: string; // N° de compte bancaire ou N° téléphone Mobile Money
  bankName?: string;
  initialBalance: number;
  currentBalance: number;
  currency: Currency;
  isActive: boolean;
  isDefault?: boolean; // Compte sélectionné par défaut
  isPettyCash?: boolean; // Marqueur pour la Petite Caisse
  isMainCash?: boolean; // Marqueur pour la Caisse Principale obligatoire
  isArchived?: boolean;
  archivedAt?: string;
  associatedPaymentMethods?: PaymentMethod[]; // Modes de paiement associés
  resetHistory?: AccountResetRecord[];
  createdByUserId?: string;
  createdByUserName?: string;
  createdAt: string;
  updatedAt?: string;
}

export type FinancialMovementType = 'INFLOW' | 'OUTFLOW' | 'TRANSFER';

export type FinancialMovementCategory =
  | 'CLIENT_PAYMENT'        // Règlement client
  | 'SUPPLIER_PAYMENT'      // Règlement commande / dette fournisseur
  | 'EXPENSE'               // Dépense d'exploitation
  | 'TRANSFER_OUT'          // Transfert sortant (virement interne)
  | 'TRANSFER_IN'           // Transfert entrant (virement interne)
  | 'CAPITAL_CONTRIBUTION'  // Apport de fonds / Caisse injection
  | 'WITHDRAWAL'            // Retrait de fonds
  | 'REFUND'                // Remboursement
  | 'PETTY_CASH_TOPUP'      // Alimentation petite caisse
  | 'DEBT_SETTLEMENT'       // Apurement dette
  | 'BALANCE_ADJUSTMENT'    // Ajustement de solde manuel avec motif
  | 'ACCOUNT_RESET'         // Réinitialisation individuelle de compte
  | 'OTHER';

export interface FinancialMovement {
  id: string;
  tenantId: string;
  financialYearId?: string;
  financialPeriodId?: string;
  cashSessionId?: string;
  movementNumber: string; // MVT-2026-000001
  financialAccountId: string; // Compte débité ou crédité
  financialAccountName: string;
  financialAccountType: FinancialAccountType;
  movementType: FinancialMovementType;
  category: FinancialMovementCategory;
  categoryLabel?: string;
  amount: number; // Toujours positif dans le modèle, le type indique le sens
  balanceBefore: number;
  balanceAfter: number;
  adjustmentDifference?: number;
  // Transfer links
  fromAccountId?: string;
  fromAccountName?: string;
  toAccountId?: string;
  toAccountName?: string;
  relatedTransferMovementId?: string;
  // Entity references
  reference?: string; // ex: "CF-2026-0001", "FAC-2026-0002"
  relatedEntityId?: string; // orderId, purchaseOrderId, expenseId, etc.
  relatedEntityType?: 'ORDER' | 'PURCHASE_ORDER' | 'SUPPLIER_DEBT' | 'EXPENSE' | 'BOUTIQUE_SALE' | 'ENROLLMENT' | 'TRANSFER' | 'ADJUSTMENT' | 'RESET' | 'OTHER';
  paymentMethod?: PaymentMethod;
  performedByUserId?: string;
  performedByUserName: string;
  notes?: string;
  reason?: string;
  receiptNumber?: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  tenantId: string;
  financialYearId?: string;
  financialPeriodId?: string;
  paymentNumber: string; // REG-2026-000001
  purchaseOrderId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  financialAccountId: string;
  financialAccountName: string;
  financialAccountType: FinancialAccountType;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  reference?: string; // N° chèque, N° transaction mobile money, bordereau
  notes?: string;
  performedByUserId?: string;
  performedByUserName: string;
  createdAt: string;
}

export type SupplierDebtStatus = 'ACTIVE' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface SupplierDebt {
  id: string;
  tenantId: string;
  debtNumber: string; // DET-F-2026-0001
  supplierId: string;
  supplierName: string;
  supplierPhone?: string;
  purchaseOrderId: string;
  poNumber: string;
  initialAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: SupplierDebtStatus;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  lastPaymentDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  financialYearId?: string;
  financialPeriodId?: string;
  cashSessionId?: string;
  financialAccountId?: string; // Compte financier crédité
  personId?: string;
  personName: string;
  targetType: PaymentTarget;
  orderId?: string;
  orderNumber?: string;
  enrollmentId?: string;
  enrollmentNumber?: string;
  paymentNumber: string; // PAY-2026-000001
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  paymentType?: 'ADVANCE' | 'INSTALLMENT' | 'BALANCE_PAYMENT' | 'REFUND';
  paymentMethod: PaymentMethod;
  reference?: string;
  receivedByUserName?: string;
  notes?: string;
  createdAt: string;
}

export interface CashRegister {
  id: string;
  tenantId: string;
  branchId?: string;
  name: string;
  code: string;
  isActive: boolean;
}

export type CashSessionStatus = 'OPEN' | 'CLOSED';

export interface CashMovement {
  id: string;
  cashSessionId: string;
  financialAccountId?: string;
  movementType: 'INFLOW' | 'OUTFLOW' | 'EXPENSE' | 'DEPOSIT' | 'WITHDRAWAL' | 'CASH_INJECTION' | 'REFUND';
  amount: number;
  category: string;
  reason: string;
  paymentId?: string;
  isCommercialRevenue?: boolean;
  performedByUserName?: string;
  createdAt: string;
}

export interface CashSession {
  id: string;
  tenantId: string;
  financialYearId?: string;
  financialPeriodId?: string;
  financialAccountId?: string;
  cashRegisterId: string;
  cashRegisterName: string;
  userId: string;
  userName: string;
  openingBalance: number;
  closingBalanceTheoretical?: number;
  closingBalanceActual?: number;
  differenceAmount?: number;
  status: CashSessionStatus;
  openedAt: string;
  closedAt?: string;
  notes?: string;
  movements: CashMovement[];
}

export interface ExpenseCategory {
  id: string;
  tenantId?: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  isSystem?: boolean;
  isActive: boolean;
}

export interface Expense {
  id: string;
  tenantId: string;
  financialYearId?: string;
  financialPeriodId?: string;
  cashSessionId?: string;
  financialAccountId?: string; // Compte financier débité (Petite caisse, Caisse principale, Banque...)
  financialAccountName?: string;
  expenseNumber: string;
  category: string;
  categoryId?: string;
  description: string;
  amount: number;
  paymentMethod?: PaymentMethod;
  recipientName?: string;
  beneficiaryPhone?: string;
  receiptNumber?: string;
  authorizedByUserName?: string;
  createdByName?: string;
  createdAt: string;
}

// STOCK, MAGASINS & FOURNISSEURS
export type StockLocation = 'MAIN_STORE' | 'BOUTIQUE' | 'PRODUCTION' | 'FORMATION' | 'OTHER';

export type StoreType = 'MAIN' | 'WORKSHOP' | 'POINT_OF_SALE' | 'WAREHOUSE' | 'BOUTIQUE' | 'TRANSIT' | 'DEPOT' | 'PRODUCTION' | 'SECONDARY' | 'OTHER';

export interface Store {
  id: string;
  tenantId: string;
  branchId?: string;
  code: string; // ex: "MAG-01", "MAG-ATELIER", "MAG-BOUTIQUE"
  name: string; // ex: "Magasin Principal", "Magasin Prestations & Atelier"
  type: StoreType;
  description?: string;
  managerName?: string;
  responsibleUserId?: string;
  responsibleUserName?: string;
  location?: string;
  isDefault?: boolean;
  isActive: boolean;
  isArchived?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductCategory {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isActive: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  symbol?: string;
  isBaseUnit?: boolean;
  isActive?: boolean;
}

export interface ProductPackaging {
  id: string;
  level: number; // 2, 3, 4... (level 1 is baseUnit)
  unitName: string; // e.g. "Paquet", "Carton", "Boîte", "Palette"
  containedQuantity: number; // e.g. 500, 5, 10
  subUnitName: string; // e.g. "Feuille", "Paquet"
  factorToBase: number; // calculated recursively to baseUnit (e.g. 500, 2500)
  salePrice?: number; // independent commercial selling price for this packaging
  purchasePrice?: number; // independent commercial purchase price for this packaging
  wholesalePrice?: number; // wholesale price for this packaging
  isAllowedForSale: boolean; // allowed in POS / boutique / orders
  isAllowedForPurchase: boolean; // allowed in supplier POs
  isDefaultSaleUnit?: boolean;
  isDefaultPurchaseUnit?: boolean;
  barcode?: string;
}

export interface ProductPackagingHistory {
  id: string;
  changeDate: string;
  changedByUserName: string;
  oldPackagings: ProductPackaging[];
  newPackagings: ProductPackaging[];
  reason?: string;
}

export interface Product {
  id: string;
  tenantId: string;
  code: string;
  barcode?: string;
  name: string;
  categoryId?: string;
  category: string;
  description?: string;
  imageUrl?: string;
  
  // Base unit & multi-level packaging hierarchy
  baseUnit: string; // Base reference unit (ex: "Feuille", "Unité", "Pièce", "Cartouche", "Litre")
  unit: string; // Alias to baseUnit for backwards compatibility
  packagings?: ProductPackaging[]; // Dynamic packaging hierarchy (Niveau 2, 3, 4...)
  defaultSaleUnit?: string; // Default unit pre-selected in sale forms
  defaultPurchaseUnit?: string; // Default unit pre-selected in supplier orders
  
  // Legacy multi-unit fields (maintained for backwards compatibility)
  purchaseUnit?: string; // Purchase unit (ex: "Carton")
  stockUnit?: string; // Reference stock unit (alias to baseUnit)
  conversionFactor?: number; // factor from purchaseUnit to baseUnit
  
  // Pricing
  costPrice: number; // Cost per base unit (ex: 24 GNF/feuille or 60 000 GNF/paquet)
  salePrice?: number; // Sale price per base unit (ex: 500 GNF/feuille)
  purchasePricePerPurchaseUnit?: number; // Cost per purchase unit (ex: 300 000 GNF/carton)
  salePricePerPurchaseUnit?: number; // Sale price per carton/purchase unit (ex: 330 000 GNF/carton)
  wholesalePrice?: number; // Wholesale price per base unit
  
  // Stock Levels (EXPRESSED STRICTLY IN BASE UNIT - SINGLE CENTRAL STOCK)
  initialStock: number; // in baseUnit
  currentStock: number; // in baseUnit (Stock Central Unique de l'Agence - Source Unique de Vérité)
  prestationStock?: number; // Deprecated alias / synchronized value with currentStock
  minStockAlert: number; // in baseUnit (Seuil alerte Stock Central)
  prestationMinStockAlert?: number; // Deprecated alias to minStockAlert
  maxStock?: number; // in baseUnit
  stockByLocation?: Record<string, number>; // Synced to { CENTRAL: currentStock }
  stockByStore?: Record<string, number>; // Synced to { CENTRAL: currentStock }
  
  // Product type classification
  isConsumable?: boolean; // Can be used as raw material / consumable in prestations
  isSellable?: boolean; // Can be sold directly in boutique / orders

  // Conversion configuration history
  conversionHistory?: ProductPackagingHistory[];
  
  supplierId?: string;
  supplierName?: string;
  location?: string;
  allowNegativeStock?: boolean;
  isDivisible?: boolean; // If true, decimals allowed (e.g. 0.5 litre), otherwise integers only
  isActive: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StockMovementType =
  | 'VENTE_BOUTIQUE'
  | 'VENTE_MARKETPLACE'
  | 'CONSOMMATION_PRESTATION'
  | 'ENTREE_ACHAT'
  | 'AJUSTEMENT'
  | 'RETOUR'
  | 'PURCHASE_ENTRY'
  | 'INTERNAL_CONSUMPTION'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'LOSS'
  | 'DETERIORATION'
  | 'THEFT'
  | 'DAMAGE'
  | 'EXPIRATION'
  | 'INVENTORY_ADJUSTMENT'
  | 'SUPPLIER_RETURN'
  | 'CUSTOMER_RETURN'
  | 'IN'
  | 'OUT'
  | 'ADJUSTMENT'
  | 'CONSUMPTION'
  | 'RETURN';

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  movementType: StockMovementType;
  quantity: number; // Quantity in base stock unit (positive or negative)
  oldStock?: number; // in base unit
  newStock?: number; // in base unit
  unitUsed?: string; // Unit used in the transaction (e.g. "Carton", "Paquet", "Feuille")
  conversionFactorApplied?: number; // Conversion factor used at the moment of the transaction
  quantityInStockUnit?: number; // Quantity in base unit (same as quantity)
  unitCost?: number; // Cost in base unit
  totalCost?: number;
  sourceLocation?: string;
  destinationLocation?: string;
  storeId?: string;
  storeName?: string;
  targetStoreId?: string;
  targetStoreName?: string;
  orderNumber?: string;
  relatedOrderId?: string;
  relatedOrderItemId?: string;
  relatedServiceId?: string;
  relatedSaleId?: string;
  relatedPoId?: string;
  serviceOrDepartment?: string;
  reason: string;
  performedByUserName?: string;
  createdAt: string;
}


export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  company?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  isActive?: boolean;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  productCode?: string;
  category?: string;
  orderedQuantityPurchaseUnit: number; // e.g. 10 cartons (commercial quantity)
  purchaseUnitName: string; // e.g. "Carton" (commercial unit chosen)
  conversionFactor: number; // e.g. 2500 feuilles / carton
  quantityInStockUnit: number; // 10 * 2500 = 25000 feuilles (in base unit)
  stockUnitName?: string; // e.g. "feuille"
  baseUnit?: string; // alias to stockUnitName
  receivedQuantityPurchaseUnit?: number; // e.g. 6 cartons received so far
  receivedQuantityInStockUnit?: number; // e.g. 15000 feuilles received so far
  unitPricePurchaseUnit: number; // e.g. 1 250 000 GNF / carton
  unitPriceStockUnit: number; // e.g. 500 GNF / feuille
  totalPrice: number; // e.g. 12 500 000 GNF
  packagingId?: string;
}

export interface RequestingDepartment {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  managerName?: string;
  isActive: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type PurchaseOrderStatus = 'DRAFT' | 'VALIDATED' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
export type PurchaseOrderPaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CREDIT';

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierName: string;
  departmentId?: string;
  departmentName?: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  paymentStatus: PurchaseOrderPaymentStatus;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  orderDate: string;
  expectedDelivery?: string;
  receivedAt?: string;
  notes?: string;
  attachments?: string[];
  createdByUserId?: string;
  createdByUserName?: string;
  items: PurchaseOrderItem[];
  payments?: SupplierPayment[];
}

// BILLING & INVOICES
export interface Invoice {
  id: string;
  tenantId: string;
  personId?: string;
  personName: string;
  personPhone?: string;
  personAddress?: string;
  orderId?: string;
  enrollmentId?: string;
  invoiceType: 'QUOTE' | 'INVOICE' | 'RECEIPT';
  documentNumber: string; // FAC-2026-000001
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIAL' | 'CANCELLED';
  notes?: string;
  directorSignatureUrl?: string;
  directorSignerName?: string;
  directorSignerTitle?: string;
  officialStampUrl?: string;
  stampName?: string;
  signatureVersion?: number;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
}

// NOTIFICATIONS & AUDIT
export interface AppNotification {
  id: string;
  tenantId: string;
  userId?: string;
  serviceId?: string;
  orderId?: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId?: string;
  userName: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  details?: any;
  ipAddress?: string;
  createdAt: string;
}

// EQUIPMENT & MATERIAL MANAGEMENT
export type EquipmentCategory = 'INFORMATIQUE' | 'IMPRESSION_PRODUCTION' | 'AUTRE';
export type EquipmentStatus = 'EN_SERVICE' | 'EN_MAINTENANCE' | 'EN_PANNE' | 'HORS_SERVICE' | 'REFORME' | 'EN_STOCK';
export type EquipmentCondition = 'EXCELLENT' | 'BON' | 'MOYEN' | 'DEGRADE';

export interface Equipment {
  id: string;
  tenantId: string;
  inventoryNumber: string; // MAT-2026-0001
  name: string;
  category: EquipmentCategory | string;
  type: string; // "Ordinateur Portable", "Imprimante Laser", "Photocopieuse", "Massicot", etc.
  brand: string;
  model?: string;
  serialNumber?: string;
  description?: string;
  acquisitionDate?: string;
  supplier?: string;
  costPrice?: number;
  location?: string;
  department?: string;
  responsiblePersonId?: string;
  responsiblePersonName?: string;
  condition: EquipmentCondition;
  status: EquipmentStatus;
  warrantyEndDate?: string;
  photoUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EquipmentMaintenance {
  id: string;
  tenantId: string;
  equipmentId: string;
  equipmentName: string;
  reportedDate: string;
  problemDescription: string;
  technicianName?: string;
  actionTaken?: string;
  replacedParts?: string;
  cost?: number;
  resolutionDate?: string;
  status: 'EN_COURS' | 'REPARE' | 'IRREPARABLE';
  notes?: string;
  createdAt: string;
}

// ==============================================================================
// MAINTENANCE & DATA RESET TYPES
// ==============================================================================

export type ResetLevel = 'TEST_DATA' | 'COMMERCIAL' | 'FINANCIAL' | 'FULL_OPERATIONAL';

export interface ResetSummaryData {
  testData: {
    invoices: number;
    orders: number;
    payments: number;
    financialMovements: number;
    expenses: number;
    enrollments: number;
    certificates: number;
  };
  commercial: {
    orders: number;
    invoices: number;
    payments: number;
    customers: number;
  };
  financial: {
    movements: number;
    payments: number;
    expenses: number;
    cashSessions: number;
    accounts: number;
  };
  operational: {
    orders: number;
    invoices: number;
    payments: number;
    customers: number;
    trainingSessions: number;
    enrollments: number;
    attendanceSheets: number;
    assessments: number;
    certificates: number;
    stockMovements: number;
    expenses: number;
    financialMovements: number;
    cashSessions: number;
  };
  preservedConfig: {
    usersCount: number;
    rolesCount: number;
    servicesCount: number;
    productsCount: number;
    suppliersCount: number;
    accountsCount: number;
    branchesCount: number;
  };
}

export interface OperationalResetOptions {
  resetServices: boolean;
  resetTraining: boolean;
  resetClients: boolean;
  stockOption: 'PRESERVE' | 'CLEAR_MOVEMENTS_ONLY' | 'FULL_STOCK_RESET';
  resetFinancialTreasury: boolean;
  supplierDebtsOption: 'PRESERVE' | 'CLEAR_DEBTS_AND_PURCHASES';
}

export interface ResetExecutionResult {
  success: boolean;
  message: string;
  level: ResetLevel;
  deletedCounts: {
    orders?: number;
    invoices?: number;
    payments?: number;
    financialMovements?: number;
    expenses?: number;
    persons?: number;
    enrollments?: number;
    certificates?: number;
    attendanceSheets?: number;
    assessments?: number;
    stockMovements?: number;
    cashSessions?: number;
    purchaseOrders?: number;
    supplierDebts?: number;
    supplierPayments?: number;
    totalRecords: number;
  };
  integrityVerification: {
    usersBefore: number;
    usersAfter: number;
    rolesPreserved: boolean;
    brandingPreserved: boolean;
    servicesPreserved: boolean;
  };
}



