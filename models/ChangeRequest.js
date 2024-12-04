const mongoose = require('mongoose');

const ChangeRequestSchema = new mongoose.Schema({
  timecardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClockRecord',
    required: true,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  note: {
    type: String,
    required: true,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  clockInTime: {
    type: Date,
  },
  clockOutTime: {
    type: Date,
  },
});

const ChangeRequests = mongoose.model('ChangeRequests', ChangeRequestSchema);
module.exports = ChangeRequests;
