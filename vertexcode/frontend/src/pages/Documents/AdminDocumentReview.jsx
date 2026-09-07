import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, ShieldCheck, FileText, Award, Download, Eye, Send } from 'lucide-react';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import Table from '@/components/shared/Table';
import Dialog from '@/components/shared/Dialog';
import Badge from '@/components/shared/Badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';

const DOC_LABELS = {
  BONAFIDE: 'Bonafide Certificate',
  PERMISSION_LETTER: 'Permission Letter',
  COLLEGE_ID: 'College ID Card',
  RESUME: 'Resume',
  ADDITIONAL: 'Additional Document',
};

const PROFILE_FIELDS = [
  { key: 'collegeName', label: 'College Name' },
  { key: 'university', label: 'University' },
  { key: 'collegeDepartment', label: 'Department' },
  { key: 'course', label: 'Course' },
  { key: 'branch', label: 'Branch' },
  { key: 'year', label: 'Year' },
  { key: 'semester', label: 'Semester' },
  { key: 'registerNumber', label: 'Register / Roll Number' },
  { key: 'collegeEmail', label: 'College Email' },
  { key: 'hodName', label: 'HOD / Staff Name' },
];

export default function AdminDocumentReview() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  // Approve/Enable Offer Letter are open to both roles — the backend scopes
  // an Admin to interns they mentor (assertCanManageLifecycle in
  // intern.controller.js), the same restriction already applied everywhere
  // else in this review flow (document approve/reject, enrollment detail).
  // Certificate generation stays Super-Admin-only (unchanged, out of scope).
  const isManager = isSuperAdmin || user.role === 'ADMIN';
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [acting, setActing] = useState(null);
  const [lifecycleActing, setLifecycleActing] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/documents')
      .then(({ data }) => setEnrollments(data.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openDetail = async (enrollment) => {
    const { data } = await api.get(`/documents/enrollment/${enrollment.id}`);
    setSelected(data.data);
  };

  const refreshSelected = async () => {
    const { data } = await api.get(`/documents/enrollment/${selected.id}`);
    setSelected(data.data);
    load();
  };

  const handleApprove = async (docId) => {
    setActing(docId);
    try {
      await api.patch(`/documents/${docId}/approve`);
      toast.success('Document verified');
      await refreshSelected();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve document');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (docId) => {
    const remarks = window.prompt('Reason for rejection (required):');
    if (!remarks || !remarks.trim()) {
      toast.error('A rejection reason is required');
      return;
    }
    setActing(docId);
    try {
      await api.patch(`/documents/${docId}/reject`, { remarks });
      toast.success('Document rejected');
      await refreshSelected();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject document');
    } finally {
      setActing(null);
    }
  };

  const handleFinalApprove = async () => {
    setLifecycleActing('approve');
    try {
      await api.post(`/interns/enrollments/${selected.id}/approve`);
      toast.success('Internship approved');
      await refreshSelected();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve internship');
    } finally {
      setLifecycleActing(null);
    }
  };

  const handleEnableOfferLetter = async () => {
    setLifecycleActing('offer-letter');
    try {
      const { data } = await api.post(`/interns/enrollments/${selected.id}/offer-letter/enable`);
      if (data.data?.emailSent === false) {
        toast.error('Offer letter enabled, but the email failed to send — use Resend Email to retry');
      } else {
        toast.success('Offer letter enabled and emailed to the intern');
      }
      await refreshSelected();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to enable offer letter');
    } finally {
      setLifecycleActing(null);
    }
  };

  const handleResendOfferLetterEmail = async () => {
    setLifecycleActing('resend-email');
    try {
      await api.post(`/interns/enrollments/${selected.id}/offer-letter/resend-email`);
      toast.success('Offer letter email resent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend offer letter email');
    } finally {
      setLifecycleActing(null);
    }
  };

  const handleGenerateCertificate = async () => {
    setLifecycleActing('certificate');
    try {
      await api.post(`/interns/enrollments/${selected.id}/certificate`);
      toast.success('Completion certificate generated');
      await refreshSelected();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate certificate');
    } finally {
      setLifecycleActing(null);
    }
  };

  // mode 'view' opens the PDF in a new tab (browser's native viewer, nothing
  // saved to disk); mode 'download' (default) forces a save-as, matching the
  // existing behavior. Both reuse the same download endpoint — the
  // distinction is purely how the frontend handles the returned bytes.
  const handleLifecycleDownload = async (kind, mode = 'download') => {
    try {
      const res = await api.get(`/interns/enrollments/${selected.id}/${kind}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      if (mode === 'view') {
        window.open(url, '_blank');
      } else {
        const link = window.document.createElement('a');
        link.href = url;
        link.download = `${kind}.pdf`;
        window.document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error(kind === 'offer-letter' ? 'Failed to open offer letter' : 'Failed to open certificate');
    }
  };

  const columns = [
    { key: 'name', header: 'Intern', render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    { key: 'batch', header: 'Batch', render: (r) => r.batch?.name || '—' },
    { key: 'category', header: 'Category', render: (r) => r.category ? <Badge value={r.category} /> : '—' },
    { key: 'registerNumber', header: 'Register Number', render: (r) => r.registerNumber || '—' },
    { key: 'pending', header: 'Pending Review', render: (r) => r.documents.filter((d) => d.status === 'PENDING_REVIEW').length },
    { key: 'verified', header: 'Verified', render: (r) => r.documents.filter((d) => d.status === 'VERIFIED').length },
    { key: 'rejected', header: 'Rejected', render: (r) => r.documents.filter((d) => d.status === 'REJECTED').length },
    { key: 'approval', header: 'Approval', render: (r) => r.finalApprovedAt ? <Badge value="INTERNSHIP_CONFIRMED" /> : '—' },
    { key: 'actions', header: 'Actions', render: (r) => <Button size="sm" onClick={() => openDetail(r)}>Review</Button> },
  ];

  const docColumns = [
    { key: 'type', header: 'Document', render: (d) => DOC_LABELS[d.type] },
    { key: 'fileName', header: 'File Name' },
    { key: 'uploadedAt', header: 'Uploaded', render: (d) => new Date(d.uploadedAt).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (d) => <Badge value={d.status} /> },
    { key: 'adminRemarks', header: 'Remarks', render: (d) => d.adminRemarks || '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (d) => d.status === 'PENDING_REVIEW' ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="success" disabled={acting === d.id} onClick={() => handleApprove(d.id)}>
            <CheckCircle2 />
            Approve
          </Button>
          <Button size="sm" variant="destructive" disabled={acting === d.id} onClick={() => handleReject(d.id)}>
            <XCircle />
            Reject
          </Button>
        </div>
      ) : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Intern Document Review" subtitle="Review internship profiles and verify uploaded documents" />

      {loading ? <Skeleton className="h-80" /> : (
        <Table columns={columns} rows={enrollments} emptyMessage="No intern enrollments found." />
      )}

      {selected && (
        <Dialog
          title={`${selected.user.firstName} ${selected.user.lastName} — Documents`}
          onClose={() => setSelected(null)}
          className="sm:max-w-3xl"
        >
          <div className="max-h-[70vh] space-y-6 overflow-y-auto">
            <div className="flex items-center gap-2">
              {selected.category && <Badge value={selected.category} />}
              {selected.finalApprovedAt && <Badge value="INTERNSHIP_CONFIRMED" />}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {PROFILE_FIELDS.map((f) => (
                <div key={f.key} className="contents">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="font-medium text-foreground">{selected[f.key] || '—'}</dd>
                </div>
              ))}
            </dl>
            <Table columns={docColumns} rows={selected.documents} emptyMessage="No documents uploaded yet." />

            {isManager && (() => {
              const requiredVerified = selected.requirement?.satisfied ?? false;
              const canApprove = requiredVerified && !selected.finalApprovedAt;
              const canEnableOfferLetter = !!selected.finalApprovedAt && !selected.offerLetter;
              const canGenerateCertificate = !!selected.offerLetter && !selected.certificate
                && selected.internshipEndDate && new Date() >= new Date(selected.internshipEndDate);
              return (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internship Lifecycle (Admin / Super Admin)</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge value={selected.finalApprovedAt ? 'INTERNSHIP_CONFIRMED' : 'PENDING'} label={selected.finalApprovedAt ? 'APPROVED' : 'PENDING'} />
                    {selected.finalApprovedAt && (
                      <>
                        <span className="ml-2 text-muted-foreground">Offer Letter:</span>
                        <Badge value={selected.offerLetter ? 'VERIFIED' : 'DRAFT'} label={selected.offerLetter ? 'ENABLED' : 'NOT ENABLED'} />
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" disabled={!canApprove || lifecycleActing} onClick={handleFinalApprove}>
                      <ShieldCheck />
                      {lifecycleActing === 'approve' ? 'Approving...' : 'Final Approve'}
                    </Button>
                    {!selected.offerLetter && (
                      <Button size="sm" variant="secondary" disabled={!canEnableOfferLetter || lifecycleActing} onClick={handleEnableOfferLetter}>
                        <FileText />
                        {lifecycleActing === 'offer-letter' ? 'Enabling...' : 'Enable Offer Letter'}
                      </Button>
                    )}
                    {selected.offerLetter && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => handleLifecycleDownload('offer-letter', 'view')}>
                          <Eye /> View
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleLifecycleDownload('offer-letter', 'download')}>
                          <Download /> Download
                        </Button>
                        <Button size="sm" variant="secondary" disabled={lifecycleActing} onClick={handleResendOfferLetterEmail}>
                          <Send />
                          {lifecycleActing === 'resend-email' ? 'Resending...' : 'Resend Email'}
                        </Button>
                      </>
                    )}
                    {isSuperAdmin && (
                      <Button size="sm" variant="secondary" disabled={!canGenerateCertificate || lifecycleActing} onClick={handleGenerateCertificate}>
                        <Award />
                        {lifecycleActing === 'certificate' ? 'Generating...' : 'Generate Certificate'}
                      </Button>
                    )}
                    {selected.certificate && (
                      <Button size="sm" variant="ghost" onClick={() => handleLifecycleDownload('certificate')}>
                        <Download /> Certificate
                      </Button>
                    )}
                  </div>
                  {!requiredVerified && (
                    <p className="text-xs text-muted-foreground">
                      Required before final approval: {(selected.requirement?.groups || []).filter((g) => g.status !== 'VERIFIED').map((g) => g.label).join(', ')}
                    </p>
                  )}
                  {canGenerateCertificate === false && selected.offerLetter && !selected.certificate && (
                    <p className="text-xs text-muted-foreground">The completion certificate unlocks after the internship end date.</p>
                  )}
                </div>
              );
            })()}
          </div>
        </Dialog>
      )}
    </div>
  );
}
