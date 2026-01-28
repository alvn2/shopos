import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { InventoryProvider } from './contexts/InventoryContext';
import { OfflineProvider } from './contexts/OfflineContext';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import AddItem from './pages/AddItem';
import BatchSales from './pages/BatchSales';
import SalesHistory from './pages/SalesHistory';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ActiveSessions from './pages/ActiveSessions';
import LowStock from './pages/LowStock';
import AuditLog from './pages/AuditLog';

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
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Main Inventory View (Home) */}
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
        </OfflineProvider>
      </InventoryProvider>
    </AuthProvider>
  );
};

export default App;