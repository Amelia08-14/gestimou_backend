const { Op } = require('sequelize');
const { UserDevice } = require('../models');

// A resident account may be signed in on at most MAX_DEVICES phones.
const MAX_DEVICES = 3;

// A session lasts 30 days (see authController), so a device that has not been
// seen for that long no longer holds a valid session: it stops counting.
// Without this, every reinstall / "clear data" (new device id) or failed logout
// left a phantom device forever and the resident got locked out at "3/3".
const DEVICE_IDLE_DAYS = 30;

// `lastActive` is refreshed on use, but at most once per this delay per device.
const TOUCH_EVERY_MS = 10 * 60 * 1000;
const lastTouch = new Map();

// Registered devices of a user, once the idle ones have been released.
const listActiveDevices = async (userId) => {
  const cutoff = new Date(Date.now() - DEVICE_IDLE_DAYS * 24 * 60 * 60 * 1000);
  await UserDevice.destroy({ where: { userId, lastActive: { [Op.lt]: cutoff } } });
  return UserDevice.findAll({ where: { userId }, order: [['lastActive', 'DESC']] });
};

// Marks a device as seen. Fire-and-forget: never blocks or fails a request.
const touchDevice = (userId, deviceId) => {
  if (!userId || !deviceId) return;
  const key = `${userId}:${deviceId}`;
  const now = Date.now();
  if (now - (lastTouch.get(key) || 0) < TOUCH_EVERY_MS) return;
  lastTouch.set(key, now);
  UserDevice.update({ lastActive: new Date(now) }, { where: { userId, deviceId: String(deviceId) } })
    .catch((err) => console.error('[touchDevice]', err?.message));
};

module.exports = { MAX_DEVICES, DEVICE_IDLE_DAYS, listActiveDevices, touchDevice };
