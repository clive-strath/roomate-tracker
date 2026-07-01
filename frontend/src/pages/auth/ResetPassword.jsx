import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/axios";

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(location.search).get("token") || "", [location.search]);

  const [form, setForm] = useState({ new_password: "", confirm_password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Reset token is missing from the link.");
      return;
    }

    if (form.new_password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (form.new_password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/reset-password", {
        token,
        new_password: form.new_password,
        confirm_password: form.confirm_password,
      });
      setSuccess(res.data?.message || "Password reset successful.");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h2 className="auth-title">Reset Password</h2>
          <p className="auth-subtitle">Choose a new password for your account.</p>
        </div>

        {error && (
          <div className="banner banner-error">
            <span className="banner-icon">!</span>
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="banner banner-success">
            <span className="banner-icon">✓</span>
            <div>{success}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              type="password"
              className="form-input"
              value={form.new_password}
              onChange={(e) => setForm((prev) => ({ ...prev, new_password: e.target.value }))}
              placeholder="Minimum 8 characters"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              className="form-input"
              value={form.confirm_password}
              onChange={(e) => setForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
              placeholder="Repeat new password"
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-muted)" }}>
          <Link to="/login" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>Back to login</Link>
        </p>
      </div>
    </div>
  );
}
