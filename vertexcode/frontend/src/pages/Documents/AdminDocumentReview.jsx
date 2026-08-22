import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, ShieldCheck, FileText, Award, Download } from 'lucide-react';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import Table from '@/components/shared/Table';
import Dialog from '@/components/shared/Dialog';
import Badge from '@/components/shared/Badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';

const DOC_LABELS = { BONAFIDE: 'Bonafide Certificate', COLLEGE_ID: 'College ID Card', RESUME: 'Resume', ADDITIONAL: 'Additional Document' };
const REQUIRED_TYPES = ['BONAFIDE', 'COLLEGE_ID'];

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

  const handleGenerateOfferLetter = async () => {
    setLifecycleActing('offer-letter');
    try {
      await api.post(`/interns/enrollments/${selected.id}/offer-letter`);
      toast.success('Offer letter generated');
      await refreshSelected();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate offer letter');
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

  const handleLifecycleDownload = async (kind) => {
    try {
      const res = await api.get(`/interns/enrollments/${selected.id}/${kind}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${kind}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(kind === 'offer-letter' ? 'Failed to download offer letter' : 'Failed to download certificate');
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
          <Button size="sm" disabled={acting === d.id} onClick={() => handleApprove(d.id)}>
            <CheckCircle2 />
            Approve
          </Button>
          <Button size="sm" variant="ghost" disabled={acting === d.id} onClick={() => handleReject(d.id)}>
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

            {isSuperAdmin && (() => {
              const requiredVerified = REQUIRED_TYPES.every((t) => selected.documents.some((d) => d.type === t && d.status === 'VERIFIED'));
              const canApprove = requiredVerified && !selected.finalApprovedAt;
              const canGenerateOfferLetter = !!selected.finalApprovedAt && !selected.offerLetter;
              const canGenerateCertificate = !!selected.offerLetter && !selected.certificate
                && selected.internshipEndDate && new Date() >= new Date(selected.internshipEndDate);
              return (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internship Lifecycle (Super Admin)</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" disabled={!canApprove || lifecycleActing} onClick={handleFinalApprove}>
                      <ShieldCheck />
                      {lifecycleActing === 'approve' ? 'Approving...' : 'Final Approve'}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={!canGenerateOfferLetter || lifecycleActing} onClick={handleGenerateOfferLetter}>
                      <FileText />
                      {lifecycleActing === 'offer-letter' ? 'Generating...' : 'Generate Offer Letter'}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={!canGenerateCertificate || lifecycleActing} onClick={handleGenerateCertificate}>
                      <Award />
                      {lifecycleActing === 'certificate' ? 'Generating...' : 'Generate Certificate'}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.offerLetter && (
                      <Button size="sm" variant="ghost" onClick={() => handleLifecycleDownload('offer-letter')}>
                        <Download /> Offer Letter
                      </Button>
                    )}
                    {selected.certificate && (
                      <Button size="sm" variant="ghost" onClick={() => handleLifecycleDownload('certificate')}>
                        <Download /> Certificate
                      </Button>
                    )}
                  </div>
                  {!requiredVerified && <p className="text-xs text-muted-foreground">Both required documents must be verified before final approval.</p>}
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
