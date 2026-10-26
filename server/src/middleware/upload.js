import multer from 'multer';
import { env } from '../config/env.js';

export const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxPdfMb * 1024 * 1024, files: 1, fields: 10 },
  fileFilter(req, file, cb) {
    const ok = file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname);
    if (ok) return cb(null, true);
    const err = new Error('Resume must be a PDF file');
    err.status = 400;
    cb(err);
  },
}).single('resume');
