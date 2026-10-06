import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  ArrowRightLeft,
  MailX,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type {
  Applicant,
  Department,
  DepartmentName,
  ApplicationStatus,
  ExportFormat,
} from '../../api/client';
import {
  getAdminApplications,
  getAdminDepartments,
  deleteAdminApplication,
  overrideApplicant,
  downloadExport,
  ALL_DEPARTMENTS,
} from '../../api/client';

type SortField = 'submittedAt' | 'applicationNumber';
type SortOrder = 'asc' | 'desc';

export default function AdminApplicantsPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('submittedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [applicantToDelete, setApplicantToDelete] = useState<Applicant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Override / Move State
  const [applicantToOverride, setApplicantToOverride] = useState<Applicant | null>(null);
  const [overrideDept, setOverrideDept] = useState<DepartmentName | ''>('');
  const [overrideStatus, setOverrideStatus] = useState<ApplicationStatus>('CONFIRMED');
  const [isOverriding, setIsOverriding] = useState(false);

  const fetchApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminApplications({
        search,
        status: statusFilter,
        department: deptFilter,
        sortBy,
        sortOrder,
        page,
        limit: 50,
      });
      setApplicants(data.applicants);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      toast.error('Failed to load applicants');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, deptFilter, sortBy, sortOrder, page]);

  async function handleConfirmDelete() {
    if (!applicantToDelete) return;
    setIsDeleting(true);
    try {
      await deleteAdminApplication(applicantToDelete._id);
      toast.success(`Deleted ${applicantToDelete.name}'s request. 1 seat restored.`);
      setApplicantToDelete(null);
      fetchApplicants();
      loadDepartments();
    } catch {
      toast.error('Failed to delete applicant request');
    } finally {
      setIsDeleting(false);
    }
  }

  const loadDepartments = useCallback(async () => {
    try {
      const data = await getAdminDepartments();
      setDepartments(data);
    } catch {
      // departments info optional for select labels
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  function openOverrideModal(applicant: Applicant) {
    setApplicantToOverride(applicant);
    setOverrideDept((applicant.allocatedDepartment as DepartmentName) || '');
    setOverrideStatus(applicant.status);
  }

  async function handleConfirmOverride() {
    if (!applicantToOverride) return;
    setIsOverriding(true);
    try {
      const res = await overrideApplicant(applicantToOverride._id, {
        allocatedDepartment: overrideDept ? (overrideDept as DepartmentName) : null,
        status: overrideStatus,
      });
      toast.success(res.message || 'Department allocation overridden (no email sent)');
      setApplicantToOverride(null);
      fetchApplicants();
      loadDepartments();
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to override applicant allocation';
      toast.error(errorMsg);
    } finally {
      setIsOverriding(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(fetchApplicants, 300); // debounce search
    return () => clearTimeout(t);
  }, [fetchApplicants]);

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ChevronUp size={12} className="text-zinc-700" />;
    return sortOrder === 'asc' ? (
      <ChevronUp size={12} className="text-[#e63946]" />
    ) : (
      <ChevronDown size={12} className="text-[#e63946]" />
    );
  }

  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  async function handleExport(format: ExportFormat) {
    setExportingFormat(format);
    try {
      await downloadExport(deptFilter || undefined, format);
      toast.success(
        `Downloaded ${deptFilter || 'all'} applicants (${format === 'xlsx' ? 'Excel' : 'CSV'})`
      );
    } catch {
      toast.error('Failed to download export');
    } finally {
      setExportingFormat(null);
    }
  }

  async function handleExportDept(dept: string, format: ExportFormat) {
    setExportingFormat(format);
    try {
      await downloadExport(dept, format);
      toast.success(`Downloaded ${dept} applicants (${format === 'xlsx' ? 'Excel' : 'CSV'})`);
    } catch {
      toast.error('Failed to download export');
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Applicants</h1>
          <p className="text-zinc-500 text-sm mt-1">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="export-excel-btn"
            onClick={() => handleExport('xlsx')}
            disabled={exportingFormat !== null}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-600/25 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors disabled:opacity-50"
            title="Download as Excel (.xlsx) file"
          >
            <FileSpreadsheet size={15} className={exportingFormat === 'xlsx' ? 'animate-pulse' : ''} />
            Export Excel
          </button>
          <button
            id="export-all-btn"
            onClick={() => handleExport('csv')}
            disabled={exportingFormat !== null}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/10 text-zinc-300 text-sm font-semibold hover:border-white/20 hover:text-white transition-colors disabled:opacity-50"
            title="Download as CSV file"
          >
            <FileText size={15} className={exportingFormat === 'csv' ? 'animate-pulse' : ''} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            id="applicant-search"
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, email, reg number, app number…"
            className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#e63946]/40 transition-colors"
          />
        </div>

        {/* Status filter */}
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-[#18181b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#e63946]/40 transition-colors"
        >
          <option value="">All Statuses</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="WAITLISTED">Waitlisted</option>
        </select>

        {/* Department filter */}
        <select
          id="dept-filter"
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
          className="bg-[#18181b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#e63946]/40 transition-colors"
        >
          <option value="">All Departments</option>
          {ALL_DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <button
          id="refresh-applicants-btn"
          onClick={fetchApplicants}
          disabled={loading}
          className="p-2.5 rounded-lg border border-white/10 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Export per-department buttons */}
      {deptFilter && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => handleExportDept(deptFilter, 'xlsx')}
            disabled={exportingFormat !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-600/20 transition-colors disabled:opacity-50"
            title={`Download ${deptFilter} in Excel`}
          >
            <FileSpreadsheet size={13} />
            Export {deptFilter} Excel
          </button>
          <button
            onClick={() => handleExportDept(deptFilter, 'csv')}
            disabled={exportingFormat !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e63946]/10 border border-[#e63946]/20 text-[#e63946] text-xs font-semibold hover:bg-[#e63946]/20 transition-colors disabled:opacity-50"
            title={`Download ${deptFilter} in CSV`}
          >
            <FileText size={13} />
            Export {deptFilter} CSV
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111113] text-zinc-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-semibold">
                  <button
                    id="sort-app-number"
                    className="flex items-center gap-1 hover:text-white transition-colors"
                    onClick={() => toggleSort('applicationNumber')}
                  >
                    App # <SortIcon field="applicationNumber" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Reg No</th>
                <th className="px-4 py-3 text-left font-semibold hidden xl:table-cell">Pref 1</th>
                <th className="px-4 py-3 text-left font-semibold hidden xl:table-cell">Pref 2</th>
                <th className="px-4 py-3 text-left font-semibold hidden xl:table-cell">Pref 3</th>
                <th className="px-4 py-3 text-left font-semibold">Allocated</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">
                  <button
                    id="sort-submitted"
                    className="flex items-center gap-1 hover:text-white transition-colors"
                    onClick={() => toggleSort('submittedAt')}
                  >
                    Submitted <SortIcon field="submittedAt" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading && applicants.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-zinc-600">
                    <RefreshCw size={20} className="animate-spin inline mb-2" />
                    <div>Loading…</div>
                  </td>
                </tr>
              ) : applicants.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-zinc-600">
                    No applicants found
                  </td>
                </tr>
              ) : (
                applicants.map((a) => (
                  <tr
                    key={a._id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                      {a.applicationNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-white truncate max-w-[140px]">
                      {a.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 hidden md:table-cell truncate max-w-[180px]">
                      {a.email}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell font-mono text-xs">
                      {a.registrationNumber}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs hidden xl:table-cell">
                      {a.preferences[0]}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs hidden xl:table-cell">
                      {a.preferences[1]}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs hidden xl:table-cell">
                      {a.preferences[2]}
                    </td>
                    <td className="px-4 py-3 text-white text-xs font-semibold">
                      {a.allocatedDepartment || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                          a.status === 'CONFIRMED'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            a.status === 'CONFIRMED' ? 'bg-green-400' : 'bg-amber-400'
                          }`}
                        />
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs hidden lg:table-cell whitespace-nowrap">
                      {new Date(a.submittedAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          id={`override-btn-${a._id}`}
                          onClick={() => openOverrideModal(a)}
                          title={`Override & move ${a.name} to another department (no email)`}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/40 transition-colors flex items-center gap-1"
                        >
                          <ArrowRightLeft size={13} />
                          <span>Move</span>
                        </button>
                        <button
                          id={`delete-btn-${a._id}`}
                          onClick={() => setApplicantToDelete(a)}
                          title={`Delete application for ${a.name}`}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-zinc-500 text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              id="prev-page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-zinc-400 text-sm disabled:opacity-40 hover:text-white hover:border-white/20 transition-colors"
            >
              ← Prev
            </button>
            <button
              id="next-page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-zinc-400 text-sm disabled:opacity-40 hover:text-white hover:border-white/20 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {applicantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/15 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Applicant Request?</h3>
                <p className="text-xs text-zinc-400">Release allocated seat and permit re-application</p>
              </div>
            </div>

            <div className="bg-zinc-900/90 rounded-xl p-4 mb-4 border border-white/5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Applicant:</span>
                <span className="font-semibold text-white">{applicantToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Reg Number:</span>
                <span className="font-mono text-zinc-300">{applicantToDelete.registrationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Allocated Department:</span>
                <span className="font-semibold text-amber-400">
                  {applicantToDelete.allocatedDepartment || 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Status:</span>
                <span className="font-semibold text-zinc-300">{applicantToDelete.status}</span>
              </div>
            </div>

            <p className="text-zinc-400 text-xs mb-6">
              Deleting this record will permanently remove the application and{' '}
              <strong className="text-white">
                immediately free up 1 seat in {applicantToDelete.allocatedDepartment || 'the department'}
              </strong>
              . The student will be allowed to re-apply if eligible.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setApplicantToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-zinc-300 text-sm font-semibold hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-applicant-btn"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override / Move Department Modal */}
      {applicantToOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-white/15 rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Override Department Allocation</h3>
                  <p className="text-xs text-zinc-400">Reassign department & status manually</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApplicantToOverride(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Silent Notice Banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs mb-5">
              <MailX size={18} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Silent Admin Override:</span>
                <span className="text-emerald-300/90 ml-1">
                  No email notification will be sent to the applicant. The department allocation and capacity counts will update silently.
                </span>
              </div>
            </div>

            {/* Applicant Summary */}
            <div className="bg-zinc-900/90 rounded-xl p-4 mb-5 border border-white/5 space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Applicant:</span>
                <span className="font-semibold text-white">{applicantToOverride.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Registration Number:</span>
                <span className="font-mono text-zinc-200">{applicantToOverride.registrationNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Current Allocation:</span>
                <span className="font-semibold text-amber-400">
                  {applicantToOverride.allocatedDepartment || 'None'}{' '}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 ml-1">
                    {applicantToOverride.status}
                  </span>
                </span>
              </div>
              <div className="pt-2 border-t border-white/5">
                <span className="text-zinc-500 text-xs block mb-1.5">Submitted Preferences:</span>
                <div className="flex flex-wrap gap-1.5">
                  {applicantToOverride.preferences.map((pref, idx) => (
                    <span
                      key={pref}
                      className={`text-xs px-2 py-0.5 rounded border ${
                        pref === applicantToOverride.allocatedDepartment
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold'
                          : 'bg-zinc-800/80 border-white/10 text-zinc-400'
                      }`}
                    >
                      #{idx + 1} {pref}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Reassign Controls */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Target Department
                </label>
                <select
                  id="override-dept-select"
                  value={overrideDept}
                  onChange={(e) => {
                    const val = e.target.value as DepartmentName | '';
                    setOverrideDept(val);
                    if (val === '') {
                      setOverrideStatus('WAITLISTED');
                    } else if (overrideStatus === 'WAITLISTED') {
                      setOverrideStatus('CONFIRMED');
                    }
                  }}
                  className="w-full bg-[#111113] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                >
                  <option value="">— None / Waitlist (No Department) —</option>
                  {ALL_DEPARTMENTS.map((deptName) => {
                    const deptInfo = departments.find((d) => d.name === deptName);
                    const filled = deptInfo ? deptInfo.allocatedCount : 0;
                    const cap = deptInfo ? deptInfo.capacity : 0;
                    const isFull = deptInfo && filled >= cap;
                    return (
                      <option key={deptName} value={deptName}>
                        {deptName} ({filled} / {cap} filled{isFull ? ' • FULL' : ''})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Allocation Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideStatus('CONFIRMED')}
                    disabled={!overrideDept}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      overrideStatus === 'CONFIRMED'
                        ? 'bg-green-500/20 border-green-500/40 text-green-400'
                        : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300'
                    } ${!overrideDept ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    CONFIRMED
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideStatus('WAITLISTED')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      overrideStatus === 'WAITLISTED'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    WAITLISTED
                  </button>
                </div>
              </div>

              {/* Over-capacity advisory if target department is full */}
              {(() => {
                const targetDeptInfo = departments.find((d) => d.name === overrideDept);
                if (
                  targetDeptInfo &&
                  targetDeptInfo.allocatedCount >= targetDeptInfo.capacity &&
                  overrideDept !== applicantToOverride.allocatedDepartment
                ) {
                  return (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                      <span>
                        <strong>Capacity Notice:</strong> {overrideDept} has reached full capacity ({targetDeptInfo.allocatedCount}/{targetDeptInfo.capacity}). Proceeding will override the quota limit.
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setApplicantToOverride(null)}
                disabled={isOverriding}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-300 text-sm font-semibold hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-override-applicant-btn"
                onClick={handleConfirmOverride}
                disabled={isOverriding}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isOverriding ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Updating…
                  </>
                ) : (
                  <>
                    <ArrowRightLeft size={14} />
                    Apply Override
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
