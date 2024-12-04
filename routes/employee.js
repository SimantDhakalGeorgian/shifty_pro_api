const express = require('express');
const multer = require('multer');
const Employee = require('../models/Employee');
const ClockRecord = require('../models/ClockRecord'); 
const ChangeRequests = require('../models/ChangeRequest'); 
const TimeOff = require('../models/ScheduleTimeoff.js'); 
const User = require('../models/User');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { isEmpAuthenticated } = require('../middleware/empAuth');
// Clock in route with PIN and _id verification
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');  // Import ObjectId

const moment = require('moment'); // For date manipulation


// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

// Create multer instance with defined storage
const upload = multer({ storage });


// Employee registration route
router.post('/create', isAuthenticated, upload.fields([
  { name: 'passportFront', maxCount: 1 },
  { name: 'passportBack', maxCount: 1 },
  { name: 'directDepositForm', maxCount: 1 },
  { name: 'studyOrWorkPermit', maxCount: 1 }
]), async (req, res) => {

  console.log("Registering..");

  try {
    // Destructure data from request body
    const { 
      name, 
      address, 
      email, 
      phoneNumber, 
      sex, 
      dob, 
      permitType, 
      sinNumber, 
      passportNumber, 
      pin, 
      position,
      password,
      payRate
    } = req.body;

    // Log the request body to ensure it's reaching this point
    console.log("Registering employee:", req.body);

    // Check for missing required files
    const requiredFiles = ['passportFront', 'passportBack', 'directDepositForm', 'studyOrWorkPermit'];
    const missingFiles = requiredFiles.filter(field => !req.files[field] || req.files[field].length === 0);
    
    if (missingFiles.length > 0) {
      return res.status(400).json({ error: `Missing files: ${missingFiles.join(', ')}` });
    }

    // Verify the admin user
    const adminUser = await User.findById(req.user.id);
    if (!adminUser || !adminUser.verified) {
      return res.status(403).json({ error: 'Only verified admins can register employees' });
    }

    // Check if the email, phone number, SIN, or passport number already exists
    const existingEmployee = await Employee.findOne({
      $or: [
        { email: email.trim() },
        { phoneNumber: phoneNumber.trim() },
        { sinNumber: sinNumber.trim() },
        { passportNumber: passportNumber.trim() }
      ]
    });

    if (existingEmployee) {
      return res.status(400).json({
        error: 'Employee already exists in our database with similar details',
        existingEmployee: {
          name: existingEmployee.name,
          email: existingEmployee.email,
          phoneNumber: existingEmployee.phoneNumber,
          sinNumber: existingEmployee.sinNumber,
          passportNumber: existingEmployee.passportNumber,
          dob: existingEmployee.dob
        }
      });
    }

    // Parse and validate the date of birth (dob)
    const formattedDob = new Date(dob);
    if (isNaN(formattedDob)) {
      return res.status(400).json({ error: 'Invalid date format for dob' });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new employee record
    const employee = new Employee({
      name, 
      address, 
      email, 
      phoneNumber, 
      sex, 
      dob: formattedDob, 
      permitType, 
      sinNumber, 
      passportNumber,
      pin,
      position,
      password: hashedPassword, // Save the hashed password
      payRate,
      passportFront: req.files.passportFront[0].path,
      passportBack: req.files.passportBack[0].path,
      directDepositForm: req.files.directDepositForm[0].path,
      studyOrWorkPermit: req.files.studyOrWorkPermit[0].path,
      userId: req.user.id
    });

    // Save the employee to the database
    await employee.save();
    res.status(201).json({ message: 'Employee registered successfully', employee });
  } catch (error) {
    console.error("Error during employee registration:", error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Get all employees route
router.get('/ViewAllEmployees', isAuthenticated, async (req, res) => {


    try {
      // Verify the admin user
      const adminUser = await User.findById(req.user.id);
      if (!adminUser || !adminUser.verified) {
        return res.status(403).json({ error: 'Only verified admins can view employee records' });
      }
  
      // Fetch all employees with selected fields only
      const employees = await Employee.find({ userId: req.user.id })
        .select('_id name email phoneNumber address position'); // Specify fields to include
  
      // Check if there are no employees
      if (!employees.length) {
        return res.status(404).json({ message: 'No employees found' });
      }
  
      // Return the list of employees
      res.status(200).json({ employees });
    } catch (error) {
      console.error("Error fetching employees:", error.message); // Log the error message
      res.status(500).json({ error: 'Internal server error' });
    }
});


router.post('/clock-in', isAuthenticated, async (req, res) => {
    const { _id, pin } = req.body;

    try {
        const employeeId = mongoose.Types.ObjectId.isValid(_id) ? new mongoose.Types.ObjectId(_id) : null;
        console.log("Received ID:", _id, "Received PIN:", pin);

        if (!employeeId) {
            return res.status(400).json({ message: 'Invalid employee ID format' });
        }

        // Attempt to find by ID and fall back to find by string if null
        let employee = await Employee.findById(employeeId);
        if (!employee) {
            console.log("Attempting to find by string ID");
            employee = await Employee.findOne({ _id: _id });
        }

        console.log("Database Employee:", employee);

        if (!employee || String(employee.pin).trim() !== String(pin).trim()) {
            return res.status(403).json({ message: 'Invalid employee ID or PIN' });
        }

        const activeRecord = await ClockRecord.findOne({ employeeId, status: 'clocked-in' });
        if (activeRecord) {
            return res.status(400).json({ message: 'Employee already clocked in' });
        }

        const clockRecord = new ClockRecord({
            employeeId,
            clockInTime: new Date(),
            status: 'clocked-in',
        });
        await clockRecord.save();

        res.status(200).json({ message: 'Clocked in successfully', clockRecord });
    } catch (error) {
        console.error("Error clocking in:", error);
        res.status(500).json({ message: 'Error clocking in', error: error.message });
    }
});


// Clock out route with PIN and _id verification
router.post('/clock-out', isAuthenticated, async (req, res) => {
    const { _id, pin } = req.body;

    try {
        // Find the employee by ID and check if the PIN matches
        const employee = await Employee.findById(_id);

        // Validate employee and PIN
        if (!employee || employee.pin.trim() !== pin.trim()) {
            return res.status(403).json({ message: 'Invalid employee ID or PIN' });
        }

        // Check if there is an active clock-in record
        const clockRecord = await ClockRecord.findOne({ employeeId: _id, status: 'clocked-in' });
        
        if (!clockRecord) {
            return res.status(400).json({ message: 'Clock-in is required to perform clock-out.' });
        }

        // Update the record with clock-out time and calculate duration
        clockRecord.clockOutTime = new Date();
        clockRecord.duration = (clockRecord.clockOutTime - clockRecord.clockInTime) / 1000 / 60; // Duration in minutes
        clockRecord.status = 'clocked-out';
        await clockRecord.save();

        res.status(200).json({ message: 'Clocked out successfully', clockRecord });
    } catch (error) {
        console.error("Error clocking out:", error);
        res.status(500).json({ message: 'Error clocking out', error: error.message });
    }
});



// Get all currently clocked-in employees
router.get('/currently-clocked-in', isAuthenticated, async (req, res) => {
    try {
        // Fetch clocked-in employees and populate name and position in the employeeId
        const currentlyClockedIn = await ClockRecord.find({ status: 'clocked-in' })
            .populate('employeeId', 'name position'); // Populate name and position fields

        // Return the response with employeeId containing name and position
        res.status(200).json({ employees: currentlyClockedIn });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching clocked-in employees', error });
    }
});


// user authentication and profiling
// Employee Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the employee exists
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: employee._id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Error during employee login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
  
// View Employee Profile
router.get('/profile', isEmpAuthenticated, async (req, res) => {
  try {
    const employee = await Employee.findById(req.user.id).populate(
      'userId', // company id
      'companyName companyAddress'
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.status(200).json({ employee });
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Edit Employee Profile
router.put('/profile/edit', isEmpAuthenticated, async (req, res) => {
  const { address, phoneNumber, position } = req.body;

  try {
    const employee = await Employee.findById(req.user.id);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Update fields
    if (address) employee.address = address;
    if (phoneNumber) employee.phoneNumber = phoneNumber;
    if (position) employee.position = position;

    // Save updated employee
    await employee.save();

    res.status(200).json({ message: 'Profile updated successfully', employee });
  } catch (error) {
    console.error('Error updating employee profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Route to fetch clock records summary for authenticated employee
router.get('/clockrecords/summary', isEmpAuthenticated, async (req, res) => {
  try {
    const employeeId = req.user.id; // Get the employeeId from the decoded token

    // Retrieve employee details (name, position) from the Employee collection
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { name, position } = employee;

    // Get the start and end of the current week
    const startOfWeek = moment().startOf('week').toDate();
    const endOfWeek = moment().endOf('week').toDate();

    // Aggregate total hours worked for the current week
    const recordsThisWeek = await ClockRecord.aggregate([
      {
        $match: {
          employeeId: new ObjectId(employeeId),
          clockInTime: { $gte: startOfWeek, $lte: endOfWeek },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$clockInTime' } },
          totalHours: { $sum: '$duration' },
          timecards: {
            $push: {
              _id: '$_id', // Include the record's unique identifier
              clockInTime: '$clockInTime',
              clockOutTime: '$clockOutTime',
              duration: '$duration',
            },
          },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    console.log(recordsThisWeek);

    // Calculate the total hours worked this week
    let totalHoursThisWeek = 0;
    recordsThisWeek.forEach(record => {
      totalHoursThisWeek += record.totalHours || 0; // Default to 0 if totalHours is undefined
    });

    // Calculate total pay for this week (assuming a fixed hourly rate of $22)
    const hourlyRate = 22;
    const totalPayThisWeek = totalHoursThisWeek * hourlyRate;

    // Format the records
    const formattedRecords = recordsThisWeek.map(record => ({
      date: record._id,
      totalHours: (record.totalHours || 0).toFixed(2), // Safeguard for undefined totalHours
      timecards: record.timecards.map(tc => ({
        _id: tc._id, // Include the record's unique identifier
        clockInTime: tc.clockInTime,
        clockOutTime: tc.clockOutTime,
        duration: (tc.duration || 0).toFixed(2), // Safeguard for undefined duration
      })),
    }));

    if (recordsThisWeek.length === 0) {
      return res.status(200).json({
        message: 'No clock records found for the specified employee.',
        data: [],
      });
    }

    // Return the formatted data along with employee details and totals
    res.status(200).json({
      message: 'Clock records summary fetched successfully',
      data: {
        employee: {
          name,
          position,
        },
        totalHoursThisWeek: totalHoursThisWeek.toFixed(2),
        totalPayThisWeek: totalPayThisWeek.toFixed(2),
        records: formattedRecords,
      },
    });
  } catch (error) {
    console.error('Error fetching clock records summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




// API to fetch employees of the logged-in user's company
router.get('/peopleDirectory', isEmpAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id; // Extract `_id` from middleware

    // Find the employee with the matching `_id` to get their userId
    const loggedInEmployee = await Employee.findOne({ _id: userId });
    if (!loggedInEmployee) {
        return res.status(404).json({ message: 'Logged-in employee not found' });
    }

    // Use the `userId` to find all employees in the same company
    const employees = await Employee.find({ userId: loggedInEmployee.userId }, 'name position phoneNumber');

    if (!employees.length) {
        return res.status(404).json({ message: 'No employees found for this company' });
    }

    res.status(200).json({ employees });
} catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: 'Internal server error' });
}
});

// Schedule time off
router.post('/scheduleTimeOff', isEmpAuthenticated, async (req, res) => {
  try {
    // Destructure request body
    const { policy, startDate, endDate, reason, status } = req.body;
    const employeeId = req.user.id; // Extract employeeId from middleware

    // Log the extracted values
    console.log({
      employeeId,
      policy,
      startDate,
      endDate,
      reason,
      status
    });

    // Check for missing required fields
    if (!policy || !startDate || !endDate || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch the employee details to get the companyId (userId)
    const employee = await Employee.findById(employeeId);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const companyId = employee.userId; // Extract companyId (userId from Employee document)

    // Log companyId for debugging
    console.log(`CompanyId (userId): ${companyId}`);

    // Create a new time off object
    const timeOff = new TimeOff({
      employeeId,
      companyId,
      policy,
      startDate,
      endDate,
      reason,
      status
    });

    // Save to the database
    await timeOff.save();

    // Send a success response
    res.status(201).json({ message: 'Time off scheduled successfully', timeOff });
  } catch (error) {
    // Handle errors
    console.error('Error scheduling time off:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// view pay records for employee profiling
router.get('/payRecords', isEmpAuthenticated, async (req, res) => {
  try {
    const employeeId = req.user.id; // Extract `_id` from middleware
    const employee = await Employee.findById(employeeId);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Fetch clock records for this employee and sort them by clock-in time
    const clockRecords = await ClockRecord.find({ employeeId }).sort({ clockInTime: 1 });

    // Group the clock records into weeks
    const payWeeks = [];
    let currentWeekStart = null;
    let totalDuration = 0; // Total duration for the current week in minutes

    clockRecords.forEach(record => {
      const clockInDate = moment(record.clockInTime);
      const clockOutDate = moment(record.clockOutTime);

      // Get the start of the week (Monday)
      const weekStart = clockInDate.startOf('week'); 

      // If we are in a new week, save the previous week's data and reset totalDuration
      if (!currentWeekStart || !weekStart.isSame(currentWeekStart, 'week')) {
        if (currentWeekStart) {
          // Add the previous week's total pay
          payWeeks.push({
            period: `${moment(currentWeekStart).format('MMM D, YYYY')} - ${moment(currentWeekStart).add(6, 'days').format('MMM D, YYYY')}`,
            totalPay: (totalDuration / 60) * parseFloat(employee.payRate), // Convert duration to hours and calculate pay
          });
        }

        // Start a new week
        currentWeekStart = weekStart;
        totalDuration = 0; // Reset duration for the new week
      }

      // Add the duration of the current clock record to the total duration for the week
      totalDuration += record.duration;
    });

    // Add the last week's data if any
    if (currentWeekStart) {
      payWeeks.push({
        period: `${moment(currentWeekStart).format('MMM D, YYYY')} - ${moment(currentWeekStart).add(6, 'days').format('MMM D, YYYY')}`,
        totalPay: (totalDuration / 60) * parseFloat(employee.payRate),
      });
    }

    // Send the response with the pay periods
    return res.json({ employee: employee.name, payWeeks });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/timecard/change-request', isEmpAuthenticated, async (req, res) => {
  try {
    const { _id, note, clockInTime, clockOutTime } = req.body;
    const employeeId = req.user.id;

    // Find the existing timecard
    const timecard = await ClockRecord.findById(_id);
    if (!timecard) {
      return res.status(404).json({ error: 'Timecard not found' });
    }

    // Create a change request
    const changeRequest = new ChangeRequests({
      timecardId: _id,
      employeeId,
      note,
      requestedAt: new Date(),
      status: 'pending',
      clockInTime: clockInTime || timecard.clockInTime, // If new times provided
      clockOutTime: clockOutTime || timecard.clockOutTime,
    });

    await changeRequest.save();
    res.status(201).json({ message: 'Change request submitted successfully' });
  } catch (error) {
    console.error('Error submitting timecard change request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;