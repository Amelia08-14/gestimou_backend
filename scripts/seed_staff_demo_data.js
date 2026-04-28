const { sequelize } = require('../config/db');
const { User } = require('../models');
const bcrypt = require('bcryptjs');

const seedStaffDemoData = async () => {
  try {
    await sequelize.authenticate();

    const passwordHash = await bcrypt.hash('Welcome123!', 10);

    const users = [
      {
        name: 'Responsable Zone 1',
        email: 'zone1@gestimou.local',
        role: 'RESPONSABLE_ZONE',
        profession: 'Responsable de Zone',
        zone: 'Zone 1'
      },
      {
        name: 'Responsable Zone 2',
        email: 'zone2@gestimou.local',
        role: 'RESPONSABLE_ZONE',
        profession: 'Responsable de Zone',
        zone: 'Zone 2'
      },
      {
        name: 'Responsable Zone 3',
        email: 'zone3@gestimou.local',
        role: 'RESPONSABLE_ZONE',
        profession: 'Responsable de Zone',
        zone: 'Zone 3'
      },
      {
        name: 'Chargé Recouvrement',
        email: 'recouvrement@gestimou.local',
        role: 'RECOUVREMENT',
        profession: 'Recouvrement'
      },
      {
        name: 'Responsable Sécurité',
        email: 'securite@gestimou.local',
        role: 'MANAGER',
        profession: 'Sécurité'
      },
      {
        name: 'HSE',
        email: 'hse@gestimou.local',
        role: 'HSE',
        profession: 'HSE'
      }
    ];

    let created = 0;
    for (const u of users) {
      const existing = await User.findOne({ where: { email: u.email } });
      if (existing) continue;
      await User.create({
        ...u,
        password: passwordHash,
        mustChangePassword: true
      });
      created += 1;
    }

    console.log(`Staff démo créés: ${created}/${users.length}`);
    process.exit(0);
  } catch (error) {
    console.error('Seed staff démo: échec', error);
    process.exit(1);
  }
};

seedStaffDemoData();
