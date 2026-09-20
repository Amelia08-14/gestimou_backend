const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { HouseholdMember, User, UserDevice, Notification, Owner } = require('../models');
const { saveImageDataUrl } = require('../utils/mediaUpload');
const { sendEmail } = require('../utils/mailer');
const { writeAuditLog } = require('../utils/auditLog');

const MAX_HOUSEHOLD_MEMBERS = 4;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateTempPassword = () => crypto.randomBytes(12).toString('base64url').slice(0, 12);

const serialize = (member, linkedUser) => ({
  id: member.id,
  fullName: member.fullName,
  relation: member.relation,
  phone: member.phone,
  photo: member.photo,
  email: member.email,
  linkedUserId: member.linkedUserId,
  // null on legacy members that have no login account
  accountActive: linkedUser ? linkedUser.isActive !== false : null,
  createdAt: member.createdAt,
});

const loadLinkedUsers = async (members) => {
  const ids = members.map((m) => m.linkedUserId).filter(Boolean);
  if (!ids.length) return new Map();
  const users = await User.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'isActive'] });
  return new Map(users.map((u) => [u.id, u]));
};

const accessMail = (primary, member, tempPassword) => ({
  subject: 'Gérance Immo Service - Vos accès à l\'application',
  body: `Bonjour ${member.fullName},

${primary.name || 'Un résident'} vous a ajouté(e) à son foyer sur l'application Gérance Immo Service.

Pour vous connecter :
E-mail : ${member.email}
Mot de passe temporaire : ${tempPassword}

À votre première connexion, vous devrez choisir un nouveau mot de passe.

Cordialement,
L'équipe Gérance Immo Service.`,
});

// Creates the login account for a member and e-mails its access. The account
// is a RESIDENT user linked to the primary resident (householdOwnerId), so it
// sees the same unit, tickets and charges.
const provisionMemberAccount = async ({ primary, member, email, transaction }) => {
  const tempPassword = generateTempPassword();
  const user = await User.create({
    name: member.fullName,
    email,
    password: await bcrypt.hash(tempPassword, 10),
    role: 'RESIDENT',
    mustChangePassword: true,
    householdOwnerId: primary.id,
  }, { transaction });
  await member.update({ email, linkedUserId: user.id }, { transaction });
  return { user, tempPassword };
};

// Returns an error string when the e-mail can't be used for a new account.
const checkEmailAvailable = async (email) => {
  if (!EMAIL_RE.test(email)) return "Adresse e-mail invalide.";
  if (await User.findOne({ where: { email } })) return 'Un compte existe déjà avec cette adresse e-mail.';
  if (await Owner.findOne({ where: { email } })) return 'Cette adresse e-mail correspond déjà à un propriétaire.';
  return null;
};

