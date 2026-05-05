const { Subcontractor } = require('../models');

// @desc    List subcontractors
// @route   GET /api/subcontractors
exports.getSubcontractors = async (req, res) => {
  try {
    const rows = await Subcontractor.findAll({ order: [['name', 'ASC']] });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

