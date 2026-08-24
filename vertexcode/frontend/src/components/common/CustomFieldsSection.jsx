import { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

// Renders + edits whatever custom fields a Super Admin has configured for
// this entity type (Configuration > Custom Fields), against one specific
// record. Drop this into any entity detail page — Employee, Intern,
// Trainee, College, Workshop — with the matching entityType.
export default function CustomFieldsSection({ entityType, entityId, editable = true }) {
  const [fields, setFields] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/custom-fields/values', { params: { entityType, entityId } }).then(({ data }) => {
      setFields(data.data);
      setValues(Object.fromEntries(data.data.map((f) => [f.id, f.value ?? ''])));
    });
  };
  useEffect(load, [entityType, entityId]);

  if (fields === null) return null;
  if (fields.length === 0) return null;

  const handleChange = (fieldId, value) => setValues((v) => ({ ...v, [fieldId]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/custom-fields/values', {
        entityType,
        entityId,
        values: fields.map((f) => ({ fieldId: f.id, value: values[f.id] })),
      });
      toast.success('Custom fields saved');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save custom fields');
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (f) => {
    const val = values[f.id] ?? '';
    if (!editable) return <span>{val || '—'}</span>;
    switch (f.fieldType) {
      case 'TEXTAREA':
        return <textarea value={val} onChange={(e) => handleChange(f.id, e.target.value)} />;
      case 'NUMBER':
        return <input type="number" value={val} onChange={(e) => handleChange(f.id, e.target.value)} />;
      case 'DATE':
        return <input type="date" value={val} onChange={(e) => handleChange(f.id, e.target.value)} />;
      case 'CHECKBOX':
        return (
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={val === 'true'}
            onChange={(e) => handleChange(f.id, e.target.checked ? 'true' : 'false')}
          />
        );
      case 'DROPDOWN':
        return (
          <select value={val} onChange={(e) => handleChange(f.id, e.target.value)}>
            <option value="">— Select —</option>
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case 'MULTISELECT': {
        const selected = val ? val.split(',') : [];
        return (
          <select
            multiple
            value={selected}
            onChange={(e) => handleChange(f.id, [...e.target.selectedOptions].map((o) => o.value).join(','))}
          >
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      }
      default:
        return <input value={val} onChange={(e) => handleChange(f.id, e.target.value)} />;
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Additional Details</h3>
        {editable && <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>}
      </div>
      <div className="form-grid">
        {fields.map((f) => (
          <label key={f.id}>
            {f.name}{f.required ? ' *' : ''}
            {renderInput(f)}
          </label>
        ))}
      </div>
    </div>
  );
}
