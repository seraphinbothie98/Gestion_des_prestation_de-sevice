import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import tenantsRouter from './routes/tenants.js';
import personsRouter from './routes/persons.js';
import servicesRouter from './routes/services.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import financialAccountsRouter from './routes/financialAccounts.js';
import filesRouter from './routes/files.js';
import syncRouter from './routes/sync.js';
import { authenticateToken } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globaux
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware d'authentification contextuel
app.use(authenticateToken);

// Routes API
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/persons', personsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/financial-accounts', financialAccountsRouter);
app.use('/api/files', filesRouter);
app.use('/api/sync', syncRouter);

// Service des fichiers statiques compilés (dist/) pour hébergement tout-en-un sur cPanel
const DIST_PATH = path.resolve(__dirname, '../dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
}

// Gestion des routes 404 API et redirection SPA pour React
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `Route API introuvable: ${req.method} ${req.originalUrl}`
    });
  }
  const indexPath = path.join(DIST_PATH, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).send('Application CMS non trouvée. Veuillez exécuter "npm run build".');
});

// Démarrage du serveur si exécuté directement (support standard ou standalone Node.js)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 CMS Backend API démarré sur le port ${PORT}`);
    console.log(`📡 URL Health: http://localhost:${PORT}/api/health`);
    console.log(`💾 Base de données: PostgreSQL cPanel`);
    console.log(`====================================================`);
  });
}

export default app;
