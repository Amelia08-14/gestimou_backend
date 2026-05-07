const { User } = require('../models');
const bcrypt = require('bcryptjs');
const { writeAuditLog } = require('../utils/auditLog');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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

// @desc    Get all users
// @route   GET /api/users
exports.getUsers = async (req, res) => {
  try {
    const where = {};
    const role = String(req.query.role || '').trim();
    if (role) where.role = role;

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
exports.getUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create user
// @route   POST /api/users
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, profession, zone } = req.body;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      profession,
      zone,
      mustChangePassword: true
    });
    
    // Don't return password
    const userJson = user.toJSON();
    delete userJson.password;
    
    res.status(201).json(userJson);

    await writeAuditLog({
      req,
      action: 'Création utilisateur',
      details: `Utilisateur créé: ${user.email} (${user.role})`,
      user: req.user,
      meta: { createdUserId: user.id }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const before = { name: user.name, email: user.email, role: user.role, profession: user.profession, zone: user.zone };
    const { password, ...rest } = req.body;
    
    if (password) {
      rest.password = await bcrypt.hash(password, 10);
      rest.mustChangePassword = true;
    }
    
    await user.update(rest);
    
    const userJson = user.toJSON();
    delete userJson.password;
    
    res.json(userJson);

    const after = { name: user.name, email: user.email, role: user.role, profession: user.profession, zone: user.zone };
    await writeAuditLog({
      req,
      action: 'Mise à jour utilisateur',
      details: `Utilisateur mis à jour: ${user.email}`,
      user: req.user,
      meta: { updatedUserId: user.id, before, after }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const meta = { deletedUserId: user.id, email: user.email, role: user.role };
    await user.destroy();
    res.json({ message: 'User removed' });

    await writeAuditLog({
      req,
      action: 'Suppression utilisateur',
      details: `Utilisateur supprimé: ${meta.email}`,
      user: req.user,
      meta
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Reset user password (admin)
// @route   POST /api/users/:id/reset-password
exports.resetUserPassword = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

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

    res.json({ message: 'Mot de passe réinitialisé.', tempPassword, emailSent });

    await writeAuditLog({
      req,
      action: 'Réinitialisation mot de passe',
      details: `Mot de passe réinitialisé: ${user.email}`,
      user: req.user,
      meta: { resetUserId: user.id, emailSent }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};
