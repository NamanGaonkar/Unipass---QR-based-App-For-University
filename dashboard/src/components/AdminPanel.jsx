import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const emptyForm = {
  code: '',
  name: '',
  semester: '',
};

const AdminPanel = () => {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [editingForm, setEditingForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const subjectCount = useMemo(() => subjects.length, [subjects]);

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

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

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
          <div className="rounded-2xl border border-blue-300 bg-[#4f8ec6] p-4 text-white shadow">
            <p className="text-xs uppercase tracking-wide text-blue-50">Authentication</p>
            <p className="mt-2 text-3xl font-black">Passwordless</p>
          </div>
          <div className="rounded-2xl border border-violet-300 bg-[#5f5897] p-4 text-white shadow">
            <p className="text-xs uppercase tracking-wide text-violet-50">QR Protocol</p>
            <p className="mt-2 text-3xl font-black">Epoch + Sig</p>
          </div>
        </section>

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
