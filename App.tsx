import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { InventoryProvider } from './contexts/InventoryContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { Toaster } from 'react-hot-toast';

// Lazy-loaded pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const Inventory = lazy(() => import('./pages/Inventory'));
const AddItem = lazy(() => import('./pages/AddItem'));
const BatchSales = lazy(() => import('./pages/BatchSales'));
const SalesHistory = lazy(() => import('./pages/SalesHistory'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const ActiveSessions = lazy(() => import('./pages/ActiveSessions'));
const LowStock = lazy(() => import('./pages/LowStock'));
const AuditLog = lazy(() => import('./pages/AuditLog'));

// Loading fallback with ShopOS branding
const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
    <div className="flex flex-col items-center gap-4 animate-pulse">
      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-brand-500 to-cyan-400 rounded-xl shadow-lg" />
      <div className="h-2 w-24 bg-slate-200 dark:bg-slate-700 rounded-full" />
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean }> = ({ children, requireAdmin }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Main Inventory View */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Inventory />
            </ProtectedRoute>
          }
        />

        {/* Legacy routes redirect */}
        <Route path="/inventory" element={<Navigate to="/" replace />} />
        <Route path="/stock" element={<Navigate to="/" replace />} />

        {/* Add New Inventory Item */}
        <Route
          path="/add-item"
          element={
            <ProtectedRoute>
              <AddItem />
            </ProtectedRoute>
          }
        />

        {/* Record a Sale */}
        <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <BatchSales />
            </ProtectedRoute>
          }
        />

        {/* View Sales History */}
        <Route
          path="/sales-history"
          element={
            <ProtectedRoute>
              <SalesHistory />
            </ProtectedRoute>
          }
        />

        {/* Reports */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* Low Stock Alerts */}
        <Route
          path="/low-stock"
          element={
            <ProtectedRoute>
              <LowStock />
            </ProtectedRoute>
          }
        />

        {/* Settings (Admin) */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute requireAdmin>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Active Sessions */}
        <Route
          path="/active-sessions"
          element={
            <ProtectedRoute>
              <ActiveSessions />
            </ProtectedRoute>
          }
        />

        {/* Audit Log (Admin) */}
        <Route
          path="/audit-log"
          element={
            <ProtectedRoute requireAdmin>
              <AuditLog />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <InventoryProvider>
        <OfflineProvider>
          <Router>
            <AppRoutes />
          </Router>
          <Toaster position="top-right" toastOptions={{
            style: { borderRadius: '12px', background: '#1e293b', color: '#f1f5f9', fontSize: '14px', fontWeight: 600 },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#f43f5e', secondary: '#fff' } }
          }} />
        </OfflineProvider>
      </InventoryProvider>
    </AuthProvider>
  );
};

export default App;