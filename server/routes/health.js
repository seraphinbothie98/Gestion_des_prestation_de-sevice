import express from 'express';
import { testConnection } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/health
 * Teste la santé de l'API Node.js et la connectivité à PostgreSQL cPanel via SELECT 1
 */
router.get('/', async (req, res) => {
  const dbHealth = await testConnection();

  const responseStatus = dbHealth.connected ? 200 : 503;

  return res.status(responseStatus).json({
    status: dbHealth.connected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    api: {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'production'
    },
    database: {
      provider: 'cPanel PostgreSQL',
      connected: dbHealth.connected,
      latencyMs: dbHealth.connected ? (dbHealth.latencyMs || null) : null,
      databaseName: dbHealth.connected ? (dbHealth.database || null) : null,
      error: dbHealth.connected ? null : (process.env.NODE_ENV === 'development' ? dbHealth.error : 'Vérifiez la configuration de vos variables DB_* dans le fichier .env'),
      message: dbHealth.connected ? 'Connexion PostgreSQL établie avec succès.' : 'En attente de configuration de la base de données PostgreSQL.'
    }
  });
});

export default router;
