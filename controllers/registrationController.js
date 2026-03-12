const { RegistrationRequest, User, Owner, Property, Residence } = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');

// Helper to send email
const sendEmail = async (to, subject, text) => {
    // Check if SMTP env vars are set
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('⚠️ SMTP not configured. Email not sent.');
        console.log('--- Email Content ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${text}`);
        console.log('---------------------');
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: {
                rejectUnauthorized: false // Helpful for self-signed certs or some hosting providers
            }
        });

        await transporter.sendMail({
            from: `"GESTIMOU Support" <${process.env.SMTP_USER}>`,
            to,
            subject,
            text,
        });
        console.log(`✅ Email sent to ${to}`);
    } catch (error) {
        console.error('❌ Error sending email:', error);
        // Don't throw, just log so the request doesn't fail
    }
};

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
    let linkedProperty = null;
    if (request.residenceId && request.door) { // Block might be empty
        const whereClause = {
            residenceId: request.residenceId,
            lotNumber: request.door.trim()
        };

        // Handle block: if request.block is provided, match it. If not, match NULL or empty string.
        if (request.block && request.block.trim() !== '') {
            whereClause.block = request.block.trim();
        } else {
            // If block is not provided in request, we look for properties where block is NULL or empty
            whereClause.block = {
                [Op.or]: [null, '']
            };
        }

        console.log('Searching for property with:', whereClause);

        const property = await Property.findOne({
            where: whereClause
        });

        if (property) {
            console.log(`Property found: ${property.title} (ID: ${property.id})`);
            // Assign owner to property
            // We update ownerId to the new owner. 
            await property.update({ ownerId: owner.id, status: 'Vendu' });
            linkedProperty = property;
        } else {
            console.warn(`No property found for Residence: ${request.residenceId}, Block: ${request.block}, Door: ${request.door}`);
        }
    }

    // Assign zone to user if property found (Resident inherits zone from property)
    if (linkedProperty) {
        // We need to fetch Residence to get the zone
        const residence = await Residence.findByPk(linkedProperty.residenceId);
        if (residence && residence.zone) {
            await user.update({ zone: residence.zone });
        }
    }

    // 4. Update Request Status
    await request.update({ status: 'APPROVED' });

    // 5. Send Email
    const emailSubject = 'Bienvenue sur Gestimou - Vos accès';
    const emailBody = `
    Bonjour ${request.firstName},

    Votre demande d'inscription a été validée avec succès.
    
    Voici vos identifiants pour vous connecter à l'application mobile Gestimou :
    
    Email : ${request.email}
    Mot de passe : ${tempPassword}
    
    Nous vous recommandons de changer ce mot de passe lors de votre première connexion (si cette fonctionnalité est disponible) ou de le conserver précieusement.
    
    Cordialement,
    L'équipe Gestimou.
    `;

    await sendEmail(request.email, emailSubject, emailBody);

    res.json({ message: 'Compte validé et créé avec succès. Email envoyé.', user, tempPassword });

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
