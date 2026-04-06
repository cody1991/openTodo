import { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import useAuthStore from './stores/authStore';
import AppLayout from './components/AppLayout/AppLayout';
import LoginPage from './pages/Login/LoginPage';
import LandingPage from './pages/Landing/LandingPage';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const TodoList = lazy(() => import('./pages/TodoList/TodoList'));
const CalendarPage = lazy(() => import('./pages/Calendar/CalendarPage'));
const BookmarksPage = lazy(() => import('./pages/Bookmarks/BookmarksPage'));
const AdminPage = lazy(() => import('./pages/Admin/AdminPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));
const ShareRequestsPage = lazy(() => import('./pages/ShareRequests/ShareRequestsPage'));
const ShareView = lazy(() => import('./pages/ShareView/ShareView'));

function ProtectedRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const location = useLocation();

  if (!initialized) {
    return PageLoader;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role_name !== 'admin') {
    return <Navigate to="/todos" replace />;
  }
  return children;
}

const PageLoader = (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <Spin size="large" />
  </div>
);

export default function App() {
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, []);

  return (
    <Suspense fallback={PageLoader}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/share/:key" element={<ShareView />} />

        {/* Protected app routes – share the AppLayout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/todos" element={<TodoList />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/share-requests" element={<ShareRequestsPage />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
