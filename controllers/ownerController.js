const { Op } = require('sequelize');
const { Owner, Property, Residence, User } = require('../models');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { writeAuditLog } = require('../utils/auditLog');

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
    auth: { user, pass },
    tls: { rejectUnauthorized: tlsRejectUnauthorized },
    logger: debug,
    debug,
  });

  return cachedTransporter;
};

const sendEmail = async (to, subject, text) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return false;
  }
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER;
    const fromName = process.env.MAIL_FROM_NAME || 'GESTIMOU Support';
    const replyTo = process.env.MAIL_REPLY_TO || fromEmail;
    const envelopeFrom = process.env.MAIL_ENVELOPE_FROM || fromEmail;

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
      replyTo,
      envelope: { from: envelopeFrom, to },
    });
    return true;
  } catch (_) {
    return false;
  }
};

const generateTempPassword = () => {
  const raw = crypto.randomBytes(12).toString('base64url');
  return raw.slice(0, 12);
};

// @desc    Get all owners
// @route   GET /api/owners
exports.getOwners = async (req, res) => {
  try {
    const where = {};
    const onlyResidents = String(req.query.onlyResidents || '').toLowerCase();
    if (onlyResidents === '1' || onlyResidents === 'true') {
      const residentUsers = await User.findAll({
        where: { role: 'RESIDENT' },
        attributes: ['email']
      });
      const emails = residentUsers.map((u) => u.email).filter(Boolean);
      if (emails.length === 0) return res.json([]);
      where.email = { [Op.in]: emails };
    }

    const residenceInclude = { model: Residence, as: 'residence', attributes: ['id', 'name', 'zone'], required: false };
    if (req.user?.role === 'RESPONSABLE_ZONE') {
      const zone = String(req.user.zone || '').trim();
      if (zone && zone.toUpperCase() !== 'ALL') {
        residenceInclude.where = { zone };
        residenceInclude.required = true;
      }
    }

    const owners = await Owner.findAll({
      where,
      include: [
        { model: Property },
        residenceInclude
      ],
      order: [['lastName', 'ASC']]
    });
    
    // Add propertiesCount virtual field for frontend compatibility
    const ownersWithCount = owners.map(owner => {
      const ownerJson = owner.toJSON();
      ownerJson.propertiesCount = owner.Properties ? owner.Properties.length : 0;
      return ownerJson;
    });

    res.json(ownersWithCount);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get single owner
// @route   GET /api/owners/:id
exports.getOwner = async (req, res) => {
  try {
    const owner = await Owner.findByPk(req.params.id, {
      include: [
        { model: Property },
        { model: Residence, as: 'residence', attributes: ['id', 'name', 'zone'] }
      ]
    });
    
    if (!owner) return res.status(404).json({ error: 'Owner not found' });

    if (req.user?.role === 'RESPONSABLE_ZONE') {
      const zone = String(req.user.zone || '').trim();
      if (zone && zone.toUpperCase() !== 'ALL') {
        const ownerZone = String(owner.residence?.zone || '').trim();
        if (!ownerZone || ownerZone !== zone) return res.status(403).json({ error: 'Forbidden' });
      }
    }
    
    const ownerJson = owner.toJSON();
    ownerJson.propertiesCount = owner.Properties ? owner.Properties.length : 0;
    ownerJson.properties = owner.Properties;

    res.json(ownerJson);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create owner
// @route   POST /api/owners
exports.createOwner = async (req, res) => {
  try {
    const owner = await Owner.create(req.body);
    res.status(201).json(owner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Update owner
// @route   PUT /api/owners/:id
exports.updateOwner = async (req, res) => {
  try {
    const owner = await Owner.findByPk(req.params.id);
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    await owner.update(req.body);
    res.json(owner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Delete owner
// @route   DELETE /api/owners/:id
exports.deleteOwner = async (req, res) => {
  try {
    const owner = await Owner.findByPk(req.params.id);
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    await owner.destroy();
    res.json({ message: 'Owner removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Reset password of linked user (owner email)
// @route   POST /api/owners/:id/reset-password
exports.resetOwnerPassword = async (req, res) => {
  try {
    const owner = await Owner.findByPk(req.params.id);
    if (!owner) return res.status(404).json({ error: 'Owner not found' });

    const email = String(owner.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email introuvable pour ce propriétaire' });

    let user = await User.findOne({ where: { email, role: 'RESIDENT' } });
    if (!user) user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: "Aucun compte utilisateur lié à cet email" });

    const tempPassword = generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 10);
    await user.update({ password: hashed, mustChangePassword: true });

    const subject = 'Gestimou - Réinitialisation de votre mot de passe';
    const body = `Bonjour ${user.name || ''},

Votre mot de passe a été réinitialisé par l'administration à votre demande.

Email : ${user.email}
Mot de passe temporaire : ${tempPassword}

À la prochaine connexion, vous devrez changer votre mot de passe.

Cordialement,
L'équipe Gestimou.`;

    const emailSent = await sendEmail(user.email, subject, body);

    res.json({ message: 'Mot de passe réinitialisé.', tempPassword, emailSent, userId: user.id });

    await writeAuditLog({
      req,
      action: 'Réinitialisation mot de passe (propriétaire)',
      details: `Mot de passe réinitialisé via propriétaires: ${user.email}`,
      user: req.user,
      meta: { ownerId: owner.id, resetUserId: user.id, emailSent }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};
