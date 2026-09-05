const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

// UTC-anchored midnight for "n days ago" — see attendance.controller.js's
// dayStart() for why plain setHours(0,0,0,0) silently shifts a day off
// against @db.Date columns in +UTC timezones.
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function buildWhere({ categoryCode, from, to, linkType, linkId }) {
  return {
    ...(categoryCode && { categoryCode }),
    ...(linkType && { linkType }),
    ...(linkId && { linkId }),
    ...((from || to) && {
      expenseDate: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    }),
  };
}

// GET /api/expenses — SUPER_ADMIN sees everything; EMPLOYEE is hard-scoped to
// their own USER-linked records. Category/date filters still apply within
// that scope, but linkType/linkId are always overwritten AFTER buildWhere so
// nothing an Employee sends in the query string can widen their own view.
async function list(req, res) {
  const where = buildWhere(req.query);
  if (req.user.role === 'EMPLOYEE') {
    where.linkType = 'USER';
    where.linkId = req.user.id;
  }
  const rows = await prisma.expense.findMany({
    where,
    include: {
      category: { select: { code: true, label: true } },
      recordedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { expenseDate: 'desc' },
  });
  return sendSuccess(res, 200, rows);
}

// GET /api/expenses/summary — totals used by dashboards, analytics and the Expenses page.
async function summary(req, res) {
  const where = buildWhere(req.query);
  const since = daysAgo(30);

  const [totalAgg, last30Agg, byCategory, categories] = await Promise.all([
    prisma.expense.aggregate({ where, _sum: { amount: true }, _count: { _all: true } }),
    prisma.expense.aggregate({ where: { ...where, expenseDate: { ...(where.expenseDate || {}), gte: since } }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ['categoryCode'], where, _sum: { amount: true } }),
    prisma.expenseCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] }),
  ]);

  const byCategoryMap = Object.fromEntries(byCategory.map((c) => [c.categoryCode, c._sum.amount || 0]));

  return sendSuccess(res, 200, {
    total: totalAgg._sum.amount || 0,
    count: totalAgg._count._all,
    last30Days: last30Agg._sum.amount || 0,
    byCategory: categories.map((c) => ({ code: c.code, label: c.label, total: byCategoryMap[c.code] || 0 })),
  });
}

// POST /api/expenses
async function create(req, res) {
  const { categoryCode, title, description, amount, expenseDate, paymentMode, reference, vendor, linkType, linkId } = req.body;
  if (!categoryCode || !title || !amount || !expenseDate) {
    throw new ApiError(400, 'categoryCode, title, amount and expenseDate are required');
  }
  if (Number(amount) <= 0) throw new ApiError(400, 'Amount must be a positive number');

  const category = await prisma.expenseCategory.findUnique({ where: { code: categoryCode } });
  if (!category) throw new ApiError(400, 'Unknown expense category');

  const row = await prisma.expense.create({
    data: {
      categoryCode,
      title,
      description: description || null,
      amount: Number(amount),
      expenseDate: new Date(expenseDate),
      paymentMode: paymentMode || null,
      reference: reference || null,
      vendor: vendor || null,
      linkType: linkType || null,
      linkId: linkId || null,
      recordedById: req.user.id,
    },
    include: {
      category: { select: { code: true, label: true } },
      recordedBy: { select: { firstName: true, lastName: true } },
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'EXPENSE', entityId: row.id, entityLabel: `${row.title} (₹${row.amount})`, after: row });
  return sendSuccess(res, 201, row);
}

// PUT /api/expenses/:id
async function update(req, res) {
  const before = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Expense not found');

  const { categoryCode, title, description, amount, expenseDate, paymentMode, reference, vendor, linkType, linkId } = req.body;

  if (categoryCode !== undefined) {
    const category = await prisma.expenseCategory.findUnique({ where: { code: categoryCode } });
    if (!category) throw new ApiError(400, 'Unknown expense category');
  }
  if (amount !== undefined && Number(amount) <= 0) throw new ApiError(400, 'Amount must be a positive number');

  const row = await prisma.expense.update({
    where: { id: req.params.id },
    data: {
      ...(categoryCode !== undefined && { categoryCode }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(amount !== undefined && { amount: Number(amount) }),
      ...(expenseDate !== undefined && { expenseDate: new Date(expenseDate) }),
      ...(paymentMode !== undefined && { paymentMode: paymentMode || null }),
      ...(reference !== undefined && { reference: reference || null }),
      ...(vendor !== undefined && { vendor: vendor || null }),
      ...(linkType !== undefined && { linkType: linkType || null }),
      ...(linkId !== undefined && { linkId: linkId || null }),
    },
    include: {
      category: { select: { code: true, label: true } },
      recordedBy: { select: { firstName: true, lastName: true } },
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'EXPENSE', entityId: row.id, entityLabel: `${row.title} (₹${row.amount})`, before, after: row });
  return sendSuccess(res, 200, row);
}

// DELETE /api/expenses/:id — Super Admin only (route-gated), matching the
// hardcoded-delete pattern used across every other module in this app.
async function remove(req, res) {
  const before = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Expense not found');
  await prisma.expense.delete({ where: { id: req.params.id } });
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'EXPENSE', entityId: before.id, entityLabel: `${before.title} (₹${before.amount})`, before });
  return sendSuccess(res, 200, { message: 'Expense removed' });
}

module.exports = { list, summary, create, update, remove };
