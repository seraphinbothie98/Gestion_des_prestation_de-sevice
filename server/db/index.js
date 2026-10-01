import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Configuration du pool PostgreSQL depuis les variables d'environnement serveur
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'cms_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', err);
});

/**
 * Exécute une requête SQL paramétrée
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[SQL]', { text: text.slice(0, 100), duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('[SQL Error]', { text, error: error.message });
    throw error;
  }
}

/**
 * Teste la connectivité PostgreSQL via SELECT 1
 */
export async function testConnection() {
  try {
    const start = Date.now();
    const result = await pool.query('SELECT 1 AS alive, version() AS pg_version, current_database() AS db_name;');
    const latency = Date.now() - start;
    return {
      connected: true,
      latencyMs: latency,
      database: result.rows[0]?.db_name,
      version: result.rows[0]?.pg_version,
      message: 'Connexion PostgreSQL établie avec succès.'
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      message: 'Échec de connexion à la base de données PostgreSQL cPanel.'
    };
  }
}
