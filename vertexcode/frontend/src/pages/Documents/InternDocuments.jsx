import { useEffect, useRef, useState } from 'react';
import { Upload, Download, RotateCcw, FolderOpen, ShieldCheck, FileText, Award } from 'lucide-react';
import api from '@/api/axios';
import PageHeader from '@/components/shared/PageHeader';
import Table from '@/components/shared/Table';
import Badge from '@/components/shared/Badge';
import KpiCard from '@/components/shared/KpiCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';

const PROFILE_FIELDS = [
  { key: 'collegeName', label: 'College Name' },
  { key: 'university', label: 'University' },
  { key: 'collegeDepartment', label: 'Department' },
  { key: 'course', label: 'Course' },
  { key: 'branch', label: 'Branch' },
  { key: 'year', label: 'Year', type: 'number' },
  { key: 'semester', label: 'Semester', type: 'number' },
  { key: 'registerNumber', label: 'Register / Roll Number' },
  { key: 'collegeEmail', label: 'College Email (Optional)' },
  { key: 'hodName', label: 'HOD / Staff Name' },
  { key: 'internshipStartDate', label: 'Internship Start Date', type: 'date' },
  { key: 'internshipEndDate', label: 'Internship End Date', type: 'date' },
];

const DOC_TYPES = [
  { type: 'BONAFIDE', label: 'Bonafide Certificate', note: 'Upload this OR a Permission Letter' },
  { type: 'PERMISSION_LETTER', label: 'Permission Letter', note: 'Upload this OR a Bonafide Certificate' },
  { type: 'COLLEGE_ID', label: 'College ID Card', note: 'Required' },
  { type: 'RESUME', label: 'Resume', note: 'Optional' },
];

const EDITABLE_STATUSES = [undefined, 'DRAFT', 'REJECTED'];

function toDateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

const CATEGORY_LABELS = { FREE_INTERNSHIP: 'Free Internship', JOT: 'Job Oriented Training (JOT)' };

