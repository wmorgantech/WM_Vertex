import { Outlet } from 'react-router-dom';
import { Layers, Sparkles, ShieldCheck, Clock3 } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: Clock3, text: 'Real-time attendance and timesheet tracking' },
  { icon: Sparkles, text: 'Productivity analytics across every team' },
  { icon: ShieldCheck, text: 'Role-based access, built in from day one' },
];

export default function AuthLayout() {
  return (
    <div className="vx-app flex min-h-screen">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-purple p-12 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 0, transparent 35%), radial-gradient(circle at 80% 60%, white 0, transparent 40%)',
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
            <Layers className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">VertexWM</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Smart workforce management, built for modern teams.
          </h1>
          <p className="max-w-sm text-sm text-primary-foreground/80">
            Employees, interns, attendance, timesheets and analytics — all in one place.
          </p>
          <ul className="space-y-3 pt-2">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-primary-foreground/90">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/15">
                  <Icon className="size-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} VertexWM. All rights reserved.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Layers className="size-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">VertexWM</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
