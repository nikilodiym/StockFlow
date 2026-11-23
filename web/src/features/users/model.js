/** Users helpers: form values and the temporary password for new accounts. */
import { roleOf } from "../../shared/lib/roles";

export function userFormValues(user, data) {
  return user
    ? {
        ...user,
        role: roleOf(user),
        warehouse: user.warehouse || user.memberships?.[0]?.warehouse || "",
      }
    : {
        name: "",
        email: "",
        role: "worker",
        warehouse: data.warehouses[0]?.id || "",
      };
}

/** Random temporary password shown once to the admin (no ambiguous characters). */
export function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@";
  return (
    "Wg!" +
    Array.from(
      crypto.getRandomValues(new Uint8Array(13)),
      (b) => alphabet[b % alphabet.length],
    ).join("")
  );
}
