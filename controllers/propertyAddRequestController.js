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
    const propertyId = String(req.body?.propertyId || req.body?.requestedPropertyId || '').trim();
    const notes = String(req.body?.notes || '').trim();

    if (!residenceId) return res.status(400).json({ error: 'residenceId requis.' });
    if (!propertyId) return res.status(400).json({ error: "Veuillez sélectionner un appartement." });

    const property = await Property.findByPk(propertyId);
    if (!property) return res.status(404).json({ error: "Bien introuvable." });
    if (String(property.residenceId || '').trim() !== residenceId) {
      console.log(`[PropertyAddRequest] residenceId mismatch: property.residenceId="${property.residenceId}" submitted="${residenceId}"`);
      return res.status(400).json({ error: "Bien invalide pour cette résidence." });
    }
    if (String(property.status || '').trim() !== 'Libre' || property.ownerId) {
      console.log(`[PropertyAddRequest] not available: status="${property.status}" ownerId="${property.ownerId}"`);
      return res.status(400).json({ error: "Ce bien n'est pas disponible (déjà attribué ou en cours de traitement)." });
    }

    // Prevent duplicate pending request for same property
    const existingPending = await PropertyAddRequest.findOne({
      where: { requestedPropertyId: String(propertyId), status: 'PENDING' }
    });
    if (existingPending) {
      return res.status(400).json({ error: "Une demande est déjà en cours pour ce bien." });
    }

    const floor = String(property.floor || '').trim();
    const block = String(property.block || '').trim();
    const door = apartmentNumberFromLotNumber(property.lotNumber);
    if (!door) return res.status(400).json({ error: "Numéro d'appartement invalide (lotNumber manquant)." });

    const request = await PropertyAddRequest.create({
      userId: user.id,
      email: normalizeEmail(user.email),
      residenceId,
      block: block || null,
      floor: floor || null,
      door,
      requestedPropertyId: String(property.id),
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
        message: `Nouvelle demande d'ajout de bien de ${user.email} (résidence: ${residenceId}, appartement: ${door}).`,
        type: 'INFO',
      });
    }

    await writeAuditLog({
      req,
      action: 'Demande ajout de bien',
      details: `Demande ajout de bien: ${user.email} résidence=${residenceId} property=${propertyId} apt=${door}`,
      user,
      meta: { requestId: request.id, residenceId, door, propertyId },
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

    const residenceId = String(request.residenceId || '').trim();
    const requestedPropertyId = String(request.requestedPropertyId || '').trim();
    if (!requestedPropertyId || !residenceId) return res.status(400).json({ error: 'Données de demande invalides.' });

    const property = await Property.findByPk(requestedPropertyId);
    if (!property) return res.status(404).json({ error: "Bien demandé introuvable." });
    if (String(property.residenceId || '').trim() !== residenceId) {
      return res.status(400).json({ error: "Bien invalide pour cette résidence." });
    }
    if (String(property.status || '').trim() !== 'Libre' || property.ownerId) {
      return res.status(400).json({ error: "Ce bien n'est plus disponible." });
    }

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
