const { MaintenanceTicket, Subcontractor, User, Notification } = require('../models');

// @desc    Get all tickets
// @route   GET /api/maintenance
exports.getTickets = async (req, res) => {
  try {
    const where = {};
    
    // Filtering for Residents: Only show their own tickets
    if (req.user && req.user.role === 'RESIDENT') {
        where.email = req.user.email; // We match by email as tickets are linked to owner/email
    }

    // Filtering for Zone Managers: Only show tickets for their zone
    if (req.user && req.user.role === 'RESPONSABLE_ZONE' && req.user.zone) {
        // This would require a join with Residence to check zone
        // For now simple list
    }

    const tickets = await MaintenanceTicket.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [{ model: Subcontractor, as: 'subcontractor' }]
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
    const ticket = await MaintenanceTicket.findByPk(req.params.id, {
      include: [{ model: Subcontractor, as: 'subcontractor' }]
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create ticket
// @route   POST /api/maintenance
exports.createTicket = async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.create(req.body);
    
    // Notification for Managers/Admins when a ticket is created
    const admins = await User.findAll({ 
        where: { 
            role: ['ADMIN', 'MANAGER', 'RESPONSABLE_ZONE'] 
        } 
    });

    for (const admin of admins) {
        // Skip if zone manager but different zone
        if (admin.role === 'RESPONSABLE_ZONE' && admin.zone !== ticket.zone) continue;

        await Notification.create({
            userId: admin.id,
            title: 'Nouveau ticket de maintenance',
            message: `Un nouveau ticket "${ticket.subject}" a été créé pour la résidence ${ticket.residenceId}.`,
            type: 'WARNING'
        });
    }

    res.status(201).json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Update ticket
// @route   PUT /api/maintenance/:id
exports.updateTicket = async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    
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
                    message: `Le ticket "${ticket.subject}" vous a été assigné.`,
                    type: 'INFO'
                });
            }
        }
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
    const ticket = await MaintenanceTicket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    await ticket.destroy();
    res.json({ message: 'Ticket removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};