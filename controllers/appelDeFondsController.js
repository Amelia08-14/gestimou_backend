const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { AppelDeFonds, AppelDeFondsDocument, Document, Residence, Owner, Property, User, Notification } = require('../models');
const { writeAuditLog } = require('../utils/auditLog');

const toMoneyNumber = (value) => {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return n;
};

const computeDashboard = ({ queteRassemblee, coutReel }) => {
  const r = toMoneyNumber(queteRassemblee) ?? 0;
  const d = toMoneyNumber(coutReel) ?? 0;
  return {
    rassemble: r,
    depense: d,
    reste: r - d,
  };
};

const roundMoney2 = (n) => {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const getSoldOwnerCount = async (residenceId) => {
  if (!residenceId) return 0;
  try {
    const count = await Property.count({
      where: { residenceId: String(residenceId), status: 'Vendu', ownerId: { [Op.ne]: null } },
      distinct: true,
      col: 'ownerId',
    });
    if (Number.isInteger(count) && count > 0) return count;
    const fallback = await Property.count({
      where: { residenceId: String(residenceId), status: 'Vendu' },
    });
    return Number.isInteger(fallback) ? fallback : 0;
  } catch (_) {
    return 0;
  }
};

const computeQueteParProprietaire = async ({ residenceId, coutEstimeGlobal }) => {
  const cost = toMoneyNumber(coutEstimeGlobal) ?? 0;
  const ownerCount = await getSoldOwnerCount(residenceId);
  if (!ownerCount || ownerCount <= 0) return { queteParProprietaire: 0, ownerCount };
  return { queteParProprietaire: roundMoney2(cost / ownerCount), ownerCount };
};

const getOwnerEmailsForResidence = async (residenceId) => {
  const rid = String(residenceId || '').trim();
  if (!rid) return [];

  try {
    const owners = await Owner.findAll({
      where: { residenceId: rid },
      attributes: ['email'],
    });
    return owners
      .map((o) => String(o.email || '').trim().toLowerCase())
      .filter(Boolean);
  } catch (_) {
  }

  const candidates = ['Owner', 'owner'];
  for (const table of candidates) {
    try {
      const [rows] = await sequelize.query(
        `SELECT email FROM \`${table}\` WHERE residenceId = :rid`,
        { replacements: { rid } }
      );
      if (!Array.isArray(rows)) continue;
      const emails = rows
        .map((r) => String(r?.email || '').trim().toLowerCase())
        .filter(Boolean);
      if (emails.length) return emails;
    } catch (_) {
    }
  }

  return [];
};

const notifyResidentsForResidence = async ({ residenceId, title, message }) => {
  const emails = await getOwnerEmailsForResidence(residenceId);

  if (!emails.length) return 0;

  const users = await User.findAll({
    where: {
      role: 'RESIDENT',
      email: { [Op.in]: emails },
    },
    attributes: ['id'],
  });

  if (!users.length) return 0;

  await Notification.bulkCreate(
    users.map((u) => ({
      userId: u.id,
      title: String(title),
      message: String(message),
      type: 'INFO',
      isRead: false,
    })),
    { validate: true }
  );

  return users.length;
};

// @route   GET /api/appel-de-fonds
exports.getAppelsDeFonds = async (req, res) => {
  try {
    const residenceId = String(req.query.residenceId || '').trim();
    const where = {};
    if (residenceId) where.residenceId = residenceId;

    const appels = await AppelDeFonds.findAll({ where, order: [['createdAt', 'DESC']] });

    return res.json(
      appels.map((a) => ({
        ...a.toJSON(),
        ownerCount: null,
        expectedTotal: null,
        dashboard: computeDashboard(a),
      }))
    );
  } catch (err) {
    console.error('getAppelsDeFonds error', {
      name: err?.name,
      message: err?.message,
      code: err?.original?.code,
      sqlMessage: err?.original?.sqlMessage,
    });
    res.status(500).json({ error: 'Server Error' });
  }
};

// @route   GET /api/appel-de-fonds/:id
exports.getAppelDeFondsById = async (req, res) => {
  try {
    const appel = await AppelDeFonds.findByPk(req.params.id);

    if (!appel) return res.status(404).json({ error: 'Not found' });

    let residence = null;
    try {
      residence = await Residence.findByPk(appel.residenceId, { attributes: ['id', 'name', 'zone'] });
    } catch (_) {
      residence = null;
    }

    let documents = [];
    try {
      documents = await AppelDeFondsDocument.findAll({
        where: { appelDeFondsId: appel.id },
        include: [{ model: Document, as: 'document', required: false }],
        order: [['createdAt', 'DESC']],
      });
    } catch (_) {
      try {
        documents = await AppelDeFondsDocument.findAll({
          where: { appelDeFondsId: appel.id },
          order: [['createdAt', 'DESC']],
        });
      } catch (_) {
        documents = [];
      }
    }

    const ownerCount = await getSoldOwnerCount(appel.residenceId);
    const perOwner = toMoneyNumber(appel.queteParProprietaire) ?? 0;
    const expectedTotal = ownerCount * perOwner;

    res.json({
      ...appel.toJSON(),
      residence: residence ? residence.toJSON() : null,
      documents: Array.isArray(documents) ? documents.map((d) => d.toJSON()) : [],
      ownerCount,
      expectedTotal,
      dashboard: computeDashboard(appel),
    });
  } catch (err) {
    console.error('getAppelDeFondsById error', {
      name: err?.name,
      message: err?.message,
      code: err?.original?.code,
      sqlMessage: err?.original?.sqlMessage,
    });
    res.status(500).json({ error: 'Server Error' });
  }
};

// @route   POST /api/appel-de-fonds
exports.createAppelDeFonds = async (req, res) => {
  try {
    const {
      residenceId,
      probleme,
      coutEstimeGlobal,
      status,
    } = req.body || {};

    const rid = String(residenceId || '').trim();
    const pb = String(probleme || '').trim();
    if (!rid || !pb) {
      return res.status(400).json({ error: 'Champs requis: residenceId, probleme' });
    }

    const computed = await computeQueteParProprietaire({ residenceId: rid, coutEstimeGlobal });

    const appel = await AppelDeFonds.create({
      residenceId: rid,
      probleme: pb,
      coutEstimeGlobal: toMoneyNumber(coutEstimeGlobal) ?? 0,
      queteParProprietaire: computed.queteParProprietaire,
      status: String(status || 'DRAFT'),
      createdBy: req.user?.id != null ? String(req.user.id) : null,
    });

    await writeAuditLog({
      req,
      action: 'Création appel de fonds',
      details: `Appel de fonds créé (ID: ${appel.id})`,
      user: req.user,
      meta: { appelDeFondsId: appel.id, residenceId: rid },
    });

    res.status(201).json(appel);
  } catch (err) {
    console.error('createAppelDeFonds error', {
      name: err?.name,
      message: err?.message,
      code: err?.original?.code,
      sqlMessage: err?.original?.sqlMessage,
    });
    res.status(500).json({ error: 'Server Error' });
  }
};

// @route   PUT /api/appel-de-fonds/:id
exports.updateAppelDeFonds = async (req, res) => {
  try {
    const appel = await AppelDeFonds.findByPk(req.params.id);
    if (!appel) return res.status(404).json({ error: 'Not found' });

    const previousStatus = String(appel.status || '');

    const payload = {};
    const fields = [
      'residenceId',
      'probleme',
      'coutEstimeGlobal',
      'queteParProprietaire',
      'status',
      'queteRassemblee',
      'coutReel',
    ];

    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        if (field === 'coutEstimeGlobal' || field === 'queteParProprietaire' || field === 'queteRassemblee' || field === 'coutReel') {
          payload[field] = toMoneyNumber(req.body[field]);
        } else if (field === 'probleme') {
          payload[field] = String(req.body[field] || '').trim();
        } else {
          payload[field] = String(req.body[field] || '').trim();
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'residenceId') || Object.prototype.hasOwnProperty.call(payload, 'coutEstimeGlobal')) {
      const rid = Object.prototype.hasOwnProperty.call(payload, 'residenceId')
        ? String(payload.residenceId || '').trim()
        : String(appel.residenceId || '').trim();
      const cost = Object.prototype.hasOwnProperty.call(payload, 'coutEstimeGlobal')
        ? payload.coutEstimeGlobal
        : appel.coutEstimeGlobal;
      const computed = await computeQueteParProprietaire({ residenceId: rid, coutEstimeGlobal: cost });
      payload.queteParProprietaire = computed.queteParProprietaire;
    }

    const nextStatus = Object.prototype.hasOwnProperty.call(payload, 'status')
      ? String(payload.status || '')
      : previousStatus;

    if (nextStatus === 'PUBLISHED' && !appel.publishedAt) {
      payload.publishedAt = new Date();
    }
    if (nextStatus === 'PROCESSED' && !appel.processedAt) {
      payload.processedAt = new Date();
    }

    await appel.update(payload);

    let notified = 0;
    if (previousStatus !== 'PUBLISHED' && nextStatus === 'PUBLISHED') {
      let residence = null;
      try {
        residence = await Residence.findByPk(appel.residenceId, { attributes: ['id', 'name', 'zone'] });
      } catch (_) {
        residence = null;
      }
      const title = residence?.name
        ? `Appel de fonds - ${residence.name}`
        : 'Appel de fonds';
      const message = `Un nouvel appel de fonds est disponible.${appel.probleme ? ` Problème: ${appel.probleme}.` : ''}${appel.queteParProprietaire != null ? ` Quête par propriétaire: ${appel.queteParProprietaire} DA.` : ''}`;
      notified = await notifyResidentsForResidence({
        residenceId: appel.residenceId,
        title,
        message,
      });
    }

    await writeAuditLog({
      req,
      action: 'Mise à jour appel de fonds',
      details: `Appel de fonds mis à jour (ID: ${appel.id})`,
      user: req.user,
      meta: { appelDeFondsId: appel.id, notifiedResidents: notified, status: nextStatus },
    });

    res.json({ ...appel.toJSON(), notifiedResidents: notified, dashboard: computeDashboard(appel) });
  } catch (err) {
    console.error('updateAppelDeFonds error', {
      name: err?.name,
      message: err?.message,
      code: err?.original?.code,
      sqlMessage: err?.original?.sqlMessage,
    });
    res.status(500).json({ error: 'Server Error' });
  }
};

