// Kept in sync with components/shared/Badge.jsx's status→color mapping
// (translated from shadcn variant names to this component's CSS badge-*
// classes) so the same status renders identically on every page, whether
// it uses this legacy CSS-based Badge or the Tailwind-based one.
const COLORS = {
  DONE: 'green', APPROVED: 'green', ACTIVE: 'green', PRESENT: 'green', COMPLETED: 'green', REVIEWED: 'green',
  PENDING: 'amber', TODO: 'gray', SUBMITTED: 'amber', IN_PROGRESS: 'blue', UPCOMING: 'blue', ONGOING: 'blue',
  LATE: 'amber', REJECTED: 'red', ABSENT: 'red', TERMINATED: 'red', BLOCKED: 'red', FLAGGED: 'red', CANCELLED: 'red',
  ON_LEAVE: 'purple', IN_REVIEW: 'purple', HIGH: 'red', URGENT: 'red', MEDIUM: 'amber', LOW: 'gray',
  PENDING_REVIEW: 'amber', VERIFIED: 'green', DRAFT: 'gray', INACTIVE: 'gray',
  // Internship category
  FREE_INTERNSHIP: 'gray', JOT: 'purple', UNCATEGORIZED: 'gray',
  // Internship lifecycle stage
  REGISTERED: 'gray', PROFILE_COMPLETE: 'blue', DOCUMENTS_SUBMITTED: 'amber',
  UNDER_ADMIN_REVIEW: 'amber', PENDING_SUPER_ADMIN_APPROVAL: 'purple',
  INTERNSHIP_CONFIRMED: 'blue', OFFER_LETTER_GENERATED: 'blue',
  INTERNSHIP_ACTIVE: 'green', INTERNSHIP_COMPLETED: 'green', CERTIFICATE_GENERATED: 'green',
  // Internship audit actions
  FINAL_APPROVED: 'blue', OFFER_LETTER_DOWNLOADED: 'gray', CERTIFICATE_DOWNLOADED: 'gray', CATEGORY_SET: 'gray',
};

export default function Badge({ value }) {
  if (!value) return null;
  const color = COLORS[value] || 'gray';
  return <span className={`badge badge-${color}`}>{String(value).replace(/_/g, ' ')}</span>;
}
