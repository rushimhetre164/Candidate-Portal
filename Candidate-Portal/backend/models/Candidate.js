const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CandidateSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  positionApplied: { type: String, required: true },
  currentPosition: { type: String, required: true },
  experienceYears: { type: Number, required: true },
  resumeFileId: { type: Schema.Types.ObjectId },
  videoFileId: { type: Schema.Types.ObjectId },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Candidate', CandidateSchema);
