const jwt = require('jsonwebtoken');

const isAuthenticated = (req, res, next) => {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  
    console.log("Received Token:", token); // Log the received token
  
    if (!token) {
      return res.status(401).json({ error: 'Token is missing' });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.id };
      next();
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(403).json({ error: 'Invalid token' });
    }
};

module.exports = { isAuthenticated };
