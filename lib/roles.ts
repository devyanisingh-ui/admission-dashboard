/** Phase 1 roles, the permission catalogue and the role → permission matrix (spec §10). */

export type RoleId =
  | "counsellor"
  | "locHead"
  | "principal"
  | "verticalHead"
  | "leadership"
  | "centralAdmin"
  | "sysAdmin";

export interface RoleDef {
  id: RoleId;
  label: string;
  /** Compact name for table headers. */
  short: string;
  higherEd: string;
  scope: "location" | "vertical" | "all" | "system";
}

export const ROLES: RoleDef[] = [
  { id: "counsellor", short: "Counsellor", label: "Admissions Counsellor", higherEd: "Admissions Counsellor", scope: "location" },
  { id: "locHead", short: "Location Head", label: "Location Admissions Head", higherEd: "Campus Admissions Head", scope: "location" },
  { id: "principal", short: "Principal", label: "Principal / Head of Institution", higherEd: "Director / Dean", scope: "location" },
  { id: "verticalHead", short: "Vertical Head", label: "Vertical Admissions Head", higherEd: "Head of Admissions – Higher Ed", scope: "vertical" },
  { id: "leadership", short: "Leadership", label: "Group Leadership", higherEd: "—", scope: "all" },
  { id: "centralAdmin", short: "Central Admin", label: "Central Admin / Support", higherEd: "Same team", scope: "all" },
  { id: "sysAdmin", short: "System Admin", label: "System Administrator (IT)", higherEd: "Same", scope: "system" },
];

export const roleLabel = (id: RoleId | string) => ROLES.find((r) => r.id === id)?.label ?? id;

export type Permission =
  | "view.group"
  | "view.marketing"
  | "view.location"
  | "view.systems"
  | "view.planning"
  | "seat.edit"
  | "seat.requestChange"
  | "seat.approve"
  | "targets.edit"
  | "marketing.edit"
  | "view.masters"
  | "status.edit"
  | "status.approve"
  | "locationMaster.edit"
  | "calendar.edit"
  | "view.reports"
  | "export"
  | "pii"
  | "pii.onDemand"
  | "view.admin"
  | "users.edit"
  | "users.request"
  | "sync.run"
  | "view.sync"
  | "view.audit";

const ALL_BUT_SYS: RoleId[] = ["counsellor", "locHead", "principal", "verticalHead", "leadership", "centralAdmin"];

/** Who holds what, by role. */
export type PermissionMatrix = Record<Permission, RoleId[]>;

/** The Phase 1 matrix from the spec (§10.2). The System Administrator can change it on the Administration page. */
export const DEFAULT_MATRIX: PermissionMatrix = {
  "view.group": ["verticalHead", "leadership", "centralAdmin"],
  "view.marketing": ["locHead", "principal", "verticalHead", "leadership", "centralAdmin"],
  "view.location": ALL_BUT_SYS,
  "view.systems": ALL_BUT_SYS,
  "view.planning": ["locHead", "principal", "verticalHead", "leadership", "centralAdmin"],
  "seat.edit": ["locHead", "centralAdmin"],
  "seat.requestChange": ["locHead"],
  "seat.approve": ["verticalHead"],
  "targets.edit": ["verticalHead", "centralAdmin"],
  /** Enter budget, spend, social media and partner figures. */
  "marketing.edit": ["locHead", "centralAdmin"],
  "view.masters": ["verticalHead", "centralAdmin", "sysAdmin"],
  "status.edit": ["centralAdmin"],
  "status.approve": ["verticalHead"],
  "locationMaster.edit": ["centralAdmin", "sysAdmin"],
  "calendar.edit": ["centralAdmin", "sysAdmin"],
  "view.reports": ALL_BUT_SYS,
  export: ["locHead", "principal", "verticalHead", "leadership", "centralAdmin"],
  pii: ["counsellor", "locHead", "principal", "verticalHead", "centralAdmin"],
  "pii.onDemand": ["leadership"],
  "view.admin": ["locHead", "verticalHead", "centralAdmin", "sysAdmin"],
  "users.edit": ["sysAdmin"],
  "users.request": ["centralAdmin"],
  "sync.run": ["sysAdmin"],
  "view.sync": ["centralAdmin", "sysAdmin"],
  "view.audit": ["locHead", "verticalHead", "centralAdmin", "sysAdmin"],
};

export const can = (role: RoleId, p: Permission, matrix: PermissionMatrix = DEFAULT_MATRIX) => (matrix[p] ?? DEFAULT_MATRIX[p]).includes(role);

/* ------------------------------------------------------------------ */
/* Permission catalogue                                                */
/* ------------------------------------------------------------------ */

