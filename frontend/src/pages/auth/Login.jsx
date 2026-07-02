import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form,    setForm]    = useState({ email: "", password: "" });
  const [error,   setError]   = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const googleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

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
    setInfo("");
    try {
      const res  = await api.post("/auth/login", form);
      const data = res.data;

      login(data);   // save token + role + user to context and localStorage

      // Route by role
      if (data.role === "admin")             navigate("/admin/dashboard");
      else if (data.role === "resident_advisor") navigate("/ra/dashboard");
      else                                   navigate("/student/dashboard");

    } catch (err) {
      const responseCode = err.response?.data?.code;
      const responseError = err.response?.data?.error;
      if (responseCode === "email_not_verified") {
        setError(responseError || "Please verify your email before logging in.");
      } else {
        setError(responseError || "Login failed. Check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!form.email) {
      setError("Enter your email above so we can resend verification.");
      return;
    }

    setResending(true);
    setInfo("");
    try {
      const res = await api.post("/auth/resend-verification", { email: form.email });
      setInfo(res.data?.message || "If the account exists and is unverified, a new verification email has been sent.");
    } catch (err) {
      setError(err.response?.data?.error || "Could not resend verification email right now.");
    } finally {
      setResending(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    const credential = credentialResponse?.credential;
    if (!credential) {
      setError("Google sign-in failed. Please try again.");
      return;
    }

    setError("");
    setInfo("");
    try {
      const res = await api.post("/auth/google-login", { credential });
      const data = res.data;
      login(data);
      navigate("/student/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Google sign-in failed.");
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
        {info && (
          <div className="banner banner-success">
            <span className="banner-icon">✓</span>
            <div>{info}</div>
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
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="form-input"
            />
            <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              Show password
            </label>
            <div style={{ textAlign: "right", marginTop: "8px" }}>
              <Link to="/forgot-password" style={{ color: "var(--primary)", fontSize: "13px", textDecoration: "none", fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>
            {error.includes("verify your email") && (
              <div style={{ marginTop: "8px" }}>
                <button type="button" className="btn" onClick={handleResendVerification} disabled={resending}>
                  {resending ? "Sending verification..." : "Resend verification email"}
                </button>
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "12px" }} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {googleEnabled && (
          <>
            <div style={{ margin: "16px 0", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
              or continue with
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <GoogleLogin
                onSuccess={handleGoogleLogin}
                onError={() => setError("Google sign-in failed. Please try again.")}
              />
            </div>
          </>
        )}

        <p style={{ textAlign: "center", marginTop: 24, fontSize: "14px", color: "var(--text-muted)" }}>
          New student? <Link to="/register" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}
