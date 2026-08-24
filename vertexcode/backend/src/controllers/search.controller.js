const prisma = require('../config/db');
const { sendSuccess } = require('../utils/apiResponse');

const TAKE = 5;

// GET /api/search?q=... — Super Admin / Admin only. Every searchable
// category here (employees, interns, trainees, colleges, tasks, workshops,
// MOUs, training programs) is management data, so this is scoped to
// managers rather than trying to replicate each module's own visibility
// rules per result type.
async function search(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return sendSuccess(res, 200, {});

  const textMatch = (field) => ({ [field]: { contains: q, mode: 'insensitive' } });
  const nameMatch = {
    OR: [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ],
  };

  const [employees, interns, trainees, colleges, tasks, workshops, mous, programs] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'] }, ...nameMatch },
      select: { id: true, firstName: true, lastName: true, email: true },
      take: TAKE,
    }),
    prisma.internEnrollment.findMany({
      where: { user: nameMatch },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      take: TAKE,
    }),
    prisma.traineeEnrollment.findMany({
      where: { user: nameMatch },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      take: TAKE,
    }),
    prisma.college.findMany({ where: textMatch('name'), take: TAKE }),
    prisma.task.findMany({ where: textMatch('title'), take: TAKE }),
    prisma.workshop.findMany({
      where: textMatch('topic'),
      include: { college: { select: { name: true } } },
      take: TAKE,
    }),
    prisma.mOU.findMany({
      where: { mouType: { contains: q, mode: 'insensitive' } },
      include: { college: { select: { name: true } } },
      take: TAKE,
    }),
    prisma.trainingProgram.findMany({ where: textMatch('name'), take: TAKE }),
  ]);

  return sendSuccess(res, 200, {
    employees: employees.map((e) => ({ id: e.id, label: `${e.firstName} ${e.lastName}`, sub: e.email, link: `/employees/${e.id}` })),
    interns: interns.map((e) => ({ id: e.id, label: `${e.user.firstName} ${e.user.lastName}`, sub: e.user.email, link: '/interns' })),
    trainees: trainees.map((e) => ({ id: e.id, label: `${e.user.firstName} ${e.user.lastName}`, sub: e.user.email, link: `/trainees/${e.id}` })),
    colleges: colleges.map((c) => ({ id: c.id, label: c.name, sub: c.city, link: '/colleges' })),
    tasks: tasks.map((t) => ({ id: t.id, label: t.title, sub: t.status, link: '/tasks' })),
    workshops: workshops.map((w) => ({ id: w.id, label: w.topic, sub: w.college.name, link: '/workshops' })),
    mous: mous.map((m) => ({ id: m.id, label: m.mouType || 'MOU', sub: m.college.name, link: '/mous' })),
    trainingPrograms: programs.map((p) => ({ id: p.id, label: p.name, sub: p.status, link: '/trainees' })),
  });
}

module.exports = { search };
