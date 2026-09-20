const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { MaintenanceTicket, Subcontractor, User, Notification, Residence, Property, Owner, TicketAttachment, TicketHistory } = require('../models');
const { writeAuditLog } = require('../utils/auditLog');
const { getEffectiveResidentEmail, getEffectiveResidentUser } = require('../utils/residentScope');
const { recordTicketHistory } = require('../utils/ticketHistory');
const { MAX_TICKET_ATTACHMENTS, MAX_TICKET_ATTACHMENTS_BYTES } = require('../middleware/uploadMiddleware');

const isAllZones = (zone) => String(zone || '').trim().toUpperCase() === 'ALL';

const normalizeTicketTitle = (title) => {
  const value = String(title || '').trim();
  if (value === 'Peinture écaillée' || value === 'Peinture escaliers') {
    return 'Peinture Escalier';
  }
  return value;
};

const PROBLEM_TYPES = [
  {
    category: 'Peinture (Partie Commune)',
    items: [
      'Retouches peinture couloir',
      'Peinture Escalier',
      "Traces d'humidité",
      'Autre problème de peinture'
    ]
  },
  {
    category: 'Plomberie (Partie Commune)',
    items: [
      "Fuite d'eau",
      'Canalisation bouchée',
      'Mauvaise odeur',
      'Autre problème plomberie'
    ]
  },
  {
    category: 'Problème Bâche à eau',
    items: [
      "Niveau d'eau bas",
      'Fuite bâche',
      'Pompe défectueuse',
      'Autre problème bâche'
    ]
  },
  {
    category: 'Problème Groupe électrogène',
    items: [
      'Panne au démarrage',
      'Niveau carburant bas',
      'Bruit anormal',
      'Eclairage défectueux'
    ]
  },
  {
    category: 'Ascenseurs & Accès',
    items: [
      'Ascenseur en panne',
      "Problème TAG d'accès",
      'Rideau parking défaillant',
      'Porte hall bloquée'
    ]
  },
  {
    category: 'Hygiène & Sécurité',
    items: [
      'Déchets accumulés',
      'Nettoyage partie communes',
      'Problème de sécurité',
      'Nuisances sonores'
    ]
  },
  {
    category: 'Espaces Extérieurs',
    items: [
      'Espace vert',
      'Place de parking occupée',
      'Eclairage extérieur'
    ]
  },
  {
    category: 'Commande TAG d\'accès',
    items: ['Demande de TAG d\'accès']
  },
  {
    category: 'Commande Télécommande Parking',
    items: ['Demande de télécommande parking']
  },
  {
    category: 'Autres',
    items: ['Autres']
  }
];

const isCoproTicketCategory = (category) => {
  const value = String(category || '');
  const privateCategories = ['Autres']; 
  return !privateCategories.includes(value);
};

const isPersonalIssueType = (title) => {
  const value = String(title || '');
  return value.includes("TAG d'accès");
};

const getResidentResidenceIds = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return [];

  const properties = await Property.findAll({
    attributes: ['residenceId'],
    include: [
      { model: Owner, as: 'owner', required: true, where: { email: normalizedEmail }, attributes: [] }
    ]
  });

  return Array.from(new Set(properties.map((p) => p.residenceId).filter(Boolean)));
};

const serializeAttachment = (a) => ({
  id: a.id,
  url: a.url,
  name: a.name,
  type: a.type,
  size: a.size,
  createdAt: a.createdAt,
});

// Always exposes `attachments` (array). Tickets that only carry the legacy
// single attachmentUrl column get it surfaced as one entry.
const withAttachments = (ticket) => {
  const json = typeof ticket.toJSON === 'function' ? ticket.toJSON() : { ...ticket };
  const rows = Array.isArray(json.attachments) ? json.attachments : [];
  if (rows.length) {
    json.attachments = rows.map(serializeAttachment);
  } else if (json.attachmentUrl) {
    json.attachments = [{
      id: `legacy-${json.id}`,
      url: json.attachmentUrl,
      name: json.attachmentName || null,
      type: json.attachmentType || null,
      size: json.attachmentSize || 0,
      createdAt: json.createdAt,
    }];
  } else {
    json.attachments = [];
  }
  return json;
};

exports.getMaintenanceCategories = async (req, res) => {
  res.json({ success: true, data: PROBLEM_TYPES });
};

