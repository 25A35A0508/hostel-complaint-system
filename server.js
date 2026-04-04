const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
const JWT_SECRET = 'serene_resolver_secret_2024';
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

function readDB() {
  if (!fs.existsSync(DB_FILE)) return { users: [], complaints: [], notices: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
function newId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

async function seedDB() {
  const db = readDB();
  if (db.users.length === 0) {
    const pw = await bcrypt.hash('admin123', 10);
    db.users = [
      { _id: newId(), name: 'Admin User',   email: 'admin@hostel.edu',     password: pw, role: 'admin',   room: 'Office', block: 'Admin',   createdAt: new Date().toISOString() },
      { _id: newId(), name: 'Alex Rivers',  email: 'alex@university.edu',  password: pw, role: 'student', room: '402-B',  block: 'Block C', createdAt: new Date().toISOString() },
      { _id: newId(), name: 'Sarah Miller', email: 'sarah@university.edu', password: pw, role: 'student', room: '112',    block: 'Block A', createdAt: new Date().toISOString() },
    ];
    const alex = db.users[1];
    db.complaints = [
      { _id: newId(), complaintId: 'SR-8842', studentId: alex._id, studentName: 'Alex Rivers', room: '402-B', block: 'Block C', category: 'Electrical', title: 'Main ceiling light flickering in Room 402-B', description: 'The ceiling light has been flickering for 3 days.', priority: 'medium', status: 'in_progress', isAnonymous: false, imageUrl: '', assignedTo: '', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { _id: newId(), complaintId: 'SR-8810', studentId: alex._id, studentName: 'Alex Rivers', room: '402-B', block: 'Block C', category: 'Plumbing',   title: 'Low water pressure in shared bathroom floor 3', description: 'Water pressure very low since Monday.', priority: 'low', status: 'resolved', isAnonymous: false, imageUrl: '', assignedTo: '', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), resolvedAt: new Date().toISOString() },
      { _id: newId(), complaintId: 'SR-8901', studentId: alex._id, studentName: 'Alex Rivers', room: '402-B', block: 'Block C', category: 'Internet',   title: 'WiFi authentication failing on mobile devices', description: 'Cannot connect to hostel WiFi on Android.', priority: 'high', status: 'pending', isAnonymous: false, imageUrl: '', assignedTo: '', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { _id: newId(), complaintId: 'SR-8855', studentId: alex._id, studentName: 'Alex Rivers', room: '402-B', block: 'Block C', category: 'Water',      title: 'Leakage near water cooler base - Block C', description: 'Water pooling on floor near the cooler.', priority: 'high', status: 'in_progress', isAnonymous: false, imageUrl: '', assignedTo: 'Plumbing Team', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    db.notices = [
      { _id: newId(), title: 'Maintenance Window', content: 'Scheduled maintenance for Central Block plumbing systems will occur this Sunday between 10:00 AM and 02:00 PM.', createdBy: 'Admin', isActive: true, createdAt: new Date().toISOString() }
    ];
    writeDB(db);
    console.log('✅ Database seeded with demo data');
  }
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ message: 'Invalid token' }); }
}

// AUTH
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.email === email.toLowerCase());
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, room: user.room, block: user.block } });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, room, block } = req.body;
  const db = readDB();
  if (db.users.find(u => u.email === email.toLowerCase())) return res.status(400).json({ message: 'Email already registered' });
  const hashed = await bcrypt.hash(password, 10);
  const user = { _id: newId(), name, email: email.toLowerCase(), password: hashed, role: 'student', room: room||'', block: block||'', createdAt: new Date().toISOString() };
  db.users.push(user);
  writeDB(db);
  res.status(201).json({ message: 'Account created successfully' });
});

// COMPLAINTS
app.get('/api/complaints/stats', authMiddleware, (req, res) => {
  const db = readDB();
  let list = req.user.role === 'student' ? db.complaints.filter(c => c.studentId === req.user.id) : db.complaints;
  res.json({ total: list.length, pending: list.filter(c=>c.status==='pending').length, inProgress: list.filter(c=>c.status==='in_progress').length, resolved: list.filter(c=>c.status==='resolved').length, active: list.filter(c=>['pending','in_progress'].includes(c.status)).length });
});

