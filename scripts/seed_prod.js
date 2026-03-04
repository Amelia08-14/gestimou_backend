const { sequelize } = require('../config/db');
const { User, Owner, Residence, Property } = require('../models');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seed...');
    
    // 1. Create Default Admin User
    const adminEmail = 'admin@aymenpromotion.com';
    const adminExists = await User.findOne({ where: { email: adminEmail } });
    
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('Admin@2024!', 10);
        await User.create({
            name: 'Admin Principal',
            email: adminEmail,
            password: hashedPassword,
            role: 'ADMIN',
            profession: 'Administrateur'
        });
        console.log('✅ Admin user created');
    } else {
        console.log('ℹ️ Admin user already exists');
    }

    // 2. Create Residence "Prestige"
    const residenceId = 'prestige';
    let residence = await Residence.findByPk(residenceId);
    
    if (!residence) {
        residence = await Residence.create({
            id: residenceId,
            name: 'Résidence Prestige',
            address: 'Alger, Algérie',
            totalUnits: 40,
            deliveredUnits: 5,
            description: 'Résidence haut standing'
        });
        console.log('✅ Residence "Prestige" created');
    }

    // 3. Create Owners & Properties from Excel Data (Hardcoded based on image)
    const ownersData = [
        { nom: 'mostefaoui', prenom: 'amine', phone: '213560709669', email: 'a.mostefaoui@aymenpromotion.com', bloc: 'A', etage: '6', edd: '1' },
        { nom: 'tidjani', prenom: 'saber', phone: '213560298174', email: 's.tidjani@aymenpromotion.com', bloc: 'B', etage: '0', edd: '2' },
        { nom: 'haddoud', prenom: 'amir', phone: '213558006613', email: 'a.haddoud@aymenpromotion.com', bloc: 'C', etage: '1', edd: '3' },
        { nom: 'messaoudi', prenom: 'abdelkrim', phone: '213', email: 'a.messaoudi@aymenpromotion.com', bloc: 'C', etage: '2', edd: '4' },
        { nom: 'ben abdelaziz', prenom: 'ghilas', phone: '213', email: 'g.benabdelaziz@aymenpromotion.com', bloc: 'A', etage: '3', edd: '5' }
    ];

    for (const data of ownersData) {
        // Create Owner
        let owner = await Owner.findOne({ where: { email: data.email } });
        if (!owner) {
            owner = await Owner.create({
                firstName: data.prenom,
                lastName: data.nom,
                email: data.email,
                phone: data.phone,
                status: 'Actif'
            });
            console.log(`✅ Owner ${data.prenom} ${data.nom} created`);
        }

        // Create Property linked to Owner
        const propertyTitle = `Appartement ${data.bloc}-${data.edd}`;
        const propertyExists = await Property.findOne({ where: { title: propertyTitle, residenceId: residenceId } });
        
        if (!propertyExists) {
            await Property.create({
                title: propertyTitle,
                type: 'Appartement',
                surface: 100.0, // Default value
                floor: data.etage,
                block: data.bloc,
                lotNumber: data.edd,
                status: 'Vendu',
                residenceId: residenceId,
                ownerId: owner.id
            });
            console.log(`✅ Property ${propertyTitle} created`);
        }
        
        // Also create a User account for this owner so they can login to Mobile App
        const userExists = await User.findOne({ where: { email: data.email } });
        if (!userExists) {
            // Default password for owners: "Welcome123!"
            const ownerPass = await bcrypt.hash('Welcome123!', 10);
            await User.create({
                name: `${data.prenom} ${data.nom}`,
                email: data.email,
                password: ownerPass,
                role: 'RESIDENT',
                profession: 'Propriétaire'
            });
            console.log(`✅ User account for ${data.email} created`);
        }
    }

    console.log('🎉 Database seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
