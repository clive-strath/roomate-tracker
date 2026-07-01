import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form,    setForm]    = useState({ email: "", password: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Both email and password are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res  = await api.post("/auth/login", form);
      const data = res.data;

      login(data);   // save token + role + user to context and localStorage

      // Route by role
      if (data.role === "admin")             navigate("/admin/dashboard");
      else if (data.role === "resident_advisor") navigate("/ra/dashboard");
      else                                   navigate("/student/dashboard");

    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">
            Continue building your roommate compatibility profile.
          </p>
        </div>

        {error && (
          <div className="banner banner-error">
            <span className="banner-icon">⚠️</span>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="student@university.ac.ke"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="form-input"
            />
            <div style={{ textAlign: "right", marginTop: "8px" }}>
              <Link to="/forgot-password" style={{ color: "var(--primary)", fontSize: "13px", textDecoration: "none", fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "12px" }} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: "14px", color: "var(--text-muted)" }}>
          New student? <Link to="/register" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}
