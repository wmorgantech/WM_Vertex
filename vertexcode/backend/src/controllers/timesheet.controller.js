const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');

const STANDARD_DAILY_TARGET_HOURS = 8;
// Statuses a timesheet entry can still be edited/deleted in — the two
// "not yet finally submitted for review" states. PENDING (submitted,
// awaiting manager) and APPROVED (final) are locked.
const EDITABLE_STATUSES = ['DRAFT', 'REJECTED'];
// An employee may still correct an already-APPROVED entry (e.g. they spot a
// mistake after the fact), but doing so must never leave it silently
// APPROVED with different numbers behind it — editing one unconditionally
// demotes the whole entry back to PENDING for the manager to review again
// (see bulkUpsertTimesheets). This is a deliberate, narrower exception to
// EDITABLE_STATUSES above, not a relaxation of it.
const RESUBMIT_ON_EDIT_STATUSES = ['APPROVED'];

// UTC-anchored midnight for the given local calendar day — see
// attendance.controller.js's dayStart() for why plain setHours(0,0,0,0)
// silently shifts a day off against @db.Date columns in +UTC timezones.
function dateOnly(d) {
  const local = new Date(d);
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

function isoDate(d) {
  return dateOnly(d).toISOString().slice(0, 10);
}

// Sunday is the only non-working day by calendar rule; ON_LEAVE/HOLIDAY/
// WEEKEND attendance records (already the authoritative source — approved
// leave syncs into Attendance as ON_LEAVE via leave.controller.js) also
// excuse a day from the 8-hour expectation. ABSENT is deliberately NOT
// excused — someone marked absent without approved leave was still
// expected to work.
const NON_WORKING_ATTENDANCE_STATUSES = ['ON_LEAVE', 'HOLIDAY', 'WEEKEND'];

function classifyDay(actualHours, isWorkingDay) {
  if (!isWorkingDay) return 'NON_WORKING';
  if (actualHours < STANDARD_DAILY_TARGET_HOURS) return 'BELOW';
  if (actualHours > STANDARD_DAILY_TARGET_HOURS) return 'ABOVE';
  return 'MET';
}

// Shared aggregation used by both the self-service summary and the
// manager's team summary — one source of truth for "expected hours",
// reusing Attendance data instead of re-deriving leave/holiday rules.
async function computeUserSummary(userId, from, to) {
  const start = dateOnly(from);
  const end = dateOnly(to);

  const [entries, attendance] = await Promise.all([
    prisma.timesheet.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.attendance.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { date: true, status: true },
    }),
  ]);

  const attendanceByDate = new Map(attendance.map((a) => [isoDate(a.date), a.status]));
  const hoursByDate = new Map();
  for (const e of entries) {
    const key = isoDate(e.date);
    hoursByDate.set(key, (hoursByDate.get(key) || 0) + e.hoursLogged);
  }

  const days = [];
  let expectedHours = 0;
  let workingDays = 0;
  let daysBelowTarget = 0;
  let daysAtOrAboveTarget = 0;
  let overtimeHours = 0;
  let actualHours = 0;

  const cursor = new Date(start);
  while (cursor <= end) {
    const key = isoDate(cursor);
    const dayOfWeek = cursor.getUTCDay(); // 0 = Sunday
    const attendanceStatus = attendanceByDate.get(key);
    const isSunday = dayOfWeek === 0;
    const isExcused = attendanceStatus && NON_WORKING_ATTENDANCE_STATUSES.includes(attendanceStatus);
    const isWorkingDay = !isSunday && !isExcused;

    const dayActual = hoursByDate.get(key) || 0;
    actualHours += dayActual;

    if (isWorkingDay) {
      workingDays += 1;
      expectedHours += STANDARD_DAILY_TARGET_HOURS;
      if (dayActual > STANDARD_DAILY_TARGET_HOURS) overtimeHours += dayActual - STANDARD_DAILY_TARGET_HOURS;
    }

    const status = classifyDay(dayActual, isWorkingDay);
    if (status === 'BELOW') daysBelowTarget += 1;
    if (status === 'MET' || status === 'ABOVE') daysAtOrAboveTarget += 1;

    days.push({
      date: key,
      dayOfWeek,
      isWorkingDay,
      nonWorkingReason: isSunday ? 'SUNDAY' : isExcused ? attendanceStatus : null,
      expectedHours: isWorkingDay ? STANDARD_DAILY_TARGET_HOURS : 0,
      actualHours: Math.round(dayActual * 100) / 100,
      status,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const statuses = new Set(entries.map((e) => e.status));
  let rollupStatus = 'NOT_STARTED';
  if (statuses.has('PENDING')) rollupStatus = 'SUBMITTED';
  else if (statuses.has('REJECTED')) rollupStatus = 'REJECTED';
  else if (entries.length > 0 && [...statuses].every((s) => s === 'APPROVED')) rollupStatus = 'APPROVED';
  else if (entries.length > 0) rollupStatus = 'DRAFT';

  return {
    from: isoDate(start),
    to: isoDate(end),
    expectedHours,
    actualHours: Math.round(actualHours * 100) / 100,
    difference: Math.round((actualHours - expectedHours) * 100) / 100,
    workingDays,
    daysBelowTarget,
    daysAtOrAboveTarget,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    status: rollupStatus,
    days,
    entries,
  };
}

async function listTimesheets(req, res) {
  const { userId, status, projectId, from, to } = req.query;
  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

  // Non-managers can never see another user's timesheets, even if they pass
  // a foreign userId — the query param is only honored for managers. A
  // non-manager is always pinned to their own id, overriding anything they
  // supplied (mirrors the same ownership rule already correct in getSummary).
  const where = {
    ...(isManagerRole ? (userId && { userId }) : { userId: req.user.id }),
    ...(status && { status }),
    ...(projectId && { projectId }),
    ...((from || to) && {
      date: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) },
    }),
  };

  const timesheets = await prisma.timesheet.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
      approver: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { date: 'desc' },
  });
  return sendSuccess(res, 200, timesheets);
}

