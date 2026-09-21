const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { touchDevice } = require('../utils/deviceLimit');

const extractBearerToken = (authorization) => {
  const raw = String(authorization || '').trim();
  if (!raw) return null;
  const [scheme, ...rest] = raw.split(' ');
  if (String(scheme || '').toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  if (!token) return null;
  if (token === 'null' || token === 'undefined') return null;
  return token;
};

const protect = async (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

    req.user = await User.findByPk(decoded.id);

    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized, user not found' });
    }

    // Admin kill-switch: a deactivated (e.g. suspicious) account is cut off on
    // its very next request, even with a still-valid token.
    if (req.user.isActive === false) {
      return res.status(403).json({
        error: "Ce compte a été désactivé. Veuillez contacter l'administration.",
        code: 'ACCOUNT_DISABLED',
      });
    }

    // Keep the device's "last seen" fresh so only unused devices expire.
    touchDevice(req.user.id, decoded.did);

    return next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: 'Not authorized, token failed' });
  }
};

const optionalProtect = async (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findByPk(decoded.id);
    if (user && user.isActive !== false) req.user = user;
  } catch (_) {
    // Ignore invalid tokens for public endpoints
  }
  next();
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(401).json({ error: 'Not authorized as an admin' });
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authorized, no user' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Household members (accounts created by a resident) can use the app but
// cannot manage the household or request new properties: only the primary
// resident can.
const requirePrimaryResident = (req, res, next) => {
  if (req.user?.householdOwnerId) {
    return res.status(403).json({ error: 'Action réservée au résident principal.' });
  }
  next();
};

module.exports = { protect, optionalProtect, admin, authorizeRoles, requirePrimaryResident };
