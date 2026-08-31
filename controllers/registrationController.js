const { RegistrationRequest, User, Owner, Property, Residence } = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');
const { writeAuditLog } = require('../utils/auditLog');

const apartmentNumberFromLotNumber = (lotNumber) => {
  const raw = String(lotNumber || '').trim();
  if (!raw) return '';
  const parts = raw.split('-').filter(Boolean);
  return String(parts[parts.length - 1] || raw).trim();
};

// @desc    Get registration options for a residence (floors + available apartments)
// @route   GET /api/registrations/options?residenceId=...
// @access  Public
exports.getResidenceOptions = async (req, res) => {
  try {
    const residenceId = String(req.query.residenceId || '').trim();
    if (!residenceId) {
      return res.status(400).json({ success: false, error: 'residenceId requis.' });
    }

    // Residents register for / claim the apartment they already occupy, so we
    // never filter on 'Libre' status — those units are handled separately
    // after key handover. What actually distinguishes "available to claim"
    // (forPropertyRequest=true, an existing resident adding another property
    // they own) is simply that nobody has been linked as its owner yet.
    const whereClause = { residenceId, status: { [Op.ne]: 'Libre' } };
    if (req.query.forPropertyRequest === 'true') {
      whereClause.ownerId = null;
    }

    const properties = await Property.findAll({
      where: whereClause,
      attributes: ['id', 'floor', 'block', 'lotNumber', 'status', 'residenceId'],
      order: [
        ['floor', 'ASC'],
        ['block', 'ASC'],
        ['lotNumber', 'ASC']
      ]
    });

    const units = properties
      .map((p) => ({
        id: p.id,
        floor: p.floor || '',
        block: p.block || '',
        apartmentNumber: apartmentNumberFromLotNumber(p.lotNumber),
        lotNumber: String(p.lotNumber || '')
      }))
      .filter((u) => Boolean(u.apartmentNumber));

    // Include empty string for apartments without a floor (shown as "Rez-de-chaussée" in UI)
    const floors = Array.from(new Set(units.map((u) => String(u.floor || '').trim())));

    res.json({ success: true, data: { floors, units } });
  } catch (err) {
    console.error('Error fetching registration options:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
};

let cachedTransporter = null;
let cachedTransporterKey = null;

const getTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const tlsRejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';
    const debug = process.env.SMTP_DEBUG === 'true';

    const key = `${host}|${port}|${secure}|${user}|${tlsRejectUnauthorized}|${debug}`;
    if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;

    cachedTransporterKey = key;
    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        },
        tls: {
            rejectUnauthorized: tlsRejectUnauthorized
        },
        logger: debug,
        debug
    });

    return cachedTransporter;
};

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
        const transporter = getTransporter();

        const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER;
        const fromName = process.env.MAIL_FROM_NAME || 'GESTIMOU Support';
        const replyTo = process.env.MAIL_REPLY_TO || fromEmail;
        const envelopeFrom = process.env.MAIL_ENVELOPE_FROM || fromEmail;

        const info = await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to,
            subject,
            text,
            replyTo,
            envelope: { from: envelopeFrom, to },
        });
        console.log('✅ Email sent', {
            to,
            messageId: info?.messageId,
            accepted: info?.accepted,
            rejected: info?.rejected,
            response: info?.response
        });
    } catch (error) {
        console.error('❌ Error sending email', {
            to,
            message: error?.message,
            code: error?.code,
            command: error?.command,
            responseCode: error?.responseCode,
            response: error?.response,
            rejected: error?.rejected
        });
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

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedFirstName = String(firstName || '').trim();
    const normalizedLastName = String(lastName || '').trim();
    const normalizedPhone = String(phone || '').trim();
    const normalizedResidenceId = String(residenceId || '').trim();

    if (!normalizedFirstName || !normalizedLastName || !normalizedEmail || !normalizedPhone) {
        return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires (Nom, Prénom, Email, Téléphone).' });
    }
    if (!normalizedResidenceId) {
        return res.status(400).json({ error: 'Veuillez sélectionner une résidence.' });
    }
    if (!String(floor || '').trim() || !String(door || '').trim()) {
        return res.status(400).json({ error: 'Veuillez sélectionner l’étage et le numéro d’appartement.' });
    }

    // Check if email already exists in User or Request
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
        return res.status(400).json({ error: 'Un compte existe déjà avec cet email.' });
    }

    const existingRequest = await RegistrationRequest.findOne({ 
        where: { 
            email: normalizedEmail, 
            status: 'PENDING' 
        } 
    });
    const payload = {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        phone: normalizedPhone,
        residenceId: normalizedResidenceId,
        block: String(block || '').trim(),
        floor: String(floor || '').trim(),
        door: String(door || '').trim()
    };

    if (existingRequest) {
        await existingRequest.update(payload);
        return res.status(201).json({ message: 'Demande envoyée avec succès.', requestId: existingRequest.id });
    }

    const existingAny = await RegistrationRequest.findOne({ where: { email: normalizedEmail } });
    if (existingAny) {
        await existingAny.update({ ...payload, status: 'PENDING' });
        return res.status(201).json({ message: 'Demande envoyée avec succès.', requestId: existingAny.id });
    }

    const request = await RegistrationRequest.create(payload);

    res.status(201).json({ message: 'Demande envoyée avec succès.', requestId: request.id });

  } catch (err) {
    console.error("Error submitting registration:", {
      name: err?.name,
      message: err?.message,
      errors: Array.isArray(err?.errors) ? err.errors.map((e) => ({ message: e?.message, type: e?.type, path: e?.path })) : undefined
    });
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Une demande existe déjà pour cet email. Veuillez patienter ou contacter l’administration.' });
    }
    if (err?.name === 'SequelizeValidationError') {
      const messages = Array.isArray(err.errors) ? err.errors.map((e) => e.message).filter(Boolean) : [];
      return res.status(400).json({ error: messages.length ? messages.join(' | ') : 'Données invalides.' });
    }
    if (err?.name && String(err.name).startsWith('Sequelize')) {
      return res.status(400).json({ error: 'Données invalides.' });
    }
    const message = String(err?.message || '');
    if (message.toLowerCase().includes('validation')) {
      const messages = Array.isArray(err?.errors) ? err.errors.map((e) => e?.message).filter(Boolean) : [];
      return res.status(400).json({ error: messages.length ? messages.join(' | ') : message });
    }
    res.status(500).json({ error: `Erreur serveur: ${message}` });
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
            residenceId: request.residenceId,
            block: request.block || null,
            floor: request.floor || null,
            doorNumber: request.door || null,
            status: 'Non Actif'
        });
    } else {
        await owner.update({
            residenceId: request.residenceId || owner.residenceId,
            block: (request.block && request.block.trim() !== '') ? request.block.trim() : owner.block,
            floor: (request.floor && request.floor.trim() !== '') ? request.floor.trim() : owner.floor,
            doorNumber: (request.door && request.door.trim() !== '') ? request.door.trim() : owner.doorNumber
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
        mustChangePassword: true,
        // Link to Owner? User model doesn't strictly link to Owner, but Owner links to Property.
        // Ideally we should link User to Owner, but for now email match is enough or we add ownerId to User.
    });

    // 3. Link Property (Optional - if property exists, link it to owner)
    // We try to find property by details provided
    let linkedProperty = null;
    let propertyLinkWarning = null;
    if (request.residenceId && request.door) { // Block might be empty
        const doorNumber = request.door.trim();
        // Residents register for the apartment they already occupy, so we
        // match on location only — the property is expected to already be
        // 'Occupé'/'Vendu', not 'Libre' (those are handled after key handover).
        // Matching is done in two passes: first a strict pass (door + block +
        // floor when provided), then — if nothing matched — a looser
        // case/whitespace-insensitive pass on the same residence + door only,
        // since block/floor formatting can drift between residences (e.g.
        // ground floor stored as '' for some, 'RDC' for others).
        const doorWhere = {
            residenceId: request.residenceId,
            [Op.or]: [
                { lotNumber: doorNumber },
                { lotNumber: { [Op.like]: `%-${doorNumber}` } }
            ]
        };

        const strictWhere = { ...doorWhere };
        if (request.block && request.block.trim() !== '') {
            strictWhere.block = request.block.trim();
        }
        if (request.floor && request.floor.trim() !== '') {
            strictWhere.floor = request.floor.trim();
        }

        console.log('Searching for property with:', strictWhere);

        let property = await Property.findOne({ where: strictWhere });

        if (!property) {
            // Loose fallback: same residence + door, ignore block/floor casing/whitespace.
            const candidates = await Property.findAll({ where: doorWhere });
            const norm = (v) => String(v || '').trim().toLowerCase();
            const wantBlock = norm(request.block);
            const wantFloor = norm(request.floor);
            property = candidates.find((p) => {
                const blockOk = !wantBlock || norm(p.block) === wantBlock;
                const floorOk = !wantFloor || norm(p.floor) === wantFloor;
                return blockOk && floorOk;
            }) || (candidates.length === 1 ? candidates[0] : null);

            if (property) {
                console.log(`Property found via loose match: ${property.title} (ID: ${property.id})`);
            }
        }

        if (property) {
            if (property.ownerId && property.ownerId !== owner.id) {
                console.warn(`Property ${property.id} already has ownerId=${property.ownerId}; reassigning to ${owner.id} for ${request.email}.`);
            }
            await property.update({ ownerId: owner.id, status: 'Vendu' });
            linkedProperty = property;
        } else {
            propertyLinkWarning = `Aucun bien correspondant trouvé (résidence: ${request.residenceId}, bloc: ${request.block || '-'}, étage: ${request.floor || '-'}, porte: ${request.door}). Le compte a été créé mais le bien doit être affecté manuellement.`;
            console.warn(propertyLinkWarning);
        }
    } else {
        propertyLinkWarning = "Aucune résidence/porte fournie dans la demande — le bien doit être affecté manuellement.";
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

    await writeAuditLog({
      req,
      action: 'Validation inscription',
      details: `Inscription validée: ${request.email}`,
      user: req.user,
      meta: { requestId: request.id }
    });

    // 5. Send Email
    const emailSubject = 'Bienvenue sur Global Immo Service - Vos accès';
    const emailBody = `
    Bonjour ${request.firstName},

    Votre demande d'inscription a été validée avec succès.

    Voici vos identifiants pour vous connecter à l'application mobile Global Immo Service :

    Email : ${request.email}
    Mot de passe : ${tempPassword}

    Nous vous recommandons de changer ce mot de passe lors de votre première connexion (si cette fonctionnalité est disponible) ou de le conserver précieusement.

    Cordialement,
    L'équipe Global Immo Service.
    `;

    await sendEmail(request.email, emailSubject, emailBody);

    res.json({
      message: 'Compte validé et créé avec succès. Email envoyé.',
      user,
      tempPassword,
      propertyLinked: Boolean(linkedProperty),
      propertyLinkWarning,
      linkedPropertyId: linkedProperty ? linkedProperty.id : null
    });

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

    await writeAuditLog({
      req,
      action: 'Rejet inscription',
      details: `Inscription rejetée: ${request.email}`,
      user: req.user,
      meta: { requestId: request.id }
    });

    res.json({ message: 'Demande rejetée.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
