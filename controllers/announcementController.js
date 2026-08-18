const { Op } = require('sequelize');
const { Announcement, AnnouncementRead, Owner, User, Residence } = require('../models');

const STAFF_ROLES = new Set(['ADMIN', 'RESPONSABLE_ZONE', 'MANAGER']);
const isStaff = (user) => STAFF_ROLES.has(String(user?.role || ''));

const parseBlocks = (blocks) =>
  String(blocks || '')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);

// Auto-promote SCHEDULED -> PUBLISHED once due, and PUBLISHED -> EXPIRED
// once past expiresAt. Cheap lazy evaluation, no cron required.
const settleStatus = async (announcement) => {
  const now = new Date();
  let next = announcement.status;
  if (next === 'SCHEDULED' && announcement.publishAt && new Date(announcement.publishAt) <= now) {
    next = 'PUBLISHED';
  }
  if (next === 'PUBLISHED' && announcement.expiresAt && new Date(announcement.expiresAt) <= now) {
    next = 'EXPIRED';
  }
  if (next !== announcement.status) {
    await announcement.update({ status: next });
  }
  return announcement;
};

// Count residents (Owners with a matching User account) targeted by this announcement.
const audienceCount = async (announcement) => {
  const where = {};
  if (announcement.residenceId) where.residenceId = announcement.residenceId;
  const owners = await Owner.findAll({ where, attributes: ['email', 'block'] });
  const blocks = parseBlocks(announcement.blocks);
  const targeted = owners.filter((o) => !blocks.length || blocks.includes(String(o.block || '').trim()));
  if (!targeted.length) return 0;
  const emails = targeted.map((o) => String(o.email || '').toLowerCase()).filter(Boolean);
  if (!emails.length) return 0;
  const count = await User.count({ where: { email: { [Op.in]: emails } } });
  return count;
};

