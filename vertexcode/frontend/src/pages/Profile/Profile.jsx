import { useEffect, useState } from 'react';
import { Mail, Phone, Pencil } from 'lucide-react';
import api from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import Badge from '@/components/common/Badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import toast from 'react-hot-toast';

const listToText = (arr) => (arr || []).join(', ');
const textToList = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

function initials(person) {
  return `${person?.firstName?.[0] || ''}${person?.lastName?.[0] || ''}`.toUpperCase();
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

function SectionHeading({ children }) {
  return <h2 className="mb-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h2>;
}

export default function Profile() {
  const { user: authUser, setUser: setAuthUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', password: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  const buildForm = (p) => ({
    phone: p.phone || '',
    gender: p.gender || '',
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
    address: p.address || '',
    experienceYears: p.experienceYears ?? '',
    skills: listToText(p.skills),
    technologyStack: listToText(p.technologyStack),
    certifications: listToText(p.certifications),
  });

  const load = () => {
    setLoading(true);
    api.get(`/users/${authUser.id}`)
      .then(({ data }) => {
        const p = data.data;
        setProfile(p);
        setForm(buildForm(p));
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [authUser.id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put(`/users/${authUser.id}`, {
        phone: form.phone || null,
        gender: form.gender || null,
        dateOfBirth: form.dateOfBirth || null,
        address: form.address || null,
        experienceYears: form.experienceYears === '' ? null : Number(form.experienceYears),
        skills: textToList(form.skills),
        technologyStack: textToList(form.technologyStack),
        certifications: textToList(form.certifications),
      });
      toast.success('Profile updated');
      setProfile((p) => ({ ...p, ...data.data }));
      setAuthUser((u) => ({ ...u, phone: data.data.phone }));
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setForm(buildForm(profile));
    setEditing(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (!passwordForm.currentPassword) {
      toast.error('Enter your current password');
      return;
    }
    setSavingPassword(true);
    try {
      await api.put(`/users/${authUser.id}`, {
        currentPassword: passwordForm.currentPassword,
        password: passwordForm.password,
      });
      toast.success('Password changed');
      setPasswordForm({ currentPassword: '', password: '', confirm: '' });
      // A successful self-service change always clears any pending forced
      // change — update locally so ProtectedRoute's redirect stops
      // immediately, without waiting for a fresh /auth/me fetch.
      setAuthUser((u) => {
        const updated = { ...u, mustChangePassword: false };
        localStorage.setItem('vertexwm_user', JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading || !profile) return <div className="page-loading">Loading...</div>;

  return (
    <div className="pb-10">
      <PageHeader title="My Profile" subtitle="Your basic details — visible to your organization" />

      {authUser.mustChangePassword && (
        <div style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', margin: '16px 0', fontSize: 13 }}>
          <strong>Password change required.</strong> Your administrator requires you to set a new password before you can continue using VertexWM.
        </div>
      )}

      {/* Header */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar className="size-14 text-base">
            <AvatarFallback>{initials(profile)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {profile.firstName} {profile.lastName}
              </h1>
              <Badge value={profile.role} />
            </div>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <p className="text-xs text-muted-foreground">
              {profile.designation || 'No designation'} · {profile.department?.name || 'No department'} · {profile.location?.name || 'No location'}
            </p>
          </div>
        </div>
        {!editing && (
          <Button onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit Profile
          </Button>
        )}
      </div>

      <Separator className="mt-6 mb-8" />

      {/* Content */}
      <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <SectionHeading>Work Information</SectionHeading>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field icon={Mail} label="Email" value={profile.email} />
              <Field label="Role" value={profile.role.replace(/_/g, ' ')} />
              <Field label="Designation" value={profile.designation} />
              <Field label="Department" value={profile.department?.name} />
              <Field label="Location" value={profile.location?.name} />
              <Field label="Join Date" value={profile.joinDate ? new Date(profile.joinDate).toLocaleDateString() : null} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Name, role, department and designation are managed by your administrator.
            </p>
          </section>

          <Separator />

          <section>
            <SectionHeading>Personal Details</SectionHeading>

            {!editing ? (
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                <Field icon={Phone} label="Phone" value={profile.phone} />
                <Field label="Gender" value={profile.gender} />
                <Field label="Date of Birth" value={profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : null} />
                <Field className="sm:col-span-2" label="Address" value={profile.address} />
                <Field label="Experience" value={profile.experienceYears != null ? `${profile.experienceYears} yrs` : null} />
                <TagList label="Skills" items={profile.skills} />
                <TagList label="Technology Stack" items={profile.technologyStack} />
                <TagList label="Certifications" items={profile.certifications} />
              </div>
            ) : (
              <form className="form-grid editing-panel" onSubmit={handleSave}>
                <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                <label>Gender
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="">— Not specified —</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label>Date of Birth<input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></label>
                <label>Address<textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
                <label>Experience (years)<input type="number" step="0.5" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} /></label>
                <label>Skills (comma-separated)<input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="e.g. React, Node.js, SQL" /></label>
                <label>Technology Stack (comma-separated)<input value={form.technologyStack} onChange={(e) => setForm({ ...form, technologyStack: e.target.value })} placeholder="e.g. .NET, Azure, PostgreSQL" /></label>
                <label>Certifications (comma-separated)<input value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} placeholder="e.g. AWS Certified Developer" /></label>
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={handleCancelEdit}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <SectionHeading>Change Password</SectionHeading>
            <form className="form-grid" onSubmit={handleChangePassword}>
              <label>Current Password<input type="password" autoComplete="current-password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} /></label>
              <label>New Password<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.password} onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })} /></label>
              <label>Confirm Password<input type="password" minLength={8} required value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} /></label>
              <div className="form-actions">
                <button type="submit" className="btn btn-secondary" disabled={savingPassword}>{savingPassword ? 'Saving...' : 'Change Password'}</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
