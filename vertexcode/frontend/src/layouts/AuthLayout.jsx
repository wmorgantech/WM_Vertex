import { Outlet, useLocation } from 'react-router-dom';
import BrandingPanel from '../pages/Auth/BrandingPanel';

// Desktop: animated branding on the left, the form (Outlet, i.e. Login) on
// the right. Mobile: BrandingPanel hides itself (lg:flex) and the form
// takes the full screen — Login.jsx shows its own compact static logo
// header in that case, so branding isn't lost, just not animated there.
//
// Login specifically uses a dark cinematic card (see Login.jsx/LogoIntro)
// against BrandingPanel's own dark panel — the root background swaps to
// match right here (at the same DOM level as the light bg-background it
// replaces) rather than Login trying to paint over it from a nested
// descendant, which is the only reliable way to win that background
// without fighting z-index/stacking order. Forgot/Reset Password keep the
// original light bg-background and card styling, untouched.
export default function AuthLayout() {
  const { pathname } = useLocation();
  const isLogin = pathname === '/login';

  return (
    <div
      className={`flex min-h-screen w-full ${isLogin ? '' : 'bg-background'}`}
      style={isLogin ? { background: 'radial-gradient(ellipse at 50% 30%, #0c0d10 0%, #050506 60%, #000 100%)' } : undefined}
    >
      <BrandingPanel />
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
        <Outlet />
      </div>
    </div>
  );
}
