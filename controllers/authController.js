const { User, UserDevice } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { writeAuditLog } = require('../utils/auditLog');

// @desc    Auth user & get token
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password, deviceId, deviceName } = req.body;
    
    // Check if user exists
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    
    // Check password
    if (!user.password) {
         return res.status(401).json({ error: 'Compte non configuré' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // --- Device Management (For Residents) ---
    if (user.role === 'RESIDENT' && deviceId) {
        // Check if device is already registered
        let device = await UserDevice.findOne({ 
            where: { userId: user.id, deviceId } 
        });

        if (device) {
            // Update last active
            await device.update({ lastActive: new Date(), deviceName: deviceName || device.deviceName });
        } else {
            // Check limit (3 devices)
            const deviceCount = await UserDevice.count({ where: { userId: user.id } });
            if (deviceCount >= 3) {
                return res.status(403).json({ 
                    error: 'Limite d\'appareils atteinte (3/3). Veuillez contacter l\'administration pour réinitialiser vos appareils.' 
                });
            }

            // Register new device
            await UserDevice.create({
                userId: user.id,
                deviceId,
                deviceName: deviceName || 'Unknown Device'
            });
        }
    } else if (user.role === 'RESIDENT' && !deviceId) {
        // If it's a resident logging in without deviceId (e.g. from web, if allowed, or older app version)
        // Ideally we enforce deviceId for mobile app.
        // For now, let's allow web login without device check if they are resident? 
        // Or assume this is web login if no deviceId.
        // If the requirement "application mobile... seulement sur 03 appareils" applies to mobile app only.
    }
    
    // Generate Token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    await writeAuditLog({
      req,
      action: 'Connexion',
      details: `Connexion de ${user.email}`,
      user,
      meta: { role: user.role }
    });
    
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Mot de passe mis à jour avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
};
