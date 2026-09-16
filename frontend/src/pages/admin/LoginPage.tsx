import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminLogin } from '../../api/client';
import axios from 'axios';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      await adminLogin(email, password);
      navigate('/admin', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429) {
          setError('Too many login attempts. Please try again in 15 minutes.');
        } else if (err.response?.status === 401) {
          setError('Invalid email or password.');
        } else {
          setError('Login failed. Please try again.');
        }
      } else {
        setError('Network error. Please check your connection.');
      }
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Film size={24} className="text-[#e63946]" />
            <span className="font-black text-xs tracking-widest text-zinc-400 uppercase">
              VITSION
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Admin Login</h1>
          <p className="text-zinc-600 text-sm mt-1">Restricted access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" id="admin-login-form">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
            >
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#e63946]/60 focus:ring-1 focus:ring-[#e63946]/30 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-[#e63946]/60 focus:ring-1 focus:ring-[#e63946]/30 transition-colors"
              />
              <button
                type="button"
                id="toggle-password"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="admin-login-btn"
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#e63946] hover:bg-[#c1121f] disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