// GET /api/timesheets/summary?userId=&from=&to= — day-by-day + rollup for
// one user. Powers both the Weekly and Monthly views (same shape, wider
// date range). Defaults to the caller; managers may pass another userId.
async function getSummary(req, res) {
  const { userId, from, to } = req.query;
  if (!from || !to) throw new ApiError(400, 'from and to are required');

  const isManagerRole = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const targetUserId = (userId && isManagerRole) ? userId : req.user.id;

  const summary = await computeUserSummary(targetUserId, from, to);
  return sendSuccess(res, 200, summary);
}

// GET /api/timesheets/team-summary?from=&to= — manager's team rollup.
// SUPER_ADMIN sees everyone who logs timesheets; ADMIN sees their direct reports.
async function getTeamSummary(req, res) {
  const { from, to } = req.query;
  if (!from || !to) throw new ApiError(400, 'from and to are required');
  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    throw new ApiError(403, 'Only managers can view the team summary');
  }

  const where = req.user.role === 'SUPER_ADMIN'
    ? { role: { in: ['EMPLOYEE', 'INTERN', 'ADMIN'] }, id: { not: req.user.id } }
    : { managerId: req.user.id };

  const teamMembers = await prisma.user.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, role: true, departmentId: true },
    orderBy: { firstName: 'asc' },
  });

  const rows = await Promise.all(
    teamMembers.map(async (member) => {
      const summary = await computeUserSummary(member.id, from, to);
      const { entries, days, ...rollup } = summary;
      return { user: member, ...rollup };
    })
  );

  return sendSuccess(res, 200, rows);
}

