const { AuditLog } = require('../models');

exports.getAuditLogs = async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;
    const logs = await AuditLog.findAll({
      order: [['createdAt', 'DESC']],
      limit,
    });
    res.json(logs);
  } catch (err) {
    const message = String(err?.message || '');
    if (message.toLowerCase().includes('auditlog') && message.toLowerCase().includes("doesn't exist")) {
      return res.status(500).json({ error: 'Table AuditLog manquante. Exécutez la migration SQL puis redémarrez le backend.' });
    }
    res.status(500).json({ error: 'Server Error' });
  }
};
