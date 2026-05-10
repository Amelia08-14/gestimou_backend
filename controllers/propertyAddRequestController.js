const { Op } = require('sequelize');
const { PropertyAddRequest, Owner, Property, Residence, User, Notification } = require('../models');
const { writeAuditLog } = require('../utils/auditLog');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const apartmentNumberFromLotNumber = (lotNumber) => {
  const raw = String(lotNumber || '').trim();
  if (!raw) return '';
  const parts = raw.split('-').filter(Boolean);
  return String(parts[parts.length - 1] || raw).trim();
};

exports.submitPropertyAddRequest = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Not authorized' });
    if (user.role !== 'RESIDENT') return res.status(403).json({ error: 'Forbidden' });

    const residenceId = String(req.body?.residenceId || '').trim();
    const floor = String(req.body?.floor || '').trim();
    const block = String(req.body?.block || '').trim();
    const door = String(req.body?.door || '').trim();
    const notes = String(req.body?.notes || '').trim();

    if (!residenceId) return res.status(400).json({ error: 'residenceId requis.' });
    if (!door) return res.status(400).json({ error: "Numéro d'appartement requis." });

    const request = await PropertyAddRequest.create({
      userId: user.id,
      email: normalizeEmail(user.email),
      residenceId,
      block: block || null,
      floor: floor || null,
      door,
      notes: notes || null,
      status: 'PENDING',
    });

    const admins = await User.findAll({
      where: { role: { [Op.in]: ['ADMIN', 'MANAGER', 'RESPONSABLE_ZONE'] } },
      attributes: ['id', 'role', 'zone'],
    });

    const residence = await Residence.findByPk(residenceId).catch(() => null);

    for (const admin of admins) {
      if (admin.role === 'RESPONSABLE_ZONE') {
        const adminZone = String(admin.zone || '').trim();
        const resZone = String(residence?.zone || '').trim();
        if (adminZone && adminZone.toUpperCase() !== 'ALL' && (!resZone || adminZone !== resZone)) continue;
      }

      await Notification.create({
        userId: admin.id,
        title: 'Demande ajout de bien',
        message: `Nouvelle demande d'ajout de bien de ${user.email} (résidence: ${residenceId}).`,
        type: 'INFO',
      });
    }

    await writeAuditLog({
      req,
      action: 'Demande ajout de bien',
      details: `Demande ajout de bien: ${user.email} résidence=${residenceId} apt=${door}`,
      user,
      meta: { requestId: request.id, residenceId, door },
    });

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.getPropertyAddRequests = async (req, res) => {
  try {
    const status = String(req.query.status || '').trim().toUpperCase();
    const where = {};
    if (status) where.status = status;

    const list = await PropertyAddRequest.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.approvePropertyAddRequest = async (req, res) => {
  try {
    const admin = req.user;
    const request = await PropertyAddRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Demande non trouvée.' });
    if (String(request.status) !== 'PENDING') {
      return res.status(400).json({ error: `Cette demande est déjà ${request.status}.` });
    }

    const email = normalizeEmail(request.email);
    const owner = email ? await Owner.findOne({ where: { email } }) : null;
    if (!owner) return res.status(400).json({ error: "Propriétaire introuvable pour cet email." });

    const door = String(request.door || '').trim();
    const residenceId = String(request.residenceId || '').trim();
    if (!door || !residenceId) return res.status(400).json({ error: 'Données de demande invalides.' });

    const where = {
      residenceId,
      [Op.or]: [
        { status: 'Libre' },
        { ownerId: null },
      ],
      [Op.and]: [
        {
          [Op.or]: [
            { lotNumber: door },
            { lotNumber: { [Op.like]: `%-${door}` } },
          ],
        },
      ],
    };

    const block = String(request.block || '').trim();
    const floor = String(request.floor || '').trim();
    if (block) where.block = block;
    if (floor) where.floor = floor;

    let property = await Property.findOne({ where });
    if (!property) {
      property = await Property.findOne({
        where: {
          residenceId,
          ownerId: null,
          status: { [Op.ne]: 'Vendu' },
        },
      });
    }

    if (!property) return res.status(404).json({ error: "Aucun bien libre correspondant n'a été trouvé." });

    await property.update({ ownerId: owner.id, status: 'Vendu' });

    await request.update({
      status: 'APPROVED',
      resolvedByUserId: admin?.id || null,
      resolvedAt: new Date(),
      linkedPropertyId: String(property.id),
    });

    const requester = await User.findByPk(request.userId).catch(() => null);
    if (requester) {
      const apt = apartmentNumberFromLotNumber(property.lotNumber);
      await Notification.create({
        userId: requester.id,
        title: 'Demande ajout de bien validée',
        message: `Votre demande d'ajout de bien a été validée. Bien ajouté: ${property.title || 'Appartement'}${apt ? ` (n° ${apt})` : ''}.`,
        type: 'SUCCESS',
      });
    }

    await writeAuditLog({
      req,
      action: 'Validation demande ajout bien',
      details: `Demande ajout bien validée: ${email} property=${property.id}`,
      user: admin,
      meta: { requestId: request.id, propertyId: property.id, ownerId: owner.id },
    });

    res.json({ message: 'Demande validée.', request, property });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.rejectPropertyAddRequest = async (req, res) => {
  try {
    const admin = req.user;
    const request = await PropertyAddRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Demande non trouvée.' });
    if (String(request.status) !== 'PENDING') {
      return res.status(400).json({ error: `Cette demande est déjà ${request.status}.` });
    }

    const reason = String(req.body?.reason || '').trim();
    await request.update({
      status: 'REJECTED',
      notes: reason || request.notes,
      resolvedByUserId: admin?.id || null,
      resolvedAt: new Date(),
    });

    const requester = await User.findByPk(request.userId).catch(() => null);
    if (requester) {
      await Notification.create({
        userId: requester.id,
        title: 'Demande ajout de bien refusée',
        message: reason ? `Votre demande a été refusée: ${reason}` : 'Votre demande a été refusée par l’administration.',
        type: 'ERROR',
      });
    }

    await writeAuditLog({
      req,
      action: 'Rejet demande ajout bien',
      details: `Demande ajout bien rejetée: ${request.email}`,
      user: admin,
      meta: { requestId: request.id },
    });

    res.json({ message: 'Demande refusée.', request });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

