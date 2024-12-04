const jwt = require('jsonwebtoken');

const isEmpAuthenticated = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to the request
    next();
  } catch (error) {
    console.error('Invalid token:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = { isEmpAuthenticated };
