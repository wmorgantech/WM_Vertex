// Rule-based insight strings computed client-side from already-fetched dashboard
// data. Not a live AI/LLM call — thresholds are intentionally simple and legible.

function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export function superAdminInsights(overview) {
  const insights = [];
  if (!overview) return insights;

  const { headcount, projects, tasks, attendance, pendingApprovals } = overview;

  const approvalsBacklog = (pendingApprovals?.timesheets || 0) + (pendingApprovals?.workUpdates || 0);
  if (approvalsBacklog > 10) {
    insights.push({
      tone: 'warning',
      text: `${approvalsBacklog} approvals are waiting across timesheets and work updates.`,
    });
  }

  const activeRatio = pct(headcount?.activeUsers, headcount?.totalEmployees + headcount?.totalInterns);
  if (headcount && activeRatio < 80) {
    insights.push({ tone: 'warning', text: `Only ${activeRatio}% of your workforce is currently active.` });
  }

  const activeProjectRatio = pct(projects?.activeProjects, projects?.totalProjects);
  if (projects?.totalProjects > 0 && activeProjectRatio < 50) {
    insights.push({
      tone: 'info',
      text: `${projects.activeProjects} of ${projects.totalProjects} projects are active — the rest are idle.`,
    });
  }

  const attendanceCounts = attendance?.last30Days || {};
  const totalAttendance = Object.values(attendanceCounts).reduce((sum, n) => sum + n, 0);
  const absenceRatio = pct(attendanceCounts.ABSENT, totalAttendance);
  if (totalAttendance > 0 && absenceRatio > 10) {
    insights.push({ tone: 'warning', text: `Absence rate is elevated this month at ${absenceRatio}%.` });
  }

  const blocked = tasks?.byStatus?.find((s) => s.status === 'BLOCKED')?.count || 0;
  if (blocked > 0) {
    insights.push({ tone: 'warning', text: `${blocked} task${blocked === 1 ? '' : 's'} across the org ${blocked === 1 ? 'is' : 'are'} blocked.` });
  }

  if (insights.length === 0) {
    insights.push({ tone: 'success', text: 'Headcount, approvals and project activity all look healthy.' });
  }

  return insights.slice(0, 4);
}

export function adminInsights(overview, team) {
  const insights = [];
  if (!overview) return insights;

  const pendingTimesheets = overview.pendingApprovals?.timesheets || 0;
  if (pendingTimesheets > 0) {
    insights.push({
      tone: pendingTimesheets > 5 ? 'warning' : 'info',
      text: `${pendingTimesheets} timesheet${pendingTimesheets === 1 ? '' : 's'} ${pendingTimesheets === 1 ? 'is' : 'are'} waiting on your review.`,
    });
  }

  if (Array.isArray(team) && team.length > 0) {
    const belowHalf = team.filter((t) => (t.taskCompletionRate ?? 0) < 50);
    if (belowHalf.length > 0) {
      insights.push({
        tone: 'warning',
        text: `${belowHalf.length} team member${belowHalf.length === 1 ? '' : 's'} ${belowHalf.length === 1 ? 'is' : 'are'} below 50% task completion.`,
      });
    }

    const topPerformer = [...team].sort((a, b) => (b.hoursLoggedLast30 || 0) - (a.hoursLoggedLast30 || 0))[0];
    if (topPerformer?.hoursLoggedLast30 > 0) {
      insights.push({
        tone: 'success',
        text: `${topPerformer.user.firstName} ${topPerformer.user.lastName} logged the most hours this period (${topPerformer.hoursLoggedLast30}h).`,
      });
    }
  }

  const blocked = overview.tasks?.byStatus?.find((s) => s.status === 'BLOCKED')?.count || 0;
  if (blocked > 0) {
    insights.push({ tone: 'warning', text: `${blocked} task${blocked === 1 ? '' : 's'} on your team ${blocked === 1 ? 'is' : 'are'} blocked.` });
  }

  if (insights.length === 0) {
    insights.push({ tone: 'success', text: 'No pending approvals and the team is on track.' });
  }

  return insights.slice(0, 4);
}

export function selfInsights(me) {
  const insights = [];
  if (!me) return insights;

  if (me.tasks?.overdue > 0) {
    insights.push({
      tone: 'warning',
      text: `You have ${me.tasks.overdue} overdue task${me.tasks.overdue === 1 ? '' : 's'} — consider prioritizing ${me.tasks.overdue === 1 ? 'it' : 'them'}.`,
    });
  }

  if (me.pendingTimesheets > 0) {
    insights.push({
      tone: 'info',
      text: `${me.pendingTimesheets} timesheet${me.pendingTimesheets === 1 ? '' : 's'} ${me.pendingTimesheets === 1 ? 'is' : 'are'} still pending approval.`,
    });
  }

  const records = me.attendance?.last30Days || [];
  const presentDays = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const presentRatio = pct(presentDays, records.length);
  if (records.length > 0 && presentRatio < 80) {
    insights.push({ tone: 'warning', text: `Your attendance rate over the last 30 days is ${presentRatio}%.` });
  }

  if (me.tasks?.total > 0) {
    const completionRatio = pct(me.tasks.done, me.tasks.total);
    if (completionRatio >= 80) {
      insights.push({ tone: 'success', text: `You've completed ${completionRatio}% of your assigned tasks.` });
    }
  }

  if (insights.length === 0) {
    insights.push({ tone: 'success', text: "You're on track — no overdue work or pending approvals." });
  }

  return insights.slice(0, 4);
}

export function internInsights(me, enrollment) {
  const insights = selfInsights(me);

  if (enrollment) {
    if ((enrollment.progressPercent ?? 0) < 40) {
      insights.unshift({
        tone: 'info',
        text: `You're ${enrollment.progressPercent ?? 0}% through your program — check in with your mentor if you feel behind.`,
      });
    }
    if (enrollment.performanceRating != null && enrollment.performanceRating < 3) {
      insights.unshift({
        tone: 'warning',
        text: `Your last performance rating was ${enrollment.performanceRating}/5 — worth a conversation with your mentor.`,
      });
    }
  }

  return insights.slice(0, 4);
}
