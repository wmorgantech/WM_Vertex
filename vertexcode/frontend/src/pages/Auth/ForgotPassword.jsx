import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail, TriangleAlert } from 'lucide-react';
import api from '../../api/axios';
import wmMark from '../../assets/wmorgan-mark.png';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputClass =
  'w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground ' +
  'transition-colors outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setEmailError('');
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (error) {
      setFormError(error?.response?.data?.message || 'Unable to send the reset link. Please try again.');
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
            <Mail size={20} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Forgot your password?</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your work email and we will send you a reset link.</p>
        </div>

        {sent ? (
          <div className="space-y-5">
            <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-foreground">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
              <span>If an account exists for this email, a password reset link has been sent.</span>
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
              <label htmlFor="forgot-email" className="text-xs font-medium text-muted-foreground">
                Work Email
              </label>
              <input
                id="forgot-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                aria-invalid={!!emailError}
                className={inputClass}
              />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
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
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {submitting ? 'Sending...' : 'Send Reset Link'}
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
