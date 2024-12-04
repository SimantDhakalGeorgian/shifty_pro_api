const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const { JWT_SECRET } = process.env;
const { isAuthenticated } = require('../middleware/auth');

// Register route
router.post('/register', async (req, res) => {
  try {
    const { companyName, companyAddress, companyPhone, companyEmail, adminName, adminPosition, adminEmail, adminPhone, username, password, selectedBusinessType, selectedPlan } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      companyName, companyAddress, companyPhone, companyEmail, adminName,
      adminPosition, adminEmail, adminPhone, username, password: hashedPassword,
      selectedBusinessType, selectedPlan, verified: false
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully, awaiting verification' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login route
router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
  
      console.log(username + password);
  
      const user = await User.findOne({ username });
  
      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
  
      // Directly using process.env.JWT_SECRET
      console.log("JWT Secret:", process.env.JWT_SECRET);
  
      if (!process.env.JWT_SECRET) {
        console.log("JWT_SECRET is undefined");
        return res.status(500).json({ error: "Internal configuration error" });
      }
  
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ message: 'Login successful', token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
});
  

// Verify User
router.put('/verify/:userId', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.userId, { verified: true }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'User verified successfully', user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// view profile
router.get('/viewProfile', isAuthenticated, async (req, res) => {
  try {
    // Extract the user's ID from the authenticated token
    const userId = req.user.id;

    // Find the user by ID
    const user = await User.findById(userId).select('-password -__v'); // Exclude sensitive fields like password and __v

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Send the user profile details
    res.status(200).json({
      message: 'Profile fetched successfully',
      profile: user,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change Password
router.put('/changePassword', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id; // Extract user ID from the token
    const { oldPassword, newPassword } = req.body;

    // Validate inputs
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Both old and new passwords are required' });
    }

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if the old password is correct
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Old password is incorrect' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;
