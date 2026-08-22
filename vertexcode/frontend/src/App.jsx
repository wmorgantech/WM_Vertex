import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import EmployeeList from './pages/Employees/EmployeeList';
import EmployeeDetail from './pages/Employees/EmployeeDetail';
import Interns from './pages/Interns/Interns';
import Departments from './pages/Departments/Departments';
import Projects from './pages/Projects/Projects';
import ProjectDetail from './pages/Projects/ProjectDetail';
import Tasks from './pages/Tasks/Tasks';
import Attendance from './pages/Attendance/Attendance';
import Timesheets from './pages/Timesheets/Timesheets';
import WorkUpdates from './pages/WorkUpdates/WorkUpdates';
import Analytics from './pages/Analytics/Analytics';
import Documents from './pages/Documents/Documents';

const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const DOCUMENT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'INTERN'];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--color-card)',
              color: 'var(--color-foreground)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.625rem',
              boxShadow: 'var(--shadow-md)',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: 'var(--color-success)', secondary: 'var(--color-card)' } },
            error: { iconTheme: { primary: 'var(--color-destructive)', secondary: 'var(--color-card)' } },
          }}
        />
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/timesheets" element={<Timesheets />} />
              <Route path="/work-updates" element={<WorkUpdates />} />

              <Route element={<RoleRoute roles={DOCUMENT_ROLES} />}>
                <Route path="/documents" element={<Documents />} />
              </Route>

              <Route element={<RoleRoute roles={MANAGER_ROLES} />}>
                <Route path="/employees" element={<EmployeeList />} />
                <Route path="/employees/:id" element={<EmployeeDetail />} />
                <Route path="/interns" element={<Interns />} />
                <Route path="/departments" element={<Departments />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/analytics" element={<Analytics />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
