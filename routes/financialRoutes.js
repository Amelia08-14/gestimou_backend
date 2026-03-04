const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  generateMonthlyCharges
} = require('../controllers/financialController');

console.log('Loading financial routes...');

router.post('/generate-charges', (req, res, next) => {
    console.log('Hit /generate-charges');
    next();
}, generateMonthlyCharges);

router.route('/')
  .get(getTransactions)
  .post(createTransaction);

router.route('/:id')
  .get(getTransaction)
  .put(updateTransaction)
  .delete(deleteTransaction);

module.exports = router;
