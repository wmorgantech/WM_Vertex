import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import toast from 'react-hot-toast';

const listToText = (arr) => (arr || []).join(', ');
const textToList = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

export default function Profile() {
  const { user: authUser, setUser: setAuthUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', password: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/users/${authUser.id}`)
      .then(({ data }) => {
        const p = data.data;
        setProfile(p);
        setForm({
          phone: p.phone || '',
          gender: p.gender || '',
          dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
          address: p.address || '',
          experienceYears: p.experienceYears ?? '',
          skills: listToText(p.skills),
          technologyStack: listToText(p.technologyStack),
          certifications: listToText(p.certifications),
        });
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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
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
    <div>
      <PageHeader title="My Profile" subtitle="Your basic details — visible to your organization" />

      {authUser.mustChangePassword && (
        <div style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          <strong>Password change required.</strong> Your administrator requires you to set a new password before you can continue using VertexWM.
        </div>
      )}

      <div className="card-grid">
        <div className="card">
          <h3>Account</h3>
          <dl className="detail-list">
            <dt>Name</dt><dd>{profile.firstName} {profile.lastName}</dd>
            <dt>Email</dt><dd>{profile.email}</dd>
            <dt>Role</dt><dd><Badge value={profile.role} /></dd>
            <dt>Designation</dt><dd>{profile.designation || '—'}</dd>
            <dt>Department</dt><dd>{profile.department?.name || '—'}</dd>
            <dt>Location</dt><dd>{profile.location?.name || '—'}</dd>
            <dt>Join Date</dt><dd>{new Date(profile.joinDate).toLocaleDateString()}</dd>
          </dl>
          <p className="empty-state" style={{ marginTop: 8, textAlign: 'left', padding: 0 }}>
            Name, role, department and designation are managed by your administrator.
          </p>
        </div>

        <div className="card">
          <h3>Basic Details</h3>
          <form className="form-grid" onSubmit={handleSave}>
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
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h3>Change Password</h3>
          <form className="form-grid" onSubmit={handleChangePassword}>
            <label>Current Password<input type="password" autoComplete="current-password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} /></label>
            <label>New Password<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.password} onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })} /></label>
            <label>Confirm Password<input type="password" minLength={8} required value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} /></label>
            <div className="form-actions">
              <button type="submit" className="btn btn-secondary" disabled={savingPassword}>{savingPassword ? 'Saving...' : 'Change Password'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
