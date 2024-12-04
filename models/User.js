const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  companyAddress: { type: String, required: true },
  companyPhone: { type: String, required: true },
  companyEmail: { type: String, required: true },
  adminName: { type: String, required: true },
  adminPosition: { type: String, required: true },
  adminEmail: { type: String, required: true },
  adminPhone: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  selectedBusinessType: { type: String, required: true },
  selectedPlan: { type: String, required: true },
  role: { type: String, default: 'admin' },
  verified: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', companySchema);