async function createTimesheet(req, res) {
  const { date, projectId, taskId, hoursLogged, description } = req.body;
  if (!date || hoursLogged === undefined) throw new ApiError(400, 'date and hoursLogged are required');
  const hours = Number(hoursLogged);
  if (Number.isNaN(hours) || hours <= 0 || hours > 24) throw new ApiError(400, 'hoursLogged must be a number between 0 and 24');

  const timesheet = await prisma.timesheet.create({
    data: {
      userId: req.user.id,
      date: dateOnly(date),
      projectId: projectId || null,
      taskId: taskId || null,
      hoursLogged: hours,
      description,
      status: 'DRAFT',
    },
  });

  return sendSuccess(res, 201, timesheet);
}

// POST /api/timesheets/bulk — save many entries (a whole week's grid) as
// drafts in one call. Each entry with an existing id is updated in place
// (only if still editable); entries without an id are created as DRAFT.
// An entry with hoursLogged <= 0 removes that cell's row entirely (an
// empty/zeroed cell means "no entry", not a persisted zero row).
//
// A row's identity is (Position, Project): `position` is a plain string
// sourced from the existing Designation master (Timesheet.position);
// `projectId` reuses the pre-existing Project relation. `taskId` is legacy
// only — kept nullable on the model for historical records, never written
// here since the current UI has no Task column.
async function bulkUpsertTimesheets(req, res) {
  const { entries } = req.body;
  if (!Array.isArray(entries)) throw new ApiError(400, 'entries must be an array');

  // Position must be a real Designation, not free text — the dropdown
  // already restricts this client-side, but a direct API call must be
  // enforced too. One query for every distinct value in the batch.
  const positionNames = [...new Set(entries.map((e) => e.position).filter(Boolean))];
  if (positionNames.length > 0) {
    const validDesignations = await prisma.designation.findMany({
      where: { name: { in: positionNames } },
      select: { name: true },
    });
    const validNames = new Set(validDesignations.map((d) => d.name));
    const invalid = positionNames.filter((p) => !validNames.has(p));
    if (invalid.length > 0) throw new ApiError(400, `Unknown position: ${invalid.join(', ')}`);
  }

  const results = [];
  const resubmitted = [];
  for (const entry of entries) {
    const { id, date, position, projectId, hoursLogged, description } = entry;
    const hours = hoursLogged === '' || hoursLogged === undefined || hoursLogged === null ? 0 : Number(hoursLogged);
    if (Number.isNaN(hours) || hours < 0) throw new ApiError(400, 'hoursLogged must be a non-negative number');
    if (hours > 24) throw new ApiError(400, 'hoursLogged must be between 0 and 24');

    if (id) {
      const existing = await prisma.timesheet.findUnique({ where: { id } });
      if (!existing || existing.userId !== req.user.id) continue; // not theirs — silently skip, not an error for a batch save

      const isResubmitEdit = RESUBMIT_ON_EDIT_STATUSES.includes(existing.status);
      if (!EDITABLE_STATUSES.includes(existing.status) && !isResubmitEdit) continue; // locked (pending) — leave untouched

      if (hours <= 0) {
        await prisma.timesheet.delete({ where: { id } });
        continue;
      }
      const updated = await prisma.timesheet.update({
        where: { id },
        data: {
          position: position !== undefined ? (position || null) : existing.position,
          projectId: projectId !== undefined ? (projectId || null) : existing.projectId,
          hoursLogged: hours,
          description: description ?? existing.description,
          // Editing a previously-approved entry always demotes it back to
          // PENDING — an employee can never edit their way to a silently
          // still-APPROVED record. See RESUBMIT_ON_EDIT_STATUSES above.
          ...(isResubmitEdit && { status: 'PENDING', approverId: null, approvedAt: null, rejectionReason: null }),
        },
      });
      if (isResubmitEdit) {
        await recordAudit({
          actorId: req.user.id, action: 'RESUBMITTED', module: 'TIMESHEET', entityId: updated.id,
          entityLabel: isoDate(updated.date), before: existing, after: updated,
        });
        resubmitted.push(updated);
      }
      results.push(updated);
    } else {
      if (hours <= 0) continue; // nothing to save
      if (!date) throw new ApiError(400, 'date is required for a new entry');
      const created = await prisma.timesheet.create({
        data: {
          userId: req.user.id,
          date: dateOnly(date),
          position: position || null,
          projectId: projectId || null,
          hoursLogged: hours,
          description,
          status: 'DRAFT',
        },
      });
      results.push(created);
    }
  }

  // One notification for the whole re-submission, not per row — mirrors
  // submitTimesheets(). A resubmitted entry is already PENDING by the time
  // we get here, so it can never reach submitTimesheets() itself (that only
  // looks at DRAFT/REJECTED), which is why this batch needs its own notify.
  if (resubmitted.length > 0) {
    const submitter = await prisma.user.findUnique({ where: { id: req.user.id }, select: { managerId: true, firstName: true, lastName: true } });
    if (submitter.managerId) {
      const dates = resubmitted.map((e) => isoDate(e.date)).sort();
      await notify({
        userId: submitter.managerId, type: 'TIMESHEET_PENDING', title: 'Approved timesheet edited — needs re-approval',
        message: `${submitter.firstName} ${submitter.lastName} edited ${resubmitted.length} previously-approved entr${resubmitted.length === 1 ? 'y' : 'ies'} (${dates[0]}${dates.length > 1 ? ` – ${dates[dates.length - 1]}` : ''})`,
        link: '/timesheets',
      });
    }
  }

  return sendSuccess(res, 200, results);
}

