const { MaintenanceTicket, Subcontractor, User, Notification, Residence } = require('../models');

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
        // This would require a join with Residence to check zone
        // For now simple list
    }

    // Add include array construction
    const include = [
        { model: Subcontractor, as: 'subcontractor', required: false }
    ];

    // Check if Residence table is empty or association is valid before including
    // For now, let's try to include Residence ONLY if we are sure it won't crash
    // or just fetch it separately if needed.
    // The previous error 500 likely came from "Residence" not being defined in the query context properly 
    // or the alias mismatch despite "as: residence" being defined in index.js.
    
    // Let's try to fetch without Residence include first to stabilize.
    // If we need Residence name, we can fetch it in a separate loop or fix the association.
    
    // In index.js we have: MaintenanceTicket.belongsTo(Residence, { foreignKey: 'residenceId', as: 'residence' });
    // So include: { model: Residence, as: 'residence' } SHOULD work.
    
    // DEBUG: Let's log the attempt
    console.log("Fetching tickets with where:", where);

    const tickets = await MaintenanceTicket.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: include
    });
    res.json(tickets);
  } catch (err) {
    console.error("Error fetching tickets:", err); // Log the real error to console
    res.status(500).json({ error: 'Server Error: ' + err.message }); // Send error details for debugging
  }
};

// @desc    Get single ticket
// @route   GET /api/maintenance/:id
exports.getTicket = async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByPk(req.params.id, {
      include: [
        { model: Subcontractor, as: 'subcontractor', required: false }
      ]
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
    const ticketData = {
        ...req.body,
        email: req.user ? req.user.email : req.body.email,
        requester: req.user ? req.user.name : (req.body.requester || 'Anonyme')
    };

    const ticket = await MaintenanceTicket.create(ticketData);
    
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