const { RegistrationRequest, User, Owner, Property, Residence } = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

// @desc    Submit a new registration request (Mobile App)
// @route   POST /api/registrations
// @access  Public
exports.submitRequest = async (req, res) => {
  try {
    console.log("Registration request received:", req.body);
    const { firstName, lastName, email, phone, residenceId, block, floor, door } = req.body;

    if (!firstName || !lastName || !email || !phone) {
        return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires (Nom, Prénom, Email, Téléphone).' });
    }

    // Check if email already exists in User or Request
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        return res.status(400).json({ error: 'Un compte existe déjà avec cet email.' });
    }

    const existingRequest = await RegistrationRequest.findOne({ 
        where: { 
            email, 
            status: 'PENDING' 
        } 
    });
    if (existingRequest) {
        return res.status(400).json({ error: 'Une demande est déjà en cours de traitement pour cet email.' });
    }

    const request = await RegistrationRequest.create({
        firstName,
        lastName,
        email,
        phone,
        residenceId: residenceId || 'Non spécifié', // Fallback if residenceId is optional
        block: block || '',
        floor: floor || '',
        door: door || ''
    });

    res.status(201).json({ message: 'Demande envoyée avec succès.', requestId: request.id });

  } catch (err) {
    console.error("Error submitting registration:", err);
    // Send clean JSON error to client instead of crashing or HTML 500
    res.status(500).json({ error: `Erreur serveur: ${err.message}` });
  }
};

// @desc    Get all pending registration requests
// @route   GET /api/registrations
// @access  Private (Admin)
exports.getRequests = async (req, res) => {
  try {
    const requests = await RegistrationRequest.findAll({
        order: [['createdAt', 'DESC']]
    });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};

// @desc    Approve a registration request
// @route   POST /api/registrations/:id/approve
// @access  Private (Admin)
exports.approveRequest = async (req, res) => {
  try {
    const request = await RegistrationRequest.findByPk(req.params.id);
    if (!request) {
        return res.status(404).json({ error: 'Demande non trouvée.' });
    }

    if (request.status !== 'PENDING') {
        return res.status(400).json({ error: `Cette demande est déjà ${request.status}.` });
    }

    // 1. Create or Find Owner
    let owner = await Owner.findOne({ where: { email: request.email } });
    if (!owner) {
        owner = await Owner.create({
            firstName: request.firstName,
            lastName: request.lastName,
            email: request.email,
            phone: request.phone,
            status: 'Actif'
        });
    }

    // 2. Create User Account
    // Generate random password or use default
    const tempPassword = Math.random().toString(36).slice(-8); // Simple 8 char password
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await User.create({
        name: `${request.firstName} ${request.lastName}`,
        email: request.email,
        password: hashedPassword,
        role: 'RESIDENT', // Mobile App User
        profession: 'Propriétaire',
        // Link to Owner? User model doesn't strictly link to Owner, but Owner links to Property.
        // Ideally we should link User to Owner, but for now email match is enough or we add ownerId to User.
    });

    // 3. Link Property (Optional - if property exists, link it to owner)
    // We try to find property by details provided
    if (request.residenceId && request.block && request.door) {
        const property = await Property.findOne({
            where: {
                residenceId: request.residenceId,
                block: request.block,
                lotNumber: request.door // Assuming 'door' maps to 'lotNumber' or similar
            }
        });

        if (property) {
            // Assign owner to property if not already assigned
            if (!property.ownerId) {
                await property.update({ ownerId: owner.id, status: 'Vendu' });
            }
        }
    }

    // 4. Update Request Status
    await request.update({ status: 'APPROVED' });

    // 5. Send Email (Mock)
    console.log(`
    📧 EMAIL SENT TO: ${request.email}
    Subject: Bienvenue sur Gestimou !
    Body: 
    Bonjour ${request.firstName},
    Votre compte a été validé.
    Voici vos accès :
    Email: ${request.email}
    Mot de passe: ${tempPassword}
    Téléchargez l'application pour commencer.
    `);

    res.json({ message: 'Compte validé et créé avec succès.', user, tempPassword });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la validation.' });
  }
};

// @desc    Reject a registration request
// @route   POST /api/registrations/:id/reject
// @access  Private (Admin)
exports.rejectRequest = async (req, res) => {
  try {
    const request = await RegistrationRequest.findByPk(req.params.id);
    if (!request) {
        return res.status(404).json({ error: 'Demande non trouvée.' });
    }

    await request.update({ status: 'REJECTED' });

    res.json({ message: 'Demande rejetée.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
