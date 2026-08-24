// A requirement "slot" is satisfied if ANY of its listed document types is
// VERIFIED. Bonafide Certificate and Permission Letter are interchangeable —
// an intern only needs one of the two, plus a College ID. Every place that
// needs to know "has this intern cleared document review" (self-service
// verification stats, submit-for-review validation, the Super Admin final
// approval gate, and the org-wide analytics counts) calls this same module
// so the rule can't drift out of sync between them.
const REQUIRED_DOC_GROUPS = [
  { key: 'identityProof', anyOf: ['BONAFIDE', 'PERMISSION_LETTER'], label: 'Bonafide Certificate or Permission Letter' },
  { key: 'collegeId', anyOf: ['COLLEGE_ID'], label: 'College ID Card' },
];

const REQUIRED_DOC_TYPES = REQUIRED_DOC_GROUPS.flatMap((g) => g.anyOf);

function findByStatus(documents, anyOf, status) {
  return documents.find((d) => anyOf.includes(d.type) && d.status === status);
}

// documents: InternDocument[] (only the `type` and `status` fields are used)
function evaluateRequiredDocs(documents) {
  const groups = REQUIRED_DOC_GROUPS.map((g) => {
    const verified = findByStatus(documents, g.anyOf, 'VERIFIED');
    const pending = findByStatus(documents, g.anyOf, 'PENDING_REVIEW');
    const rejected = findByStatus(documents, g.anyOf, 'REJECTED');
    const draft = findByStatus(documents, g.anyOf, 'DRAFT');
    const doc = verified || pending || rejected || draft || null;
    const status = verified ? 'VERIFIED' : pending ? 'PENDING_REVIEW' : rejected ? 'REJECTED' : draft ? 'DRAFT' : 'MISSING';
    return { key: g.key, label: g.label, anyOf: g.anyOf, status, doc };
  });
  return {
    satisfied: groups.every((g) => g.status === 'VERIFIED'),
    // "uploaded" = every slot has at least something submitted (draft counts,
    // matching the pre-existing submitForVerification rule for BONAFIDE/COLLEGE_ID).
    uploaded: groups.every((g) => g.status !== 'MISSING'),
    anyPendingReview: groups.some((g) => g.status === 'PENDING_REVIEW'),
    groups,
  };
}

module.exports = { REQUIRED_DOC_GROUPS, REQUIRED_DOC_TYPES, evaluateRequiredDocs };
