import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  LayoutDashboard,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const ADMIN_TOKEN_KEY = "offense_tracker_admin_token";
const emptyStudent = {
  student_no: "",
  first_name: "",
  last_name: "",
  grade: "7",
  section: "A",
  adviser: "",
  status: "Active",
};
const emptyOffense = {
  code: "",
  name: "",
  category: "Minor",
  severity_points: 1,
  recommended_action: "",
  active: true,
};
const emptyIncident = {
  incident_date: new Date().toISOString().slice(0, 10),
  student_id: "",
  offense_id: "",
  action_taken: "",
  status: "Open",
  reported_by: "",
  notes: "",
};

function fullName(item) {
  return `${item.first_name} ${item.last_name}`;
}

function studentOptionLabel(student) {
  return `${student.student_no} - ${fullName(student)} (${student.grade}-${student.section})`;
}

async function api(path, options = {}) {
  const shouldAttachAdminToken = path !== "/admin/login" && !path.startsWith("/student-portal/");
  const adminToken = shouldAttachAdminToken ? window.localStorage.getItem(ADMIN_TOKEN_KEY) : "";
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      message = JSON.parse(text)?.detail || text;
    } catch {
      // The API may return plain text for infrastructure errors.
    }
    throw new Error(message || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function uploadExcel(path, file) {
  const formData = new FormData();
  formData.append("file", file);
  const adminToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      message = JSON.parse(text)?.detail || text;
    } catch {
      // The API may return plain text for infrastructure errors.
    }
    throw new Error(message || `Import failed: ${response.status}`);
  }
  return response.json();
}

