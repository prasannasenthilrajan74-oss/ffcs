import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Film,
  ArrowLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Search,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { DepartmentName, VerifyMemberResult } from '../api/client';
import {
  ALL_DEPARTMENTS,
  submitApplication,
  verifyFFCSMember,
} from '../api/client';
import axios from 'axios';

type Step = 'form' | 'review' | 'submitting';

interface FormData {
  name: string;
  email: string;
  registrationNumber: string;
  phone: string;
  pref1: DepartmentName | '';
  pref2: DepartmentName | '';
  pref3: DepartmentName | '';
}

const INITIAL_FORM: FormData = {
  name: '',
  email: '',
  registrationNumber: '',
  phone: '',
  pref1: '',
  pref2: '',
  pref3: '',
};

function SelectField({
  label,
  value,
  onChange,
  exclude,
  id,
  required,
}: {
  label: string;
  value: DepartmentName | '';
  onChange: (v: DepartmentName | '') => void;
  exclude: (DepartmentName | '')[];
  id: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
      >
        {label}
        {required && <span className="text-[#e63946] ml-1">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as DepartmentName | '')}
        required={required}
        className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#e63946]/60 focus:ring-1 focus:ring-[#e63946]/30 transition-colors appearance-none"
      >
        <option value="">Select department…</option>
        {ALL_DEPARTMENTS.map((dept) => (
          <option
            key={dept}
            value={dept}
            disabled={exclude.includes(dept)}
          >
            {dept}
            {exclude.includes(dept) ? ' (already selected)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {}
  );
  const [submitError, setSubmitError] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyMemberResult | null>(null);
  const [verifiedMember, setVerifiedMember] = useState<VerifyMemberResult['member'] | null>(null);

  const set = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    []
  );

  // Check member against official FFCS roster
  const checkMember = useCallback(async (regNo: string) => {
    const clean = regNo.trim().toUpperCase();
    if (!clean || clean.length < 5) {
      setVerifyResult(null);
      setVerifiedMember(null);
      return;
    }

    setVerifying(true);
    try {
      const res = await verifyFFCSMember(clean);
      setVerifyResult(res);
      if (res.valid && res.member) {
        setVerifiedMember(res.member);
        setForm((prev) => ({
          ...prev,
          registrationNumber: res.member!.registrationNumber,
          name: res.member!.name,
          email: res.member!.email,
          phone: prev.phone || res.member!.phone || '',
        }));
        setErrors((prev) => ({
          ...prev,
          registrationNumber: undefined,
          name: undefined,
          email: undefined,
        }));
        if (res.alreadyRegistered) {
          toast('You have already submitted department preferences.', { icon: 'ℹ️' });
        } else {
          toast.success(`Verified: ${res.member.name}`);
        }
      } else {
        setVerifiedMember(null);
        setErrors((prev) => ({
          ...prev,
          registrationNumber: res.message || 'Not found in official FFCS roster',
        }));
      }
    } catch {
      toast.error('Failed to verify registration number with FFCS roster');
    } finally {
      setVerifying(false);
    }
  }, []);

  // Debounced auto-verification as student types their reg number
  useEffect(() => {
    const clean = form.registrationNumber.trim().toUpperCase();
    if (clean.length >= 8 && (!verifiedMember || verifiedMember.registrationNumber !== clean)) {
      const timer = setTimeout(() => {
        checkMember(clean);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [form.registrationNumber, verifiedMember, checkMember]);

  // Validate form fields
  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!form.registrationNumber.trim()) {
      newErrors.registrationNumber = 'Registration number is required';
    } else if (verifyResult && !verifyResult.valid) {
      newErrors.registrationNumber = 'Must be an approved member in the FFCS roster';
    } else if (verifyResult?.alreadyRegistered) {
      newErrors.registrationNumber = 'You have already submitted your preferences';
    } else if (!verifiedMember) {
      newErrors.registrationNumber = 'Please verify your registration number first';
    }

    if (!form.name.trim()) newErrors.name = 'Full name is required';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!form.email.toLowerCase().endsWith('@vitstudent.ac.in')) {
      newErrors.email = 'Must be a @vitstudent.ac.in email address';
    } else if (
      verifiedMember &&
      form.email.toLowerCase().trim() !== verifiedMember.email.toLowerCase().trim()
    ) {
      newErrors.email = `Must match your registered FFCS email (${verifiedMember.email})`;
    }

    if (!form.pref1) newErrors.pref1 = 'First preference is required';
    if (!form.pref2) newErrors.pref2 = 'Second preference is required';
    if (!form.pref3) newErrors.pref3 = 'Third preference is required';
    if (form.phone && !/^[0-9+\-\s()]{7,15}$/.test(form.phone)) {
      newErrors.phone = 'Invalid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function goToReview(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) setStep('review');
  }

  async function handleSubmit() {
    if (step === 'submitting') return; // prevent double submit
    setStep('submitting');
    setSubmitError('');

    try {
      const result = await submitApplication({
        name: form.name.trim(),
        email: form.email.trim(),
        registrationNumber: form.registrationNumber.trim(),
        phone: form.phone.trim() || undefined,
        preferences: [
          form.pref1 as DepartmentName,
          form.pref2 as DepartmentName,
          form.pref3 as DepartmentName,
        ],
      });

      // Store in sessionStorage so result page works on refresh without re-submitting
      sessionStorage.setItem('vitsion_result', JSON.stringify(result));
      navigate('/result', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data;

        // Duplicate registration — treat as already done
        if (err.response?.status === 409 && data?.applicationNumber) {
          sessionStorage.setItem(
            'vitsion_result',
            JSON.stringify({
              applicationNumber: data.applicationNumber,
              status: data.status,
              allocatedDepartment: data.allocatedDepartment,
            })
          );
          navigate('/result', { replace: true });
          return;
        }

        // Validation errors from backend
        if (err.response?.status === 422 && data?.errors) {
          const msgs = (data.errors as Array<{ msg: string }>)
            .map((e) => e.msg)
            .join('. ');
          setSubmitError(msgs);
          setStep('review');
          return;
        }

        // Registration closed
        if (err.response?.status === 403) {
          setSubmitError(
            data?.error || 'Registration is currently closed.'
          );
          setStep('review');
          return;
        }

        // Rate limit
        if (err.response?.status === 429) {
          setSubmitError(
            'Too many requests. Please wait a moment and try again.'
          );
          setStep('review');
          return;
        }
      }

      setSubmitError(
        'Something went wrong while submitting your application. Please try again.'
      );
      setStep('review');
      toast.error('Submission failed. Please try again.');
    }
  }



  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Film strip top */}
      <div className="h-2 bg-gradient-to-r from-[#e63946] via-[#f4a261] to-[#e63946]" />

      {/* Header */}
      <header className="px-6 py-5 max-w-2xl mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold tracking-widest uppercase">
          <Film size={16} className="text-[#e63946]" />
          VITSION
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pb-16">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-2">
            Department Selection
          </h1>
          <p className="text-zinc-500 text-sm">
            {step === 'form' && 'Fill in your details to register for department selection.'}
            {(step === 'review' || step === 'submitting') &&
              'Review your information before submitting.'}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-8">
          {['Details', 'Review', 'Done'].map((label, i) => {
            const active =
              (i === 0 && step === 'form') ||
              (i === 1 && (step === 'review' || step === 'submitting')) ||
              (i === 2 && false);
            const done =
              (i === 0 && step !== 'form') || false;
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    active
                      ? 'bg-[#e63946] text-white'
                      : done
                      ? 'bg-green-600 text-white'
                      : 'bg-white/10 text-zinc-500'
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    active ? 'text-white' : 'text-zinc-600'
                  }`}
                >
                  {label}
                </span>
                {i < 2 && (
                  <ChevronRight size={14} className="text-zinc-700 mx-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── FORM STEP ─────────────────────────────────────────────────── */}
        {step === 'form' && (
          <form onSubmit={goToReview} noValidate className="space-y-5">
            {/* Registration Number First with FFCS Verification */}
            <Field
              label="Registration Number"
              id="registrationNumber"
              required
              error={errors.registrationNumber}
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="registrationNumber"
                    type="text"
                    value={form.registrationNumber}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      set('registrationNumber', val);
                      if (verifiedMember && val !== verifiedMember.registrationNumber) {
                        setVerifiedMember(null);
                        setVerifyResult(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        checkMember(form.registrationNumber);
                      }
                    }}
                    placeholder="Enter your registration number"
                    className={inputClass(!!errors.registrationNumber)}
                    autoComplete="off"
                  />
                  {verifiedMember && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 flex items-center gap-1 text-xs font-semibold">
                      <ShieldCheck size={16} /> Verified
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  id="verify-roster-btn"
                  onClick={() => checkMember(form.registrationNumber)}
                  disabled={verifying || !form.registrationNumber.trim()}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-zinc-200 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  {verifying ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-[#e63946]" />
                      Checking…
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      Verify Roster
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Enter your VIT registration number to check eligibility against the official FFCS roster.
              </p>
            </Field>

            {/* Verification Status Cards */}
            {verifiedMember && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-200">
                <CheckCircle2 className="text-emerald-400 mt-0.5 shrink-0" size={20} />
                <div className="text-sm flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck size={16} /> Approved FFCS Member
                    </span>
                    {(verifiedMember.programme || verifiedMember.school) && (
                      <span className="text-xs bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 font-medium">
                        {verifiedMember.programme} {verifiedMember.school ? `• ${verifiedMember.school}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-300 text-xs mt-1">
                    Official Record: <strong className="text-white">{verifiedMember.name}</strong> ({verifiedMember.email})
                  </p>
                  <p className="text-emerald-400/80 text-[11px] mt-1">
                    ✓ Name and email auto-filled from official club records.
                  </p>
                </div>
              </div>
            )}

            {verifyResult && !verifyResult.valid && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-200">
                <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={20} />
                <div className="text-sm">
                  <div className="font-bold text-red-400">Not Eligible — FFCS Roster Check Failed</div>
                  <p className="text-zinc-300 text-xs mt-1">
                    {verifyResult.message || 'Registration number not found in official FFCS members roster.'}
                  </p>
                  <p className="text-red-400/80 text-[11px] mt-1">
                    Only students registered in the official 2026-27 roster can select departments.
                  </p>
                </div>
              </div>
            )}

            {verifyResult?.alreadyRegistered && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start justify-between gap-3 animate-in fade-in duration-200">
                <div className="text-sm">
                  <div className="font-bold text-amber-400">Already Submitted Preferences</div>
                  <p className="text-zinc-300 text-xs mt-1">
                    Application #{verifyResult.applicationNumber} was confirmed for{' '}
                    <strong className="text-white">{verifyResult.allocatedDepartment || 'Pending'}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem(
                      'vitsion_result',
                      JSON.stringify({
                        applicationNumber: verifyResult.applicationNumber,
                        status: verifyResult.status,
                        allocatedDepartment: verifyResult.allocatedDepartment,
                      })
                    );
                    navigate('/result');
                  }}
                  className="px-3 py-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg text-xs font-semibold whitespace-nowrap"
                >
                  View Result →
                </button>
              </div>
            )}

            {/* Name */}
            <Field
              label="Full Name"
              id="name"
              required
              error={errors.name}
            >
              <div className="relative">
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  readOnly={!!verifiedMember}
                  placeholder="Your full name"
                  className={`${inputClass(!!errors.name)} ${
                    verifiedMember ? 'bg-zinc-900 text-zinc-300 pr-10 cursor-not-allowed' : ''
                  }`}
                  autoComplete="name"
                />
                {verifiedMember && (
                  <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                )}
              </div>
            </Field>

            {/* Email */}
            <Field
              label="VIT Email ID"
              id="email"
              required
              error={errors.email}
            >
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  readOnly={!!verifiedMember}
                  placeholder="yourname@vitstudent.ac.in"
                  className={`${inputClass(!!errors.email)} ${
                    verifiedMember ? 'bg-zinc-900 text-zinc-300 pr-10 cursor-not-allowed' : ''
                  }`}
                  autoComplete="email"
                  inputMode="email"
                />
                {verifiedMember && (
                  <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                )}
              </div>
            </Field>

            {/* Phone */}
            <Field
              label="Phone Number"
              id="phone"
              error={errors.phone}
              optional
            >
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="e.g. 9876543210"
                className={inputClass(!!errors.phone)}
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>

            {/* Divider */}
            <div className="border-t border-white/[0.06] pt-4">
              <p className="text-xs text-zinc-500 mb-4">
                Select 3 different departments in order of preference.
              </p>
              <div className="space-y-4">
                <SelectField
                  id="pref1"
                  label="1st Preference"
                  value={form.pref1}
                  onChange={(v) => set('pref1', v)}
                  exclude={[form.pref2, form.pref3]}
                  required
                />
                {errors.pref1 && (
                  <p className="text-[#e63946] text-xs mt-1">{errors.pref1}</p>
                )}

                <SelectField
                  id="pref2"
                  label="2nd Preference"
                  value={form.pref2}
                  onChange={(v) => set('pref2', v)}
                  exclude={[form.pref1, form.pref3]}
                  required
                />
                {errors.pref2 && (
                  <p className="text-[#e63946] text-xs mt-1">{errors.pref2}</p>
                )}

                <SelectField
                  id="pref3"
                  label="3rd Preference"
                  value={form.pref3}
                  onChange={(v) => set('pref3', v)}
                  exclude={[form.pref1, form.pref2]}
                  required
                />
                {errors.pref3 && (
                  <p className="text-[#e63946] text-xs mt-1">{errors.pref3}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              id="review-btn"
              className="w-full py-4 bg-[#e63946] hover:bg-[#c1121f] text-white font-bold text-base rounded-xl transition-all duration-200 hover:shadow-[0_0_20px_rgba(230,57,70,0.3)] active:scale-[0.98] mt-4"
            >
              Review My Application →
            </button>
          </form>
        )}

        {/* ── REVIEW STEP ───────────────────────────────────────────────── */}
        {(step === 'review' || step === 'submitting') && (
          <div className="space-y-6">
            {/* Error banner */}
            {submitError && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Summary card */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <h2 className="font-bold text-sm tracking-wide">
                  Application Summary
                </h2>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {[
                  { label: 'Full Name', value: form.name },
                  { label: 'VIT Email', value: form.email },
                  { label: 'Registration Number', value: form.registrationNumber },
                  ...(form.phone
                    ? [{ label: 'Phone', value: form.phone }]
                    : []),
                  { label: '1st Preference', value: form.pref1 || '—' },
                  { label: '2nd Preference', value: form.pref2 || '—' },
                  { label: '3rd Preference', value: form.pref3 || '—' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-6 py-3">
                    <span className="text-zinc-500 text-sm">{row.label}</span>
                    <span className="text-white text-sm font-medium max-w-xs text-right break-all">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-zinc-600 text-xs text-center">
              Please verify your details. Once submitted, your application cannot be
              changed.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setSubmitError('');
                }}
                disabled={step === 'submitting'}
                className="flex-1 py-4 border border-white/10 text-zinc-300 font-semibold text-sm rounded-xl hover:border-white/20 transition-colors disabled:opacity-50"
              >
                ← Edit
              </button>
              <button
                type="button"
                id="submit-btn"
                onClick={handleSubmit}
                disabled={step === 'submitting'}
                className="flex-[2] py-4 bg-[#e63946] hover:bg-[#c1121f] disabled:bg-[#e63946]/50 text-white font-bold text-base rounded-xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3"
              >
                {step === 'submitting' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'SUBMIT APPLICATION'
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      <div className="h-2 bg-gradient-to-r from-[#e63946] via-[#f4a261] to-[#e63946]" />
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full bg-[#18181b] border ${
    hasError ? 'border-[#e63946]' : 'border-white/10'
  } rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#e63946]/60 focus:ring-1 focus:ring-[#e63946]/30 transition-colors`;
}

function Field({
  label,
  id,
  required,
  optional,
  error,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5"
      >
        {label}
        {required && <span className="text-[#e63946] ml-1">*</span>}
        {optional && <span className="text-zinc-600 ml-1 normal-case font-normal">(optional)</span>}
      </label>
      {children}
      {error && (
        <p className="text-[#e63946] text-xs mt-1 flex items-center gap-1">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}
