import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute    from "./components/ProtectedRoute";

import StudentRegister  from "./pages/auth/StudentRegister";
import Login            from "./pages/auth/Login";
import ForgotPassword   from "./pages/auth/ForgotPassword";
import ResetPassword    from "./pages/auth/ResetPassword";
import StudentDashboard from "./pages/dashboards/StudentDashboard";
import AdminDashboard   from "./pages/dashboards/AdminDashboard";
import RADashboard      from "./pages/dashboards/RADashboard";
import PreferenceForm   from "./pages/preferences/PreferenceForm";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/"         element={<Navigate to="/login" replace />} />
          <Route path="/register" element={<StudentRegister />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Student */}
          <Route path="/student/dashboard" element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          } />
          <Route path="/student/preferences" element={
            <ProtectedRoute allowedRoles={["student"]}>
              <PreferenceForm />
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Resident Advisor */}
          <Route path="/ra/dashboard" element={
            <ProtectedRoute allowedRoles={["resident_advisor"]}>
              <RADashboard />
            </ProtectedRoute>
          } />

          {/* Fallbacks */}
          <Route path="/unauthorized" element={
            <div className="auth-page">
              <div className="auth-card" style={{ textAlign: "center" }}>
                <span style={{ fontSize: "48px", display: "block", marginBottom: "16px" }}>🚫</span>
                <h2 className="auth-title">403 — Access Denied</h2>
                <p className="auth-subtitle" style={{ marginBottom: "20px" }}>
                  You do not have the required permissions to view this screen.
                </p>
                <button className="btn btn-primary" onClick={() => window.history.back()}>
                  Go Back
                </button>
              </div>
            </div>
          } />
          <Route path="*" element={
            <div className="auth-page">
              <div className="auth-card" style={{ textAlign: "center" }}>
                <span style={{ fontSize: "48px", display: "block", marginBottom: "16px" }}>🔍</span>
                <h2 className="auth-title">404 — Page Not Found</h2>
                <p className="auth-subtitle" style={{ marginBottom: "20px" }}>
                  The requested page could not be located on the system.
                </p>
                <button className="btn btn-primary" onClick={() => window.location.href = "/"}>
                  Return to Portal
                </button>
              </div>
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
