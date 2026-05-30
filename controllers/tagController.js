const { Tag, User, Notification } = require('../models');
const { writeAuditLog } = require('../utils/auditLog');
const { Op } = require('sequelize');

// @route POST /api/tags
exports.createTag = async (req, res) => {
  try {
    const creator = req.user;
    const {
      residentEmail,
      residenceId,
      residenceName,
      propertyId,
      transactionId,
      transactionDescription,
      notes,
    } = req.body;

    if (!residentEmail) {
      return res.status(400).json({ error: 'residentEmail requis.' });
    }

    const tag = await Tag.create({
      createdByUserId: creator.id,
      residentEmail: String(residentEmail).trim().toLowerCase(),
      residenceId: residenceId || null,
      residenceName: residenceName || null,
      propertyId: propertyId || null,
      transactionId: transactionId || null,
      transactionDescription: transactionDescription || null,
      notes: notes || null,
      status: 'ACTIVE',
    });

    // Notify all RECOUVREMENT users
    try {
      const recouvreurs = await User.findAll({
        where: { role: { [Op.in]: ['RECOUVREMENT', 'ADMIN'] } },
        attributes: ['id'],
      });
      const label = transactionDescription ? `"${transactionDescription}"` : 'une charge';
      for (const r of recouvreurs) {
        await Notification.create({
          userId: r.id,
          title: 'TAG ACTIVE créé',
          message: `${creator.name || creator.email} a activé un TAG pour ${residentEmail}${residenceName ? ` (${residenceName})` : ''} suite au paiement de ${label}.`,
          type: 'INFO',
        });
      }
    } catch (_) {}

    await writeAuditLog({
      req,
      action: 'Création TAG ACTIVE',
      details: `TAG créé pour ${residentEmail} par ${creator.email}`,
      user: creator,
      meta: { tagId: tag.id, residentEmail, residenceId },
    });

    res.status(201).json(tag);
  } catch (err) {
    console.error('[tagController] createTag error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @route GET /api/tags
exports.getTags = async (req, res) => {
  try {
    const user = req.user;
    const where = {};

    // GESTIONNAIRE_TAG sees only their own tags
    if (user.role === 'GESTIONNAIRE_TAG') {
      where.createdByUserId = user.id;
    }

    const tags = await Tag.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    res.json(tags);
  } catch (err) {
    console.error('[tagController] getTags error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};
