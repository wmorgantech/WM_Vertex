import { useAuth } from '../../context/AuthContext';
import SuperAdminDashboard from './SuperAdminDashboard';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import InternDashboard from './InternDashboard';

const DASHBOARDS = {
  SUPER_ADMIN: SuperAdminDashboard,
  ADMIN: AdminDashboard,
  EMPLOYEE: EmployeeDashboard,
  INTERN: InternDashboard,
};

export default function Dashboard() {
  const { user } = useAuth();
  const RoleDashboard = DASHBOARDS[user?.role] || EmployeeDashboard;
  return <RoleDashboard />;
}
