const { evaluateRequiredDocs } = require('./internDocumentRequirements');

// Derives the 9-stage internship lifecycle label for display purposes.
// Only `finalApprovedAt` is a genuine stored decision — everything else is
// computed from documents / offerLetter / certificate / dates so there is a
// single source of truth and nothing can drift out of sync.
const STAGES = {
  REGISTERED: 'REGISTERED',
  PROFILE_COMPLETE: 'PROFILE_COMPLETE',
  DOCUMENTS_SUBMITTED: 'DOCUMENTS_SUBMITTED',
  UNDER_ADMIN_REVIEW: 'UNDER_ADMIN_REVIEW',
  PENDING_SUPER_ADMIN_APPROVAL: 'PENDING_SUPER_ADMIN_APPROVAL',
  INTERNSHIP_CONFIRMED: 'INTERNSHIP_CONFIRMED',
  OFFER_LETTER_GENERATED: 'OFFER_LETTER_GENERATED',
  INTERNSHIP_ACTIVE: 'INTERNSHIP_ACTIVE',
  INTERNSHIP_COMPLETED: 'INTERNSHIP_COMPLETED',
  CERTIFICATE_GENERATED: 'CERTIFICATE_GENERATED',
};

/**
 * @param {object} enrollment - InternEnrollment row (must include finalApprovedAt, internshipStartDate, internshipEndDate, and the 12 profile fields)
 * @param {object[]} documents - InternDocument rows for this enrollment
 * @param {object|null} offerLetter
 * @param {object|null} certificate
 */
function computeInternshipStage(enrollment, documents, offerLetter, certificate) {
  if (certificate) return STAGES.CERTIFICATE_GENERATED;

  const now = new Date();
  const endDate = enrollment.internshipEndDate ? new Date(enrollment.internshipEndDate) : null;
  const startDate = enrollment.internshipStartDate ? new Date(enrollment.internshipStartDate) : null;

  if (enrollment.finalApprovedAt && endDate && now > endDate) return STAGES.INTERNSHIP_COMPLETED;
  if (offerLetter) return STAGES.OFFER_LETTER_GENERATED;
  if (enrollment.finalApprovedAt && startDate && now >= startDate) return STAGES.INTERNSHIP_ACTIVE;
  if (enrollment.finalApprovedAt) return STAGES.INTERNSHIP_CONFIRMED;

  const requirement = evaluateRequiredDocs(documents);
  if (requirement.satisfied) return STAGES.PENDING_SUPER_ADMIN_APPROVAL;
  if (requirement.anyPendingReview) return STAGES.UNDER_ADMIN_REVIEW;

  const anyUploaded = documents.length > 0;
  if (anyUploaded) return STAGES.DOCUMENTS_SUBMITTED;

  const profileFields = [
    'collegeName', 'university', 'collegeDepartment', 'course', 'branch', 'year', 'semester',
    'registerNumber', 'hodName', 'internshipStartDate', 'internshipEndDate',
  ];
  const profileComplete = profileFields.every((f) => enrollment[f] !== null && enrollment[f] !== undefined && enrollment[f] !== '');
  if (profileComplete) return STAGES.PROFILE_COMPLETE;

  return STAGES.REGISTERED;
}

module.exports = { computeInternshipStage, STAGES };
