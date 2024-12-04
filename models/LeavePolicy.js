const mongoose = require('mongoose');

const leavePolicySchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employees' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Companies' },
  policy: String,
  startDate: Date,
  endDate: Date,
  reason: String,
  status: String,
});

module.exports = mongoose.model('LeavePolicies', leavePolicySchema);