// POST /api/timesheets/submit — move every DRAFT/REJECTED entry the caller
// has in [from, to] to PENDING in one go, and notify their manager once
// (not once per row — see the old per-row notify() this replaced).
async function submitTimesheets(req, res) {
  const { from, to } = req.body;
  if (!from || !to) throw new ApiError(400, 'from and to are required');

  const submittable = await prisma.timesheet.findMany({
    where: { userId: req.user.id, date: { gte: dateOnly(from), lte: dateOnly(to) }, status: { in: EDITABLE_STATUSES } },
  });
  if (submittable.length === 0) throw new ApiError(400, 'No draft entries to submit for this period');

  const totalHours = submittable.reduce((s, e) => s + e.hoursLogged, 0);

  await prisma.timesheet.updateMany({
    where: { id: { in: submittable.map((e) => e.id) } },
    data: { status: 'PENDING', rejectionReason: null, approverId: null, approvedAt: null },
  });

  for (const e of submittable) {
    await recordAudit({ actorId: req.user.id, action: 'SUBMITTED', module: 'TIMESHEET', entityId: e.id, entityLabel: isoDate(e.date) });
  }

  const submitter = await prisma.user.findUnique({ where: { id: req.user.id }, select: { managerId: true, firstName: true, lastName: true } });
  if (submitter.managerId) {
    await notify({
      userId: submitter.managerId, type: 'TIMESHEET_PENDING', title: 'Timesheet submitted for review',
      message: `${submitter.firstName} ${submitter.lastName} submitted ${submittable.length} entr${submittable.length === 1 ? 'y' : 'ies'} (${totalHours}h) for ${isoDate(from)} – ${isoDate(to)}`,
      link: '/timesheets',
    });
  }

  return sendSuccess(res, 200, { submitted: submittable.length });
}

async function updateTimesheet(req, res) {
  const ts = await prisma.timesheet.findUnique({ where: { id: req.params.id } });
  if (!ts) throw new ApiError(404, 'Timesheet not found');
  if (ts.userId !== req.user.id) throw new ApiError(403, 'Not authorized to edit this timesheet');
  if (!EDITABLE_STATUSES.includes(ts.status)) throw new ApiError(409, 'Only draft or rejected timesheets can be edited');

  const { hoursLogged, description, projectId, taskId, date } = req.body;
  let hours;
  if (hoursLogged !== undefined) {
    hours = Number(hoursLogged);
    if (Number.isNaN(hours) || hours <= 0 || hours > 24) {
      throw new ApiError(400, 'hoursLogged must be a number between 0 and 24');
    }
  }
  const updated = await prisma.timesheet.update({
    where: { id: req.params.id },
    data: {
      ...(hours !== undefined && { hoursLogged: hours }),
      ...(description !== undefined && { description }),
      ...(projectId !== undefined && { projectId }),
      ...(taskId !== undefined && { taskId }),
      ...(date && { date: dateOnly(date) }),
    },
  });
  return sendSuccess(res, 200, updated);
}

