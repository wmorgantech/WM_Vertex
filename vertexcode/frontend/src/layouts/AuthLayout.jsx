import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 px-4 py-8">
      <Outlet />
    </div>
  );
}
