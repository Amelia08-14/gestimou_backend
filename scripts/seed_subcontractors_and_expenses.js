const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');
const { Subcontractor, User, Residence, FinancialTransaction } = require('../models');

const demoSubcontractors = [
  {
    name: 'Amel Benelhadj',
    specialty: 'Plomberie',
    profession: 'Plombier',
    phone: '+213 555 000 101',
    email: 'plombier@gestimou.local',
    address: 'Alger'
  },
  {
    name: 'Ahmed Electricien',
    specialty: 'Électricité',
    profession: 'Électricien',
    phone: '+213 555 000 102',
    email: 'electricien@gestimou.local',
    address: 'Alger'
  },
  {
    name: 'Sofiane Ascenseurs',
    specialty: 'Ascenseurs',
    profession: 'Technicien ascenseur',
    phone: '+213 555 000 103',
    email: 'ascenseurs@gestimou.local',
    address: 'Alger'
  },
  {
    name: 'Khaled Serrurerie',
    specialty: 'Serrurerie',
    profession: 'Serrurier',
    phone: '+213 555 000 104',
    email: 'serrurier@gestimou.local',
    address: 'Alger'
  },
  {
    name: 'Nadia Nettoyage',
    specialty: 'Nettoyage',
    profession: 'Agent entretien',
    phone: '+213 555 000 105',
    email: 'nettoyage@gestimou.local',
    address: 'Alger'
  }
];

const hashToInt = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const seedSubcontractors = async () => {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('ChangeMe123!', salt);

  let createdSubs = 0;
  let createdUsers = 0;

  for (const entry of demoSubcontractors) {
    const existing = await Subcontractor.findOne({ where: { email: entry.email } });

    if (existing) {
      await existing.update({
        name: entry.name,
        specialty: entry.specialty,
        phone: entry.phone,
        address: entry.address,
        status: 'Actif'
      });
    } else {
      await Subcontractor.create({
        name: entry.name,
        specialty: entry.specialty,
        phone: entry.phone,
        email: entry.email,
        address: entry.address,
        status: 'Actif'
      });
      createdSubs += 1;
    }

    const existingUser = await User.findOne({ where: { email: entry.email } });
    if (!existingUser) {
      await User.create({
        name: entry.name,
        email: entry.email,
        role: 'INTERVENANT',
        profession: entry.profession,
        password: passwordHash
      });
      createdUsers += 1;
    }
  }

  return { createdSubs, createdUsers };
};

const seedExpenses = async () => {
  const residences = await Residence.findAll({ order: [['id', 'ASC']] });
  let created = 0;

  for (const residence of residences) {
    const base = hashToInt(residence.id);
    const month = (base % 3) + 1;
    const year = new Date().getFullYear();

    const expenses = [
      {
        description: `Dépense - Maintenance ascenseur - ${residence.name}`,
        amount: 80000 + (base % 70000),
        status: base % 2 === 0 ? 'Payé' : 'En attente',
        date: new Date(year, month, 5)
      },
      {
        description: `Dépense - Éclairage extérieur - ${residence.name}`,
        amount: 15000 + (base % 25000),
        status: base % 3 === 0 ? 'Payé' : 'En attente',
        date: new Date(year, month, 18)
      }
    ];

    for (const exp of expenses) {
      const exists = await FinancialTransaction.findOne({
        where: {
          type: 'Dépense',
          residenceId: residence.id,
          description: exp.description,
          date: exp.date
        }
      });

      if (exists) continue;

      await FinancialTransaction.create({
        type: 'Dépense',
        description: exp.description,
        amount: exp.amount,
        status: exp.status,
        date: exp.date,
        residenceId: residence.id,
        propertyId: null
      });
      created += 1;
    }
  }

  return { created };
};

const run = async () => {
  try {
    await sequelize.authenticate();
    const subs = await seedSubcontractors();
    const expenses = await seedExpenses();
    console.log(`Prestataires ajoutés: ${subs.createdSubs}, comptes intervenants ajoutés: ${subs.createdUsers}`);
    console.log(`Dépenses ajoutées: ${expenses.created}`);
    process.exit(0);
  } catch (error) {
    console.error('Erreur seed_subcontractors_and_expenses:', error);
    process.exit(1);
  }
};

run();

