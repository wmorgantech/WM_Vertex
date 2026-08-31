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
import Masters from './pages/Configuration/Masters';
import Permissions from './pages/Configuration/Permissions';
import AuditLog from './pages/Configuration/AuditLog';
import NotificationSettings from './pages/Configuration/NotificationSettings';
import CustomFields from './pages/Configuration/CustomFields';
import DocumentSettings from './pages/Configuration/DocumentSettings';
import Leave from './pages/Leave/Leave';
import Expenses from './pages/Expenses/Expenses';
import Trainees from './pages/Trainees/Trainees';
import TraineeDetail from './pages/Trainees/TraineeDetail';
import Colleges from './pages/Colleges/Colleges';
import Workshops from './pages/Workshops/Workshops';
import MOUs from './pages/MOUs/MOUs';
import Enquiries from './pages/Enquiries/Enquiries';
import Profile from './pages/Profile/Profile';

const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const DOCUMENT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'INTERN'];
const SUPER_ADMIN_ROLES = ['SUPER_ADMIN'];
// Interns page also opens to Employees — the backend additionally restricts
// who can actually add an intern to the "Senior Full Stack Developer"
// designation (see intern.routes.js canAddIntern); this just lets that
// route resolve instead of bouncing them to /dashboard.
const INTERN_PAGE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'];
// Enquiry is open to any staff role — Interns/Trainees excluded (see
// enquiry.routes.js/enquiry.controller.js for the matching backend rule).
const ENQUIRY_PAGE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'];

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
              <Route path="/profile" element={<Profile />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/timesheets" element={<Timesheets />} />
              <Route path="/work-updates" element={<WorkUpdates />} />
              <Route path="/workshops" element={<Workshops />} />
              <Route path="/leave" element={<Leave />} />

              <Route element={<RoleRoute roles={DOCUMENT_ROLES} />}>
                <Route path="/documents" element={<Documents />} />
              </Route>

              <Route element={<RoleRoute roles={INTERN_PAGE_ROLES} />}>
                <Route path="/interns" element={<Interns />} />
              </Route>

              <Route element={<RoleRoute roles={ENQUIRY_PAGE_ROLES} />}>
                <Route path="/enquiries" element={<Enquiries />} />
              </Route>

              <Route element={<RoleRoute roles={MANAGER_ROLES} />}>
                <Route path="/employees" element={<EmployeeList />} />
                <Route path="/employees/:id" element={<EmployeeDetail />} />
                <Route path="/trainees" element={<Trainees />} />
                <Route path="/trainees/:id" element={<TraineeDetail />} />
                <Route path="/colleges" element={<Colleges />} />
                <Route path="/mous" element={<MOUs />} />
                <Route path="/departments" element={<Departments />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/analytics" element={<Analytics />} />
              </Route>

              <Route element={<RoleRoute roles={SUPER_ADMIN_ROLES} />}>
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/configuration/masters" element={<Masters />} />
                <Route path="/configuration/permissions" element={<Permissions />} />
                <Route path="/configuration/audit-log" element={<AuditLog />} />
                <Route path="/configuration/notifications" element={<NotificationSettings />} />
                <Route path="/configuration/custom-fields" element={<CustomFields />} />
                <Route path="/configuration/document-settings" element={<DocumentSettings />} />
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
