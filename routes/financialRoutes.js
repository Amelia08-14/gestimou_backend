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

router.post('/generate-charges', protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'RECOUVREMENT'), generateAnnualCharges);

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'RECOUVREMENT'), getTransactions)
  .post(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'RECOUVREMENT'), createTransaction);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'RECOUVREMENT'), getTransaction)
  .put(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'RECOUVREMENT'), updateTransaction)
  .delete(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'RECOUVREMENT'), deleteTransaction);

module.exports = router;
