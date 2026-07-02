import { useEffect, useMemo, useState } from "react";
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

const WAKE_LABELS = { 1: "Very Early (5AM)", 2: "Early (6:30AM)", 3: "Normal (7:30AM)", 4: "Late (9AM)", 5: "Very Late (10AM+)" };
const SLEEP_LABELS = { 1: "Very Early (9PM)", 2: "Early (10PM)", 3: "Normal (11PM)", 4: "Late (12AM)", 5: "Very Late (1AM+)" };
const NOISE_LABELS = { 1: "Silence needed", 2: "Mostly quiet", 3: "Some noise ok", 4: "Fairly loud", 5: "Loud is fine" };
const CLEAN_LABELS = { 1: "Very messy", 2: "Somewhat messy", 3: "Average", 4: "Fairly tidy", 5: "Obsessively tidy" };
const GUEST_LABELS = { 1: "No guests ever", 2: "Rarely", 3: "Sometimes", 4: "Often", 5: "Guests daily" };
const SOCIAL_LABELS = { 1: "Strong Introvert", 2: "Mostly Introvert", 3: "Balanced", 4: "Mostly Extrovert", 5: "Strong Extrovert" };
const VAPING_LABELS = { 1: "No vaping", 2: "Occasional vaping", 3: "Frequent vaping" };