const canAccessTicket = async (user, ticketId) => {
  const ticket = await MaintenanceTicket.findByPk(ticketId, {
    include: [{ model: Residence, as: 'residence', attributes: ['id', 'name', 'zone'] }]
  });
  if (!ticket) return { ok: false, status: 404, error: 'Ticket not found' };
  if (!user) return { ok: false, status: 401, error: 'Not authorized' };

  if (user.role === 'RESIDENT') {
    // Household members share the primary resident's tickets (see residentScope).
    const residentEmail = await getEffectiveResidentEmail(user);
    const ticketEmail = String(ticket.email || '').toLowerCase();
    const ownTicket = ticketEmail && (ticketEmail === residentEmail || ticketEmail === String(user.email || '').toLowerCase());
    if (!ownTicket) {
      // Pour les tickets de copropriété
      const residenceIds = await getResidentResidenceIds(residentEmail);
      const isCopro = isCoproTicketCategory(ticket.category);
      const isPersonal = isPersonalIssueType(ticket.title);
      
      const allowedCopro = residenceIds.includes(ticket.residenceId) && isCopro && !isPersonal;
      if (!allowedCopro) return { ok: false, status: 403, error: 'Forbidden' };
    }
  }

  if (user.role === 'INTERVENANT') {
    const allowedByName = ticket.assignee && user.name && ticket.assignee === user.name;
    let allowedBySub = false;
    const sub = await Subcontractor.findOne({ where: { email: user.email } });
    if (sub && ticket.subcontractorId && String(ticket.subcontractorId) === String(sub.id)) {
      allowedBySub = true;
    }
    if (!allowedByName && !allowedBySub) return { ok: false, status: 403, error: 'Forbidden' };
  }

  if (user.role === 'RESPONSABLE_ZONE') {
    const zone = String(user.zone || '').trim();
    if (zone && !isAllZones(zone)) {
      const ticketZone = String(ticket.residence?.zone || '').trim();
      // Only block if residence zone is known AND doesn't match
      if (ticketZone && ticketZone !== zone) return { ok: false, status: 403, error: 'Forbidden' };
    }
  }

  return { ok: true, ticket };
};