export type PermissionGroup = "Dashboards & reports" | "Seat Matrix & targets" | "Marketing data" | "Masters" | "Data & privacy" | "Administration";

export interface PermissionDef {
  id: Permission;
  label: string;
  description: string;
  group: PermissionGroup;
  /** Must also be held: an action needs the screen it lives on. */
  requires?: Permission[];
  /** Cannot be held together; granting one removes the other. */
  excludes?: Permission[];
  /** Grants access to personal data, other people's accounts or live integrations. */
  sensitive?: boolean;
}

export const PERMISSION_GROUPS: PermissionGroup[] = ["Dashboards & reports", "Seat Matrix & targets", "Marketing data", "Masters", "Data & privacy", "Administration"];

export const PERMISSIONS: PermissionDef[] = [
  { id: "view.location", group: "Dashboards & reports", label: "View location dashboards", description: "Dashboard, Drill-down, Grade-wise reports, Withdrawals and Alerts for the role's own scope" },
  { id: "view.group", group: "Dashboards & reports", label: "View group performance", description: "Cross-location comparison and the school leaderboard", requires: ["view.location"] },
  { id: "view.marketing", group: "Dashboards & reports", label: "View marketing reports", description: "Budget & Outreach and Social Media reports" },
  { id: "view.systems", group: "Dashboards & reports", label: "View source-system data", description: "System Views: records as held in LeadSquared, SaaS and FABS" },
  { id: "view.reports", group: "Dashboards & reports", label: "Open the Download Centre", description: "Standard report packs for the role's scope" },
  { id: "export", group: "Dashboards & reports", label: "Export to CSV / Excel", description: "Download buttons on tables and widgets across the dashboard" },

  { id: "view.planning", group: "Seat Matrix & targets", label: "View Seat Matrix & targets", description: "Seat Matrix, admission targets and their change history" },
  { id: "seat.edit", group: "Seat Matrix & targets", label: "Create and edit Seat Matrix", description: "Create, edit, add/remove rows and delete matrices while a cycle is in setup", requires: ["view.planning"] },
  { id: "seat.requestChange", group: "Seat Matrix & targets", label: "Request Seat Matrix changes", description: "Propose changes once a cycle has started and its matrix is locked", requires: ["view.planning"] },
  { id: "seat.approve", group: "Seat Matrix & targets", label: "Approve Seat Matrix changes", description: "Approve or reject change requests on locked matrices", requires: ["view.planning"] },
  { id: "targets.edit", group: "Seat Matrix & targets", label: "Set admission targets", description: "Enter and change grade-wise admission targets", requires: ["view.planning"] },

  { id: "marketing.edit", group: "Marketing data", label: "Enter marketing figures", description: "Budget, spend, social media and partner figures", requires: ["view.marketing"] },

  { id: "view.masters", group: "Masters", label: "View masters", description: "Locations, grades, sources, reasons, status mapping and the cycle calendar" },
  { id: "locationMaster.edit", group: "Masters", label: "Edit locations and grades", description: "Add, rename, deactivate or delete locations, grades and programmes", requires: ["view.masters"] },
  { id: "calendar.edit", group: "Masters", label: "Edit the cycle calendar", description: "Open, lock and close admission cycles", requires: ["view.masters"] },
  { id: "status.edit", group: "Masters", label: "Propose status mapping", description: "Map source-system statuses to dashboard stages (needs approval)", requires: ["view.masters"] },
  { id: "status.approve", group: "Masters", label: "Approve status mapping", description: "Approve or reject proposed status mappings", requires: ["view.masters"] },

  { id: "pii", group: "Data & privacy", label: "See personal data", description: "Student and parent names, phone numbers and email addresses shown in full", sensitive: true, excludes: ["pii.onDemand"] },
  { id: "pii.onDemand", group: "Data & privacy", label: "Reveal personal data on demand", description: "Personal data is masked; each reveal is one click and audit-logged", sensitive: true, excludes: ["pii"] },

  { id: "view.admin", group: "Administration", label: "Open Administration", description: "The Administration page (each tab needs its own permission below)" },
  { id: "view.audit", group: "Administration", label: "View the audit log", description: "Who changed what, when — limited to the role's own scope", requires: ["view.admin"] },
  { id: "users.request", group: "Administration", label: "Request user and role changes", description: "View users and roles and raise change requests to the System Administrator", requires: ["view.admin"] },
  { id: "users.edit", group: "Administration", label: "Manage users and permissions", description: "Add and edit users, assign roles and change this permission matrix", requires: ["view.admin"], sensitive: true },
  { id: "view.sync", group: "Administration", label: "View sync status", description: "Data-source health and sync run history", requires: ["view.admin"] },
  { id: "sync.run", group: "Administration", label: "Run and configure sync", description: "Trigger manual syncs and change integration settings", requires: ["view.sync"], sensitive: true },
];