export default function InternDocuments() {
  const [data, setData] = useState(null);
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileForm, setProfileForm] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingType, setUploadingType] = useState(null);
  const fileInputRef = useRef(null);
  const pendingTypeRef = useRef(null);

  const load = () => {
    setLoading(true);
    api.get('/documents/mine')
      .then(({ data: res }) => {
        setData(res.data);
        setNotEnrolled(false);
        setProfileForm(Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, res.data.enrollment[f.key] ?? ''])));
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotEnrolled(true);
        else toast.error(err.response?.data?.message || 'Failed to load documents');
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleProfileChange = (key, value) => setProfileForm((f) => ({ ...f, [key]: value }));

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const payload = { ...profileForm };
      for (const f of PROFILE_FIELDS) {
        if (f.type === 'number' && payload[f.key] === '') payload[f.key] = null;
      }
      await api.put('/interns/enrollments/me', payload);
      toast.success('Profile updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const triggerUpload = (type) => {
    pendingTypeRef.current = type;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    const type = pendingTypeRef.current;
    e.target.value = '';
    if (!file || !type) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    setUploadingType(type);
    try {
      await api.post('/documents/upload', formData);
      toast.success('Document uploaded');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingType(null);
    }
  };

  const handleSubmitForVerification = async () => {
    setSubmitting(true);
    try {
      await api.post('/documents/submit');
      toast.success('Submitted for verification');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit for verification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = doc.fileName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download document');
    }
  };

  const handleLifecycleDownload = async (kind, enrollmentId) => {
    try {
      const res = await api.get(`/interns/enrollments/${enrollmentId}/${kind}/download`, { responseType: 'blob' });
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (notEnrolled) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Documents" subtitle="Internship profile and document verification" />
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            You are not yet enrolled in an internship batch. Contact an admin to get enrolled before completing your profile and documents.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { documents, profileCompletionPercent, verification, stage, offerLetter, certificate, enrollment } = data;
  const additionalDocs = documents.filter((d) => d.type === 'ADDITIONAL');
  const requiredGroups = verification.requiredGroups || [];
  const missingGroups = requiredGroups.filter((g) => g.status === 'MISSING' || g.status === 'REJECTED');
  const canSubmit = requiredGroups.every((g) => ['DRAFT', 'PENDING_REVIEW', 'VERIFIED'].includes(g.status))
    && documents.some((d) => d.status === 'DRAFT');

  const rows = [
    ...DOC_TYPES.map(({ type, label, note }) => ({
      key: type,
      label: `${label} (${note})`,
      type,
      doc: documents.find((d) => d.type === type),
    })),
    ...additionalDocs.map((doc, idx) => ({ key: doc.id, label: `Additional Document ${idx + 1}`, type: 'ADDITIONAL', doc })),
  ];

  const columns = [
    { key: 'label', header: 'Document', render: (r) => r.label },
    { key: 'fileName', header: 'File Name', render: (r) => r.doc?.fileName || '—' },
    { key: 'uploadedAt', header: 'Upload Date', render: (r) => r.doc ? new Date(r.doc.uploadedAt).toLocaleDateString() : '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.doc?.status || 'DRAFT'} /> },
    { key: 'remarks', header: 'Admin Remarks', render: (r) => r.doc?.adminRemarks || '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => {
        const canEdit = EDITABLE_STATUSES.includes(r.doc?.status);
        return (
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                disabled={uploadingType === r.type}
                onClick={() => triggerUpload(r.type)}
              >
                <Upload />
                {uploadingType === r.type ? 'Uploading...' : r.doc ? 'Re-upload' : 'Upload'}
              </Button>
            )}
            {r.doc?.status === 'VERIFIED' && (
              <Button size="sm" onClick={() => handleDownload(r.doc)}>
                <Download />
                Download
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="My Documents" subtitle="Internship profile and document verification" />

      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileSelected} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiCard label="Profile Completion" value={`${profileCompletionPercent}%`} icon={FolderOpen} accent="info" />
        <KpiCard label="Verified Required Docs" value={`${verification.verifiedRequired}/${verification.totalRequired}`} icon={ShieldCheck} accent="success" />
        <KpiCard label="Total Verified" value={`${verification.verifiedAll}/${verification.totalUploaded}`} icon={ShieldCheck} accent="primary" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Document Verification</CardTitle>
          <div className="flex items-center gap-2">
            {enrollment.category && <Badge value={enrollment.category} />}
            <Badge value={stage} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pb-5">
          {enrollment.category && (
            <p className="text-xs text-muted-foreground">Program: {CATEGORY_LABELS[enrollment.category] || enrollment.category}</p>
          )}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Required documents verified</span>
              <span className="text-muted-foreground">{verification.verifiedRequired}/{verification.totalRequired}</span>
            </div>
            <Progress value={(verification.verifiedRequired / verification.totalRequired) * 100} />
          </div>
          {missingGroups.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing / Action Needed</p>
              <ul className="list-inside list-disc text-sm text-foreground">
                {missingGroups.map((g) => <li key={g.key}>{g.label}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Offer Letter &amp; Completion Certificate</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Offer Letter</p>
                <p className="text-xs text-muted-foreground">
                  {offerLetter ? `Generated ${new Date(offerLetter.generatedAt).toLocaleDateString()}` : 'Not yet generated'}
                </p>
              </div>
            </div>
            <Button size="sm" disabled={!offerLetter} onClick={() => handleLifecycleDownload('offer-letter', enrollment.id)}>
              <Download />
              Download
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <Award className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Completion Certificate</p>
                <p className="text-xs text-muted-foreground">
                  {certificate ? `Generated ${new Date(certificate.generatedAt).toLocaleDateString()}` : 'Not yet generated'}
                </p>
              </div>
            </div>
            <Button size="sm" disabled={!certificate} onClick={() => handleLifecycleDownload('certificate', enrollment.id)}>
              <Download />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Internship Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={handleProfileSave}>
            {PROFILE_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                  value={f.type === 'date' ? toDateInput(profileForm[f.key]) : profileForm[f.key] ?? ''}
                  onChange={(e) => handleProfileChange(f.key, e.target.value)}
                />
              </div>
            ))}
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Profile'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Documents</CardTitle>
          <Button disabled={!canSubmit || submitting} onClick={handleSubmitForVerification}>
            <RotateCcw />
            {submitting ? 'Submitting...' : 'Submit for Verification'}
          </Button>
        </CardHeader>
        <CardContent>
          <Table columns={columns} rows={rows} />
          {!canSubmit && (
            <p className="mt-3 text-xs text-muted-foreground">
              Upload a Bonafide Certificate or Permission Letter, plus your College ID Card, before submitting for verification.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
