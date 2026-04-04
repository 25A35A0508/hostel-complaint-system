const router = require('express').Router();
const Notice = require('../models/Notice');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  const notices = await Notice.find({ isActive: true }).sort({ createdAt: -1 });
  res.json(notices);
});

router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const notice = await Notice.create({ ...req.body, createdBy: req.user.name });
  res.status(201).json(notice);
});

router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  await Notice.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
