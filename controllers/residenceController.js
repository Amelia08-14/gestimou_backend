const { Residence, Property } = require('../models');

// @desc    Get all residences
// @route   GET /api/residences
exports.getResidences = async (req, res) => {
  try {
    const where = {};
    
    // Role-based filtering
    if (req.user) {
        if (req.user.role === 'RESPONSABLE_ZONE') {
            if (req.user.zone) {
                where.zone = req.user.zone;
            } else {
                where.zone = 'Unassigned';
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