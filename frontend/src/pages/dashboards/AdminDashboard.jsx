import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function AdminDashboard() {
  const { role } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");

  const [data, setData] = useState({ students: [], total: 0, submitted: 0, not_submitted: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsPerPage] = useState(20);
  const [studentsTotalPages, setStudentsTotalPages] = useState(1);
  const [exportingAssignmentsSummaryCsv, setExportingAssignmentsSummaryCsv] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  // Form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "admin", // default to admin
    hostelBlock: "",
    password: "",
    confirmPassword: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Allocation workflow state
  const [semester, setSemester] = useState(`${new Date().getFullYear()}-S1`);
  const [allocLoading, setAllocLoading] = useState(false);
  const [allocProcessing, setAllocProcessing] = useState(false);
  const [allocError, setAllocError] = useState("");
  const [allocSuccess, setAllocSuccess] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [singles, setSingles] = useState([]);
  const [studentDirectory, setStudentDirectory] = useState({});
  const [previewMeta, setPreviewMeta] = useState({
    rooms_required: 0,
    rooms_available: 0,
    sufficient_rooms: true,
    waiting_unmatched_student_ids: [],
  });
  const [confirmedAssignments, setConfirmedAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [assignmentsPerPage] = useState(20);
  const [assignmentsTotalPages, setAssignmentsTotalPages] = useState(1);
  const [assignmentsTotal, setAssignmentsTotal] = useState(0);
  const [assignmentFilters, setAssignmentFilters] = useState({
    status: "",
    hostel_block: "",
    search: "",
    sort_by: "created_at",
    sort_order: "desc",
  });
  const [undoAssignmentLoadingId, setUndoAssignmentLoadingId] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [conflictFilters, setConflictFilters] = useState({
    status: "",
    severity: "",
    type: "",
    from_date: "",
    to_date: "",
    sort_by: "created_at",
    sort_order: "desc",
  });
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflictsPage, setConflictsPage] = useState(1);
  const [conflictsPerPage] = useState(20);
  const [conflictsTotalPages, setConflictsTotalPages] = useState(1);
  const [conflictsTotal, setConflictsTotal] = useState(0);
  const [conflictError, setConflictError] = useState("");
  const [conflictUpdateOpen, setConflictUpdateOpen] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [conflictResolutionNotes, setConflictResolutionNotes] = useState("");
  const [conflictUpdateSubmitting, setConflictUpdateSubmitting] = useState(false);

  // Breakdown modal
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);

  // Override modal
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overrideReplacementId, setOverrideReplacementId] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  // Supervisor workflow state (moved from Admin Supervisor Tools)
  const [verificationRows, setVerificationRows] = useState([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [reviewVerificationTarget, setReviewVerificationTarget] = useState(null);
  const [verificationReviewNote, setVerificationReviewNote] = useState("");
  const [selectedVerificationStudent, setSelectedVerificationStudent] = useState(null);
  const [verificationDocsLoading, setVerificationDocsLoading] = useState(false);
  const [verificationDocs, setVerificationDocs] = useState(null);
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState("");
  const [verificationDocPreviewUrl, setVerificationDocPreviewUrl] = useState("");
  const [verificationDocMimeType, setVerificationDocMimeType] = useState("");

  const [stayReviewRows, setStayReviewRows] = useState([]);
  const [stayReviewLoading, setStayReviewLoading] = useState(false);
  const [reviewStayTarget, setReviewStayTarget] = useState(null);
  const [stayReviewNote, setStayReviewNote] = useState("");

  const [studentIdInput, setStudentIdInput] = useState("");
  const [studentLookup, setStudentLookup] = useState("");
  const [studentLookupRows, setStudentLookupRows] = useState([]);
  const [studentLookupLoading, setStudentLookupLoading] = useState(false);
  const [diagScores, setDiagScores] = useState([]);
  const [diagSummary, setDiagSummary] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const clearAllocationBanners = () => {
    setAllocError("");
    setAllocSuccess("");
  };

  const formatClassification = (isFlagged) => (isFlagged ? "Flagged" : "Suggested");

  const toSuggestionRow = (pair) => ({
    row_id: `${pair.student_id_1}-${pair.student_id_2}`,
    student_id_1: pair.student_id_1,
    student_id_2: pair.student_id_2,
    student_1_name: pair.student_1_name,
    student_2_name: pair.student_2_name,
    student_1_gender: pair.student_1_gender,
    student_2_gender: pair.student_2_gender,
    student_1_number: pair.student_1_number,
    student_2_number: pair.student_2_number,
    student_1_year: pair.student_1_year,
    student_2_year: pair.student_2_year,
    score: pair.score,
    breakdown: pair.breakdown,
    is_flagged: pair.is_flagged,
    joins_existing_room: !!pair.joins_existing_room,
    classification: formatClassification(pair.is_flagged),
    status: "suggested",
    room_assignment_status: "Pending approval",
  });

  const addSingleIfMissing = (nextSingles, studentId) => {
    if (!studentDirectory[studentId]) return;
    if (nextSingles.some((s) => s.student_id === studentId)) return;

    const info = studentDirectory[studentId];
    nextSingles.push({
      student_id: studentId,
      name: info.name,
      gender: info.gender,
      student_number: info.student_number,
      year: info.year,
      status: "suggested",
    });
  };

  const getOverrideCandidates = (targetRow) => {
    const candidateMap = new Map();

    suggestions.forEach((row) => {
      if (row.status !== "suggested") return;
      if (row.row_id === targetRow.row_id) return;

      [row.student_id_1, row.student_id_2].forEach((sid) => {
        if (sid !== targetRow.student_id_1) candidateMap.set(sid, studentDirectory[sid]);
      });
    });

    singles.forEach((single) => {
      if (single.status !== "suggested") return;
      if (single.student_id !== targetRow.student_id_1) {
        candidateMap.set(single.student_id, studentDirectory[single.student_id]);
      }
    });

    return Array.from(candidateMap.entries())
      .filter(([, info]) => !!info)
      .map(([studentId, info]) => ({
        student_id: studentId,
        name: info.name,
        gender: info.gender,
        student_number: info.student_number,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const refreshPreviewMeta = (nextSuggestions, nextSingles) => {
    const requiredRooms =
      nextSuggestions.filter((row) => row.status === "suggested" && !row.joins_existing_room).length +
      nextSingles.filter((s) => s.status === "suggested").length;

    setPreviewMeta((prev) => ({
      ...prev,
      rooms_required: requiredRooms,
      sufficient_rooms: prev.rooms_available >= requiredRooms,
    }));
  };

  const handleGenerateSuggestions = async () => {
    clearAllocationBanners();
    setAllocLoading(true);

    try {
      const res = await api.get(`/admin/allocation/preview?semester=${encodeURIComponent(semester)}`);
      const preview = res.data;

      const mappedSuggestions = (preview.matched_pairs || []).map(toSuggestionRow);
      const mappedSingles = (preview.unmatched_students || []).map((student) => ({
        ...student,
        status: "suggested",
      }));

      const directory = {};
      mappedSuggestions.forEach((row) => {
        directory[row.student_id_1] = {
          name: row.student_1_name,
          gender: row.student_1_gender,
          student_number: row.student_1_number,
          year: row.student_1_year,
        };
        directory[row.student_id_2] = {
          name: row.student_2_name,
          gender: row.student_2_gender,
          student_number: row.student_2_number,
          year: row.student_2_year,
        };
      });
      mappedSingles.forEach((student) => {
        directory[student.student_id] = {
          name: student.name,
          gender: student.gender,
          student_number: student.student_number,
          year: student.year,
        };
      });

      setStudentDirectory(directory);
      setSuggestions(mappedSuggestions);
      setSingles(mappedSingles);
      setPreviewMeta({
        rooms_required: preview.rooms_required || 0,
        rooms_available: preview.rooms_available || 0,
        sufficient_rooms: !!preview.sufficient_rooms,
        waiting_unmatched_student_ids: preview.waiting_unmatched_student_ids || [],
      });
      setAllocSuccess("Allocation suggestions generated. Review and approve desired matches.");
    } catch (err) {
      setSuggestions([]);
      setSingles([]);
      setStudentDirectory({});
      setPreviewMeta((prev) => ({
        ...prev,
        rooms_required: 0,
        sufficient_rooms: prev.rooms_available >= 0,
        waiting_unmatched_student_ids: [],
      }));
      setAllocError(err.response?.data?.error || "Failed to generate allocation suggestions.");
    } finally {
      setAllocLoading(false);
    }
  };

  const handleOpenBreakdown = (row) => {
    setSelectedBreakdown(row);
    setBreakdownOpen(true);
  };

  const handleCloseBreakdown = () => {
    setBreakdownOpen(false);
    setSelectedBreakdown(null);
  };

  const handleOpenOverride = (row) => {
    setOverrideTarget(row);
    setOverrideReplacementId("");
    setOverrideOpen(true);
  };

  const handleCloseOverride = () => {
    setOverrideOpen(false);
    setOverrideTarget(null);
    setOverrideReplacementId("");
  };

  const handleSubmitOverride = async (e) => {
    e.preventDefault();
    if (!overrideTarget || !overrideReplacementId) return;

    clearAllocationBanners();
    setOverrideSubmitting(true);

    try {
      const replacementId = Number(overrideReplacementId);
      const res = await api.post("/admin/allocation/override", {
        semester,
        student_id_1: overrideTarget.student_id_1,
        student_id_2: replacementId,
      });

      const overrideResult = res.data;

      const nextSuggestions = [...suggestions];
      const nextSingles = [...singles];

      const targetIdx = nextSuggestions.findIndex((row) => row.row_id === overrideTarget.row_id);
      if (targetIdx === -1) {
        throw new Error("Target suggestion no longer exists.");
      }

      const oldPartnerId = nextSuggestions[targetIdx].student_id_2;

      // If replacement student is currently in another pair, remove that pair and free the displaced partner.
      const replacementPairIdx = nextSuggestions.findIndex(
        (row, idx) =>
          idx !== targetIdx &&
          row.status === "suggested" &&
          (row.student_id_1 === replacementId || row.student_id_2 === replacementId)
      );
      if (replacementPairIdx !== -1) {
        const replacementPair = nextSuggestions[replacementPairIdx];
        const displacedId = replacementPair.student_id_1 === replacementId
          ? replacementPair.student_id_2
          : replacementPair.student_id_1;

        addSingleIfMissing(nextSingles, displacedId);
        nextSuggestions.splice(replacementPairIdx, 1);
      }

      // Replacement student should not remain in singles.
      const replacementSingleIdx = nextSingles.findIndex((s) => s.student_id === replacementId);
      if (replacementSingleIdx !== -1) {
        nextSingles.splice(replacementSingleIdx, 1);
      }

      // Previous partner is freed as unmatched.
      addSingleIfMissing(nextSingles, oldPartnerId);

      const updatedTargetIdx = nextSuggestions.findIndex((row) => row.row_id === overrideTarget.row_id);
      const replacementInfo = studentDirectory[replacementId];
      nextSuggestions[updatedTargetIdx] = {
        ...nextSuggestions[updatedTargetIdx],
        row_id: `${overrideResult.student_id_1}-${overrideResult.student_id_2}`,
        student_id_1: overrideResult.student_id_1,
        student_id_2: overrideResult.student_id_2,
        student_1_name: overrideResult.student_1_name,
        student_2_name: overrideResult.student_2_name,
        student_2_gender: replacementInfo?.gender || nextSuggestions[updatedTargetIdx].student_2_gender,
        student_2_number: replacementInfo?.student_number || nextSuggestions[updatedTargetIdx].student_2_number,
        score: overrideResult.score,
        breakdown: overrideResult.breakdown,
        is_flagged: overrideResult.is_flagged,
        classification: formatClassification(overrideResult.is_flagged),
        status: "suggested",
        room_assignment_status: "Pending approval",
      };

      setSuggestions(nextSuggestions);
      setSingles(nextSingles);
      refreshPreviewMeta(nextSuggestions, nextSingles);
      handleCloseOverride();
      setAllocSuccess("Match override applied and compatibility score recalculated.");
    } catch (err) {
      setAllocError(err.response?.data?.error || err.message || "Failed to override match.");
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleApproveRow = async (row) => {
    clearAllocationBanners();
    setAllocProcessing(true);

    try {
      await api.post("/admin/allocation/approve-pair", {
        semester,
        student_id_1: row.student_id_1,
        student_id_2: row.student_id_2,
        score: row.score,
        breakdown: row.breakdown,
        joins_existing_room: row.joins_existing_room,
      });

      setSuggestions((prev) => prev.map((item) => {
        if (item.row_id !== row.row_id) return item;
        return {
          ...item,
          status: "approved",
          room_assignment_status: item.joins_existing_room ? "Assigned to partially allocated room" : "Assigned",
        };
      }));
      fetchRoomAvailability();
      setAllocSuccess("Pair approved and assigned to room.");
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to approve pair.");
    } finally {
      setAllocProcessing(false);
    }
  };

  const handleRejectRow = async (row) => {
    clearAllocationBanners();
    setAllocProcessing(true);

    try {
      await api.post("/admin/allocation/reject-pair", {
        semester,
        student_id_1: row.student_id_1,
        student_id_2: row.student_id_2,
      });

      setSuggestions((prev) => prev.map((item) => {
        if (item.row_id !== row.row_id) return item;
        return {
          ...item,
          status: "rejected",
          room_assignment_status: "Unassigned",
        };
      }));
      setAllocSuccess("Pair rejected. Students remain unassigned.");
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to reject pair.");
    } finally {
      setAllocProcessing(false);
    }
  };

  const handleApproveAll = async () => {
    const pendingPairs = suggestions.filter((row) => row.status === "suggested");
    const pendingSingles = singles.filter((s) => s.status === "suggested").map((s) => s.student_id);

    if (pendingPairs.length === 0 && pendingSingles.length === 0) {
      setAllocError("No suggested allocations available to approve.");
      return;
    }

    clearAllocationBanners();
    setAllocProcessing(true);

    try {
      await api.post("/admin/allocation/approve-all", {
        semester,
        pairs: pendingPairs,
        singles: pendingSingles,
      });

      const nextSuggestions = suggestions.map((row) => {
        if (row.status !== "suggested") return row;
        return {
          ...row,
          status: "approved",
          room_assignment_status: row.joins_existing_room ? "Assigned to partially allocated room" : "Assigned",
        };
      });

      const nextSingles = singles.map((single) => {
        if (single.status !== "suggested") return single;
        return {
          ...single,
          status: "approved",
        };
      });

      setSuggestions(nextSuggestions);
      setSingles(nextSingles);
      refreshPreviewMeta(nextSuggestions, nextSingles);
      fetchRoomAvailability();
      setAllocSuccess("All suggested allocations approved and assigned.");
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to approve all suggestions.");
    } finally {
      setAllocProcessing(false);
    }
  };

  const handleRejectAll = async () => {
    clearAllocationBanners();
    setAllocProcessing(true);

    try {
      await api.post("/admin/allocation/reject-all", { semester });

      const nextSuggestions = suggestions.map((row) => {
        if (row.status !== "suggested") return row;
        return {
          ...row,
          status: "rejected",
          room_assignment_status: "Unassigned",
        };
      });

      const nextSingles = singles.map((single) => {
        if (single.status !== "suggested") return single;
        return {
          ...single,
          status: "rejected",
        };
      });

      setSuggestions(nextSuggestions);
      setSingles(nextSingles);
      refreshPreviewMeta(nextSuggestions, nextSingles);
      setAllocSuccess("All suggested allocations rejected.");
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to reject all suggestions.");
    } finally {
      setAllocProcessing(false);
    }
  };

  const breakdownLabels = {
    wake_time: "Wake Time",
    sleep_time: "Sleep Time",
    noise_tolerance: "Noise Tolerance",
    cleanliness_level: "Cleanliness",
    guest_policy: "Guest Policy",
    bathroom_schedule: "Bathroom Schedule",
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("semester", semester);
      params.set("page", String(studentsPage));
      params.set("per_page", String(studentsPerPage));
      if (search.trim()) params.set("search", search.trim());
      if (filterGender) params.set("gender", filterGender);
      if (filterYear) params.set("year", filterYear);
      if (filterStatus) params.set("preferences_status", filterStatus);

      const res = await api.get(`/admin/students?${params.toString()}`);
      setData(res.data);
      setStudentsTotalPages(res.data?.total_pages || 1);
    } catch {
      console.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const handleExportAssignmentsSummaryCsv = async () => {
    setExportingAssignmentsSummaryCsv(true);
    try {
      const params = new URLSearchParams();
      params.set("semester", semester);
      if (assignmentFilters.search.trim()) params.set("search", assignmentFilters.search.trim());
      if (assignmentFilters.status) params.set("status", assignmentFilters.status);
      if (assignmentFilters.hostel_block) params.set("hostel_block", assignmentFilters.hostel_block);
      if (assignmentFilters.sort_by) params.set("sort_by", assignmentFilters.sort_by);
      if (assignmentFilters.sort_order) params.set("sort_order", assignmentFilters.sort_order);

      const res = await api.get(`/admin/reports/assignments-summary.csv?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `assignments_summary_${semester}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to export assignments summary CSV report.");
    } finally {
      setExportingAssignmentsSummaryCsv(false);
    }
  };

  const fetchRoomAvailability = async () => {
    try {
      const res = await api.get("/admin/allocation/rooms-summary");
      const emptyRooms = Number(res.data?.empty_rooms || 0);
      setPreviewMeta((prev) => ({
        ...prev,
        rooms_available: emptyRooms,
        sufficient_rooms: emptyRooms >= prev.rooms_required,
      }));
    } catch {
      console.error("Failed to load room availability");
    }
  };

  const fetchConfirmedAssignments = async () => {
    setAssignmentsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("semester", semester);
      params.set("page", String(assignmentsPage));
      params.set("per_page", String(assignmentsPerPage));
      if (assignmentFilters.status) params.set("status", assignmentFilters.status);
      if (assignmentFilters.hostel_block) params.set("hostel_block", assignmentFilters.hostel_block);
      if (assignmentFilters.search.trim()) params.set("search", assignmentFilters.search.trim());
      if (assignmentFilters.sort_by) params.set("sort_by", assignmentFilters.sort_by);
      if (assignmentFilters.sort_order) params.set("sort_order", assignmentFilters.sort_order);

      const res = await api.get(`/admin/allocation/assignments?${params.toString()}`);
      setConfirmedAssignments(res.data?.assignments || []);
      setAssignmentsTotalPages(res.data?.total_pages || 1);
      setAssignmentsTotal(res.data?.total || 0);
    } catch {
      console.error("Failed to load confirmed assignments");
      setConfirmedAssignments([]);
      setAssignmentsTotalPages(1);
      setAssignmentsTotal(0);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const handleUndoAssignment = async (assignment) => {
    const roomLabel = assignment.room_number ? `Room ${assignment.room_number}` : "this room";
    const proceed = window.confirm(`Undo assignment for ${roomLabel}? This will free the room and unassign the students.`);
    if (!proceed) return;

    clearAllocationBanners();
    setUndoAssignmentLoadingId(assignment.assignment_id);

    try {
      await api.patch(`/admin/allocation/assignments/${assignment.assignment_id}/undo`);
      setAllocSuccess("Assignment deleted successfully. Room is now empty.");
      fetchConfirmedAssignments();
      fetchStudents();
      fetchRoomAvailability();
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to undo assignment.");
    } finally {
      setUndoAssignmentLoadingId(null);
    }
  };

  const fetchConflicts = async () => {
    setConflictsLoading(true);
    setConflictError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(conflictsPage));
      params.set("per_page", String(conflictsPerPage));
      if (conflictFilters.status) params.set("status", conflictFilters.status);
      if (conflictFilters.severity) params.set("severity", conflictFilters.severity);
      if (conflictFilters.type) params.set("type", conflictFilters.type);
      if (conflictFilters.from_date) params.set("from_date", conflictFilters.from_date);
      if (conflictFilters.to_date) params.set("to_date", conflictFilters.to_date);
      if (conflictFilters.sort_by) params.set("sort_by", conflictFilters.sort_by);
      if (conflictFilters.sort_order) params.set("sort_order", conflictFilters.sort_order);

      const res = await api.get(`/conflicts?${params.toString()}`);
      setConflicts(res.data?.conflicts || []);
      setConflictsTotalPages(res.data?.total_pages || 1);
      setConflictsTotal(res.data?.total || 0);
    } catch (err) {
      setConflictError(err.response?.data?.error || "Failed to load conflicts");
      setConflictsTotalPages(1);
      setConflictsTotal(0);
    } finally {
      setConflictsLoading(false);
    }
  };

  const handleOpenConflictUpdate = (conflict) => {
    if (conflict.status !== "escalated") return;
    setSelectedConflict(conflict);
    setConflictResolutionNotes(conflict.resolution_notes || "");
    setConflictError("");
    setConflictUpdateOpen(true);
  };

  const handleCloseConflictUpdate = () => {
    setConflictUpdateOpen(false);
    setSelectedConflict(null);
    setConflictResolutionNotes("");
  };

  const handleSubmitConflictUpdate = async (e) => {
    e.preventDefault();
    if (!selectedConflict) return;

    const notes = conflictResolutionNotes.trim();
    if (!notes) {
      setConflictError("resolution_notes is required to resolve escalated conflict");
      return;
    }

    setConflictUpdateSubmitting(true);
    setConflictError("");
    try {
      await api.put(`/conflicts/${selectedConflict.conflict_id}/escalation`, {
        status: "resolved",
        resolution_notes: notes,
      });
      setActionMessage(`Conflict #${selectedConflict.conflict_id} resolved successfully.`);
      setTimeout(() => setActionMessage(""), 3000);
      handleCloseConflictUpdate();
      fetchConflicts();
    } catch (err) {
      setConflictError(err.response?.data?.error || "Failed to resolve conflict");
    } finally {
      setConflictUpdateSubmitting(false);
    }
  };

  const clearDocPreviews = () => {
    if (profilePhotoPreviewUrl) URL.revokeObjectURL(profilePhotoPreviewUrl);
    if (verificationDocPreviewUrl) URL.revokeObjectURL(verificationDocPreviewUrl);
    setProfilePhotoPreviewUrl("");
    setVerificationDocPreviewUrl("");
    setVerificationDocMimeType("");
  };

  const loadVerificationQueue = async () => {
    setVerificationLoading(true);
    try {
      const res = await api.get("/admin/students/verification/pending?page=1&per_page=50");
      setVerificationRows(res.data?.students || []);
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to load pending verifications.");
    } finally {
      setVerificationLoading(false);
    }
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
        const profileBlobRes = await api.get(`/admin/students/${student.student_id}/verification-documents/profile-photo`, { responseType: "blob" });
        setProfilePhotoPreviewUrl(URL.createObjectURL(profileBlobRes.data));
      }

      if (payload?.verification_document?.available) {
        const verificationBlobRes = await api.get(`/admin/students/${student.student_id}/verification-documents/verification-document`, { responseType: "blob" });
        setVerificationDocPreviewUrl(URL.createObjectURL(verificationBlobRes.data));
        setVerificationDocMimeType(verificationBlobRes.data?.type || payload?.verification_document?.mime_type || "");
      }
    } catch (err) {
      setVerificationDocs(null);
      clearDocPreviews();
      setAllocError(err.response?.data?.error || "Failed to load submitted documents.");
    } finally {
      setVerificationDocsLoading(false);
    }
  };

  const submitVerificationReview = async () => {
    if (!reviewVerificationTarget) return;
    try {
      await api.patch(`/admin/students/${reviewVerificationTarget.student_id}/verification`, {
        action: reviewVerificationTarget.action,
        note: verificationReviewNote,
      });
      setReviewVerificationTarget(null);
      setVerificationReviewNote("");
      await loadVerificationQueue();
      if (selectedVerificationStudent?.student_id === reviewVerificationTarget.student_id) {
        await loadVerificationDocuments(selectedVerificationStudent);
      }
      setActionMessage(`Verification ${reviewVerificationTarget.action}d successfully.`);
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to review verification.");
    }
  };

  const loadStayReviewQueue = async () => {
    setStayReviewLoading(true);
    try {
      const res = await api.get("/admin/stay-date-requests?status=pending&page=1&per_page=50");
      setStayReviewRows(res.data?.requests || []);
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to load stay-date requests.");
    } finally {
      setStayReviewLoading(false);
    }
  };

  const submitStayReview = async () => {
    if (!reviewStayTarget) return;
    try {
      await api.patch(`/admin/stay-date-requests/${reviewStayTarget.request_id}/review`, {
        action: reviewStayTarget.action,
        admin_note: stayReviewNote,
      });
      setReviewStayTarget(null);
      setStayReviewNote("");
      await loadStayReviewQueue();
      setActionMessage(`Stay-date request ${reviewStayTarget.action}d successfully.`);
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to review stay-date request.");
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
      setAllocError(err.response?.data?.error || "Failed to load compatibility diagnostics.");
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
      setAllocError(err.response?.data?.error || "Failed to search students.");
    } finally {
      setStudentLookupLoading(false);
    }
  };

  const refreshCompatibility = async () => {
    const sid = Number(studentIdInput);
    if (!Number.isInteger(sid) || sid <= 0) {
      setAllocError("Enter a valid student ID first.");
      return;
    }

    try {
      await api.post(`/admin/students/${sid}/compatibility/refresh`);
      await loadDiagnostics(sid);
      setActionMessage("Compatibility scores refreshed for selected student.");
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to refresh compatibility.");
    }
  };

  useEffect(() => {
    fetchRoomAvailability();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [semester, studentsPage, studentsPerPage, search, filterGender, filterYear, filterStatus]);

  useEffect(() => {
    setStudentsPage(1);
  }, [semester, search, filterGender, filterYear, filterStatus]);

  useEffect(() => {
    fetchConfirmedAssignments();
  }, [
    semester,
    assignmentsPage,
    assignmentsPerPage,
    assignmentFilters.status,
    assignmentFilters.hostel_block,
    assignmentFilters.search,
    assignmentFilters.sort_by,
    assignmentFilters.sort_order,
  ]);

  useEffect(() => {
    setAssignmentsPage(1);
  }, [
    semester,
    assignmentFilters.status,
    assignmentFilters.hostel_block,
    assignmentFilters.search,
    assignmentFilters.sort_by,
    assignmentFilters.sort_order,
  ]);

  useEffect(() => {
    fetchConflicts();
  }, [
    conflictsPage,
    conflictsPerPage,
    conflictFilters.status,
    conflictFilters.severity,
    conflictFilters.type,
    conflictFilters.from_date,
    conflictFilters.to_date,
    conflictFilters.sort_by,
    conflictFilters.sort_order,
  ]);

  useEffect(() => {
    setConflictsPage(1);
  }, [
    conflictFilters.status,
    conflictFilters.severity,
    conflictFilters.type,
    conflictFilters.from_date,
    conflictFilters.to_date,
    conflictFilters.sort_by,
    conflictFilters.sort_order,
  ]);

  useEffect(() => {
    loadVerificationQueue();
    loadStayReviewQueue();
  }, []);

  useEffect(() => {
    if (activeSection === "verification") {
      loadVerificationQueue();
    }
    if (activeSection === "stay-requests") {
      loadStayReviewQueue();
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === "verification" && !verificationLoading && verificationRows.length === 0) {
      setActiveSection("overview");
      setSelectedVerificationStudent(null);
      setVerificationDocs(null);
      clearDocPreviews();
    }
  }, [activeSection, verificationLoading, verificationRows.length]);

  useEffect(() => {
    if (activeSection === "stay-requests" && !stayReviewLoading && stayReviewRows.length === 0) {
      setActiveSection("overview");
    }
  }, [activeSection, stayReviewLoading, stayReviewRows.length]);

  useEffect(() => {
    return () => {
      if (profilePhotoPreviewUrl) URL.revokeObjectURL(profilePhotoPreviewUrl);
      if (verificationDocPreviewUrl) URL.revokeObjectURL(verificationDocPreviewUrl);
    };
  }, [profilePhotoPreviewUrl, verificationDocPreviewUrl]);

  const openCount = conflicts.filter((c) => c.status === "open").length;
  const mediationCount = conflicts.filter((c) => c.status === "in_mediation").length;
  const escalatedCount = conflicts.filter((c) => c.status === "escalated").length;
  const verificationPendingCount = verificationRows.length;
  const stayPendingCount = stayReviewRows.length;
  const verificationTabDisabled = !verificationLoading && verificationPendingCount === 0;
  const stayRequestsTabDisabled = !stayReviewLoading && stayPendingCount === 0;

  const handleDisable = async (studentId, studentName) => {
    if (window.confirm(`Are you sure you want to deactivate student ${studentName}?`)) {
      try {
        await api.patch(`/admin/students/${studentId}/disable`);
        setActionMessage(`Student ${studentName} has been deactivated successfully.`);
        fetchStudents(); // Refresh
        setTimeout(() => setActionMessage(""), 3000);
      } catch {
        console.error("Failed to deactivate student");
      }
    }
  };

  const handleModalOpen = () => {
    // Reset form
    setForm({
      name: "",
      email: "",
      role: "admin",
      hostelBlock: "",
      password: "",
      confirmPassword: "",
    });
    setFormErrors({});
    setSubmitError("");
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user types
    if (formErrors[name]) {
      const newErrors = { ...formErrors };
      delete newErrors[name];
      setFormErrors(newErrors);
    }
    // Clear submit error on any change
    if (submitError) setSubmitError("");
  };

  const handleRoleChange = (e) => {
    const value = e.target.value;
    setForm(prev => ({
      ...prev,
      role: value,
      hostelBlock: value === "resident_advisor" ? "" : form.hostelBlock, // keep hostelBlock if switching from RA to admin? Actually we want to clear when switching to admin.
    }));
    // Actually, when switching to admin, we should clear hostelBlock because it's not needed.
    if (value === "admin") {
      setForm(prev => ({
        ...prev,
        hostelBlock: "",
      }));
    }
    // Clear hostelBlock error if any
    if (formErrors.hostelBlock) {
      const newErrors = { ...formErrors };
      delete newErrors.hostelBlock;
      setFormErrors(newErrors);
    }
  };

  const validateForm = () => {
    const errors = {};
    const { name, email, role, hostelBlock, password, confirmPassword } = form;

    if (!name.trim()) errors.name = "Full name is required";
    if (!email.trim()) errors.email = "Email address is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = "Email address is invalid";
    if (!role) errors.role = "Role is required";
    if (role === "resident_advisor" && !hostelBlock.trim()) errors.hostelBlock = "Hostel block is required for Resident Advisors";
    if (!password) errors.password = "Password is required";
    else if (password.length < 8) errors.password = "Password must be at least 8 characters";
    if (!confirmPassword) errors.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match";

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitLoading(true);
    setSubmitError("");

    try {
      await api.post("/admin/users", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        hostelBlock: form.role === "resident_advisor" ? form.hostelBlock.trim() : null,
      });
      // Success
      setActionMessage(`${form.role.charAt(0).toUpperCase() + form.role.slice(1)} account created successfully`);
      setModalOpen(false);
      fetchStudents(); // Refresh student table as per requirement
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err) {
      let message = "An error occurred";
      if (err.response) {
        if (err.response.status === 409) {
          message = "Email already registered";
        } else if (err.response.status === 400) {
          message = err.response.data.error || "Invalid input";
        } else {
          message = err.response.data.error || "Failed to create account";
        }
      }
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Navbar />
      <div className="main-content">
        <div className="admin-layout">
          <aside className="admin-sidebar">
            <div className="admin-sidebar-card">
              <h3 className="admin-sidebar-title">Admin Navigation</h3>
              <div className="admin-sidebar-links">
                <button type="button" className={`admin-nav-btn ${activeSection === "overview" ? "active" : ""}`} onClick={() => setActiveSection("overview")}>Overview</button>
                <button type="button" className={`admin-nav-btn ${activeSection === "students" ? "active" : ""}`} onClick={() => setActiveSection("students")}>Students</button>
                <button type="button" className={`admin-nav-btn ${activeSection === "assignments" ? "active" : ""}`} onClick={() => setActiveSection("assignments")}>Assignments</button>
                <button type="button" className={`admin-nav-btn ${activeSection === "allocation" ? "active" : ""}`} onClick={() => setActiveSection("allocation")}>Allocation</button>
                <button type="button" className={`admin-nav-btn ${activeSection === "conflicts" ? "active" : ""}`} onClick={() => setActiveSection("conflicts")}>Conflicts</button>
                <button
                  type="button"
                  className={`admin-nav-btn ${activeSection === "verification" ? "active" : ""}`}
                  onClick={() => setActiveSection("verification")}
                  disabled={verificationTabDisabled}
                  title={verificationTabDisabled ? "No pending verification approvals" : "Verification Queue"}
                >
                  Verification Queue
                  <span style={{ marginLeft: "8px", fontSize: "12px", fontWeight: 700, minWidth: "18px", textAlign: "center", padding: "1px 6px", borderRadius: "999px", background: verificationPendingCount > 0 ? "var(--primary)" : "var(--surface-muted)", color: verificationPendingCount > 0 ? "#fff" : "var(--text-muted)" }}>
                    {verificationPendingCount}
                  </span>
                </button>
                <button
                  type="button"
                  className={`admin-nav-btn ${activeSection === "stay-requests" ? "active" : ""}`}
                  onClick={() => setActiveSection("stay-requests")}
                  disabled={stayRequestsTabDisabled}
                  title={stayRequestsTabDisabled ? "No pending stay-date approvals" : "Stay-Date Requests"}
                >
                  Stay-Date Requests
                  <span style={{ marginLeft: "8px", fontSize: "12px", fontWeight: 700, minWidth: "18px", textAlign: "center", padding: "1px 6px", borderRadius: "999px", background: stayPendingCount > 0 ? "var(--primary)" : "var(--surface-muted)", color: stayPendingCount > 0 ? "#fff" : "var(--text-muted)" }}>
                    {stayPendingCount}
                  </span>
                </button>
                <button type="button" className={`admin-nav-btn ${activeSection === "diagnostics" ? "active" : ""}`} onClick={() => setActiveSection("diagnostics")}>Compatibility Diagnostics</button>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "14px", padding: "10px 14px", fontSize: "13px" }}
                onClick={handleModalOpen}
              >
                Create Staff
              </button>
            </div>
          </aside>

          <div className="admin-content-pane">
        <div style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "28px", marginBottom: "4px" }}>Admin Roommate Management</h1>
            <p style={{ color: "var(--text-muted)" }}>
              Review compatibility directory status, check student profile compliance, and prepare matching cycles.
            </p>
          </div>
          {role === "admin" && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={handleModalOpen}
                className="btn btn-primary"
                style={{ padding: "10px 20px", fontSize: "14px", borderRadius: "4px" }}
              >
                Create Staff Account
              </button>
            </div>
          )}
        </div>

        {actionMessage && (
          <div className="banner banner-success">
            <span className="banner-icon">✓</span>
            <div>{actionMessage}</div>
          </div>
        )}

        {allocError && (
          <div className="banner banner-error">
            <span className="banner-icon">!</span>
            <div>{allocError}</div>
          </div>
        )}

        {allocSuccess && (
          <div className="banner banner-success">
            <span className="banner-icon">✓</span>
            <div>{allocSuccess}</div>
          </div>
        )}

        {activeSection === "overview" && (
        <div id="overview-section" className="stats-panel">
          <div className="stat-card stat-card-indigo">
            <div className="stat-value">{data.total}</div>
            <div className="stat-label">Total Registered Students</div>
          </div>
          <div className="stat-card stat-card-teal">
            <div className="stat-value">{data.submitted}</div>
            <div className="stat-label">Profile Complete / Ready for Matching</div>
          </div>
          <div className="stat-card stat-card-rose">
            <div className="stat-value">{data.not_submitted}</div>
            <div className="stat-label">Profile Incomplete</div>
          </div>
        </div>
        )}

        {activeSection === "students" && (
        <div id="students-section" className="card">
          <div className="table-controls">
            <h3 className="card-title" style={{ margin: 0 }}>
              <span>👥</span> Student Compatibility Directory
            </h3>
            
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
              <input
                type="text"
                placeholder="Search by name or student number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-input search-input"
                style={{ padding: "8px 12px", fontSize: "13.5px" }}
              />
              
              <select
                value={filterStatus}
                onChange={e => {
                  setFilterStatus(e.target.value);
                  setStudentsPage(1);
                }}
                className="form-select"
                style={{ width: "auto", padding: "8px 12px", fontSize: "13.5px" }}
              >
                <option value="">All Statuses</option>
                <option value="submitted">Profile Complete</option>
                <option value="not_submitted">Profile Incomplete</option>
              </select>

              <select
                value={filterGender}
                onChange={e => {
                  setFilterGender(e.target.value);
                  setStudentsPage(1);
                }}
                className="form-select"
                style={{ width: "auto", padding: "8px 12px", fontSize: "13.5px" }}
              >
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>

              <select
                value={filterYear}
                onChange={e => {
                  setFilterYear(e.target.value);
                  setStudentsPage(1);
                }}
                className="form-select"
                style={{ width: "auto", padding: "8px 12px", fontSize: "13.5px" }}
              >
                <option value="">All Years</option>
                {[1,2,3,4,5,6].map(y => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>

            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
              Loading student directory...
            </p>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Student Number</th>
                    <th>Year</th>
                    <th>Gender</th>
                    <th>Matching Status</th>
                    <th>Assignment</th>
                    <th>Date Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                        No matching student profiles found.
                      </td>
                    </tr>
                  ) : (
                    data.students.map((s) => (
                      <tr key={s.student_id}>
                        <td style={{ fontWeight: "600" }}>{s.name}</td>
                        <td>{s.student_number}</td>
                        <td>Year {s.year}</td>
                        <td style={{ textTransform: "capitalize" }}>{s.gender?.replace("_", " ")}</td>
                        <td>
                          {s.preferences_status === "submitted" ? (
                            <span className="badge badge-success">✓ Ready for Matching</span>
                          ) : (
                            <span className="badge badge-error">✗ Profile Incomplete</span>
                          )}
                        </td>
                        <td>
                          {s.assignment ? (
                            <span className="badge badge-success">
                              {s.assignment.room_number} ({String(s.assignment.status).replace("_", " ")})
                            </span>
                          ) : (
                            <span className="badge badge-warning">Unassigned</span>
                          )}
                        </td>
                        <td>{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
                        <td>
                          <button
                            onClick={() => handleDisable(s.student_id, s.name)}
                            className="btn btn-danger"
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              Page {studentsPage} of {studentsTotalPages} ({data.total} records)
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "6px 10px", fontSize: "12px" }}
                disabled={studentsPage <= 1 || loading}
                onClick={() => setStudentsPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "6px 10px", fontSize: "12px" }}
                disabled={studentsPage >= studentsTotalPages || loading}
                onClick={() => setStudentsPage((p) => Math.min(studentsTotalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
        )}

        {activeSection === "assignments" && (
        <div id="assignments-section" className="card">
          <div className="table-controls" style={{ marginBottom: "12px" }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <span>✅</span> Confirmed Assignments ({semester})
            </h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                value={assignmentFilters.search}
                onChange={(e) => setAssignmentFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Search room or student..."
                className="form-input"
                style={{ width: "220px", padding: "8px 10px", fontSize: "13px" }}
              />
              <select
                value={assignmentFilters.status}
                onChange={(e) => setAssignmentFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="form-select"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
              >
                <option value="">Active + Awaiting</option>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="awaiting_roommate">Awaiting roommate</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={assignmentFilters.hostel_block}
                onChange={(e) => setAssignmentFilters((prev) => ({ ...prev, hostel_block: e.target.value }))}
                className="form-select"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
              >
                <option value="">All Blocks</option>
                <option value="A">Block A</option>
                <option value="B">Block B</option>
                <option value="C">Block C</option>
              </select>
              <select
                value={assignmentFilters.sort_by}
                onChange={(e) => setAssignmentFilters((prev) => ({ ...prev, sort_by: e.target.value }))}
                className="form-select"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
              >
                <option value="created_at">Sort: Created Date</option>
                <option value="score">Sort: Compatibility Score</option>
                <option value="room_number">Sort: Room Number</option>
              </select>
              <select
                value={assignmentFilters.sort_order}
                onChange={(e) => setAssignmentFilters((prev) => ({ ...prev, sort_order: e.target.value }))}
                className="form-select"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
              >
                <option value="desc">Order: Descending</option>
                <option value="asc">Order: Ascending</option>
              </select>
              <button className="btn btn-secondary" style={{ padding: "8px 10px", fontSize: "13px" }} onClick={fetchConfirmedAssignments}>
                Refresh
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "8px 10px", fontSize: "13px" }}
                onClick={handleExportAssignmentsSummaryCsv}
                disabled={exportingAssignmentsSummaryCsv}
              >
                {exportingAssignmentsSummaryCsv ? "Exporting..." : "Export Assignments CSV"}
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Block</th>
                  <th>Student 1</th>
                  <th>Student 2</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignmentsLoading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px" }}>
                      Loading assignments...
                    </td>
                  </tr>
                ) : confirmedAssignments.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px" }}>
                      No confirmed assignments found for this semester.
                    </td>
                  </tr>
                ) : (
                  confirmedAssignments.map((a) => (
                    <tr key={a.assignment_id}>
                      <td>{a.room_number || "-"}</td>
                      <td>{a.hostel_block || "-"}</td>
                      <td>{a.student_1?.name || "-"}</td>
                      <td>{a.student_2?.name || "Awaiting roommate"}</td>
                      <td><span className="badge badge-success" style={{ textTransform: "capitalize" }}>{String(a.status).replace("_", " ")}</span></td>
                      <td>{a.compatibility_score ?? "-"}</td>
                      <td>
                        <button
                          onClick={() => handleUndoAssignment(a)}
                          className="btn btn-danger"
                          style={{ padding: "5px 8px", fontSize: "12px", borderRadius: "6px" }}
                          disabled={undoAssignmentLoadingId === a.assignment_id}
                        >
                          {undoAssignmentLoadingId === a.assignment_id ? "Undoing..." : "Undo Assignment"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              Page {assignmentsPage} of {assignmentsTotalPages} ({assignmentsTotal} records)
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "6px 10px", fontSize: "12px" }}
                disabled={assignmentsPage <= 1 || assignmentsLoading}
                onClick={() => setAssignmentsPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "6px 10px", fontSize: "12px" }}
                disabled={assignmentsPage >= assignmentsTotalPages || assignmentsLoading}
                onClick={() => setAssignmentsPage((p) => Math.min(assignmentsTotalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
        )}

        {activeSection === "allocation" && (
        <div id="allocation-section" className="card">
          <div className="table-controls" style={{ marginBottom: "16px" }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <span>🏠</span> Room Allocation Management
            </h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="form-input"
                placeholder="Semester (e.g. 2026-S1)"
                style={{ width: "210px", padding: "8px 12px" }}
              />
              <button
                onClick={handleGenerateSuggestions}
                className="btn btn-primary"
                disabled={allocLoading || allocProcessing}
                style={{ padding: "8px 14px", borderRadius: "8px" }}
              >
                {allocLoading ? "Generating..." : "Generate Allocation Suggestions"}
              </button>
            </div>
          </div>

          <div className="stats-panel" style={{ marginBottom: "18px" }}>
            <div className="stat-card stat-card-indigo">
              <div className="stat-value">{previewMeta.rooms_required}</div>
              <div className="stat-label">Required Empty Rooms</div>
            </div>
            <div className="stat-card stat-card-teal">
              <div className="stat-value">{previewMeta.rooms_available}</div>
              <div className="stat-label">Available Empty Rooms</div>
            </div>
            <div className="stat-card stat-card-rose">
              <div className="stat-value">{previewMeta.sufficient_rooms ? "YES" : "NO"}</div>
              <div className="stat-label">Capacity Validation</div>
            </div>
          </div>

          {!previewMeta.sufficient_rooms && (
            <div className="banner banner-warning" style={{ marginBottom: "18px" }}>
              <span className="banner-icon">⚠</span>
              <div>Allocation cannot be completed. Please add additional rooms.</div>
            </div>
          )}

          {previewMeta.waiting_unmatched_student_ids.length > 0 && (
            <div className="banner banner-warning" style={{ marginBottom: "18px" }}>
              <span className="banner-icon">!</span>
              <div>
                {previewMeta.waiting_unmatched_student_ids.length} waiting student(s) remain unmatched this run and will stay prioritised in the next allocation cycle.
              </div>
            </div>
          )}

          <div className="table-controls" style={{ marginBottom: "12px" }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <span>🧩</span> Allocation Suggestions Table
            </h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={handleApproveAll}
                className="btn btn-primary"
                disabled={allocProcessing || allocLoading || !previewMeta.sufficient_rooms}
                style={{ padding: "8px 14px", borderRadius: "8px" }}
              >
                Approve All
              </button>
              <button
                onClick={handleRejectAll}
                className="btn btn-secondary"
                disabled={allocProcessing || allocLoading}
                style={{ padding: "8px 14px", borderRadius: "8px" }}
              >
                Reject All
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student 1</th>
                  <th>Student 2</th>
                  <th>Compatibility Score</th>
                  <th>Classification</th>
                  <th>Room Assignment Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                      Generate allocation suggestions to begin workflow.
                    </td>
                  </tr>
                ) : (
                  suggestions.map((row) => (
                    <tr key={row.row_id} className={row.is_flagged ? "allocation-row-flagged" : ""}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.student_1_name}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{row.student_1_number}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.student_2_name}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{row.student_2_number}</div>
                      </td>
                      <td style={{ fontWeight: 700, color: row.score < 40 ? "var(--accent-rose-text)" : "var(--text-main)" }}>
                        {row.score}%
                      </td>
                      <td>
                        {row.is_flagged ? (
                          <span className="badge badge-warning">Flagged</span>
                        ) : (
                          <span className="badge badge-success">Suggested</span>
                        )}
                      </td>
                      <td>
                        {row.status === "approved" ? (
                          <span className="badge badge-success">{row.room_assignment_status}</span>
                        ) : row.status === "rejected" ? (
                          <span className="badge badge-error">Unassigned</span>
                        ) : (
                          <span className="badge badge-warning">Pending approval</span>
                        )}
                      </td>
                      <td>
                        <div className="allocation-actions">
                          <button
                            onClick={() => handleOpenBreakdown(row)}
                            className="btn btn-secondary"
                            style={{ padding: "5px 8px", fontSize: "12px", borderRadius: "6px" }}
                          >
                            View Breakdown
                          </button>
                          <button
                            onClick={() => handleOpenOverride(row)}
                            className="btn btn-secondary"
                            style={{ padding: "5px 8px", fontSize: "12px", borderRadius: "6px" }}
                            disabled={row.status !== "suggested" || allocProcessing}
                          >
                            Override Match
                          </button>
                          <button
                            onClick={() => handleApproveRow(row)}
                            className="btn btn-primary"
                            style={{ padding: "5px 8px", fontSize: "12px", borderRadius: "6px" }}
                            disabled={row.status !== "suggested" || allocProcessing || !previewMeta.sufficient_rooms}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectRow(row)}
                            className="btn btn-danger"
                            style={{ padding: "5px 8px", fontSize: "12px", borderRadius: "6px" }}
                            disabled={row.status !== "suggested" || allocProcessing}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {singles.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h4 style={{ marginBottom: "10px" }}>Unmatched Students (Solo Allocations)</h4>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Gender</th>
                      <th>Status</th>
                      <th>Room Assignment Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {singles.map((single) => (
                      <tr key={single.student_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{single.name}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{single.student_number}</div>
                        </td>
                        <td style={{ textTransform: "capitalize" }}>{single.gender?.replace("_", " ")}</td>
                        <td>
                          {single.status === "approved" ? (
                            <span className="badge badge-success">Approved</span>
                          ) : single.status === "rejected" ? (
                            <span className="badge badge-error">Rejected</span>
                          ) : (
                            <span className="badge badge-warning">Suggested</span>
                          )}
                        </td>
                        <td>
                          {single.status === "approved"
                            ? "Room assigned as awaiting_roommate"
                            : "Pending decision"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        )}

        {activeSection === "conflicts" && (
        <div className="dashboard-grid">
          <div id="conflicts-section" className="card" style={{ marginBottom: 0 }}>
            <h3 className="card-title">
              <span>📋</span> Conflict Logs
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13.5px", lineHeight: "1.5" }}>
              Monitor all student-reported roommate conflicts across blocks and intervene in escalated cases.
            </p>
            <div className="stats-panel" style={{ marginBottom: "14px" }}>
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

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
              <select
                value={conflictFilters.status}
                onChange={(e) => setConflictFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="form-select"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_mediation">In Mediation</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
                <option value="disabled">Disabled</option>
              </select>
              <select
                value={conflictFilters.severity}
                onChange={(e) => setConflictFilters((prev) => ({ ...prev, severity: e.target.value }))}
                className="form-select"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
              >
                <option value="">All Severity</option>
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>Severity {s}</option>
                ))}
              </select>
              <select
                value={conflictFilters.type}
                onChange={(e) => setConflictFilters((prev) => ({ ...prev, type: e.target.value }))}
                className="form-select"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
              >
                <option value="">All Types</option>
                <option value="sleep_schedule">Sleep Schedule</option>
                <option value="noise">Noise</option>
                <option value="cleanliness">Cleanliness</option>
                <option value="guests">Guests</option>
                <option value="bathroom">Bathroom</option>
                <option value="other">Other</option>
              </select>
              <input
                type="date"
                value={conflictFilters.from_date}
                onChange={(e) => setConflictFilters((prev) => ({ ...prev, from_date: e.target.value }))}
                className="form-input"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
                title="From date"
              />
              <input
                type="date"
                value={conflictFilters.to_date}
                onChange={(e) => setConflictFilters((prev) => ({ ...prev, to_date: e.target.value }))}
                className="form-input"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
                title="To date"
              />
              <select
                value={conflictFilters.sort_by}
                onChange={(e) => setConflictFilters((prev) => ({ ...prev, sort_by: e.target.value }))}
                className="form-select"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
              >
                <option value="created_at">Sort: Created Date</option>
                <option value="severity">Sort: Severity</option>
                <option value="status">Sort: Status</option>
              </select>
              <select
                value={conflictFilters.sort_order}
                onChange={(e) => setConflictFilters((prev) => ({ ...prev, sort_order: e.target.value }))}
                className="form-select"
                style={{ width: "auto", padding: "8px 10px", fontSize: "13px" }}
              >
                <option value="desc">Order: Descending</option>
                <option value="asc">Order: Ascending</option>
              </select>
              <button className="btn btn-secondary" style={{ padding: "8px 10px", fontSize: "13px" }} onClick={fetchConflicts}>
                Refresh
              </button>
            </div>

            {conflictError && (
              <div className="banner banner-error" style={{ marginBottom: "10px" }}>
                <span className="banner-icon">!</span>
                <div>{conflictError}</div>
              </div>
            )}

            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Block</th>
                    <th>Room</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Reported</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {conflictsLoading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px" }}>
                        Loading conflicts...
                      </td>
                    </tr>
                  ) : conflicts.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px" }}>
                        No conflicts found for current filters.
                      </td>
                    </tr>
                  ) : (
                    conflicts.map((conflict) => (
                      <tr key={conflict.conflict_id}>
                        <td>#{conflict.conflict_id}</td>
                        <td>{conflict.hostel_block || "-"}</td>
                        <td>{conflict.room_number || "-"}</td>
                        <td style={{ textTransform: "capitalize" }}>{String(conflict.conflict_type || "").replace("_", " ")}</td>
                        <td>{conflict.severity}</td>
                        <td><span className="badge badge-warning" style={{ textTransform: "capitalize" }}>{String(conflict.status || "").replace("_", " ")}</span></td>
                        <td>{conflict.created_at ? new Date(conflict.created_at).toLocaleDateString() : "-"}</td>
                        <td>
                          <button
                            onClick={() => handleOpenConflictUpdate(conflict)}
                            className="btn btn-primary"
                            style={{ padding: "5px 10px", fontSize: "12px", borderRadius: "6px" }}
                            disabled={conflict.status !== "escalated"}
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

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
              <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                Page {conflictsPage} of {conflictsTotalPages} ({conflictsTotal} records)
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "6px 10px", fontSize: "12px" }}
                  disabled={conflictsPage <= 1 || conflictsLoading}
                  onClick={() => setConflictsPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "6px 10px", fontSize: "12px" }}
                  disabled={conflictsPage >= conflictsTotalPages || conflictsLoading}
                  onClick={() => setConflictsPage((p) => Math.min(conflictsTotalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

        </div>
        )}

        {activeSection === "verification" && (
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
                        <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => { setReviewVerificationTarget({ ...row, action: "approve" }); setVerificationReviewNote(""); }}>Approve</button>
                        <button className="btn btn-danger" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => { setReviewVerificationTarget({ ...row, action: "reject" }); setVerificationReviewNote(""); }}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(selectedVerificationStudent || verificationDocsLoading) && (
            <div style={{ marginTop: "14px", borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
              <h4 style={{ marginBottom: "10px" }}>Submitted Documents: {selectedVerificationStudent?.name || "Selected Student"}</h4>
              {verificationDocsLoading ? (
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading submitted documents...</p>
              ) : (
                <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: 0 }}>
                  <div style={{ border: "1px solid var(--border-color)", borderRadius: "10px", padding: "10px" }}>
                    <h5 style={{ marginBottom: "8px" }}>Profile Photo</h5>
                    {profilePhotoPreviewUrl ? (
                      <img src={profilePhotoPreviewUrl} alt="Submitted profile" style={{ width: "100%", maxHeight: "280px", objectFit: "contain", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
                    ) : (
                      <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No profile photo submitted.</p>
                    )}
                  </div>
                  <div style={{ border: "1px solid var(--border-color)", borderRadius: "10px", padding: "10px" }}>
                    <h5 style={{ marginBottom: "8px" }}>Verification Document</h5>
                    {verificationDocPreviewUrl ? (
                      verificationDocMimeType.includes("pdf") ? (
                        <iframe src={verificationDocPreviewUrl} title="Verification document preview" style={{ width: "100%", height: "320px", border: "1px solid var(--border-color)", borderRadius: "8px" }} />
                      ) : (
                        <img src={verificationDocPreviewUrl} alt="Verification document" style={{ width: "100%", maxHeight: "280px", objectFit: "contain", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
                      )
                    ) : (
                      <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No verification document submitted.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {activeSection === "stay-requests" && (
        <div className="card">
          <div className="table-controls" style={{ marginBottom: "10px" }}>
            <h3 className="card-title" style={{ margin: 0 }}><span>🗓️</span> Pending Stay-Date Requests</h3>
            <button className="btn btn-secondary" onClick={loadStayReviewQueue}>Refresh</button>
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
                {stayReviewLoading ? (
                  <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading requests...</td></tr>
                ) : stayReviewRows.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)" }}>No pending stay-date requests.</td></tr>
                ) : stayReviewRows.map((row) => (
                  <tr key={row.request_id}>
                    <td>#{row.request_id}</td>
                    <td>{row.student_name} ({row.student_number})</td>
                    <td>{row.requested_start} - {row.requested_end}</td>
                    <td>{row.reason || "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => { setReviewStayTarget({ ...row, action: "approve" }); setStayReviewNote(""); }}>Approve</button>
                        <button className="btn btn-danger" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={() => { setReviewStayTarget({ ...row, action: "reject" }); setStayReviewNote(""); }}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {activeSection === "diagnostics" && (
        <div className="card">
          <h3 className="card-title"><span>📈</span> Compatibility Diagnostics</h3>
          <div className="form-group" style={{ marginBottom: "12px" }}>
            <label className="form-label">Find Student by Name, Student Number, or Email</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input className="form-input" style={{ maxWidth: "360px" }} placeholder="Search students..." value={studentLookup} onChange={(e) => setStudentLookup(e.target.value)} />
              <button className="btn btn-secondary" onClick={lookupStudents}>Search</button>
            </div>

            {studentLookupLoading && <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "8px" }}>Searching students...</p>}
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
            <input className="form-input" style={{ maxWidth: "260px" }} placeholder="Enter student ID" value={studentIdInput} onChange={(e) => setStudentIdInput(e.target.value)} />
            <button className="btn btn-secondary" onClick={() => {
              const sid = Number(studentIdInput);
              if (Number.isInteger(sid) && sid > 0) loadDiagnostics(sid);
              else setAllocError("Enter a valid student ID first.");
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
        )}
          </div>
        </div>
      </div>

      {reviewVerificationTarget && (
        <div className="modal-backdrop" onClick={() => setReviewVerificationTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{reviewVerificationTarget.action === "approve" ? "Approve" : "Reject"} Verification</h3>
              <button className="modal-close" onClick={() => setReviewVerificationTarget(null)}>×</button>
            </div>
            <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
              <p>Student: <strong>{reviewVerificationTarget.name}</strong></p>
              <textarea className="form-textarea" rows={4} placeholder="Optional note..." value={verificationReviewNote} onChange={(e) => setVerificationReviewNote(e.target.value)} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button className="btn btn-secondary" onClick={() => setReviewVerificationTarget(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={submitVerificationReview}>Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reviewStayTarget && (
        <div className="modal-backdrop" onClick={() => setReviewStayTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{reviewStayTarget.action === "approve" ? "Approve" : "Reject"} Stay-Date Request</h3>
              <button className="modal-close" onClick={() => setReviewStayTarget(null)}>×</button>
            </div>
            <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
              <p>Request: <strong>#{reviewStayTarget.request_id}</strong></p>
              <textarea className="form-textarea" rows={4} placeholder="Optional admin note..." value={stayReviewNote} onChange={(e) => setStayReviewNote(e.target.value)} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button className="btn btn-secondary" onClick={() => setReviewStayTarget(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={submitStayReview}>Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={handleModalClose}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Staff Account</h3>
              <button className="modal-close" onClick={handleModalClose}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFieldChange}
                  className="form-input"
                  style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.name ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                />
                {formErrors.name && (
                  <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                    {formErrors.name}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleFieldChange}
                  className="form-input"
                  style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.email ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                />
                {formErrors.email && (
                  <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                    {formErrors.email}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleRoleChange}
                  className="form-select"
                  style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.role ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                >
                  <option value="">Select Role</option>
                  <option value="admin">Administrator</option>
                  <option value="resident_advisor">Resident Advisor</option>
                </select>
                {formErrors.role && (
                  <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                    {formErrors.role}
                  </span>
                )}
              </div>

              {form.role === "resident_advisor" && (
                <div className="form-group">
                  <label>Hostel Block</label>
                  <input
                    type="text"
                    name="hostelBlock"
                    value={form.hostelBlock}
                    onChange={handleFieldChange}
                    className="form-input"
                    style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.hostelBlock ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                  />
                  {formErrors.hostelBlock && (
                    <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                      {formErrors.hostelBlock}
                    </span>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleFieldChange}
                  className="form-input"
                  style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.password ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                />
                {formErrors.password && (
                  <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                    {formErrors.password}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleFieldChange}
                  className="form-input"
                  style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.confirmPassword ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                />
                {formErrors.confirmPassword && (
                  <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                    {formErrors.confirmPassword}
                  </span>
                )}
              </div>

              {submitError && (
                <div className="alert alert-error" style={{ marginTop: "15px", padding: "10px", background: "var(--bg-error)", color: "var(--color-error)", borderRadius: "4px" }}>
                  {submitError}
                </div>
              )}

              <div className="form-group" style={{ marginTop: "20px", textAlign: "right" }}>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="btn btn-primary"
                  style={{ padding: "10px 20px", fontSize: "14px", borderRadius: "4px", opacity: submitLoading ? 0.7 : 1 }}
                >
                  {submitLoading ? "Creating..." : "Create Account"}
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="btn btn-secondary"
                  style={{ padding: "10px 20px", fontSize: "14px", marginLeft: "10px", borderRadius: "4px" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {breakdownOpen && selectedBreakdown && (
        <div className="modal-backdrop" onClick={handleCloseBreakdown}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assignment Overview & Scores</h3>
              <button className="modal-close" onClick={handleCloseBreakdown}>×</button>
            </div>
            <form style={{ marginTop: "16px" }}>
              <div className="form-group">
                <label className="form-label">Pairing</label>
                <input
                  className="form-input"
                  readOnly
                  value={`${selectedBreakdown.student_1_name} ↔ ${selectedBreakdown.student_2_name}`}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Total Compatibility Score</label>
                <input
                  className="form-input"
                  readOnly
                  value={`${selectedBreakdown.score}%`}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Score Breakdown by Category</label>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedBreakdown.breakdown || {}).map(([key, val]) => (
                        <tr key={key}>
                          <td>{breakdownLabels[key] || key}</td>
                          <td>{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={handleCloseBreakdown}>
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {overrideOpen && overrideTarget && (
        <div className="modal-backdrop" onClick={handleCloseOverride}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Override Match</h3>
              <button className="modal-close" onClick={handleCloseOverride}>×</button>
            </div>
            <form onSubmit={handleSubmitOverride} style={{ marginTop: "16px" }}>
              <p style={{ color: "var(--text-muted)", marginBottom: "12px" }}>
                Replace pairing for <strong>{overrideTarget.student_1_name}</strong>.
              </p>
              <div className="form-group">
                <label className="form-label">Current Match</label>
                <input
                  className="form-input"
                  value={`${overrideTarget.student_1_name} ↔ ${overrideTarget.student_2_name}`}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label className="form-label">Select Replacement Student</label>
                <select
                  className="form-select"
                  value={overrideReplacementId}
                  onChange={(e) => setOverrideReplacementId(e.target.value)}
                  required
                >
                  <option value="">Choose a student...</option>
                  {getOverrideCandidates(overrideTarget).map((candidate) => (
                    <option key={candidate.student_id} value={candidate.student_id}>
                      {candidate.name} ({candidate.student_number})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseOverride}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={overrideSubmitting}
                >
                  {overrideSubmitting ? "Applying..." : "Apply Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {conflictUpdateOpen && selectedConflict && (
        <div className="modal-backdrop" onClick={handleCloseConflictUpdate}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Update Escalated Conflict</h3>
              <button className="modal-close" onClick={handleCloseConflictUpdate}>×</button>
            </div>
            <form onSubmit={handleSubmitConflictUpdate} style={{ marginTop: "16px" }}>
              <div className="form-group">
                <label className="form-label">Conflict</label>
                <input
                  className="form-input"
                  readOnly
                  value={`#${selectedConflict.conflict_id} - ${selectedConflict.room_number || "Unknown room"}`}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <input className="form-input" readOnly value="resolved" />
              </div>
              <div className="form-group">
                <label className="form-label">Resolution Notes (required)</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={conflictResolutionNotes}
                  onChange={(e) => setConflictResolutionNotes(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={handleCloseConflictUpdate}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={conflictUpdateSubmitting}>
                  {conflictUpdateSubmitting ? "Saving..." : "Mark as Resolved"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}