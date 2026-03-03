const { Owner, Property } = require('../models');

// @desc    Get all owners
// @route   GET /api/owners
exports.getOwners = async (req, res) => {
  try {
    const owners = await Owner.findAll({
      include: [
        { model: Property }
      ],
      order: [['lastName', 'ASC']]
    });
    
    // Add propertiesCount virtual field for frontend compatibility
    const ownersWithCount = owners.map(owner => {
      const ownerJson = owner.toJSON();
      ownerJson.propertiesCount = owner.Properties ? owner.Properties.length : 0;
      return ownerJson;
    });

    res.json(ownersWithCount);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get single owner
// @route   GET /api/owners/:id
exports.getOwner = async (req, res) => {
  try {
    const owner = await Owner.findByPk(req.params.id, {
      include: [{ model: Property }]
    });
    
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    
    const ownerJson = owner.toJSON();
    ownerJson.propertiesCount = owner.Properties ? owner.Properties.length : 0;
    // Map properties key to match frontend expectation (lowercase) if needed
    ownerJson.properties = owner.Properties;

    res.json(ownerJson);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create owner
// @route   POST /api/owners
exports.createOwner = async (req, res) => {
  try {
    const owner = await Owner.create(req.body);
    res.status(201).json(owner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Update owner
// @route   PUT /api/owners/:id
exports.updateOwner = async (req, res) => {
  try {
    const owner = await Owner.findByPk(req.params.id);
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    await owner.update(req.body);
    res.json(owner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Delete owner
// @route   DELETE /api/owners/:id
exports.deleteOwner = async (req, res) => {
  try {
    const owner = await Owner.findByPk(req.params.id);
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    await owner.destroy();
    res.json({ message: 'Owner removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};