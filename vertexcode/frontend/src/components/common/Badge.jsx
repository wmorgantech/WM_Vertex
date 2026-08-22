const COLORS = {
  DONE: 'green', APPROVED: 'green', ACTIVE: 'green', PRESENT: 'green', COMPLETED: 'green', REVIEWED: 'green',
  PENDING: 'amber', TODO: 'gray', SUBMITTED: 'amber', IN_PROGRESS: 'blue', UPCOMING: 'blue', ONGOING: 'blue',
  LATE: 'amber', REJECTED: 'red', ABSENT: 'red', TERMINATED: 'red', BLOCKED: 'red', FLAGGED: 'red',
  ON_LEAVE: 'purple', IN_REVIEW: 'purple', HIGH: 'red', URGENT: 'red', MEDIUM: 'amber', LOW: 'gray',
  PENDING_REVIEW: 'amber', VERIFIED: 'green', DRAFT: 'gray',
  FREE_INTERNSHIP: 'gray', JOT: 'purple', UNCATEGORIZED: 'gray',
  REGISTERED: 'gray', PROFILE_COMPLETE: 'blue', DOCUMENTS_SUBMITTED: 'amber',
  UNDER_ADMIN_REVIEW: 'amber', PENDING_SUPER_ADMIN_APPROVAL: 'purple',
  INTERNSHIP_CONFIRMED: 'blue', OFFER_LETTER_GENERATED: 'blue',
  INTERNSHIP_ACTIVE: 'green', INTERNSHIP_COMPLETED: 'green', CERTIFICATE_GENERATED: 'green',
};

export default function Badge({ value }) {
  if (!value) return null;
  const color = COLORS[value] || 'gray';
  return <span className={`badge badge-${color}`}>{String(value).replace(/_/g, ' ')}</span>;
}