function App() {
  const [portalView, setPortalView] = useState(false);
  const [adminToken, setAdminToken] = useState(() => window.localStorage.getItem(ADMIN_TOKEN_KEY) || "");
  const [adminVerified, setAdminVerified] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(Boolean(adminToken));
  const [activeTab, setActiveTab] = useState("dashboard");
  const [students, setStudents] = useState([]);
  const [offenses, setOffenses] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [studentSummary, setStudentSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [saving, setSaving] = useState("");
  const [importing, setImporting] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [selectedIncidentIds, setSelectedIncidentIds] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedOffenseIds, setSelectedOffenseIds] = useState([]);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [offenseForm, setOffenseForm] = useState(emptyOffense);
  const [incidentForm, setIncidentForm] = useState(emptyIncident);
  const [filters, setFilters] = useState({ search: "", month: "", category: "", status: "" });
  const notificationTimer = useRef(null);

  function showNotification(type, title, message) {
    window.clearTimeout(notificationTimer.current);
    setNotification({ type, title, message });
    notificationTimer.current = window.setTimeout(() => setNotification(null), 5000);
  }

  useEffect(
    () => () => window.clearTimeout(notificationTimer.current),
    [],
  );

  function clearAdminSession() {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken("");
    setAdminVerified(false);
    setCheckingAdmin(false);
    setStudents([]);
    setOffenses([]);
    setIncidents([]);
    setDashboard(null);
    setStudentSummary([]);
    setSelectedIncidentIds([]);
    setSelectedStudentIds([]);
    setSelectedOffenseIds([]);
    setStudentForm(emptyStudent);
    setOffenseForm(emptyOffense);
    setIncidentForm(emptyIncident);
    setError("");
  }

  async function loadData() {
    if (!adminToken || !adminVerified) return;
    setLoading(true);
    setError("");
    try {
      const year = new Date().getFullYear();
      const [studentsData, offensesData, incidentsData, dashData, summaryData] = await Promise.all([
        api("/students"),
        api("/offenses"),
        api(`/incidents?${new URLSearchParams(filters)}`),
        api(`/reports/dashboard?year=${year}`),
        api(`/reports/student-summary?year=${year}`),
      ]);
      setStudents(studentsData);
      setSelectedStudentIds((current) => {
        const availableIds = new Set(studentsData.map((student) => String(student.id)));
        return current.filter((id) => availableIds.has(String(id)));
      });
      setOffenses(offensesData);
      setSelectedOffenseIds((current) => {
        const availableIds = new Set(offensesData.map((offense) => String(offense.id)));
        return current.filter((id) => availableIds.has(String(id)));
      });
      setIncidents(incidentsData);
      setSelectedIncidentIds((current) => {
        const availableIds = new Set(incidentsData.map((incident) => String(incident.id)));
        return current.filter((id) => availableIds.has(String(id)));
      });
      setDashboard(dashData);
      setStudentSummary(summaryData);
    } catch (err) {
      setError(err.message);
      if (err.message === "Admin login is required") {
        clearAdminSession();
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!adminToken) {
      setAdminVerified(false);
      setCheckingAdmin(false);
      setLoading(false);
      return undefined;
    }

    let active = true;
    async function verifyAdmin() {
      setCheckingAdmin(true);
      setError("");
      try {
        await api("/admin/me");
        if (!active) return;
        setAdminVerified(true);
      } catch {
        if (active) clearAdminSession();
      } finally {
        if (active) setCheckingAdmin(false);
      }
    }
    verifyAdmin();
    return () => {
      active = false;
    };
  }, [adminToken]);

  useEffect(() => {
    if (adminToken && adminVerified) loadData();
  }, [adminToken, adminVerified]);

  function handleAdminLogin(token) {
    window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    setAdminToken(token);
  }

  function logoutAdmin() {
    clearAdminSession();
  }

  async function saveStudent(event) {
    event.preventDefault();
    const { id, ...payload } = studentForm;
    const isUpdate = Boolean(id);
    setSaving("student");
    try {
      const savedStudent = await api(id ? `/students/${id}` : "/students", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setStudentForm(emptyStudent);
      await loadData();
      showNotification(
        "success",
        isUpdate ? "Student updated" : "Student saved",
        `${payload.first_name} ${payload.last_name}'s record was ${isUpdate ? "updated" : "added"}. Portal username: ${savedStudent.username} · Password: ${savedStudent.initial_password}`,
      );
    } catch (err) {
      showNotification("error", "Student was not saved", err.message);
    } finally {
      setSaving("");
    }
  }

  async function saveOffense(event) {
    event.preventDefault();
    const { id, ...payload } = offenseForm;
    const isUpdate = Boolean(id);
    setSaving("offense");
    try {
      await api(id ? `/offenses/${id}` : "/offenses", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setOffenseForm(emptyOffense);
      await loadData();
      showNotification(
        "success",
        isUpdate ? "Offense updated" : "Offense saved",
        `${payload.name} was ${isUpdate ? "updated" : "added"} successfully.`,
      );
    } catch (err) {
      showNotification("error", "Offense was not saved", err.message);
    } finally {
      setSaving("");
    }
  }

  async function saveIncident(event) {
    event.preventDefault();
    const { id, ...payload } = incidentForm;
    const isUpdate = Boolean(id);
    setSaving("incident");
    try {
      await api(id ? `/incidents/${id}` : "/incidents", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({
          ...payload,
          student_id: Number(payload.student_id),
          offense_id: Number(payload.offense_id),
        }),
      });
      setIncidentForm(emptyIncident);
      await loadData();
      showNotification(
        "success",
        isUpdate ? "Incident updated" : "Incident saved",
        `The incident record was ${isUpdate ? "updated" : "logged"} successfully.`,
      );
    } catch (err) {
      showNotification("error", "Incident was not saved", err.message);
    } finally {
      setSaving("");
    }
  }

  async function importWorkbook(kind, file) {
    const isStudents = kind === "students";
    setImporting(kind);
    try {
      const result = await uploadExcel(`/${kind}/import`, file);
      await loadData();
      const details = [
        `${result.imported} ${isStudents ? "student" : "incident"} record${result.imported === 1 ? "" : "s"} added`,
        result.skipped ? `${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped` : "",
        result.error_count ? `${result.error_count} row${result.error_count === 1 ? "" : "s"} need attention` : "",
      ].filter(Boolean);
      const firstError = result.errors?.[0];
      showNotification(
        result.imported > 0 ? "success" : "error",
        result.imported > 0 ? "Excel import complete" : "No records were imported",
        `${details.join(" · ")}${firstError ? `. Row ${firstError.row}: ${firstError.message}` : "."}`,
      );
    } catch (err) {
      showNotification("error", "Excel import failed", err.message);
    } finally {
      setImporting("");
    }
  }

  function requestDelete(kind, id, label) {
    setPendingDelete({ kind, id, label });
  }

  function requestBulkDelete(kind, ids) {
    const singular = { incidents: "incident", students: "student", offenses: "offense" }[kind];
    setPendingDelete({
      kind,
      ids,
      label: `${ids.length} selected ${singular}${ids.length === 1 ? "" : "s"}`,
      bulk: true,
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { kind, id, ids, label, bulk } = pendingDelete;
    const singular = { incidents: "incident", students: "student", offenses: "offense" }[kind];
    setDeleting(true);
    try {
      const result = bulk
        ? await api(`/${kind}/bulk-delete`, {
          method: "POST",
          body: JSON.stringify({ ids: ids.map(Number) }),
        })
        : await api(`/${kind}/${id}`, { method: "DELETE" });
      setPendingDelete(null);
      if (bulk) {
        const includesEditedRecord = ids.some((recordId) => {
          const formId = { incidents: incidentForm.id, students: studentForm.id, offenses: offenseForm.id }[kind];
          return String(recordId) === String(formId);
        });
        if (kind === "incidents") setSelectedIncidentIds([]);
        if (kind === "students") setSelectedStudentIds([]);
        if (kind === "offenses") setSelectedOffenseIds([]);
        if (kind === "incidents" && includesEditedRecord) setIncidentForm(emptyIncident);
        if (kind === "students" && includesEditedRecord) {
          setStudentForm(emptyStudent);
        }
        if (kind === "offenses" && includesEditedRecord) setOffenseForm(emptyOffense);
      }
      await loadData();
      showNotification(
        "success",
        bulk ? `${kind[0].toUpperCase()}${kind.slice(1)} deleted` : "Record deleted",
        bulk
          ? `${result.deleted} ${singular} record${result.deleted === 1 ? " was" : "s were"} deleted successfully.`
          : `${label} was deleted successfully.`,
      );
    } catch (err) {
      setPendingDelete(null);
      showNotification("error", "Record was not deleted", err.message);
    } finally {
      setDeleting(false);
    }
  }

  const selectedOffense = useMemo(
    () => offenses.find((item) => String(item.id) === String(incidentForm.offense_id)),
    [incidentForm.offense_id, offenses],
  );

  useEffect(() => {
    if (selectedOffense && !incidentForm.action_taken) {
      setIncidentForm((current) => ({
        ...current,
        action_taken: selectedOffense.recommended_action,
      }));
    }
  }, [selectedOffense]);

  if (portalView) {
    return <StudentPortal onBack={() => setPortalView(false)} />;
  }

  if (!adminToken || !adminVerified) {
    return (
      <AdminLogin
        busy={checkingAdmin}
        onLogin={handleAdminLogin}
        onStudentPortal={() => setPortalView(true)}
      />
    );
  }

  const tabs = [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["incidents", ClipboardList, "Incidents"],
    ["students", Users, "Students"],
    ["offenses", ShieldAlert, "Offenses"],
    ["summary", FileText, "Student Summary"],
    ["reports", BarChart3, "Reports"],
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OT</div>
          <div>
            <strong>Offense Tracker</strong>
            <span>RTSagasaNHS</span>
          </div>
        </div>
        <nav>
          {tabs.map(([id, Icon, label]) => (
            <button
              key={id}
              className={activeTab === id ? "active" : ""}
              onClick={() => setActiveTab(id)}
              type="button"
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div className="page-heading">
            <span className="eyebrow">Student Discipline Records</span>
            <h1>Offense Tracker</h1>
            <p>Student discipline records, incident logging, offense catalog, and reports.</p>
          </div>
          <div className="topbar-actions">
            <button className="btn secondary" type="button" onClick={() => setPortalView(true)}>
              <LogIn size={18} /> Student Portal
            </button>
            <button className="btn danger-solid" type="button" onClick={logoutAdmin}>
              <LogOut size={18} /> Sign out
            </button>
            <button className="btn primary" type="button" onClick={loadData} disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : <CalendarDays size={18} />}
              {loading ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </header>

        {notification && (
          <NotificationBanner
            notification={notification}
            onClose={() => setNotification(null)}
          />
        )}
        {error && <div className="alert">{error}</div>}
        {loading && <div className="loading">Loading records...</div>}

        {!loading && activeTab === "dashboard" && <Dashboard dashboard={dashboard} />}
        {!loading && activeTab === "incidents" && (
          <Incidents
            incidents={incidents}
            students={students}
            offenses={offenses}
            form={incidentForm}
            setForm={setIncidentForm}
            onCancel={() => setIncidentForm(emptyIncident)}
            filters={filters}
            setFilters={setFilters}
            onSearch={loadData}
            onSubmit={saveIncident}
            saving={saving === "incident"}
            importing={importing === "incidents"}
            onImport={(file) => importWorkbook("incidents", file)}
            onEdit={(row) => setIncidentForm({
              id: row.id,
              incident_date: row.incident_date,
              student_id: row.student_id,
              offense_id: row.offense_id,
              action_taken: row.action_taken || "",
              status: row.status,
              reported_by: row.reported_by || "",
              notes: row.notes || "",
            })}
            onDelete={(id, label) => requestDelete("incidents", id, label)}
            selectedIds={selectedIncidentIds}
            onSelectionChange={setSelectedIncidentIds}
            onBulkDelete={(ids) => requestBulkDelete("incidents", ids)}
          />
        )}
        {!loading && activeTab === "students" && (
          <Students
            students={students}
            form={studentForm}
            setForm={setStudentForm}
            onCancel={() => setStudentForm(emptyStudent)}
            onSubmit={saveStudent}
            saving={saving === "student"}
            importing={importing === "students"}
            onImport={(file) => importWorkbook("students", file)}
            onEdit={(row) => setStudentForm(row)}
            onDelete={(id, label) => requestDelete("students", id, label)}
            selectedIds={selectedStudentIds}
            onSelectionChange={setSelectedStudentIds}
            onBulkDelete={(ids) => requestBulkDelete("students", ids)}
          />
        )}
        {!loading && activeTab === "offenses" && (
          <Offenses
            offenses={offenses}
            form={offenseForm}
            setForm={setOffenseForm}
            onCancel={() => setOffenseForm(emptyOffense)}
            onSubmit={saveOffense}
            saving={saving === "offense"}
            onEdit={(row) => setOffenseForm({ ...row, active: Boolean(row.active) })}
            onDelete={(id, label) => requestDelete("offenses", id, label)}
            selectedIds={selectedOffenseIds}
            onSelectionChange={setSelectedOffenseIds}
            onBulkDelete={(ids) => requestBulkDelete("offenses", ids)}
          />
        )}
        {!loading && activeTab === "summary" && (
          <StudentSummary studentSummary={studentSummary} />
        )}
        {!loading && activeTab === "reports" && (
          <Reports dashboard={dashboard} studentSummary={studentSummary} />
        )}
      </main>
      {pendingDelete && (
        <ConfirmDialog
          label={pendingDelete.label}
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
          confirmLabel={pendingDelete.bulk ? `Delete ${pendingDelete.kind}` : "Delete record"}
        />
      )}
    </div>
  );
}

function AdminLogin({ busy: checkingSession = false, onLogin, onStudentPortal }) {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const isBusy = busy || checkingSession;

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      const result = await api("/admin/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      setCredentials({ username: "", password: "" });
      onLogin(result.access_token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login-page">
      <section className="admin-login-card">
        <div className="brand login-brand">
          <div className="brand-mark">OT</div>
          <div>
            <strong>Offense Tracker</strong>
            <span>RTSagasaNHS</span>
          </div>
        </div>
        <div className="admin-login-copy">
          <span className="eyebrow">Admin access</span>
          <h1>Sign in to tracker</h1>
          <p>{checkingSession ? "Checking admin session..." : "Use your tracker administrator account."}</p>
        </div>
        {loginError && <div className="alert">{loginError}</div>}
        <form className="portal-login-form" onSubmit={login}>
          <label>Username<input autoComplete="username" required disabled={checkingSession} value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} /></label>
          <label>Password<input autoComplete="current-password" type="password" required disabled={checkingSession} value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label>
          <button className="btn primary" type="submit" disabled={isBusy}>
            {isBusy ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
            {checkingSession ? "Checking..." : busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <button className="btn secondary login-student-link" type="button" onClick={onStudentPortal} disabled={checkingSession}>
          <GraduationCap size={18} /> Student Portal
        </button>
      </section>
    </div>
  );
}

const PORTAL_TOKEN_KEY = "offense_tracker_student_portal_token";

function StudentPortal({ onBack }) {
  const [token, setToken] = useState(() => window.localStorage.getItem(PORTAL_TOKEN_KEY) || "");
  const [portalData, setPortalData] = useState(null);
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(Boolean(token));
  const [portalError, setPortalError] = useState("");

  const incidentColumns = useMemo(
    () => [
      { header: "Incident", accessorKey: "incident_no" },
      { header: "Date", accessorKey: "incident_date" },
      { header: "Code", accessorKey: "offense_code" },
      { header: "Offense", accessorKey: "offense_name" },
      {
        header: "Category",
        accessorKey: "category",
        cell: ({ getValue }) => <span className={`pill ${String(getValue()).toLowerCase()}`}>{getValue()}</span>,
      },
      { header: "Points", accessorKey: "severity_points" },
      { header: "Status", accessorKey: "status" },
      { header: "Action Taken", accessorFn: (row) => row.action_taken || "—" },
    ],
    [],
  );

  useEffect(() => {
    if (!token) {
      setBusy(false);
      setPortalData(null);
      return;
    }

    let active = true;
    setBusy(true);
    api("/student-portal/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((data) => {
        if (active) setPortalData(data);
      })
      .catch((err) => {
        if (!active) return;
        window.localStorage.removeItem(PORTAL_TOKEN_KEY);
        setToken("");
        setPortalError(err.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setPortalError("");
    try {
      const result = await api("/student-portal/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      window.localStorage.setItem(PORTAL_TOKEN_KEY, result.access_token);
      setToken(result.access_token);
      setCredentials({ username: "", password: "" });
    } catch (err) {
      setPortalError(err.message);
      setBusy(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(PORTAL_TOKEN_KEY);
    setToken("");
    setPortalData(null);
    setPortalError("");
  }

  if (!portalData) {
    return (
      <div className="portal-page">
        <header className="portal-header">
          <div className="brand portal-brand">
            <div className="brand-mark">OT</div>
            <div><strong>Student Portal</strong><span>RTSagasaNHS</span></div>
          </div>
          <button className="btn secondary" type="button" onClick={onBack}>Back to tracker</button>
        </header>
        <main className="portal-login-shell">
          <section className="portal-login-card">
            <div className="portal-login-icon"><GraduationCap size={30} /></div>
            <span className="eyebrow">Student access</span>
            <h1>View your offense records</h1>
            <p>Sign in using your Student ID and assigned password.</p>
            {portalError && <div className="alert">{portalError}</div>}
            <form className="portal-login-form" onSubmit={login}>
              <label>Student ID<input autoComplete="username" required value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} /></label>
              <label>Password<input autoComplete="current-password" type="password" required value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label>
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
                {busy ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  const { student, totals, incidents: portalIncidents } = portalData;
  const cards = [
    ["Total Incidents", totals.total_incidents, ClipboardList],
    ["Minor Incidents", totals.minor_incidents, BookOpen],
    ["Major Incidents", totals.major_incidents, AlertTriangle],
    ["Severity Points", totals.severity_points, ShieldAlert],
  ];

  return (
    <div className="portal-page">
      <header className="portal-header">
        <div className="brand portal-brand">
          <div className="brand-mark">OT</div>
          <div><strong>Student Portal</strong><span>RTSagasaNHS</span></div>
        </div>
        <div className="topbar-actions">
          <button className="btn secondary" type="button" onClick={onBack}>Back to tracker</button>
          <button className="btn danger-solid" type="button" onClick={logout}><LogOut size={18} /> Sign out</button>
        </div>
      </header>
      <main className="portal-content stack">
        <section className="portal-student-hero">
          <div>
            <span className="eyebrow">Student offense record</span>
            <h1>{fullName(student)}</h1>
            <p>{student.student_no} · Grade {student.grade}-{student.section} · Adviser: {student.adviser || "Not assigned"}</p>
          </div>
          <span className={`portal-status ${student.status.toLowerCase()}`}>{student.status}</span>
        </section>
        <div className="kpi-grid portal-kpis">
          {cards.map(([label, value, Icon]) => (
            <div className="kpi" key={label}>
              <div className="kpi-icon"><Icon size={20} /></div>
              <span>{label}</span>
              <strong>{value || 0}</strong>
            </div>
          ))}
        </div>
        <Panel title={`My Offense Records (${portalIncidents.length})`} icon={ClipboardList}>
          <DataTable data={portalIncidents} columns={incidentColumns} searchPlaceholder="Search my offense records" />
        </Panel>
      </main>
    </div>
  );
}

function Dashboard({ dashboard }) {
  const totals = dashboard?.totals || {};
  const monthly = dashboard?.monthly || [];
  const topOffenses = dashboard?.top_offenses || [];
  const topStudentColumns = useMemo(
    () => [
      { header: "Student", accessorFn: (row) => fullName(row) },
      { header: "Grade", accessorFn: (row) => `${row.grade}-${row.section}` },
      { header: "Incidents", accessorKey: "incident_count" },
      { header: "Points", accessorKey: "points" },
    ],
    [],
  );
  const cards = [
    ["Total Incidents", totals.total_incidents || 0, ClipboardList, "neutral"],
    ["Minor Incidents", totals.minor_incidents || 0, BookOpen, "minor"],
    ["Major Incidents", totals.major_incidents || 0, AlertTriangle, "major"],
    ["Active Students", totals.active_students || 0, GraduationCap, "neutral"],
    ["Students with Offenses", totals.students_with_incidents || 0, Users, "monitor"],
    ["Open Cases", totals.open_cases || 0, ShieldAlert, "major"],
  ];
  return (
    <section className="dashboard stack">
      <div className="kpi-grid dashboard-kpis">
        {cards.map(([label, value, Icon, tone]) => (
          <div className={`kpi ${tone}`} key={label}>
            <div className="kpi-icon"><Icon size={20} /></div>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="grid two dashboard-charts">
        <Panel title="Monthly Incident Trend" icon={BarChart3}>
          <IncidentLineChart data={monthly} />
        </Panel>
        <Panel title="Most Common Offenses" icon={BarChart3}>
          <OffenseBarChart data={topOffenses} />
        </Panel>
      </div>
      <Panel title="Top Students by Severity Points">
        <DataTable
          data={dashboard?.top_students || []}
          columns={topStudentColumns}
          searchPlaceholder="Search top students"
        />
      </Panel>
    </section>
  );
}

function BulkDeleteControls({ count, selectedIds, singularLabel, onDelete, onClear }) {
  return (
    <>
      <span className="selected-count">{count} selected</span>
      <button className="btn danger-solid" type="button" onClick={() => onDelete(selectedIds)}>
        <Trash2 size={17} />
        Delete selected
      </button>
      <button className="btn secondary" type="button" onClick={onClear}>
        Clear {singularLabel} selection
      </button>
    </>
  );
}

function StudentSearchPicker({ students, value, onChange }) {
  const selectedStudent = useMemo(
    () => students.find((student) => String(student.id) === String(value)),
    [students, value],
  );
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const keepTypedQuery = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (selectedStudent) {
      setQuery(studentOptionLabel(selectedStudent));
      keepTypedQuery.current = false;
      return;
    }
    if (!keepTypedQuery.current) {
      setQuery("");
    }
    keepTypedQuery.current = false;
  }, [selectedStudent, value]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(value ? "" : "Select a student from the results.");
  }, [value]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return students.slice(0, 8);
    return students
      .filter((student) => {
        const haystack = [
          student.student_no,
          student.first_name,
          student.last_name,
          `${student.grade}-${student.section}`,
          student.adviser,
        ].join(" ").toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 8);
  }, [query, students]);

  function selectStudent(student) {
    setQuery(studentOptionLabel(student));
    setFocused(false);
    onChange(String(student.id));
  }

  function updateQuery(event) {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    const exactMatch = students.find(
      (student) => studentOptionLabel(student).toLowerCase() === nextQuery.trim().toLowerCase(),
    );
    keepTypedQuery.current = true;
    onChange(exactMatch ? String(exactMatch.id) : "");
  }

  return (
    <label className="student-search-label">
      Student
      <div className="student-search">
        <Search className="student-search-icon" size={17} />
        <input
          ref={inputRef}
          required
          type="search"
          placeholder="Search name or student no."
          value={query}
          onChange={updateQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        />
        {focused && (
          <div className="student-search-results" role="listbox">
            {matches.length > 0 ? matches.map((student) => (
              <button
                key={student.id}
                type="button"
                role="option"
                aria-selected={String(student.id) === String(value)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectStudent(student)}
              >
                <strong>{student.student_no}</strong>
                <span>{fullName(student)} · Grade {student.grade}-{student.section}</span>
              </button>
            )) : (
              <div className="student-search-empty">No matching students</div>
            )}
          </div>
        )}
      </div>
    </label>
  );
}

function Incidents({
  incidents,
  students,
  offenses,
  form,
  setForm,
  onCancel,
  filters,
  setFilters,
  onSearch,
  onSubmit,
  saving,
  importing,
  onImport,
  onEdit,
  onDelete,
  selectedIds,
  onSelectionChange,
  onBulkDelete,
}) {
  const incidentColumns = useMemo(
    () => [
      { header: "ID", accessorKey: "incident_no" },
      { header: "Date", accessorKey: "incident_date" },
      {
        header: "Student",
        accessorFn: (row) => `${row.student_no} - ${row.first_name} ${row.last_name}`,
      },
      { header: "Grade", accessorFn: (row) => `${row.grade}-${row.section}` },
      { header: "Offense", accessorKey: "offense_name" },
      {
        header: "Category",
        accessorKey: "category",
        cell: ({ getValue }) => <span className={`pill ${String(getValue()).toLowerCase()}`}>{getValue()}</span>,
      },
      { header: "Status", accessorKey: "status" },
      {
        id: "actions",
        header: "",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <div className="row-actions">
            <button className="icon" type="button" onClick={() => onEdit(row.original)} title="Edit incident"><Pencil size={16} /></button>
            <button className="icon danger" type="button" onClick={() => onDelete(row.original.id, row.original.incident_no)} title="Delete incident"><Trash2 size={16} /></button>
          </div>
        ),
      },
    ],
    [onEdit, onDelete],
  );
  return (
    <section className="stack">
      <Panel title={form.id ? "Edit Incident" : "Log New Incident"} icon={Plus}>
        <form className="form-grid record-form" onSubmit={onSubmit}>
          {!form.id && (
            <ExcelImportCard
              title="Import incidents from Excel"
              description="Incident Date, Student No., and Offense Code are required. Optional: Action Taken, Status, Reported By, and Notes."
              busy={importing}
              onImport={onImport}
            />
          )}
          <label>Date<input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} /></label>
          <StudentSearchPicker
            students={students}
            value={form.student_id}
            onChange={(studentId) => setForm({ ...form, student_id: studentId })}
          />
          <label>Offense<select required value={form.offense_id} onChange={(e) => setForm({ ...form, offense_id: e.target.value, action_taken: "" })}>
            <option value="">Select offense</option>
            {offenses.filter((item) => item.active).map((offense) => <option key={offense.id} value={offense.id}>{offense.code} - {offense.name}</option>)}
          </select></label>
          <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {["Open", "Parent Notified", "Under Review", "Resolved"].map((item) => <option key={item}>{item}</option>)}
          </select></label>
          <label>Reported By<input value={form.reported_by} onChange={(e) => setForm({ ...form, reported_by: e.target.value })} /></label>
          <label className="wide">Action Taken<input value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} /></label>
          <label className="wide">Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
              {saving ? "Saving..." : `${form.id ? "Update" : "Save"} Incident`}
            </button>
            <button className="btn secondary" type="button" onClick={onCancel}><X size={18} /> Clear</button>
          </div>
        </form>
      </Panel>
      <Panel title="Incident Records">
        <div className="toolbar">
          <span className="toolbar-label"><Filter size={16} /> Filters</span>
          <div className="searchbox"><Search size={17} /><input placeholder="Search incidents" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
          <input type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} />
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option><option>Minor</option><option>Major</option></select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{["Open", "Parent Notified", "Under Review", "Resolved"].map((item) => <option key={item}>{item}</option>)}</select>
          <button className="btn primary" type="button" onClick={onSearch}>Apply</button>
        </div>
        <DataTable
          data={incidents}
          columns={incidentColumns}
          searchPlaceholder="Search visible incidents"
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          selectionLabel="incident"
          getSelectionLabel={(incident) => incident.incident_no}
          bulkActions={(count) => (
            <BulkDeleteControls
              count={count}
              selectedIds={selectedIds}
              singularLabel="incident"
              onDelete={onBulkDelete}
              onClear={() => onSelectionChange([])}
            />
          )}
        />
      </Panel>
    </section>
  );
}

function Students({
  students,
  form,
  setForm,
  onCancel,
  onSubmit,
  saving,
  importing,
  onImport,
  onEdit,
  onDelete,
  selectedIds,
  onSelectionChange,
  onBulkDelete,
}) {
  const studentColumns = useMemo(
    () => [
      { header: "Student No.", accessorKey: "student_no" },
      { header: "Name", accessorFn: (row) => fullName(row) },
      { header: "Grade", accessorKey: "grade" },
      { header: "Section", accessorKey: "section" },
      { header: "Adviser", accessorKey: "adviser" },
      { header: "Status", accessorKey: "status" },
      {
        id: "actions",
        header: "",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <div className="row-actions">
            <button className="icon" type="button" onClick={() => onEdit(row.original)} title="Edit student"><Pencil size={16} /></button>
            <button className="icon danger" type="button" onClick={() => onDelete(row.original.id, fullName(row.original))} title="Delete student"><Trash2 size={16} /></button>
          </div>
        ),
      },
    ],
    [onEdit, onDelete],
  );
  return (
    <section className="stack">
      <Panel title={form.id ? "Edit Student" : "Add Student"} icon={Plus}>
        <form className="form-grid record-form" onSubmit={onSubmit}>
          {!form.id && (
            <ExcelImportCard
              title="Import students from Excel"
              description="Student No., First Name, Last Name, Grade, and Section are required. Optional: Adviser and Status."
              busy={importing}
              onImport={onImport}
            />
          )}
          <div className="credential-hint">
            <KeyRound size={20} />
            <div>
              <strong>Student portal credentials</strong>
              <span>Username: Student ID · Password: Student ID + Last Name (spaces removed)</span>
            </div>
          </div>
          <label>Student No.<input required value={form.student_no} onChange={(e) => setForm({ ...form, student_no: e.target.value })} /></label>
          <label>First Name<input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
          <label>Last Name<input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
          <label>Grade<select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>{["7", "8", "9", "10", "11", "12"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Section<select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>{["A", "B", "C", "D"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Adviser<input value={form.adviser} onChange={(e) => setForm({ ...form, adviser: e.target.value })} /></label>
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
              {saving ? "Saving..." : `${form.id ? "Update" : "Save"} Student`}
            </button>
            <button className="btn secondary" type="button" onClick={onCancel}><X size={18} /> Clear</button>
          </div>
        </form>
      </Panel>
      <Panel title={`Students (${students.length})`}>
        <DataTable
          data={students}
          columns={studentColumns}
          searchPlaceholder="Search students"
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          selectionLabel="student"
          getSelectionLabel={fullName}
          bulkActions={(count) => (
            <BulkDeleteControls
              count={count}
              selectedIds={selectedIds}
              singularLabel="student"
              onDelete={onBulkDelete}
              onClear={() => onSelectionChange([])}
            />
          )}
        />
      </Panel>
    </section>
  );
}

function Offenses({
  offenses,
  form,
  setForm,
  onCancel,
  onSubmit,
  saving,
  onEdit,
  onDelete,
  selectedIds,
  onSelectionChange,
  onBulkDelete,
}) {
  const offenseColumns = useMemo(
    () => [
      { header: "Code", accessorKey: "code" },
      { header: "Offense", accessorKey: "name" },
      {
        header: "Category",
        accessorKey: "category",
        cell: ({ getValue }) => <span className={`pill ${String(getValue()).toLowerCase()}`}>{getValue()}</span>,
      },
      { header: "Points", accessorKey: "severity_points" },
      { header: "Recommended Action", accessorKey: "recommended_action" },
      {
        id: "actions",
        header: "",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <div className="row-actions">
            <button className="icon" type="button" onClick={() => onEdit(row.original)} title="Edit offense"><Pencil size={16} /></button>
            <button className="icon danger" type="button" onClick={() => onDelete(row.original.id, row.original.name)} title="Delete offense"><Trash2 size={16} /></button>
          </div>
        ),
      },
    ],
    [onEdit, onDelete],
  );
  return (
    <section className="stack">
      <Panel title={form.id ? "Edit Offense" : "Add Offense"} icon={Plus}>
        <form className="form-grid record-form" onSubmit={onSubmit}>
          <label>Code<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label>Offense Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Minor</option><option>Major</option></select></label>
          <label>Severity Points<input type="number" min="1" max="10" value={form.severity_points} onChange={(e) => setForm({ ...form, severity_points: Number(e.target.value) })} /></label>
          <label className="wide">Recommended Action<input value={form.recommended_action} onChange={(e) => setForm({ ...form, recommended_action: e.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
              {saving ? "Saving..." : `${form.id ? "Update" : "Save"} Offense`}
            </button>
            <button className="btn secondary" type="button" onClick={onCancel}><X size={18} /> Clear</button>
          </div>
        </form>
      </Panel>
      <Panel title="Offense Catalog">
        <DataTable
          data={offenses}
          columns={offenseColumns}
          searchPlaceholder="Search offenses"
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          selectionLabel="offense"
          getSelectionLabel={(offense) => `${offense.code} - ${offense.name}`}
          bulkActions={(count) => (
            <BulkDeleteControls
              count={count}
              selectedIds={selectedIds}
              singularLabel="offense"
              onDelete={onBulkDelete}
              onClear={() => onSelectionChange([])}
            />
          )}
        />
      </Panel>
    </section>
  );
}

function StudentSummary({ studentSummary }) {
  const [risk, setRisk] = useState("");
  const [grade, setGrade] = useState("");
  const summaryColumns = useMemo(
    () => [
      { header: "Student No.", accessorKey: "student_no" },
      { header: "Name", accessorFn: (row) => fullName(row) },
      { header: "Grade", accessorFn: (row) => `${row.grade}-${row.section}` },
      { header: "Total", accessorKey: "total_offenses" },
      { header: "Minor", accessorFn: (row) => row.minor_offenses || 0 },
      { header: "Major", accessorFn: (row) => row.major_offenses || 0 },
      { header: "Points", accessorKey: "severity_points" },
      { header: "Last Incident", accessorFn: (row) => row.last_incident_date || "" },
      {
        header: "Risk",
        accessorKey: "risk_band",
        cell: ({ getValue }) => <span className={`risk ${String(getValue()).toLowerCase()}`}>{getValue()}</span>,
      },
    ],
    [],
  );
  const filtered = studentSummary.filter((row) => {
    const matchesRisk = !risk || row.risk_band === risk;
    const matchesGrade = !grade || row.grade === grade;
    return matchesRisk && matchesGrade;
  });
  const counts = {
    high: studentSummary.filter((row) => row.risk_band === "High").length,
    monitor: studentSummary.filter((row) => row.risk_band === "Monitor").length,
    low: studentSummary.filter((row) => row.risk_band === "Low").length,
  };

  return (
    <section className="stack">
      <div className="summary-hero">
        <div>
          <span className="eyebrow">Student Offense Summary</span>
          <h2>Risk-ranked view of student offense history</h2>
        </div>
        <div className="summary-chips">
          <span><AlertTriangle size={16} /> {counts.high} High</span>
          <span><ShieldAlert size={16} /> {counts.monitor} Monitor</span>
          <span><CheckCircle2 size={16} /> {counts.low} Low</span>
        </div>
      </div>
      <Panel title="Summary Filters" icon={Filter}>
        <div className="toolbar summary-toolbar">
          <select value={risk} onChange={(e) => setRisk(e.target.value)}><option value="">All risk bands</option>{["High", "Monitor", "Low", "None"].map((item) => <option key={item}>{item}</option>)}</select>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">All grades</option>{["7", "8", "9", "10", "11", "12"].map((item) => <option key={item}>{item}</option>)}</select>
          <button className="btn secondary" type="button" onClick={() => { setRisk(""); setGrade(""); }}><X size={17} /> Reset</button>
        </div>
      </Panel>
      <Panel title={`Student Offense Summary (${filtered.length})`}>
        <DataTable data={filtered} columns={summaryColumns} searchPlaceholder="Search student summary" />
      </Panel>
    </section>
  );
}

function Reports({ dashboard }) {
  return (
    <section className="stack">
      <div className="grid two">
        <Panel title="Minor vs. Major Incidents" icon={BarChart3}>
          <CategoryBarChart data={dashboard?.monthly || []} />
        </Panel>
        <Panel title="Monthly Severity Points" icon={BarChart3}>
          <SeverityLineChart data={dashboard?.monthly || []} />
        </Panel>
      </div>
    </section>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="panel">
      <div className="panel-title">{Icon && <Icon size={18} />}<h2>{title}</h2></div>
      {children}
    </section>
  );
}

function ExcelImportCard({ title, description, busy, onImport }) {
  const inputRef = useRef(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    await onImport(file);
    event.target.value = "";
  }

  return (
    <div className="excel-import">
      <span className="excel-import-icon"><FileSpreadsheet size={23} /></span>
      <div className="excel-import-copy">
        <strong>{title}</strong>
        <span>{description} The first worksheet will be used.</span>
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleFile}
        tabIndex="-1"
      />
      <button
        className="btn excel-btn"
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />}
        {busy ? "Importing..." : "Choose Excel file"}
      </button>
    </div>
  );
}

function NotificationBanner({ notification, onClose }) {
  const isSuccess = notification.type === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`notification-banner ${notification.type}`} role={isSuccess ? "status" : "alert"} aria-live="polite">
      <span className="notification-icon"><Icon size={21} /></span>
      <div>
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss notification"><X size={18} /></button>
    </div>
  );
}

function ConfirmDialog({ label, busy, onCancel, onConfirm, confirmLabel = "Delete record" }) {
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, onCancel]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
        <div className="dialog-icon"><Trash2 size={24} /></div>
        <div className="dialog-copy">
          <span className="eyebrow">Delete record</span>
          <h2 id="delete-title">Are you sure?</h2>
          <p id="delete-description">
            You’re about to delete <strong>{label}</strong>. This action cannot be undone.
          </p>
        </div>
        <div className="dialog-actions">
          <button className="btn secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn danger-solid" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <Trash2 size={18} />}
            {busy ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TableWrap({ children }) {
  return <div className="table-wrap">{children}</div>;
}

function SelectionCheckbox({ indeterminate = false, ...props }) {
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return <input ref={checkboxRef} className="selection-checkbox" type="checkbox" {...props} />;
}

function SelectAllCheckbox({ table, selectionLabel }) {
  const filteredRows = table.getFilteredRowModel().flatRows;
  const selectedCount = filteredRows.filter((row) => row.getIsSelected()).length;
  const allSelected = filteredRows.length > 0 && selectedCount === filteredRows.length;

  function toggleFilteredRows(event) {
    const checked = event.target.checked;
    table.setRowSelection((current) => {
      const next = { ...current };
      filteredRows.forEach((row) => {
        if (checked) next[row.id] = true;
        else delete next[row.id];
      });
      return next;
    });
  }

  return (
    <SelectionCheckbox
      aria-label={`Select all visible ${selectionLabel} records`}
      checked={allSelected}
      indeterminate={selectedCount > 0 && !allSelected}
      onChange={toggleFilteredRows}
    />
  );
}

function DataTable({
  data,
  columns,
  searchPlaceholder = "Search table",
  selectedIds,
  onSelectionChange,
  bulkActions,
  selectionLabel = "record",
  getSelectionLabel,
}) {
  const pageSize = 10;
  const [globalFilter, setGlobalFilter] = useState("");
  const selectable = Array.isArray(selectedIds) && Boolean(onSelectionChange);
  const rowSelection = useMemo(
    () => Object.fromEntries((selectedIds || []).map((id) => [String(id), true])),
    [selectedIds],
  );
  const tableColumns = useMemo(() => {
    if (!selectable) return columns;
    return [
      {
        id: "select",
        header: ({ table: currentTable }) => (
          <SelectAllCheckbox table={currentTable} selectionLabel={selectionLabel} />
        ),
        cell: ({ row }) => (
          <SelectionCheckbox
            aria-label={`Select ${getSelectionLabel?.(row.original) || `${selectionLabel} ${row.original.id}`}`}
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            indeterminate={row.getIsSomeSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableGlobalFilter: false,
      },
      ...columns,
    ];
  }, [columns, getSelectionLabel, selectable, selectionLabel]);
  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { globalFilter, ...(selectable ? { rowSelection } : {}) },
    initialState: { pagination: { pageSize } },
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: selectable
      ? (updater) => {
        const next = typeof updater === "function" ? updater(rowSelection) : updater;
        onSelectionChange(Object.keys(next).filter((id) => next[id]));
      }
      : undefined,
    getRowId: selectable ? (row) => String(row.id) : undefined,
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });
  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const firstRow = filteredCount ? pageIndex * pageSize + 1 : 0;
  const lastRow = Math.min((pageIndex + 1) * pageSize, filteredCount);

  return (
    <div className="data-table">
      <div className="data-table-toolbar">
        <div className="searchbox data-table-search">
          <Search size={17} />
          <input
            placeholder={searchPlaceholder}
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
          />
        </div>
        <span className="table-count">
          {firstRow}–{lastRow} of {filteredCount} <i>·</i> 10 rows per page
        </span>
      </div>
      {selectable && selectedIds.length > 0 && (
        <div className="bulk-action-bar">{bulkActions(selectedIds.length)}</div>
      )}
      <TableWrap>
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
            {!table.getRowModel().rows.length && (
              <tr>
                <td className="empty-cell" colSpan={tableColumns.length}>No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
      <div className="pagination">
        <button className="btn secondary" type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </button>
        <span>
          Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
        </span>
        <button className="btn secondary" type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </button>
      </div>
    </div>
  );
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function chartData(rows) {
  return rows.map((row) => ({
    ...row,
    label: monthNames[Math.max(0, Number(String(row.month).slice(5, 7)) - 1)] || row.month,
  }));
}

const chartTooltipStyle = {
  border: "1px solid #eedbd3",
  borderRadius: 12,
  boxShadow: "0 14px 34px rgba(84, 34, 22, 0.12)",
  color: "#2b1715",
};

function EmptyChart() {
  return (
    <div className="chart-empty">
      <BarChart3 size={26} />
      <strong>No chart data yet</strong>
      <span>Incident activity will appear here once records are available.</span>
    </div>
  );
}

function IncidentLineChart({ data }) {
  const rows = chartData(data);
  if (!rows.length) return <EmptyChart />;

  return (
    <div className="chart-area" role="img" aria-label="Line chart showing monthly total incidents">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 18, left: -12, bottom: 4 }} accessibilityLayer>
          <CartesianGrid stroke="#f1dfd7" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#765e58", fontSize: 12 }} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#765e58", fontSize: 12 }} />
          <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: "#f97316", strokeDasharray: "4 4" }} />
          <Line
            type="monotone"
            dataKey="total"
            name="Incidents"
            stroke="#b42318"
            strokeWidth={3}
            dot={{ fill: "#fbbf24", stroke: "#b42318", strokeWidth: 2, r: 4 }}
            activeDot={{ fill: "#ffffff", stroke: "#f97316", strokeWidth: 3, r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function OffenseBarChart({ data }) {
  const rows = data.slice(0, 5);
  if (!rows.length) return <EmptyChart />;
  const maxCount = Math.max(...rows.map((row) => Number(row.incident_count) || 0), 1);

  return (
    <div className="offense-rank-list" role="list" aria-label="Most common offenses">
      {rows.map((row, index) => {
        const count = Number(row.incident_count) || 0;
        const width = `${Math.max(8, Math.round((count / maxCount) * 100))}%`;
        return (
          <div className="offense-rank-row" role="listitem" key={`${row.name}-${index}`}>
            <div className="offense-rank-meta">
              <span className="rank-number">{index + 1}</span>
              <strong title={row.name}>{row.name}</strong>
              <em>{count} incident{count === 1 ? "" : "s"}</em>
            </div>
            <div className="offense-rank-track" aria-hidden="true">
              <span style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBarChart({ data }) {
  const rows = chartData(data);
  if (!rows.length) return <EmptyChart />;

  return (
    <div className="chart-area" role="img" aria-label="Grouped bar graph comparing monthly minor and major incidents">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={rows} margin={{ top: 12, right: 18, left: -12, bottom: 4 }} accessibilityLayer>
          <CartesianGrid stroke="#f1dfd7" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#765e58", fontSize: 12 }} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#765e58", fontSize: 12 }} />
          <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "#fff8f3" }} />
          <Legend iconType="circle" wrapperStyle={{ color: "#563d38", fontSize: 12 }} />
          <Bar dataKey="minor" name="Minor" fill="#fbbf24" radius={[6, 6, 0, 0]} maxBarSize={26} />
          <Bar dataKey="major" name="Major" fill="#b42318" radius={[6, 6, 0, 0]} maxBarSize={26} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SeverityLineChart({ data }) {
  const rows = chartData(data);
  if (!rows.length) return <EmptyChart />;

  return (
    <div className="chart-area" role="img" aria-label="Line chart showing monthly severity points">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 18, left: -6, bottom: 4 }} accessibilityLayer>
          <CartesianGrid stroke="#f1dfd7" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#765e58", fontSize: 12 }} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#765e58", fontSize: 12 }} />
          <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: "#f97316", strokeDasharray: "4 4" }} />
          <Line
            type="monotone"
            dataKey="points"
            name="Severity points"
            stroke="#f97316"
            strokeWidth={3}
            dot={{ fill: "#ffffff", stroke: "#f97316", strokeWidth: 2, r: 4 }}
            activeDot={{ fill: "#fbbf24", stroke: "#b42318", strokeWidth: 2, r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
