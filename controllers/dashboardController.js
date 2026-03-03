const { Residence, MaintenanceTicket, FinancialTransaction, Owner } = require('../models');
const { Op } = require('sequelize');

// @desc    Get dashboard stats
// @route   GET /api/dashboard
// @access  Public (for now)
exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Stats Cards
    const totalResidences = await Residence.count();
    
    const ticketsCount = await MaintenanceTicket.count({
      where: { status: { [Op.not]: 'Terminé' } }
    });

    // Occupancy Rate
    const residences = await Residence.findAll({
      attributes: ['totalUnits', 'deliveredUnits']
    });
    
    let totalDelivered = 0;
    let totalUnits = 0;
    residences.forEach(r => {
      totalDelivered += r.deliveredUnits || 0;
      totalUnits += r.totalUnits || 0;
    });
    
    const occupancyRate = totalUnits > 0 
      ? Math.round((totalDelivered / totalUnits) * 100) + '%' 
      : '0%';

    // Monthly Revenue (Current Month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);
    
    const monthlyRevenueSum = await FinancialTransaction.sum('amount', {
      where: { 
        type: 'Charge', 
        date: { [Op.gte]: startOfMonth } 
      }
    });
    
    const monthlyRevenue = (monthlyRevenueSum ? Number(monthlyRevenueSum).toLocaleString() : '0') + ' DA';

    const stats = {
      totalResidences,
      occupancyRate,
      ticketsCount,
      monthlyRevenue
    };

    // 2. Revenue Data (Last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    
    const transactions = await FinancialTransaction.findAll({
      where: { 
        type: 'Charge',
        date: { [Op.gte]: sixMonthsAgo }
      },
      include: [{ model: Residence, attributes: ['name'] }],
      order: [['date', 'ASC']]
    });

    const revenueMap = new Map();
    
    transactions.forEach(t => {
      const month = t.date.toLocaleString('default', { month: 'short' });
      if (!revenueMap.has(month)) {
        revenueMap.set(month, { name: month });
      }
      const entry = revenueMap.get(month);
      const resName = t.Residence ? t.Residence.name : 'Inconnu';
      entry[resName] = (entry[resName] || 0) + Number(t.amount);
    });
    
    const revenueData = Array.from(revenueMap.values());

    // 3. Weekly Activity
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    
    const weekTickets = await MaintenanceTicket.findAll({
      where: { createdAt: { [Op.gte]: sevenDaysAgo } }
    });
    
    const weekPayments = await FinancialTransaction.findAll({
      where: { type: 'Charge', date: { [Op.gte]: sevenDaysAgo } }
    });

    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const weeklyActivity = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = days[d.getDay()];
      
      let ticketCount = 0;
      let paymentCount = 0;
      
      weekTickets.forEach(t => {
        if (t.createdAt.toISOString().split('T')[0] === dateStr) ticketCount++;
      });
      
      weekPayments.forEach(p => {
        if (p.date.toISOString().split('T')[0] === dateStr) paymentCount++;
      });

      weeklyActivity.push({
        date: dateStr,
        name: dayName,
        tickets: ticketCount,
        payments: paymentCount
      });
    }

    // 4. Recent Activities
    const recentTickets = await MaintenanceTicket.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [{ model: Residence, attributes: ['name'] }]
    });
    
    const recentTransactions = await FinancialTransaction.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Residence, attributes: ['name'] },
        // { model: Property, include: [Owner] } // Property/Owner relation might be complex depending on seed
      ]
    });
    
    const recentOwners = await Owner.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']]
    });

    const activities = [
      ...recentTickets.map(t => ({
        type: 'warning',
        user: t.requester,
        action: `A signalé: ${t.title}`,
        time: t.createdAt.toLocaleDateString('fr-FR'),
        amount: t.status,
        date: t.createdAt
      })),
      ...recentTransactions.map(t => ({
        type: t.type === 'Charge' ? 'success' : 'neutral',
        user: 'Système', // Simplify for now
        action: t.description,
        time: t.date.toLocaleDateString('fr-FR'),
        amount: Number(t.amount).toLocaleString() + ' DA',
        date: t.createdAt
      })),
      ...recentOwners.map(o => ({
        type: 'info',
        user: o.createdBy || 'Admin',
        action: `A ajouté un propriétaire: ${o.lastName}`,
        time: o.createdAt.toLocaleDateString('fr-FR'),
        amount: 'Nouveau',
        date: o.createdAt
      }))
    ].sort((a, b) => b.date - a.date).slice(0, 20);

    res.json({
      stats,
      revenueData,
      weeklyActivity,
      activities
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
};