const FIELD_OPTIONS = [
  { value: "stem", label: "STEM" },
  { value: "medicine", label: "Medicine" },
  { value: "business", label: "Business" },
  { value: "social_sciences", label: "Social Sciences" },
  { value: "law", label: "Law" },
  { value: "arts_humanities", label: "Arts and Humanities" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
];

const HOBBY_OPTIONS = [
  { value: "reading", label: "Reading" },
  { value: "gaming", label: "Gaming" },
  { value: "sports", label: "Sports" },
  { value: "music", label: "Music" },
  { value: "cooking", label: "Cooking" },
  { value: "art_drawing", label: "Art and Drawing" },
  { value: "photography", label: "Photography" },
  { value: "travel", label: "Travel" },
  { value: "fitness_gym", label: "Fitness and Gym" },
  { value: "movies_series", label: "Movies and Series" },
  { value: "dancing", label: "Dancing" },
  { value: "volunteering", label: "Volunteering" },
  { value: "coding", label: "Coding" },
  { value: "fashion", label: "Fashion" },
  { value: "nature_hiking", label: "Nature and Hiking" },
];

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

function StatusBadge({ text, className }) {
  return (
    <span className={`badge ${className}`} style={{ textTransform: "capitalize" }}>
      {text}
    </span>
  );
}

export default function StudentDashboard() {
  const { user, setUser } = useAuth();
  const studentId = user?.student_id;

  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState({ type: "", text: "" });

  const [studentProfile, setStudentProfile] = useState(null);
  const [prefData, setPrefData] = useState(null);
  const [preferenceForm, setPreferenceForm] = useState({
    wake_time: 3,
    sleep_time: 3,
    noise_tolerance: 3,
    cleanliness_level: 3,
    guest_policy: 3,
    bathroom_schedule: 3,
    study_habits: "flexible",
    introvert_extrovert: 3,
    vaping_habit: 1,
    field_of_study: "other",
    hobbies: [],
    additional_notes: "",
  });
  const [isPrefEdit, setIsPrefEdit] = useState(false);
  const [isPrefLocked, setIsPrefLocked] = useState(false);
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState({ type: "", text: "" });
  const [hobbySearch, setHobbySearch] = useState("");
  const [allergies, setAllergies] = useState(DEFAULT_ALLERGIES);
  const [allergySaving, setAllergySaving] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [stayRows, setStayRows] = useState([]);
  const [stayLoading, setStayLoading] = useState(false);
  const [stayForm, setStayForm] = useState({ requested_start: "", requested_end: "", reason: "" });

  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [verificationFile, setVerificationFile] = useState(null);

  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedPreferredIds, setSelectedPreferredIds] = useState([]);

  const [conflicts, setConflicts] = useState([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflictError, setConflictError] = useState("");
  const [conflictSuccess, setConflictSuccess] = useState("");
  const [conflictForm, setConflictForm] = useState({
    conflict_type: "noise",
    severity: 3,
    description: "",
  });

  const backendBaseUrl = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
    return apiBase.replace(/\/api\/?$/, "");
  }, []);

  const fetchProfile = async () => {
    if (!studentId) return;
    const res = await api.get(`/students/${studentId}`);
    setStudentProfile(res.data);
    setUser((prev) => (prev ? { ...prev, ...res.data } : prev));
  };

  const fetchPreferences = async () => {
    if (!studentId) return;
    try {
      const res = await api.get(`/preferences/${studentId}`);
      setPrefData(res.data);
      if (res.data?.submitted && res.data?.preferences) {
        const incoming = res.data.preferences;
        setPreferenceForm({
          ...incoming,
          introvert_extrovert: incoming.introvert_extrovert ?? 3,
          vaping_habit: incoming.vaping_habit ?? 1,
          field_of_study: incoming.field_of_study ?? "other",
          hobbies: Array.isArray(incoming.hobbies) ? incoming.hobbies : [],
          additional_notes: incoming.additional_notes || "",
        });
        setIsPrefEdit(true);
        setIsPrefLocked(!!incoming.is_locked);
      }
    } catch {
      setPrefData({ submitted: false });
      setIsPrefEdit(false);
      setIsPrefLocked(false);
    }
  };

  const fetchAllergies = async () => {
    if (!studentId) return;
    try {
      const res = await api.get(`/students/${studentId}/allergies`);
      setAllergies({ ...DEFAULT_ALLERGIES, ...(res.data?.allergies || {}) });
    } catch {
      setAllergies(DEFAULT_ALLERGIES);
    }
  };

  const fetchAssignment = async () => {
    if (!studentId) return;
    try {
      const sem = `${new Date().getFullYear()}-S1`;
      const res = await api.get(`/students/${studentId}/assignment?semester=${encodeURIComponent(sem)}`);
      setAssignment(res.data?.assignment || null);
    } catch {
      setAssignment(null);
    }
  };

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

  const fetchStayRequests = async () => {
    if (!studentId) return;
    setStayLoading(true);
    try {
      const res = await api.get(`/students/${studentId}/stay-requests`);
      setStayRows(res.data?.requests || []);
    } catch {
      setStayRows([]);
    } finally {
      setStayLoading(false);
    }
  };

  const fetchCandidates = async ({ silent = false } = {}) => {
    if (!studentId) return;
    setCandidatesLoading(true);
    try {
      const res = await api.get(`/students/${studentId}/compatibility-candidates?limit=10`);
      const rows = res.data?.candidates || [];
      setCandidates(rows);
      setSelectedPreferredIds((prev) => prev.filter((id) => rows.some((r) => r.candidate_student_id === id)));
    } catch (err) {
      setCandidates([]);
      if (!silent) {
        setBanner({ type: "error", text: err.response?.data?.error || "Could not load compatibility suggestions." });
      }
    } finally {
      setCandidatesLoading(false);
    }
  };

  const fetchPreferred = async () => {
    if (!studentId) return;
    try {
      const res = await api.get(`/students/${studentId}/preferred-roommates`);
      const ids = (res.data?.preferred_roommates || []).map((row) => row.preferred_student_id);
      setSelectedPreferredIds(ids);
    } catch {
      setSelectedPreferredIds([]);
    }
  };

  const fetchAll = async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchProfile(),
        fetchPreferences(),
        fetchAllergies(),
        fetchAssignment(),
        fetchStayRequests(),
        fetchPreferred(),
        fetchCandidates({ silent: true }),
        fetchMyConflicts(),
      ]);
    } catch {
      setBanner({ type: "error", text: "Failed to load dashboard data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const isVerifiedByAdmin = !!studentProfile?.email_verified && studentProfile?.verification_status === "approved";

  useEffect(() => {
    if (isVerifiedByAdmin && activeTab === "verification") {
      setActiveTab("profile");
    }
  }, [isVerifiedByAdmin, activeTab]);

  const accountStatus = useMemo(() => {
    if (assignment) return "assigned";
    if (!studentProfile?.email_verified) return "not verified";
    if (studentProfile?.verification_status === "approved") return "verified";
    return "awaiting verification";
  }, [assignment, studentProfile]);

  const accountStatusBadgeClass =
    accountStatus === "assigned" || accountStatus === "verified"
      ? "badge-success"
      : accountStatus === "awaiting verification"
        ? "badge-warning"
        : "badge-error";

  const traits = useMemo(() => {
    const pref = prefData?.preferences;
    if (!prefData?.submitted || !pref) return [];
    const result = [];

    if (pref.sleep_time >= 4) result.push({ text: "Night Owl", icon: "🌙" });
    else if (pref.sleep_time <= 2) result.push({ text: "Early Sleeper", icon: "🌅" });
    else result.push({ text: "Balanced Sleeper", icon: "🕒" });

    if (pref.study_habits === "quiet") result.push({ text: "Quiet Study Style", icon: "📚" });
    else if (pref.study_habits === "group") result.push({ text: "Group Study Style", icon: "👥" });
    else result.push({ text: "Flexible Study Style", icon: "📚" });

    if (pref.cleanliness_level >= 4) result.push({ text: "Highly Organized", icon: "🧹" });
    else if (pref.cleanliness_level <= 2) result.push({ text: "Relaxed Cleanliness", icon: "📦" });
    else result.push({ text: "Moderately Tidy", icon: "🧹" });

    if (pref.introvert_extrovert >= 4) result.push({ text: "Extrovert Leaning", icon: "🗣️" });
    else if (pref.introvert_extrovert <= 2) result.push({ text: "Introvert Leaning", icon: "🧠" });
    else result.push({ text: "Socially Balanced", icon: "⚖️" });

    if (pref.field_of_study) result.push({ text: `Field: ${String(pref.field_of_study).replace("_", " ")}`, icon: "🎓" });
    if (Array.isArray(pref.hobbies) && pref.hobbies.length > 0) {
      result.push({ text: `${pref.hobbies.length} hobbies selected`, icon: "🎯" });
    }

    return result;
  }, [prefData]);

  const resolveAssetUrl = (path) => {
    if (!path) return "";
    if (String(path).startsWith("http")) return path;
    return `${backendBaseUrl}/${String(path).replace(/^\/+/, "")}`;
  };

  const renderAvatar = (path, name, size = 34) => {
    if (path) {
      return (
        <img
          src={resolveAssetUrl(path)}
          alt={`${name} profile`}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            objectFit: "cover",
            borderRadius: "999px",
            border: "1px solid var(--border-color)",
            flexShrink: 0,
            background: "var(--bg-primary)",
          }}
        />
      );
    }

    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "999px",
          border: "1px dashed var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: "11px",
          fontWeight: 700,
          flexShrink: 0,
          background: "var(--bg-primary)",
        }}
      >
        {String(name || "?").slice(0, 1).toUpperCase()}
      </div>
    );
  };

  const handleGoogleLikeUpload = async ({ file, allowed, endpoint, successMessage, clear }) => {
    const fileError = validateUploadFile(file, allowed);
    if (fileError) {
      setBanner({ type: "error", text: fileError });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/students/${studentId}/${endpoint}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      clear();
      setBanner({ type: "success", text: successMessage });
      await Promise.all([fetchProfile(), fetchCandidates({ silent: true })]);
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Upload failed." });
    }
  };

  const onUploadProfilePhoto = async (e) => {
    e.preventDefault();
    await handleGoogleLikeUpload({
      file: profilePhotoFile,
      allowed: PROFILE_EXTENSIONS,
      endpoint: "profile-photo",
      successMessage: "Profile photo uploaded successfully.",
      clear: () => setProfilePhotoFile(null),
    });
  };

  const onUploadVerification = async (e) => {
    e.preventDefault();
    await handleGoogleLikeUpload({
      file: verificationFile,
      allowed: VERIFICATION_EXTENSIONS,
      endpoint: "verification-document",
      successMessage: "Verification document uploaded successfully.",
      clear: () => setVerificationFile(null),
    });
  };

  const handlePrefSlider = (e) => {
    setPreferenceForm((prev) => ({ ...prev, [e.target.name]: parseInt(e.target.value, 10) }));
  };

  const handlePrefRadio = (e) => {
    const val = e.target.name === "bathroom_schedule" ? parseInt(e.target.value, 10) : e.target.value;
    setPreferenceForm((prev) => ({ ...prev, [e.target.name]: val }));
  };

  const handlePrefSelect = (e) => {
    const numericFields = new Set(["vaping_habit"]);
    const val = numericFields.has(e.target.name) ? parseInt(e.target.value, 10) : e.target.value;
    setPreferenceForm((prev) => ({ ...prev, [e.target.name]: val }));
  };

  const handleHobbyToggle = (hobby) => {
    const current = Array.isArray(preferenceForm.hobbies) ? preferenceForm.hobbies : [];
    const next = current.includes(hobby) ? current.filter((h) => h !== hobby) : [...current, hobby];
    setPreferenceForm((prev) => ({ ...prev, hobbies: next }));
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setPreferenceSaving(true);
    setPreferenceMessage({ type: "", text: "" });
    try {
      if (isPrefEdit) {
        await api.put("/preferences/", preferenceForm);
      } else {
        await api.post("/preferences/", preferenceForm);
      }
      setPreferenceMessage({ type: "success", text: "Preferences saved successfully." });
      await fetchPreferences();
      await fetchCandidates({ silent: true });
    } catch (err) {
      const errors = err.response?.data?.errors || [err.response?.data?.error || "Failed to save preferences."];
      setPreferenceMessage({ type: "error", text: Array.isArray(errors) ? errors.join(", ") : errors });
    } finally {
      setPreferenceSaving(false);
    }
  };

  const toggleAllergy = (field) => {
    setAllergies((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSaveAllergies = async (e) => {
    e.preventDefault();
    setAllergySaving(true);
    try {
      await api.put(`/students/${studentId}/allergies`, allergies);
      setBanner({ type: "success", text: "Allergy and sensitivity profile saved." });
      await fetchCandidates({ silent: true });
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to save allergies." });
    } finally {
      setAllergySaving(false);
    }
  };

  const toggleSuggested = (candidateId) => {
    setSelectedPreferredIds((prev) => {
      if (prev.includes(candidateId)) return prev.filter((id) => id !== candidateId);
      if (prev.length >= 3) return prev;
      return [...prev, candidateId];
    });
  };

  const savePreferredSuggestions = async () => {
    try {
      await api.put(`/students/${studentId}/preferred-roommates`, {
        preferred_student_ids: selectedPreferredIds,
      });
      setBanner({ type: "success", text: "Preferred roommates updated from suggestions." });
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Could not save preferred roommates." });
    }
  };

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

  const submitStayRequest = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/students/${studentId}/stay-requests`, stayForm);
      setBanner({ type: "success", text: "Stay-date request submitted successfully." });
      setStayForm({ requested_start: "", requested_end: "", reason: "" });
      await Promise.all([fetchStayRequests(), fetchProfile()]);
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to submit stay-date request." });
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="main-content" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Loading student workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      <div className="main-content">
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "28px", marginBottom: "4px" }}>Hello, {studentProfile?.name || user?.name} 👋</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            Student Number: <strong style={{ color: "var(--text-main)" }}>{studentProfile?.student_number || user?.student_number}</strong>
            {" "}| Year of Study: <strong style={{ color: "var(--text-main)" }}>{studentProfile?.year || user?.year}</strong>
          </p>
        </div>

        {banner.text && (
          <div className={`banner ${banner.type === "success" ? "banner-success" : "banner-error"}`}>
            <span className="banner-icon">{banner.type === "success" ? "✓" : "!"}</span>
            <div>{banner.text}</div>
          </div>
        )}

        <div className="student-dashboard-layout">
          <aside className="student-sidebar">
            <div className="student-sidebar-card">
              <h3 className="student-sidebar-title">Student Workspace</h3>
              <div className="admin-sidebar-links">
                <button
                  type="button"
                  className={`dashboard-nav-btn ${activeTab === "profile" ? "active" : ""}`}
                  onClick={() => setActiveTab("profile")}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className={`dashboard-nav-btn ${activeTab === "verification" ? "active" : ""}`}
                  onClick={() => setActiveTab("verification")}
                  disabled={isVerifiedByAdmin}
                  title={isVerifiedByAdmin ? "Verification is complete. This tab is locked." : "Verification"}
                >
                  Verification
                </button>
                <button
                  type="button"
                  className={`dashboard-nav-btn ${activeTab === "preferences" ? "active" : ""}`}
                  onClick={() => setActiveTab("preferences")}
                  disabled={!isVerifiedByAdmin}
                  title={!isVerifiedByAdmin ? "Available after admin verification." : "Preferences"}
                >
                  Preferences
                </button>
                <button
                  type="button"
                  className={`dashboard-nav-btn ${activeTab === "assignment" ? "active" : ""}`}
                  onClick={() => setActiveTab("assignment")}
                  disabled={!isVerifiedByAdmin}
                  title={!isVerifiedByAdmin ? "Available after admin verification." : "Assignment"}
                >
                  Assignment
                </button>
              </div>
              <div style={{ marginTop: "12px" }}>
                <StatusBadge text={accountStatus} className={accountStatusBadgeClass} />
              </div>
            </div>
          </aside>

          <div className="admin-content-pane">
            {activeTab === "profile" && (
              <div style={{ display: "grid", gap: "18px" }}>
                <div className="card">
                  <h3 className="card-title"><span>👤</span> Profile Overview</h3>
                  <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "140px 1fr" }}>
                    <div>
                      {studentProfile?.profile_photo_path ? (
                        <img
                          src={resolveAssetUrl(studentProfile.profile_photo_path)}
                          alt="Profile"
                          style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "14px", border: "1px solid var(--border-color)" }}
                        />
                      ) : (
                        <div style={{ width: "120px", height: "120px", borderRadius: "14px", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                          No photo
                        </div>
                      )}
                    </div>
                    <div>
                      <p><strong>Name:</strong> {studentProfile?.name || "-"}</p>
                      <p><strong>Email:</strong> {studentProfile?.email || "-"}</p>
                      <p><strong>Student Number:</strong> {studentProfile?.student_number || "-"}</p>
                      <p><strong>Year:</strong> {studentProfile?.year || "-"}</p>
                      <p><strong>Gender:</strong> {studentProfile?.gender || "-"}</p>
                      <p><strong>Profile Status:</strong> <StatusBadge text={accountStatus} className={accountStatusBadgeClass} /></p>
                      <p style={{ marginBottom: 0 }}>
                        <strong>Verification:</strong>{" "}
                        <StatusBadge
                          text={studentProfile?.verification_status || "pending"}
                          className={studentProfile?.verification_status === "approved" ? "badge-success" : studentProfile?.verification_status === "rejected" ? "badge-error" : "badge-warning"}
                        />
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="card-title"><span>📅</span> Stay Dates (Start and Check-out)</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "10px" }}>
                    Current approved dates: {studentProfile?.expected_start_date || "-"} to {studentProfile?.expected_end_date || "-"}
                  </p>

                  <form onSubmit={submitStayRequest} style={{ marginBottom: "14px" }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Start date</label>
                        <input
                          type="date"
                          className="form-input"
                          value={stayForm.requested_start}
                          onChange={(e) => setStayForm((prev) => ({ ...prev, requested_start: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Check-out date</label>
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
                    <button type="submit" className="btn btn-primary">Submit Date Request</button>
                  </form>

                  <div className="table-responsive">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Requested Range</th>
                          <th>Status</th>
                          <th>Admin Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stayLoading ? (
                          <tr><td colSpan="4" style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading requests...</td></tr>
                        ) : stayRows.length === 0 ? (
                          <tr><td colSpan="4" style={{ textAlign: "center", color: "var(--text-muted)" }}>No stay-date requests yet.</td></tr>
                        ) : stayRows.map((row) => (
                          <tr key={row.request_id}>
                            <td>#{row.request_id}</td>
                            <td>{row.requested_start} - {row.requested_end}</td>
                            <td><StatusBadge text={row.status} className={row.status === "approved" ? "badge-success" : row.status === "rejected" ? "badge-error" : "badge-warning"} /></td>
                            <td>{row.admin_note || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "verification" && (
              <div className="card" style={{ display: "grid", gap: "18px" }}>
                <h3 className="card-title"><span>🪪</span> Verification Uploads</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  Upload your profile picture and school ID/admission letter. Your account stays pending until admin review is complete.
                </p>

                <form onSubmit={onUploadProfilePhoto} style={{ display: "grid", gap: "10px" }}>
                  <label className="form-label">Profile picture</label>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    onChange={(e) => setProfilePhotoFile(e.target.files?.[0] || null)}
                    className="form-input"
                  />
                  <button type="submit" className="btn btn-secondary" style={{ width: "fit-content" }}>
                    Upload Profile Picture
                  </button>
                </form>

                <form onSubmit={onUploadVerification} style={{ display: "grid", gap: "10px" }}>
                  <label className="form-label">School ID or admission letter</label>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.pdf"
                    onChange={(e) => setVerificationFile(e.target.files?.[0] || null)}
                    className="form-input"
                  />
                  <button type="submit" className="btn btn-primary" style={{ width: "fit-content" }}>
                    Upload Verification Document
                  </button>
                </form>
              </div>
            )}

            {activeTab === "preferences" && (
              <div className="card" style={{ display: "grid", gap: "18px" }}>
                {!isVerifiedByAdmin ? (
                  <div className="banner banner-warning">
                    <span className="banner-icon">⚠</span>
                    <div>Preferences unlock after admin verification is approved.</div>
                  </div>
                ) : (
                  <>
                    <h3 className="card-title"><span>🎛️</span> Preferences and Suggestions</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                      Fill or update full lifestyle preferences, habits, hobbies, and allergies below, then choose suggested roommates from the same tab.
                    </p>

                    {isPrefLocked && (
                      <div className="banner banner-warning" style={{ marginBottom: 0 }}>
                        <span className="banner-icon">🔒</span>
                        <div>Preferences are locked for this semester and cannot be modified.</div>
                      </div>
                    )}

                    {preferenceMessage.text && (
                      <div className={`banner ${preferenceMessage.type === "success" ? "banner-success" : "banner-error"}`} style={{ marginBottom: 0 }}>
                        <span className="banner-icon">{preferenceMessage.type === "success" ? "✓" : "⚠"}</span>
                        <div>{preferenceMessage.text}</div>
                      </div>
                    )}

                    <form onSubmit={handleSavePreferences} style={{ display: "grid", gap: "14px" }}>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Wake Time ({preferenceForm.wake_time}/5)</label>
                          <input type="range" min="1" max="5" name="wake_time" value={preferenceForm.wake_time} onChange={handlePrefSlider} disabled={isPrefLocked} className="form-input" />
                          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{WAKE_LABELS[preferenceForm.wake_time]}</p>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Sleep Time ({preferenceForm.sleep_time}/5)</label>
                          <input type="range" min="1" max="5" name="sleep_time" value={preferenceForm.sleep_time} onChange={handlePrefSlider} disabled={isPrefLocked} className="form-input" />
                          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{SLEEP_LABELS[preferenceForm.sleep_time]}</p>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Noise Tolerance ({preferenceForm.noise_tolerance}/5)</label>
                          <input type="range" min="1" max="5" name="noise_tolerance" value={preferenceForm.noise_tolerance} onChange={handlePrefSlider} disabled={isPrefLocked} className="form-input" />
                          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{NOISE_LABELS[preferenceForm.noise_tolerance]}</p>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Cleanliness ({preferenceForm.cleanliness_level}/5)</label>
                          <input type="range" min="1" max="5" name="cleanliness_level" value={preferenceForm.cleanliness_level} onChange={handlePrefSlider} disabled={isPrefLocked} className="form-input" />
                          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{CLEAN_LABELS[preferenceForm.cleanliness_level]}</p>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Guest Policy ({preferenceForm.guest_policy}/5)</label>
                          <input type="range" min="1" max="5" name="guest_policy" value={preferenceForm.guest_policy} onChange={handlePrefSlider} disabled={isPrefLocked} className="form-input" />
                          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{GUEST_LABELS[preferenceForm.guest_policy]}</p>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Social Style ({preferenceForm.introvert_extrovert}/5)</label>
                          <input type="range" min="1" max="5" name="introvert_extrovert" value={preferenceForm.introvert_extrovert} onChange={handlePrefSlider} disabled={isPrefLocked} className="form-input" />
                          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{SOCIAL_LABELS[preferenceForm.introvert_extrovert]}</p>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Bathroom Schedule</label>
                        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                          <label><input type="radio" name="bathroom_schedule" value={1} checked={String(preferenceForm.bathroom_schedule) === "1"} onChange={handlePrefRadio} disabled={isPrefLocked} /> Morning</label>
                          <label><input type="radio" name="bathroom_schedule" value={2} checked={String(preferenceForm.bathroom_schedule) === "2"} onChange={handlePrefRadio} disabled={isPrefLocked} /> Evening</label>
                          <label><input type="radio" name="bathroom_schedule" value={3} checked={String(preferenceForm.bathroom_schedule) === "3"} onChange={handlePrefRadio} disabled={isPrefLocked} /> Flexible</label>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Study Habits</label>
                          <select name="study_habits" className="form-select" value={preferenceForm.study_habits} onChange={handlePrefRadio} disabled={isPrefLocked}>
                            <option value="quiet">Quiet</option>
                            <option value="group">Group</option>
                            <option value="flexible">Flexible</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Vaping Habit</label>
                          <select name="vaping_habit" className="form-select" value={preferenceForm.vaping_habit} onChange={handlePrefSelect} disabled={isPrefLocked}>
                            <option value={1}>{VAPING_LABELS[1]}</option>
                            <option value={2}>{VAPING_LABELS[2]}</option>
                            <option value={3}>{VAPING_LABELS[3]}</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Field of Study</label>
                        <select name="field_of_study" className="form-select" value={preferenceForm.field_of_study} onChange={handlePrefSelect} disabled={isPrefLocked}>
                          {FIELD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Hobbies</label>
                        <input
                          className="form-input"
                          placeholder="Search hobbies..."
                          value={hobbySearch}
                          onChange={(e) => setHobbySearch(e.target.value)}
                          disabled={isPrefLocked}
                          style={{ marginBottom: "10px" }}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          {HOBBY_OPTIONS.filter((hobby) => {
                            const term = hobbySearch.trim().toLowerCase();
                            return !term || hobby.label.toLowerCase().includes(term);
                          }).map((hobby) => (
                            <label key={hobby.value} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                              <input
                                type="checkbox"
                                checked={(preferenceForm.hobbies || []).includes(hobby.value)}
                                onChange={() => handleHobbyToggle(hobby.value)}
                                disabled={isPrefLocked}
                              />
                              <span>{hobby.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Additional Notes</label>
                        <textarea
                          className="form-textarea"
                          rows={3}
                          name="additional_notes"
                          value={preferenceForm.additional_notes || ""}
                          onChange={(e) => setPreferenceForm((prev) => ({ ...prev, additional_notes: e.target.value }))}
                          disabled={isPrefLocked}
                        />
                      </div>

                      <div>
                        <button type="submit" className="btn btn-primary" disabled={isPrefLocked || preferenceSaving}>
                          {preferenceSaving ? "Saving..." : isPrefEdit ? "Update Preferences" : "Save Preferences"}
                        </button>
                      </div>
                    </form>

                    <form onSubmit={handleSaveAllergies} style={{ display: "grid", gap: "12px" }}>
                      <h4 style={{ marginBottom: 0 }}>Allergies and Sensitivities</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
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

                      <div>
                        <button type="submit" className="btn btn-secondary" disabled={allergySaving}>
                          {allergySaving ? "Saving..." : "Save Allergies"}
                        </button>
                      </div>
                    </form>

                    <button type="button" className="btn btn-secondary" onClick={fetchCandidates} style={{ width: "fit-content" }}>
                      Refresh Suggestions
                    </button>

                    {prefData?.submitted && traits.length > 0 && (
                      <div>
                        <p style={{ marginBottom: "8px", fontWeight: 600 }}>Current preference snapshot</p>
                        <div className="trait-pill-grid">
                          {traits.map((trait, idx) => (
                            <span className="trait-pill" key={idx}>
                              <span>{trait.icon}</span>
                              <span>{trait.text}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="table-responsive">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Select</th>
                            <th>Candidate</th>
                            <th>Year</th>
                            <th>Score</th>
                            <th>Reason Tags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {candidatesLoading ? (
                            <tr>
                              <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading suggestions...</td>
                            </tr>
                          ) : candidates.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>No compatibility suggestions available yet.</td>
                            </tr>
                          ) : (
                            candidates.map((row) => (
                              <tr key={row.candidate_student_id}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedPreferredIds.includes(row.candidate_student_id)}
                                    onChange={() => toggleSuggested(row.candidate_student_id)}
                                    disabled={!selectedPreferredIds.includes(row.candidate_student_id) && selectedPreferredIds.length >= 3}
                                  />
                                </td>
                                  <div className="candidate-cell">
                                    {renderAvatar(row.profile_photo_path, row.name, 34)}
                                    <div className="candidate-hover-wrap">
                                      <span className="candidate-name-trigger">{row.name}</span>
                                      <span style={{ color: "var(--text-muted)", fontSize: "12px" }}> ({row.student_number})</span>
                                      <div className="candidate-hover-card" role="tooltip">
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                          {renderAvatar(row.profile_photo_path, row.name, 56)}
                                          <div>
                                            <div style={{ fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>{row.name}</div>
                                            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Year {row.year}</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                <td>{row.year}</td>
                                <td>{row.score}</td>
                                <td>{(row.reason_tags || []).join(", ") || "-"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <button className="btn btn-primary" onClick={savePreferredSuggestions}>
                        Save Selected Suggestions as Preferred Roommates
                      </button>
                      <p style={{ marginTop: "6px", color: "var(--text-muted)", fontSize: "12px" }}>
                        You can pick up to 3 preferred roommates.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "assignment" && (
              <div style={{ display: "grid", gap: "18px" }}>
                {!isVerifiedByAdmin ? (
                  <div className="banner banner-warning">
                    <span className="banner-icon">⚠</span>
                    <div>Assignment and conflict reporting unlock after admin verification is approved.</div>
                  </div>
                ) : (
                  <>
                    <div className="card">
                      <h3 className="card-title"><span>🏠</span> My Assignment</h3>
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
                        <div className="empty-state" style={{ padding: "16px 0" }}>
                          <span className="empty-state-icon">🏠</span>
                          <h4 className="empty-state-title" style={{ fontSize: "15px", marginBottom: "8px" }}>
                            Your roommate match has not been generated yet.
                          </h4>
                        </div>
                      )}
                    </div>

                    <div className="card">
                      <h3 className="card-title"><span>📝</span> Report Conflict</h3>

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

                    <div className="card">
                      <h3 className="card-title"><span>📋</span> My Conflict History</h3>
                      <button
                        className="btn btn-secondary"
                        style={{ marginBottom: "10px", padding: "6px 10px", fontSize: "13px" }}
                        onClick={fetchMyConflicts}
                      >
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
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
