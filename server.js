const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const propertyRoutes = require('./routes/propertyRoutes');

// Import Models and Associations
require('./models/index');

dotenv.config();

connectDB();

const app = express();

app.use(express.json());

// CORS Configuration for Production
app.use(cors({
    origin: ['https://dev.aymenpromotion-dz.com', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(helmet());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.send('API is running...');
});

const financialRoutes = require('./routes/financialRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const userRoutes = require('./routes/userRoutes');
const residenceRoutes = require('./routes/residenceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');

// Mount routers
app.use('/api/properties', propertyRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/owners', ownerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/residences', residenceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
