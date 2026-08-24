const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

// Builds list/create/update/remove handlers for a "code as primary key"
// master table — Designation, Location, EmploymentType and CollegeType all
// share this exact shape, and Task/Timesheet/Leave statuses now do too.
function buildCodeMasterCrud({ model, auditModule, countRelation, extraFields = [] }) {
  async function list(req, res) {
    const rows = await prisma[model].findMany({
      include: countRelation ? { _count: { select: { [countRelation]: true } } } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    return sendSuccess(res, 200, rows);
  }

  async function create(req, res) {
    const { code, label, sortOrder, ...rest } = req.body;
    if (!code || !label) throw new ApiError(400, 'code and label are required');
    const data = { code: code.toUpperCase().replace(/\s+/g, '_'), label, sortOrder: sortOrder ?? 0 };
    for (const f of extraFields) if (rest[f] !== undefined) data[f] = rest[f];
    const row = await prisma[model].create({ data });
    await recordAudit({ actorId: req.user.id, action: 'CREATED', module: auditModule, entityId: row.code, entityLabel: row.label, after: row });
    return sendSuccess(res, 201, row);
  }

  async function update(req, res) {
    const { label, active, sortOrder, ...rest } = req.body;
    const before = await prisma[model].findUnique({ where: { code: req.params.code } });
    if (!before) throw new ApiError(404, 'Not found');
    const data = {};
    if (label !== undefined) data.label = label;
    if (active !== undefined) data.active = active;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    for (const f of extraFields) if (rest[f] !== undefined) data[f] = rest[f];
    const row = await prisma[model].update({ where: { code: req.params.code }, data });
    await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: auditModule, entityId: row.code, entityLabel: row.label, before, after: row });
    return sendSuccess(res, 200, row);
  }

  async function remove(req, res) {
    const before = await prisma[model].findUnique({
      where: { code: req.params.code },
      include: countRelation ? { _count: { select: { [countRelation]: true } } } : undefined,
    });
    if (!before) throw new ApiError(404, 'Not found');
    if (countRelation && before._count[countRelation] > 0) {
      throw new ApiError(400, `Cannot delete: ${before._count[countRelation]} record(s) still use this. Reassign them first.`);
    }
    await prisma[model].delete({ where: { code: req.params.code } });
    await recordAudit({ actorId: req.user.id, action: 'DELETED', module: auditModule, entityId: before.code, entityLabel: before.label, before });
    return sendSuccess(res, 200, { message: 'Removed' });
  }

  return { list, create, update, remove };
}

module.exports = { buildCodeMasterCrud };
