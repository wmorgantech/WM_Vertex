import { Outlet } from 'react-router-dom';
import BrandingPanel from '../pages/Auth/BrandingPanel';

// Desktop: animated branding on the left, the form (Outlet, i.e. Login) on
// the right. Mobile: BrandingPanel hides itself (lg:flex) and the form
// takes the full screen — Login.jsx shows its own compact static logo
// header in that case, so branding isn't lost, just not animated there.
export default function AuthLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <BrandingPanel />
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
        <Outlet />
      </div>
    </div>
  );
}
