/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

async function main() {
  console.log('Seeding VertexWM database...');
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // --- Departments ----------------------------------------------------------
  const engineering = await prisma.department.upsert({
    where: { name: 'Engineering' },
    update: {},
    create: { name: 'Engineering', description: 'Product engineering and platform teams' },
  });
  const marketing = await prisma.department.upsert({
    where: { name: 'Marketing' },
    update: {},
    create: { name: 'Marketing', description: 'Brand, growth and communications' },
  });
  const operations = await prisma.department.upsert({
    where: { name: 'Operations' },
    update: {},
    create: { name: 'Operations', description: 'HR, finance and business operations' },
  });

  // --- Super Admin ------------------------------------------------------------
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@vertexwm.com' },
    update: {},
    create: {
      email: 'superadmin@vertexwm.com',
      password: hash,
      firstName: 'Avery',
      lastName: 'Sterling',
      role: 'SUPER_ADMIN',
      designation: 'Managing Director',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      departmentId: operations.id,
    },
  });

  // --- Admins (Managers) ------------------------------------------------------
  const engManager = await prisma.user.upsert({
    where: { email: 'admin.eng@vertexwm.com' },
    update: {},
    create: {
      email: 'admin.eng@vertexwm.com',
      password: hash,
      firstName: 'Priya',
      lastName: 'Nair',
      role: 'ADMIN',
      designation: 'Engineering Manager',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      departmentId: engineering.id,
      managerId: superAdmin.id,
    },
  });
  const mktManager = await prisma.user.upsert({
    where: { email: 'admin.marketing@vertexwm.com' },
    update: {},
    create: {
      email: 'admin.marketing@vertexwm.com',
      password: hash,
      firstName: 'Jordan',
      lastName: 'Blake',
      role: 'ADMIN',
      designation: 'Marketing Manager',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      departmentId: marketing.id,
      managerId: superAdmin.id,
    },
  });

  await prisma.department.update({ where: { id: engineering.id }, data: { headId: engManager.id } });
  await prisma.department.update({ where: { id: marketing.id }, data: { headId: mktManager.id } });

  // --- Employees ---------------------------------------------------------------
  const employee1 = await prisma.user.upsert({
    where: { email: 'employee1@vertexwm.com' },
    update: {},
    create: {
      email: 'employee1@vertexwm.com',
      password: hash,
      firstName: 'Sam',
      lastName: 'Okafor',
      role: 'EMPLOYEE',
      designation: 'Senior Software Engineer',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      departmentId: engineering.id,
      managerId: engManager.id,
    },
  });
  const employee2 = await prisma.user.upsert({
    where: { email: 'employee2@vertexwm.com' },
    update: {},
    create: {
      email: 'employee2@vertexwm.com',
      password: hash,
      firstName: 'Lena',
      lastName: 'Morozova',
      role: 'EMPLOYEE',
      designation: 'Marketing Specialist',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      departmentId: marketing.id,
      managerId: mktManager.id,
    },
  });

  // --- Interns -----------------------------------------------------------------
  const intern1 = await prisma.user.upsert({
    where: { email: 'intern1@vertexwm.com' },
    update: {},
    create: {
      email: 'intern1@vertexwm.com',
      password: hash,
      firstName: 'Noah',
      lastName: 'Kim',
      role: 'INTERN',
      designation: 'Software Engineering Intern',
      employmentType: 'INTERN',
      status: 'ACTIVE',
      departmentId: engineering.id,
      managerId: engManager.id,
    },
  });
  const intern2 = await prisma.user.upsert({
    where: { email: 'intern2@vertexwm.com' },
    update: {},
    create: {
      email: 'intern2@vertexwm.com',
      password: hash,
      firstName: 'Zara',
      lastName: 'Ahmed',
      role: 'INTERN',
      designation: 'Marketing Intern',
      employmentType: 'INTERN',
      status: 'ACTIVE',
      departmentId: marketing.id,
      managerId: mktManager.id,
    },
  });

  // --- Internship batch & enrollments ------------------------------------------
  const batch = await prisma.internshipBatch.upsert({
    where: { id: 'seed-batch-2026-summer' },
    update: {},
    create: {
      id: 'seed-batch-2026-summer',
      name: 'Summer 2026 Internship Program',
      program: 'Software & Marketing Track',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-08-31'),
      status: 'ONGOING',
      description: 'Cross-functional summer internship cohort',
    },
  });

  await prisma.internEnrollment.upsert({
    where: { userId: intern1.id },
    update: {},
    create: { userId: intern1.id, batchId: batch.id, mentorId: employee1.id, progressPercent: 45, performanceRating: 4.2 },
  });
  await prisma.internEnrollment.upsert({
    where: { userId: intern2.id },
    update: {},
    create: { userId: intern2.id, batchId: batch.id, mentorId: employee2.id, progressPercent: 60, performanceRating: 4.5 },
  });

  // --- Project & tasks -----------------------------------------------------------
  const project = await prisma.project.create({
    data: {
      name: 'VertexWM Platform Rollout',
      description: 'Internal rollout of the workforce management platform',
      status: 'ACTIVE',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-09-30'),
      managerId: engManager.id,
      members: {
        create: [{ userId: employee1.id }, { userId: intern1.id }],
      },
    },
  });

  await prisma.task.createMany({
    data: [
      {
        title: 'Design database schema',
        description: 'Finalize Prisma schema for all modules',
        type: 'PROJECT',
        priority: 'HIGH',
        status: 'DONE',
        progress: 100,
        projectId: project.id,
        assigneeId: employee1.id,
        createdById: engManager.id,
        completedAt: new Date(),
      },
      {
        title: 'Build attendance API',
        type: 'PROJECT',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        progress: 70,
        projectId: project.id,
        assigneeId: employee1.id,
        createdById: engManager.id,
        dueDate: new Date('2026-07-15'),
      },
      {
        title: 'Write unit tests for task module',
        type: 'DAILY',
        priority: 'MEDIUM',
        status: 'TODO',
        projectId: project.id,
        assigneeId: intern1.id,
        createdById: employee1.id,
        dueDate: new Date('2026-07-12'),
      },
      {
        title: 'Draft launch announcement',
        type: 'DAILY',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        progress: 30,
        assigneeId: employee2.id,
        createdById: mktManager.id,
        dueDate: new Date('2026-07-20'),
      },
      {
        title: 'Prepare social media assets',
        type: 'DAILY',
        priority: 'LOW',
        status: 'TODO',
        assigneeId: intern2.id,
        createdById: mktManager.id,
        dueDate: new Date('2026-07-18'),
      },
    ],
  });

  // --- Attendance (last 5 days) --------------------------------------------------
  const users = [superAdmin, engManager, mktManager, employee1, employee2, intern1, intern2];
  for (let i = 1; i <= 5; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    for (const u of users) {
      const clockIn = new Date(date);
      clockIn.setHours(9, Math.floor(Math.random() * 20), 0, 0);
      const clockOut = new Date(date);
      clockOut.setHours(18, Math.floor(Math.random() * 20), 0, 0);
      await prisma.attendance.upsert({
        where: { userId_date: { userId: u.id, date } },
        update: {},
        create: {
          userId: u.id,
          date,
          clockIn,
          clockOut,
          status: clockIn.getHours() > 9 ? 'LATE' : 'PRESENT',
          workHours: Math.round(((clockOut - clockIn) / 3600000) * 100) / 100,
        },
      });
    }
  }

  // --- Timesheets ------------------------------------------------------------------
  await prisma.timesheet.createMany({
    data: [
      { userId: employee1.id, date: new Date('2026-07-06'), projectId: project.id, hoursLogged: 6.5, description: 'API development', status: 'APPROVED', approverId: engManager.id, approvedAt: new Date() },
      { userId: employee1.id, date: new Date('2026-07-07'), projectId: project.id, hoursLogged: 7, description: 'Schema review', status: 'PENDING' },
      { userId: intern1.id, date: new Date('2026-07-07'), projectId: project.id, hoursLogged: 5, description: 'Test writing', status: 'PENDING' },
    ],
  });

  // --- Daily work updates -----------------------------------------------------------
  await prisma.dailyWorkUpdate.createMany({
    data: [
      {
        userId: employee1.id,
        date: new Date('2026-07-07'),
        summary: 'Completed schema review and started attendance API.',
        tasksCompleted: 'Schema design, DB migration',
        planForTomorrow: 'Continue attendance API endpoints',
        status: 'REVIEWED',
        managerFeedback: 'Great progress, keep it up.',
        reviewedById: engManager.id,
        reviewedAt: new Date(),
      },
      {
        userId: intern1.id,
        date: new Date('2026-07-07'),
        summary: 'Wrote initial unit tests for task creation.',
        blockers: 'Need clarification on validation rules',
        status: 'SUBMITTED',
      },
    ],
  });

  console.log('Seeding complete.');
  console.log('---------------------------------------------');
  console.log('Default password for all seeded users:', DEFAULT_PASSWORD);
  console.log('Super Admin:  superadmin@vertexwm.com');
  console.log('Admin (Eng):  admin.eng@vertexwm.com');
  console.log('Admin (Mkt):  admin.marketing@vertexwm.com');
  console.log('Employee:     employee1@vertexwm.com / employee2@vertexwm.com');
  console.log('Intern:       intern1@vertexwm.com / intern2@vertexwm.com');
  console.log('---------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
