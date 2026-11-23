/**
 * Preview mode (?preview=1[&role=manager]): the panel works on demo data from
 * mocks/ without a server, for design review. Everything preview-specific starts here.
 */
import { initialData } from "../../mocks/demoData";

const params = () => new URLSearchParams(location.search);

export const isPreview = () => params().get("preview") === "1";
export const previewRole = () => (params().get("role") === "manager" ? "manager" : "admin");

export function previewUser() {
  return initialData().users[previewRole() === "manager" ? 1 : 0];
}

/** Demo data, kept in sessionStorage so edits survive a page reload. */
export function previewData() {
  try {
    return (
      JSON.parse(sessionStorage.getItem("warego-preview") || "null") ||
      (() => {
        const seed = initialData();
        if (previewRole() === "manager")
          seed.notifications = seed.notifications.filter(
            (n) => n.target !== "requests",
          );
        return seed;
      })()
    );
  } catch {
    return initialData();
  }
}

export function savePreviewData(data) {
  sessionStorage.setItem("warego-preview", JSON.stringify(data));
}
