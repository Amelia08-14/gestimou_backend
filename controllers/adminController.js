const { sequelize } = require('../config/db');
const {
  User,
  Residence,
  Owner,
  Property,
  FinancialTransaction,
  MaintenanceTicket,
  Subcontractor,
  Document,
  Notification,
  RegistrationRequest,
  UserDevice,
  Reserve
} = require('../models');
const { writeAuditLog } = require('../utils/auditLog');

const parseDataUrl = (dataUrl) => {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
};

const getUpdatableFields = (model, rows) => {
  const pk = Array.isArray(model.primaryKeyAttributes) ? model.primaryKeyAttributes : [];
  const sample = rows[0] || {};
  return Object.keys(sample).filter((field) => !pk.includes(field));
};

const backupModels = [
  { key: 'Residence', model: Residence },
  { key: 'Owner', model: Owner },
  { key: 'Property', model: Property },
  { key: 'FinancialTransaction', model: FinancialTransaction },
  { key: 'MaintenanceTicket', model: MaintenanceTicket },
  { key: 'Subcontractor', model: Subcontractor },
  { key: 'Document', model: Document },
  { key: 'Reserve', model: Reserve },
  { key: 'Notification', model: Notification },
  { key: 'RegistrationRequest', model: RegistrationRequest },
  { key: 'UserDevice', model: UserDevice },
  { key: 'User', model: User }
];

// @desc    Download a JSON backup (export)
// @route   GET /api/admin/backup
exports.downloadBackup = async (req, res) => {
  try {
    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        app: 'gestimou'
      },
      tables: {}
    };

    for (const entry of backupModels) {
      const rows = await entry.model.findAll({ raw: true });
      payload.tables[entry.key] = rows;
    }

    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload));

    await writeAuditLog({
      req,
      action: 'Sauvegarde',
      details: `Sauvegarde exportée: ${filename}`,
      user: req.user,
      meta: { filename }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Restore from a JSON backup
// @route   POST /api/admin/restore
exports.restoreBackup = async (req, res) => {
  try {
    const { dataUrl } = req.body || {};
    const parsed = parseDataUrl(dataUrl);
    if (!parsed || parsed.mimeType !== 'application/json') {
      return res.status(400).json({ error: 'Invalid backup file' });
    }

    const buffer = Buffer.from(parsed.base64Data, 'base64');
    if (buffer.length > 100 * 1024 * 1024) {
      return res.status(400).json({ error: 'Backup too large (max 100MB)' });
    }

    const json = JSON.parse(buffer.toString('utf8'));
    const tables = json?.tables;
    if (!tables || typeof tables !== 'object') {
      return res.status(400).json({ error: 'Invalid backup structure' });
    }

    await sequelize.transaction(async (transaction) => {
      for (const entry of backupModels) {
        const rows = tables[entry.key];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const updateOnDuplicate = getUpdatableFields(entry.model, rows);
        if (updateOnDuplicate.length === 0) continue;

        await entry.model.bulkCreate(rows, {
          updateOnDuplicate,
          transaction
        });
      }
    });

    await writeAuditLog({
      req,
      action: 'Restauration',
      details: 'Sauvegarde restaurée',
      user: req.user
    });

    res.json({ message: 'Backup restored' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};
