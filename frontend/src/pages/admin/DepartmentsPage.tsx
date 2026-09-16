import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Edit3, Check, X, AlertTriangle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Department } from '../../api/client';
import {
  getAdminDepartments,
  updateDepartment,
  ALL_DEPARTMENTS,
} from '../../api/client';

interface EditState {
  id: string;
  value: string;
}

interface WarningState {
  id: string;
  requestedCapacity: number;
  currentAllocations: number;
  message: string;
}

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState<WarningState | null>(null);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminDepartments();
      // Sort by the canonical order
      const sorted = ALL_DEPARTMENTS.map((name) =>
        data.find((d) => d.name === name)
      ).filter(Boolean) as Department[];
      setDepartments(sorted);
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  function startEdit(dept: Department) {
    setEditing({ id: dept._id, value: String(dept.capacity) });
  }

  function cancelEdit() {
    setEditing(null);
    setWarning(null);
  }

  async function saveCapacity(force = false) {
    if (!editing) return;
    const newCapacity = parseInt(editing.value, 10);
    if (isNaN(newCapacity) || newCapacity < 0) {
      toast.error('Invalid capacity value');
      return;
    }

    setSaving(true);
    try {
      const result = await updateDepartment(editing.id, {
        capacity: newCapacity,
        force,
      });

      // Update local state
      setDepartments((prev) =>
        prev.map((d) => (d._id === editing.id ? { ...d, ...result } : d))
      );
      setEditing(null);
      setWarning(null);
      toast.success('Capacity updated');
    } catch (err: unknown) {
      // Check for over-capacity warning (409)
      const axErr = err as { response?: { status: number; data: WarningState & { warning: boolean } } };
      if (axErr.response?.status === 409 && axErr.response.data?.warning) {
        setWarning({
          id: editing.id,
          requestedCapacity: axErr.response.data.requestedCapacity,
          currentAllocations: axErr.response.data.currentAllocations,
          message: axErr.response.data.message,
        });
      } else {
        toast.error('Failed to update capacity');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleExportAll() {
    window.open('/api/admin/export', '_blank');
  }

  function handleExportDept(name: string) {
    window.open(
      `/api/admin/export?department=${encodeURIComponent(name)}`,
      '_blank'
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Departments</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Configure capacities and export department lists
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="export-all-depts-btn"
            onClick={handleExportAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-zinc-300 text-sm font-semibold hover:border-white/20 hover:text-white transition-colors"
          >
            <Download size={14} />
            Export All
          </button>
          <button
            id="refresh-depts-btn"
            onClick={loadDepartments}
            disabled={loading}
            className="p-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Warning modal */}
      {warning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#18181b] border border-amber-500/30 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-white mb-1">Capacity Warning</h3>
                <p className="text-zinc-400 text-sm">{warning.message}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                id="cancel-capacity-warning"
                onClick={cancelEdit}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-zinc-400 text-sm font-semibold hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-capacity-warning"
                onClick={() => saveCapacity(true)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold hover:bg-amber-500/30 transition-colors disabled:opacity-50"
              >
                Confirm Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Department table */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#111113] text-zinc-400 text-xs uppercase tracking-wider">
              <th className="px-5 py-3 text-left font-semibold">Department</th>
              <th className="px-5 py-3 text-center font-semibold">Capacity</th>
              <th className="px-5 py-3 text-center font-semibold">Filled</th>
              <th className="px-5 py-3 text-center font-semibold">Remaining</th>
              <th className="px-5 py-3 text-center font-semibold">Status</th>
              <th className="px-5 py-3 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-zinc-600">
                  <RefreshCw size={18} className="animate-spin inline" />
                </td>
              </tr>
            ) : (
              departments.map((dept) => {
                const isEditing = editing?.id === dept._id;
                const isFull = dept.allocatedCount >= dept.capacity;
                const pct =
                  dept.capacity > 0
                    ? Math.min(100, (dept.allocatedCount / dept.capacity) * 100)
                    : 0;

                return (
                  <tr
                    key={dept._id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4 font-semibold text-white">
                      {dept.name}
                    </td>

                    {/* Capacity cell with inline edit */}
                    <td className="px-5 py-4 text-center">
                      {isEditing ? (
                        <input
                          id={`capacity-input-${dept._id}`}
                          type="number"
                          min={0}
                          value={editing.value}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev ? { ...prev, value: e.target.value } : prev
                            )
                          }
                          className="w-20 bg-[#09090b] border border-[#e63946]/40 rounded-lg px-2 py-1 text-white text-center text-sm focus:outline-none focus:ring-1 focus:ring-[#e63946]/30"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveCapacity();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                      ) : (
                        <span className="font-mono font-bold text-white">
                          {dept.capacity}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-mono text-white">
                          {dept.allocatedCount}
                        </span>
                        <div className="w-16 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isFull
                                ? 'bg-red-500'
                                : pct > 70
                                ? 'bg-amber-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-center font-mono text-zinc-400">
                      {dept.remaining}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          isFull
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-green-500/20 text-green-400'
                        }`}
                      >
                        {isFull ? 'FULL' : 'OPEN'}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              id={`save-capacity-${dept._id}`}
                              onClick={() => saveCapacity()}
                              disabled={saving}
                              className="p-1.5 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              id={`cancel-edit-${dept._id}`}
                              onClick={cancelEdit}
                              className="p-1.5 rounded-md bg-white/10 text-zinc-400 hover:bg-white/20 transition-colors"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              id={`edit-capacity-${dept._id}`}
                              onClick={() => startEdit(dept)}
                              className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                              title="Edit capacity"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              id={`export-dept-${dept._id}`}
                              onClick={() => handleExportDept(dept.name)}
                              className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                              title="Export CSV"
                            >
                              <Download size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-zinc-600 text-xs mt-4">
        Click the edit icon to change a department's capacity. Existing
        allocations will never be removed automatically.
      </p>
    </div>
  );
}