export const permissionDef = (p: Permission) => PERMISSIONS.find((d) => d.id === p)!;

/** Cells that cannot be switched off, so nobody can lock themselves out of managing permissions. */
export const LOCKED_GRANTS: { role: RoleId; perm: Permission; reason: string }[] = [
  { role: "sysAdmin", perm: "view.admin", reason: "The System Administrator always keeps access to Administration" },
  { role: "sysAdmin", perm: "users.edit", reason: "The System Administrator always keeps the right to manage permissions" },
];
export const lockedReason = (role: RoleId, p: Permission) => LOCKED_GRANTS.find((l) => l.role === role && l.perm === p)?.reason;

export interface GrantResult {
  matrix: PermissionMatrix;
  /** Other permissions switched on or off for the same role to keep the matrix consistent. */
  alsoGranted: Permission[];
  alsoRevoked: Permission[];
}

/**
 * Switches one permission for one role, keeping the matrix consistent:
 * granting also grants what it requires (and drops what it excludes); revoking also revokes whatever depends on it.
 * Locked grants are never revoked.
 */
export function setGrant(matrix: PermissionMatrix, role: RoleId, perm: Permission, on: boolean): GrantResult {
  const next = Object.fromEntries(Object.entries(matrix).map(([k, v]) => [k, [...v]])) as PermissionMatrix;
  const alsoGranted: Permission[] = [];
  const alsoRevoked: Permission[] = [];
  const has = (p: Permission) => next[p].includes(role);
  const grant = (p: Permission, primary: boolean) => {
    if (has(p)) return;
    next[p].push(role);
    if (!primary) alsoGranted.push(p);
    const d = permissionDef(p);
    d.excludes?.forEach((x) => revoke(x, false));
    d.requires?.forEach((r) => grant(r, false));
  };
  const revoke = (p: Permission, primary: boolean) => {
    if (!has(p) || lockedReason(role, p)) return;
    next[p] = next[p].filter((r) => r !== role);
    if (!primary) alsoRevoked.push(p);
    PERMISSIONS.filter((d) => d.requires?.includes(p)).forEach((d) => revoke(d.id, false));
  };
  if (on) grant(perm, true);
  else revoke(perm, true);
  return { matrix: next, alsoGranted, alsoRevoked };
}

export interface GrantChange { role: RoleId; perm: Permission; on: boolean }

/** Every role × permission cell that differs between two matrices. */
export function matrixChanges(from: PermissionMatrix, to: PermissionMatrix): GrantChange[] {
  const out: GrantChange[] = [];
  for (const d of PERMISSIONS)
    for (const r of ROLES) {
      const a = from[d.id].includes(r.id), b = to[d.id].includes(r.id);
      if (a !== b) out.push({ role: r.id, perm: d.id, on: b });
    }
  return out;
}

/* ------------------------------------------------------------------ */
/* Saved matrix                                                        */
/* ------------------------------------------------------------------ */

export const PERMISSIONS_KEY = "role-permissions-v1";

export interface PermissionLogEntry { id: string; at: string; who: string; summary: string; changes: GrantChange[] }
export interface PermissionStore { matrix: PermissionMatrix; log: PermissionLogEntry[] }

export const defaultPermissionStore = (): PermissionStore => ({ matrix: DEFAULT_MATRIX, log: [] });

/** Reads a saved store: unknown roles and permissions are dropped, permissions added since fall back to the default. */
export function revivePermissions(raw: unknown): PermissionStore | null {
  const s = raw as Partial<PermissionStore> | null;
  if (!s || typeof s.matrix !== "object" || !s.matrix) return null;
  const ids = new Set(ROLES.map((r) => r.id));
  const saved = s.matrix as Partial<Record<string, unknown>>;
  const matrix = Object.fromEntries(
    PERMISSIONS.map((d) => {
      const v = saved[d.id];
      const roles = Array.isArray(v) ? (v.filter((r) => ids.has(r as RoleId)) as RoleId[]) : DEFAULT_MATRIX[d.id];
      return [d.id, roles];
    }),
  ) as PermissionMatrix;
  for (const l of LOCKED_GRANTS) if (!matrix[l.perm].includes(l.role)) matrix[l.perm].push(l.role);
  return { matrix, log: Array.isArray(s.log) ? s.log : [] };
}
