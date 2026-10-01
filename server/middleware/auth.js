import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cpanel-secret-jwt-key-change-in-production-min-32-chars';

/**
 * Middleware d'extraction et de validation du JWT
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      req.user = null;
    } else {
      req.user = decoded;
    }
    next();
  });
}

/**
 * Middleware forçant l'authentification obligatoire
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Non authentifié. Jeton d\'accès manquant ou expiré.'
    });
  }
  next();
}

/**
 * Middleware vérifiant les rôles autorisés
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Non authentifié.' });
    }
    if (req.user.role === 'SUPER_ADMIN') {
      return next(); // Super Admin a accès universel
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé: privilèges insuffisants.'
      });
    }
    next();
  };
}

/**
 * Helper pour générer un jeton JWT
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.SESSION_EXPIRY || '7d'
  });
}
