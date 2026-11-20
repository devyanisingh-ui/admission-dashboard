/** Phase 1 roles and permission matrix (spec §10). */

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
  higherEd: string;
  scope: "location" | "vertical" | "all" | "system";
}

export const ROLES: RoleDef[] = [
  { id: "counsellor", label: "Admissions Counsellor", higherEd: "Admissions Counsellor", scope: "location" },
  { id: "locHead", label: "Location Admissions Head", higherEd: "Campus Admissions Head", scope: "location" },
  { id: "principal", label: "Principal / Head of Institution", higherEd: "Director / Dean", scope: "location" },
  { id: "verticalHead", label: "Vertical Admissions Head", higherEd: "Head of Admissions – Higher Ed", scope: "vertical" },
  { id: "leadership", label: "Group Leadership", higherEd: "—", scope: "all" },
  { id: "centralAdmin", label: "Central Admin / Support", higherEd: "Same team", scope: "all" },
  { id: "sysAdmin", label: "System Administrator (IT)", higherEd: "Same", scope: "system" },
];

export const roleLabel = (id: RoleId | string) => ROLES.find((r) => r.id === id)?.label ?? id;

export type Permission =
  | "view.group"
  | "view.marketing"
  | "view.location"
  | "view.systems"
  | "view.mapping"
  | "mapping.act"
  | "mapping.override"
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

const MATRIX: Record<Permission, RoleId[]> = {
  "view.group": ["verticalHead", "leadership", "centralAdmin"],
  "view.marketing": ["locHead", "principal", "verticalHead", "leadership", "centralAdmin"],
  "view.location": ALL_BUT_SYS,
  "view.systems": ALL_BUT_SYS,
  "view.mapping": ["counsellor", "locHead", "principal", "verticalHead", "centralAdmin"],
  "mapping.act": ["counsellor", "locHead", "centralAdmin"],
  "mapping.override": ["locHead", "verticalHead", "centralAdmin"],
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

export const can = (role: RoleId, p: Permission) => MATRIX[p].includes(role);
