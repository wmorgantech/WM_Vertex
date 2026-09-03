const prisma = require('../config/db');
const { sendSuccess } = require('../utils/apiResponse');
const { computeInternshipStage } = require('../utils/internshipStage');
const { evaluateRequiredDocs } = require('../utils/internDocumentRequirements');

// UTC-anchored midnight for "n days ago" on the local calendar — see
// attendance.controller.js's dayStart() for why plain setHours(0,0,0,0)
// silently shifts a day off against @db.Date columns in +UTC timezones.
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// GET /api/analytics/overview — org-wide KPIs (Super Admin / Admin)
async function overview(req, res) {
  const since = daysAgo(30);

  const [
    totalEmployees, totalInterns, totalTrainees, activeUsers, totalDepartments,
    totalProjects, activeProjects, totalTasks, tasksByStatus, unallocatedTasks,
    attendanceLast30, pendingTimesheets, pendingWorkUpdates,
    enrollmentsWithDocs,
    upcomingWorkshops, workshopFollowUpsOverdue, activeMous, mousExpiringSoon,
    expenseTotalAgg, expenseLast30Agg, expenseByCategory,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { in: ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' } }),
    prisma.user.count({ where: { role: 'INTERN' } }),
    prisma.user.count({ where: { role: 'TRAINEE' } }),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.department.count(),
    prisma.project.count(),
    prisma.project.count({ where: { status: 'ACTIVE' } }),
    prisma.task.count(),
    prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.task.count({ where: { assigneeId: null } }),
    prisma.attendance.findMany({ where: { date: { gte: since } }, select: { status: true, date: true, workHours: true } }),
    prisma.timesheet.count({ where: { status: 'PENDING' } }),
    prisma.dailyWorkUpdate.count({ where: { status: 'SUBMITTED' } }),
    // SUPER_ADMIN sees every enrollment; ADMIN only sees interns they mentor ("records assigned to them").
    prisma.internEnrollment.findMany({
      where: req.user.role === 'ADMIN' ? { mentorId: req.user.id } : {},
      include: {
        documents: true,
        user: { select: { firstName: true, lastName: true } },
        offerLetter: { select: { generatedAt: true } },
        certificate: { select: { generatedAt: true } },
      },
    }),
    prisma.workshop.count({ where: { status: { in: ['SCHEDULED', 'CONFIRMED'] } } }),
    prisma.workshop.count({ where: { followUpDate: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.mOU.count({ where: { status: 'ACTIVE' } }),
    prisma.mOU.count({
      where: { status: 'ACTIVE', endDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) } },
    }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: since } } }),
    prisma.expense.groupBy({ by: ['categoryCode'], _sum: { amount: true } }),
  ]);

  const attendanceByStatus = attendanceLast30.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const allDocs = enrollmentsWithDocs.flatMap((e) =>
    e.documents.map((d) => ({ ...d, internName: `${e.user.firstName} ${e.user.lastName}` }))
  );
  const pendingVerifications = allDocs.filter((d) => d.status === 'PENDING_REVIEW').length;
  const rejectedDocuments = allDocs.filter((d) => d.status === 'REJECTED').length;
  const requiredVerified = (e) => evaluateRequiredDocs(e.documents).satisfied;
  const verifiedInterns = enrollmentsWithDocs.filter(requiredVerified).length;
  const pendingApplications = enrollmentsWithDocs.filter((e) => requiredVerified(e) && !e.finalApprovedAt).length;
  const recentSubmissions = allDocs
    .filter((d) => d.status !== 'DRAFT')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 6)
    .map((d) => ({ id: d.id, internName: d.internName, type: d.type, status: d.status, updatedAt: d.updatedAt }));

  const payload = {
    headcount: { totalEmployees, totalInterns, totalTrainees, activeUsers, totalDepartments },
    projects: { totalProjects, activeProjects },
    tasks: {
      total: totalTasks,
      unallocated: unallocatedTasks,
      byStatus: tasksByStatus.map((t) => ({ status: t.status, count: t._count._all })),
    },
    attendance: { last30Days: attendanceByStatus },
    pendingApprovals: { timesheets: pendingTimesheets, workUpdates: pendingWorkUpdates },
    documents: { pendingVerifications, verifiedInterns, rejectedDocuments, pendingApplications, recentSubmissions },
    businessDevelopment: { upcomingWorkshops, workshopFollowUpsOverdue, activeMous, mousExpiringSoon },
  };

  // Finance / Reports / Offer Letters / Certificates / Audit Logs are Super-Admin-only
  // per the permission spec — not merely hidden by the frontend, actually absent from
  // the response for any other role so an Admin can't read them by inspecting network
  // traffic. Admin has no Expenses module access at all (expense.routes.js is
  // hardcoded isSuperAdmin), so the finance totals/category breakdown must not leak
  // here either.
  if (req.user.role === 'SUPER_ADMIN') {
    payload.finance = {
      totalExpenses: expenseTotalAgg._sum.amount || 0,
      last30DaysExpenses: expenseLast30Agg._sum.amount || 0,
      expensesByCategory: expenseByCategory.map((c) => ({ category: c.categoryCode, total: c._sum.amount || 0 })),
    };

    const categoryBreakdown = enrollmentsWithDocs.reduce((acc, e) => {
      const key = e.category || 'UNCATEGORIZED';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const stageBreakdown = enrollmentsWithDocs.reduce((acc, e) => {
      const stage = computeInternshipStage(e, e.documents, e.offerLetter, e.certificate);
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {});

    const offerLettersGenerated = enrollmentsWithDocs.filter((e) => e.offerLetter).length;
    const offerLettersPending = enrollmentsWithDocs.filter((e) => e.finalApprovedAt && !e.offerLetter).length;

    const now = new Date();
    const certificatesGenerated = enrollmentsWithDocs.filter((e) => e.certificate).length;
    const certificatesEligiblePending = enrollmentsWithDocs.filter((e) =>
      e.offerLetter && !e.certificate && e.internshipEndDate && now >= new Date(e.internshipEndDate)
    ).length;
    const certificatesNotYetEligible = enrollmentsWithDocs.filter((e) =>
      e.offerLetter && !e.certificate && (!e.internshipEndDate || now < new Date(e.internshipEndDate))
    ).length;

    const recentAudit = await prisma.internshipAudit.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        enrollment: { select: { user: { select: { firstName: true, lastName: true } } } },
        actor: { select: { firstName: true, lastName: true } },
      },
    });

    payload.reports = { categoryBreakdown, stageBreakdown };
    payload.offerLetters = { generated: offerLettersGenerated, pending: offerLettersPending };
    payload.certificates = {
      generated: certificatesGenerated,
      eligiblePending: certificatesEligiblePending,
      notYetEligible: certificatesNotYetEligible,
    };
    payload.audit = {
      recent: recentAudit.map((a) => ({
        id: a.id,
        action: a.action,
        internName: `${a.enrollment.user.firstName} ${a.enrollment.user.lastName}`,
        actorName: `${a.actor.firstName} ${a.actor.lastName}`,
        createdAt: a.createdAt,
      })),
    };
  }

  return sendSuccess(res, 200, payload);
}

