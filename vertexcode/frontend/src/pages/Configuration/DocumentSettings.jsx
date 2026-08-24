import { useEffect, useState } from 'react';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import toast from 'react-hot-toast';

export default function DocumentSettings() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => setForm(data.data)).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/settings', form);
      setForm(data.data);
      toast.success('Document settings updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <div className="page-loading">Loading...</div>;

  return (
    <div>
      <PageHeader
        title="Configuration — Document Settings"
        subtitle="Company identity used on generated offer letters and completion certificates"
      />

      <div className="card" style={{ maxWidth: 560 }}>
        <form className="form-grid" onSubmit={handleSave}>
          <label>Company Name<input value={form.companyName || ''} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></label>
          <label>Company Address<textarea value={form.companyAddress || ''} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} /></label>
          <label>Logo URL (optional)<input value={form.companyLogoUrl || ''} onChange={(e) => setForm({ ...form, companyLogoUrl: e.target.value })} placeholder="https://..." /></label>
          <label>Signatory Name<input value={form.signatoryName || ''} onChange={(e) => setForm({ ...form, signatoryName: e.target.value })} /></label>
          <label>Signatory Title<input value={form.signatoryTitle || ''} onChange={(e) => setForm({ ...form, signatoryTitle: e.target.value })} /></label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
