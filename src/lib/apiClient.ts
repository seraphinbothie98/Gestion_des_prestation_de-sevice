/**
 * Client API universel pour architecture cPanel (PostgreSQL + Node.js Express)
 * Utilise des requêtes fetch relatives vers /api/*
 * Ne communique JAMAIS directement avec la base de données PostgreSQL.
 */

import {
  Tenant,
  Person,
  Service,
  Product,
  Order,
  FinancialAccount,
  User
} from '../types';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  database: {
    connected: boolean;
    latencyMs?: number;
    provider: string;
    version?: string;
    message: string;
  };
}

class ApiClient {
  private static instance: ApiClient;
  private token: string | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('cms_auth_token');
    }
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('cms_auth_token', token);
      } else {
        localStorage.removeItem('cms_auth_token');
      }
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('cms_auth_token');
    }
    return this.token;
  }

  /**
   * Méthode générique fetch sécurisée
   */
  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    
    // Ajout automatique du Content-Type si payload JSON
    if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // Ajout automatique du jeton Bearer si présent
    const token = this.getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // URL relative (/api/...)
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        let errorMsg = `Erreur HTTP ${response.status} (${response.statusText})`;
        try {
          const errData = await response.json();
          if (errData && errData.message) errorMsg = errData.message;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      return await response.json();
    } catch (error: any) {
      console.warn(`[ApiClient Error on ${url}]:`, error.message);
      throw error;
    }
  }

  // --- SANTÉ SYSTÈME (HEALTH) ---
  public async checkHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/api/health');
  }

  // --- AUTHENTIFICATION ---
  public async login(identifier: string, password?: string): Promise<{ success: boolean; token?: string; user?: User; message?: string }> {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  public async getMe(): Promise<{ success: boolean; user?: User }> {
    return this.request('/api/auth/me');
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // --- TENANTS & AGENCES ---
  public async getTenants(): Promise<Tenant[]> {
    const res = await this.request('/api/tenants');
    return res.data || [];
  }

  public async saveTenant(tenant: Tenant): Promise<boolean> {
    const res = await this.request('/api/tenants', {
      method: 'POST',
      body: JSON.stringify(tenant)
    });
    return Boolean(res.success);
  }

  // --- PERSONNES & CLIENTS ---
  public async getPersons(tenantId?: string): Promise<Person[]> {
    const queryStr = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await this.request(`/api/persons${queryStr}`);
    return res.data || [];
  }

  public async savePerson(person: Person): Promise<boolean> {
    const res = await this.request('/api/persons', {
      method: 'POST',
      body: JSON.stringify(person)
    });
    return Boolean(res.success);
  }

  // --- SERVICES & PRESTATIONS ---
  public async getServices(tenantId?: string): Promise<Service[]> {
    const queryStr = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await this.request(`/api/services${queryStr}`);
    return res.data || [];
  }

  public async saveService(service: Service): Promise<boolean> {
    const res = await this.request('/api/services', {
      method: 'POST',
      body: JSON.stringify(service)
    });
    return Boolean(res.success);
  }

  // --- PRODUITS & STOCK ---
  public async getProducts(tenantId?: string): Promise<Product[]> {
    const queryStr = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await this.request(`/api/products${queryStr}`);
    return res.data || [];
  }

  public async saveProduct(product: Product): Promise<boolean> {
    const res = await this.request('/api/products', {
      method: 'POST',
      body: JSON.stringify(product)
    });
    return Boolean(res.success);
  }

  // --- COMMANDES ---
  public async getOrders(tenantId?: string): Promise<Order[]> {
    const queryStr = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await this.request(`/api/orders${queryStr}`);
    return res.data || [];
  }

  public async saveOrder(order: Order): Promise<boolean> {
    const res = await this.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order)
    });
    return Boolean(res.success);
  }

  // --- COMPTES FINANCIERS ---
  public async getFinancialAccounts(tenantId?: string): Promise<FinancialAccount[]> {
    const queryStr = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await this.request(`/api/financial-accounts${queryStr}`);
    return res.data || [];
  }

  public async saveFinancialAccount(account: FinancialAccount): Promise<boolean> {
    const res = await this.request('/api/financial-accounts', {
      method: 'POST',
      body: JSON.stringify(account)
    });
    return Boolean(res.success);
  }

  // --- SYNCHRONISATION GLOBALE ---
  public async syncState(tenantId?: string): Promise<{
    tenants: Tenant[];
    persons: Person[];
    services: Service[];
    products: Product[];
    orders: Order[];
    financialAccounts: FinancialAccount[];
  }> {
    const queryStr = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await this.request(`/api/sync${queryStr}`);
    return res.data || {
      tenants: [],
      persons: [],
      services: [],
      products: [],
      orders: [],
      financialAccounts: []
    };
  }

  // --- TÉLÉVERSEMENT DE FICHIERS SUR CPANEL ---
  public async uploadFile(file: File): Promise<{ success: boolean; file?: { url: string; filename: string } }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/files/upload', {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Échec d'envoi du fichier (${response.statusText})`);
    }

    return await response.json();
  }
}

export const apiClient = ApiClient.getInstance();
