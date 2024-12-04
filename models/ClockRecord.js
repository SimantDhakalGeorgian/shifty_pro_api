// models/ClockRecord.js
const mongoose = require('mongoose');

const clockRecordSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  clockInTime: { type: Date, required: true },
  clockOutTime: { type: Date }, // Can be null if only clocked in
  duration: { type: Number },   // Optional: store duration in minutes or seconds for convenience
  status: { type: String, enum: ['clocked-in', 'clocked-out'], default: 'clocked-in' },
});

module.exports = mongoose.model('ClockRecord', clockRecordSchema);
