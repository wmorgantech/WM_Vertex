import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', email: 'superadmin@vertexwm.com' },
  { label: 'Admin', email: 'admin.eng@vertexwm.com' },
  { label: 'Employee', email: 'employee1@vertexwm.com' },
  { label: 'Intern', email: 'intern1@vertexwm.com' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('superadmin@vertexwm.com');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h2>
        <p className="text-sm text-muted-foreground">Use your VertexWM work email and password.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            'Signing in...'
          ) : (
            <>
              <LogIn /> Sign in
            </>
          )}
        </Button>
      </form>

      <Card className="bg-muted/40 shadow-none">
        <CardContent className="px-4 py-4 text-xs">
          <p className="mb-2 font-semibold text-foreground">
            Demo credentials <span className="font-normal text-muted-foreground">(password: Password123!)</span>
          </p>
          <ul className="space-y-1">
            {DEMO_ACCOUNTS.map((acc) => (
              <li key={acc.email} className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>{acc.label}</span>
                <button
                  type="button"
                  onClick={() => setEmail(acc.email)}
                  className="font-mono text-foreground/80 underline-offset-2 hover:text-primary hover:underline"
                >
                  {acc.email}
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
