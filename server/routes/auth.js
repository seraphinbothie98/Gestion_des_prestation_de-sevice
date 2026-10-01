import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { generateToken, requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Authentifie un utilisateur par email/username et mot de passe
 */
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Identifiant (email ou nom d\'utilisateur) et mot de passe requis.'
      });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();

    // Recherche de l'utilisateur
    const userResult = await query(
      `SELECT u.*, t.name as tenant_name, t.activity_type as tenant_activity, t.is_active as tenant_active
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE LOWER(u.email) = $1 OR LOWER(u.username) = $1
       LIMIT 1`,
      [cleanIdentifier]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects ou compte introuvable.'
      });
    }

    const user = userResult.rows[0];

    // Vérifier si le compte est actif
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Ce compte utilisateur a été désactivé par l\'administrateur.'
      });
    }

    // Vérifier si le compte est verrouillé
    if (user.is_locked && user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000));
      return res.status(423).json({
        success: false,
        isLocked: true,
        remainingMinutes,
        message: `Compte temporairement verrouillé suite à plusieurs tentatives. Réessayez dans ${remainingMinutes} minute(s).`
      });
    }

    // Comparaison du mot de passe avec bcrypt
    let passwordMatch = false;
    if (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')) {
      passwordMatch = await bcrypt.compare(password, user.password_hash);
    } else {
      // Tolérance pour mots de passe bruts en initialisation/démo
      passwordMatch = user.password_hash === password;
      if (passwordMatch) {
        // Migration automatique vers hash bcrypt
        const newHash = await bcrypt.hash(password, 10);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
      }
    }

    if (!passwordMatch) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      let lockUpdate = '';
      const params = [newAttempts, user.id];

      if (newAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min de verrouillage
        lockUpdate = ', is_locked = TRUE, locked_until = $3';
        params.splice(2, 0, lockUntil);
      }

      await query(
        `UPDATE users SET failed_login_attempts = $1 ${lockUpdate} WHERE id = $2`,
        params
      );

      return res.status(401).json({
        success: false,
        message: 'Mot de passe incorrect.'
      });
    }

    // Réinitialisation des tentatives et mise à jour de last_login_at
    await query(
      `UPDATE users 
       SET failed_login_attempts = 0, is_locked = FALSE, locked_until = NULL, last_login_at = NOW() 
       WHERE id = $1`,
      [user.id]
    );

    // Génération du JWT
    const tokenPayload = {
      id: user.id,
      tenantId: user.tenant_id,
      branchId: user.branch_id,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    };

    const token = generateToken(tokenPayload);

    // Ne jamais renvoyer le mot de passe hashé
    delete user.password_hash;

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        branchId: user.branch_id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatar_url,
        isActive: user.is_active
      }
    });
  } catch (error) {
    console.error('[Auth Login Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne lors de la tentative de connexion.'
    });
  }
});

/**
 * GET /api/auth/me
 * Profil de l'utilisateur authentifié
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, tenant_id, branch_id, first_name, last_name, username, email, phone, role, avatar_url, is_active, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    }

    return res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  return res.json({ success: true, message: 'Déconnexion effectuée avec succès.' });
});

export default router;
