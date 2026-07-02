import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../../api/axios";

export default function VerifyEmail() {
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get("token") || "", [location.search]);

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Verification token is missing.");
        return;
      }

      try {
        const res = await api.post("/auth/verify-email", { token });
        setStatus("success");
        setMessage(res.data?.message || "Email verified successfully. You can now log in.");
      } catch (err) {
        setStatus("error");
        setMessage(err.response?.data?.error || "Email verification failed.");
      }
    };

    verify();
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <h2 className="auth-title">Email Verification</h2>
        <p className="auth-subtitle" style={{ marginBottom: "16px" }}>
          {status === "loading" ? "Please wait while we confirm your email." : "Verification status"}
        </p>

        {status === "loading" && <div className="banner">{message}</div>}
        {status === "success" && (
          <div className="banner banner-success">
            <span className="banner-icon">✓</span>
            <div>{message}</div>
          </div>
        )}
        {status === "error" && (
          <div className="banner banner-error">
            <span className="banner-icon">⚠️</span>
            <div>{message}</div>
          </div>
        )}

        <p style={{ marginTop: "18px" }}>
          <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
            Go to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
