/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

async function main() {
  console.log('Seeding VertexWM database...');
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // --- Configurable master data (employment types, locations) --------------------
  await prisma.employmentType.createMany({
    data: [
      { code: 'FULL_TIME', label: 'Full-Time', sortOrder: 1 },
      { code: 'PART_TIME', label: 'Part-Time', sortOrder: 2 },
      { code: 'INTERN', label: 'Intern', sortOrder: 3 },
      { code: 'CONTRACT', label: 'Contract', sortOrder: 4 },
      { code: 'TRAINEE', label: 'Trainee', sortOrder: 5 },
    ],
    skipDuplicates: true,
  });

  await prisma.location.createMany({
    data: [
      { name: 'Chennai HQ', city: 'Chennai', sortOrder: 1 },
      { name: 'Bengaluru Office', city: 'Bengaluru', sortOrder: 2 },
      { name: 'Remote', sortOrder: 3 },
    ],
    skipDuplicates: true,
  });

  await prisma.collegeType.createMany({
    data: [
      { code: 'ENGINEERING', label: 'Engineering College', sortOrder: 1 },
      { code: 'ARTS_SCIENCE', label: 'Arts & Science College', sortOrder: 2 },
      { code: 'UNIVERSITY', label: 'University', sortOrder: 3 },
      { code: 'POLYTECHNIC', label: 'Polytechnic', sortOrder: 4 },
    ],
    skipDuplicates: true,
  });

  await prisma.leaveType.createMany({
    data: [
      { code: 'CASUAL', label: 'Casual Leave', paid: true, sortOrder: 1 },
      { code: 'SICK', label: 'Sick Leave', paid: true, sortOrder: 2 },
      { code: 'EARNED', label: 'Earned / Annual Leave', paid: true, sortOrder: 3 },
      { code: 'UNPAID', label: 'Unpaid Leave', paid: false, sortOrder: 4 },
    ],
    skipDuplicates: true,
  });

  await prisma.expenseCategory.createMany({
    data: [
      { code: 'SALARY', label: 'Salary & Payroll', sortOrder: 1 },
      { code: 'TRAVEL', label: 'Travel', sortOrder: 2 },
      { code: 'OFFICE', label: 'Office Expenses', sortOrder: 3 },
      { code: 'WORKSHOP_EVENT', label: 'Workshop / Event Expenses', sortOrder: 4 },
      { code: 'OPERATIONAL', label: 'Operational Expenses', sortOrder: 5 },
      { code: 'OTHER', label: 'Other', sortOrder: 6 },
    ],
    skipDuplicates: true,
  });

  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: 'VertexWM Software Solutions',
      companyAddress: 'Coimbatore, Tamil Nadu, India',
      signatoryName: 'Avery Sterling',
      signatoryTitle: 'Managing Director',
    },
  });

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

  // --- Designations (master list; Users reference these by name) -----------------
  await prisma.designation.createMany({
    data: [
      { name: 'Managing Director', departmentId: operations.id, sortOrder: 1 },
      { name: 'Engineering Manager', departmentId: engineering.id, sortOrder: 2 },
      { name: 'Marketing Manager', departmentId: marketing.id, sortOrder: 3 },
      { name: 'Senior Software Engineer', departmentId: engineering.id, sortOrder: 4 },
      { name: 'Senior Full Stack Developer', departmentId: engineering.id, sortOrder: 4 },
      { name: 'Marketing Specialist', departmentId: marketing.id, sortOrder: 5 },
      { name: 'Software Engineering Intern', departmentId: engineering.id, sortOrder: 6 },
      { name: 'Marketing Intern', departmentId: marketing.id, sortOrder: 7 },
    ],
    skipDuplicates: true,
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

  // --- Trainees ------------------------------------------------------------------
  const trainee1 = await prisma.user.upsert({
    where: { email: 'trainee1@vertexwm.com' },
    update: {},
    create: {
      email: 'trainee1@vertexwm.com',
      password: hash,
      firstName: 'Ravi',
      lastName: 'Menon',
      role: 'TRAINEE',
      employmentType: 'TRAINEE',
      status: 'ACTIVE',
      departmentId: engineering.id,
      managerId: engManager.id,
    },
  });
  const trainee2 = await prisma.user.upsert({
    where: { email: 'trainee2@vertexwm.com' },
    update: {},
    create: {
      email: 'trainee2@vertexwm.com',
      password: hash,
      firstName: 'Divya',
      lastName: 'Shetty',
      role: 'TRAINEE',
      employmentType: 'TRAINEE',
      status: 'ACTIVE',
      departmentId: engineering.id,
      managerId: engManager.id,
    },
  });

  // --- Training program, topics & trainee enrollments ---------------------------
  const trainingProgram = await prisma.trainingProgram.upsert({
    where: { id: 'seed-program-fullstack-2026' },
    update: {},
    create: {
      id: 'seed-program-fullstack-2026',
      name: 'Full-Stack .NET Trainee Program',
      description: 'Foundational to advanced full-stack training track',
      technology: '.NET / React',
      duration: '3 months',
      totalSessions: 9,
      trainerId: engManager.id,
      mentorId: employee1.id,
      fee: 30000,
      discount: 5000,
      finalFee: 25000,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-09-30'),
      status: 'ONGOING',
    },
  });

  const topicNames = ['C#', 'OOP', '.NET Core', 'Web API', 'SQL', 'Entity Framework', 'React', 'Azure', 'Project'];
  const topics = [];
  for (let i = 0; i < topicNames.length; i += 1) {
    const t = await prisma.trainingTopic.upsert({
      where: { id: `seed-topic-${trainingProgram.id}-${i}` },
      update: {},
      create: {
        id: `seed-topic-${trainingProgram.id}-${i}`,
        programId: trainingProgram.id,
        topic: topicNames[i],
        sequence: i + 1,
        expectedDurationHours: 8,
      },
    });
    topics.push(t);
  }

  const trainee1Enrollment = await prisma.traineeEnrollment.upsert({
    where: { userId: trainee1.id },
    update: {},
    create: {
      userId: trainee1.id,
      programId: trainingProgram.id,
      mentorId: employee1.id,
      progressPercent: 44,
      education: 'B.E. Computer Science',
      qualification: 'B.E.',
      experienceYears: 0,
      trainingStartDate: new Date('2026-07-01'),
      totalFee: 25000,
      discount: 5000,
      finalFee: 25000,
    },
  });
  await prisma.traineeEnrollment.upsert({
    where: { userId: trainee2.id },
    update: {},
    create: {
      userId: trainee2.id,
      programId: trainingProgram.id,
      mentorId: employee1.id,
      progressPercent: 22,
      education: 'B.Tech IT',
      qualification: 'B.Tech',
      experienceYears: 0.5,
      trainingStartDate: new Date('2026-07-01'),
      totalFee: 25000,
      discount: 5000,
      finalFee: 25000,
    },
  });

  // Trainee 1 has completed the first 4 topics
  for (let i = 0; i < 4; i += 1) {
    await prisma.traineeTopicProgress.upsert({
      where: { enrollmentId_topicId: { enrollmentId: trainee1Enrollment.id, topicId: topics[i].id } },
      update: {},
      create: {
        enrollmentId: trainee1Enrollment.id,
        topicId: topics[i].id,
        status: 'COMPLETED',
        assignmentStatus: 'REVIEWED',
        completedAt: new Date(),
      },
    });
  }

  await prisma.trainingSession.upsert({
    where: { id: 'seed-session-1' },
    update: {},
    create: {
      id: 'seed-session-1',
      programId: trainingProgram.id,
      topicId: topics[3].id,
      trainerId: engManager.id,
      mentorId: employee1.id,
      date: new Date('2026-08-20'),
      topicsCovered: 'Web API routing, controllers, DTOs',
      topicsPending: 'Authentication middleware',
      remarks: 'Good progress from the cohort',
    },
  });

  await prisma.traineePayment.upsert({
    where: { id: 'seed-payment-1' },
    update: {},
    create: {
      id: 'seed-payment-1',
      enrollmentId: trainee1Enrollment.id,
      amount: 15000,
      paymentMode: 'UPI',
      reference: 'TXN-SEED-001',
      recordedById: engManager.id,
    },
  });

  // --- Colleges, Workshops & MOUs -------------------------------------------------
  const college1 = await prisma.college.upsert({
    where: { name: 'Sri Ramakrishna Engineering College' },
    update: {},
    create: {
      name: 'Sri Ramakrishna Engineering College',
      typeCode: 'ENGINEERING',
      university: 'Anna University',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      contactPerson: 'Dr. Kavitha R',
      phone: '9876543210',
      email: 'placements@srec.example.edu',
      coordinator: 'Dr. Kavitha R',
    },
  });
  const college2 = await prisma.college.upsert({
    where: { name: 'PSG College of Technology' },
    update: {},
    create: {
      name: 'PSG College of Technology',
      typeCode: 'ENGINEERING',
      university: 'Anna University',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      contactPerson: 'Prof. Suresh Kumar',
      phone: '9876500000',
      email: 'training@psgtech.example.edu',
    },
  });

  const csDept = await prisma.collegeDepartment.upsert({
    where: { collegeId_name: { collegeId: college1.id, name: 'Computer Science' } },
    update: {},
    create: { collegeId: college1.id, name: 'Computer Science', contactPerson: 'Dr. Kavitha R', contactEmail: 'cs@srec.example.edu' },
  });

  await prisma.workshop.upsert({
    where: { id: 'seed-workshop-1' },
    update: {},
    create: {
      id: 'seed-workshop-1',
      collegeId: college1.id,
      collegeDepartmentId: csDept.id,
      contactPerson: 'Dr. Kavitha R',
      contactNumber: '9876543210',
      topic: 'Full-Stack Web Development',
      technology: 'React & .NET',
      proposedDate: new Date('2026-09-10'),
      duration: '1 day',
      expectedParticipants: 60,
      assignedEmployeeId: employee1.id,
      trainerId: engManager.id,
      status: 'SCHEDULED',
      confirmedDate: new Date('2026-09-10'),
    },
  });
  // Overdue follow-up, to demonstrate the FOLLOW-UP OVERDUE business rule.
  await prisma.workshop.upsert({
    where: { id: 'seed-workshop-2' },
    update: {},
    create: {
      id: 'seed-workshop-2',
      collegeId: college2.id,
      topic: 'Cloud & DevOps Fundamentals',
      technology: 'Azure',
      status: 'FOLLOW_UP_REQUIRED',
      assignedEmployeeId: employee2.id,
      followUpDate: new Date('2026-08-10'),
      discussionNotes: 'Initial discussion done, awaiting department confirmation.',
      nextAction: 'Call department coordinator to confirm date',
    },
  });

  await prisma.mOU.upsert({
    where: { id: 'seed-mou-1' },
    update: {},
    create: {
      id: 'seed-mou-1',
      collegeId: college1.id,
      contactPerson: 'Dr. Kavitha R',
      mouType: 'Internship & Training Partnership',
      purpose: 'Structured internship pipeline for final-year students',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      status: 'ACTIVE',
      assignedEmployeeId: engManager.id,
      signedDate: new Date('2026-01-01'),
    },
  });
  // Expiring within 30 days, to demonstrate the MOU EXPIRING SOON business rule.
  await prisma.mOU.upsert({
    where: { id: 'seed-mou-2' },
    update: {},
    create: {
      id: 'seed-mou-2',
      collegeId: college2.id,
      contactPerson: 'Prof. Suresh Kumar',
      mouType: 'Workshop Partnership',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-09-15'),
      status: 'ACTIVE',
      assignedEmployeeId: mktManager.id,
      signedDate: new Date('2025-09-01'),
    },
  });

  // --- Expenses (actual company spending) ---------------------------------------
  const seedExpenses = [
    {
      id: 'seed-expense-1',
      categoryCode: 'SALARY',
      title: `Monthly salary — ${engManager.firstName} ${engManager.lastName}`,
      amount: 75000,
      expenseDate: new Date('2026-08-01'),
      paymentMode: 'BANK_TRANSFER',
      linkType: 'USER',
      linkId: engManager.id,
      recordedById: superAdmin.id,
    },
    {
      id: 'seed-expense-2',
      categoryCode: 'SALARY',
      title: `Monthly salary — ${mktManager.firstName} ${mktManager.lastName}`,
      amount: 68000,
      expenseDate: new Date('2026-08-01'),
      paymentMode: 'BANK_TRANSFER',
      linkType: 'USER',
      linkId: mktManager.id,
      recordedById: superAdmin.id,
    },
    {
      id: 'seed-expense-3',
      categoryCode: 'WORKSHOP_EVENT',
      title: 'Full-Stack Web Development workshop — venue & materials',
      amount: 15000,
      expenseDate: new Date('2026-07-20'),
      paymentMode: 'UPI',
      vendor: 'SRI Engineering College',
      linkType: 'WORKSHOP',
      linkId: 'seed-workshop-1',
      recordedById: superAdmin.id,
    },
    {
      id: 'seed-expense-4',
      categoryCode: 'OFFICE',
      title: 'Office supplies & stationery',
      amount: 8500,
      expenseDate: new Date('2026-08-05'),
      paymentMode: 'CARD',
      vendor: 'Office Depot',
      recordedById: superAdmin.id,
    },
    {
      id: 'seed-expense-5',
      categoryCode: 'TRAVEL',
      title: 'Client visit travel — Bengaluru',
      amount: 6200,
      expenseDate: new Date('2026-08-12'),
      paymentMode: 'CARD',
      recordedById: superAdmin.id,
    },
  ];
  for (const e of seedExpenses) {
    await prisma.expense.upsert({ where: { id: e.id }, update: {}, create: e });
  }

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
  const project = await prisma.project.upsert({
    where: { id: 'seed-project-platform-rollout' },
    update: {},
    create: {
      id: 'seed-project-platform-rollout',
      name: 'VertexWM Platform Rollout',
      description: 'Internal rollout of the workforce management platform',
      status: 'ACTIVE',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-09-30'),
      managerId: engManager.id,
      members: {
        connectOrCreate: [
          { where: { projectId_userId: { projectId: 'seed-project-platform-rollout', userId: employee1.id } }, create: { userId: employee1.id } },
          { where: { projectId_userId: { projectId: 'seed-project-platform-rollout', userId: intern1.id } }, create: { userId: intern1.id } },
        ],
      },
    },
  });

  const seedTasks = [
    {
      id: 'seed-task-1', title: 'Design database schema', description: 'Finalize Prisma schema for all modules',
      type: 'PROJECT', priority: 'HIGH', status: 'DONE', progress: 100,
      projectId: project.id, assigneeId: employee1.id, createdById: engManager.id, completedAt: new Date(),
    },
    {
      id: 'seed-task-2', title: 'Build attendance API', type: 'PROJECT', priority: 'HIGH', status: 'IN_PROGRESS', progress: 70,
      projectId: project.id, assigneeId: employee1.id, createdById: engManager.id, dueDate: new Date('2026-07-15'),
    },
    {
      id: 'seed-task-3', title: 'Write unit tests for task module', type: 'DAILY', priority: 'MEDIUM', status: 'TODO',
      projectId: project.id, assigneeId: intern1.id, createdById: employee1.id, dueDate: new Date('2026-07-12'),
    },
    {
      id: 'seed-task-4', title: 'Draft launch announcement', type: 'DAILY', priority: 'MEDIUM', status: 'IN_PROGRESS', progress: 30,
      assigneeId: employee2.id, createdById: mktManager.id, dueDate: new Date('2026-07-20'),
    },
    {
      id: 'seed-task-5', title: 'Prepare social media assets', type: 'DAILY', priority: 'LOW', status: 'TODO',
      assigneeId: intern2.id, createdById: mktManager.id, dueDate: new Date('2026-07-18'),
    },
  ];
  for (const t of seedTasks) {
    const { id, ...data } = t;
    await prisma.task.upsert({ where: { id }, update: {}, create: { id, ...data } });
  }

  // --- Attendance (last 5 days) --------------------------------------------------
  const users = [superAdmin, engManager, mktManager, employee1, employee2, intern1, intern2, trainee1, trainee2];
  for (let i = 1; i <= 5; i += 1) {
    const local = new Date();
    local.setDate(local.getDate() - i);
    // UTC-anchored midnight for this local calendar day — a plain
    // setHours(0,0,0,0) would serialize to the previous day once written to
    // the DATE column in any positive-UTC-offset timezone (e.g. IST).
    const date = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
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
  const seedTimesheets = [
    { id: 'seed-ts-1', userId: employee1.id, date: new Date('2026-07-06'), projectId: project.id, hoursLogged: 6.5, description: 'API development', status: 'APPROVED', approverId: engManager.id, approvedAt: new Date() },
    { id: 'seed-ts-2', userId: employee1.id, date: new Date('2026-07-07'), projectId: project.id, hoursLogged: 7, description: 'Schema review', status: 'PENDING' },
    { id: 'seed-ts-3', userId: intern1.id, date: new Date('2026-07-07'), projectId: project.id, hoursLogged: 5, description: 'Test writing', status: 'PENDING' },
  ];
  for (const t of seedTimesheets) {
    const { id, ...data } = t;
    await prisma.timesheet.upsert({ where: { id }, update: {}, create: { id, ...data } });
  }

  // --- Daily work updates -----------------------------------------------------------
  const seedWorkUpdates = [
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
  ];
  for (const w of seedWorkUpdates) {
    await prisma.dailyWorkUpdate.upsert({
      where: { userId_date: { userId: w.userId, date: w.date } },
      update: {},
      create: w,
    });
  }

  // --- Unallocated task (demonstrates the "not allocated" highlight) -------------
  await prisma.task.upsert({
    where: { id: 'seed-task-unallocated' },
    update: {},
    create: {
      id: 'seed-task-unallocated',
      title: 'Set up staging environment',
      description: 'No one has picked this up yet — should show as NOT ALLOCATED.',
      type: 'PROJECT',
      priority: 'HIGH',
      status: 'TODO',
      projectId: project.id,
      assigneeId: null,
      createdById: engManager.id,
      dueDate: new Date('2026-07-25'),
    },
  });

  // --- Default Admin permission matrix (Super-Admin-configurable) ----------------
  // Mirrors current hardcoded isManager-gated routes so behavior is unchanged
  // until a Super Admin explicitly toggles something off.
  const ADMIN_PERMISSIONS = [
    ['department', 'create'], ['department', 'edit'],
    ['project', 'create'], ['project', 'edit'], ['project', 'assign'],
    ['task', 'create'],
    ['timesheet', 'approve'], ['timesheet', 'reject'],
    ['analytics', 'view'],
    ['attendance', 'view'], ['attendance', 'mark'],
    ['user', 'view'], ['user', 'create'],
    ['document', 'view'], ['document', 'approve'], ['document', 'reject'],
    ['intern', 'manage'],
    ['trainee', 'manage'],
    ['workupdate', 'review'],
    ['college', 'manage'],
    ['workshop', 'manage'],
    ['mou', 'manage'],
    ['leave', 'approve'],
    ['expense', 'view'], ['expense', 'create'], ['expense', 'edit'],
  ];
  await prisma.permission.createMany({
    data: ADMIN_PERMISSIONS.map(([module, action]) => ({ role: 'ADMIN', module, action, allowed: true })),
    skipDuplicates: true,
  });

  console.log('Seeding complete.');
  console.log('---------------------------------------------');
  console.log('Default password for all seeded users:', DEFAULT_PASSWORD);
  console.log('Super Admin:  superadmin@vertexwm.com');
  console.log('Admin (Eng):  admin.eng@vertexwm.com');
  console.log('Admin (Mkt):  admin.marketing@vertexwm.com');
  console.log('Employee:     employee1@vertexwm.com / employee2@vertexwm.com');
  console.log('Intern:       intern1@vertexwm.com / intern2@vertexwm.com');
  console.log('Trainee:      trainee1@vertexwm.com / trainee2@vertexwm.com');
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
