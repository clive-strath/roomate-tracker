import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

const CONFLICT_TYPES = [
  { value: "sleep_schedule", label: "Sleep Schedule" },
  { value: "noise", label: "Noise" },
  { value: "cleanliness", label: "Cleanliness" },
  { value: "guests", label: "Guests" },
  { value: "bathroom", label: "Bathroom" },
  { value: "other", label: "Other" },
];

export default function StudentDashboard() {
  const { user } = useAuth();

  const [prefData, setPrefData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState(null);

  const [conflicts, setConflicts] = useState([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflictError, setConflictError] = useState("");
  const [conflictSuccess, setConflictSuccess] = useState("");
  const [conflictForm, setConflictForm] = useState({
    conflict_type: "noise",
    severity: 3,
    description: "",
  });

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const res = await api.get(`/preferences/${user.student_id}`);
        setPrefData(res.data);
      } catch {
        setPrefData({ submitted: false });
      } finally {
        setLoading(false);
      }
    };

    if (user?.student_id) fetchPreferences();
  }, [user]);

  useEffect(() => {
    const fetchAssignment = async () => {
      if (!user?.student_id) return;
      try {
        const sem = `${new Date().getFullYear()}-S1`;
        const res = await api.get(`/students/${user.student_id}/assignment?semester=${encodeURIComponent(sem)}`);
        setAssignment(res.data?.assignment || null);
      } catch {
        setAssignment(null);
      }
    };

    fetchAssignment();
  }, [user]);

  const fetchMyConflicts = async () => {
    setConflictsLoading(true);
    setConflictError("");
    try {
      const res = await api.get("/conflicts");
      setConflicts(res.data?.conflicts || []);
    } catch (err) {
      setConflictError(err.response?.data?.error || "Failed to load your conflict history");
    } finally {
      setConflictsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyConflicts();
  }, []);

  const submitConflict = async (e) => {
    e.preventDefault();
    setConflictError("");
    setConflictSuccess("");

    if (!String(conflictForm.description || "").trim()) {
      setConflictError("Please add a short description before submitting.");
      return;
    }

    try {
      await api.post("/conflicts", {
        conflict_type: conflictForm.conflict_type,
        severity: Number(conflictForm.severity),
        description: conflictForm.description.trim(),
      });

      setConflictSuccess("Conflict submitted successfully. Your RA has been notified through the dashboard queue.");
      setConflictForm((prev) => ({ ...prev, description: "" }));
      fetchMyConflicts();
    } catch (err) {
      setConflictError(err.response?.data?.error || "Could not submit conflict. Ensure you have an active assignment.");
    }
  };

  const getTraits = (pref) => {
    if (!pref) return [];
    const traits = [];

    if (pref.sleep_time >= 4) traits.push({ text: "Night Owl", icon: "🌙" });
    else if (pref.sleep_time <= 2) traits.push({ text: "Early Sleeper", icon: "🌅" });
    else traits.push({ text: "Balanced Sleeper", icon: "🕒" });

    if (pref.study_habits === "quiet") traits.push({ text: "Quiet Study Style", icon: "📚" });
    else if (pref.study_habits === "group") traits.push({ text: "Group Study Style", icon: "👥" });
    else traits.push({ text: "Flexible Study Style", icon: "📚" });

    if (pref.cleanliness_level >= 4) traits.push({ text: "Highly Organized", icon: "🧹" });
    else if (pref.cleanliness_level <= 2) traits.push({ text: "Relaxed Cleanliness", icon: "📦" });
    else traits.push({ text: "Moderately Tidy", icon: "🧹" });

    if (pref.guest_policy <= 2) traits.push({ text: "Low Guest Activity", icon: "🚪" });
    else if (pref.guest_policy >= 4) traits.push({ text: "High Guest Activity", icon: "🚪" });
    else traits.push({ text: "Moderate Guest Activity", icon: "🚪" });

    if (String(pref.bathroom_schedule) === "1") traits.push({ text: "Morning Schedule", icon: "🚿" });
    else if (String(pref.bathroom_schedule) === "2") traits.push({ text: "Evening Schedule", icon: "🚿" });
    else traits.push({ text: "Flexible Schedule", icon: "🚿" });

    return traits;
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="main-content" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Loading roommate profile...</p>
        </div>
      </div>
    );
  }

  const traits = prefData?.submitted ? getTraits(prefData.preferences) : [];

  return (
    <div className="page-container">
      <Navbar />
      <div className="main-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px", borderBottom: "1px solid var(--border-color)", paddingBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "28px", marginBottom: "4px" }}>Hello, {user?.name} 👋</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              Student Number: <strong style={{ color: "var(--text-main)" }}>{user?.student_number}</strong> | Year of Study: <strong style={{ color: "var(--text-main)" }}>{user?.year}</strong>
            </p>
          </div>
          <div>
            {!prefData?.submitted && (
              <Link to="/student/preferences">
                <button className="btn btn-primary">Start Matching Onboarding →</button>
              </Link>
            )}
          </div>
        </div>

        <div className="dashboard-grid">
          <div>
            {!prefData?.submitted ? (
              <div className="banner banner-warning" style={{ padding: "28px" }}>
                <span className="banner-icon" style={{ fontSize: "24px" }}>⚠️</span>
                <div>
                  <h3 style={{ fontSize: "16px", color: "var(--accent-amber-text)", marginBottom: "6px" }}>Compatibility Profile Incomplete</h3>
                  <p style={{ marginBottom: "16px", lineHeight: "1.5" }}>
                    Your roommate matching profile has not been configured. You must submit your lifestyle preferences before you can be matched with a roommate for the upcoming semester.
                  </p>
                  <Link to="/student/preferences">
                    <button className="btn btn-primary" style={{ backgroundColor: "var(--accent-amber-text)" }}>
                      Build Your Compatibility Profile
                    </button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h3 className="card-title" style={{ margin: 0 }}>
                    <span>🤝</span> Your Compatibility Profile
                  </h3>
                  {!prefData.preferences?.is_locked && (
                    <Link to="/student/preferences" style={{ textDecoration: "none" }}>
                      <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }}>
                        Edit Profile Preferences
                      </button>
                    </Link>
                  )}
                </div>

                <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "16px" }}>
                  Your profile preferences are used to match you with roommates of similar habits. Here are your current traits:
                </p>

                <div className="trait-pill-grid" style={{ marginBottom: "24px" }}>
                  {traits.map((trait, idx) => (
                    <span className="trait-pill" key={idx} style={{ padding: "8px 16px", fontSize: "13px" }}>
                      <span>{trait.icon}</span>
                      <span>{trait.text}</span>
                    </span>
                  ))}
                </div>

                {prefData.preferences?.additional_notes && (
                  <div style={{ padding: "16px", background: "var(--bg-primary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                    <strong style={{ display: "block", fontSize: "12px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "6px" }}>
                      Additional Notes
                    </strong>
                    <p style={{ fontSize: "13.5px", fontStyle: "italic", color: "var(--text-main)" }}>
                      &ldquo;{prefData.preferences.additional_notes}&rdquo;
                    </p>
                  </div>
                )}

                {prefData.preferences?.is_locked && (
                  <p style={{ color: "var(--accent-amber-text)", fontSize: "13px", marginTop: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🔒</span> Preferences are locked for this semester matching cycle.
                  </p>
                )}
              </div>
            )}

            <div className="card">
              <h3 className="card-title">
                <span>🏠</span> Matching Status
              </h3>
              {assignment ? (
                <div style={{ padding: "14px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", background: "var(--bg-primary)" }}>
                  <p style={{ marginBottom: "8px", color: "var(--text-main)" }}>
                    <strong>Room:</strong> {assignment.room_number || "-"} (Block {assignment.hostel_block || "-"})
                  </p>
                  <p style={{ marginBottom: "8px", color: "var(--text-main)", textTransform: "capitalize" }}>
                    <strong>Status:</strong> {String(assignment.status || "").replace("_", " ")}
                  </p>
                  <p style={{ marginBottom: "8px", color: "var(--text-main)" }}>
                    <strong>Roommate:</strong> {assignment.roommate?.name || "Awaiting roommate"}
                  </p>
                  <p style={{ marginBottom: 0, color: "var(--text-main)" }}>
                    <strong>Compatibility Score:</strong> {assignment.compatibility_score ?? "N/A"}
                  </p>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: "20px 0" }}>
                  <span className="empty-state-icon">🏠</span>
                  <h4 className="empty-state-title" style={{ fontSize: "15px", marginBottom: "8px" }}>
                    Your roommate match has not been generated yet.
                  </h4>
                  <p className="empty-state-desc" style={{ maxWidth: "480px" }}>
                    We are waiting for the current matching cycle to complete. You will be notified when compatibility results are available.
                  </p>
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="card-title">
                <span>📝</span> Report Conflict
              </h3>

              {conflictSuccess && (
                <div className="banner banner-success" style={{ marginBottom: "10px" }}>
                  <span className="banner-icon">✓</span>
                  <div>{conflictSuccess}</div>
                </div>
              )}

              {conflictError && (
                <div className="banner banner-error" style={{ marginBottom: "10px" }}>
                  <span className="banner-icon">!</span>
                  <div>{conflictError}</div>
                </div>
              )}

              <form onSubmit={submitConflict} style={{ display: "grid", gap: "10px" }}>
                <div className="form-group">
                  <label>Conflict Type</label>
                  <select
                    className="form-select"
                    value={conflictForm.conflict_type}
                    onChange={(e) => setConflictForm((prev) => ({ ...prev, conflict_type: e.target.value }))}
                  >
                    {CONFLICT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Severity (1-5)</label>
                  <select
                    className="form-select"
                    value={conflictForm.severity}
                    onChange={(e) => setConflictForm((prev) => ({ ...prev, severity: Number(e.target.value) }))}
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={conflictForm.description}
                    onChange={(e) => setConflictForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the concern and what support you need..."
                  />
                </div>

                <div>
                  <button type="submit" className="btn btn-primary">Submit Conflict</button>
                </div>
              </form>
            </div>
          </div>

          <div>
            <div className="card">
              <h3 className="card-title">
                <span>📋</span> My Conflict History
              </h3>

              <button className="btn btn-secondary" style={{ marginBottom: "10px", padding: "6px 10px", fontSize: "13px" }} onClick={fetchMyConflicts}>
                Refresh
              </button>

              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Reported</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflictsLoading ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)", padding: "14px" }}>
                          Loading conflicts...
                        </td>
                      </tr>
                    ) : conflicts.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)", padding: "14px" }}>
                          No conflicts reported yet.
                        </td>
                      </tr>
                    ) : (
                      conflicts.map((conflict) => (
                        <tr key={conflict.conflict_id}>
                          <td>#{conflict.conflict_id}</td>
                          <td style={{ textTransform: "capitalize" }}>{String(conflict.conflict_type || "").replace("_", " ")}</td>
                          <td>{conflict.severity}</td>
                          <td><span className="badge badge-warning" style={{ textTransform: "capitalize" }}>{String(conflict.status || "").replace("_", " ")}</span></td>
                          <td>{conflict.created_at ? new Date(conflict.created_at).toLocaleDateString() : "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
