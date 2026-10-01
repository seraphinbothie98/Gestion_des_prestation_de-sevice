import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  Tenant,
  Person,
  Service,
  Order,
  Product,
  FinancialAccount
} from '../../types';

export class SupabaseService {
  private static instance: SupabaseService;

  private constructor() {}

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  public isReady(): boolean {
    return isSupabaseConfigured() && getSupabaseClient() !== null;
  }

  // ==========================================================================
  // TENANTS
  // ==========================================================================
  public async getTenants(): Promise<Tenant[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('tenants').select('*').order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code,
      slug: d.slug,
      activityType: d.activity_type || 'SERVICE_CENTER',
      status: d.status || 'ACTIVE',
      responsibleName: d.responsible_name || '',
      subscriptionStatus: d.subscription_status || 'ACTIVE',
      trialStartedAt: d.trial_started_at || d.created_at,
      trialEndsAt: d.trial_ends_at || d.created_at,
      trialDaysTotal: d.trial_days_total || 45,
      activationRequests: d.activation_requests || [],
      phone: d.phone,
      email: d.email,
      address: d.address,
      currency: d.currency || 'GNF',
      taxRate: Number(d.tax_rate || 0),
      isActive: d.is_active ?? true,
      settings: d.settings || {},
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));
  }

  public async upsertTenant(tenant: Tenant): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client.from('tenants').upsert({
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      slug: tenant.slug,
      activity_type: tenant.activityType,
      status: tenant.status,
      responsible_name: tenant.responsibleName,
      subscription_status: tenant.subscriptionStatus,
      trial_started_at: tenant.trialStartedAt,
      trial_ends_at: tenant.trialEndsAt,
      trial_days_total: tenant.trialDaysTotal,
      activation_requests: tenant.activationRequests,
      phone: tenant.phone,
      email: tenant.email,
      address: tenant.address,
      currency: tenant.currency,
      tax_rate: tenant.taxRate,
      is_active: tenant.isActive,
      settings: tenant.settings,
      updated_at: new Date().toISOString()
    });
    return !error;
  }

  // ==========================================================================
  // PERSONS & CUSTOMERS
  // ==========================================================================
  public async getPersons(tenantId: string): Promise<Person[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    let query = client.from('persons').select('*');
    if (tenantId && tenantId !== 'ALL') {
      query = query.eq('tenant_id', tenantId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      firstName: d.first_name,
      lastName: d.last_name,
      phone: d.phone,
      email: d.email,
      address: d.address,
      types: d.types || ['CUSTOMER'],
      isActive: d.is_active ?? true,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));
  }

  public async upsertPerson(person: Person): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client.from('persons').upsert({
      id: person.id,
      tenant_id: person.tenantId,
      first_name: person.firstName,
      last_name: person.lastName,
      phone: person.phone,
      email: person.email,
      address: person.address,
      types: person.types,
      is_active: person.isActive,
      updated_at: new Date().toISOString()
    });
    return !error;
  }

  // ==========================================================================
  // SERVICES
  // ==========================================================================
  public async getServices(tenantId: string): Promise<Service[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    let query = client.from('services').select('*');
    if (tenantId && tenantId !== 'ALL') {
      query = query.eq('tenant_id', tenantId);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      categoryId: d.category_id,
      code: d.code,
      name: d.name,
      description: d.description,
      unit: d.unit,
      baseCost: Number(d.base_cost || 0),
      basePrice: Number(d.base_price || 0),
      consumables: d.consumables || [],
      consumableMode: d.consumable_mode || 'NONE',
      isClientSupportAllowed: d.is_client_support_allowed ?? true,
      requiresFile: d.requires_file ?? false,
      estimatedDurationMinutes: d.estimated_duration_minutes ?? 5,
      pricingRules: d.pricing_rules || [],
      isActive: d.is_active ?? true,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));
  }

  public async upsertService(service: Service): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client.from('services').upsert({
      id: service.id,
      tenant_id: service.tenantId,
      category_id: service.categoryId,
      code: service.code,
      name: service.name,
      description: service.description,
      unit: service.unit,
      base_cost: service.baseCost,
      base_price: service.basePrice,
      consumables: service.consumables,
      consumable_mode: service.consumableMode,
      is_client_support_allowed: service.isClientSupportAllowed,
      requires_file: service.requiresFile,
      estimated_duration_minutes: service.estimatedDurationMinutes,
      pricing_rules: service.pricingRules,
      is_active: service.isActive,
      updated_at: new Date().toISOString()
    });
    return !error;
  }

  // ==========================================================================
  // PRODUCTS
  // ==========================================================================
  public async getProducts(tenantId: string): Promise<Product[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    let query = client.from('products').select('*');
    if (tenantId && tenantId !== 'ALL') {
      query = query.eq('tenant_id', tenantId);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      code: d.code,
      barcode: d.barcode,
      name: d.name,
      categoryId: d.category_id,
      category: d.category,
      description: d.description,
      baseUnit: d.base_unit || d.unit,
      unit: d.unit,
      costPrice: Number(d.cost_price || 0),
      salePrice: Number(d.sale_price || 0),
      wholesalePrice: Number(d.wholesale_price || 0),
      initialStock: Number(d.initial_stock || 0),
      currentStock: Number(d.current_stock || 0),
      prestationStock: Number(d.prestation_stock || 0),
      minStockAlert: Number(d.min_stock_alert || 0),
      maxStock: Number(d.max_stock || 0),
      packagings: d.packagings || [],
      stockByLocation: d.stock_by_location || {},
      stockByStore: d.stock_by_store || {},
      isConsumable: d.is_consumable ?? true,
      isSellable: d.is_sellable ?? true,
      isActive: d.is_active ?? true,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));
  }

  public async upsertProduct(product: Product): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client.from('products').upsert({
      id: product.id,
      tenant_id: product.tenantId,
      code: product.code,
      barcode: product.barcode,
      name: product.name,
      category_id: product.categoryId,
      category: product.category,
      description: product.description,
      base_unit: product.baseUnit || product.unit,
      unit: product.unit,
      cost_price: product.costPrice,
      sale_price: product.salePrice,
      wholesale_price: product.wholesalePrice,
      initial_stock: product.initialStock,
      current_stock: product.currentStock,
      prestation_stock: product.prestationStock,
      min_stock_alert: product.minStockAlert,
      max_stock: product.maxStock,
      packagings: product.packagings,
      stock_by_location: product.stockByLocation,
      stock_by_store: product.stockByStore,
      is_consumable: product.isConsumable,
      is_sellable: product.isSellable,
      is_active: product.isActive,
      updated_at: new Date().toISOString()
    });
    return !error;
  }

  // ==========================================================================
  // ORDERS
  // ==========================================================================
  public async getOrders(tenantId: string): Promise<Order[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    let query = client.from('orders').select('*');
    if (tenantId && tenantId !== 'ALL') {
      query = query.eq('tenant_id', tenantId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      branchId: d.branch_id,
      orderNumber: d.order_number,
      customerType: d.customer_type,
      personId: d.person_id,
      personName: d.person_name,
      personPhone: d.person_phone,
      personEmail: d.person_email,
      status: d.status,
      paymentStatus: d.payment_status,
      deliveryStatus: d.delivery_status,
      priority: d.priority,
      items: d.items || [],
      files: d.files || [],
      subtotal: Number(d.subtotal || 0),
      discountAmount: Number(d.discount_amount || 0),
      taxAmount: Number(d.tax_amount || 0),
      totalAmount: Number(d.total_amount || 0),
      paidAmount: Number(d.paid_amount || 0),
      dueAmount: Number(d.due_amount || 0),
      dueDate: d.due_date,
      instructions: d.instructions,
      isClientSupportProvided: d.is_client_support_provided,
      consumablesDeducted: d.consumables_deducted,
      stockDeducted: d.stock_deducted,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));
  }

  public async upsertOrder(order: Order): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client.from('orders').upsert({
      id: order.id,
      tenant_id: order.tenantId,
      branch_id: order.branchId,
      order_number: order.orderNumber,
      customer_type: order.customerType,
      person_id: order.personId,
      person_name: order.personName,
      person_phone: order.personPhone,
      person_email: order.personEmail,
      status: order.status,
      payment_status: order.paymentStatus,
      delivery_status: order.deliveryStatus,
      priority: order.priority,
      items: order.items,
      files: order.files,
      subtotal: order.subtotal,
      discount_amount: order.discountAmount,
      tax_amount: order.taxAmount,
      total_amount: order.totalAmount,
      paid_amount: order.paidAmount,
      due_amount: order.dueAmount,
      due_date: order.dueDate,
      instructions: order.instructions,
      is_client_support_provided: order.isClientSupportProvided,
      consumables_deducted: order.consumablesDeducted,
      stock_deducted: order.stockDeducted,
      updated_at: new Date().toISOString()
    });
    return !error;
  }

  // ==========================================================================
  // FINANCIAL ACCOUNTS
  // ==========================================================================
  public async getFinancialAccounts(tenantId: string): Promise<FinancialAccount[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    let query = client.from('financial_accounts').select('*');
    if (tenantId && tenantId !== 'ALL') {
      query = query.eq('tenant_id', tenantId);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      name: d.name,
      code: d.code,
      type: d.type,
      currency: d.currency || 'GNF',
      currentBalance: Number(d.current_balance || 0),
      initialBalance: Number(d.initial_balance || 0),
      isActive: d.is_active ?? true,
      isDefault: d.is_default ?? false,
      accountNumber: d.account_number,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));
  }

  public async upsertFinancialAccount(account: FinancialAccount): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client.from('financial_accounts').upsert({
      id: account.id,
      tenant_id: account.tenantId,
      name: account.name,
      code: account.code,
      type: account.type,
      currency: account.currency,
      current_balance: account.currentBalance,
      initial_balance: account.initialBalance,
      is_active: account.isActive,
      is_default: account.isDefault,
      account_number: account.accountNumber,
      updated_at: new Date().toISOString()
    });
    return !error;
  }
}

export const supabaseService = SupabaseService.getInstance();
