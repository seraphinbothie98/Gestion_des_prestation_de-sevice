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
      latencyMs: dbHealth.latencyMs || null,
      version: dbHealth.version || null,
      databaseName: dbHealth.database || null,
      error: dbHealth.error || null,
      message: dbHealth.message
    }
  });
});

export default router;
