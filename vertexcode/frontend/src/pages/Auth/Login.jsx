import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Layers, Loader2, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Real Role enum values. The selector below is a UX convenience only — the
// backend's actual stored role is always the source of truth for what the
// account can access (see RoleRoute.jsx / middleware/rbac.js). If the
// selection doesn't match the account's real role after a successful
// authentication, the session is torn down and the user is asked to
// pick the right one instead of being silently let in under the wrong label.
const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'INTERN', label: 'Intern' },
];

const DEMO_ACCOUNTS = [
  { role: 'SUPER_ADMIN', label: 'Super Admin', email: 'superadmin@vertexwm.com' },
  { role: 'ADMIN', label: 'Admin', email: 'admin.eng@vertexwm.com' },
  { role: 'EMPLOYEE', label: 'Employee', email: 'vijay@gmail.com' },
  { role: 'INTERN', label: 'Intern', email: 'intern1@vertexwm.com' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 ' +
  'transition-colors outline-none focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500/30 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export default function Login() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('SUPER_ADMIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const roleLabel = (value) => ROLES.find((r) => r.value === value)?.label || value;

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
      const user = await login(email, password);

      if (user.role !== role) {
        const actualRole = user.role;
        await logout();
        throw { roleMismatch: true, actualRole };
      }

      navigate('/dashboard');
    } catch (err) {
      if (err?.roleMismatch) {
        setFormError(`This account is registered as "${roleLabel(err.actualRole)}", not "${roleLabel(role)}". Select the correct role and try again.`);
      } else if (err?.response?.status === 401) {
        setFormError('Unable to sign in. Please check your email and password.');
      } else {
        setFormError(err?.response?.data?.message || 'Unable to sign in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoClick = (acc) => {
    setRole(acc.role);
    setEmail(acc.email);
    setEmailError('');
    setFormError('');
  };

  return (
    <div className="w-full max-w-[420px]">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700">
            <Layers className="size-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Welcome back</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to continue to your account</p>
        </div>

        <form className="space-y-3.5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-1.5">
            <label htmlFor="role" className="text-xs font-medium text-zinc-400">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={submitting}
              className={inputClass + ' cursor-pointer appearance-none bg-[url(\'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E\')] bg-[right_0.75rem_center] bg-no-repeat pr-9'}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-zinc-400">
              Work Email
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
            <label htmlFor="password" className="text-xs font-medium text-zinc-400">
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
                className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300 disabled:pointer-events-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2.5 text-sm text-red-300">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="mb-2.5 text-xs font-medium text-zinc-400">
          Demo credentials <span className="text-zinc-600">(password: Password123!)</span>
        </p>
        <ul className="space-y-1.5">
          {DEMO_ACCOUNTS.map((acc) => (
            <li key={acc.email} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-zinc-500">{acc.label}</span>
              <button
                type="button"
                onClick={() => handleDemoClick(acc)}
                disabled={submitting}
                className="rounded font-mono text-zinc-300 underline-offset-2 hover:text-violet-400 hover:underline disabled:pointer-events-none"
              >
                {acc.email}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
