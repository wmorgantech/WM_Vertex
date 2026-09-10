import { useEffect, useState } from 'react';
import { Pencil, Wallet, UserCog, GraduationCap } from 'lucide-react';
import api from '@/api/axios';
import toast from 'react-hot-toast';
import PageHeader from '@/components/shared/PageHeader';
import KpiCard from '@/components/shared/KpiCard';
import Badge from '@/components/shared/Badge';
import Dialog from '@/components/shared/Dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value ?? '—'}</p>
    </div>
  );
}

// Only education/qualification/experienceYears are self-editable — that's
// the exact whitelist PUT /trainees/enrollments/me enforces server-side
// (see trainee.controller.js's SELF_FIELDS), so the edit form here mirrors
// it exactly rather than offering fields the backend would silently ignore.
export default function MyProgram() {
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ education: '', qualification: '', experienceYears: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/trainees/enrollments')
      .then(({ data }) => {
        const mine = data.data[0];
        if (!mine) return null;
        return api.get(`/trainees/enrollments/${mine.id}`);
      })
      .then((res) => { if (res) setEnrollment(res.data.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openEdit = () => {
    setForm({
      education: enrollment.education || '',
      qualification: enrollment.qualification || '',
      experienceYears: enrollment.experienceYears ?? '',
    });
    setEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/trainees/enrollments/me', {
        ...form,
        experienceYears: form.experienceYears === '' ? null : Number(form.experienceYears),
      });
      toast.success('Details updated');
      setEditing(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Program" subtitle="No training program enrollment on record yet." />
        <p className="text-sm text-muted-foreground">Contact an admin to be enrolled in a training program.</p>
      </div>
    );
  }

  const { program, mentor, payment } = enrollment;
  const mentorName = mentor ? `${mentor.firstName} ${mentor.lastName}` : 'Not assigned';
  const trainerName = program.trainer ? `${program.trainer.firstName} ${program.trainer.lastName}` : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Program"
        subtitle={program.name}
        actions={<Button size="sm" variant="secondary" onClick={openEdit}><Pencil /> Edit My Details</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Status" value={enrollment.completionStatus.replace(/_/g, ' ')} icon={GraduationCap} accent="primary" />
        <KpiCard label="Mentor" value={mentorName} icon={UserCog} accent="info" />
        <KpiCard
          label="Payment Balance"
          value={payment.balance > 0 ? `₹${payment.balance.toLocaleString()}` : 'Paid'}
          icon={Wallet}
          accent={payment.balance > 0 ? 'destructive' : 'success'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Program Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 pb-5 sm:grid-cols-2">
            <Field label="Technology" value={program.technology} />
            <Field label="Duration" value={program.duration} />
            <Field label="Trainer" value={trainerName} />
            <Field label="Start Date" value={program.startDate ? new Date(program.startDate).toLocaleDateString() : null} />
            <Field label="End Date" value={program.endDate ? new Date(program.endDate).toLocaleDateString() : null} />
            <Field label="Program Status" value={<Badge value={program.status} />} />
            <div className="sm:col-span-2">
              <Field label="Description" value={program.description} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>My Enrollment</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 pb-5 sm:grid-cols-2">
            <Field label="Training Start" value={enrollment.trainingStartDate ? new Date(enrollment.trainingStartDate).toLocaleDateString() : null} />
            <Field label="Training End" value={enrollment.trainingEndDate ? new Date(enrollment.trainingEndDate).toLocaleDateString() : null} />
            <Field label="Education" value={enrollment.education} />
            <Field label="Qualification" value={enrollment.qualification} />
            <Field label="Experience" value={enrollment.experienceYears != null ? `${enrollment.experienceYears} yrs` : null} />
            {enrollment.notes && (
              <div className="sm:col-span-2">
                <Field label="Notes" value={enrollment.notes} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {editing && (
        <Dialog title="Edit My Details" onClose={() => setEditing(false)}>
          <form className="space-y-4" onSubmit={handleSave}>
            <label className="block text-sm">
              Education
              <input
                className="mt-1 w-full rounded-md border border-input bg-transparent p-2 text-sm"
                value={form.education}
                onChange={(e) => setForm({ ...form, education: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Qualification
              <input
                className="mt-1 w-full rounded-md border border-input bg-transparent p-2 text-sm"
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Experience (years)
              <input
                type="number" step="0.5"
                className="mt-1 w-full rounded-md border border-input bg-transparent p-2 text-sm"
                value={form.experienceYears}
                onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
