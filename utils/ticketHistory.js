const { TicketHistory } = require('../models');

// Best-effort: the timeline must never make a ticket operation fail.
const recordTicketHistory = async ({ ticketId, action, fromStatus = null, toStatus = null, note = null, actor = null }) => {
  try {
    await TicketHistory.create({
      ticketId: String(ticketId),
      action,
      fromStatus,
      toStatus,
      note: note ? String(note) : null,
      actorUserId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      actorRole: actor?.role ?? null,
    });
  } catch (err) {
    console.warn('[TicketHistory] record failed:', err?.message);
  }
};

module.exports = { recordTicketHistory };
