const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'goldintel_quant_secret_key_2026';

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED_ACCESS',
      message: 'Access restricted. Please sign in to your profile to upload or update data.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Your authentication session has expired. Please sign in again.'
    });
  }
}

function optionalToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (e) {
      // Ignore invalid token in optional context
    }
  }
  next();
}

module.exports = {
  verifyToken,
  optionalToken,
  JWT_SECRET
};
