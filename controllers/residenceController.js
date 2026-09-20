const { Residence, Property, Owner, User, FinancialTransaction, HouseholdMember } = require('../models');
const { Op } = require('sequelize');
const { getEffectiveResidentEmail } = require('../utils/residentScope');
const fs = require('fs');
const path = require('path');

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const parseDataUrl = (dataUrl) => {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const base64Data = match[2];
  return { mimeType, base64Data };
};

const extFromMimeType = (mimeType) => {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return null;
};

// @desc    Get all residences
// @route   GET /api/residences
exports.getResidences = async (req, res) => {
  try {
    const where = {};
    
    // Role-based filtering
    if (req.user) {
        if (req.user.role === 'RECOUVREMENT') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (req.user.role === 'RESIDENT') {
            // scope=property_request: show all residences so the resident can request a property in any residence
            if (String(req.query.scope || '') !== 'property_request') {
                const owner = await Owner.findOne({ where: { email: await getEffectiveResidentEmail(req.user) } });
                if (!owner || !owner.residenceId) return res.json([]);
                where.id = owner.residenceId;
            }
        }
        if (req.user.role === 'RESPONSABLE_ZONE') {
            const zone = String(req.user.zone || '').trim();
            if (!zone) {
              where.zone = 'Unassigned';
            } else if (zone.toUpperCase() !== 'ALL') {
              where.zone = zone;
            }
        }
    } else {
        // Public request (e.g. from registration form)
        // Allow fetching list but maybe only IDs and Names?
        // For now allow all for the dropdown.
    }

    const residences = await Residence.findAll({
      where,
      include: req.user && req.user.role !== 'RESIDENT' ? [{ model: Property }] : [] // Only include properties for authenticated staff
    });
    res.json(residences);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get single residence
// @route   GET /api/residences/:id
exports.getResidence = async (req, res) => {
  try {
    if (req.user?.role === 'RECOUVREMENT') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user?.role === 'RESIDENT') {
      const owner = await Owner.findOne({ where: { email: await getEffectiveResidentEmail(req.user) } });
      if (!owner || !owner.residenceId || String(owner.residenceId) !== String(req.params.id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // Residents get the residence card only, never the other owners' properties.
    const residence = await Residence.findByPk(req.params.id, {
      include: req.user?.role === 'RESIDENT' ? [] : [{ model: Property }]
    });
    if (!residence) return res.status(404).json({ error: 'Residence not found' });
    res.json(residence);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create residence
// @route   POST /api/residences
exports.createResidence = async (req, res) => {
  try {
    const residence = await Residence.create(req.body);
    res.status(201).json(residence);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Update residence
// @route   PUT /api/residences/:id
exports.updateResidence = async (req, res) => {
  try {
    const residence = await Residence.findByPk(req.params.id);
    if (!residence) return res.status(404).json({ error: 'Residence not found' });
    await residence.update(req.body);
    res.json(residence);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Delete residence
// @route   DELETE /api/residences/:id
exports.deleteResidence = async (req, res) => {
  try {
    const residence = await Residence.findByPk(req.params.id);
    if (!residence) return res.status(404).json({ error: 'Residence not found' });
    await residence.destroy();
    res.json({ message: 'Residence removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Upload residence logo or cover image
// @route   POST /api/residences/:id/upload
exports.uploadResidenceMedia = async (req, res) => {
  try {
    const residence = await Residence.findByPk(req.params.id);
    if (!residence) return res.status(404).json({ error: 'Residence not found' });

    const { type, dataUrl } = req.body || {};
    if (type !== 'logo' && type !== 'image') {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    if (!allowedMimeTypes.has(parsed.mimeType)) {
      return res.status(400).json({ error: 'Unsupported image type' });
    }

    const ext = extFromMimeType(parsed.mimeType);
    if (!ext) {
      return res.status(400).json({ error: 'Unsupported image type' });
    }

    const buffer = Buffer.from(parsed.base64Data, 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 5MB)' });
    }

    const uploadsDir = path.join(__dirname, '..', 'uploads', 'residences');
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const filename = `${residence.id}-${type}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const publicPath = `/uploads/residences/${filename}`;
    await residence.update({ [type]: publicPath });

    res.json({ url: publicPath });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Per-residence property/owner directory ("Trombinoscope"), grouped by block
// @route   GET /api/residences/:id/trombinoscope
exports.getResidenceTrombinoscope = async (req, res) => {
  try {
    const residenceId = req.params.id;
    const properties = await Property.findAll({
      where: { residenceId },
      include: [{ model: Owner, as: 'owner', required: false }],
      order: [['block', 'ASC'], ['floor', 'ASC'], ['lotNumber', 'ASC']],
    });

    const ownerEmails = properties
      .map((p) => p.owner?.email)
      .filter(Boolean)
      .map((e) => String(e).toLowerCase());

    const [users, transactions] = await Promise.all([
      ownerEmails.length
        ? User.findAll({ where: { email: { [Op.in]: ownerEmails } }, attributes: ['id', 'email', 'mustChangePassword'] })
        : [],
      FinancialTransaction.findAll({
        where: { propertyId: { [Op.in]: properties.map((p) => p.id) } },
        attributes: ['propertyId', 'status'],
      }),
    ]);

    const userByEmail = new Map(users.map((u) => [String(u.email).toLowerCase(), u]));

    const householdCounts = new Map();
    if (users.length) {
      const counts = await HouseholdMember.findAll({
        where: { userId: { [Op.in]: users.map((u) => u.id) } },
        attributes: ['userId'],
      });
      const byUserId = new Map();
      for (const c of counts) byUserId.set(c.userId, (byUserId.get(c.userId) || 0) + 1);
      for (const u of users) householdCounts.set(String(u.email).toLowerCase(), byUserId.get(u.id) || 0);
    }

    const txByProperty = new Map();
    for (const t of transactions) {
      const list = txByProperty.get(t.propertyId) || [];
      list.push(t.status);
      txByProperty.set(t.propertyId, list);
    }

    const rows = properties.map((p) => {
      const ownerEmail = p.owner?.email ? String(p.owner.email).toLowerCase() : null;
      const user = ownerEmail ? userByEmail.get(ownerEmail) : null;
      const statuses = txByProperty.get(p.id) || [];

      let accountStatus = 'SANS_COMPTE';
      if (user) accountStatus = user.mustChangePassword ? 'PREMIERE_CONNEXION' : 'ACTIF';

      let paymentStatus = null;
      if (statuses.includes('En attente')) paymentStatus = 'IMPAYE';
      else if (statuses.includes('Payé')) paymentStatus = 'REGLE';

      return {
        propertyId: p.id,
        block: p.block || '—',
        floor: p.floor || '',
        lotNumber: p.lotNumber || '',
        surface: p.surface,
        ownerName: p.owner ? `${p.owner.firstName} ${p.owner.lastName}`.trim() : null,
        ownerId: p.owner?.id || null,
        occupants: ownerEmail ? 1 + (householdCounts.get(ownerEmail) || 0) : 0,
        accountStatus,
        paymentStatus,
      };
    });

    const blocks = new Map();
    for (const r of rows) {
      if (!blocks.has(r.block)) blocks.set(r.block, []);
      blocks.get(r.block).push(r);
    }

    res.json({
      totalLots: rows.length,
      activeAccounts: rows.filter((r) => r.accountStatus === 'ACTIF').length,
      pendingFirstLogin: rows.filter((r) => r.accountStatus === 'PREMIERE_CONNEXION').length,
      noAccount: rows.filter((r) => r.accountStatus === 'SANS_COMPTE').length,
      blocks: Array.from(blocks.entries()).map(([block, lots]) => ({ block, lots })),
    });
  } catch (err) {
    console.error('[Residence] getResidenceTrombinoscope error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};
