import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, GraduationCap } from 'lucide-react';
import api from '@/api/axios';
import Badge from '@/components/common/Badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

const CATEGORY_LABELS = { FREE_INTERNSHIP: 'Free Internship', JOT: 'Job Oriented Training (JOT)' };

function initials(person) {
  return `${person?.firstName?.[0] || ''}${person?.lastName?.[0] || ''}`.toUpperCase();
}

function SectionHeading({ children }) {
  return <h2 className="mb-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h2>;
}

function Field({ icon: Icon, label, value, className }) {
  return (
    <div className={`flex items-start gap-2.5 ${className || ''}`}>
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value ?? '—'}</p>
      </div>
    </div>
  );
}

export default function InternDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [enrollment, setEnrollment] = useState(location.state?.enrollment || null);
  const [loading, setLoading] = useState(!location.state?.enrollment);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // The list already sends the full enrollment via router state (the
    // normal navigation path); only a direct link, refresh, or missing
    // state falls back to fetching it — reusing the same, already
    // permission-scoped list endpoint rather than adding a new
    // get-enrollment-by-id route on the backend.
    if (location.state?.enrollment) return;
    setLoading(true);
    api.get('/interns/enrollments')
      .then(({ data }) => {
        const match = data.data.find((e) => e.id === id);
        if (!match) setNotFound(true);
        else setEnrollment(match);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="page-loading">Loading...</div>;
  if (notFound || !enrollment) return <div className="empty-state">Intern enrollment not found.</div>;

  const { user, batch, mentor } = enrollment;

  return (
    <div className="pb-10">
      <Link
        to="/interns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Interns
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar className="size-14 text-base">
            <AvatarFallback>{initials(user)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {user.firstName} {user.lastName}
              </h1>
              <Badge value={enrollment.completionStatus} />
              {enrollment.category && <Badge value={enrollment.category} label={CATEGORY_LABELS[enrollment.category]} />}
            </div>
            <p className="text-sm text-muted-foreground">{batch?.name || 'No batch'}</p>
            <p className="text-xs text-muted-foreground">
              {user.status?.replace(/_/g, ' ')} · Mentor: {mentor ? `${mentor.firstName} ${mentor.lastName}` : 'Unassigned'}
            </p>
          </div>
        </div>
      </div>

      <Separator className="mt-6 mb-8" />

      {/* Content */}
      <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <SectionHeading>Contact</SectionHeading>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field icon={Mail} label="Email" value={user.email} />
              <Field label="Account Status" value={user.status?.replace(/_/g, ' ')} />
            </div>
          </section>

          <Separator />

          <section>
            <SectionHeading>Internship</SectionHeading>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field label="Batch" value={batch?.name} />
              <Field label="Program" value={batch?.program} />
              <Field label="Batch Start" value={batch?.startDate ? new Date(batch.startDate).toLocaleDateString() : null} />
              <Field label="Batch End" value={batch?.endDate ? new Date(batch.endDate).toLocaleDateString() : null} />
              <Field label="Mentor" value={mentor ? `${mentor.firstName} ${mentor.lastName}` : null} />
              <Field label="Completion Status" value={enrollment.completionStatus?.replace(/_/g, ' ')} />
              <Field label="Progress" value={`${enrollment.progressPercent ?? 0}%`} />
              <Field label="Performance Rating" value={enrollment.performanceRating ?? null} />
              <Field label="Stipend" value={enrollment.stipend != null ? `₹${enrollment.stipend.toLocaleString()}` : null} />
              <Field label="Internship Start" value={enrollment.internshipStartDate ? new Date(enrollment.internshipStartDate).toLocaleDateString() : null} />
              <Field label="Internship End" value={enrollment.internshipEndDate ? new Date(enrollment.internshipEndDate).toLocaleDateString() : null} />
              <Field className="sm:col-span-2" label="Notes" value={enrollment.notes} />
            </div>
          </section>

          <Separator />

          <section>
            <SectionHeading>Academic Profile</SectionHeading>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field icon={GraduationCap} label="College" value={enrollment.collegeName} />
              <Field label="College Department" value={enrollment.collegeDepartment} />
              <Field label="College Email" value={enrollment.collegeEmail} />
              <Field label="Course" value={enrollment.course} />
              <Field label="University" value={enrollment.university} />
              <Field label="Branch" value={enrollment.branch} />
              <Field label="Semester" value={enrollment.semester} />
              <Field label="Year" value={enrollment.year} />
              <Field label="Register Number" value={enrollment.registerNumber} />
              <Field label="HOD Name" value={enrollment.hodName} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
