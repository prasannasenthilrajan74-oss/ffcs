import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Film,
  LayoutDashboard,
  Users,
  Building2,
  LogOut,
  Menu,
  X,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminLogout, checkAdminAuth } from '../../api/client';

const NAV = [
  { to: '/appdefg', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/appdefg/applicants', label: 'Applicants', icon: Users },
  { to: '/appdefg/departments', label: 'Departments', icon: Building2 },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    checkAdminAuth().then((ok) => {
      if (!ok) navigate('/appdefg/login', { replace: true });
      else setAuthChecked(true);
    });
  }, [navigate]);

  async function handleLogout() {
    try {
      await adminLogout();
      toast.success('Logged out');
      navigate('/appdefg/login', { replace: true });
    } catch {
      toast.error('Logout failed');
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="text-[#e63946] animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex">
      {/* ── Sidebar (desktop) ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 bg-[#0c0c0e] border-r border-white/[0.06] fixed inset-y-0 left-0 z-20">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
          <Film size={20} className="text-[#e63946]" />
          <div>
            <div className="text-xs font-black tracking-widest text-white uppercase">
              VITSION
            </div>
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
              Admin Panel
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon, exact }) => {
            const active = exact
              ? location.pathname === to
              : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#e63946]/15 text-[#e63946]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <button
            id="admin-logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Mobile nav ────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#0c0c0e] border-b border-white/[0.06] flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Film size={18} className="text-[#e63946]" />
          <span className="text-xs font-black tracking-widest text-white uppercase">
            VITSION Admin
          </span>
        </div>
        <button
          id="mobile-nav-toggle"
          onClick={() => setMobileOpen((o) => !o)}
          className="text-zinc-400 hover:text-white"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/70" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-14 left-0 right-0 bg-[#0c0c0e] border-b border-white/[0.06] py-2 px-3 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV.map(({ to, label, icon: Icon, exact }) => {
              const active = exact
                ? location.pathname === to
                : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#e63946]/15 text-[#e63946]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
            <button
              onClick={() => { setMobileOpen(false); handleLogout(); }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium text-zinc-500 hover:text-white"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      )}

      {/* ── Page content ──────────────────────────────────────────── */}
      <div className="flex-1 md:ml-60">
        <div className="pt-14 md:pt-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
