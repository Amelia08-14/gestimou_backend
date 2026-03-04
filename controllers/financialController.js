const { FinancialTransaction, Property, Residence, Owner } = require('../models');
const { Op } = require('sequelize');

// @desc    Get all transactions
// @route   GET /api/financial
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await FinancialTransaction.findAll({
      include: [
        { model: Residence, attributes: ['name'] },
        { 
          model: Property,
          as: 'property', // Explicit lowercase alias
          attributes: ['title', 'lotNumber'],
          include: [{ model: Owner, as: 'owner', attributes: ['firstName', 'lastName'] }]
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

// @desc    Generate monthly charges for all properties
// @route   POST /api/financial/generate-charges
exports.generateMonthlyCharges = async (req, res) => {
  try {
    const { month, year, amount } = req.body; // e.g., 3, 2026, 15000
    
    // Find all properties
    const properties = await Property.findAll();
    const createdCharges = [];
    
    for (const property of properties) {
        // Define date range for the specified month
        // month is 1-12
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month
        
        // Check if charge already exists
        const existing = await FinancialTransaction.findOne({
            where: {
                propertyId: property.id,
                type: 'Charge',
                date: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });
        
        if (!existing) {
            // Determine default amount based on property type or size if needed
            // For now use provided amount or default 15000
            const chargeAmount = amount || 15000;
            
            // Format description
            const monthName = new Date(year, month - 1, 1).toLocaleString('fr-FR', { month: 'long' });
            const description = `Charges Copropriété - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
            
            const charge = await FinancialTransaction.create({
                type: 'Charge',
                description: description,
                amount: chargeAmount,
                status: 'Impayé',
                date: new Date(year, month - 1, 5), // Due date 5th of month
                propertyId: property.id,
                residenceId: property.residenceId
            });
            createdCharges.push(charge);
        }
    }
    
    res.json({ 
        message: `Generated ${createdCharges.length} charges for ${properties.length} properties.`, 
        count: createdCharges.length 
    });
    
  } catch (err) {
    console.error(err);
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