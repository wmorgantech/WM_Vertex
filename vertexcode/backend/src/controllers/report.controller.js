const prisma = require('../config/db');
const { recordAudit } = require('../utils/audit');
const { sendReport } = require('../utils/exportReport');

const dateStamp = () => new Date().toISOString().slice(0, 10);

async function audited(req, module) {
  await recordAudit({ actorId: req.user.id, action: 'EXPORTED', module, entityId: req.user.id, entityLabel: `${module} report` });
}

async function exportEmployees(req, res) {
  const rows = await prisma.user.findMany({
    where: { role: { in: ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'] } },
    include: { department: true, location: true, manager: { select: { firstName: true, lastName: true } } },
    orderBy: { firstName: 'asc' },
  });
  await audited(req, 'EMPLOYEE_REPORT');
  return sendReport(req, res, `employees-${dateStamp()}`, rows, [
    { key: 'firstName', header: 'First Name' },
    { key: 'lastName', header: 'Last Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role' },
    { key: 'designation', header: 'Designation' },
    { key: 'department.name', header: 'Department' },
    { key: 'location.name', header: 'Location' },
    { key: 'manager.firstName', header: 'Manager First Name' },
    { key: 'manager.lastName', header: 'Manager Last Name' },
    { key: 'employmentType', header: 'Employment Type' },
    { key: 'status', header: 'Status' },
    { key: 'joinDate', header: 'Join Date', type: 'date' },
  ]);
}

async function exportAttendance(req, res) {
  const { from, to } = req.query;
  const rows = await prisma.attendance.findMany({
    where: (from || to) ? { date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : undefined,
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { date: 'desc' },
  });
  await audited(req, 'ATTENDANCE_REPORT');
  return sendReport(req, res, `attendance-${dateStamp()}`, rows, [
    { key: 'date', header: 'Date', type: 'date' },
    { key: 'user.firstName', header: 'First Name' },
    { key: 'user.lastName', header: 'Last Name' },
    { key: 'user.email', header: 'Email' },
    { key: 'clockIn', header: 'Clock In', type: 'datetime' },
    { key: 'clockOut', header: 'Clock Out', type: 'datetime' },
    { key: 'workHours', header: 'Work Hours', type: 'number' },
    { key: 'status', header: 'Status' },
  ]);
}

async function exportTimesheets(req, res) {
  const { status } = req.query;
  const rows = await prisma.timesheet.findMany({
    where: status ? { status } : undefined,
    include: {
      user: { select: { firstName: true, lastName: true } },
      project: { select: { name: true } },
      approver: { select: { firstName: true, lastName: true } },
    },
    orderBy: { date: 'desc' },
  });
  await audited(req, 'TIMESHEET_REPORT');
  return sendReport(req, res, `timesheets-${dateStamp()}`, rows, [
    { key: 'date', header: 'Date', type: 'date' },
    { key: 'user.firstName', header: 'First Name' },
    { key: 'user.lastName', header: 'Last Name' },
    { key: 'project.name', header: 'Project' },
    { key: 'hoursLogged', header: 'Hours Logged', type: 'number' },
    { key: 'description', header: 'Description' },
    { key: 'status', header: 'Status' },
    { key: 'approver.firstName', header: 'Approved By' },
  ]);
}

async function exportTasks(req, res) {
  const { status } = req.query;
  const rows = await prisma.task.findMany({
    where: status ? { status } : undefined,
    include: {
      assignee: { select: { firstName: true, lastName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      project: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  await audited(req, 'TASK_REPORT');
  return sendReport(req, res, `tasks-${dateStamp()}`, rows, [
    { key: 'title', header: 'Title' },
    { key: 'project.name', header: 'Project' },
    { key: 'type', header: 'Type' },
    { key: 'priority', header: 'Priority' },
    { key: 'status', header: 'Status' },
    { key: 'progress', header: 'Progress %', type: 'number' },
    { key: 'assignee.firstName', header: 'Assignee First Name' },
    { key: 'assignee.lastName', header: 'Assignee Last Name' },
    { key: 'createdBy.firstName', header: 'Created By' },
    { key: 'dueDate', header: 'Due Date', type: 'date' },
    { key: 'completedAt', header: 'Completed At', type: 'datetime' },
  ]);
}

async function exportInterns(req, res) {
  const rows = await prisma.internEnrollment.findMany({
    include: {
      user: { select: { firstName: true, lastName: true, email: true, status: true } },
      batch: { select: { name: true, program: true } },
      mentor: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  await audited(req, 'INTERN_REPORT');
  return sendReport(req, res, `interns-${dateStamp()}`, rows, [
    { key: 'user.firstName', header: 'First Name' },
    { key: 'user.lastName', header: 'Last Name' },
    { key: 'user.email', header: 'Email' },
    { key: 'batch.name', header: 'Batch' },
    { key: 'mentor.firstName', header: 'Mentor First Name' },
    { key: 'mentor.lastName', header: 'Mentor Last Name' },
    { key: 'collegeName', header: 'College' },
    { key: 'category', header: 'Category' },
    { key: 'progressPercent', header: 'Progress %', type: 'number' },
    { key: 'performanceRating', header: 'Performance Rating', type: 'number' },
    { key: 'completionStatus', header: 'Status' },
    { key: 'user.status', header: 'Account Status' },
  ]);
}

async function exportTrainees(req, res) {
  const rows = await prisma.traineeEnrollment.findMany({
    include: {
      user: { select: { firstName: true, lastName: true, email: true, status: true } },
      program: { select: { name: true } },
      mentor: { select: { firstName: true, lastName: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  await audited(req, 'TRAINEE_REPORT');
  return sendReport(
    req,
    res,
    `trainees-${dateStamp()}`,
    rows.map((r) => ({
      ...r,
      totalPaid: r.payments.reduce((s, p) => s + p.amount, 0),
      balance: Math.max((r.finalFee ?? 0) - r.payments.reduce((s, p) => s + p.amount, 0), 0),
    })),
    [
      { key: 'user.firstName', header: 'First Name' },
      { key: 'user.lastName', header: 'Last Name' },
      { key: 'user.email', header: 'Email' },
      { key: 'program.name', header: 'Program' },
      { key: 'mentor.firstName', header: 'Mentor First Name' },
      { key: 'mentor.lastName', header: 'Mentor Last Name' },
      { key: 'progressPercent', header: 'Progress %', type: 'number' },
      { key: 'completionStatus', header: 'Status' },
      { key: 'finalFee', header: 'Final Fee', type: 'currency' },
      { key: 'totalPaid', header: 'Total Paid', type: 'currency' },
      { key: 'balance', header: 'Balance Due', type: 'currency' },
    ]
  );
}

// Filters mirror the Expenses page's on-screen filters exactly (category,
// date range) so the export always matches what's currently visible there —
// and, since Expense never stores income, this can never include revenue.
async function exportExpenses(req, res) {
  const { from, to, categoryCode } = req.query;
  const rows = await prisma.expense.findMany({
    where: {
      ...(categoryCode && { categoryCode }),
      ...((from || to) && { expenseDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    },
    include: {
      category: { select: { label: true } },
      recordedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { expenseDate: 'desc' },
  });
  await audited(req, 'EXPENSE_REPORT');
  return sendReport(req, res, `expenses-${dateStamp()}`, rows, [
    { key: 'expenseDate', header: 'Date', type: 'date' },
    { key: 'category.label', header: 'Category' },
    { key: 'title', header: 'Title' },
    { key: 'amount', header: 'Amount', type: 'currency' },
    { key: 'paymentMode', header: 'Payment Mode' },
    { key: 'vendor', header: 'Vendor' },
    { key: 'reference', header: 'Reference' },
    { key: 'recordedBy.firstName', header: 'Recorded By First Name' },
    { key: 'recordedBy.lastName', header: 'Recorded By Last Name' },
    { key: 'description', header: 'Description' },
  ], { totals: ['amount'], sheetName: 'Expenses' });
}

module.exports = {
  exportEmployees, exportAttendance, exportTimesheets, exportTasks, exportInterns, exportTrainees, exportExpenses,
};
