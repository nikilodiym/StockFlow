/** Number, date and name formatting (uk-UA). */
export const fmt = (n) =>
  new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(
    Number(n) || 0,
  );
export const initials = (n) =>
  (n || "Користувач")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
export const dateParts = (d) => {
  if (!d) return ["—", ""];
  const v = new Date(d);
  return [
    v.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" }),
    v.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }),
  ];
};
