const multer = require('multer');
const ApiError = require('../utils/apiError');

// Memory storage, not disk — the file is transient input for a one-shot
// import and is never retained (unlike middleware/upload.js's intern
// documents, which are permanent records written to disk).
const ALLOWED_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'];
// Matches the shared errorHandler's existing LIMIT_FILE_SIZE message
// ("File exceeds the 5MB size limit") rather than introducing a
// differently-worded limit for this one endpoint.
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function fileFilter(req, file, cb) {
  const looksLikeCsv = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.csv');
  if (!looksLikeCsv) {
    return cb(new ApiError(400, 'Only .csv files are allowed'));
  }
  cb(null, true);
}

const csvUpload = multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

module.exports = csvUpload;
