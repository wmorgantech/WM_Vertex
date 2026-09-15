import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, TriangleAlert } from 'lucide-react';
import api from '../../api/axios';
import wmMark from '../../assets/wmorgan-mark.png';

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground ' +
  'transition-colors outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reset, setReset] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    if (!token) {
      setFormError('This reset link is invalid or has expired.');
      return;
    }

    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setReset(true);
    } catch (error) {
      setFormError(error?.response?.data?.message || 'This reset link is invalid or has expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-6 flex flex-col items-center text-center lg:hidden">
        <img src={wmMark} alt="W Morgan Technologies" className="size-12 rounded-full" />
        <p className="mt-2 text-sm font-semibold text-foreground">W Morgan Technologies</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LockKeyhole size={20} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your VertexWM account.</p>
        </div>

        {reset ? (
          <div className="space-y-5">
            <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-foreground">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
              <span>Password reset successfully. Please login with your new password.</span>
            </div>
            <Link
              to="/login"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Back to Login
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-xs font-medium text-muted-foreground">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting || !token}
                  className={inputClass + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={submitting || !token}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={submitting || !token}
                className={inputClass}
              />
            </div>

            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !token}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {submitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-5 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to Login
        </Link>
      </div>
    </div>
  );
}
