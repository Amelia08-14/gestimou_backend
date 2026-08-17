const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { User, PasswordResetToken } = require('../models');
const { writeAuditLog } = require('../utils/auditLog');

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── Mailer (same pattern as registrationController.js) ────────────────────
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
    console.warn('⚠️ SMTP not configured. Email not sent.');
    console.log('--- Email Content ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${text}`);
    console.log('---------------------');
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
  } catch (error) {
    console.error('❌ Error sending email', { to, message: error?.message });
    return false;
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const escapeHtml = (str) =>
  String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

// Consumes a raw token: verifies it, sets the new password, marks the token
// used. Returns { ok: true } or { ok: false, error }.
const consumeResetToken = async (rawToken, newPassword) => {
  if (!rawToken) return { ok: false, error: 'Lien invalide.' };
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
  }

  const tokenHash = hashToken(rawToken);
  const record = await PasswordResetToken.findOne({ where: { tokenHash, used: false } });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'Ce lien de réinitialisation est invalide ou a expiré.' };
  }

  const user = await User.findByPk(record.userId);
  if (!user) return { ok: false, error: 'Compte introuvable.' };

  const hashed = await bcrypt.hash(newPassword, 10);
  await user.update({ password: hashed, mustChangePassword: false });
  await record.update({ used: true });

  await writeAuditLog({
    action: 'Réinitialisation mot de passe (self-service)',
    details: `Mot de passe réinitialisé via lien email: ${user.email}`,
    user,
  });

  return { ok: true };
};

// ─── JSON API (used by the mobile app) ──────────────────────────────────────

// @desc    Request a password reset link by email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const genericResponse = {
      message: "Si un compte existe avec cette adresse e-mail, un lien de réinitialisation vient d'être envoyé.",
    };
    if (!email) return res.status(400).json({ error: 'Adresse e-mail requise.' });

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Don't reveal whether the account exists.
      return res.json(genericResponse);
    }

    // Invalidate any previous unused tokens for this user.
    await PasswordResetToken.destroy({ where: { userId: user.id, used: false } });

    const rawToken = crypto.randomBytes(32).toString('hex');
    await PasswordResetToken.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });

    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${rawToken}`;
    const subject = 'Gestimou - Réinitialisation de votre mot de passe';
    const body = `Bonjour ${user.name || ''},

Vous avez demandé la réinitialisation de votre mot de passe Gestimou.

Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe (valable 1 heure) :
${resetUrl}

Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.

Cordialement,
L'équipe Gestimou.`;

    await sendEmail(user.email, subject, body);
    res.json(genericResponse);
  } catch (err) {
    console.error('[forgotPassword]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};

// @desc    Reset password from a token (JSON, e.g. future in-app flow)
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    const result = await consumeResetToken(token, newPassword);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (err) {
    console.error('[resetPassword]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};

// ─── HTML page (opened from the emailed link) ───────────────────────────────

const pageShell = (bodyHtml) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gestimou - Réinitialisation du mot de passe</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#F3EFE6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; padding:24px; box-sizing:border-box; }
  .card { background:#fff; max-width:400px; width:100%; border-radius:20px; padding:32px 28px; box-shadow:0 8px 30px rgba(0,0,0,0.08); }
  h1 { font-size:22px; margin:0 0 8px; color:#0C1620; }
  p { color:#6B7280; font-size:14px; line-height:1.5; margin:0 0 20px; }
  label { display:block; font-size:13px; font-weight:600; color:#0C1620; margin-bottom:6px; }
  input { width:100%; box-sizing:border-box; padding:14px 16px; border-radius:14px; border:1.4px solid #D8D2C0;
          background:#ECE7DA; font-size:15px; margin-bottom:16px; }
  button { width:100%; padding:15px; border:none; border-radius:30px; background:#DB9200; color:#0C1620;
           font-weight:700; font-size:15px; cursor:pointer; }
  .error { background:rgba(224,54,79,0.10); border:1px solid rgba(224,54,79,0.3); color:#E0364F;
           padding:12px 14px; border-radius:12px; font-size:13px; margin-bottom:18px; }
  .success { color:#16A34A; font-weight:700; }
</style>
</head>
<body><div class="card">${bodyHtml}</div></body>
</html>`;

const resetForm = (token, error) => `
  <h1>Réinitialiser le mot de passe</h1>
  <p>Choisissez un nouveau mot de passe pour votre compte Gestimou.</p>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
  <form method="POST" action="/reset-password">
    <input type="hidden" name="token" value="${escapeHtml(token)}" />
    <label for="newPassword">Nouveau mot de passe</label>
    <input type="password" id="newPassword" name="newPassword" minlength="6" required />
    <label for="confirmPassword">Confirmer le mot de passe</label>
    <input type="password" id="confirmPassword" name="confirmPassword" minlength="6" required />
    <button type="submit">Changer le mot de passe</button>
  </form>`;

// @desc    Show the reset-password form
// @route   GET /reset-password
// @access  Public
exports.renderResetPage = (req, res) => {
  res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'none'");
  const token = String(req.query.token || '');
  if (!token) {
    return res.status(400).send(pageShell('<h1>Lien invalide</h1><p>Ce lien de réinitialisation est incomplet.</p>'));
  }
  res.send(pageShell(resetForm(token, null)));
};

// @desc    Handle the reset-password form submission
// @route   POST /reset-password
// @access  Public
exports.submitResetPage = async (req, res) => {
  res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'none'");
  const { token, newPassword, confirmPassword } = req.body || {};

  if (newPassword !== confirmPassword) {
    return res.status(400).send(pageShell(resetForm(token, 'Les mots de passe ne correspondent pas.')));
  }

  const result = await consumeResetToken(token, newPassword);
  if (!result.ok) {
    return res.status(400).send(pageShell(resetForm(token, result.error)));
  }

  res.send(pageShell(`
    <h1 class="success">Mot de passe modifié</h1>
    <p>Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter dans l'application Gestimou.</p>
  `));
};
