const { Op } = require('sequelize');
const { Message, MaintenanceTicket, User, Notification } = require('../models');
const { recordTicketHistory } = require('../utils/ticketHistory');
const { saveImageDataUrl } = require('../utils/mediaUpload');
const { getEffectiveResidentEmail, getEffectiveResidentUser, getHouseholdUserIds } = require('../utils/residentScope');

const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'RESPONSABLE_ZONE', 'INTERVENANT']);
const isStaff = (user) => STAFF_ROLES.has(String(user?.role || ''));

const serialize = (m) => ({
  id: m.id,
  ticketId: m.ticketId,
  userId: m.userId,
  senderId: m.senderId,
  senderRole: m.senderRole,
  senderName: m.sender?.name || null,
  kind: m.kind || 'CHAT',
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

// Notifies everybody living in the resident's unit (primary resident + household accounts).
const notifyHousehold = async (residentUser, { title, message }) => {
  const ids = await getHouseholdUserIds(residentUser);
  const text = String(message).slice(0, 250);
  for (const userId of ids) {
    await Notification.create({ userId, title, message: text, type: 'INFO' }).catch(() => null);
  }
};

const preview = (text, max = 120) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

// ── Report Chat (attached to a maintenance ticket) ────────────────────────

// @desc    List messages for a maintenance ticket
// @route   GET /api/messages/ticket/:ticketId
exports.getTicketMessages = async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByPk(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable.' });

    const ownsTicket = req.user.role === 'RESIDENT' &&
      String(ticket.email || '').toLowerCase() === await getEffectiveResidentEmail(req.user);
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

    const ownsTicket = req.user.role === 'RESIDENT' &&
      String(ticket.email || '').toLowerCase() === await getEffectiveResidentEmail(req.user);
    if (!ownsTicket && !isStaff(req.user)) return res.status(403).json({ error: 'Forbidden' });

    // A resident can only reply: the conversation opens once someone from the
    // administration/staff has written on this ticket (chat message or information).
    if (ownsTicket) {
      const staffMessages = await Message.count({
        where: { ticketId: ticket.id, senderRole: { [Op.ne]: 'RESIDENT' } },
      });
      if (!staffMessages) {
        return res.status(403).json({
          error: "Vous pourrez écrire dès que l'administration vous aura envoyé un message.",
          code: 'CHAT_LOCKED',
        });
      }
    }

    const body = String(req.body?.body || '').trim();
    const attachments = await saveAttachments(req.body?.attachments);
    if (!body && !attachments.length) return res.status(400).json({ error: 'Message vide.' });

    // Threads always belong to the primary resident, even when a household
    // member writes, so chat history survives the member's account removal.
    const threadOwner = ownsTicket
      ? await getEffectiveResidentUser(req.user)
      : (ticket.email ? await User.findOne({ where: { email: ticket.email } }) : null);
    if (!threadOwner) return res.status(400).json({ error: 'Résident introuvable pour ce ticket.' });

    const message = await Message.create({
      ticketId: ticket.id,
      userId: threadOwner.id,
      senderId: req.user.id,
      senderRole: req.user.role,
      kind: 'CHAT',
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
      await notifyHousehold(threadOwner, {
        title: 'Nouvelle réponse',
        message: `Nouveau message sur votre signalement "${ticket.title}"${body ? ` : ${preview(body)}` : '.'}`,
      });
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


// ── Information messages (administration -> resident, per ticket) ─────────

const INFO_ROLES = new Set(['ADMIN', 'MANAGER', 'RESPONSABLE_ZONE']);

// @desc    Post an information message on a ticket (e.g. a manager has to intervene)
// @route   POST /api/messages/ticket/:ticketId/info
// @access  ADMIN, MANAGER, RESPONSABLE_ZONE
exports.sendTicketInfo = async (req, res) => {
  try {
    if (!INFO_ROLES.has(String(req.user?.role || ''))) return res.status(403).json({ error: 'Forbidden' });

    const ticket = await MaintenanceTicket.findByPk(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable.' });

    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Message vide.' });
    if (body.length > 1000) return res.status(400).json({ error: 'Message trop long (1000 caractères maximum).' });

    const resident = ticket.email ? await User.findOne({ where: { email: String(ticket.email).toLowerCase() } }) : null;
    if (!resident) return res.status(400).json({ error: 'Résident introuvable pour ce ticket.' });

    const message = await Message.create({
      ticketId: ticket.id,
      userId: resident.id,
      senderId: req.user.id,
      senderRole: req.user.role,
      kind: 'INFO',
      body,
    });

    await recordTicketHistory({ ticketId: ticket.id, action: 'INFO_MESSAGE', note: body, actor: req.user });

    await notifyHousehold(resident, {
      title: 'Information sur votre signalement',
      message: `Information sur "${ticket.title}" : ${preview(body)}`,
    });

    const withSender = await Message.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'role'] }],
    });
    res.status(201).json(serialize(withSender));
  } catch (err) {
    console.error('[Message] sendTicketInfo error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};
