import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function Navbar() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Token may already be expired/revoked; local logout should still proceed.
    } finally {
      logout();
      navigate("/login");
    }
  };

  const getRoleLabel = (r) => {
    if (r === "resident_advisor") return "Resident Advisor";
    return r;
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand" style={{ cursor: "pointer" }} onClick={() => {
          if (role === "student") navigate("/student/dashboard");
          else if (role === "admin") navigate("/admin/dashboard");
          else if (role === "resident_advisor") navigate("/ra/dashboard");
        }}>
          <svg viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          <span>Hostel Harmony</span>
        </div>
        
        {user && (
          <div className="navbar-user-info">
            <div style={{ textAlign: "right" }}>
              <div className="navbar-user-name">{user.name}</div>
              <span className="navbar-user-role">{getRoleLabel(role)}</span>
            </div>
            <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }} onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
