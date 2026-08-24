import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { downloadReport } from '../../lib/download';
import { useAuth } from '../../context/AuthContext';

const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

export default function Trainees() {
  const { user } = useAuth();
  const [tab, setTab] = useState('enrollments');
  const [enrollments, setEnrollments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [programForm, setProgramForm] = useState({ name: '', description: '', technology: '', duration: '', trainerId: '', mentorId: '', fee: '', discount: '', finalFee: '', startDate: '', endDate: '' });
  const [enrollForm, setEnrollForm] = useState({ userId: '', programId: '', mentorId: '', totalFee: '', discount: '', finalFee: '' });
  const [topicForm, setTopicForm] = useState({ topic: '', sequence: '', expectedDurationHours: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/trainees/enrollments'), api.get('/trainees/programs'), api.get('/users')])
      .then(([e, p, u]) => {
        setEnrollments(e.data.data);
        setPrograms(p.data.data);
        setUsers(u.data.data);
        if (!selectedProgramId && p.data.data.length) setSelectedProgramId(p.data.data[0].id);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    if (!selectedProgramId) return;
    api.get('/trainees/topics', { params: { programId: selectedProgramId } }).then(({ data }) => setTopics(data.data));
  }, [selectedProgramId]);

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/trainees/programs', {
        ...programForm,
        fee: numOrNull(programForm.fee),
        discount: numOrNull(programForm.discount),
        finalFee: numOrNull(programForm.finalFee),
      });
      toast.success('Training program created');
      setShowProgramModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create program');
    } finally {
      setSaving(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/trainees/enrollments', {
        ...enrollForm,
        totalFee: numOrNull(enrollForm.totalFee),
        discount: numOrNull(enrollForm.discount),
        finalFee: numOrNull(enrollForm.finalFee),
      });
      toast.success('Trainee enrolled');
      setShowEnrollModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to enroll trainee');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/trainees/topics', {
        ...topicForm,
        programId: selectedProgramId,
        sequence: topicForm.sequence === '' ? 0 : parseInt(topicForm.sequence, 10),
        expectedDurationHours: numOrNull(topicForm.expectedDurationHours),
      });
      toast.success('Topic added');
      setShowTopicModal(false);
      setTopicForm({ topic: '', sequence: '', expectedDurationHours: '' });
      const { data } = await api.get('/trainees/topics', { params: { programId: selectedProgramId } });
      setTopics(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add topic');
    } finally {
      setSaving(false);
    }
  };

  const enrollmentColumns = [
    { key: 'name', header: 'Trainee', render: (r) => <Link to={`/trainees/${r.id}`}>{r.user.firstName} {r.user.lastName}</Link> },
    { key: 'program', header: 'Program', render: (r) => r.program.name },
    { key: 'mentor', header: 'Mentor', render: (r) => r.mentor ? `${r.mentor.firstName} ${r.mentor.lastName}` : '—' },
    { key: 'progressPercent', header: 'Progress', render: (r) => `${r.progressPercent}%` },
    { key: 'completionStatus', header: 'Status', render: (r) => <Badge value={r.completionStatus} /> },
  ];

  const programColumns = [
    { key: 'name', header: 'Program' },
    { key: 'technology', header: 'Technology', render: (r) => r.technology || '—' },
    { key: 'trainer', header: 'Trainer', render: (r) => `${r.trainer.firstName} ${r.trainer.lastName}` },
    { key: 'startDate', header: 'Start', render: (r) => new Date(r.startDate).toLocaleDateString() },
    { key: 'endDate', header: 'End', render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'count', header: 'Trainees', render: (r) => r._count?.enrollments ?? 0 },
  ];

  const topicColumns = [
    { key: 'sequence', header: '#' },
    { key: 'topic', header: 'Topic' },
    { key: 'expectedDurationHours', header: 'Hours', render: (r) => r.expectedDurationHours ?? '—' },
    { key: 'active', header: 'Status', render: (r) => <Badge value={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
  ];

  const potentialTrainees = users.filter((u) => !enrollments.some((e) => e.user.id === u.id) && u.role !== 'INTERN');
  const staffUsers = users.filter((u) => ['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(u.role));

  return (
    <div>
      <PageHeader
        title="Trainee Management"
        subtitle="Training programs, curriculum topics, and trainee lifecycle"
        actions={(
          <>
            {user.role === 'SUPER_ADMIN' && (
              <>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/trainees', 'trainees.csv')}>Export CSV</button>
                <button className="btn btn-secondary" onClick={() => downloadReport('/reports/trainees?format=xlsx', 'trainees.xlsx')}>Export Excel</button>
              </>
            )}
            <button className="btn btn-secondary" onClick={() => setShowProgramModal(true)}><Plus size={14} /> New Program</button>
            <button className="btn btn-primary" onClick={() => setShowEnrollModal(true)}><Plus size={14} /> Enroll Trainee</button>
          </>
        )}
      />

      <div className="tabs">
        <button className={`tab ${tab === 'enrollments' ? 'active' : ''}`} onClick={() => setTab('enrollments')}>Trainees</button>
        <button className={`tab ${tab === 'programs' ? 'active' : ''}`} onClick={() => setTab('programs')}>Programs</button>
        <button className={`tab ${tab === 'topics' ? 'active' : ''}`} onClick={() => setTab('topics')}>Curriculum Topics</button>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : (
        <>
          {tab === 'enrollments' && <DataTable columns={enrollmentColumns} rows={enrollments} emptyMessage="No trainees enrolled yet." />}
          {tab === 'programs' && <DataTable columns={programColumns} rows={programs} emptyMessage="No training programs yet." />}
          {tab === 'topics' && (
            <div>
              <div className="toolbar">
                <select value={selectedProgramId} onChange={(e) => setSelectedProgramId(e.target.value)}>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="btn btn-primary" onClick={() => setShowTopicModal(true)} disabled={!selectedProgramId}><Plus size={14} /> Add Topic</button>
              </div>
              <DataTable columns={topicColumns} rows={topics} emptyMessage="No topics defined for this program yet." />
            </div>
          )}
        </>
      )}

      {showProgramModal && (
        <Modal title="New Training Program" onClose={() => setShowProgramModal(false)}>
          <form className="form-grid" onSubmit={handleCreateProgram}>
            <label>Name<input required value={programForm.name} onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })} /></label>
            <label>Technology<input value={programForm.technology} onChange={(e) => setProgramForm({ ...programForm, technology: e.target.value })} /></label>
            <label>Duration<input placeholder="e.g. 3 months" value={programForm.duration} onChange={(e) => setProgramForm({ ...programForm, duration: e.target.value })} /></label>
            <label>Trainer
              <select required value={programForm.trainerId} onChange={(e) => setProgramForm({ ...programForm, trainerId: e.target.value })}>
                <option value="">Select trainer...</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Mentor
              <select value={programForm.mentorId} onChange={(e) => setProgramForm({ ...programForm, mentorId: e.target.value })}>
                <option value="">— None —</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Fee<input type="number" value={programForm.fee} onChange={(e) => setProgramForm({ ...programForm, fee: e.target.value })} /></label>
            <label>Discount<input type="number" value={programForm.discount} onChange={(e) => setProgramForm({ ...programForm, discount: e.target.value })} /></label>
            <label>Final Fee<input type="number" value={programForm.finalFee} onChange={(e) => setProgramForm({ ...programForm, finalFee: e.target.value })} /></label>
            <label>Start Date<input type="date" required value={programForm.startDate} onChange={(e) => setProgramForm({ ...programForm, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" required value={programForm.endDate} onChange={(e) => setProgramForm({ ...programForm, endDate: e.target.value })} /></label>
            <label>Description<textarea value={programForm.description} onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowProgramModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showEnrollModal && (
        <Modal title="Enroll Trainee" onClose={() => setShowEnrollModal(false)}>
          <form className="form-grid" onSubmit={handleEnroll}>
            <label>Trainee
              <select required value={enrollForm.userId} onChange={(e) => setEnrollForm({ ...enrollForm, userId: e.target.value })}>
                <option value="">Select user...</option>
                {potentialTrainees.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Program
              <select required value={enrollForm.programId} onChange={(e) => setEnrollForm({ ...enrollForm, programId: e.target.value })}>
                <option value="">Select program...</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Mentor
              <select value={enrollForm.mentorId} onChange={(e) => setEnrollForm({ ...enrollForm, mentorId: e.target.value })}>
                <option value="">— None —</option>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </label>
            <label>Total Fee<input type="number" value={enrollForm.totalFee} onChange={(e) => setEnrollForm({ ...enrollForm, totalFee: e.target.value })} /></label>
            <label>Discount<input type="number" value={enrollForm.discount} onChange={(e) => setEnrollForm({ ...enrollForm, discount: e.target.value })} /></label>
            <label>Final Fee<input type="number" value={enrollForm.finalFee} onChange={(e) => setEnrollForm({ ...enrollForm, finalFee: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowEnrollModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Enroll'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showTopicModal && (
        <Modal title="Add Curriculum Topic" onClose={() => setShowTopicModal(false)}>
          <form className="form-grid" onSubmit={handleCreateTopic}>
            <label>Topic<input required value={topicForm.topic} onChange={(e) => setTopicForm({ ...topicForm, topic: e.target.value })} /></label>
            <label>Sequence<input type="number" value={topicForm.sequence} onChange={(e) => setTopicForm({ ...topicForm, sequence: e.target.value })} /></label>
            <label>Expected Hours<input type="number" value={topicForm.expectedDurationHours} onChange={(e) => setTopicForm({ ...topicForm, expectedDurationHours: e.target.value })} /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowTopicModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
