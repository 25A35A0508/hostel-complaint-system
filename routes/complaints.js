const router = require('express').Router();
const Complaint = require('../models/Complaint');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// File upload setup
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/complaints — student sees own; admin sees all
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, category, priority, search } = req.query;
    let filter = {};

    if (req.user.role === 'student') filter.studentId = req.user.id;

    if (status && status !== 'all') filter.status = status;
    if (category) filter.category = category;
    if (priority)  filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { complaintId: { $regex: search, $options: 'i' } },
        { studentName: { $regex: search, $options: 'i' } }
      ];
    }

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/complaints/stats — dashboard counts
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const filter = req.user.role === 'student' ? { studentId: req.user.id } : {};
    const [total, pending, inProgress, resolved] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.countDocuments({ ...filter, status: 'pending' }),
      Complaint.countDocuments({ ...filter, status: 'in_progress' }),
      Complaint.countDocuments({ ...filter, status: 'resolved' }),
    ]);
    res.json({ total, pending, inProgress, resolved, active: pending + inProgress });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/complaints/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/complaints — create
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { category, title, description, priority, isAnonymous } = req.body;
    const complaint = await Complaint.create({
      studentId:   req.user.id,
      studentName: isAnonymous === 'true' ? 'Anonymous' : req.user.name,
      room:        req.body.room || 'N/A',
      block:       req.body.block || 'N/A',
      category, title, description,
      priority:    priority || 'medium',
      isAnonymous: isAnonymous === 'true',
      imageUrl:    req.file ? `/uploads/${req.file.filename}` : '',
    });
    res.status(201).json(complaint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/complaints/:id/status — admin updates status
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'student') return res.status(403).json({ message: 'Forbidden' });
    const { status, assignedTo } = req.body;
    const update = { status, updatedAt: new Date() };
    if (assignedTo) update.assignedTo = assignedTo;
    if (status === 'resolved') update.resolvedAt = new Date();
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/complaints/:id/message — add message to complaint chat
router.post('/:id/message', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Not found' });

    complaint.messages.push({
      sender: req.user.name,
      senderRole: req.user.role,
      text,
      time: new Date()
    });
    await complaint.save();
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/complaints/:id — admin only
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'student') return res.status(403).json({ message: 'Forbidden' });
    await Complaint.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
