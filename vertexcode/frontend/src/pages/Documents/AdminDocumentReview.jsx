import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, ShieldCheck, FileText, Award, Download, Eye, Send, Trash2, RotateCcw, Pencil, Files, Clock, Archive, ClipboardCheck, CircleCheck, CircleX, Search, Users } from 'lucide-react';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import Table from '@/components/shared/Table';
import Dialog from '@/components/shared/Dialog';
import Badge from '@/components/shared/Badge';
import KpiCard from '@/components/shared/KpiCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';

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

// Client-side only — builds a CSV from the already-loaded on-screen rows for
// whichever interns are currently checked. Deliberately not a backend call:
// this is a lightweight "export just what I've selected" convenience, not a
// substitute for the full Export CSV/Excel (which pulls fresh document
// metadata from the API) below.
function exportSelectedToCsv(rows) {
  const headers = ['Intern', 'Batch', 'Category', 'Register Number', 'Pending Review', 'Verified', 'Rejected', 'Approved'];
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    lines.push([
      `${r.user.firstName} ${r.user.lastName}`,
      r.batch?.name || '',
      r.category || '',
      r.registerNumber || '',
      r.documents.filter((d) => d.status === 'PENDING_REVIEW').length,
      r.documents.filter((d) => d.status === 'VERIFIED').length,
      r.documents.filter((d) => d.status === 'REJECTED').length,
      r.finalApprovedAt ? 'Yes' : 'No',
    ].map(escape).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `selected-interns-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AdminDocumentReview() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  // Approve/Enable Offer Letter are open to both roles — the backend scopes
  // an Admin to interns they mentor (assertCanManageLifecycle in
  // intern.controller.js), the same restriction already applied everywhere
  // else in this review flow (document approve/reject, enrollment detail).
  // Certificate generation stays Super-Admin-only (unchanged, out of scope).
  const isManager = isSuperAdmin || user.role === 'ADMIN';
  const [pageTab, setPageTab] = useState('review');
  const [enrollments, setEnrollments] = useState([]);
  const [trashDocs, setTrashDocs] = useState([]);
  const [summary, setSummary] = useState({ totalDocuments: 0, pendingReview: 0, verified: 0, rejected: 0, approved: 0, trash: 0 });
  const [lifecycleStats, setLifecycleStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [acting, setActing] = useState(null);
  const [lifecycleActing, setLifecycleActing] = useState(null);
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState(new Set());
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [editingRemarksDoc, setEditingRemarksDoc] = useState(null);
  const [remarksDraft, setRemarksDraft] = useState('');
  const [search, setSearch] = useState('');
  const loadRequestRef = useRef(0);

  const load = (resetView = false) => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    if (resetView) {
      setSelected(null);
      setSelectedEnrollmentIds(new Set());
      setSelectedDocIds(new Set());
      setSummary({ totalDocuments: 0, pendingReview: 0, verified: 0, rejected: 0, approved: 0, trash: 0 });
      if (pageTab === 'review') {
        setTrashDocs([]);
      } else {
        setEnrollments([]);
        setLifecycleStats(null);
      }
    }
    Promise.allSettled([
      api.get('/documents'),
      api.get('/documents/summary'),
      pageTab === 'trash' ? api.get('/documents/trash') : Promise.resolve(null),
      // Reused, not duplicated — the same /analytics/overview endpoint both
      // dashboards already call. Pending Internship Approvals / Offer
      // Letters / Certificates used to live only on the Super Admin and
      // Admin dashboards; they're internship-lifecycle metrics that belong
      // on this page instead, so the dashboards were trimmed to stop
      // duplicating them (see SuperAdminDashboard.jsx/AdminDashboard.jsx).
      api.get('/analytics/overview'),
    ])
      .then(([e, s, t, ov]) => {
        if (requestId !== loadRequestRef.current) return;
        if (e.status === 'fulfilled') {
          setEnrollments(e.value.data.data);
        }
        if (s.status === 'fulfilled') {
          setSummary(s.value.data?.data || {
            totalDocuments: 0,
            pendingReview: 0,
            verified: 0,
            rejected: 0,
            approved: 0,
            trash: 0,
          });
        }
        if (t?.status === 'fulfilled') setTrashDocs(t.value.data.data);
        if (ov.status === 'fulfilled') setLifecycleStats(ov.value.data.data);
        const failed = [e, s, t, ov].filter(Boolean).find((r) => r.status === 'rejected');
        if (failed) toast.error(failed.reason?.response?.data?.message || 'Some data failed to load');
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => load(true), [pageTab]);

  const openDetail = async (enrollment) => {
    try {
      const response = await api.get(`/documents/enrollment/${enrollment.id}`);
      if (!response.data?.success || !response.data.data) {
        throw new Error('The document detail response was invalid');
      }
      setSelected(response.data.data);
      setSelectedDocIds(new Set());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load intern documents');
    }
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

  // View — previews the uploaded file in-page. The backend
  // (GET /documents/:id/download) already exists and already supports this
  // exact access pattern (Super Admin unrestricted, Admin mentor-scoped) —
  // no backend/workflow change, just how the already-fetched blob is shown.
  // The browser reads the Blob's own Content-Type, so the original
  // response's Content-Disposition: attachment header from res.download()
  // doesn't force a save-as here.
  const [viewingDoc, setViewingDoc] = useState(null);
  const [viewingDocUrl, setViewingDocUrl] = useState(null);

  const handleViewDoc = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      setViewingDoc(doc);
      setViewingDocUrl(URL.createObjectURL(res.data));
    } catch {
      toast.error('Failed to open document');
    }
  };

  const closeViewDoc = () => {
    if (viewingDocUrl) URL.revokeObjectURL(viewingDocUrl);
    setViewingDoc(null);
    setViewingDocUrl(null);
  };

  const openEditRemarks = (doc) => {
    setEditingRemarksDoc(doc);
    setRemarksDraft(doc.adminRemarks || '');
  };

  const handleSaveRemarks = async () => {
    setActing(editingRemarksDoc.id);
    try {
      await api.patch(`/documents/${editingRemarksDoc.id}/remarks`, { remarks: remarksDraft });
      toast.success('Remarks updated');
      setEditingRemarksDoc(null);
      await refreshSelected();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update remarks');
    } finally {
      setActing(null);
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Move this document to Trash? This can be undone with Restore.')) return;
    setActing(docId);
    try {
      await api.delete(`/documents/${docId}`);
      toast.success('Document moved to Trash');
      await refreshSelected();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove document');
    } finally {
      setActing(null);
    }
  };

  const handleBulkDeleteDocs = async () => {
    const ids = Array.from(selectedDocIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Move ${ids.length} selected document(s) to Trash? This can be undone with Restore.`)) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/documents/${id}`)));
      toast.success(`${ids.length} document(s) moved to Trash`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove some of the selected documents');
    } finally {
      setSelectedDocIds(new Set());
      await refreshSelected();
    }
  };

  const handleRestoreDoc = async (docId) => {
    try {
      await api.post(`/documents/${docId}/restore`);
      toast.success('Document restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore document');
    }
  };

  // Irreversible — DELETE /documents/:id/permanent (Super Admin only,
  // requires the document already be in Trash) actually removes the row and
  // its file, not a re-run of Move to Trash. Confirmation is required before
  // the request is even sent.
  const handlePermanentlyDeleteDoc = async (doc) => {
    if (!window.confirm(`Permanently delete "${DOC_LABELS[doc.type]}" for ${doc.enrollment.user.firstName} ${doc.enrollment.user.lastName}? This cannot be undone.`)) return;
    setActing(doc.id);
    try {
      await api.delete(`/documents/${doc.id}/permanent`);
      toast.success('Document permanently deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete document');
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

  // Client-side only — both lists are already fully loaded (listAll/listTrash
  // have no server-side search param), so this filters the already-fetched
  // arrays rather than adding a new backend query. Matches intern name/email
  // (Review Queue and Trash) or the document type/file name already shown in
  // each row's own data (listTrash's user select has no email, hence the
  // `|| ''` guard there).
  const searchTerm = search.trim().toLowerCase();
  const matches = (text) => (text || '').toLowerCase().includes(searchTerm);
  const filteredEnrollments = !searchTerm ? enrollments : enrollments.filter((r) =>
    matches(`${r.user.firstName} ${r.user.lastName}`) ||
    matches(r.user.email) ||
    r.documents.some((d) => matches(DOC_LABELS[d.type]) || matches(d.fileName))
  );
  const filteredTrashDocs = !searchTerm ? trashDocs : trashDocs.filter((d) =>
    matches(`${d.enrollment.user.firstName} ${d.enrollment.user.lastName}`) ||
    matches(d.enrollment.user.email) ||
    matches(DOC_LABELS[d.type]) ||
    matches(d.fileName)
  );

  const toggleSelectEnrollment = (id) => {
    setSelectedEnrollmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const visibleEnrollmentIds = filteredEnrollments.map((r) => r.id);
  const allEnrollmentsSelected = visibleEnrollmentIds.length > 0 && visibleEnrollmentIds.every((id) => selectedEnrollmentIds.has(id));
  const someEnrollmentsSelected = visibleEnrollmentIds.some((id) => selectedEnrollmentIds.has(id));
  const toggleSelectAllEnrollments = () => {
    setSelectedEnrollmentIds((prev) => {
      const next = new Set(prev);
      if (allEnrollmentsSelected) visibleEnrollmentIds.forEach((id) => next.delete(id));
      else visibleEnrollmentIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleSelectDoc = (id) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const visibleDocIds = (selected?.documents || []).map((d) => d.id);
  const allDocsSelected = visibleDocIds.length > 0 && visibleDocIds.every((id) => selectedDocIds.has(id));
  const someDocsSelected = visibleDocIds.some((id) => selectedDocIds.has(id));
  const toggleSelectAllDocs = () => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (allDocsSelected) visibleDocIds.forEach((id) => next.delete(id));
      else visibleDocIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const columns = [
    ...(isSuperAdmin ? [{
      key: 'select',
      header: (
        <input
          type="checkbox"
          aria-label="Select all visible interns"
          checked={allEnrollmentsSelected}
          ref={(el) => { if (el) el.indeterminate = someEnrollmentsSelected && !allEnrollmentsSelected; }}
          onChange={toggleSelectAllEnrollments}
        />
      ),
      render: (r) => (
        <input
          type="checkbox"
          aria-label={`Select ${r.user.firstName} ${r.user.lastName}`}
          checked={selectedEnrollmentIds.has(r.id)}
          onChange={() => toggleSelectEnrollment(r.id)}
        />
      ),
    }] : []),
    { key: 'id', header: 'ID', render: (r) => <span title={r.id}>{r.id.slice(0, 8)}</span> },
    { key: 'name', header: 'Intern', render: (r) => `${r.user.firstName} ${r.user.lastName}` },
    { key: 'batch', header: 'Batch', render: (r) => r.batch?.name || '—' },
    { key: 'category', header: 'Category', render: (r) => r.category ? <Badge value={r.category} /> : '—' },
    { key: 'registerNumber', header: 'Register Number', render: (r) => r.registerNumber || '—' },
    { key: 'pending', header: 'Pending Review', render: (r) => r.documents.filter((d) => d.status === 'PENDING_REVIEW').length },
    { key: 'verified', header: 'Verified', render: (r) => r.documents.filter((d) => d.status === 'VERIFIED').length },
    { key: 'rejected', header: 'Rejected', render: (r) => r.documents.filter((d) => d.status === 'REJECTED').length },
    { key: 'approval', header: 'Approval', render: (r) => r.finalApprovedAt ? <Badge value="INTERNSHIP_CONFIRMED" /> : '—' },
    { key: 'actions', header: 'Actions', render: (r) => <Button size="sm" onClick={() => openDetail(r)}><Eye />Review</Button> },
  ];

  const trashColumns = [
    { key: 'id', header: 'ID', render: (d) => <span title={d.id}>{d.id.slice(0, 8)}</span> },
    { key: 'intern', header: 'Intern', render: (d) => `${d.enrollment.user.firstName} ${d.enrollment.user.lastName}` },
    { key: 'batch', header: 'Batch', render: (d) => d.enrollment.batch?.name || '—' },
    { key: 'type', header: 'Document', render: (d) => DOC_LABELS[d.type] },
    { key: 'status', header: 'Status', render: (d) => <Badge value={d.status} /> },
    { key: 'deletedAt', header: 'Removed', render: (d) => d.deletedAt ? new Date(d.deletedAt).toLocaleString() : '—' },
    {
      key: 'actions', header: 'Actions',
      render: (d) => isSuperAdmin ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={acting === d.id} onClick={() => handleRestoreDoc(d.id)}><RotateCcw />Restore</Button>
          <Button size="sm" variant="destructive" disabled={acting === d.id} onClick={() => handlePermanentlyDeleteDoc(d)}><Trash2 />Delete Permanently</Button>
        </div>
      ) : '—',
    },
  ];

  const docColumns = [
    ...(isSuperAdmin ? [{
      key: 'select',
      header: (
        <input
          type="checkbox"
          aria-label="Select all documents"
          checked={allDocsSelected}
          ref={(el) => { if (el) el.indeterminate = someDocsSelected && !allDocsSelected; }}
          onChange={toggleSelectAllDocs}
        />
      ),
      render: (d) => (
        <input
          type="checkbox"
          aria-label={`Select ${DOC_LABELS[d.type]}`}
          checked={selectedDocIds.has(d.id)}
          onChange={() => toggleSelectDoc(d.id)}
        />
      ),
    }] : []),
    { key: 'id', header: 'ID', render: (d) => <span title={d.id}>{d.id.slice(0, 8)}</span> },
    { key: 'type', header: 'Document', render: (d) => DOC_LABELS[d.type] },
    { key: 'fileName', header: 'File Name' },
    { key: 'uploadedAt', header: 'Uploaded', render: (d) => new Date(d.uploadedAt).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (d) => <Badge value={d.status} /> },
    { key: 'adminRemarks', header: 'Remarks', render: (d) => d.adminRemarks || '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (d) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleViewDoc(d)}>
            <Eye />
          </Button>
          {d.status === 'PENDING_REVIEW' && (
            <>
              <Button size="sm" variant="success" disabled={acting === d.id} onClick={() => handleApprove(d.id)}>
                <CheckCircle2 />
                Approve
              </Button>
              <Button size="sm" variant="destructive" disabled={acting === d.id} onClick={() => handleReject(d.id)}>
                <XCircle />
                Reject
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" disabled={acting === d.id} onClick={() => openEditRemarks(d)}>
            <Pencil />
          </Button>
          {isSuperAdmin && (
            <Button size="sm" variant="ghost" disabled={acting === d.id} onClick={() => handleDeleteDoc(d.id)}>
              <Trash2 />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intern Document Review"
        subtitle="Review internship profiles and verify uploaded documents"
        actions={isSuperAdmin ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => downloadReport('/reports/intern-documents', 'intern-documents.csv')}><Download />Export CSV</Button>
            <Button variant="secondary" onClick={() => downloadReport('/reports/intern-documents?format=xlsx', 'intern-documents.xlsx')}><Download />Export Excel</Button>
          </div>
        ) : undefined}
      />

      {/* Cards are tab-specific — Review Queue shows document-review +
          lifecycle counts, Trash shows only Trash-relevant counts. Previously
          this grid was unconditional and never changed when switching to the
          Trash tab; both blocks below are now gated on pageTab so cards
          actually update when the tab changes. */}
      {pageTab === 'review' && (
        // Clean 4-column grid — row 1 is document-review counts, row 2 is
        // internship-lifecycle counts. KpiCard's Card is a flex column with
        // no fixed height, so it already stretches to match the tallest
        // card in its row (CSS grid's default align-items: stretch) —
        // Offer Letters/Certificates' extra hint line doesn't unbalance the
        // row. Row 2 only fully populates for Super Admin — offerLetters/
        // certificates are absent from /analytics/overview for Admin by
        // design (see analytics.controller.js), not a bug here.
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Total Documents" value={summary.totalDocuments} accent="primary" icon={Files} />
          <KpiCard label="Pending Review" value={summary.pendingReview} accent="warning" icon={Clock} />
          <KpiCard label="Verified" value={summary.verified} accent="success" icon={CircleCheck} />
          <KpiCard label="Rejected" value={summary.rejected} accent="destructive" icon={CircleX} />
          <KpiCard label="Approved (Interns)" value={summary.approved} accent="purple" icon={ShieldCheck} />
          {lifecycleStats && (
            <>
              <KpiCard label="Pending Final Approval" value={lifecycleStats.documents.pendingApplications} accent="warning" icon={ClipboardCheck} />
              {lifecycleStats.offerLetters && (
                <KpiCard label="Offer Letters" value={lifecycleStats.offerLetters.generated} hint={`${lifecycleStats.offerLetters.pending} pending`} accent="info" icon={FileText} />
              )}
              {lifecycleStats.certificates && (
                <KpiCard label="Certificates" value={lifecycleStats.certificates.generated} hint={`${lifecycleStats.certificates.eligiblePending} ready to issue`} accent="success" icon={Award} />
              )}
            </>
          )}
        </div>
      )}

      {pageTab === 'trash' && (
        // Only what's genuinely available for Trash: summary.trash is the
        // same authoritative server-side count already used for the tab's
        // badge; "Interns Affected" is a real distinct-enrollment count
        // derived from the already-loaded trashDocs, not a fabricated stat.
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Documents in Trash" value={summary.trash} accent="destructive" icon={Archive} />
          <KpiCard label="Interns Affected" value={new Set(trashDocs.map((d) => d.enrollment.user.id)).size} accent="primary" icon={Users} />
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-border">
        <button
          className={`px-3 py-2 text-sm font-medium ${pageTab === 'review' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'}`}
          onClick={() => setPageTab('review')}
        >
          Review Queue
        </button>
        <button
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${pageTab === 'trash' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'}`}
          onClick={() => setPageTab('trash')}
        >
          <Archive className="size-4" /> Trash {summary.trash > 0 && <Badge value="TERMINATED" label={String(summary.trash)} />}
        </button>
      </div>

      {/* Same left-icon search pattern already used by GlobalSearch.jsx in
          the top bar — filters the already-loaded list client-side (see
          filteredEnrollments/filteredTrashDocs above), no new API call. */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by intern name, email, or document..."
          className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isSuperAdmin && pageTab === 'review' && selectedEnrollmentIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <span>{selectedEnrollmentIds.size} selected</span>
          <Button size="sm" variant="ghost" onClick={() => setSelectedEnrollmentIds(new Set())}>Clear selection</Button>
          <Button size="sm" variant="secondary" onClick={() => exportSelectedToCsv(enrollments.filter((r) => selectedEnrollmentIds.has(r.id)))}>
            <Download /> Export Selected
          </Button>
        </div>
      )}

      {loading ? <Skeleton className="h-80" /> : (
        pageTab === 'trash'
          ? <Table columns={trashColumns} rows={filteredTrashDocs} emptyMessage={searchTerm ? 'No matching documents in Trash.' : 'Trash is empty.'} />
          : <Table columns={columns} rows={filteredEnrollments} emptyMessage={searchTerm ? 'No matching interns.' : 'No intern enrollments found.'} />
      )}

      {selected && (
        <Dialog
          title={`${selected.user.firstName} ${selected.user.lastName} — Documents`}
          onClose={() => setSelected(null)}
          className="flex max-h-[85vh] flex-col sm:max-w-[960px]"
          bodyClassName="min-h-0 flex-1 overflow-y-auto"
        >
          <div className="space-y-6">
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

            {isSuperAdmin && selectedDocIds.size > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2 text-sm">
                <span>{selectedDocIds.size} selected</span>
                <Button size="sm" variant="ghost" onClick={() => setSelectedDocIds(new Set())}>Clear</Button>
                <Button size="sm" variant="destructive" onClick={handleBulkDeleteDocs}><Trash2 />Delete Selected</Button>
              </div>
            )}
            <Table columns={docColumns} rows={selected.documents} emptyMessage="No documents uploaded yet." />

            {isManager && (() => {
              const requiredVerified = selected.requirement?.satisfied ?? false;
              const canApprove = requiredVerified && !selected.finalApprovedAt;
              const canEnableOfferLetter = !!selected.finalApprovedAt && !selected.offerLetter;
              // Matches the backend's actual prerequisites exactly (see
              // intern.controller.js generateCertificate): final approval +
              // the internship end date having passed. An offer letter is
              // NOT required by the backend — the UI previously demanded
              // one anyway, disabling this button in cases the backend
              // would happily allow (e.g. approved, end date passed, but
              // the offer letter was never enabled).
              const canGenerateCertificate = !!selected.finalApprovedAt && !selected.certificate
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
                  {isSuperAdmin && !selected.certificate && !canGenerateCertificate && (
                    <p className="text-xs text-muted-foreground">
                      {!selected.finalApprovedAt
                        ? 'The completion certificate unlocks after final approval.'
                        : 'The completion certificate unlocks after the internship end date.'}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </Dialog>
      )}

      {viewingDoc && (
        <Dialog
          title={`${DOC_LABELS[viewingDoc.type] || 'Document'} — ${viewingDoc.fileName}`}
          onClose={closeViewDoc}
          className="flex max-h-[85vh] flex-col sm:max-w-3xl"
          bodyClassName="min-h-0 flex-1"
        >
          <div className="flex h-full min-h-0 flex-col gap-4">
            <iframe
              src={viewingDocUrl}
              title={viewingDoc.fileName}
              className="h-[65vh] w-full rounded-md border border-border bg-muted/20"
            />
            <div className="flex justify-end">
              <Button variant="ghost" onClick={closeViewDoc}>Cancel</Button>
            </div>
          </div>
        </Dialog>
      )}

      {editingRemarksDoc && (
        <Dialog title={`Edit Remarks — ${DOC_LABELS[editingRemarksDoc.type]}`} onClose={() => setEditingRemarksDoc(null)}>
          <div className="space-y-4">
            <textarea
              className="min-h-24 w-full rounded-md border border-input bg-transparent p-2 text-sm"
              value={remarksDraft}
              onChange={(e) => setRemarksDraft(e.target.value)}
              placeholder="Remarks visible to reviewers (not the file, type or status — those stay immutable)"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingRemarksDoc(null)}>Cancel</Button>
              <Button disabled={acting === editingRemarksDoc.id} onClick={handleSaveRemarks}>
                {acting === editingRemarksDoc.id ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
