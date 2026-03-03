const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const propertyRoutes = require('./routes/propertyRoutes');

// Import Models to ensure they are registered
require('./models/User');
require('./models/Property');
require('./models/Owner');
require('./models/Financial');
require('./models/Maintenance');
require('./models/Document');

dotenv.config();

connectDB();

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Mount routers
app.use('/api/properties', propertyRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
