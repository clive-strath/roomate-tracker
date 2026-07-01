import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

const WAKE_LABELS  = { 1:"Very Early (5AM)", 2:"Early (6:30AM)", 3:"Normal (7:30AM)", 4:"Late (9AM)",  5:"Very Late (10AM+)" };
const SLEEP_LABELS = { 1:"Very Early (9PM)", 2:"Early (10PM)",   3:"Normal (11PM)",   4:"Late (12AM)", 5:"Very Late (1AM+)" };
const NOISE_LABELS = { 1:"Silence needed",   2:"Mostly quiet",   3:"Some noise ok",   4:"Fairly loud", 5:"Loud is fine"     };
const CLEAN_LABELS = { 1:"Very messy",       2:"Somewhat messy", 3:"Average",         4:"Fairly tidy", 5:"Obsessively tidy" };
const GUEST_LABELS = { 1:"No guests ever",   2:"Rarely",         3:"Sometimes",       4:"Often",       5:"Guests daily"     };

export default function PreferenceForm() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    wake_time:         3,
    sleep_time:        3,
    noise_tolerance:   3,
    cleanliness_level: 3,
    guest_policy:      3,
    bathroom_schedule: 3,
    study_habits:      "flexible",
    additional_notes:  "",
  });

  const [isEdit,   setIsEdit]   = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [message,  setMessage]  = useState({ type:"", text:"" });

  // Check if preferences already exist
  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.get(`/preferences/${user.student_id}`);
        if (res.data.submitted && res.data.preferences) {
          setForm(res.data.preferences);
          setIsEdit(true);
          setIsLocked(res.data.preferences.is_locked);
        }
      } catch {
        // No preferences yet — stay in create mode
      } finally {
        setLoading(false);
      }
    };
    if (user?.student_id) check();
  }, [user]);

  const handleSlider = (e) => {
    setForm({ ...form, [e.target.name]: parseInt(e.target.value) });
  };

  const handleRadio = (e) => {
    // For bathroom_schedule, it's stored as int in backend, convert if needed
    const val = e.target.name === "bathroom_schedule" ? parseInt(e.target.value) : e.target.value;
    setForm({ ...form, [e.target.name]: val });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type:"", text:"" });
    try {
      if (isEdit) {
        await api.put("/preferences/", form);
        setMessage({ type:"success", text:"Compatibility Profile Updated ✓" });
      } else {
        await api.post("/preferences/", form);
        setMessage({ type:"success", text:"Compatibility Profile Completed ✓" });
        setIsEdit(true);
      }
      setTimeout(() => navigate("/student/dashboard"), 1500);
    } catch (err) {
      const errors = err.response?.data?.errors || [err.response?.data?.error || "Submission failed"];
      setMessage({ type:"error", text: Array.isArray(errors) ? errors.join(", ") : errors });
    } finally {
      setSaving(false);
    }
  };

  // Derive display tags for the Live Lifestyle Snapshot
  const getSleepTag = () => {
    if (form.sleep_time >= 4) return { text: "Night Owl", icon: "🌙" };
    if (form.sleep_time <= 2) return { text: "Early Sleeper", icon: "🌅" };
    return { text: "Normal Sleeper", icon: "🕒" };
  };

  const getStudyTag = () => {
    if (form.study_habits === "quiet") return { text: "Quiet Learner", icon: "📚" };
    if (form.study_habits === "group") return { text: "Group Learner", icon: "👥" };
    return { text: "Flexible Study", icon: "📚" };
  };

  const getCleanTag = () => {
    if (form.cleanliness_level >= 4) return { text: "Highly Organized", icon: "🧹" };
    if (form.cleanliness_level <= 2) return { text: "Relaxed Cleanliness", icon: "📦" };
    return { text: "Moderately Tidy", icon: "🧹" };
  };

  const getGuestTag = () => {
    if (form.guest_policy <= 2) return { text: "Rare Guests", icon: "🚪" };
    if (form.guest_policy >= 4) return { text: "Frequent Guests", icon: "🚪" };
    return { text: "Moderate Guests", icon: "🚪" };
  };

  const getBathroomTag = () => {
    if (String(form.bathroom_schedule) === "1") return { text: "Morning Schedule", icon: "🚿" };
    if (String(form.bathroom_schedule) === "2") return { text: "Evening Schedule", icon: "🚿" };
    return { text: "Flexible Schedule", icon: "🚿" };
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="main-content" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Loading compatibility profile setup...</p>
        </div>
      </div>
    );
  }

  const sleepTag = getSleepTag();
  const studyTag = getStudyTag();
  const cleanTag = getCleanTag();
  const guestTag = getGuestTag();
  const bathroomTag = getBathroomTag();

  return (
    <div className="page-container">
      <Navbar />
      <div className="main-content">
        <div style={{ marginBottom: "28px" }}>
          <span className="auth-step">Step 2 of 2: Lifestyle Matching</span>
          <h1 style={{ fontSize: "32px", marginBottom: "8px" }}>Build Your Compatibility Profile</h1>
          <p style={{ color: "var(--text-muted)" }}>
            Your lifestyle choices determine your roommate compatibility. Answer honestly to find your perfect hostel match.
          </p>
        </div>

        {isLocked && (
          <div className="banner banner-warning">
            <span className="banner-icon">🔒</span>
            <div>Preferences are locked for this semester and cannot be modified.</div>
          </div>
        )}

        {message.text && (
          <div className={`banner ${message.type === "success" ? "banner-success" : "banner-error"}`}>
            <span className="banner-icon">{message.type === "success" ? "✓" : "⚠️"}</span>
            <div>{message.text}</div>
          </div>
        )}

        <div className="dashboard-grid">
          {/* Left Column: Form */}
          <div>
            <form onSubmit={handleSubmit}>
              {/* Sleep Schedule Group */}
              <fieldset className="profile-section-fieldset">
                <legend className="profile-section-legend">🌅 Sleep Schedule</legend>
                
                {/* Wake Time */}
                <div className="slider-group">
                  <div className="slider-label-row">
                    <label className="slider-question">🌅 When does your day usually begin?</label>
                    <span className="slider-value-indicator">{form.wake_time}/5</span>
                  </div>
                  <div className="slider-input-container">
                    <input
                      type="range"
                      name="wake_time"
                      min="1"
                      max="5"
                      value={form.wake_time}
                      onChange={handleSlider}
                      disabled={isLocked}
                      className="slider-input"
                    />
                  </div>
                  <p className="slider-desc">{WAKE_LABELS[form.wake_time]}</p>
                </div>

                {/* Sleep Time */}
                <div className="slider-group">
                  <div className="slider-label-row">
                    <label className="slider-question">🌙 When do you usually go to sleep?</label>
                    <span className="slider-value-indicator">{form.sleep_time}/5</span>
                  </div>
                  <div className="slider-input-container">
                    <input
                      type="range"
                      name="sleep_time"
                      min="1"
                      max="5"
                      value={form.sleep_time}
                      onChange={handleSlider}
                      disabled={isLocked}
                      className="slider-input"
                    />
                  </div>
                  <p className="slider-desc">{SLEEP_LABELS[form.sleep_time]}</p>
                </div>
              </fieldset>

              {/* Living Habits Group */}
              <fieldset className="profile-section-fieldset">
                <legend className="profile-section-legend">🏠 Living Habits</legend>

                {/* Noise Tolerance */}
                <div className="slider-group">
                  <div className="slider-label-row">
                    <label className="slider-question">🔊 How much background noise can you comfortably live with?</label>
                    <span className="slider-value-indicator">{form.noise_tolerance}/5</span>
                  </div>
                  <div className="slider-input-container">
                    <input
                      type="range"
                      name="noise_tolerance"
                      min="1"
                      max="5"
                      value={form.noise_tolerance}
                      onChange={handleSlider}
                      disabled={isLocked}
                      className="slider-input"
                    />
                  </div>
                  <p className="slider-desc">{NOISE_LABELS[form.noise_tolerance]}</p>
                </div>

                {/* Cleanliness Level */}
                <div className="slider-group">
                  <div className="slider-label-row">
                    <label className="slider-question">🧹 How tidy do you prefer your living space?</label>
                    <span className="slider-value-indicator">{form.cleanliness_level}/5</span>
                  </div>
                  <div className="slider-input-container">
                    <input
                      type="range"
                      name="cleanliness_level"
                      min="1"
                      max="5"
                      value={form.cleanliness_level}
                      onChange={handleSlider}
                      disabled={isLocked}
                      className="slider-input"
                    />
                  </div>
                  <p className="slider-desc">{CLEAN_LABELS[form.cleanliness_level]}</p>
                </div>

                {/* Guest Policy */}
                <div className="slider-group">
                  <div className="slider-label-row">
                    <label className="slider-question">🚪 How often are guests welcome in your room?</label>
                    <span className="slider-value-indicator">{form.guest_policy}/5</span>
                  </div>
                  <div className="slider-input-container">
                    <input
                      type="range"
                      name="guest_policy"
                      min="1"
                      max="5"
                      value={form.guest_policy}
                      onChange={handleSlider}
                      disabled={isLocked}
                      className="slider-input"
                    />
                  </div>
                  <p className="slider-desc">{GUEST_LABELS[form.guest_policy]}</p>
                </div>
              </fieldset>

              {/* Bathroom Schedule */}
              <fieldset className="profile-section-fieldset">
                <legend className="profile-section-legend">🚿 Bathroom Schedule</legend>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: "12px" }}>
                    🚿 When do you usually use shared facilities?
                  </label>
                  <div className="radio-cards-container">
                    <label className={`radio-card-label ${String(form.bathroom_schedule) === "1" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="bathroom_schedule"
                        value="1"
                        checked={String(form.bathroom_schedule) === "1"}
                        onChange={handleRadio}
                        disabled={isLocked}
                        className="radio-card-input"
                      />
                      <span>Morning (5AM – 8AM)</span>
                    </label>
                    <label className={`radio-card-label ${String(form.bathroom_schedule) === "2" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="bathroom_schedule"
                        value="2"
                        checked={String(form.bathroom_schedule) === "2"}
                        onChange={handleRadio}
                        disabled={isLocked}
                        className="radio-card-input"
                      />
                      <span>Evening (6PM – 9PM)</span>
                    </label>
                    <label className={`radio-card-label ${String(form.bathroom_schedule) === "3" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="bathroom_schedule"
                        value="3"
                        checked={String(form.bathroom_schedule) === "3"}
                        onChange={handleRadio}
                        disabled={isLocked}
                        className="radio-card-input"
                      />
                      <span>Flexible (any time)</span>
                    </label>
                  </div>
                </div>
              </fieldset>

              {/* Study Habits */}
              <fieldset className="profile-section-fieldset">
                <legend className="profile-section-legend">📚 Study Habits</legend>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: "12px" }}>
                    📚 How do you usually study?
                  </label>
                  <div className="radio-cards-container">
                    <label className={`radio-card-label ${form.study_habits === "quiet" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="study_habits"
                        value="quiet"
                        checked={form.study_habits === "quiet"}
                        onChange={handleRadio}
                        disabled={isLocked}
                        className="radio-card-input"
                      />
                      <span>I study in silence and need a quiet room</span>
                    </label>
                    <label className={`radio-card-label ${form.study_habits === "group" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="study_habits"
                        value="group"
                        checked={form.study_habits === "group"}
                        onChange={handleRadio}
                        disabled={isLocked}
                        className="radio-card-input"
                      />
                      <span>I often study with friends or in groups</span>
                    </label>
                    <label className={`radio-card-label ${form.study_habits === "flexible" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="study_habits"
                        value="flexible"
                        checked={form.study_habits === "flexible"}
                        onChange={handleRadio}
                        disabled={isLocked}
                        className="radio-card-input"
                      />
                      <span>I can adapt to different study environments</span>
                    </label>
                  </div>
                </div>
              </fieldset>

              {/* Additional Notes */}
              <div className="card">
                <h3 className="card-title">📝 Additional Profile Notes</h3>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Anything else the system or admin should know about your living preferences...
                  </label>
                  <textarea
                    name="additional_notes"
                    value={form.additional_notes || ""}
                    onChange={e => setForm({ ...form, additional_notes: e.target.value })}
                    disabled={isLocked}
                    placeholder="e.g. Allergy details, roommate requests, block preferences..."
                    rows={4}
                    className="form-textarea"
                  />
                </div>
              </div>

              {!isLocked && (
                <div style={{ display: "flex", gap: "16px", marginTop: "24px" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => navigate("/student/dashboard")}>
                    Back to Dashboard
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                    {saving ? "Saving Profile..." : isEdit ? "Update Compatibility Profile" : "Complete Compatibility Profile"}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Live Lifestyle Snapshot */}
          <div>
            <div className="snapshot-container">
              <h3 className="snapshot-title">
                <span>⚡</span> Your Lifestyle Snapshot
              </h3>
              <p style={{ fontSize: "12px", color: "var(--accent-teal-text)", marginBottom: "16px", opacity: 0.85 }}>
                Here is a live summary of how others will see you based on your answers:
              </p>
              <div className="snapshot-tag-list">
                <div className="snapshot-tag">
                  <span>{sleepTag.icon}</span>
                  <span>{sleepTag.text}</span>
                </div>
                <div className="snapshot-tag">
                  <span>{studyTag.icon}</span>
                  <span>{studyTag.text}</span>
                </div>
                <div className="snapshot-tag">
                  <span>{cleanTag.icon}</span>
                  <span>{cleanTag.text}</span>
                </div>
                <div className="snapshot-tag">
                  <span>{guestTag.icon}</span>
                  <span>{guestTag.text}</span>
                </div>
                <div className="snapshot-tag">
                  <span>{bathroomTag.icon}</span>
                  <span>{bathroomTag.text}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
