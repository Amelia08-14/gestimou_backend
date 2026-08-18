const { HouseholdMember } = require('../models');
const { saveImageDataUrl } = require('../utils/mediaUpload');

const ACCESS_LEVELS = new Set(['FULL', 'RESIDENT', 'VISITOR', 'CUSTOM']);

// @desc    List the household members of the logged-in resident
// @route   GET /api/household-members
// @access  Private (RESIDENT)
exports.getHouseholdMembers = async (req, res) => {
  try {
    const members = await HouseholdMember.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'ASC']],
    });
    res.json(members);
  } catch (err) {
    console.error('[HouseholdMember] list error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Add a household member
// @route   POST /api/household-members
// @access  Private (RESIDENT)
exports.addHouseholdMember = async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || '').trim();
    const relation = String(req.body?.relation || '').trim();
    let accessLevel = String(req.body?.accessLevel || 'RESIDENT').trim().toUpperCase();
    const phone = String(req.body?.phone || '').trim();
    const photoDataUrl = req.body?.photo;

    if (!fullName) return res.status(400).json({ error: 'Le nom est requis.' });
    if (!ACCESS_LEVELS.has(accessLevel)) accessLevel = 'RESIDENT';

    let photo = null;
    if (photoDataUrl) {
      photo = await saveImageDataUrl(photoDataUrl, 'household');
      if (!photo) return res.status(400).json({ error: 'Photo invalide.' });
    }

    const member = await HouseholdMember.create({
      userId: req.user.id,
      fullName,
      relation: relation || null,
      accessLevel,
      phone: phone || null,
      photo,
    });

    res.status(201).json(member);
  } catch (err) {
    console.error('[HouseholdMember] add error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Edit a household member
// @route   PUT /api/household-members/:id
// @access  Private (RESIDENT, owner only)
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
    if (req.body?.accessLevel !== undefined) {
      const accessLevel = String(req.body.accessLevel).trim().toUpperCase();
      if (ACCESS_LEVELS.has(accessLevel)) updates.accessLevel = accessLevel;
    }
    if (req.body?.photo) {
      const photo = await saveImageDataUrl(req.body.photo, 'household');
      if (!photo) return res.status(400).json({ error: 'Photo invalide.' });
      updates.photo = photo;
    }

    await member.update(updates);
    res.json(member);
  } catch (err) {
    console.error('[HouseholdMember] update error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Remove a household member
// @route   DELETE /api/household-members/:id
// @access  Private (RESIDENT, owner only)
exports.removeHouseholdMember = async (req, res) => {
  try {
    const member = await HouseholdMember.findByPk(req.params.id);
    if (!member || member.userId !== req.user.id) {
      return res.status(404).json({ error: 'Membre introuvable.' });
    }
    await member.destroy();
    res.json({ message: 'Membre supprimé.' });
  } catch (err) {
    console.error('[HouseholdMember] remove error:', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};
