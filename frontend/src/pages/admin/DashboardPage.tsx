import { useEffect, useState, useCallback } from 'react';
import { Users, CheckCircle2, Clock, Building2, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AdminStats } from '../../api/client';
import { getAdminStats, updateSettings } from '../../api/client';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAdminStats();
      setStats(data);
    } catch {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStats, 30_000);
    return () => clearInterval(interval);
  }, [loadStats]);

  async function toggleRegistration() {
    if (!stats || toggling) return;
    setToggling(true);
    try {
      const result = await updateSettings({
        registrationOpen: !stats.registrationOpen,
      });
      setStats((prev) => prev ? { ...prev, registrationOpen: result.registrationOpen } : prev);
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

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="text-zinc-500 animate-spin" size={24} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">VITSION Department Allocation</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="refresh-stats-btn"
            onClick={loadStats}
            disabled={loading}
            className="p-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
            title="Refresh"
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

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Total Applicants',
            value: stats?.totalApplicants ?? 0,
            icon: <Users size={20} className="text-zinc-400" />,
            color: 'border-white/[0.08]',
          },
          {
            label: 'Confirmed',
            value: stats?.confirmed ?? 0,
            icon: <CheckCircle2 size={20} className="text-green-400" />,
            color: 'border-green-500/20',
          },
          {
            label: 'Waitlisted',
            value: stats?.waitlisted ?? 0,
            icon: <Clock size={20} className="text-amber-400" />,
            color: 'border-amber-500/20',
          },
          {
            label: 'Seats Filled',
            value: `${stats?.totalFilled ?? 0} / ${stats?.totalCapacity ?? 0}`,
            icon: <Building2 size={20} className="text-[#e63946]" />,
            color: 'border-[#e63946]/20',
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`bg-[#111113] rounded-xl p-5 border ${card.color}`}
          >
            <div className="flex items-center justify-between mb-3">
              {card.icon}
            </div>
            <div className="text-2xl font-black text-white">{card.value}</div>
            <div className="text-zinc-500 text-xs mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Department status */}
      <div>
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
          Department Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stats?.departments.map((dept) => {
            const pct = dept.capacity > 0
              ? Math.min(100, (dept.allocatedCount / dept.capacity) * 100)
              : 0;
            const isFull = dept.allocatedCount >= dept.capacity;

            return (
              <div
                key={dept._id}
                className="bg-[#111113] rounded-xl p-5 border border-white/[0.06] hover:border-white/[0.10] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-white text-sm">{dept.name}</div>
                    <div className="text-zinc-500 text-xs mt-0.5">
                      {dept.allocatedCount} / {dept.capacity} seats
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
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