// @desc    Get all tickets
// @route   GET /api/maintenance
exports.getTickets = async (req, res) => {
  try {
    const where = {};
    
    // Filtering for Residents: Only show their own tickets
    if (req.user && req.user.role === 'RESIDENT') {
        const residentEmail = await getEffectiveResidentEmail(req.user);
        const scope = String(req.query.scope || '').trim().toLowerCase();
        if (scope === 'residence') {
          const residenceId = String(req.query.residenceId || '').trim();
          const residenceIds = await getResidentResidenceIds(residentEmail);
          if (!residenceId || !residenceIds.includes(residenceId)) {
            return res.status(403).json({ error: 'Forbidden' });
          }
          where.residenceId = residenceId;
          where.title = { [Op.notLike]: "%TAG d'accès%" };
        } else {
          where.email = residentEmail;
        }
    }

    // Filtering for Intervenants: Only show tickets assigned to them
    if (req.user && req.user.role === 'INTERVENANT') {
        const sub = await Subcontractor.findOne({ where: { email: req.user.email } });
        if (sub) {
            where.subcontractorId = sub.id;
        } else {
            return res.json([]); // No subcontractor profile found for this user
        }
    }

    // Filtering for Zone Managers: Only show tickets for their zone
    if (req.user && req.user.role === 'RESPONSABLE_ZONE' && req.user.zone) {
        // Zone filtering handled via Residence join below
    }

    // Add include array construction
    const include = [{ model: Residence, as: 'residence', attributes: ['id', 'name', 'zone'], required: false }];
    if (req.user && req.user.role === 'RESPONSABLE_ZONE') {
      const zone = String(req.user.zone || '').trim();
      if (zone && !isAllZones(zone)) {
        include[0].where = { zone };
        include[0].required = true;
      }
    }
    
    // Attempt to include Subcontractor safely
    // Since Subcontractor is defined in index.js, it should work if the table exists
    include.push({ model: Subcontractor, as: 'subcontractor', required: false });
    include.push({ model: TicketAttachment, as: 'attachments', required: false, separate: true, order: [['createdAt', 'ASC']] });

    const tickets = await MaintenanceTicket.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: include
    });
    res.json(tickets.map(withAttachments));
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get single ticket
// @route   GET /api/maintenance/:id
exports.getTicket = async (req, res) => {
  try {
    const access = await canAccessTicket(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const ticket = access.ticket;
    const subcontractor = await Subcontractor.findByPk(ticket.subcontractorId).catch(() => null);
    const attachments = await TicketAttachment.findAll({ where: { ticketId: ticket.id }, order: [['createdAt', 'ASC']] });
    const json = ticket.toJSON();
    json.attachments = attachments;
    json.subcontractor = subcontractor || null;
    res.json(withAttachments(json));
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create ticket
// @route   POST /api/maintenance
exports.createTicket = async (req, res) => {
  try {
    const { title, residenceId, category } = req.body;

    // --- Duplicate Prevention for "Ascenseurs & Accès" ---
    if (category === 'Ascenseurs & Accès' && title && !isPersonalIssueType(title) && residenceId) {
      const existingTicket = await MaintenanceTicket.findOne({
        where: {
          residenceId,
          title,
          status: { [Op.not]: 'Terminé' }
        }
      });

      if (existingTicket) {
        return res.status(409).json({ 
          error: "Un autre ticket a été lancé dans votre résidence : attendez qu'il soit terminé pour signaler une autre panne" 
        });
      }
    }

    const rawDescription = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const safeDescription = rawDescription.slice(0, 100);

    // Tickets raised by a household member belong to the primary resident's
    // unit, so they are stored under the primary resident's e-mail.
    const ticketEmail = req.user
      ? (req.user.role === 'RESIDENT' ? await getEffectiveResidentEmail(req.user) : req.user.email)
      : req.body.email;

    const ticketData = {
        ...req.body,
        title: normalizeTicketTitle(req.body.title),
        description: safeDescription,
        email: ticketEmail,
        requester: req.user ? req.user.name : (req.body.requester || 'Anonyme')
    };

    const residence = ticketData.residenceId ? await Residence.findByPk(ticketData.residenceId) : null;
    if (!ticketData.responsible && residence?.zone) {
      const zoneManager = await User.findOne({
        where: { role: 'RESPONSABLE_ZONE', zone: residence.zone }
      });
      if (zoneManager?.name) ticketData.responsible = zoneManager.name;
    }

    const ticket = await MaintenanceTicket.create(ticketData);
    await recordTicketHistory({ ticketId: ticket.id, action: 'CREATED', toStatus: ticket.status, actor: req.user });

    const createdResidence = residence || (ticket.residenceId ? await Residence.findByPk(ticket.residenceId) : null);

    // Notification for requester confirmation
    if (ticket.email) {
      const normalizedEmail = String(ticket.email || '').trim().toLowerCase();
      const requesterUser = normalizedEmail ? await User.findOne({ where: { email: normalizedEmail } }) : null;
      if (requesterUser) {
        await Notification.create({
          userId: requesterUser.id,
          title: 'Ticket enregistré',
          message: `Votre ticket "${ticket.title}" a bien été enregistré.`,
          type: 'INFO'
        });
      }
    }

    // Notification for Managers/Admins/Zone-Managers/HSE when a ticket is created
    const admins = await User.findAll({
        where: {
            role: { [Op.in]: ['ADMIN', 'MANAGER', 'RESPONSABLE_ZONE', 'HSE'] }
        }
    });

    for (const admin of admins) {
        // Zone managers: only notify for their zone
        if (admin.role === 'RESPONSABLE_ZONE') {
          const adminZone = String(admin.zone || '').trim().toLowerCase();
          const residenceZone = String(createdResidence?.zone || '').trim().toLowerCase();
          console.log(`[NOTIF] RESPONSABLE_ZONE ${admin.email}: adminZone="${adminZone}" residenceZone="${residenceZone}"`);
          // Only skip if admin zone is specific (not ALL) AND residence zone is known AND they don't match
          if (adminZone && !isAllZones(adminZone) && residenceZone && adminZone !== residenceZone) continue;
        }
        // HSE: only notify for their zone (if set), otherwise notify for all
        if (admin.role === 'HSE') {
          const adminZone = String(admin.zone || '').trim();
          if (adminZone && adminZone.toUpperCase() !== 'ALL') {
            const residenceZone = String(createdResidence?.zone || '').trim();
            if (!residenceZone) continue;
            if (residenceZone.toLowerCase() !== adminZone.toLowerCase()) continue;
          }
        }

        await Notification.create({
            userId: admin.id,
            title: 'Nouveau ticket de maintenance',
            message: `Un nouveau ticket "${ticket.title}" a été créé pour la résidence ${createdResidence?.name || ticket.residenceId || 'Non spécifiée'}.`,
            type: 'WARNING'
        });
    }

    await writeAuditLog({
      req,
      action: 'Création ticket',
      details: `Ticket créé: ${ticket.title}`,
      user: req.user,
      meta: { ticketId: ticket.id, residenceId: ticket.residenceId || null }
    });

    res.status(201).json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Update ticket
// @route   PUT /api/maintenance/:id
exports.updateTicket = async (req, res) => {
  try {
    const access = await canAccessTicket(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const ticket = access.ticket;
    
    const before = { status: ticket.status, assignee: ticket.assignee, subcontractorId: ticket.subcontractorId, responsible: ticket.responsible };
    const oldIntervenant = ticket.subcontractorId;
    const user = req.user;
    const isAdmin = user?.role === 'ADMIN';
    const isZoneManager = user?.role === 'RESPONSABLE_ZONE';
    const profession = String(user?.profession || '').toLowerCase();
    const isSecurityManager = user?.role === 'MANAGER' && (profession.includes('sécur') || profession.includes('secur'));

    const patch = {};

    // Role-based status restrictions
    if (typeof req.body?.status === 'string') {
      const newStatus = req.body.status;

      // INTERVENANT can only set status to "En cours"
      if (user.role === 'INTERVENANT' && newStatus !== 'En cours') {
        return res.status(403).json({ error: 'Un intervenant peut uniquement mettre le statut à "En cours"' });
      }

      // Only ADMIN or RESPONSABLE_ZONE can set status to "Terminé"
      if (newStatus === 'Terminé' && user.role !== 'ADMIN' && user.role !== 'RESPONSABLE_ZONE') {
        return res.status(403).json({ error: 'Seul un administrateur ou responsable de zone peut clôturer un ticket' });
      }

      // Only ADMIN or RESPONSABLE_ZONE can reject a ticket
      if (newStatus === 'Rejeté' && user.role !== 'ADMIN' && user.role !== 'RESPONSABLE_ZONE') {
        return res.status(403).json({ error: 'Seul un administrateur ou responsable de zone peut rejeter un ticket' });
      }

      patch.status = newStatus;
    }

    // Rejection reason
    if (typeof req.body?.rejectionReason === 'string') {
      if (user.role !== 'ADMIN' && user.role !== 'RESPONSABLE_ZONE') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      patch.rejectionReason = req.body.rejectionReason;
    }

    if (typeof req.body?.priority === 'string') patch.priority = req.body.priority;
    if (typeof req.body?.title === 'string') patch.title = normalizeTicketTitle(req.body.title);
    if (typeof req.body?.category === 'string' || req.body?.category === null) patch.category = req.body.category;
    if (typeof req.body?.location === 'string') patch.location = req.body.location;

    if ('description' in (req.body || {})) {
      const raw = typeof req.body.description === 'string' ? req.body.description.trim() : '';
      patch.description = raw.slice(0, 100);
    }

    if (typeof req.body?.responsible === 'string' || req.body?.responsible === null) {
      // canAccessTicket() above already restricted RESPONSABLE_ZONE to tickets
      // in their own zone (or all zones, if they manage 'ALL') — they're the
      // one who assigns tickets, so they must be able to set/change who's
      // responsible for it, not just ADMIN.
      if (!isAdmin && !isZoneManager) return res.status(403).json({ error: 'Forbidden' });
      patch.responsible = req.body.responsible || null;
    }

    const wantsAssignIntervenant = 'subcontractorId' in (req.body || {}) || 'assignee' in (req.body || {});
    if (wantsAssignIntervenant) {
      const residence = ticket.residenceId ? await Residence.findByPk(ticket.residenceId) : null;
      const zoneManagerZone = String(user?.zone || '').trim();
      const isInZone =
        isZoneManager &&
        (isAllZones(zoneManagerZone) ||
          (zoneManagerZone && residence?.zone && zoneManagerZone === residence.zone));

      const canSelfTake = !ticket.responsible && (isInZone || isSecurityManager);
      const canAssign =
        isAdmin ||
        (ticket.responsible && user?.name && ticket.responsible === user.name) ||
        canSelfTake;

      if (!canAssign) return res.status(403).json({ error: 'Forbidden' });

      if (!ticket.responsible && canSelfTake && user?.name) {
        patch.responsible = user.name;
      }

      if (req.body.subcontractorId) {
        patch.subcontractorId = req.body.subcontractorId;
        patch.assignee = null;
      } else if ('subcontractorId' in (req.body || {}) && !req.body.subcontractorId) {
        patch.subcontractorId = null;
      }

      if (typeof req.body.assignee === 'string' && req.body.assignee.trim()) {
        patch.assignee = req.body.assignee.trim();
        patch.subcontractorId = null;
      } else if ('assignee' in (req.body || {}) && !req.body.assignee) {
        patch.assignee = null;
      }
    }

    const nextStatus = typeof patch.status === 'string' ? patch.status : ticket.status;
    if (String(nextStatus || '').trim() !== 'Signalé') {
      const nextResponsible = ('responsible' in patch) ? patch.responsible : ticket.responsible;
      const nextAssignee = ('assignee' in patch) ? patch.assignee : ticket.assignee;
      const nextSubcontractorId = ('subcontractorId' in patch) ? patch.subcontractorId : ticket.subcontractorId;
      const assigned =
        Boolean(String(nextResponsible || '').trim()) ||
        Boolean(String(nextAssignee || '').trim()) ||
        Boolean(String(nextSubcontractorId || '').trim());
      if (!assigned) {
        return res.status(400).json({ error: "Impossible de changer le statut tant qu'aucun intervenant ou responsable n'est affecté" });
      }
    }

    await ticket.update(patch);

    if (ticket.subcontractorId && ticket.subcontractorId !== oldIntervenant) {
        const subcontractor = await Subcontractor.findByPk(ticket.subcontractorId);
        if (subcontractor && subcontractor.email) {
            const user = await User.findOne({ where: { email: subcontractor.email } });
            if (user) {
                await Notification.create({
                    userId: user.id,
                    title: 'Nouvelle tâche assignée',
                    message: `Le ticket "${ticket.title}" vous a été assigné.`,
                    type: 'INFO'
                });
            }
        }
    }

    const after = { status: ticket.status, assignee: ticket.assignee, subcontractorId: ticket.subcontractorId, responsible: ticket.responsible };

    if (before.status !== after.status) {
      await recordTicketHistory({
        ticketId: ticket.id,
        action: 'STATUS_CHANGED',
        fromStatus: before.status,
        toStatus: after.status,
        note: after.status === 'Rejeté' ? ticket.rejectionReason : null,
        actor: req.user,
      });
    }
    if (
      before.assignee !== after.assignee ||
      String(before.subcontractorId || '') !== String(after.subcontractorId || '') ||
      before.responsible !== after.responsible
    ) {
      const assignedTo = after.assignee || after.responsible || (ticket.subcontractorId ? 'un intervenant' : null);
      await recordTicketHistory({
        ticketId: ticket.id,
        action: 'ASSIGNED',
        note: assignedTo ? `Affecté à ${assignedTo}` : 'Affectation retirée',
        actor: req.user,
      });
    }

    // Notify requester when status changes
    if (before.status !== after.status && ticket.email) {
      const normalizedEmail = String(ticket.email || '').trim().toLowerCase();
      const requesterUser = normalizedEmail ? await User.findOne({ where: { email: normalizedEmail } }) : null;
      if (requesterUser) {
        await Notification.create({
          userId: requesterUser.id,
          title: 'Statut ticket mis à jour',
          message: `Le ticket "${ticket.title}" est passé à "${ticket.status}".`,
          type: ticket.status === 'Terminé' ? 'SUCCESS' : 'INFO'
        });
      }
    }

    // Notify admins/managers/zone managers/HSE when status changes
    if (before.status !== after.status) {
      const residence = ticket.residenceId ? await Residence.findByPk(ticket.residenceId) : null;
      const admins = await User.findAll({
        where: {
          role: { [Op.in]: ['ADMIN', 'MANAGER', 'RESPONSABLE_ZONE', 'HSE'] }
        }
      });

      for (const adminUser of admins) {
        if (adminUser.role === 'RESPONSABLE_ZONE') {
          const adminZone = String(adminUser.zone || '').trim().toLowerCase();
          const residenceZone = String(residence?.zone || '').trim().toLowerCase();
          console.log(`[NOTIF-UPDATE] RESPONSABLE_ZONE ${adminUser.email}: adminZone="${adminZone}" residenceZone="${residenceZone}"`);
          // Only skip if admin zone is specific (not ALL) AND residence zone is known AND they don't match
          if (adminZone && !isAllZones(adminZone) && residenceZone && adminZone !== residenceZone) continue;
        }
        if (adminUser.role === 'HSE') {
          const adminZone = String(adminUser.zone || '').trim();
          if (adminZone && adminZone.toUpperCase() !== 'ALL') {
            const residenceZone = String(residence?.zone || '').trim();
            if (!residenceZone) continue;
            if (residenceZone.toLowerCase() !== adminZone.toLowerCase()) continue;
          }
        }

        await Notification.create({
          userId: adminUser.id,
          title: 'Ticket: statut mis à jour',
          message: `Le ticket "${ticket.title}" est passé à "${ticket.status}".`,
          type: ticket.status === 'Terminé' ? 'SUCCESS' : 'INFO'
        });
      }
    }

    const changed = JSON.stringify(before) !== JSON.stringify(after);
    if (changed) {
      const statusChanged = before.status !== after.status;
      const details = statusChanged
        ? `Statut ticket "${ticket.title}": ${before.status} → ${after.status}`
        : `Ticket mis à jour: ${ticket.title}`;

      await writeAuditLog({
        req,
        action: statusChanged ? 'Changement statut ticket' : 'Mise à jour ticket',
        details,
        user: req.user,
        meta: { ticketId: ticket.id, before, after }
      });
    }

    res.json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Delete ticket
// @route   DELETE /api/maintenance/:id
exports.deleteTicket = async (req, res) => {
  try {
    const access = await canAccessTicket(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const ticket = access.ticket;

    if (req.user?.role === 'INTERVENANT') return res.status(403).json({ error: 'Forbidden' });
    await ticket.destroy();
    res.json({ message: 'Ticket removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

const removeUploadedFiles = (files = []) => {
  for (const file of files) {
    const filePath = file?.path || (file?.filename ? path.join(__dirname, '..', 'uploads', 'tickets', file.filename) : null);
    if (filePath) fs.promises.unlink(filePath).catch(() => null);
  }
};

// Shared by the multi-file endpoint and the legacy single-file one.
// Rules: at most MAX_TICKET_ATTACHMENTS files per ticket, MAX_TICKET_ATTACHMENTS_BYTES in total.
const attachFilesToTicket = async (req, res, files) => {
  const access = await canAccessTicket(req.user, req.params.id);
  if (!access.ok) {
    removeUploadedFiles(files);
    return res.status(access.status).json({ error: access.error });
  }
  const ticket = access.ticket;

  if (!files.length) return res.status(400).json({ error: 'Aucun fichier fourni.' });

  const existing = await TicketAttachment.findAll({ where: { ticketId: ticket.id } });
  const existingCount = existing.length;
  const existingBytes = existing.reduce((sum, a) => sum + (a.size || 0), 0);
  const incomingBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);

  if (existingCount + files.length > MAX_TICKET_ATTACHMENTS) {
    removeUploadedFiles(files);
    return res.status(400).json({ error: `${MAX_TICKET_ATTACHMENTS} pièces jointes maximum par ticket.` });
  }
  if (existingBytes + incomingBytes > MAX_TICKET_ATTACHMENTS_BYTES) {
    removeUploadedFiles(files);
    return res.status(413).json({ error: 'Les pièces jointes ne doivent pas dépasser 10 Mo au total.' });
  }

  const created = [];
  for (const file of files) {
    created.push(await TicketAttachment.create({
      ticketId: ticket.id,
      url: `/uploads/tickets/${file.filename}`,
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      uploadedByUserId: req.user.id,
    }));
  }

  // Keep the legacy single-attachment columns pointing at the first file so
  // older admin-web screens still show a link.
  if (!ticket.attachmentUrl) {
    await ticket.update({
      attachmentUrl: created[0].url,
      attachmentName: created[0].name,
      attachmentType: created[0].type,
      attachmentSize: created[0].size,
    });
  }

  await recordTicketHistory({
    ticketId: ticket.id,
    action: 'ATTACHMENT_ADDED',
    note: `${created.length} pièce(s) jointe(s) ajoutée(s)`,
    actor: req.user,
  });

  await writeAuditLog({
    req,
    action: 'Pièce jointe ticket',
    details: `${created.length} pièce(s) jointe(s) uploadée(s): ${ticket.title}`,
    user: req.user,
    meta: { ticketId: ticket.id, files: created.map((a) => ({ name: a.name, size: a.size })) }
  });

  const all = await TicketAttachment.findAll({ where: { ticketId: ticket.id }, order: [['createdAt', 'ASC']] });
  return res.status(201).json({ attachments: all.map(serializeAttachment) });
};

// @desc    Upload ticket attachments (up to 4 files, 10 MB in total)
// @route   POST /api/maintenance/:id/attachments   (multipart field "files")
exports.uploadTicketAttachments = async (req, res) => {
  try {
    await attachFilesToTicket(req, res, req.files || []);
  } catch (err) {
    removeUploadedFiles(req.files || []);
    res.status(400).json({ error: err.message });
  }
};

// @desc    Legacy single-file upload (multipart field "file"), kept for older clients
// @route   POST /api/maintenance/:id/attachment
exports.uploadTicketAttachment = async (req, res) => {
  try {
    await attachFilesToTicket(req, res, req.file ? [req.file] : []);
  } catch (err) {
    removeUploadedFiles(req.file ? [req.file] : []);
    res.status(400).json({ error: err.message });
  }
};

// @desc    Delete one attachment of a ticket (uploader or staff)
// @route   DELETE /api/maintenance/:id/attachments/:attachmentId
exports.deleteTicketAttachment = async (req, res) => {
  try {
    const access = await canAccessTicket(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const attachment = await TicketAttachment.findOne({
      where: { id: req.params.attachmentId, ticketId: access.ticket.id },
    });
    if (!attachment) return res.status(404).json({ error: 'Pièce jointe introuvable.' });

    // Staff can remove any file; residents only files uploaded from their own
    // household (themselves, the primary resident or another member).
    const isStaff = ['ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'].includes(req.user.role);
    if (!isStaff) {
      const uploader = attachment.uploadedByUserId ? await User.findByPk(attachment.uploadedByUserId) : null;
      const householdOf = async (u) => (u ? (await getEffectiveResidentUser(u)).id : null);
      const sameHousehold = uploader && (await householdOf(uploader)) === (await householdOf(req.user));
      if (!sameHousehold) return res.status(403).json({ error: 'Forbidden' });
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'tickets', path.basename(attachment.url));
    await attachment.destroy();
    fs.promises.unlink(filePath).catch(() => null);

    res.json({ message: 'Pièce jointe supprimée.' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Processing history of a ticket (creation, status changes, assignments...)
// @route   GET /api/maintenance/:id/history
exports.getTicketHistory = async (req, res) => {
  try {
    const access = await canAccessTicket(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const ticket = access.ticket;

    const rows = await TicketHistory.findAll({
      where: { ticketId: ticket.id },
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
    });

    let items = rows.map((r) => r.toJSON());

    // Tickets that pre-date the history feature: rebuild a minimal timeline.
    if (!items.length) {
      items.push({ id: 'created', action: 'CREATED', toStatus: 'Signalé', createdAt: ticket.createdAt, actorRole: 'RESIDENT' });
      if (ticket.status && ticket.status !== 'Signalé') {
        items.push({ id: 'current', action: 'STATUS_CHANGED', fromStatus: 'Signalé', toStatus: ticket.status, createdAt: ticket.updatedAt, actorRole: null });
      }
    }

    const viewerIsResident = req.user.role === 'RESIDENT';
    items = items.map((item) => ({
      id: item.id,
      action: item.action,
      fromStatus: item.fromStatus || null,
      toStatus: item.toStatus || null,
      // Residents see who acted only by role, never staff names or assignee details.
      note: viewerIsResident && item.action === 'ASSIGNED' ? null : (item.note || null),
      actorRole: item.actorRole || null,
      actorName: viewerIsResident && item.actorRole !== 'RESIDENT' ? null : (item.actorName || null),
      createdAt: item.createdAt,
    }));

    // Start / end of the treatment, derived from the status transitions.
    const firstInProgress = items.find((i) => i.toStatus === 'En cours');
    const closing = [...items].reverse().find((i) => i.toStatus === 'Terminé' || i.toStatus === 'Rejeté');

    res.json({
      history: items,
      startedAt: firstInProgress ? firstInProgress.createdAt : null,
      closedAt: closing && ['Terminé', 'Rejeté'].includes(ticket.status) ? closing.createdAt : null,
    });
  } catch (err) {
    console.error('[Ticket] history error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};
