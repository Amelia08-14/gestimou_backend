const { FinancialTransaction } = require('../models');

// @desc    Get all transactions
// @route   GET /api/financial
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await FinancialTransaction.findAll({
      order: [['date', 'DESC']]
    });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

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