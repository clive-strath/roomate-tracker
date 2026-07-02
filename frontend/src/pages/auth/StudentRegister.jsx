import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";

export default function StudentRegister() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name:           "",
    student_number: "",
    email:          "",
    gender:         "",
    year:           "",
    phone:          "",
    password:       "",
    confirmPassword:"",
  });

  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) {
      e.name = "Full name is required";
    } else if (form.name.trim().length < 2) {
      e.name = "Full name must be at least 2 characters";
    }
    if (!form.student_number.trim()) {
      e.student_number = "Student number is required";
    }
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      e.email = "Valid email is required";
    }
    if (!form.gender) {
      e.gender = "Please select your gender";
    }
    if (!form.year) {
      e.year = "Year of study is required";
    }
    if (form.password.length < 8) {
      e.password = "Password must be at least 8 characters";
    }
    if (form.password !== form.confirmPassword) {
      e.confirmPassword = "Passwords do not match";
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        name:           form.name,
        student_number: form.student_number.toUpperCase(),
        email:          form.email,
        gender:         form.gender,
        year:           parseInt(form.year),
        phone:          form.phone || undefined,
        password:       form.password,
      });
      setSuccess(true);
      setSuccessMessage(res.data?.message || "Registration successful. Please verify your email before logging in.");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      const msg = err.response?.data?.error || "Registration failed. Try again.";
      setErrors({ server: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-step">Step 1 of 2: Profile Setup</div>
          <h2 className="auth-title">Create Your Roommate Profile</h2>
          <p className="auth-subtitle">
            Tell us about yourself so we can help match you with a compatible roommate.
          </p>
        </div>

        {success && (
          <div className="banner banner-success">
            <span className="banner-icon">✓</span>
            <div>{successMessage || "Registration successful. Check your email for the verification link. Redirecting to login..."}</div>
          </div>
        )}
        {errors.server && (
          <div className="banner banner-error">
            <span className="banner-icon">⚠️</span>
            <div>{errors.server}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              name="name"
              type="text"
              className={`form-input ${errors.name ? "error" : ""}`}
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Jane Achieng"
            />
            {errors.name && <span className="form-input-error">{errors.name}</span>}
          </div>

          <div className="form-row">
            {/* Student Number */}
            <div className="form-group">
              <label className="form-label">Student Number</label>
              <input
                name="student_number"
                type="text"
                className={`form-input ${errors.student_number ? "error" : ""}`}
                value={form.student_number}
                onChange={handleChange}
                placeholder="e.g. UON/2022/12345"
              />
              {errors.student_number && <span className="form-input-error">{errors.student_number}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                name="email"
                type="email"
                className={`form-input ${errors.email ? "error" : ""}`}
                value={form.email}
                onChange={handleChange}
                placeholder="student@university.ac.ke"
              />
              {errors.email && <span className="form-input-error">{errors.email}</span>}
            </div>
          </div>

          <div className="form-row">
            {/* Gender */}
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className={`form-select ${errors.gender ? "error" : ""}`}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {errors.gender && <span className="form-input-error">{errors.gender}</span>}
            </div>

            {/* Year of Study */}
            <div className="form-group">
              <label className="form-label">Year of Study</label>
              <select
                name="year"
                value={form.year}
                onChange={handleChange}
                className={`form-select ${errors.year ? "error" : ""}`}
              >
                <option value="">Select year</option>
                {[1,2,3,4,5,6].map(y => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
              {errors.year && <span className="form-input-error">{errors.year}</span>}
            </div>
          </div>

          {/* Phone (optional) */}
          <div className="form-group">
            <label className="form-label">Phone Number (optional)</label>
            <input
              name="phone"
              type="tel"
              className="form-input"
              value={form.phone}
              onChange={handleChange}
              placeholder="+254 7XX XXX XXX"
            />
          </div>

          <div className="form-row">
            {/* Password */}
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                className={`form-input ${errors.password ? "error" : ""}`}
                value={form.password}
                onChange={handleChange}
                placeholder="Min 8 characters"
              />
              <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Show password
              </label>
              {errors.password && <span className="form-input-error">{errors.password}</span>}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                className={`form-input ${errors.confirmPassword ? "error" : ""}`}
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat password"
              />
              <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
                <input
                  type="checkbox"
                  checked={showConfirmPassword}
                  onChange={(e) => setShowConfirmPassword(e.target.checked)}
                />
                Show confirm password
              </label>
              {errors.confirmPassword && <span className="form-input-error">{errors.confirmPassword}</span>}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "12px" }} disabled={loading}>
            {loading ? "Registering..." : "Continue to Step 2"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: "14px", color: "var(--text-muted)" }}>
          Already have an account? <Link to="/login" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>Login here</Link>
        </p>
      </div>
    </div>
  );
}
