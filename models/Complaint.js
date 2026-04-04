const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender:    String,
  senderRole:String,
  text:      String,
  time:      { type: Date, default: Date.now }
});

const complaintSchema = new mongoose.Schema({
  complaintId:  { type: String, unique: true },
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName:  { type: String, required: true },
  room:         { type: String, required: true },
  block:        { type: String, required: true },
  category:     { type: String, enum: ['Electrical','Plumbing','Internet','Water','Maintenance','Mess','Noise','Other'], required: true },
  title:        { type: String, required: true },
  description:  { type: String, required: true },
  priority:     { type: String, enum: ['low','medium','high','critical'], default: 'medium' },
  status:       { type: String, enum: ['pending','in_progress','resolved','closed'], default: 'pending' },
  isAnonymous:  { type: Boolean, default: false },
  imageUrl:     { type: String, default: '' },
  assignedTo:   { type: String, default: '' },
  messages:     [messageSchema],
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now },
  resolvedAt:   { type: Date }
});

// Auto-generate complaint ID
complaintSchema.pre('save', async function(next) {
  if (!this.complaintId) {
    const count = await mongoose.model('Complaint').countDocuments();
    this.complaintId = `SR-${9000 + count}`;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Complaint', complaintSchema);
