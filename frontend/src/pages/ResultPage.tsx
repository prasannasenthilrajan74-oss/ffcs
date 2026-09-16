import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Film, CheckCircle2, Clock, Copy, Check } from 'lucide-react';
import type { ApplicationStatus, DepartmentName } from '../api/client';

interface StoredResult {
  applicationNumber: string;
  status: ApplicationStatus;
  allocatedDepartment: DepartmentName | null;
}

export default function ResultPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<StoredResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('vitsion_result');
    if (!stored) {
      // No result in session — redirect to home
      navigate('/', { replace: true });
      return;
    }
    try {
      setResult(JSON.parse(stored));
    } catch {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  function copyAppNumber() {
    if (!result) return;
    navigator.clipboard.writeText(result.applicationNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!result) return null;

  const isConfirmed = result.status === 'CONFIRMED';

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      {/* Film strip top */}
      <div className="h-2 bg-gradient-to-r from-[#e63946] via-[#f4a261] to-[#e63946]" />

      {/* Header */}
      <header className="px-6 py-5 max-w-2xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold tracking-widest uppercase">
          <Film size={16} className="text-[#e63946]" />
          VITSION
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-lg">
          {isConfirmed ? (
            <>
              {/* Success glow */}
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-green-500/20 blur-2xl scale-150" />
                  <CheckCircle2 size={64} className="text-green-500 relative" />
                </div>
              </div>

              <div className="text-center mb-8">
                <h1 className="text-3xl font-black tracking-tight mb-2 text-green-400">
                  Registration Successful
                </h1>
                <p className="text-zinc-500 text-sm">
                  You have been allocated to a department.
                </p>
              </div>

              <div className="rounded-2xl border border-green-500/20 bg-green-500/5 overflow-hidden mb-6">
                <div className="divide-y divide-white/[0.04]">
                  <ResultRow label="Application Number">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-white">
                        {result.applicationNumber}
                      </span>
                      <button
                        id="copy-app-number"
                        onClick={copyAppNumber}
                        className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                        title="Copy application number"
                      >
                        {copied ? (
                          <Check size={14} className="text-green-400" />
                        ) : (
                          <Copy size={14} className="text-zinc-500" />
                        )}
                      </button>
                    </div>
                  </ResultRow>

                  <ResultRow label="Allocated Department">
                    <span className="font-bold text-white text-lg uppercase tracking-wide">
                      {result.allocatedDepartment}
                    </span>
                  </ResultRow>

                  <ResultRow label="Status">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-bold">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      CONFIRMED
                    </span>
                  </ResultRow>
                </div>
              </div>

              <p className="text-zinc-500 text-sm text-center mb-8">
                Please save your application number{' '}
                <strong className="text-white font-mono">
                  {result.applicationNumber}
                </strong>{' '}
                for future reference.
              </p>
            </>
          ) : (
            <>
              {/* Waitlisted */}
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-2xl scale-150" />
                  <Clock size={64} className="text-amber-500 relative" />
                </div>
              </div>

              <div className="text-center mb-8">
                <h1 className="text-3xl font-black tracking-tight mb-2 text-amber-400">
                  Application Submitted
                </h1>
                <p className="text-zinc-500 text-sm">
                  Your application has been received and recorded.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden mb-6">
                <div className="divide-y divide-white/[0.04]">
                  <ResultRow label="Application Number">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-white">
                        {result.applicationNumber}
                      </span>
                      <button
                        id="copy-app-number-waitlist"
                        onClick={copyAppNumber}
                        className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                        title="Copy application number"
                      >
                        {copied ? (
                          <Check size={14} className="text-green-400" />
                        ) : (
                          <Copy size={14} className="text-zinc-500" />
                        )}
                      </button>
                    </div>
                  </ResultRow>
                  <ResultRow label="Status">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      WAITLISTED
                    </span>
                  </ResultRow>
                </div>
              </div>

              <p className="text-zinc-500 text-sm text-center mb-8">
                All three selected departments were full at the time of
                allocation. Please save your application number{' '}
                <strong className="text-white font-mono">
                  {result.applicationNumber}
                </strong>{' '}
                for future reference.
              </p>
            </>
          )}

          <Link
            to="/"
            className="block w-full py-4 text-center border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 font-semibold text-sm rounded-xl transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </main>

      <div className="h-2 bg-gradient-to-r from-[#e63946] via-[#f4a261] to-[#e63946]" />
    </div>
  );
}

function ResultRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <span className="text-zinc-400 text-sm">{label}</span>
      <div>{children}</div>
    </div>
  );
}
