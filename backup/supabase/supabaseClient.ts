import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper to resolve env vars across Vite client runtime and Node test scripts
const getEnvVar = (key: string): string => {
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv) {
      if (metaEnv[key]) return String(metaEnv[key]);
      if (metaEnv[`VITE_${key}`]) return String(metaEnv[`VITE_${key}`]);
    }
  } catch (e) {
    // Ignore in non-meta environments
  }

  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env[key]) return String(process.env[key]);
      if (process.env[`VITE_${key}`]) return String(process.env[`VITE_${key}`]);
    }
  } catch (e) {
    // Ignore in non-process environments
  }

  return '';
};

export const SUPABASE_URL = getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL') || '';
export const SUPABASE_ANON_KEY = getEnvVar('SUPABASE_ANON_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY') || '';

export const isSupabaseConfigured = (): boolean => {
  const url = (SUPABASE_URL || '').trim();
  const key = (SUPABASE_ANON_KEY || '').trim();
  return Boolean(
    url &&
    key &&
    !url.includes('your-project') &&
    !key.includes('...') &&
    (url.startsWith('https://') || url.startsWith('http://'))
  );
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      db: {
        schema: 'public'
      }
    });
  }
  return supabaseInstance;
};

export const checkSupabaseConnection = async (): Promise<{
  connected: boolean;
  message: string;
  url?: string;
  error?: string;
}> => {
  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      message: 'Supabase n\'est pas encore configuré (variables SUPABASE_URL ou SUPABASE_ANON_KEY manquantes). Utilisation du stockage local.',
      url: SUPABASE_URL || 'Non défini'
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      message: 'Impossible d\'initialiser le client Supabase.',
      url: SUPABASE_URL
    };
  }

  try {
    const { error } = await client.from('tenants').select('id').limit(1);
    if (error) {
      return {
        connected: false,
        message: `Erreur de connexion Supabase: ${error.message}`,
        url: SUPABASE_URL,
        error: error.message
      };
    }
    return {
      connected: true,
      message: 'Connexion Supabase PostgreSQL établie avec succès.',
      url: SUPABASE_URL
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `Erreur inattendue lors du test de connexion: ${err.message}`,
      url: SUPABASE_URL,
      error: err.message
    };
  }
};
