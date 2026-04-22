const { AuditLog } = require('../models');

const getRequestIp = (req) => {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req?.ip || null;
};

const writeAuditLog = async ({ req, action, details, user, meta }) => {
  try {
    const metaStr = meta == null ? null : JSON.stringify(meta);
    await AuditLog.create({
      action: String(action || '').trim() || 'Action',
      details: String(details || '').trim() || '',
      userId: user?.id != null ? String(user.id) : null,
      userName: user?.name != null ? String(user.name) : null,
      userRole: user?.role != null ? String(user.role) : null,
      ip: getRequestIp(req),
      meta: metaStr,
    });
  } catch (_) {
  }
};

module.exports = { writeAuditLog };
