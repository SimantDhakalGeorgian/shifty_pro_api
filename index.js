const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const employeeRoutes = require('./routes/employee');
require('dotenv').config();
dotenv.config();
const app = express();
app.use(express.json());
const path = require('path');

const axios = require('axios');
const bodyParser = require('body-parser');

// Replace with your OneSignal App ID and REST API Key
const ONE_SIGNAL_APP_ID = 'your-onesignal-app-id';
const ONE_SIGNAL_API_KEY = 'your-onesignal-api-key';

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employees', employeeRoutes);


// API to send notification
app.post('/send-notification', async (req, res) => {
  const { playerId, title, message } = req.body;

  if (!playerId || !title || !message) {
    return res.status(400).json({ error: 'Missing playerId, title, or message' });
  }

  const notificationData = {
    app_id: ONE_SIGNAL_APP_ID,
    include_player_ids: [playerId], // The player ID for the device you want to send the notification to
    headings: { en: title },
    contents: { en: message },
  };

  try {
    const response = await axios.post('https://onesignal.com/api/v1/notifications', notificationData, {
      headers: {
        Authorization: `Basic ${ONE_SIGNAL_API_KEY}`,
      },
    });

    res.status(200).json({
      message: 'Notification sent successfully',
      response: response.data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
