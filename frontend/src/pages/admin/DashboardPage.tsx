import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  Building2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  UserX,
  Copy,
  Check,
  FileSpreadsheet,
  FileText,
  Search,
  Phone,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { AdminStats, UnfilledMembersResponse, UnfilledMember } from '../../api/client';
import {
  getAdminStats,
  getUnfilledMembers,
  downloadUnfilledExport,
  updateSettings,
} from '../../api/client';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [unfilledData, setUnfilledData] = useState<UnfilledMembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'excel' | null>(null);

  // Search, pagination & copy state for unfilled members
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const pageSize = 15;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, unfilledRes] = await Promise.all([
        getAdminStats(),
        getUnfilledMembers().catch((err) => {
          console.error('Failed to load unfilled members', err);
          return null;
        }),
      ]);
      setStats(statsRes);
      if (unfilledRes) {
        setUnfilledData(unfilledRes);
      }
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function toggleRegistration() {
    if (!stats || toggling) return;
    setToggling(true);
    try {
      const result = await updateSettings({
        registrationOpen: !stats.registrationOpen,
      });
      setStats((prev) => (prev ? { ...prev, registrationOpen: result.registrationOpen } : prev));
      toast.success(
        result.registrationOpen
          ? 'Registration is now OPEN'
          : 'Registration is now CLOSED'
      );
    } catch {
      toast.error('Failed to update setting');
    } finally {
      setToggling(false);
    }
  }

  // Handle export
  async function handleExport(format: 'csv' | 'excel') {
    try {
      setExportingFormat(format);
      await downloadUnfilledExport(format);
      toast.success(`Downloaded pending members (${format.toUpperCase()})`);
    } catch {
      toast.error(`Failed to export pending members as ${format.toUpperCase()}`);
    } finally {
      setExportingFormat(null);
    }
  }

  // Filtered unfilled members list
  const filteredUnfilled = useMemo(() => {
    if (!unfilledData?.unfilledMembers) return [];
    const q = search.trim().toLowerCase();
    if (!q) return unfilledData.unfilledMembers;

    return unfilledData.unfilledMembers.filter((m) => {
      return (
        m.name.toLowerCase().includes(q) ||
        m.registrationNumber.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.programme && m.programme.toLowerCase().includes(q)) ||
        (m.school && m.school.toLowerCase().includes(q)) ||
        (m.phone && m.phone.includes(q))
      );
    });
  }, [unfilledData?.unfilledMembers, search]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Paginated view
  const totalPages = Math.max(1, Math.ceil(filteredUnfilled.length / pageSize));
  const paginatedMembers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUnfilled.slice(start, start + pageSize);
  }, [filteredUnfilled, page]);

  // Copy all pending emails to clipboard
  async function handleCopyAllEmails() {
    if (!unfilledData?.unfilledMembers.length) return;
    const emails = unfilledData.unfilledMembers
      .map((m) => m.email.trim())
      .filter(Boolean)
      .join(', ');

    try {
      await navigator.clipboard.writeText(emails);
      setCopiedAll(true);
      toast.success(`Copied ${unfilledData.unfilledMembers.length} pending emails to clipboard!`);
      setTimeout(() => setCopiedAll(false), 3000);
    } catch {
      toast.error('Failed to copy emails');
    }
  }

  // Copy individual email
  async function handleCopySingleEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      toast.success(`Copied ${email}`);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch {
      toast.error('Failed to copy email');
    }
  }

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="text-zinc-500 animate-spin" size={24} />
      </div>
    );
  }

  const totalRoster = unfilledData?.totalRoster ?? stats?.totalRosterMembers ?? 131;
  const filledCount = unfilledData?.filledCount ?? stats?.rosterFilledCount ?? 0;
  const unfilledCount = unfilledData?.unfilledCount ?? stats?.rosterUnfilledCount ?? Math.max(0, totalRoster - filledCount);
  const fillPercentage = totalRoster > 0 ? Math.round((filledCount / totalRoster) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">
            VITSION Movie Makers Department Allocation • FFCS Member Tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="refresh-stats-btn"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Registration toggle */}
          <button
            id="toggle-registration-btn"
            onClick={toggleRegistration}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
              stats?.registrationOpen
                ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
            }`}
          >
            {stats?.registrationOpen ? (
              <>
                <ToggleRight size={18} /> Registration Open
              </>
            ) : (
              <>
                <ToggleLeft size={18} /> Registration Closed
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Summary Stats Cards (6 metrics) ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Total Roster Card */}
        <div className="bg-[#111113] rounded-xl p-4 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <Users size={18} className="text-blue-400" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase tracking-wider">
              Roster
            </span>
          </div>
          <div className="text-2xl font-black text-white">{totalRoster}</div>
          <div className="text-zinc-500 text-xs mt-1">Total FFCS Members</div>
        </div>

        {/* Submitted Card */}
        <div className="bg-[#111113] rounded-xl p-4 border border-emerald-500/20">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              {fillPercentage}%
            </span>
          </div>
          <div className="text-2xl font-black text-white">{filledCount}</div>
          <div className="text-zinc-500 text-xs mt-1">Submitted Forms</div>
        </div>

        {/* Not Filled Yet Card (HIGHLIGHTED) */}
        <div className="bg-[#111113] rounded-xl p-4 border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.04] to-transparent">
          <div className="flex items-center justify-between mb-2">
            <UserX size={18} className="text-amber-400" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
              {totalRoster > 0 ? Math.round((unfilledCount / totalRoster) * 100) : 0}% pending
            </span>
          </div>
          <div className="text-2xl font-black text-amber-300">{unfilledCount}</div>
          <div className="text-zinc-400 text-xs mt-1 font-medium">Not Filled Yet</div>
        </div>

        {/* Confirmed Seats Card */}
        <div className="bg-[#111113] rounded-xl p-4 border border-green-500/20">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 size={18} className="text-green-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats?.confirmed ?? 0}</div>
          <div className="text-zinc-500 text-xs mt-1">Confirmed Seats</div>
        </div>

        {/* Waitlisted Card */}
        <div className="bg-[#111113] rounded-xl p-4 border border-purple-500/20">
          <div className="flex items-center justify-between mb-2">
            <Clock size={18} className="text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats?.waitlisted ?? 0}</div>
          <div className="text-zinc-500 text-xs mt-1">Waitlisted</div>
        </div>

        {/* Total Seats Filled Card */}
        <div className="bg-[#111113] rounded-xl p-4 border border-[#e63946]/20">
          <div className="flex items-center justify-between mb-2">
            <Building2 size={18} className="text-[#e63946]" />
          </div>
          <div className="text-2xl font-black text-white">
            {stats?.totalFilled ?? 0} <span className="text-sm font-normal text-zinc-500">/ {stats?.totalCapacity ?? 0}</span>
          </div>
          <div className="text-zinc-500 text-xs mt-1">Dept Seats Filled</div>
        </div>
      </div>

      {/* ── FFCS Roster Submission Progress Banner ──────────────────────────── */}
      <div className="bg-[#111113] rounded-xl p-5 border border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">FFCS Roster Submission Progress</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-white/[0.06] text-zinc-300">
              {filledCount} of {totalRoster} submitted ({fillPercentage}%)
            </span>
          </div>
          <div className="text-xs text-zinc-400">
            <span className="font-bold text-amber-400">{unfilledCount}</span> member{unfilledCount === 1 ? '' : 's'} remaining to apply
          </div>
        </div>

        {/* Dual Progress Bar */}
        <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500"
            style={{ width: `${fillPercentage}%` }}
            title={`Filled: ${filledCount} (${fillPercentage}%)`}
          />
          <div
            className="h-full bg-amber-500/40 transition-all duration-500"
            style={{ width: `${100 - fillPercentage}%` }}
            title={`Pending: ${unfilledCount} (${100 - fillPercentage}%)`}
          />
        </div>
      </div>

      {/* ── Pending Members (Not Filled Yet) Section ─────────────────────────── */}
      <div className="bg-[#111113] rounded-xl border border-white/[0.08] overflow-hidden">
        {/* Section Header */}
        <div className="p-5 border-b border-white/[0.06] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-white">
                Pending FFCS Members (Not Filled Yet)
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                {unfilledCount} of {totalRoster} pending
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              List of approved FFCS roster members who have not yet submitted their department preference application.
            </p>
          </div>

          {/* Quick Actions (Copy Emails, Export) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyAllEmails}
              disabled={unfilledCount === 0}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                copiedAll
                  ? 'bg-green-500/20 border-green-500/40 text-green-400'
                  : 'bg-white/[0.04] border-white/10 text-zinc-300 hover:bg-white/[0.08] hover:text-white'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Copy comma-separated emails to paste into reminder email"
            >
              {copiedAll ? <Check size={14} /> : <Copy size={14} />}
              {copiedAll ? 'Emails Copied!' : 'Copy Pending Emails'}
            </button>

            <button
              onClick={() => handleExport('csv')}
              disabled={exportingFormat !== null || unfilledCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/10 text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-40"
              title="Export as CSV"
            >
              <FileText size={14} />
              CSV
            </button>

            <button
              onClick={() => handleExport('excel')}
              disabled={exportingFormat !== null || unfilledCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
              title="Export as Excel (.xlsx)"
            >
              <FileSpreadsheet size={14} />
              Excel
            </button>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="p-4 bg-white/[0.01] border-b border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search name, reg no, email, school..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#09090b] border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e63946]"
            />
          </div>

          <div className="text-xs text-zinc-400 self-start sm:self-center">
            Showing <span className="font-semibold text-white">{filteredUnfilled.length}</span> of{' '}
            <span className="font-semibold text-white">{unfilledCount}</span> pending members
          </div>
        </div>

        {/* Members Table */}
        {unfilledCount === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
              <Sparkles size={28} />
            </div>
            <h3 className="text-base font-bold text-white">All 131 FFCS Members Have Submitted!</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              100% submission rate achieved. Every approved member on the roster has completed their department preference application.
            </p>
          </div>
        ) : filteredUnfilled.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <AlertCircle size={24} className="mx-auto mb-2 text-zinc-600" />
            <div className="text-sm font-semibold text-zinc-400">No matching pending members found</div>
            <p className="text-xs text-zinc-600 mt-1">Try clearing your search query &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] border-b border-white/[0.06] text-zinc-400 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Reg No</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Programme / School</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedMembers.map((member: UnfilledMember, idx: number) => {
                  const globalIdx = (page - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={member.registrationNumber}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-4 text-center text-zinc-500 font-mono text-[11px]">
                        {globalIdx}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-zinc-200">
                          {member.registrationNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                        {member.name}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`mailto:${member.email}`}
                            className="text-zinc-300 hover:text-[#e63946] transition-colors font-mono text-[11px]"
                          >
                            {member.email}
                          </a>
                          <button
                            onClick={() => handleCopySingleEmail(member.email)}
                            className="p-1 rounded text-zinc-500 hover:text-white transition-colors"
                            title="Copy email"
                          >
                            {copiedEmail === member.email ? (
                              <Check size={12} className="text-green-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 whitespace-nowrap font-mono text-[11px]">
                        {member.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone size={11} className="text-zinc-600" />
                            {member.phone}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {member.programme && (
                            <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-300 text-[10px]">
                              {member.programme}
                            </span>
                          )}
                          {member.school && (
                            <span className="text-zinc-500 text-[11px]">({member.school})</span>
                          )}
                          {!member.programme && !member.school && (
                            <span className="text-zinc-600">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-3 bg-white/[0.01] border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              Page <span className="text-white font-medium">{page}</span> of{' '}
              <span className="text-white font-medium">{totalPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Department Status ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
          Department Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {stats?.departments.map((dept) => {
            const pct =
              dept.capacity > 0
                ? Math.min(100, (dept.allocatedCount / dept.capacity) * 100)
                : 0;
            const isFull = dept.allocatedCount >= dept.capacity;

            return (
              <div
                key={dept._id}
                className="bg-[#111113] rounded-xl p-4 border border-white/[0.06] hover:border-white/[0.10] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-white text-sm">{dept.name}</div>
                    <div className="text-zinc-500 text-xs mt-0.5">
                      {dept.allocatedCount} / {dept.capacity} seats
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isFull
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {isFull ? 'FULL' : `${dept.remaining} LEFT`}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isFull ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

