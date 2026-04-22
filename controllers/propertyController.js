const { Property, Owner, Residence } = require('../models');

// @desc    Get all properties
// @route   GET /api/properties
// @access  Public
exports.getProperties = async (req, res) => {
  try {
    const include = [
      { model: Owner, as: 'owner', required: false },
      { model: Residence, required: false, attributes: ['id', 'name', 'zone'] }
    ];

    if (req.user?.role === 'RESIDENT') {
      include[0] = { model: Owner, as: 'owner', required: true, where: { email: req.user.email } };
    }

    if (req.user?.role === 'RESPONSABLE_ZONE') {
      const zone = String(req.user.zone || '').trim();
      if (zone && zone.toUpperCase() !== 'ALL') {
        include[1].where = { zone };
        include[1].required = true;
      }
    }

    const properties = await Property.findAll({
      include
    });
    res.json({ success: true, data: properties });
  } catch (err) {
    console.error('Error fetching properties:', err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Get single property
// @route   GET /api/properties/:id
// @access  Public
exports.getProperty = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id, {
      include: [
        { model: Owner, as: 'owner', required: false },
        { model: Residence, required: false, attributes: ['id', 'name', 'zone'] }
      ]
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    if (req.user?.role === 'RESIDENT') {
      const email = property.owner?.email;
      if (!email || email !== req.user.email) return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (req.user?.role === 'RESPONSABLE_ZONE') {
      const zone = String(req.user.zone || '').trim();
      if (zone && zone.toUpperCase() !== 'ALL') {
        const propertyZone = String(property.Residence?.zone || '').trim();
        if (!propertyZone || propertyZone !== zone) return res.status(403).json({ success: false, error: 'Forbidden' });
      }
    }

    res.json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Create new property
// @route   POST /api/properties
// @access  Private (Admin)
exports.createProperty = async (req, res) => {
  try {
    const property = await Property.create(req.body);
    res.status(201).json({ success: true, data: property });
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      const messages = err.errors.map(e => e.message);
      return res.status(400).json({ success: false, error: messages });
    }
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Update property
// @route   PUT /api/properties/:id
// @access  Private (Admin)
exports.updateProperty = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    await property.update(req.body);
    res.json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Delete property
// @route   DELETE /api/properties/:id
// @access  Private (Admin)
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    await property.destroy();
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
