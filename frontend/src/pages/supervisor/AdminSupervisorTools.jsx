import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

function ReviewModal({ title, actionLabel, onSubmit, onClose }) {
  const [note, setNote] = useState("");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form
          style={{ marginTop: "12px", display: "grid", gap: "12px" }}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(note);
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Note</label>
            <textarea className="form-textarea" rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{actionLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminSupervisorTools() {
  const [banner, setBanner] = useState({ type: "", text: "" });

  const [verificationRows, setVerificationRows] = useState([]);
  const [stayRows, setStayRows] = useState([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [stayLoading, setStayLoading] = useState(false);

  const [reviewVerificationTarget, setReviewVerificationTarget] = useState(null);
  const [reviewStayTarget, setReviewStayTarget] = useState(null);
  const [selectedVerificationStudent, setSelectedVerificationStudent] = useState(null);
  const [verificationDocsLoading, setVerificationDocsLoading] = useState(false);
  const [verificationDocs, setVerificationDocs] = useState(null);
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState("");
  const [verificationDocPreviewUrl, setVerificationDocPreviewUrl] = useState("");
  const [verificationDocMimeType, setVerificationDocMimeType] = useState("");

  const [studentIdInput, setStudentIdInput] = useState("");
  const [studentLookup, setStudentLookup] = useState("");
  const [studentLookupRows, setStudentLookupRows] = useState([]);
  const [studentLookupLoading, setStudentLookupLoading] = useState(false);
  const [diagScores, setDiagScores] = useState([]);
  const [diagSummary, setDiagSummary] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const loadVerificationQueue = async () => {
    setVerificationLoading(true);
    try {
      const res = await api.get("/admin/students/verification/pending?page=1&per_page=50");
      setVerificationRows(res.data?.students || []);
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to load pending verifications." });
    } finally {
      setVerificationLoading(false);
    }
  };

  const loadStayRequests = async () => {
    setStayLoading(true);
    try {
      const res = await api.get("/admin/stay-date-requests?status=pending&page=1&per_page=50");
      setStayRows(res.data?.requests || []);
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to load stay-date requests." });
    } finally {
      setStayLoading(false);
    }
  };

  const clearDocPreviews = () => {
    if (profilePhotoPreviewUrl) URL.revokeObjectURL(profilePhotoPreviewUrl);
    if (verificationDocPreviewUrl) URL.revokeObjectURL(verificationDocPreviewUrl);
    setProfilePhotoPreviewUrl("");
    setVerificationDocPreviewUrl("");
    setVerificationDocMimeType("");
  };

  const loadVerificationDocuments = async (student) => {
    setSelectedVerificationStudent(student);
    setVerificationDocsLoading(true);
    clearDocPreviews();

    try {
      const metaRes = await api.get(`/admin/students/${student.student_id}/verification-documents`);
      const payload = metaRes.data || null;
      setVerificationDocs(payload);

      if (payload?.profile_photo?.available) {
        const profileBlobRes = await api.get(
          `/admin/students/${student.student_id}/verification-documents/profile-photo`,
          { responseType: "blob" }
        );
        setProfilePhotoPreviewUrl(URL.createObjectURL(profileBlobRes.data));
      }

      if (payload?.verification_document?.available) {
        const verificationBlobRes = await api.get(
          `/admin/students/${student.student_id}/verification-documents/verification-document`,
          { responseType: "blob" }
        );
        setVerificationDocPreviewUrl(URL.createObjectURL(verificationBlobRes.data));
        setVerificationDocMimeType(verificationBlobRes.data?.type || payload?.verification_document?.mime_type || "");
      }
    } catch (err) {
      setVerificationDocs(null);
      clearDocPreviews();
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to load submitted documents." });
    } finally {
      setVerificationDocsLoading(false);
    }
  };

  const loadDiagnostics = async (studentId) => {
    setDiagLoading(true);
    try {
      const [scoresRes, summaryRes] = await Promise.all([
        api.get(`/admin/students/${studentId}/compatibility/scores?limit=25&include_blocked=true`),
        api.get(`/admin/students/${studentId}/compatibility/summary`),
      ]);
      setDiagScores(scoresRes.data?.scores || []);
      setDiagSummary(summaryRes.data || null);
    } catch (err) {
      setDiagScores([]);
      setDiagSummary(null);
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to load compatibility diagnostics." });
    } finally {
      setDiagLoading(false);
    }
  };

  const lookupStudents = async () => {
    const term = (studentLookup || "").trim();
    if (!term) {
      setStudentLookupRows([]);
      return;
    }

    setStudentLookupLoading(true);
    try {
      const query = new URLSearchParams({ search: term, page: "1", per_page: "10" });
      const res = await api.get(`/admin/students?${query.toString()}`);
      setStudentLookupRows(res.data?.students || []);
    } catch (err) {
      setStudentLookupRows([]);
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to search students." });
    } finally {
      setStudentLookupLoading(false);
    }
  };

  const refreshCompatibility = async () => {
    const studentId = Number(studentIdInput);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      setBanner({ type: "error", text: "Enter a valid student ID first." });
      return;
    }

    try {
      await api.post(`/admin/students/${studentId}/compatibility/refresh`);
      await loadDiagnostics(studentId);
      setBanner({ type: "success", text: "Compatibility scores refreshed for selected student." });
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to refresh compatibility." });
    }
  };

  const submitVerificationReview = async (action, note) => {
    try {
      const reviewedStudentId = reviewVerificationTarget.student_id;
      await api.patch(`/admin/students/${reviewedStudentId}/verification`, { action, note });
      setReviewVerificationTarget(null);
      await loadVerificationQueue();
      if (Number(studentIdInput) === Number(reviewedStudentId)) {
        await loadDiagnostics(reviewedStudentId);
      }
      setBanner({ type: "success", text: `Verification ${action}d successfully.` });
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to review verification." });
    }
  };

  const submitStayReview = async (action, note) => {
    try {
      await api.patch(`/admin/stay-date-requests/${reviewStayTarget.request_id}/review`, { action, admin_note: note });
      setReviewStayTarget(null);
      await loadStayRequests();
      setBanner({ type: "success", text: `Stay-date request ${action}d successfully.` });
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.error || "Failed to review stay-date request." });
    }
  };

  useEffect(() => {
    loadVerificationQueue();
    loadStayRequests();
  }, []);

  useEffect(() => {
    return () => {
      if (profilePhotoPreviewUrl) URL.revokeObjectURL(profilePhotoPreviewUrl);
      if (verificationDocPreviewUrl) URL.revokeObjectURL(verificationDocPreviewUrl);
    };
  }, [profilePhotoPreviewUrl, verificationDocPreviewUrl]);

  return (
    <div className="page-container">
      <Navbar />
      <div className="main-content">
        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "28px", marginBottom: "6px" }}>Admin Supervisor Tools</h1>
            <p style={{ color: "var(--text-muted)", maxWidth: "780px" }}>
              Review verification and stay-date queues, then inspect and refresh compatibility diagnostics by student.
            </p>
          </div>
          <Link to="/admin/dashboard" className="btn btn-secondary" style={{ height: "fit-content" }}>
            Back to Dashboard
          </Link>
        </div>

        {banner.text && (
          <div className={`banner ${banner.type === "success" ? "banner-success" : "banner-error"}`}>
            <span className="banner-icon">{banner.type === "success" ? "✓" : "!"}</span>
            <div>{banner.text}</div>
          </div>
        )}

        <div className="card">
          <div className="table-controls" style={{ marginBottom: "10px" }}>
            <h3 className="card-title" style={{ margin: 0 }}><span>🪪</span> Pending Verification Queue</h3>
            <button className="btn btn-secondary" onClick={loadVerificationQueue}>Refresh</button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student Number</th>
                  <th>Email</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {verificationLoading ? (
                  <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading queue...</td></tr>
                ) : verificationRows.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>No pending verification submissions.</td></tr>
                ) : verificationRows.map((row) => (
                  <tr key={row.student_id}>
                    <td>{row.name}</td>
                    <td>{row.student_number}</td>
                    <td>{row.email}</td>
                    <td>{row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => loadVerificationDocuments(row)}>View Docs</button>
                        <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => setReviewVerificationTarget({ ...row, action: "approve" })}>Approve</button>
                        <button className="btn btn-danger" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => setReviewVerificationTarget({ ...row, action: "reject" })}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(selectedVerificationStudent || verificationDocsLoading) && (
            <div style={{ marginTop: "14px", borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
              <h4 style={{ marginBottom: "10px" }}>
                Submitted Documents: {selectedVerificationStudent?.name || "Selected Student"}
              </h4>

              {verificationDocsLoading ? (
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading submitted documents...</p>
              ) : (
                <>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "10px" }}>
                    Student Number: {verificationDocs?.student_number || "-"} | Verification Status: {verificationDocs?.verification_status || "pending"}
                  </p>

                  <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: 0 }}>
                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "10px", padding: "10px" }}>
                      <h5 style={{ marginBottom: "8px" }}>Profile Photo</h5>
                      {profilePhotoPreviewUrl ? (
                        <img
                          src={profilePhotoPreviewUrl}
                          alt="Submitted profile"
                          style={{ width: "100%", maxHeight: "280px", objectFit: "contain", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                        />
                      ) : (
                        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No profile photo submitted.</p>
                      )}
                    </div>

                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "10px", padding: "10px" }}>
                      <h5 style={{ marginBottom: "8px" }}>Verification Document</h5>
                      {verificationDocPreviewUrl ? (
                        verificationDocMimeType.includes("pdf") ? (
                          <iframe
                            src={verificationDocPreviewUrl}
                            title="Verification document preview"
                            style={{ width: "100%", height: "320px", border: "1px solid var(--border-color)", borderRadius: "8px" }}
                          />
                        ) : (
                          <img
                            src={verificationDocPreviewUrl}
                            alt="Verification document"
                            style={{ width: "100%", maxHeight: "280px", objectFit: "contain", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                          />
                        )
                      ) : (
                        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No verification document submitted.</p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: "6px 10px", fontSize: "12px" }}
                      onClick={() => setReviewVerificationTarget({ ...selectedVerificationStudent, action: "approve" })}
                    >
                      Approve Selected Student
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: "6px 10px", fontSize: "12px" }}
                      onClick={() => setReviewVerificationTarget({ ...selectedVerificationStudent, action: "reject" })}
                    >
                      Reject Selected Student
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="table-controls" style={{ marginBottom: "10px" }}>
            <h3 className="card-title" style={{ margin: 0 }}><span>🗓️</span> Pending Stay-Date Requests</h3>
            <button className="btn btn-secondary" onClick={loadStayRequests}>Refresh</button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Student</th>
                  <th>Date Range</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stayLoading ? (
                  <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading requests...</td></tr>
                ) : stayRows.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>No pending stay-date requests.</td></tr>
                ) : stayRows.map((row) => (
                  <tr key={row.request_id}>
                    <td>#{row.request_id}</td>
                    <td>{row.student_name} ({row.student_number})</td>
                    <td>{row.requested_start} - {row.requested_end}</td>
                    <td>{row.reason || "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => setReviewStayTarget({ ...row, action: "approve" })}>Approve</button>
                        <button className="btn btn-danger" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => setReviewStayTarget({ ...row, action: "reject" })}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title"><span>📈</span> Compatibility Diagnostics</h3>
          <div className="form-group" style={{ marginBottom: "12px" }}>
            <label className="form-label">Find Student by Name, Student Number, or Email</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                className="form-input"
                style={{ maxWidth: "360px" }}
                placeholder="Search students..."
                value={studentLookup}
                onChange={(e) => setStudentLookup(e.target.value)}
              />
              <button className="btn btn-secondary" onClick={lookupStudents}>Search</button>
            </div>

            {studentLookupLoading && (
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "8px" }}>Searching students...</p>
            )}

            {!studentLookupLoading && studentLookupRows.length > 0 && (
              <div style={{ marginTop: "8px", display: "grid", gap: "6px" }}>
                {studentLookupRows.map((row) => (
                  <button
                    key={row.student_id}
                    type="button"
                    className="btn btn-secondary"
                    style={{ justifyContent: "space-between", textAlign: "left" }}
                    onClick={() => {
                      setStudentIdInput(String(row.student_id));
                      setStudentLookupRows([]);
                      setStudentLookup("");
                      loadDiagnostics(row.student_id);
                    }}
                  >
                    <span>{row.name} ({row.student_number})</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>ID {row.student_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            <input
              className="form-input"
              style={{ maxWidth: "260px" }}
              placeholder="Enter student ID"
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value)}
            />
            <button className="btn btn-secondary" onClick={() => {
              const sid = Number(studentIdInput);
              if (Number.isInteger(sid) && sid > 0) loadDiagnostics(sid);
              else setBanner({ type: "error", text: "Enter a valid student ID first." });
            }}>
              Load Diagnostics
            </button>
            <button className="btn btn-primary" onClick={refreshCompatibility}>Refresh Scores</button>
          </div>

          {diagSummary && (
            <div className="stats-panel" style={{ marginBottom: "12px" }}>
              <div className="stat-card stat-card-indigo">
                <div className="stat-value">{diagSummary.total_candidates}</div>
                <div className="stat-label">Total candidates</div>
              </div>
              <div className="stat-card stat-card-rose">
                <div className="stat-value">{diagSummary.blocked_candidates}</div>
                <div className="stat-label">Hard blocked</div>
              </div>
              <div className="stat-card stat-card-teal">
                <div className="stat-value">{diagSummary.eligible_candidates}</div>
                <div className="stat-label">Eligible</div>
              </div>
            </div>
          )}

          {diagSummary?.by_reason && (
            <div style={{ marginBottom: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {Object.entries(diagSummary.by_reason).map(([reason, count]) => (
                <span key={reason} className="badge badge-warning">{reason}: {count}</span>
              ))}
            </div>
          )}

          {diagSummary && (
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "10px" }}>
              Student: <strong style={{ color: "var(--text-main)" }}>{diagSummary.student_name || diagSummary.student_id}</strong> | Eligibility: {diagSummary.is_matching_eligible ? "ready" : "not ready"}
            </p>
          )}

          {diagSummary && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
              <span className={`badge ${diagSummary.email_verified ? "badge-success" : "badge-warning"}`}>
                Email {diagSummary.email_verified ? "verified" : "not verified"}
              </span>
              <span className={`badge ${diagSummary.verification_status === "approved" ? "badge-success" : diagSummary.verification_status === "rejected" ? "badge-error" : "badge-warning"}`}>
                Verification: {diagSummary.verification_status || "unknown"}
              </span>
              <button
                className="btn btn-primary"
                style={{ padding: "6px 10px", fontSize: "12px" }}
                onClick={() => setReviewVerificationTarget({
                  student_id: diagSummary.student_id,
                  name: diagSummary.student_name,
                  action: "approve",
                })}
              >
                Approve Verification
              </button>
              <button
                className="btn btn-danger"
                style={{ padding: "6px 10px", fontSize: "12px" }}
                onClick={() => setReviewVerificationTarget({
                  student_id: diagSummary.student_id,
                  name: diagSummary.student_name,
                  action: "reject",
                })}
              >
                Reject Verification
              </button>
            </div>
          )}

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Candidate ID</th>
                  <th>Score</th>
                  <th>Blocked</th>
                  <th>Reason</th>
                  <th>Computed At</th>
                </tr>
              </thead>
              <tbody>
                {diagLoading ? (
                  <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading diagnostics...</td></tr>
                ) : diagScores.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>No compatibility diagnostics loaded.</td></tr>
                ) : diagScores.map((row) => (
                  <tr key={`${row.candidate_id}-${row.computed_at || "na"}`}>
                    <td>{row.candidate_id}</td>
                    <td>{row.score}</td>
                    <td>{row.is_hard_blocked ? "Yes" : "No"}</td>
                    <td>{row.block_reason || "-"}</td>
                    <td>{row.computed_at ? new Date(row.computed_at).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {reviewVerificationTarget && (
        <ReviewModal
          title={`${reviewVerificationTarget.action === "approve" ? "Approve" : "Reject"} Verification`}
          actionLabel={reviewVerificationTarget.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
          onSubmit={(note) => submitVerificationReview(reviewVerificationTarget.action, note)}
          onClose={() => setReviewVerificationTarget(null)}
        />
      )}

      {reviewStayTarget && (
        <ReviewModal
          title={`${reviewStayTarget.action === "approve" ? "Approve" : "Reject"} Stay-Date Request`}
          actionLabel={reviewStayTarget.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
          onSubmit={(note) => submitStayReview(reviewStayTarget.action, note)}
          onClose={() => setReviewStayTarget(null)}
        />
      )}
    </div>
  );
}
