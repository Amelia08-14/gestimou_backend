const express = require('express');
const path = require('path');
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

const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma']
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(morgan('dev'));

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    return res.status(413).json({ error: 'Payload Too Large' });
  }

  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large' });
    }
    return res.status(400).json({ error: 'Upload error' });
  }

  if (err && err.message === 'Unsupported file type') {
    return res.status(400).json({ error: 'Unsupported file type' });
  }

  return next(err);
});

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
const notificationRoutes = require('./routes/notificationRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const documentRoutes = require('./routes/documentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const { startAnnualChargesScheduler } = require('./jobs/annualChargesScheduler');

// Mount routers
app.use('/api/properties', propertyRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/owners', ownerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/residences', residenceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/audit-logs', auditLogRoutes);

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
  startAnnualChargesScheduler();
})().catch((err) => {
  console.error('Failed to start server:', err?.message || err);
  process.exit(1);
});
