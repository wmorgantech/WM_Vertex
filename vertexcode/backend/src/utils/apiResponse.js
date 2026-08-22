function sendSuccess(res, statusCode, data, meta = undefined) {
  const payload = { success: true, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
}

module.exports = { sendSuccess };
