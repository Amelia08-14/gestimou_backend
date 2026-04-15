const { generateAnnualChargesInternal } = require('../controllers/financialController');

const startAnnualChargesScheduler = () => {
  const enabled = String(process.env.ENABLE_CHARGES_SCHEDULER || '').toLowerCase();
  if (enabled !== 'true' && enabled !== '1') return;

  const intervalMsRaw = Number(process.env.CHARGES_SCHEDULER_INTERVAL_MS);
  const intervalMs = Number.isFinite(intervalMsRaw) && intervalMsRaw > 1000 ? intervalMsRaw : 6 * 60 * 60 * 1000;

  const tick = async () => {
    try {
      const now = new Date();
      await generateAnnualChargesInternal({ year: now.getFullYear(), now });
    } catch (e) {
      console.error('AnnualChargesScheduler error:', e?.message || e);
    }
  };

  setTimeout(tick, 3000);
  setInterval(tick, intervalMs);
  console.log('AnnualChargesScheduler enabled');
};

module.exports = { startAnnualChargesScheduler };

