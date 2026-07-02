import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

const DEFAULT_ALLERGIES = {
  has_dust_mould_allergy: false,
  has_fragrance_sensitivity: false,
  has_food_allergy: false,
  food_allergy_detail: "",
  has_latex_allergy: false,
  has_chemical_sensitivity: false,
  chemical_sensitivity_detail: "",
  has_severe_nut_allergy: false,
  has_smoke_sensitivity: false,
  has_asthma_or_respiratory_condition: false,
  heavy_fragrance_user: false,
  cooks_strong_smelling_food: false,
  uses_strong_cleaning_products: false,
  stores_or_eats_nuts_in_room: false,
  smoking_habit: "no",
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const PROFILE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const VERIFICATION_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "pdf"];

function StatusBadge({ text, className }) {
  return <span className={`badge ${className}`} style={{ textTransform: "capitalize" }}>{text}</span>;
}

function validateUploadFile(file, allowedExtensions) {
  if (!file) return "Choose a file first.";
  const name = String(file.name || "");
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (!allowedExtensions.includes(ext)) {
    return `Unsupported file type. Allowed: ${allowedExtensions.join(", ")}`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "File is too large. Maximum allowed size is 10MB.";
  }
  return null;
}

export default function StudentSupervisorTools() {
  const { user, setUser } = useAuth();
  const studentId = user?.student_id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [allergies, setAllergies] = useState(DEFAULT_ALLERGIES);
  const [preferredRoommates, setPreferredRoommates] = useState([]);
  const [preferredInput, setPreferredInput] = useState("");
  const [stayRequests, setStayRequests] = useState([]);
  const [stayForm, setStayForm] = useState({ requested_start: "", requested_end: "", reason: "" });
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [verificationFile, setVerificationFile] = useState(null);
  const [profileDragOver, setProfileDragOver] = useState(false);
  const [verificationDragOver, setVerificationDragOver] = useState(false);
  const [candidateYear, setCandidateYear] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  const [banner, setBanner] = useState({ type: "", text: "" });

  const verificationLabel = useMemo(() => {
    if (!profile) return "unknown";
    if (!profile.email_verified) return "email not verified";
    if (profile.verification_status === "approved") return "approved";
    if (profile.verification_status === "rejected") return "rejected";
    return "pending";
  }, [profile]);

  const fetchProfile = async () => {
    if (!studentId) return;
    const res = await api.get(`/students/${studentId}`);
    setProfile(res.data);
    setUser((prev) => (prev ? { ...prev, ...res.data } : prev));
  };

  const fetchAllergies = async () => {
    if (!studentId) return;
    const res = await api.get(`/students/${studentId}/allergies`);
    setAllergies({ ...DEFAULT_ALLERGIES, ...(res.data?.allergies || {}) });
  };

  const fetchPreferred = async () => {
    if (!studentId) return;
    const res = await api.get(`/students/${studentId}/preferred-roommates`);
    const rows = res.data?.preferred_roommates || [];
    setPreferredRoommates(rows);
    setPreferredInput(rows.map((r) => r.preferred_student_id).join(","));
  };

  const fetchStayRequests = async () => {
    if (!studentId) return;
    const res = await api.get(`/students/${studentId}/stay-requests`);
    setStayRequests(res.data?.requests || []);
  };

  const fetchCandidates = async () => {
    if (!studentId) return;
    setCandidatesLoading(true);
    try {
      const query = new URLSearchParams();
      query.set("limit", "10");
      if (candidateYear) query.set("year", candidateYear);
      const res = await api.get(`/students/${studentId}/compatibility-candidates?${query.toString()}`);
      setCandidates(res.data?.candidates || []);
    } catch (err) {
      setCandidates([]);
      setBanner({ type: "error", text: err.response?.data?.error || "Could not load compatibility candidates." });
    } finally {
      setCandidatesLoading(false);
    }
  };

  const fetchSummary = async () => {
    if (!studentId) return;
    try {
      const res = await api.get(`/students/${studentId}/compatibility/summary`);
      setSummary(res.data || null);
    } catch {
      setSummary(null);
    }
  };

  const fetchAll = async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      await Promise.all([fetchProfile(), fetchAllergies(), fetchPreferred(), fetchStayRequests()]);
      await fetchCandidates();
      await fetchSummary();
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to load supervisor tools." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const onUploadVerification = async (e) => {
    e.preventDefault();
    const fileError = validateUploadFile(verificationFile, VERIFICATION_EXTENSIONS);
    if (fileError) {
      setBanner({ type: "error", text: fileError });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", verificationFile);
      await api.post(`/students/${studentId}/verification-document`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setVerificationFile(null);
      setBanner({ type: "success", text: "Verification document uploaded successfully." });
      await fetchProfile();
      await fetchCandidates();
      await fetchSummary();
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to upload document." });
    }
  };

  const onUploadProfilePhoto = async (e) => {
    e.preventDefault();
    const fileError = validateUploadFile(profilePhotoFile, PROFILE_EXTENSIONS);
    if (fileError) {
      setBanner({ type: "error", text: fileError });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", profilePhotoFile);
      await api.post(`/students/${studentId}/profile-photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfilePhotoFile(null);
      setBanner({ type: "success", text: "Profile photo uploaded successfully." });
      await fetchProfile();
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to upload profile photo." });
    }
  };

  const onSaveAllergies = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/students/${studentId}/allergies`, allergies);
      setBanner({ type: "success", text: "Allergy profile saved." });
      await fetchCandidates();
      await fetchSummary();
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to save allergies." });
    }
  };

  const onSavePreferred = async (e) => {
    e.preventDefault();
    try {
      const ids = preferredInput
        .split(/[\s,]+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n > 0);

      await api.put(`/students/${studentId}/preferred-roommates`, { preferred_student_ids: ids });
      setBanner({ type: "success", text: "Preferred roommates updated." });
      await fetchPreferred();
      await fetchCandidates();
      await fetchSummary();
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to update preferred roommates." });
    }
  };

  const onSubmitStayRequest = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/students/${studentId}/stay-requests`, stayForm);
      setBanner({ type: "success", text: "Stay-date request submitted." });
      setStayForm({ requested_start: "", requested_end: "", reason: "" });
      await fetchStayRequests();
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to submit stay-date request." });
    }
  };

  const onRefreshCompatibility = async () => {
    try {
      await api.post(`/students/${studentId}/compatibility/refresh`);
      await fetchCandidates();
      await fetchSummary();
      setBanner({ type: "success", text: "Compatibility scores refreshed." });
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Could not refresh compatibility scores." });
    }
  };

  const toggleAllergy = (field) => setAllergies((prev) => ({ ...prev, [field]: !prev[field] }));

  const handleDropFile = (event, setter, dragSetter) => {
    event.preventDefault();
    dragSetter(false);
    const dropped = event.dataTransfer?.files?.[0];
    if (dropped) setter(dropped);
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}>
          <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Loading supervisor tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      <div className="main-content">
        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "28px", marginBottom: "6px" }}>Student Supervisor Tools</h1>
            <p style={{ color: "var(--text-muted)", maxWidth: "780px" }}>
              Manage verification, health compatibility factors, preferred roommate cards, stay-date requests, and candidate diagnostics from one place.
            </p>
          </div>
          <Link to="/student/dashboard" className="btn btn-secondary" style={{ height: "fit-content" }}>
            Back to Dashboard
          </Link>
        </div>

        {banner.text && (
          <div className={`banner ${banner.type === "success" ? "banner-success" : "banner-error"}`}>
            <span className="banner-icon">{banner.type === "success" ? "✓" : "!"}</span>
            <div>{banner.text}</div>
          </div>
        )}

        <div className="dashboard-grid supervisor-grid">
          <div>
            <div className="card">
              <h3 className="card-title"><span>🪪</span> Verification Status</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <StatusBadge text={`email ${profile?.email_verified ? "verified" : "not verified"}`} className={profile?.email_verified ? "badge-success" : "badge-warning"} />
                <StatusBadge text={verificationLabel} className={verificationLabel === "approved" ? "badge-success" : verificationLabel === "rejected" ? "badge-error" : "badge-warning"} />
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "10px" }}>
                Current profile photo path: <strong style={{ color: "var(--text-main)" }}>{profile?.profile_photo_path || "not uploaded"}</strong>
              </p>
              <form onSubmit={onUploadProfilePhoto} style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setProfileDragOver(true);
                  }}
                  onDragLeave={() => setProfileDragOver(false)}
                  onDrop={(e) => handleDropFile(e, setProfilePhotoFile, setProfileDragOver)}
                  style={{
                    border: profileDragOver ? "2px dashed var(--primary)" : "1.5px dashed var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    background: profileDragOver ? "var(--primary-soft)" : "var(--bg-primary)",
                    padding: "12px",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                    textAlign: "center",
                  }}
                >
                  Drag and drop profile photo here
                </div>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  onChange={(e) => setProfilePhotoFile(e.target.files?.[0] || null)}
                  className="form-input"
                />
                {profilePhotoFile && (
                  <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    Selected: <strong style={{ color: "var(--text-main)" }}>{profilePhotoFile.name}</strong>
                  </p>
                )}
                <div>
                  <button type="submit" className="btn btn-secondary">Upload Profile Photo</button>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                  Accepted: png, jpg, jpeg, webp. Max size: 10MB.
                </p>
              </form>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "12px" }}>
                Upload a clear ID or institutional document. Uploading sets status to pending until reviewed by admin.
              </p>
              <form onSubmit={onUploadVerification} style={{ display: "grid", gap: "10px" }}>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setVerificationDragOver(true);
                  }}
                  onDragLeave={() => setVerificationDragOver(false)}
                  onDrop={(e) => handleDropFile(e, setVerificationFile, setVerificationDragOver)}
                  style={{
                    border: verificationDragOver ? "2px dashed var(--primary)" : "1.5px dashed var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    background: verificationDragOver ? "var(--primary-soft)" : "var(--bg-primary)",
                    padding: "12px",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                    textAlign: "center",
                  }}
                >
                  Drag and drop verification document here
                </div>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf"
                  onChange={(e) => setVerificationFile(e.target.files?.[0] || null)}
                  className="form-input"
                />
                {verificationFile && (
                  <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    Selected: <strong style={{ color: "var(--text-main)" }}>{verificationFile.name}</strong>
                  </p>
                )}
                <div>
                  <button type="submit" className="btn btn-primary">Upload Verification Document</button>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                  Accepted: png, jpg, jpeg, webp, pdf. Max size: 10MB.
                </p>
              </form>
            </div>

            <div className="card">
              <h3 className="card-title"><span>🧬</span> Allergy and Sensitivity Profile</h3>
              <form onSubmit={onSaveAllergies}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  {[
                    ["has_dust_mould_allergy", "Dust or mould allergy"],
                    ["has_fragrance_sensitivity", "Fragrance sensitivity"],
                    ["has_food_allergy", "Food allergy"],
                    ["has_latex_allergy", "Latex allergy"],
                    ["has_chemical_sensitivity", "Chemical sensitivity"],
                    ["has_severe_nut_allergy", "Severe nut allergy"],
                    ["has_smoke_sensitivity", "Smoke sensitivity"],
                    ["has_asthma_or_respiratory_condition", "Asthma or respiratory condition"],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" }}>
                      <input type="checkbox" checked={!!allergies[key]} onChange={() => toggleAllergy(key)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Food allergy detail</label>
                    <input
                      className="form-input"
                      value={allergies.food_allergy_detail || ""}
                      onChange={(e) => setAllergies((prev) => ({ ...prev, food_allergy_detail: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Chemical sensitivity detail</label>
                    <input
                      className="form-input"
                      value={allergies.chemical_sensitivity_detail || ""}
                      onChange={(e) => setAllergies((prev) => ({ ...prev, chemical_sensitivity_detail: e.target.value }))}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary">Save Allergy Profile</button>
              </form>
            </div>

            <div className="card">
              <h3 className="card-title"><span>🗓️</span> Stay-Date Requests</h3>
              <form onSubmit={onSubmitStayRequest} style={{ marginBottom: "16px" }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Requested Start</label>
                    <input
                      type="date"
                      className="form-input"
                      value={stayForm.requested_start}
                      onChange={(e) => setStayForm((prev) => ({ ...prev, requested_start: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Requested End</label>
                    <input
                      type="date"
                      className="form-input"
                      value={stayForm.requested_end}
                      onChange={(e) => setStayForm((prev) => ({ ...prev, requested_end: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={stayForm.reason}
                    onChange={(e) => setStayForm((prev) => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
                <button type="submit" className="btn btn-primary">Submit Stay-Date Request</button>
              </form>

              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Range</th>
                      <th>Status</th>
                      <th>Admin Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stayRequests.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center", color: "var(--text-muted)" }}>No stay-date requests yet.</td>
                      </tr>
                    ) : (
                      stayRequests.map((row) => (
                        <tr key={row.request_id}>
                          <td>#{row.request_id}</td>
                          <td>{row.requested_start} - {row.requested_end}</td>
                          <td><StatusBadge text={row.status} className={row.status === "approved" ? "badge-success" : row.status === "rejected" ? "badge-error" : "badge-warning"} /></td>
                          <td>{row.admin_note || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <div className="card">
              <h3 className="card-title"><span>🧑‍🤝‍🧑</span> Preferred Roommate Cards</h3>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "10px" }}>
                Enter up to 3 student IDs, separated by commas or spaces.
              </p>
              <form onSubmit={onSavePreferred} style={{ display: "grid", gap: "10px" }}>
                <input
                  className="form-input"
                  value={preferredInput}
                  onChange={(e) => setPreferredInput(e.target.value)}
                  placeholder="Example: 14, 27, 33"
                />
                <button type="submit" className="btn btn-primary">Save Preferred Roommates</button>
              </form>

              <div style={{ marginTop: "14px", display: "grid", gap: "8px" }}>
                {preferredRoommates.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No preferred roommates selected.</p>
                ) : preferredRoommates.map((row) => (
                  <div key={row.preferred_student_id} style={{ border: "1px solid var(--border-color)", borderRadius: "10px", padding: "10px" }}>
                    <div style={{ fontWeight: 700 }}>{row.name || "Unknown"}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>ID {row.preferred_student_id} • {row.student_number || "N/A"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px", flexWrap: "wrap" }}>
                <h3 className="card-title" style={{ margin: 0 }}><span>📊</span> Compatibility Candidates</h3>
                <button className="btn btn-secondary" onClick={onRefreshCompatibility}>Refresh Scores</button>
              </div>

              {summary && (
                <div className="stats-panel" style={{ marginBottom: "12px" }}>
                  <div className="stat-card stat-card-indigo">
                    <div className="stat-value">{summary.total_candidates}</div>
                    <div className="stat-label">Total candidates</div>
                  </div>
                  <div className="stat-card stat-card-teal">
                    <div className="stat-value">{summary.eligible_candidates}</div>
                    <div className="stat-label">Eligible candidates</div>
                  </div>
                  <div className="stat-card stat-card-rose">
                    <div className="stat-value">{summary.blocked_candidates}</div>
                    <div className="stat-label">Hard blocked</div>
                  </div>
                </div>
              )}

              {summary && !summary.is_matching_eligible && (
                <div className="banner banner-warning" style={{ marginBottom: "10px" }}>
                  <span className="banner-icon">!</span>
                  <div>
                    Matching eligibility incomplete. Requirements: active account, verified email, approved verification, and submitted preferences.
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: "10px" }}>
                <label className="form-label">Filter by Year</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <select className="form-select" value={candidateYear} onChange={(e) => setCandidateYear(e.target.value)}>
                    <option value="">All years</option>
                    {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                  <button className="btn btn-secondary" onClick={fetchCandidates}>Apply</button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Year</th>
                      <th>Score</th>
                      <th>Reason Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidatesLoading ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading candidates...</td>
                      </tr>
                    ) : candidates.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center", color: "var(--text-muted)" }}>No candidates available yet.</td>
                      </tr>
                    ) : (
                      candidates.map((row) => (
                        <tr key={row.candidate_student_id}>
                          <td>{row.name} ({row.student_number})</td>
                          <td>{row.year}</td>
                          <td>{row.score}</td>
                          <td>{(row.reason_tags || []).join(", ") || "-"}</td>
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
