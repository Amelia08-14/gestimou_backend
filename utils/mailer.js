const nodemailer = require('nodemailer');

let cachedTransporter = null;
let cachedKey = null;

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const tlsRejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';

  const key = `${host}|${port}|${secure}|${user}|${tlsRejectUnauthorized}`;
  if (cachedTransporter && cachedKey === key) return cachedTransporter;

  cachedKey = key;
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: tlsRejectUnauthorized },
  });
  return cachedTransporter;
};

// Best-effort plain-text mail through the Brevo SMTP relay configured in .env.
// Resolves to true when sent, false when SMTP isn't configured or the send failed.
const sendEmail = async (to, subject, text) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return false;
  }

  try {
    const fromEmail = process.env.MAIL_FROM || process.env.SMTP_USER;
    const fromName = process.env.MAIL_FROM_NAME || 'GESTIMOU Support';
    const replyTo = process.env.MAIL_REPLY_TO || fromEmail;
    const envelopeFrom = process.env.MAIL_ENVELOPE_FROM || fromEmail;

    await getTransporter().sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
      replyTo,
      envelope: { from: envelopeFrom, to },
    });
    return true;
  } catch (err) {
    console.warn('[mailer] send failed:', err?.message);
    return false;
  }
};

module.exports = { sendEmail };
