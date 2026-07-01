import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

const STATUS_OPTIONS = ["open", "in_mediation", "resolved", "escalated"];

export default function RADashboard() {
  const { user } = useAuth();

  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    status: "in_mediation",
    mediation_notes: "",
    actions_taken: "",
    resolution_notes: "",
    escalation_notes: "",
  });

  const fetchConflicts = async () => {
    setLoading(true);
    setError("");
    try {
      const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await api.get(`/ra/conflicts${query}`);
      setConflicts(res.data?.conflicts || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load conflict queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, [statusFilter]);

  const openCount = useMemo(() => conflicts.filter((c) => c.status === "open").length, [conflicts]);
  const mediationCount = useMemo(() => conflicts.filter((c) => c.status === "in_mediation").length, [conflicts]);
  const escalatedCount = useMemo(() => conflicts.filter((c) => c.status === "escalated").length, [conflicts]);

  const startEdit = (conflict) => {
    setEditId(conflict.conflict_id);
    setForm({
      status: conflict.status === "open" ? "in_mediation" : conflict.status,
      mediation_notes: conflict.mediation_notes || "",
      actions_taken: conflict.actions_taken || "",
      resolution_notes: conflict.resolution_notes || "",
      escalation_notes: conflict.escalation_notes || "",
    });
    setSuccess("");
    setError("");
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm({
      status: "in_mediation",
      mediation_notes: "",
      actions_taken: "",
      resolution_notes: "",
      escalation_notes: "",
    });
  };

  const submitUpdate = async (conflictId) => {
    setError("");
    setSuccess("");
    try {
      await api.put(`/conflicts/${conflictId}`, form);
      setSuccess("Conflict updated successfully.");
      cancelEdit();
      fetchConflicts();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update conflict");
    }
  };

  return (
    <div className="page-container">
      <Navbar />
      <div className="main-content">
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", marginBottom: "4px" }}>Resident Advisor Dashboard</h1>
          <p style={{ color: "var(--text-muted)" }}>
            Assigned Block: <strong style={{ color: "var(--text-main)" }}>Block {user?.hostel_block || "Unassigned"}</strong>
          </p>
        </div>

        {success && (
          <div className="banner banner-success">
            <span className="banner-icon">✓</span>
            <div>{success}</div>
          </div>
        )}

        {error && (
          <div className="banner banner-error">
            <span className="banner-icon">!</span>
            <div>{error}</div>
          </div>
        )}

        <div className="stats-panel" style={{ marginBottom: "18px" }}>
          <div className="stat-card stat-card-indigo">
            <div className="stat-value">{openCount}</div>
            <div className="stat-label">Open</div>
          </div>
          <div className="stat-card stat-card-teal">
            <div className="stat-value">{mediationCount}</div>
            <div className="stat-label">In Mediation</div>
          </div>
          <div className="stat-card stat-card-rose">
            <div className="stat-value">{escalatedCount}</div>
            <div className="stat-label">Escalated</div>
          </div>
        </div>

        <div className="card">
          <div className="table-controls" style={{ marginBottom: "14px" }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <span>⚠️</span> Conflict Queue
            </h3>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-select"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ")}
                  </option>
                ))}
                <option value="disabled">disabled</option>
              </select>
              <button className="btn btn-secondary" onClick={fetchConflicts} style={{ padding: "8px 10px", fontSize: "13px" }}>
                Refresh
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Reported</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                      Loading conflicts...
                    </td>
                  </tr>
                ) : conflicts.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                      No conflicts currently in your block.
                    </td>
                  </tr>
                ) : (
                  conflicts.map((conflict) => (
                    <tr key={conflict.conflict_id}>
                      <td>#{conflict.conflict_id}</td>
                      <td>{conflict.room_number || "-"}</td>
                      <td style={{ textTransform: "capitalize" }}>{String(conflict.conflict_type || "").replace("_", " ")}</td>
                      <td>{conflict.severity}</td>
                      <td>
                        <span className="badge badge-warning" style={{ textTransform: "capitalize" }}>
                          {String(conflict.status || "").replace("_", " ")}
                        </span>
                      </td>
                      <td>{conflict.created_at ? new Date(conflict.created_at).toLocaleDateString() : "-"}</td>
                      <td>
                        <button
                          onClick={() => startEdit(conflict)}
                          className="btn btn-primary"
                          style={{ padding: "5px 10px", fontSize: "12px", borderRadius: "6px" }}
                          disabled={conflict.status === "resolved" || conflict.status === "disabled"}
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {editId && (
          <div className="card">
            <h3 className="card-title">
              <span>🛠️</span> Update Conflict #{editId}
            </h3>
            <div style={{ display: "grid", gap: "12px" }}>
              <div className="form-group">
                <label>New Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="form-select"
                >
                  <option value="in_mediation">in mediation</option>
                  <option value="resolved">resolved</option>
                  <option value="escalated">escalated</option>
                </select>
              </div>

              <div className="form-group">
                <label>Mediation Notes</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.mediation_notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, mediation_notes: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Actions Taken</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.actions_taken}
                  onChange={(e) => setForm((prev) => ({ ...prev, actions_taken: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Resolution Notes (required for resolved)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.resolution_notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, resolution_notes: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Escalation Notes (required for escalated)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.escalation_notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, escalation_notes: e.target.value }))}
                />
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-primary" onClick={() => submitUpdate(editId)}>
                  Save Update
                </button>
                <button className="btn btn-secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <h3 className="card-title">
            <span>📘</span> RA Quick Guide
          </h3>
          <ul style={{ fontSize: "13px", color: "var(--text-main)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <li>Review new open conflicts daily.</li>
            <li>Move valid cases into mediation and track actions taken.</li>
            <li>Resolve when settled; escalate complex cases to admin.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
