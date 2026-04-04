const router = require('express').Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const users = await User.find({}, '-password').sort({ createdAt: -1 });
  res.json(users);
});

module.exports = router;