// @route   POST /api/appel-de-fonds/:id/documents
exports.attachDocuments = async (req, res) => {
  try {
    const appel = await AppelDeFonds.findByPk(req.params.id);
    if (!appel) return res.status(404).json({ error: 'Not found' });

    const phase = String(req.body?.phase || 'BEFORE').trim().toUpperCase();
    const rawIds = req.body?.documentIds ?? (req.body?.documentId != null ? [req.body.documentId] : []);
    const documentIds = Array.isArray(rawIds)
      ? rawIds.map((id) => Number(id)).filter((n) => Number.isInteger(n) && n > 0)
      : [];

    if (!documentIds.length) {
      return res.status(400).json({ error: 'documentIds requis' });
    }

    const docs = await Document.findAll({ where: { id: { [Op.in]: documentIds } }, attributes: ['id'] });
    const foundIds = new Set(docs.map((d) => d.id));
    const missing = documentIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      return res.status(400).json({ error: `Documents introuvables: ${missing.join(', ')}` });
    }

    for (const documentId of documentIds) {
      await AppelDeFondsDocument.findOrCreate({
        where: { appelDeFondsId: appel.id, documentId, phase },
        defaults: { appelDeFondsId: appel.id, documentId, phase },
      });
    }

    const updated = await AppelDeFonds.findByPk(appel.id, {
      include: [
        {
          model: AppelDeFondsDocument,
          as: 'documents',
          include: [{ model: Document, as: 'document' }],
          order: [['createdAt', 'DESC']],
        },
      ],
    });

    res.json(updated);
  } catch (err) {
    console.error('attachDocuments error', {
      name: err?.name,
      message: err?.message,
      code: err?.original?.code,
      sqlMessage: err?.original?.sqlMessage,
    });
    res.status(500).json({ error: 'Server Error' });
  }
};

// @route   DELETE /api/appel-de-fonds/:id/documents/:documentId
exports.detachDocument = async (req, res) => {
  try {
    const appel = await AppelDeFonds.findByPk(req.params.id);
    if (!appel) return res.status(404).json({ error: 'Not found' });

    const documentId = Number(req.params.documentId);
    if (!Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ error: 'documentId invalide' });
    }

    const phase = req.query.phase ? String(req.query.phase).trim().toUpperCase() : null;

    const where = { appelDeFondsId: appel.id, documentId };
    if (phase) where.phase = phase;

    await AppelDeFondsDocument.destroy({ where });

    res.json({ message: 'Document détaché' });
  } catch (err) {
    console.error('detachDocument error', {
      name: err?.name,
      message: err?.message,
      code: err?.original?.code,
      sqlMessage: err?.original?.sqlMessage,
    });
    res.status(500).json({ error: 'Server Error' });
  }
};
