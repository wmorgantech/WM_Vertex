/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Production-safe seed: creates ONLY the generic lookup/config master data
// every environment needs to function (dropdown options, status masters,
// the default Admin permission matrix). It creates zero users and zero
// business records — the first real account is created manually (see
// README.md "Creating the first account").
async function main() {
  console.log('Seeding VertexWM master/config data...');

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

  await prisma.collegeType.createMany({
    data: [
      { code: 'ENGINEERING', label: 'Engineering College', sortOrder: 1 },
      { code: 'ARTS_SCIENCE', label: 'Arts & Science College', sortOrder: 2 },
      { code: 'UNIVERSITY', label: 'University', sortOrder: 3 },
      { code: 'POLYTECHNIC', label: 'Polytechnic', sortOrder: 4 },
    ],
    skipDuplicates: true,
  });

  // Draft state for the weekly/monthly Timesheet workflow (Save Draft →
  // Submit → Approve/Reject → Resubmit) — code-required, not optional.
  await prisma.timesheetStatus.upsert({
    where: { code: 'DRAFT' },
    update: {},
    create: { code: 'DRAFT', label: 'Draft', sortOrder: 0 },
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

  // Required by intern.routes.js's canAddIntern / navigation.js's designation
  // check — an Employee holding exactly this designation may add interns
  // without the broader intern:manage permission. User.designation has a DB
  // FK to Designation.name, so this row must exist for that feature to be
  // assignable at all; it is not example/demo data.
  await prisma.designation.upsert({
    where: { name: 'Senior Full Stack Developer' },
    update: {},
    create: { name: 'Senior Full Stack Developer', sortOrder: 1 },
  });

  // Default Admin permission matrix (Super-Admin-configurable). Pure role
  // config — no dependency on any user existing.
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
  ];
  await prisma.permission.createMany({
    data: ADMIN_PERMISSIONS.map(([module, action]) => ({ role: 'ADMIN', module, action, allowed: true })),
    skipDuplicates: true,
  });

  console.log('Seeding complete — master/config data only, no users created.');
  console.log('Create your first Super Admin account per README.md "Creating the first account".');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
