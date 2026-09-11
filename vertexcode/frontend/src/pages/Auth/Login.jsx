import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import wmMark from '../../assets/wmorgan-mark.png';

// The real Role enum lives entirely server-side now — see
// AuthContext.jsx/RoleRoute.jsx/middleware/rbac.js, all unchanged. This
// page used to also ask the user to pick a role and compare it to the
// account's real role after login, purely as a client-side UX check; that
// selector is gone, but the actual authentication call (email + password)
// and the post-login role-based routing/authorization are untouched.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground ' +
  'transition-colors outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

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
    <div className="w-full max-w-[420px]">
      {/* Compact static logo — shown only where BrandingPanel is hidden
          (mobile/tablet, below lg), so branding is never lost, just not
          animated there. */}
      <div className="mb-6 flex flex-col items-center text-center lg:hidden">
        <img src={wmMark} alt="W Morgan Technologies" className="size-12 rounded-full" />
        <p className="mt-2 text-sm font-semibold text-foreground">W Morgan Technologies</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to continue to your account</p>
        </div>

        <form className="space-y-3.5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
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
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
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
                className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
    </div>
  );
}
