import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [debugLink, setDebugLink] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setDebugLink("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setSuccess(res.data?.message || "If an account exists for that email, a reset link has been sent.");
      if (res.data?.reset_link) {
        setDebugLink(res.data.reset_link);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to process password reset request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h2 className="auth-title">Forgot Password</h2>
          <p className="auth-subtitle">
            Enter your email and we will send a secure reset link.
          </p>
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

        {debugLink && (
          <div className="banner banner-warning">
            <span className="banner-icon">⚠</span>
            <div>
              SMTP debug fallback link:
              <br />
              <a href={debugLink} target="_blank" rel="noreferrer">{debugLink}</a>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.ac.ke"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-muted)" }}>
          Remember your password? <Link to="/login" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>Back to login</Link>
        </p>
      </div>
    </div>
  );
}
