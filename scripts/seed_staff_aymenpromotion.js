const { sequelize } = require('../config/db');
const { User } = require('../models');
const bcrypt = require('bcryptjs');

const seedStaffAymenPromotion = async () => {
  try {
    await sequelize.authenticate();

    const passwordHash = await bcrypt.hash('Welcome123!', 10);

    const desiredUsers = [
      {
        name: 'TOUFIK KACIMI',
        email: 't.kacimi@aymenpromotion.com',
        role: 'RESPONSABLE_ZONE',
        profession: 'Responsable de Zone',
        zone: 'Zone 1'
      },
      {
        name: 'Djamal KIBBOUA',
        email: 'd.kibboua@aymenpromotion.com',
        role: 'RESPONSABLE_ZONE',
        profession: 'Responsable de Zone',
        zone: 'Zone 2'
      },
      {
        name: 'Athmane YACEF',
        email: 'a.yacef@aymenpromotion.com',
        role: 'RESPONSABLE_ZONE',
        profession: 'Responsable de Zone',
        zone: 'Zone 3'
      },
      {
        name: 'Salim Noui',
        email: 's.noui@aymenpromotion.com',
        role: 'RECOUVREMENT',
        profession: 'Recouvrement',
        zone: null
      },
      {
        name: 'Cherif Djezzar',
        email: 'c.djezzar@aymenpromotion.com',
        role: 'MANAGER',
        profession: 'Sécurité',
        zone: null
      }
    ];

    const cleanupEmails = [
      'zone1@gestimou.local',
      'zone2@gestimou.local',
      'zone3@gestimou.local',
      'recouvrement@gestimou.local',
      'securite@gestimou.local',
      'hse@gestimou.local'
    ];

    await User.destroy({ where: { email: cleanupEmails } });

    let created = 0;
    let updated = 0;

    for (const u of desiredUsers) {
      const existing = await User.findOne({ where: { email: u.email } });
      if (!existing) {
        await User.create({
          name: u.name,
          email: u.email,
          password: passwordHash,
          role: u.role,
          profession: u.profession,
          zone: u.zone,
          mustChangePassword: true
        });
        created += 1;
        continue;
      }

      await existing.update({
        name: u.name,
        role: u.role,
        profession: u.profession,
        zone: u.zone
      });
      updated += 1;
    }

    console.log(`Staff AymenPromotion synchronisés: created=${created}, updated=${updated}`);
    process.exit(0);
  } catch (error) {
    console.error('Seed staff AymenPromotion: échec', error);
    process.exit(1);
  }
};

seedStaffAymenPromotion();
