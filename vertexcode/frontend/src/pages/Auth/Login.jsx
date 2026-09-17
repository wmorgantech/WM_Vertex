import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import wmMark from '../../assets/wmorgan-mark.png';
import LogoIntro from './LogoIntro';

// The real Role enum lives entirely server-side now — see
// AuthContext.jsx/RoleRoute.jsx/middleware/rbac.js, all unchanged. The
// role selector below is purely a visual affordance matching the brand
// reference (and is never sent to the login call or compared against
// anything) — the actual authentication (email + password) and the
// post-login role-based routing/authorization it triggers are untouched.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_OPTIONS = ['Super Admin', 'Admin', 'Employee', 'Intern'];

const inputClass =
  'w-full rounded-lg border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 ' +
  'transition-colors outline-none focus-visible:border-[#ff5252]/60 focus-visible:ring-2 focus-visible:ring-[#ff5252]/25 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [introComplete, setIntroComplete] = useState(false);
  const [selectedRole, setSelectedRole] = useState(ROLE_OPTIONS[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleEmailBlur = () => {
    if (email && !EMAIL_RE.test(email)) {
      setEmailError('Enter a valid email address.');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!EMAIL_RE.test(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError('');
    if (!password) {
      setFormError('Enter your password.');
      return;
    }
    setFormError('');
    setSubmitting(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (err?.response?.status === 401) {
        setFormError('Unable to sign in. Please check your email and password.');
      } else {
        setFormError(err?.response?.data?.message || 'Unable to sign in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Full-screen splash — nothing below it (this form included) is
          visible until it fades out; see LogoIntro.jsx. Plays once per
          Login page load. */}
      {!introComplete && <LogoIntro onComplete={() => setIntroComplete(true)} />}

      <div className="w-full max-w-[420px]">
        {/* Compact logo header — shown only where BrandingPanel is hidden
            (mobile/tablet, below lg), so branding is never lost there,
            re-themed to match the same dark/red/green identity. */}
        <div className="mb-6 flex flex-col items-center text-center lg:hidden">
          <div className="size-14 overflow-hidden rounded-full" style={{ boxShadow: '0 0 0 2px rgba(200,30,44,0.55), 0 0 30px rgba(200,30,44,0.35)' }}>
            {/* Unmodified artwork — no filter/recolor of any kind. */}
            <img
              src={wmMark}
              alt="W Morgan Technologies"
              className="h-full w-full scale-110 object-cover"
            />
          </div>
          <p className="mt-2.5 text-base font-extrabold uppercase tracking-wide text-[#34d399]">W Morgan</p>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff5252]">Technologies</p>
        </div>

        <div
          className="rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
          style={{ background: 'linear-gradient(160deg, rgba(20,20,24,0.85), rgba(6,6,8,0.9))' }}
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <h1 className="text-xl font-semibold tracking-tight text-white">Welcome Back</h1>
            <p className="mt-1 text-sm text-white/50">Sign in to continue</p>
          </div>

          <div className="mb-5 flex flex-wrap justify-center gap-x-4 gap-y-2">
            {ROLE_OPTIONS.map((role) => (
              <label key={role} className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-white/70">
                <input
                  type="radio"
                  name="displayRole"
                  checked={selectedRole === role}
                  onChange={() => setSelectedRole(role)}
                  className="size-3.5 accent-[#ff5252]"
                />
                {role}
              </label>
            ))}
          </div>

          <form className="space-y-3.5" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-white/50">
                Email / Username
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                disabled={submitting}
                aria-invalid={!!emailError}
                className={inputClass}
              />
              {emailError && <p className="text-xs text-red-400">{emailError}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-white/50">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className={inputClass + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={submitting}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-1 text-white/50 transition-colors hover:text-white disabled:pointer-events-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-[#ff5252] transition-colors hover:text-[#ff8080]"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5252]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'linear-gradient(90deg, #ff5252 0%, #c81e2c 55%, #7a0f14 100%)' }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Login
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
