const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  generateAnnualCharges,
  getMyChargesSummary,
  getMyCharges,
  getClientChargeStatus
} = require('../controllers/financialController');

router.post('/generate-charges', protect, authorizeRoles('ADMIN', 'RECOUVREMENT'), generateAnnualCharges);
router.get('/my-charges-summary', protect, authorizeRoles('RESIDENT'), getMyChargesSummary);
router.get('/my-charges', protect, authorizeRoles('RESIDENT'), getMyCharges);
router.get('/client-status', protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'RECOUVREMENT'), getClientChargeStatus);

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'RECOUVREMENT', 'GESTIONNAIRE_TAG'), getTransactions)
  .post(protect, authorizeRoles('ADMIN', 'RECOUVREMENT'), createTransaction);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN', 'RECOUVREMENT', 'GESTIONNAIRE_TAG'), getTransaction)
  .put(protect, authorizeRoles('ADMIN', 'RECOUVREMENT'), updateTransaction)
  .delete(protect, authorizeRoles('ADMIN', 'RECOUVREMENT'), deleteTransaction);

module.exports = router;
