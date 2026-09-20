const { User, UserDevice } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { writeAuditLog } = require('../utils/auditLog');
const { saveImageDataUrl, removeUploadedImage } = require('../utils/mediaUpload');

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  profession: user.profession,
  zone: user.zone,
  photo: user.photo || null,
  isHouseholdMember: !!user.householdOwnerId,
  mustChangePassword: !!user.mustChangePassword,
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password, deviceId, deviceName } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    
    // Check if user exists
    const user = await User.findOne({ where: { email: normalizedEmail } });
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

    if (user.isActive === false) {
      return res.status(403).json({
        error: "Ce compte a été désactivé. Veuillez contacter l'administration.",
        code: 'ACCOUNT_DISABLED',
      });
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
      details: `Connexion de ${normalizedEmail}`,
      user,
      meta: { role: user.role }
    });
    
    res.json({ ...publicUser(user), token });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get current user (me)
// @route   GET /api/auth/me
exports.me = async (req, res) => {
  res.json(publicUser(req.user));
};

// @desc    Set or replace the profile picture (optional, base64 data URL)
// @route   PUT /api/auth/photo
exports.updatePhoto = async (req, res) => {
  try {
    const photo = await saveImageDataUrl(req.body?.photo, 'avatars', { maxBytes: AVATAR_MAX_BYTES });
    if (!photo) {
      return res.status(400).json({ error: 'Photo invalide (JPG, PNG ou WebP, 5 Mo maximum).' });
    }

    const user = await User.findByPk(req.user.id);
    const previous = user.photo;
    await user.update({ photo });
    if (previous) removeUploadedImage(previous, 'avatars');

    res.json(publicUser(user));
  } catch (err) {
    console.error('[updatePhoto]', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Remove the profile picture
// @route   DELETE /api/auth/photo
exports.removePhoto = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const previous = user.photo;
    await user.update({ photo: null });
    if (previous) removeUploadedImage(previous, 'avatars');

    res.json(publicUser(user));
  } catch (err) {
    console.error('[removePhoto]', err?.message);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Logout - remove current device from UserDevice table
// @route   POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const { deviceId } = req.body || {};
    if (req.user && deviceId) {
      await UserDevice.destroy({ where: { userId: req.user.id, deviceId: String(deviceId) } });
    }
    res.json({ message: 'Déconnecté.' });
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
    user.mustChangePassword = false;
    await user.save();

    await writeAuditLog({
      req,
      action: 'Changement mot de passe',
      details: `Mot de passe modifié: ${user.email}`,
      user
    });

    res.json({ message: 'Mot de passe mis à jour avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
};