// Shared by the single-row and bulk approve/reject endpoints so the two
// surfaces can never drift apart.
async function approveOne(id, actorId) {
  const before = await prisma.timesheet.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, 'Timesheet not found');
  if (before.status !== 'PENDING') throw new ApiError(409, 'Only timesheets awaiting approval can be approved');
  const updated = await prisma.timesheet.update({
    where: { id },
    data: { status: 'APPROVED', approverId: actorId, approvedAt: new Date(), rejectionReason: null },
  });
  await recordAudit({ actorId, action: 'APPROVED', module: 'TIMESHEET', entityId: updated.id, before, after: updated });
  return updated;
}

async function rejectOne(id, actorId, reason) {
  const before = await prisma.timesheet.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, 'Timesheet not found');
  if (before.status !== 'PENDING') throw new ApiError(409, 'Only timesheets awaiting approval can be rejected');
  const updated = await prisma.timesheet.update({
    where: { id },
    data: { status: 'REJECTED', approverId: actorId, approvedAt: new Date(), rejectionReason: reason || null },
  });
  await recordAudit({ actorId, action: 'REJECTED', module: 'TIMESHEET', entityId: updated.id, before, after: updated });
  await notify({
    userId: updated.userId, type: 'TIMESHEET_REJECTED', title: 'Timesheet rejected',
    message: reason || 'Your timesheet was rejected — see remarks and resubmit.', link: '/timesheets',
  });
  return updated;
}

async function approveTimesheet(req, res) {
  const updated = await approveOne(req.params.id, req.user.id);
  return sendSuccess(res, 200, updated);
}

async function rejectTimesheet(req, res) {
  const { reason } = req.body;
  const updated = await rejectOne(req.params.id, req.user.id, reason);
  return sendSuccess(res, 200, updated);
}

async function bulkApprove(req, res) {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) throw new ApiError(400, 'ids must be a non-empty array');
  const updated = [];
  for (const id of ids) updated.push(await approveOne(id, req.user.id));
  return sendSuccess(res, 200, updated);
}

async function bulkReject(req, res) {
  const { ids, reason } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) throw new ApiError(400, 'ids must be a non-empty array');
  const updated = [];
  for (const id of ids) updated.push(await rejectOne(id, req.user.id, reason));
  return sendSuccess(res, 200, updated);
}

async function deleteTimesheet(req, res) {
  const ts = await prisma.timesheet.findUnique({ where: { id: req.params.id } });
  if (!ts) throw new ApiError(404, 'Timesheet not found');
  if (ts.userId !== req.user.id && !['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
    throw new ApiError(403, 'Not authorized');
  }
  // A submitted (PENDING) or already-APPROVED row is read-only for everyone,
  // including managers — deleting it is a form of editing it.
  if (!EDITABLE_STATUSES.includes(ts.status)) {
    throw new ApiError(409, 'Only draft or rejected timesheets can be deleted');
  }
  await prisma.timesheet.delete({ where: { id: req.params.id } });
  return sendSuccess(res, 200, { message: 'Timesheet removed' });
}

module.exports = {
  listTimesheets, getSummary, getTeamSummary, createTimesheet, bulkUpsertTimesheets, submitTimesheets,
  updateTimesheet, approveTimesheet, rejectTimesheet, bulkApprove, bulkReject, deleteTimesheet,
};
