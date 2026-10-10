const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/db');
const { verifyToken, JWT_SECRET } = require('../middleware/authMiddleware');

const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const client = new OAuth2Client(googleClientId);

// Helper to generate session JWT
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      googleId: user.google_id
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * POST /api/auth/google
 * Authenticates Google User profile via Google ID Token or credential payload
 */
router.post('/google', async (req, res) => {
  try {
    const { credential, userInfo } = req.body;
    let email, name, picture, googleId, role = 'ANALYST';

    if (credential && googleClientId) {
      // Verify official Google Token
      try {
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: googleClientId,
        });
        const payload = ticket.getPayload();
        googleId = payload.sub;
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
      } catch (err) {
        console.warn('Google ID token verification failed:', err.message);
      }
    }

    // Fallback if client decoded directly or provided userInfo payload
    if (!email && userInfo) {
      email = userInfo.email;
      name = userInfo.name || email.split('@')[0];
      picture = userInfo.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
      googleId = userInfo.sub || userInfo.id || `google_${Date.now()}`;
    }

    if (!email) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Email is required for Google Sign-In' });
    }

    // Upsert User into Database
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (existing.rows && existing.rows.length > 0) {
      user = existing.rows[0];
      await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    } else {
      const inserted = await db.query(
        `INSERT INTO users (google_id, email, name, picture, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [googleId, email, name, picture, role]
      );
      user = inserted.rows?.[0] || { id: 1, google_id: googleId, email, name, picture, role };
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        googleId: user.google_id
      }
    });

  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'AUTH_FAILED', message: err.message });
  }
});

/**
 * POST /api/auth/demo-login
 * 1-Click Demo Login for quick hackathon evaluation
 */
router.post('/demo-login', async (req, res) => {
  try {
    const { role = 'QUANT_ANALYST', name = 'Senior Quant Trader' } = req.body;
    const demoEmail = `quant.trader.${role.toLowerCase()}@mcx-goldintel.com`;
    const demoPicture = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
    const googleId = `demo_${Date.now()}`;

    const existing = await db.query('SELECT * FROM users WHERE email = $1', [demoEmail]);
    let user;

    if (existing.rows && existing.rows.length > 0) {
      user = existing.rows[0];
      await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    } else {
      const inserted = await db.query(
        `INSERT INTO users (google_id, email, name, picture, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [googleId, demoEmail, name, demoPicture, role]
      );
      user = inserted.rows?.[0] || { id: 99, google_id: googleId, email: demoEmail, name, picture: demoPicture, role };
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        googleId: user.google_id
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'DEMO_AUTH_FAILED', message: err.message });
  }
});

/**
 * GET /api/auth/me
 * Validates active session and returns user profile
 */
router.get('/me', verifyToken, async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