// GET /api/analytics/team — manager's team performance snapshot
async function teamPerformance(req, res) {
  const { departmentId, managerId } = req.query;

  const where = {
    ...(departmentId && { departmentId }),
    ...(managerId && { managerId }),
    role: { in: ['EMPLOYEE', 'INTERN'] },
  };

  const users = await prisma.user.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, role: true, departmentId: true },
  });

  const since = daysAgo(30);
  const results = await Promise.all(
    users.map(async (u) => {
      const [tasksDone, tasksTotal, attendanceDays, hoursLogged] = await Promise.all([
        prisma.task.count({ where: { assigneeId: u.id, status: 'DONE' } }),
        prisma.task.count({ where: { assigneeId: u.id } }),
        prisma.attendance.count({ where: { userId: u.id, date: { gte: since }, status: { in: ['PRESENT', 'LATE'] } } }),
        prisma.timesheet.aggregate({ where: { userId: u.id, date: { gte: since }, status: 'APPROVED' }, _sum: { hoursLogged: true } }),
      ]);
      return {
        user: u,
        tasksDone,
        tasksTotal,
        taskCompletionRate: tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0,
        attendanceDaysLast30: attendanceDays,
        hoursLoggedLast30: hoursLogged._sum.hoursLogged || 0,
      };
    })
  );

  return sendSuccess(res, 200, results);
}

// GET /api/analytics/me — individual dashboard for employees/interns
async function myPerformance(req, res) {
  const userId = req.user.id;
  const since = daysAgo(30);

  const [tasksDone, tasksTotal, tasksOverdue, attendance, hoursLogged, pendingTimesheets, workUpdatesSubmitted] = await Promise.all([
    prisma.task.count({ where: { assigneeId: userId, status: 'DONE' } }),
    prisma.task.count({ where: { assigneeId: userId } }),
    prisma.task.count({ where: { assigneeId: userId, status: { not: 'DONE' }, dueDate: { lt: new Date() } } }),
    prisma.attendance.findMany({ where: { userId, date: { gte: since } }, select: { status: true, date: true, workHours: true } }),
    prisma.timesheet.aggregate({ where: { userId, date: { gte: since }, status: 'APPROVED' }, _sum: { hoursLogged: true } }),
    prisma.timesheet.count({ where: { userId, status: 'PENDING' } }),
    prisma.dailyWorkUpdate.count({ where: { userId, date: { gte: since } } }),
  ]);

  return sendSuccess(res, 200, {
    tasks: { done: tasksDone, total: tasksTotal, overdue: tasksOverdue },
    attendance: { last30Days: attendance },
    hoursLoggedLast30: hoursLogged._sum.hoursLogged || 0,
    pendingTimesheets,
    workUpdatesSubmittedLast30: workUpdatesSubmitted,
  });
}

// GET /api/analytics/interns — intern program performance
async function internPerformance(req, res) {
  const enrollments = await prisma.internEnrollment.findMany({
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      batch: { select: { id: true, name: true, status: true } },
      mentor: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const byStatus = enrollments.reduce((acc, e) => {
    acc[e.completionStatus] = (acc[e.completionStatus] || 0) + 1;
    return acc;
  }, {});

  const avgRating = enrollments.filter((e) => e.performanceRating != null);
  const averagePerformanceRating = avgRating.length
    ? Math.round((avgRating.reduce((s, e) => s + e.performanceRating, 0) / avgRating.length) * 100) / 100
    : null;

  return sendSuccess(res, 200, { enrollments, byStatus, averagePerformanceRating });
}

module.exports = { overview, teamPerformance, myPerformance, internPerformance };