app.get('/api/complaints', authMiddleware, (req, res) => {
  const db = readDB();
  let list = req.user.role === 'student' ? db.complaints.filter(c => c.studentId === req.user.id) : db.complaints;
  const { status, category, priority, search } = req.query;
  if (status && status !== 'all') list = list.filter(c => c.status === status);
  if (category) list = list.filter(c => c.category === category);
  if (priority)  list = list.filter(c => c.priority === priority);
  if (search) { const s = search.toLowerCase(); list = list.filter(c => c.title.toLowerCase().includes(s)||c.complaintId.toLowerCase().includes(s)||c.studentName.toLowerCase().includes(s)); }
  list.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  res.json(list);
});

app.get('/api/complaints/:id', authMiddleware, (req, res) => {
  const db = readDB();
  const c = db.complaints.find(c => c._id === req.params.id);
  if (!c) return res.status(404).json({ message: 'Not found' });
  res.json(c);
});

app.post('/api/complaints', authMiddleware, upload.single('image'), (req, res) => {
  const db = readDB();
  const { category, title, description, priority, isAnonymous, room, block } = req.body;
  const complaint = { _id: newId(), complaintId: `SR-${9000+db.complaints.length}`, studentId: req.user.id, studentName: isAnonymous==='true'?'Anonymous':req.user.name, room:room||'N/A', block:block||'N/A', category, title, description, priority:priority||'medium', status:'pending', isAnonymous:isAnonymous==='true', imageUrl:req.file?`/uploads/${req.file.filename}`:'', assignedTo:'', messages:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
  db.complaints.push(complaint);
  writeDB(db);
  res.status(201).json(complaint);
});

app.patch('/api/complaints/:id/status', authMiddleware, (req, res) => {
  if (req.user.role==='student') return res.status(403).json({ message:'Forbidden' });
  const db = readDB();
  const idx = db.complaints.findIndex(c => c._id===req.params.id);
  if (idx===-1) return res.status(404).json({ message:'Not found' });
  const { status, assignedTo } = req.body;
  db.complaints[idx].status = status;
  db.complaints[idx].updatedAt = new Date().toISOString();
  if (assignedTo) db.complaints[idx].assignedTo = assignedTo;
  if (status==='resolved') db.complaints[idx].resolvedAt = new Date().toISOString();
  writeDB(db);
  res.json(db.complaints[idx]);
});

app.post('/api/complaints/:id/message', authMiddleware, (req, res) => {
  const db = readDB();
  const idx = db.complaints.findIndex(c => c._id===req.params.id);
  if (idx===-1) return res.status(404).json({ message:'Not found' });
  db.complaints[idx].messages.push({ sender:req.user.name, senderRole:req.user.role, text:req.body.text, time:new Date().toISOString() });
  db.complaints[idx].updatedAt = new Date().toISOString();
  writeDB(db);
  res.json(db.complaints[idx]);
});

app.delete('/api/complaints/:id', authMiddleware, (req, res) => {
  if (req.user.role==='student') return res.status(403).json({ message:'Forbidden' });
  const db = readDB();
  db.complaints = db.complaints.filter(c => c._id!==req.params.id);
  writeDB(db);
  res.json({ message:'Deleted' });
});

// NOTICES
app.get('/api/notices', authMiddleware, (req, res) => {
  const db = readDB();
  res.json(db.notices.filter(n=>n.isActive).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
});
app.post('/api/notices', authMiddleware, (req, res) => {
  if (req.user.role!=='admin') return res.status(403).json({ message:'Forbidden' });
  const db = readDB();
  const notice = { _id:newId(), ...req.body, createdBy:req.user.name, isActive:true, createdAt:new Date().toISOString() };
  db.notices.push(notice);
  writeDB(db);
  res.status(201).json(notice);
});
app.delete('/api/notices/:id', authMiddleware, (req, res) => {
  if (req.user.role!=='admin') return res.status(403).json({ message:'Forbidden' });
  const db = readDB();
  db.notices = db.notices.filter(n=>n._id!==req.params.id);
  writeDB(db);
  res.json({ message:'Deleted' });
});

// USERS
app.get('/api/users', authMiddleware, (req, res) => {
  if (req.user.role!=='admin') return res.status(403).json({ message:'Forbidden' });
  const db = readDB();
  res.json(db.users.map(({password,...u})=>u));
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
});

seedDB().then(() => {
  app.listen(5000, () => {
    console.log('🚀 Server running on http://localhost:5000');
    console.log('✅ Using local JSON database — no MongoDB needed!');
    console.log('🌐 Open: http://localhost:5000/pages/login.html');
  });
});