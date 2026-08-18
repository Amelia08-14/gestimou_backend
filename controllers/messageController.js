const { Message, MaintenanceTicket, User, Notification } = require('../models');
const { saveImageDataUrl } = require('../utils/mediaUpload');

const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'RESPONSABLE_ZONE', 'INTERVENANT']);
const isStaff = (user) => STAFF_ROLES.has(String(user?.role || ''));

const serialize = (m) => ({
  id: m.id,
  ticketId: m.ticketId,
  userId: m.userId,
  senderId: m.senderId,
  senderRole: m.senderRole,
  senderName: m.sender?.name || null,
  body: m.body,
  attachments: (() => {
    try { return m.attachments ? JSON.parse(m.attachments) : []; } catch (_) { return []; }
  })(),
  createdAt: m.createdAt,
});

const saveAttachments = async (list) => {
  if (!Array.isArray(list) || !list.length) return [];
  const saved = [];
  for (const item of list.slice(0, 6)) {
    const dataUrl = typeof item === 'string' ? item : item?.dataUrl;
    if (!dataUrl) continue;
    const url = await saveImageDataUrl(dataUrl, 'messages');
    if (url) saved.push({ url, type: 'image' });
  }
  return saved;
};

// ── Report Chat (attached to a maintenance ticket) ────────────────────────

// @desc    List messages for a maintenance ticket
// @route   GET /api/messages/ticket/:ticketId
exports.getTicketMessages = async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByPk(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable.' });

    const ownsTicket = String(ticket.email || '').toLowerCase() === String(req.user.email || '').toLowerCase();
    if (!ownsTicket && !isStaff(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const messages = await Message.findAll({
      where: { ticketId: ticket.id },
      include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'role'] }],
      order: [['createdAt', 'ASC']],
    });

    res.json(messages.map(serialize));
  } catch (err) {
    console.error('[Message] getTicketMessages error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Send a message on a maintenance ticket
// @route   POST /api/messages/ticket/:ticketId
exports.sendTicketMessage = async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByPk(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable.' });

    const ownsTicket = String(ticket.email || '').toLowerCase() === String(req.user.email || '').toLowerCase();
    if (!ownsTicket && !isStaff(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const body = String(req.body?.body || '').trim();
    const attachments = await saveAttachments(req.body?.attachments);
    if (!body && !attachments.length) return res.status(400).json({ error: 'Message vide.' });

    const threadOwner = ownsTicket
      ? req.user
      : (ticket.email ? await User.findOne({ where: { email: ticket.email } }) : null);
    if (!threadOwner) return res.status(400).json({ error: 'Résident introuvable pour ce ticket.' });

    const message = await Message.create({
      ticketId: ticket.id,
      userId: threadOwner.id,
      senderId: req.user.id,
      senderRole: req.user.role,
      body: body || null,
      attachments: attachments.length ? JSON.stringify(attachments) : null,
    });

    // Notify the other side
    if (ownsTicket) {
      // Resident wrote — notify staff assigned/responsible (best-effort, broad ADMIN/MANAGER ping)
      const staff = await User.findAll({ where: { role: 'ADMIN' }, attributes: ['id'] });
      for (const s of staff) {
        await Notification.create({
          userId: s.id,
          title: 'Nouveau message',
          message: `${req.user.name || req.user.email} a répondu sur le ticket #${ticket.id}.`,
          type: 'INFO',
        }).catch(() => null);
      }
    } else if (threadOwner) {
      await Notification.create({
        userId: threadOwner.id,
        title: 'Nouvelle réponse',
        message: `Une réponse a été ajoutée à votre signalement "${ticket.title}".`,
        type: 'INFO',
      }).catch(() => null);
    }

    const withSender = await Message.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'role'] }],
    });
    res.status(201).json(serialize(withSender));
  } catch (err) {
    console.error('[Message] sendTicketMessage error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// ── Admin chat (general thread between a resident and management) ────────

// @desc    List the logged-in resident's admin thread (or a given resident's, for staff)
// @route   GET /api/messages/admin?userId=123
exports.getAdminMessages = async (req, res) => {
  try {
    let targetUserId = req.user.id;
    if (isStaff(req.user) && req.query.userId) {
      targetUserId = Number(req.query.userId);
    }

    const messages = await Message.findAll({
      where: { ticketId: null, userId: targetUserId },
      include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'role'] }],
      order: [['createdAt', 'ASC']],
    });

    res.json(messages.map(serialize));
  } catch (err) {
    console.error('[Message] getAdminMessages error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Send a message in the admin thread
// @route   POST /api/messages/admin  { body, attachments, userId? (staff only) }
exports.sendAdminMessage = async (req, res) => {
  try {
    let targetUserId = req.user.id;
    if (isStaff(req.user) && req.body?.userId) {
      targetUserId = Number(req.body.userId);
    }

    const body = String(req.body?.body || '').trim();
    const attachments = await saveAttachments(req.body?.attachments);
    if (!body && !attachments.length) return res.status(400).json({ error: 'Message vide.' });

    const message = await Message.create({
      ticketId: null,
      userId: targetUserId,
      senderId: req.user.id,
      senderRole: req.user.role,
      body: body || null,
      attachments: attachments.length ? JSON.stringify(attachments) : null,
    });

    if (targetUserId === req.user.id) {
      const staff = await User.findAll({ where: { role: 'ADMIN' }, attributes: ['id'] });
      for (const s of staff) {
        await Notification.create({
          userId: s.id,
          title: 'Nouveau message résident',
          message: `${req.user.name || req.user.email} vous a envoyé un message.`,
          type: 'INFO',
        }).catch(() => null);
      }
    } else {
      await Notification.create({
        userId: targetUserId,
        title: 'Message de l\'administration',
        message: 'Vous avez reçu une nouvelle réponse de l\'administration.',
        type: 'INFO',
      }).catch(() => null);
    }

    const withSender = await Message.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'role'] }],
    });
    res.status(201).json(serialize(withSender));
  } catch (err) {
    console.error('[Message] sendAdminMessage error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};