// @desc    List the household members of the logged-in resident
// @route   GET /api/household-members
// @access  Private (RESIDENT)
exports.getHouseholdMembers = async (req, res) => {
  try {
    const members = await HouseholdMember.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'ASC']],
    });
    const linked = await loadLinkedUsers(members);
    res.json(members.map((m) => serialize(m, linked.get(m.linkedUserId))));
  } catch (err) {
    console.error('[HouseholdMember] list error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Add a household member: creates their account and e-mails their access
// @route   POST /api/household-members
// @access  Private (primary RESIDENT)
exports.addHouseholdMember = async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || '').trim();
    const relation = String(req.body?.relation || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const photoDataUrl = req.body?.photo;

    if (!fullName) return res.status(400).json({ error: 'Le nom est requis.' });
    if (!email) return res.status(400).json({ error: "L'adresse e-mail est requise." });

    const count = await HouseholdMember.count({ where: { userId: req.user.id } });
    if (count >= MAX_HOUSEHOLD_MEMBERS) {
      return res.status(400).json({ error: `Vous avez atteint le maximum de ${MAX_HOUSEHOLD_MEMBERS} membres du foyer.` });
    }

    const emailError = await checkEmailAvailable(email);
    if (emailError) return res.status(409).json({ error: emailError });

    let photo = null;
    if (photoDataUrl) {
      photo = await saveImageDataUrl(photoDataUrl, 'household');
      if (!photo) return res.status(400).json({ error: 'Photo invalide.' });
    }

    const tx = await sequelize.transaction();
    let member;
    let tempPassword;
    let user;
    try {
      member = await HouseholdMember.create({
        userId: req.user.id,
        fullName,
        relation: relation || null,
        phone: phone || null,
        photo,
      }, { transaction: tx });
      ({ user, tempPassword } = await provisionMemberAccount({ primary: req.user, member, email, transaction: tx }));
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      if (err?.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
      }
      throw err;
    }

    const mail = accessMail(req.user, member, tempPassword);
    const emailSent = await sendEmail(email, mail.subject, mail.body);

    await writeAuditLog({
      req,
      action: 'Ajout membre du foyer',
      details: `Membre ajouté: ${email} (foyer de ${req.user.email})`,
      user: req.user,
      meta: { memberId: member.id, memberUserId: user.id, emailSent },
    });

    res.status(201).json({ ...serialize(member, user), emailSent });
  } catch (err) {
    console.error('[HouseholdMember] add error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Edit a household member
// @route   PUT /api/household-members/:id
// @access  Private (primary RESIDENT, owner only)
exports.updateHouseholdMember = async (req, res) => {
  try {
    const member = await HouseholdMember.findByPk(req.params.id);
    if (!member || member.userId !== req.user.id) {
      return res.status(404).json({ error: 'Membre introuvable.' });
    }

    const updates = {};
    if (req.body?.fullName !== undefined) {
      const fullName = String(req.body.fullName).trim();
      if (!fullName) return res.status(400).json({ error: 'Le nom est requis.' });
      updates.fullName = fullName;
    }
    if (req.body?.relation !== undefined) updates.relation = String(req.body.relation).trim() || null;
    if (req.body?.phone !== undefined) updates.phone = String(req.body.phone).trim() || null;
    if (req.body?.photo) {
      const photo = await saveImageDataUrl(req.body.photo, 'household');
      if (!photo) return res.status(400).json({ error: 'Photo invalide.' });
      updates.photo = photo;
    }

    // Legacy members were declared without a login: giving them an e-mail now
    // provisions their account. Once linked, the e-mail can't be changed.
    const newEmail = String(req.body?.email || '').trim().toLowerCase();
    let tempPassword = null;
    let provisionedUser = null;
    if (newEmail && !member.linkedUserId) {
      const emailError = await checkEmailAvailable(newEmail);
      if (emailError) return res.status(409).json({ error: emailError });

      const tx = await sequelize.transaction();
      try {
        await member.update(updates, { transaction: tx });
        ({ user: provisionedUser, tempPassword } = await provisionMemberAccount({
          primary: req.user, member, email: newEmail, transaction: tx,
        }));
        await tx.commit();
      } catch (err) {
        await tx.rollback();
        if (err?.name === 'SequelizeUniqueConstraintError') {
          return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
        }
        throw err;
      }
    } else {
      await member.update(updates);
    }

    let emailSent;
    if (provisionedUser) {
      const mail = accessMail(req.user, member, tempPassword);
      emailSent = await sendEmail(newEmail, mail.subject, mail.body);
    }

    let linked = provisionedUser;
    if (!linked && member.linkedUserId) {
      linked = await User.findByPk(member.linkedUserId);
      if (linked && updates.fullName) await linked.update({ name: updates.fullName });
    }

    res.json({ ...serialize(member, linked), ...(emailSent !== undefined ? { emailSent } : {}) });
  } catch (err) {
    console.error('[HouseholdMember] update error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Send the member their access again (new temporary password)
// @route   POST /api/household-members/:id/resend-access
// @access  Private (primary RESIDENT, owner only)
exports.resendMemberAccess = async (req, res) => {
  try {
    const member = await HouseholdMember.findByPk(req.params.id);
    if (!member || member.userId !== req.user.id) {
      return res.status(404).json({ error: 'Membre introuvable.' });
    }
    const user = member.linkedUserId ? await User.findByPk(member.linkedUserId) : null;
    if (!user || !member.email) {
      return res.status(400).json({ error: "Ce membre n'a pas de compte. Ajoutez son adresse e-mail." });
    }
    if (user.isActive === false) {
      return res.status(403).json({ error: "Ce compte a été désactivé par l'administration." });
    }

    const tempPassword = generateTempPassword();
    await user.update({ password: await bcrypt.hash(tempPassword, 10), mustChangePassword: true });

    const mail = accessMail(req.user, member, tempPassword);
    const emailSent = await sendEmail(member.email, mail.subject, mail.body);

    await writeAuditLog({
      req,
      action: 'Renvoi accès membre du foyer',
      details: `Accès renvoyés à ${member.email}`,
      user: req.user,
      meta: { memberId: member.id, emailSent },
    });

    res.json({ emailSent });
  } catch (err) {
    console.error('[HouseholdMember] resend error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Remove a household member and revoke their account
// @route   DELETE /api/household-members/:id
// @access  Private (primary RESIDENT, owner only)
exports.removeHouseholdMember = async (req, res) => {
  try {
    const member = await HouseholdMember.findByPk(req.params.id);
    if (!member || member.userId !== req.user.id) {
      return res.status(404).json({ error: 'Membre introuvable.' });
    }

    const linkedUserId = member.linkedUserId;
    await member.destroy();

    if (linkedUserId) {
      const linked = await User.findByPk(linkedUserId);
      // Only ever delete an account that was created through this household.
      if (linked && linked.householdOwnerId === req.user.id) {
        await UserDevice.destroy({ where: { userId: linked.id } });
        await Notification.destroy({ where: { userId: linked.id } });
        await linked.destroy();
      }
    }

    await writeAuditLog({
      req,
      action: 'Retrait membre du foyer',
      details: `Membre retiré: ${member.email || member.fullName} (foyer de ${req.user.email})`,
      user: req.user,
      meta: { memberId: member.id, memberUserId: linkedUserId },
    });

    res.json({ message: 'Membre supprimé.' });
  } catch (err) {
    console.error('[HouseholdMember] remove error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.MAX_HOUSEHOLD_MEMBERS = MAX_HOUSEHOLD_MEMBERS;
