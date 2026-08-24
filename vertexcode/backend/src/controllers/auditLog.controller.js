const prisma = require('../config/db');
const { sendSuccess } = require('../utils/apiResponse');

async function listAuditLogs(req, res) {
  const { module, actorId, page = 1, limit = 50 } = req.query;
  const where = {
    ...(module && { module }),
    ...(actorId && { actorId }),
  };
  const take = Math.min(Number(limit) || 50, 200);
  const skip = (Number(page) - 1) * take;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return sendSuccess(res, 200, rows, { total, page: Number(page), limit: take });
}

module.exports = { listAuditLogs };
