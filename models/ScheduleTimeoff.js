const mongoose = require('mongoose');

const timeOffSchema = new mongoose.Schema({
  employeeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee', 
    required: true 
  },
  companyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', // Adjust 'User' to match the name of your company model 
    required: true 
  },
  policy: { 
    type: String, 
    required: true 
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  reason: { 
    type: String 
  },
  status: { 
    type: String, 
    required: true 
  }
});

module.exports = mongoose.model('TimeOff', timeOffSchema);
