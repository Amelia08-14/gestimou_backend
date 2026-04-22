const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  generateAnnualCharges
} = require('../controllers/financialController');

router.post('/generate-charges', protect, authorizeRoles('ADMIN', 'RECOUVREMENT'), generateAnnualCharges);

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'RECOUVREMENT'), getTransactions)
  .post(protect, authorizeRoles('ADMIN', 'RECOUVREMENT'), createTransaction);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN', 'RECOUVREMENT'), getTransaction)
  .put(protect, authorizeRoles('ADMIN', 'RECOUVREMENT'), updateTransaction)
  .delete(protect, authorizeRoles('ADMIN', 'RECOUVREMENT'), deleteTransaction);

module.exports = router;
