/**
 * AI Student Assistant - Authentication Middleware
 * Protects API and MCP routes using JSON Web Tokens (JWT).
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_ai_assistant_jwt_secure_key_98234710928374';

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: No authentication token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized: User account no longer exists'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: Invalid or expired token'
    });
  }
};

// Backwards compatibility for existing admin middleware
const protectAdmin = async (req, res, next) => {
  await protect(req, res, () => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'student')) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Insufficient privileges'
    });
  });
};

module.exports = {
  protect,
  protectAdmin,
  JWT_SECRET
};
