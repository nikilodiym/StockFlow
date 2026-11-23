/** Effective role of a user: staff = admin, otherwise the warehouse role. */
export const roleOf = (u) =>
  u?.is_staff ? "admin" : u?.role || u?.memberships?.[0]?.role || "worker";
