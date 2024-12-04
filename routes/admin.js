const express = require('express');
const multer = require('multer');
const Employee = require('../models/Employee');
const ClockRecord = require('../models/ClockRecord'); 
const ChangeRequests = require('../models/ChangeRequest');
const LeavePolicies = require('../models/LeavePolicy'); 
const TimeOff = require('../models/ScheduleTimeoff.js'); 
const EventsModel = require('../models/EventModel'); 
const User = require('../models/User');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
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


// View all time-off records
router.get('/viewTimeOffRecords', isAuthenticated, async (req, res) => {
    try {
        const companyId = req.user.id; // Extract companyId from middleware

        // Log the companyId for debugging
        console.log(`Admin (CompanyId): ${companyId}`);

        // Find all time-off records with 'Pending' status for the company
        const timeOffRecords = await TimeOff.find({ companyId, status: 'Pending' })
            .populate('employeeId', 'name position') // Populate employee details
            .sort({ startDate: -1 }); // Sort by start date (latest first)

        // Send the records in the response
        res.status(200).json({
            message: 'Pending time-off records fetched successfully',
            timeOffRecords,
        });
    } catch (error) {
        // Handle errors
        console.error('Error fetching time off records:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Update time-off status
router.patch('/updateTimeOffStatus/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params; // Extract time-off record ID from request params
      const { status } = req.body; // Extract new status from request body
      const companyId = req.user.id; // Extract companyId from middleware
  
      // Check if the status is provided
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
  
      // Find the time-off record and ensure it belongs to the admin's company
      const timeOffRecord = await TimeOff.findOne({ _id: id, companyId });
  
      if (!timeOffRecord) {
        return res.status(404).json({ error: 'Time-off record not found or unauthorized' });
      }
  
      // Update the status
      timeOffRecord.status = status;
      await timeOffRecord.save();
  
      // Send a success response
      res.status(200).json({ message: 'Time off status updated successfully', timeOffRecord });
    } catch (error) {
      // Handle errors
      console.error('Error updating time off status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/timecard/change-requests', isAuthenticated, async (req, res) => {
    try {
      const changeRequests = await ChangeRequests.find()
        .populate('employeeId', 'fullName phone email');
  
      const formattedRequests = changeRequests.map(request => ({
        _id: request._id, // Include the _id field
        user: {
          fullName: request.employeeId.fullName,
          phone: request.employeeId.phone,
          email: request.employeeId.email,
        },
        requestedAt: request.requestedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        record: {
          timecardId: request.timecardId,
          clockInTime: request.clockInTime,
          clockOutTime: request.clockOutTime,
        },
        note: request.note,
        status: request.status,
      }));
  
      res.status(200).json({
        message: 'Change requests fetched successfully',
        data: formattedRequests,
      });
    } catch (error) {
      console.error('Error fetching change requests:', error);
      res.status(500).json({ error: 'Internal server error' });
    } 
  });
  


// Admin API to take action on change request
router.put('/timecard/change-request/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params; // Change request ID
    const { status, newClockInTime, newClockOutTime } = req.body;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use "approved" or "rejected".' });
    }

    // Find the change request by ID
    const changeRequest = await ChangeRequests.findById(id);
    if (!changeRequest) {
      return res.status(404).json({ error: 'Change request not found' });
    }

    // Update the change request status
    changeRequest.status = status;
    await changeRequest.save();

    let updatedClockRecord = null;

    if (status === 'approved') {
      // Validate the new clock-in and clock-out times
      if (!newClockInTime || !newClockOutTime) {
        return res.status(400).json({ error: 'Clock-in and clock-out times are required for approval.' });
      }

      // Find the corresponding clock record
      const clockRecord = await ClockRecord.findById(changeRequest.timecardId);
      if (!clockRecord) {
        return res.status(404).json({ error: 'Clock record not found.' });
      }

      // Update clock record with new times
      const clockInDate = new Date(newClockInTime);
      const clockOutDate = new Date(newClockOutTime);
      const duration = (clockOutDate - clockInDate) / (1000 * 60 * 60); // Convert milliseconds to hours

      clockRecord.clockInTime = clockInDate;
      clockRecord.clockOutTime = clockOutDate;
      clockRecord.duration = duration.toFixed(2); // Keep duration to 2 decimal places

      updatedClockRecord = await clockRecord.save();
    }

    res.status(200).json({
      message: `Change request ${status} successfully`,
      changeRequest,
      ...(status === 'approved' && { updatedClockRecord }),
    });
  } catch (error) {
    console.error('Error updating change request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Generate report
// report data from database
router.get('/reports/change-requests', isAuthenticated, async (req, res) => {
  try {
    const changeRequests = await ChangeRequests.find()
      .populate('employeeId', 'name email')
      .exec();

    const report = changeRequests.map(request => ({
      employeeName: request.employeeId.name,
      email: request.employeeId.email,
      requestedAt: request.requestedAt.toLocaleString(),
      clockInTime: request.clockInTime.toLocaleString(),
      clockOutTime: request.clockOutTime.toLocaleString(),
      note: request.note,
      status: request.status,
    }));

    res.status(200).json({ message: 'Report generated successfully', data: report });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reports/attendance', isAuthenticated, async (req, res) => {
  try {
    const attendanceRecords = await ClockRecord.find()
      .populate('employeeId', 'name')
      .exec();

    const report = attendanceRecords.map(record => ({
      employeeName: record.employeeId.name,
      clockInTime: record.clockInTime.toLocaleString(),
      clockOutTime: record.clockOutTime.toLocaleString(),
      duration: record.duration.toFixed(2), // Convert duration to hours
      status: record.status,
    }));

    res.status(200).json({ message: 'Report generated successfully', data: report });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' + error });
  }
});

router.get('/reports/leave-policies', isAuthenticated, async (req, res) => {
  try {
    const policies = await LeavePolicies.find()
      .populate('employeeId', 'name')
      .exec();

    const report = policies.map(policy => ({
      employeeName: policy.employeeId.name,
      policy: policy.policy,
      startDate: policy.startDate.toLocaleDateString(),
      endDate: policy.endDate.toLocaleDateString(),
      reason: policy.reason,
      status: policy.status,
    }));

    res.status(200).json({ message: 'Report generated successfully', data: report });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error'+ error });
  }
});


// Create a new event
router.post('/events', isAuthenticated, async (req, res) => {
  try {
    const { title, description, eventDate } = req.body;

    if (!title || !description || !eventDate) {
      return res.status(400).json({ error: 'Title, description, and date are required' });
    }

    const event = new EventsModel({ title, description, eventDate });
    await event.save();

    res.status(201).json({ message: 'Event created successfully', event });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch all upcoming events
router.get('/events/all', async (req, res) => {
  try {
    // Fetch all events sorted by eventDate
    const events = await EventsModel.find().sort({ eventDate: 1 });

    // Prepare the response with only the required fields
    const eventsResponse = events.map(event => ({
      _id: event._id,
      title: event.title,
      description: event.description,
      eventDate: event.eventDate,
    }));

    // Send the response
    res.status(200).json({ message: 'All events fetched successfully', events: eventsResponse });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
  
module.exports = router;