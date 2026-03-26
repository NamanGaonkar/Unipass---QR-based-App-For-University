import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const emptyForm = {
  code: '',
  name: '',
  semester: '',
};

const AdminPanel = () => {
  const [subjects, setSubjects] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [editingForm, setEditingForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const subjectCount = useMemo(() => subjects.length, [subjects]);
  const activeTeachersCount = useMemo(() => activeSessions.length, [activeSessions]);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/subjects`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch subjects.');
      }
      setSubjects(Array.isArray(data.subjects) ? data.subjects : []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActiveSessions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/active-sessions`);
      const data = await response.json();
      if (response.ok && data.sessions) {
        setActiveSessions(Array.isArray(data.sessions) ? data.sessions : []);
      }
    } catch (err) {
      // Silent fail for active sessions polling
      console.log('Active sessions polling...');
    }
  }, []);

  useEffect(() => {
    loadSubjects();
    loadActiveSessions();
    const interval = setInterval(loadActiveSessions, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [loadSubjects, loadActiveSessions]);

  const addSubject = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      semester: form.semester.trim(),
    };

    if (!payload.code || !payload.name) {
      setError('Code and name are required.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subject.');
      }

      setSubjects((prev) => [data.subject, ...prev]);
      setForm(emptyForm);
      setStatus('Subject added.');
    } catch (createError) {
      setError(createError.message);
    }
  };

  const beginEdit = (subject) => {
    setEditingId(subject.id);
    setEditingForm({
      code: subject.code || '',
      name: subject.name || '',
      semester: subject.semester || '',
    });
    setStatus('');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId('');
    setEditingForm(emptyForm);
  };

  const saveEdit = async () => {
    const payload = {
      code: editingForm.code.trim().toUpperCase(),
      name: editingForm.name.trim(),
      semester: editingForm.semester.trim(),
    };

    if (!payload.code || !payload.name) {
      setError('Code and name are required.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/subjects/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update subject.');
      }

      setSubjects((prev) => prev.map((item) => (item.id === editingId ? data.subject : item)));
      cancelEdit();
      setStatus('Subject updated.');
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  const deleteSubject = async (subjectId) => {
    setError('');
    setStatus('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/subjects/${subjectId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove subject.');
      }

      setSubjects((prev) => prev.filter((item) => item.id !== subjectId));
      if (editingId === subjectId) {
        cancelEdit();
      }
      setStatus('Subject removed.');
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f7ef] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <header className="mb-8 overflow-hidden rounded-2xl border border-cyan-300/60 shadow-lg">
          <div className="bg-[#43c6c9] px-6 py-4 text-white">
            <h1 className="text-3xl font-black tracking-tight">UniPass Admin Console</h1>
            <p className="mt-1 text-sm text-cyan-50">Manage subjects for teacher sessions and live QR attendance windows.</p>
          </div>
          <div className="bg-[#4f8ec6] px-6 py-3 text-sm text-blue-50">No passwords. No login tables. Campus-local QR workflow.</div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-cyan-300 bg-[#43c6c9] p-4 text-white shadow">
            <p className="text-xs uppercase tracking-wide text-cyan-50">Subjects</p>
            <p className="mt-2 text-3xl font-black">{subjectCount}</p>
          </div>
          <div className="rounded-2xl border border-green-300 bg-emerald-500 p-4 text-white shadow">
            <p className="text-xs uppercase tracking-wide text-green-50">Active Teachers</p>
            <p className="mt-2 text-3xl font-black">{activeTeachersCount}</p>
          </div>
          <div className="rounded-2xl border border-violet-300 bg-[#5f5897] p-4 text-white shadow">
            <p className="text-xs uppercase tracking-wide text-violet-50">QR Protocol</p>
            <p className="mt-2 text-3xl font-black">Epoch + Sig</p>
          </div>
        </section>

        {activeSessions.length > 0 && (
          <section className="mt-6 rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">🔴 Live Sessions ({activeSessions.length})</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-700">
                    <th className="px-2 py-2">Teacher</th>
                    <th className="px-2 py-2">Subject</th>
                    <th className="px-2 py-2">Students Marked</th>
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSessions.map((session) => (
                    <tr key={`${session.teacherId}|${session.epoch}`} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50">
                      <td className="px-2 py-2">
                        <div className="font-semibold">{session.teacherName}</div>
                        <div className="text-xs text-slate-500">{session.teacherId}</div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-mono font-bold text-emerald-600">{session.subjectCode}</div>
                        <div className="text-xs text-slate-600">{session.subjectName}</div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="inline-block rounded-full bg-emerald-100 px-4 py-2 font-bold text-emerald-700">
                          {session.markedCount}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => setSelectedSession(session)}
                          className="rounded bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {selectedSession.subjectCode} – {selectedSession.subjectName}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">Teaching by {selectedSession.teacherName}</p>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="text-2xl text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-600">Teacher ID</p>
                  <p className="mt-1 font-mono text-lg font-bold text-slate-900">{selectedSession.teacherId}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-600">Teacher Name</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{selectedSession.teacherName}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-emerald-600">Attendance Count</p>
                  <p className="mt-1 text-3xl font-black text-emerald-700">{selectedSession.markedCount}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-blue-600">Session Epoch</p>
                  <p className="mt-1 font-mono text-lg font-bold text-blue-900">{selectedSession.epoch}</p>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-slate-100 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-600">Session Timeline</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><strong>Started:</strong> {new Date(selectedSession.issuedAt).toLocaleString()}</p>
                  <p><strong>Expires:</strong> {new Date(selectedSession.expiresAt).toLocaleString()}</p>
                  <p><strong>Last Activity:</strong> {new Date(selectedSession.lastActivity).toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedSession(null)}
                  className="rounded-lg bg-slate-200 px-6 py-2 font-semibold text-slate-700 hover:bg-slate-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Add Subject</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={addSubject}>
            <input
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
              placeholder="Code (EC401)"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
              placeholder="Subject Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
              placeholder="Semester"
              value={form.semester}
              onChange={(e) => setForm((prev) => ({ ...prev, semester: e.target.value }))}
            />
            <button type="submit" className="rounded-xl bg-[#245ad7] px-3 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8]">
              Add Subject
            </button>
          </form>
          {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
          {status ? <p className="mt-3 text-sm font-semibold text-emerald-600">{status}</p> : null}
        </section>

        <section className="mt-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Configured Subjects</h2>
            <button
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={loadSubjects}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {subjects.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No subjects yet.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-700">
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Semester</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((item) => {
                    const isEditing = editingId === item.id;
                    return (
                      <tr key={item.id} className="border-b border-slate-100 text-slate-700">
                        <td className="px-2 py-2 font-mono">
                          {isEditing ? (
                            <input
                              className="w-28 rounded border border-slate-300 px-2 py-1"
                              value={editingForm.code}
                              onChange={(e) => setEditingForm((prev) => ({ ...prev, code: e.target.value }))}
                            />
                          ) : (
                            item.code
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {isEditing ? (
                            <input
                              className="w-full min-w-56 rounded border border-slate-300 px-2 py-1"
                              value={editingForm.name}
                              onChange={(e) => setEditingForm((prev) => ({ ...prev, name: e.target.value }))}
                            />
                          ) : (
                            item.name
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {isEditing ? (
                            <input
                              className="w-20 rounded border border-slate-300 px-2 py-1"
                              value={editingForm.semester}
                              onChange={(e) => setEditingForm((prev) => ({ ...prev, semester: e.target.value }))}
                            />
                          ) : (
                            item.semester || '-'
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
                                  onClick={saveEdit}
                                >
                                  Save
                                </button>
                                <button
                                  className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                                  onClick={cancelEdit}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                className="rounded bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-200"
                                onClick={() => beginEdit(item)}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                              onClick={() => deleteSubject(item.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminPanel;
