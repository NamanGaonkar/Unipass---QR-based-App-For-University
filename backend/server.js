require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const CAMPUS_KEY = process.env.CAMPUS_SHARED_KEY || 'unipass-campus-2026';
const WINDOW_SECONDS = Number(process.env.EPOCH_WINDOW_SECONDS || 60);
const CAMPUS_WIFI_TAG = process.env.CAMPUS_WIFI_TAG || 'AITD-CAMPUS';

const dbDir = path.join(__dirname, 'data');
const dbFile = path.join(dbDir, 'local-db.json');

const normalize = (value) => String(value || '').trim().toUpperCase();

const ensureDb = () => {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (!fs.existsSync(dbFile)) {
    const initialData = {
      subjects: [
        {
          id: 'SUBJ-EC301',
          code: 'EC301',
          name: 'Signals and Systems',
          semester: '5',
          createdAt: Date.now(),
        },
      ],
      attendance: [],
    };

    fs.writeFileSync(dbFile, JSON.stringify(initialData, null, 2));
  }
};

const readDb = () => {
  ensureDb();
  const raw = fs.readFileSync(dbFile, 'utf8');
  return JSON.parse(raw);
};

const writeDb = (nextDb) => {
  fs.writeFileSync(dbFile, JSON.stringify(nextDb, null, 2));
};

const epochWindow = (timestamp) => Math.floor(Number(timestamp) / (WINDOW_SECONDS * 1000));

const createTokenSignature = ({ teacherId, subjectCode, epoch }) => {
  const payload = `${normalize(teacherId)}|${normalize(subjectCode)}|${Number(epoch)}|${CAMPUS_KEY}`;
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 20);
};

const createProofSignature = ({ studentId, studentName, teacherId, subjectCode, epoch }) => {
  const payload = [
    normalize(studentId),
    normalize(studentName),
    normalize(teacherId),
    normalize(subjectCode),
    Number(epoch),
    CAMPUS_KEY,
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 24);
};

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'campus-local',
    wifi: CAMPUS_WIFI_TAG,
    epochWindowSeconds: WINDOW_SECONDS,
    timestamp: Date.now(),
  });
});

app.get('/api/admin/subjects', (req, res) => {
  const db = readDb();
  res.json({ subjects: db.subjects || [] });
});

app.post('/api/admin/subjects', (req, res) => {
  const db = readDb();
  const code = normalize(req.body.code);
  const name = String(req.body.name || '').trim();
  const semester = String(req.body.semester || '').trim();

  if (!code || !name) {
    return res.status(400).json({ error: 'Subject code and name are required.' });
  }

  const duplicate = (db.subjects || []).some((item) => normalize(item.code) === code);
  if (duplicate) {
    return res.status(409).json({ error: 'Subject code already exists.' });
  }

  const subject = {
    id: `SUBJ-${code}`,
    code,
    name,
    semester,
    createdAt: Date.now(),
  };

  db.subjects = [subject, ...(db.subjects || [])];
  writeDb(db);
  res.status(201).json({ subject });
});

app.delete('/api/admin/subjects/:subjectId', (req, res) => {
  const db = readDb();
  const before = db.subjects.length;
  db.subjects = db.subjects.filter((item) => item.id !== req.params.subjectId);

  if (db.subjects.length === before) {
    return res.status(404).json({ error: 'Subject not found.' });
  }

  writeDb(db);
  res.json({ success: true });
});

app.put('/api/admin/subjects/:subjectId', (req, res) => {
  const db = readDb();
  const subjectId = String(req.params.subjectId || '').trim();
  const code = normalize(req.body.code);
  const name = String(req.body.name || '').trim();
  const semester = String(req.body.semester || '').trim();

  if (!code || !name) {
    return res.status(400).json({ error: 'Subject code and name are required.' });
  }

  const existingIndex = (db.subjects || []).findIndex((item) => item.id === subjectId);
  if (existingIndex < 0) {
    return res.status(404).json({ error: 'Subject not found.' });
  }

  const duplicateCode = (db.subjects || []).some(
    (item, idx) => idx !== existingIndex && normalize(item.code) === code
  );

  if (duplicateCode) {
    return res.status(409).json({ error: 'Another subject already uses this code.' });
  }

  const updated = {
    ...db.subjects[existingIndex],
    code,
    name,
    semester,
    updatedAt: Date.now(),
  };

  db.subjects[existingIndex] = updated;
  writeDb(db);
  res.json({ subject: updated });
});

app.get('/api/teacher/subjects', (req, res) => {
  const db = readDb();
  res.json({ subjects: db.subjects || [] });
});

app.get('/api/teacher/attendance-summary', (req, res) => {
  const teacherId = normalize(req.query.teacherId);
  const subjectId = String(req.query.subjectId || '').trim();
  const subjectCode = normalize(req.query.subjectCode);
  const epoch = Number(req.query.epoch);

  if (!teacherId || (!subjectId && !subjectCode)) {
    return res.status(400).json({ error: 'teacherId and (subjectId or subjectCode) are required.' });
  }

  const db = readDb();
  const source = Array.isArray(db.attendance) ? db.attendance : [];

  const filtered = source.filter((entry) => {
    const sameTeacher = normalize(entry.teacherId) === teacherId;
    const sameSubject = subjectId
      ? String(entry.subjectId || '').trim() === subjectId
      : normalize(entry.subjectCode) === subjectCode;
    const sameEpoch = Number.isFinite(epoch) ? Number(entry.epoch) === epoch : true;
    return sameTeacher && sameSubject && sameEpoch;
  });

  const students = filtered
    .map((entry) => ({
      attendanceId: entry.id,
      studentId: entry.studentId,
      studentName: entry.studentName,
      markedAt: entry.markedAt,
      epoch: entry.epoch,
    }))
    .sort((a, b) => Number(b.markedAt) - Number(a.markedAt));

  res.json({
    teacherId,
    subjectId: subjectId || null,
    subjectCode,
    epoch: Number.isFinite(epoch) ? epoch : null,
    count: students.length,
    students,
  });
});

