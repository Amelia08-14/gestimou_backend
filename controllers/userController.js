const { User } = require('../models');
const bcrypt = require('bcryptjs');
const { writeAuditLog } = require('../utils/auditLog');

// @desc    Get all users
// @route   GET /api/users
exports.getUsers = async (req, res) => {
  try {
    const where = {};
    const role = String(req.query.role || '').trim();
    if (role) where.role = role;

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
exports.getUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create user
// @route   POST /api/users
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, profession, zone } = req.body;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      profession,
      zone
    });
    
    // Don't return password
    const userJson = user.toJSON();
    delete userJson.password;
    
    res.status(201).json(userJson);

    await writeAuditLog({
      req,
      action: 'Création utilisateur',
      details: `Utilisateur créé: ${user.email} (${user.role})`,
      user: req.user,
      meta: { createdUserId: user.id }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const before = { name: user.name, email: user.email, role: user.role, profession: user.profession, zone: user.zone };
    const { password, ...rest } = req.body;
    
    if (password) {
      rest.password = await bcrypt.hash(password, 10);
    }
    
    await user.update(rest);
    
    const userJson = user.toJSON();
    delete userJson.password;
    
    res.json(userJson);

    const after = { name: user.name, email: user.email, role: user.role, profession: user.profession, zone: user.zone };
    await writeAuditLog({
      req,
      action: 'Mise à jour utilisateur',
      details: `Utilisateur mis à jour: ${user.email}`,
      user: req.user,
      meta: { updatedUserId: user.id, before, after }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const meta = { deletedUserId: user.id, email: user.email, role: user.role };
    await user.destroy();
    res.json({ message: 'User removed' });

    await writeAuditLog({
      req,
      action: 'Suppression utilisateur',
      details: `Utilisateur supprimé: ${meta.email}`,
      user: req.user,
      meta
    });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};
