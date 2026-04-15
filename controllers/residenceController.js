const { Residence, Property } = require('../models');
const fs = require('fs');
const path = require('path');

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const parseDataUrl = (dataUrl) => {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const base64Data = match[2];
  return { mimeType, base64Data };
};

const extFromMimeType = (mimeType) => {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return null;
};

// @desc    Get all residences
// @route   GET /api/residences
exports.getResidences = async (req, res) => {
  try {
    const where = {};
    
    // Role-based filtering
    if (req.user) {
        if (req.user.role === 'RESPONSABLE_ZONE') {
            const zone = String(req.user.zone || '').trim();
            if (!zone) {
              where.zone = 'Unassigned';
            } else if (zone.toUpperCase() !== 'ALL') {
              where.zone = zone;
            }
        }
    } else {
        // Public request (e.g. from registration form)
        // Allow fetching list but maybe only IDs and Names?
        // For now allow all for the dropdown.
    }

    const residences = await Residence.findAll({
      where,
      include: req.user ? [{ model: Property }] : [] // Only include properties for authenticated staff
    });
    res.json(residences);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get single residence
// @route   GET /api/residences/:id
exports.getResidence = async (req, res) => {
  try {
    const residence = await Residence.findByPk(req.params.id, {
      include: [{ model: Property }]
    });
    if (!residence) return res.status(404).json({ error: 'Residence not found' });
    res.json(residence);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create residence
// @route   POST /api/residences
exports.createResidence = async (req, res) => {
  try {
    const residence = await Residence.create(req.body);
    res.status(201).json(residence);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Update residence
// @route   PUT /api/residences/:id
exports.updateResidence = async (req, res) => {
  try {
    const residence = await Residence.findByPk(req.params.id);
    if (!residence) return res.status(404).json({ error: 'Residence not found' });
    await residence.update(req.body);
    res.json(residence);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Delete residence
// @route   DELETE /api/residences/:id
exports.deleteResidence = async (req, res) => {
  try {
    const residence = await Residence.findByPk(req.params.id);
    if (!residence) return res.status(404).json({ error: 'Residence not found' });
    await residence.destroy();
    res.json({ message: 'Residence removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Upload residence logo or cover image
// @route   POST /api/residences/:id/upload
exports.uploadResidenceMedia = async (req, res) => {
  try {
    const residence = await Residence.findByPk(req.params.id);
    if (!residence) return res.status(404).json({ error: 'Residence not found' });

    const { type, dataUrl } = req.body || {};
    if (type !== 'logo' && type !== 'image') {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    if (!allowedMimeTypes.has(parsed.mimeType)) {
      return res.status(400).json({ error: 'Unsupported image type' });
    }

    const ext = extFromMimeType(parsed.mimeType);
    if (!ext) {
      return res.status(400).json({ error: 'Unsupported image type' });
    }

    const buffer = Buffer.from(parsed.base64Data, 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 5MB)' });
    }

    const uploadsDir = path.join(__dirname, '..', 'uploads', 'residences');
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const filename = `${residence.id}-${type}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const publicPath = `/uploads/residences/${filename}`;
    await residence.update({ [type]: publicPath });

    res.json({ url: publicPath });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};