app.post('/api/teacher/generate-session', (req, res) => {
  const teacherId = normalize(req.body.teacherId);
  const teacherName = String(req.body.teacherName || '').trim();
  const subjectCode = normalize(req.body.subjectCode);

  if (!teacherId || !teacherName || !subjectCode) {
    return res.status(400).json({ error: 'teacherId, teacherName, subjectCode are required.' });
  }

  const db = readDb();
  const subject = (db.subjects || []).find((item) => normalize(item.code) === subjectCode);
  if (!subject) {
    return res.status(404).json({ error: 'Subject not configured by admin.' });
  }

  const issuedAt = Date.now();
  const epoch = epochWindow(issuedAt);

  const qrPayload = {
    v: 1,
    kind: 'teacher-session',
    campus: 'AITD',
    wifiTag: CAMPUS_WIFI_TAG,
    teacherId,
    teacherName,
    subjectId: subject.id,
    subjectCode: subject.code,
    subjectName: subject.name,
    epoch,
    issuedAt,
    expiresAt: (epoch + 1) * WINDOW_SECONDS * 1000,
  };

  qrPayload.sig = createTokenSignature({
    teacherId: qrPayload.teacherId,
    subjectCode: qrPayload.subjectCode,
    epoch: qrPayload.epoch,
  });

  res.json({
    qrPayload,
    qrText: JSON.stringify(qrPayload),
    expiresInSeconds: Math.max(0, Math.floor((qrPayload.expiresAt - Date.now()) / 1000)),
  });
});

app.post('/api/student/mark-attendance', (req, res) => {
  const studentId = normalize(req.body.studentId);
  const studentName = String(req.body.studentName || '').trim();
  const qrPayload = req.body.qrPayload;

  if (!studentId || !studentName || !qrPayload) {
    return res.status(400).json({ error: 'studentId, studentName, qrPayload are required.' });
  }

  if (qrPayload.kind !== 'teacher-session') {
    return res.status(400).json({ error: 'Invalid QR type.' });
  }

  const now = Date.now();
  const nowEpoch = epochWindow(now);

  const subjectIdFromQr = String(qrPayload.subjectId || '').trim();
  const subjectCodeFromQr = normalize(qrPayload.subjectCode);

  const db = readDb();
  const activeSubject = (db.subjects || []).find((item) => {
    if (subjectIdFromQr) {
      return item.id === subjectIdFromQr;
    }
    return normalize(item.code) === subjectCodeFromQr;
  });

  if (!activeSubject) {
    return res.status(400).json({ error: 'Subject not available anymore. Ask teacher to generate a new QR.' });
  }

  const expectedSig = createTokenSignature({
    teacherId: qrPayload.teacherId,
    subjectCode: qrPayload.subjectCode,
    epoch: qrPayload.epoch,
  });

  if (expectedSig !== qrPayload.sig) {
    return res.status(400).json({ error: 'QR signature mismatch.' });
  }

  if (Math.abs(nowEpoch - Number(qrPayload.epoch)) > 1) {
    return res.status(400).json({ error: 'QR expired. Ask teacher to refresh QR.' });
  }

  const proof = createProofSignature({
    studentId,
    studentName,
    teacherId: qrPayload.teacherId,
    subjectCode: qrPayload.subjectCode,
    epoch: qrPayload.epoch,
  });

  const attendanceId = `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const duplicate = (db.attendance || []).find(
    (entry) =>
      normalize(entry.studentId) === studentId &&
      normalize(entry.teacherId) === normalize(qrPayload.teacherId) &&
      (subjectIdFromQr
        ? String(entry.subjectId || '').trim() === subjectIdFromQr
        : normalize(entry.subjectCode) === subjectCodeFromQr) &&
      Number(entry.epoch) === Number(qrPayload.epoch)
  );

  if (duplicate) {
    return res.status(409).json({
      error: 'Attendance already marked for this epoch window.',
      attendance: duplicate,
    });
  }

  const record = {
    id: attendanceId,
    studentId,
    studentName,
    teacherId: normalize(qrPayload.teacherId),
    teacherName: String(qrPayload.teacherName || '').trim(),
    subjectId: activeSubject.id,
    subjectCode: normalize(activeSubject.code),
    subjectName: String(activeSubject.name || '').trim(),
    epoch: Number(qrPayload.epoch),
    markedAt: now,
    proof,
  };

  db.attendance = [record, ...(db.attendance || [])];
  writeDb(db);

  res.json({
    success: true,
    message: 'Attendance marked successfully.',
    attendance: record,
  });
});

app.get('/api/admin/attendance', (req, res) => {
  const db = readDb();
  res.json({ attendance: db.attendance || [] });
});

app.listen(PORT, () => {
  ensureDb();
  // eslint-disable-next-line no-console
  console.log(`UniPass local backend running on http://localhost:${PORT}`);
});
