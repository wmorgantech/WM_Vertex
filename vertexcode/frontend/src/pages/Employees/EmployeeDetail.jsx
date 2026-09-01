import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import CustomFieldsSection from '../../components/common/CustomFieldsSection';
import toast from 'react-hot-toast';

const listToText = (arr) => (arr || []).join(', ');
const textToList = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

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
    <div>
      <PageHeader title={`${user.firstName} ${user.lastName}`} subtitle={user.designation || user.role} />

      <div className="card-grid">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Profile</h3>
            <button className="btn btn-ghost btn-sm" onClick={openProfileEdit}>Edit</button>
          </div>
          <dl className="detail-list">
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Phone</dt><dd>{user.phone || '—'}</dd>
            <dt>Role</dt><dd><Badge value={user.role} /></dd>
            <dt>Designation</dt><dd>{user.designation || '—'}</dd>
            <dt>Employment Type</dt><dd>{user.employmentType}</dd>
            <dt>Department</dt><dd>{user.department?.name || '—'}</dd>
            <dt>Location</dt><dd>{user.location?.name || '—'}</dd>
            <dt>Manager</dt><dd>{user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : '—'}</dd>
            <dt>Join Date</dt><dd>{new Date(user.joinDate).toLocaleDateString()}</dd>
          </dl>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Personal & Professional</h3>
            <button className="btn btn-ghost btn-sm" onClick={openEdit}>Edit</button>
          </div>
          <dl className="detail-list">
            <dt>Gender</dt><dd>{user.gender || '—'}</dd>
            <dt>Date of Birth</dt><dd>{user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : '—'}</dd>
            <dt>Address</dt><dd>{user.address || '—'}</dd>
            <dt>Experience</dt><dd>{user.experienceYears != null ? `${user.experienceYears} yrs` : '—'}</dd>
            <dt>Skills</dt><dd>{user.skills?.length ? user.skills.join(', ') : '—'}</dd>
            <dt>Technology Stack</dt><dd>{user.technologyStack?.length ? user.technologyStack.join(', ') : '—'}</dd>
            <dt>Certifications</dt><dd>{user.certifications?.length ? user.certifications.join(', ') : '—'}</dd>
          </dl>
        </div>

        <div className="card">
          <h3>Employment Status</h3>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="TERMINATED">Terminated</option>
            <option value="ALUMNI">Alumni</option>
          </select>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleStatusUpdate}>Update Status</button>
        </div>

        <CustomFieldsSection entityType="EMPLOYEE" entityId={user.id} />

        <div className="card">
          <h3>Direct Reports</h3>
          {user.directReports?.length ? (
            <ul className="simple-list">
              {user.directReports.map((r) => <li key={r.id}>{r.firstName} {r.lastName} — {r.designation || r.role}</li>)}
            </ul>
          ) : <div className="empty-state">No direct reports.</div>}
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
