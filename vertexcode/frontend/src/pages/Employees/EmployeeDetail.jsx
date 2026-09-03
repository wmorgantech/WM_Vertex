import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Pencil } from 'lucide-react';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import Badge from '@/components/shared/Badge';
import Modal from '@/components/common/Modal';
import CustomFieldsSection from '@/components/common/CustomFieldsSection';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';

const listToText = (arr) => (arr || []).join(', ');
const textToList = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'ALUMNI', label: 'Alumni' },
];

function initials(person) {
  return `${person?.firstName?.[0] || ''}${person?.lastName?.[0] || ''}`.toUpperCase();
}

function SectionHeading({ children, action }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h2>
      {action}
    </div>
  );
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

function TagList({ label, items }) {
  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      {items?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm font-medium text-foreground">—</p>
      )}
    </div>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [managers, setManagers] = useState([]);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/users/${id}`),
      api.get('/departments'),
      api.get('/masters/designations'),
      api.get('/masters/locations'),
      api.get('/masters/employment-types'),
      api.get('/users'),
    ])
      .then(([u, dep, des, loc, et, all]) => {
        setUser(u.data.data);
        setStatus(u.data.data.status);
        setDepartments(dep.data.data);
        setDesignations(des.data.data.filter((x) => x.active));
        setLocations(loc.data.data.filter((x) => x.active));
        setEmploymentTypes(et.data.data.filter((x) => x.active));
        setManagers(all.data.data.filter((x) => x.id !== id && ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(x.role)));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleStatusUpdate = async () => {
    try {
      await api.put(`/users/${id}`, { status });
      toast.success('Status updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const openProfileEdit = () => {
    setProfileForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      designation: user.designation || '',
      employmentType: user.employmentType,
      departmentId: user.departmentId || '',
      locationId: user.locationId || '',
      managerId: user.managerId || '',
      joinDate: user.joinDate ? user.joinDate.slice(0, 10) : '',
    });
    setShowProfileModal(true);
  };

  // Lets EmployeeList.jsx's "Edit" row action land directly in edit mode via
  // /employees/:id?edit=1, instead of duplicating this modal on the list page.
  useEffect(() => {
    if (user && searchParams.get('edit') === '1') {
      openProfileEdit();
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put(`/users/${id}`, {
        ...profileForm,
        designation: profileForm.designation || null,
        departmentId: profileForm.departmentId || null,
        locationId: profileForm.locationId || null,
        managerId: profileForm.managerId || null,
        joinDate: profileForm.joinDate || null,
      });
      toast.success('Profile updated');
      setShowProfileModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const openEdit = () => {
    setEditForm({
      gender: user.gender || '',
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '',
      address: user.address || '',
      experienceYears: user.experienceYears ?? '',
      skills: listToText(user.skills),
      technologyStack: listToText(user.technologyStack),
      certifications: listToText(user.certifications),
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/users/${id}`, {
        gender: editForm.gender || null,
        dateOfBirth: editForm.dateOfBirth || null,
        address: editForm.address || null,
        experienceYears: editForm.experienceYears === '' ? null : Number(editForm.experienceYears),
        skills: textToList(editForm.skills),
        technologyStack: textToList(editForm.technologyStack),
        certifications: textToList(editForm.certifications),
      });
      toast.success('Profile updated');
      setShowEditModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <div className="empty-state">Employee not found.</div>;

  return (
    <div className="pb-10">
      <Link
        to="/employees"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Employees
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
              <Badge value={user.status} />
            </div>
            <p className="text-sm text-muted-foreground">{user.designation || '—'}</p>
            <p className="text-xs text-muted-foreground">
              {user.role.replace(/_/g, ' ')} · {user.department?.name || 'No department'} · {user.location?.name || 'No location'}
            </p>
          </div>
        </div>
        <Button onClick={openProfileEdit}>
          <Pencil className="size-4" />
          Edit Profile
        </Button>
      </div>

      <Separator className="mt-6 mb-8" />

      {/* Content */}
      <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <SectionHeading>Contact</SectionHeading>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field icon={Mail} label="Email" value={user.email} />
              <Field icon={Phone} label="Phone" value={user.phone} />
            </div>
          </section>

          <Separator />

          <section>
            <SectionHeading>Work Information</SectionHeading>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field label="Role" value={user.role.replace(/_/g, ' ')} />
              <Field label="Designation" value={user.designation} />
              <Field label="Employment Type" value={user.employmentType} />
              <Field label="Department" value={user.department?.name} />
              <Field label="Location" value={user.location?.name} />
              <Field label="Manager" value={user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : null} />
              <Field label="Join Date" value={user.joinDate ? new Date(user.joinDate).toLocaleDateString() : null} />
            </div>
          </section>

          <Separator />

          <section>
            <SectionHeading action={<Button variant="ghost" size="sm" onClick={openEdit}><Pencil className="size-3.5" /> Edit</Button>}>
              Personal Information
            </SectionHeading>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field label="Gender" value={user.gender} />
              <Field label="Date of Birth" value={user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : null} />
              <Field label="Experience" value={user.experienceYears != null ? `${user.experienceYears} yrs` : null} />
              <Field className="sm:col-span-2" label="Address" value={user.address} />
              <TagList label="Skills" items={user.skills} />
              <TagList label="Technology Stack" items={user.technologyStack} />
              <TagList label="Certifications" items={user.certifications} />
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <SectionHeading>Employment Status</SectionHeading>
            <div className="flex items-center gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="mt-3 w-full" onClick={handleStatusUpdate} disabled={status === user.status}>
              Update Status
            </Button>
          </section>

          <Separator />

          <section>
            <SectionHeading>Direct Reports</SectionHeading>
            {user.directReports?.length ? (
              <ul className="space-y-3">
                {user.directReports.map((r) => (
                  <li key={r.id} className="flex items-center gap-2.5">
                    <Avatar className="size-7 text-[10px]">
                      <AvatarFallback>{initials(r)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{r.firstName} {r.lastName}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.designation || r.role}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No direct reports.</p>
            )}
          </section>

          <Separator />

          <CustomFieldsSection entityType="EMPLOYEE" entityId={user.id} />
        </div>
      </div>

      {showProfileModal && profileForm && (
        <Modal title="Edit Profile" onClose={() => setShowProfileModal(false)}>
          <form className="form-grid" onSubmit={handleSaveProfile}>
            <label>First Name<input required value={profileForm.firstName} onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })} /></label>
            <label>Last Name<input required value={profileForm.lastName} onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })} /></label>
            <label>Email<input type="email" required value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} /></label>
            <label>Phone<input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></label>
            <label>Role
              <select value={profileForm.role} onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })} disabled={!isSuperAdmin && (user.role === 'SUPER_ADMIN' || profileForm.role === 'SUPER_ADMIN')}>
                <option value="EMPLOYEE">Employee</option>
                <option value="ADMIN">Admin</option>
                {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
              </select>
            </label>
            <label>Designation
              <select value={profileForm.designation} onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}>
                <option value="">— None —</option>
                {designations.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </label>
            <label>Employment Type
              <select value={profileForm.employmentType} onChange={(e) => setProfileForm({ ...profileForm, employmentType: e.target.value })}>
                {employmentTypes.map((et) => <option key={et.code} value={et.code}>{et.label}</option>)}
              </select>
            </label>
            <label>Join Date<input type="date" required value={profileForm.joinDate} onChange={(e) => setProfileForm({ ...profileForm, joinDate: e.target.value })} /></label>
            <label>Department
              <select value={profileForm.departmentId} onChange={(e) => setProfileForm({ ...profileForm, departmentId: e.target.value })}>
                <option value="">— None —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label>Location
              <select value={profileForm.locationId} onChange={(e) => setProfileForm({ ...profileForm, locationId: e.target.value })}>
                <option value="">— None —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label>Manager
              <select value={profileForm.managerId} onChange={(e) => setProfileForm({ ...profileForm, managerId: e.target.value })}>
                <option value="">— None —</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowProfileModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showEditModal && editForm && (
        <Modal title="Edit Personal & Professional Details" onClose={() => setShowEditModal(false)}>
          <form className="form-grid" onSubmit={handleSaveEdit}>
            <label>Gender
              <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                <option value="">— Not specified —</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label>Date of Birth<input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} /></label>
            <label>Address<textarea value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></label>
            <label>Experience (years)<input type="number" step="0.5" value={editForm.experienceYears} onChange={(e) => setEditForm({ ...editForm, experienceYears: e.target.value })} /></label>
            <label>Skills (comma-separated)<input value={editForm.skills} onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })} placeholder="e.g. React, Node.js, SQL" /></label>
            <label>Technology Stack (comma-separated)<input value={editForm.technologyStack} onChange={(e) => setEditForm({ ...editForm, technologyStack: e.target.value })} placeholder="e.g. .NET, Azure, PostgreSQL" /></label>
            <label>Certifications (comma-separated)<input value={editForm.certifications} onChange={(e) => setEditForm({ ...editForm, certifications: e.target.value })} placeholder="e.g. AWS Certified Developer" /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
