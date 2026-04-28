const { FinancialTransaction, Property, Residence, Owner, User, Notification, Document } = require('../models');
const { Op } = require('sequelize');

const computeAnnualPeriod = (year) => {
  const periodStart = new Date(year, 0, 1);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(year, 11, 31);
  periodEnd.setHours(23, 59, 59, 999);
  const generationStart = new Date(periodEnd);
  generationStart.setMonth(generationStart.getMonth() - 3);
  generationStart.setHours(0, 0, 0, 0);
  return { periodStart, periodEnd, generationStart };
};

const generateAnnualChargesInternal = async ({ year, amount, force = false, now = new Date() } = {}) => {
  const safeYear = Number(year || now.getFullYear());
  const { periodStart, periodEnd, generationStart } = computeAnnualPeriod(safeYear);

  if (!force && now < generationStart) {
    return { skipped: true, reason: 'too_early', created: 0, notified: 0, year: safeYear };
  }

  const [properties, residences] = await Promise.all([
    Property.findAll({
      include: [{ model: Owner, as: 'owner', required: false, attributes: ['id', 'email', 'firstName', 'lastName'] }]
    }),
    Residence.findAll({ attributes: ['id', 'name', 'zone'] })
  ]);

  const residenceById = new Map(residences.map((r) => [r.id, r]));

  let created = 0;
  let notified = 0;

  for (const property of properties) {
    const existing = await FinancialTransaction.findOne({
      where: {
        propertyId: property.id,
        type: 'Charge',
        periodStart: { [Op.lte]: periodStart },
        periodEnd: { [Op.gte]: periodEnd }
      }
    });

    if (existing) continue;

    const monthlyAmount = Number(amount || property.price || 15000);
    const chargeAmount = monthlyAmount;
    const residence = residenceById.get(property.residenceId);
    const residenceName = residence?.name || property.residenceId || '';
    const description = `Charge gestion - Année ${safeYear}`;

    const charge = await FinancialTransaction.create({
      type: 'Charge',
      description,
      amount: chargeAmount,
      status: 'Impayé',
      date: now,
      periodStart,
      periodEnd,
      propertyId: property.id,
      residenceId: property.residenceId
    });

    created += 1;

    const ownerEmail = property.owner?.email;
    if (ownerEmail) {
      const user = await User.findOne({ where: { email: String(ownerEmail).toLowerCase() } });
      if (user) {
        await Notification.create({
          userId: user.id,
          title: 'Charge annuelle',
          message: `Votre charge annuelle ${safeYear} a été générée pour ${residenceName} (${property.title}). Montant: ${monthlyAmount} DA/mois. Échéance: ${periodEnd.toLocaleDateString('fr-FR')}.`,
          type: 'WARNING'
        });
        notified += 1;
      }
    }

    if (force && charge) {
      continue;
    }
  }

  return { skipped: false, created, notified, year: safeYear };
};

