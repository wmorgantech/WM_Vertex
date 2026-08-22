import { Badge as UiBadge } from '@/components/ui/badge';

const COLORS = {
  DONE: 'success', APPROVED: 'success', ACTIVE: 'success', PRESENT: 'success', COMPLETED: 'success', REVIEWED: 'success',
  PENDING: 'warning', TODO: 'muted', SUBMITTED: 'warning', IN_PROGRESS: 'info', UPCOMING: 'info', ONGOING: 'info',
  LATE: 'warning', REJECTED: 'destructive', ABSENT: 'destructive', TERMINATED: 'destructive', BLOCKED: 'destructive', FLAGGED: 'destructive',
  ON_LEAVE: 'purple', IN_REVIEW: 'purple', HIGH: 'destructive', URGENT: 'destructive', MEDIUM: 'warning', LOW: 'muted',
  PENDING_REVIEW: 'warning', VERIFIED: 'success', DRAFT: 'muted',
  // Internship category
  FREE_INTERNSHIP: 'muted', JOT: 'purple', UNCATEGORIZED: 'muted',
  // Internship lifecycle stage
  REGISTERED: 'muted', PROFILE_COMPLETE: 'info', DOCUMENTS_SUBMITTED: 'warning',
  UNDER_ADMIN_REVIEW: 'warning', PENDING_SUPER_ADMIN_APPROVAL: 'purple',
  INTERNSHIP_CONFIRMED: 'info', OFFER_LETTER_GENERATED: 'info',
  INTERNSHIP_ACTIVE: 'success', INTERNSHIP_COMPLETED: 'success', CERTIFICATE_GENERATED: 'success',
  // Internship audit actions
  FINAL_APPROVED: 'info', OFFER_LETTER_DOWNLOADED: 'muted', CERTIFICATE_DOWNLOADED: 'muted', CATEGORY_SET: 'muted',
};

export default function Badge({ value }) {
  if (!value) return null;
  const variant = COLORS[value] || 'muted';
  return <UiBadge variant={variant}>{String(value).replace(/_/g, ' ')}</UiBadge>;
}
