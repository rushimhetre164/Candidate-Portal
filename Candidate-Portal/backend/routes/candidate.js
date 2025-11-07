// routes/candidate.js (robust version with clearer errors + multer error handler)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const Candidate = require('../models/Candidate');

/* ---------------------------- Multer storages ---------------------------- */
const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    return cb(new Error('Resume must be a PDF'));
  }
});

const uploadVideo = multer({
  storage: multer.memoryStorage(),
  // Client enforces ≤ 90s; size limit generous to avoid false negatives
  limits: { fileSize: 200 * 1024 * 1024 },
});

/* ------------------------ Helper: Save buffer to GridFS ------------------------ */
// FIX: resolve with {_id: uploadStream.id} because 'finish' doesn't provide the file object
function saveBufferToGridFS({ db, bucketName, filename, contentType, buffer, metadata }) {
  return new Promise((resolve, reject) => {
    try {
      const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName });
      const uploadStream = bucket.openUploadStream(filename, { contentType, metadata });
      const fileId = uploadStream.id; // <-- get id from stream

      uploadStream.once('finish', () => resolve({ _id: fileId }));
      uploadStream.once('error', (err) => reject(err));

      uploadStream.end(buffer); // write & close
    } catch (err) {
      reject(err);
    }
  });
}

/* ---------------- Create candidate + upload resume (PDF ≤ 5MB) ---------------- */
router.post('/candidate', (req, res, next) => {
  // run multer first so we can catch its errors in our error handler
  uploadResume.single('resume')(req, res, async (multerErr) => {
    if (multerErr) return next(multerErr);

    try {
      const { firstName, lastName, positionApplied, currentPosition, experienceYears } = req.body;

      // basic validation
      if (!firstName || !lastName || !positionApplied || !currentPosition || experienceYears === undefined) {
        return res.status(400).json({ message: 'All fields are required.' });
      }
      const expNum = Number(experienceYears);
      if (!Number.isFinite(expNum) || expNum < 0) {
        return res.status(400).json({ message: 'Experience in Years must be a non-negative number.' });
      }

      if (!req.file) return res.status(400).json({ message: 'Resume (PDF) is required.' });
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ message: 'Resume must be a PDF.' });
      }

      // ensure db ready
      const conn = mongoose.connection;
      if (!conn?.db) return res.status(500).json({ message: 'Database not ready' });

      // save resume to GridFS
      const file = await saveBufferToGridFS({
        db: conn.db,
        bucketName: 'resumes',
        filename: req.file.originalname || 'resume.pdf',
        contentType: req.file.mimetype,
        buffer: req.file.buffer,
        metadata: { fieldname: 'resume' }
      });

      // create candidate doc
      const candidate = new Candidate({
        firstName,
        lastName,
        positionApplied,
        currentPosition,
        experienceYears: expNum,
        resumeFileId: file._id
      });
      await candidate.save();

      return res.json({ message: 'Candidate saved', candidateId: candidate._id });
    } catch (err) {
      console.error('Resume upload error:', err);
      return res.status(500).json({
        message: 'Error saving candidate/resume',
        error: err?.message || String(err)
      });
    }
  });
});

/* -------------------------- Upload video (≤ 90s client) -------------------------- */
router.post('/candidate/:id/video', (req, res, next) => {
  uploadVideo.single('video')(req, res, async (multerErr) => {
    if (multerErr) return next(multerErr);

    try {
      const candidateId = req.params.id;
      if (!ObjectId.isValid(candidateId)) {
        return res.status(400).json({ message: 'Invalid candidate id' });
      }

      const candidate = await Candidate.findById(candidateId);
      if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

      if (!req.file) return res.status(400).json({ message: 'Video is required' });
      const allowed = ['video/webm', 'video/mp4', 'video/x-matroska'];
      if (!allowed.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Unsupported video format' });
      }

      const conn = mongoose.connection;
      if (!conn?.db) return res.status(500).json({ message: 'Database not ready' });

      const file = await saveBufferToGridFS({
        db: conn.db,
        bucketName: 'videos',
        filename: req.file.originalname || 'video.webm',
        contentType: req.file.mimetype,
        buffer: req.file.buffer,
        metadata: { candidateId }
      });

      candidate.videoFileId = file._id;
      await candidate.save();

      return res.json({ message: 'Video uploaded', videoFileId: file._id });
    } catch (err) {
      console.error('Video upload error:', err);
      return res.status(500).json({
        message: 'Error saving video',
        error: err?.message || String(err)
      });
    }
  });
});

/* ------------------------------- Get candidate ------------------------------- */
router.get('/candidate/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id).lean();
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });
    return res.json(candidate);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err?.message || String(err) });
  }
});

/* ----------------------------- Download resume ----------------------------- */
router.get('/file/resume/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!ObjectId.isValid(fileId)) return res.status(400).send('Invalid file id');

    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'resumes' });
    const filesColl = db.collection('resumes.files');
    const doc = await filesColl.findOne({ _id: new ObjectId(fileId) });
    if (!doc) return res.status(404).send('File not found');

    res.set('Content-Type', doc.contentType || 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${doc.filename}"`);
    bucket.openDownloadStream(new ObjectId(fileId)).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

/* ------------------------- Stream video (with range) ------------------------- */
router.get('/file/video/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!ObjectId.isValid(fileId)) return res.status(400).send('Invalid file id');

    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'videos' });
    const filesColl = db.collection('videos.files');
    const doc = await filesColl.findOne({ _id: new ObjectId(fileId) });
    if (!doc) return res.status(404).send('File not found');

    const range = req.headers.range;
    if (!range) {
      res.set('Content-Type', doc.contentType || 'video/webm');
      return bucket.openDownloadStream(new ObjectId(fileId)).pipe(res);
    }

    const fileSize = doc.length;
    const [startStr, endStr] = range.replace('bytes=', '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': (end - start) + 1,
      'Content-Type': doc.contentType || 'video/webm'
    });

    bucket.openDownloadStream(new ObjectId(fileId), { start, end }).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

/* ----------------------- Multer & general error handler ---------------------- */
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File too large', error: 'Max size exceeded' });
    }
    return res.status(400).json({ message: 'Upload error', error: err.message });
  }
  if (err) {
    console.error('Unhandled route error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message || String(err) });
  }
});

module.exports = router;