// @desc    List announcements (admin/staff) with type/status/search filters
// @route   GET /api/announcements/manage
exports.getAnnouncementsForStaff = async (req, res) => {
  try {
    if (!isStaff(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const { category, status, q } = req.query;
    const where = {};
    if (category) where.category = String(category).toUpperCase();
    if (status) where.status = String(status).toUpperCase();
    if (q) where.title = { [Op.like]: `%${q}%` };

    let announcements = await Announcement.findAll({
      where,
      include: [{ model: Residence, as: 'residence', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });

    announcements = await Promise.all(announcements.map(settleStatus));

    const withStats = await Promise.all(
      announcements.map(async (a) => {
        const total = await audienceCount(a);
        const readCount = await AnnouncementRead.count({ where: { announcementId: a.id } });
        return {
          id: a.id,
          title: a.title,
          body: a.body,
          category: a.category,
          status: a.status,
          residenceId: a.residenceId,
          residenceName: a.residence?.name || null,
          blocks: a.blocks,
          publishAt: a.publishAt,
          expiresAt: a.expiresAt,
          createdAt: a.createdAt,
          readCount,
          audienceCount: total,
        };
      })
    );

    res.json(withStats);
  } catch (err) {
    console.error('[Announcement] getAnnouncementsForStaff error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create an announcement
// @route   POST /api/announcements
exports.createAnnouncement = async (req, res) => {
  try {
    if (!isStaff(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!title || !body) return res.status(400).json({ error: 'Titre et contenu requis.' });

    const category = ['URGENT', 'INFO', 'EVENT'].includes(String(req.body?.category).toUpperCase())
      ? String(req.body.category).toUpperCase()
      : 'INFO';
    const status = ['DRAFT', 'SCHEDULED', 'PUBLISHED'].includes(String(req.body?.status).toUpperCase())
      ? String(req.body.status).toUpperCase()
      : 'DRAFT';

    const announcement = await Announcement.create({
      title,
      body,
      category,
      status,
      residenceId: req.body?.residenceId ? String(req.body.residenceId) : null,
      blocks: req.body?.blocks ? String(req.body.blocks).trim() : null,
      publishAt: req.body?.publishAt ? new Date(req.body.publishAt) : (status === 'PUBLISHED' ? new Date() : null),
      expiresAt: req.body?.expiresAt ? new Date(req.body.expiresAt) : null,
      createdByUserId: req.user.id,
    });

    res.status(201).json(announcement);
  } catch (err) {
    console.error('[Announcement] createAnnouncement error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update an announcement
// @route   PUT /api/announcements/:id
exports.updateAnnouncement = async (req, res) => {
  try {
    if (!isStaff(req.user)) return res.status(403).json({ error: 'Forbidden' });
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Avis introuvable.' });

    const updates = {};
    if (req.body?.title !== undefined) updates.title = String(req.body.title).trim();
    if (req.body?.body !== undefined) updates.body = String(req.body.body).trim();
    if (req.body?.category !== undefined) {
      const c = String(req.body.category).toUpperCase();
      if (['URGENT', 'INFO', 'EVENT'].includes(c)) updates.category = c;
    }
    if (req.body?.status !== undefined) {
      const s = String(req.body.status).toUpperCase();
      if (['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED'].includes(s)) {
        updates.status = s;
        if (s === 'PUBLISHED' && !announcement.publishAt) updates.publishAt = new Date();
      }
    }
    if (req.body?.residenceId !== undefined) updates.residenceId = req.body.residenceId ? String(req.body.residenceId) : null;
    if (req.body?.blocks !== undefined) updates.blocks = req.body.blocks ? String(req.body.blocks).trim() : null;
    if (req.body?.publishAt !== undefined) updates.publishAt = req.body.publishAt ? new Date(req.body.publishAt) : null;
    if (req.body?.expiresAt !== undefined) updates.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;

    await announcement.update(updates);
    res.json(announcement);
  } catch (err) {
    console.error('[Announcement] updateAnnouncement error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Delete an announcement
// @route   DELETE /api/announcements/:id
exports.deleteAnnouncement = async (req, res) => {
  try {
    if (!isStaff(req.user)) return res.status(403).json({ error: 'Forbidden' });
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Avis introuvable.' });
    await AnnouncementRead.destroy({ where: { announcementId: announcement.id } });
    await announcement.destroy();
    res.json({ message: 'Avis supprimé.' });
  } catch (err) {
    console.error('[Announcement] deleteAnnouncement error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// ── Resident-facing (mobile "Notices") ─────────────────────────────────────

// @desc    List published announcements visible to the logged-in resident
// @route   GET /api/announcements
exports.getMyAnnouncements = async (req, res) => {
  try {
    const owner = await Owner.findOne({ where: { email: req.user.email } });

    const where = {
      status: { [Op.in]: ['PUBLISHED', 'SCHEDULED'] },
      [Op.or]: [{ residenceId: null }, { residenceId: owner?.residenceId || '__none__' }],
    };

    let announcements = await Announcement.findAll({ where, order: [['publishAt', 'DESC'], ['createdAt', 'DESC']] });
    announcements = await Promise.all(announcements.map(settleStatus));
    announcements = announcements.filter((a) => a.status === 'PUBLISHED');

    const ownerBlock = String(owner?.block || '').trim();
    announcements = announcements.filter((a) => {
      const blocks = parseBlocks(a.blocks);
      return !blocks.length || (ownerBlock && blocks.includes(ownerBlock));
    });

    const readRows = await AnnouncementRead.findAll({
      where: { userId: req.user.id, announcementId: { [Op.in]: announcements.map((a) => a.id) } },
    });
    const readIds = new Set(readRows.map((r) => r.announcementId));

    res.json(
      announcements.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        category: a.category,
        publishAt: a.publishAt,
        createdAt: a.createdAt,
        isRead: readIds.has(a.id),
      }))
    );
  } catch (err) {
    console.error('[Announcement] getMyAnnouncements error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Mark an announcement as read
// @route   POST /api/announcements/:id/read
exports.markAnnouncementRead = async (req, res) => {
  try {
    const announcementId = Number(req.params.id);
    const [row] = await AnnouncementRead.findOrCreate({
      where: { announcementId, userId: req.user.id },
      defaults: { readAt: new Date() },
    });
    res.json({ ok: true, id: row.id });
  } catch (err) {
    console.error('[Announcement] markAnnouncementRead error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};
