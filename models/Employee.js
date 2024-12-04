const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  sex: { type: String, required: true },
  dob: { type: Date, required: true },
  permitType: { type: String, required: true },
  sinNumber: { type: String, required: true },
  passportNumber: { type: String, required: true },
  passportFront: { type: String, required: true },
  passportBack: { type: String, required: true },
  directDepositForm: { type: String, required: true },
  studyOrWorkPermit: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pin: { type: String, required: true },
  position: { type: String, required: true },
  password: { type: String, required: true },
  payRate: { type: Number, required: true }
});

module.exports = mongoose.model('Employee', employeeSchema);
