const { Op } = require('sequelize');
const { MaintenanceTicket, Subcontractor, User, Notification, Residence } = require('../models');
const { writeAuditLog } = require('../utils/auditLog');

const isAllZones = (zone) => String(zone || '').trim().toUpperCase() === 'ALL';

const canAccessTicket = async (user, ticketId) => {
  const ticket = await MaintenanceTicket.findByPk(ticketId, {
    include: [{ model: Residence, as: 'residence', attributes: ['id', 'name', 'zone'] }]
  });
  if (!ticket) return { ok: false, status: 404, error: 'Ticket not found' };
  if (!user) return { ok: false, status: 401, error: 'Not authorized' };

  if (user.role === 'RESIDENT') {
    if (!ticket.email || ticket.email !== user.email) return { ok: false, status: 403, error: 'Forbidden' };
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
      if (!ticketZone || ticketZone !== zone) return { ok: false, status: 403, error: 'Forbidden' };
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
        where.email = req.user.email; 
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

    const tickets = await MaintenanceTicket.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: include
    });
    res.json(tickets);
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
    const json = ticket.toJSON();
    json.subcontractor = subcontractor || null;
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create ticket
// @route   POST /api/maintenance
exports.createTicket = async (req, res) => {
  try {
    const ticketData = {
        ...req.body,
        email: req.user ? req.user.email : req.body.email,
        requester: req.user ? req.user.name : (req.body.requester || 'Anonyme')
    };

    const ticket = await MaintenanceTicket.create(ticketData);
    
    const residence = ticket.residenceId ? await Residence.findByPk(ticket.residenceId) : null;

    // Notification for Managers/Admins when a ticket is created
    const admins = await User.findAll({ 
        where: { 
            role: { [Op.in]: ['ADMIN', 'MANAGER', 'RESPONSABLE_ZONE'] }
        } 
    });

    for (const admin of admins) {
        // Skip if zone manager but different zone
        if (admin.role === 'RESPONSABLE_ZONE') {
          if (!admin.zone) continue;
          if (!residence?.zone) continue;
          if (admin.zone !== residence.zone) continue;
        }

        await Notification.create({
            userId: admin.id,
            title: 'Nouveau ticket de maintenance',
            message: `Un nouveau ticket "${ticket.title}" a été créé pour la résidence ${ticket.residenceId || 'Non spécifiée'}.`,
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
    
    const before = { status: ticket.status, assignee: ticket.assignee, subcontractorId: ticket.subcontractorId };
    const oldIntervenant = ticket.subcontractorId;
    await ticket.update(req.body);

    // Notification if a subcontractor (Intervenant) is assigned
    if (req.body.subcontractorId && req.body.subcontractorId !== oldIntervenant) {
        // Find if this subcontractor has a User account
        const subcontractor = await Subcontractor.findByPk(req.body.subcontractorId);
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

    const after = { status: ticket.status, assignee: ticket.assignee, subcontractorId: ticket.subcontractorId };
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    if (changed) {
      await writeAuditLog({
        req,
        action: 'Mise à jour ticket',
        details: `Ticket mis à jour: ${ticket.title}`,
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

// @desc    Upload ticket attachment (single file, max 2MB)
// @route   POST /api/maintenance/:id/attachment
exports.uploadTicketAttachment = async (req, res) => {
  try {
    const access = await canAccessTicket(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const ticket = access.ticket;

    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const publicUrl = `/uploads/tickets/${req.file.filename}`;
    await ticket.update({
      attachmentUrl: publicUrl,
      attachmentName: req.file.originalname,
      attachmentType: req.file.mimetype,
      attachmentSize: req.file.size,
    });

    res.json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