// @desc    Get resident charges summary (due date + notifications)
// @route   GET /api/financial/my-charges-summary
exports.getMyChargesSummary = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Not authorized' });
    if (user.role !== 'RESIDENT') return res.status(403).json({ error: 'Forbidden' });

    const props = await Property.findAll({
      attributes: ['id', 'price'],
      include: [{ model: Owner, as: 'owner', required: true, where: { email: String(user.email).toLowerCase() }, attributes: ['id', 'email'] }]
    });
    const propertyIds = props.map((p) => p.id);
    if (propertyIds.length === 0) {
      return res.json({ status: 'Actif', nextPaymentDate: null, annualAmount: 15000 * 12, daysRemaining: null });
    }

    const charges = await FinancialTransaction.findAll({
      where: { type: 'Charge', propertyId: { [Op.in]: propertyIds } },
      order: [['periodEnd', 'ASC']]
    });

    const now = new Date();
    let nextUnpaid = null;
    let latestPaidEnd = null;

    for (const c of charges) {
      const end = c.periodEnd ? new Date(c.periodEnd) : null;
      if (!end || Number.isNaN(end.getTime())) continue;
      if (String(c.status || '') === 'Payé') {
        if (!latestPaidEnd || end > latestPaidEnd) latestPaidEnd = end;
        continue;
      }
      if (!nextUnpaid || end < nextUnpaid) nextUnpaid = end;
    }

    const due = nextUnpaid || latestPaidEnd;
    if (!due) {
      return res.json({ status: 'Actif', nextPaymentDate: null, annualAmount: 15000 * 12, daysRemaining: null });
    }

    const msLeft = due.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    const shouldWarn = daysRemaining <= 90 && daysRemaining > 10;
    const shouldUrgent = daysRemaining <= 10 && daysRemaining >= 0;

    if (shouldWarn || shouldUrgent) {
      const title = shouldUrgent ? 'Paiement urgent' : 'Paiement à venir';
      const type = shouldUrgent ? 'ERROR' : 'WARNING';
      const dateLabel = due.toLocaleDateString('fr-FR');
      const message = shouldUrgent
        ? `Important et urgent ; votre paiement doit se faire avant le : ${dateLabel}`
        : `Votre paiement approche. Date prévue : ${dateLabel}`;

      const recent = await Notification.findOne({
        where: {
          userId: user.id,
          title,
          createdAt: { [Op.gte]: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
        },
        order: [['createdAt', 'DESC']]
      });

      if (!recent) {
        await Notification.create({ userId: user.id, title, message, type });
      }
    }

    res.json({
      status: 'Actif',
      nextPaymentDate: due.toISOString(),
      annualAmount: 15000 * 12,
      daysRemaining
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Get all transactions
// @route   GET /api/financial
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await FinancialTransaction.findAll({
      include: [
        { model: Residence, attributes: ['id', 'name', 'zone'] },
        { 
          model: Property,
          as: 'property',
          attributes: ['id', 'title', 'lotNumber', 'block', 'floor', 'status'],
          include: [{ model: Owner, as: 'owner', attributes: ['firstName', 'lastName'] }]
        },
        {
          model: Document,
          as: 'document',
          attributes: ['id', 'name', 'category', 'type', 'size', 'url', 'createdAt']
        }
      ],
      order: [['date', 'DESC']]
    });
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Generate annual charges for all properties (3 months before deadline)
// @route   POST /api/financial/generate-charges
exports.generateAnnualCharges = async (req, res) => {
  try {
    const { year, amount, force } = req.body || {};
    const result = await generateAnnualChargesInternal({ year, amount, force: Boolean(force), now: new Date() });
    if (result.skipped) {
      return res.json({ message: `Trop tôt pour générer les charges annuelles ${result.year}.`, ...result });
    }

    res.json({
      message: `Charges annuelles générées: ${result.created}. Notifications: ${result.notified}.`,
      ...result
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.generateMonthlyCharges = exports.generateAnnualCharges;
exports.generateAnnualChargesInternal = generateAnnualChargesInternal;

// @desc    Get single transaction
// @route   GET /api/financial/:id
exports.getTransaction = async (req, res) => {
  try {
    const transaction = await FinancialTransaction.findByPk(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Create transaction
// @route   POST /api/financial
exports.createTransaction = async (req, res) => {
  try {
    const transaction = await FinancialTransaction.create(req.body);
    res.status(201).json(transaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Update transaction
// @route   PUT /api/financial/:id
exports.updateTransaction = async (req, res) => {
  try {
    const transaction = await FinancialTransaction.findByPk(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    await transaction.update(req.body);
    res.json(transaction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// @desc    Delete transaction
// @route   DELETE /api/financial/:id
exports.deleteTransaction = async (req, res) => {
  try {
    const transaction = await FinancialTransaction.findByPk(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    await transaction.destroy();
    res.json({ message: 'Transaction removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};
